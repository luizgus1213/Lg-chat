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
