function getAllowedMediaTypes() {
    return [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",

      "video/mp4",
      "video/webm",
      "video/quicktime",

      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",

      "application/pdf",
      "text/plain",
      "text/csv",

      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",

      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/vnd.rar",
      "application/x-7z-compressed",
    ];
  }

function getFileKindFromMime(mimeType) {
    if (!mimeType) return "file";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";

    return "file";
  }

function getFileKindLabel(kind) {
    if (kind === "image") return "foto";
    if (kind === "video") return "vídeo";
    if (kind === "audio") return "áudio";

    return "documento";
  }

function getFileIconFromMime(mimeType, fileName = "") {
    const lowerName = String(fileName).toLowerCase();

    if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) return "📕";
    if (mimeType === "text/plain" || lowerName.endsWith(".txt")) return "📄";
    if (mimeType === "text/csv" || lowerName.endsWith(".csv")) return "📊";
    if (mimeType && mimeType.includes("word")) return "📝";
    if (mimeType && mimeType.includes("excel")) return "📊";
    if (mimeType && mimeType.includes("spreadsheet")) return "📊";
    if (mimeType && mimeType.includes("powerpoint")) return "📑";
    if (mimeType && mimeType.includes("presentation")) return "📑";
    if (mimeType && (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z"))) return "🗜️";

    return "📎";
  }

function validateMediaFile(file) {
    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de enviar arquivo.");
      return false;
    }

    if (isBlockedChat()) {
      ui.showToast("error", getBlockNoticeText());
      return false;
    }

    if (!file) {
      return false;
    }

    if (!getAllowedMediaTypes().includes(file.type)) {
      ui.showToast(
        "error",
        "Envie foto, vídeo, áudio ou documento em formato permitido.",
      );
      return false;
    }

    const maxSize = 50 * 1024 * 1024;

    if (file.size > maxSize) {
      ui.showToast("error", "O arquivo deve ter no máximo 50MB.");
      return false;
    }

    return true;
  }

function closeAttachmentMenu() {
    const menu = safeEl("attachmentMenu");

    if (menu) {
      menu.classList.add("hidden");
    }
  }
