import { useEffect, useMemo, useRef } from "react";

import type { ChatMessage } from "../../messages.schemas";

import { MessageItem } from "../MessageItem";

import styles from "./styles.module.css";

type MessageListProps = {
  messages: ChatMessage[];
  currentUserId: number;

  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;

  onLoadOlder: () => void;
};

export function MessageList({
  messages,
  currentUserId,
  isLoading,
  isLoadingOlder,
  hasMore,
  onLoadOlder,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  const lastMessageId = useMemo(() => {
    return messages.at(-1)?.id ?? null;
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      block: "end",
    });
  }, [lastMessageId]);

  if (isLoading && messages.length === 0) {
    return <div className={styles.status}>Carregando mensagens...</div>;
  }

  return (
    <div className={styles.container} role="log" aria-live="polite">
      {hasMore ? (
        <button
          className={styles.loadOlder}
          type="button"
          disabled={isLoadingOlder}
          onClick={onLoadOlder}
        >
          {isLoadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}
        </button>
      ) : null}

      {messages.length === 0 ? (
        <div className={styles.status}>Nenhuma mensagem nesta conversa.</div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={`${message.id}-${message.clientId || ""}`}
            message={message}
            currentUserId={currentUserId}
          />
        ))
      )}

      <div ref={endRef} />
    </div>
  );
}
