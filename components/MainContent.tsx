import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DashboardEodBanner } from './dashboard/DashboardEodBanner';
import OnlineSidebarNav from './online/OnlineSidebarNav';
import TimeFilter from './TimeFilter';
import {
  AppData,
  AppDataSurgicalUpdate,
  BrandProfile,
  CustomerDebtRecord,
  DashboardBreakEvenAnalysis,
  DiagnosisRange,
  POSOrder,
  ProductLine,
  RevenueSubTab,
  RevenueDelta,
} from '../types';
import { AppThemeId } from '../constants/themes';
import { CardSkeleton, TableSkeleton } from './shared/ui/Skeleton';
import ErrorBoundary from './ui/ErrorBoundary';
import {
  processPlaceOrder,
  processReturnOrder,
  processCancelReturn,
  processCancelLegacyReturnTransaction,
  deletePosOrder,
  editPosOrder,
  recalcSalesRecordsForDate,
  getOrderLocalDateKey,
} from '../services/posOrderService';
import { supabase } from '../services/supabase';
import { apiService } from '../services/apiService';

const HelpCenter = React.lazy(() => import('./help/HelpCenter'));
const OverviewPage = React.lazy(() => import('./overview/OverviewPage'));
const RevenueManager = React.lazy(() => import('./RevenueManager'));
const ExpenseManager = React.lazy(() => import('./ExpenseManager'));
const PayrollManager = React.lazy(() => import('./PayrollManager'));
const StaffManager = React.lazy(() => import('./StaffManager'));
const ProductGroupManager = React.lazy(() => import('./ProductGroupManager'));
const PromotionManager = React.lazy(() => import('./PromotionManager'));
const MarketingManager = React.lazy(() => import('./marketing/MarketingManager'));
const BrandManager = React.lazy(() => import('./marketing/BrandManager'));
const POSComputer = React.lazy(() => import('./pos/POSComputer'));
const GoodsInventory = React.lazy(() => import('./pos/GoodsInventory'));
const CustomerListPage = React.lazy(() => import('./customers/CustomerListPage'));
const SupplierContainer = React.lazy(() => import('./suppliers/SupplierContainer'));
const PurchaseOrdersContainer = React.lazy(() => import('./purchase/PurchaseOrdersContainer'));
const AuditContainer = React.lazy(() => import('./audit/AuditContainer'));
const PendingOrdersPage = React.lazy(() => import('./orders/PendingOrdersPage'));
const OrderInvoices = React.lazy(() => import('./orders/OrderInvoices'));
const OrderReturns = React.lazy(() => import('./orders/OrderReturns'));
const OrderRepairs = React.lazy(() => import('./orders/OrderRepairs'));
const DeliveryPartners = React.lazy(() => import('./orders/DeliveryPartners'));
const ShippingOrders = React.lazy(() => import('./orders/ShippingOrders'));
const PurchaseInvoices = React.lazy(() => import('./orders/PurchaseInvoices'));
const GoodsInternalUse = React.lazy(() => import('./inventory/GoodsInternalUse'));
const GoodsDisposal = React.lazy(() => import('./inventory/GoodsDisposal'));
const AnalysisContainer = React.lazy(() => import('./analysis/AnalysisContainer'));
const CashLedgerPage = React.lazy(() => import('./finance/CashLedgerPage'));
const EndOfDayReportPage = React.lazy(() => import('./reports/EndOfDayReportPage'));
const SalesReportPage = React.lazy(() => import('./reports/SalesReportPage'));
const OrderReportPage = React.lazy(() => import('./reports/OrderReportPage'));
const GoodsReportPage = React.lazy(() => import('./reports/GoodsReportPage'));
const CustomerReportPage = React.lazy(() => import('./reports/CustomerReportPage'));
const SupplierReportPage = React.lazy(() => import('./reports/SupplierReportPage'));
const StaffReportPage = React.lazy(() => import('./reports/StaffReportPage'));
const ChannelReportPage = React.lazy(() => import('./reports/ChannelReportPage'));
const FinanceReportPage = React.lazy(() => import('./reports/FinanceReportPage'));
const KnowledgeManager = React.lazy(() => import('./KnowledgeManager'));
const OnlineCatalogPage = React.lazy(() => import('./website/OnlineCatalogPage'));
const OnlineOrdersPage = React.lazy(() => import('./online/OnlineOrdersPage'));
const WebsiteProductsPage = React.lazy(() => import('./website/WebsiteProductsPage'));
const WebsiteOrdersPage = React.lazy(() => import('./website/WebsiteOrdersPage'));
const WebsiteOperationsPage = React.lazy(() => import('./website/WebsiteOperationsPage'));
const WebsiteChannelLinksPage = React.lazy(() => import('./website/WebsiteChannelLinksPage'));
const ShopeeProductsPage = React.lazy(() => import('./website/ShopeeProductsPage'));

