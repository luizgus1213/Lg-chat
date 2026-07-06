const state = window.LGChat.state;

const ui = window.LGChat.ui;

let boundSocket = null;

let uiBound = false;

let localAudioEnabled = true;

let localVideoEnabled = true;

const RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

function safeEl(id) {
    try {
      return ui.el(id);
    } catch (_error) {
      return null;
    }
  }

function getChatName(chat) {
    if (!chat) return "Contato";
    if (chat.type === "private" && chat.privateUser) {
      return chat.privateUser.nome || `Contato #${chat.privateUser.id}`;
    }
    if (chat.name) return chat.name;

    return "Contato";
  }

function getCallTargetName(call = state.activeCall) {
    if (!call) return "Chamada";
    if (call.fromUser && call.fromUser.nome) return call.fromUser.nome;
    if (call.targetUser && call.targetUser.nome) return call.targetUser.nome;

    return getChatName(state.selectedChat);
  }

function getInitial(name) {
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
  }

function isPrivateChatAvailable() {
    const chat = state.selectedChat;

    if (!chat) {
      ui.showToast("error", "Escolha uma conversa antes de iniciar chamada.");
      return false;
    }

    if (chat.type !== "private") {
      ui.showToast("error", "Chamadas estão disponíveis somente em conversa privada.");
      return false;
    }

    const block = chat.block || {};

    if (block.blockedByMe) {
      ui.showToast("error", "Você bloqueou esse contato. Desbloqueie para iniciar chamada.");
      return false;
    }

    if (block.blockedMe || block.isBlocked) {
      ui.showToast("error", "Você não pode iniciar chamada com esse contato.");
      return false;
    }

    return true;
  }

function syncCallButtons() {
    const voiceButton = safeEl("startVoiceCallButton");
    const videoButton = safeEl("startVideoCallButton");
    const enabled = Boolean(
      state.selectedChat &&
        state.selectedChat.type === "private" &&
        !(state.selectedChat.block && state.selectedChat.block.isBlocked),
    );

    if (voiceButton) voiceButton.disabled = !enabled;
    if (videoButton) videoButton.disabled = !enabled;
  }

function showPanel() {
    const panel = safeEl("callPanel");
    if (panel) panel.classList.remove("hidden");
  }

function hidePanel() {
    const panel = safeEl("callPanel");
    if (panel) panel.classList.add("hidden");
  }

function setStatus(text) {
    const status = safeEl("callStatusText");
    if (status) status.textContent = text;
  }

function updateCallHeader() {
    const name = getCallTargetName();
    const nameElement = safeEl("callUserName");
    const initialElement = safeEl("callAvatarInitial");

    if (nameElement) nameElement.textContent = name;
    if (initialElement) initialElement.textContent = getInitial(name);
  }
