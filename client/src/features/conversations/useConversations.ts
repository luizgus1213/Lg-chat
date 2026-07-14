import { useCallback, useEffect, useRef, useState } from "react";
import { ZodError } from "zod";

import { ApiError } from "../../api/apiClient";
import { useSocket } from "../../socket/useSocket";
import { getAuthErrorMessage } from "../auth/auth.errors";
import { chatMessageSchema } from "../messages/messages.schemas";
import { listConversations } from "./conversations.api";
import {
  chatUpdatedPayloadSchema,
  userStatusPayloadSchema,
  type Conversation,
} from "./conversations.schemas";
import { sortConversations } from "./conversations.utils";
import {
  applyMessageToConversationList,
  applyUpdatedMessageToList,
  mergeServerSnapshot,
} from "./conversations.store";

export type ConversationsStatus = "loading" | "ready" | "refreshing" | "error";

type UseConversationsOptions = {
  selectedChatId: number | null;
  currentUserId: number | null;
};

type RefreshOptions = {
  silent?: boolean;
  initial?: boolean;
};

type ConversationStore = {
  ownerUserId: number | null;
  items: Conversation[];
};

type LoadStore = {
  ownerUserId: number | null;
  status: ConversationsStatus;
  errorMessage: string | null;
  hasLoaded: boolean;
};

function isCancellation(error: unknown): boolean {
  return error instanceof ApiError && error.code === "REQUEST_CANCELLED";
}

function getConversationErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return "O servidor retornou dados de conversas inválidos.";
  }

  return getAuthErrorMessage(error);
}

