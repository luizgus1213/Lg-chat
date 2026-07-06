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
