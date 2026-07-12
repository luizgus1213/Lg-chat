import { useMessages } from "../../hooks/useMessages";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";

import { MessageList } from "../MessageList";
import { MessageComposer } from "../MessageComposer";

import styles from "./styles.module.css";

type MessagesPanelProps = {
  chatId: number;
  currentUserId: number;

  disabledReason?: string | null;
};

export function MessagesPanel({
  chatId,
  currentUserId,
  disabledReason,
}: MessagesPanelProps) {
  const messages = useMessages({
    chatId,
    currentUserId,
  });

  const typing = useTypingIndicator({
    chatId,
    currentUserId,
  });

  const socketDisabledReason =
    messages.socketStatus === "connected"
      ? null
      : messages.socketStatus === "connecting"
        ? "Conectando ao servidor em tempo real..."
        : "Sem conexão em tempo real. Aguarde a reconexão.";

  const finalDisabledReason = disabledReason || socketDisabledReason;

  return (
    <section className={styles.panel}>
      <div className={styles.statusArea}>
        {messages.errorMessage ? (
          <div className={styles.error} role="alert">
            {messages.errorMessage}
          </div>
        ) : null}

        {typing.typingText ? (
          <div className={styles.typing} role="status" aria-live="polite">
            <span className={styles.typingDots}>
              <i />
              <i />
              <i />
            </span>

            <span>{typing.typingText}</span>
          </div>
        ) : null}
      </div>

      <MessageList
        messages={messages.messages}
        currentUserId={currentUserId}
        isLoading={messages.isLoading}
        isLoadingOlder={messages.isLoadingOlder}
        hasMore={messages.hasMore}
        onLoadOlder={() => {
          void messages.loadOlder();
        }}
      />

      <MessageComposer
        disabled={Boolean(finalDisabledReason)}
        disabledReason={finalDisabledReason}
        isSending={messages.isSending}
        onSend={messages.sendText}
        onTyping={typing.notifyTyping}
        onStopTyping={typing.stopTyping}
      />
    </section>
  );
}
