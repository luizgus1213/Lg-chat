(() => {
  window.LGChat = window.LGChat || {};

  const scriptPromises = new Map();
  const stylePromises = new Map();

  function runWhenIdle(callback, timeout = 1100) {
    const perf = window.LGChat.performance;

    if (perf && typeof perf.runWhenIdle === "function") {
      perf.runWhenIdle(callback, timeout);
      return;
    }

    window.setTimeout(callback, 1);
  }

  function loadScriptOnce(src) {
    if (scriptPromises.has(src)) {
      return scriptPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-lazy-src="${src}"]`);

      if (existing && existing.dataset.loaded === "true") {
        resolve(existing);
        return;
      }

      const script = existing || document.createElement("script");

      script.src = src;
      script.defer = true;
      script.dataset.lazySrc = src;

      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve(script);
      }, { once: true });

      script.addEventListener("error", () => {
        reject(new Error(`Erro ao carregar ${src}`));
      }, { once: true });

      if (!existing) {
        document.body.appendChild(script);
      }
    });

    scriptPromises.set(src, promise);

    return promise;
  }

  function loadStyleOnce(href) {
    if (stylePromises.has(href)) {
      return stylePromises.get(href);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${href}"]`);

      if (existing) {
        resolve(existing);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;

      link.addEventListener("load", () => resolve(link), { once: true });
      link.addEventListener("error", () => reject(new Error(`Erro ao carregar ${href}`)), {
        once: true,
      });

      document.head.appendChild(link);
    });

    stylePromises.set(href, promise);

    return promise;
  }

  const statusProxy = {
    __lazyProxy: true,
    bindUi() {
      const openButton = document.getElementById("openStatusPanelButton");

      if (!openButton || openButton.dataset.lazyStatusBound === "true") return;

      openButton.dataset.lazyStatusBound = "true";
      openButton.addEventListener("click", () => {
        statusProxy.openStatusPanel().catch((error) => {
          console.error("Erro ao abrir status:", error);
          window.LGChat.ui?.showToast?.("error", error.message);
        });
      });
    },
    async ensureLoaded() {
      await loadStyleOnce("features/status-panel/status-panel.css");

      if (window.LGChat.loadStatusPanelPartial) {
        await window.LGChat.loadStatusPanelPartial();
      }

      if (window.LGChat.status && window.LGChat.status.__lazyProxy !== true) {
        return window.LGChat.status;
      }

      await loadScriptOnce("js/status.js");

      const realStatus = window.LGChat.status;

      if (!realStatus || realStatus.__lazyProxy === true) {
        throw new Error("Módulo de status não carregou corretamente.");
      }

      if (typeof realStatus.bindUi === "function") {
        realStatus.bindUi();
      }

      return realStatus;
    },
    async openStatusPanel() {
      const realStatus = await statusProxy.ensureLoaded();
      return realStatus.openStatusPanel();
    },
    async loadStatuses() {
      const realStatus = await statusProxy.ensureLoaded();
      return realStatus.loadStatuses();
    },
    renderSidebarStatuses() {
      // O status real será carregado quando o usuário abrir o painel.
    },
    closeStatusPanel() {},
    openStatusViewer() {},
    closeStatusViewer() {},
  };

  let callSocket = null;
  let callProxyUnbound = false;
  let voiceHandler = null;
  let videoHandler = null;

  function simpleSyncCallButtons() {
    const state = window.LGChat.state || {};
    const selected = state.selectedChat;
    const enabled = Boolean(
      selected &&
        selected.type === "private" &&
        !(selected.block && selected.block.isBlocked),
    );

    const voiceButton = document.getElementById("startVoiceCallButton");
    const videoButton = document.getElementById("startVideoCallButton");

    if (voiceButton) voiceButton.disabled = !enabled;
    if (videoButton) videoButton.disabled = !enabled;
  }

  function unbindCallLaunchButtons() {
    if (callProxyUnbound) return;

    const voiceButton = document.getElementById("startVoiceCallButton");
    const videoButton = document.getElementById("startVideoCallButton");

    if (voiceButton && voiceHandler) {
      voiceButton.removeEventListener("click", voiceHandler);
    }

    if (videoButton && videoHandler) {
      videoButton.removeEventListener("click", videoHandler);
    }

    callProxyUnbound = true;
  }

  const callProxy = {
    __lazyProxy: true,
    bindUi() {
      const voiceButton = document.getElementById("startVoiceCallButton");
      const videoButton = document.getElementById("startVideoCallButton");

      if (voiceButton && !voiceButton.dataset.lazyCallBound) {
        voiceHandler = () => {
          callProxy.startCall("voice").catch((error) => {
            console.error("Erro ao iniciar chamada de voz:", error);
            window.LGChat.ui?.showToast?.("error", error.message);
          });
        };

        voiceButton.dataset.lazyCallBound = "true";
        voiceButton.addEventListener("click", voiceHandler);
      }

      if (videoButton && !videoButton.dataset.lazyCallBound) {
        videoHandler = () => {
          callProxy.startCall("video").catch((error) => {
            console.error("Erro ao iniciar chamada de vídeo:", error);
            window.LGChat.ui?.showToast?.("error", error.message);
          });
        };

        videoButton.dataset.lazyCallBound = "true";
        videoButton.addEventListener("click", videoHandler);
      }

      simpleSyncCallButtons();
    },
    bindSocket(socket) {
      if (!socket || callSocket === socket) return;

      callSocket = socket;

      socket.on("call:incoming", (payload) => {
        callProxy.ensureLoaded().then((realCall) => {
          realCall.handleIncomingCall?.(payload);
        }).catch((error) => {
          console.error("Erro ao carregar chamada recebida:", error);
        });
      });

      socket.on("call:accepted", (payload) => {
        callProxy.ensureLoaded().then((realCall) => {
          realCall.handleAccepted?.(payload);
        }).catch((error) => {
          console.error("Erro ao processar aceite de chamada:", error);
        });
      });

      socket.on("call:rejected", (payload) => {
        callProxy.ensureLoaded().then((realCall) => {
          realCall.handleRemoteRejected?.(payload);
        }).catch((error) => {
          console.error("Erro ao processar chamada recusada:", error);
        });
      });

      socket.on("call:ended", (payload) => {
        callProxy.ensureLoaded().then((realCall) => {
          realCall.handleRemoteEnded?.(payload);
        }).catch((error) => {
          console.error("Erro ao processar chamada encerrada:", error);
        });
      });

      socket.on("call:signal", (payload) => {
        callProxy.ensureLoaded().then((realCall) => {
          realCall.handleSignal?.(payload);
        }).catch((error) => {
          console.error("Erro ao processar sinal de chamada:", error);
        });
      });
    },
    syncCallButtons() {
      if (window.LGChat.call && window.LGChat.call.__lazyProxy !== true) {
        return window.LGChat.call.syncCallButtons?.();
      }

      simpleSyncCallButtons();
    },
    async ensureLoaded() {
      if (window.LGChat.call && window.LGChat.call.__lazyProxy !== true) {
        return window.LGChat.call;
      }

      await loadScriptOnce("js/call.js");

      const realCall = window.LGChat.call;

      if (!realCall || realCall.__lazyProxy === true) {
        throw new Error("Módulo de chamada não carregou corretamente.");
      }

      unbindCallLaunchButtons();

      if (typeof realCall.bindUi === "function") {
        realCall.bindUi();
      }

      return realCall;
    },
    async startCall(type) {
      const realCall = await callProxy.ensureLoaded();
      return realCall.startCall(type);
    },
    async endCall(options) {
      const realCall = await callProxy.ensureLoaded();
      return realCall.endCall(options);
    },
  };

  const pwaProxy = {
    __lazyProxy: true,
    bindUi() {
      const installButton = document.getElementById("installAppButton");
      const soundButton = document.getElementById("toggleSoundButton");
      const notificationsButton = document.getElementById("enableNotificationsButton");

      const bind = (button, action) => {
        if (!button || button.dataset.lazyPwaBound === "true") return;

        button.dataset.lazyPwaBound = "true";
        button.addEventListener("click", () => {
          pwaProxy.ensureLoaded().then((realPwa) => {
            realPwa.bindUi?.();
            action(realPwa);
          }).catch((error) => {
            console.error("Erro ao carregar PWA:", error);
            window.LGChat.ui?.showToast?.("error", error.message);
          });
        });
      };

      bind(installButton, (realPwa) => realPwa.installApp?.());
      bind(soundButton, (realPwa) => realPwa.setSoundEnabled?.(!window.LGChat.state.notificationSoundEnabled));
      bind(notificationsButton, (realPwa) => realPwa.requestNotificationPermission?.());
    },
    register() {
      runWhenIdle(() => {
        pwaProxy.ensureLoaded().then((realPwa) => {
          realPwa.bindUi?.();
          realPwa.register?.();
        }).catch((error) => {
          console.error("Erro ao carregar PWA em segundo plano:", error);
        });
      }, 1600);
    },
    async ensureLoaded() {
      if (window.LGChat.pwa && window.LGChat.pwa.__lazyProxy !== true) {
        return window.LGChat.pwa;
      }

      await loadScriptOnce("js/pwa.js");

      const realPwa = window.LGChat.pwa;

      if (!realPwa || realPwa.__lazyProxy === true) {
        throw new Error("Módulo PWA não carregou corretamente.");
      }

      return realPwa;
    },
    notifyNewMessage(message) {
      pwaProxy.ensureLoaded().then((realPwa) => {
        realPwa.notifyNewMessage?.(message);
      }).catch(() => undefined);
    },
    clearUnreadCount() {
      if (window.LGChat.pwa && window.LGChat.pwa.__lazyProxy !== true) {
        window.LGChat.pwa.clearUnreadCount?.();
      }
    },
    incrementUnreadCount() {
      if (window.LGChat.pwa && window.LGChat.pwa.__lazyProxy !== true) {
        window.LGChat.pwa.incrementUnreadCount?.();
      }
    },
  };

  if (!window.LGChat.status) window.LGChat.status = statusProxy;
  if (!window.LGChat.call) window.LGChat.call = callProxy;
  if (!window.LGChat.pwa) window.LGChat.pwa = pwaProxy;

  async function ensurePanelStyle(name) {
    const map = {
      info: "features/info-panel/info-panel.css",
      users: "features/users-panel/users-panel.css",
      group: "features/group-panel/group-panel.css",
      status: "features/status-panel/status-panel.css",
    };

    const href = map[name];

    if (!href) return null;

    return loadStyleOnce(href);
  }

  window.LGChat.lazy = {
    loadScriptOnce,
    loadStyleOnce,
    ensurePanelStyle,
    ensureStatus: statusProxy.ensureLoaded,
    ensureCall: callProxy.ensureLoaded,
    ensurePwa: pwaProxy.ensureLoaded,
  };
})();
