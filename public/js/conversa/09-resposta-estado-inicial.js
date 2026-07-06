function getReplyAuthorLabel(message) {
    if (!message) return "Mensagem";

    if (state.currentUser && message.fromUserId === state.currentUser.id) {
      return "Você";
    }

    return "Mensagem";
  }

function buildReplySnapshot(message) {
    if (!message) return null;

    return {
      id: message.id,
      chatId: message.chatId,
      fromUserId: message.fromUserId,
      text: message.text,
      type: message.type,
      mediaOriginalName: message.mediaOriginalName || null,
      deletedAt: message.deletedAt || null,
    };
  }

function closeMessageActionMenu() {
    const oldMenu = document.querySelector(".message-actions-menu");
    if (oldMenu) oldMenu.remove();
  }
