import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, Cloud } from 'lucide-react';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Back online');
      setIsOnline(true);
      setShowNotification(true);
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    };

    const handleOffline = () => {
      console.log('📴 Offline mode');
      setIsOnline(false);
      setShowNotification(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persistent indicator (always visible when offline)
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <WifiOff size={16} />
          <span>Chế độ Offline - Dữ liệu sẽ tự động đồng bộ khi có mạng</span>
        </div>
      </div>
    );
  }

  // Notification (temporary, when status changes)
  if (showNotification) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-slide-down">
        <div className={`rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 ${
          isOnline 
            ? 'bg-green-500 text-white' 
            : 'bg-amber-500 text-white'
        }`}>
          {isOnline ? (
            <>
              <Cloud size={20} />
              <span className="font-medium">Đã kết nối - Đang đồng bộ dữ liệu...</span>
            </>
          ) : (
            <>
              <CloudOff size={20} />
              <span className="font-medium">Mất kết nối - Chuyển sang chế độ Offline</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default OfflineIndicator;
