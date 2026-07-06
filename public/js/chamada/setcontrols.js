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
