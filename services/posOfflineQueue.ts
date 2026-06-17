/**
 * POS Offline Queue — IndexedDB-based
 * Lưu trữ bền vững các thao tác POS khi mất kết nối.
 * Tự động replay khi có mạng trở lại.
 */

const DB_NAME = 'cfo_brain_pos_queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_ops';

export type PendingOpType =
  | 'pushBatch'
  | 'upsertItem'
  | 'deleteItem'
  | 'inventoryApply'
  | 'inventoryDelete';

export interface PendingOp {
  id: string;
  timestamp: number;
  opType: PendingOpType;
  /** key tương ứng với AppData key (posOrders, posProducts, ...) */
  dataKey: string;
  /** Payload gốc (chưa sanitize) */
  payload: unknown;
  retries: number;
  lastError?: string;
}

const getPayloadId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : null;
};

const canCoalesceItemOp = (opType: PendingOpType) =>
  opType === 'upsertItem' || opType === 'deleteItem';

class POSOfflineQueueService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Khởi tạo IndexedDB — idempotent, gọi nhiều lần cũng được */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('dataKey', 'dataKey', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });

    return this.initPromise;
  }

  /** Thêm một thao tác vào queue */
  async enqueue(op: Omit<PendingOp, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    await this.init();
    const id = crypto.randomUUID();
    const pendingOp: PendingOp = { ...op, id, timestamp: Date.now(), retries: 0 };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const addPendingOp = () => {
        const req = store.add(pendingOp);
        req.onsuccess = () => resolve(id);
        req.onerror = () => reject(req.error);
      };

      if (!canCoalesceItemOp(op.opType)) {
        addPendingOp();
        return;
      }

      const payloadId = getPayloadId(op.payload);
      if (!payloadId) {
        addPendingOp();
        return;
      }

      // Dùng dataKey index để chỉ scan records cùng key, tránh full-scan toàn queue
      const dataKeyIndex = store.index('dataKey');
      const allReq = dataKeyIndex.getAll(op.dataKey);
      allReq.onerror = () => reject(allReq.error);
      allReq.onsuccess = () => {
        const ops = (allReq.result || []) as PendingOp[];
        const existing = ops
          .filter(
            item =>
              canCoalesceItemOp(item.opType) &&
              getPayloadId(item.payload) === payloadId
          )
          .sort((a, b) => b.timestamp - a.timestamp)[0];

        if (!existing) {
          addPendingOp();
          return;
        }

        // The latest delete wins over an earlier unsynced upsert for the same record.
        if (existing.opType === 'upsertItem' && op.opType === 'deleteItem') {
          const putReq = store.put({ ...pendingOp, id: existing.id });
          putReq.onsuccess = () => resolve(existing.id);
          putReq.onerror = () => reject(putReq.error);
          return;
        }

        // Later edits replace an earlier unsynced upsert for the same record.
        if (existing.opType === 'upsertItem' && op.opType === 'upsertItem') {
          const putReq = store.put({
            ...existing,
            payload: op.payload,
            timestamp: pendingOp.timestamp,
            retries: 0,
          });
          putReq.onsuccess = () => resolve(existing.id);
          putReq.onerror = () => reject(putReq.error);
          return;
        }

        // If delete is pending and user recreates/updates the same id, the latest state wins.
        if (existing.opType === 'deleteItem' && op.opType === 'upsertItem') {
          const putReq = store.put({ ...pendingOp, id: existing.id });
          putReq.onsuccess = () => resolve(existing.id);
          putReq.onerror = () => reject(putReq.error);
          return;
        }

        // Duplicate deletes for the same record do not need another queue item.
        if (existing.opType === 'deleteItem' && op.opType === 'deleteItem') {
          resolve(existing.id);
          return;
        }

        addPendingOp();
      };
    });
  }

  /** Lấy tất cả thao tác đang chờ, sắp xếp theo thời gian */
  async getAll(): Promise<PendingOp[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const req = index.getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.timestamp - b.timestamp));
      req.onerror = () => reject(req.error);
    });
  }

  /** Gộp các thao tác item trùng nhau để queue chỉ giữ trạng thái cuối cùng cần sync */
  async compactItemOps(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const ops = ((req.result || []) as PendingOp[]).sort(
          (a, b) => a.timestamp - b.timestamp
        );
        const latestByRecord = new Map<string, PendingOp>();
        const itemOpIds = new Set<string>();

        for (const op of ops) {
          if (!canCoalesceItemOp(op.opType)) continue;

          const payloadId = getPayloadId(op.payload);
          if (!payloadId) continue;

          itemOpIds.add(op.id);
          const key = `${op.dataKey}:${payloadId}`;
          const existing = latestByRecord.get(key);

          if (!existing) {
            latestByRecord.set(key, op);
            continue;
          }

          latestByRecord.set(key, {
            ...op,
            id: existing.id,
            retries: 0,
          });
        }

        const compactedOps = Array.from(latestByRecord.values());
        const retainedIds = new Set(compactedOps.map(op => op.id));
        const obsoleteIds = Array.from(itemOpIds).filter(id => !retainedIds.has(id));
        let pending = obsoleteIds.length + compactedOps.length;

        if (pending === 0) {
          resolve();
          return;
        }

        const finishOne = () => {
          pending -= 1;
          if (pending === 0) resolve();
        };

        obsoleteIds.forEach(id => {
          const deleteReq = store.delete(id);
          deleteReq.onsuccess = finishOne;
          deleteReq.onerror = () => reject(deleteReq.error);
        });

        compactedOps.forEach(op => {
          const putReq = store.put(op);
          putReq.onsuccess = finishOne;
          putReq.onerror = () => reject(putReq.error);
        });
      };
    });
  }

  /** Xóa một thao tác đã xử lý thành công */
  async remove(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Cập nhật số lần retry */
  async incrementRetry(id: string, lastError?: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const op = getReq.result as PendingOp;
        if (!op) { resolve(); return; }
        op.retries = (op.retries || 0) + 1;
        op.lastError = lastError;
        const putReq = store.put(op);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  /** Đếm số thao tác đang chờ */
  async count(): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Đếm số thao tác đang chờ theo AppData key */
  async countByDataKey(dataKey: string): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('dataKey');
      const req = index.count(dataKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Xóa toàn bộ queue (sau khi sync thành công) */
  async clearAll(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const posOfflineQueue = new POSOfflineQueueService();
