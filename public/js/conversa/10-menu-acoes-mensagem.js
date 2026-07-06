function openMessageActionMenu(message, anchorElement) {
    if (!isActionableMessage(message)) return;

    closeMessageActionMenu();

    const menu = document.createElement("div");
    menu.className = "message-actions-menu";

    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "Responder";
    replyButton.addEventListener("click", () => {
      closeMessageActionMenu();
      startReplyMessage(message);
    });

    menu.appendChild(replyButton);

    const forwardButton = document.createElement("button");
    forwardButton.type = "button";
    forwardButton.textContent = "Encaminhar";
    forwardButton.addEventListener("click", () => {
      closeMessageActionMenu();
      openForwardMessageModal(message);
    });

    menu.appendChild(forwardButton);

    const starButton = document.createElement("button");
    starButton.type = "button";
    starButton.textContent = message.isStarred ? "Remover dos favoritos" : "Favoritar";
    starButton.addEventListener("click", () => {
      closeMessageActionMenu();
      toggleMessageStar(message).catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    menu.appendChild(starButton);

    const reactions = document.createElement("div");
    reactions.className = "message-reaction-picker";

    ["👍", "❤️", "😂", "😮", "😢", "🙏"].forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reaction-pick-button";
      button.textContent = emoji;
      button.title = `Reagir com ${emoji}`;
      button.addEventListener("click", () => {
        closeMessageActionMenu();
        toggleMessageReaction(message, emoji).catch((error) => {
          ui.showToast("error", error.message);
        });
      });
      reactions.appendChild(button);
    });

    menu.appendChild(reactions);

    if (isOwnEditableMessage(message)) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent =
        message.type === "text" ? "Editar mensagem" : "Editar legenda";
      editButton.addEventListener("click", () => {
        closeMessageActionMenu();
        startEditMessage(message);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger";
      deleteButton.textContent = "Apagar para todos";
      deleteButton.addEventListener("click", () => {
        closeMessageActionMenu();
        deleteMessageForEveryone(message).catch((error) => {
          ui.showToast("error", error.message);
        });
      });

      menu.appendChild(editButton);
      menu.appendChild(deleteButton);
    }

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
            closeMessageActionMenu();
          }
        },
        { once: true },
      );
    }, 0);
  }
