(() => {
  const state = window.LGChat.state;
  const api = window.LGChat.api;
  const ui = window.LGChat.ui;

  state.showArchivedChats = Boolean(state.showArchivedChats);

  function scheduleChatsRefresh(reason = "chat", delay = 700) {
    const performanceApi = window.LGChat.performance;

    if (performanceApi && typeof performanceApi.scheduleLoadChats === "function") {
      return performanceApi.scheduleLoadChats(reason, delay);
    }

    return loadChats({ silent: true });
  }

  function applyMessageToChatList(message, options = {}) {
    if (!message || !message.chatId || !Array.isArray(state.allChats)) {
      return false;
    }

    let found = false;
    const chatId = Number(message.chatId);
    const selectedChatId = state.selectedChat ? Number(state.selectedChat.id) : null;
    const isCurrentChat = selectedChatId === chatId;
    const isMine = state.currentUser && Number(message.fromUserId) === Number(state.currentUser.id);

    state.allChats = state.allChats.map((chat) => {
      if (Number(chat.id) !== chatId) return chat;

      found = true;

      const shouldIncrementUnread =
        options.incrementUnread === true && !isCurrentChat && !isMine;

      return {
        ...chat,
        lastMessage: {
          ...(chat.lastMessage || {}),
          ...message,
        },
        updatedAt: message.createdAt || new Date().toISOString(),
        unreadCount: shouldIncrementUnread
          ? Number(chat.unreadCount || 0) + 1
          : Number(chat.unreadCount || 0),
      };
    });

    if (found) {
      renderChats();
    }

    return found;
  }

  function markChatListAsRead(chatId) {
    if (!chatId || !Array.isArray(state.allChats)) return;

    let changed = false;

    state.allChats = state.allChats.map((chat) => {
      if (Number(chat.id) !== Number(chatId)) return chat;
      if (Number(chat.unreadCount || 0) === 0) return chat;

      changed = true;
      return {
        ...chat,
        unreadCount: 0,
      };
    });

    if (changed) {
      renderChats();
    }
  }


  function getChatName(chat) {
    if (!chat) return "Chat";
    if (chat.type === "private" && chat.privateUser) {
      return chat.privateUser.nome || `Contato #${chat.privateUser.id}`;
    }
    if (chat.name) return chat.name;
    if (chat.type === "private") return `Conversa privada #${chat.id}`;
    return `Chat #${chat.id}`;
  }

  function getChatInitial(chat) {
    return getChatName(chat).charAt(0).toUpperCase();
  }

  function getAvatarUrl(chat) {
    if (!chat) return null;

    if (chat.type === "private" && chat.privateUser) {
      return chat.privateUser.avatarUrl || null;
    }

    return chat.avatarUrl || null;
  }

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

  function getAllowedMediaTypes() {
    return [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",

      "video/mp4",
      "video/webm",
      "video/quicktime",

      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",

      "application/pdf",
      "text/plain",
      "text/csv",

      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",

      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/vnd.rar",
      "application/x-7z-compressed",
    ];
  }

  function getFileKindFromMime(mimeType) {
    if (!mimeType) return "file";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";

    return "file";
  }

  function getFileKindLabel(kind) {
    if (kind === "image") return "foto";
    if (kind === "video") return "vídeo";
    if (kind === "audio") return "áudio";

    return "documento";
  }

  function getFileIconFromMime(mimeType, fileName = "") {
    const lowerName = String(fileName).toLowerCase();

    if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) return "📕";
    if (mimeType === "text/plain" || lowerName.endsWith(".txt")) return "📄";
    if (mimeType === "text/csv" || lowerName.endsWith(".csv")) return "📊";
    if (mimeType && mimeType.includes("word")) return "📝";
    if (mimeType && mimeType.includes("excel")) return "📊";
    if (mimeType && mimeType.includes("spreadsheet")) return "📊";
    if (mimeType && mimeType.includes("powerpoint")) return "📑";
    if (mimeType && mimeType.includes("presentation")) return "📑";
    if (mimeType && (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z"))) return "🗜️";

    return "📎";
  }

  function validateMediaFile(file) {
    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de enviar arquivo.");
      return false;
    }

    if (isBlockedChat()) {
      ui.showToast("error", getBlockNoticeText());
      return false;
    }

    if (!file) {
      return false;
    }

    if (!getAllowedMediaTypes().includes(file.type)) {
      ui.showToast(
        "error",
        "Envie foto, vídeo, áudio ou documento em formato permitido.",
      );
      return false;
    }

    const maxSize = 50 * 1024 * 1024;

    if (file.size > maxSize) {
      ui.showToast("error", "O arquivo deve ter no máximo 50MB.");
      return false;
    }

    return true;
  }

  function closeAttachmentMenu() {
    const menu = safeEl("attachmentMenu");

    if (menu) {
      menu.classList.add("hidden");
    }
  }

  function toggleAttachmentMenu() {
    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de anexar arquivo.");
      return;
    }

    if (isBlockedChat()) {
      ui.showToast("error", getBlockNoticeText());
      return;
    }

    const menu = safeEl("attachmentMenu");

    if (!menu) return;

    menu.classList.toggle("hidden");
  }

  function formatChatTime(value) {
    if (!value) return "";

    const date = new Date(value);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  function getLastMessagePreview(chat) {
    const lastMessage = chat.lastMessage;

    if (!lastMessage) {
      return chat.type === "group"
        ? "Grupo"
        : chat.privateUser?.about || "Conversa privada";
    }

    if (lastMessage.deletedAt) {
      return "Mensagem apagada";
    }

    if (lastMessage.type === "system") {
      return lastMessage.text || "Atualização do grupo";
    }

    const prefix =
      state.currentUser && lastMessage.fromUserId === state.currentUser.id
        ? "Você: "
        : "";
    const forwarded = lastMessage.isForwarded ? "↪ " : "";

    if (lastMessage.type === "image") {
      return `${prefix}${forwarded}📷 Foto${lastMessage.text ? `: ${lastMessage.text}` : ""}`;
    }

    if (lastMessage.type === "video") {
      return `${prefix}${forwarded}🎥 Vídeo${lastMessage.text ? `: ${lastMessage.text}` : ""}`;
    }

    if (lastMessage.type === "audio") {
      return `${prefix}${forwarded}🎙️ Áudio${lastMessage.text ? `: ${lastMessage.text}` : ""}`;
    }

    if (lastMessage.type === "file") {
      return `${prefix}${forwarded}📎 ${lastMessage.mediaOriginalName || "Documento"}${lastMessage.text ? `: ${lastMessage.text}` : ""}`;
    }

    return `${prefix}${forwarded}${lastMessage.text || ""}`;
  }


  function isMutedChat(chat) {
    if (!chat || !chat.isMuted) return false;
    if (!chat.mutedUntil) return true;

    return new Date(chat.mutedUntil).getTime() > Date.now();
  }

  function getChatFlagIcons(chat) {
    const flags = [];

    if (chat.isPinned) flags.push("📌");
    if (isMutedChat(chat)) flags.push("🔕");
    if (chat.isArchived) flags.push("📦");

    return flags.join(" ");
  }


  function safeEl(id) {
    try {
      return ui.el(id);
    } catch (_error) {
      return null;
    }
  }

  function getChatBlock(chat = state.selectedChat) {
    return chat && chat.block
      ? chat.block
      : {
          blockedByMe: false,
          blockedMe: false,
          isBlocked: false,
        };
  }

  function isBlockedChat(chat = state.selectedChat) {
    const block = getChatBlock(chat);

    return Boolean(block.isBlocked || block.blockedByMe || block.blockedMe);
  }

  function getBlockNoticeText(chat = state.selectedChat) {
    const block = getChatBlock(chat);

    if (block.blockedByMe && block.blockedMe) {
      return "Você e esse contato estão bloqueados. Desbloqueie para voltar a conversar.";
    }

    if (block.blockedByMe) {
      return "Você bloqueou esse contato. Desbloqueie para enviar mensagens.";
    }

    if (block.blockedMe) {
      return "Você não pode enviar mensagens para esse contato.";
    }

    return "";
  }

  function syncBlockNotice() {
    const notice = safeEl("chatBlockNotice");
    const input = safeEl("messageInput");
    const sendButton = safeEl("sendMessageButton");
    const mediaButton = safeEl("mediaButton");
    const voiceButton = safeEl("voiceButton");

    const blocked = isBlockedChat(state.selectedChat);
    const text = getBlockNoticeText(state.selectedChat);

    if (notice) {
      notice.classList.toggle("hidden", !blocked);
      notice.textContent = text;
    }

    if (!state.selectedChat) return;

    if (input) {
      input.disabled = blocked;
      input.placeholder = blocked ? "Contato bloqueado" : "Digite sua mensagem...";
    }

    if (sendButton) sendButton.disabled = blocked;
    if (mediaButton) mediaButton.disabled = blocked;
    if (voiceButton) voiceButton.disabled = blocked;
  }


  function closeChatOptionsMenu() {
    const oldMenu = document.querySelector(".chat-options-menu");
    if (oldMenu) oldMenu.remove();
  }

  function updateArchivedToggleButton() {
    const button = ui.el("toggleArchivedChatsButton");

    if (!button) return;

    const showingArchived = Boolean(state.showArchivedChats);
    button.classList.toggle("active", showingArchived);
    button.textContent = showingArchived ? "← Voltar aos chats" : "Arquivadas";
    button.title = showingArchived
      ? "Voltar para conversas principais"
      : "Ver conversas arquivadas";
  }

  async function toggleArchivedChats() {
    state.showArchivedChats = !state.showArchivedChats;
    updateArchivedToggleButton();

    if (state.showArchivedChats) {
      ui.showToast("success", "Mostrando conversas arquivadas.");
    }

    await loadChats({ silent: true });
  }

  async function updateChatPreferences(chatId, preferences) {
    const response = await api.request(`/api/chats/${chatId}/preferences`, {
      method: "PATCH",
      body: JSON.stringify(preferences),
    });

    const updated = response.data;

    state.allChats = (state.allChats || []).map((chat) => {
      if (Number(chat.id) !== Number(chatId)) return chat;

      return {
        ...chat,
        ...updated,
      };
    });

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      state.selectedChat = {
        ...state.selectedChat,
        ...updated,
      };
    }

    return updated;
  }

  function getMuteUntil(hours) {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return date.toISOString();
  }

  function openChatOptionsMenu(chat, anchorElement) {
    closeChatOptionsMenu();

    if (!chat || !chat.id) return;

    const menu = document.createElement("div");
    menu.className = "chat-options-menu";

    const addOption = (label, handler, className = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (className) button.className = className;

      button.addEventListener("click", async () => {
        closeChatOptionsMenu();

        try {
          await handler();
        } catch (error) {
          console.error("Erro ao atualizar preferências do chat:", error);
          ui.showToast("error", error.message);
        }
      });

      menu.appendChild(button);
      return button;
    };

    addOption(chat.isPinned ? "Desfixar conversa" : "Fixar conversa", async () => {
      await updateChatPreferences(chat.id, { isPinned: !chat.isPinned });
      ui.showToast("success", chat.isPinned ? "Conversa desfixada." : "Conversa fixada.");
      await loadChats({ silent: true });
    });

    addOption(
      chat.isArchived ? "Desarquivar conversa" : "Arquivar conversa",
      async () => {
        await updateChatPreferences(chat.id, { isArchived: !chat.isArchived });

        ui.showToast(
          "success",
          chat.isArchived ? "Conversa desarquivada." : "Conversa arquivada.",
        );

        await loadChats({ silent: true });
      },
      chat.isArchived ? "" : "warning",
    );

    const divider = document.createElement("div");
    divider.className = "chat-options-divider";
    menu.appendChild(divider);

    if (isMutedChat(chat)) {
      addOption("Reativar notificações", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: false,
          mutedUntil: null,
        });

        ui.showToast("success", "Notificações reativadas.");
        await loadChats({ silent: true });
      });
    } else {
      addOption("Silenciar por 8 horas", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: true,
          mutedUntil: getMuteUntil(8),
        });

        ui.showToast("success", "Conversa silenciada por 8 horas.");
        await loadChats({ silent: true });
      });

      addOption("Silenciar por 1 semana", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: true,
          mutedUntil: getMuteUntil(24 * 7),
        });

        ui.showToast("success", "Conversa silenciada por 1 semana.");
        await loadChats({ silent: true });
      });

      addOption("Silenciar sempre", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: true,
          mutedUntil: null,
        });

        ui.showToast("success", "Conversa silenciada.");
        await loadChats({ silent: true });
      });
    }


    const privacyDivider = document.createElement("div");
    privacyDivider.className = "chat-options-divider";
    menu.appendChild(privacyDivider);

    if (chat.type === "private") {
      addOption(
        chat.block?.blockedByMe ? "Desbloquear contato" : "Bloquear contato",
        async () => {
          await updateBlockContact(chat.id, !chat.block?.blockedByMe);
          ui.showToast(
            "success",
            chat.block?.blockedByMe ? "Contato desbloqueado." : "Contato bloqueado.",
          );
        },
        chat.block?.blockedByMe ? "" : "danger",
      );
    }

    addOption("Limpar conversa", async () => {
      await clearCurrentChat(chat.id, getChatName(chat));
    }, "warning");

    addOption("Apagar conversa para mim", async () => {
      await deleteCurrentChatForMe(chat.id, getChatName(chat));
    }, "danger");

    document.body.appendChild(menu);

    const rect = anchorElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    const top = Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 12);
    const left = Math.min(
      Math.max(12, rect.right - menuRect.width),
      window.innerWidth - menuRect.width - 12,
    );

    menu.style.top = `${Math.max(12, top)}px`;
    menu.style.left = `${Math.max(12, left)}px`;

    setTimeout(() => {
      document.addEventListener(
        "click",
        (event) => {
          if (!menu.contains(event.target)) {
            closeChatOptionsMenu();
          }
        },
        { once: true },
      );
    }, 0);
  }

  function getMessageStatusText(message) {
    if (!state.currentUser || message.fromUserId !== state.currentUser.id) {
      return "";
    }

    if (message.clientStatus === "sending") {
      return "•";
    }

    if (message.clientStatus === "error") {
      return "!";
    }

    if (message.clientStatus === "read") {
      return "✓✓";
    }

    return "✓";
  }

  function getMessageStatusTitle(message) {
    if (message.clientStatus === "sending") return "Enviando";
    if (message.clientStatus === "error") return "Erro ao enviar";
    if (message.clientStatus === "read") return "Lida";
    return "Enviada";
  }

  function findMessageElementByClientId(clientId) {
    if (!clientId) return null;

    const messagesBox = ui.el("messages");

    return Array.from(messagesBox.children).find((child) => {
      return child.dataset && child.dataset.clientId === String(clientId);
    });
  }

  function markLocalMessageAsError(clientId) {
    const messageElement = findMessageElementByClientId(clientId);

    if (!messageElement) return;

    messageElement.classList.add("message-error");

    const status = messageElement.querySelector(".message-status");

    if (status) {
      status.textContent = "!";
      status.title = "Erro ao enviar";
    }
  }

  async function markChatAsRead(chatId, messageId) {
    if (!chatId || !messageId) return;

    try {
      await api.request(`/api/chats/${chatId}/read`, {
        method: "POST",
        body: JSON.stringify({ messageId }),
      });

      if (state.selectedChat && state.selectedChat.id === chatId) {
        state.selectedChat.lastReadMessageId = messageId;
      }

      markChatListAsRead(chatId);
    } catch (error) {
      console.error("Erro ao marcar chat como lido:", error);
    }
  }

  function isRealMessageId(messageId) {
    return (
      messageId &&
      !String(messageId).startsWith("temp-") &&
      Number.isFinite(Number(messageId))
    );
  }

  function isOwnEditableMessage(message) {
    return Boolean(
      state.currentUser &&
        message &&
        message.fromUserId === state.currentUser.id &&
        isRealMessageId(message.id) &&
        message.type !== "system" &&
        !message.deletedAt &&
        message.clientStatus !== "sending" &&
        message.clientStatus !== "error",
    );
  }


  function isActionableMessage(message) {
    return Boolean(
      message &&
        isRealMessageId(message.id) &&
        message.type !== "system" &&
        !message.deletedAt &&
        message.clientStatus !== "sending" &&
        message.clientStatus !== "error",
    );
  }

  function getReplyPreviewText(message) {
    if (!message) return "Mensagem";
    if (message.deletedAt) return "Mensagem apagada";
    if (message.type === "image") return message.text ? `Foto: ${message.text}` : "Foto";
    if (message.type === "video") return message.text ? `Vídeo: ${message.text}` : "Vídeo";
    if (message.type === "audio") return message.text ? `Áudio: ${message.text}` : "Áudio";
    if (message.type === "file") return message.text ? `Documento: ${message.text}` : message.mediaOriginalName || "Documento";
    return message.text || "Mensagem";
  }

  function getReplyAuthorLabel(message) {
    if (!message) return "Mensagem";

    if (state.currentUser && message.fromUserId === state.currentUser.id) {
      return "Você";
    }

    return "Mensagem";
  }

  function buildReplySnapshot(message) {
    if (!message) return null;

    return {
      id: message.id,
      chatId: message.chatId,
      fromUserId: message.fromUserId,
      text: message.text,
      type: message.type,
      mediaOriginalName: message.mediaOriginalName || null,
      deletedAt: message.deletedAt || null,
    };
  }

  function closeMessageActionMenu() {
    const oldMenu = document.querySelector(".message-actions-menu");
    if (oldMenu) oldMenu.remove();
  }

  function openMessageActionMenu(message, anchorElement) {
    if (!isActionableMessage(message)) return;

    closeMessageActionMenu();

    const menu = document.createElement("div");
    menu.className = "message-actions-menu";

    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "Responder";
    replyButton.addEventListener("click", () => {
      closeMessageActionMenu();
      startReplyMessage(message);
    });

    menu.appendChild(replyButton);

    const forwardButton = document.createElement("button");
    forwardButton.type = "button";
    forwardButton.textContent = "Encaminhar";
    forwardButton.addEventListener("click", () => {
      closeMessageActionMenu();
      openForwardMessageModal(message);
    });

    menu.appendChild(forwardButton);

    const starButton = document.createElement("button");
    starButton.type = "button";
    starButton.textContent = message.isStarred ? "Remover dos favoritos" : "Favoritar";
    starButton.addEventListener("click", () => {
      closeMessageActionMenu();
      toggleMessageStar(message).catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    menu.appendChild(starButton);

    const reactions = document.createElement("div");
    reactions.className = "message-reaction-picker";

    ["👍", "❤️", "😂", "😮", "😢", "🙏"].forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reaction-pick-button";
      button.textContent = emoji;
      button.title = `Reagir com ${emoji}`;
      button.addEventListener("click", () => {
        closeMessageActionMenu();
        toggleMessageReaction(message, emoji).catch((error) => {
          ui.showToast("error", error.message);
        });
      });
      reactions.appendChild(button);
    });

    menu.appendChild(reactions);

    if (isOwnEditableMessage(message)) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent =
        message.type === "text" ? "Editar mensagem" : "Editar legenda";
      editButton.addEventListener("click", () => {
        closeMessageActionMenu();
        startEditMessage(message);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger";
      deleteButton.textContent = "Apagar para todos";
      deleteButton.addEventListener("click", () => {
        closeMessageActionMenu();
        deleteMessageForEveryone(message).catch((error) => {
          ui.showToast("error", error.message);
        });
      });

      menu.appendChild(editButton);
      menu.appendChild(deleteButton);
    }

    document.body.appendChild(menu);

    const rect = anchorElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    const top = Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 12);
    const left = Math.min(
      Math.max(12, rect.right - menuRect.width),
      window.innerWidth - menuRect.width - 12,
    );

    menu.style.top = `${Math.max(12, top)}px`;
    menu.style.left = `${Math.max(12, left)}px`;

    setTimeout(() => {
      document.addEventListener(
        "click",
        (event) => {
          if (!menu.contains(event.target)) {
            closeMessageActionMenu();
          }
        },
        { once: true },
      );
    }, 0);
  }

  function syncEditingBar() {
    const bar = ui.el("editingBar");
    const preview = ui.el("editingPreview");
    const input = ui.el("messageInput");

    if (!bar || !preview || !input) return;

    if (!state.editingMessage) {
      bar.classList.add("hidden");
      preview.textContent = "";
      input.placeholder = "Digite sua mensagem...";
      return;
    }

    bar.classList.remove("hidden");
    preview.textContent = state.editingMessage.text || "Legenda vazia";
    input.placeholder = "Edite sua mensagem...";
  }

  function syncReplyBar() {
    const bar = ui.el("replyBar");
    const author = ui.el("replyAuthor");
    const preview = ui.el("replyPreview");
    const input = ui.el("messageInput");

    if (!bar || !author || !preview || !input) return;

    if (!state.replyToMessage) {
      bar.classList.add("hidden");
      author.textContent = "";
      preview.textContent = "";

      if (!state.editingMessage) {
        input.placeholder = "Digite sua mensagem...";
      }

      return;
    }

    bar.classList.remove("hidden");
    author.textContent = `Respondendo ${getReplyAuthorLabel(state.replyToMessage)}`;
    preview.textContent = getReplyPreviewText(state.replyToMessage);

    if (!state.editingMessage) {
      input.placeholder = "Digite sua resposta...";
    }
  }

  function startReplyMessage(message) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível responder essa mensagem.");
      return;
    }

    if (state.editingMessage) {
      cancelEditMessage();
      ui.el("messageInput").value = "";
    }

    state.replyToMessage = buildReplySnapshot(message);
    syncReplyBar();

    setTimeout(() => {
      ui.el("messageInput").focus();
    }, 50);
  }

  function cancelReplyMessage() {
    state.replyToMessage = null;
    syncReplyBar();
  }

  function scrollToMessage(messageId) {
    const element = findMessageElementById(messageId);

    if (!element) {
      ui.showToast("error", "Mensagem original não está carregada nessa conversa.");
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("message-highlight");

    setTimeout(() => {
      element.classList.remove("message-highlight");
    }, 1400);
  }



  function getMessageTypeIcon(type) {
    if (type === "image") return "📷";
    if (type === "video") return "🎥";
    if (type === "audio") return "🎙️";
    if (type === "file") return "📎";
    return "💬";
  }

  function getSearchResultPreview(message) {
    if (!message) return "Mensagem";
    if (message.deletedAt) return "Mensagem apagada";
    if (message.type === "image") return message.text ? `Foto: ${message.text}` : "Foto";
    if (message.type === "video") return message.text ? `Vídeo: ${message.text}` : "Vídeo";
    if (message.type === "audio") return message.text ? `Áudio: ${message.text}` : "Áudio";
    if (message.type === "file") return message.text ? `Documento: ${message.text}` : message.mediaOriginalName || "Documento";
    return message.text || message.mediaOriginalName || "Mensagem";
  }

  function getSearchAuthorLabel(message) {
    if (state.currentUser && message.fromUserId === state.currentUser.id) {
      return "Você";
    }

    if (
      state.selectedChat &&
      state.selectedChat.privateUser &&
      Number(state.selectedChat.privateUser.id) === Number(message.fromUserId)
    ) {
      return state.selectedChat.privateUser.nome || "Contato";
    }

    return `Usuário #${message.fromUserId}`;
  }

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

  function openForwardMessageModal(message) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível encaminhar essa mensagem.");
      return;
    }

    state.forwardingMessage = {
      id: Number(message.id),
      chatId: Number(message.chatId),
      text: getSearchResultPreview(message),
      type: message.type,
    };

    const modal = safeEl("forwardMessageModal");
    const preview = safeEl("forwardMessagePreview");

    if (!modal || !preview) return;

    preview.textContent = getSearchResultPreview(message);
    renderForwardChatChoices();
    modal.classList.remove("hidden");
  }

  function closeForwardMessageModal() {
    state.forwardingMessage = null;

    const modal = safeEl("forwardMessageModal");
    const list = safeEl("forwardChatsList");
    const preview = safeEl("forwardMessagePreview");

    if (modal) modal.classList.add("hidden");
    if (list) list.replaceChildren();
    if (preview) preview.textContent = "";
  }

  async function submitForwardMessage() {
    if (!state.forwardingMessage) {
      ui.showToast("error", "Nenhuma mensagem selecionada para encaminhar.");
      return;
    }

    const list = safeEl("forwardChatsList");
    const selected = list
      ? Array.from(list.querySelectorAll("input[type='checkbox']:checked"))
          .map((input) => Number(input.value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    if (!selected.length) {
      ui.showToast("error", "Escolha pelo menos uma conversa.");
      return;
    }

    const button = safeEl("sendForwardMessageButton");
    if (button) {
      button.disabled = true;
      button.textContent = "Encaminhando...";
    }

    try {
      await api.request(
        `/api/chats/${state.forwardingMessage.chatId}/messages/${state.forwardingMessage.id}/forward`,
        {
          method: "POST",
          body: JSON.stringify({
            targetChatIds: selected,
          }),
        },
      );

      ui.showToast("success", "Mensagem encaminhada.");
      closeForwardMessageModal();
      await loadChats({ silent: true });

      if (
        state.selectedChat &&
        selected.some((chatId) => Number(chatId) === Number(state.selectedChat.id))
      ) {
        await loadChatMessages(state.selectedChat.id);
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Encaminhar";
      }
    }
  }

  async function toggleMessageStar(message) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível favoritar essa mensagem.");
      return;
    }

    const response = await api.request(
      `/api/chats/${message.chatId}/messages/${message.id}/star`,
      {
        method: "POST",
        body: JSON.stringify({
          starred: !message.isStarred,
        }),
      },
    );

    updateMessage(response.data, { preserveReactionMineState: true });

    ui.showToast(
      "success",
      response.data.isStarred ? "Mensagem favoritada." : "Mensagem removida das favoritas.",
    );

    const panel = safeEl("starredMessagesPanel");

    if (panel && !panel.classList.contains("hidden")) {
      openStarredMessagesPanel().catch((error) => {
        console.error("Erro ao atualizar favoritas:", error);
      });
    }

    return response.data;
  }

  function createReplyPreviewElement(replyTo) {
    if (!replyTo) return null;

    const box = document.createElement("button");
    box.type = "button";
    box.className = "message-reply-preview";
    box.title = "Ir para mensagem respondida";

    const author = document.createElement("strong");
    author.textContent = getReplyAuthorLabel(replyTo);

    const preview = document.createElement("span");
    preview.textContent = getReplyPreviewText(replyTo);

    box.appendChild(author);
    box.appendChild(preview);

    if (replyTo.id) {
      box.addEventListener("click", (event) => {
        event.stopPropagation();
        scrollToMessage(replyTo.id);
      });
    }

    return box;
  }

  function createReactionsElement(message) {
    const reactions = Array.isArray(message.reactions)
      ? message.reactions.filter((reaction) => Number(reaction.count) > 0)
      : [];

    if (!reactions.length || !isRealMessageId(message.id)) return null;

    const box = document.createElement("div");
    box.className = "message-reactions";

    reactions.forEach((reaction) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "message-reaction";

      if (reaction.reactedByMe) {
        button.classList.add("mine");
      }

      button.textContent = `${reaction.emoji} ${reaction.count}`;
      button.title = reaction.reactedByMe
        ? "Clique para remover sua reação"
        : `Reagir com ${reaction.emoji}`;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMessageReaction(message, reaction.emoji).catch((error) => {
          ui.showToast("error", error.message);
        });
      });

      box.appendChild(button);
    });

    return box;
  }

  async function toggleMessageReaction(message, emoji) {
    if (!isActionableMessage(message)) {
      ui.showToast("error", "Não é possível reagir a essa mensagem.");
      return;
    }

    const response = await api.request(
      `/api/chats/${message.chatId}/messages/${message.id}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      },
    );

    updateMessage(response.data);
  }

  function startEditMessage(message) {
    if (!isOwnEditableMessage(message)) {
      ui.showToast("error", "Você só pode editar mensagens enviadas por você.");
      return;
    }

    if (state.replyToMessage) {
      cancelReplyMessage();
    }

    state.editingMessage = {
      id: Number(message.id),
      chatId: Number(message.chatId),
      text: message.text || "",
      type: message.type,
    };

    const input = ui.el("messageInput");
    input.value = message.text || "";
    syncEditingBar();

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 50);
  }

  function cancelEditMessage() {
    state.editingMessage = null;
    syncEditingBar();
  }

  async function submitEditedMessage() {
    if (!state.selectedChat || !state.editingMessage) return;

    const input = ui.el("messageInput");
    const text = input.value.trim();

    if (!text) {
      ui.showToast("error", "A mensagem editada não pode ficar vazia.");
      return;
    }

    const editing = state.editingMessage;

    const response = await api.request(
      `/api/chats/${editing.chatId}/messages/${editing.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ text }),
      },
    );

    updateMessage(response.data);
    ui.showToast("success", "Mensagem editada.");

    input.value = "";
    cancelEditMessage();
    await loadChats({ silent: true });
  }

  async function deleteMessageForEveryone(message) {
    if (!isOwnEditableMessage(message)) {
      ui.showToast("error", "Você só pode apagar mensagens enviadas por você.");
      return;
    }

    const confirmed = window.confirm(
      "Apagar esta mensagem para todos? Essa ação não pode ser desfeita.",
    );

    if (!confirmed) return;

    const response = await api.request(
      `/api/chats/${message.chatId}/messages/${message.id}`,
      {
        method: "DELETE",
      },
    );

    updateMessage(response.data);

    if (
      state.editingMessage &&
      Number(state.editingMessage.id) === Number(message.id)
    ) {
      ui.el("messageInput").value = "";
      cancelEditMessage();
    }

    ui.showToast("success", "Mensagem apagada.");
    await loadChats({ silent: true });
  }

  function findMessageElementById(messageId) {
    if (!isRealMessageId(messageId)) return null;

    const messagesBox = ui.el("messages");

    return messagesBox.querySelector(`[data-message-id="${messageId}"]`);
  }

  function getMyReactionEmojisFromElement(element) {
    if (!element) return new Set();

    const emojis = new Set();

    element.querySelectorAll(".message-reaction.mine").forEach((reaction) => {
      const emoji = (reaction.textContent || "").trim().split(/\s+/)[0];
      if (emoji) emojis.add(emoji);
    });

    return emojis;
  }

  function updateMessage(message, options = {}) {
    if (!message || !message.id) return;

    if (
      state.selectedChat &&
      message.chatId &&
      Number(message.chatId) !== Number(state.selectedChat.id)
    ) {
      return;
    }

    const existing = findMessageElementById(message.id);
    const myReactionEmojis = options.preserveReactionMineState
      ? getMyReactionEmojisFromElement(existing)
      : new Set();
    const reactions = Array.isArray(message.reactions)
      ? message.reactions.map((reaction) => ({
          ...reaction,
          reactedByMe:
            Boolean(reaction.reactedByMe) || myReactionEmojis.has(reaction.emoji),
        }))
      : message.reactions;

    const replacement = buildMessageElement({
      ...message,
      reactions,
      clientStatus:
        state.currentUser && message.fromUserId === state.currentUser.id
          ? "sent"
          : message.clientStatus,
    });

    if (existing) {
      existing.replaceWith(replacement);
      return;
    }

    addMessage(message);
  }

  function openMediaViewer(message) {
    if (!message.mediaUrl) return;

    const modal = ui.el("mediaViewerModal");
    const body = ui.el("mediaViewerBody");
    const caption = ui.el("mediaViewerCaption");
    const title = ui.el("mediaViewerTitle");

    if (!modal || !body || !caption || !title) {
      window.open(message.mediaUrl, "_blank", "noopener,noreferrer");
      return;
    }

    body.replaceChildren();

    const isImage = message.type === "image";
    const isAudio = message.type === "audio";
    const isFile = message.type === "file";

    if (isFile) {
      const fileCard = document.createElement("a");
      fileCard.className = "media-viewer-file-card";
      fileCard.href = message.mediaUrl;
      fileCard.target = "_blank";
      fileCard.rel = "noopener noreferrer";
      fileCard.download = message.mediaOriginalName || "";

      const icon = document.createElement("span");
      icon.className = "media-viewer-file-icon";
      icon.textContent = getFileIconFromMime(
        message.mediaMimeType,
        message.mediaOriginalName,
      );

      const info = document.createElement("div");
      info.className = "media-viewer-file-info";

      const name = document.createElement("strong");
      name.textContent = message.mediaOriginalName || "Documento";

      const meta = document.createElement("span");
      meta.textContent = `${message.mediaMimeType || "arquivo"} • ${formatFileSize(Number(message.mediaSize || 0))}`;

      const hint = document.createElement("small");
      hint.textContent = "Clique para abrir ou baixar";

      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(hint);

      fileCard.appendChild(icon);
      fileCard.appendChild(info);

      body.appendChild(fileCard);
    } else {
      const media = isImage
        ? document.createElement("img")
        : isAudio
          ? document.createElement("audio")
          : document.createElement("video");

      media.className = isImage
        ? "media-viewer-image"
        : isAudio
          ? "media-viewer-audio"
          : "media-viewer-video";
      media.src = message.mediaUrl;

      if (!isImage) {
        media.controls = true;
        media.autoplay = true;
      }

      body.appendChild(media);
    }

    title.textContent = isImage
      ? "Foto"
      : isAudio
        ? "Áudio"
        : isFile
          ? "Documento"
          : "Vídeo";
    caption.textContent = message.text || message.mediaOriginalName || "";

    modal.classList.remove("hidden");
  }

  function closeMediaViewer() {
    const modal = ui.el("mediaViewerModal");
    const body = ui.el("mediaViewerBody");
    const caption = ui.el("mediaViewerCaption");

    if (!modal || !body || !caption) return;

    modal.classList.add("hidden");
    body.replaceChildren();
    caption.textContent = "";
  }

  function revokeMediaPreviewUrl() {
    if (state.pendingMediaPreviewUrl) {
      URL.revokeObjectURL(state.pendingMediaPreviewUrl);
      state.pendingMediaPreviewUrl = null;
    }
  }

  function openMediaPreview(file) {
    if (!validateMediaFile(file)) return;

    revokeMediaPreviewUrl();

    state.pendingMediaFile = file;
    state.pendingMediaPreviewUrl = URL.createObjectURL(file);

    const modal = ui.el("mediaPreviewModal");
    const body = ui.el("mediaPreviewBody");
    const caption = ui.el("mediaPreviewCaption");
    const meta = ui.el("mediaPreviewMeta");
    const title = ui.el("mediaPreviewTitle");

    body.replaceChildren();

    const kind = getFileKindFromMime(file.type);
    const isImage = kind === "image";
    const isAudio = kind === "audio";
    const isVideo = kind === "video";
    const isFile = kind === "file";

    if (isFile) {
      const fileBox = document.createElement("div");
      fileBox.className = "media-preview-file-box";

      const icon = document.createElement("span");
      icon.className = "media-preview-file-icon";
      icon.textContent = getFileIconFromMime(file.type, file.name);

      const info = document.createElement("div");
      info.className = "media-preview-file-info";

      const name = document.createElement("strong");
      name.textContent = file.name || "Documento";

      const details = document.createElement("span");
      details.textContent = `${file.type || "arquivo"} • ${formatFileSize(file.size)}`;

      info.appendChild(name);
      info.appendChild(details);

      fileBox.appendChild(icon);
      fileBox.appendChild(info);
      body.appendChild(fileBox);
    } else {
      const preview = isImage
        ? document.createElement("img")
        : isAudio
          ? document.createElement("audio")
          : document.createElement("video");

      preview.className = isImage
        ? "media-preview-image"
        : isAudio
          ? "media-preview-audio"
          : "media-preview-video";
      preview.src = state.pendingMediaPreviewUrl;

      if (!isImage) {
        preview.controls = true;
        preview.preload = "metadata";
      }

      body.appendChild(preview);
    }

    title.textContent = isImage
      ? "Enviar foto"
      : isVideo
        ? "Enviar vídeo"
        : isAudio
          ? "Enviar áudio"
          : "Enviar documento";
    meta.textContent = `${file.name || "arquivo"} • ${formatFileSize(file.size)}`;

    caption.placeholder = isFile
      ? "Adicione uma mensagem para esse documento..."
      : "Adicione uma legenda...";
    caption.value = ui.el("messageInput").value.trim();
    modal.classList.remove("hidden");

    setTimeout(() => {
      caption.focus();
    }, 50);
  }

  function closeMediaPreview() {
    const modal = ui.el("mediaPreviewModal");
    const body = ui.el("mediaPreviewBody");
    const caption = ui.el("mediaPreviewCaption");

    state.pendingMediaFile = null;
    revokeMediaPreviewUrl();

    modal.classList.add("hidden");
    body.replaceChildren();
    caption.value = "";

    setMediaPreviewSending(false);
  }

  function setMediaPreviewSending(isSending) {
    const sendButton = ui.el("sendMediaPreviewButton");
    const cancelButton = ui.el("cancelMediaPreviewButton");
    const closeButton = ui.el("closeMediaPreviewButton");
    const caption = ui.el("mediaPreviewCaption");

    if (!sendButton || !cancelButton || !closeButton || !caption) return;

    sendButton.disabled = isSending;
    cancelButton.disabled = isSending;
    closeButton.disabled = isSending;
    caption.disabled = isSending;

    sendButton.textContent = isSending ? "Enviando..." : "Enviar";
  }

  async function sendPreviewMedia() {
    if (!state.pendingMediaFile) {
      ui.showToast("error", "Nenhuma mídia selecionada.");
      return;
    }

    try {
      setMediaPreviewSending(true);

      const caption = ui.el("mediaPreviewCaption").value.trim();

      await sendMediaMessage(state.pendingMediaFile, caption);

      ui.el("messageInput").value = "";
      closeMediaPreview();
    } catch (error) {
      ui.showToast("error", error.message);
      setMediaPreviewSending(false);
    }
  }


  function getBestAudioMimeType() {
    const options = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];

    if (!window.MediaRecorder) return "";

    return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  function formatRecordingTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function setAudioRecorderButtons(mode) {
    const stopButton = ui.el("stopAudioRecorderButton");
    const sendButton = ui.el("sendAudioRecorderButton");
    const cancelButton = ui.el("cancelAudioRecorderButton");
    const closeButton = ui.el("closeAudioRecorderButton");

    if (!stopButton || !sendButton || !cancelButton || !closeButton) return;

    const isSending = mode === "sending";

    stopButton.classList.toggle("hidden", mode !== "recording");
    sendButton.classList.toggle("hidden", mode !== "preview" && mode !== "sending");

    stopButton.disabled = isSending;
    sendButton.disabled = isSending;
    cancelButton.disabled = isSending;
    closeButton.disabled = isSending;

    sendButton.textContent = isSending ? "Enviando..." : "Enviar áudio";
  }

  function clearAudioRecorderTimer() {
    clearInterval(state.audioRecorderTimerInterval);
    state.audioRecorderTimerInterval = null;
  }

  function stopAudioStream() {
    if (state.audioRecorderStream) {
      state.audioRecorderStream.getTracks().forEach((track) => track.stop());
      state.audioRecorderStream = null;
    }
  }

  function revokeAudioPreviewUrl() {
    if (state.audioPreviewUrl) {
      URL.revokeObjectURL(state.audioPreviewUrl);
      state.audioPreviewUrl = null;
    }
  }

  function resetAudioRecorderUi() {
    clearAudioRecorderTimer();
    stopAudioStream();
    revokeAudioPreviewUrl();

    const modal = ui.el("audioRecorderModal");
    const status = ui.el("audioRecorderStatus");
    const timer = ui.el("audioRecorderTimer");
    const player = ui.el("audioPreviewPlayer");
    const pulse = ui.el("audioRecorderPulse");

    state.audioRecorder = null;
    state.audioRecorderChunks = [];
    state.pendingAudioFile = null;
    state.isAudioRecorderCancelling = false;

    if (status) status.textContent = "Preparando gravação...";
    if (timer) timer.textContent = "00:00";
    if (pulse) pulse.classList.remove("is-recording");

    if (player) {
      player.pause();
      player.removeAttribute("src");
      player.load();
      player.classList.add("hidden");
    }

    if (modal) modal.classList.add("hidden");

    setAudioRecorderButtons("idle");
  }

  async function startAudioRecording() {
    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de gravar áudio.");
      return;
    }

    if (isBlockedChat()) {
      ui.showToast("error", getBlockNoticeText());
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      ui.showToast("error", "Seu navegador não suporta gravação de áudio.");
      return;
    }

    if (!window.MediaRecorder) {
      ui.showToast("error", "Seu navegador não suporta MediaRecorder.");
      return;
    }

    resetAudioRecorderUi();

    const modal = ui.el("audioRecorderModal");
    const status = ui.el("audioRecorderStatus");
    const timer = ui.el("audioRecorderTimer");
    const pulse = ui.el("audioRecorderPulse");

    modal.classList.remove("hidden");
    status.textContent = "Pedindo permissão do microfone...";
    timer.textContent = "00:00";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      state.audioRecorderStream = stream;
      state.audioRecorder = recorder;
      state.audioRecorderChunks = [];
      state.isAudioRecorderCancelling = false;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          state.audioRecorderChunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        clearAudioRecorderTimer();
        stopAudioStream();

        if (state.isAudioRecorderCancelling) {
          resetAudioRecorderUi();
          return;
        }

        const rawType = recorder.mimeType || mimeType || "audio/webm";
        const type = rawType.split(";")[0] || "audio/webm";
        const blob = new Blob(state.audioRecorderChunks || [], { type });

        if (blob.size < 500) {
          ui.showToast("error", "Áudio muito curto. Grave novamente.");
          resetAudioRecorderUi();
          return;
        }

        const extension = type.includes("ogg")
          ? "ogg"
          : type.includes("mp4")
            ? "m4a"
            : "webm";

        const file = new File([blob], `audio-${Date.now()}.${extension}`, {
          type,
        });

        state.pendingAudioFile = file;
        revokeAudioPreviewUrl();
        state.audioPreviewUrl = URL.createObjectURL(file);

        const player = ui.el("audioPreviewPlayer");
        player.src = state.audioPreviewUrl;
        player.classList.remove("hidden");

        status.textContent = "Prévia do áudio";
        pulse.classList.remove("is-recording");
        setAudioRecorderButtons("preview");
      });

      recorder.start();
      state.audioRecorderStartedAt = Date.now();

      status.textContent = "Gravando áudio...";
      pulse.classList.add("is-recording");
      setAudioRecorderButtons("recording");

      state.audioRecorderTimerInterval = setInterval(() => {
        timer.textContent = formatRecordingTime(Date.now() - state.audioRecorderStartedAt);
      }, 250);
    } catch (error) {
      console.error("Erro ao gravar áudio:", error);
      ui.showToast(
        "error",
        "Não foi possível acessar o microfone. Verifique a permissão do navegador.",
      );
      resetAudioRecorderUi();
    }
  }

  function stopAudioRecording() {
    const recorder = state.audioRecorder;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }

  function cancelAudioRecording() {
    state.isAudioRecorderCancelling = true;

    const recorder = state.audioRecorder;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    resetAudioRecorderUi();
  }

  async function sendRecordedAudio() {
    if (!state.pendingAudioFile) {
      ui.showToast("error", "Nenhum áudio gravado para enviar.");
      return;
    }

    try {
      setAudioRecorderButtons("sending");
      await sendMediaMessage(state.pendingAudioFile, "");
      resetAudioRecorderUi();
    } catch (error) {
      ui.showToast("error", error.message);
      setAudioRecorderButtons("preview");
    }
  }


  const INITIAL_MESSAGE_LIMIT = 30;
  const OLDER_MESSAGE_LIMIT = 30;
  const MAX_RENDERED_MESSAGES = 180;
  const MESSAGE_CACHE_LIMIT = 320;

  function getChatCacheKey(chatId) {
    return String(Number(chatId));
  }

  function getMessageCache(chatId) {
    const key = getChatCacheKey(chatId);
    state.messageCacheByChat = state.messageCacheByChat || {};
    if (!Array.isArray(state.messageCacheByChat[key])) state.messageCacheByChat[key] = [];
    return state.messageCacheByChat[key];
  }

  function setMessageCache(chatId, messages) {
    const key = getChatCacheKey(chatId);
    state.messageCacheByChat = state.messageCacheByChat || {};
    state.messageCacheByChat[key] = messages.slice(-MESSAGE_CACHE_LIMIT);
    return state.messageCacheByChat[key];
  }

  function getMessagePagination(chatId) {
    const key = getChatCacheKey(chatId);
    state.messagePaginationByChat = state.messagePaginationByChat || {};
    if (!state.messagePaginationByChat[key]) {
      state.messagePaginationByChat[key] = {
        hasMore: true,
        isLoadingOlder: false,
        oldestId: null,
        lastLoadedAt: 0,
      };
    }
    return state.messagePaginationByChat[key];
  }

  function getRealMessageId(message) {
    const id = Number(message?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  function sortMessages(messages) {
    return [...messages].sort((a, b) => {
      const aId = getRealMessageId(a);
      const bId = getRealMessageId(b);
      if (aId && bId) return aId - bId;
      if (aId) return 1;
      if (bId) return -1;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }

  function mergeMessagesIntoCache(chatId, incomingMessages, options = {}) {
    const incoming = Array.isArray(incomingMessages) ? incomingMessages.filter(Boolean) : [];

    if (options.replace) return setMessageCache(chatId, sortMessages(incoming));

    const current = getMessageCache(chatId);
    const byKey = new Map();

    for (const message of current) {
      const realId = getRealMessageId(message);
      const key = realId ? `id:${realId}` : message.clientId ? `client:${message.clientId}` : `tmp:${Math.random()}`;
      byKey.set(key, message);
    }

    for (const message of incoming) {
      const realId = getRealMessageId(message);
      const key = realId ? `id:${realId}` : message.clientId ? `client:${message.clientId}` : `tmp:${Date.now()}:${Math.random()}`;
      if (message.clientId) byKey.delete(`client:${message.clientId}`);
      byKey.set(key, { ...(byKey.get(key) || {}), ...message });
    }

    return setMessageCache(chatId, sortMessages(Array.from(byKey.values())));
  }

  function upsertMessageInCache(message) {
    if (!message || !message.chatId) return;
    mergeMessagesIntoCache(message.chatId, [message]);
  }

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

  async function loadOlderMessages(chatId) {
    const pagination = getMessagePagination(chatId);

    if (pagination.isLoadingOlder || !pagination.hasMore) return [];

    const cache = getMessageCache(chatId);
    const beforeId = pagination.oldestId || getOldestMessageId(cache);

    if (!beforeId) {
      pagination.hasMore = false;
      return [];
    }

    pagination.isLoadingOlder = true;

    const messagesBox = ui.el("messages");
    const loading = createMessagesLoadingMore();
    messagesBox.prepend(loading);

    try {
      const response = await api.request(`/api/chats/${chatId}/messages?limit=${OLDER_MESSAGE_LIMIT}&beforeId=${beforeId}`);
      const olderMessages = response.data || [];

      pagination.hasMore = olderMessages.length >= OLDER_MESSAGE_LIMIT;
      pagination.oldestId = getOldestMessageId(olderMessages) || beforeId;
      pagination.lastLoadedAt = Date.now();

      mergeMessagesIntoCache(chatId, olderMessages);
      loading.remove();

      await prependOlderMessages(chatId, olderMessages);

      return olderMessages;
    } finally {
      loading.remove();
      pagination.isLoadingOlder = false;
    }
  }

  function scheduleMarkChatAsRead(chatId, messageId) {
    if (!chatId || !messageId) return Promise.resolve();

    const key = getChatCacheKey(chatId);
    const current = Number(state.pendingReadByChat?.[key] || 0);
    const nextId = Math.max(current, Number(messageId));

    state.pendingReadByChat = state.pendingReadByChat || {};
    state.pendingReadTimers = state.pendingReadTimers || {};
    state.pendingReadByChat[key] = nextId;

    window.clearTimeout(state.pendingReadTimers[key]);

    return new Promise((resolve) => {
      state.pendingReadTimers[key] = window.setTimeout(() => {
        const latestId = Number(state.pendingReadByChat[key] || nextId);

        delete state.pendingReadByChat[key];
        delete state.pendingReadTimers[key];

        markChatAsRead(chatId, latestId)
          .then(resolve)
          .catch((error) => {
            console.error("Erro ao marcar mensagens como lidas:", error);
            resolve();
          });
      }, 450);
    });
  }



  const CHAT_CACHE_TTL_MS = 5 * 60 * 1000;
  const USERS_CACHE_TTL_MS = 20 * 60 * 1000;

  function getUserScopedKey(name) {
    const userId = state.currentUser && state.currentUser.id ? state.currentUser.id : "anon";
    return `lgchat:${name}:${userId}`;
  }

  function readJsonCache(key, maxAgeMs) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!parsed || !Array.isArray(parsed.data)) return null;
      if (Date.now() - Number(parsed.savedAt || 0) > maxAgeMs) return null;

      return parsed.data;
    } catch (_error) {
      return null;
    }
  }

  function writeJsonCache(key, data) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          savedAt: Date.now(),
          data,
        }),
      );
    } catch (_error) {
      // Cache local é opcional.
    }
  }

  function getChatsCacheKey() {
    return `${getUserScopedKey("chats")}:${state.showArchivedChats ? "archived" : "active"}`;
  }

  function restoreChatsFromCache() {
    const cachedChats = readJsonCache(getChatsCacheKey(), CHAT_CACHE_TTL_MS);

    if (!cachedChats || cachedChats.length === 0 || (state.allChats || []).length) {
      return false;
    }

    state.allChats = cachedChats;
    updateArchivedToggleButton();
    renderChats();

    return true;
  }

  function saveChatsToCache(chats) {
    if (!Array.isArray(chats)) return;

    writeJsonCache(getChatsCacheKey(), chats.slice(0, 250));
  }

  function restoreUsersFromCache() {
    const cachedUsers = readJsonCache(getUserScopedKey("users"), USERS_CACHE_TTL_MS);

    if (!cachedUsers || cachedUsers.length === 0) {
      return false;
    }

    state.allUsers = cachedUsers;
    renderUsersForPrivateChat();
    renderUsersForGroup();

    return true;
  }

  function saveUsersToCache(users) {
    if (!Array.isArray(users)) return;

    writeJsonCache(getUserScopedKey("users"), users.slice(0, 500));
  }

  function appendNodesInChunks(target, nodes, options = {}) {
    const chunkSize = Number(options.chunkSize || 24);

    let index = 0;

    function renderChunk() {
      const fragment = document.createDocumentFragment();
      const end = Math.min(index + chunkSize, nodes.length);

      while (index < end) {
        fragment.appendChild(nodes[index]);
        index += 1;
      }

      target.appendChild(fragment);

      if (index < nodes.length) {
        window.requestAnimationFrame(renderChunk);
      }
    }

    renderChunk();
  }

  async function loadUsers(options = {}) {
    if (options.useCache !== false) {
      restoreUsersFromCache();
    }

    const data = await api.request("/api/users");
    state.allUsers = data.data || [];

    saveUsersToCache(state.allUsers);
    renderUsersForPrivateChat();
    renderUsersForGroup();

    return state.allUsers;
  }

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


  async function openChat(chat) {
    const requestedChatId = Number(chat.id);
    state.openingChatId = requestedChatId;

    ui.showMobileChat();

    const messagesBox = ui.el("messages");
    messagesBox.className = "messages";
    ui.setLoading(messagesBox, "Carregando mensagens...");

    if (
      state.editingMessage &&
      Number(state.editingMessage.chatId) !== requestedChatId
    ) {
      cancelEditMessage();
      ui.el("messageInput").value = "";
    }

    state.selectedChat = { ...chat };

    updateChatHeader(state.selectedChat);
    renderChats();

    if (state.socket && state.socket.connected) {
      state.socket.emit("join_chat", { chatId: requestedChatId });
    }

    const searchPanel = ui.el("chatSearchPanel");
    if (searchPanel && !searchPanel.classList.contains("hidden")) {
      ui.el("messageSearchInput").value = "";
      ui.el("messageSearchType").value = "all";
      resetChatSearchResults("Digite para pesquisar mensagens.");
    }

    const fullChatPromise = api.request(`/api/chats/${requestedChatId}`);
    const messagesPromise = loadChatMessages(requestedChatId);

    const fullChatData = await fullChatPromise;

    if (state.openingChatId !== requestedChatId) return;

    const fullChat = { ...chat, ...fullChatData.data };
    state.selectedChat = fullChat;

    updateChatHeader(fullChat);
    renderChats();

    await messagesPromise;

    const performanceApi = window.LGChat.performance;

    const loadInfo = () => {
      loadChatInfo(fullChat.id).catch((error) => {
        console.error("Erro ao carregar detalhes do chat:", error);
      });
    };

    if (performanceApi && typeof performanceApi.runWhenIdle === "function") {
      performanceApi.runWhenIdle(loadInfo, 900);
    } else {
      loadInfo();
    }
  }


  async function loadChatMessages(chatId, options = {}) {
    const messagesBox = ui.el("messages");
    const pagination = getMessagePagination(chatId);
    const cache = getMessageCache(chatId);
    const canUseCache =
      options.force !== true &&
      cache.length > 0 &&
      Date.now() - Number(pagination.lastLoadedAt || 0) < 10_000;

    bindMessagesInfiniteScroll();

    if (canUseCache) {
      await renderMessagesReplace(chatId, cache);
      ui.scrollMessagesToBottom();

      const newest = getNewestMessage(cache);

      if (newest?.id) {
        scheduleMarkChatAsRead(chatId, newest.id);
        markChatListAsRead(chatId);
      }

      return cache;
    }

    const response = await api.request(`/api/chats/${chatId}/messages?limit=${INITIAL_MESSAGE_LIMIT}`);
    const messages = response.data || [];

    messagesBox.className = "messages";

    const merged = mergeMessagesIntoCache(chatId, messages, { replace: true });

    pagination.hasMore = messages.length >= INITIAL_MESSAGE_LIMIT;
    pagination.oldestId = getOldestMessageId(messages);
    pagination.lastLoadedAt = Date.now();

    await renderMessagesReplace(chatId, merged);
    ui.scrollMessagesToBottom();

    const lastMessage = getNewestMessage(messages);

    if (lastMessage?.id) {
      scheduleMarkChatAsRead(chatId, lastMessage.id);
      markChatListAsRead(chatId);
    }

    return messages;
  }


  async function loadChatInfo(chatId) {
    const [chatData, membersData] = await Promise.all([
      api.request(`/api/chats/${chatId}`),
      api.request(`/api/chats/${chatId}/members`),
    ]);

    const chat = chatData.data;
    const members = membersData.data || [];
    const chatInfoBox = ui.el("chatInfoBox");

    if (state.selectedChat && state.selectedChat.id === chat.id) {
      state.selectedChat = { ...state.selectedChat, ...chat };
      updateChatHeader(state.selectedChat);
    }

    chatInfoBox.replaceChildren();

    const profile = document.createElement("div");
    profile.className = "group-profile";

    const avatar = document.createElement("button");
    avatar.type = "button";
    avatar.className = "group-profile-avatar";

    if (chat.canManageGroup === true) {
      avatar.classList.add("editable");
      avatar.title = "Alterar foto do grupo";
    }

    if (chat.avatarUrl) {
      const img = document.createElement("img");
      img.src = chat.avatarUrl;
      img.alt = `Imagem de ${getChatName(chat)}`;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getChatName(chat).charAt(0).toUpperCase();
    }

    if (chat.canManageGroup === true) {
      const overlay = document.createElement("span");
      overlay.className = "avatar-edit-overlay";
      overlay.textContent = "Alterar foto";
      avatar.appendChild(overlay);
      avatar.addEventListener("click", () => openGroupAvatarPicker(chat.id));
    }

    const title = document.createElement("h4");
    title.textContent = getChatName(chat);

    const type = document.createElement("p");
    type.className = "muted";
    type.textContent =
      chat.type === "group"
        ? `Grupo • sua permissão: ${chat.myRole || "member"}`
        : formatUserStatus(chat.privateUser);

    profile.appendChild(avatar);
    profile.appendChild(title);
    profile.appendChild(type);
    chatInfoBox.appendChild(profile);

    const descriptionBox = document.createElement("div");
    descriptionBox.className = "group-section";

    const descriptionTitle = document.createElement("h4");
    descriptionTitle.textContent = "Descrição";

    const description = document.createElement("p");
    description.textContent =
      chat.type === "private"
        ? chat.privateUser?.about || "Disponível"
        : chat.description || "Esse grupo ainda não possui descrição.";

    descriptionBox.appendChild(descriptionTitle);
    descriptionBox.appendChild(description);
    chatInfoBox.appendChild(descriptionBox);

    if (chat.type === "private") {
      const privacyBox = document.createElement("div");
      privacyBox.className = "privacy-action-zone";

      const privacyTitle = document.createElement("h4");
      privacyTitle.textContent = "Privacidade";

      const privacyText = document.createElement("p");
      privacyText.textContent =
        "Controle esse contato e o histórico dessa conversa somente na sua conta.";

      const actions = document.createElement("div");
      actions.className = "privacy-action-grid";

      const blockButton = document.createElement("button");
      blockButton.type = "button";
      blockButton.className = chat.block?.blockedByMe ? "neutral-button" : "danger-button";
      blockButton.textContent = chat.block?.blockedByMe
        ? "Desbloquear contato"
        : "Bloquear contato";
      blockButton.addEventListener("click", () => {
        updateBlockContact(chat.id, !chat.block?.blockedByMe).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "warning-button";
      clearButton.textContent = "Limpar conversa";
      clearButton.addEventListener("click", () => {
        clearCurrentChat(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger-button";
      deleteButton.textContent = "Apagar conversa para mim";
      deleteButton.addEventListener("click", () => {
        deleteCurrentChatForMe(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      actions.appendChild(blockButton);
      actions.appendChild(clearButton);
      actions.appendChild(deleteButton);

      privacyBox.appendChild(privacyTitle);
      privacyBox.appendChild(privacyText);
      privacyBox.appendChild(actions);

      if (chat.block?.blockedByMe || chat.block?.blockedMe) {
        const note = document.createElement("p");
        note.className = "blocked-contact-note";
        note.textContent = getBlockNoticeText(chat);
        privacyBox.appendChild(note);
      }

      chatInfoBox.appendChild(privacyBox);
    }

    const membersBox = document.createElement("div");
    membersBox.className = "group-section";

    const membersTitle = document.createElement("h4");
    membersTitle.textContent = `Membros (${members.length})`;

    const list = document.createElement("div");
    list.className = "member-list";

    members.forEach((member) => {
      const item = document.createElement("div");
      item.className = "member-item";

      const user = member.user || {};
      const miniAvatar = document.createElement("div");
      miniAvatar.className = "mini-avatar";

      if (user.avatarUrl) {
        const img = document.createElement("img");
        img.src = user.avatarUrl;
        img.alt = `Foto de ${user.nome || "usuário"}`;
        miniAvatar.appendChild(img);
      } else {
        miniAvatar.textContent = (user.nome || "?").charAt(0).toUpperCase();
      }

      const content = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = user.nome || `Usuário ${member.userId}`;

      const role = document.createElement("span");
      role.textContent = formatMemberRole(member.role);

      content.appendChild(name);
      content.appendChild(role);
      item.appendChild(miniAvatar);
      item.appendChild(content);
      list.appendChild(item);
    });

    membersBox.appendChild(membersTitle);
    membersBox.appendChild(list);
    chatInfoBox.appendChild(membersBox);

    if (chat.type === "group") {
      const leaveBox = document.createElement("div");
      leaveBox.className = "group-action-zone";

      const leaveTitle = document.createElement("h4");
      leaveTitle.textContent = "Participação";

      const leaveText = document.createElement("p");
      leaveText.textContent =
        "Você pode sair desse grupo. Depois disso, não verá mais as mensagens novas.";

      const leaveButton = document.createElement("button");
      leaveButton.type = "button";
      leaveButton.className = "warning-button";
      leaveButton.textContent = "Sair do grupo";
      leaveButton.addEventListener("click", () => {
        leaveCurrentGroup(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      leaveBox.appendChild(leaveTitle);
      leaveBox.appendChild(leaveText);
      leaveBox.appendChild(leaveButton);
      chatInfoBox.appendChild(leaveBox);
    }

    if (chat.type === "group" && chat.canDeleteGroup === true) {
      const dangerBox = document.createElement("div");
      dangerBox.className = "group-danger-zone";

      const dangerTitle = document.createElement("h4");
      dangerTitle.textContent = "Zona perigosa";

      const dangerText = document.createElement("p");
      dangerText.textContent =
        "Excluir o grupo remove as mensagens e os membros desse grupo.";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger-button";
      deleteButton.textContent = "Excluir grupo";
      deleteButton.addEventListener("click", () => {
        deleteCurrentGroup(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      dangerBox.appendChild(dangerTitle);
      dangerBox.appendChild(dangerText);
      dangerBox.appendChild(deleteButton);
      chatInfoBox.appendChild(dangerBox);
    }
  }

  function formatMemberRole(role) {
    if (role === "owner") return "Dono";
    if (role === "admin") return "Administrador";
    return "Membro";
  }

  async function leaveCurrentGroup(chatId, chatName) {
    const confirmed = window.confirm(`Tem certeza que deseja sair do grupo "${chatName}"?`);
    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}/leave`, { method: "POST" });
    ui.showToast("success", "Você saiu do grupo.");

    if (state.selectedChat && state.selectedChat.id === chatId) {
      state.selectedChat = null;
    }

    await loadChats({ silent: true });
    ui.resetChatScreen();
  }

  async function deleteCurrentGroup(chatId, chatName) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o grupo "${chatName}"? Essa ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}`, { method: "DELETE" });
    ui.showToast("success", "Grupo excluído com sucesso.");

    if (state.selectedChat && state.selectedChat.id === chatId) {
      state.selectedChat = null;
    }

    await loadChats({ silent: true });
    ui.resetChatScreen();
  }

  async function updateBlockContact(chatId, blocked) {
    const response = await api.request(`/api/chats/${chatId}/block`, {
      method: "PATCH",
      body: JSON.stringify({ blocked }),
    });

    const block = response.data.block;

    state.allChats = (state.allChats || []).map((chat) => {
      if (Number(chat.id) !== Number(chatId)) return chat;

      return {
        ...chat,
        block,
      };
    });

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      state.selectedChat = {
        ...state.selectedChat,
        block,
      };

      updateChatHeader(state.selectedChat);
      syncBlockNotice();
      await loadChatInfo(chatId);
    }

    await loadChats({ silent: true });

    return block;
  }

  async function clearCurrentChat(chatId, chatName) {
    const confirmed = window.confirm(
      `Limpar a conversa "${chatName}" somente para você? As mensagens continuarão aparecendo para a outra pessoa.`,
    );

    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}/clear`, {
      method: "POST",
    });

    ui.showToast("success", "Conversa limpa somente para você.");

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      cancelReplyMessage();
      cancelEditMessage();
      ui.el("messageInput").value = "";
      await loadChatMessages(chatId);
      await loadChatInfo(chatId);
    }

    await loadChats({ silent: true });
  }

  async function deleteCurrentChatForMe(chatId, chatName) {
    const confirmed = window.confirm(
      `Apagar a conversa "${chatName}" somente para você? Ela vai sair da sua lista, mas a outra pessoa não será afetada.`,
    );

    if (!confirmed) return;

    await api.request(`/api/chats/${chatId}/delete-for-me`, {
      method: "POST",
    });

    ui.showToast("success", "Conversa apagada somente para você.");

    if (state.selectedChat && Number(state.selectedChat.id) === Number(chatId)) {
      state.selectedChat = null;
    }

    await loadChats({ silent: true });
    ui.closeInfoPanel();
    ui.resetChatScreen();
  }

  function buildMessageElement(message) {
    const div = document.createElement("div");
    div.className = "message";

    if (message.clientId) {
      div.dataset.clientId = String(message.clientId);
    }

    if (message.id) {
      div.dataset.messageId = String(message.id);
    }

    if (message.type === "system") {
      div.classList.add("system");

      const shouldShowGroupAvatar =
        message.text &&
        message.text.toLowerCase().includes("imagem do grupo") &&
        state.selectedChat &&
        state.selectedChat.avatarUrl;

      if (shouldShowGroupAvatar) {
        const avatar = document.createElement("img");
        avatar.className = "system-message-avatar";
        avatar.src = state.selectedChat.avatarUrl;
        avatar.alt = "Foto do grupo";
        div.appendChild(avatar);
      }

      const text = document.createElement("span");
      text.textContent = message.text;
      div.appendChild(text);
      return div;
    }

    const isMine =
      state.currentUser && message.fromUserId === state.currentUser.id;

    if (isMine) {
      div.classList.add("mine");
    }

    if (message.deletedAt) {
      div.classList.add("deleted");
    }

    if (message.clientStatus === "error") {
      div.classList.add("message-error");
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (isActionableMessage(message)) {
      div.classList.add("selectable");

      const actionButton = document.createElement("button");
      actionButton.type = "button";
      actionButton.className = "message-action-button";
      actionButton.title = "Opções da mensagem";
      actionButton.textContent = "⌄";
      actionButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openMessageActionMenu(message, actionButton);
      });

      bubble.appendChild(actionButton);

      div.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openMessageActionMenu(message, div);
      });
    }

    if (message.replyTo) {
      const replyPreview = createReplyPreviewElement(message.replyTo);

      if (replyPreview) {
        bubble.appendChild(replyPreview);
      }
    }

    if (message.isForwarded) {
      const forwardedLabel = document.createElement("span");
      forwardedLabel.className = "forwarded-label";
      forwardedLabel.textContent = "↪ Encaminhada";
      bubble.appendChild(forwardedLabel);
    }

    if (message.type === "image" && message.mediaUrl) {
      bubble.classList.add("media-bubble");

      const img = document.createElement("img");
      img.className = "message-media-image";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = message.mediaUrl;
      img.alt = message.mediaOriginalName || "Imagem enviada";
      img.loading = "lazy";
      img.addEventListener("click", () => {
        openMediaViewer(message);
      });
      bubble.appendChild(img);
    }

    if (message.type === "video" && message.mediaUrl) {
      bubble.classList.add("media-bubble");

      const video = document.createElement("video");
      video.className = "message-media-video";
      video.preload = "metadata";
      video.src = message.mediaUrl;
      video.controls = true;
      video.preload = "metadata";
      bubble.appendChild(video);

      video.addEventListener("dblclick", () => {
        openMediaViewer(message);
      });
    }

    if (message.type === "audio" && message.mediaUrl) {
      bubble.classList.add("audio-bubble");

      const audioWrap = document.createElement("div");
      audioWrap.className = "message-audio-box";

      const audioIcon = document.createElement("span");
      audioIcon.className = "message-audio-icon";
      audioIcon.textContent = "🎙";

      const audio = document.createElement("audio");
      audio.className = "message-media-audio";
      audio.src = message.mediaUrl;
      audio.controls = true;
      audio.preload = "metadata";

      audioWrap.appendChild(audioIcon);
      audioWrap.appendChild(audio);
      bubble.appendChild(audioWrap);
    }

    if (message.type === "file" && message.mediaUrl) {
      bubble.classList.add("file-bubble");

      const fileLink = document.createElement("a");
      fileLink.className = "message-file-box";
      fileLink.href = message.mediaUrl;
      fileLink.target = "_blank";
      fileLink.rel = "noopener noreferrer";
      fileLink.download = message.mediaOriginalName || "";
      fileLink.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      const fileIcon = document.createElement("span");
      fileIcon.className = "message-file-icon";
      fileIcon.textContent = getFileIconFromMime(
        message.mediaMimeType,
        message.mediaOriginalName,
      );

      const fileInfo = document.createElement("div");
      fileInfo.className = "message-file-info";

      const fileName = document.createElement("strong");
      fileName.textContent = message.mediaOriginalName || "Documento";

      const fileMeta = document.createElement("span");
      fileMeta.textContent = `${message.mediaMimeType || "arquivo"} • ${formatFileSize(Number(message.mediaSize || 0))}`;

      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileMeta);

      fileLink.appendChild(fileIcon);
      fileLink.appendChild(fileInfo);

      bubble.appendChild(fileLink);
    }

    if (message.text) {
      const text = document.createElement("p");
      text.textContent = message.text;
      bubble.appendChild(text);
    }

    if (message.type === "text" && !message.text) {
      const text = document.createElement("p");
      text.textContent = "";
      bubble.appendChild(text);
    }

    const meta = document.createElement("span");
    meta.className = "message-meta";

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = ui.formatDate(message.createdAt);

    meta.appendChild(time);

    if (message.editedAt && !message.deletedAt) {
      const edited = document.createElement("span");
      edited.className = "edited-label";
      edited.textContent = "editada";
      meta.appendChild(edited);
    }

    if (message.isStarred && !message.deletedAt) {
      const star = document.createElement("span");
      star.className = "starred-label";
      star.textContent = "⭐";
      star.title = "Mensagem favorita";
      meta.appendChild(star);
    }

    const statusText = getMessageStatusText(message);

    if (statusText) {
      const status = document.createElement("span");
      status.className = "message-status";
      status.textContent = statusText;
      status.title = getMessageStatusTitle(message);

      if (message.clientStatus === "sending") {
        status.classList.add("sending");
      }

      if (message.clientStatus === "error") {
        status.classList.add("error");
      }

      if (message.clientStatus === "read") {
        status.classList.add("read");
      }

      meta.appendChild(status);
    }

    bubble.appendChild(meta);

    const reactions = createReactionsElement(message);

    if (reactions) {
      bubble.appendChild(reactions);
    }

    div.appendChild(bubble);

    return div;
  }

  function addMessage(message) {
    const messagesBox = ui.el("messages");
    messagesBox.classList.remove("empty-state");

    removeMessagePlaceholders(messagesBox);

    upsertMessageInCache(message);

    if (message.clientId) {
      const existing = findMessageElementByClientId(message.clientId);

      if (existing) {
        const replacement = buildMessageElement({
          ...message,
          clientStatus: message.clientStatus || "sent",
        });

        existing.replaceWith(replacement);
        return;
      }
    }

    if (message.id) {
      const existingById = findMessageElementById(message.id);

      if (existingById) {
        existingById.replaceWith(buildMessageElement(message));
        return;
      }
    }

    const div = buildMessageElement(message);
    messagesBox.appendChild(div);

    const nearBottom =
      messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < 280;

    if (nearBottom) {
      trimRenderedMessagesIfNeeded();
    }
  }


  async function createPrivateChat(userId) {
    const data = await api.request("/api/chats/private", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });

    ui.showToast("success", "Conversa criada.");
    ui.closeModal("usersPanel");
    await loadChats({ silent: true });
    await openChat(data.data);
  }

  function renderUsersForPrivateChat() {
    const usersList = ui.el("usersList");
    if (!usersList) return;

    const search = ui.el("userSearch").value.toLowerCase().trim();
    const filtered = state.allUsers.filter((user) => {
      return (
        user.nome.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      );
    });

    usersList.replaceChildren();

    if (!filtered.length) {
      ui.setEmpty(usersList, "Nenhum usuário encontrado.");
      return;
    }

    const nodes = filtered.map((user) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "user-row";

      const avatar = document.createElement("div");
      avatar.className = "mini-avatar";

      if (user.avatarUrl) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = user.avatarUrl;
        img.alt = `Foto de ${user.nome}`;
        avatar.appendChild(img);
      } else {
        avatar.textContent = user.nome.charAt(0).toUpperCase();
      }

      const content = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = user.nome;

      const email = document.createElement("span");
      email.textContent = user.email;

      content.appendChild(name);
      content.appendChild(email);
      button.appendChild(avatar);
      button.appendChild(content);

      button.addEventListener("click", () => {
        createPrivateChat(user.id).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      return button;
    });

    appendNodesInChunks(usersList, nodes, {
      chunkSize: window.matchMedia && window.matchMedia("(max-width: 820px)").matches ? 16 : 32,
    });
  }

  function renderUsersForGroup() {
    const groupUsersList = ui.el("groupUsersList");
    if (!groupUsersList) return;

    const searchInput = safeEl("groupUserSearch");
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const users = search
      ? state.allUsers.filter((user) => {
          return (
            user.nome.toLowerCase().includes(search) ||
            user.email.toLowerCase().includes(search)
          );
        })
      : state.allUsers;

    groupUsersList.replaceChildren();

    if (!users.length) {
      ui.setEmpty(groupUsersList, "Nenhum usuário disponível.");
      return;
    }

    const nodes = users.map((user) => {
      const label = document.createElement("label");
      label.className = "check-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = user.id;
      checkbox.className = "group-user-checkbox";

      const span = document.createElement("span");
      span.textContent = `${user.nome} • ${user.email}`;

      label.appendChild(checkbox);
      label.appendChild(span);

      return label;
    });

    appendNodesInChunks(groupUsersList, nodes, {
      chunkSize: window.matchMedia && window.matchMedia("(max-width: 820px)").matches ? 18 : 36,
    });
  }


  async function createGroup() {
    const button = ui.el("createGroupButton");
    if (state.isCreateGroupLoading) return;

    try {
      state.isCreateGroupLoading = true;
      button.disabled = true;
      button.textContent = "Criando grupo...";

      const name = ui.el("groupName").value.trim();
      const description = ui.el("groupDescription").value.trim();

      const memberIds = Array.from(
        document.querySelectorAll(".group-user-checkbox:checked"),
      ).map((input) => Number(input.value));

      const data = await api.request("/api/chats/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          memberIds,
        }),
      });

      ui.el("groupName").value = "";
      ui.el("groupDescription").value = "";

      document.querySelectorAll(".group-user-checkbox:checked").forEach((input) => {
        input.checked = false;
      });

      ui.closeModal("groupPanel");
      ui.showToast("success", "Grupo criado com sucesso.");
      await loadChats({ silent: true });
      await openChat(data.data);
    } finally {
      state.isCreateGroupLoading = false;
      button.disabled = false;
      button.textContent = "Criar grupo";
    }
  }

  function sendMessage() {
    if (state.editingMessage) {
      submitEditedMessage().catch((error) => {
        ui.showToast("error", error.message);
      });
      return;
    }

    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de enviar mensagem.");
      return;
    }

    if (isBlockedChat()) {
      ui.showToast("error", getBlockNoticeText());
      return;
    }

    if (!state.socket || !state.socket.connected) {
      ui.showToast("error", "Socket desconectado. Recarregue a página.");
      return;
    }

    const input = ui.el("messageInput");
    const text = input.value.trim();

    if (!text) {
      ui.showToast("error", "Digite uma mensagem.");
      return;
    }

    const clientId = makeClientId();
    const replyToMessage = state.replyToMessage ? buildReplySnapshot(state.replyToMessage) : null;
    const replyToMessageId = replyToMessage ? Number(replyToMessage.id) : undefined;

    addMessage({
      id: `temp-${clientId}`,
      chatId: state.selectedChat.id,
      fromUserId: state.currentUser.id,
      text,
      type: "text",
      createdAt: new Date().toISOString(),
      replyToMessageId: replyToMessageId ?? null,
      replyTo: replyToMessage,
      clientId,
      clientStatus: "sending",
    });

    ui.scrollMessagesToBottom();

    input.value = "";
    ui.el("typingText").textContent = "";

    state.socket.emit(
      "chat_message",
      {
        chatId: state.selectedChat.id,
        text,
        clientId,
        replyToMessageId,
      },
      (response) => {
        if (!response || !response.success) {
          markLocalMessageAsError(clientId);

          ui.showToast(
            "error",
            response?.error?.message || "Erro ao enviar mensagem.",
          );
          return;
        }

        addMessage({
          ...response.data,
          clientId,
          clientStatus: "sent",
        });

        cancelReplyMessage();

        if (applyMessageToChatList) {
          applyMessageToChatList(response.data, { incrementUnread: false });
        }

        scheduleChatsRefresh("message-sent", 1200).catch((error) => {
          console.error("Erro ao atualizar chats depois de enviar:", error);
        });
      },
    );
  }

  async function sendMediaMessage(file, captionOverride) {
    if (!validateMediaFile(file)) return;

    const caption =
      typeof captionOverride === "string"
        ? captionOverride.trim()
        : ui.el("messageInput").value.trim();

    const formData = new FormData();
    formData.append("media", file);

    if (caption) formData.append("caption", caption);

    if (state.replyToMessage && state.replyToMessage.id) {
      formData.append("replyToMessageId", String(state.replyToMessage.id));
    }

    const data = await api.request(`/api/chats/${state.selectedChat.id}/media`, {
      method: "POST",
      body: formData,
    });

    ui.el("messageInput").value = "";
    cancelReplyMessage();

    if (!state.socket || !state.socket.connected) {
      addMessage({
        ...data.data,
        clientStatus: "sent",
      });
      ui.scrollMessagesToBottom();
    }

    if (applyMessageToChatList) {
      applyMessageToChatList(data.data, { incrementUnread: false });
    }

    scheduleChatsRefresh("media-sent", 1200).catch((error) => {
      console.error("Erro ao atualizar chats depois de mídia:", error);
    });

    return data.data;
  }

  function handleTyping() {
    if (!state.selectedChat || !state.socket || !state.socket.connected) return;

    state.socket.emit("typing_start", { chatId: state.selectedChat.id });

    clearTimeout(state.typingTimeout);

    state.typingTimeout = setTimeout(() => {
      if (!state.socket || !state.selectedChat) return;
      state.socket.emit("typing_stop", { chatId: state.selectedChat.id });
    }, 900);
  }

  function openGroupAvatarPicker(chatId) {
    const input = ui.el("groupAvatarInput");
    input.value = "";
    input.dataset.chatId = String(chatId);
    input.click();
  }

  async function uploadGroupAvatar(chatId, file) {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      ui.showToast("error", "Use uma imagem JPG, PNG ou WEBP.");
      return;
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      ui.showToast("error", "A imagem deve ter no máximo 2MB.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    const data = await api.request(`/api/chats/${chatId}/avatar`, {
      method: "POST",
      body: formData,
    });

    const updatedChat = data.data;
    ui.showToast("success", "Foto do grupo atualizada.");

    state.selectedChat = { ...(state.selectedChat || {}), ...updatedChat };
    updateChatHeader(state.selectedChat);

    await loadChats({ silent: true });

    state.allChats = state.allChats.map((chat) => {
      if (chat.id !== chatId) return chat;
      return { ...chat, ...updatedChat };
    });

    renderChats();
    await Promise.all([loadChatInfo(chatId), loadChatMessages(chatId)]);
  }


  function handleUserStatusUpdate(payload) {
    if (!payload || !payload.userId) return;

    const updateUser = (user) => {
      if (!user || Number(user.id) !== Number(payload.userId)) return user;

      return {
        ...user,
        isOnline: Boolean(payload.isOnline),
        lastSeenAt: payload.lastSeenAt || user.lastSeenAt,
      };
    };

    state.allUsers = (state.allUsers || []).map(updateUser);

    state.allChats = (state.allChats || []).map((chat) => {
      if (!chat.privateUser || Number(chat.privateUser.id) !== Number(payload.userId)) {
        return chat;
      }

      return {
        ...chat,
        privateUser: updateUser(chat.privateUser),
      };
    });

    if (
      state.selectedChat &&
      state.selectedChat.privateUser &&
      Number(state.selectedChat.privateUser.id) === Number(payload.userId)
    ) {
      state.selectedChat = {
        ...state.selectedChat,
        privateUser: updateUser(state.selectedChat.privateUser),
      };

      updateChatHeader(state.selectedChat);
    }

    renderChats();
  }

  window.LGChat.chat = {
    getChatName,
    getAvatarUrl,
    formatUserStatus,
    loadUsers,
    loadChats,
    scheduleChatsRefresh,
    applyMessageToChatList,
    markChatListAsRead,
    renderChats,
    toggleArchivedChats,
    updateArchivedToggleButton,
    updateChatPreferences,
    isMutedChat,
    isBlockedChat,
    getBlockNoticeText,
    updateBlockContact,
    clearCurrentChat,
    deleteCurrentChatForMe,
    syncBlockNotice,
    openChatOptionsMenu,
    closeChatOptionsMenu,
    toggleAttachmentMenu,
    closeAttachmentMenu,
    openChat,
    addMessage,
    updateMessage,
    markChatAsRead,
    scheduleMarkChatAsRead,
    loadOlderMessages,
    openMediaViewer,
    closeMediaViewer,
    renderUsersForPrivateChat,
    renderUsersForGroup,
    createGroup,
    sendMessage,
    startReplyMessage,
    cancelReplyMessage,
    toggleMessageReaction,
    startEditMessage,
    cancelEditMessage,
    submitEditedMessage,
    deleteMessageForEveryone,
    openMediaPreview,
    closeMediaPreview,
    sendPreviewMedia,
    sendMediaMessage,
    validateMediaFile,
    startAudioRecording,
    stopAudioRecording,
    cancelAudioRecording,
    sendRecordedAudio,
    handleTyping,
    formatMemberRole,
    deleteCurrentGroup,
    leaveCurrentGroup,
    openGroupAvatarPicker,
    uploadGroupAvatar,
    createChatAvatar,
    fillAvatarElement,
    updateChatHeader,
    handleUserStatusUpdate,
    openChatSearchPanel,
    closeChatSearchPanel,
    clearChatSearch,
    scheduleChatSearch,
    performChatSearch,
    openStarredMessagesPanel,
    closeStarredMessagesPanel,
    openForwardMessageModal,
    closeForwardMessageModal,
    submitForwardMessage,
    toggleMessageStar,
  };
})();
