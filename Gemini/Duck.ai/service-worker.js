const CACHE_NAME = 'recomp-cache-v1';
const FILES_TO_CACHE = [
'/index.html',
'/manifest.json',
'/service-worker.js'
// Add any external assets here, e.g. '/styles.css', '/app.js', '/icons/192.png'
];

self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
);
self.skipWaiting();
});

self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then(keys => Promise.all(
keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
))
);
self.clients.claim();
});

self.addEventListener('fetch', (event) => {
// Try cache first, then network, and update cache with network response
event.respondWith(
caches.match(event.request).then(cached => {
if (cached) return cached;
return fetch(event.request).then(response => {
// Don't cache opaque responses (e.g. cross-origin without CORS)
if (!response || response.status !== 200 || response.type === 'opaque') return response;
const respClone = response.clone();
caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
return response;
}).catch(() => {
// Optional: return fallback if desired
});
})
);
});