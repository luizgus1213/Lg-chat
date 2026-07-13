import { useCallback, useEffect, useRef, useState } from "react";

import { useSocket } from "../../socket/useSocket";
import { chatMessageSchema } from "../messages/messages.schemas";
import type { Conversation } from "../conversations/conversations.schemas";
import { getConversationTitle } from "../conversations/conversations.utils";

const SOUND_KEY = "lgchat.notifications.sound.v1";
const SYSTEM_KEY = "lgchat.notifications.system.v1";

function readSetting(key: string, fallback: boolean) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function saveSetting(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // A preferência continua válida durante a sessão atual.
  }
}

type Options = {
  currentUserId: number;
  activeChatId: number | null;
  activeChatAtBottom: boolean;
  conversations: Conversation[];
};

export function useNotifications({ currentUserId, activeChatId, activeChatAtBottom, conversations }: Options) {
  const { socket } = useSocket();
  // O som começa desligado em cada sessão para respeitar autoplay; a ativação
  // acontece somente a partir do gesto explícito no painel de notificações.
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState(() =>
    readSetting(SYSTEM_KEY, false) &&
    "Notification" in window &&
    Notification.permission === "granted",
  );
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playingRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const conversationsRef = useRef(conversations);
  const stateRef = useRef({ activeChatId, activeChatAtBottom, soundEnabled, systemEnabled });

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { stateRef.current = { activeChatId, activeChatAtBottom, soundEnabled, systemEnabled }; }, [activeChatAtBottom, activeChatId, soundEnabled, systemEnabled]);

  const enableSound = useCallback(async (enabled: boolean) => {
    setErrorMessage(null);
    if (enabled) {
      try {
        const AudioContextConstructor = window.AudioContext;
        const context = audioContextRef.current ?? new AudioContextConstructor();
        audioContextRef.current = context;
        if (context.state === "suspended") await context.resume();
      } catch {
        setErrorMessage("O navegador bloqueou o áudio. Interaja com a página e tente novamente.");
        return;
      }
    }
    saveSetting(SOUND_KEY, enabled);
    setSoundEnabled(enabled);
  }, []);

  const requestSystemNotifications = useCallback(async () => {
    setErrorMessage(null);
    if (!("Notification" in window)) {
      setErrorMessage("Notificações do sistema não são suportadas neste navegador.");
      return;
    }
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    setSystemEnabled(enabled);
    saveSetting(SYSTEM_KEY, enabled);
    if (!enabled) setErrorMessage("A permissão para notificações não foi concedida.");
  }, []);

  const disableSystemNotifications = useCallback(() => {
    setSystemEnabled(false);
    saveSetting(SYSTEM_KEY, false);
  }, []);

  useEffect(() => {
    if (!socket) return;

    function playSound() {
      const context = audioContextRef.current;
      if (!context || context.state !== "running" || playingRef.current) return;
      try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        playingRef.current = true;
        oscillator.type = "sine";
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.addEventListener("ended", () => {
          playingRef.current = false;
          oscillator.disconnect();
          gain.disconnect();
        }, { once: true });
        oscillator.start();
        oscillator.stop(context.currentTime + 0.17);
      } catch {
        playingRef.current = false;
        setErrorMessage("Não foi possível reproduzir o som de notificação.");
      }
    }

    function handleMessage(payload: unknown) {
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success || parsed.data.fromUserId === currentUserId) return;
      const conversation = conversationsRef.current.find((item) => item.id === parsed.data.chatId);
      const current = stateRef.current;
      const isVisibleAtBottom =
        current.activeChatId === parsed.data.chatId &&
        current.activeChatAtBottom &&
        document.visibilityState === "visible" &&
        document.hasFocus();
      if (isVisibleAtBottom) return;

      const title = conversation ? getConversationTitle(conversation) : "LG Chat";
      setToast(`Nova mensagem em ${title}`);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => { toastTimerRef.current = null; setToast(null); }, 4_500);

      if (conversation && current.soundEnabled && !conversation.isMuted) playSound();
      if (
        current.systemEnabled &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        new Notification(title, {
          body: parsed.data.text?.trim() || "Nova mensagem",
          icon: conversation?.avatarUrl || undefined,
          tag: `lgchat-${parsed.data.chatId}`,
        });
      }
    }

    socket.on("chat_message", handleMessage);
    return () => {
      socket.off("chat_message", handleMessage);
    };
  }, [currentUserId, socket]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") {
        void context.close().catch(() => {
          if (import.meta.env.DEV) {
            console.warn("[LG Chat] Não foi possível liberar o dispositivo de áudio.");
          }
        });
      }
    };
  }, []);

  return {
    soundEnabled,
    systemEnabled,
    toast,
    errorMessage,
    enableSound,
    requestSystemNotifications,
    disableSystemNotifications,
    dismissToast: () => setToast(null),
  };
}
