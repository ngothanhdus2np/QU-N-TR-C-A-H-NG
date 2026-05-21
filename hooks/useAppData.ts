
import { useEffect, useMemo, useCallback, useReducer } from 'react';
import { AppData, ChatMessage, BrandProfile } from '../types';
import { INITIAL_APP_DATA, DEFAULT_POLICIES, DEFAULT_EXPENSE_CATEGORIES } from '../constants/defaultData';
import { DEFAULT_BRAND } from '../constants/marketing';
import { apiService, TABLE_MAP } from '../services/apiService';
import { calculateStrategicSuggestions } from '../businessLogic';
import { dataMapper } from '../services/dataMapper';
import { appReducer } from './appReducer';
import { AppState } from './stateTypes';
import { validationService } from '../services/validationService';

const localTodayStr = new Date().toLocaleDateString('sv-SE');

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

  const setActiveTab = useCallback((tab: any) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }), []);
  const setBrandProfile = useCallback((profile: BrandProfile) => dispatch({ type: 'SET_BRAND_PROFILE', payload: profile }), []);
  const setChatMessages = useCallback((messages: ChatMessage[]) => dispatch({ type: 'SET_CHAT_MESSAGES', payload: messages }), []);
  const setShowResigned = useCallback((show: boolean) => dispatch({ type: 'SET_SHOW_RESIGNED', payload: show }), []);
  const setDiagnosisRange = useCallback((range: any) => dispatch({ type: 'SET_DIAGNOSIS_RANGE', payload: range }), []);
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

  const fetchData = useCallback(async (isManual = false) => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      const { data: results, errors } = await apiService.fetchAllData();
      dispatch({ type: 'SET_SYNC_ERRORS', payload: errors });
      
      if (errors && errors.length > 0) {
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      } else {
        dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      }
      
      const localDataStr = localStorage.getItem('cfo_brain_local_data');
      const localData = localDataStr ? JSON.parse(localDataStr) : null;

      if (results.brandProfile) {
        const mappedBrand = dataMapper.mapBrandProfile(results.brandProfile);
        dispatch({ type: 'SET_BRAND_PROFILE', payload: mappedBrand });
        localStorage.setItem('cfo_brain_brand_profile', JSON.stringify(mappedBrand));
      } else {
        const localBrand = localStorage.getItem('cfo_brain_brand_profile');
        if (localBrand) dispatch({ type: 'SET_BRAND_PROFILE', payload: JSON.parse(localBrand) });
      }
      
      const newState = dataMapper.mapAllData(results, localData);
      
      // "Sync Force" - Push local gaps to Cloud when triggered manually (e.g. Refresh button)
      if (isManual) {
        let totalPushed = 0;
        let totalErrors = 0;
        const pushErrors: string[] = [];

        const syncConfigs = [
          { key: 'revenue', cloud: results.revenue, matchKey: 'date' },
          { key: 'expenses', cloud: results.expenses, matchKey: 'id' },
          { key: 'payroll', cloud: results.payroll, matchKey: 'id' },
          { key: 'employees', cloud: results.employees, matchKey: 'id' },
          { key: 'posProducts', cloud: results.posProducts, matchKey: 'id' },
          { key: 'posOrders', cloud: results.posOrders, matchKey: 'id' },
          { key: 'posCustomers', cloud: results.posCustomers, matchKey: 'id' },
          { key: 'posSuppliers', cloud: results.posSuppliers, matchKey: 'id' },
          { key: 'inventoryTransactions', cloud: results.inventoryTransactions, matchKey: 'id' },
          { key: 'productGroups', cloud: results.pGroups, matchKey: 'id' },
          { key: 'productGroupRevenue', cloud: results.pGroupRev, matchKey: 'id' }
        ];

        console.log("[Sync] Bắt đầu kiểm tra dữ liệu local chưa có trên Cloud...");
        for (const config of syncConfigs) {
          const cloudItems = (config.cloud || []) as any[];
          const cloudKeys = new Set(cloudItems.map((i: any) => i[config.matchKey]));
          const localItems = ((newState as any)[config.key] || []) as any[];
          const missingOnCloud = localItems.filter((i: any) => !cloudKeys.has(i[config.matchKey]));
          
          if (missingOnCloud.length > 0) {
            console.log(`[Sync] Tìm thấy ${missingOnCloud.length} bản ghi mới cho ${config.key}. Đang đẩy lên Cloud...`);
            try {
              // Validate each item before pushing
              const validItems = missingOnCloud.filter(item => {
                const errors = validationService.validate(config.key as any, item);
                if (errors.length > 0) {
                  totalErrors++;
                  pushErrors.push(`${config.key}: ID ${item.id || item.date} - ${errors[0].message}`);
                  return false;
                }
                return true;
              });

              if (validItems.length > 0) {
                await apiService.upsertMany(config.key as any, validItems);
                totalPushed += validItems.length;
              }
            } catch (e: any) {
              totalErrors++;
              pushErrors.push(`Lỗi bảng ${config.key}: ${e.message}`);
              console.error(`[Sync] Lỗi đẩy ${config.key}:`, e);
            }
          }
        }
        
        if (totalPushed > 0 || totalErrors > 0) {
          let msg = `KẾT QUẢ ĐỒNG BỘ:\n- Đã đẩy: ${totalPushed} bản ghi.\n- Bị chặn (lỗi): ${totalErrors} bản ghi.`;
          if (pushErrors.length > 0) msg += `\n\nChi tiết lỗi:\n${pushErrors.slice(0, 5).join('\n')}${pushErrors.length > 5 ? '\n...' : ''}`;
          alert(msg);
        } else {
          alert("Dữ liệu đã đồng nhất hoàn toàn với Cloud.");
        }
      }
      
      dispatch({ type: 'SET_DATA', payload: newState });
      console.log(`Sync Complete. posProducts count: ${newState.posProducts?.length || 0}`);
      localStorage.setItem('cfo_brain_local_data', JSON.stringify(newState));
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: any) {
      console.error("Lỗi đồng bộ Supabase:", err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      const localDataStr = localStorage.getItem('cfo_brain_local_data');
      if (localDataStr) dispatch({ type: 'SET_DATA', payload: JSON.parse(localDataStr) });
      if (isManual) alert(`LỖI ĐỒNG BỘ: ${err.message || "Kiểm tra kết nối và cấu trúc bảng"}`);
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, []); // Removed 'data' dependency to prevent infinite loop

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await apiService.upsertItem('brandProfile' as any, brandProfile);
      } catch (e) {
        console.error("Brand sync error:", e);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [brandProfile]);

  const updateData = useCallback(async (key: keyof AppData, newList: any, idToRemove?: string) => { 
    // Ensure unique IDs to prevent Supabase errors
    const uniqueList = Array.isArray(newList) 
      ? Array.from(new Map(newList.map(item => [item.id, item])).values())
      : newList;

    dispatch({ type: 'SET_DATA', payload: { [key]: uniqueList } });
    
    // Get current data from localStorage to avoid dependency on 'data' state
    const localDataStr = localStorage.getItem('cfo_brain_local_data');
    const currentLocalData = localDataStr ? JSON.parse(localDataStr) : {};
    localStorage.setItem('cfo_brain_local_data', JSON.stringify({ ...currentLocalData, [key]: uniqueList }));
    
    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      if (idToRemove) {
        await apiService.deleteItem(key, idToRemove);
      } else if (Array.isArray(newList) && newList.length === 0 && TABLE_MAP[key as string]) {
        await apiService.clearTable(key);
      }
      
      if (uniqueList && Array.isArray(uniqueList) && uniqueList.length > 0 && TABLE_MAP[key as string]) {
        await apiService.upsertMany(key, uniqueList);
      } else if (['violationTypes', 'violationOccurrences', 'customDeductions', 'holidays', 'responsibilityApprovals', 'tetCampaign', 'expenseCategories', 'shopeeCosts', 'dailyAdsConfig', 'dailyBreakEvenConfig'].includes(key as string)) {
        const configKeys: any = { 
          violationTypes: 'violation_types', 
          violationOccurrences: 'violation_occurrences', 
          customDeductions: 'custom_penalties', 
          holidays: 'holidays', 
          responsibilityApprovals: 'responsibility_approvals', 
          tetCampaign: 'tet_campaign',
          expenseCategories: 'expense_categories',
          shopeeCosts: 'shopee_costs',
          dailyAdsConfig: 'daily_ads_config',
          dailyBreakEvenConfig: 'daily_break_even_config'
        };
        await apiService.upsertConfig(configKeys[key as string], newList);
      }
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_SYNC_ERRORS', payload: null });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: any) { 
      console.error(`Error updating ${key}:`, err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      const errorMsg = `LỖI ĐỒNG BỘ [${key}]: ${err.message || 'Lỗi không xác định'}`;
      dispatch({ type: 'SET_SYNC_ERRORS', payload: [errorMsg] });
      throw err;
    } finally { dispatch({ type: 'SET_SYNCING', payload: false }); }
  }, []);

  const updateSurgical = useCallback(async (updates: { key: keyof AppData, item: any, isDelete?: boolean }[]) => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    dispatch({ type: 'UPDATE_SURGICAL', payload: updates });
    
    // Durable Save: Update localStorage immediately before Cloud push
    try {
      const localDataStr = localStorage.getItem('cfo_brain_local_data');
      let currentLocalData = localDataStr ? JSON.parse(localDataStr) : { ...state.data };
      
      for (const u of updates) {
        const key = u.key as keyof AppData;
        const newList = [...(currentLocalData[key] || [])];
        const idx = newList.findIndex((i: any) => i.id === u.item.id);
        if (u.isDelete) {
          if (idx > -1) newList.splice(idx, 1);
        } else {
          if (idx > -1) newList[idx] = { ...newList[idx], ...u.item };
          else newList.push(u.item);
        }
        currentLocalData[key] = newList;
      }
      localStorage.setItem('cfo_brain_local_data', JSON.stringify(currentLocalData));
    } catch (e) {
      console.error("Local storage sync error:", e);
    }
    
    try {
      for (const u of updates) {
        if (u.isDelete) {
          await apiService.deleteItem(u.key, u.item.id);
        } else {
          await apiService.upsertItem(u.key, u.item);
        }
      }
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_SYNC_ERRORS', payload: null });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: any) {
      console.error("LỖI ĐỒNG BỘ SURGICAL:", err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      const errorMsg = `LỖI ĐỒNG BỘ DỮ LIỆU: ${err.message || 'Lỗi kết nối hoặc ràng buộc dữ liệu'}`;
      dispatch({ type: 'SET_SYNC_ERRORS', payload: [errorMsg] });
      throw err;
    } finally { dispatch({ type: 'SET_SYNCING', payload: false }); }
  }, [state.data]);

  const pushBatch = useCallback(async (key: keyof AppData, items: any[]) => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    
    // Update Local State & Storage first
    const localDataStr = localStorage.getItem('cfo_brain_local_data');
    let currentLocalData = localDataStr ? JSON.parse(localDataStr) : { ...state.data };
    const existingList = [...(currentLocalData[key] || [])];
    
    // Merge new items into existing list (by ID)
    const itemMap = new Map(existingList.map(i => [i.id, i]));
    items.forEach(item => itemMap.set(item.id, item));
    const newList = Array.from(itemMap.values());
    
    dispatch({ type: 'SET_DATA', payload: { [key]: newList } });
    localStorage.setItem('cfo_brain_local_data', JSON.stringify({ ...currentLocalData, [key]: newList }));

    try {
      if (TABLE_MAP[key as string]) {
        await apiService.upsertMany(key, items);
      }
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: true });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err: any) {
      console.error(`Error pushing batch to ${key}:`, err);
      dispatch({ type: 'SET_CLOUD_CONNECTED', payload: false });
      throw err;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, [state.data]);

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
    updateData,
    updateSurgical,
    pushBatch,
    syncErrors,
    lastSyncTime
  };
}
