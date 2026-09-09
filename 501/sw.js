/* Service worker della app 501.
   Scope: la sola cartella /501/ — le altre pagine del portale non passano da qui.
   Strategia: rete-prima per l'HTML (le modifiche si vedono subito), cache-prima
   per icone e manifest, best-effort per i font esterni. */

const VERSION = 'v1';
const CACHE = '501-' + VERSION;

// il guscio minimo per partire offline
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll fallisce in blocco se manca un file: qui ognuno va per conto suo
    await Promise.all(SHELL.map((url) => cache.add(new Request(url, {cache: 'reload'})).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('501-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const inScope = sameOrigin && url.pathname.startsWith(new URL('./', self.location).pathname);

  // navigazioni e HTML: prima la rete, la cache come rete di sicurezza
  if (req.mode === 'navigate' || (inScope && req.destination === 'document')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const hit = await caches.match(req);
        return hit || caches.match('./index.html');
      }
    })());
    return;
  }

  // risorse della app: cache-prima, con aggiornamento in sottofondo
  if (inScope) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) {
        fetch(req).then((res) => res.ok && caches.open(CACHE).then((c) => c.put(req, res))).catch(() => {});
        return hit;
      }
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // font e librerie esterne: se la rete non c'e', si prova la copia salvata
  if (!sameOrigin) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await caches.match(req);
        if (hit) return hit;
        throw err;
      }
    })());
  }
});
