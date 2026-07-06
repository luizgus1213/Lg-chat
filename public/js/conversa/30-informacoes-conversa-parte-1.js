/* Corrigido: função loadChatInfo completa neste arquivo. */

async function loadChatInfo(chatId) {
    const [chatData, membersData] = await Promise.all([
      api.request(`/api/chats/${chatId}`),
      api.request(`/api/chats/${chatId}/members`),
    ]);

    const chat = chatData.data;
    const members = membersData.data || [];
    const chatInfoBox = ui.el("chatInfoBox");

    if (state.selectedChat && state.selectedChat.id === chat.id) {
      state.selectedChat = { ...state.selectedChat, ...chat };
      updateChatHeader(state.selectedChat);
    }

    chatInfoBox.replaceChildren();

    const profile = document.createElement("div");
    profile.className = "group-profile";

    const avatar = document.createElement("button");
    avatar.type = "button";
    avatar.className = "group-profile-avatar";

    if (chat.canManageGroup === true) {
      avatar.classList.add("editable");
      avatar.title = "Alterar foto do grupo";
    }

    if (chat.avatarUrl) {
      const img = document.createElement("img");
      img.src = chat.avatarUrl;
      img.alt = `Imagem de ${getChatName(chat)}`;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getChatName(chat).charAt(0).toUpperCase();
    }

    if (chat.canManageGroup === true) {
      const overlay = document.createElement("span");
      overlay.className = "avatar-edit-overlay";
      overlay.textContent = "Alterar foto";
      avatar.appendChild(overlay);
      avatar.addEventListener("click", () => openGroupAvatarPicker(chat.id));
    }

    const title = document.createElement("h4");
    title.textContent = getChatName(chat);

    const type = document.createElement("p");
    type.className = "muted";
    type.textContent =
      chat.type === "group"
        ? `Grupo • sua permissão: ${chat.myRole || "member"}`
        : formatUserStatus(chat.privateUser);

    profile.appendChild(avatar);
    profile.appendChild(title);
    profile.appendChild(type);
    chatInfoBox.appendChild(profile);

    const descriptionBox = document.createElement("div");
    descriptionBox.className = "group-section";

    const descriptionTitle = document.createElement("h4");
    descriptionTitle.textContent = "Descrição";

    const description = document.createElement("p");
    description.textContent =
      chat.type === "private"
        ? chat.privateUser?.about || "Disponível"
        : chat.description || "Esse grupo ainda não possui descrição.";

    descriptionBox.appendChild(descriptionTitle);
    descriptionBox.appendChild(description);
    chatInfoBox.appendChild(descriptionBox);

    if (chat.type === "private") {
      const privacyBox = document.createElement("div");
      privacyBox.className = "privacy-action-zone";

      const privacyTitle = document.createElement("h4");
      privacyTitle.textContent = "Privacidade";

      const privacyText = document.createElement("p");
      privacyText.textContent =
        "Controle esse contato e o histórico dessa conversa somente na sua conta.";

      const actions = document.createElement("div");
      actions.className = "privacy-action-grid";

      const blockButton = document.createElement("button");
      blockButton.type = "button";
      blockButton.className = chat.block?.blockedByMe ? "neutral-button" : "danger-button";
      blockButton.textContent = chat.block?.blockedByMe
        ? "Desbloquear contato"
        : "Bloquear contato";
      blockButton.addEventListener("click", () => {
        updateBlockContact(chat.id, !chat.block?.blockedByMe).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "warning-button";
      clearButton.textContent = "Limpar conversa";
      clearButton.addEventListener("click", () => {
        clearCurrentChat(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger-button";
      deleteButton.textContent = "Apagar conversa para mim";
      deleteButton.addEventListener("click", () => {
        deleteCurrentChatForMe(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      actions.appendChild(blockButton);
      actions.appendChild(clearButton);
      actions.appendChild(deleteButton);

      privacyBox.appendChild(privacyTitle);
      privacyBox.appendChild(privacyText);
      privacyBox.appendChild(actions);

      if (chat.block?.blockedByMe || chat.block?.blockedMe) {
        const note = document.createElement("p");
        note.className = "blocked-contact-note";
        note.textContent = getBlockNoticeText(chat);
        privacyBox.appendChild(note);
      }

      chatInfoBox.appendChild(privacyBox);
    }

    const membersBox = document.createElement("div");
    membersBox.className = "group-section";

    const membersTitle = document.createElement("h4");
    membersTitle.textContent = `Membros (${members.length})`;

    const list = document.createElement("div");
    list.className = "member-list";

    members.forEach((member) => {
      const item = document.createElement("div");
      item.className = "member-item";

      const user = member.user || {};
      const miniAvatar = document.createElement("div");
      miniAvatar.className = "mini-avatar";

      if (user.avatarUrl) {
        const img = document.createElement("img");
        img.src = user.avatarUrl;
        img.alt = `Foto de ${user.nome || "usuário"}`;
        miniAvatar.appendChild(img);
      } else {
        miniAvatar.textContent = (user.nome || "?").charAt(0).toUpperCase();
      }

      const content = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = user.nome || `Usuário ${member.userId}`;

      const role = document.createElement("span");
      role.textContent = formatMemberRole(member.role);

      content.appendChild(name);
      content.appendChild(role);
      item.appendChild(miniAvatar);
      item.appendChild(content);
      list.appendChild(item);
    });

    membersBox.appendChild(membersTitle);
    membersBox.appendChild(list);
    chatInfoBox.appendChild(membersBox);

    if (chat.type === "group") {
      const leaveBox = document.createElement("div");
      leaveBox.className = "group-action-zone";

      const leaveTitle = document.createElement("h4");
      leaveTitle.textContent = "Participação";

      const leaveText = document.createElement("p");
      leaveText.textContent =
        "Você pode sair desse grupo. Depois disso, não verá mais as mensagens novas.";

      const leaveButton = document.createElement("button");
      leaveButton.type = "button";
      leaveButton.className = "warning-button";
      leaveButton.textContent = "Sair do grupo";
      leaveButton.addEventListener("click", () => {
        leaveCurrentGroup(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      leaveBox.appendChild(leaveTitle);
      leaveBox.appendChild(leaveText);
      leaveBox.appendChild(leaveButton);
      chatInfoBox.appendChild(leaveBox);
    }

    if (chat.type === "group" && chat.canDeleteGroup === true) {
      const dangerBox = document.createElement("div");
      dangerBox.className = "group-danger-zone";

      const dangerTitle = document.createElement("h4");
      dangerTitle.textContent = "Zona perigosa";

      const dangerText = document.createElement("p");
      dangerText.textContent =
        "Excluir o grupo remove as mensagens e os membros desse grupo.";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger-button";
      deleteButton.textContent = "Excluir grupo";
      deleteButton.addEventListener("click", () => {
        deleteCurrentGroup(chat.id, getChatName(chat)).catch((error) =>
          ui.showToast("error", error.message),
        );
      });

      dangerBox.appendChild(dangerTitle);
      dangerBox.appendChild(dangerText);
      dangerBox.appendChild(deleteButton);
      chatInfoBox.appendChild(dangerBox);
    }
  }
