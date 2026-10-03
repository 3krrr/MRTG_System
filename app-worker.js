const CACHE='mirae-shell-3.0.0',ROOT=new URL('./',self.location.href);
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll([new URL('index.html',ROOT),new URL('icons/mirae-192.png',ROOT)]))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mirae-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const r=event.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==ROOT.origin||!u.pathname.startsWith(ROOT.pathname)||u.pathname.includes('/push/')||u.pathname.endsWith('/config.js')||u.pathname.includes('/downloads/'))return;
 const staticAsset=/\.(?:js|css|png|webmanifest)$/.test(u.pathname),navigation=r.mode==='navigate';if(!staticAsset&&!navigation)return;
 event.respondWith(fetch(r).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return response}).catch(async()=>{const cached=await caches.match(r);if(cached)return cached;if(navigation)return await caches.match(new URL('index.html',ROOT))||Response.error();return Response.error()}));
});
