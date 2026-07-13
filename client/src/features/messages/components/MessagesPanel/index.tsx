import { useMemo, useState } from "react";

import { useMessages } from "../../hooks/useMessages";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
import type { ChatMessage } from "../../messages.schemas";
import { MessageComposer } from "../MessageComposer";
import { MessageList } from "../MessageList";

import styles from "./styles.module.css";

type MessagesPanelProps = {
  chatId: number;
  currentUserId: number;
  disabledReason?: string | null;
  onReadConfirmed?: (chatId: number, messageId: number) => void;
};

export function MessagesPanel({
  chatId,
  currentUserId,
  disabledReason,
  onReadConfirmed,
}: MessagesPanelProps) {
  const messages = useMessages({
    chatId,
    currentUserId,
    onReadConfirmed,
  });
  const typing = useTypingIndicator({ chatId, currentUserId });
  const [replyToMessageId, setReplyToMessageId] = useState<number | null>(null);

  const socketDisabledReason =
    messages.socketStatus === "connected"
      ? null
      : messages.socketStatus === "connecting"
        ? "Conectando ao servidor em tempo real..."
        : "Sem conexão em tempo real. Aguarde a reconexão.";

  const showInitialError =
    Boolean(messages.errorMessage) && messages.messages.length === 0;
  const replyTo = useMemo(
    () =>
      replyToMessageId
        ? messages.messages.find(
            (message) =>
              message.id === replyToMessageId && !message.deletedAt,
          ) ?? null
        : null,
    [messages.messages, replyToMessageId],
  );
  const loadingDisabledReason =
    messages.isLoading && messages.messages.length === 0
      ? "Carregando as mensagens desta conversa…"
      : null;
  const errorDisabledReason = showInitialError
    ? "Carregue as mensagens antes de enviar."
    : null;
  const finalDisabledReason =
    disabledReason ||
    loadingDisabledReason ||
    errorDisabledReason ||
    socketDisabledReason;

  function handleReply(message: ChatMessage) {
    setReplyToMessageId(message.id);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.notices}>
        {messages.errorMessage && !showInitialError ? (
          <div className={styles.error} role="alert">
            <span>{messages.errorMessage}</span>
            <button type="button" onClick={() => void messages.reload()}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {messages.readErrorMessage ? (
          <div className={styles.readError} role="status">
            <span>Não foi possível confirmar a leitura.</span>
            <button type="button" onClick={() => void messages.retryRead()}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {messages.actionErrorMessage ? (
          <div className={styles.error} role="alert">
            {messages.actionErrorMessage}
          </div>
        ) : null}

        {typing.typingText ? (
          <div className={styles.typing} role="status" aria-live="polite">
            <span className={styles.typingDots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{typing.typingText}</span>
          </div>
        ) : null}
      </div>

      {showInitialError ? (
        <div className={styles.error} role="alert">
          {messages.errorMessage}
          <div>
            <button type="button" onClick={() => void messages.reload()}>
              Tentar novamente
            </button>
          </div>
        </div>
      ) : (
        <MessageList
          messages={messages.messages}
          currentUserId={currentUserId}
          isLoading={messages.isLoading}
          isLoadingOlder={messages.isLoadingOlder}
          hasMore={messages.hasMore}
          pendingMessageIds={messages.pendingMessageIds}
          onLoadOlder={() => void messages.loadOlder()}
          onAtBottomChange={messages.setViewportAtBottom}
          onReply={handleReply}
          onReact={(messageId, emoji) => {
            void messages.reactToMessage(messageId, emoji);
          }}
          onToggleStar={(messageId, starred) => {
            void messages.toggleStar(messageId, starred);
          }}
        />
      )}

      <MessageComposer
        disabled={Boolean(finalDisabledReason) || showInitialError}
        disabledReason={finalDisabledReason}
        isSending={messages.isSending}
        replyTo={replyTo}
        onCancelReply={() => setReplyToMessageId(null)}
        onSendText={messages.sendText}
        onSendMedia={messages.sendMedia}
        onTyping={typing.notifyTyping}
        onStopTyping={typing.stopTyping}
      />
    </section>
  );
}
