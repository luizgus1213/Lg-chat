import { useCallback, useLayoutEffect, useRef } from "react";

import type { ChatMessage } from "../../messages.schemas";
import { MessageItem } from "../MessageItem";

import styles from "./styles.module.css";

type MessageListProps = {
  messages: ChatMessage[];
  currentUserId: number;
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  pendingMessageIds: ReadonlySet<number>;
  onLoadOlder: () => void;
  onAtBottomChange: (isAtBottom: boolean) => void;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: number, emoji: string) => void;
  onToggleStar: (messageId: number, starred: boolean) => void;
};

const BOTTOM_THRESHOLD_PX = 80;

export function MessageList({
  messages,
  currentUserId,
  isLoading,
  isLoadingOlder,
  hasMore,
  pendingMessageIds,
  onLoadOlder,
  onAtBottomChange,
  onReply,
  onReact,
  onToggleStar,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const atBottomRef = useRef(true);
  const previousLastIdRef = useRef<number | null>(null);
  const preserveScrollRef = useRef<{
    height: number;
    top: number;
  } | null>(null);

  const updateBottomState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;

    atBottomRef.current = isAtBottom;
    onAtBottomChange(isAtBottom);
  }, [onAtBottomChange]);

  function handleLoadOlder() {
    const container = containerRef.current;

    if (container) {
      preserveScrollRef.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
      };
    }

    onLoadOlder();
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || isLoading) return;

    const preserved = preserveScrollRef.current;

    if (preserved && !isLoadingOlder) {
      container.scrollTop =
        preserved.top + (container.scrollHeight - preserved.height);
      preserveScrollRef.current = null;
      updateBottomState();
      return;
    }

    const lastMessage = messages.at(-1);
    const lastId = lastMessage?.id ?? null;

    if (!initializedRef.current) {
      initializedRef.current = true;
      container.scrollTop = container.scrollHeight;
      previousLastIdRef.current = lastId;
      updateBottomState();
      return;
    }

    if (lastId !== previousLastIdRef.current) {
      const shouldFollowMessage =
        atBottomRef.current || lastMessage?.fromUserId === currentUserId;

      if (shouldFollowMessage) {
        container.scrollTop = container.scrollHeight;
      }

      previousLastIdRef.current = lastId;
      updateBottomState();
    }
  }, [
    messages,
    currentUserId,
    isLoading,
    isLoadingOlder,
    updateBottomState,
  ]);

  if (isLoading && messages.length === 0) {
    return (
      <div className={styles.status} role="status" aria-live="polite">
        Carregando mensagens…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      role="log"
      aria-live="polite"
      aria-busy={isLoadingOlder}
      aria-relevant="additions text"
      onScroll={updateBottomState}
    >
      {hasMore ? (
        <button
          className={styles.loadOlder}
          type="button"
          disabled={isLoadingOlder}
          onClick={handleLoadOlder}
        >
          {isLoadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}
        </button>
      ) : null}

      {messages.length === 0 ? (
        <div className={styles.status}>Nenhuma mensagem nesta conversa.</div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={message.clientId || "message-" + message.id}
            message={message}
            currentUserId={currentUserId}
            isActionPending={pendingMessageIds.has(message.id)}
            onReply={onReply}
            onReact={onReact}
            onToggleStar={onToggleStar}
          />
        ))
      )}
    </div>
  );
}
