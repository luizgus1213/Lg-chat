const state = window.LGChat.state;

const api = window.LGChat.api;

const ui = window.LGChat.ui;

state.showArchivedChats = Boolean(state.showArchivedChats);

function scheduleChatsRefresh(reason = "chat", delay = 700) {
    const performanceApi = window.LGChat.performance;

    if (performanceApi && typeof performanceApi.scheduleLoadChats === "function") {
      return performanceApi.scheduleLoadChats(reason, delay);
    }

    return loadChats({ silent: true });
  }

function applyMessageToChatList(message, options = {}) {
    if (!message || !message.chatId || !Array.isArray(state.allChats)) {
      return false;
    }

    let found = false;
    const chatId = Number(message.chatId);
    const selectedChatId = state.selectedChat ? Number(state.selectedChat.id) : null;
    const isCurrentChat = selectedChatId === chatId;
    const isMine = state.currentUser && Number(message.fromUserId) === Number(state.currentUser.id);

    state.allChats = state.allChats.map((chat) => {
      if (Number(chat.id) !== chatId) return chat;

      found = true;

      const shouldIncrementUnread =
        options.incrementUnread === true && !isCurrentChat && !isMine;

      return {
        ...chat,
        lastMessage: {
          ...(chat.lastMessage || {}),
          ...message,
        },
        updatedAt: message.createdAt || new Date().toISOString(),
        unreadCount: shouldIncrementUnread
          ? Number(chat.unreadCount || 0) + 1
          : Number(chat.unreadCount || 0),
      };
    });

    if (found) {
      renderChats();
    }

    return found;
  }

function markChatListAsRead(chatId) {
    if (!chatId || !Array.isArray(state.allChats)) return;

    let changed = false;

    state.allChats = state.allChats.map((chat) => {
      if (Number(chat.id) !== Number(chatId)) return chat;
      if (Number(chat.unreadCount || 0) === 0) return chat;

      changed = true;
      return {
        ...chat,
        unreadCount: 0,
      };
    });

    if (changed) {
      renderChats();
    }
  }

function getChatName(chat) {
    if (!chat) return "Chat";
    if (chat.type === "private" && chat.privateUser) {
      return chat.privateUser.nome || `Contato #${chat.privateUser.id}`;
    }
    if (chat.name) return chat.name;
    if (chat.type === "private") return `Conversa privada #${chat.id}`;
    return `Chat #${chat.id}`;
  }

function getChatInitial(chat) {
    return getChatName(chat).charAt(0).toUpperCase();
  }

function getAvatarUrl(chat) {
    if (!chat) return null;

    if (chat.type === "private" && chat.privateUser) {
      return chat.privateUser.avatarUrl || null;
    }

    return chat.avatarUrl || null;
  }
