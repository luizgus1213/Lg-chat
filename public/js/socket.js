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
    });

    state.socket.on("connect", () => {
      console.log("Socket conectado:", state.socket.id);
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

        chat.loadChats().catch((error) => {
          console.error("Erro ao atualizar chats:", error);
        });

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
        chat.markChatAsRead(message.chatId, message.id).finally(() => {
          chat.loadChats().catch((error) => {
            console.error("Erro ao atualizar chats:", error);
          });
        });

        return;
      }

      chat.loadChats().catch((error) => {
        console.error("Erro ao atualizar chats:", error);
      });
    });

    state.socket.on("chat_message_updated", (message) => {
      const chat = window.LGChat.chat;
      const isCurrentChat =
        state.selectedChat && message.chatId === state.selectedChat.id;

      if (isCurrentChat) {
        chat.updateMessage(message, { preserveReactionMineState: true });
      }

      chat.loadChats().catch((error) => {
        console.error("Erro ao atualizar chats depois de editar/apagar:", error);
      });
    });

    state.socket.on("chat_updated", () => {
      window.LGChat.chat.loadChats().catch((error) => {
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
