// CFO Brain 4.0 - Service Worker
// Version: 1.0.3

const CACHE_NAME = 'cfo-brain-v1.0.3';
const RUNTIME_CACHE = 'cfo-brain-runtime-v2';
const IMAGE_CACHE = 'cfo-brain-images-v2';
const MAX_IMAGE_CACHE_BYTES = 1_500_000;

// Files to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker: Installed successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('❌ Service Worker: Install failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old caches
              return cacheName !== CACHE_NAME && 
                     cacheName !== RUNTIME_CACHE && 
                     cacheName !== IMAGE_CACHE;
            })
            .map((cacheName) => {
              console.log('🗑️ Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activated successfully');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // SW chỉ xử lý GET. Các method khác (HEAD/POST/PUT/DELETE) đi thẳng ra mạng —
  // Cache API .put() ném lỗi với HEAD ("Request method 'HEAD' is unsupported"),
  // và không bao giờ nên cache request mutate.
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip data API calls entirely. Caching large JSON snapshots can stall the app/browser.
  if (url.pathname.startsWith('/api/data/')) {
    return;
  }

  // API calls: fetch fresh; only cache lightweight GET responses for offline fallback.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const contentLength = Number(response.headers.get('content-length') || 0);
          const canCache =
            request.method === 'GET' &&
            response.ok &&
            (contentLength === 0 || contentLength < 200_000);

          if (canCache) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Handle images separately
  if (request.destination === 'image') {
    // Document preview pages are already static local files and can be large.
    // Let the browser HTTP cache handle them; Cache Storage cloning can stall the tab over time.
    if (url.pathname.startsWith('/knowledge-page-images/')) {
      return;
    }

    event.respondWith(
      caches.open(IMAGE_CACHE)
        .then((cache) => {
          return cache.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              return fetch(request)
                .then((response) => {
                  const contentLength = Number(response.headers.get('content-length') || 0);
                  const canCache =
                    response.ok &&
                    (contentLength === 0 || contentLength <= MAX_IMAGE_CACHE_BYTES);

                  if (canCache) {
                    cache.put(request, response.clone());
                  }
                  return response;
                })
                .catch(() => {
                  // Return placeholder image if offline
                  return new Response(
                    '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#e2e8f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#94a3b8" font-family="Arial" font-size="12">Offline</text></svg>',
                    { headers: { 'Content-Type': 'image/svg+xml' } }
                  );
                });
            });
        })
    );
    return;
  }

  // Network first, fallback to cache (for HTML, CSS, JS)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Return error for other requests
            return new Response('Offline - No cached version available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// LƯU Ý (dọn 2026-07-10, audit mục O): trước đây ở đây có 1 listener 'sync' +
// syncOfflineOrders/syncInventoryChanges/openDB thao tác trên IndexedDB 'CFOBrainDB'
// (store 'pending_orders'/'pending_inventory'). Đó là DEAD CODE — không listener nào
// đăng ký các sync tag này, và store đó KHÔNG phải hàng đợi offline thật của app.
// Hàng đợi offline thật là 'cfo_brain_pos_queue' (store 'pending_ops') trong
// services/posOfflineQueue.ts, replay qua hooks/useOfflineSync.ts khi có mạng lại —
// hoàn toàn không phụ thuộc Background Sync API. Đã xoá để tránh gây nhầm lẫn.

// Push notification
self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'CFO Brain';
  const options = {
    body: data.body || 'Bạn có thông báo mới',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Mở' },
      { action: 'close', title: 'Đóng' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});

// Message from client
self.addEventListener('message', (event) => {
  console.log('💬 Message from client:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }
});

console.log('🚀 Service Worker loaded');
