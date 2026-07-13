import { ConversationAvatar } from "../ConversationAvatar";
import {
  formatConversationTime,
  getConversationActivityDate,
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
  const activityDate = getConversationActivityDate(conversation);

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
          {time ? <time dateTime={activityDate}>{time}</time> : null}
        </span>

        <span className={styles.bottom}>
          <span className={styles.preview} title={preview}>
            {conversation.isMuted ? (
              <span
                aria-label="Conversa silenciada"
                title="Conversa silenciada"
              >
                <span aria-hidden="true">🔇 </span>
              </span>
            ) : null}
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
            <span
              className={styles.pinned}
              title="Conversa fixada"
              aria-label="Conversa fixada"
            >
              <span aria-hidden="true">📌</span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
