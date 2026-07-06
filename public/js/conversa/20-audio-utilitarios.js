async function sendPreviewMedia() {
    if (!state.pendingMediaFile) {
      ui.showToast("error", "Nenhuma mídia selecionada.");
      return;
    }

    try {
      setMediaPreviewSending(true);

      const caption = ui.el("mediaPreviewCaption").value.trim();

      await sendMediaMessage(state.pendingMediaFile, caption);

      ui.el("messageInput").value = "";
      closeMediaPreview();
    } catch (error) {
      ui.showToast("error", error.message);
      setMediaPreviewSending(false);
    }
  }

function getBestAudioMimeType() {
    const options = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];

    if (!window.MediaRecorder) return "";

    return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

function formatRecordingTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

function setAudioRecorderButtons(mode) {
    const stopButton = ui.el("stopAudioRecorderButton");
    const sendButton = ui.el("sendAudioRecorderButton");
    const cancelButton = ui.el("cancelAudioRecorderButton");
    const closeButton = ui.el("closeAudioRecorderButton");

    if (!stopButton || !sendButton || !cancelButton || !closeButton) return;

    const isSending = mode === "sending";

    stopButton.classList.toggle("hidden", mode !== "recording");
    sendButton.classList.toggle("hidden", mode !== "preview" && mode !== "sending");

    stopButton.disabled = isSending;
    sendButton.disabled = isSending;
    cancelButton.disabled = isSending;
    closeButton.disabled = isSending;

    sendButton.textContent = isSending ? "Enviando..." : "Enviar áudio";
  }

function clearAudioRecorderTimer() {
    clearInterval(state.audioRecorderTimerInterval);
    state.audioRecorderTimerInterval = null;
  }

function stopAudioStream() {
    if (state.audioRecorderStream) {
      state.audioRecorderStream.getTracks().forEach((track) => track.stop());
      state.audioRecorderStream = null;
    }
  }

function revokeAudioPreviewUrl() {
    if (state.audioPreviewUrl) {
      URL.revokeObjectURL(state.audioPreviewUrl);
      state.audioPreviewUrl = null;
    }
  }

function resetAudioRecorderUi() {
    clearAudioRecorderTimer();
    stopAudioStream();
    revokeAudioPreviewUrl();

    const modal = ui.el("audioRecorderModal");
    const status = ui.el("audioRecorderStatus");
    const timer = ui.el("audioRecorderTimer");
    const player = ui.el("audioPreviewPlayer");
    const pulse = ui.el("audioRecorderPulse");

    state.audioRecorder = null;
    state.audioRecorderChunks = [];
    state.pendingAudioFile = null;
    state.isAudioRecorderCancelling = false;

    if (status) status.textContent = "Preparando gravação...";
    if (timer) timer.textContent = "00:00";
    if (pulse) pulse.classList.remove("is-recording");

    if (player) {
      player.pause();
      player.removeAttribute("src");
      player.load();
      player.classList.add("hidden");
    }

    if (modal) modal.classList.add("hidden");

    setAudioRecorderButtons("idle");
  }
