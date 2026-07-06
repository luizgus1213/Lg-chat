function formatMemberRole(role) {
    if (role === "owner") return "Dono";
    if (role === "admin") return "Administrador";
    return "Membro";
  }

async function leaveCurrentGroup(chatId, chatName) {
    const confirmed = window.confirm(`Tem certeza que deseja sair do grupo "${chatName}"?`);
    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}/leave`, { method: "POST" });
    ui.showToast("success", "Você saiu do grupo.");

    if (state.selectedChat && state.selectedChat.id === chatId) {
      state.selectedChat = null;
    }

    await loadChats({ silent: true });
    ui.resetChatScreen();
  }

async function deleteCurrentGroup(chatId, chatName) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o grupo "${chatName}"? Essa ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}`, { method: "DELETE" });
    ui.showToast("success", "Grupo excluído com sucesso.");

    if (state.selectedChat && state.selectedChat.id === chatId) {
      state.selectedChat = null;
    }

    await loadChats({ silent: true });
    ui.resetChatScreen();
  }

async function updateBlockContact(chatId, blocked) {
    const response = await api.request(`/api/chats/${chatId}/block`, {
      method: "PATCH",
      body: JSON.stringify({ blocked }),
    });

    const block = response.data.block;

    state.allChats = (state.allChats || []).map((chat) => {
      if (Number(chat.id) !== Number(chatId)) return chat;

      return {
        ...chat,
        block,
      };
    });

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      state.selectedChat = {
        ...state.selectedChat,
        block,
      };

      updateChatHeader(state.selectedChat);
      syncBlockNotice();
      await loadChatInfo(chatId);
    }

    await loadChats({ silent: true });

    return block;
  }

async function clearCurrentChat(chatId, chatName) {
    const confirmed = window.confirm(
      `Limpar a conversa "${chatName}" somente para você? As mensagens continuarão aparecendo para a outra pessoa.`,
    );

    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}/clear`, {
      method: "POST",
    });

    ui.showToast("success", "Conversa limpa somente para você.");

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      cancelReplyMessage();
      cancelEditMessage();
      ui.el("messageInput").value = "";
      await loadChatMessages(chatId);
      await loadChatInfo(chatId);
    }

    await loadChats({ silent: true });
  }

async function deleteCurrentChatForMe(chatId, chatName) {
    const confirmed = window.confirm(
      `Apagar a conversa "${chatName}" somente para você? Ela vai sair da sua lista, mas a outra pessoa não será afetada.`,
    );

    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}/delete-for-me`, {
      method: "POST",
    });

    ui.showToast("success", "Conversa apagada somente para você.");

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      state.selectedChat = null;
    }

    await loadChats({ silent: true });
    ui.closeInfoPanel();
    ui.resetChatScreen();
  }
