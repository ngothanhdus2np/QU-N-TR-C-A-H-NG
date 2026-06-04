import { AppData, BrandProfile } from '../types';

const DB_NAME = 'cfo_brain_app_cache';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const DATA_KEY = 'app_data';
const BRAND_KEY = 'brand_profile';

interface CacheRecord<T> {
  key: string;
  value: T;
  updatedAt: string;
}

class AppDataCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = event => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });

    return this.initPromise;
  }

  private async getRecord<T>(key: string): Promise<CacheRecord<T> | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CacheRecord<T> | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private async putRecord<T>(key: string, value: T): Promise<void> {
    await this.init();
    if (!this.db) return;

    const record: CacheRecord<T> = {
      key,
      value,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getDataSnapshot(): Promise<AppData | null> {
    const record = await this.getRecord<AppData>(DATA_KEY);
    return record?.value ?? null;
  }

  async saveDataSnapshot(data: AppData): Promise<void> {
    await this.putRecord(DATA_KEY, data);
  }

  async getBrandProfile(): Promise<BrandProfile | null> {
    const record = await this.getRecord<BrandProfile>(BRAND_KEY);
    return record?.value ?? null;
  }

  async saveBrandProfile(profile: BrandProfile): Promise<void> {
    await this.putRecord(BRAND_KEY, profile);
  }

  async clearDataKeys(keys: (keyof AppData)[]): Promise<void> {
    // Clear from IndexedDB
    const snapshot = await this.getDataSnapshot();
    if (snapshot) {
      const updated = { ...snapshot };
      for (const k of keys) {
        (updated as Record<string, unknown>)[k] = [];
      }
      await this.saveDataSnapshot(updated as AppData);
    }
    // Clear from localStorage
    try {
      const raw = localStorage.getItem('cfo_brain_local_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const k of keys) delete parsed[k];
        localStorage.setItem('cfo_brain_local_data', JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
  }
}

export const appDataCache = new AppDataCacheService();
