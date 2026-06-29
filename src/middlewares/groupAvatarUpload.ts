import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import { AppError } from "../errors/AppError";

const UPLOAD_DIR = path.resolve("public", "uploads", "groups");

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true,
});

const ALLOWED_MIME_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },

  filename: (_req, file, callback) => {
    const extension = ALLOWED_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      return callback(
        new AppError(
          400,
          "Formato de imagem inválido. Use JPG, PNG ou WEBP.",
          "INVALID_IMAGE_FORMAT",
        ),
        "",
      );
    }

    const safeName = `group-${Date.now()}-${crypto.randomUUID()}.${extension}`;

    callback(null, safeName);
  },
});

export const groupAvatarUpload = multer({
  storage,

  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new AppError(
          400,
          "Formato de imagem inválido. Use JPG, PNG ou WEBP.",
          "INVALID_IMAGE_FORMAT",
        ),
      );
    }

    callback(null, true);
  },
}).single("avatar");
