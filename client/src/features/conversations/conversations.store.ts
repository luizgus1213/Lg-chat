import type { ServerChatMessage } from "../messages/messages.schemas";
import type { Conversation } from "./conversations.schemas";
import { sortConversations } from "./conversations.utils";

type ConversationLastMessage = NonNullable<Conversation["lastMessage"]>;

function toConversationLastMessage(
  message: ServerChatMessage,
): ConversationLastMessage {
  return {
    id: message.id,
    chatId: message.chatId,
    fromUserId: message.fromUserId,
    text: message.text,
    type: message.type,
    mediaUrl: message.mediaUrl,
    mediaMimeType: message.mediaMimeType,
    mediaOriginalName: message.mediaOriginalName,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
  };
}

export function applyMessageToConversationList(
  conversations: Conversation[],
  message: ServerChatMessage,
  currentUserId: number,
): Conversation[] {
  let changed = false;
  const updated = conversations.map((conversation) => {
    if (conversation.id !== message.chatId) return conversation;
    const previousMessageId = conversation.lastMessage?.id ?? 0;
    if (message.id <= previousMessageId) return conversation;

    changed = true;
    const shouldIncrementUnread =
      message.fromUserId !== currentUserId && message.type !== "system";

    return {
      ...conversation,
      lastMessage: toConversationLastMessage(message),
      updatedAt: message.createdAt,
      unreadCount: shouldIncrementUnread
        ? conversation.unreadCount + 1
        : conversation.unreadCount,
    };
  });

  return changed ? sortConversations(updated) : conversations;
}

export function applyUpdatedMessageToList(
  conversations: Conversation[],
  message: ServerChatMessage,
): Conversation[] {
  let changed = false;
  const updated = conversations.map((conversation) => {
    if (
      conversation.id !== message.chatId ||
      conversation.lastMessage?.id !== message.id
    ) {
      return conversation;
    }

    changed = true;
    return {
      ...conversation,
      lastMessage: toConversationLastMessage(message),
      updatedAt:
        message.updatedAt ||
        message.editedAt ||
        message.deletedAt ||
        message.createdAt,
    };
  });

  return changed ? sortConversations(updated) : conversations;
}

export function mergeServerSnapshot(
  serverItems: Conversation[],
  currentItems: Conversation[],
  mutationVersions: ReadonlyMap<number, number>,
  requestMutationVersion: number,
): Conversation[] {
  const currentById = new Map(
    currentItems.map((conversation) => [conversation.id, conversation]),
  );
  const serverIds = new Set(serverItems.map((conversation) => conversation.id));
  const merged = serverItems.map((serverConversation) => {
    const currentConversation = currentById.get(serverConversation.id);
    const mutationVersion = mutationVersions.get(serverConversation.id) ?? 0;
    return currentConversation && mutationVersion > requestMutationVersion
      ? currentConversation
      : serverConversation;
  });

  for (const currentConversation of currentItems) {
    const mutationVersion = mutationVersions.get(currentConversation.id) ?? 0;
    if (
      mutationVersion > requestMutationVersion &&
      !serverIds.has(currentConversation.id)
    ) {
      merged.push(currentConversation);
    }
  }

  return sortConversations(merged);
}
