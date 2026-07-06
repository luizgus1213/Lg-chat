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
