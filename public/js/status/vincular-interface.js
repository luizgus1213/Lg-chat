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
      if (!validateStatusMediaFile(file)) return;

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
