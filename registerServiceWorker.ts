// Service Worker Registration for CFO Brain 4.0

interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export function registerServiceWorker(config?: ServiceWorkerConfig) {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service Workers not supported in this browser');
    return;
  }

  // Register on load
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('✅ Service Worker registered:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (!newWorker) return;

        console.log('🔄 Service Worker update found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('✨ New version available!');

            if (config?.onUpdate) {
              config.onUpdate(registration);
            } else {
              // Default: Show update prompt
              showUpdatePrompt(registration);
            }
          }
        });
      });

      // Success callback
      if (config?.onSuccess) {
        config.onSuccess(registration);
      }

      // Check for updates every hour
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000
      );
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });

  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('🌐 Back online');
    if (config?.onOnline) {
      config.onOnline();
    }

    // Trigger background sync
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // @ts-ignore - Background Sync API not yet in TypeScript types
        registration.sync.register('sync-orders');
        // @ts-ignore - Background Sync API not yet in TypeScript types
        registration.sync.register('sync-inventory');
      });
    }
  });

  window.addEventListener('offline', () => {
    console.log('📴 Offline mode');
    if (config?.onOffline) {
      config.onOffline();
    }
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', event => {
    console.log('💬 Message from Service Worker:', event.data);

    if (event.data.type === 'SYNC_COMPLETE') {
      console.log(`✅ Synced ${event.data.data.synced} items`);

      // Show notification
      showNotification('Đồng bộ thành công', {
        body: `Đã đồng bộ ${event.data.data.synced} mục`,
        icon: '/assets/logos/icon-192.png',
      });
    }
  });
}

// Show update prompt
function showUpdatePrompt(registration: ServiceWorkerRegistration) {
  const shouldUpdate = confirm(
    '🎉 Có phiên bản mới của CFO Brain!\n\nBạn có muốn cập nhật ngay không?'
  );

  if (shouldUpdate) {
    const waitingWorker = registration.waiting;

    if (waitingWorker) {
      // Tell service worker to skip waiting
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });

      // Reload page when new service worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }
}

// Show notification
function showNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, options);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, options);
      }
    });
  }
}
