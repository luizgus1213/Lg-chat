import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../api/apiClient";
import { useSocket } from "../../../socket/useSocket";
import { getAuthErrorMessage } from "../../auth/auth.errors";
import { listMessages, markChatAsRead } from "../api/messages.api";
import { chatMessageSchema, type ChatMessage } from "../messages.schemas";

const PAGE_SIZE = 30;
const SOCKET_ACK_TIMEOUT_MS = 15_000;
const READ_DEBOUNCE_MS = 350;

type SocketAck = {
  success: boolean;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

type UseMessagesOptions = {
  chatId: number;
  currentUserId: number;
  onReadConfirmed?: (chatId: number, messageId: number) => void;
};

function compareMessages(first: ChatMessage, second: ChatMessage) {
  const firstTime = new Date(first.createdAt).getTime();
  const secondTime = new Date(second.createdAt).getTime();

  if (firstTime !== secondTime) return firstTime - secondTime;
  return first.id - second.id;
}

function mergeOneMessage(
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

  if (targetIndex >= 0) {
    next[targetIndex] = { ...next[targetIndex], ...incoming };
  } else {
    next.push(incoming);
  }

  return next.sort(compareMessages);
}

function mergeManyMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  return incoming.reduce(
    (messages, message) => mergeOneMessage(messages, message),
    current,
  );
}

function createClientId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAckErrorMessage(ack: SocketAck) {
  return ack.error?.message || "Não foi possível enviar a mensagem.";
}

function isCancellation(error: unknown) {
  return error instanceof ApiError && error.code === "REQUEST_CANCELLED";
}

