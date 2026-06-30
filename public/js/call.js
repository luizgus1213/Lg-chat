(() => {
  const state = window.LGChat.state;
  const ui = window.LGChat.ui;

  let boundSocket = null;
  let uiBound = false;
  let localAudioEnabled = true;
  let localVideoEnabled = true;

  const RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  function safeEl(id) {
    try {
      return ui.el(id);
    } catch (_error) {
      return null;
    }
  }

  function getChatName(chat) {
    if (!chat) return "Contato";
    if (chat.type === "private" && chat.privateUser) {
      return chat.privateUser.nome || `Contato #${chat.privateUser.id}`;
    }
    if (chat.name) return chat.name;

    return "Contato";
  }

  function getCallTargetName(call = state.activeCall) {
    if (!call) return "Chamada";
    if (call.fromUser && call.fromUser.nome) return call.fromUser.nome;
    if (call.targetUser && call.targetUser.nome) return call.targetUser.nome;

    return getChatName(state.selectedChat);
  }

  function getInitial(name) {
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
  }

  function isPrivateChatAvailable() {
    const chat = state.selectedChat;

    if (!chat) {
      ui.showToast("error", "Escolha uma conversa antes de iniciar chamada.");
      return false;
    }

    if (chat.type !== "private") {
      ui.showToast("error", "Chamadas estão disponíveis somente em conversa privada.");
      return false;
    }

    const block = chat.block || {};

    if (block.blockedByMe) {
      ui.showToast("error", "Você bloqueou esse contato. Desbloqueie para iniciar chamada.");
      return false;
    }

    if (block.blockedMe || block.isBlocked) {
      ui.showToast("error", "Você não pode iniciar chamada com esse contato.");
      return false;
    }

    return true;
  }

  function syncCallButtons() {
    const voiceButton = safeEl("startVoiceCallButton");
    const videoButton = safeEl("startVideoCallButton");
    const enabled = Boolean(
      state.selectedChat &&
        state.selectedChat.type === "private" &&
        !(state.selectedChat.block && state.selectedChat.block.isBlocked),
    );

    if (voiceButton) voiceButton.disabled = !enabled;
    if (videoButton) videoButton.disabled = !enabled;
  }

  function showPanel() {
    const panel = safeEl("callPanel");
    if (panel) panel.classList.remove("hidden");
  }

  function hidePanel() {
    const panel = safeEl("callPanel");
    if (panel) panel.classList.add("hidden");
  }

  function setStatus(text) {
    const status = safeEl("callStatusText");
    if (status) status.textContent = text;
  }

  function updateCallHeader() {
    const name = getCallTargetName();
    const nameElement = safeEl("callUserName");
    const initialElement = safeEl("callAvatarInitial");

    if (nameElement) nameElement.textContent = name;
    if (initialElement) initialElement.textContent = getInitial(name);
  }

  function setControls(mode) {
    const acceptButton = safeEl("acceptCallButton");
    const rejectButton = safeEl("rejectCallButton");
    const endButton = safeEl("endCallButton");
    const muteButton = safeEl("toggleMuteCallButton");
    const cameraButton = safeEl("toggleCameraCallButton");

    [acceptButton, rejectButton, endButton, muteButton, cameraButton].forEach((button) => {
      if (button) button.classList.add("hidden");
    });

    if (mode === "incoming") {
      if (acceptButton) acceptButton.classList.remove("hidden");
      if (rejectButton) rejectButton.classList.remove("hidden");
      return;
    }

    if (mode === "active" || mode === "outgoing") {
      if (endButton) endButton.classList.remove("hidden");
      if (muteButton) muteButton.classList.remove("hidden");

      if (state.activeCall && state.activeCall.type === "video" && cameraButton) {
        cameraButton.classList.remove("hidden");
      }
    }
  }

  function updateVideoVisibility() {
    const remoteVideo = safeEl("remoteCallVideo");
    const localVideo = safeEl("localCallVideo");
    const fallback = safeEl("callAvatarFallback");
    const hasVideoCall = state.activeCall && state.activeCall.type === "video";

    if (remoteVideo) {
      remoteVideo.classList.toggle("hidden", !hasVideoCall || !remoteVideo.srcObject);
    }

    if (localVideo) {
      localVideo.classList.toggle("hidden", !hasVideoCall || !localVideo.srcObject);
    }

    if (fallback) {
      fallback.classList.toggle(
        "over-video",
        Boolean(hasVideoCall && remoteVideo && remoteVideo.srcObject),
      );
    }
  }

  function startTimer() {
    stopTimer();

    const timer = safeEl("callTimer");
    state.callStartedAt = Date.now();

    if (timer) {
      timer.classList.remove("hidden");
      timer.textContent = "00:00";
    }

    state.callTimerInterval = setInterval(() => {
      if (!timer || !state.callStartedAt) return;

      const seconds = Math.floor((Date.now() - state.callStartedAt) / 1000);
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;

      timer.textContent = `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
    }, 1000);
  }

  function stopTimer() {
    const timer = safeEl("callTimer");

    if (state.callTimerInterval) {
      clearInterval(state.callTimerInterval);
      state.callTimerInterval = null;
    }

    state.callStartedAt = null;

    if (timer) {
      timer.classList.add("hidden");
      timer.textContent = "00:00";
    }
  }

  async function getLocalMedia(type) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Seu navegador não suporta chamada de voz/vídeo.");
    }

    const constraints = {
      audio: true,
      video:
        type === "video"
          ? {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    state.localCallStream = stream;

    const localVideo = safeEl("localCallVideo");

    if (localVideo) {
      localVideo.srcObject = stream;
      localVideo.muted = true;
      localVideo.playsInline = true;
    }

    localAudioEnabled = true;
    localVideoEnabled = true;
    syncMediaButtons();
    updateVideoVisibility();

    return stream;
  }

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

  function emitCallSignal(signal) {
    if (!state.socket || !state.activeCall) return;

    state.socket.emit("call:signal", {
      callId: state.activeCall.callId,
      chatId: state.activeCall.chatId,
      signal,
    });
  }

  async function startCall(type) {
    if (!isPrivateChatAvailable()) return;
    if (state.activeCall) {
      ui.showToast("error", "Você já está em uma chamada.");
      return;
    }

    const chat = state.selectedChat;

    try {
      const ack = await new Promise((resolve) => {
        state.socket.emit(
          "call:start",
          {
            chatId: chat.id,
            type,
          },
          resolve,
        );
      });

      if (!ack || !ack.success) {
        throw new Error(ack?.error?.message || "Não foi possível iniciar a chamada.");
      }

      state.activeCall = {
        ...ack.data,
        mode: "outgoing",
        targetUser: ack.data.targetUser || chat.privateUser,
      };

      showPanel();
      updateCallHeader();
      setControls("outgoing");
      setStatus(type === "video" ? "Chamando por vídeo..." : "Chamando...");

      const stream = await getLocalMedia(type);
      const peer = createPeerConnection();

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      emitCallSignal({
        type: "offer",
        sdp: offer,
      });
    } catch (error) {
      console.error("Erro ao iniciar chamada:", error);
      ui.showToast("error", error.message || "Erro ao iniciar chamada.");
      endCall({ notifyServer: true, silent: true });
    }
  }

  function handleIncomingCall(call) {
    if (state.activeCall) {
      state.socket.emit("call:reject", {
        callId: call.callId,
        chatId: call.chatId,
      });

      return;
    }

    state.activeCall = {
      ...call,
      mode: "incoming",
    };

    showPanel();
    updateCallHeader();
    setControls("incoming");
    setStatus(call.type === "video" ? "Chamada de vídeo recebida" : "Chamada de voz recebida");
    updateVideoVisibility();
  }

  async function acceptCall() {
    if (!state.activeCall || state.activeCall.mode !== "incoming") return;

    try {
      const active = state.activeCall;
      const stream = await getLocalMedia(active.type);
      const peer = createPeerConnection();

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      const ack = await new Promise((resolve) => {
        state.socket.emit(
          "call:accept",
          {
            callId: active.callId,
            chatId: active.chatId,
          },
          resolve,
        );
      });

      if (!ack || !ack.success) {
        throw new Error(ack?.error?.message || "Não foi possível atender a chamada.");
      }

      state.activeCall = {
        ...state.activeCall,
        ...ack.data,
        mode: "active",
      };

      setControls("active");
      setStatus("Conectando...");

      if (state.pendingCallOffer) {
        await handleOffer(state.pendingCallOffer);
        state.pendingCallOffer = null;
      }

      await flushPendingCandidates();
    } catch (error) {
      console.error("Erro ao atender chamada:", error);
      ui.showToast("error", error.message || "Erro ao atender chamada.");
      endCall({ notifyServer: true });
    }
  }

  async function rejectCall() {
    if (!state.activeCall) return;

    const callId = state.activeCall.callId;
    const chatId = state.activeCall.chatId;

    try {
      if (state.socket) {
        state.socket.emit("call:reject", {
          callId,
          chatId,
        });
      }
    } finally {
      cleanupCall();
    }
  }

  async function handleOffer(signal) {
    if (!state.callPeerConnection || !state.activeCall) {
      state.pendingCallOffer = signal;
      return;
    }

    const peer = state.callPeerConnection;

    await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    emitCallSignal({
      type: "answer",
      sdp: answer,
    });
  }

  async function handleAnswer(signal) {
    if (!state.callPeerConnection) return;

    await state.callPeerConnection.setRemoteDescription(
      new RTCSessionDescription(signal.sdp),
    );

    setStatus("Conectando...");
    await flushPendingCandidates();
  }

  async function handleCandidate(signal) {
    if (!signal.candidate) return;

    if (
      !state.callPeerConnection ||
      !state.callPeerConnection.remoteDescription ||
      !state.callPeerConnection.remoteDescription.type
    ) {
      state.pendingCallCandidates.push(signal.candidate);
      return;
    }

    await state.callPeerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }

  async function flushPendingCandidates() {
    if (!state.callPeerConnection) return;

    const candidates = [...state.pendingCallCandidates];
    state.pendingCallCandidates = [];

    for (const candidate of candidates) {
      try {
        await state.callPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Erro ao adicionar candidato ICE pendente:", error);
      }
    }
  }

  async function handleSignal(payload) {
    if (!payload || !payload.signal) return;

    const signal = payload.signal;

    try {
      if (signal.type === "offer") {
        await handleOffer(signal);
      }

      if (signal.type === "answer") {
        await handleAnswer(signal);
      }

      if (signal.type === "candidate") {
        await handleCandidate(signal);
      }
    } catch (error) {
      console.error("Erro ao processar sinal da chamada:", error);
      ui.showToast("error", "Erro ao conectar chamada.");
      endCall({ notifyServer: true });
    }
  }

  function handleAccepted(call) {
    if (!state.activeCall || state.activeCall.callId !== call.callId) return;

    state.activeCall = {
      ...state.activeCall,
      ...call,
      mode: "active",
    };

    setControls("active");
    setStatus("Conectando...");
  }

  function handleRemoteEnded(message) {
    if (!state.activeCall || state.activeCall.callId !== message.callId) return;

    ui.showToast("success", "Chamada encerrada.");
    cleanupCall();
  }

  function handleRemoteRejected(message) {
    if (!state.activeCall || state.activeCall.callId !== message.callId) return;

    ui.showToast("error", "Chamada recusada ou cancelada.");
    cleanupCall();
  }

  function cleanupCall() {
    stopTimer();
    closePeerConnection();
    stopLocalMedia();

    state.activeCall = null;
    state.pendingCallOffer = null;
    state.pendingCallCandidates = [];

    setControls("idle");
    hidePanel();
    syncCallButtons();
  }

  function endCall(options = {}) {
    const active = state.activeCall;

    if (active && options.notifyServer !== false && state.socket) {
      state.socket.emit("call:end", {
        callId: active.callId,
        chatId: active.chatId,
      });
    }

    cleanupCall();

    if (!options.silent) {
      ui.showToast("success", "Chamada encerrada.");
    }
  }

  function bindSocket(socket) {
    if (!socket || boundSocket === socket) return;

    boundSocket = socket;

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRemoteRejected);
    socket.on("call:ended", handleRemoteEnded);
    socket.on("call:signal", (payload) => {
      handleSignal(payload).catch((error) => {
        console.error("Erro no sinal da chamada:", error);
      });
    });
  }

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
})();
