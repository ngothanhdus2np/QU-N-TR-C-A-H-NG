
import { useEffect, useMemo, useCallback, useReducer, useState } from 'react';
import { AppData, AppDataItem, AppDataSurgicalUpdate, ChatMessage, BrandProfile, DiagnosisRange } from '../types';
import { INITIAL_APP_DATA } from '../constants/defaultData';
import { DEFAULT_BRAND } from '../constants/marketing';
import { apiService, TABLE_MAP } from '../services/apiService';
import { calculateStrategicSuggestions } from '../src/lib';
import { dataMapper } from '../services/dataMapper';
import { appReducer } from './appReducer';
import { AppState } from './stateTypes';
import { validationService } from '../services/validationService';
import { incrementPending, getPendingCount, clearPending } from '../services/syncService';
import { useOfflineSync } from './useOfflineSync';
import { appDataCache } from '../services/appDataCache';

const localTodayStr = new Date().toLocaleDateString('sv-SE');
type IdentifiableItem = { id: string };
type PosSeedProduct = IdentifiableItem & { sku?: unknown };
type SyncableDataKey =
  | 'revenue'
  | 'expenses'
  | 'payroll'
  | 'employees'
  | 'posProducts'
  | 'posOrders'
  | 'posCustomers'
  | 'inventoryTransactions'
  | 'productGroups'
  | 'productGroupRevenue';
type ConfigDataKey =
  | 'violationTypes'
  | 'violationOccurrences'
  | 'customDeductions'
  | 'holidays'
  | 'responsibilityApprovals'
  | 'tetCampaign'
  | 'expenseCategories'
  | 'shopeeCosts'
  | 'dailyAdsConfig'
  | 'dailyBreakEvenConfig'
  | 'posPaymentSettings'
  | 'posInventorySettings';

const CONFIG_KEY_MAP: Record<ConfigDataKey, string> = {
  violationTypes: 'violation_types',
  violationOccurrences: 'violation_occurrences',
  customDeductions: 'custom_penalties',
  holidays: 'holidays',
  responsibilityApprovals: 'responsibility_approvals',
  tetCampaign: 'tet_campaign',
  expenseCategories: 'expense_categories',
  shopeeCosts: 'shopee_costs',
  dailyAdsConfig: 'daily_ads_config',
  dailyBreakEvenConfig: 'daily_break_even_config',
  posPaymentSettings: 'pos_payment_settings',
  posInventorySettings: 'pos_inventory_settings',
};

const CONFIG_DATA_KEYS = new Set<keyof AppData>(Object.keys(CONFIG_KEY_MAP) as ConfigDataKey[]);

const isIdentifiableItem = (item: unknown): item is IdentifiableItem => (
  typeof item === 'object' &&
  item !== null &&
  'id' in item &&
  typeof (item as { id?: unknown }).id === 'string'
);

// localStorage có thể ném QuotaExceededError khi data quá lớn (~6MB posProducts).
// Fallback: lưu không có posProducts để giữ data tài chính/HR an toàn.
function safeLocalStorageSet(key: string, data: Partial<AppData> | AppData) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e: unknown) {
    const storageError = e as { name?: string; code?: number };
    if (storageError.name === 'QuotaExceededError' || storageError.code === 22) {
      console.error('[Storage] Quota exceeded — lưu fallback không có posProducts');
      try {
        const { posProducts: _dropped, ...rest } = data;
        localStorage.setItem(key, JSON.stringify(rest));
      } catch {
        // Nếu vẫn không được, bỏ qua — data an toàn trên cloud
      }
    } else {
      console.error('[Storage] Lỗi lưu localStorage:', e);
    }
  }
}

function parseLocalStorageData(): Partial<AppData> | null {
  const localDataStr = localStorage.getItem('cfo_brain_local_data');
  if (!localDataStr) return null;

  try {
    return JSON.parse(localDataStr) as Partial<AppData>;
  } catch (error) {
    console.error('[Storage] Lỗi đọc localStorage cache:', error);
    return null;
  }
}

