async function startAudioRecording() {
    if (!state.selectedChat) {
      ui.showToast("error", "Escolha uma conversa antes de gravar áudio.");
      return;
    }

    if (isBlockedChat()) {
      ui.showToast("error", getBlockNoticeText());
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      ui.showToast("error", "Seu navegador não suporta gravação de áudio.");
      return;
    }

    if (!window.MediaRecorder) {
      ui.showToast("error", "Seu navegador não suporta MediaRecorder.");
      return;
    }

    resetAudioRecorderUi();

    const modal = ui.el("audioRecorderModal");
    const status = ui.el("audioRecorderStatus");
    const timer = ui.el("audioRecorderTimer");
    const pulse = ui.el("audioRecorderPulse");

    modal.classList.remove("hidden");
    status.textContent = "Pedindo permissão do microfone...";
    timer.textContent = "00:00";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      state.audioRecorderStream = stream;
      state.audioRecorder = recorder;
      state.audioRecorderChunks = [];
      state.isAudioRecorderCancelling = false;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          state.audioRecorderChunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        clearAudioRecorderTimer();
        stopAudioStream();

        if (state.isAudioRecorderCancelling) {
          resetAudioRecorderUi();
          return;
        }

        const rawType = recorder.mimeType || mimeType || "audio/webm";
        const type = rawType.split(";")[0] || "audio/webm";
        const blob = new Blob(state.audioRecorderChunks || [], { type });

        if (blob.size < 500) {
          ui.showToast("error", "Áudio muito curto. Grave novamente.");
          resetAudioRecorderUi();
          return;
        }

        const extension = type.includes("ogg")
          ? "ogg"
          : type.includes("mp4")
            ? "m4a"
            : "webm";

        const file = new File([blob], `audio-${Date.now()}.${extension}`, {
          type,
        });

        state.pendingAudioFile = file;
        revokeAudioPreviewUrl();
        state.audioPreviewUrl = URL.createObjectURL(file);

        const player = ui.el("audioPreviewPlayer");
        player.src = state.audioPreviewUrl;
        player.classList.remove("hidden");

        status.textContent = "Prévia do áudio";
        pulse.classList.remove("is-recording");
        setAudioRecorderButtons("preview");
      });

      recorder.start();
      state.audioRecorderStartedAt = Date.now();

      status.textContent = "Gravando áudio...";
      pulse.classList.add("is-recording");
      setAudioRecorderButtons("recording");

      state.audioRecorderTimerInterval = setInterval(() => {
        timer.textContent = formatRecordingTime(Date.now() - state.audioRecorderStartedAt);
      }, 250);
    } catch (error) {
      console.error("Erro ao gravar áudio:", error);
      ui.showToast(
        "error",
        "Não foi possível acessar o microfone. Verifique a permissão do navegador.",
      );
      resetAudioRecorderUi();
    }
  }

function stopAudioRecording() {
    const recorder = state.audioRecorder;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }
