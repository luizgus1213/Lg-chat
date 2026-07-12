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
      <div className={styles.empty}>
        <strong>{emptyTitle}</strong>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          selected={conversation.id === selectedChatId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
