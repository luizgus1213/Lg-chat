function formatUserStatus(user) {
    if (!user) return "Conversa privada";

    if (user.isOnline) {
      return "online agora";
    }

    if (!user.lastSeenAt) {
      return user.about || "Disponível";
    }

    const date = new Date(user.lastSeenAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const time = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) {
      return `visto por último hoje às ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
      return `visto por último ontem às ${time}`;
    }

    return `visto por último em ${date.toLocaleDateString("pt-BR")} às ${time}`;
  }

function createChatAvatar(chat, className) {
    const avatar = document.createElement("div");
    avatar.className = className;

    const avatarUrl = getAvatarUrl(chat);

    if (avatarUrl) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = avatarUrl;
      img.alt = `Foto de ${getChatName(chat)}`;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getChatInitial(chat);
    }

    return avatar;
  }

function fillAvatarElement(element, chat) {
    element.replaceChildren();

    const avatarUrl = getAvatarUrl(chat);

    if (avatarUrl) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = avatarUrl;
      img.alt = `Foto de ${getChatName(chat)}`;
      element.appendChild(img);
      return;
    }

    element.textContent = getChatInitial(chat);
  }

function updateChatHeader(chat) {
    const profileButton = ui.el("chatHeaderProfileButton");
    const headerAvatar = ui.el("chatHeaderAvatar");

    profileButton.disabled = false;
    fillAvatarElement(headerAvatar, chat);

    ui.el("chatTitle").textContent = getChatName(chat);
    ui.el("chatSubtitle").textContent =
      chat.type === "group" ? "Grupo" : formatUserStatus(chat.privateUser);

    syncBlockNotice();

    if (window.LGChat.call && typeof window.LGChat.call.syncCallButtons === "function") {
      window.LGChat.call.syncCallButtons();
    }
  }

function makeClientId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }
