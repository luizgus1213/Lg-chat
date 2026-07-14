import { describe, expect, it } from "vitest";

import type { ChatMessage, ServerChatMessage } from "./messages.schemas";
import {
  asSentMessage,
  canConfirmMessageRead,
  hasServerConfirmation,
  mergeOneMessage,
  mergeRealtimeUpdate,
} from "./messages.store";

function serverMessage(
  overrides: Partial<ServerChatMessage> = {},
): ServerChatMessage {
  return {
    id: 42,
    chatId: 7,
    fromUserId: 3,
    text: "Olá",
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
    createdAt: "2026-07-13T12:00:00.000Z",
    updatedAt: null,
    clientId: "client-1",
    replyTo: null,
    reactions: [],
    isStarred: false,
    deliveryStatus: "sent",
    ...overrides,
  };
}

function optimisticMessage(): ChatMessage {
  return {
    ...serverMessage({ id: -1 }),
    clientStatus: "sending",
    localError: null,
  };
}

describe("reconciliação de mensagens", () => {
  it("reconcilia ACK antes do broadcast sem duplicar", () => {
    const optimistic = optimisticMessage();
    const ack = asSentMessage(serverMessage());
    const afterAck = mergeOneMessage([optimistic], ack);
    const afterBroadcast = mergeOneMessage(afterAck, ack);

    expect(afterBroadcast).toHaveLength(1);
    expect(afterBroadcast[0]).toMatchObject({ id: 42, clientStatus: "sent" });
  });

  it("reconcilia broadcast antes do ACK sem duplicar", () => {
    const optimistic = optimisticMessage();
    const broadcast = asSentMessage(serverMessage());
    const afterBroadcast = mergeOneMessage([optimistic], broadcast);
    const afterAck = mergeOneMessage(afterBroadcast, broadcast);

    expect(afterAck).toHaveLength(1);
    expect(afterAck[0].clientId).toBe("client-1");
  });

  it("preserva a reação local ao receber resumo remoto", () => {
    const current = serverMessage({
      reactions: [{ emoji: "👍", count: 1, reactedByMe: true }],
    });
    const incoming = serverMessage({
      reactions: [{ emoji: "👍", count: 2, reactedByMe: false }],
    });

    const [merged] = mergeRealtimeUpdate([current], incoming);
    expect(merged.reactions[0]).toEqual({
      emoji: "👍",
      count: 2,
      reactedByMe: true,
    });
  });

  it("considera o broadcast confirmação quando o ACK não chega", () => {
    const broadcast = asSentMessage(serverMessage());

    expect(hasServerConfirmation([broadcast], new Set(), "client-1")).toBe(
      true,
    );
  });

  it("reconcilia retry com o mesmo clientId sem criar duplicata", () => {
    const failed = {
      ...optimisticMessage(),
      clientStatus: "error" as const,
      localError: "Tempo esgotado",
    };
    const confirmed = asSentMessage(serverMessage());

    const result = mergeOneMessage([failed], confirmed);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 42, clientId: "client-1" });
  });
});

describe("confirmação de leitura", () => {
  it("exige página visível, focada e posicionada no final", () => {
    expect(
      canConfirmMessageRead({
        isAtBottom: true,
        isDocumentVisible: true,
        hasDocumentFocus: true,
      }),
    ).toBe(true);
    expect(
      canConfirmMessageRead({
        isAtBottom: false,
        isDocumentVisible: true,
        hasDocumentFocus: true,
      }),
    ).toBe(false);
    expect(
      canConfirmMessageRead({
        isAtBottom: true,
        isDocumentVisible: false,
        hasDocumentFocus: true,
      }),
    ).toBe(false);
  });
});