interface MainContentProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: AppData;
  brandProfile: BrandProfile;
  setBrandProfile: (profile: BrandProfile) => void;
  showResigned: boolean;
  setShowResigned: (show: boolean) => void;
  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
  suggestedFocusProducts: ProductLine[];
  breakEvenAnalysis: DashboardBreakEvenAnalysis;
  updateData: <K extends keyof AppData>(
    key: K,
    newList: AppData[K],
    idToRemove?: string
  ) => Promise<void>;
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  applyRevenueDelta: (dateKey: string, delta: RevenueDelta) => Promise<void>;
  // [TXN-RPC-01] Local-only sync (dùng sau khi RPC server-side đã áp dụng đầy đủ) + RPC xóa đơn
  applyLocalOnly: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  applyRevenueDeltaLocal: (dateKey: string, delta: RevenueDelta) => Promise<void>;
  deletePosOrderTx: (orderId: string) => Promise<void>;
  cancelPosReturnTx: (returnOrderId: string) => Promise<void>;
  editPosOrderTx: (
    orderId: string,
    updatedOrder: POSOrder,
    debtRecord: CustomerDebtRecord | null,
    allowSellOutOfStock: boolean
  ) => Promise<void>;
  placePosOrderTx: (
    order: POSOrder,
    debtRecord: CustomerDebtRecord | null,
    allowSellOutOfStock: boolean
  ) => Promise<void>;
  pushBatch: (key: keyof AppData, items: unknown[]) => Promise<void>;
  loadInventoryOut?: () => Promise<void>;
  isDataReady?: boolean;
  isSyncing?: boolean;
  offlinePendingCount?: number;
  offlineOrderPendingCount?: number;
  isDraining?: boolean;
  onDrainOfflineQueue?: () => Promise<{ synced: number; failed: number }>;
  onRefreshData?: () => Promise<void>;
  userRole?: string;
  onManagerUnlocked?: () => void;
  activeThemeId?: AppThemeId;
  onThemeChange?: (id: AppThemeId) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeTab,
  setActiveTab,
  data,
  brandProfile,
  setBrandProfile,
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
  updateData,
  updateSurgical,
  applyRevenueDelta,
  applyLocalOnly,
  applyRevenueDeltaLocal,
  deletePosOrderTx,
  cancelPosReturnTx,
  editPosOrderTx,
  placePosOrderTx,
  pushBatch,
  loadInventoryOut,
  isDataReady = true,
  offlinePendingCount: _offlinePendingCount,
  offlineOrderPendingCount,
  isDraining,
  isSyncing,
  onDrainOfflineQueue,
  onRefreshData,
  userRole,
  onManagerUnlocked,
  activeThemeId,
  onThemeChange,
}) => {
  const location = useLocation();
  const editProductId = new URLSearchParams(location.search).get('edit') ?? undefined;
  const viewProductId = new URLSearchParams(location.search).get('view') ?? undefined;

  // Soft-delete: đơn 'cancelled' chỉ hiển thị ở trang Hóa đơn/Trả hàng (xem lại lịch sử).
  // Mọi trang tính toán/báo cáo/POS dùng activeData — hành vi y như thời xóa cứng, không
  // consumer nào phải tự nhớ lọc. Handler service (xóa/hủy/sửa) vẫn dùng `data` đầy đủ.
  const activePosOrders = React.useMemo(
    () => (data.posOrders || []).filter(o => o.status !== 'cancelled'),
    [data.posOrders]
  );
  const activeData = React.useMemo(
    () => ({ ...data, posOrders: activePosOrders }),
    [data, activePosOrders]
  );

  const [orderToEdit, setOrderToEdit] = useState<AppData['posOrders'][number] | null>(null);
  const [orderToReturn, setOrderToReturn] = useState<AppData['posOrders'][number] | null>(null);
  const [eodReport, setEodReport] = useState<{ date: string; summary: string } | null>(null);
  const [eodDismissed, setEodDismissed] = useState(false);
  const [onlineShopeeSubTab, setOnlineShopeeSubTab] = useState<RevenueSubTab>('source');
  const [inventoryInFormOpen, setInventoryInFormOpen] = useState(false);
  const [shopeeSidebarCollapsed, setShopeeSidebarCollapsed] = useState(false);
  const [shopFilter, setShopFilter] = useState<number | null>(null);
  const [filterOutPlatforms, setFilterOutPlatforms] = useState<string[]>([]);
  const [filterOutStatuses, setFilterOutStatuses] = useState<string[]>([]);
  const [filterOutShippingUnits, setFilterOutShippingUnits] = useState<string[]>([]);
  const [openFilterPopup, setOpenFilterPopup] = useState<'platform' | 'status' | 'shipping' | null>(
    null
  );
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const platformBtnRef = useRef<HTMLButtonElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const shippingBtnRef = useRef<HTMLButtonElement>(null);

  const syncInventoryOutFromBot = async (): Promise<{ inserted: number; skipped: number }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    const res = await fetch('/api/inventory-out/sync-from-bot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Sync thất bại');
    // Luôn reload local state sau sync (kể cả khi chỉ update, không insert mới)
    if ((json.inserted > 0 || json.updated > 0) && loadInventoryOut) {
      await loadInventoryOut();
    }
    return { inserted: json.inserted, skipped: json.skipped };
  };

  const openPopup = (
    key: 'platform' | 'status' | 'shipping',
    ref: React.RefObject<HTMLButtonElement>
  ) => {
    if (openFilterPopup === key) {
      setOpenFilterPopup(null);
      return;
    }
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPopupPos({ top: rect.top, left: rect.right + 8 });
    }
    setOpenFilterPopup(key);
  };

  useEffect(() => {
    if (!openFilterPopup) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-filter-popup-portal]') && !target.closest('[data-filter-btn]')) {
        setOpenFilterPopup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openFilterPopup]);

  // Auto-load dữ liệu xuất kho từ Supabase khi user mở tab inventory_out
  useEffect(() => {
    if (onlineShopeeSubTab === 'inventory_out' && loadInventoryOut) {
      loadInventoryOut();
    }
  }, [onlineShopeeSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    fetch(`/api/eod-report?date=${yesterday}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.summary) setEodReport(d);
      })
      .catch(() => {});
  }, []);

  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const renderContent = () => {
    const renderKnowledgeManager = (
      initialMainTab: 'mechanisms' | 'standards' | 'workflows' | 'templates'
    ) => (
      <React.Suspense
        fallback={
          <div className="space-y-8 pt-4">
            <CardSkeleton />
            <TableSkeleton />
          </div>
        }
      >
        <KnowledgeManager
          data={activeData}
          onUpdateData={updateData}
          initialMainTab={initialMainTab}
        />
      </React.Suspense>
    );

    const renderOnlineNav = () => (
      <OnlineSidebarNav
        activeTab={activeTab}
        activeShopeeSubTab={onlineShopeeSubTab}
        onSelectMainTab={handleSetActiveTab}
        onSelectShopeeSubTab={setOnlineShopeeSubTab}
      />
    );

    const renderShopeeRevenueManager = ({
      initialSubTab = 'diagnosis',
      hiddenSubTabs = [],
      diagnosisLabel,
      withFilters = false,
    }: {
      initialSubTab?: RevenueSubTab;
      hiddenSubTabs?: RevenueSubTab[];
      diagnosisLabel?: string;
      withFilters?: boolean;
    } = {}) => (
      <RevenueManager
        list={data.shopeeRevenue || []}
        productGroups={data.productGroups || []}
        groupRevenue={data.shopeeProductGroupRevenue || []}
        shopeeSourceData={data.shopeeSourceData || []}
        shopeeCosts={data.shopeeCosts}
        shopeeInventoryIn={data.shopeeInventoryIn || []}
        shopeeInventoryOut={data.shopeeInventoryOut || []}
        dailyAdsConfig={data.dailyAdsConfig || {}}
        onUpdate={(newList, idToRem) => updateData('shopeeRevenue', newList, idToRem)}
        onUpdateSurgical={updateSurgical}
        onUpdateGroupRevenue={newList => updateData('shopeeProductGroupRevenue', newList)}
        onUpdateGroups={newList => updateData('productGroups', newList)}
        onUpdateShopeeSource={newList => updateData('shopeeSourceData', newList)}
        onUpdateShopeeCosts={newConfig => updateData('shopeeCosts', newConfig)}
        onUpdateShopeeInventoryIn={newList => updateData('shopeeInventoryIn', newList)}
        onInventoryInFormToggle={setInventoryInFormOpen}
        suppliers={data.suppliers || []}
        shopFilter={shopFilter}
        onShopFilterChange={setShopFilter}
        onUpdateShopeeInventoryOut={newList => updateData('shopeeInventoryOut', newList)}
        onUpdateDailyAdsConfig={newConfig => updateData('dailyAdsConfig', newConfig)}
        isShopee={true}
        initialSubTab={initialSubTab}
        activeSubTab={onlineShopeeSubTab}
        onChangeSubTab={setOnlineShopeeSubTab}
        hiddenSubTabs={hiddenSubTabs}
        diagnosisLabel={diagnosisLabel}
        hideSubTabNav={true}
        hideTimeFilter={true}
        inventoryOutFilterPlatforms={withFilters ? filterOutPlatforms : []}
        inventoryOutFilterStatuses={withFilters ? filterOutStatuses : []}
        inventoryOutFilterShippingUnits={withFilters ? filterOutShippingUnits : []}
        diagnosisRange={diagnosisRange}
        setDiagnosisRange={setDiagnosisRange}
        diagStartDate={diagStartDate}
        setDiagStartDate={setDiagStartDate}
        diagEndDate={diagEndDate}
        setDiagEndDate={setDiagEndDate}
        onSyncInventoryOutFromBot={syncInventoryOutFromBot}
      />
    );

    switch (activeTab) {
      case 'help':
        return <HelpCenter />;
      case 'overview':
        return <OverviewPage data={activeData} isLoading={!isDataReady} />;
      case 'orders':
        return <PendingOrdersPage orders={activePosOrders} />;
      case 'customers':
        return (
          <CustomerListPage
            customers={data.posCustomers || []}
            customerDebtHistory={data.customerDebtHistory || []}
            onUpdateCustomers={newList => updateData('posCustomers', newList)}
            onUpdateSurgical={updateSurgical}
            isLoading={!isDataReady}
          />
        );
      case 'suppliers':
        return (
          <SupplierContainer
            data={activeData}
            onUpdateData={updateData}
            onUpdateSurgical={updateSurgical}
            isLoading={!isDataReady}
          />
        );
      case 'product-groups':
        return (
          <ProductGroupManager
            productGroups={data.productGroups || []}
            products={data.posProducts || []}
            groupRevenue={data.productGroupRevenue || []}
            onUpdateGroups={newList => updateData('productGroups', newList)}
            onUpdateGroupRevenue={newList => updateData('productGroupRevenue', newList)}
            list={data.revenue}
            onUpdateRevenue={newList => updateData('revenue', newList)}
          />
        );
      case 'store-revenue':
        return (
          <RevenueManager
            list={data.revenue}
            productGroups={data.productGroups || []}
            groupRevenue={data.productGroupRevenue || []}
            onUpdate={(newList, idToRem) => updateData('revenue', newList, idToRem)}
            onUpdateSurgical={updateSurgical}
            onUpdateGroupRevenue={newList => updateData('productGroupRevenue', newList)}
            onUpdateGroups={newList => updateData('productGroups', newList)}
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        );
      case 'shopee-revenue':
        return (
          <div
            className={`grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10 ${inventoryInFormOpen || shopeeSidebarCollapsed ? '' : 'lg:grid-cols-[280px_minmax(0,1fr)]'}`}
          >
            {!inventoryInFormOpen && shopeeSidebarCollapsed ? (
              <button
                onClick={() => setShopeeSidebarCollapsed(false)}
                className="hidden h-full w-10 shrink-0 items-start justify-center rounded-2xl border border-slate-100 bg-white pt-4 text-slate-400 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600 lg:flex"
                title="Hiện danh mục & bộ lọc"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <aside className={`flex h-full min-h-0 ${inventoryInFormOpen ? 'hidden' : ''}`}>
                <div className="flex h-full min-h-0 w-full flex-col gap-4">
                  {renderOnlineNav()}
                  <div
                    className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-3"
                    style={{ overflow: 'visible' }}
                  >
                    <div className="h-full min-h-0 overflow-y-auto pr-1">
                      <div className="mb-3 flex items-center justify-between px-1">
                        <p className="text-xs font-semibold uppercase text-slate-500">Bộ lọc</p>
                        <button
                          onClick={() => setShopeeSidebarCollapsed(true)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                          title="Ẩn danh mục & bộ lọc"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Nhóm: Thời gian */}
                      <div className="mb-4">
                        <p className="text-2xs font-bold uppercase text-slate-400 tracking-widest mb-2">
                          Thời gian
                        </p>
                        <TimeFilter
                          diagnosisRange={diagnosisRange}
                          setDiagnosisRange={setDiagnosisRange}
                          diagStartDate={diagStartDate}
                          setDiagStartDate={setDiagStartDate}
                          diagEndDate={diagEndDate}
                          setDiagEndDate={setDiagEndDate}
                          variant="range"
                        />
                      </div>
                      {onlineShopeeSubTab === 'source' && (
                        <div className="mb-4">
                          <p className="text-2xs font-bold uppercase text-slate-400 tracking-widest mb-2">
                            Shop
                          </p>
                          <div className="flex flex-col gap-1">
                            {[null, 0, 1].map((val, i) => (
                              <button
                                key={i}
                                onClick={() => setShopFilter(val)}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                  shopFilter === val
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                }`}
                              >
                                {val === null ? 'Tất cả' : `Shop ${val + 1}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {onlineShopeeSubTab === 'inventory_out' && (
                        <div className="space-y-4">
                          {/* Nhóm: Nền tảng */}
                          <div>
                            <p className="text-2xs font-bold uppercase text-slate-400 tracking-widest mb-2">
                              Nền tảng
                            </p>
                            <button
                              ref={platformBtnRef}
                              data-filter-btn
                              onClick={() => openPopup('platform', platformBtnRef)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all ${filterOutPlatforms.length > 0 ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                            >
                              <span className="truncate">
                                {filterOutPlatforms.length > 0
                                  ? filterOutPlatforms.join(', ')
                                  : 'Chọn nền tảng'}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 shrink-0 ml-1 transition-transform ${openFilterPopup === 'platform' ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </div>

                          {/* Nhóm: Trạng thái */}
                          <div>
                            <p className="text-2xs font-bold uppercase text-slate-400 tracking-widest mb-2">
                              Trạng thái
                            </p>
                            <button
                              ref={statusBtnRef}
                              data-filter-btn
                              onClick={() => openPopup('status', statusBtnRef)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all ${filterOutStatuses.length > 0 ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                            >
                              <span className="truncate">
                                {filterOutStatuses.length > 0
                                  ? filterOutStatuses.join(', ')
                                  : 'Chọn trạng thái'}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 shrink-0 ml-1 transition-transform ${openFilterPopup === 'status' ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </div>

                          {/* Nhóm: ĐVVC */}
                          <div>
                            <p className="text-2xs font-bold uppercase text-slate-400 tracking-widest mb-2">
                              ĐVVC
                            </p>
                            <button
                              ref={shippingBtnRef}
                              data-filter-btn
                              onClick={() => openPopup('shipping', shippingBtnRef)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all ${filterOutShippingUnits.length > 0 ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                            >
                              <span className="truncate">
                                {filterOutShippingUnits.length > 0
                                  ? filterOutShippingUnits.join(', ')
                                  : 'Chọn ĐVVC'}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 shrink-0 ml-1 transition-transform ${openFilterPopup === 'shipping' ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </div>

                          {/* Portals — render popup ra ngoài DOM tree để thoát overflow */}
                          {openFilterPopup === 'platform' &&
                            ReactDOM.createPortal(
                              <div
                                data-filter-popup-portal
                                style={{
                                  position: 'fixed',
                                  top: popupPos.top,
                                  left: popupPos.left,
                                  zIndex: 9999,
                                }}
                                className="w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-2xs font-bold uppercase text-slate-400">
                                    Nền tảng
                                  </span>
                                  {filterOutPlatforms.length > 0 && (
                                    <button
                                      onClick={() => setFilterOutPlatforms([])}
                                      className="text-2xs text-indigo-500 hover:underline"
                                    >
                                      Xóa
                                    </button>
                                  )}
                                </div>
                                {['Shopee 1', 'Shopee 2', 'Lazada', 'TikTok'].map(p => (
                                  <label
                                    key={p}
                                    className="flex items-center gap-2 cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filterOutPlatforms.includes(p)}
                                      onChange={() =>
                                        setFilterOutPlatforms(prev =>
                                          prev.includes(p)
                                            ? prev.filter(x => x !== p)
                                            : [...prev, p]
                                        )
                                      }
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-slate-700 group-hover:text-slate-900">
                                      {p}
                                    </span>
                                  </label>
                                ))}
                              </div>,
                              document.body
                            )}
                          {openFilterPopup === 'status' &&
                            ReactDOM.createPortal(
                              <div
                                data-filter-popup-portal
                                style={{
                                  position: 'fixed',
                                  top: popupPos.top,
                                  left: popupPos.left,
                                  zIndex: 9999,
                                }}
                                className="w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-2xs font-bold uppercase text-slate-400">
                                    Trạng thái
                                  </span>
                                  {filterOutStatuses.length > 0 && (
                                    <button
                                      onClick={() => setFilterOutStatuses([])}
                                      className="text-2xs text-indigo-500 hover:underline"
                                    >
                                      Xóa
                                    </button>
                                  )}
                                </div>
                                {[
                                  { code: 'OK', label: 'Đã giao' },
                                  { code: 'SHIPPING', label: 'Đang giao' },
                                  { code: 'RETURN', label: 'Hoàn hàng' },
                                  { code: 'RETURNED', label: 'Đã hoàn' },
                                  { code: 'CANCEL', label: 'Huỷ' },
                                  { code: 'LOST', label: 'Thất lạc' },
                                  { code: 'PENDING', label: 'Chờ xử lý' },
                                ].map(({ code, label }) => (
                                  <label
                                    key={code}
                                    className="flex items-center gap-2 cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filterOutStatuses.includes(code)}
                                      onChange={() =>
                                        setFilterOutStatuses(prev =>
                                          prev.includes(code)
                                            ? prev.filter(x => x !== code)
                                            : [...prev, code]
                                        )
                                      }
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-slate-700 group-hover:text-slate-900">
                                      {label}
                                    </span>
                                  </label>
                                ))}
                              </div>,
                              document.body
                            )}
                          {openFilterPopup === 'shipping' &&
                            ReactDOM.createPortal(
                              <div
                                data-filter-popup-portal
                                style={{
                                  position: 'fixed',
                                  top: popupPos.top,
                                  left: popupPos.left,
                                  zIndex: 9999,
                                }}
                                className="w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-2xs font-bold uppercase text-slate-400">
                                    ĐVVC
                                  </span>
                                  {filterOutShippingUnits.length > 0 && (
                                    <button
                                      onClick={() => setFilterOutShippingUnits([])}
                                      className="text-2xs text-indigo-500 hover:underline"
                                    >
                                      Xóa
                                    </button>
                                  )}
                                </div>
                                {['GHN', 'SPX', 'GHTK', 'J&T'].map(u => (
                                  <label
                                    key={u}
                                    className="flex items-center gap-2 cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filterOutShippingUnits.includes(u)}
                                      onChange={() =>
                                        setFilterOutShippingUnits(prev =>
                                          prev.includes(u)
                                            ? prev.filter(x => x !== u)
                                            : [...prev, u]
                                        )
                                      }
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-slate-700 group-hover:text-slate-900">
                                      {u}
                                    </span>
                                  </label>
                                ))}
                              </div>,
                              document.body
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            )}
            <section className="relative h-full min-h-0 min-w-0 overflow-hidden">
              {onlineShopeeSubTab === 'source' ? (
                <React.Suspense fallback={<CardSkeleton />}>
                  <ShopeeProductsPage />
                </React.Suspense>
              ) : (
                renderShopeeRevenueManager({
                  initialSubTab: 'source',
                  hiddenSubTabs: ['diagnosis'],
                  withFilters: true,
                })
              )}
            </section>
          </div>
        );
      case 'cash-ledger':
        return (
          <CashLedgerPage
            data={activeData}
            onAddExpense={expense => updateData('expenses', [...(data.expenses || []), expense])}
            onAddPosOrder={order => pushBatch('posOrders', [order])}
          />
        );
      case 'expenses':
        return (
          <ExpenseManager
            list={data.expenses}
            categories={data.expenseCategories || []}
            revenueList={data.revenue}
            shopeeProductGroupRevenue={data.shopeeProductGroupRevenue || []}
            payrolls={data.payroll}
            recurringExpenses={data.recurringExpenses || []}
            onUpdate={(newList, idToRem) => updateData('expenses', newList, idToRem)}
            onUpdateSurgical={updateSurgical}
            onUpdateCategories={newCats => updateData('expenseCategories', newCats)}
            onUpdateRecurringExpenses={newList => updateData('recurringExpenses', newList)}
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        );
      case 'promotions':
        return (
          <PromotionManager
            promotions={data.promotions || []}
            revenue={data.revenue}
            expenses={data.expenses}
            onUpdate={(newList, idToRem) => updateData('promotions', newList, idToRem)}
            onSelectMainTab={handleSetActiveTab}
          />
        );
      case 'marketing':
        return (
          <MarketingManager
            brandProfile={brandProfile}
            onUpdateBrand={setBrandProfile}
            suggestedFocusProducts={suggestedFocusProducts}
            onSelectMainTab={handleSetActiveTab}
          />
        );
      case 'brand':
        return <BrandManager brandProfile={brandProfile} onUpdate={setBrandProfile} />;
      case 'sop':
      case 'sop-mechanisms':
        return renderKnowledgeManager('mechanisms');
      case 'sop-standards':
        return renderKnowledgeManager('standards');
      case 'sop-workflows':
        return renderKnowledgeManager('workflows');
      case 'sop-templates':
        return renderKnowledgeManager('templates');
      case 'goods-purchase':
      case 'purchase-returns':
        return (
          <PurchaseOrdersContainer
            data={activeData}
            onUpdateData={updateData}
            onUpdateSurgical={updateSurgical}
            onPushBatch={pushBatch}
            initialView={activeTab === 'purchase-returns' ? 'returns' : 'imports'}
            onRefreshData={onRefreshData}
          />
        );
      case 'goods-audit':
        return (
          <AuditContainer
            data={activeData}
            onUpdateData={updateData}
            onUpdateSurgical={updateSurgical}
            onPushBatch={pushBatch}
          />
        );
      case 'order-invoices':
        return (
          <OrderInvoices
            // Trang Hóa đơn nhận CẢ đơn đã hủy (soft-delete) để xem lại qua lọc "Đã hủy"
            orders={data.posOrders || []}
            customers={data.posCustomers || []}
            employees={data.employees || []}
            storeName={brandProfile.name}
            storeAddress={brandProfile.address}
            storePhone={brandProfile.phone}
            onUpdateSurgical={updateSurgical}
            onEditInPOS={order => {
              setOrderToEdit(order);
              handleSetActiveTab('pos');
            }}
            onReturnInPOS={order => {
              setOrderToReturn(order);
              handleSetActiveTab('pos');
            }}
            onDeleteOrders={async (orderIds: string[]) => {
              const failures: { orderCode: string; error: string }[] = [];
              const deletedOrderIds = new Set<string>();
              const affectedDates = new Set<string>();
              for (const orderId of orderIds) {
                const order = (data.posOrders || []).find(o => o.id === orderId);
                if (!order) {
                  failures.push({ orderCode: orderId, error: 'Không tìm thấy đơn' });
                  continue;
                }
                try {
                  await deletePosOrder({
                    data,
                    order,
                    applyLocalOnly,
                    applyRevenueDeltaLocal,
                    deletePosOrderTx,
                  });
                  deletedOrderIds.add(order.id);
                  affectedDates.add(getOrderLocalDateKey(order));
                } catch (err) {
                  failures.push({
                    orderCode: order.orderCode,
                    error: err instanceof Error ? err.message : 'Lỗi không xác định',
                  });
                }
              }
              // Tính lại sales_records 1 lần cho mỗi ngày bị ảnh hưởng, loại trừ TOÀN BỘ đơn
              // đã xóa trong batch (không chỉ đơn cuối) — tránh đếm lại đơn đã xóa ở bước trước.
              for (const dateKey of affectedDates) {
                try {
                  await recalcSalesRecordsForDate(data, dateKey, deletedOrderIds, updateSurgical);
                } catch (staffErr) {
                  console.error(
                    '[onDeleteOrders] Cập nhật lại doanh số NV thất bại (non-critical):',
                    dateKey,
                    staffErr
                  );
                }
              }
              return { successCount: deletedOrderIds.size, failures };
            }}
          />
        );
      case 'order-returns':
        return (
          <OrderReturns
            // Trang Trả hàng nhận CẢ phiếu đã hủy để hiển thị trạng thái "Đã hủy"
            orders={data.posOrders || []}
            products={data.posProducts || []}
            customers={data.posCustomers || []}
            transactions={data.inventoryTransactions || []}
            onUpdateSurgical={updateSurgical}
            onCancelReturn={async (orderId: string) => {
              const returnOrder = (data.posOrders || []).find(o => o.id === orderId);
              if (!returnOrder) throw new Error('Không tìm thấy phiếu trả hàng');
              await processCancelReturn({
                data,
                returnOrder,
                applyLocalOnly,
                applyRevenueDeltaLocal,
                cancelPosReturnTx,
                updateSurgical,
              });
            }}
            onCancelLegacyReturn={async (transactionId: string) => {
              const transaction = (data.inventoryTransactions || []).find(
                t => t.id === transactionId
              );
              if (!transaction) throw new Error('Không tìm thấy phiếu trả hàng');
              await processCancelLegacyReturnTransaction({
                data,
                transaction,
                updateSurgical,
                applyRevenueDelta,
              });
            }}
            onReturnInPOS={order => {
              setOrderToReturn(order);
              handleSetActiveTab('pos');
            }}
          />
        );
      case 'order-repairs':
        return <OrderRepairs />;
      case 'online-orders':
        return (
          <React.Suspense fallback={<TableSkeleton />}>
            <OnlineOrdersPage navigationSlot={renderOnlineNav()} />
          </React.Suspense>
        );
      case 'delivery-partners':
        return <DeliveryPartners navigationSlot={renderOnlineNav()} />;
      case 'shipping-orders':
        return <ShippingOrders navigationSlot={renderOnlineNav()} />;
      case 'purchase-invoices':
        return (
          <PurchaseInvoices
            transactions={data.inventoryTransactions || []}
            suppliers={data.suppliers || []}
            supplierDebts={data.supplierDebts || []}
            products={data.posProducts || []}
          />
        );
      case 'goods-internal-use':
        return (
          <GoodsInternalUse
            products={data.posProducts || []}
            data={activeData}
            onUpdateSurgical={updateSurgical}
          />
        );
      case 'goods-disposal':
        return (
          <GoodsDisposal
            products={data.posProducts || []}
            data={activeData}
            onUpdateSurgical={updateSurgical}
          />
        );
      case 'analysis-business':
        return (
          <AnalysisContainer
            data={activeData}
            initialSection="business"
            breakEvenAnalysis={breakEvenAnalysis}
            onUpdateData={updateData}
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        );
      case 'analysis-online-sales':
        return renderShopeeRevenueManager({
          initialSubTab: 'diagnosis',
          diagnosisLabel: 'Bán Online',
        });
      case 'analysis-goods':
        return <AnalysisContainer data={activeData} initialSection="goods" onUpdate={updateData} />;
      case 'analysis-customers':
        return <AnalysisContainer data={activeData} initialSection="customers" />;
      case 'analysis-staff':
        return <AnalysisContainer data={activeData} initialSection="staff" />;
      case 'analysis-expenses':
        return (
          <AnalysisContainer data={activeData} initialSection="expenses" onUpdate={updateData} />
        );
      case 'analysis-efficiency':
        return <AnalysisContainer data={activeData} initialSection="efficiency" />;
      case 'analysis-placeholder':
      case 'report-eod':
        return (
          <EndOfDayReportPage
            orders={activePosOrders}
            employees={data.employees || []}
            sales={data.sales || []}
            onUpdateSales={records => updateData('sales', records)}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'report-sales':
        return (
          <SalesReportPage
            orders={activePosOrders}
            products={data.posProducts || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
            employees={data.employees || []}
            inventoryTransactions={data.inventoryTransactions || []}
          />
        );
      case 'report-orders':
        return (
          <OrderReportPage
            orders={activePosOrders}
            products={data.posProducts || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'report-goods':
        return (
          <GoodsReportPage
            orders={activePosOrders}
            products={data.posProducts || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'report-customers':
        return (
          <CustomerReportPage
            orders={activePosOrders}
            customers={data.posCustomers || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'report-suppliers':
        return (
          <SupplierReportPage
            transactions={data.inventoryTransactions || []}
            suppliers={data.suppliers || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'report-staff':
        return (
          <StaffReportPage
            orders={activePosOrders}
            employees={data.employees || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'report-channels':
        return (
          <ChannelReportPage
            orders={activePosOrders}
            employees={data.employees || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'report-finance':
        return (
          <FinanceReportPage
            orders={activePosOrders}
            products={data.posProducts || []}
            expenses={data.expenses || []}
            payroll={data.payroll || []}
            inventoryTransactions={data.inventoryTransactions || []}
            storeName={brandProfile.name || 'Chi nhánh trung tâm'}
          />
        );
      case 'online-catalog':
        return (
          <React.Suspense fallback={<CardSkeleton />}>
            <OnlineCatalogPage
              navigationSlot={renderOnlineNav()}
              onNavigate={handleSetActiveTab}
              products={data.posProducts || []}
            />
          </React.Suspense>
        );
      case 'website-products':
        return (
          <React.Suspense fallback={<CardSkeleton />}>
            <WebsiteProductsPage navigationSlot={renderOnlineNav()} posProducts={data.posProducts || []} />
          </React.Suspense>
        );
      case 'website-orders':
        return (
          <React.Suspense fallback={<TableSkeleton />}>
            <WebsiteOrdersPage navigationSlot={renderOnlineNav()} />
          </React.Suspense>
        );
      case 'website-operations':
        return (
          <React.Suspense fallback={<TableSkeleton />}>
            <WebsiteOperationsPage navigationSlot={renderOnlineNav()} />
          </React.Suspense>
        );
      case 'channel-connections':
        return (
          <React.Suspense fallback={<TableSkeleton />}>
            <WebsiteChannelLinksPage navigationSlot={renderOnlineNav()} />
          </React.Suspense>
        );
      default:
        return null;
    }
  };

  const isPosActive = activeTab === 'pos';
  // Giữ POSComputer mounted sau lần đầu ghé trang — chỉ ẩn/hiện bằng CSS khi chuyển tab khác,
  // để giỏ hàng/danh sách hóa đơn (state trong usePOSState) không bị mất khi quay lại POS.
  const [hasMountedPos, setHasMountedPos] = useState(isPosActive);
  useEffect(() => {
    if (isPosActive) setHasMountedPos(true);
  }, [isPosActive]);
  const isGoodsActive =
    activeTab === 'goods' || activeTab === 'goods-pricing' || activeTab === 'goods-warranty';
  const isStaffActive = activeTab === 'staff' || activeTab === 'staff-ledger';
  const isPayrollActive = activeTab === 'payroll' || activeTab.startsWith('payroll-');
  const isOnlineActive =
    activeTab === 'online-orders' ||
    activeTab === 'shopee-revenue' ||
    activeTab === 'delivery-partners' ||
    activeTab === 'shipping-orders' ||
    activeTab === 'online-catalog' ||
    activeTab === 'website-products' ||
    activeTab === 'website-orders' ||
    activeTab === 'website-operations' ||
    activeTab === 'channel-connections';

  return (
    <div
      className="h-full flex flex-col"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {eodReport && !eodDismissed && (
        <div className="px-4 md:px-8 shrink-0">
          <DashboardEodBanner report={eodReport} onDismiss={() => setEodDismissed(true)} />
        </div>
      )}
      {hasMountedPos && (
        <div
          style={{
            display: isPosActive ? 'flex' : 'none',
            flex: '1 1 0',
            minHeight: 0,
            flexDirection: 'column',
          }}
          className="flex-1 min-h-0"
        >
          <ErrorBoundary key="pos" moduleName="pos">
            <React.Suspense fallback={<CardSkeleton />}>
              <POSComputer
                isActive={isPosActive}
                products={data.posProducts || []}
                productGroups={data.productGroups || []}
                customers={data.posCustomers || []}
                employees={data.employees || []}
                orders={activePosOrders}
                inventoryTransactions={data.inventoryTransactions || []}
                customerDebtHistory={data.customerDebtHistory || []}
                orderToEdit={orderToEdit}
                onOrderEditLoaded={() => setOrderToEdit(null)}
                orderToReturn={orderToReturn}
                onOrderReturnLoaded={() => setOrderToReturn(null)}
                paymentSettings={data.posPaymentSettings}
                inventorySettings={data.posInventorySettings}
                brandProfile={brandProfile}
                currentStaffName={brandProfile?.name || 'Quản lý'}
                onGoToManagement={() => handleSetActiveTab('overview')}
                requireManagerAuth={userRole === 'cashier'}
                onManagerUnlocked={onManagerUnlocked}
                offlineOrderPendingCount={offlineOrderPendingCount}
                isDraining={isDraining}
                onDrainOfflineQueue={onDrainOfflineQueue}
                onAddCustomer={customer => {
                  const updatedCustomers = [...(data.posCustomers || []), customer];
                  updateData('posCustomers', updatedCustomers);
                }}
                onPlaceOrder={(order, updatedProducts, updatedCustomer, debtRecord) =>
                  processPlaceOrder({
                    data,
                    order,
                    updatedProducts,
                    updatedCustomer,
                    debtRecord,
                    allowSellOutOfStock: data.posInventorySettings?.allowSellOutOfStock ?? false,
                    applyLocalOnly,
                    applyRevenueDeltaLocal,
                    placePosOrderTx,
                    updateSurgical,
                  })
                }
                onReturnOrder={(
                  returnOrder,
                  updatedProducts,
                  returnedItems,
                  exchangeItems,
                  updatedCustomer
                ) =>
                  processReturnOrder({
                    data,
                    returnOrder,
                    updatedProducts,
                    returnedItems,
                    exchangeItems,
                    allowSellOutOfStock: data.posInventorySettings?.allowSellOutOfStock ?? false,
                    updatedCustomer,
                    pushBatch,
                    updateSurgical,
                    applyRevenueDelta,
                  })
                }
                onEditOrder={(
                  originalOrder,
                  updatedOrder,
                  updatedCustomer,
                  debtRecord,
                  revertedCustomer
                ) =>
                  editPosOrder({
                    data,
                    originalOrder,
                    updatedOrder,
                    updatedCustomer,
                    revertedCustomer,
                    debtRecord,
                    allowSellOutOfStock: data.posInventorySettings?.allowSellOutOfStock ?? false,
                    applyLocalOnly,
                    applyRevenueDeltaLocal,
                    editPosOrderTx,
                    updateSurgical,
                  })
                }
                onUpdateSurgical={updateSurgical}
                revenue={data.revenue || []}
                isDataReady={isDataReady}
                activeThemeId={activeThemeId}
                onThemeChange={onThemeChange}
                expenses={data.expenses || []}
                expenseCategories={data.expenseCategories || []}
                onAddExpense={expense =>
                  updateData('expenses', [...(data.expenses || []), expense])
                }
              />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      )}
      {isGoodsActive && (
        <div className="h-full min-h-0 pt-10 pb-5 flex flex-col">
          <ErrorBoundary key="goods" moduleName="goods">
            <React.Suspense fallback={<TableSkeleton />}>
              <GoodsInventory
                products={data.posProducts || []}
                transactions={data.inventoryTransactions || []}
                orders={activePosOrders}
                productGroups={data.productGroups || []}
                suppliers={data.suppliers || []}
                inventoryCostMethod={data.posInventorySettings?.costMethod}
                onUpdateProducts={newList => updateData('posProducts', newList)}
                onUpdateSurgical={updateSurgical}
                onPushBatch={pushBatch}
                onAddTransaction={t => pushBatch('inventoryTransactions', [t])}
                requestedTab={
                  activeTab === 'goods-pricing'
                    ? 'pricing'
                    : activeTab === 'goods-warranty'
                      ? 'warranty'
                      : activeTab === 'goods'
                        ? 'goods'
                        : undefined
                }
                initialProductId={editProductId}
                initialViewProductId={viewProductId}
              />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      )}

      {isStaffActive && (
        <div className="h-full min-h-0 pt-10 pb-5 flex flex-col">
          <ErrorBoundary key="staff" moduleName="staff">
            <React.Suspense fallback={<TableSkeleton />}>
              <StaffManager
                list={data.employees}
                policies={data.salaryPolicies}
                allData={data}
                onUpdate={(newList, idToRem) => updateData('employees', newList, idToRem)}
                showResigned={showResigned}
                setShowResigned={setShowResigned}
                onUpdatePerformance={newList => updateData('staffPerformance', newList)}
                onSelectMainTab={handleSetActiveTab}
                requestedTab={
                  activeTab === 'staff-ledger'
                    ? 'ledger'
                    : activeTab === 'staff'
                      ? 'list'
                      : undefined
                }
              />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      )}
      {isPayrollActive && (
        <div className="h-full min-h-0 pt-10 pb-5 flex flex-col">
          <ErrorBoundary key="payroll" moduleName="payroll">
            <React.Suspense fallback={<TableSkeleton />}>
              <PayrollManager
                data={activeData}
                onUpdateData={updateData}
                onUpdateSurgical={updateSurgical}
                showResigned={showResigned}
                setShowResigned={setShowResigned}
                requestedTab={
                  activeTab === 'payroll-overtime'
                    ? 'overtime'
                    : activeTab === 'payroll-sales'
                      ? 'sales'
                      : activeTab === 'payroll-penalties'
                        ? 'penalties'
                        : activeTab === 'payroll-summary'
                          ? 'summary'
                          : activeTab === 'payroll-ledger'
                            ? 'ledger'
                            : isPayrollActive
                              ? 'attendance'
                              : undefined
                }
                onSelectMainTab={handleSetActiveTab}
              />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* All other tabs */}
      {!isPosActive && !isGoodsActive && !isStaffActive && !isPayrollActive && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="h-full"
          >
            <ErrorBoundary key={activeTab} moduleName={activeTab}>
              <React.Suspense
                fallback={
                  <div className="h-full pt-10 pb-5 space-y-8">
                    <CardSkeleton />
                    <TableSkeleton />
                  </div>
                }
              >
                <div className="h-full pt-10 pb-5">{renderContent()}</div>
              </React.Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default MainContent;
