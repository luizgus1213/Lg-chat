import { ConversationItem } from "./ConversationItem";

import type { Conversation } from "../conversations.schemas";

type ConversationListProps = {
  conversations: Conversation[];
  selectedChatId: number | null;
  onSelect: (conversation: Conversation) => void;
};

export function ConversationList({
  conversations,
  selectedChatId,
  onSelect,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="conversation-list-status">
        <strong>Nenhuma conversa</strong>

        <span>Suas conversas aparecerão aqui quando você iniciar um chat.</span>
      </div>
    );
  }

  return (
    <div className="conversation-list">
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
