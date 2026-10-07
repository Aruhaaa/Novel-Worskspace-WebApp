/*
 * Novelist Workspace: lets the app open without a connection.
 * It keeps the app's own files (never the database or other websites) and serves them when the network is gone.
 */
const CACHE = 'novelist-app-v1';

self.addEventListener('install', (event) => {
  // Keep the page itself so it can open offline; the other files are kept as they are used
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(self.registration.scope))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('novelist-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only the app's own files. The database, fonts from other sites and ads are left alone.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Network first, so a new release is picked up straight away; the kept page is only for when the network is gone
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(self.registration.scope, copy));
          }
          return response;
        })
        .catch(() => caches.match(self.registration.scope).then((hit) => hit || Response.error()))
    );
    return;
  }

  // Built files carry a fingerprint in their name, so a kept copy is never out of date
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
