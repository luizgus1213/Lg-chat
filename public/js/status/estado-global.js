window.LGChat = window.LGChat || {};

const state = window.LGChat.state;

const ui = window.LGChat.ui;

const VIEW_DURATION_MS = 6500;

let lastStatusLoadAt = 0;

let statusLoadPromise = null;

function safeEl(id) {
    return document.getElementById(id);
  }

async function request(path, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        "Erro ao executar ação de status.";

      throw new Error(message);
    }

    return payload?.data;
  }

function getInitial(user) {
    return (user?.nome || "?").charAt(0).toUpperCase();
  }

function fillAvatar(element, user, seen = false) {
    if (!element) return;

    element.replaceChildren();
    element.classList.toggle("seen", Boolean(seen));

    if (user?.avatarUrl) {
      const img = document.createElement("img");
      img.src = user.avatarUrl;
      img.alt = `Foto de ${user.nome || "usuário"}`;
      element.appendChild(img);
      return;
    }

    element.textContent = getInitial(user);
  }

function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) return "Agora";
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) return `${diffHours} h atrás`;

    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

function validateStatusMediaFile(file) {
    if (!file) return false;

    const mb = 1024 * 1024;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      ui.showToast("error", "Publique apenas foto ou vídeo no status.");
      return false;
    }

    const maxBytes = isImage ? 8 * mb : 30 * mb;
    const maxLabel = isImage ? "8MB" : "30MB";

    if (file.size > maxBytes) {
      ui.showToast("error", `Status de ${isImage ? "imagem" : "vídeo"} deve ter no máximo ${maxLabel}.`);
      return false;
    }

    return true;
  }
