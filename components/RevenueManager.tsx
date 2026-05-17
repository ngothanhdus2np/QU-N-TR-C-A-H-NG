import React, { useState, useMemo } from 'react';
import {
  RevenueRecord,
  ProductGroup,
  ProductGroupRevenue,
  ShopeeSourceItem,
  ShopeeCostConfig,
  ShopeeInventoryInRecord,
  ShopeeInventoryOutRecord,
  DiagnosisRange,
  RevenueSubTab,
  AppDataSurgicalUpdate,
} from '../types';
import TimeFilter from './TimeFilter';
import DiagnosisTab from './revenue/DiagnosisTab';
import MatrixTab from './revenue/MatrixTab';
import SourceTab from './revenue/SourceTab';
import CostsTab from './revenue/CostsTab';
import InventoryInTab from './revenue/InventoryInTab';
import InventoryOutTab from './revenue/InventoryOutTab';
import ReportTab from './revenue/ReportTab';
import LedgerTab from './revenue/LedgerTab';
import { RevenueSubTabNav } from './revenue/RevenueSubTabNav';
import { RevenueAuditModal } from './revenue/RevenueAuditModal';
import { useRevenueLedger } from './revenue/useRevenueLedger';
import { useShopeeInventoryOut } from './revenue/useShopeeInventoryOut';

interface Props {
  list: RevenueRecord[];
  productGroups: ProductGroup[];
  groupRevenue: ProductGroupRevenue[];
  onUpdate: (newList: RevenueRecord[], idToRemove?: string) => Promise<void>;
  onUpdateGroupRevenue: (newList: ProductGroupRevenue[]) => Promise<void>;
  onUpdateGroups: (newList: ProductGroup[]) => Promise<void>;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  isShopee?: boolean;

  shopeeSourceData?: ShopeeSourceItem[];
  shopeeCosts?: ShopeeCostConfig;
  shopeeInventoryIn?: ShopeeInventoryInRecord[];
  shopeeInventoryOut?: ShopeeInventoryOutRecord[];
  dailyAdsConfig?: Record<string, number>;
  onUpdateShopeeSource?: (newList: ShopeeSourceItem[]) => Promise<void>;
  onUpdateShopeeCosts?: (costs: ShopeeCostConfig) => Promise<void>;
  onUpdateShopeeInventoryIn?: (newList: ShopeeInventoryInRecord[]) => Promise<void>;
  onUpdateShopeeInventoryOut?: (newList: ShopeeInventoryOutRecord[]) => Promise<void>;
  onUpdateDailyAdsConfig?: (config: Record<string, number>) => Promise<void>;

  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
}

const RevenueManager: React.FC<Props> = ({
  list,
  onUpdate,
  isShopee,
  groupRevenue,
  productGroups,
  onUpdateSurgical,
  shopeeSourceData = [],
  shopeeCosts,
  shopeeInventoryIn = [],
  shopeeInventoryOut = [],
  dailyAdsConfig = {},
  onUpdateShopeeCosts,
  onUpdateShopeeInventoryOut,
  onUpdateDailyAdsConfig,
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<RevenueSubTab>('diagnosis');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);

  const ledger = useRevenueLedger({
    list,
    isShopee,
    onUpdate,
    onUpdateSurgical,
    setActiveSubTab,
  });

  const shopee = useShopeeInventoryOut({
    shopeeInventoryOut,
    shopeeSourceData,
    shopeeCosts,
    dailyAdsConfig,
    onUpdateShopeeInventoryOut,
    onUpdateShopeeCosts,
    onUpdateDailyAdsConfig,
    onUpdateSurgical,
  });

  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');

  // --- TIME INTELLIGENCE ---
  const timeContext = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE');
    let start = '';
    let end = todayStr;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE');

    const last7 = new Date(now);
    last7.setDate(now.getDate() - 7);
    const last7Str = last7.toLocaleDateString('sv-SE');

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthStr = thisMonthStart.toLocaleDateString('sv-SE');

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthStartStr = lastMonthStart.toLocaleDateString('sv-SE');
    const lastMonthEndStr = lastMonthEnd.toLocaleDateString('sv-SE');

    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const thisYearStr = thisYearStart.toLocaleDateString('sv-SE');

    switch (diagnosisRange) {
      case 'today':
        start = todayStr;
        end = todayStr;
        break;
      case 'yesterday':
        start = yesterdayStr;
        end = yesterdayStr;
        break;
      case 'last7':
        start = last7Str;
        end = todayStr;
        break;
      case 'thisMonth':
        start = thisMonthStr;
        end = todayStr;
        break;
      case 'lastMonth':
        start = lastMonthStartStr;
        end = lastMonthEndStr;
        break;
      case 'thisYear':
        start = thisYearStr;
        end = todayStr;
        break;
      case 'custom':
        start = diagStartDate;
        end = diagEndDate;
        break;
      case 'all':
        start = '1900-01-01';
        end = '2100-12-31';
        break;
    }

    return { start, end };
  }, [diagnosisRange, diagStartDate, diagEndDate]);

  const dynamicTitle = useMemo(() => {
    const formatDate = (dateStr: string) => {
      if (!dateStr || dateStr === '1900-01-01' || dateStr === '2100-12-31') return '';
      const [y, m] = dateStr.split('-');
      return `${m}/${y}`;
    };
    const formatYear = (dateStr: string) => dateStr.split('-')[0];

    if (diagnosisRange === 'thisMonth' || diagnosisRange === 'lastMonth') {
      return `THÁNG ${formatDate(timeContext.start)}`;
    }
    if (diagnosisRange === 'thisYear') {
      return `NĂM ${formatYear(timeContext.start)}`;
    }
    if (diagnosisRange === 'all') {
      return 'TẤT CẢ THỜI GIAN';
    }

    const startFormatted = formatDate(timeContext.start);
    const endFormatted = formatDate(timeContext.end);

    if (startFormatted === endFormatted) {
      return `THÁNG ${startFormatted}`;
    }

    return `TỪ ${startFormatted} ĐẾN ${endFormatted}`;
  }, [diagnosisRange, timeContext]);

  const filteredListByRange = useMemo(
    () =>
      list
        .filter(r => r.date >= timeContext.start && r.date <= timeContext.end)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [list, timeContext]
  );

  // --- MA TRẬN TÀI CHÍNH ---
  const years = useMemo(() => {
    const ySet = new Set<string>();
    list.forEach(r => {
      if (r.date) {
        const parts = r.date.split('-');
        if (parts.length > 0) ySet.add(parts[0]);
      }
    });
    return Array.from(ySet).sort((a, b) => b.localeCompare(a));
  }, [list]);

  const financialMetrics = [
    { key: 'totalGrossRevenue', label: 'Tổng tiền hàng' },
    { key: 'discount', label: 'Giảm giá' },
    { key: 'revenueOther', label: 'Doanh thu khác' },
    { key: 'returnsValue', label: 'Giá trị trả hàng' },
    { key: 'netRevenue', label: 'Doanh thu thuần' },
    { key: 'totalCogs', label: 'Tổng giá vốn' },
    { key: 'grossProfit', label: 'Lợi nhuận gộp' },
  ];

  const financialMatrixData = useMemo(() => {
    return financialMetrics.map(metric => {
      const yearValues: Record<string, number> = {};
      years.forEach(y => {
        const sParts = timeContext.start.split('-');
        const eParts = timeContext.end.split('-');
        const startOfTarget = `${y}-${sParts[1]}-${sParts[2]}`;
        const endOfTarget = `${y}-${eParts[1]}-${eParts[2]}`;
        const sum = list
          .filter(r => r.date >= startOfTarget && r.date <= endOfTarget)
          .reduce(
            (acc, curr) => acc + ((curr[metric.key as keyof RevenueRecord] as number) || 0),
            0
          );
        yearValues[y] = sum;
      });
      return { ...metric, yearValues };
    });
  }, [list, years, timeContext]);

  const maxFinancialValue = useMemo(() => {
    let max = 0;
    financialMatrixData.forEach(row => {
      Object.values(row.yearValues).forEach(v => {
        const val = v as number;
        if (val > max) max = val;
      });
    });
    return max || 1;
  }, [financialMatrixData]);

  const getHeatmapColor = (value: number) => {
    if (value <= 0) return 'transparent';
    const intensity = value / maxFinancialValue;
    if (intensity > 0.8) return 'bg-emerald-500 text-white font-normal';
    if (intensity > 0.5) return 'bg-emerald-400 text-white font-normal';
    if (intensity > 0.3) return 'bg-emerald-200 text-emerald-900 font-normal';
    if (intensity > 0.1) return 'bg-emerald-100 text-emerald-800 font-normal';
    return 'bg-emerald-50 text-emerald-700 font-normal';
  };

  // --- PHÂN TÍCH DOANH THU ---
  const revenueAnalytics = useMemo(() => {
    if (filteredListByRange.length === 0) return null;
    const totalRev = filteredListByRange.reduce(
      (sum, r) => sum + (r.netRevenue || 0) + (r.revenueOther || 0),
      0
    );
    const totalGrossBeforeLeak = filteredListByRange.reduce(
      (sum, r) => sum + (r.totalGrossRevenue || 0) + (r.revenueOther || 0),
      0
    );
    const totalDisc = filteredListByRange.reduce((sum, r) => sum + (r.discount || 0), 0);
    const totalRet = filteredListByRange.reduce((sum, r) => sum + (r.returnsValue || 0), 0);
    const totalCogs = filteredListByRange.reduce((sum, r) => sum + (r.totalCogs || 0), 0);
    const leakRatio =
      totalGrossBeforeLeak > 0 ? ((totalDisc + totalRet) / totalGrossBeforeLeak) * 100 : 0;
    const margin = totalRev > 0 ? ((totalRev - totalCogs) / totalRev) * 100 : 0;
    const uniqueDays = new Set(filteredListByRange.map(r => r.date).filter(Boolean)).size;
    const salesVelocity = uniqueDays > 0 ? totalRev / uniqueDays : 0;
    const netProfit = totalRev - totalCogs;

    return {
      totalRev,
      totalDisc,
      totalRet,
      totalCogs,
      leakRatio,
      margin,
      salesVelocity,
      netProfit,
      daysCount: uniqueDays,
      totalGrossBeforeLeak,
    };
  }, [filteredListByRange]);

  const structureData = useMemo(() => {
    if (!revenueAnalytics) return [];
    return [
      { name: 'Giảm giá', value: revenueAnalytics.totalDisc, color: '#f43f5e' },
      { name: 'Trả hàng', value: revenueAnalytics.totalRet, color: '#f59e0b' },
      { name: 'Giá vốn', value: revenueAnalytics.totalCogs, color: '#64748b' },
      { name: 'Lợi nhuận', value: revenueAnalytics.netProfit, color: '#10b981' },
    ].filter(d => d.value > 0);
  }, [revenueAnalytics]);

  const runRevenueDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const contextData = `
        KHOẢNG THỜI GIAN: ${diagnosisRange.toUpperCase()} (Từ ${timeContext.start} đến ${timeContext.end}).

        THÔNG SỐ TÀI CHÍNH CỐT LÕI:
        - Doanh thu Thuần: ${revenueAnalytics?.totalRev.toLocaleString()}đ (Net Revenue)
        - Giá vốn hàng bán (COGS): ${revenueAnalytics?.totalCogs.toLocaleString()}đ
        - Lợi nhuận gộp: ${revenueAnalytics?.netProfit.toLocaleString()}đ
        - Biên lợi nhuận gộp: ${revenueAnalytics?.margin.toFixed(1)}%
        - Tỷ lệ Rò rỉ (Leakage): ${revenueAnalytics?.leakRatio.toFixed(1)}% (Chiết khấu + Trả hàng / Doanh thu tổng)
        - Vận tốc bán hàng: ${revenueAnalytics?.salesVelocity.toLocaleString()}đ/ngày

        NHIỆM VỤ:
        1. PHÂN TÍCH 'SỨC KHOẺ TÀI CHÍNH': Nhận định về biên lợi nhuận và tỷ lệ rò rỉ.
        2. TỐI ƯU CHI PHÍ: Đưa ra 3 hành động cụ thể để cắt giảm chi phí mà không ảnh hưởng doanh số.
        3. CHIẾN LƯỢC TĂNG TRƯỞNG: Làm sao để tăng 'Vận tốc bán hàng' trong giai đoạn tiếp theo?
        4. CẢNH BÁO RỦI RO: Dự báo các rủi ro về tồn kho hoặc hụt dòng tiền.
      `;
      const response = await fetch('/api/ai/revenue-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI service error');
      setDiagnosisResult(data.result || 'Lỗi khởi tạo chẩn đoán.');
    } catch (err) {
      console.error('Revenue diagnosis error:', err);
      setDiagnosisResult('Lỗi kết nối AI. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-full animate-in fade-in duration-500">
      <TimeFilter
        diagnosisRange={diagnosisRange}
        setDiagnosisRange={setDiagnosisRange}
        diagStartDate={diagStartDate}
        setDiagStartDate={setDiagStartDate}
        diagEndDate={diagEndDate}
        setDiagEndDate={setDiagEndDate}
      />

      <RevenueSubTabNav
        activeSubTab={activeSubTab}
        isShopee={isShopee}
        onChangeSubTab={setActiveSubTab}
      />

      {activeSubTab === 'diagnosis' && (
        <DiagnosisTab
          revenueAnalytics={revenueAnalytics}
          structureData={structureData}
          formatNumber={formatNumber}
          runRevenueDiagnosis={runRevenueDiagnosis}
          isDiagnosing={isDiagnosing}
          diagnosisResult={diagnosisResult}
          setDiagnosisResult={setDiagnosisResult}
        />
      )}

      {activeSubTab === 'matrix' && !isShopee && (
        <MatrixTab
          isShopee={!!isShopee}
          productGroups={productGroups}
          groupRevenue={groupRevenue}
          timeContext={timeContext}
          years={years}
          financialMatrixData={financialMatrixData}
          getHeatmapColor={getHeatmapColor}
          formatNumber={formatNumber}
        />
      )}

      {isShopee && activeSubTab === 'source' && (
        <SourceTab shopeeSourceData={shopeeSourceData} formatNumber={formatNumber} />
      )}

      {isShopee && activeSubTab === 'costs' && (
        <CostsTab
          shopeeCosts={shopeeCosts}
          totalFixedCosts={shopee.totalFixedCosts}
          totalVariableCosts={shopee.totalVariableCosts}
          fixedCostPerOrder={shopee.fixedCostPerOrder}
          formatNumber={formatNumber}
          handleUpdateShopeeCostConfig={shopee.handleUpdateShopeeCostConfig}
          handleAddShopeeCostItem={shopee.handleAddShopeeCostItem}
          handleUpdateShopeeCostItem={shopee.handleUpdateShopeeCostItem}
          handleRemoveShopeeCostItem={shopee.handleRemoveShopeeCostItem}
        />
      )}

      {isShopee && activeSubTab === 'inventory_in' && (
        <InventoryInTab shopeeInventoryIn={shopeeInventoryIn} formatNumber={formatNumber} />
      )}

      {isShopee && activeSubTab === 'inventory_out' && (
        <InventoryOutTab
          shopeeInventoryOut={shopeeInventoryOut}
          shopeeSourceData={shopeeSourceData}
          shopeeCosts={shopeeCosts}
          dailyAdsConfig={dailyAdsConfig}
          selectedAdsDate={shopee.selectedAdsDate}
          setSelectedAdsDate={shopee.setSelectedAdsDate}
          inventoryOutForm={shopee.inventoryOutForm}
          setInventoryOutForm={shopee.setInventoryOutForm}
          editingInventoryOutId={shopee.editingInventoryOutId}
          setEditingInventoryOutId={shopee.setEditingInventoryOutId}
          deleteConfirmId={shopee.deleteConfirmId}
          setDeleteConfirmId={shopee.setDeleteConfirmId}
          clearAllConfirm={shopee.clearAllConfirm}
          setClearAllConfirm={shopee.setClearAllConfirm}
          handleAddInventoryOut={shopee.handleAddInventoryOut}
          handleEditInventoryOut={shopee.handleEditInventoryOut}
          handleRemoveInventoryOut={shopee.handleRemoveInventoryOut}
          handleClearAllInventoryOut={shopee.handleClearAllInventoryOut}
          handleShopeeFileUpload={shopee.handleShopeeFileUpload}
          handleDistributeAdsCost={shopee.handleDistributeAdsCost}
          shopeeFileInputRef={shopee.shopeeFileInputRef}
          totalVariableCosts={shopee.totalVariableCosts}
          formatNumber={formatNumber}
          dynamicTitle={dynamicTitle}
          shopeeTotals={shopee.shopeeTotals}
          onUpdateShopeeCosts={onUpdateShopeeCosts}
        />
      )}

      {isShopee && activeSubTab === 'report' && (
        <ReportTab
          shopeeSourceData={shopeeSourceData}
          shopeeInventoryOut={shopeeInventoryOut}
          timeContext={timeContext}
          formatNumber={formatNumber}
        />
      )}

      {activeSubTab === 'ledger' && !isShopee && (
        <LedgerTab
          formData={ledger.formData}
          setFormData={ledger.setFormData}
          isSaving={ledger.isSaving}
          handleAdd={ledger.handleAdd}
          filteredListByRange={filteredListByRange}
          timeContext={timeContext}
          onUpdate={onUpdate}
          list={list}
          isShopee={isShopee}
          formatNumber={formatNumber}
        />
      )}

      {ledger.showAuditModal && (
        <RevenueAuditModal
          auditConflicts={ledger.auditConflicts}
          setAuditConflicts={ledger.setAuditConflicts}
          onClose={() => ledger.setShowAuditModal(false)}
          onResolveConflicts={ledger.handleResolveConflicts}
          formatNumber={formatNumber}
        />
      )}
    </div>
  );
};

export default RevenueManager;
