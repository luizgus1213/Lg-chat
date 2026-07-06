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
        img.loading = "eager";
        img.decoding = "async";
        img.src = status.mediaUrl;
        img.alt = status.text || "Status";
        body.appendChild(img);
      }

      if (status.type === "video") {
        const video = document.createElement("video");
        video.className = "status-viewer-video";
        video.preload = "metadata";
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
