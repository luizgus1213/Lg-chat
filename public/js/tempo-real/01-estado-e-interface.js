const state = window.LGChat.state;

const ui = window.LGChat.ui;

function requestNotificationPermission() {
    if (!("Notification" in window)) {
      state.notificationPermission = "unsupported";
      return;
    }

    if (Notification.permission === "granted") {
      state.notificationPermission = "granted";
      return;
    }

    if (Notification.permission === "denied") {
      state.notificationPermission = "denied";
      return;
    }

    Notification.requestPermission()
      .then((permission) => {
        state.notificationPermission = permission;
      })
      .catch((error) => {
        console.error("Erro ao pedir permissão de notificação:", error);
        state.notificationPermission = "denied";
      });
  }

function notifyNewMessage(message) {
    const pwa = window.LGChat.pwa;

    if (pwa && typeof pwa.notifyNewMessage === "function") {
      pwa.notifyNewMessage(message);
      return;
    }

    if (!("Notification" in window)) return;
    if (state.notificationPermission !== "granted") return;

    try {
      new Notification("Nova mensagem", {
        body: message.text || "Você recebeu uma nova mensagem.",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
      });
    } catch (error) {
      console.error("Erro ao mostrar notificação:", error);
    }
  }

function scheduleChatsRefresh(reason = "socket", delay = 700) {
    const performanceApi = window.LGChat.performance;

    if (performanceApi && typeof performanceApi.scheduleLoadChats === "function") {
      return performanceApi.scheduleLoadChats(reason, delay);
    }

    const chat = window.LGChat.chat;

    if (chat && typeof chat.loadChats === "function") {
      return chat.loadChats({ silent: true });
    }

    return Promise.resolve();
  }

function isMutedChat(chatId) {
    const chat = (state.allChats || []).find((item) => {
      return Number(item.id) === Number(chatId);
    });

    if (!chat || !chat.isMuted) return false;
    if (!chat.mutedUntil) return true;

    return new Date(chat.mutedUntil).getTime() > Date.now();
  }
