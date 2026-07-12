import { ConversationAvatar } from "../ConversationAvatar";
import {
  formatConversationTime,
  getConversationPreview,
  getConversationTitle,
} from "../../conversations.utils";
import type { Conversation } from "../../conversations.schemas";

import styles from "./styles.module.css";

type ConversationItemProps = {
  conversation: Conversation;
  selected: boolean;
  onSelect: (conversation: Conversation) => void;
};

export function ConversationItem({
  conversation,
  selected,
  onSelect,
}: ConversationItemProps) {
  const title = getConversationTitle(conversation);
  const preview = getConversationPreview(conversation);
  const time = formatConversationTime(conversation);

  return (
    <button
      className={`${styles.item} ${selected ? styles.selected : ""}`}
      type="button"
      onClick={() => onSelect(conversation)}
      aria-current={selected ? "page" : undefined}
    >
      <ConversationAvatar name={title} src={conversation.avatarUrl} />

      <span className={styles.content}>
        <span className={styles.top}>
          <strong title={title}>{title}</strong>
          <time>{time}</time>
        </span>

        <span className={styles.bottom}>
          <span className={styles.preview} title={preview}>
            {conversation.isMuted ? "🔇 " : ""}
            {preview}
          </span>

          {conversation.unreadCount > 0 ? (
            <span
              className={styles.unread}
              aria-label={`${conversation.unreadCount} mensagens não lidas`}
            >
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          ) : conversation.isPinned ? (
            <span className={styles.pinned} title="Conversa fixada" aria-label="Conversa fixada">
              📌
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
