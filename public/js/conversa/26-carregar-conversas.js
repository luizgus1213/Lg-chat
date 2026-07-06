async function loadChats(options = {}) {
    if (state.isLoadingChats && state.loadingChatsPromise) {
      return state.loadingChatsPromise;
    }

    const chatsList = ui.el("chatsList");
    const restoredFromCache = options.useCache !== false ? restoreChatsFromCache() : false;
    const shouldShowLoading =
      options.silent !== true &&
      !(state.allChats || []).length &&
      !restoredFromCache;

    if (shouldShowLoading) {
      ui.setLoading(
        chatsList,
        state.showArchivedChats ? "Carregando chats arquivados..." : "Carregando chats...",
      );
    }

    const query = state.showArchivedChats ? "?archived=true" : "";

    state.isLoadingChats = true;
    state.loadingChatsPromise = api.request(`/api/chats${query}`)
      .then((data) => {
        state.allChats = data.data || [];

        saveChatsToCache(state.allChats);

        if (state.selectedChat) {
          const refreshedSelectedChat = state.allChats.find((chat) => {
            return Number(chat.id) === Number(state.selectedChat.id);
          });

          if (refreshedSelectedChat) {
            state.selectedChat = {
              ...state.selectedChat,
              ...refreshedSelectedChat,
            };
          }
        }

        updateArchivedToggleButton();
        renderChats();

        return state.allChats;
      })
      .finally(() => {
        state.isLoadingChats = false;
        state.loadingChatsPromise = null;
      });

    return state.loadingChatsPromise;
  }
