import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { getAuthErrorMessage } from "../auth/auth.errors";
import {
  chatMessageSchema,
  type ServerChatMessage,
} from "../messages/messages.schemas";
import { useSocket } from "../../socket/useSocket";
import { listConversations } from "./conversations.api";
import type { Conversation } from "./conversations.schemas";

export type ConversationsStatus =
  | "loading"
  | "ready"
  | "refreshing"
  | "error";

type UseConversationsOptions = {
  selectedChatId: number | null;
  currentUserId: number | null;
};

type ConversationStore = {
  ownerUserId: number | null;
  items: Conversation[];
};

type LoadStore = {
  ownerUserId: number | null;
  status: ConversationsStatus;
  errorMessage: string | null;
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
  if (!value) return 0;
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

      if (pinnedDifference !== 0) return pinnedDifference;
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
    ...(message.updatedAt ? { updatedAt: message.updatedAt } : {}),
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
  };
}

function applyMessageToConversationList(
  conversations: Conversation[],
  message: ServerChatMessage,
  currentUserId: number,
): Conversation[] {
  const updated = conversations.map((conversation) => {
    if (conversation.id !== message.chatId) return conversation;

    const alreadyApplied = conversation.lastMessage?.id === message.id;
    const isOwnMessage = message.fromUserId === currentUserId;

    return {
      ...conversation,
      lastMessage: toConversationLastMessage(message),
      updatedAt: message.createdAt,
      unreadCount:
        !isOwnMessage && !alreadyApplied
          ? conversation.unreadCount + 1
          : conversation.unreadCount,
    };
  });

  return sortConversations(updated);
}

function applyUpdatedMessageToList(
  conversations: Conversation[],
  message: ServerChatMessage,
): Conversation[] {
  return sortConversations(
    conversations.map((conversation) => {
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
    }),
  );
}

export function useConversations({
  selectedChatId,
  currentUserId,
}: UseConversationsOptions) {
  const { socket } = useSocket();

  const [conversationStore, setConversationStore] =
    useState<ConversationStore>({ ownerUserId: null, items: [] });
  const [loadStore, setLoadStore] = useState<LoadStore>({
    ownerUserId: null,
    status: "loading",
    errorMessage: null,
  });

  const conversationStoreRef = useRef(conversationStore);
  const currentUserIdRef = useRef(currentUserId);
  const requestSequenceRef = useRef(0);
  const syncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    conversationStoreRef.current = conversationStore;
  }, [conversationStore]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const visibleConversations =
    conversationStore.ownerUserId === currentUserId
      ? conversationStore.items
      : [];

  const status =
    loadStore.ownerUserId === currentUserId ? loadStore.status : "loading";
  const errorMessage =
    loadStore.ownerUserId === currentUserId ? loadStore.errorMessage : null;

  const refresh = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const ownerUserId = currentUserIdRef.current;
      if (!ownerUserId) return;

      const requestSequence = ++requestSequenceRef.current;
      const hasVisibleData =
        conversationStoreRef.current.ownerUserId === ownerUserId &&
        conversationStoreRef.current.items.length > 0;

      if (!options.silent) {
        setLoadStore({
          ownerUserId,
          status: hasVisibleData ? "refreshing" : "loading",
          errorMessage: null,
        });
      }

      try {
        const response = await listConversations();

        if (
          requestSequence !== requestSequenceRef.current ||
          ownerUserId !== currentUserIdRef.current
        ) {
          return;
        }

        setConversationStore({
          ownerUserId,
          items: sortConversations(response.data),
        });
        setLoadStore({
          ownerUserId,
          status: "ready",
          errorMessage: null,
        });
      } catch (error: unknown) {
        if (
          requestSequence !== requestSequenceRef.current ||
          ownerUserId !== currentUserIdRef.current
        ) {
          return;
        }

        setLoadStore({
          ownerUserId,
          status: hasVisibleData ? "ready" : "error",
          errorMessage: getAuthErrorMessage(error),
        });
      }
    },
    [],
  );

  const confirmConversationRead = useCallback((chatId: number) => {
    const ownerUserId = currentUserIdRef.current;
    if (!ownerUserId) return;

    setConversationStore((current) => {
      if (current.ownerUserId !== ownerUserId) return current;

      return {
        ...current,
        items: current.items.map((conversation) =>
          conversation.id === chatId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      };
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const ownerUserId = currentUserId;
    const requestSequence = ++requestSequenceRef.current;
    const controller = new AbortController();
    let active = true;

    void listConversations({ signal: controller.signal })
      .then((response) => {
        if (
          !active ||
          requestSequence !== requestSequenceRef.current ||
          ownerUserId !== currentUserIdRef.current
        ) {
          return;
        }

        setConversationStore({
          ownerUserId,
          items: sortConversations(response.data),
        });
        setLoadStore({
          ownerUserId,
          status: "ready",
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (
          !active ||
          requestSequence !== requestSequenceRef.current ||
          ownerUserId !== currentUserIdRef.current
        ) {
          return;
        }

        setLoadStore({
          ownerUserId,
          status: "error",
          errorMessage: getAuthErrorMessage(error),
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!socket || !currentUserId) return;

    const userId = currentUserId;

    function queueEventSync() {
      if (syncTimerRef.current !== null) return;

      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null;
        void refresh({ silent: true });
      }, 250);
    }

    function hasConversation(chatId: number) {
      return (
        conversationStoreRef.current.ownerUserId === userId &&
        conversationStoreRef.current.items.some(
          (conversation) => conversation.id === chatId,
        )
      );
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

      if (!hasConversation(parsed.data.chatId)) {
        queueEventSync();
        return;
      }

      setConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        return {
          ...current,
          items: applyMessageToConversationList(
            current.items,
            parsed.data,
            userId,
          ),
        };
      });
    }

    function handleChatMessageUpdated(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success) return;

      setConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        return {
          ...current,
          items: applyUpdatedMessageToList(current.items, parsed.data),
        };
      });
    }

    function handleChatUpdated(payload: unknown) {
      const parsed = chatUpdatedPayloadSchema.safeParse(payload);
      if (!parsed.success) return;

      if (!hasConversation(parsed.data.chatId)) {
        queueEventSync();
        return;
      }

      const data = parsed.data;

      setConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        return {
          ...current,
          items: sortConversations(
            current.items.map((conversation) =>
              conversation.id !== data.chatId
                ? conversation
                : {
                    ...conversation,
                    updatedAt: data.updatedAt ?? conversation.updatedAt,
                    name:
                      data.name === undefined ? conversation.name : data.name,
                    description:
                      data.description === undefined
                        ? conversation.description
                        : data.description,
                    avatarUrl:
                      data.avatarUrl === undefined
                        ? conversation.avatarUrl
                        : data.avatarUrl,
                  },
            ),
          ),
        };
      });
    }

    function handleUserStatus(payload: unknown) {
      const parsed = userStatusPayloadSchema.safeParse(payload);
      if (!parsed.success) return;

      const data = parsed.data;

      setConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        return {
          ...current,
          items: current.items.map((conversation) => {
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
        };
      });
    }

    function handleReconnect() {
      void refresh({ silent: true });
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

      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [socket, currentUserId, selectedChatId, refresh]);

  return {
    conversations: visibleConversations,
    status,
    errorMessage,
    refresh,
    confirmConversationRead,
  };
}
