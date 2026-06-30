import { useEffect, useMemo, useCallback, useReducer, useState, useRef } from 'react';
import {
  AppData,
  AppDataItem,
  AppDataSurgicalUpdate,
  ChatMessage,
  BrandProfile,
  DiagnosisRange,
  ShopeeInventoryOutRecord,
  RevenueRecord,
  RevenueDelta,
} from '../types';
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
import { markLocalWrite } from './useRealtimeSync';

const localTodayStr = new Date().toLocaleDateString('sv-SE');
type IdentifiableItem = { id: string };
type SyncableDataKey =
  | 'revenue'
  | 'expenses'
  | 'payroll'
  | 'employees'
  | 'salaryPolicies'
  | 'attendance'
  | 'overtime'
  | 'sales'
  | 'shortages'
  | 'advances'
  | 'staffPerformance'
  | 'knowledgeBase'
  | 'promotions'
  | 'shopeeRevenue'
  | 'shopeeProductGroupRevenue'
  | 'shopeeSourceData'
  | 'shopeeInventoryIn'
  | 'shopeeInventoryOut'
  | 'posProducts'
  | 'posOrders'
  | 'posCustomers'
  | 'inventoryTransactions'
  | 'suppliers'
  | 'supplierDebts'
  | 'productGroups'
  | 'productGroupRevenue'
  | 'cashflow'
  | 'recurringExpenses'
  | 'customerDebtHistory';
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
const CONFIG_OVERRIDES_STORAGE_KEY = 'cfo_brain_config_overrides';

const isIdentifiableItem = (item: unknown): item is IdentifiableItem =>
  typeof item === 'object' &&
  item !== null &&
  'id' in item &&
  typeof (item as { id?: unknown }).id === 'string';

function buildSurgicalRollbackUpdates(
  data: AppData,
  updates: AppDataSurgicalUpdate[]
): AppDataSurgicalUpdate[] {
  const rollback: AppDataSurgicalUpdate[] = [];
  for (const update of updates) {
    if (!isIdentifiableItem(update.item)) continue;
    const currentList = Array.isArray(data[update.key]) ? data[update.key] : [];
    const existing = currentList.find(item => isIdentifiableItem(item) && item.id === update.item.id);

    if (update.isDelete) {
      if (existing) rollback.push({ key: update.key, item: existing } as AppDataSurgicalUpdate);
    } else if (existing) {
      rollback.push({ key: update.key, item: existing } as AppDataSurgicalUpdate);
    } else {
      rollback.push({
        key: update.key,
        item: { id: update.item.id },
        isDelete: true,
      } as AppDataSurgicalUpdate);
    }
  }
  return rollback.reverse();
}

function applySurgicalUpdatesToSnapshot(
  data: Partial<AppData>,
  updates: AppDataSurgicalUpdate[]
): Partial<AppData> {
  const nextData: Record<string, unknown> = { ...data };
  for (const update of updates) {
    if (!isIdentifiableItem(update.item)) continue;
    const key = update.key as string;
    const existingItems = Array.isArray(nextData[key]) ? [...nextData[key] as IdentifiableItem[]] : [];
    const idx = existingItems.findIndex(item => item.id === update.item.id);
    if (update.isDelete) {
      if (idx > -1) existingItems.splice(idx, 1);
    } else if (idx > -1) {
      existingItems[idx] = { ...existingItems[idx], ...update.item };
    } else {
      existingItems.push(update.item as IdentifiableItem);
    }
    nextData[key] = existingItems;
  }
  return nextData as Partial<AppData>;
}

const isSystemKnowledgeArticle = (item: unknown) =>
  isIdentifiableItem(item) && item.id.startsWith('system-doc-');

function sanitizeAppDataSnapshot<T extends Partial<AppData> | AppData>(data: T): T {
  if (!Array.isArray(data.knowledgeBase)) return data;
  const knowledgeBase = data.knowledgeBase.filter(item => !isSystemKnowledgeArticle(item));
  if (knowledgeBase.length === data.knowledgeBase.length) return data;
  return { ...data, knowledgeBase } as T;
}

const SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 phút
const SYNC_LAST_KEY = 'cfo_brain_last_cloud_sync';

function isSyncOnCooldown(): boolean {
  const last = Number(localStorage.getItem(SYNC_LAST_KEY) || 0);
  return Date.now() - last < SYNC_COOLDOWN_MS;
}

function markSyncDone() {
  localStorage.setItem(SYNC_LAST_KEY, String(Date.now()));
}

const LOCAL_STORAGE_DROPPED_KEYS: (keyof AppData)[] = [
  'posProducts',
  'posOrders',
  'inventoryTransactions',
  'productGroupRevenue',
  'shopeeSourceData',
];

function stripHeavyKnowledgeFields<T extends Partial<AppData> | AppData>(data: T): T {
  if (!Array.isArray(data.knowledgeBase)) return data;

  return {
    ...data,
    knowledgeBase: data.knowledgeBase.map(item => ({
      ...item,
      sourceFileData: undefined,
    })),
  } as T;
}

