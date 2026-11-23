/**
 * Shape-Shift Racer Service Worker
 * Provides offline shell caching and enables PWA standalone install.
 * Strictly ignores external AdSense, Analytics, and MediaPipe CDN calls.
 */

const CACHE_NAME = 'ssr-shell-v1';
const CORE_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/contact.html',
  '/credits.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept external AdSense or DoubleClick network calls
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML pages so updates are immediate
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for static local assets (JS, CSS, icons, images)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      });
    })
  );
});
