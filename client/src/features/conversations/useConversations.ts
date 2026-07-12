import { useCallback, useEffect, useState } from "react";

import { z } from "zod";

import { getAuthErrorMessage } from "../auth/auth.errors";
import { useSocket } from "../../socket/useSocket";

import { listConversations } from "./conversations.api";

import {
  chatMessageSchema,
  type ServerChatMessage,
} from "../messages/messages.schemas";

import type { Conversation } from "./conversations.schemas";

export type ConversationsStatus = "loading" | "ready" | "error";

type UseConversationsOptions = {
  selectedChatId: number | null;
  currentUserId: number | null;
};

type ConversationLastMessage = NonNullable<Conversation["lastMessage"]>;

const chatUpdatedPayloadSchema = z
  .object({
    chatId: z.number().int().positive(),

    updatedAt: z.string().min(1).optional(),

    name: z.string().nullable().optional(),

    description: z.string().nullable().optional(),

    avatarUrl: z.string().nullable().optional(),
  })
  .passthrough();

const userStatusPayloadSchema = z.object({
  userId: z.number().int().positive(),
  isOnline: z.boolean(),

  lastSeenAt: z.string().nullable().optional(),
});

function getTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((first, second) => {
    if (first.isPinned !== second.isPinned) {
      return Number(second.isPinned) - Number(first.isPinned);
    }

    if (first.isPinned && second.isPinned) {
      const pinnedDifference =
        getTimestamp(second.pinnedAt) - getTimestamp(first.pinnedAt);

      if (pinnedDifference !== 0) {
        return pinnedDifference;
      }
    }

    const firstUpdatedAt = first.lastMessage?.createdAt || first.updatedAt;

    const secondUpdatedAt = second.lastMessage?.createdAt || second.updatedAt;

    return getTimestamp(secondUpdatedAt) - getTimestamp(firstUpdatedAt);
  });
}

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

    ...(message.updatedAt
      ? {
          updatedAt: message.updatedAt,
        }
      : {}),

    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
  };
}

function applyMessageToConversationList(
  conversations: Conversation[],
  message: ServerChatMessage,
  options: {
    selectedChatId: number | null;
    currentUserId: number | null;
  },
): Conversation[] {
  let conversationFound = false;

  const updatedConversations = conversations.map((conversation) => {
    if (conversation.id !== message.chatId) {
      return conversation;
    }

    conversationFound = true;

    const alreadyApplied = conversation.lastMessage?.id === message.id;

    const isOwnMessage = message.fromUserId === options.currentUserId;

    const isOpenAndVisible =
      options.selectedChatId === message.chatId &&
      document.visibilityState === "visible";

    let unreadCount = conversation.unreadCount;

    if (isOpenAndVisible) {
      unreadCount = 0;
    } else if (!isOwnMessage && !alreadyApplied) {
      unreadCount += 1;
    }

    return {
      ...conversation,

      lastMessage: toConversationLastMessage(message),

      updatedAt: message.createdAt,

      unreadCount,
    };
  });

  if (!conversationFound) {
    /*
      O evento pertence a um chat que ainda não
      está na lista local.

      Não fazemos uma requisição automática aqui.
      O chat aparecerá ao atualizar ou reconectar.
    */
    return conversations;
  }

  return sortConversations(updatedConversations);
}

function applyUpdatedMessageToList(
  conversations: Conversation[],
  message: ServerChatMessage,
): Conversation[] {
  const updatedConversations = conversations.map((conversation) => {
    if (
      conversation.id !== message.chatId ||
      conversation.lastMessage?.id !== message.id
    ) {
      return conversation;
    }

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

  return sortConversations(updatedConversations);
}

export function useConversations({
  selectedChatId,
  currentUserId,
}: UseConversationsOptions) {
  const { socket } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [status, setStatus] = useState<ConversationsStatus>("loading");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await listConversations();

      setConversations(sortConversations(response.data));

      setStatus("ready");
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));

      setStatus("error");
    }
  }, []);

  const markConversationAsReadLocally = useCallback((chatId: number) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === chatId
          ? {
              ...conversation,
              unreadCount: 0,
            }
          : conversation,
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listConversations()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setConversations(sortConversations(response.data));

        setErrorMessage(null);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(getAuthErrorMessage(error));

        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    function handleChatMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);

      if (!parsed.success) {
        console.error(
          "[LG Chat] Mensagem inválida recebida para a lista:",
          parsed.error,
        );

        return;
      }

      setConversations((current) =>
        applyMessageToConversationList(current, parsed.data, {
          selectedChatId,
          currentUserId,
        }),
      );
    }

    function handleChatMessageUpdated(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);

      if (!parsed.success) {
        console.error(
          "[LG Chat] Atualização de mensagem inválida:",
          parsed.error,
        );

        return;
      }

      setConversations((current) =>
        applyUpdatedMessageToList(current, parsed.data),
      );
    }

    function handleChatUpdated(payload: unknown) {
      const parsed = chatUpdatedPayloadSchema.safeParse(payload);

      if (!parsed.success) {
        console.error("[LG Chat] Atualização de chat inválida:", parsed.error);

        return;
      }

      const data = parsed.data;

      setConversations((current) => {
        const updated = current.map((conversation) => {
          if (conversation.id !== data.chatId) {
            return conversation;
          }

          return {
            ...conversation,

            updatedAt: data.updatedAt ?? conversation.updatedAt,

            name: data.name === undefined ? conversation.name : data.name,

            description:
              data.description === undefined
                ? conversation.description
                : data.description,

            avatarUrl:
              data.avatarUrl === undefined
                ? conversation.avatarUrl
                : data.avatarUrl,
          };
        });

        return sortConversations(updated);
      });
    }

    function handleUserStatus(payload: unknown) {
      const parsed = userStatusPayloadSchema.safeParse(payload);

      if (!parsed.success) {
        console.error("[LG Chat] Status de usuário inválido:", parsed.error);

        return;
      }

      const data = parsed.data;

      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.privateUser?.id !== data.userId) {
            return conversation;
          }

          return {
            ...conversation,

            privateUser: {
              ...conversation.privateUser,

              isOnline: data.isOnline,

              lastSeenAt:
                data.lastSeenAt === undefined
                  ? conversation.privateUser.lastSeenAt
                  : data.lastSeenAt,
            },
          };
        }),
      );
    }

    function handleReconnect() {
      /*
        Uma única sincronização após reconectar.

        Não é polling.
      */
      void refresh();
    }

    socket.on("chat_message", handleChatMessage);

    socket.on("chat_message_updated", handleChatMessageUpdated);

    socket.on("chat_updated", handleChatUpdated);

    socket.on("user_status", handleUserStatus);

    socket.io.on("reconnect", handleReconnect);

    return () => {
      socket.off("chat_message", handleChatMessage);

      socket.off("chat_message_updated", handleChatMessageUpdated);

      socket.off("chat_updated", handleChatUpdated);

      socket.off("user_status", handleUserStatus);

      socket.io.off("reconnect", handleReconnect);
    };
  }, [socket, selectedChatId, currentUserId, refresh]);

  return {
    conversations,
    status,
    errorMessage,

    refresh,
    markConversationAsReadLocally,
  };
}
