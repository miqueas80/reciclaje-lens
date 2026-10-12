const PREFIX='nexus-recycle-industrial-';
const CACHE=PREFIX+'v3.1.0';
const ASSETS=['./','./index.html','./styles.css','./app.js','./catalog.js','./identify.js','./workflow.js','./lots.js','./db.js','./trust.js','./spectra.js','./spectral-lab.js','./serial.js','./quality-report.js','./station.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);const cached=await cache.match(r);
  if(cached)return cached;
  try{const res=await fetch(r);if(res.ok&&res.type==='basic'&&r.destination!=='document')await cache.put(r,res.clone());return res}
  catch{if(r.mode==='navigate')return cache.match('./index.html');return Response.error()}
 })());
});
