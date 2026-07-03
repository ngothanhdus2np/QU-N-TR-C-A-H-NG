import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Chỉ dùng cho DEV: production đã có service-worker tự phát hiện bản mới
// (registerServiceWorker.ts). Ở dev, server (tsx server.ts) không có cơ chế
// đó nên poll /api/server-boot-id — đổi id nghĩa là server vừa restart (code mới).
const POLL_INTERVAL_MS = 10_000;

const DevUpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const bootIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/server-boot-id', { cache: 'no-store' });
        if (!res.ok) return;
        const { bootId } = await res.json();
        if (cancelled) return;
        if (bootIdRef.current === null) {
          bootIdRef.current = bootId;
        } else if (bootIdRef.current !== bootId) {
          setHasUpdate(true);
        }
      } catch {
        // Server đang restart giữa chừng — bỏ qua, lần poll sau sẽ bắt lại được
      }
    };

    check();
    const intervalId = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
      <div className="flex items-center justify-center gap-3">
        <span>Server vừa cập nhật code mới — tải lại trang để dùng bản mới nhất.</span>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 font-semibold transition-colors"
        >
          <RefreshCw size={14} />
          Tải lại
        </button>
      </div>
    </div>
  );
};

export default DevUpdateBanner;
