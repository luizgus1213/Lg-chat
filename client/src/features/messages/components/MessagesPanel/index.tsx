import { useMessages } from "../../hooks/useMessages";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
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

  const socketDisabledReason =
    messages.socketStatus === "connected"
      ? null
      : messages.socketStatus === "connecting"
        ? "Conectando ao servidor em tempo real..."
        : "Sem conexão em tempo real. Aguarde a reconexão.";

  const finalDisabledReason = disabledReason || socketDisabledReason;
  const showInitialError =
    Boolean(messages.errorMessage) && messages.messages.length === 0;

  return (
    <section className={styles.panel}>
      <div className={styles.notices}>
        {messages.errorMessage && !showInitialError ? (
          <div className={styles.error} role="alert">
            {messages.errorMessage}
          </div>
        ) : null}

        {messages.readErrorMessage ? (
          <div className={styles.readError} role="status">
            Não foi possível confirmar a leitura. Tentaremos novamente quando a
            conversa estiver visível.
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
          onLoadOlder={() => void messages.loadOlder()}
          onAtBottomChange={messages.setViewportAtBottom}
        />
      )}

      <MessageComposer
        disabled={Boolean(finalDisabledReason) || showInitialError}
        disabledReason={finalDisabledReason}
        isSending={messages.isSending}
        onSend={messages.sendText}
        onTyping={typing.notifyTyping}
        onStopTyping={typing.stopTyping}
      />
    </section>
  );
}
