import React, { useState, useEffect } from 'react';
import { QrCode, X, Smartphone, Wifi, Globe } from 'lucide-react';

/**
 * Development QR Code component
 * Shows QR code for easy mobile testing
 * Only visible in development mode
 */
const DevQRCode: React.FC = () => {
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [localIP, setLocalIP] = useState('');

  useEffect(() => {
    // Only show in development
    if (import.meta.env.PROD) return;

    // Get current URL
    const currentUrl = window.location.href;
    setQrCodeUrl(currentUrl);

    // Try to get local IP from URL
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      setLocalIP(hostname);
    }
  }, []);

  // Don't show in production
  if (import.meta.env.PROD) return null;

  // Don't show if already on mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) return null;

  return (
    <>
      {/* Floating button */}
      {!showQR && (
        <button
          onClick={() => setShowQR(true)}
          className="fixed bottom-6 left-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110"
          title="Hiển thị QR Code để test trên mobile"
        >
          <QrCode size={24} />
        </button>
      )}

      {/* QR Code modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone size={32} className="text-indigo-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Test trên Mobile
              </h2>
              <p className="text-gray-600 mb-6">
                Quét QR code bằng camera điện thoại
              </p>

              {/* QR Code */}
              <div className="bg-white p-4 rounded-xl border-2 border-gray-200 mb-6">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeUrl)}`}
                  alt="QR Code"
                  className="w-full h-auto"
                />
              </div>

              {/* URL */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-1">URL:</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {qrCodeUrl}
                </p>
              </div>

              {/* Instructions */}
              <div className="space-y-3 text-left">
                {localIP ? (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="bg-green-100 p-2 rounded-lg mt-0.5">
                      <Wifi size={16} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Cùng WiFi</p>
                      <p className="text-gray-600">
                        Điện thoại đang cùng WiFi với máy tính
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="bg-amber-100 p-2 rounded-lg mt-0.5">
                      <Wifi size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Localhost</p>
                      <p className="text-gray-600">
                        Chỉ truy cập được từ máy tính này. Để test trên mobile, dùng:
                      </p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 block">
                        npm run dev:mobile
                      </code>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 text-sm">
                  <div className="bg-blue-100 p-2 rounded-lg mt-0.5">
                    <Globe size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Public URL</p>
                    <p className="text-gray-600">
                      Để test từ bất kỳ đâu (có HTTPS), dùng:
                    </p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 block">
                      npm run dev:tunnel
                    </code>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-indigo-50 rounded-xl text-left">
                <p className="text-xs font-semibold text-indigo-900 mb-2">
                  💡 Tips:
                </p>
                <ul className="text-xs text-indigo-700 space-y-1">
                  <li>• iPhone: Mở Camera app → Quét QR</li>
                  <li>• Android: Mở Camera hoặc Google Lens</li>
                  <li>• Sau khi vào, thêm vào Home Screen để test PWA</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DevQRCode;
