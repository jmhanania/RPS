/* eslint-disable no-restricted-globals */
const CACHE = 'rps-shell-v1';
const ASSETS = [
  './index.html',
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

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return (
        cached ||
        fetch(event.request).then(function(res) {
          return res;
        })
      );
    })
  );
});
