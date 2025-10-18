// sw.js v=1 — cache-busting & offline
const SW_VERSION = "v1";
const CACHE = "theremin-fusion-" + SW_VERSION;
const ASSETS = [
  "./",
  "./index.html?v=1",
  "./manifest.json",
  "./styles.css",
  "./app.js",
  "./icon-192.png",
  "./icon-512.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>!k.includes(SW_VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(()=>caches.match("./index.html?v=1")))
    );
  }
});
