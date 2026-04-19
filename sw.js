/* eslint-disable no-restricted-globals */
/* v2: network-first for HTML so UI updates aren’t stuck behind cache-first index */
const CACHE = 'rps-shell-v2';
const ASSETS = [
  './style.css',
  './js/game.js',
  './js/auth.js',
  './manifest.webmanifest',
  './icons/rps.svg',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(k) {
          if (k !== CACHE) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const accept = event.request.headers.get('accept') || '';
  const isDocument =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    accept.indexOf('text/html') !== -1;

  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then(function(res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function(cache) {
              cache.put(event.request, copy);
            });
          }
          return res;
        })
        .catch(function() {
          return caches.match(event.request).then(function(c) {
            return c || caches.match('./index.html');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request);
    })
  );
});
