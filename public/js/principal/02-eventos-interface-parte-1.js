function bindEvents() {
    ui.el("chatHeaderProfileButton").addEventListener("click", async () => {
      if (!state.selectedChat) return;

      if (window.LGChat.lazy && typeof window.LGChat.lazy.ensurePanelStyle === "function") {
        await window.LGChat.lazy.ensurePanelStyle("info").catch(() => undefined);
      }

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

      await ui.withButtonLoading(ui.el("loginForm").querySelector("button[type='submit']"), async () => {
        try {
          await auth.loginUser();
        } catch (error) {
          ui.showToast("error", error.message);
        }
      }, "Entrando...");
    });

    ui.el("registerForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      await ui.withButtonLoading(ui.el("registerForm").querySelector("button[type='submit']"), async () => {
        try {
          await auth.registerUser();
        } catch (error) {
          ui.showToast("error", error.message);
        }
      }, "Criando...");
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
        ui.setButtonLoading(ui.el("changeProfileAvatarButton"), true, "Enviando...");
        await auth.uploadMyAvatar(file);
      } catch (error) {
        ui.showToast("error", error.message);
      } finally {
        ui.setButtonLoading(ui.el("changeProfileAvatarButton"), false);
        input.value = "";
      }
    });

    ui.el("profileForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      await ui.withButtonLoading(ui.el("saveProfileButton"), async () => {
        try {
          await auth.updateMyProfile();
          ui.closeModal("profilePanel");
        } catch (error) {
          ui.showToast("error", error.message);
        }
      }, "Salvando...");
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
