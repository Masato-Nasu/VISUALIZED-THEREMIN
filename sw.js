
// sw.js v1
const CACHE="kbxaerial-scratch-v1";
const ASSETS=["./","./index.html?v=1","./manifest.json","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) .then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{ if(e.request.method!=="GET") return; e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))); });
