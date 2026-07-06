function getMessageStatusText(message) {
    if (!state.currentUser || message.fromUserId !== state.currentUser.id) {
      return "";
    }

    if (message.clientStatus === "sending") {
      return "•";
    }

    if (message.clientStatus === "error") {
      return "!";
    }

    if (message.clientStatus === "read") {
      return "✓✓";
    }

    return "✓";
  }

function getMessageStatusTitle(message) {
    if (message.clientStatus === "sending") return "Enviando";
    if (message.clientStatus === "error") return "Erro ao enviar";
    if (message.clientStatus === "read") return "Lida";
    return "Enviada";
  }

function findMessageElementByClientId(clientId) {
    if (!clientId) return null;

    const messagesBox = ui.el("messages");

    return Array.from(messagesBox.children).find((child) => {
      return child.dataset && child.dataset.clientId === String(clientId);
    });
  }

function markLocalMessageAsError(clientId) {
    const messageElement = findMessageElementByClientId(clientId);

    if (!messageElement) return;

    messageElement.classList.add("message-error");

    const status = messageElement.querySelector(".message-status");

    if (status) {
      status.textContent = "!";
      status.title = "Erro ao enviar";
    }
  }

async function markChatAsRead(chatId, messageId) {
    if (!chatId || !messageId) return;

    try {
      await api.request(`/api/chats/${chatId}/read`, {
        method: "POST",
        body: JSON.stringify({ messageId }),
      });

      if (state.selectedChat && state.selectedChat.id === chatId) {
        state.selectedChat.lastReadMessageId = messageId;
      }

      markChatListAsRead(chatId);
    } catch (error) {
      console.error("Erro ao marcar chat como lido:", error);
    }
  }

function isRealMessageId(messageId) {
    return (
      messageId &&
      !String(messageId).startsWith("temp-") &&
      Number.isFinite(Number(messageId))
    );
  }

function isOwnEditableMessage(message) {
    return Boolean(
      state.currentUser &&
        message &&
        message.fromUserId === state.currentUser.id &&
        isRealMessageId(message.id) &&
        message.type !== "system" &&
        !message.deletedAt &&
        message.clientStatus !== "sending" &&
        message.clientStatus !== "error",
    );
  }

function isActionableMessage(message) {
    return Boolean(
      message &&
        isRealMessageId(message.id) &&
        message.type !== "system" &&
        !message.deletedAt &&
        message.clientStatus !== "sending" &&
        message.clientStatus !== "error",
    );
  }

function getReplyPreviewText(message) {
    if (!message) return "Mensagem";
    if (message.deletedAt) return "Mensagem apagada";
    if (message.type === "image") return message.text ? `Foto: ${message.text}` : "Foto";
    if (message.type === "video") return message.text ? `Vídeo: ${message.text}` : "Vídeo";
    if (message.type === "audio") return message.text ? `Áudio: ${message.text}` : "Áudio";
    if (message.type === "file") return message.text ? `Documento: ${message.text}` : message.mediaOriginalName || "Documento";
    return message.text || "Mensagem";
  }
