function createReplyPreviewElement(replyTo) {
    if (!replyTo) return null;

    const box = document.createElement("button");
    box.type = "button";
    box.className = "message-reply-preview";
    box.title = "Ir para mensagem respondida";

    const author = document.createElement("strong");
    author.textContent = getReplyAuthorLabel(replyTo);

    const preview = document.createElement("span");
    preview.textContent = getReplyPreviewText(replyTo);

    box.appendChild(author);
    box.appendChild(preview);

    if (replyTo.id) {
      box.addEventListener("click", (event) => {
        event.stopPropagation();
        scrollToMessage(replyTo.id);
      });
    }

    return box;
  }

function createReactionsElement(message) {
    const reactions = Array.isArray(message.reactions)
      ? message.reactions.filter((reaction) => Number(reaction.count) > 0)
      : [];

    if (!reactions.length || !isRealMessageId(message.id)) return null;

    const box = document.createElement("div");
    box.className = "message-reactions";

    reactions.forEach((reaction) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "message-reaction";

      if (reaction.reactedByMe) {
        button.classList.add("mine");
      }

      button.textContent = `${reaction.emoji} ${reaction.count}`;
      button.title = reaction.reactedByMe
        ? "Clique para remover sua reação"
        : `Reagir com ${reaction.emoji}`;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMessageReaction(message, reaction.emoji).catch((error) => {
          ui.showToast("error", error.message);
        });
      });

      box.appendChild(button);
    });

    return box;
  }

async function toggleMessageReaction(message, emoji) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível reagir a essa mensagem.");
      return;
    }

    const response = await api.request(
      `/api/chats/${message.chatId}/messages/${message.id}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      },
    );

    updateMessage(response.data);
  }

function startEditMessage(message) {
    if (!isOwnEditableMessage(message)) {
      ui.showToast("error", "Você só pode editar mensagens enviadas por você.");
      return;
    }

    if (state.replyToMessage) {
      cancelReplyMessage();
    }

    state.editingMessage = {
      id: Number(message.id),
      chatId: Number(message.chatId),
      text: message.text || "",
      type: message.type,
    };

    const input = ui.el("messageInput");
    input.value = message.text || "";
    syncEditingBar();

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 50);
  }

function cancelEditMessage() {
    state.editingMessage = null;
    syncEditingBar();
  }
