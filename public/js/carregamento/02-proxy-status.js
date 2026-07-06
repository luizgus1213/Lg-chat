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
