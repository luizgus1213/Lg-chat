async function sendMediaMessage(file, captionOverride) {
    if (!validateMediaFile(file)) return;

    const caption =
      typeof captionOverride === "string"
        ? captionOverride.trim()
        : ui.el("messageInput").value.trim();

    const formData = new FormData();
    formData.append("media", file);

    if (caption) formData.append("caption", caption);

    if (state.replyToMessage && state.replyToMessage.id) {
      formData.append("replyToMessageId", String(state.replyToMessage.id));
    }

    const data = await api.request(`/api/chats/${state.selectedChat.id}/media`, {
      method: "POST",
      body: formData,
    });

    ui.el("messageInput").value = "";
    cancelReplyMessage();

    if (!state.socket || !state.socket.connected) {
      addMessage({
        ...data.data,
        clientStatus: "sent",
      });
      ui.scrollMessagesToBottom();
    }

    if (applyMessageToChatList) {
      applyMessageToChatList(data.data, { incrementUnread: false });
    }

    scheduleChatsRefresh("media-sent", 1200).catch((error) => {
      console.error("Erro ao atualizar chats depois de mídia:", error);
    });

    return data.data;
  }

function handleTyping() {
    if (!state.selectedChat || !state.socket || !state.socket.connected) return;

    state.socket.emit("typing_start", { chatId: state.selectedChat.id });

    clearTimeout(state.typingTimeout);

    state.typingTimeout = setTimeout(() => {
      if (!state.socket || !state.selectedChat) return;
      state.socket.emit("typing_stop", { chatId: state.selectedChat.id });
    }, 900);
  }

function openGroupAvatarPicker(chatId) {
    const input = ui.el("groupAvatarInput");
    input.value = "";
    input.dataset.chatId = String(chatId);
    input.click();
  }

async function uploadGroupAvatar(chatId, file) {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      ui.showToast("error", "Use uma imagem JPG, PNG ou WEBP.");
      return;
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      ui.showToast("error", "A imagem deve ter no máximo 2MB.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    const data = await api.request(`/api/chats/${chatId}/avatar`, {
      method: "POST",
      body: formData,
    });

    const updatedChat = data.data;
    ui.showToast("success", "Foto do grupo atualizada.");

    state.selectedChat = { ...(state.selectedChat || {}), ...updatedChat };
    updateChatHeader(state.selectedChat);

    await loadChats({ silent: true });

    state.allChats = state.allChats.map((chat) => {
      if (chat.id !== chatId) return chat;
      return { ...chat, ...updatedChat };
    });

    renderChats();
    await Promise.all([loadChatInfo(chatId), loadChatMessages(chatId)]);
  }
