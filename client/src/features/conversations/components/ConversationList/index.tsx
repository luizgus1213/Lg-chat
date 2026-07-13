import type { Conversation } from "../../conversations.schemas";
import { ConversationItem } from "../ConversationItem";

import styles from "./styles.module.css";

type ConversationListProps = {
  conversations: Conversation[];
  selectedChatId: number | null;
  onSelect: (conversation: Conversation) => void;
  emptyTitle: string;
  emptyMessage: string;
};

export function ConversationList({
  conversations,
  selectedChatId,
  onSelect,
  emptyTitle,
  emptyMessage,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className={styles.empty} role="status" aria-live="polite">
        <strong>{emptyTitle}</strong>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ul className={styles.list} aria-label="Lista de conversas">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <ConversationItem
            conversation={conversation}
            selected={conversation.id === selectedChatId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
