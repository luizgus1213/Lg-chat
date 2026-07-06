function renderUsersForGroup() {
    const groupUsersList = ui.el("groupUsersList");
    if (!groupUsersList) return;

    const searchInput = safeEl("groupUserSearch");
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const users = search
      ? state.allUsers.filter((user) => {
          return (
            user.nome.toLowerCase().includes(search) ||
            user.email.toLowerCase().includes(search)
          );
        })
      : state.allUsers;

    groupUsersList.replaceChildren();

    if (!users.length) {
      ui.setEmpty(groupUsersList, "Nenhum usuário disponível.");
      return;
    }

    const nodes = users.map((user) => {
      const label = document.createElement("label");
      label.className = "check-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = user.id;
      checkbox.className = "group-user-checkbox";

      const span = document.createElement("span");
      span.textContent = `${user.nome} • ${user.email}`;

      label.appendChild(checkbox);
      label.appendChild(span);

      return label;
    });

    appendNodesInChunks(groupUsersList, nodes, {
      chunkSize: window.matchMedia && window.matchMedia("(max-width: 820px)").matches ? 18 : 36,
    });
  }

async function createGroup() {
    const button = ui.el("createGroupButton");
    if (state.isCreateGroupLoading) return;

    try {
      state.isCreateGroupLoading = true;
      button.disabled = true;
      button.textContent = "Criando grupo...";

      const name = ui.el("groupName").value.trim();
      const description = ui.el("groupDescription").value.trim();

      const memberIds = Array.from(
        document.querySelectorAll(".group-user-checkbox:checked"),
      ).map((input) => Number(input.value));

      const data = await api.request("/api/chats/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          memberIds,
        }),
      });

      ui.el("groupName").value = "";
      ui.el("groupDescription").value = "";

      document.querySelectorAll(".group-user-checkbox:checked").forEach((input) => {
        input.checked = false;
      });

      ui.closeModal("groupPanel");
      ui.showToast("success", "Grupo criado com sucesso.");
      await loadChats({ silent: true });
      await openChat(data.data);
    } finally {
      state.isCreateGroupLoading = false;
      button.disabled = false;
      button.textContent = "Criar grupo";
    }
  }
