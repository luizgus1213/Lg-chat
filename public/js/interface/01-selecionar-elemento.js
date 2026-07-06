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
