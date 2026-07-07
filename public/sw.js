const CACHE_NAME = "lgchat-shell-mobile-pwa-fix-v12";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",

  "/css/base.css",
  "/css/buttons.css",
  "/css/responsive.css",
  "/css/responsive-devices.css",
  "/css/visual-fix.css",

  "/features/auth/auth.css",
  "/features/sidebar/sidebar.css",
  "/features/chat-main/chat-main.css",
  "/features/toast/toast.css",

  "/features/auth/auth.html",
  "/features/sidebar/sidebar.html",
  "/features/chat-main/chat-main.html",
  "/features/info-panel/info-panel.html",
  "/features/users-panel/users-panel.html",
  "/features/group-panel/group-panel.html",
  "/features/global-inputs/global-inputs.html",
  "/features/toast/toast.html",

  "/js/partials.js",
  "/js/state.js",
  "/js/api.js",
  "/js/ui.js",
  "/js/performance.js",
  "/js/clientDiagnostics.js",
  "/js/deviceCompatibility.js",
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

  "/js/app-instalavel/estado-global.js",
  "/js/app-instalavel/som-notificacao.js",
  "/js/app-instalavel/sincronizar-interface.js",
  "/js/app-instalavel/service-worker.js",

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
  if (url.pathname.includes("chrome.devtools")) return true;

  return false;
}

function isHtmlRequest(request) {
  return request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
}

function shouldUseNetworkFirst(request) {
  const url = new URL(request.url);

  return (
    isHtmlRequest(request) ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".html")
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, {
      cache: "no-store",
    });

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

  if (shouldUseNetworkFirst(event.request)) {
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

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        const existingClient = clients.find((client) => {
          return "focus" in client && new URL(client.url).origin === self.location.origin;
        });

        if (existingClient) {
          existingClient.focus();
          existingClient.postMessage({
            type: "OPEN_CHAT_FROM_NOTIFICATION",
            chatId: event.notification.data?.chatId,
          });
          return;
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
