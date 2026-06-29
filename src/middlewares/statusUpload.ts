import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import { AppError } from "../errors/AppError";

const UPLOAD_DIR = path.resolve("public", "uploads", "status");

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true,
});

const ALLOWED_STATUS_MIME_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],

  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },

  filename: (_req, file, callback) => {
    const extension = ALLOWED_STATUS_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      return callback(
        new AppError(
          400,
          "Formato inválido. Publique imagem ou vídeo em formato permitido.",
          "INVALID_STATUS_MEDIA_FORMAT",
        ),
        "",
      );
    }

    const safeName = `status-${Date.now()}-${crypto.randomUUID()}.${extension}`;

    callback(null, safeName);
  },
});

export const statusUpload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_STATUS_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new AppError(
          400,
          "Formato inválido. Publique imagem ou vídeo em formato permitido.",
          "INVALID_STATUS_MEDIA_FORMAT",
        ),
      );
    }

    callback(null, true);
  },
}).single("media");
