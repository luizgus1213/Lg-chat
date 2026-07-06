function renderChatSearchResults(data) {
    const status = ui.el("messageSearchStatus");
    const resultsBox = ui.el("messageSearchResults");
    const results = Array.isArray(data?.results) ? data.results : [];
    const total = Number(data?.total || results.length);
    const typeLabel = getSearchTypeLabel(data?.type || "all");

    resultsBox.replaceChildren();

    if (!results.length) {
      status.textContent = `Nenhum resultado encontrado em ${typeLabel.toLowerCase()}.`;

      const empty = document.createElement("div");
      empty.className = "chat-search-empty";
      empty.textContent = "Tente outra palavra ou outro filtro.";
      resultsBox.appendChild(empty);
      return;
    }

    status.textContent = `${total} resultado${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"} • ${typeLabel}`;

    results.forEach((message) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-search-result";
      item.title = "Ir para essa mensagem";

      const icon = document.createElement("span");
      icon.className = "chat-search-result-icon";
      icon.textContent = getMessageTypeIcon(message.type);

      const body = document.createElement("div");
      body.className = "chat-search-result-body";

      const author = document.createElement("strong");
      author.className = "chat-search-result-author";
      author.textContent = getSearchAuthorLabel(message);

      const preview = document.createElement("span");
      preview.className = "chat-search-result-preview";
      preview.textContent = getSearchResultPreview(message);

      body.appendChild(author);
      body.appendChild(preview);

      const time = document.createElement("span");
      time.className = "chat-search-result-time";
      time.textContent = ui.formatDate(message.createdAt);

      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(time);

      item.addEventListener("click", () => {
        openSearchResult(message).catch((error) => {
          ui.showToast("error", error.message);
        });
      });

      resultsBox.appendChild(item);
    });
  }

async function openSearchResult(message) {
    if (!state.selectedChat || Number(message.chatId) !== Number(state.selectedChat.id)) {
      return;
    }

    let element = findMessageElementById(message.id);

    if (!element) {
      const beforeId = Number(message.id) + 1;
      const response = await api.request(
        `/api/chats/${message.chatId}/messages?limit=80&beforeId=${beforeId}`,
      );

      const messages = response.data || [];
      const messagesBox = ui.el("messages");
      messagesBox.className = "messages";
      mergeMessagesIntoCache(message.chatId, messages, { replace: true });
      await renderMessagesReplace(message.chatId, getMessageCache(message.chatId));

      element = findMessageElementById(message.id);
    }

    if (!element) {
      ui.showToast("error", "Não consegui carregar essa mensagem.");
      return;
    }

    scrollToMessage(message.id);
  }

function closeStarredMessagesPanel() {
    const panel = safeEl("starredMessagesPanel");
    if (!panel) return;

    panel.classList.add("hidden");

    const results = safeEl("starredMessagesResults");
    if (results) results.replaceChildren();
  }

async function openStarredMessagesPanel() {
    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa para ver favoritas.");
      return;
    }

    const panel = safeEl("starredMessagesPanel");
    const status = safeEl("starredMessagesStatus");
    const results = safeEl("starredMessagesResults");

    if (!panel || !status || !results) return;

    panel.classList.remove("hidden");
    results.replaceChildren();
    status.textContent = "Carregando favoritas...";

    const response = await api.request(
      `/api/chats/${state.selectedChat.id}/messages/starred?limit=80`,
    );

    renderStarredMessages(response.data || []);
  }
