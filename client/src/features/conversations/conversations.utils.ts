import type { Conversation } from "./conversations.schemas";

function getTimestamp(value?: string | null): number {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function getConversationTitle(conversation: Conversation): string {
  if (conversation.name?.trim()) {
    return conversation.name.trim();
  }

  if (conversation.privateUser?.nome) {
    return conversation.privateUser.nome;
  }

  return conversation.type === "group" ? "Grupo sem nome" : "Conversa";
}

export function getConversationPreview(conversation: Conversation): string {
  const message = conversation.lastMessage;

  if (!message) {
    return conversation.type === "group" ? "Grupo criado" : "Nenhuma mensagem";
  }

  if (message.deletedAt) {
    return "Mensagem apagada";
  }

  if (message.type === "image") {
    return "📷 Imagem";
  }

  if (message.type === "video") {
    return "🎥 Vídeo";
  }

  if (message.type === "audio") {
    return "🎵 Áudio";
  }

  if (message.type === "file") {
    return `📎 ${message.mediaOriginalName || "Documento"}`;
  }

  if (message.type === "system") {
    return message.text || "Atualização da conversa";
  }

  return message.text?.trim() || "Nova mensagem";
}

export function getConversationActivityDate(
  conversation: Conversation,
): string {
  return conversation.lastMessage?.createdAt || conversation.updatedAt;
}

export function sortConversations(
  conversations: readonly Conversation[],
): Conversation[] {
  return [...conversations].sort((first, second) => {
    if (first.isPinned !== second.isPinned) {
      return Number(second.isPinned) - Number(first.isPinned);
    }

    if (first.isPinned && second.isPinned) {
      const pinnedDifference =
        getTimestamp(second.pinnedAt ?? second.updatedAt) -
        getTimestamp(first.pinnedAt ?? first.updatedAt);

      if (pinnedDifference !== 0) return pinnedDifference;
    }

    const activityDifference =
      getTimestamp(getConversationActivityDate(second)) -
      getTimestamp(getConversationActivityDate(first));

    return activityDifference || second.id - first.id;
  });
}

export function matchesConversationSearch(
  conversation: Conversation,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchableValues = [
    getConversationTitle(conversation),
    getConversationPreview(conversation),
    conversation.description,
    conversation.lastMessage?.text,
    conversation.lastMessage?.mediaOriginalName,
    conversation.privateUser?.nome,
    conversation.privateUser?.email,
    conversation.privateUser?.about,
  ];

  return searchableValues.some(
    (value) =>
      typeof value === "string" &&
      normalizeSearchText(value).includes(normalizedQuery),
  );
}

export function formatConversationTime(conversation: Conversation): string {
  const value = getConversationActivityDate(conversation);

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) {
    return "Ontem";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}
