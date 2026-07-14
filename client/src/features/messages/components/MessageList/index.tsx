import { useCallback, useLayoutEffect, useRef, useState } from "react";

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
  highlightedMessageId: number | null;
  onLoadOlder: () => void;
  onAtBottomChange: (isAtBottom: boolean) => void;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: number, emoji: string) => void;
  onToggleStar: (messageId: number, starred: boolean) => void;
  onEdit: (messageId: number, text: string) => Promise<boolean>;
  onDelete: (messageId: number) => Promise<boolean>;
  onForward: (message: ChatMessage) => void;
  onRetry: (messageId: number) => Promise<void>;
};

const BOTTOM_THRESHOLD_PX = 80;

export function MessageList({
  messages,
  currentUserId,
  isLoading,
  isLoadingOlder,
  hasMore,
  pendingMessageIds,
  highlightedMessageId,
  onLoadOlder,
  onAtBottomChange,
  onReply,
  onReact,
  onToggleStar,
  onEdit,
  onDelete,
  onForward,
  onRetry,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const atBottomRef = useRef(true);
  const previousLastIdRef = useRef<number | null>(null);
  const preserveScrollRef = useRef<{
    height: number;
    top: number;
  } | null>(null);
  const messageElementsRef = useRef(new Map<number, HTMLElement>());
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const updateBottomState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;

    atBottomRef.current = isAtBottom;
    if (isAtBottom) setHasNewMessages(false);
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
      } else {
        setHasNewMessages(true);
      }

      previousLastIdRef.current = lastId;
      updateBottomState();
    }
  }, [messages, currentUserId, isLoading, isLoadingOlder, updateBottomState]);

  useLayoutEffect(() => {
    if (!highlightedMessageId) return;
    const element = messageElementsRef.current.get(highlightedMessageId);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightedMessageId, messages]);

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
            highlighted={message.id === highlightedMessageId}
            itemRef={(element) => {
              if (element) messageElementsRef.current.set(message.id, element);
              else messageElementsRef.current.delete(message.id);
            }}
            onReply={onReply}
            onReact={onReact}
            onToggleStar={onToggleStar}
            onEdit={onEdit}
            onDelete={onDelete}
            onForward={onForward}
            onRetry={onRetry}
          />
        ))
      )}
      {hasNewMessages ? (
        <button
          className={styles.newMessages}
          type="button"
          onClick={() => {
            const container = containerRef.current;
            if (container)
              container.scrollTo({
                top: container.scrollHeight,
                behavior: "smooth",
              });
            setHasNewMessages(false);
          }}
        >
          Novas mensagens ↓
        </button>
      ) : null}
    </div>
  );
}
