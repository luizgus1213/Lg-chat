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
