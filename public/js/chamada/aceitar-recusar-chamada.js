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
