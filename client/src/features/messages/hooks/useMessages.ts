import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../api/apiClient";
import { useSocket } from "../../../socket/useSocket";
import { getAuthErrorMessage } from "../../auth/auth.errors";
import {
  listMessages,
  markChatAsRead,
  sendMediaMessage,
  setMessageStarred,
  toggleMessageReaction,
} from "../api/messages.api";
import {
  chatMessageSchema,
  type ChatMessage,
  type ServerChatMessage,
} from "../messages.schemas";

const PAGE_SIZE = 30;
const SOCKET_ACK_TIMEOUT_MS = 15_000;
const READ_DEBOUNCE_MS = 350;

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
]);

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

type PendingConfirmation = {
  confirm: () => void;
  cancel: () => void;
};

function compareMessages(first: ChatMessage, second: ChatMessage) {
  const firstTime = new Date(first.createdAt).getTime();
  const secondTime = new Date(second.createdAt).getTime();
  const safeFirstTime = Number.isNaN(firstTime) ? 0 : firstTime;
  const safeSecondTime = Number.isNaN(secondTime) ? 0 : secondTime;

  if (safeFirstTime !== safeSecondTime) return safeFirstTime - safeSecondTime;
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

function mergeRealtimeUpdate(
  current: ChatMessage[],
  incoming: ServerChatMessage,
) {
  const existing = current.find((message) => message.id === incoming.id);
  const reactions = incoming.reactions.map((reaction) => ({
    ...reaction,
    reactedByMe:
      existing?.reactions.find((item) => item.emoji === reaction.emoji)
        ?.reactedByMe ?? false,
  }));

  return mergeOneMessage(current, {
    ...incoming,
    reactions,
    isStarred: existing?.isStarred ?? false,
    clientStatus: "sent",
    localError: null,
  });
}

function createClientId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAckErrorMessage(ack: SocketAck) {
  return ack.error?.message || "Não foi possível enviar a mensagem.";
}

function isCancellation(error: unknown) {
  return error instanceof ApiError && error.code === "REQUEST_CANCELLED";
}

function asSentMessage(message: ServerChatMessage): ChatMessage {
  return {
    ...message,
    clientStatus: "sent",
    localError: null,
  };
}

function createReplyPreview(message: ChatMessage) {
  return {
    id: message.id,
    chatId: message.chatId,
    fromUserId: message.fromUserId,
    text: message.text,
    type: message.type,
    mediaOriginalName: message.mediaOriginalName,
    deletedAt: message.deletedAt,
  };
}

function validateMediaFile(file: File) {
  if (!file.name || file.size <= 0) {
    throw new Error("Escolha um arquivo válido para enviar.");
  }

  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    throw new Error(
      "Formato não permitido. Envie uma foto, vídeo, áudio ou documento compatível.",
    );
  }

  const megabyte = 1024 * 1024;
  const maxBytes = file.type.startsWith("image/")
    ? 8 * megabyte
    : file.type.startsWith("video/")
      ? 50 * megabyte
      : file.type.startsWith("audio/")
        ? 15 * megabyte
        : 25 * megabyte;

  if (file.size > maxBytes) {
    const maxMegabytes = Math.round(maxBytes / megabyte);
    throw new Error(`Esse arquivo deve ter no máximo ${maxMegabytes} MB.`);
  }
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
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const [pendingMessageIds, setPendingMessageIds] = useState<Set<number>>(
    () => new Set(),
  );

  const mountedRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const requestSequenceRef = useRef(0);
  const localMessageIdRef = useRef(-1);
  const viewportAtBottomRef = useRef(false);
  const readTimerRef = useRef<number | null>(null);
  const pendingReadIdRef = useRef(0);
  const lastConfirmedReadIdRef = useRef(0);
  const confirmedClientIdsRef = useRef(new Set<string>());
  const pendingConfirmationsRef = useRef(
    new Map<string, PendingConfirmation>(),
  );
  const latestRequestControllerRef = useRef<AbortController | null>(null);
  const olderRequestControllerRef = useRef<AbortController | null>(null);
  const readControllerRef = useRef<AbortController | null>(null);
  const actionControllersRef = useRef(new Set<AbortController>());
  const sendingRef = useRef(false);
  const loadingOlderRef = useRef(false);

  const commitMessages = useCallback(
    (updater: (current: ChatMessage[]) => ChatMessage[]) => {
      setMessages((current) => {
        const next = updater(current);
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    const actionControllers = actionControllersRef.current;
    const pendingConfirmations = pendingConfirmationsRef.current;

    return () => {
      mountedRef.current = false;
      latestRequestControllerRef.current?.abort();
      olderRequestControllerRef.current?.abort();
      readControllerRef.current?.abort();

      for (const controller of actionControllers) {
        controller.abort();
      }
      actionControllers.clear();

      for (const confirmation of pendingConfirmations.values()) {
        confirmation.cancel();
      }
      pendingConfirmations.clear();

      if (readTimerRef.current !== null) {
        window.clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
    };
  }, []);

  const canConfirmRead = useCallback(() => {
    return (
      viewportAtBottomRef.current &&
      document.visibilityState === "visible" &&
      document.hasFocus()
    );
  }, []);

  const flushPendingRead = useCallback(async () => {
    if (!canConfirmRead() || readControllerRef.current) return;

    const messageId = pendingReadIdRef.current;
    if (messageId <= lastConfirmedReadIdRef.current || messageId <= 0) return;

    pendingReadIdRef.current = 0;
    const controller = new AbortController();
    readControllerRef.current = controller;

    try {
      const response = await markChatAsRead(chatId, messageId, {
        signal: controller.signal,
      });
      if (!mountedRef.current || controller.signal.aborted) return;

      const confirmedId = response.data.lastReadMessageId;
      lastConfirmedReadIdRef.current = Math.max(
        lastConfirmedReadIdRef.current,
        confirmedId,
      );
      setReadErrorMessage(null);
      onReadConfirmed?.(chatId, confirmedId);
    } catch (error: unknown) {
      if (controller.signal.aborted || !mountedRef.current) return;
      pendingReadIdRef.current = Math.max(
        pendingReadIdRef.current,
        messageId,
      );
      setReadErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (readControllerRef.current === controller) {
        readControllerRef.current = null;
      }
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

    if (latestReceivedMessage) scheduleMarkRead(latestReceivedMessage.id);
  }, [currentUserId, scheduleMarkRead]);

  const setViewportAtBottom = useCallback(
    (isAtBottom: boolean) => {
      viewportAtBottomRef.current = isAtBottom;
      if (isAtBottom) scheduleLatestReceivedAsRead();
    },
    [scheduleLatestReceivedAsRead],
  );

  const loadLatest = useCallback(async () => {
    const sequence = ++requestSequenceRef.current;
    latestRequestControllerRef.current?.abort();
    olderRequestControllerRef.current?.abort();

    const controller = new AbortController();
    latestRequestControllerRef.current = controller;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await listMessages(
        chatId,
        { limit: PAGE_SIZE },
        { signal: controller.signal },
      );
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        sequence !== requestSequenceRef.current
      ) {
        return;
      }

      const loadedMessages = response.data.map(asSentMessage);
      commitMessages((current) => mergeManyMessages(current, loadedMessages));
      setHasMore(loadedMessages.length === PAGE_SIZE);
      setErrorMessage(null);
    } catch (error: unknown) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        sequence !== requestSequenceRef.current ||
        isCancellation(error)
      ) {
        return;
      }
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (
        mountedRef.current &&
        sequence === requestSequenceRef.current &&
        latestRequestControllerRef.current === controller
      ) {
        latestRequestControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, [chatId, commitMessages]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) void loadLatest();
    });

    return () => {
      active = false;
      requestSequenceRef.current += 1;
      latestRequestControllerRef.current?.abort();
    };
  }, [loadLatest]);

  useEffect(() => {
    if (!socket) return;

    function joinCurrentChat() {
      if (socket?.connected) socket.emit("join_chat", { chatId });
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

    joinCurrentChat();
    socket.on("connect", joinCurrentChat);
    socket.on("chat_message", handleMessage);
    socket.on("chat_message_updated", handleUpdatedMessage);

    return () => {
      socket.off("connect", joinCurrentChat);
      socket.off("chat_message", handleMessage);
      socket.off("chat_message_updated", handleUpdatedMessage);
    };
  }, [
    socket,
    chatId,
    currentUserId,
    canConfirmRead,
    commitMessages,
    scheduleMarkRead,
  ]);

  useEffect(() => {
    function tryConfirmVisibleMessages() {
      if (canConfirmRead()) scheduleLatestReceivedAsRead();
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

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMore) return;

    const oldestMessage = messagesRef.current.find((message) => message.id > 0);
    if (!oldestMessage) {
      setHasMore(false);
      return;
    }

    const controller = new AbortController();
    olderRequestControllerRef.current?.abort();
    olderRequestControllerRef.current = controller;
    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    setErrorMessage(null);

    try {
      const response = await listMessages(
        chatId,
        { limit: PAGE_SIZE, beforeId: oldestMessage.id },
        { signal: controller.signal },
      );
      if (!mountedRef.current || controller.signal.aborted) return;

      const olderMessages = response.data.map(asSentMessage);
      commitMessages((current) => mergeManyMessages(current, olderMessages));
      setHasMore(olderMessages.length === PAGE_SIZE);
    } catch (error: unknown) {
      if (
        mountedRef.current &&
        !controller.signal.aborted &&
        !isCancellation(error)
      ) {
        setErrorMessage(getAuthErrorMessage(error));
      }
    } finally {
      if (olderRequestControllerRef.current === controller) {
        olderRequestControllerRef.current = null;
        loadingOlderRef.current = false;
        if (mountedRef.current) setIsLoadingOlder(false);
      }
    }
  }, [chatId, commitMessages, hasMore]);

  const sendText = useCallback(
    async (rawText: string, replyTo: ChatMessage | null = null) => {
      const text = rawText.trim();
      if (!text) throw new Error("Digite uma mensagem.");
      if (text.length > 1_000) {
        throw new Error("A mensagem pode ter no máximo 1.000 caracteres.");
      }
      if (!socket?.connected) {
        throw new Error("Sem conexão em tempo real. Aguarde a reconexão.");
      }
      if (sendingRef.current) {
        throw new Error("Aguarde o envio atual terminar.");
      }

      const validReply =
        replyTo && replyTo.id > 0 && !replyTo.deletedAt ? replyTo : null;
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
        replyToMessageId: validReply?.id ?? null,
        forwardedFromMessageId: null,
        isForwarded: false,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: null,
        clientId,
        replyTo: validReply ? createReplyPreview(validReply) : null,
        reactions: [],
        isStarred: false,
        clientStatus: "sending",
        localError: null,
      };

      commitMessages((current) =>
        mergeOneMessage(current, optimisticMessage),
      );
      sendingRef.current = true;
      setIsSending(true);

      try {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            pendingConfirmationsRef.current.delete(clientId);
            callback();
          };
          const timeout = window.setTimeout(() => {
            if (
              confirmedClientIdsRef.current.has(clientId) ||
              messagesRef.current.some(
                (message) => message.clientId === clientId && message.id > 0,
              )
            ) {
              finish(resolve);
              return;
            }
            finish(() =>
              reject(
                new Error("O servidor demorou demais para confirmar o envio."),
              ),
            );
          }, SOCKET_ACK_TIMEOUT_MS);

          pendingConfirmationsRef.current.set(clientId, {
            confirm: () => finish(resolve),
            cancel: () => finish(resolve),
          });

          socket.emit(
            "chat_message",
            {
              chatId,
              text,
              clientId,
              ...(validReply ? { replyToMessageId: validReply.id } : {}),
            },
            (ack: SocketAck) => {
              if (settled) return;
              if (!ack?.success) {
                finish(() => reject(new Error(getAckErrorMessage(ack))));
                return;
              }

              const parsed = chatMessageSchema.safeParse(ack.data);
              if (!parsed.success) {
                finish(() =>
                  reject(
                    new Error("O servidor retornou uma mensagem inválida."),
                  ),
                );
                return;
              }

              confirmedClientIdsRef.current.add(clientId);
              commitMessages((current) =>
                mergeOneMessage(
                  current,
                  asSentMessage({
                    ...parsed.data,
                    clientId: parsed.data.clientId || clientId,
                  }),
                ),
              );
              finish(resolve);
            },
          );
        });
      } catch (error: unknown) {
        const alreadyConfirmed =
          confirmedClientIdsRef.current.has(clientId) ||
          messagesRef.current.some(
            (message) => message.clientId === clientId && message.id > 0,
          );
        if (!alreadyConfirmed && mountedRef.current) {
          const message =
            error instanceof Error ? error.message : "Erro ao enviar mensagem.";
          commitMessages((current) =>
            current.map((item) =>
              item.clientId === clientId
                ? { ...item, clientStatus: "error", localError: message }
                : item,
            ),
          );
          throw error;
        }
      } finally {
        sendingRef.current = false;
        if (mountedRef.current) setIsSending(false);
      }
    },
    [chatId, commitMessages, currentUserId, socket],
  );

  const sendMedia = useCallback(
    async (
      file: File,
      rawCaption: string,
      replyTo: ChatMessage | null = null,
    ) => {
      validateMediaFile(file);
      const caption = rawCaption.trim();
      if (caption.length > 1_000) {
        throw new Error("A legenda pode ter no máximo 1.000 caracteres.");
      }
      if (sendingRef.current) throw new Error("Aguarde o envio atual terminar.");

      const validReply =
        replyTo && replyTo.id > 0 && !replyTo.deletedAt ? replyTo : null;
      const controller = new AbortController();
      actionControllersRef.current.add(controller);
      sendingRef.current = true;
      setIsSending(true);

      try {
        const response = await sendMediaMessage(chatId, file, {
          caption: caption || undefined,
          replyToMessageId: validReply?.id,
          signal: controller.signal,
        });
        if (!mountedRef.current || controller.signal.aborted) return;
        commitMessages((current) =>
          mergeOneMessage(current, asSentMessage(response.data)),
        );
      } catch (error: unknown) {
        if (!controller.signal.aborted) throw error;
      } finally {
        actionControllersRef.current.delete(controller);
        sendingRef.current = false;
        if (mountedRef.current) setIsSending(false);
      }
    },
    [chatId, commitMessages],
  );

  const runMessageAction = useCallback(
    async (
      messageId: number,
      request: (controller: AbortController) => Promise<ServerChatMessage>,
    ) => {
      if (messageId <= 0 || pendingMessageIds.has(messageId)) return;

      const controller = new AbortController();
      actionControllersRef.current.add(controller);
      setPendingMessageIds((current) => {
        const next = new Set(current);
        next.add(messageId);
        return next;
      });
      setActionErrorMessage(null);

      try {
        const message = await request(controller);
        if (!mountedRef.current || controller.signal.aborted) return;
        commitMessages((current) =>
          mergeOneMessage(current, asSentMessage(message)),
        );
      } catch (error: unknown) {
        if (mountedRef.current && !controller.signal.aborted) {
          setActionErrorMessage(getAuthErrorMessage(error));
        }
      } finally {
        actionControllersRef.current.delete(controller);
        if (mountedRef.current) {
          setPendingMessageIds((current) => {
            const next = new Set(current);
            next.delete(messageId);
            return next;
          });
        }
      }
    },
    [commitMessages, pendingMessageIds],
  );

  const reactToMessage = useCallback(
    async (messageId: number, emoji: string) => {
      await runMessageAction(messageId, async (controller) => {
        const response = await toggleMessageReaction(
          chatId,
          messageId,
          emoji,
          { signal: controller.signal },
        );
        return response.data;
      });
    },
    [chatId, runMessageAction],
  );

  const toggleStar = useCallback(
    async (messageId: number, starred: boolean) => {
      await runMessageAction(messageId, async (controller) => {
        const response = await setMessageStarred(
          chatId,
          messageId,
          starred,
          { signal: controller.signal },
        );
        return response.data;
      });
    },
    [chatId, runMessageAction],
  );

  return {
    messages,
    isLoading,
    isLoadingOlder,
    isSending,
    hasMore,
    errorMessage,
    readErrorMessage,
    actionErrorMessage,
    pendingMessageIds,
    socketStatus,
    reload: loadLatest,
    loadOlder,
    sendText,
    sendMedia,
    reactToMessage,
    toggleStar,
    setViewportAtBottom,
    retryRead: flushPendingRead,
  };
}
