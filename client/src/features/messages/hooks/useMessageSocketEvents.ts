import { useEffect, type MutableRefObject } from "react";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@shared/publicContracts";

import {
  chatMessageSchema,
  chatReadEventSchema,
  type ChatMessage,
} from "../messages.schemas";
import {
  asSentMessage,
  mergeOneMessage,
  mergeRealtimeUpdate,
} from "../messages.store";

export type PendingMessageConfirmation = {
  confirm: () => void;
  cancel: () => void;
};

type Options = {
  socket: Socket | null;
  chatId: number;
  currentUserId: number;
  confirmedClientIdsRef: MutableRefObject<Set<string>>;
  pendingConfirmationsRef: MutableRefObject<
    Map<string, PendingMessageConfirmation>
  >;
  commitMessages: (updater: (current: ChatMessage[]) => ChatMessage[]) => void;
  canConfirmRead: () => boolean;
  scheduleMarkRead: (messageId: number) => void;
};

export function useMessageSocketEvents({
  socket,
  chatId,
  currentUserId,
  confirmedClientIdsRef,
  pendingConfirmationsRef,
  commitMessages,
  canConfirmRead,
  scheduleMarkRead,
}: Options) {
  useEffect(() => {
    if (!socket) return;
    const boundSocket = socket;

    function joinCurrentChat() {
      if (boundSocket.connected) {
        boundSocket.emit(SOCKET_EVENTS.joinChat, { chatId });
      }
    }

    function handleMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success) {
        if (import.meta.env.DEV) {
          console.error("[LG Chat] Mensagem inválida recebida:", parsed.error);
        }
        return;
      }

      const message = parsed.data;
      if (message.chatId !== chatId) return;

      if (message.clientId) {
        confirmedClientIdsRef.current.add(message.clientId);
      }

      commitMessages((current) =>
        mergeOneMessage(current, asSentMessage(message)),
      );
      if (message.clientId) {
        pendingConfirmationsRef.current.get(message.clientId)?.confirm();
      }

      if (message.fromUserId !== currentUserId && canConfirmRead()) {
        scheduleMarkRead(message.id);
      }
    }

    function handleUpdatedMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success || parsed.data.chatId !== chatId) return;
      commitMessages((current) => mergeRealtimeUpdate(current, parsed.data));
    }

    function handleChatRead(payload: unknown) {
      const parsed = chatReadEventSchema.safeParse(payload);
      if (
        !parsed.success ||
        parsed.data.chatId !== chatId ||
        parsed.data.userId === currentUserId
      ) {
        return;
      }

      commitMessages((current) =>
        current.map((message) =>
          message.fromUserId === currentUserId &&
          message.id > 0 &&
          message.id <= parsed.data.lastReadMessageId
            ? { ...message, deliveryStatus: "read" as const }
            : message,
        ),
      );
    }

    joinCurrentChat();
    boundSocket.on("connect", joinCurrentChat);
    boundSocket.on(SOCKET_EVENTS.chatMessage, handleMessage);
    boundSocket.on(SOCKET_EVENTS.chatMessageUpdated, handleUpdatedMessage);
    boundSocket.on(SOCKET_EVENTS.chatRead, handleChatRead);

    return () => {
      boundSocket.off("connect", joinCurrentChat);
      boundSocket.off(SOCKET_EVENTS.chatMessage, handleMessage);
      boundSocket.off(SOCKET_EVENTS.chatMessageUpdated, handleUpdatedMessage);
      boundSocket.off(SOCKET_EVENTS.chatRead, handleChatRead);
    };
  }, [
    canConfirmRead,
    chatId,
    commitMessages,
    confirmedClientIdsRef,
    currentUserId,
    pendingConfirmationsRef,
    scheduleMarkRead,
    socket,
  ]);
}
