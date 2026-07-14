import { describe, expect, it } from "vitest";

import type { Conversation } from "./conversations.schemas";
import {
  applyMessageToConversationList,
  applyUpdatedMessageToList,
  mergeServerSnapshot,
} from "./conversations.store";
import type { ServerChatMessage } from "../messages/messages.schemas";

function conversation(id: number, updatedAt: string): Conversation {
  return {
    id,
    type: "private",
    name: `Conversa ${id}`,
    description: null,
    avatarUrl: null,
    createdById: null,
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt,
    myRole: "member",
    lastReadMessageId: null,
    isPinned: false,
    isArchived: false,
    isMuted: false,
    pinnedAt: null,
    archivedAt: null,
    mutedUntil: null,
    chatClearedAt: null,
    chatDeletedAt: null,
    unreadCount: 0,
    block: null,
    lastMessage: null,
    privateUser: null,
  };
}

function message(
  overrides: Partial<ServerChatMessage> = {},
): ServerChatMessage {
  return {
    id: 10,
    chatId: 1,
    fromUserId: 2,
    text: "Nova mensagem",
    type: "text",
    mediaUrl: null,
    mediaMimeType: null,
    mediaSize: null,
    mediaOriginalName: null,
    replyToMessageId: null,
    forwardedFromMessageId: null,
    isForwarded: false,
    editedAt: null,
    deletedAt: null,
    createdAt: "2026-07-13T10:03:00.000Z",
    updatedAt: null,
    clientId: "conversation-message-1",
    replyTo: null,
    reactions: [],
    isStarred: false,
    deliveryStatus: "sent",
    ...overrides,
  };
}

describe("merge de snapshot de conversas", () => {
  it("preserva evento Socket.IO que chegou durante a requisição HTTP", () => {
    const stale = conversation(1, "2026-07-13T10:00:00.000Z");
    const realtime = conversation(1, "2026-07-13T10:01:00.000Z");
    const merged = mergeServerSnapshot(
      [stale],
      [realtime],
      new Map([[1, 2]]),
      1,
    );

    expect(merged[0].updatedAt).toBe("2026-07-13T10:01:00.000Z");
  });

  it("aceita o snapshot quando não houve mutação concorrente", () => {
    const server = conversation(1, "2026-07-13T10:02:00.000Z");
    const current = conversation(1, "2026-07-13T10:01:00.000Z");
    const merged = mergeServerSnapshot([server], [current], new Map(), 1);

    expect(merged[0].updatedAt).toBe("2026-07-13T10:02:00.000Z");
  });

  it("incrementa não lidas apenas para mensagens recebidas", () => {
    const initial = conversation(1, "2026-07-13T10:00:00.000Z");
    const received = applyMessageToConversationList([initial], message(), 1);
    const sentByMe = applyMessageToConversationList(
      [initial],
      message({ fromUserId: 1 }),
      1,
    );

    expect(received[0].unreadCount).toBe(1);
    expect(sentByMe[0].unreadCount).toBe(0);
  });

  it("atualiza edição e exclusão somente quando afetam a última mensagem", () => {
    const withLastMessage = applyMessageToConversationList(
      [conversation(1, "2026-07-13T10:00:00.000Z")],
      message(),
      1,
    );
    const edited = applyUpdatedMessageToList(
      withLastMessage,
      message({ text: "Editada", editedAt: "2026-07-13T10:04:00.000Z" }),
    );

    expect(edited[0].lastMessage?.text).toBe("Editada");
    expect(edited[0].updatedAt).toBe("2026-07-13T10:04:00.000Z");
  });
});
