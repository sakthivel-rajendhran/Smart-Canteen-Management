// DRS Quick Serve — Production Progressive Web App Service Worker
const CACHE_VERSION = 'drs-quick-serve-v2.0';
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `runtime-${CACHE_VERSION}`;

// Pre-cached App Shell Assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/icon.svg',
];

// Sensitive endpoints that MUST NEVER be cached
const SENSITIVE_API_PATTERNS = [
  /\/api\/auth/i,
  /\/api\/payments/i,
  /\/api\/orders/i,
  /\/api\/notifications/i,
  /\/socket\.io/i,
];

// 1. Service Worker Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[DRS PWA] Pre-caching application shell...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Service Worker Activation & Old Cache Cleanup
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== RUNTIME_CACHE_NAME) {
            console.log('[DRS PWA] Purging outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check if request is sensitive
function isSensitiveRequest(url, method) {
  if (method !== 'GET') return true; // Never cache non-GET requests
  return SENSITIVE_API_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

// 3. Network & Cache Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-HTTP(S) requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // STRICT PRIVACY: Pass sensitive APIs directly to network, bypass cache entirely
  if (isSensitiveRequest(url, request.method)) {
    return; // Standard network fetch
  }

  // A. Navigation Requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If valid response, cache a clone for offline re-use
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // B. Public GET APIs (e.g. /api/menu, /api/categories) -> Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return new Response(JSON.stringify({ success: false, message: 'You are currently offline' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
          });
        })
    );
    return;
  }

  // C. Static Assets (CSS, JS, Fonts, Images) -> Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'image' ||
              request.destination === 'font' ||
              url.pathname.startsWith('/assets/'))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If an image fails to load while offline, return nothing or let component handle fallback
          return new Response('', { status: 408 });
        });
    })
  );
});
