/**
 * sw.js
 * ------
 * Minimal "app shell" service worker. Caches every file the app needs on
 * first load so the calculator keeps working offline (e.g. in airplane
 * mode) and launches instantly from the iPhone home screen.
 *
 * Bump CACHE_NAME whenever any cached file changes so users automatically
 * get the new version next time they're online.
 */

const CACHE_NAME = 'mortgage-calc-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/calculations.js',
  './js/amortization.js',
  './js/affordability.js',
  './js/refinance.js',
  './js/scenarios.js',
  './js/formatters.js',
  './js/export.js',
  './js/storage.js',
  './js/ui.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Install: pre-cache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell files, falling back to network.
// For navigation requests, fall back to the cached index.html if offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Cache a copy of newly-fetched same-origin assets for next time.
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
