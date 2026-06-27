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

// Background sync - sync offline data when online
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOfflineOrders());
  }
  
  if (event.tag === 'sync-inventory') {
    event.waitUntil(syncInventoryChanges());
  }
});

// Sync offline orders
async function syncOfflineOrders() {
  try {
    console.log('📤 Syncing offline orders...');
    
    // Get offline orders from IndexedDB
    const db = await openDB();
    const orders = await db.getAll('pending_orders');
    
    // Send to server
    for (const order of orders) {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      
      if (response.ok) {
        await db.delete('pending_orders', order.id);
        console.log('✅ Order synced:', order.id);
      }
    }
    
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { synced: orders.length }
      });
    });
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

// Sync inventory changes
async function syncInventoryChanges() {
  try {
    console.log('📤 Syncing inventory changes...');
    
    const db = await openDB();
    const changes = await db.getAll('pending_inventory');
    
    for (const change of changes) {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change)
      });
      
      if (response.ok) {
        await db.delete('pending_inventory', change.id);
        console.log('✅ Inventory synced:', change.id);
      }
    }
    
  } catch (error) {
    console.error('❌ Inventory sync failed:', error);
  }
}

// Helper: Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CFOBrainDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pending_orders')) {
        db.createObjectStore('pending_orders', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('pending_inventory')) {
        db.createObjectStore('pending_inventory', { keyPath: 'id' });
      }
    };
  });
}

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
