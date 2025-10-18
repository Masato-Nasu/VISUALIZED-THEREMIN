// sw.js v6 — KB×AERIAL wrapper
const CACHE="kbxaerial-v6";
const ASSETS=[
  "./",
  "./index.html?v=6",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./kb/index.html",
  "./aerial/index.html",
  "./aerial/hum-theremin-recorder.html",
  "./aerial/manifest.json",
  "./aerial/sw.js",
  "./aerial/Chime.mp3"
];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) .then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url=new URL(e.request.url);
  if(url.origin===location.origin){
    if(url.pathname.endsWith(".html")||url.pathname==="/"){
      e.respondWith((async()=>{
        try{
          const net=await fetch(e.request,{cache:"no-store"});
          const c=await caches.open(CACHE); c.put(e.request, net.clone());
          return net;
        }catch{
          const c=await caches.open(CACHE);
          return (await c.match(e.request)) || new Response("Offline", {status:503});
        }
      })());
    }else{
      e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
    }
  }
});
