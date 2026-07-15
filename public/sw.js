// ECHO service worker (production only — see src/main.tsx).
//
// Strategy matters here:
//  - Navigations / HTML: NETWORK-FIRST. index.html names the hashed JS/CSS
//    chunks, so serving it cache-first would pin users to an old build forever
//    (the previous version did exactly that). Cache is only a offline fallback.
//  - Hashed build assets: CACHE-FIRST. Their URLs change every build, so a hit
//    is always the right file and a new build simply misses and refetches.
// Anything not GET, cross-origin, or an API call is left alone entirely.

const CACHE_NAME = "echo-v2";
const PRECACHE = ["/", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isHashedAsset = (url) =>
  url.pathname.startsWith("/assets/") || /\.[0-9a-f]{8,}\.(js|css|woff2?)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;        // never touch cross-origin
  if (url.pathname.startsWith("/api/")) return;           // never cache the backend API
  if (url.pathname.startsWith("/functions/")) return;
  if (url.hostname.includes("supabase")) return;

  // HTML / navigations → network-first so new deploys actually land.
  const isNavigation =
    request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Hashed assets → cache-first (URL changes per build, so this can't go stale).
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else → network, falling back to cache when offline.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
