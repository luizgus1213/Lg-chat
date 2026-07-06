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
