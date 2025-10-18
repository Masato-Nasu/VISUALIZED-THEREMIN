// sw.js v=3 (two-finger toggle support; cache bump)
const SW_VERSION="v3";
const CACHE="kbxaerial-"+SW_VERSION;
const ASSETS=[
  "./",
  "./index.html?v=3",
  "./manifest.json",
  "./style.css",
  "./app.js",
  "./icon-192.png",
  "./icon-512.png"
];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return res;
      }).catch(()=>caches.match("./index.html?v=3")))
    );
  }
});