import type { ChatMessage, ServerChatMessage } from "./messages.schemas";

export function compareMessages(first: ChatMessage, second: ChatMessage) {
  const firstTime = new Date(first.createdAt).getTime();
  const secondTime = new Date(second.createdAt).getTime();
  const safeFirstTime = Number.isNaN(firstTime) ? 0 : firstTime;
  const safeSecondTime = Number.isNaN(secondTime) ? 0 : secondTime;

  if (safeFirstTime !== safeSecondTime) return safeFirstTime - safeSecondTime;
  return first.id - second.id;
}

export function mergeOneMessage(
  current: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] {
  const next = [...current];
  const idIndex =
    incoming.id > 0
      ? next.findIndex(
          (message) => message.id > 0 && message.id === incoming.id,
        )
      : -1;
  const clientIndex = incoming.clientId
    ? next.findIndex((message) => message.clientId === incoming.clientId)
    : -1;
  const targetIndex = idIndex >= 0 ? idIndex : clientIndex;

  if (targetIndex >= 0)
    next[targetIndex] = { ...next[targetIndex], ...incoming };
  else next.push(incoming);

  return next.sort(compareMessages);
}

export function mergeManyMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
) {
  return incoming.reduce(
    (messages, message) => mergeOneMessage(messages, message),
    current,
  );
}

export function mergeRealtimeUpdate(
  current: ChatMessage[],
  incoming: ServerChatMessage,
) {
  const existing = current.find((message) => message.id === incoming.id);
  const reactions = incoming.reactions.map((reaction) => ({
    ...reaction,
    reactedByMe:
      existing?.reactions.find((item) => item.emoji === reaction.emoji)
        ?.reactedByMe ?? false,
  }));

  return mergeOneMessage(current, {
    ...incoming,
    reactions,
    isStarred: existing?.isStarred ?? false,
    clientStatus: "sent",
    localError: null,
  });
}

export function asSentMessage(message: ServerChatMessage): ChatMessage {
  return { ...message, clientStatus: "sent", localError: null };
}

export function createReplyPreview(message: ChatMessage) {
  return {
    id: message.id,
    chatId: message.chatId,
    fromUserId: message.fromUserId,
    text: message.text,
    type: message.type,
    mediaOriginalName: message.mediaOriginalName,
    deletedAt: message.deletedAt,
  };
}

export function createMessageClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function hasServerConfirmation(
  messages: readonly ChatMessage[],
  confirmedClientIds: ReadonlySet<string>,
  clientId: string,
): boolean {
  return (
    confirmedClientIds.has(clientId) ||
    messages.some((message) => message.clientId === clientId && message.id > 0)
  );
}

export function canConfirmMessageRead(options: {
  isAtBottom: boolean;
  isDocumentVisible: boolean;
  hasDocumentFocus: boolean;
}): boolean {
  return (
    options.isAtBottom && options.isDocumentVisible && options.hasDocumentFocus
  );
}
