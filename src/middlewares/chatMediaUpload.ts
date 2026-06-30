import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import { AppError } from "../errors/AppError";

const UPLOAD_DIR = path.resolve("public", "uploads", "chat-media");

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true,
});

const MAX_FILE_SIZE_MB = 50; // limite bruto; limites por tipo ficam em uploadSecurity.ts

const ALLOWED_MIME_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],

  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],

  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/mp4", "m4a"],
  ["audio/aac", "aac"],

  ["application/pdf", "pdf"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],

  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],

  ["application/vnd.ms-excel", "xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx",
  ],

  ["application/vnd.ms-powerpoint", "ppt"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pptx",
  ],

  ["application/zip", "zip"],
  ["application/x-zip-compressed", "zip"],
  ["application/x-rar-compressed", "rar"],
  ["application/vnd.rar", "rar"],
  ["application/x-7z-compressed", "7z"],
]);

function getUploadExtension(mimetype: string) {
  return ALLOWED_MIME_TYPES.get(mimetype);
}

function invalidFileError() {
  return new AppError(
    400,
    "Formato inválido. Envie foto, vídeo, áudio ou documento permitido.",
    "INVALID_CHAT_FILE_FORMAT",
  );
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },

  filename: (_req, file, callback) => {
    const extension = getUploadExtension(file.mimetype);

    if (!extension) {
      return callback(invalidFileError(), "");
    }

    const safeName = `chat-${Date.now()}-${crypto.randomUUID()}.${extension}`;

    callback(null, safeName);
  },
});

export const chatMediaUpload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!getUploadExtension(file.mimetype)) {
      return callback(invalidFileError());
    }

    callback(null, true);
  },
}).single("media");
