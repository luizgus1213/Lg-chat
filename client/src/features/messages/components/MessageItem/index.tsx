import type { ChatMessage } from "../../messages.schemas";

import styles from "./styles.module.css";

type MessageItemProps = {
  message: ChatMessage;
  currentUserId: number;
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return "Arquivo";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const size = value / 1024 ** unitIndex;

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getSafeMediaUrl(value?: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value, window.location.origin);

    if (!["http:", "https:", "blob:"].includes(url.protocol)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function getStatus(message: ChatMessage) {
  if (message.clientStatus === "sending") return "•";
  if (message.clientStatus === "error") return "!";
  return "✓";
}

function MessageMedia({ message }: { message: ChatMessage }) {
  const mediaUrl = getSafeMediaUrl(message.mediaUrl);
  if (!mediaUrl || message.deletedAt) return null;

  if (message.type === "image") {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" className={styles.media}>
        <img
          className={styles.image}
          src={mediaUrl}
          alt={message.text?.trim() || "Imagem enviada na conversa"}
          loading="lazy"
        />
      </a>
    );
  }

  if (message.type === "video") {
    return (
      <div className={styles.media}>
        <video className={styles.video} src={mediaUrl} controls preload="metadata">
          Seu navegador não suporta a reprodução deste vídeo.
        </video>
      </div>
    );
  }

  if (message.type === "audio") {
    return (
      <div className={styles.media}>
        <audio className={styles.audio} src={mediaUrl} controls preload="none">
          Seu navegador não suporta a reprodução deste áudio.
        </audio>
      </div>
    );
  }

  if (message.type === "file") {
    return (
      <div className={styles.media}>
        <a
          className={styles.fileLink}
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.fileIcon} aria-hidden="true">
            📎
          </span>
          <span className={styles.fileInfo}>
            <strong>{message.mediaOriginalName || "Abrir arquivo"}</strong>
            <span>{formatFileSize(message.mediaSize)}</span>
          </span>
        </a>
      </div>
    );
  }

  return null;
}

export function MessageItem({ message, currentUserId }: MessageItemProps) {
  const isOwn = message.fromUserId === currentUserId;

  if (message.type === "system") {
    return (
      <div className={styles.system}>
        {message.text || "Atualização da conversa"}
      </div>
    );
  }

  const visibleText = message.text?.trim();

  return (
    <article
      className={`${styles.wrapper} ${isOwn ? styles.own : styles.received}`}
    >
      <div
        className={`${styles.bubble} ${
          message.clientStatus === "error" ? styles.error : ""
        }`}
      >
        {message.isForwarded && !message.deletedAt ? (
          <span className={styles.forwarded}>Encaminhada</span>
        ) : null}

        {message.replyTo && !message.deletedAt ? (
          <div className={styles.reply}>
            {message.replyTo.text ||
              message.replyTo.mediaOriginalName ||
              "Mensagem"}
          </div>
        ) : null}

        {message.deletedAt ? (
          <p className={styles.deleted}>Mensagem apagada</p>
        ) : (
          <>
            <MessageMedia message={message} />
            {visibleText ? <p className={styles.text}>{visibleText}</p> : null}
          </>
        )}

        <footer className={styles.footer}>
          {message.editedAt && !message.deletedAt ? <span>Editada</span> : null}
          <time dateTime={message.createdAt}>
            {formatMessageTime(message.createdAt)}
          </time>

          {isOwn ? (
            <span
              className={
                message.clientStatus === "error" ? styles.statusError : ""
              }
              title={message.localError || message.clientStatus || "Enviada"}
              aria-label={message.localError || message.clientStatus || "Enviada"}
            >
              {getStatus(message)}
            </span>
          ) : null}
        </footer>

        {message.localError ? (
          <span className={styles.localError}>{message.localError}</span>
        ) : null}
      </div>
    </article>
  );
}
