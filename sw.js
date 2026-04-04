const CACHE_NAME = 'my-business-pos-v7';
const ASSETS = [
  './',
  'index.html',
  'pos.html',
  'inventory.html',
  'expenses.html',
  'khata.html',
  'orders.html',
  'reports.html',
  'data.js',
  'sync.js',
  'ui.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'logo.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Manrope:wght@400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.error('Failed to cache:', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).then(response => {
        // Cache new successful requests for faster next load
        // Avoid caching opaque Google API responses that might fail offline if not handled properly
        if (response && response.status === 200 && event.request.method === 'GET') {
          // Only cache http/https
          if (event.request.url.startsWith('http')) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
        }
        return response;
      }).catch(error => {
        // Fallback to index.html ONLY for HTML navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
