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
