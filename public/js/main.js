(() => {
  const state = window.LGChat.state;
  const ui = window.LGChat.ui;
  const auth = window.LGChat.auth;
  const chat = window.LGChat.chat;
  const socket = window.LGChat.socket;

  async function startApp() {
    try {
      ui.showChatArea();

      await auth.loadMe();

      socket.connectSocket();
      socket.requestNotificationPermission();

      await Promise.all([chat.loadUsers(), chat.loadChats()]);

      if (window.LGChat.status && typeof window.LGChat.status.loadStatuses === "function") {
        await window.LGChat.status.loadStatuses().catch((error) => {
          console.error("Erro ao carregar status:", error);
        });
      }
    } catch (error) {
      ui.showToast("error", error.message);
      auth.logout();
    }
  }

  function bindEvents() {
    ui.el("chatHeaderProfileButton").addEventListener("click", () => {
      if (!state.selectedChat) return;
      ui.toggleInfoPanel();
    });

    ui.el("groupAvatarInput").addEventListener("change", async (event) => {
      const input = event.target;
      const file = input.files && input.files[0];
      const chatId = Number(input.dataset.chatId);

      if (!chatId || !file) return;

      try {
        await chat.uploadGroupAvatar(chatId, file);
      } catch (error) {
        ui.showToast("error", error.message);
      } finally {
        input.value = "";
        delete input.dataset.chatId;
      }
    });

    ui.el("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await auth.loginUser();
      } catch (error) {
        ui.showToast("error", error.message);
      }
    });

    ui.el("registerForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await auth.registerUser();
      } catch (error) {
        ui.showToast("error", error.message);
      }
    });

    ui.el("logoutButton").addEventListener("click", () => {
      auth.logout();
    });

    ui.el("openProfileButton").addEventListener("click", () => {
      auth.renderCurrentUser();
      ui.openModal("profilePanel");
    });

    ui.el("closeProfilePanelButton").addEventListener("click", () => {
      ui.closeModal("profilePanel");
    });

    ui.el("changeProfileAvatarButton").addEventListener("click", () => {
      ui.el("profileAvatarInput").click();
    });

    ui.el("profileAvatarInput").addEventListener("change", async (event) => {
      const input = event.target;
      const file = input.files && input.files[0];

      if (!file) return;

      try {
        await auth.uploadMyAvatar(file);
      } catch (error) {
        ui.showToast("error", error.message);
      } finally {
        input.value = "";
      }
    });

    ui.el("profileForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await auth.updateMyProfile();
        ui.closeModal("profilePanel");
      } catch (error) {
        ui.showToast("error", error.message);
      }
    });

    ui.el("refreshChatsButton").addEventListener("click", () => {
      chat.loadChats().catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    ui.el("toggleArchivedChatsButton").addEventListener("click", () => {
      chat.toggleArchivedChats().catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    ui.el("openChatSearchButton").addEventListener("click", () => {
      chat.openChatSearchPanel();
    });

    ui.el("openStarredMessagesButton").addEventListener("click", () => {
      chat.openStarredMessagesPanel().catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    ui.el("closeStarredMessagesButton").addEventListener("click", () => {
      chat.closeStarredMessagesPanel();
    });

    ui.el("closeForwardMessageButton").addEventListener("click", () => {
      chat.closeForwardMessageModal();
    });

    ui.el("cancelForwardMessageButton").addEventListener("click", () => {
      chat.closeForwardMessageModal();
    });

    ui.el("sendForwardMessageButton").addEventListener("click", () => {
      chat.submitForwardMessage().catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    ui.el("closeChatSearchButton").addEventListener("click", () => {
      chat.closeChatSearchPanel();
    });

    ui.el("clearChatSearchButton").addEventListener("click", () => {
      chat.clearChatSearch();
    });

    ui.el("messageSearchInput").addEventListener("input", () => {
      chat.scheduleChatSearch();
    });

    ui.el("messageSearchType").addEventListener("change", () => {
      chat.performChatSearch();
    });

    ui.el("closeInfoPanelButton").addEventListener("click", () => {
      ui.closeInfoPanel();
    });

    ui.el("backToChatsButton").addEventListener("click", () => {
      ui.showMobileSidebar();
    });

    ui.el("openUsersButton").addEventListener("click", () => {
      ui.openModal("usersPanel");
      chat.renderUsersForPrivateChat();
    });

    ui.el("closeUsersPanelButton").addEventListener("click", () => {
      ui.closeModal("usersPanel");
    });

    ui.el("openGroupButton").addEventListener("click", () => {
      ui.openModal("groupPanel");
      chat.renderUsersForGroup();
    });

    ui.el("closeGroupPanelButton").addEventListener("click", () => {
      ui.closeModal("groupPanel");
    });

    ui.el("createGroupButton").addEventListener("click", async () => {
      try {
        await chat.createGroup();
      } catch (error) {
        ui.showToast("error", error.message);
      }
    });

    ui.el("chatSearch").addEventListener("input", () => {
      chat.renderChats();
    });

    ui.el("userSearch").addEventListener("input", () => {
      chat.renderUsersForPrivateChat();
    });

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

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await window.LGChat.loadPartials();

      bindEvents();

      if (window.LGChat.status && typeof window.LGChat.status.bindUi === "function") {
        window.LGChat.status.bindUi();
      }

      if (window.LGChat.call && typeof window.LGChat.call.bindUi === "function") {
        window.LGChat.call.bindUi();
      }

      if (window.LGChat.pwa && typeof window.LGChat.pwa.bindUi === "function") {
        window.LGChat.pwa.bindUi();
      }

      if (window.LGChat.pwa && typeof window.LGChat.pwa.register === "function") {
        window.LGChat.pwa.register();
      }

      if (state.token) {
        await startApp();
      } else {
        ui.showAuthArea();
      }
    } catch (error) {
      console.error("Erro ao iniciar interface:", error);
      alert("Erro ao carregar interface. Veja o console.");
    }
  });

  window.LGChat.main = {
    startApp,
  };
})();
