(() => {
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

  function connectSocket() {
    if (state.socket) {
      state.socket.disconnect();
    }

    state.socket = io({
      auth: {
        token: state.token,
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5000,
      timeout: 12000,
      transports: ["websocket", "polling"],
    });

    state.socket.on("connect", () => {
      console.log("Socket conectado:", state.socket.id);
      document.body.classList.remove("socket-offline");
      document.body.classList.add("socket-online");

      if (window.LGChat.performance && typeof window.LGChat.performance.scheduleLoadChats === "function") {
        window.LGChat.performance.scheduleLoadChats("socket-reconnected", 500).catch(() => undefined);
      }
    });

    state.socket.on("disconnect", (reason) => {
      document.body.classList.remove("socket-online");
      document.body.classList.add("socket-offline");

      if (reason !== "io client disconnect") {
        ui.showToast("error", "Conexão em tempo real caiu. Tentando reconectar...");
      }
    });

    state.socket.io.on("reconnect", () => {
      document.body.classList.remove("socket-offline");
      document.body.classList.add("socket-online");
      ui.showToast("success", "Conexão em tempo real restaurada.");
    });

    state.socket.io.on("reconnect_failed", () => {
      ui.showToast("error", "Não foi possível reconectar em tempo real. Recarregue a página.");
    });

    state.socket.on("connect_error", (error) => {
      ui.showToast("error", error.message || "Erro ao conectar no socket.");
    });

    state.socket.on("server_error", (error) => {
      ui.showToast("error", error.message || "Erro recebido do servidor.");
    });

    state.socket.on("chat_message", (message) => {
      const chat = window.LGChat.chat;
      const isCurrentChat =
        state.selectedChat && message.chatId === state.selectedChat.id;

      if (!isCurrentChat) {
        if (!isMutedChat(message.chatId)) {
          ui.showToast("success", "Nova mensagem recebida.");
          notifyNewMessage(message);
        }

        if (!chat.applyMessageToChatList || !chat.applyMessageToChatList(message, { incrementUnread: true })) {
          scheduleChatsRefresh("message", 700).catch((error) => {
            console.error("Erro ao atualizar chats:", error);
          });
        }

        return;
      }

      chat.addMessage(
        state.currentUser && message.fromUserId === state.currentUser.id
          ? { ...message, clientStatus: "sent" }
          : message,
      );

      const pwa = window.LGChat.pwa;
      if (pwa && typeof pwa.clearUnreadCount === "function" && document.visibilityState === "visible") {
        pwa.clearUnreadCount();
      }

      ui.scrollMessagesToBottom();

      if (!state.currentUser || message.fromUserId !== state.currentUser.id) {
        if (typeof chat.scheduleMarkChatAsRead === "function") {
          chat.scheduleMarkChatAsRead(message.chatId, message.id);
        } else {
          chat.markChatAsRead(message.chatId, message.id).catch((error) => {
            console.error("Erro ao marcar chat como lido:", error);
          });
        }

        if (typeof chat.markChatListAsRead === "function") {
          chat.markChatListAsRead(message.chatId);
        }

        return;
      }

      if (chat.applyMessageToChatList) {
        chat.applyMessageToChatList(message, { incrementUnread: false });
      }

      if (chat.applyMessageToChatList) {
        chat.applyMessageToChatList(message, { incrementUnread: false });
      }
    });

    state.socket.on("chat_message_updated", (message) => {
      const chat = window.LGChat.chat;
      const isCurrentChat =
        state.selectedChat && message.chatId === state.selectedChat.id;

      if (isCurrentChat) {
        chat.updateMessage(message, { preserveReactionMineState: true });
      }

      scheduleChatsRefresh("message-updated", 800).catch((error) => {
        console.error("Erro ao atualizar chats depois de editar/apagar:", error);
      });
    });

    state.socket.on("chat_updated", () => {
      const delay = document.visibilityState === "hidden" ? 2500 : 900;

      scheduleChatsRefresh("chat-updated", delay).catch((error) => {
        console.error("Erro ao atualizar lista de chats:", error);
      });
    });

    state.socket.on("user_status", (payload) => {
      const chat = window.LGChat.chat;

      if (chat && typeof chat.handleUserStatusUpdate === "function") {
        chat.handleUserStatusUpdate(payload);
      }
    });

    state.socket.on("typing_start", (payload) => {
      if (!state.selectedChat || payload.chatId !== state.selectedChat.id) return;
      if (state.currentUser && payload.userId === state.currentUser.id) return;

      ui.el("typingText").textContent = `${payload.nome} está digitando...`;
    });

    state.socket.on("typing_stop", (payload) => {
      if (!state.selectedChat || payload.chatId !== state.selectedChat.id) return;
      ui.el("typingText").textContent = "";
    });

    const call = window.LGChat.call;
    if (call && typeof call.bindSocket === "function") {
      call.bindSocket(state.socket);
    }
  }

  window.LGChat.socket = {
    connectSocket,
    requestNotificationPermission,
  };
})();
