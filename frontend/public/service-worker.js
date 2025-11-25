// File: frontend/public/service-worker.js

const CACHE_NAME = 'truekicks-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/Logo.png',
  // Tambahkan path ke assets penting lainnya jika perlu
];

// Event Install: Caching aset statis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Event Fetch: Menyajikan dari cache terlebih dahulu
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Ditemukan di cache
        }
        return fetch(event.request); // Ambil dari jaringan
      })
  );
});

// Event Activate: Membersihkan cache lama
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});