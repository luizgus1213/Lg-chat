function renderStarredMessages(messages) {
    const status = safeEl("starredMessagesStatus");
    const results = safeEl("starredMessagesResults");

    if (!status || !results) return;

    results.replaceChildren();

    if (!messages.length) {
      status.textContent = "Nenhuma mensagem favorita nessa conversa.";

      const empty = document.createElement("div");
      empty.className = "chat-search-empty";
      empty.textContent = "Favorite mensagens usando o menu da bolha.";
      results.appendChild(empty);
      return;
    }

    status.textContent = `${messages.length} favorita${messages.length === 1 ? "" : "s"} nessa conversa`;

    messages.forEach((message) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-search-result";
      item.title = "Ir para essa mensagem";

      const icon = document.createElement("span");
      icon.className = "chat-search-result-icon";
      icon.textContent = "⭐";

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

      results.appendChild(item);
    });
  }

function renderForwardChatChoices() {
    const list = safeEl("forwardChatsList");
    if (!list) return;

    list.replaceChildren();

    const chats = (state.allChats || []).filter((chat) => {
      if (!chat || !chat.id) return false;
      if (state.selectedChat && Number(chat.id) === Number(state.selectedChat.id)) {
        return true;
      }

      return !chat.isArchived;
    });

    if (!chats.length) {
      ui.setEmpty(list, "Nenhuma conversa disponível para encaminhar.");
      return;
    }

    chats.forEach((chat) => {
      const label = document.createElement("label");
      label.className = "forward-chat-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = String(chat.id);

      const avatar = createChatAvatar(chat, "mini-avatar");

      const body = document.createElement("div");
      body.className = "forward-chat-option-body";

      const title = document.createElement("strong");
      title.textContent = getChatName(chat);

      const subtitle = document.createElement("span");
      subtitle.textContent = getLastMessagePreview(chat);

      body.appendChild(title);
      body.appendChild(subtitle);

      label.appendChild(checkbox);
      label.appendChild(avatar);
      label.appendChild(body);

      list.appendChild(label);
    });
  }
