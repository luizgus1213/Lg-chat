});

    ui.el("messageInput").addEventListener("input", () => {
      chat.handleTyping();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      if (typeof chat.closeChatOptionsMenu === "function") {
        chat.closeChatOptionsMenu();
      }

      if (typeof chat.closeAttachmentMenu === "function") {
        chat.closeAttachmentMenu();
      }

      const mediaViewerModal = ui.el("mediaViewerModal");

      if (mediaViewerModal && !mediaViewerModal.classList.contains("hidden")) {
        chat.closeMediaViewer();
        return;
      }

      const audioRecorderModal = ui.el("audioRecorderModal");

      if (audioRecorderModal && !audioRecorderModal.classList.contains("hidden")) {
        chat.cancelAudioRecording();
        return;
      }

      const mediaPreviewModal = ui.el("mediaPreviewModal");

      if (mediaPreviewModal && !mediaPreviewModal.classList.contains("hidden")) {
        chat.closeMediaPreview();
        return;
      }

      const chatSearchPanel = ui.el("chatSearchPanel");

      if (chatSearchPanel && !chatSearchPanel.classList.contains("hidden")) {
        chat.closeChatSearchPanel();
        return;
      }

      if (state.editingMessage) {
        chat.cancelEditMessage();
        ui.el("messageInput").value = "";
        return;
      }

      if (state.replyToMessage) {
        chat.cancelReplyMessage();
        return;
      }

      ui.closeModal("profilePanel");
      ui.closeModal("usersPanel");
      ui.closeModal("groupPanel");
      ui.closeInfoPanel();
    });
  }
