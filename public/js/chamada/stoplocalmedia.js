function stopLocalMedia() {
    if (state.localCallStream) {
      state.localCallStream.getTracks().forEach((track) => track.stop());
    }

    state.localCallStream = null;

    const localVideo = safeEl("localCallVideo");
    const remoteVideo = safeEl("remoteCallVideo");

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    updateVideoVisibility();
  }

function createPeerConnection() {
    closePeerConnection();

    const peer = new RTCPeerConnection(RTC_CONFIG);

    peer.onicecandidate = (event) => {
      if (!event.candidate || !state.activeCall) return;

      emitCallSignal({
        type: "candidate",
        candidate: event.candidate,
      });
    };

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;

      if (!remoteStream) return;

      state.remoteCallStream = remoteStream;

      const remoteVideo = safeEl("remoteCallVideo");
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.playsInline = true;
      }

      updateVideoVisibility();
    };

    peer.onconnectionstatechange = () => {
      if (!state.callPeerConnection) return;

      if (peer.connectionState === "connected") {
        setStatus("Em chamada");
        startTimer();
      }

      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        if (peer.connectionState === "failed") {
          ui.showToast("error", "A conexão da chamada falhou.");
          endCall({ notifyServer: true });
        }
      }
    };

    state.callPeerConnection = peer;
    return peer;
  }

function closePeerConnection() {
    if (state.callPeerConnection) {
      try {
        state.callPeerConnection.onicecandidate = null;
        state.callPeerConnection.ontrack = null;
        state.callPeerConnection.onconnectionstatechange = null;
        state.callPeerConnection.close();
      } catch (error) {
        console.error("Erro ao fechar conexão WebRTC:", error);
      }
    }

    state.callPeerConnection = null;
    state.remoteCallStream = null;
  }

function syncMediaButtons() {
    const muteButton = safeEl("toggleMuteCallButton");
    const cameraButton = safeEl("toggleCameraCallButton");

    if (muteButton) {
      muteButton.textContent = localAudioEnabled ? "🎙️" : "🔇";
      muteButton.title = localAudioEnabled ? "Mutar microfone" : "Ativar microfone";
      muteButton.classList.toggle("off", !localAudioEnabled);
    }

    if (cameraButton) {
      cameraButton.textContent = localVideoEnabled ? "📷" : "🚫";
      cameraButton.title = localVideoEnabled ? "Desligar câmera" : "Ligar câmera";
      cameraButton.classList.toggle("off", !localVideoEnabled);
    }
  }

function toggleMute() {
    if (!state.localCallStream) return;

    localAudioEnabled = !localAudioEnabled;

    state.localCallStream.getAudioTracks().forEach((track) => {
      track.enabled = localAudioEnabled;
    });

    syncMediaButtons();
  }

function toggleCamera() {
    if (!state.localCallStream) return;

    localVideoEnabled = !localVideoEnabled;

    state.localCallStream.getVideoTracks().forEach((track) => {
      track.enabled = localVideoEnabled;
    });

    syncMediaButtons();
  }
