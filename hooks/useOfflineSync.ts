import { useState, useEffect, useCallback, useRef } from 'react';
import { posOfflineQueue, PendingOp } from '../services/posOfflineQueue';
import { apiService } from '../services/apiService';
import { AppData, RevenueDelta } from '../types';

interface UseOfflineSyncReturn {
  offlinePendingCount: number;
  offlineOrderPendingCount: number;
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
  const [offlineOrderPendingCount, setOfflineOrderPendingCount] = useState(0);
  const [isDraining, setIsDraining] = useState(false);
  const isDrainingRef = useRef(false);

  const refreshPendingCounts = useCallback(async () => {
    const [total, orders] = await Promise.all([
      posOfflineQueue.count(),
      posOfflineQueue.countByDataKey('posOrders'),
    ]);
    setOfflinePendingCount(total);
    setOfflineOrderPendingCount(orders);
    return { total, orders };
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
          failed++;
          continue;
        }

        try {
          const key = op.dataKey as keyof AppData;

          if (op.opType === 'pushBatch') {
            const items = Array.isArray(op.payload) ? op.payload : [op.payload];
            await apiService.upsertMany(key, items);
          } else if (op.opType === 'inventoryApply') {
            await apiService.applyInventoryTransactionWithStock(
              op.payload as AppData['inventoryTransactions'][number]
            );
          } else if (op.opType === 'inventoryDelete') {
            const payload = op.payload as { id: string };
            await apiService.deleteInventoryTransactionWithStock(payload.id);
          } else if (op.opType === 'revenueDelta') {
            const payload = op.payload as { id: string; dateKey: string; delta: RevenueDelta };
            await apiService.applyRevenueDelta(payload.id, payload.dateKey, payload.delta);
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
          await posOfflineQueue.incrementRetry(op.id, message);
          failed++;
        }
      }
    } finally {
      await refreshPendingCounts();
      isDrainingRef.current = false;
      setIsDraining(false);
    }

    return { synced, failed };
  }, [refreshPendingCounts]);

  useEffect(() => {
    posOfflineQueue.init().then(() => {
      return posOfflineQueue.compactItemOps();
    }).then(() => {
      refreshPendingCounts().then(async ({ total }) => {
        if (total === 0) return;
        const reachable = await isServerReachable();
        if (reachable) await drainQueue();
      });
    }).catch(err => {
      console.error('[OfflineSync] IndexedDB không khởi tạo được:', err);
    });
  }, [drainQueue, refreshPendingCounts]);

  const enqueueOp = useCallback(async (op: Omit<PendingOp, 'id' | 'timestamp' | 'retries'>) => {
    try {
      await posOfflineQueue.enqueue(op);
      await refreshPendingCounts();
    } catch (err) {
      console.error('[OfflineSync] Không thể enqueue vào IndexedDB:', err);
    }
  }, [refreshPendingCounts]);

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

  useEffect(() => {
    if (offlinePendingCount === 0) return;

    const id = window.setInterval(async () => {
      if (isDrainingRef.current) return;
      const reachable = await isServerReachable();
      if (reachable) await drainQueue();
    }, 30_000);

    return () => window.clearInterval(id);
  }, [drainQueue, offlinePendingCount]);

  return { offlinePendingCount, offlineOrderPendingCount, enqueueOp, drainQueue, isDraining };
}
