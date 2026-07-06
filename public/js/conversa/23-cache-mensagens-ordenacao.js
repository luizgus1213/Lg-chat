function getOldestMessageId(messages) {
    const ids = (messages || []).map(getRealMessageId).filter((id) => Number.isInteger(id) && id > 0);
    return ids.length ? Math.min(...ids) : null;
  }

function getNewestMessage(messages) {
    const withIds = (messages || []).filter((message) => getRealMessageId(message));
    return withIds.length ? withIds[withIds.length - 1] : null;
  }

function removeMessagePlaceholders(messagesBox) {
    messagesBox.querySelectorAll(".empty-chat, .loading, .messages-loading-more").forEach((node) => node.remove());
  }

function createMessagesLoadingMore() {
    const loading = document.createElement("div");
    loading.className = "messages-loading-more";
    loading.textContent = "Carregando mensagens antigas...";
    return loading;
  }

function createEmptyMessagesState() {
    const empty = document.createElement("div");
    empty.className = "empty-chat";
    empty.textContent = "Nenhuma mensagem ainda. Seja o primeiro a enviar.";
    return empty;
  }

function renderMessageNodes(messages) {
    return (messages || []).map((message) => buildMessageElement(message));
  }

function trimRenderedMessagesIfNeeded() {
    const messagesBox = ui.el("messages");
    const removable = Array.from(messagesBox.children).filter((child) => child.classList && child.classList.contains("message"));
    if (removable.length <= MAX_RENDERED_MESSAGES) return;
    const removeCount = removable.length - MAX_RENDERED_MESSAGES;
    for (let index = 0; index < removeCount; index += 1) removable[index].remove();
  }

async function renderMessagesReplace(chatId, messages) {
    const messagesBox = ui.el("messages");
    messagesBox.className = "messages";
    messagesBox.replaceChildren();

    if (!messages.length) {
      messagesBox.appendChild(createEmptyMessagesState());
      return;
    }

    const nodes = renderMessageNodes(messages);
    const performanceApi = window.LGChat.performance;

    if (performanceApi && typeof performanceApi.appendFragmentInChunks === "function") {
      await performanceApi.appendFragmentInChunks(messagesBox, nodes, { chunkSize: 22 });
    } else {
      const fragment = document.createDocumentFragment();
      nodes.forEach((node) => fragment.appendChild(node));
      messagesBox.appendChild(fragment);
    }
  }

async function prependOlderMessages(chatId, olderMessages) {
    if (!olderMessages.length) return;

    const messagesBox = ui.el("messages");
    const previousHeight = messagesBox.scrollHeight;
    const previousTop = messagesBox.scrollTop;

    removeMessagePlaceholders(messagesBox);

    const fragment = document.createDocumentFragment();
    renderMessageNodes(olderMessages).forEach((node) => fragment.appendChild(node));
    messagesBox.prepend(fragment);
    messagesBox.scrollTop = messagesBox.scrollHeight - previousHeight + previousTop;
  }

function bindMessagesInfiniteScroll() {
    const messagesBox = ui.el("messages");
    if (!messagesBox || messagesBox.dataset.infiniteScrollBound === "true") return;

    messagesBox.dataset.infiniteScrollBound = "true";

    const onScroll = () => {
      if (!state.selectedChat) return;
      if (messagesBox.scrollTop > 90) return;

      loadOlderMessages(state.selectedChat.id).catch((error) => {
        console.error("Erro ao carregar mensagens antigas:", error);
        ui.showToast("error", error.message || "Erro ao carregar mensagens antigas.");
      });
    };

    const performanceApi = window.LGChat.performance;
    const handler = performanceApi && typeof performanceApi.throttle === "function"
      ? performanceApi.throttle(onScroll, 180)
      : onScroll;

    messagesBox.addEventListener("scroll", handler, { passive: true });
  }
