/**
 * sw.js — Service Worker
 * FLOW | 資産シミュレーター
 *
 * 修正点（Android対応）:
 * - icon ファイルが存在しなくても SW インストールが止まらないよう
 *   各URLのキャッシュを個別に試み、失敗しても続行する
 * - アイコンを必須リソースから外す（manifest.json は必須のまま）
 */
const CACHE_NAME = 'fire-sim-v17-cache';

// 必須リソース（失敗するとインストール中断）
const CORE_URLS = [
  './index.html',
  './manifest.json',
];

// オプションリソース（失敗してもインストール継続）
const OPTIONAL_URLS = [
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // コアリソースを先にキャッシュ（失敗したら throw してインストール中断）
      await cache.addAll(CORE_URLS).catch(err => {
        console.warn('[SW] Core cache failed, retrying individually:', err);
        return Promise.all(
          CORE_URLS.map(url => cache.add(url).catch(e => console.warn('[SW] Failed to cache:', url, e)))
        );
      });

      // オプションリソースは失敗しても継続
      await Promise.all(
        OPTIONAL_URLS.map(url =>
          cache.add(url).catch(e => console.info('[SW] Optional cache skipped:', url, e.message))
        )
      );
    })
  );
  // 待機状態をスキップして即座にアクティブ化
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    )
  );
  // 全クライアントを即座にコントロール下に置く
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // POST リクエストはキャッシュしない
  if (event.request.method !== 'GET') return;

  // Chrome の拡張リクエストはスキップ
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(networkResponse => {
        // 成功したレスポンスをキャッシュに保存
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // ネットワーク失敗時はindex.htmlにフォールバック
      return caches.match('./index.html');
    })
  );
});
