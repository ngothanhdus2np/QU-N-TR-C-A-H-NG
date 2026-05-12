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
  | 'deleteItem';

export interface PendingOp {
  id: string;
  timestamp: number;
  opType: PendingOpType;
  /** key tương ứng với AppData key (posOrders, posProducts, ...) */
  dataKey: string;
  /** Payload gốc (chưa sanitize) */
  payload: unknown;
  retries: number;
}

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
      const req = store.add(pendingOp);
      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
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
  async incrementRetry(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const op = getReq.result as PendingOp;
        if (!op) { resolve(); return; }
        op.retries = (op.retries || 0) + 1;
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
