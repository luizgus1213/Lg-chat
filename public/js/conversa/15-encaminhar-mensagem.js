function openForwardMessageModal(message) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível encaminhar essa mensagem.");
      return;
    }

    state.forwardingMessage = {
      id: Number(message.id),
      chatId: Number(message.chatId),
      text: getSearchResultPreview(message),
      type: message.type,
    };

    const modal = safeEl("forwardMessageModal");
    const preview = safeEl("forwardMessagePreview");

    if (!modal || !preview) return;

    preview.textContent = getSearchResultPreview(message);
    renderForwardChatChoices();
    modal.classList.remove("hidden");
  }

function closeForwardMessageModal() {
    state.forwardingMessage = null;

    const modal = safeEl("forwardMessageModal");
    const list = safeEl("forwardChatsList");
    const preview = safeEl("forwardMessagePreview");

    if (modal) modal.classList.add("hidden");
    if (list) list.replaceChildren();
    if (preview) preview.textContent = "";
  }

async function submitForwardMessage() {
    if (!state.forwardingMessage) {
      ui.showToast("error", "Nenhuma mensagem selecionada para encaminhar.");
      return;
    }

    const list = safeEl("forwardChatsList");
    const selected = list
      ? Array.from(list.querySelectorAll("input[type='checkbox']:checked"))
          .map((input) => Number(input.value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    if (!selected.length) {
      ui.showToast("error", "Escolha pelo menos uma conversa.");
      return;
    }

    const button = safeEl("sendForwardMessageButton");
    if (button) {
      button.disabled = true;
      button.textContent = "Encaminhando...";
    }

    try {
      await api.request(
        `/api/chats/${state.forwardingMessage.chatId}/messages/${state.forwardingMessage.id}/forward`,
        {
          method: "POST",
          body: JSON.stringify({
            targetChatIds: selected,
          }),
        },
      );

      ui.showToast("success", "Mensagem encaminhada.");
      closeForwardMessageModal();
      await loadChats({ silent: true });

      if (
        state.selectedChat &&
        selected.some((chatId) => Number(chatId) === Number(state.selectedChat.id))
      ) {
        await loadChatMessages(state.selectedChat.id);
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Encaminhar";
      }
    }
  }

async function toggleMessageStar(message) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível favoritar essa mensagem.");
      return;
    }

    const response = await api.request(
      `/api/chats/${message.chatId}/messages/${message.id}/star`,
      {
        method: "POST",
        body: JSON.stringify({
          starred: !message.isStarred,
        }),
      },
    );

    updateMessage(response.data, { preserveReactionMineState: true });

    ui.showToast(
      "success",
      response.data.isStarred ? "Mensagem favoritada." : "Mensagem removida das favoritas.",
    );

    const panel = safeEl("starredMessagesPanel");

    if (panel && !panel.classList.contains("hidden")) {
      openStarredMessagesPanel().catch((error) => {
        console.error("Erro ao atualizar favoritas:", error);
      });
    }

    return response.data;
  }
