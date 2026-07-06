function syncUi() {
    const state = getState();
    const installButton = safeEl("installAppButton");
    const soundButton = safeEl("toggleSoundButton");
    const notificationsButton = safeEl("enableNotificationsButton");

    if (installButton) {
      const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0);
      const dismissedRecently = dismissedAt && Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 7;
      const shouldShow = Boolean(deferredInstallPrompt) && !state.isInstalledApp && !dismissedRecently;

      installButton.classList.toggle("hidden", !shouldShow);
    }

    if (soundButton) {
      soundButton.textContent = isSoundEnabled() ? "Som: ligado" : "Som: desligado";
      soundButton.classList.toggle("muted-action", !isSoundEnabled());
    }

    if (notificationsButton) {
      if (!("Notification" in window)) {
        notificationsButton.textContent = "Notificações indisponíveis";
        notificationsButton.disabled = true;
      } else if (Notification.permission === "granted" && areBrowserNotificationsEnabled()) {
        notificationsButton.textContent = "Notificações: ligadas";
        notificationsButton.disabled = false;
      } else if (Notification.permission === "denied") {
        notificationsButton.textContent = "Notificações bloqueadas";
        notificationsButton.disabled = true;
      } else if (!areBrowserNotificationsEnabled()) {
        notificationsButton.textContent = "Notificações: desligadas";
        notificationsButton.disabled = false;
      } else {
        notificationsButton.textContent = "Ativar notificações";
        notificationsButton.disabled = false;
      }
    }
  }

async function installApp() {
    if (!deferredInstallPrompt) {
      const ui = window.LGChat.ui;

      if (ui && typeof ui.showToast === "function") {
        ui.showToast("error", "Instalação ainda não disponível neste navegador.");
      }

      return;
    }

    deferredInstallPrompt.prompt();

    const result = await deferredInstallPrompt.userChoice;

    if (result.outcome !== "accepted") {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    }

    deferredInstallPrompt = null;
    syncUi();
  }

function bindUi() {
    if (hasBoundUi) {
      syncUi();
      return;
    }

    hasBoundUi = true;

    const installButton = safeEl("installAppButton");
    const soundButton = safeEl("toggleSoundButton");
    const notificationsButton = safeEl("enableNotificationsButton");

    if (installButton) {
      installButton.addEventListener("click", () => {
        installApp().catch((error) => {
          console.error("Erro ao instalar app:", error);
        });
      });
    }

    if (soundButton) {
      soundButton.addEventListener("click", () => {
        setSoundEnabled(!isSoundEnabled());
      });
    }

    if (notificationsButton) {
      notificationsButton.addEventListener("click", async () => {
        if (Notification.permission === "granted" && areBrowserNotificationsEnabled()) {
          setBrowserNotificationsEnabled(false);
          return;
        }

        await requestNotificationPermission();
      });
    }

    syncUi();
  }
