// sw.js stable 20251018052749
const CACHE="theremin-stable-20251018052749";
const ASSETS=["./","./index.html?v=20251018052749","./manifest.json?v=20251018052749","./icon-192.png?v=20251018052749","./icon-512.png?v=20251018052749"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>k!==CACHE && caches.delete(k)));await self.clients.claim();})())});
self.addEventListener("fetch",e=>{
  const r=e.request; const url=new URL(r.url);
  if(r.method!=="GET") return;
  if(r.headers.get("range")) return;
  if(url.origin!==location.origin) return;
  const acc=r.headers.get("accept")||"";
  if(acc.includes("audio")) return; // no caching for audio
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(r);
    const fresh=fetch(r).then(res=>{ if(res && res.ok && res.type!=="opaque") c.put(r,res.clone()); return res; }).catch(()=>hit);
    return hit||fresh;
  })());
});
