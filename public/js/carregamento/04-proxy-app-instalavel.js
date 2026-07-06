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
