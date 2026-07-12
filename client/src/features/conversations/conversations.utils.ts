import type { Conversation } from "./conversations.schemas";

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

  if (message.type === "document" || message.type === "file") {
    return `📎 ${message.mediaOriginalName || "Documento"}`;
  }

  if (message.type === "system") {
    return message.text || "Atualização da conversa";
  }

  return message.text?.trim() || "Nova mensagem";
}

export function formatConversationTime(conversation: Conversation): string {
  const value = conversation.lastMessage?.createdAt || conversation.updatedAt;

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
