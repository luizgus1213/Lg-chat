import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { z } from "zod";

import { useSocket } from "../../../socket/useSocket";

const LOCAL_STOP_DELAY_MS = 900;

/*
  Enquanto a pessoa continuar digitando, o evento typing_start
  pode ser renovado no máximo uma vez por segundo.

  Isso mantém o indicador ativo sem disparar um evento em cada tecla.
*/
const TYPING_REFRESH_INTERVAL_MS = 1_000;

/*
  Proteção local: caso typing_stop não chegue por perda de conexão,
  o indicador remoto desaparece automaticamente.
*/
const REMOTE_SAFETY_TIMEOUT_MS = 4_000;

const typingPayloadSchema = z.object({
  chatId: z.number().int().positive(),
  userId: z.number().int().positive(),
  nome: z.string().trim().min(1).max(100),
});

type UseTypingIndicatorOptions = {
  chatId: number;
  currentUserId: number;
};

export function useTypingIndicator({
  chatId,
  currentUserId,
}: UseTypingIndicatorOptions) {
  const { socket } = useSocket();

  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const localTypingActiveRef = useRef(false);

  const lastTypingStartEmitRef = useRef(0);

  const localStopTimerRef = useRef<number | null>(null);

  const remoteTimersRef = useRef(new Map<number, number>());

  const stopTyping = useCallback(() => {
    if (localStopTimerRef.current !== null) {
      window.clearTimeout(localStopTimerRef.current);

      localStopTimerRef.current = null;
    }

    if (!localTypingActiveRef.current) {
      return;
    }

    localTypingActiveRef.current = false;
    lastTypingStartEmitRef.current = 0;

    if (!socket?.connected) {
      return;
    }

    socket.emit("typing_stop", {
      chatId,
    });
  }, [chatId, socket]);

  const notifyTyping = useCallback(() => {
    if (!socket?.connected) {
      return;
    }

    const now = Date.now();

    const shouldEmitTypingStart =
      !localTypingActiveRef.current ||
      now - lastTypingStartEmitRef.current >= TYPING_REFRESH_INTERVAL_MS;

    localTypingActiveRef.current = true;

    if (shouldEmitTypingStart) {
      lastTypingStartEmitRef.current = now;

      socket.emit("typing_start", {
        chatId,
      });
    }

    if (localStopTimerRef.current !== null) {
      window.clearTimeout(localStopTimerRef.current);
    }

    localStopTimerRef.current = window.setTimeout(() => {
      localStopTimerRef.current = null;

      if (!localTypingActiveRef.current) {
        return;
      }

      localTypingActiveRef.current = false;
      lastTypingStartEmitRef.current = 0;

      if (socket.connected) {
        socket.emit("typing_stop", {
          chatId,
        });
      }
    }, LOCAL_STOP_DELAY_MS);
  }, [chatId, socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    /*
      Guardamos a referência atual do Map para que o cleanup
      utilize exatamente a mesma instância criada neste efeito.
    */
    const remoteTimers = remoteTimersRef.current;

    function clearRemoteTimer(userId: number) {
      const timer = remoteTimers.get(userId);

      if (timer !== undefined) {
        window.clearTimeout(timer);
        remoteTimers.delete(userId);
      }
    }

    function removeRemoteTypingUser(userId: number) {
      clearRemoteTimer(userId);

      setTypingUsers((current) => {
        const key = String(userId);

        if (!(key in current)) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[key];

        return next;
      });
    }

    function clearAllRemoteTypingUsers() {
      for (const timer of remoteTimers.values()) {
        window.clearTimeout(timer);
      }

      remoteTimers.clear();
      setTypingUsers({});
    }

    function clearLocalTypingState() {
      if (localStopTimerRef.current !== null) {
        window.clearTimeout(localStopTimerRef.current);

        localStopTimerRef.current = null;
      }

      localTypingActiveRef.current = false;
      lastTypingStartEmitRef.current = 0;
    }

    function handleTypingStart(payload: unknown) {
      const parsed = typingPayloadSchema.safeParse(payload);

      if (!parsed.success) {
        if (import.meta.env.DEV) {
          console.error("[LG Chat] Evento typing_start inválido:", parsed.error);
        }

        return;
      }

      const data = parsed.data;

      if (data.chatId !== chatId || data.userId === currentUserId) {
        return;
      }

      setTypingUsers((current) => ({
        ...current,
        [String(data.userId)]: data.nome,
      }));

      clearRemoteTimer(data.userId);

      /*
        Não é polling.

        Este temporizador apenas remove um indicador
        que ficou preso caso typing_stop não chegue.
      */
      const safetyTimer = window.setTimeout(() => {
        removeRemoteTypingUser(data.userId);
      }, REMOTE_SAFETY_TIMEOUT_MS);

      remoteTimers.set(data.userId, safetyTimer);
    }

    function handleTypingStop(payload: unknown) {
      const parsed = typingPayloadSchema.safeParse(payload);

      if (!parsed.success) {
        if (import.meta.env.DEV) {
          console.error("[LG Chat] Evento typing_stop inválido:", parsed.error);
        }

        return;
      }

      const data = parsed.data;

      if (data.chatId !== chatId) {
        return;
      }

      removeRemoteTypingUser(data.userId);
    }

    function handleSocketDisconnect() {
      clearLocalTypingState();
      clearAllRemoteTypingUsers();
    }

    socket.on("typing_start", handleTypingStart);

    socket.on("typing_stop", handleTypingStop);

    socket.on("disconnect", handleSocketDisconnect);

    return () => {
      socket.off("typing_start", handleTypingStart);

      socket.off("typing_stop", handleTypingStop);

      socket.off("disconnect", handleSocketDisconnect);

      if (localStopTimerRef.current !== null) {
        window.clearTimeout(localStopTimerRef.current);
      }

      if (localTypingActiveRef.current && socket.connected) {
        socket.emit("typing_stop", {
          chatId,
        });
      }

      localTypingActiveRef.current = false;
      lastTypingStartEmitRef.current = 0;
      localStopTimerRef.current = null;

      for (const timer of remoteTimers.values()) {
        window.clearTimeout(timer);
      }

      remoteTimers.clear();
    };
  }, [socket, chatId, currentUserId]);

  const typingText = useMemo(() => {
    const names = Object.values(typingUsers);

    if (names.length === 0) {
      return null;
    }

    if (names.length === 1) {
      return `${names[0]} está digitando...`;
    }

    if (names.length === 2) {
      return `${names[0]} e ${names[1]} estão digitando...`;
    }

    return `${names[0]} e mais ${names.length - 1} pessoas estão digitando...`;
  }, [typingUsers]);

  return {
    typingText,
    notifyTyping,
    stopTyping,
  };
}
