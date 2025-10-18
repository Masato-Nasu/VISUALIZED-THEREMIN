// sw.js — Motion Theremin PWA — 202510180427
const SW_VERSION = "theremin-20251018045954";
const CACHE = "pwa-cache-" + SW_VERSION;

// 必ず更新させたいアセット
const ASSETS = [
  "./",
  "./index.html?v=20251018045954",
  "./manifest.json?v=20251018045954",
  "./icon-192.png?v=20251018045954",
  "./icon-512.png?v=20251018045954"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE && caches.delete(k)));
    await self.clients.claim();
  })());
});

// fetch戦略:
// 1) audio/blob/Range等は素通り
// 2) 同一オリジンのGETは Stale-While-Revalidate
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return; // 非GETは素通り
  if (req.headers.get("range")) return; // Range リクエストは素通り
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/event-stream")) return;

  // 他オリジンは素通り
  if (url.origin !== location.origin) return;

  // audio はキャッシュしない（ユーザーが選ぶBGM対策）
  if (accept.includes("audio")) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((fresh) => {
      // 成功時のみキャッシュ更新
      if (fresh && fresh.ok && fresh.type !== "opaque") {
        cache.put(req, fresh.clone());
      }
      return fresh;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
