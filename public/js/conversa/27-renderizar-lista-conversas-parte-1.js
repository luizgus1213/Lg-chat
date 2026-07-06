/* Corrigido: função renderChats completa neste arquivo. */

function renderChats() {
    const chatsList = ui.el("chatsList");
    const search = ui.el("chatSearch").value.toLowerCase().trim();

    const filtered = state.allChats.filter((chat) => {
      return getChatName(chat).toLowerCase().includes(search);
    });

    chatsList.replaceChildren();

    if (!filtered.length) {
      ui.setEmpty(
        chatsList,
        state.showArchivedChats
          ? "Nenhum chat arquivado encontrado."
          : "Nenhum chat encontrado.",
      );
      return;
    }

    const renderToken = `${Date.now()}-${Math.random()}`;
    renderChats.lastToken = renderToken;

    function createChatItem(chat) {
      const item = document.createElement("div");
      item.role = "button";
      item.tabIndex = 0;
      item.className = "chat-item";

      if (state.selectedChat && state.selectedChat.id === chat.id) {
        item.classList.add("active");
      }

      const unreadCount = Number(chat.unreadCount || 0);

      if (unreadCount > 0) {
        item.classList.add("has-unread");
      }

      if (chat.isPinned) {
        item.classList.add("is-pinned");
      }

      if (chat.isArchived) {
        item.classList.add("is-archived");
      }

      if (isMutedChat(chat)) {
        item.classList.add("is-muted");
      }

      const avatar = createChatAvatar(chat, "chat-avatar");

      const content = document.createElement("div");
      content.className = "chat-item-content";

      const top = document.createElement("div");
      top.className = "chat-item-top";

      const title = document.createElement("strong");
      title.textContent = getChatName(chat);

      const time = document.createElement("span");
      time.className = "chat-item-time";
      time.textContent = formatChatTime(chat.lastMessage?.createdAt || chat.updatedAt);

      const flags = document.createElement("span");
      flags.className = "chat-flags";
      flags.textContent = getChatFlagIcons(chat);

      const timeBox = document.createElement("div");
      timeBox.className = "chat-time-box";
      if (flags.textContent) timeBox.appendChild(flags);
      timeBox.appendChild(time);

      top.appendChild(title);
      top.appendChild(timeBox);

      const bottom = document.createElement("div");
      bottom.className = "chat-item-bottom";

      const subtitle = document.createElement("span");
      subtitle.className = "chat-last-message";
      subtitle.textContent = getLastMessagePreview(chat);

      bottom.appendChild(subtitle);

      if (unreadCount > 0) {
        const badge = document.createElement("span");
        badge.className = "chat-unread-badge";
        badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        bottom.appendChild(badge);
      }

      content.appendChild(top);
      content.appendChild(bottom);

      const optionsButton = document.createElement("button");
      optionsButton.type = "button";
      optionsButton.className = "chat-options-button";
      optionsButton.title = "Opções da conversa";
      optionsButton.textContent = "⋮";
      optionsButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openChatOptionsMenu(chat, optionsButton);
      });

      item.appendChild(avatar);
      item.appendChild(content);
      item.appendChild(optionsButton);

      item.addEventListener("click", () => {
        openChat(chat).catch((error) => ui.showToast("error", error.message));
      });

      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openChat(chat).catch((error) => ui.showToast("error", error.message));
      });

      item.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openChatOptionsMenu(chat, item);
      });

      return item;
    }

    const chunkSize = window.matchMedia && window.matchMedia("(max-width: 820px)").matches ? 12 : 24;
    let index = 0;

    function renderChunk() {
      if (renderChats.lastToken !== renderToken) return;

      const fragment = document.createDocumentFragment();
      const end = Math.min(index + chunkSize, filtered.length);

      while (index < end) {
        fragment.appendChild(createChatItem(filtered[index]));
        index += 1;
      }

      chatsList.appendChild(fragment);

      if (index < filtered.length) {
        window.requestAnimationFrame(renderChunk);
      }
    }

    renderChunk();
  }
