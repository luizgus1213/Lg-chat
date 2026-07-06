function addMessage(message) {
    const messagesBox = ui.el("messages");
    messagesBox.classList.remove("empty-state");

    removeMessagePlaceholders(messagesBox);

    upsertMessageInCache(message);

    if (message.clientId) {
      const existing = findMessageElementByClientId(message.clientId);

      if (existing) {
        const replacement = buildMessageElement({
          ...message,
          clientStatus: message.clientStatus || "sent",
        });

        existing.replaceWith(replacement);
        return;
      }
    }

    if (message.id) {
      const existingById = findMessageElementById(message.id);

      if (existingById) {
        existingById.replaceWith(buildMessageElement(message));
        return;
      }
    }

    const div = buildMessageElement(message);
    messagesBox.appendChild(div);

    const nearBottom =
      messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < 280;

    if (nearBottom) {
      trimRenderedMessagesIfNeeded();
    }
  }

async function createPrivateChat(userId) {
    const data = await api.request("/api/chats/private", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });

    ui.showToast("success", "Conversa criada.");
    ui.closeModal("usersPanel");
    await loadChats({ silent: true });
    await openChat(data.data);
  }

function renderUsersForPrivateChat() {
    const usersList = ui.el("usersList");
    if (!usersList) return;

    const search = ui.el("userSearch").value.toLowerCase().trim();
    const filtered = state.allUsers.filter((user) => {
      return (
        user.nome.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      );
    });

    usersList.replaceChildren();

    if (!filtered.length) {
      ui.setEmpty(usersList, "Nenhum usuário encontrado.");
      return;
    }

    const nodes = filtered.map((user) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "user-row";

      const avatar = document.createElement("div");
      avatar.className = "mini-avatar";

      if (user.avatarUrl) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = user.avatarUrl;
        img.alt = `Foto de ${user.nome}`;
        avatar.appendChild(img);
      } else {
        avatar.textContent = user.nome.charAt(0).toUpperCase();
      }

      const content = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = user.nome;

      const email = document.createElement("span");
      email.textContent = user.email;

      content.appendChild(name);
      content.appendChild(email);
      button.appendChild(avatar);
      button.appendChild(content);

      button.addEventListener("click", () => {
        createPrivateChat(user.id).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      return button;
    });

    appendNodesInChunks(usersList, nodes, {
      chunkSize: window.matchMedia && window.matchMedia("(max-width: 820px)").matches ? 16 : 32,
    });
  }
