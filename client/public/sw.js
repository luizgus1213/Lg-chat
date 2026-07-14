const CACHE_PREFIX = "lgchat-react-shell";
const CACHE_VERSION = "v2";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
  "/apple-touch-icon.png",
  "/badge-96.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const results = await Promise.allSettled(
        APP_SHELL.map(async (assetPath) => {
          const response = await fetch(assetPath, {
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(
              `Não foi possível armazenar ${assetPath}: HTTP ${response.status}`,
            );
          }

          await cache.put(assetPath, response);
        }),
      );

      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        console.warn(
          "[Service Worker] Alguns arquivos do app shell não foram armazenados.",
          failures,
        );
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(`${CACHE_PREFIX}-`) &&
              cacheName !== CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );

      await self.clients.claim();
    })(),
  );
});

function isPrivateRequest(request) {
  const url = new URL(request.url);

  return (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname === "/health"
  );
}

async function navigationResponse(request) {
  try {
    return await fetch(request, {
      cache: "no-store",
    });
  } catch {
    const cachedIndex = await caches.match("/index.html");

    if (cachedIndex) {
      return cachedIndex;
    }

    return new Response(
      "O LG Chat está temporariamente indisponível e esta página não está no cache.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }
}

async function staticResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok && networkResponse.type === "basic") {
    await cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (isPrivateRequest(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  const url = new URL(request.url);

  const cacheableStaticPaths = new Set([
    "/favicon.svg",
    "/manifest.webmanifest",
    "/icon-192.png",
    "/icon-512.png",
    "/maskable-512.png",
    "/apple-touch-icon.png",
    "/badge-96.png",
  ]);

  if (
    url.pathname.startsWith("/assets/") ||
    cacheableStaticPaths.has(url.pathname)
  ) {
    event.respondWith(staticResponse(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
