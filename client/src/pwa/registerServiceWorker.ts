import { dispatchRecoverableError } from "../api/apiEvents";

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              dispatchRecoverableError({
                code: "APP_UPDATE_AVAILABLE",
                message:
                  "Uma atualização do LG Chat está disponível. Recarregue quando puder.",
              });
            }
          });
        });
      })
      .catch(() => undefined);
  });
}
