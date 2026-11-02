/* =========================================================================
   sw.js — service worker di Frame.

   Mette in cache il guscio dell'app (si apre anche senza rete). I video
   non passano mai di qui: vengono letti direttamente dal dispositivo.

   ATTENZIONE: cambiando un file dell'app bisogna alzare VERSIONE.
   ========================================================================= */

const VERSIONE = 'frame-v2';

const GUSCIO = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/motore.js',
  './js/mp4.js',
  './manifest.webmanifest',
  './icons/icona-192.png',
  './icons/icona-512.png',
  './icons/icona-maskable-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSIONE);
    await Promise.all(GUSCIO.map(async (p) => {
      try { await cache.add(new Request(p, { cache: 'reload' })); } catch (e) { /* si riprova al prossimo avvio */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('frame-') && k !== VERSIONE) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Prima la cache, poi aggiorna in silenzio dalla rete. */
self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  evento.respondWith((async () => {
    const cache = await caches.open(VERSIONE);
    const salvata = await cache.match(req, { ignoreSearch: true });
    const rete = fetch(req).then((r) => {
      if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
      return r;
    }).catch(() => null);
    if (salvata) { evento.waitUntil(rete); return salvata; }
    return (await rete) || Response.error();
  })());
});
