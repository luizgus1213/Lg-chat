const CACHE_NAME = "lgchat-shell-diagnostics-v2";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",

  "/css/base.css",
  "/css/buttons.css",
  "/css/responsive.css",

  "/features/auth/auth.css",
  "/features/sidebar/sidebar.css",
  "/features/status-panel/status-panel.css",
  "/features/chat-main/chat-main.css",
  "/features/info-panel/info-panel.css",
  "/features/users-panel/users-panel.css",
  "/features/group-panel/group-panel.css",
  "/features/toast/toast.css",

  "/js/partials.js",
  "/js/state.js",
  "/js/api.js",
  "/js/ui.js",
  "/js/performance.js",
  "/js/clientDiagnostics.js",
  "/js/lazyModules.js",
  "/js/prefetch.js",
  "/js/auth.js",
  "/js/chat.js",
  "/js/socket.js",
  "/js/call.js",
  "/js/status.js",
  "/js/pwa.js",
  "/js/version.js",
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
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith("lgchat-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        );
      })
      .then(() => self.clients.claim()),
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

function isHtmlRequest(request) {
  return request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => undefined);
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) return cached;

    if (isHtmlRequest(request)) {
      return cache.match("/index.html");
    }

    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => undefined);
      }

      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}

self.addEventListener("fetch", (event) => {
  if (shouldIgnoreRequest(event.request)) return;

  if (isHtmlRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