export function useMessages({
  chatId,
  currentUserId,
  onReadConfirmed,
}: UseMessagesOptions) {
  const { socket, status: socketStatus } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readErrorMessage, setReadErrorMessage] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const requestSequenceRef = useRef(0);
  const localMessageIdRef = useRef(-1);
  const viewportAtBottomRef = useRef(false);
  const readTimerRef = useRef<number | null>(null);
  const pendingReadIdRef = useRef(0);
  const lastConfirmedReadIdRef = useRef(0);
  const confirmedClientIdsRef = useRef(new Set<string>());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const canConfirmRead = useCallback(() => {
    return (
      viewportAtBottomRef.current &&
      document.visibilityState === "visible" &&
      document.hasFocus()
    );
  }, []);

  const flushPendingRead = useCallback(async () => {
    if (!canConfirmRead()) return;

    const messageId = pendingReadIdRef.current;

    if (messageId <= lastConfirmedReadIdRef.current || messageId <= 0) {
      return;
    }

    pendingReadIdRef.current = 0;

    try {
      const response = await markChatAsRead(chatId, messageId);
      const confirmedId = response.data.lastReadMessageId;

      lastConfirmedReadIdRef.current = Math.max(
        lastConfirmedReadIdRef.current,
        confirmedId,
      );
      setReadErrorMessage(null);
      onReadConfirmed?.(chatId, confirmedId);
    } catch (error: unknown) {
      pendingReadIdRef.current = Math.max(
        pendingReadIdRef.current,
        messageId,
      );
      setReadErrorMessage(getAuthErrorMessage(error));
    }
  }, [canConfirmRead, chatId, onReadConfirmed]);

  const scheduleMarkRead = useCallback(
    (messageId: number) => {
      if (messageId <= 0) return;

      pendingReadIdRef.current = Math.max(
        pendingReadIdRef.current,
        messageId,
      );

      if (readTimerRef.current !== null) {
        window.clearTimeout(readTimerRef.current);
      }

      readTimerRef.current = window.setTimeout(() => {
        readTimerRef.current = null;
        void flushPendingRead();
      }, READ_DEBOUNCE_MS);
    },
    [flushPendingRead],
  );

  const scheduleLatestReceivedAsRead = useCallback(() => {
    const latestReceivedMessage = [...messagesRef.current]
      .reverse()
      .find(
        (message) =>
          message.id > 0 && message.fromUserId !== currentUserId,
      );

    if (latestReceivedMessage) {
      scheduleMarkRead(latestReceivedMessage.id);
    }
  }, [currentUserId, scheduleMarkRead]);

  const setViewportAtBottom = useCallback(
    (isAtBottom: boolean) => {
      viewportAtBottomRef.current = isAtBottom;

      if (isAtBottom) {
        scheduleLatestReceivedAsRead();
      }
    },
    [scheduleLatestReceivedAsRead],
  );

  useEffect(() => {
    const sequence = ++requestSequenceRef.current;
    const controller = new AbortController();
    let active = true;

    void listMessages(
      chatId,
      { limit: PAGE_SIZE },
      { signal: controller.signal },
    )
      .then((response) => {
        if (!active || sequence !== requestSequenceRef.current) return;

        const loadedMessages: ChatMessage[] = response.data.map((message) => ({
          ...message,
          clientStatus: "sent",
        }));

        setMessages(loadedMessages);
        setHasMore(loadedMessages.length === PAGE_SIZE);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (
          !active ||
          sequence !== requestSequenceRef.current ||
          isCancellation(error)
        ) {
          return;
        }

        setErrorMessage(getAuthErrorMessage(error));
      })
      .finally(() => {
        if (active && sequence === requestSequenceRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
      requestSequenceRef.current += 1;
    };
  }, [chatId]);

  useEffect(() => {
    if (!socket) return;

    function handleMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);

      if (!parsed.success) {
        console.error("[LG Chat] Mensagem inválida recebida:", parsed.error);
        return;
      }

      const message = parsed.data;
      if (message.chatId !== chatId) return;

      if (message.clientId) {
        confirmedClientIdsRef.current.add(message.clientId);
      }

      setMessages((current) =>
        mergeOneMessage(current, {
          ...message,
          clientStatus: "sent",
          localError: null,
        }),
      );

      if (message.fromUserId !== currentUserId && canConfirmRead()) {
        scheduleMarkRead(message.id);
      }
    }

    function handleUpdatedMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success || parsed.data.chatId !== chatId) return;

      setMessages((current) =>
        mergeOneMessage(current, {
          ...parsed.data,
          clientStatus: "sent",
          localError: null,
        }),
      );
    }

    socket.emit("join_chat", { chatId });
    socket.on("chat_message", handleMessage);
    socket.on("chat_message_updated", handleUpdatedMessage);

    return () => {
      socket.off("chat_message", handleMessage);
      socket.off("chat_message_updated", handleUpdatedMessage);
    };
  }, [
    socket,
    chatId,
    currentUserId,
    canConfirmRead,
    scheduleMarkRead,
  ]);

  useEffect(() => {
    function tryConfirmVisibleMessages() {
      if (canConfirmRead()) {
        scheduleLatestReceivedAsRead();
      }
    }

    document.addEventListener("visibilitychange", tryConfirmVisibleMessages);
    window.addEventListener("focus", tryConfirmVisibleMessages);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        tryConfirmVisibleMessages,
      );
      window.removeEventListener("focus", tryConfirmVisibleMessages);
    };
  }, [canConfirmRead, scheduleLatestReceivedAsRead]);

  useEffect(() => {
    return () => {
      if (readTimerRef.current !== null) {
        window.clearTimeout(readTimerRef.current);
      }
    };
  }, []);

  const reload = useCallback(async () => {
    const sequence = ++requestSequenceRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await listMessages(chatId, { limit: PAGE_SIZE });
      if (sequence !== requestSequenceRef.current) return;

      setMessages(
        response.data.map((message) => ({
          ...message,
          clientStatus: "sent",
        })),
      );
      setHasMore(response.data.length === PAGE_SIZE);
    } catch (error: unknown) {
      if (sequence !== requestSequenceRef.current) return;
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (sequence === requestSequenceRef.current) {
        setIsLoading(false);
      }
    }
  }, [chatId]);

  const loadOlder = useCallback(async () => {
    if (isLoadingOlder || !hasMore) return;

    const oldestMessage = messagesRef.current.find((message) => message.id > 0);

    if (!oldestMessage) {
      setHasMore(false);
      return;
    }

    setIsLoadingOlder(true);
    setErrorMessage(null);

    try {
      const response = await listMessages(chatId, {
        limit: PAGE_SIZE,
        beforeId: oldestMessage.id,
      });

      const olderMessages: ChatMessage[] = response.data.map((message) => ({
        ...message,
        clientStatus: "sent",
      }));

      setMessages((current) => mergeManyMessages(current, olderMessages));
      setHasMore(olderMessages.length === PAGE_SIZE);
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsLoadingOlder(false);
    }
  }, [chatId, hasMore, isLoadingOlder]);

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();

      if (!text) throw new Error("Digite uma mensagem.");
      if (text.length > 1_000) {
        throw new Error("A mensagem pode ter no máximo 1.000 caracteres.");
      }
      if (!socket?.connected) {
        throw new Error("Sem conexão em tempo real. Aguarde a reconexão.");
      }

      const clientId = createClientId();
      const now = new Date().toISOString();
      const optimisticMessage: ChatMessage = {
        id: localMessageIdRef.current--,
        chatId,
        fromUserId: currentUserId,
        text,
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
        createdAt: now,
        updatedAt: null,
        clientId,
        replyTo: null,
        reactions: [],
        isStarred: false,
        clientStatus: "sending",
        localError: null,
      };

      setMessages((current) => mergeOneMessage(current, optimisticMessage));
      setIsSending(true);

      try {
        await new Promise<void>((resolve, reject) => {
          let settled = false;

          const timeout = window.setTimeout(() => {
            if (settled) return;

            const alreadyConfirmed =
              confirmedClientIdsRef.current.has(clientId) ||
              messagesRef.current.some(
                (message) => message.clientId === clientId && message.id > 0,
              );

            settled = true;

            if (alreadyConfirmed) {
              resolve();
              return;
            }

            reject(
              new Error("O servidor demorou demais para confirmar o envio."),
            );
          }, SOCKET_ACK_TIMEOUT_MS);

          socket.emit(
            "chat_message",
            { chatId, text, clientId },
            (ack: SocketAck) => {
              if (settled) return;

              settled = true;
              window.clearTimeout(timeout);

              if (!ack?.success) {
                reject(new Error(getAckErrorMessage(ack)));
                return;
              }

              const parsed = chatMessageSchema.safeParse(ack.data);

              if (!parsed.success) {
                reject(new Error("O servidor retornou uma mensagem inválida."));
                return;
              }

              const confirmedMessage: ChatMessage = {
                ...parsed.data,
                clientId: parsed.data.clientId || clientId,
                clientStatus: "sent",
                localError: null,
              };

              confirmedClientIdsRef.current.add(clientId);
              setMessages((current) =>
                mergeOneMessage(current, confirmedMessage),
              );
              resolve();
            },
          );
        });
      } catch (error: unknown) {
        const alreadyConfirmed =
          confirmedClientIdsRef.current.has(clientId) ||
          messagesRef.current.some(
            (message) => message.clientId === clientId && message.id > 0,
          );

        if (alreadyConfirmed) return;

        const message =
          error instanceof Error ? error.message : "Erro ao enviar mensagem.";

        setMessages((current) =>
          current.map((item) =>
            item.clientId === clientId
              ? { ...item, clientStatus: "error", localError: message }
              : item,
          ),
        );

        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [chatId, currentUserId, socket],
  );

  return {
    messages,
    isLoading,
    isLoadingOlder,
    isSending,
    hasMore,
    errorMessage,
    readErrorMessage,
    socketStatus,
    reload,
    loadOlder,
    sendText,
    setViewportAtBottom,
  };
}
