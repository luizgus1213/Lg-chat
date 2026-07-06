/* Corrigido: função openChatOptionsMenu completa neste arquivo. */

function openChatOptionsMenu(chat, anchorElement) {
    closeChatOptionsMenu();

    if (!chat || !chat.id) return;

    const menu = document.createElement("div");
    menu.className = "chat-options-menu";

    const addOption = (label, handler, className = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (className) button.className = className;

      button.addEventListener("click", async () => {
        closeChatOptionsMenu();

        try {
          await handler();
        } catch (error) {
          console.error("Erro ao atualizar preferências do chat:", error);
          ui.showToast("error", error.message);
        }
      });

      menu.appendChild(button);
      return button;
    };

    addOption(chat.isPinned ? "Desfixar conversa" : "Fixar conversa", async () => {
      await updateChatPreferences(chat.id, { isPinned: !chat.isPinned });
      ui.showToast("success", chat.isPinned ? "Conversa desfixada." : "Conversa fixada.");
      await loadChats({ silent: true });
    });

    addOption(
      chat.isArchived ? "Desarquivar conversa" : "Arquivar conversa",
      async () => {
        await updateChatPreferences(chat.id, { isArchived: !chat.isArchived });

        ui.showToast(
          "success",
          chat.isArchived ? "Conversa desarquivada." : "Conversa arquivada.",
        );

        await loadChats({ silent: true });
      },
      chat.isArchived ? "" : "warning",
    );

    const divider = document.createElement("div");
    divider.className = "chat-options-divider";
    menu.appendChild(divider);

    if (isMutedChat(chat)) {
      addOption("Reativar notificações", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: false,
          mutedUntil: null,
        });

        ui.showToast("success", "Notificações reativadas.");
        await loadChats({ silent: true });
      });
    } else {
      addOption("Silenciar por 8 horas", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: true,
          mutedUntil: getMuteUntil(8),
        });

        ui.showToast("success", "Conversa silenciada por 8 horas.");
        await loadChats({ silent: true });
      });

      addOption("Silenciar por 1 semana", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: true,
          mutedUntil: getMuteUntil(24 * 7),
        });

        ui.showToast("success", "Conversa silenciada por 1 semana.");
        await loadChats({ silent: true });
      });

      addOption("Silenciar sempre", async () => {
        await updateChatPreferences(chat.id, {
          isMuted: true,
          mutedUntil: null,
        });

        ui.showToast("success", "Conversa silenciada.");
        await loadChats({ silent: true });
      });
    }


    const privacyDivider = document.createElement("div");
    privacyDivider.className = "chat-options-divider";
    menu.appendChild(privacyDivider);

    if (chat.type === "private") {
      addOption(
        chat.block?.blockedByMe ? "Desbloquear contato" : "Bloquear contato",
        async () => {
          await updateBlockContact(chat.id, !chat.block?.blockedByMe);
          ui.showToast(
            "success",
            chat.block?.blockedByMe ? "Contato desbloqueado." : "Contato bloqueado.",
          );
        },
        chat.block?.blockedByMe ? "" : "danger",
      );
    }

addOption("Limpar conversa", async () => {
      await clearCurrentChat(chat.id, getChatName(chat));
    }, "warning");

    addOption("Apagar conversa para mim", async () => {
      await deleteCurrentChatForMe(chat.id, getChatName(chat));
    }, "danger");

    document.body.appendChild(menu);

    const rect = anchorElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    const top = Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 12);
    const left = Math.min(
      Math.max(12, rect.right - menuRect.width),
      window.innerWidth - menuRect.width - 12,
    );

    menu.style.top = `${Math.max(12, top)}px`;
    menu.style.left = `${Math.max(12, left)}px`;

    setTimeout(() => {
      document.addEventListener(
        "click",
        (event) => {
          if (!menu.contains(event.target)) {
            closeChatOptionsMenu();
          }
        },
        { once: true },
      );
    }, 0);
  }
