(() => {
  window.LGChat = window.LGChat || {};

  const DEFAULT_TITLE = "LG Chat";
  const INSTALL_DISMISSED_KEY = "lgchat_install_dismissed_at";
  let deferredInstallPrompt = null;
  let hasBoundUi = false;
  let audioContext = null;

  function getState() {
    return window.LGChat.state || {};
  }

  function safeEl(id) {
    return document.getElementById(id);
  }

  function getChatNameById(chatId) {
    const state = getState();
    const chatModule = window.LGChat.chat;
    const chat = (state.allChats || []).find((item) => {
      return Number(item.id) === Number(chatId);
    });

    if (chatModule && typeof chatModule.getChatName === "function" && chat) {
      return chatModule.getChatName(chat);
    }

    if (chat && chat.name) return chat.name;
    if (chat && chat.privateUser) return chat.privateUser.nome || "Contato";

    return "LG Chat";
  }

  function getMessagePreview(message) {
    if (!message) return "Você recebeu uma nova mensagem.";

    if (message.deletedAt) return "Mensagem apagada.";
    if (message.type === "image") return message.text ? `Foto: ${message.text}` : "📷 Foto";
    if (message.type === "video") return message.text ? `Vídeo: ${message.text}` : "🎥 Vídeo";
    if (message.type === "audio") return message.text ? `Áudio: ${message.text}` : "🎙️ Áudio";
    if (message.type === "file") {
      return message.mediaOriginalName
        ? `📎 ${message.mediaOriginalName}`
        : "📎 Documento";
    }

    return message.text || "Você recebeu uma nova mensagem.";
  }

  function updateTitle() {
    const state = getState();
    const count = Number(state.appUnreadCount || 0);
    const title = state.originalTitle || DEFAULT_TITLE;

    document.title = count > 0 ? `(${count}) ${title}` : title;

    if ("setAppBadge" in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => undefined);
      } else if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => undefined);
      }
    }
  }

  function incrementUnreadCount() {
    const state = getState();

    state.appUnreadCount = Number(state.appUnreadCount || 0) + 1;
    updateTitle();
  }

  function clearUnreadCount() {
    const state = getState();

    state.appUnreadCount = 0;
    updateTitle();
  }

  function isSoundEnabled() {
    const state = getState();

    return state.notificationSoundEnabled !== false;
  }

  function setSoundEnabled(enabled) {
    const state = getState();

    state.notificationSoundEnabled = Boolean(enabled);
    localStorage.setItem("lgchat_sound", enabled ? "on" : "off");
    syncUi();
  }

  function areBrowserNotificationsEnabled() {
    const state = getState();

    return state.browserNotificationsEnabled !== false;
  }

  function setBrowserNotificationsEnabled(enabled) {
    const state = getState();

    state.browserNotificationsEnabled = Boolean(enabled);
    localStorage.setItem("lgchat_browser_notifications", enabled ? "on" : "off");
    syncUi();
  }

  function playNotificationSound() {
    if (!isSoundEnabled()) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      audioContext = audioContext || new AudioContextClass();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.18);
    } catch (error) {
      console.error("Erro ao tocar som de notificação:", error);
    }
  }

  async function requestNotificationPermission() {
    const state = getState();

    if (!("Notification" in window)) {
      state.notificationPermission = "unsupported";
      syncUi();
      return "unsupported";
    }

    if (Notification.permission === "granted") {
      state.notificationPermission = "granted";
      setBrowserNotificationsEnabled(true);
      syncUi();
      return "granted";
    }

    if (Notification.permission === "denied") {
      state.notificationPermission = "denied";
      syncUi();
      return "denied";
    }

    const permission = await Notification.requestPermission();

    state.notificationPermission = permission;

    if (permission === "granted") {
      setBrowserNotificationsEnabled(true);
    }

    syncUi();
    return permission;
  }

  async function showSystemNotification(message) {
    const state = getState();

    if (!areBrowserNotificationsEnabled()) return;
    if (!("Notification" in window)) return;
    if (state.notificationPermission !== "granted" && Notification.permission !== "granted") return;

    const title = getChatNameById(message.chatId);
    const body = getMessagePreview(message);

    try {
      if (
        navigator.serviceWorker &&
        navigator.serviceWorker.ready &&
        typeof navigator.serviceWorker.ready.then === "function"
      ) {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(title, {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/badge-96.png",
          tag: `chat-${message.chatId}`,
          renotify: true,
          data: {
            chatId: message.chatId,
            url: "/",
          },
        });

        return;
      }

      new Notification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: `chat-${message.chatId}`,
      });
    } catch (error) {
      console.error("Erro ao mostrar notificação:", error);
    }
  }

  function notifyNewMessage(message) {
    incrementUnreadCount();
    playNotificationSound();

    if (document.visibilityState !== "visible") {
      showSystemNotification(message).catch((error) => {
        console.error("Erro ao mostrar notificação do service worker:", error);
      });
    }
  }

  function syncUi() {
    const state = getState();
    const installButton = safeEl("installAppButton");
    const soundButton = safeEl("toggleSoundButton");
    const notificationsButton = safeEl("enableNotificationsButton");

    if (installButton) {
      const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0);
      const dismissedRecently = dismissedAt && Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 7;
      const shouldShow = Boolean(deferredInstallPrompt) && !state.isInstalledApp && !dismissedRecently;

      installButton.classList.toggle("hidden", !shouldShow);
    }

    if (soundButton) {
      soundButton.textContent = isSoundEnabled() ? "Som: ligado" : "Som: desligado";
      soundButton.classList.toggle("muted-action", !isSoundEnabled());
    }

    if (notificationsButton) {
      if (!("Notification" in window)) {
        notificationsButton.textContent = "Notificações indisponíveis";
        notificationsButton.disabled = true;
      } else if (Notification.permission === "granted" && areBrowserNotificationsEnabled()) {
        notificationsButton.textContent = "Notificações: ligadas";
        notificationsButton.disabled = false;
      } else if (Notification.permission === "denied") {
        notificationsButton.textContent = "Notificações bloqueadas";
        notificationsButton.disabled = true;
      } else if (!areBrowserNotificationsEnabled()) {
        notificationsButton.textContent = "Notificações: desligadas";
        notificationsButton.disabled = false;
      } else {
        notificationsButton.textContent = "Ativar notificações";
        notificationsButton.disabled = false;
      }
    }
  }

  async function installApp() {
    if (!deferredInstallPrompt) {
      const ui = window.LGChat.ui;

      if (ui && typeof ui.showToast === "function") {
        ui.showToast("error", "Instalação ainda não disponível neste navegador.");
      }

      return;
    }

    deferredInstallPrompt.prompt();

    const result = await deferredInstallPrompt.userChoice;

    if (result.outcome !== "accepted") {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    }

    deferredInstallPrompt = null;
    syncUi();
  }

  function bindUi() {
    if (hasBoundUi) {
      syncUi();
      return;
    }

    hasBoundUi = true;

    const installButton = safeEl("installAppButton");
    const soundButton = safeEl("toggleSoundButton");
    const notificationsButton = safeEl("enableNotificationsButton");

    if (installButton) {
      installButton.addEventListener("click", () => {
        installApp().catch((error) => {
          console.error("Erro ao instalar app:", error);
        });
      });
    }

    if (soundButton) {
      soundButton.addEventListener("click", () => {
        setSoundEnabled(!isSoundEnabled());
      });
    }

    if (notificationsButton) {
      notificationsButton.addEventListener("click", async () => {
        if (Notification.permission === "granted" && areBrowserNotificationsEnabled()) {
          setBrowserNotificationsEnabled(false);
          return;
        }

        await requestNotificationPermission();
      });
    }

    syncUi();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          console.info("Service Worker registrado com sucesso.");
        })
        .catch((error) => {
          console.error("Erro ao registrar Service Worker:", error);
        });
    });
  }

  function register() {
    registerServiceWorker();
    syncUi();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();

    deferredInstallPrompt = event;
    getState().canInstallApp = true;

    syncUi();
  });

  window.addEventListener("appinstalled", () => {
    getState().isInstalledApp = true;
    deferredInstallPrompt = null;

    syncUi();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      clearUnreadCount();
    }
  });

  window.addEventListener("focus", clearUnreadCount);

  window.LGChat.pwa = {
    register,
    bindUi,
    syncUi,
    notifyNewMessage,
    requestNotificationPermission,
    playNotificationSound,
    clearUnreadCount,
    incrementUnreadCount,
    setSoundEnabled,
    setBrowserNotificationsEnabled,
  };
})();
