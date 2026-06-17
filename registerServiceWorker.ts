// Service Worker Registration for CFO Brain 4.0

interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export function registerServiceWorker(config?: ServiceWorkerConfig) {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Khi SW mới activate và claim clients → tự động reload trang
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      if (config?.onSuccess) {
        config.onSuccess(registration);
      }

      // Kiểm tra update mỗi 5 phút (thay vì 1 giờ)
      setInterval(() => registration.update(), 5 * 60 * 1000);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });

  window.addEventListener('online', () => {
    if (config?.onOnline) config.onOnline();
  });

  window.addEventListener('offline', () => {
    if (config?.onOffline) config.onOffline();
  });
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
