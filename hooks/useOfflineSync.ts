/**
 * useOfflineSync — React hook quản lý Offline Queue cho POS
 *
 * Chức năng:
 * 1. Khởi tạo IndexedDB queue khi mount
 * 2. Expose `enqueueOp` để các action có thể enqueue khi gặp lỗi mạng
 * 3. Tự động drain queue khi window.online fired
 * 4. Expose `offlinePendingCount` để hiển thị badge trên UI
 */

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

export function useOfflineSync(): UseOfflineSyncReturn {
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isDraining, setIsDraining] = useState(false);
  const isDrainingRef = useRef(false);

  // Khởi tạo và đọc count từ IndexedDB khi mount
  useEffect(() => {
    posOfflineQueue.init().then(() => {
      posOfflineQueue.count().then(c => setOfflinePendingCount(c));
    }).catch(err => {
      console.warn('[OfflineSync] IndexedDB không khởi tạo được:', err);
    });
  }, []);

  /** Drain toàn bộ queue — gọi thao tác lên server theo thứ tự */
  const drainQueue = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isDrainingRef.current) return { synced: 0, failed: 0 };
    isDrainingRef.current = true;
    setIsDraining(true);

    let synced = 0;
    let failed = 0;

    try {
      const ops = await posOfflineQueue.getAll();
      if (ops.length === 0) return { synced: 0, failed: 0 };

      console.log(`[OfflineSync] Bắt đầu drain ${ops.length} thao tác đang chờ...`);

      for (const op of ops) {
        // Bỏ qua nếu đã retry quá nhiều lần (tránh vòng lặp vô tận)
        if (op.retries >= 5) {
          console.warn(`[OfflineSync] Bỏ qua op ${op.id} (retry ${op.retries} >= 5)`);
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
            await apiService.deleteItem(key, op.payload.id);
          }

          // Thành công → xóa khỏi queue
          await posOfflineQueue.remove(op.id);
          synced++;
          console.log(`[OfflineSync] ✅ Synced ${op.opType} [${op.dataKey}] id=${op.id}`);
        } catch (err: any) {
          console.error(`[OfflineSync] ❌ Lỗi sync op ${op.id}:`, err?.message);
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

    console.log(`[OfflineSync] Drain xong: synced=${synced}, failed=${failed}`);
    return { synced, failed };
  }, []);

  /** Enqueue một thao tác vào IndexedDB queue */
  const enqueueOp = useCallback(async (op: Omit<PendingOp, 'id' | 'timestamp' | 'retries'>) => {
    try {
      await posOfflineQueue.enqueue(op);
      const count = await posOfflineQueue.count();
      setOfflinePendingCount(count);
      console.log(`[OfflineSync] Đã enqueue ${op.opType} [${op.dataKey}]. Queue: ${count}`);
    } catch (err) {
      console.error('[OfflineSync] Không thể enqueue vào IndexedDB:', err);
    }
  }, []);

  // Lắng nghe sự kiện "online" → tự drain queue
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[OfflineSync] Kết nối trở lại! Bắt đầu drain queue...');
      // Đợi một chút để đảm bảo kết nối thực sự ổn định
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = await drainQueue();
      if (result.synced > 0) {
        console.log(`[OfflineSync] Đã đồng bộ ${result.synced} thao tác sau khi có mạng.`);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [drainQueue]);

  return { offlinePendingCount, enqueueOp, drainQueue, isDraining };
}
