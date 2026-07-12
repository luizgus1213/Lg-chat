import type { ChatMessage } from "../../messages.schemas";
import styles from "./styles.module.css";

type MessageItemProps = {
  message: ChatMessage;
  currentUserId: number;
};

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatus(message: ChatMessage) {
  if (message.clientStatus === "sending") {
    return "•";
  }

  if (message.clientStatus === "error") {
    return "!";
  }

  return "✓";
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

  return (
    <article
      className={[styles.wrapper, isOwn ? styles.own : styles.received].join(
        " ",
      )}
    >
      <div
        className={[
          styles.bubble,
          message.clientStatus === "error" ? styles.error : "",
        ].join(" ")}
      >
        {message.isForwarded ? (
          <span className={styles.forwarded}>Encaminhada</span>
        ) : null}

        {message.replyTo ? (
          <div className={styles.reply}>
            {message.replyTo.text ||
              message.replyTo.mediaOriginalName ||
              "Mensagem"}
          </div>
        ) : null}

        <p>{message.text || "Mensagem"}</p>

        <footer className={styles.footer}>
          {message.editedAt ? <span>Editada</span> : null}

          <time>{formatMessageTime(message.createdAt)}</time>

          {isOwn ? (
            <span title={message.localError || message.clientStatus}>
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
