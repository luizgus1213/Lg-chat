window.LGChat = window.LGChat || {};

const DEFAULT_TITLE = "LG Chat";

const INSTALL_DISMISSED_KEY = "lgchat_install_dismissed_at";

let deferredInstallPrompt = null;

let hasBoundUi = false;

let audioContext = null;

let hasReloadedForServiceWorkerUpdate = false;

function getState() {
    return window.LGChat.state || {};
  }

function safeEl(id) {
    return document.getElementById(id);
  }

function getChatNameById(chatId) {
    const state = getState();
    const chatModule = window.LGChat.chat;
    const chat = (state.allChats || []).find((item) => {
      return Number(item.id) === Number(chatId);
    });

    if (chatModule && typeof chatModule.getChatName === "function" && chat) {
      return chatModule.getChatName(chat);
    }

    if (chat && chat.name) return chat.name;
    if (chat && chat.privateUser) return chat.privateUser.nome || "Contato";

    return "LG Chat";
  }

function getMessagePreview(message) {
    if (!message) return "Você recebeu uma nova mensagem.";

    if (message.deletedAt) return "Mensagem apagada.";
    if (message.type === "image") return message.text ? `Foto: ${message.text}` : "📷 Foto";
    if (message.type === "video") return message.text ? `Vídeo: ${message.text}` : "🎥 Vídeo";
    if (message.type === "audio") return message.text ? `Áudio: ${message.text}` : "🎙️ Áudio";
    if (message.type === "file") {
      return message.mediaOriginalName
        ? `📎 ${message.mediaOriginalName}`
        : "📎 Documento";
    }

    return message.text || "Você recebeu uma nova mensagem.";
  }

function updateTitle() {
    const state = getState();
    const count = Number(state.appUnreadCount || 0);
    const title = state.originalTitle || DEFAULT_TITLE;

    document.title = count > 0 ? `(${count}) ${title}` : title;

    if ("setAppBadge" in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => undefined);
      } else if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => undefined);
      }
    }
  }

function incrementUnreadCount() {
    const state = getState();

    state.appUnreadCount = Number(state.appUnreadCount || 0) + 1;
    updateTitle();
  }

function clearUnreadCount() {
    const state = getState();

    state.appUnreadCount = 0;
    updateTitle();
  }

function isSoundEnabled() {
    const state = getState();

    return state.notificationSoundEnabled !== false;
  }

function setSoundEnabled(enabled) {
    const state = getState();

    state.notificationSoundEnabled = Boolean(enabled);
    localStorage.setItem("lgchat_sound", enabled ? "on" : "off");
    syncUi();
  }

function areBrowserNotificationsEnabled() {
    const state = getState();

    return state.browserNotificationsEnabled !== false;
  }

function setBrowserNotificationsEnabled(enabled) {
    const state = getState();

    state.browserNotificationsEnabled = Boolean(enabled);
    localStorage.setItem("lgchat_browser_notifications", enabled ? "on" : "off");
    syncUi();
  }
