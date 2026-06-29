const CACHE_NAME = "lgchat-shell-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/css/base.css",
  "/css/buttons.css",
  "/css/responsive.css",
  "/features/auth/auth.css",
  "/features/sidebar/sidebar.css",
  "/features/chat-main/chat-main.css",
  "/features/info-panel/info-panel.css",
  "/features/users-panel/users-panel.css",
  "/features/group-panel/group-panel.css",
  "/features/toast/toast.css",
  "/js/partials.js",
  "/js/state.js",
  "/js/api.js",
  "/js/ui.js",
  "/js/auth.js",
  "/js/chat.js",
  "/js/socket.js",
  "/js/pwa.js",
  "/js/main.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/badge-96.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => undefined);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }).then(() => self.clients.claim()),
  );
});

function shouldIgnoreRequest(request) {
  const url = new URL(request.url);

  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/socket.io/")) return true;
  if (url.pathname.startsWith("/uploads/")) return true;

  return false;
}

self.addEventListener("fetch", (event) => {
  if (shouldIgnoreRequest(event.request)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          return;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
