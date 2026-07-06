async function loadOlderMessages(chatId) {
    const pagination = getMessagePagination(chatId);

    if (pagination.isLoadingOlder || !pagination.hasMore) return [];

    const cache = getMessageCache(chatId);
    const beforeId = pagination.oldestId || getOldestMessageId(cache);

    if (!beforeId) {
      pagination.hasMore = false;
      return [];
    }

    pagination.isLoadingOlder = true;

    const messagesBox = ui.el("messages");
    const loading = createMessagesLoadingMore();
    messagesBox.prepend(loading);

    try {
      const response = await api.request(`/api/chats/${chatId}/messages?limit=${OLDER_MESSAGE_LIMIT}&beforeId=${beforeId}`);
      const olderMessages = response.data || [];

      pagination.hasMore = olderMessages.length >= OLDER_MESSAGE_LIMIT;
      pagination.oldestId = getOldestMessageId(olderMessages) || beforeId;
      pagination.lastLoadedAt = Date.now();

      mergeMessagesIntoCache(chatId, olderMessages);
      loading.remove();

      await prependOlderMessages(chatId, olderMessages);

      return olderMessages;
    } finally {
      loading.remove();
      pagination.isLoadingOlder = false;
    }
  }

function scheduleMarkChatAsRead(chatId, messageId) {
    if (!chatId || !messageId) return Promise.resolve();

    const key = getChatCacheKey(chatId);
    const current = Number(state.pendingReadByChat?.[key] || 0);
    const nextId = Math.max(current, Number(messageId));

    state.pendingReadByChat = state.pendingReadByChat || {};
    state.pendingReadTimers = state.pendingReadTimers || {};
    state.pendingReadByChat[key] = nextId;

    window.clearTimeout(state.pendingReadTimers[key]);

    return new Promise((resolve) => {
      state.pendingReadTimers[key] = window.setTimeout(() => {
        const latestId = Number(state.pendingReadByChat[key] || nextId);

        delete state.pendingReadByChat[key];
        delete state.pendingReadTimers[key];

        markChatAsRead(chatId, latestId)
          .then(resolve)
          .catch((error) => {
            console.error("Erro ao marcar mensagens como lidas:", error);
            resolve();
          });
      }, 450);
    });
  }

const CHAT_CACHE_TTL_MS = 5 * 60 * 1000;

const USERS_CACHE_TTL_MS = 20 * 60 * 1000;

function getUserScopedKey(name) {
    const userId = state.currentUser && state.currentUser.id ? state.currentUser.id : "anon";
    return `lgchat:${name}:${userId}`;
  }

function readJsonCache(key, maxAgeMs) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!parsed || !Array.isArray(parsed.data)) return null;
      if (Date.now() - Number(parsed.savedAt || 0) > maxAgeMs) return null;

      return parsed.data;
    } catch (_error) {
      return null;
    }
  }

function writeJsonCache(key, data) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          savedAt: Date.now(),
          data,
        }),
      );
    } catch (_error) {
      // Cache local é opcional.
    }
  }

function getChatsCacheKey() {
    return `${getUserScopedKey("chats")}:${state.showArchivedChats ? "archived" : "active"}`;
  }
