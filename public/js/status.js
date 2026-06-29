(() => {
  window.LGChat = window.LGChat || {};

  const state = window.LGChat.state;
  const ui = window.LGChat.ui;

  const VIEW_DURATION_MS = 6500;

  function safeEl(id) {
    return document.getElementById(id);
  }

  async function request(path, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        "Erro ao executar ação de status.";

      throw new Error(message);
    }

    return payload?.data;
  }

  function getInitial(user) {
    return (user?.nome || "?").charAt(0).toUpperCase();
  }

  function fillAvatar(element, user, seen = false) {
    if (!element) return;

    element.replaceChildren();
    element.classList.toggle("seen", Boolean(seen));

    if (user?.avatarUrl) {
      const img = document.createElement("img");
      img.src = user.avatarUrl;
      img.alt = `Foto de ${user.nome || "usuário"}`;
      element.appendChild(img);
      return;
    }

    element.textContent = getInitial(user);
  }

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) return "Agora";
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) return `${diffHours} h atrás`;

    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

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

  function createStatusRow(group, isMine) {
    const lastStatus = group.statuses[group.statuses.length - 1];

    const button = document.createElement("button");
    button.type = "button";
    button.className = "status-row";

    const avatar = document.createElement("div");
    avatar.className = "status-row-avatar";
    fillAvatar(avatar, group.user, !group.hasUnseen);

    const body = document.createElement("div");
    body.className = "status-row-body";

    const name = document.createElement("strong");
    name.textContent = isMine ? "Meu status" : group.user?.nome || "Contato";

    const subtitle = document.createElement("span");
    subtitle.textContent = lastStatus
      ? `${formatTime(lastStatus.createdAt)} • ${getStatusPreview(lastStatus)}`
      : "Sem atualizações";

    body.appendChild(name);
    body.appendChild(subtitle);

    const count = document.createElement("span");
    count.className = "status-row-count";
    count.textContent = `${group.statuses.length}`;

    button.appendChild(avatar);
    button.appendChild(body);
    button.appendChild(count);

    button.addEventListener("click", () => {
      openStatusViewer(group.user.id);
    });

    return button;
  }

  function renderStatusPanel() {
    const myList = safeEl("myStatusList");
    const recentList = safeEl("recentStatusList");

    if (!myList || !recentList) return;

    myList.replaceChildren();
    recentList.replaceChildren();

    const myGroup = getMyGroup();

    if (myGroup) {
      myList.appendChild(createStatusRow(myGroup, true));
    } else {
      const empty = document.createElement("div");
      empty.className = "status-list-empty";
      empty.textContent = "Você ainda não publicou nenhum status.";
      myList.appendChild(empty);
    }

    const otherGroups = getOtherGroups();

    if (!otherGroups.length) {
      const empty = document.createElement("div");
      empty.className = "status-list-empty";
      empty.textContent = "Nenhum status recente dos seus contatos.";
      recentList.appendChild(empty);
      return;
    }

    for (const group of otherGroups) {
      recentList.appendChild(createStatusRow(group, false));
    }
  }

  async function loadStatuses() {
    const groups = await request("/api/status");

    state.statusGroups = Array.isArray(groups) ? groups : [];

    renderSidebarStatuses();
    renderStatusPanel();

    return state.statusGroups;
  }

  function openStatusPanel() {
    ui.openModal("statusPanel");

    loadStatuses().catch((error) => {
      ui.showToast("error", error.message);
    });
  }

  function closeStatusPanel() {
    ui.closeModal("statusPanel");
  }

  async function createTextStatus() {
    const input = safeEl("statusTextInput");
    const text = input?.value?.trim();

    if (!text) {
      ui.showToast("error", "Digite algo para publicar no status.");
      return;
    }

    await request("/api/status/text", {
      method: "POST",
      body: JSON.stringify({
        text,
        backgroundColor: "#00a884",
      }),
    });

    input.value = "";

    ui.showToast("success", "Status publicado.");
    await loadStatuses();
  }

  async function createMediaStatus(file) {
    if (!file) return;

    const captionInput = safeEl("statusMediaCaptionInput");
    const formData = new FormData();

    formData.append("media", file);

    if (captionInput?.value?.trim()) {
      formData.append("text", captionInput.value.trim());
    }

    await request("/api/status/media", {
      method: "POST",
      body: formData,
    });

    if (captionInput) captionInput.value = "";

    ui.showToast("success", "Status publicado.");
    await loadStatuses();
  }

  function findGroupIndexByUserId(userId) {
    return (state.statusGroups || []).findIndex((group) => {
      return Number(group.user?.id) === Number(userId);
    });
  }

  function getCurrentViewerData() {
    const viewer = state.statusViewer;

    if (!viewer) return null;

    const group = state.statusGroups[viewer.groupIndex];
    const status = group?.statuses?.[viewer.statusIndex];

    if (!group || !status) return null;

    return {
      group,
      status,
    };
  }

  function stopStatusTimer() {
    if (state.statusAutoTimer) {
      clearTimeout(state.statusAutoTimer);
      state.statusAutoTimer = null;
    }

    if (state.statusProgressTimer) {
      clearInterval(state.statusProgressTimer);
      state.statusProgressTimer = null;
    }
  }

  function startStatusTimer() {
    stopStatusTimer();

    const progress = safeEl("statusViewerProgressBar");
    const startedAt = Date.now();

    if (progress) {
      progress.style.width = "0%";
    }

    state.statusProgressTimer = setInterval(() => {
      const percent = Math.min(100, ((Date.now() - startedAt) / VIEW_DURATION_MS) * 100);

      if (progress) {
        progress.style.width = `${percent}%`;
      }
    }, 120);

    state.statusAutoTimer = setTimeout(() => {
      nextStatus();
    }, VIEW_DURATION_MS);
  }

  async function markCurrentStatusViewed(status) {
    if (!status || !state.currentUser) return;
    if (Number(status.userId) === Number(state.currentUser.id)) return;
    if (status.viewedByMe) return;

    try {
      await request(`/api/status/${status.id}/view`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      status.viewedByMe = true;
      await loadStatuses();
    } catch (error) {
      console.error("Erro ao marcar status como visualizado:", error);
    }
  }

  function renderStatusViewer() {
    const data = getCurrentViewerData();

    if (!data) {
      closeStatusViewer();
      return;
    }

    const { group, status } = data;

    const avatar = safeEl("statusViewerAvatar");
    const name = safeEl("statusViewerName");
    const time = safeEl("statusViewerTime");
    const body = safeEl("statusViewerBody");
    const deleteButton = safeEl("deleteStatusButton");
    const showViewsButton = safeEl("showStatusViewsButton");
    const viewsList = safeEl("statusViewsList");

    fillAvatar(avatar, group.user, false);

    if (name) name.textContent = group.user?.nome || "Status";
    if (time) time.textContent = formatTime(status.createdAt);

    if (deleteButton) {
      deleteButton.classList.toggle(
        "hidden",
        !state.currentUser || Number(status.userId) !== Number(state.currentUser.id),
      );
    }

    if (showViewsButton) {
      const isMine =
        state.currentUser && Number(status.userId) === Number(state.currentUser.id);

      showViewsButton.classList.toggle("hidden", !isMine);
      showViewsButton.textContent = `👁️ ${status.viewCount || 0} visualização(ões)`;
    }

    if (viewsList) {
      viewsList.classList.add("hidden");
      viewsList.replaceChildren();
    }

    if (body) {
      body.replaceChildren();

      if (status.type === "text") {
        const text = document.createElement("div");
        text.className = "status-viewer-text";
        text.textContent = status.text || "";
        text.style.background = status.backgroundColor || "#00a884";
        body.appendChild(text);
      }

      if (status.type === "image") {
        const img = document.createElement("img");
        img.className = "status-viewer-image";
        img.src = status.mediaUrl;
        img.alt = status.text || "Status";
        body.appendChild(img);
      }

      if (status.type === "video") {
        const video = document.createElement("video");
        video.className = "status-viewer-video";
        video.src = status.mediaUrl;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        body.appendChild(video);
      }

      if (status.type !== "text" && status.text) {
        const caption = document.createElement("p");
        caption.className = "status-viewer-caption";
        caption.textContent = status.text;
        body.appendChild(caption);
      }
    }

    markCurrentStatusViewed(status);
    startStatusTimer();
  }

  function openStatusViewer(userId) {
    const groupIndex = findGroupIndexByUserId(userId);

    if (groupIndex < 0) return;

    state.statusViewer = {
      groupIndex,
      statusIndex: 0,
    };

    safeEl("statusViewer")?.classList.remove("hidden");
    renderStatusViewer();
  }

  function closeStatusViewer() {
    stopStatusTimer();

    state.statusViewer = null;

    safeEl("statusViewer")?.classList.add("hidden");
    safeEl("statusViewerBody")?.replaceChildren();
  }

  function nextStatus() {
    const viewer = state.statusViewer;

    if (!viewer) return;

    const group = state.statusGroups[viewer.groupIndex];

    if (!group) {
      closeStatusViewer();
      return;
    }

    if (viewer.statusIndex < group.statuses.length - 1) {
      viewer.statusIndex += 1;
      renderStatusViewer();
      return;
    }

    if (viewer.groupIndex < state.statusGroups.length - 1) {
      viewer.groupIndex += 1;
      viewer.statusIndex = 0;
      renderStatusViewer();
      return;
    }

    closeStatusViewer();
  }

  function previousStatus() {
    const viewer = state.statusViewer;

    if (!viewer) return;

    if (viewer.statusIndex > 0) {
      viewer.statusIndex -= 1;
      renderStatusViewer();
      return;
    }

    if (viewer.groupIndex > 0) {
      viewer.groupIndex -= 1;
      const group = state.statusGroups[viewer.groupIndex];

      viewer.statusIndex = Math.max(0, (group?.statuses?.length || 1) - 1);
      renderStatusViewer();
    }
  }

  async function deleteCurrentStatus() {
    const data = getCurrentViewerData();

    if (!data) return;

    const confirmed = window.confirm("Apagar este status?");

    if (!confirmed) return;

    await request(`/api/status/${data.status.id}`, {
      method: "DELETE",
    });

    ui.showToast("success", "Status apagado.");
    await loadStatuses();
    closeStatusViewer();
  }

  async function toggleViewsList() {
    const data = getCurrentViewerData();
    const list = safeEl("statusViewsList");

    if (!data || !list) return;

    if (!list.classList.contains("hidden")) {
      list.classList.add("hidden");
      return;
    }

    const views = await request(`/api/status/${data.status.id}/views`);

    list.replaceChildren();

    if (!views.length) {
      const empty = document.createElement("div");
      empty.className = "status-list-empty";
      empty.textContent = "Ninguém visualizou ainda.";
      list.appendChild(empty);
    }

    for (const view of views) {
      const row = document.createElement("div");
      row.className = "status-view-row";

      const avatar = document.createElement("div");
      avatar.className = "status-view-row-avatar";
      fillAvatar(avatar, view.viewer, false);

      const name = document.createElement("strong");
      name.textContent = view.viewer?.nome || "Usuário";

      const time = document.createElement("span");
      time.textContent = formatTime(view.viewedAt);

      row.appendChild(avatar);
      row.appendChild(name);
      row.appendChild(time);

      list.appendChild(row);
    }

    list.classList.remove("hidden");
  }

  function bindUi() {
    safeEl("openStatusPanelButton")?.addEventListener("click", openStatusPanel);
    safeEl("closeStatusPanelButton")?.addEventListener("click", closeStatusPanel);

    safeEl("createTextStatusButton")?.addEventListener("click", () => {
      createTextStatus().catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    safeEl("pickStatusMediaButton")?.addEventListener("click", () => {
      safeEl("statusMediaInput")?.click();
    });

    safeEl("statusMediaInput")?.addEventListener("change", (event) => {
      const input = event.target;
      const file = input.files && input.files[0];

      input.value = "";

      if (!file) return;

      createMediaStatus(file).catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    safeEl("closeStatusViewerButton")?.addEventListener("click", closeStatusViewer);
    safeEl("nextStatusButton")?.addEventListener("click", nextStatus);
    safeEl("previousStatusButton")?.addEventListener("click", previousStatus);

    safeEl("deleteStatusButton")?.addEventListener("click", () => {
      deleteCurrentStatus().catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    safeEl("showStatusViewsButton")?.addEventListener("click", () => {
      toggleViewsList().catch((error) => {
        ui.showToast("error", error.message);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      if (!safeEl("statusViewer")?.classList.contains("hidden")) {
        closeStatusViewer();
        return;
      }

      if (!safeEl("statusPanel")?.classList.contains("hidden")) {
        closeStatusPanel();
      }
    });

    renderSidebarStatuses();
  }

  window.LGChat.status = {
    bindUi,
    loadStatuses,
    openStatusPanel,
    closeStatusPanel,
    openStatusViewer,
    closeStatusViewer,
    renderSidebarStatuses,
  };
})();
