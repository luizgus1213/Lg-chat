function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.info("Service Worker registrado com sucesso.");
        registration.update().catch(() => undefined);

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;

          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        syncUi();
      })
      .catch((error) => {
        console.error("Erro ao registrar Service Worker:", error);
        syncUi();
      });
  });
}

function register() {
  registerServiceWorker();
  syncUi();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloadedForServiceWorkerUpdate) return;

    hasReloadedForServiceWorkerUpdate = true;
    window.location.reload();
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();

  deferredInstallPrompt = event;
  getState().canInstallApp = true;

  syncUi();
});

window.addEventListener("appinstalled", () => {
  getState().isInstalledApp = true;
  deferredInstallPrompt = null;

  syncUi();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    clearUnreadCount();
  }
});

window.addEventListener("focus", clearUnreadCount);

window.LGChat.pwa = {
  register,
  bindUi,
  installApp,
  syncUi,
  notifyNewMessage,
  requestNotificationPermission,
  playNotificationSound,
  unlockNotificationAudio,
  clearUnreadCount,
  incrementUnreadCount,
  setSoundEnabled,
  setBrowserNotificationsEnabled,
};
