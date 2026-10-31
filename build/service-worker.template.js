const PREFIX = 'all-transport-' + self.registration.scope + '::';
const CACHE = PREFIX + '__CACHE_VERSION__';
const FILES = __APP_FILES__.map(path => new URL(path, self.registration.scope).href);
const INDEX = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache requests to the API, Supabase, or other external services.
  if (request.method !== 'GET' || url.origin !== self.location.origin || /\/api(?:\/|$)/.test(url.pathname)) return;
  if (request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(INDEX))));
  } else if (FILES.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(request).then(cached => cached || fetch(request))));
  }
});
