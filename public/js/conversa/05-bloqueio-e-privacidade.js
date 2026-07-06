function isBlockedChat(chat = state.selectedChat) {
    const block = getChatBlock(chat);

    return Boolean(block.isBlocked || block.blockedByMe || block.blockedMe);
  }

function getBlockNoticeText(chat = state.selectedChat) {
    const block = getChatBlock(chat);

    if (block.blockedByMe && block.blockedMe) {
      return "Você e esse contato estão bloqueados. Desbloqueie para voltar a conversar.";
    }

    if (block.blockedByMe) {
      return "Você bloqueou esse contato. Desbloqueie para enviar mensagens.";
    }

    if (block.blockedMe) {
      return "Você não pode enviar mensagens para esse contato.";
    }

    return "";
  }

function syncBlockNotice() {
    const notice = safeEl("chatBlockNotice");
    const input = safeEl("messageInput");
    const sendButton = safeEl("sendMessageButton");
    const mediaButton = safeEl("mediaButton");
    const voiceButton = safeEl("voiceButton");

    const blocked = isBlockedChat(state.selectedChat);
    const text = getBlockNoticeText(state.selectedChat);

    if (notice) {
      notice.classList.toggle("hidden", !blocked);
      notice.textContent = text;
    }

    if (!state.selectedChat) return;

    if (input) {
      input.disabled = blocked;
      input.placeholder = blocked ? "Contato bloqueado" : "Digite sua mensagem...";
    }

    if (sendButton) sendButton.disabled = blocked;
    if (mediaButton) mediaButton.disabled = blocked;
    if (voiceButton) voiceButton.disabled = blocked;
  }

function closeChatOptionsMenu() {
    const oldMenu = document.querySelector(".chat-options-menu");
    if (oldMenu) oldMenu.remove();
  }

function updateArchivedToggleButton() {
    const button = ui.el("toggleArchivedChatsButton");

    if (!button) return;

    const showingArchived = Boolean(state.showArchivedChats);
    button.classList.toggle("active", showingArchived);
    button.textContent = showingArchived ? "← Voltar aos chats" : "Arquivadas";
    button.title = showingArchived
      ? "Voltar para conversas principais"
      : "Ver conversas arquivadas";
  }

async function toggleArchivedChats() {
    state.showArchivedChats = !state.showArchivedChats;
    updateArchivedToggleButton();

    if (state.showArchivedChats) {
      ui.showToast("success", "Mostrando conversas arquivadas.");
    }

    await loadChats({ silent: true });
  }

async function updateChatPreferences(chatId, preferences) {
    const response = await api.request(`/api/chats/${chatId}/preferences`, {
      method: "PATCH",
      body: JSON.stringify(preferences),
    });

    const updated = response.data;

    state.allChats = (state.allChats || []).map((chat) => {
      if (Number(chat.id) !== Number(chatId)) return chat;

      return {
        ...chat,
        ...updated,
      };
    });

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      state.selectedChat = {
        ...state.selectedChat,
        ...updated,
      };
    }

    return updated;
  }

function getMuteUntil(hours) {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return date.toISOString();
  }