async function loadCachedDataSnapshot(): Promise<Partial<AppData> | null> {
  try {
    const indexedDbData = await appDataCache.getDataSnapshot();
    return indexedDbData || parseLocalStorageData();
  } catch (error) {
    console.error('[Cache] Lỗi đọc IndexedDB snapshot:', error);
    return parseLocalStorageData();
  }
}

async function saveDataSnapshot(data: Partial<AppData> | AppData): Promise<void> {
  const snapshot = { ...INITIAL_APP_DATA, ...data } as AppData;
  safeLocalStorageSet('cfo_brain_local_data', snapshot);
  try {
    await appDataCache.saveDataSnapshot(snapshot);
  } catch (error) {
    console.error('[Cache] Lỗi lưu IndexedDB snapshot:', error);
  }
}

const isNetworkSyncError = (err: unknown) => (
  typeof navigator !== 'undefined' && !navigator.onLine
) || String(err instanceof Error ? err.message : err).toLowerCase().includes('fetch')
  || String(err instanceof Error ? err.message : err).toLowerCase().includes('network');

const loadBundledPosProducts = async (): Promise<PosSeedProduct[]> => {
  if (typeof window === 'undefined') return [];

  try {
    const res = await fetch('/imports/kiotviet-products.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const products = await res.json();
    return Array.isArray(products) ? products.filter(isIdentifiableItem) as PosSeedProduct[] : [];
  } catch {
    return [];
  }
};

const POS_PRODUCTS_SEED_KEY = 'cfo_brain_pos_products_seed_version';
const POS_PRODUCTS_SEED_VERSION = 'kiotviet_2026-05-06_12739';

const initialState: AppState = {
  data: INITIAL_APP_DATA,
  activeTab: 'pos',
  brandProfile: DEFAULT_BRAND,
  chatMessages: [],
  isSyncing: false,
  isCloudConnected: false,
  showResigned: false,
  diagnosisRange: 'thisMonth',
  diagStartDate: localTodayStr,
  diagEndDate: localTodayStr,
  syncErrors: null,
  lastSyncTime: null,
};

export function useAppData() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [pendingCount, setPendingCount] = useState(() => getPendingCount());
  
  // === Offline Queue (IndexedDB) ===
  const { offlinePendingCount, enqueueOp, drainQueue, isDraining } = useOfflineSync();

  const {
    data,
    activeTab,
    brandProfile,
    chatMessages,
    isSyncing,
    isCloudConnected,
    showResigned,
    diagnosisRange,
    diagStartDate,
    diagEndDate,
    syncErrors,
    lastSyncTime
  } = state;

  const setActiveTab = useCallback((tab: string) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }), []);
  const setBrandProfile = useCallback((profile: BrandProfile) => dispatch({ type: 'SET_BRAND_PROFILE', payload: profile }), []);
  const setChatMessages = useCallback((messages: ChatMessage[]) => dispatch({ type: 'SET_CHAT_MESSAGES', payload: messages }), []);
  const setShowResigned = useCallback((show: boolean) => dispatch({ type: 'SET_SHOW_RESIGNED', payload: show }), []);
  const setDiagnosisRange = useCallback((range: DiagnosisRange) => dispatch({ type: 'SET_DIAGNOSIS_RANGE', payload: range }), []);
  const setDiagStartDate = useCallback((date: string) => dispatch({ type: 'SET_DIAG_START_DATE', payload: date }), []);
  const setDiagEndDate = useCallback((date: string) => dispatch({ type: 'SET_DIAG_END_DATE', payload: date }), []);

  const suggestedFocusProducts = useMemo(() => {
    const nextMonthNum = new Date().getMonth() + 2;
    const normalizedNextMonth = nextMonthNum > 12 ? 1 : nextMonthNum;
    return calculateStrategicSuggestions(data.productGroupRevenue || [], normalizedNextMonth);
  }, [data.productGroupRevenue]);

  const breakEvenAnalysis = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 2. Calculate Total Monthly Costs (Payroll + All Expenses for this month)
    // Using local month string "YYYY-MM" to match "YYYY-MM-DD" or "YYYY-MM"
    const monthlyPayroll = data.payroll
      .filter(p => p.month === currentMonth)
      .reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
    
    const monthlyExpenses = data.expenses
      .filter(e => e.date && e.date.includes(currentMonth))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      
    const totalMonthlyCost = monthlyPayroll + monthlyExpenses;
    const dailyFixedCost = totalMonthlyCost / daysInMonth;

    // 3. Calculate Average Gross Margin (last 30 days)
    const last30DaysRevenue = data.revenue.slice(-30);
    const avgGrossMargin = last30DaysRevenue.length > 0
      ? last30DaysRevenue.reduce((sum, r) => {
          const rev = (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
          const margin = rev > 0 ? (Number(r.grossProfit) || 0) / rev : 0;
          return sum + margin;
        }, 0) / last30DaysRevenue.length
      : 0.3;

    const dailyBreakEvenRevenue = avgGrossMargin > 0 ? dailyFixedCost / avgGrossMargin : 0;

    const todayStr = now.toLocaleDateString('sv-SE');
    const todayRevRec = data.revenue.find(r => r.date === todayStr);
    const todayRevenue = todayRevRec ? (Number(todayRevRec.netRevenue) || 0) + (Number(todayRevRec.revenueOther) || 0) : 0;
    
    return {
      dailyFixedCost,
      avgGrossMargin,
      dailyBreakEvenRevenue,
      todayRevenue,
      progress: dailyBreakEvenRevenue > 0 ? (todayRevenue / dailyBreakEvenRevenue) * 100 : 0,
      isProfitable: todayRevenue > dailyBreakEvenRevenue && dailyBreakEvenRevenue > 0
    };
  }, [data.payroll, data.expenses, data.revenue]);

  const fetchData = useCallback(async (isManual = false, silent = false) => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      const { data: results, errors } = await apiService.fetchAllData();
      dispatch({ type: 'SET_SYNC_ERRORS', payload: errors });
      
      if (errors && errors.length > 0) {
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      } else {
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      }
      
      let localData = await loadCachedDataSnapshot();

      if (localStorage.getItem(POS_PRODUCTS_SEED_KEY) !== POS_PRODUCTS_SEED_VERSION) {
        const bundledProducts = await loadBundledPosProducts();
        if (bundledProducts.length > 0) {
          const existingProducts = Array.isArray(localData?.posProducts) ? localData.posProducts : [];
          const bySku = new Map<string, AppData['posProducts'][number]>(
            existingProducts.map((product) => [String(product.sku || product.id), product] as const)
          );
          bundledProducts.forEach((product) => {
            const key = String(product.sku || product.id);
            bySku.set(key, { ...(bySku.get(key) || {}), ...product } as AppData['posProducts'][number]);
          });
          localData = { ...(localData || {}), posProducts: Array.from(bySku.values()) };
          await saveDataSnapshot(localData);
          localStorage.setItem(POS_PRODUCTS_SEED_KEY, POS_PRODUCTS_SEED_VERSION);
        }
      }

      if (results.brandProfile) {
        const mappedBrand = dataMapper.mapBrandProfile(results.brandProfile);
        dispatch({ type: 'SET_BRAND_PROFILE', payload: mappedBrand });
        localStorage.setItem('cfo_brain_brand_profile', JSON.stringify(mappedBrand));
        await appDataCache.saveBrandProfile(mappedBrand);
      } else {
        const localBrand = localStorage.getItem('cfo_brain_brand_profile');
        const cachedBrand = await appDataCache.getBrandProfile();
        if (cachedBrand) {
          dispatch({ type: 'SET_BRAND_PROFILE', payload: cachedBrand });
        } else if (localBrand) {
          dispatch({ type: 'SET_BRAND_PROFILE', payload: JSON.parse(localBrand) });
        }
      }
      
      const newState = dataMapper.mapAllData(results, localData);
      
      // "Sync Force" - Push local gaps to Cloud when triggered manually (e.g. Refresh button)
      if (isManual) {
        let totalPushed = 0;
        let totalErrors = 0;
        const pushErrors: string[] = [];

        const syncConfigs: Array<{ key: SyncableDataKey; cloud: unknown[] | undefined; matchKey: 'id' | 'date' }> = [
          { key: 'revenue', cloud: results.revenue, matchKey: 'date' },
          { key: 'expenses', cloud: results.expenses, matchKey: 'id' },
          { key: 'payroll', cloud: results.payroll, matchKey: 'id' },
          { key: 'employees', cloud: results.employees, matchKey: 'id' },
          { key: 'posProducts', cloud: results.posProducts, matchKey: 'id' },
          { key: 'posOrders', cloud: results.posOrders, matchKey: 'id' },
          { key: 'posCustomers', cloud: results.posCustomers, matchKey: 'id' },
          { key: 'inventoryTransactions', cloud: results.inventoryTransactions, matchKey: 'id' },
          { key: 'productGroups', cloud: results.pGroups, matchKey: 'id' },
          { key: 'productGroupRevenue', cloud: results.pGroupRev, matchKey: 'id' }
        ];

        for (const config of syncConfigs) {
          const cloudItems = (config.cloud || []).filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
          const cloudKeys = new Set(cloudItems.map((item) => item[config.matchKey]));
          const localValue = newState[config.key];
          const localItems = Array.isArray(localValue)
            ? (localValue as unknown[]).filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
            : [];
          const missingOnCloud = localItems.filter((item) => !cloudKeys.has(item[config.matchKey]));

          if (missingOnCloud.length > 0) {
            try {
              // Validate each item before pushing
              const validItems = missingOnCloud.filter(item => {
                const errors = validationService.validate(config.key, item);
                if (errors.length > 0) {
                  totalErrors++;
                  pushErrors.push(`${config.key}: ID ${String(item.id || item.date || 'unknown')} - ${errors[0].message}`);
                  return false;
                }
                return true;
              });

              if (validItems.length > 0) {
                await apiService.upsertMany(config.key, validItems);
                totalPushed += validItems.length;
              }
            } catch (e: unknown) {
              totalErrors++;
              const message = e instanceof Error ? e.message : String(e);
              pushErrors.push(`Lỗi bảng ${config.key}: ${message}`);
              console.error(`[Sync] Lỗi đẩy ${config.key}:`, e);
            }
          }
        }
        
        if (!silent) {
          if (totalPushed > 0 || totalErrors > 0) {
            let msg = `KẾT QUẢ ĐỒNG BỘ:\n- Đã đẩy: ${totalPushed} bản ghi.\n- Bị chặn (lỗi): ${totalErrors} bản ghi.`;
            if (pushErrors.length > 0) msg += `\n\nChi tiết lỗi:\n${pushErrors.slice(0, 5).join('\n')}${pushErrors.length > 5 ? '\n...' : ''}`;
            alert(msg);
          } else {
            alert("Dữ liệu đã đồng nhất hoàn toàn với Cloud.");
          }
        }
      }
      
      dispatch({ type: 'SET_DATA', payload: newState });
      await saveDataSnapshot(newState);
      clearPending();
      setPendingCount(0);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: unknown) {
      console.error("Lỗi đồng bộ Supabase:", err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      const cachedData = await loadCachedDataSnapshot();
      if (cachedData) dispatch({ type: 'SET_DATA', payload: cachedData });
      const message = err instanceof Error ? err.message : 'Kiểm tra kết nối và cấu trúc bảng';
      if (isManual) alert(`LỖI ĐỒNG BỘ: ${message}`);
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, []); // Removed 'data' dependency to prevent infinite loop

  useEffect(() => {
    let cancelled = false;

    const hydrateThenSync = async () => {
      const [cachedData, cachedBrand] = await Promise.all([
        loadCachedDataSnapshot(),
        appDataCache.getBrandProfile().catch(error => {
          console.error('[Cache] Lỗi đọc brand profile cache:', error);
          return null;
        }),
      ]);

      if (cancelled) return;

      if (cachedData) {
        dispatch({ type: 'SET_DATA', payload: cachedData });
      }

      if (cachedBrand) {
        dispatch({ type: 'SET_BRAND_PROFILE', payload: cachedBrand });
      } else {
        const localBrand = localStorage.getItem('cfo_brain_brand_profile');
        if (localBrand) dispatch({ type: 'SET_BRAND_PROFILE', payload: JSON.parse(localBrand) });
      }

      fetchData();
    };

    hydrateThenSync();

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await apiService.upsertItem('brandProfile', brandProfile);
        await appDataCache.saveBrandProfile(brandProfile);
      } catch (e) {
        console.error("Brand sync error:", e);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [brandProfile]);

  const updateData = useCallback(async <K extends keyof AppData>(key: K, newList: AppData[K], idToRemove?: string) => {
    // Ensure unique IDs to prevent Supabase errors
    const uniqueList = (() => {
      if (!Array.isArray(newList)) return newList;
      const arrayItems = newList as unknown[];
      if (!arrayItems.every(isIdentifiableItem)) return newList;
      return Array.from(new Map(arrayItems.map(item => [item.id, item] as const)).values());
    })();

    dispatch({ type: 'SET_DATA', payload: { [key]: uniqueList } });
    
    // Get current data from localStorage to avoid dependency on 'data' state
    const currentLocalData = (await loadCachedDataSnapshot()) || {};
    const nextLocalData = { ...currentLocalData, [key]: uniqueList };
    await saveDataSnapshot(nextLocalData);
    
    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      if (idToRemove) {
        await apiService.deleteItem(key, idToRemove);
      } else if (Array.isArray(newList) && newList.length === 0 && TABLE_MAP[key as string]) {
        await apiService.clearTable(key);
      }
      
      if (uniqueList && Array.isArray(uniqueList) && uniqueList.length > 0 && TABLE_MAP[key as string]) {
        await apiService.upsertMany(key, uniqueList);
      } else if (CONFIG_DATA_KEYS.has(key)) {
        await apiService.upsertConfig(CONFIG_KEY_MAP[key as ConfigDataKey], newList);
      }
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_SYNC_ERRORS', payload: null });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: unknown) {
      console.error(`Error updating ${key}:`, err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      const errorMsg = `LỖI ĐỒNG BỘ [${key}]: ${message}`;
      dispatch({ type: 'SET_SYNC_ERRORS', payload: [errorMsg] });
      throw err;
    } finally { dispatch({ type: 'SET_SYNCING', payload: false }); }
  }, []);

  const updateSurgical = useCallback(async (updates: AppDataSurgicalUpdate[]) => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    dispatch({ type: 'UPDATE_SURGICAL', payload: updates });
    
    // Durable Save: Update localStorage immediately before Cloud push
    try {
      const cachedData = await loadCachedDataSnapshot();
      const currentLocalData: Record<string, unknown> = { ...state.data, ...(cachedData || {}) };
      
      for (const u of updates) {
        const key = u.key as string;
        const existingItems = Array.isArray(currentLocalData[key]) ? currentLocalData[key] : [];
        const newList = [...existingItems];
        const idx = newList.findIndex((item) => isIdentifiableItem(item) && item.id === u.item.id);
        if (u.isDelete) {
          if (idx > -1) newList.splice(idx, 1);
        } else {
          if (idx > -1) newList[idx] = { ...newList[idx], ...u.item };
          else newList.push(u.item);
        }
        currentLocalData[key] = newList;
      }
      await saveDataSnapshot(currentLocalData as Partial<AppData>);
    } catch (e) {
      console.error("Local storage sync error:", e);
    }
    
    const inventoryUpdates = updates.filter(u => u.key === 'inventoryTransactions');
    const hasStockUpdates = updates.some(u => u.key === 'posProducts');
    const shouldUseInventoryRpc = inventoryUpdates.length > 0 && hasStockUpdates;

    // Track successful operations for rollback
    const completedOperations: Array<{ 
      key: keyof AppData; 
      id: string; 
      isDelete: boolean; 
      previousData?: AppDataItem<keyof AppData> | { id: string }
    }> = [];

    try {

      if (shouldUseInventoryRpc) {
        for (const inventoryUpdate of inventoryUpdates) {
          if (inventoryUpdate.isDelete) {
            await apiService.deleteInventoryTransactionWithStock(inventoryUpdate.item.id);
            completedOperations.push({ 
              key: inventoryUpdate.key, 
              id: inventoryUpdate.item.id, 
              isDelete: true,
              previousData: inventoryUpdate.item 
            });
          } else {
            await apiService.applyInventoryTransactionWithStock(
              inventoryUpdate.item as AppData['inventoryTransactions'][number]
            );
            completedOperations.push({ 
              key: inventoryUpdate.key, 
              id: inventoryUpdate.item.id, 
              isDelete: false 
            });
          }
        }
      }

      for (const u of updates) {
        if (
          shouldUseInventoryRpc &&
          (u.key === 'inventoryTransactions' || u.key === 'posProducts')
        ) {
          continue;
        }
        if (u.isDelete) {
          await apiService.deleteItem(u.key, u.item.id);
          completedOperations.push({ 
            key: u.key, 
            id: u.item.id, 
            isDelete: true,
            previousData: u.item 
          });
        } else {
          await apiService.upsertItem(u.key, u.item);
          completedOperations.push({ 
            key: u.key, 
            id: u.item.id, 
            isDelete: false 
          });
        }
      }
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_SYNC_ERRORS', payload: null });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: unknown) {
      console.error("LỖI ĐỒNG BỘ SURGICAL:", err);
      
      // Attempt rollback of completed operations
      if (completedOperations.length > 0) {
        console.warn(`Đang rollback ${completedOperations.length} operations đã hoàn thành...`);
        for (const op of completedOperations.reverse()) {
          try {
            if (op.isDelete && op.previousData) {
              // Restore deleted item
              await apiService.upsertItem(op.key, op.previousData);
            } else if (!op.isDelete) {
              // Delete newly created/updated item
              await apiService.deleteItem(op.key, op.id);
            }
          } catch (rollbackErr) {
            console.error(`Lỗi khi rollback operation cho ${op.key}:${op.id}`, rollbackErr);
          }
        }
      }
      
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      const message = err instanceof Error ? err.message : 'Lỗi kết nối hoặc ràng buộc dữ liệu';
      const errorMsg = `LỖI ĐỒNG BỘ DỮ LIỆU: ${message}`;
      dispatch({ type: 'SET_SYNC_ERRORS', payload: [errorMsg] });

      if (isNetworkSyncError(err)) {
        for (const u of updates) {
          if (shouldUseInventoryRpc && u.key === 'posProducts') continue;
          if (shouldUseInventoryRpc && u.key === 'inventoryTransactions') {
            await enqueueOp({
              opType: u.isDelete ? 'inventoryDelete' : 'inventoryApply',
              dataKey: u.key as string,
              payload: u.isDelete ? { id: u.item.id } : u.item,
            });
            continue;
          }
          await enqueueOp({
            opType: u.isDelete ? 'deleteItem' : 'upsertItem',
            dataKey: u.key as string,
            payload: u.isDelete ? { id: u.item.id } : u.item,
          });
        }
      } else {
        throw err;
      }
    } finally { dispatch({ type: 'SET_SYNCING', payload: false }); }
  }, [state.data, enqueueOp]);

  const pushBatch = useCallback(async <K extends keyof AppData>(key: K, items: Extract<AppData[K], unknown[]>) => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    
    // Update Local State & Storage first (luôn thành công dù offline)
    const cachedData = await loadCachedDataSnapshot();
    const currentLocalData: Record<string, unknown> = { ...state.data, ...(cachedData || {}) };
    const existingItems = Array.isArray(currentLocalData[key]) ? currentLocalData[key] : [];
    const existingList = [...existingItems];
    
    // Merge new items into existing list (by ID)
    const itemMap = new Map(existingList.filter(isIdentifiableItem).map((item) => [item.id, item] as const));
    (items as unknown[]).filter(isIdentifiableItem).forEach((item) => itemMap.set(item.id, item));
    const newList = Array.from(itemMap.values());
    
    dispatch({ type: 'SET_DATA', payload: { [key]: newList } });
    await saveDataSnapshot({ ...currentLocalData, [key]: newList } as Partial<AppData>);

    try {
      if (TABLE_MAP[key as string]) {
        await apiService.upsertMany(key, items);
      }
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: unknown) {
      console.error(`Error pushing batch to ${key}:`, err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      // === Offline Queue: lưu vào IndexedDB để retry sau ===
      if (isNetworkSyncError(err)) {
        await enqueueOp({ opType: 'pushBatch', dataKey: key as string, payload: items });
      } else {
        const newCount = incrementPending();
        setPendingCount(newCount);
      }
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, [state.data, enqueueOp]);

  const silentSync = useCallback(() => fetchData(true, true), [fetchData]);

  // Cleanup: Ensure categories are moved to their correct root parents
  useEffect(() => {
    if (!data.expenseCategories || data.expenseCategories.length === 0) return;
    
    let hasChanges = false;
    const updatedCategories = data.expenseCategories.map(cat => {
      const nameLower = cat.name.toLowerCase();
      
      // 1. Skip the root categories themselves to avoid circular parenting or invalid state
      if (['cat-fixed', 'cat-variable', 'cat-depreciation-root', 'cat-interest-root'].includes(cat.id)) {
        return cat;
      }

      // 2. Salary logic: Move salary-related items from Fixed to Variable
      const isSalary = ['Lương cơ bản', 'Hoa hồng', 'Thưởng doanh số', 'Lương nhân viên', 'Lương & Thưởng', 'Thu nhập nhân sự (Biến đổi)'].includes(cat.name) || nameLower.includes('lương');
      if (isSalary && cat.parentId && cat.parentId.startsWith('cat-fixed')) {
        hasChanges = true;
        return { ...cat, parentId: 'cat-variable' };
      }

      // 3. Interest logic: Ensure all interest-related categories are under the Interest root
      if (nameLower.includes('lãi vay') && cat.parentId !== 'cat-interest-root') {
        hasChanges = true;
        return { ...cat, parentId: 'cat-interest-root' };
      }

      // 4. Depreciation logic: Ensure all depreciation-related categories are under the Depreciation root
      if (nameLower.includes('khấu hao') && cat.parentId !== 'cat-depreciation-root') {
        hasChanges = true;
        return { ...cat, parentId: 'cat-depreciation-root' };
      }

      return cat;
    });

    if (hasChanges) {
      updateData('expenseCategories', updatedCategories);
    }
  }, [data.expenseCategories, updateData]);

  return {
    data,
    activeTab,
    setActiveTab,
    brandProfile,
    setBrandProfile,
    chatMessages,
    setChatMessages,
    isSyncing,
    isCloudConnected,
    showResigned,
    setShowResigned,
    diagnosisRange,
    setDiagnosisRange,
    diagStartDate,
    setDiagStartDate,
    diagEndDate,
    setDiagEndDate,
    suggestedFocusProducts,
    breakEvenAnalysis,
    fetchData,
    silentSync,
    updateData,
    updateSurgical,
    pushBatch,
    syncErrors,
    lastSyncTime,
    pendingCount,
    // === Offline Queue ===
    offlinePendingCount,
    drainQueue,
    isDraining,
  };
}
