function syncUi() {
  const state = getState();
  const installButton = safeEl("installAppButton");
  const soundButton = safeEl("toggleSoundButton");
  const notificationsButton = safeEl("enableNotificationsButton");

  state.isInstalledApp = isStandaloneApp();

  if (installButton) {
    /*
      Antes o botão só aparecia quando beforeinstallprompt disparava.
      Em vários celulares esse evento não aparece imediatamente, então deixamos
      a opção visível e mostramos instrução manual quando o navegador não expõe prompt.
    */
    const shouldShowInstallButton = !state.isInstalledApp;

    installButton.classList.toggle("hidden", !shouldShowInstallButton);
    installButton.disabled = false;
    installButton.textContent = deferredInstallPrompt ? "Instalar app" : "Instalar app";
    installButton.title = deferredInstallPrompt
      ? "Instalar LG Chat neste aparelho"
      : "Abrir instruções de instalação neste navegador";
  }

  if (soundButton) {
    soundButton.textContent = isSoundEnabled() ? "Som: ligado" : "Som: desligado";
    soundButton.classList.toggle("muted-action", !isSoundEnabled());
    soundButton.disabled = false;
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

function showManualInstallInstructions() {
  const ui = window.LGChat.ui;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  let message = "Para instalar, use o menu do navegador e escolha Instalar app.";

  if (isIOS) {
    message = "No iPhone/iPad, abra no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.";
  } else if (isAndroid) {
    message = "No Android, toque no menu ⋮ do Chrome/Edge e escolha Instalar app ou Adicionar à tela inicial.";
  }

  if (ui && typeof ui.showToast === "function") {
    ui.showToast("success", message);
  } else {
    alert(message);
  }
}

async function installApp() {
  if (!deferredInstallPrompt) {
    showManualInstallInstructions();
    syncUi();
    return;
  }

  try {
    deferredInstallPrompt.prompt();

    await deferredInstallPrompt.userChoice;
  } finally {
    deferredInstallPrompt = null;
    syncUi();
  }
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
    soundButton.addEventListener("click", async () => {
      const nextValue = !isSoundEnabled();

      if (nextValue && typeof unlockNotificationAudio === "function") {
        await unlockNotificationAudio();
      }

      setSoundEnabled(nextValue);

      if (nextValue && typeof playNotificationSound === "function") {
        await playNotificationSound();
      }
    });
  }

  if (notificationsButton) {
    notificationsButton.addEventListener("click", async () => {
      if (!("Notification" in window)) return;

      if (Notification.permission === "granted" && areBrowserNotificationsEnabled()) {
        setBrowserNotificationsEnabled(false);
        return;
      }

      await requestNotificationPermission();
    });
  }

  syncUi();
}
