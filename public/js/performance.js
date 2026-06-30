(() => {
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

  function observeLazyMedia() {
    makeMediaLazy(document);

    if (perf.mediaObserver) return;

    perf.mediaObserver = new MutationObserver((mutations) => {
      runWhenIdle(() => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            makeMediaLazy(node);
          });
        }
      });
    });

    perf.mediaObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function patchFetchTiming() {
    if (window.__lgchatFetchTimingPatched) return;
    window.__lgchatFetchTimingPatched = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const start = performance.now();
      const requestTarget = String(args[0] || "");

      try {
        const response = await originalFetch(...args);
        const ms = Math.round(performance.now() - start);

        if (ms >= 1400) {
          console.warn(`[LG Chat] Requisição lenta: ${requestTarget} levou ${ms}ms`);
        }

        return response;
      } catch (error) {
        const ms = Math.round(performance.now() - start);
        console.error(`[LG Chat] Falha em ${requestTarget} depois de ${ms}ms`, error);
        throw error;
      }
    };
  }


  function bindVisibilityMemoryCleanup() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden") return;

      const state = window.LGChat.state;

      if (!state || !state.messageCacheByChat) return;

      for (const key of Object.keys(state.messageCacheByChat)) {
        const cache = state.messageCacheByChat[key];

        if (Array.isArray(cache) && cache.length > 160) {
          state.messageCacheByChat[key] = cache.slice(-160);
        }
      }
    });
  }

  function bindNetworkHints() {
    window.addEventListener("offline", () => {
      const ui = window.LGChat.ui;
      if (ui && typeof ui.showToast === "function") {
        ui.showToast("error", "Você está offline. Algumas ações podem demorar.");
      }
    });

    window.addEventListener("online", () => {
      const ui = window.LGChat.ui;
      if (ui && typeof ui.showToast === "function") {
        ui.showToast("success", "Conexão restaurada.");
      }

      scheduleLoadChats("online", 250).catch((error) => {
        console.error("Erro ao atualizar chats depois de reconectar:", error);
      });
    });
  }


  function debounce(callback, delay = 300) {
    let timer = null;

    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }

  function throttle(callback, delay = 120) {
    let lastRun = 0;
    let timer = null;

    return (...args) => {
      const now = Date.now();
      const remaining = delay - (now - lastRun);

      window.clearTimeout(timer);

      if (remaining <= 0) {
        lastRun = now;
        callback(...args);
        return;
      }

      timer = window.setTimeout(() => {
        lastRun = Date.now();
        callback(...args);
      }, remaining);
    };
  }

  function appendFragmentInChunks(target, nodes, options = {}) {
    const chunkSize = Number(options.chunkSize || 18);
    const mode = options.mode === "prepend" ? "prepend" : "append";

    return new Promise((resolve) => {
      let index = 0;

      function runChunk() {
        const fragment = document.createDocumentFragment();
        const end = Math.min(index + chunkSize, nodes.length);

        while (index < end) {
          fragment.appendChild(nodes[index]);
          index += 1;
        }

        if (mode === "prepend") {
          target.prepend(fragment);
        } else {
          target.appendChild(fragment);
        }

        if (index >= nodes.length) {
          resolve();
          return;
        }

        window.requestAnimationFrame(runChunk);
      }

      runChunk();
    });
  }



  function observeVideosForPerformance() {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target;

        if (!(video instanceof HTMLVideoElement)) continue;

        if (!entry.isIntersecting && !video.paused) {
          video.pause();
        }

        if (!entry.isIntersecting) {
          video.preload = "metadata";
        }
      }
    }, {
      rootMargin: "160px",
      threshold: 0.05,
    });

    const bindVideo = (video) => {
      if (!(video instanceof HTMLVideoElement)) return;
      if (video.dataset.performanceVideoObserved === "true") return;

      video.dataset.performanceVideoObserved = "true";
      observer.observe(video);
    };

    document.querySelectorAll("video").forEach(bindVideo);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            bindVideo(node);
            return;
          }

          if (node instanceof HTMLElement) {
            node.querySelectorAll("video").forEach(bindVideo);
          }
        });
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }



  function cleanupOldLocalCaches() {
    try {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;

      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);

        if (!key || !key.startsWith("lgchat:")) continue;

        const raw = localStorage.getItem(key);

        if (!raw) continue;

        const parsed = JSON.parse(raw);

        if (parsed && parsed.savedAt && now - Number(parsed.savedAt) > maxAge) {
          localStorage.removeItem(key);
        }
      }
    } catch (_error) {
      // Limpeza de cache local é opcional.
    }
  }



  function bindVisibleRefresh() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;

      if (window.LGChat.performance && typeof window.LGChat.performance.scheduleLoadChats === "function") {
        window.LGChat.performance.scheduleLoadChats("visible", 500).catch((error) => {
          console.error("Erro ao atualizar chats ao voltar para aba:", error);
        });
      }
    });
  }


  function init() {
    enablePerformanceMode();
    observeLazyMedia();
    patchFetchTiming();
    bindNetworkHints();
    bindVisibleRefresh();
    cleanupOldLocalCaches();
    observeVideosForPerformance();
    bindVisibilityMemoryCleanup();
  }

  window.LGChat.performance = {
    init,
    scheduleIdle,
    runWhenIdle,
    enablePerformanceMode,
    makeMediaLazy,
    observeLazyMedia,
    scheduleLoadChats,
    directLoadChats,
    debounce,
    throttle,
    appendFragmentInChunks,
  };
})();
