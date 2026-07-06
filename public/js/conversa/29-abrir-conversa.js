async function openChat(chat) {
    const requestedChatId = Number(chat.id);
    state.openingChatId = requestedChatId;

    ui.showMobileChat();

    const messagesBox = ui.el("messages");
    messagesBox.className = "messages";
    ui.setLoading(messagesBox, "Carregando mensagens...");

    if (
      state.editingMessage &&
      Number(state.editingMessage.chatId) !== requestedChatId
    ) {
      cancelEditMessage();
      ui.el("messageInput").value = "";
    }

    state.selectedChat = { ...chat };

    updateChatHeader(state.selectedChat);
    renderChats();

    if (state.socket && state.socket.connected) {
      state.socket.emit("join_chat", { chatId: requestedChatId });
    }

    const searchPanel = ui.el("chatSearchPanel");
    if (searchPanel && !searchPanel.classList.contains("hidden")) {
      ui.el("messageSearchInput").value = "";
      ui.el("messageSearchType").value = "all";
      resetChatSearchResults("Digite para pesquisar mensagens.");
    }

    const fullChatPromise = api.request(`/api/chats/${requestedChatId}`);
    const messagesPromise = loadChatMessages(requestedChatId);

    const fullChatData = await fullChatPromise;

    if (state.openingChatId !== requestedChatId) return;

    const fullChat = { ...chat, ...fullChatData.data };
    state.selectedChat = fullChat;

    updateChatHeader(fullChat);
    renderChats();

    await messagesPromise;

    const performanceApi = window.LGChat.performance;

    const loadInfo = () => {
      loadChatInfo(fullChat.id).catch((error) => {
        console.error("Erro ao carregar detalhes do chat:", error);
      });
    };

    if (performanceApi && typeof performanceApi.runWhenIdle === "function") {
      performanceApi.runWhenIdle(loadInfo, 900);
    } else {
      loadInfo();
    }
  }

async function loadChatMessages(chatId, options = {}) {
    const messagesBox = ui.el("messages");
    const pagination = getMessagePagination(chatId);
    const cache = getMessageCache(chatId);
    const canUseCache =
      options.force !== true &&
      cache.length > 0 &&
      Date.now() - Number(pagination.lastLoadedAt || 0) < 10_000;

    bindMessagesInfiniteScroll();

    if (canUseCache) {
      await renderMessagesReplace(chatId, cache);
      ui.scrollMessagesToBottom();

      const newest = getNewestMessage(cache);

      if (newest?.id) {
        scheduleMarkChatAsRead(chatId, newest.id);
        markChatListAsRead(chatId);
      }

      return cache;
    }

    const response = await api.request(`/api/chats/${chatId}/messages?limit=${INITIAL_MESSAGE_LIMIT}`);
    const messages = response.data || [];

    messagesBox.className = "messages";

    const merged = mergeMessagesIntoCache(chatId, messages, { replace: true });

    pagination.hasMore = messages.length >= INITIAL_MESSAGE_LIMIT;
    pagination.oldestId = getOldestMessageId(messages);
    pagination.lastLoadedAt = Date.now();

    await renderMessagesReplace(chatId, merged);
    ui.scrollMessagesToBottom();

    const lastMessage = getNewestMessage(messages);

    if (lastMessage?.id) {
      scheduleMarkChatAsRead(chatId, lastMessage.id);
      markChatListAsRead(chatId);
    }

    return messages;
  }
