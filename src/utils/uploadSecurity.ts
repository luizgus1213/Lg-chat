import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp = require("sharp");
import { AppError } from "../errors/AppError";
import { logger, toSafeLogError } from "./logger";
import { CHAT_UPLOAD_LIMIT_BYTES } from "../shared/publicContracts";
import { toUploadUrl } from "../config/uploadPaths";

const MB = 1024 * 1024;

const LIMITS = {
  avatar: 5 * MB,
  chatImage: CHAT_UPLOAD_LIMIT_BYTES.image,
  chatVideo: CHAT_UPLOAD_LIMIT_BYTES.video,
  chatAudio: CHAT_UPLOAD_LIMIT_BYTES.audio,
  chatDocument: CHAT_UPLOAD_LIMIT_BYTES.document,
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
  return toUploadUrl(filePath);
}

export async function removeUploadedFile(filePath?: string | null) {
  if (!filePath) return;

  await fs.unlink(filePath).catch(() => undefined);
}

function assertMaxSize(
  file: Express.Multer.File,
  maxBytes: number,
  message: string,
  code: string,
) {
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
  return (
    file.mimetype === "image/gif" ||
    file.originalname.toLowerCase().endsWith(".gif")
  );
}

function startsWithBytes(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

async function assertFileSignature(file: Express.Multer.File) {
  const handle = await fs.open(file.path, "r");
  const header = Buffer.alloc(32);

  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const ascii = header.toString("ascii");
  const mime = file.mimetype;
  const valid =
    (["text/plain", "text/csv"].includes(mime) && !header.includes(0)) ||
    (["image/jpeg", "image/jpg"].includes(mime) &&
      startsWithBytes(header, [0xff, 0xd8, 0xff])) ||
    (mime === "image/png" &&
      startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47])) ||
    (mime === "image/gif" && ascii.startsWith("GIF8")) ||
    (mime === "image/webp" &&
      ascii.startsWith("RIFF") &&
      ascii.slice(8, 12) === "WEBP") ||
    (["video/mp4", "video/quicktime", "audio/mp4"].includes(mime) &&
      ascii.slice(4, 8) === "ftyp") ||
    (["video/webm", "audio/webm"].includes(mime) &&
      startsWithBytes(header, [0x1a, 0x45, 0xdf, 0xa3])) ||
    (mime === "audio/ogg" && ascii.startsWith("OggS")) ||
    (["audio/wav", "audio/x-wav"].includes(mime) &&
      ascii.startsWith("RIFF") &&
      ascii.slice(8, 12) === "WAVE") ||
    (["audio/mpeg", "audio/mp3"].includes(mime) &&
      (ascii.startsWith("ID3") ||
        (header[0] === 0xff && (header[1] & 0xe0) === 0xe0))) ||
    (mime === "audio/aac" &&
      header[0] === 0xff &&
      (header[1] & 0xf6) === 0xf0) ||
    (mime === "application/pdf" && ascii.startsWith("%PDF")) ||
    ([
      "application/zip",
      "application/x-zip-compressed",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ].includes(mime) &&
      ascii.startsWith("PK")) ||
    ([
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
    ].includes(mime) &&
      startsWithBytes(header, [0xd0, 0xcf, 0x11, 0xe0])) ||
    (["application/x-rar-compressed", "application/vnd.rar"].includes(mime) &&
      ascii.startsWith("Rar!")) ||
    (mime === "application/x-7z-compressed" &&
      startsWithBytes(header, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]));

  if (!valid) {
    throw new AppError(
      400,
      "O conteúdo do arquivo não corresponde ao formato informado.",
      "UPLOAD_CONTENT_TYPE_MISMATCH",
    );
  }
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
        error: toSafeLogError(error),
        mimeType: file.mimetype,
      },
      "Falha ao otimizar imagem. Usando arquivo original para não quebrar o envio.",
    );

    return asOriginalUpload(file);
  }
}

export async function processAvatarImageUpload(
  file: Express.Multer.File,
): Promise<ProcessedUpload> {
  await assertFileSignature(file);
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

export async function processChatMediaUpload(
  file: Express.Multer.File,
): Promise<ProcessedUpload> {
  await assertFileSignature(file);
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

export async function processStatusMediaUpload(
  file: Express.Multer.File,
): Promise<ProcessedUpload> {
  await assertFileSignature(file);
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
