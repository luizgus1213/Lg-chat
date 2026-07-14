import {
  CHAT_ALLOWED_MIME_TYPES,
  CHAT_UPLOAD_LIMIT_BYTES,
} from "@shared/publicContracts";

const ALLOWED_MEDIA_TYPES = new Set<string>(CHAT_ALLOWED_MIME_TYPES);

export function validateMediaFile(file: File): void {
  if (!file.name || file.size <= 0) {
    throw new Error("Escolha um arquivo válido para enviar.");
  }

  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    throw new Error(
      "Formato não permitido. Envie uma foto, vídeo, áudio ou documento compatível.",
    );
  }

  const maxBytes = file.type.startsWith("image/")
    ? CHAT_UPLOAD_LIMIT_BYTES.image
    : file.type.startsWith("video/")
      ? CHAT_UPLOAD_LIMIT_BYTES.video
      : file.type.startsWith("audio/")
        ? CHAT_UPLOAD_LIMIT_BYTES.audio
        : CHAT_UPLOAD_LIMIT_BYTES.document;

  if (file.size > maxBytes) {
    const maxMegabytes = Math.round(maxBytes / 1024 / 1024);
    throw new Error(`Esse arquivo deve ter no máximo ${maxMegabytes} MB.`);
  }
}
