ui.el("userSearch").addEventListener("input", debouncedRenderPrivateUsers);

    ui.el("mediaButton").addEventListener("click", (event) => {
      event.stopPropagation();
      chat.toggleAttachmentMenu();
    });

    ui.el("attachGalleryButton").addEventListener("click", () => {
      chat.closeAttachmentMenu();
      ui.el("mediaInput").click();
    });

    ui.el("attachCameraButton").addEventListener("click", () => {
      chat.closeAttachmentMenu();
      ui.el("cameraInput").click();
    });

    ui.el("attachVideoButton").addEventListener("click", () => {
      chat.closeAttachmentMenu();
      ui.el("videoCaptureInput").click();
    });

    ui.el("attachDocumentButton").addEventListener("click", () => {
      chat.closeAttachmentMenu();
      ui.el("documentInput").click();
    });

    ["mediaInput", "cameraInput", "videoCaptureInput", "documentInput"].forEach(
      (inputId) => {
        ui.el(inputId).addEventListener("change", (event) => {
          const input = event.target;
          const file = input.files && input.files[0];

          input.value = "";

          if (!file) return;

          chat.openMediaPreview(file);
        });
      },
    );

    document.addEventListener("click", (event) => {
      const menu = document.getElementById("attachmentMenu");
      const button = document.getElementById("mediaButton");

      if (!menu || menu.classList.contains("hidden")) return;
      if (menu.contains(event.target) || button.contains(event.target)) return;

      chat.closeAttachmentMenu();
    });

    ui.el("closeMediaPreviewButton").addEventListener("click", () => {
      chat.closeMediaPreview();
    });

    ui.el("cancelMediaPreviewButton").addEventListener("click", () => {
      chat.closeMediaPreview();
    });

    ui.el("sendMediaPreviewButton").addEventListener("click", () => {
      chat.sendPreviewMedia();
    });

    ui.el("voiceButton").addEventListener("click", () => {
      chat.startAudioRecording();
    });

    ui.el("closeAudioRecorderButton").addEventListener("click", () => {
      chat.cancelAudioRecording();
    });

    ui.el("cancelAudioRecorderButton").addEventListener("click", () => {
      chat.cancelAudioRecording();
    });

    ui.el("stopAudioRecorderButton").addEventListener("click", () => {
      chat.stopAudioRecording();
    });

    ui.el("sendAudioRecorderButton").addEventListener("click", () => {
      chat.sendRecordedAudio();
    });


    ui.el("mediaPreviewCaption").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      event.preventDefault();
      chat.sendPreviewMedia();
    });

    ui.el("closeMediaViewerButton").addEventListener("click", () => {
      chat.closeMediaViewer();
    });

    ui.el("mediaViewerModal").addEventListener("click", (event) => {
      if (event.target.id === "mediaViewerModal") {
        chat.closeMediaViewer();
      }
    });

    ui.el("cancelEditButton").addEventListener("click", () => {
      chat.cancelEditMessage();
      ui.el("messageInput").value = "";
    });

    ui.el("cancelReplyButton").addEventListener("click", () => {
      chat.cancelReplyMessage();
    });

    ui.el("messageForm").addEventListener("submit", (event) => {
      event.preventDefault();
      chat.sendMessage();
