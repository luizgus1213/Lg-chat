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
    await loadStatuses({ force: true });
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
    await loadStatuses({ force: true });
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
      await loadStatuses({ force: true });
    } catch (error) {
      console.error("Erro ao marcar status como visualizado:", error);
    }
  }
