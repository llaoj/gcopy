// GCopy static-shell Service Worker.
// Privacy rule: NEVER intercept or cache `/api/*` (clipboard payloads, auth,
// or SSE `/api/v1/clipboard/events`) or `/ping`. Only static UI shell assets
// are cached so GCopy can be installed as a standalone desktop/mobile PWA.
const CACHE_NAME = "gcopy-shell-v1";
const PRECACHE_URLS = [
  "/manifest.json",
  "/gcopy.svg",
  "/icon-192.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((staleKey) => caches.delete(staleKey)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/ping" ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // Hashed Next.js static bundles are immutable: serve from cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  // HTML navigations & public icons: network-first, falling back to cache offline.
  if (
    request.mode === "navigate" ||
    PRECACHE_URLS.includes(url.pathname) ||
    url.pathname.startsWith("/icon-")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          if (request.mode === "navigate") {
            const rootShell = await caches.match("/");
            if (rootShell) {
              return rootShell;
            }
          }
          throw new Error("Network unavailable");
        }),
    );
  }
});
