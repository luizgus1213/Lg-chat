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
