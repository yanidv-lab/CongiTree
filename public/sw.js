const CACHE_NAME = 'cognitree-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Gemini-backed API calls are dynamic and must always hit the network - never cache them.
  if (url.pathname.startsWith('/api/')) return;

  // Only handle same-origin requests (app shell, built assets, fonts). Everything else
  // (cross-origin, e.g. Google Fonts) is left to the browser's normal handling.
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate: serve instantly from cache when available, refresh the cache in the
  // background, and fall back to the last cached app shell when fully offline.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached || (request.mode === 'navigate' ? cache.match('/') : undefined));
      return cached || networkFetch;
    })
  );
});
