// sw.js v22.2 — normal distribution
const V='v22.2'; const CACHE='aerial-'+V;
const ASSETS=[
  './',
  './index.html?v=22.2',
  './hum-theremin-recorder.html?v=22.2',
  './manifest.json?v=22.2',
  './icon-192.png',
  './icon-512.png',
  './Chime.mp3'
];
self.addEventListener('install', e => {
  e.waitUntil((async()=>{
    const c = await caches.open(CACHE);
    for (const u of ASSETS){ try{ await c.add(u); }catch{} }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async()=>{
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // HTML は network-first（常に最新を優先取得）
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith((async()=>{
      try{
        const net = await fetch(e.request, {cache:'no-store'});
        const c = await caches.open(CACHE); c.put(e.request, net.clone());
        return net;
      }catch{
        const c = await caches.open(CACHE);
        return (await c.match(e.request)) || new Response('Offline', {status:503});
      }
    })());
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
