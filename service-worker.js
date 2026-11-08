const CACHE = 'zeju-pwa-2026-11-08-6';
const SHELL = ['./index.html', './app.webmanifest', './app-icon.svg', './app-icon-180.png', './app-icon-192.png', './app-icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('zeju-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate';
  if (!navigation && !/\.(?:js|css|webmanifest|svg|png)$/i.test(new URL(request.url).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(navigation ? './index.html' : request, response.clone());
      return response;
    } catch {
      return await cache.match(request, {ignoreSearch:true}) || (navigation ? await cache.match('./index.html') : null) || Response.error();
    }
  })());
});
