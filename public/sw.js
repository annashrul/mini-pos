const CACHE_NAME = "nusapos-v1";

// Install: skip waiting
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything, cache as fallback for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, API routes, SSE events
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-first strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && !url.pathname.startsWith("/_next/webpack")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || new Response("Offline", { status: 503 })))
  );
});
