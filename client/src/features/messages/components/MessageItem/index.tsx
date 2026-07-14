import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "../../messages.schemas";
import { MediaViewer } from "../MediaViewer";
import { MessageMedia } from "./MessageMedia";

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
  onRetry: (messageId: number) => Promise<void>;
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatus(message: ChatMessage) {
  if (message.clientStatus === "sending") return "…";
  if (message.clientStatus === "error") return "!";
  if (message.deliveryStatus === "read") return "✓✓";
  return "✓";
}

function getStatusLabel(message: ChatMessage) {
  if (message.localError) return message.localError;
  if (message.clientStatus === "sending") return "Enviando";
  if (message.clientStatus === "error") return "Falha no envio";
  if (message.deliveryStatus === "read") return "Lida";
  return "Enviada";
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
  onRetry,
}: MessageItemProps) {
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewer, setViewer] = useState<{
    url: string;
    type: "image" | "video";
    label: string;
  } | null>(null);
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
              onOpen={(url, type, label) => setViewer({ url, type, label })}
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
                  <textarea
                    autoFocus
                    value={editingText}
                    maxLength={1_000}
                    rows={3}
                    disabled={isActionPending}
                    onChange={(event) => setEditingText(event.target.value)}
                  />
                </label>
                <div>
                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => setEditingText(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isActionPending || !editingText.trim()}
                  >
                    Salvar
                  </button>
                </div>
              </form>
            ) : visibleText ? (
              <p className={styles.text}>{visibleText}</p>
            ) : null}
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onReply(message);
                  }}
                >
                  Responder
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-pressed={message.isStarred}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleStar(message.id, !message.isStarred);
                  }}
                >
                  {message.isStarred ? "Desfavoritar" : "Favoritar"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsReactionPickerOpen(true);
                  }}
                >
                  Reagir
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onForward(message);
                  }}
                >
                  Encaminhar
                </button>
                {isOwn && message.type === "text" && visibleText ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setEditingText(message.text ?? "");
                    }}
                  >
                    Editar
                  </button>
                ) : null}
                {isOwn ? (
                  <button
                    className={styles.dangerAction}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                  >
                    Excluir
                  </button>
                ) : null}
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
          <div
            className={styles.deleteConfirm}
            role="alertdialog"
            aria-label="Confirmar exclusão da mensagem"
          >
            <span>Apagar para todos?</span>
            <div>
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isActionPending}
                onClick={() =>
                  void onDelete(message.id).then((success) => {
                    if (success) setConfirmDelete(false);
                  })
                }
              >
                Apagar
              </button>
            </div>
          </div>
        ) : null}

        {message.localError ? (
          <span className={styles.localError}>
            {message.localError}
            {message.clientStatus === "error" && message.type === "text" ? (
              <button type="button" onClick={() => void onRetry(message.id)}>
                Tentar novamente
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {viewer ? (
        <MediaViewer
          url={viewer.url}
          type={viewer.type}
          label={viewer.label}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </article>
  );
}
