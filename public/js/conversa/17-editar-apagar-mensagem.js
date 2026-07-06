async function submitEditedMessage() {
    if (!state.selectedChat || !state.editingMessage) return;

    const input = ui.el("messageInput");
    const text = input.value.trim();

    if (!text) {
      ui.showToast("error", "A mensagem editada não pode ficar vazia.");
      return;
    }

    const editing = state.editingMessage;

    const response = await api.request(
      `/api/chats/${editing.chatId}/messages/${editing.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ text }),
      },
    );

    updateMessage(response.data);
    ui.showToast("success", "Mensagem editada.");

    input.value = "";
    cancelEditMessage();
    await loadChats({ silent: true });
  }

async function deleteMessageForEveryone(message) {
    if (!isOwnEditableMessage(message)) {
      ui.showToast("error", "Você só pode apagar mensagens enviadas por você.");
      return;
    }

    const confirmed = window.confirm(
      "Apagar esta mensagem para todos? Essa ação não pode ser desfeita.",
    );

    if (!confirmed) return;

    const response = await api.request(
      `/api/chats/${message.chatId}/messages/${message.id}`,
      {
        method: "DELETE",
      },
    );

    updateMessage(response.data);

    if (
      state.editingMessage &&
      Number(state.editingMessage.id) === Number(message.id)
    ) {
      ui.el("messageInput").value = "";
      cancelEditMessage();
    }

    ui.showToast("success", "Mensagem apagada.");
    await loadChats({ silent: true });
  }

function findMessageElementById(messageId) {
    if (!isRealMessageId(messageId)) return null;

    const messagesBox = ui.el("messages");

    return messagesBox.querySelector(`[data-message-id="${messageId}"]`);
  }

function getMyReactionEmojisFromElement(element) {
    if (!element) return new Set();

    const emojis = new Set();

    element.querySelectorAll(".message-reaction.mine").forEach((reaction) => {
      const emoji = (reaction.textContent || "").trim().split(/\s+/)[0];
      if (emoji) emojis.add(emoji);
    });

    return emojis;
  }

function updateMessage(message, options = {}) {
    if (!message || !message.id) return;

    if (
      state.selectedChat &&
      message.chatId &&
      Number(message.chatId) !== Number(state.selectedChat.id)
    ) {
      return;
    }

    const existing = findMessageElementById(message.id);
    const myReactionEmojis = options.preserveReactionMineState
      ? getMyReactionEmojisFromElement(existing)
      : new Set();
    const reactions = Array.isArray(message.reactions)
      ? message.reactions.map((reaction) => ({
          ...reaction,
          reactedByMe:
            Boolean(reaction.reactedByMe) || myReactionEmojis.has(reaction.emoji),
        }))
      : message.reactions;

    const replacement = buildMessageElement({
      ...message,
      reactions,
      clientStatus:
        state.currentUser && message.fromUserId === state.currentUser.id
          ? "sent"
          : message.clientStatus,
    });

    if (existing) {
      existing.replaceWith(replacement);
      return;
    }

    addMessage(message);
  }
