function getStatusPreview(status) {
    if (!status) return "Status";

    if (status.type === "text") return status.text || "Texto";
    if (status.type === "image") return status.text ? `Foto: ${status.text}` : "Foto";
    if (status.type === "video") return status.text ? `Vídeo: ${status.text}` : "Vídeo";

    return "Status";
  }

function getMyGroup() {
    if (!state.currentUser) return null;

    return (state.statusGroups || []).find((group) => {
      return Number(group.user?.id) === Number(state.currentUser.id);
    }) || null;
  }

function getOtherGroups() {
    if (!state.currentUser) return state.statusGroups || [];

    return (state.statusGroups || []).filter((group) => {
      return Number(group.user?.id) !== Number(state.currentUser.id);
    });
  }

function renderSidebarStatuses() {
    const myAvatar = safeEl("myStatusAvatar");
    const myText = safeEl("myStatusText");
    const contactsList = safeEl("statusContactsList");

    const myGroup = getMyGroup();

    if (myAvatar) {
      fillAvatar(myAvatar, state.currentUser, false);
      if (!myGroup && !state.currentUser?.avatarUrl) myAvatar.textContent = "+";
    }

    if (myText) {
      myText.textContent = myGroup
        ? `${myGroup.statuses.length} atualização(ões) publicada(s)`
        : "Toque para publicar ou ver status";
    }

    if (!contactsList) return;

    contactsList.replaceChildren();

    const groups = getOtherGroups().slice(0, 4);

    for (const group of groups) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "status-contact-button";

      const avatar = document.createElement("div");
      avatar.className = "status-contact-avatar";
      fillAvatar(avatar, group.user, !group.hasUnseen);

      const body = document.createElement("div");
      body.className = "status-contact-text";

      const name = document.createElement("strong");
      name.textContent = group.user?.nome || "Contato";

      const lastStatus = group.statuses[group.statuses.length - 1];
      const preview = document.createElement("span");
      preview.textContent = lastStatus
        ? `${formatTime(lastStatus.createdAt)} • ${getStatusPreview(lastStatus)}`
        : "Status";

      body.appendChild(name);
      body.appendChild(preview);

      button.appendChild(avatar);
      button.appendChild(body);

      if (group.hasUnseen) {
        const dot = document.createElement("span");
        dot.className = "status-contact-dot";
        button.appendChild(dot);
      }

      button.addEventListener("click", () => {
        openStatusViewer(group.user.id);
      });

      contactsList.appendChild(button);
    }
  }