export function useConversations({ currentUserId }: UseConversationsOptions) {
  const { socket } = useSocket();

  const [conversationStore, setConversationStore] = useState<ConversationStore>(
    { ownerUserId: null, items: [] },
  );
  const [loadStore, setLoadStore] = useState<LoadStore>({
    ownerUserId: null,
    status: "loading",
    errorMessage: null,
    hasLoaded: false,
  });

  const conversationStoreRef = useRef(conversationStore);
  const loadStoreRef = useRef(loadStore);
  const currentUserIdRef = useRef(currentUserId);
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const mutationVersionRef = useRef(0);
  const conversationMutationVersionsRef = useRef(new Map<number, number>());

  const updateConversationStore = useCallback(
    (updater: (current: ConversationStore) => ConversationStore) => {
      const next = updater(conversationStoreRef.current);

      if (next === conversationStoreRef.current) return;

      conversationStoreRef.current = next;
      setConversationStore(next);
    },
    [],
  );

  const updateLoadStore = useCallback(
    (updater: (current: LoadStore) => LoadStore) => {
      const next = updater(loadStoreRef.current);

      if (next === loadStoreRef.current) return;

      loadStoreRef.current = next;
      setLoadStore(next);
    },
    [],
  );

  const markConversationMutated = useCallback((chatId: number) => {
    const nextVersion = mutationVersionRef.current + 1;
    mutationVersionRef.current = nextVersion;
    conversationMutationVersionsRef.current.set(chatId, nextVersion);
  }, []);

  const visibleConversations =
    conversationStore.ownerUserId === currentUserId
      ? conversationStore.items
      : [];

  const status: ConversationsStatus =
    currentUserId === null
      ? "ready"
      : loadStore.ownerUserId === currentUserId
        ? loadStore.status
        : "loading";
  const errorMessage =
    loadStore.ownerUserId === currentUserId ? loadStore.errorMessage : null;

  const refresh = useCallback(
    async (options: RefreshOptions = {}) => {
      const ownerUserId = currentUserIdRef.current;
      if (!ownerUserId) return;

      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;

      activeRequestRef.current?.abort();

      const controller = new AbortController();
      activeRequestRef.current = controller;

      const requestMutationVersion = mutationVersionRef.current;
      const currentStore = conversationStoreRef.current;
      const currentLoad = loadStoreRef.current;
      const hasSnapshot =
        currentStore.ownerUserId === ownerUserId &&
        currentLoad.ownerUserId === ownerUserId &&
        currentLoad.hasLoaded;

      if (!options.silent && !options.initial) {
        updateLoadStore(() => ({
          ownerUserId,
          status: hasSnapshot ? "refreshing" : "loading",
          errorMessage: null,
          hasLoaded: hasSnapshot,
        }));
      }

      try {
        const response = await listConversations({ signal: controller.signal });

        if (
          requestSequence !== requestSequenceRef.current ||
          ownerUserId !== currentUserIdRef.current
        ) {
          return;
        }

        const latestStore = conversationStoreRef.current;
        const items =
          latestStore.ownerUserId === ownerUserId
            ? mergeServerSnapshot(
                response.data,
                latestStore.items,
                conversationMutationVersionsRef.current,
                requestMutationVersion,
              )
            : sortConversations(response.data);

        updateConversationStore(() => ({ ownerUserId, items }));
        updateLoadStore(() => ({
          ownerUserId,
          status: "ready",
          errorMessage: null,
          hasLoaded: true,
        }));
      } catch (error: unknown) {
        if (
          requestSequence !== requestSequenceRef.current ||
          ownerUserId !== currentUserIdRef.current ||
          isCancellation(error)
        ) {
          return;
        }

        updateLoadStore(() => ({
          ownerUserId,
          status: hasSnapshot ? "ready" : "error",
          errorMessage: getConversationErrorMessage(error),
          hasLoaded: hasSnapshot,
        }));
      } finally {
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }
      }
    },
    [updateConversationStore, updateLoadStore],
  );

  const confirmConversationRead = useCallback(
    (chatId: number, confirmedMessageId?: number) => {
      if (!Number.isInteger(chatId) || chatId <= 0) return;

      const ownerUserId = currentUserIdRef.current;
      if (!ownerUserId) return;

      let needsExactSync = false;

      updateConversationStore((current) => {
        if (current.ownerUserId !== ownerUserId) return current;

        let changed = false;
        const items = current.items.map((conversation) => {
          if (conversation.id !== chatId) return conversation;

          const validConfirmedId =
            typeof confirmedMessageId === "number" &&
            Number.isInteger(confirmedMessageId) &&
            confirmedMessageId > 0
              ? confirmedMessageId
              : null;
          const hasNewerMessage = Boolean(
            validConfirmedId &&
            conversation.lastMessage &&
            conversation.lastMessage.id > validConfirmedId,
          );
          const nextUnreadCount = hasNewerMessage
            ? conversation.unreadCount
            : 0;
          const nextLastReadMessageId = validConfirmedId
            ? Math.max(conversation.lastReadMessageId ?? 0, validConfirmedId)
            : conversation.lastReadMessageId;

          if (
            nextUnreadCount === conversation.unreadCount &&
            nextLastReadMessageId === conversation.lastReadMessageId
          ) {
            return conversation;
          }

          changed = true;
          needsExactSync ||= hasNewerMessage;

          return {
            ...conversation,
            unreadCount: nextUnreadCount,
            lastReadMessageId: nextLastReadMessageId,
          };
        });

        if (!changed) return current;

        markConversationMutated(chatId);
        return { ...current, items };
      });

      if (needsExactSync) {
        void refresh({ silent: true });
      }
    },
    [markConversationMutated, refresh, updateConversationStore],
  );

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    activeRequestRef.current?.abort();
    requestSequenceRef.current += 1;
    mutationVersionRef.current = 0;
    conversationMutationVersionsRef.current.clear();

    if (currentUserId) {
      void refresh({ initial: true });
    }

    return () => {
      requestSequenceRef.current += 1;
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    };
  }, [currentUserId, refresh]);

  useEffect(() => {
    if (!socket || !currentUserId) return;

    const userId = currentUserId;

    function logInvalidEvent(eventName: string, error: ZodError) {
      if (import.meta.env.DEV) {
        console.warn(`[LG Chat] Evento ${eventName} inválido.`, error.issues);
      }
    }

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
        logInvalidEvent("chat_message", parsed.error);
        return;
      }

      if (!hasConversation(parsed.data.chatId)) {
        queueEventSync();
        return;
      }

      updateConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        const items = applyMessageToConversationList(
          current.items,
          parsed.data,
          userId,
        );

        if (items === current.items) return current;

        markConversationMutated(parsed.data.chatId);
        return { ...current, items };
      });
    }

    function handleChatMessageUpdated(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);

      if (!parsed.success) {
        logInvalidEvent("chat_message_updated", parsed.error);
        return;
      }

      if (!hasConversation(parsed.data.chatId)) {
        queueEventSync();
        return;
      }

      updateConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        const items = applyUpdatedMessageToList(current.items, parsed.data);
        if (items === current.items) return current;

        markConversationMutated(parsed.data.chatId);
        return { ...current, items };
      });
    }

    function handleChatUpdated(payload: unknown) {
      const parsed = chatUpdatedPayloadSchema.safeParse(payload);

      if (!parsed.success) {
        logInvalidEvent("chat_updated", parsed.error);
        return;
      }

      if (!hasConversation(parsed.data.chatId)) {
        queueEventSync();
        return;
      }

      const data = parsed.data;

      updateConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        let changed = false;
        const updatedItems = current.items.map((conversation) => {
          if (conversation.id !== data.chatId) return conversation;

          const nextConversation = {
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

          changed =
            nextConversation.updatedAt !== conversation.updatedAt ||
            nextConversation.name !== conversation.name ||
            nextConversation.description !== conversation.description ||
            nextConversation.avatarUrl !== conversation.avatarUrl;

          return changed ? nextConversation : conversation;
        });

        if (!changed) return current;

        markConversationMutated(data.chatId);
        return { ...current, items: sortConversations(updatedItems) };
      });
    }

    function handleUserStatus(payload: unknown) {
      const parsed = userStatusPayloadSchema.safeParse(payload);

      if (!parsed.success) {
        logInvalidEvent("user_status", parsed.error);
        return;
      }

      const data = parsed.data;

      updateConversationStore((current) => {
        if (current.ownerUserId !== userId) return current;

        const changedChatIds: number[] = [];
        const items = current.items.map((conversation) => {
          const privateUser = conversation.privateUser;
          if (privateUser?.id !== data.userId) return conversation;

          const lastSeenAt =
            data.lastSeenAt === undefined
              ? privateUser.lastSeenAt
              : data.lastSeenAt;

          if (
            privateUser.isOnline === data.isOnline &&
            privateUser.lastSeenAt === lastSeenAt
          ) {
            return conversation;
          }

          changedChatIds.push(conversation.id);

          return {
            ...conversation,
            privateUser: {
              ...privateUser,
              isOnline: data.isOnline,
              lastSeenAt,
            },
          };
        });

        if (changedChatIds.length === 0) return current;

        for (const chatId of changedChatIds) {
          markConversationMutated(chatId);
        }

        return { ...current, items };
      });
    }

    function handleReconnect() {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      // O Manager emite uma vez por reconexão concluída. O backend já
      // reinscreve todas as salas do usuário antes dos próximos eventos.
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
  }, [
    socket,
    currentUserId,
    markConversationMutated,
    refresh,
    updateConversationStore,
  ]);

  return {
    conversations: visibleConversations,
    status,
    errorMessage,
    refresh,
    confirmConversationRead,
  };
}
