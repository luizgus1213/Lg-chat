import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "../../messages.schemas";

import styles from "./styles.module.css";

const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

type MessageItemProps = {
  message: ChatMessage;
  currentUserId: number;
  isActionPending: boolean;
  highlighted: boolean;
  itemRef: (element: HTMLElement | null) => void;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: number, emoji: string) => void;
  onToggleStar: (messageId: number, starred: boolean) => void;
  onEdit: (messageId: number, text: string) => Promise<boolean>;
  onDelete: (messageId: number) => Promise<boolean>;
  onForward: (message: ChatMessage) => void;
};

type MediaStatus = "loading" | "ready" | "error";

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function getStatus(message: ChatMessage) {
  if (message.clientStatus === "sending") return "…";
  if (message.clientStatus === "error") return "!";
  return "✓";
}

function getStatusLabel(message: ChatMessage) {
  if (message.localError) return message.localError;
  if (message.clientStatus === "sending") return "Enviando";
  if (message.clientStatus === "error") return "Falha no envio";
  return "Enviada";
}

function MessageMedia({ message }: { message: ChatMessage }) {
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
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mediaLink}
          hidden={status === "error"}
        >
          <img
            className={styles.image}
            src={mediaUrl}
            alt={message.text?.trim() || "Imagem enviada na conversa"}
            loading="lazy"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        </a>
      ) : null}

      {message.type === "video" ? (
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

export function MessageItem({
  message,
  currentUserId,
  isActionPending,
  highlighted,
  itemRef,
  onReply,
  onReact,
  onToggleStar,
  onEdit,
  onDelete,
  onForward,
}: MessageItemProps) {
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const isOwn = message.fromUserId === currentUserId;

  useEffect(() => {
    itemRef(wrapperRef.current);
    return () => itemRef(null);
  }, [itemRef]);

  useEffect(() => {
    if (!isMenuOpen && !isReactionPickerOpen) return;
    function closeOnOutside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsReactionPickerOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsReactionPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen, isReactionPickerOpen]);

  if (message.type === "system") {
    return (
      <div className={styles.system} role="note">
        {message.text || "Atualização da conversa"}
      </div>
    );
  }

  const visibleText = message.text?.trim();
  const canUseActions = message.id > 0 && !message.deletedAt;

  return (
    <article
      ref={wrapperRef}
      className={[
        styles.wrapper,
        isOwn ? styles.own : styles.received,
        highlighted ? styles.highlighted : "",
      ].join(" ")}
    >
      <div
        className={[
          styles.bubble,
          message.clientStatus === "error" ? styles.error : "",
        ].join(" ")}
      >
        {message.isForwarded && !message.deletedAt ? (
          <span className={styles.forwarded}>Encaminhada</span>
        ) : null}

        {message.replyTo && !message.deletedAt ? (
          <div className={styles.reply}>
            {message.replyTo.deletedAt
              ? "Mensagem apagada"
              : message.replyTo.text ||
                message.replyTo.mediaOriginalName ||
                "Mensagem"}
          </div>
        ) : null}

        {message.deletedAt ? (
          <p className={styles.deleted}>Mensagem apagada</p>
        ) : (
          <>
            <MessageMedia
              key={message.mediaUrl || "media-" + message.id}
              message={message}
            />
            {editingText !== null ? (
              <form
                className={styles.editForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!editingText.trim()) return;
                  void onEdit(message.id, editingText).then((success) => {
                    if (success) setEditingText(null);
                  });
                }}
              >
                <label>
                  <span>Editar mensagem</span>
                  <textarea autoFocus value={editingText} maxLength={1_000} rows={3} disabled={isActionPending} onChange={(event) => setEditingText(event.target.value)} />
                </label>
                <div>
                  <button type="button" disabled={isActionPending} onClick={() => setEditingText(null)}>Cancelar</button>
                  <button type="submit" disabled={isActionPending || !editingText.trim()}>Salvar</button>
                </div>
              </form>
            ) : visibleText ? <p className={styles.text}>{visibleText}</p> : null}
          </>
        )}

        {message.reactions.length > 0 && !message.deletedAt ? (
          <div className={styles.reactions} aria-label="Reações da mensagem">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                className={reaction.reactedByMe ? styles.reactedByMe : ""}
                aria-pressed={reaction.reactedByMe}
                aria-label={
                  reaction.emoji +
                  ": " +
                  reaction.count +
                  (reaction.count === 1 ? " reação" : " reações")
                }
                disabled={isActionPending}
                onClick={() => onReact(message.id, reaction.emoji)}
              >
                <span aria-hidden="true">{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <footer className={styles.footer}>
          {message.isStarred && !message.deletedAt ? (
            <span title="Mensagem favorita" aria-label="Mensagem favorita">
              ★
            </span>
          ) : null}
          {message.editedAt && !message.deletedAt ? <span>Editada</span> : null}
          <time dateTime={message.createdAt}>
            {formatMessageTime(message.createdAt)}
          </time>

          {isOwn ? (
            <span
              className={
                message.clientStatus === "error" ? styles.statusError : ""
              }
              title={getStatusLabel(message)}
              aria-label={getStatusLabel(message)}
            >
              {getStatus(message)}
            </span>
          ) : null}
        </footer>

        {canUseActions ? (
          <div className={styles.menuArea}>
            <button
              className={styles.menuButton}
              type="button"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              disabled={isActionPending}
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              Ações
            </button>
            {isMenuOpen ? (
              <div className={styles.actions} role="menu">
                <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onReply(message); }}>Responder</button>
                <button type="button" role="menuitem" aria-pressed={message.isStarred} onClick={() => { setIsMenuOpen(false); onToggleStar(message.id, !message.isStarred); }}>{message.isStarred ? "Desfavoritar" : "Favoritar"}</button>
                <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); setIsReactionPickerOpen(true); }}>Reagir</button>
                <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onForward(message); }}>Encaminhar</button>
                {isOwn ? <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); setEditingText(message.text ?? ""); }}>Editar</button> : null}
                {isOwn ? <button className={styles.dangerAction} type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); setConfirmDelete(true); }}>Excluir</button> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {canUseActions && isReactionPickerOpen ? (
          <div className={styles.reactionPicker} aria-label="Escolher reação">
            {REACTION_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={"Reagir com " + emoji}
                disabled={isActionPending}
                onClick={() => {
                  setIsReactionPickerOpen(false);
                  onReact(message.id, emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {confirmDelete ? (
          <div className={styles.deleteConfirm} role="alertdialog" aria-label="Confirmar exclusão da mensagem">
            <span>Apagar para todos?</span>
            <div>
              <button type="button" disabled={isActionPending} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button type="button" disabled={isActionPending} onClick={() => void onDelete(message.id).then((success) => {
                if (success) setConfirmDelete(false);
              })}>Apagar</button>
            </div>
          </div>
        ) : null}

        {message.localError ? (
          <span className={styles.localError}>{message.localError}</span>
        ) : null}
      </div>
    </article>
  );
}
