function bindUi() {
    if (uiBound) {
      syncCallButtons();
      return;
    }

    uiBound = true;

    const voiceButton = safeEl("startVoiceCallButton");
    const videoButton = safeEl("startVideoCallButton");
    const acceptButton = safeEl("acceptCallButton");
    const rejectButton = safeEl("rejectCallButton");
    const endButton = safeEl("endCallButton");
    const muteButton = safeEl("toggleMuteCallButton");
    const cameraButton = safeEl("toggleCameraCallButton");

    if (voiceButton) {
      voiceButton.addEventListener("click", () => {
        startCall("voice").catch((error) => {
          console.error("Erro ao iniciar chamada de voz:", error);
          ui.showToast("error", error.message);
        });
      });
    }

    if (videoButton) {
      videoButton.addEventListener("click", () => {
        startCall("video").catch((error) => {
          console.error("Erro ao iniciar chamada de vídeo:", error);
          ui.showToast("error", error.message);
        });
      });
    }

    if (acceptButton) {
      acceptButton.addEventListener("click", () => {
        acceptCall().catch((error) => {
          console.error("Erro ao atender chamada:", error);
          ui.showToast("error", error.message);
        });
      });
    }

    if (rejectButton) {
      rejectButton.addEventListener("click", () => {
        rejectCall().catch((error) => {
          console.error("Erro ao recusar chamada:", error);
        });
      });
    }

    if (endButton) {
      endButton.addEventListener("click", () => {
        endCall({ notifyServer: true });
      });
    }

    if (muteButton) muteButton.addEventListener("click", toggleMute);
    if (cameraButton) cameraButton.addEventListener("click", toggleCamera);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.activeCall) {
        endCall({ notifyServer: true });
      }
    });

    syncCallButtons();
  }

window.LGChat.call = {
    bindUi,
    bindSocket,
    syncCallButtons,
    startCall,
    endCall,
    handleIncomingCall,
    handleAccepted,
    handleRemoteEnded,
    handleRemoteRejected,
    handleSignal,
  };
