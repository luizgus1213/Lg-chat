function getSearchTypeLabel(type) {
    const labels = {
      all: "Todos",
      text: "Textos",
      image: "Fotos",
      video: "Vídeos",
      audio: "Áudios",
      file: "Documentos",
      media: "Mídias",
    };

    return labels[type] || "Todos";
  }

function resetChatSearchResults(message = "Digite para pesquisar mensagens.") {
    const status = ui.el("messageSearchStatus");
    const results = ui.el("messageSearchResults");

    if (status) status.textContent = message;
    if (results) results.replaceChildren();
  }

function openChatSearchPanel() {
    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de pesquisar.");
      return;
    }

    const panel = ui.el("chatSearchPanel");
    const input = ui.el("messageSearchInput");

    panel.classList.remove("hidden");

    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    scheduleChatSearch();
  }

function closeChatSearchPanel() {
    const panel = ui.el("chatSearchPanel");
    const input = ui.el("messageSearchInput");

    panel.classList.add("hidden");
    input.value = "";
    resetChatSearchResults();
  }

function clearChatSearch() {
    ui.el("messageSearchInput").value = "";
    ui.el("messageSearchType").value = "all";
    resetChatSearchResults();
    ui.el("messageSearchInput").focus();
  }

function scheduleChatSearch() {
    clearTimeout(state.chatSearchTimeout);

    state.chatSearchTimeout = setTimeout(() => {
      performChatSearch().catch((error) => {
        console.error("Erro ao pesquisar mensagens:", error);
        ui.showToast("error", error.message);
      });
    }, 260);
  }

async function performChatSearch() {
    if (!state.selectedChat) return;

    const input = ui.el("messageSearchInput");
    const typeInput = ui.el("messageSearchType");
    const status = ui.el("messageSearchStatus");
    const resultsBox = ui.el("messageSearchResults");

    const q = input.value.trim();
    const type = typeInput.value || "all";

    resultsBox.replaceChildren();

    if (!q && type === "all") {
      status.textContent = "Digite para pesquisar mensagens ou escolha um filtro de mídia.";
      return;
    }

    status.textContent = "Pesquisando...";

    const params = new URLSearchParams({
      type,
      limit: "40",
    });

    if (q) params.set("q", q);

    const response = await api.request(
      `/api/chats/${state.selectedChat.id}/messages/search?${params.toString()}`,
    );

    renderChatSearchResults(response.data);
  }
