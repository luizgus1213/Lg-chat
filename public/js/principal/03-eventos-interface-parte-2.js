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

    ui.el("openUsersButton").addEventListener("click", async () => {
      if (window.LGChat.lazy && typeof window.LGChat.lazy.ensurePanelStyle === "function") {
        await window.LGChat.lazy.ensurePanelStyle("users").catch(() => undefined);
      }

      ui.openModal("usersPanel");

      if (!state.allUsers || !state.allUsers.length) {
        try {
          await chat.loadUsers();
        } catch (error) {
          ui.showToast("error", error.message);
          return;
        }
      }

      chat.renderUsersForPrivateChat();
    });

    ui.el("closeUsersPanelButton").addEventListener("click", () => {
      ui.closeModal("usersPanel");
    });

    ui.el("openGroupButton").addEventListener("click", async () => {
      if (window.LGChat.lazy && typeof window.LGChat.lazy.ensurePanelStyle === "function") {
        await window.LGChat.lazy.ensurePanelStyle("group").catch(() => undefined);
      }

      ui.openModal("groupPanel");

      if (!state.allUsers || !state.allUsers.length) {
        try {
          await chat.loadUsers();
        } catch (error) {
          ui.showToast("error", error.message);
          return;
        }
      }

      chat.renderUsersForGroup();
    });

    ui.el("closeGroupPanelButton").addEventListener("click", () => {
      ui.closeModal("groupPanel");
    });

    ui.el("createGroupButton").addEventListener("click", async () => {
      await ui.withButtonLoading(ui.el("createGroupButton"), async () => {
        try {
          await chat.createGroup();
        } catch (error) {
          ui.showToast("error", error.message);
        }
      }, "Criando...");
    });

    const debouncedRenderChats =
      window.LGChat.performance && typeof window.LGChat.performance.debounce === "function"
        ? window.LGChat.performance.debounce(() => chat.renderChats(), 120)
        : () => chat.renderChats();

    ui.el("chatSearch").addEventListener("input", debouncedRenderChats);

    const debouncedRenderPrivateUsers =
      window.LGChat.performance && typeof window.LGChat.performance.debounce === "function"
        ? window.LGChat.performance.debounce(() => chat.renderUsersForPrivateChat(), 140)
        : () => chat.renderUsersForPrivateChat();
