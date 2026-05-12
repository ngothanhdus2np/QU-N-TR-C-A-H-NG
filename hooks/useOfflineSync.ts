import { useState, useEffect, useCallback, useRef } from 'react';
import { posOfflineQueue, PendingOp } from '../services/posOfflineQueue';
import { apiService } from '../services/apiService';
import { AppData } from '../types';

interface UseOfflineSyncReturn {
  offlinePendingCount: number;
  enqueueOp: (op: Omit<PendingOp, 'id' | 'timestamp' | 'retries'>) => Promise<void>;
  drainQueue: () => Promise<{ synced: number; failed: number }>;
  isDraining: boolean;
}

async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch('/health', { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isDraining, setIsDraining] = useState(false);
  const isDrainingRef = useRef(false);

  useEffect(() => {
    posOfflineQueue.init().then(() => {
      posOfflineQueue.count().then(c => setOfflinePendingCount(c));
    }).catch(err => {
      console.error('[OfflineSync] IndexedDB không khởi tạo được:', err);
    });
  }, []);

  const drainQueue = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isDrainingRef.current) return { synced: 0, failed: 0 };
    isDrainingRef.current = true;
    setIsDraining(true);

    let synced = 0;
    let failed = 0;

    try {
      const ops = await posOfflineQueue.getAll();
      if (ops.length === 0) return { synced: 0, failed: 0 };

      for (const op of ops) {
        if (op.retries >= 5) {
          await posOfflineQueue.remove(op.id);
          failed++;
          continue;
        }

        try {
          const key = op.dataKey as keyof AppData;

          if (op.opType === 'pushBatch') {
            const items = Array.isArray(op.payload) ? op.payload : [op.payload];
            await apiService.upsertMany(key, items);
          } else if (op.opType === 'upsertItem') {
            await apiService.upsertItem(key, op.payload);
          } else if (op.opType === 'deleteItem') {
            const payload = op.payload as { id: string };
            await apiService.deleteItem(key, payload.id);
          }

          await posOfflineQueue.remove(op.id);
          synced++;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[OfflineSync] Lỗi sync op ${op.id}:`, message);
          await posOfflineQueue.incrementRetry(op.id);
          failed++;
        }
      }
    } finally {
      const remaining = await posOfflineQueue.count();
      setOfflinePendingCount(remaining);
      isDrainingRef.current = false;
      setIsDraining(false);
    }

    return { synced, failed };
  }, []);

  const enqueueOp = useCallback(async (op: Omit<PendingOp, 'id' | 'timestamp' | 'retries'>) => {
    try {
      await posOfflineQueue.enqueue(op);
      const count = await posOfflineQueue.count();
      setOfflinePendingCount(count);
    } catch (err) {
      console.error('[OfflineSync] Không thể enqueue vào IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      // Kiểm tra server thực sự reachable, không chỉ dựa vào navigator.onLine
      await new Promise(resolve => setTimeout(resolve, 1500));
      const reachable = await isServerReachable();
      if (!reachable) return;
      await drainQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [drainQueue]);

  return { offlinePendingCount, enqueueOp, drainQueue, isDraining };
}
