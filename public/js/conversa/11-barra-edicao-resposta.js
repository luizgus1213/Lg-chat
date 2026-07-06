function syncEditingBar() {
    const bar = ui.el("editingBar");
    const preview = ui.el("editingPreview");
    const input = ui.el("messageInput");

    if (!bar || !preview || !input) return;

    if (!state.editingMessage) {
      bar.classList.add("hidden");
      preview.textContent = "";
      input.placeholder = "Digite sua mensagem...";
      return;
    }

    bar.classList.remove("hidden");
    preview.textContent = state.editingMessage.text || "Legenda vazia";
    input.placeholder = "Edite sua mensagem...";
  }

function syncReplyBar() {
    const bar = ui.el("replyBar");
    const author = ui.el("replyAuthor");
    const preview = ui.el("replyPreview");
    const input = ui.el("messageInput");

    if (!bar || !author || !preview || !input) return;

    if (!state.replyToMessage) {
      bar.classList.add("hidden");
      author.textContent = "";
      preview.textContent = "";

      if (!state.editingMessage) {
        input.placeholder = "Digite sua mensagem...";
      }

      return;
    }

    bar.classList.remove("hidden");
    author.textContent = `Respondendo ${getReplyAuthorLabel(state.replyToMessage)}`;
    preview.textContent = getReplyPreviewText(state.replyToMessage);

    if (!state.editingMessage) {
      input.placeholder = "Digite sua resposta...";
    }
  }

function startReplyMessage(message) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível responder essa mensagem.");
      return;
    }

    if (state.editingMessage) {
      cancelEditMessage();
      ui.el("messageInput").value = "";
    }

    state.replyToMessage = buildReplySnapshot(message);
    syncReplyBar();

    setTimeout(() => {
      ui.el("messageInput").focus();
    }, 50);
  }

function cancelReplyMessage() {
    state.replyToMessage = null;
    syncReplyBar();
  }

function scrollToMessage(messageId) {
    const element = findMessageElementById(messageId);

    if (!element) {
      ui.showToast("error", "Mensagem original não está carregada nessa conversa.");
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("message-highlight");

    setTimeout(() => {
      element.classList.remove("message-highlight");
    }, 1400);
  }

function getMessageTypeIcon(type) {
    if (type === "image") return "📷";
    if (type === "video") return "🎥";
    if (type === "audio") return "🎙️";
    if (type === "file") return "📎";
    return "💬";
  }

function getSearchResultPreview(message) {
    if (!message) return "Mensagem";
    if (message.deletedAt) return "Mensagem apagada";
    if (message.type === "image") return message.text ? `Foto: ${message.text}` : "Foto";
    if (message.type === "video") return message.text ? `Vídeo: ${message.text}` : "Vídeo";
    if (message.type === "audio") return message.text ? `Áudio: ${message.text}` : "Áudio";
    if (message.type === "file") return message.text ? `Documento: ${message.text}` : message.mediaOriginalName || "Documento";
    return message.text || message.mediaOriginalName || "Mensagem";
  }

function getSearchAuthorLabel(message) {
    if (state.currentUser && message.fromUserId === state.currentUser.id) {
      return "Você";
    }

    if (
      state.selectedChat &&
      state.selectedChat.privateUser &&
      Number(state.selectedChat.privateUser.id) === Number(message.fromUserId)
    ) {
      return state.selectedChat.privateUser.nome || "Contato";
    }

    return `Usuário #${message.fromUserId}`;
  }
