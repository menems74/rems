/* =========================================================================
   sw.js — service worker di Pranzo 2.0.

   L'app deve funzionare in aereo: si mette in cache tutto il guscio (HTML,
   CSS, moduli, dati iniziali, icone) e si serve prima dalla cache, poi si
   ricontrolla la rete in silenzio. Così l'avvio è immediato anche con una
   linea lenta, e l'aggiornamento arriva al lancio successivo.

   ATTENZIONE: cambiando un file dell'app bisogna alzare VERSIONE, altrimenti
   i telefoni continuano a servire la copia vecchia.
   ========================================================================= */

const VERSIONE = 'pranzo-v13';

/* Il guscio: tutto ciò che serve per aprire l'app senza rete. */
const GUSCIO = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/model.js',
  './js/planner.js',
  './js/shopping.js',
  './js/tastes.js',
  './js/ai-import.js',
  './js/backup.js',
  './js/photo.js',
  './js/ui/dom.js',
  './js/ui/home.js',
  './js/ui/week.js',
  './js/ui/catalog.js',
  './js/ui/dish.js',
  './js/ui/shopping.js',
  './js/ui/pantry.js',
  './js/ui/tastes.js',
  './js/ui/import.js',
  './js/ui/settings.js',
  './data/seed-ingredienti.json',
  './data/seed-piatti.json',
  './manifest.webmanifest',
  './icons/icona-192.png',
  './icons/icona-512.png',
  './icons/icona-maskable-192.png',
  './icons/icona-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSIONE);
    // uno per uno: se un file manca non deve fallire tutta l'installazione
    await Promise.all(GUSCIO.map(async (percorso) => {
      try { await cache.add(new Request(percorso, { cache: 'reload' })); }
      catch (e) { console.warn('[sw] non messo in cache:', percorso, e.message); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome.startsWith('pranzo-') && nome !== VERSIONE) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;

  const url = new URL(richiesta.url);
  if (url.origin !== self.location.origin) return;      // niente di esterno, qui non ce n'è

  // navigazione: si apre sempre, anche offline
  if (richiesta.mode === 'navigate') {
    evento.respondWith(daCacheePoiRete(new Request('./index.html'), richiesta));
    return;
  }

  evento.respondWith(daCacheePoiRete(richiesta, richiesta));
});

/**
 * Prima la cache (avvio immediato), poi la rete in sottofondo per la volta
 * dopo. Se non c'è né l'una né l'altra si risponde con un errore leggibile
 * invece di lasciare la pagina bianca.
 */
async function daCacheePoiRete(chiave, originale) {
  const cache = await caches.open(VERSIONE);
  const inCache = await cache.match(chiave, { ignoreSearch: true });

  const dallaRete = fetch(originale).then((risposta) => {
    if (risposta && risposta.ok && risposta.type === 'basic') {
      cache.put(chiave, risposta.clone()).catch(() => {});
    }
    return risposta;
  }).catch(() => null);

  if (inCache) return inCache;

  const risposta = await dallaRete;
  if (risposta) return risposta;

  return new Response(
    'Sei senza rete e questa parte non è ancora salvata sul telefono.',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}

/* L'app può chiedere di svuotare la cache (dalle impostazioni). */
self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'svuotaCache') {
    evento.waitUntil((async () => {
      for (const nome of await caches.keys()) {
        if (nome.startsWith('pranzo-')) await caches.delete(nome);
      }
      if (evento.source) evento.source.postMessage({ tipo: 'cacheSvuotata' });
    })());
  }
});
