window.LGChat = window.LGChat || {};

const state = window.LGChat.state;

const perf = {
    chatsTimer: null,
    chatsPromise: null,
    chatsResolvers: [],
    lastChatsLoadAt: 0,
    mediaObserver: null,
    slowToastTimer: null,
  };

function isLowEndDevice() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 820px)").matches;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(connection && connection.saveData);

    return saveData || isMobile || cores <= 4 || memory <= 4;
  }

function enablePerformanceMode() {
    const active = isLowEndDevice();
    document.documentElement.classList.toggle("performance-mode", active);
    document.body.classList.toggle("performance-mode", active);
  }

function scheduleIdle(callback, timeout = 900) {
    runWhenIdle(callback, timeout);
  }

function runWhenIdle(callback, timeout = 900) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout });
      return;
    }

    window.setTimeout(callback, 1);
  }

function directLoadChats(options = {}) {
    const chat = window.LGChat.chat;

    if (!chat || typeof chat.loadChats !== "function") {
      return Promise.resolve([]);
    }

    if (state.isLoadingChats && state.loadingChatsPromise) {
      return state.loadingChatsPromise;
    }

    const promise = Promise.resolve(
      chat.loadChats({
        silent: true,
        ...options,
      }),
    ).finally(() => {
      perf.lastChatsLoadAt = Date.now();
    });

    return promise;
  }

function scheduleLoadChats(reason = "auto", delay = 700) {
    const now = Date.now();

    if (now - perf.lastChatsLoadAt < 450 && !state.forceNextChatReload) {
      return Promise.resolve(state.allChats || []);
    }

    window.clearTimeout(perf.chatsTimer);

    const scheduledPromise = new Promise((resolve, reject) => {
      perf.chatsResolvers.push({ resolve, reject });
    });

    perf.chatsTimer = window.setTimeout(async () => {
      const resolvers = perf.chatsResolvers.splice(0);

      try {
        const result = await directLoadChats({ silent: true, reason });
        resolvers.forEach((item) => item.resolve(result));
      } catch (error) {
        resolvers.forEach((item) => item.reject(error));
      }
    }, delay);

    return scheduledPromise;
  }

function makeMediaLazy(root = document) {
    root.querySelectorAll("img").forEach((img) => {
      if (!img.hasAttribute("loading")) img.loading = "lazy";
      if (!img.hasAttribute("decoding")) img.decoding = "async";
    });

    root.querySelectorAll("video").forEach((video) => {
      if (!video.hasAttribute("preload")) video.preload = "metadata";
      if (!video.hasAttribute("playsinline")) video.setAttribute("playsinline", "");
    });
  }
