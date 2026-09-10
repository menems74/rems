/* Service worker di Pranzo 2.0.
   Scope: la sola cartella /pranzo/ — il resto del portale non passa da qui.
   Rete-prima per le pagine, cache-prima per stili, script e icone. */

const VERSION = 'v1';
const CACHE = 'pranzo-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './ui.css',
  './core.js',
  './main.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map((url) => cache.add(new Request(url, {cache:'reload'})).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('pranzo-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if(event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const inScope = sameOrigin && url.pathname.startsWith(new URL('./', self.location).pathname);

  if(req.mode === 'navigate' || (inScope && req.destination === 'document')){
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        (await caches.open(CACHE)).put(req, fresh.clone());
        return fresh;
      } catch(err){
        return (await caches.match(req)) || caches.match('./index.html');
      }
    })());
    return;
  }

  if(inScope){
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if(hit){
        fetch(req).then((res) => res.ok && caches.open(CACHE).then((c) => c.put(req, res))).catch(() => {});
        return hit;
      }
      const res = await fetch(req);
      if(res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  if(!sameOrigin){
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if(res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch(err){
        const hit = await caches.match(req);
        if(hit) return hit;
        throw err;
      }
    })());
  }
});