function makeLocalStorageSnapshot(data: Partial<AppData> | AppData): Partial<AppData> {
  const snapshot = { ...stripHeavyKnowledgeFields(data) } as Partial<AppData>;
  for (const key of LOCAL_STORAGE_DROPPED_KEYS) {
    delete snapshot[key];
  }
  return snapshot;
}

// localStorage stringify là thao tác đồng bộ, nếu ghi snapshot lớn có thể khóa tab.
// Chỉ lưu bản nhẹ để fallback nhanh; bản đầy đủ lưu ở IndexedDB.
function safeLocalStorageSet(key: string, data: Partial<AppData> | AppData) {
  const lightSnapshot = makeLocalStorageSnapshot(data);
  try {
    localStorage.setItem(key, JSON.stringify(lightSnapshot));
  } catch (e: unknown) {
    const storageError = e as { name?: string; code?: number };
    if (storageError.name === 'QuotaExceededError' || storageError.code === 22) {
      console.error('[Storage] Quota exceeded — bỏ qua localStorage snapshot nhẹ');
      try {
        localStorage.removeItem(key);
      } catch {
        // Nếu vẫn không được, bỏ qua — data an toàn trên IndexedDB/cloud
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
    return sanitizeAppDataSnapshot(JSON.parse(localDataStr) as Partial<AppData>);
  } catch (error) {
    console.error('[Storage] Lỗi đọc localStorage cache:', error);
    return null;
  }
}

async function loadCachedDataSnapshot(): Promise<Partial<AppData> | null> {
  try {
    const indexedDbData = await appDataCache.getDataSnapshot();
    return indexedDbData ? sanitizeAppDataSnapshot(indexedDbData) : parseLocalStorageData();
  } catch (error) {
    console.error('[Cache] Lỗi đọc IndexedDB snapshot:', error);
    return parseLocalStorageData();
  }
}

async function saveDataSnapshot(data: Partial<AppData> | AppData): Promise<void> {
  const snapshot = sanitizeAppDataSnapshot(
    stripHeavyKnowledgeFields({ ...INITIAL_APP_DATA, ...data } as AppData)
  );
  safeLocalStorageSet('cfo_brain_local_data', snapshot);
  try {
    await appDataCache.saveDataSnapshot(snapshot);
  } catch (error) {
    console.error('[Cache] Lỗi lưu IndexedDB snapshot:', error);
  }
}

function loadConfigOverrides(): Partial<Pick<AppData, ConfigDataKey>> {
  try {
    const raw = localStorage.getItem(CONFIG_OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('[Storage] Lỗi đọc config overrides:', error);
    return {};
  }
}

function saveConfigOverride<K extends ConfigDataKey>(key: K, value: AppData[K]) {
  try {
    const current = loadConfigOverrides();
    localStorage.setItem(
      CONFIG_OVERRIDES_STORAGE_KEY,
      JSON.stringify({ ...current, [key]: value })
    );
  } catch (error) {
    console.error(`[Storage] Lỗi lưu config override [${key}]:`, error);
  }
}

const isNetworkSyncError = (err: unknown) =>
  (typeof navigator !== 'undefined' && !navigator.onLine) ||
  String(err instanceof Error ? err.message : err)
    .toLowerCase()
    .includes('fetch') ||
  String(err instanceof Error ? err.message : err)
    .toLowerCase()
    .includes('network');

// Lỗi nên GIỮ write local + enqueue retry (KHÔNG xóa dữ liệu): mất mạng, hết phiên đăng nhập
// (401 — hay gặp khi chạy qua tunnel, session chưa/đã hết hạn), hoặc lỗi server tạm thời (5xx/429/timeout).
// Chỉ lỗi dữ liệu thực sự (400/409/422...) mới rollback + throw để báo người dùng.
const isRetryableSyncError = (err: unknown): boolean => {
  if (isNetworkSyncError(err)) return true;
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    msg.includes('401') ||
    msg.includes('unauthorized') ||
    msg.includes('timeout') ||
    msg.includes('429') ||
    /\(5\d\d\)/.test(msg)
  );
};

const canReachLocalServer = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return true;
  try {
    const res = await fetch('/health', { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
};

const normalizeActiveTab = (tab: string) => (tab === 'dashboard' ? 'overview' : tab);

const getInitialTab = () => {
  const path = window.location.pathname.replace(/^\//, '').trim();
  return normalizeActiveTab(path || 'pos');
};

const initialState: AppState = {
  data: INITIAL_APP_DATA,
  activeTab: getInitialTab(),
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
  isDataReady: false,
};

export function useAppData() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [pendingCount, setPendingCount] = useState(() => getPendingCount());

  // === Offline Queue (IndexedDB) ===
  const { offlinePendingCount, offlineOrderPendingCount, enqueueOp, drainQueue, isDraining } =
    useOfflineSync();

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
    lastSyncTime,
  } = state;

  const setActiveTab = useCallback(
    (tab: string) => dispatch({ type: 'SET_ACTIVE_TAB', payload: normalizeActiveTab(tab) }),
    []
  );
  const setBrandProfile = useCallback(
    (profile: BrandProfile) => dispatch({ type: 'SET_BRAND_PROFILE', payload: profile }),
    []
  );
  const setChatMessages = useCallback(
    (messages: ChatMessage[]) => dispatch({ type: 'SET_CHAT_MESSAGES', payload: messages }),
    []
  );
  const setShowResigned = useCallback(
    (show: boolean) => dispatch({ type: 'SET_SHOW_RESIGNED', payload: show }),
    []
  );
  const setDiagnosisRange = useCallback(
    (range: DiagnosisRange) => dispatch({ type: 'SET_DIAGNOSIS_RANGE', payload: range }),
    []
  );
  const setDiagStartDate = useCallback(
    (date: string) => dispatch({ type: 'SET_DIAG_START_DATE', payload: date }),
    []
  );
  const setDiagEndDate = useCallback(
    (date: string) => dispatch({ type: 'SET_DIAG_END_DATE', payload: date }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const refreshReachability = async () => {
      const reachable = await canReachLocalServer();
      if (!cancelled) {
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: reachable });
      }
    };

    refreshReachability();
    const intervalId = window.setInterval(refreshReachability, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

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
    // Filter trước (O(n)) rồi sort 30 records (O(30 log 30)) thay vì sort toàn bộ O(n log n)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('sv-SE');
    const last30DaysRevenue = data.revenue
      .filter(r => r.date >= thirtyDaysAgoStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    const avgGrossMargin =
      last30DaysRevenue.length > 0
        ? last30DaysRevenue.reduce((sum, r) => {
            const rev = (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
            const margin = rev > 0 ? (Number(r.grossProfit) || 0) / rev : 0;
            return sum + margin;
          }, 0) / last30DaysRevenue.length
        : 0.3;

    const dailyBreakEvenRevenue = avgGrossMargin > 0 ? dailyFixedCost / avgGrossMargin : 0;

    const todayStr = now.toLocaleDateString('sv-SE');
    const todayRevRec = data.revenue.find(r => r.date === todayStr);
    const todayRevenue = todayRevRec
      ? (Number(todayRevRec.netRevenue) || 0) + (Number(todayRevRec.revenueOther) || 0)
      : 0;

    return {
      dailyFixedCost,
      avgGrossMargin,
      dailyBreakEvenRevenue,
      todayRevenue,
      progress: dailyBreakEvenRevenue > 0 ? (todayRevenue / dailyBreakEvenRevenue) * 100 : 0,
      isProfitable: todayRevenue > dailyBreakEvenRevenue && dailyBreakEvenRevenue > 0,
    };
  }, [data.payroll, data.expenses, data.revenue]);

  const fetchData = useCallback(async (isManual = false, silent = false) => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      let localData = await loadCachedDataSnapshot();
      const configOverrides = loadConfigOverrides();
      if (Object.keys(configOverrides).length > 0) {
        localData = { ...(localData || {}), ...configOverrides };
      }
      // Manual sync luôn fetch lại posProducts để nhận thay đổi từ DB (tên, giá, v.v.)
      const skipPosProducts =
        !isManual &&
        Array.isArray(localData?.posProducts) && localData.posProducts.length > 0;

      const browserReportsOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (browserReportsOffline && !(await canReachLocalServer())) {
        const offlineMessage = 'Đang offline — dùng dữ liệu cache, bỏ qua tải cloud.';
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
        dispatch({ type: 'SET_SYNC_ERRORS', payload: [offlineMessage] });
        if (localData) dispatch({ type: 'SET_DATA', payload: localData });
        return;
      }

      // Cooldown 10 phút: bỏ qua fetch cloud nếu vừa sync gần đây (trừ khi user bấm thủ công)
      if (!isManual && isSyncOnCooldown()) {
        if (localData) dispatch({ type: 'SET_DATA', payload: localData });
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
        return;
      }

      // Timeout 45s — shopee_inventory_out được fetch riêng (lazy) nên main load nhẹ hơn
      const FETCH_TIMEOUT_MS = 45_000;
      const fetchWithTimeout = Promise.race([
        apiService.fetchAllData({ skipPosProducts }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Đồng bộ quá thời gian — kiểm tra kết nối mạng')), FETCH_TIMEOUT_MS)
        ),
      ]);
      const { data: results, errors } = await fetchWithTimeout;
      const hasFetchErrors = !!errors?.length;
      dispatch({ type: 'SET_SYNC_ERRORS', payload: errors });

      if (hasFetchErrors) {
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      } else {
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      }

      if (results.brandProfile) {
        // Nếu Supabase trả null cho phone/address, ưu tiên dữ liệu từ IndexedDB
        // (IndexedDB được cập nhật mỗi khi user gõ qua debounce auto-save,
        //  khác với localStorage chỉ được ghi khi Supabase trả về data).
        const cachedBrandForMerge = await appDataCache.getBrandProfile();
        const serverRaw = {
          ...results.brandProfile,
          phone: results.brandProfile.phone ?? cachedBrandForMerge?.phone,
          address: results.brandProfile.address ?? cachedBrandForMerge?.address,
        };
        const mappedBrand = dataMapper.mapBrandProfile(serverRaw);
        brandFromServerRef.current = true;
        dispatch({ type: 'SET_BRAND_PROFILE', payload: mappedBrand });
        localStorage.setItem('cfo_brain_brand_profile', JSON.stringify(mappedBrand));
        await appDataCache.saveBrandProfile(mappedBrand);
      } else {
        const localBrand = localStorage.getItem('cfo_brain_brand_profile');
        const cachedBrand = await appDataCache.getBrandProfile();
        if (cachedBrand) {
          brandFromServerRef.current = true;
          dispatch({ type: 'SET_BRAND_PROFILE', payload: cachedBrand });
        } else if (localBrand) {
          brandFromServerRef.current = true;
          dispatch({ type: 'SET_BRAND_PROFILE', payload: JSON.parse(localBrand) });
        }
      }

      const newState = sanitizeAppDataSnapshot(dataMapper.mapAllData(results, localData));

      // "Sync Force" - Push local gaps to Cloud when triggered manually (e.g. Refresh button)
      if (isManual && !hasFetchErrors) {
        let totalPushed = 0;
        let totalErrors = 0;
        const pushErrors: string[] = [];

        const allSyncConfigs: Array<{
          key: SyncableDataKey;
          cloud: unknown[] | undefined;
          matchKey: 'id' | 'date';
        }> = [
          { key: 'revenue', cloud: results.revenue, matchKey: 'date' },
          { key: 'expenses', cloud: results.expenses, matchKey: 'id' },
          { key: 'payroll', cloud: results.payroll, matchKey: 'id' },
          { key: 'employees', cloud: results.employees, matchKey: 'id' },
          { key: 'salaryPolicies', cloud: results.policies, matchKey: 'id' },
          { key: 'attendance', cloud: results.attendance, matchKey: 'id' },
          { key: 'overtime', cloud: results.overtime, matchKey: 'id' },
          { key: 'sales', cloud: results.sales, matchKey: 'id' },
          { key: 'shortages', cloud: results.shortages, matchKey: 'id' },
          { key: 'advances', cloud: results.advances, matchKey: 'id' },
          { key: 'staffPerformance', cloud: results.perf, matchKey: 'id' },
          { key: 'knowledgeBase', cloud: results.kb, matchKey: 'id' },
          { key: 'promotions', cloud: results.promotions, matchKey: 'id' },
          { key: 'shopeeRevenue', cloud: results.shopeeRevenue, matchKey: 'date' },
          {
            key: 'shopeeProductGroupRevenue',
            cloud: results.shopeeProductGroupRevenue,
            matchKey: 'id',
          },
          { key: 'shopeeSourceData', cloud: results.shopeeSourceData, matchKey: 'id' },
          { key: 'shopeeInventoryIn', cloud: results.shopeeInventoryIn, matchKey: 'id' },
          { key: 'shopeeInventoryOut', cloud: results.shopeeInventoryOut, matchKey: 'id' },
          { key: 'posProducts', cloud: results.posProducts, matchKey: 'id' },
          { key: 'posOrders', cloud: results.posOrders, matchKey: 'id' },
          { key: 'posCustomers', cloud: results.posCustomers, matchKey: 'id' },
          { key: 'inventoryTransactions', cloud: results.inventoryTransactions, matchKey: 'id' },
          { key: 'suppliers', cloud: results.suppliers, matchKey: 'id' },
          { key: 'supplierDebts', cloud: results.supplierDebts, matchKey: 'id' },
          { key: 'productGroups', cloud: results.pGroups, matchKey: 'id' },
          { key: 'productGroupRevenue', cloud: results.pGroupRev, matchKey: 'id' },
          { key: 'cashflow', cloud: results.cashflow, matchKey: 'id' },
          { key: 'recurringExpenses', cloud: results.recurringExpenses, matchKey: 'id' },
          { key: 'customerDebtHistory', cloud: results.customerDebtHistory, matchKey: 'id' },
        ];
        const syncConfigs = allSyncConfigs.filter(
          config => !(skipPosProducts && config.key === 'posProducts')
        );

        for (const config of syncConfigs) {
          const cloudItems = (config.cloud || []).filter(
            (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
          );
          const cloudKeys = new Set(cloudItems.map(item => item[config.matchKey]));
          const localValue = newState[config.key];
          const localItems = Array.isArray(localValue)
            ? (localValue as unknown[]).filter(
                (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
              )
            : [];
          const missingOnCloud = localItems.filter(
            item =>
              !cloudKeys.has(item[config.matchKey]) &&
              !(config.key === 'knowledgeBase' && isSystemKnowledgeArticle(item))
          );

          if (missingOnCloud.length > 0) {
            try {
              // Validate each item before pushing
              const validItems = missingOnCloud.filter(item => {
                const errors = validationService.validate(config.key, item);
                if (errors.length > 0) {
                  totalErrors++;
                  pushErrors.push(
                    `${config.key}: ID ${String(item.id || item.date || 'unknown')} - ${errors[0].message}`
                  );
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
            if (pushErrors.length > 0)
              msg += `\n\nChi tiết lỗi:\n${pushErrors.slice(0, 5).join('\n')}${pushErrors.length > 5 ? '\n...' : ''}`;
            alert(msg);
          } else {
            alert('Dữ liệu đã đồng nhất hoàn toàn với Cloud.');
          }
        }
      }

      dispatch({ type: 'SET_DATA', payload: newState });
      await saveDataSnapshot(newState);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: !hasFetchErrors });

      if (!hasFetchErrors) markSyncDone();

      // Tự động tính lại COGS từ pos_orders sau mỗi lần sync, tối đa 1 lần/giờ
      if (!hasFetchErrors) {
        const COGS_RECALC_KEY = 'cogs_recalc_last_run';
        const lastRun = Number(localStorage.getItem(COGS_RECALC_KEY) || 0);
        if (Date.now() - lastRun > 60 * 60 * 1000) {
          localStorage.setItem(COGS_RECALC_KEY, String(Date.now()));
          fetch('/api/analytics/recalculate-cogs', { method: 'POST' })
            .then(r => r.ok && appDataCache.clearDataKeys(['revenue']))
            .catch(() => {}); // fire-and-forget, không block UI
        }
      }

      // Lazy-load shopee_inventory_out sau khi data chính đã hiển thị
      if (!hasFetchErrors) {
        apiService.fetchShopeeInventoryOut().then(({ data: rawRows }) => {
          if (!rawRows?.length) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped = rawRows.map((r: any) => ({
            id: r.id as string,
            date: (r.date ?? '') as string,
            status: (r.status ?? 'OK') as ShopeeInventoryOutRecord['status'],
            orderId: (r.order_id ?? r.orderId ?? '') as string,
            sku: (r.sku ?? '') as string,
            quantity: Number(r.quantity ?? 0),
            salePrice: Number(r.sale_price ?? r.salePrice ?? 0),
            platformFee: Number(r.platform_fee ?? r.platformFee ?? 0),
            paymentFee: Number(r.payment_fee ?? r.paymentFee ?? 0),
            freeshipExtra: Number(r.freeship_extra ?? r.freeshipExtra ?? 0),
            affiliateFee: Number(r.affiliate_fee ?? r.affiliateFee ?? 0),
            handlingFee: Number(r.handling_fee ?? r.handlingFee ?? 0),
            pishipFee: Number(r.piship_fee ?? r.pishipFee ?? 0),
            vatTax: Number(r.vat_tax ?? r.vatTax ?? 0),
            adsCost: Number(r.ads_cost ?? r.adsCost ?? 0),
            adsTax: Number(r.ads_tax ?? r.adsTax ?? 0),
            personalIncomeTax: Number(r.personal_income_tax ?? r.personalIncomeTax ?? 0),
            netProfit: Number(r.net_profit ?? r.netProfit ?? 0),
            customerPaid: Number(r.customer_paid ?? r.customerPaid ?? r.sale_price ?? r.salePrice ?? 0),
            address: (r.address ?? '') as string,
            shippingUnit: (r.shipping_unit ?? r.shippingUnit ?? '') as string,
            platform: (r.platform ?? 'Shopee 2') as string,
            productName: (r.product_name ?? r.productName ?? '') as string,
            trackingNumber: (r.tracking_number ?? r.trackingNumber ?? r.order_id ?? r.orderId ?? '') as string,
            shipDate: (r.ship_date ?? r.shipDate ?? r.date ?? '') as string,
            profitStatus: (r.profit_status ?? r.profitStatus ?? '') as string,
          }));
          dispatch({ type: 'SET_DATA', payload: { shopeeInventoryOut: mapped } });
        }).catch(() => { /* silent — không block UI */ });
      }
      if (!hasFetchErrors) {
        localStorage.removeItem(CONFIG_OVERRIDES_STORAGE_KEY);
        clearPending();
        setPendingCount(0);
        dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
      }
    } catch (err: unknown) {
      console.error('Lỗi đồng bộ Supabase:', err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      const cachedData = await loadCachedDataSnapshot();
      if (cachedData) dispatch({ type: 'SET_DATA', payload: cachedData });
      const message = err instanceof Error ? err.message : 'Kiểm tra kết nối và cấu trúc bảng';
      dispatch({ type: 'SET_SYNC_ERRORS', payload: [`LỖI ĐỒNG BỘ: ${message}`] });
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
        dispatch({ type: 'SET_DATA', payload: { ...cachedData, ...loadConfigOverrides() } });
      }

      if (cachedBrand) {
        brandFromServerRef.current = true;
        dispatch({ type: 'SET_BRAND_PROFILE', payload: cachedBrand });
      } else {
        const localBrand = localStorage.getItem('cfo_brain_brand_profile');
        if (localBrand) {
          brandFromServerRef.current = true;
          dispatch({ type: 'SET_BRAND_PROFILE', payload: JSON.parse(localBrand) });
        }
      }

      fetchData();
    };

    hydrateThenSync();

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const brandSaveReadyRef = useRef(false);
  const brandFromServerRef = useRef(false);
  useEffect(() => {
    if (!brandSaveReadyRef.current) {
      brandSaveReadyRef.current = true;
      return;
    }
    if (brandFromServerRef.current) {
      brandFromServerRef.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await apiService.upsertItem('brandProfile', brandProfile);
        await appDataCache.saveBrandProfile(brandProfile);
        dispatch({ type: 'SET_SYNC_ERRORS', payload: null });
      } catch (e) {
        console.error('Brand sync error:', e);
        const msg = e instanceof Error ? e.message : 'Không thể lưu hồ sơ cửa hàng';
        dispatch({ type: 'SET_SYNC_ERRORS', payload: [`LỖI LƯU HỒ SƠ CỬA HÀNG: ${msg}`] });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [brandProfile]);

  const updateData = useCallback(
    async <K extends keyof AppData>(key: K, newList: AppData[K], idToRemove?: string) => {
      // Ensure unique IDs to prevent Supabase errors
      const uniqueList = (() => {
        if (!Array.isArray(newList)) return newList;
        const arrayItems = newList as unknown[];
        if (!arrayItems.every(isIdentifiableItem)) return newList;
        return Array.from(new Map(arrayItems.map(item => [item.id, item] as const)).values());
      })();

      dispatch({ type: 'SET_DATA', payload: { [key]: uniqueList } });

      if (CONFIG_DATA_KEYS.has(key)) {
        saveConfigOverride(key as ConfigDataKey, uniqueList as AppData[ConfigDataKey]);
        dispatch({ type: 'SET_SYNCING', payload: true });
        try {
          await apiService.upsertConfig(CONFIG_KEY_MAP[key as ConfigDataKey], uniqueList);
          dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
          dispatch({ type: 'SET_SYNC_ERRORS', payload: null });
          dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
        } catch (err: unknown) {
          console.error(`Error updating config ${key}:`, err);
          dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
          const message = err instanceof Error ? err.message : 'Lỗi không xác định';
          dispatch({ type: 'SET_SYNC_ERRORS', payload: [`LỖI ĐỒNG BỘ [${key}]: ${message}`] });
        } finally {
          dispatch({ type: 'SET_SYNCING', payload: false });
        }
        return;
      }

      // Get current data from localStorage to avoid dependency on 'data' state
      const currentLocalData = (await loadCachedDataSnapshot()) || {};
      const nextLocalData = { ...currentLocalData, [key]: uniqueList };
      await saveDataSnapshot(nextLocalData);

      dispatch({ type: 'SET_SYNCING', payload: true });
      try {
        if (idToRemove) {
          // Chỉ xóa item được chỉ định — không upsert lại toàn bộ list (tránh write amplification)
          await apiService.deleteItem(key, idToRemove);
        } else if (Array.isArray(newList) && newList.length === 0 && TABLE_MAP[key as string]) {
          await apiService.clearTable(key);
        } else if (
          uniqueList &&
          Array.isArray(uniqueList) &&
          uniqueList.length > 0 &&
          TABLE_MAP[key as string]
        ) {
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
        // DON'T throw - data is already saved locally
        // throw err;
      } finally {
        dispatch({ type: 'SET_SYNCING', payload: false });
      }
    },
    []
  );

  const mergeRemoteUpdate = useCallback(async (updates: AppDataSurgicalUpdate[]) => {
    dispatch({ type: 'UPDATE_SURGICAL', payload: updates });
    try {
      const cachedData = await loadCachedDataSnapshot();
      const currentLocalData: Record<string, unknown> = { ...(cachedData || {}) };
      for (const u of updates) {
        const key = u.key as string;
        const existingItems = Array.isArray(currentLocalData[key]) ? currentLocalData[key] : [];
        const newList = [...(existingItems as unknown[])];
        const idx = newList.findIndex(item => (item as { id?: string })?.id === u.item.id);
        if (u.isDelete) { if (idx > -1) newList.splice(idx, 1); }
        else { if (idx > -1) newList[idx] = { ...newList[idx] as object, ...u.item }; else newList.push(u.item); }
        currentLocalData[key] = newList;
      }
      await saveDataSnapshot(currentLocalData as Partial<AppData>);
    } catch (e) { console.error('[Realtime] IndexedDB sync error:', e); }
  }, []);

  // Reload shopeeInventoryOut từ Supabase vào local state (không write lại Supabase)
  const loadInventoryOut = useCallback(async () => {
    try {
      const { data: rawRows } = await apiService.fetchShopeeInventoryOut();
      if (!rawRows?.length) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = rawRows.map((r: any) => ({
        id: r.id as string,
        date: (r.date ?? '') as string,
        status: (r.status ?? 'OK') as AppData['shopeeInventoryOut'][number]['status'],
        orderId: (r.order_id ?? r.orderId ?? '') as string,
        sku: (r.sku ?? '') as string,
        quantity: Number(r.quantity ?? 0),
        salePrice: Number(r.sale_price ?? r.salePrice ?? 0),
        platformFee: Number(r.platform_fee ?? r.platformFee ?? 0),
        paymentFee: Number(r.payment_fee ?? r.paymentFee ?? 0),
        freeshipExtra: Number(r.freeship_extra ?? r.freeshipExtra ?? 0),
        affiliateFee: Number(r.affiliate_fee ?? r.affiliateFee ?? 0),
        handlingFee: Number(r.handling_fee ?? r.handlingFee ?? 0),
        pishipFee: Number(r.piship_fee ?? r.pishipFee ?? 0),
        vatTax: Number(r.vat_tax ?? r.vatTax ?? 0),
        adsCost: Number(r.ads_cost ?? r.adsCost ?? 0),
        adsTax: Number(r.ads_tax ?? r.adsTax ?? 0),
        personalIncomeTax: Number(r.personal_income_tax ?? r.personalIncomeTax ?? 0),
        netProfit: Number(r.net_profit ?? r.netProfit ?? 0),
        customerPaid: Number(r.customer_paid ?? r.customerPaid ?? r.sale_price ?? r.salePrice ?? 0),
        address: (r.address ?? '') as string,
        shippingUnit: (r.shipping_unit ?? r.shippingUnit ?? '') as string,
        platform: (r.platform ?? 'Shopee 2') as string,
        productName: (r.product_name ?? r.productName ?? '') as string,
        trackingNumber: (r.tracking_number ?? r.trackingNumber ?? r.order_id ?? r.orderId ?? '') as string,
        shipDate: (r.ship_date ?? r.shipDate ?? r.date ?? '') as string,
        profitStatus: (r.profit_status ?? r.profitStatus ?? '') as string,
      }));
      dispatch({ type: 'SET_DATA', payload: { shopeeInventoryOut: mapped } });
    } catch { /* silent — không block UI */ }
  }, []);

  const updateSurgical = useCallback(
    async (updates: AppDataSurgicalUpdate[]) => {
      // Đánh dấu để useRealtimeSync bỏ qua echo từ Supabase Realtime
      updates.forEach(u => { if ('id' in u.item) markLocalWrite(u.item.id as string); });
      dispatch({ type: 'SET_SYNCING', payload: true });
      const localRollbackUpdates = buildSurgicalRollbackUpdates(state.data, updates);
      dispatch({ type: 'UPDATE_SURGICAL', payload: updates });

      // Durable Save: Update localStorage immediately before Cloud push
      try {
        const cachedData = await loadCachedDataSnapshot();
        const currentLocalData: Record<string, unknown> = { ...state.data, ...(cachedData || {}) };

        for (const u of updates) {
          const key = u.key as string;
          const existingItems = Array.isArray(currentLocalData[key]) ? currentLocalData[key] : [];
          const newList = [...existingItems];
          const idx = newList.findIndex(item => isIdentifiableItem(item) && item.id === u.item.id);
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
        console.error('Local storage sync error:', e);
      }

      const inventoryUpdates = updates.filter(u => u.key === 'inventoryTransactions');
      const hasStockUpdates = updates.some(u => u.key === 'posProducts');
      const shouldUseInventoryRpc = inventoryUpdates.length > 0 && hasStockUpdates;

      // Track successful operations for rollback
      const completedOperations: Array<{
        key: keyof AppData;
        id: string;
        isDelete: boolean;
        previousData?: AppDataItem<keyof AppData> | { id: string };
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
                previousData: inventoryUpdate.item,
              });
            } else {
              await apiService.applyInventoryTransactionWithStock(
                inventoryUpdate.item as AppData['inventoryTransactions'][number]
              );
              completedOperations.push({
                key: inventoryUpdate.key,
                id: inventoryUpdate.item.id,
                isDelete: false,
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
              previousData: u.item,
            });
          } else {
            await apiService.upsertItem(u.key, u.item);
            completedOperations.push({
              key: u.key,
              id: u.item.id,
              isDelete: false,
            });
          }
        }
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
        dispatch({ type: 'SET_SYNC_ERRORS', payload: null });
        dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
      } catch (err: unknown) {
        console.error('LỖI ĐỒNG BỘ SURGICAL:', err);

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

        if (isRetryableSyncError(err)) {
          for (const u of updates) {
            if (shouldUseInventoryRpc && u.key === 'posProducts') continue;
            try {
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
            } catch (enqueueErr) {
              console.error(`[Sync] Lỗi enqueue offline op cho ${u.key}:`, enqueueErr);
            }
          }
        } else {
          if (localRollbackUpdates.length > 0) {
            dispatch({ type: 'UPDATE_SURGICAL', payload: localRollbackUpdates });
            try {
              const cachedData = await loadCachedDataSnapshot();
              const rolledBackSnapshot = applySurgicalUpdatesToSnapshot(
                { ...state.data, ...(cachedData || {}) },
                localRollbackUpdates
              );
              await saveDataSnapshot(rolledBackSnapshot);
            } catch (rollbackCacheErr) {
              console.error('[Sync] Không thể rollback cache local:', rollbackCacheErr);
            }
          }
          throw err;
        }
      } finally {
        dispatch({ type: 'SET_SYNCING', payload: false });
      }
    },
    [state.data, enqueueOp]
  );

  // [DATA-02] Cộng dồn doanh thu theo DELTA atomic — thay read-modify-write ghi đè cả dòng.
  // Local: cập nhật optimistic theo date (giữ id cũ nếu đã có; ngày mới → tạo id và truyền
  //   chính id đó cho RPC → realtime echo khớp id, tránh nhân đôi dòng doanh thu sau resync).
  // Cloud: RPC atomic ON CONFLICT(date) += delta; offline (retryable) → enqueue replay.
  const applyRevenueDelta = useCallback(
    async (dateKey: string, delta: RevenueDelta) => {
      dispatch({ type: 'SET_SYNCING', payload: true });
      try {
        const cachedData = await loadCachedDataSnapshot();
        const currentLocalData: Record<string, unknown> = { ...state.data, ...(cachedData || {}) };
        const existingList: RevenueRecord[] = Array.isArray(currentLocalData.revenue)
          ? (currentLocalData.revenue as RevenueRecord[])
          : [];
        const idx = existingList.findIndex(r => r.date === dateKey);

        let recordId: string;
        let newList: RevenueRecord[];
        if (idx > -1) {
          const cur = existingList[idx];
          recordId = cur.id;
          newList = [...existingList];
          newList[idx] = {
            ...cur,
            totalGrossRevenue: (cur.totalGrossRevenue || 0) + delta.totalGrossRevenue,
            discount: (cur.discount || 0) + delta.discount,
            revenueOther: (cur.revenueOther || 0) + delta.revenueOther,
            returnsValue: (cur.returnsValue || 0) + delta.returnsValue,
            netRevenue: (cur.netRevenue || 0) + delta.netRevenue,
            totalCogs: (cur.totalCogs || 0) + delta.totalCogs,
            grossProfit: (cur.grossProfit || 0) + delta.grossProfit,
          };
        } else {
          recordId = crypto.randomUUID();
          newList = [...existingList, { id: recordId, date: dateKey, ...delta }];
        }

        markLocalWrite(recordId); // bỏ qua echo realtime cho record vừa ghi local
        dispatch({ type: 'SET_DATA', payload: { revenue: newList } });
        await saveDataSnapshot({ ...currentLocalData, revenue: newList } as Partial<AppData>);

        try {
          await apiService.applyRevenueDelta(recordId, dateKey, delta);
          dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
          dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
        } catch (err: unknown) {
          if (isRetryableSyncError(err)) {
            await enqueueOp({
              opType: 'revenueDelta',
              dataKey: 'revenue',
              payload: { id: recordId, dateKey, delta },
            });
            dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
          } else {
            // Lỗi không retry-được → hoàn local optimistic rồi ném để caller rollback các bước trước
            dispatch({ type: 'SET_DATA', payload: { revenue: existingList } });
            await saveDataSnapshot({ ...currentLocalData, revenue: existingList } as Partial<AppData>);
            throw err;
          }
        }
      } finally {
        dispatch({ type: 'SET_SYNCING', payload: false });
      }
    },
    [state.data, enqueueOp]
  );

  const pushBatch = useCallback(
    async <K extends keyof AppData>(key: K, items: Extract<AppData[K], unknown[]>) => {
      dispatch({ type: 'SET_SYNCING', payload: true });

      // Update Local State & Storage first (luôn thành công dù offline)
      const cachedData = await loadCachedDataSnapshot();
      const currentLocalData: Record<string, unknown> = { ...state.data, ...(cachedData || {}) };
      const existingItems = Array.isArray(currentLocalData[key]) ? currentLocalData[key] : [];
      const existingList = [...existingItems];

      // Merge new items into existing list (by ID)
      const itemMap = new Map(
        existingList.filter(isIdentifiableItem).map(item => [item.id, item] as const)
      );
      (items as unknown[]).filter(isIdentifiableItem).forEach(item => itemMap.set(item.id, item));
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
        if (isRetryableSyncError(err)) {
          await enqueueOp({ opType: 'pushBatch', dataKey: key as string, payload: items });
        } else {
          const newCount = incrementPending();
          setPendingCount(newCount);
        }
      } finally {
        dispatch({ type: 'SET_SYNCING', payload: false });
      }
    },
    [state.data, enqueueOp]
  );

  const silentSync = useCallback(() => fetchData(true, true), [fetchData]);

  // Cleanup: Ensure categories are moved to their correct root parents
  useEffect(() => {
    if (!data.expenseCategories || data.expenseCategories.length === 0) return;

    let hasChanges = false;
    const updatedCategories = data.expenseCategories.map(cat => {
      const nameLower = cat.name.toLowerCase();

      // 1. Skip the root categories themselves to avoid circular parenting or invalid state
      if (
        ['cat-fixed', 'cat-variable', 'cat-depreciation-root', 'cat-interest-root'].includes(cat.id)
      ) {
        return cat;
      }

      // 2. Salary logic: Move salary-related items from Fixed to Variable
      const isSalary =
        [
          'Lương cơ bản',
          'Hoa hồng',
          'Thưởng doanh số',
          'Lương nhân viên',
          'Lương & Thưởng',
          'Thu nhập nhân sự (Biến đổi)',
        ].includes(cat.name) || nameLower.includes('lương');
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
    applyRevenueDelta,
    mergeRemoteUpdate,
    loadInventoryOut,
    pushBatch,
    syncErrors,
    lastSyncTime,
    pendingCount,
    // === Offline Queue ===
    offlinePendingCount,
    offlineOrderPendingCount,
    drainQueue,
    isDraining,
    isDataReady: state.isDataReady,
  };
}
