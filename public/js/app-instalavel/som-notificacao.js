async function unlockNotificationAudio() {
  if (notificationAudioUnlocked) return true;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return false;

    audioContext = audioContext || new AudioContextClass();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    /*
      Toca um som praticamente mudo em resposta a um clique/toque.
      Isso libera o AudioContext em Chrome/Edge/Safari mobile.
    */
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.03);

    notificationAudioUnlocked = true;
    return true;
  } catch (error) {
    console.warn("Não foi possível liberar áudio de notificação:", error);
    return false;
  }
}

function bindAudioUnlockEvents() {
  const unlock = () => {
    unlockNotificationAudio().catch(() => undefined);
  };

  ["pointerdown", "touchstart", "keydown", "click"].forEach((eventName) => {
    document.addEventListener(eventName, unlock, {
      once: true,
      passive: true,
    });
  });
}

bindAudioUnlockEvents();

async function playNotificationSound() {
  if (!isSoundEnabled()) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    audioContext = audioContext || new AudioContextClass();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.16);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.22);
  } catch (error) {
    console.error("Erro ao tocar som de notificação:", error);
  }
}

async function requestNotificationPermission() {
  const state = getState();

  await unlockNotificationAudio();

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
  if (
    state.notificationPermission !== "granted" &&
    Notification.permission !== "granted"
  )
    return;

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

function notifyNewMessage(message, options = {}) {
  incrementUnreadCount();
  playNotificationSound();

  const shouldShowSystemNotification =
    options.forceSystem === true || document.visibilityState !== "visible";

  if (shouldShowSystemNotification) {
    showSystemNotification(message).catch((error) => {
      console.error("Erro ao mostrar notificação do service worker:", error);
    });
  }
}
