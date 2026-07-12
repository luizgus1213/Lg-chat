import { ConversationAvatar } from "./ConversationAvatar";

import {
  formatConversationTime,
  getConversationPreview,
  getConversationTitle,
} from "../conversations.utils";

import type { Conversation } from "../conversations.schemas";

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
      className={`conversation-item ${
        selected ? "conversation-item-selected" : ""
      }`}
      type="button"
      onClick={() => {
        onSelect(conversation);
      }}
      aria-current={selected ? "page" : undefined}
    >
      <ConversationAvatar name={title} src={conversation.avatarUrl} />

      <span className="conversation-item-content">
        <span className="conversation-item-top">
          <strong title={title}>{title}</strong>

          <time>{time}</time>
        </span>

        <span className="conversation-item-bottom">
          <span className="conversation-preview" title={preview}>
            {conversation.isMuted ? "🔇 " : ""}
            {preview}
          </span>

          {conversation.unreadCount > 0 ? (
            <span
              className="conversation-unread"
              aria-label={`${conversation.unreadCount} mensagens não lidas`}
            >
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          ) : conversation.isPinned ? (
            <span className="conversation-pinned" title="Conversa fixada">
              📌
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
