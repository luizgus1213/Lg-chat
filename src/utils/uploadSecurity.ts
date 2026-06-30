import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp = require("sharp");
import { AppError } from "../errors/AppError";
import { logger } from "./logger";

const PUBLIC_ROOT = path.resolve("public");

const MB = 1024 * 1024;

const LIMITS = {
  avatar: 5 * MB,
  chatImage: 8 * MB,
  chatVideo: 50 * MB,
  chatAudio: 15 * MB,
  chatDocument: 25 * MB,
  statusImage: 8 * MB,
  statusVideo: 30 * MB,
};

export type ProcessedUpload = {
  filePath: string;
  mediaUrl: string;
  mediaMimeType: string;
  mediaSize: number;
  mediaOriginalName: string;
};

function sanitizeOriginalName(originalName?: string | null) {
  const baseName = path.basename(String(originalName || "arquivo"));

  const clean = baseName
    .normalize("NFKD")
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return clean || "arquivo";
}

function getPublicUrl(filePath: string) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(PUBLIC_ROOT, resolved).replace(/\\/g, "/");

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError(
      500,
      "Arquivo processado fora da pasta pública.",
      "INVALID_UPLOAD_PUBLIC_PATH",
    );
  }

  return `/${relative}`;
}

export async function removeUploadedFile(filePath?: string | null) {
  if (!filePath) return;

  await fs.unlink(filePath).catch(() => undefined);
}

function assertMaxSize(file: Express.Multer.File, maxBytes: number, message: string, code: string) {
  if (file.size > maxBytes) {
    throw new AppError(413, message, code);
  }
}

function isImage(mimetype: string) {
  return mimetype.startsWith("image/");
}

function isVideo(mimetype: string) {
  return mimetype.startsWith("video/");
}

function isAudio(mimetype: string) {
  return mimetype.startsWith("audio/");
}

function isAnimatedOrGif(file: Express.Multer.File) {
  return file.mimetype === "image/gif" || file.originalname.toLowerCase().endsWith(".gif");
}

function asOriginalUpload(file: Express.Multer.File): ProcessedUpload {
  return {
    filePath: file.path,
    mediaUrl: getPublicUrl(file.path),
    mediaMimeType: file.mimetype,
    mediaSize: file.size,
    mediaOriginalName: sanitizeOriginalName(file.originalname),
  };
}

async function optimizeImageUpload(
  file: Express.Multer.File,
  options: {
    label: string;
    maxWidth: number;
    maxHeight: number;
    quality: number;
  },
): Promise<ProcessedUpload> {
  if (!isImage(file.mimetype)) {
    return asOriginalUpload(file);
  }

  if (isAnimatedOrGif(file)) {
    return asOriginalUpload(file);
  }

  const outputPath = path.join(
    path.dirname(file.path),
    `${options.label}-${Date.now()}-${crypto.randomUUID()}.webp`,
  );

  try {
    await sharp(file.path)
      .rotate()
      .resize({
        width: options.maxWidth,
        height: options.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: options.quality,
        effort: 4,
      })
      .toFile(outputPath);

    const outputStat = await fs.stat(outputPath);

    await removeUploadedFile(file.path);

    logger.info(
      {
        originalSize: file.size,
        optimizedSize: outputStat.size,
        originalMime: file.mimetype,
        outputPath,
      },
      "Imagem otimizada com sucesso",
    );

    return {
      filePath: outputPath,
      mediaUrl: getPublicUrl(outputPath),
      mediaMimeType: "image/webp",
      mediaSize: outputStat.size,
      mediaOriginalName: sanitizeOriginalName(file.originalname),
    };
  } catch (error) {
    await removeUploadedFile(outputPath);

    logger.warn(
      {
        err: error,
        originalName: sanitizeOriginalName(file.originalname),
        mimeType: file.mimetype,
      },
      "Falha ao otimizar imagem. Usando arquivo original para não quebrar o envio.",
    );

    return asOriginalUpload(file);
  }
}

export async function processAvatarImageUpload(file: Express.Multer.File): Promise<ProcessedUpload> {
  assertMaxSize(
    file,
    LIMITS.avatar,
    "A foto de perfil deve ter no máximo 5MB.",
    "AVATAR_FILE_TOO_LARGE",
  );

  return optimizeImageUpload(file, {
    label: "avatar",
    maxWidth: 512,
    maxHeight: 512,
    quality: 82,
  });
}

export async function processChatMediaUpload(file: Express.Multer.File): Promise<ProcessedUpload> {
  if (isImage(file.mimetype)) {
    assertMaxSize(
      file,
      LIMITS.chatImage,
      "Imagem do chat deve ter no máximo 8MB.",
      "CHAT_IMAGE_TOO_LARGE",
    );

    return optimizeImageUpload(file, {
      label: "chat",
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 82,
    });
  }

  if (isVideo(file.mimetype)) {
    assertMaxSize(
      file,
      LIMITS.chatVideo,
      "Vídeo do chat deve ter no máximo 50MB.",
      "CHAT_VIDEO_TOO_LARGE",
    );

    return asOriginalUpload(file);
  }

  if (isAudio(file.mimetype)) {
    assertMaxSize(
      file,
      LIMITS.chatAudio,
      "Áudio do chat deve ter no máximo 15MB.",
      "CHAT_AUDIO_TOO_LARGE",
    );

    return asOriginalUpload(file);
  }

  assertMaxSize(
    file,
    LIMITS.chatDocument,
    "Documento deve ter no máximo 25MB.",
    "CHAT_DOCUMENT_TOO_LARGE",
  );

  return asOriginalUpload(file);
}

export async function processStatusMediaUpload(file: Express.Multer.File): Promise<ProcessedUpload> {
  if (isImage(file.mimetype)) {
    assertMaxSize(
      file,
      LIMITS.statusImage,
      "Imagem do status deve ter no máximo 8MB.",
      "STATUS_IMAGE_TOO_LARGE",
    );

    return optimizeImageUpload(file, {
      label: "status",
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 82,
    });
  }

  if (isVideo(file.mimetype)) {
    assertMaxSize(
      file,
      LIMITS.statusVideo,
      "Vídeo do status deve ter no máximo 30MB.",
      "STATUS_VIDEO_TOO_LARGE",
    );

    return asOriginalUpload(file);
  }

  throw new AppError(
    400,
    "Formato inválido. Publique imagem ou vídeo em formato permitido.",
    "INVALID_STATUS_MEDIA_FORMAT",
  );
}
