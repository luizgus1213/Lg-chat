(() => {
  function el(id) {
    return document.getElementById(id);
  }

  const toastHistory = new Map();

  function showToast(type, message) {
    const container = el("toastContainer");
    const text = message || "Erro inesperado.";
    const key = `${type}:${text}`;
    const now = Date.now();
    const lastShown = toastHistory.get(key) || 0;

    if (now - lastShown < 1600) {
      return;
    }

    toastHistory.set(key, now);

    if (!container) {
      console.error("Toast container não encontrado:", text);
      return;
    }

    const toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.textContent = text;

    if (type === "error") {
      console.error("Erro no site:", text);
    }

    container.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("hide");

      window.setTimeout(() => {
        toast.remove();
      }, 250);
    }, 4200);
  }

  function setButtonLoading(button, isLoading, loadingText = "Carregando...") {
    if (!button) return;

    if (isLoading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent || "";
      }

      button.disabled = true;
      button.dataset.loading = "true";
      button.textContent = loadingText;
      return;
    }

    button.disabled = false;
    button.dataset.loading = "false";

    if (button.dataset.originalText !== undefined) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }

  async function withButtonLoading(button, callback, loadingText = "Carregando...") {
    if (!button || button.dataset.loading === "true") return;

    try {
      setButtonLoading(button, true, loadingText);
      return await callback();
    } finally {
      setButtonLoading(button, false);
    }
  }

  function setLoading(target, message = "Carregando...") {
    if (!target) return;

    target.replaceChildren();

    const div = document.createElement("div");
    div.className = "loading";
    div.textContent = message;

    target.appendChild(div);
  }

  function setEmpty(target, message) {
    if (!target) return;

    target.replaceChildren();

    const div = document.createElement("div");
    div.className = "empty-small";
    div.textContent = message;

    target.appendChild(div);
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function scrollMessagesToBottom() {
    const messagesBox = el("messages");

    if (!messagesBox) return;

    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  function showAuthArea() {
    el("authArea").classList.remove("hidden");
    el("chatArea").classList.add("hidden");
    document.body.classList.remove("mobile-chat-open");
  }

  function showChatArea() {
    el("authArea").classList.add("hidden");
    el("chatArea").classList.remove("hidden");
  }

  function showMobileChat() {
    document.body.classList.add("mobile-chat-open");
  }

  function showMobileSidebar() {
    document.body.classList.remove("mobile-chat-open");
  }

  function openModal(id) {
    el(id).classList.remove("hidden");
  }

  function closeModal(id) {
    el(id).classList.add("hidden");
  }

  function toggleInfoPanel() {
    el("infoPanel").classList.toggle("open");
  }

  function closeInfoPanel() {
    el("infoPanel").classList.remove("open");
  }

  function resetChatScreen() {
    const messagesBox = el("messages");
    const chatInfoBox = el("chatInfoBox");
    const profileButton = el("chatHeaderProfileButton");
    const headerAvatar = el("chatHeaderAvatar");

    if (profileButton) profileButton.disabled = true;
    if (headerAvatar) {
      headerAvatar.replaceChildren();
      headerAvatar.textContent = "?";
    }

    if (el("chatTitle")) el("chatTitle").textContent = "Escolha uma conversa";
    if (el("chatSubtitle")) el("chatSubtitle").textContent = "Nenhum chat selecionado";
    if (el("typingText")) el("typingText").textContent = "";

    if (el("startVoiceCallButton")) el("startVoiceCallButton").disabled = true;
    if (el("startVideoCallButton")) el("startVideoCallButton").disabled = true;

    if (messagesBox) {
      messagesBox.className = "messages empty-state";
      messagesBox.replaceChildren();

      const wrapper = document.createElement("div");
      const title = document.createElement("h3");
      const text = document.createElement("p");

      title.textContent = "Bem-vindo ao LG Chat";
      text.textContent = "Crie um grupo ou escolha uma conversa para começar.";

      wrapper.appendChild(title);
      wrapper.appendChild(text);
      messagesBox.appendChild(wrapper);
    }

    if (chatInfoBox) {
      chatInfoBox.replaceChildren();

      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Selecione um chat para ver os detalhes.";

      chatInfoBox.appendChild(p);
    }

    closeInfoPanel();
    showMobileSidebar();
  }

  window.LGChat.ui = {
    el,
    showToast,
    setButtonLoading,
    withButtonLoading,
    setLoading,
    setEmpty,
    formatDate,
    scrollMessagesToBottom,
    showAuthArea,
    showChatArea,
    showMobileChat,
    showMobileSidebar,
    openModal,
    closeModal,
    toggleInfoPanel,
    closeInfoPanel,
    resetChatScreen,
  };
})();
