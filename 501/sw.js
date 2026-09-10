/* Il vecchio service worker della app "501".
   La app ora si chiama Dart e vive in /dart/: questo si disinstalla da solo,
   svuota le proprie cache e manda i client alla nuova pagina. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('501-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({type:'window'});
    clients.forEach((c) => c.navigate(new URL('../dart/', self.location).href).catch(() => {}));
  })());
});

/* finche' resta attivo non serve piu' nulla dalla cache */
self.addEventListener('fetch', (event) => { event.respondWith(fetch(event.request)); });
