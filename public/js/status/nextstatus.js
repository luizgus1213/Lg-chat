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
    await loadStatuses({ force: true });
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
