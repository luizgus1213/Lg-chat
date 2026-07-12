import { useCallback, useEffect, useRef, useState } from "react";

import { getAuthErrorMessage } from "../../auth/auth.errors";
import { useSocket } from "../../../socket/useSocket";

import { listMessages, markChatAsRead } from "../api/messages.api";

import { chatMessageSchema, type ChatMessage } from "../messages.schemas";

const PAGE_SIZE = 30;
const SOCKET_ACK_TIMEOUT_MS = 15_000;

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
};

function compareMessages(first: ChatMessage, second: ChatMessage) {
  const firstTime = new Date(first.createdAt).getTime();
  const secondTime = new Date(second.createdAt).getTime();

  if (firstTime !== secondTime) {
    return firstTime - secondTime;
  }

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
    next[targetIndex] = {
      ...next[targetIndex],
      ...incoming,
    };
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
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAckErrorMessage(ack: SocketAck) {
  return ack.error?.message || "Não foi possível enviar a mensagem.";
}

export function useMessages({ chatId, currentUserId }: UseMessagesOptions) {
  const { socket, status: socketStatus } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const [isSending, setIsSending] = useState(false);

  const [hasMore, setHasMore] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestSequence = useRef(0);

  const readTimer = useRef<number | null>(null);
  const pendingReadId = useRef(0);

  const scheduleMarkRead = useCallback(
    (messageId: number) => {
      if (messageId <= 0) return;

      pendingReadId.current = Math.max(pendingReadId.current, messageId);

      if (readTimer.current) {
        window.clearTimeout(readTimer.current);
      }

      /*
        Não é polling.

        É apenas um debounce acionado quando uma mensagem
        é carregada ou recebida.
      */
      readTimer.current = window.setTimeout(() => {
        const latestMessageId = pendingReadId.current;

        pendingReadId.current = 0;
        readTimer.current = null;

        void markChatAsRead(chatId, latestMessageId).catch((error: unknown) => {
          console.error("Erro ao marcar mensagens como lidas:", error);
        });
      }, 350);
    },
    [chatId],
  );

  useEffect(() => {
    return () => {
      if (readTimer.current) {
        window.clearTimeout(readTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const sequence = ++requestSequence.current;

    void listMessages(chatId, {
      limit: PAGE_SIZE,
    })
      .then((response) => {
        if (sequence !== requestSequence.current) {
          return;
        }

        const loadedMessages: ChatMessage[] = response.data.map((message) => ({
          ...message,
          clientStatus: "sent",
        }));

        setMessages(loadedMessages);

        setHasMore(loadedMessages.length === PAGE_SIZE);

        const latestReceivedMessage = [...loadedMessages]
          .reverse()
          .find((message) => message.fromUserId !== currentUserId);

        if (latestReceivedMessage && document.visibilityState === "visible") {
          scheduleMarkRead(latestReceivedMessage.id);
        }
      })
      .catch((error: unknown) => {
        if (sequence !== requestSequence.current) {
          return;
        }

        setErrorMessage(getAuthErrorMessage(error));
      })
      .finally(() => {
        if (sequence === requestSequence.current) {
          setIsLoading(false);
        }
      });

    return () => {
      requestSequence.current += 1;
    };
  }, [chatId, currentUserId, scheduleMarkRead]);

  useEffect(() => {
    if (!socket) return;

    function handleMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);

      if (!parsed.success) {
        console.error("Mensagem inválida recebida pelo socket:", parsed.error);

        return;
      }

      const message = parsed.data;

      if (message.chatId !== chatId) return;

      setMessages((current) =>
        mergeOneMessage(current, {
          ...message,
          clientStatus: "sent",
        }),
      );

      if (
        message.fromUserId !== currentUserId &&
        document.visibilityState === "visible"
      ) {
        scheduleMarkRead(message.id);
      }
    }

    function handleUpdatedMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);

      if (!parsed.success) return;

      if (parsed.data.chatId !== chatId) return;

      setMessages((current) =>
        mergeOneMessage(current, {
          ...parsed.data,
          clientStatus: "sent",
        }),
      );
    }

    socket.emit("join_chat", {
      chatId,
    });

    socket.on("chat_message", handleMessage);
    socket.on("chat_message_updated", handleUpdatedMessage);

    return () => {
      socket.off("chat_message", handleMessage);
      socket.off("chat_message_updated", handleUpdatedMessage);
    };
  }, [socket, chatId, currentUserId, scheduleMarkRead]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        return;
      }

      const latestReceivedMessage = [...messages]
        .reverse()
        .find(
          (message) => message.id > 0 && message.fromUserId !== currentUserId,
        );

      if (latestReceivedMessage) {
        scheduleMarkRead(latestReceivedMessage.id);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [messages, currentUserId, scheduleMarkRead]);

  const loadOlder = useCallback(async () => {
    if (isLoadingOlder || !hasMore) {
      return;
    }
    const oldestMessage = messages.find((message) => message.id > 0);

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
  }, [chatId, hasMore, isLoadingOlder, messages]);

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();

      if (!text) {
        throw new Error("Digite uma mensagem.");
      }

      if (text.length > 1_000) {
        throw new Error("A mensagem pode ter no máximo 1.000 caracteres.");
      }

      if (!socket || !socket.connected) {
        throw new Error("Sem conexão em tempo real. Aguarde a reconexão.");
      }

      const clientId = createClientId();
      const now = new Date().toISOString();

      const optimisticMessage: ChatMessage = {
        id: -Date.now(),
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

            settled = true;

            reject(
              new Error("O servidor demorou demais para confirmar o envio."),
            );
          }, SOCKET_ACK_TIMEOUT_MS);

          socket.emit(
            "chat_message",
            {
              chatId,
              text,
              clientId,
            },
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

              setMessages((current) =>
                mergeOneMessage(current, {
                  ...parsed.data,
                  clientStatus: "sent",
                }),
              );

              resolve();
            },
          );
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Erro ao enviar mensagem.";

        setMessages((current) =>
          current.map((item) =>
            item.clientId === clientId
              ? {
                  ...item,
                  clientStatus: "error",
                  localError: message,
                }
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

    socketStatus,

    loadOlder,
    sendText,
  };
}
