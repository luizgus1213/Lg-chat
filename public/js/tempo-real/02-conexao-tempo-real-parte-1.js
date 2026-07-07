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

    if (
      window.LGChat.performance &&
      typeof window.LGChat.performance.scheduleLoadChats === "function"
    ) {
      window.LGChat.performance
        .scheduleLoadChats("socket-reconnected", 500)
        .catch(() => undefined);
    }
  });

  state.socket.on("disconnect", (reason) => {
    document.body.classList.remove("socket-online");
    document.body.classList.add("socket-offline");

    if (reason !== "io client disconnect") {
      ui.showToast(
        "error",
        "Conexão em tempo real caiu. Tentando reconectar...",
      );
    }
  });

  state.socket.io.on("reconnect", () => {
    document.body.classList.remove("socket-offline");
    document.body.classList.add("socket-online");
    ui.showToast("success", "Conexão em tempo real restaurada.");
  });

  state.socket.io.on("reconnect_failed", () => {
    ui.showToast(
      "error",
      "Não foi possível reconectar em tempo real. Recarregue a página.",
    );
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

      if (
        !chat.applyMessageToChatList ||
        !chat.applyMessageToChatList(message, { incrementUnread: true })
      ) {
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
    if (
      state.currentUser &&
      Number(message.fromUserId) !== Number(state.currentUser.id) &&
      !isMutedChat(message.chatId)
    ) {
      notifyNewMessage(message, {
        forceSystem: document.visibilityState !== "visible",
      });
    }

    const pwa = window.LGChat.pwa;
    if (
      pwa &&
      typeof pwa.clearUnreadCount === "function" &&
      document.visibilityState === "visible"
    ) {
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

    if (!isCurrentChat) {
      if (chat.applyMessageToChatList) {
        chat.applyMessageToChatList(message, { incrementUnread: false });
      }
      return;
    }

    chat.updateMessage(message);
  });
}
