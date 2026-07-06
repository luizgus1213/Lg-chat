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
