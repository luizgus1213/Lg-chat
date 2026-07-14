import { useState } from "react";

import type { ChatMessage } from "../../messages.schemas";
import styles from "./styles.module.css";

type MediaStatus = "loading" | "ready" | "error";

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return "Tamanho não informado";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const size = value / 1024 ** unitIndex;

  return size.toFixed(unitIndex === 0 ? 0 : 1) + " " + units[unitIndex];
}

function getSafeMediaUrl(value?: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin &&
      url.pathname.startsWith("/uploads/")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function MessageMedia({
  message,
  onOpen,
}: {
  message: ChatMessage;
  onOpen: (url: string, type: "image" | "video", label: string) => void;
}) {
  const mediaUrl = getSafeMediaUrl(message.mediaUrl);
  const [status, setStatus] = useState<MediaStatus>("loading");

  if (!mediaUrl || message.deletedAt) return null;

  if (message.type === "file") {
    return (
      <div className={styles.media}>
        <a
          className={styles.fileLink}
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className={styles.fileIcon} aria-hidden="true">
            📎
          </span>
          <span className={styles.fileInfo}>
            <strong>{message.mediaOriginalName || "Abrir arquivo"}</strong>
            <span>
              {message.mediaMimeType || "Arquivo"} ·{" "}
              {formatFileSize(message.mediaSize)}
            </span>
          </span>
        </a>
      </div>
    );
  }

  const loadingLabel =
    message.type === "image"
      ? "Carregando imagem…"
      : message.type === "video"
        ? "Carregando vídeo…"
        : "Carregando áudio…";

  return (
    <div className={styles.media}>
      {status === "loading" ? (
        <span className={styles.mediaStatus} role="status" aria-live="polite">
          {loadingLabel}
        </span>
      ) : null}
      {status === "error" ? (
        <span className={styles.mediaError} role="alert">
          Não foi possível carregar esta mídia.{" "}
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            Abrir em outra aba
          </a>
        </span>
      ) : null}

      {message.type === "image" ? (
        <button
          type="button"
          className={styles.mediaLink}
          hidden={status === "error"}
          onClick={() =>
            onOpen(
              mediaUrl,
              "image",
              message.text?.trim() || "Imagem enviada na conversa",
            )
          }
        >
          <img
            className={styles.image}
            src={mediaUrl}
            alt={message.text?.trim() || "Imagem enviada na conversa"}
            loading="lazy"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        </button>
      ) : null}

      {message.type === "video" ? (
        <div>
          <video
            className={styles.video}
            src={mediaUrl}
            controls
            preload="metadata"
            hidden={status === "error"}
            onLoadedMetadata={() => setStatus("ready")}
            onError={() => setStatus("error")}
          >
            Seu navegador não suporta a reprodução deste vídeo.
          </video>
          {status === "ready" ? (
            <button
              type="button"
              className={styles.openMedia}
              onClick={() =>
                onOpen(
                  mediaUrl,
                  "video",
                  message.text?.trim() || "Vídeo enviado na conversa",
                )
              }
            >
              Ampliar vídeo
            </button>
          ) : null}
        </div>
      ) : null}

      {message.type === "audio" ? (
        <audio
          className={styles.audio}
          src={mediaUrl}
          controls
          preload="metadata"
          hidden={status === "error"}
          onLoadedMetadata={() => setStatus("ready")}
          onError={() => setStatus("error")}
        >
          Seu navegador não suporta a reprodução deste áudio.
        </audio>
      ) : null}
    </div>
  );
}
