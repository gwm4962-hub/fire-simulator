const CACHE_NAME = 'fire-sim-v16-cache';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 必須リソースのみキャッシュ（CDN失敗でSWインストールが止まらないよう個別に試みる）
      return cache.addAll(urlsToCache).catch(() => {
        return Promise.all(
          urlsToCache.map(url =>
            cache.add(url).catch(err => console.warn('[SW] キャッシュ失敗:', url, err))
          )
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => caches.match('./index.html'))
  );
});
