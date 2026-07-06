function sendMessage() {
    if (state.editingMessage) {
      submitEditedMessage().catch((error) => {
        ui.showToast("error", error.message);
      });
      return;
    }

    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de enviar mensagem.");
      return;
    }

    if (isBlockedChat()) {
      ui.showToast("error", getBlockNoticeText());
      return;
    }

    if (!state.socket || !state.socket.connected) {
      ui.showToast("error", "Socket desconectado. Recarregue a página.");
      return;
    }

    const input = ui.el("messageInput");
    const text = input.value.trim();

    if (!text) {
      ui.showToast("error", "Digite uma mensagem.");
      return;
    }

    const clientId = makeClientId();
    const replyToMessage = state.replyToMessage ? buildReplySnapshot(state.replyToMessage) : null;
    const replyToMessageId = replyToMessage ? Number(replyToMessage.id) : undefined;

    addMessage({
      id: `temp-${clientId}`,
      chatId: state.selectedChat.id,
      fromUserId: state.currentUser.id,
      text,
      type: "text",
      createdAt: new Date().toISOString(),
      replyToMessageId: replyToMessageId ?? null,
      replyTo: replyToMessage,
      clientId,
      clientStatus: "sending",
    });

    ui.scrollMessagesToBottom();

    input.value = "";
    ui.el("typingText").textContent = "";

    state.socket.emit(
      "chat_message",
      {
        chatId: state.selectedChat.id,
        text,
        clientId,
        replyToMessageId,
      },
      (response) => {
        if (!response || !response.success) {
          markLocalMessageAsError(clientId);

          ui.showToast(
            "error",
            response?.error?.message || "Erro ao enviar mensagem.",
          );
          return;
        }

        addMessage({
          ...response.data,
          clientId,
          clientStatus: "sent",
        });

        cancelReplyMessage();

        if (applyMessageToChatList) {
          applyMessageToChatList(response.data, { incrementUnread: false });
        }

        scheduleChatsRefresh("message-sent", 1200).catch((error) => {
          console.error("Erro ao atualizar chats depois de enviar:", error);
        });
      },
    );
  }
