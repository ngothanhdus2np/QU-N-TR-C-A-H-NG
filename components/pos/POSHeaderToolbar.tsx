import React from 'react';
import {
  Activity,
  Check,
  FileText,
  Keyboard,
  LayoutGrid,
  LogOut,
  PackageOpen,
  PenTool,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Undo2,
  X,
} from 'lucide-react';
import { POSProduct } from '../../types';
import type { InvoiceTab } from './types';

interface POSHeaderToolbarProps {
  productSearchRef: React.RefObject<HTMLInputElement | null>;
  searchResultRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setDebouncedSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  productSearchSort: 'skuDesc' | 'priceDesc';
  setProductSearchSort: React.Dispatch<React.SetStateAction<'skuDesc' | 'priceDesc'>>;
  searchFilteredProducts: POSProduct[];
  showProductResults: boolean;
  setShowProductResults: React.Dispatch<React.SetStateAction<boolean>>;
  selectedResultIndex: number;
  setSelectedResultIndex: React.Dispatch<React.SetStateAction<number>>;
  addToCart: (product: POSProduct) => void;
  mode: 'sales' | 'return';
  tabs: InvoiceTab[];
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  closeTab: (e: React.MouseEvent, id: string) => void;
  addNewTab: () => void;
  setShowReturnModal: React.Dispatch<React.SetStateAction<boolean>>;
  offlinePendingCount: number;
  isDraining: boolean;
  isAutoPrintEnabled: boolean;
  setIsAutoPrintEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showGridMenu: boolean;
  setShowGridMenu: React.Dispatch<React.SetStateAction<boolean>>;
  onGoToManagement?: () => void;
  onViewEODReport?: () => void;
  onProcessOrders?: () => void;
  onProcessRepairs?: () => void;
  onShowShortcuts?: () => void;
  onShowSelectInvoice?: () => void;
  onShowReturnInvoice?: () => void;
  onManualSync?: () => void;
  onLogout?: () => void;
}

const POSHeaderToolbar: React.FC<POSHeaderToolbarProps> = ({
  productSearchRef,
  searchResultRefs,
  searchTerm,
  setSearchTerm,
  setDebouncedSearchTerm,
  productSearchSort,
  setProductSearchSort,
  searchFilteredProducts,
  showProductResults,
  setShowProductResults,
  selectedResultIndex,
  setSelectedResultIndex,
  addToCart,
  mode,
  tabs,
  activeTabId,
  setActiveTabId,
  closeTab,
  addNewTab,
  setShowReturnModal,
  offlinePendingCount,
  isDraining,
  isAutoPrintEnabled,
  setIsAutoPrintEnabled,
  showGridMenu,
  setShowGridMenu,
  onGoToManagement,
  onViewEODReport,
  onProcessOrders,
  onProcessRepairs,
  onShowShortcuts,
  onShowSelectInvoice,
  onShowReturnInvoice,
  onManualSync,
  onLogout,
}) => {
  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const [displayLimit, setDisplayLimit] = React.useState(50);
  const [showMobileQR, setShowMobileQR] = React.useState(false);
  const [showVisitorStats, setShowVisitorStats] = React.useState(false);
  const mobileUrl = window.location.origin;
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mobileUrl)}`;
  const sortOptions = [
    { value: 'skuDesc' as const, label: 'Theo mã hàng', helper: 'Cao - thấp' },
    { value: 'priceDesc' as const, label: 'Theo giá tiền', helper: 'Cao - thấp' },
  ];

  // Reset display limit when search term changes
  React.useEffect(() => {
    setDisplayLimit(50);
  }, [searchTerm]);

  return (
    <div
      className="bg-slate-100 h-14 flex items-center px-4 gap-2 shrink-0 shadow-sm z-50 border-b border-slate-200"
      style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: '56px' }}
    >
      <div className="relative w-[clamp(320px,34vw,500px)] shrink-0">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center text-slate-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          ref={productSearchRef}
          type="text"
          placeholder={
            mode === 'return' ? 'Dùng ô tìm hàng trả / hàng đổi bên dưới' : 'Tìm hàng hóa (F3)'
          }
          disabled={mode === 'return'}
          className={`w-full pl-10 pr-11 py-2 border rounded-lg text-sm outline-none font-normal transition-all placeholder:font-normal ${
            mode === 'return'
              ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed placeholder:text-slate-500'
              : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 placeholder:text-slate-400'
          }`}
          value={searchTerm}
          onBlur={() => {
            setTimeout(() => setShowProductResults(false), 200);
          }}
          onFocus={() => {
            if (mode === 'return') return;
            if (searchFilteredProducts.length > 0) setShowProductResults(true);
          }}
          onChange={e => {
            if (mode === 'return') return;
            setSearchTerm(e.target.value);
          }}
          onKeyDown={e => {
            if (mode === 'return') return;
            if (showProductResults && searchFilteredProducts.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedResultIndex(prev => (prev + 1) % searchFilteredProducts.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedResultIndex(
                  prev => (prev - 1 + searchFilteredProducts.length) % searchFilteredProducts.length
                );
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedResultIndex >= 0 && searchFilteredProducts[selectedResultIndex]) {
                  addToCart(searchFilteredProducts[selectedResultIndex]);
                  setSearchTerm('');
                  setDebouncedSearchTerm('');
                  setShowProductResults(false);
                }
              } else if (e.key === 'Escape') {
                setShowProductResults(false);
              }
            }
          }}
        />
        <button
          disabled={mode === 'return'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            if (mode === 'return') return;
            setShowSortMenu(prev => !prev);
          }}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${
            mode === 'return'
              ? 'text-slate-400 cursor-not-allowed'
              : showSortMenu
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-slate-500 hover:text-indigo-500 hover:bg-slate-50'
          }`}
          title="Sắp xếp kết quả tìm kiếm"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {mode !== 'return' && showSortMenu && (
          <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-[0_16px_40px_rgba(15,23,42,0.16)] overflow-hidden z-dropdown p-1">
            {sortOptions.map(option => (
              <button
                key={option.value}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setProductSearchSort(option.value);
                  setShowSortMenu(false);
                  if (searchFilteredProducts.length > 0) setShowProductResults(true);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  productSearchSort === option.value
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>
                  <span className="block text-xs font-normal">{option.label}</span>
                  <span className="block text-2xs font-normal text-slate-400">
                    {option.helper}
                  </span>
                </span>
                {productSearchSort === option.value && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {mode !== 'return' && showProductResults && searchFilteredProducts.length > 0 && (
          <div className="absolute top-full left-0 w-[500px] mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden z-dropdown max-h-[500px] overflow-y-auto">
            {searchFilteredProducts.slice(0, displayLimit).map((p, idx) => {
              const isParent = p.isParent && p.variantCount && p.variantCount > 0;
              const variantAttrs = p.variantAttributes || {};
              const attrKeys = Object.keys(variantAttrs);
              const attrBadge =
                attrKeys.length > 0 ? Object.values(variantAttrs).join(' • ') : null;

              return (
                <button
                  key={p.id}
                  ref={el => {
                    searchResultRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    addToCart(p);
                    setSearchTerm('');
                    setDebouncedSearchTerm('');
                    setShowProductResults(false);
                    setDisplayLimit(50);
                  }}
                  onMouseEnter={() => setSelectedResultIndex(idx)}
                  className={`w-full px-4 py-3 flex items-start gap-3 border-b border-slate-50 last:border-0 transition-all text-left ${idx === selectedResultIndex ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-100">
                    {p.images && p.images[0] ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <PackageOpen className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`text-sm font-normal ${idx === selectedResultIndex ? 'text-indigo-900' : 'text-slate-800'}`}
                        >
                          {p.name}
                        </span>
                        {attrBadge && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-2xs font-normal rounded shrink-0">
                            {attrBadge}
                          </span>
                        )}
                        {isParent && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-2xs font-normal rounded shrink-0">
                            {p.variantCount} biến thể
                          </span>
                        )}
                      </div>
                      <span className="text-indigo-600 font-mono text-sm font-normal shrink-0">
                        {p.salePrice.toLocaleString()}đ
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-mono uppercase">{p.sku}</span>
                      <span className="text-slate-300">|</span>
                      <span className={p.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        Tồn: {p.stock}
                      </span>
                      {p.importPrice && p.importPrice > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>Giá vốn: {p.importPrice.toLocaleString()}đ</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {searchFilteredProducts.length > displayLimit && (
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={e => {
                  e.stopPropagation();
                  setDisplayLimit(prev => prev + 50);
                }}
                className="w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border-t border-indigo-100 text-center transition-colors"
              >
                <span className="text-sm font-normal text-indigo-600">
                  Xem thêm {Math.min(50, searchFilteredProducts.length - displayLimit)} kết quả (
                  {searchFilteredProducts.length - displayLimit} còn lại)
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex h-11 min-w-0 flex-1 items-end self-end overflow-hidden">
        <div
          className="pos-invoice-tab-scroll flex items-end self-stretch min-w-0 w-full overflow-x-auto overflow-y-hidden"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 #f1f5f9',
          }}
        >
          <div className="flex items-end self-stretch min-w-max gap-1.5">
            {tabs.map(tab => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`h-full px-5 flex items-center gap-3 rounded-t-xl font-normal text-sm border-t-2 transition-all cursor-pointer shadow-sm justify-between group ${activeTabId === tab.id ? 'bg-white text-indigo-600 border-indigo-500' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600'}`}
                style={{ minWidth: '153.12px', maxWidth: '153.12px' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{tab.name}</span>
                </div>
                <X
                  className={`h-4 w-4 shrink-0 text-slate-300 hover:text-rose-500 transition-colors ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onClick={e => closeTab(e, tab.id)}
                />
              </div>
            ))}

            {/* Nút + trong flow khi tabs ít */}
            {tabs.length < 5 && (
              <div
                onClick={addNewTab}
                className="relative h-full w-16 shrink-0 flex items-center justify-center text-slate-500 hover:text-indigo-600 cursor-pointer transition-all"
                title="Thêm hóa đơn"
              >
                <Plus className="h-5 w-5" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nút + tách riêng khi tabs nhiều */}
      {tabs.length >= 5 && (
        <div
          onClick={addNewTab}
          className="relative flex h-11 w-16 shrink-0 self-end items-center justify-center text-slate-500 hover:text-indigo-600 cursor-pointer transition-all"
          title="Thêm hóa đơn"
        >
          <Plus className="h-5 w-5" />
          {tabs.length > 5 && (
            <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-[9px] font-normal px-1.5 py-0.5 rounded-full min-w-[16px] text-center border-2 border-white">
              {tabs.length - 5}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 px-2 text-slate-600 ml-auto">
        <div className="relative flex items-center">
          <button
            title="Lượt khách"
            onClick={() => setShowVisitorStats(open => !open)}
            className={`hover:text-indigo-600 transition-colors ${showVisitorStats ? 'text-indigo-600' : ''}`}
          >
            <ShoppingBag className="h-4.5 w-4.5" />
          </button>
          {showVisitorStats && (
            <>
              <div className="fixed inset-0 z-modal" onClick={() => setShowVisitorStats(false)} />
              <div className="absolute right-0 top-full mt-3 w-64 rounded-2xl border border-slate-100 bg-white p-4 shadow-2xl z-modal">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Lượt khách phiên hiện tại</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-400">Hóa đơn mở</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{tabs.length}</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 p-3">
                    <p className="text-indigo-500">Có hàng</p>
                    <p className="mt-1 text-lg font-semibold text-indigo-700">
                      {tabs.filter(tab => tab.cart.length > 0 || (tab.returnCart || []).length > 0).length}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Dùng để kiểm nhanh số phiên bán hàng đang mở trên máy tính tiền.
                </p>
              </div>
            </>
          )}
        </div>
        <div className="relative flex items-center">
          <button
            title="Mở POS trên điện thoại"
            onClick={() => setShowMobileQR(!showMobileQR)}
            className={`flex items-center transition-colors ${showMobileQR ? 'text-indigo-600' : 'hover:text-indigo-600'}`}
          >
            <Smartphone className="h-4.5 w-4.5" />
          </button>
          {showMobileQR && (
            <>
              <div className="fixed inset-0 z-modal" onClick={() => setShowMobileQR(false)} />
              <div className="absolute right-0 top-full mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-modal p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800 text-sm">Mở POS trên điện thoại</h3>
                </div>
                {isLocalhost ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mb-3">
                    Đang dùng localhost. Kết nối cùng WiFi và truy cập bằng địa chỉ IP mạng LAN của
                    máy tính.
                  </p>
                ) : (
                  <>
                    <img
                      src={qrImageUrl}
                      alt="QR Code"
                      className="w-[180px] h-[180px] mx-auto mb-3 rounded-xl"
                    />
                    <p className="text-xs font-mono text-center text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 mb-3 break-all">
                      {mobileUrl}
                    </p>
                  </>
                )}
                <div className="space-y-1.5 text-xs text-slate-500">
                  <p>📶 Kết nối cùng WiFi với máy tính</p>
                  <p>📱 Quét mã QR bằng camera điện thoại</p>
                  <p>🛒 Giao diện POS sẽ tự hiển thị trên mobile</p>
                </div>
              </div>
            </>
          )}
        </div>
        <button
          title="Đổi trả"
          onClick={() => setShowReturnModal(true)}
          className="hover:text-indigo-600 transition-colors"
        >
          <RotateCcw className="h-4.5 w-4.5" />
        </button>
        <button
          title="Đồng bộ"
          onClick={onManualSync}
          className={`relative hover:text-indigo-600 transition-colors ${isDraining ? 'text-indigo-600' : ''}`}
        >
          <RefreshCw className={`h-4.5 w-4.5 ${isDraining ? 'animate-spin' : ''}`} />
          {offlinePendingCount > 0 && !isDraining && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-normal px-1.5 py-0.5 rounded-full min-w-[16px] text-center border-2 border-white">
              {offlinePendingCount}
            </span>
          )}
        </button>
        <button
          title="In (Auto)"
          onClick={() => setIsAutoPrintEnabled(!isAutoPrintEnabled)}
          className={`transition-all ${isAutoPrintEnabled ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Printer className="h-4.5 w-4.5" />
        </button>
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-normal text-slate-700 uppercase">admin</span>
          </div>
          <div className="relative">
            <div
              onClick={() => setShowGridMenu(!showGridMenu)}
              className={`h-9 w-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${showGridMenu ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`}
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </div>

            {showGridMenu && (
              <>
                <div className="fixed inset-0 z-modal" onClick={() => setShowGridMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 z-modal overflow-hidden py-2 animate-in fade-in slide-in-from-top-4 duration-200">
                  <GridMenuItem
                    icon={<Activity className="h-4.5 w-4.5" />}
                    label="Xem báo cáo cuối ngày"
                    onClick={onViewEODReport}
                  />
                  <GridMenuItem
                    icon={<FileText className="h-4.5 w-4.5" />}
                    label="Chọn hóa đơn"
                    onClick={onShowSelectInvoice}
                  />
                  <GridMenuItem
                    icon={<ShoppingBag className="h-4.5 w-4.5" />}
                    label="Xử lý đặt hàng"
                    onClick={onProcessOrders}
                  />
                  <GridMenuItem
                    icon={<Undo2 className="h-4.5 w-4.5" />}
                    label="Chọn hóa đơn trả hàng"
                    onClick={onShowReturnInvoice}
                  />
                  <GridMenuItem
                    icon={<PenTool className="h-4.5 w-4.5" />}
                    label="Xử lý yêu cầu sửa chữa"
                    onClick={onProcessRepairs}
                  />
                  <GridMenuItem
                    icon={<Keyboard className="h-4.5 w-4.5" />}
                    label="Phím tắt"
                    onClick={onShowShortcuts}
                  />
                  <GridMenuItem
                    icon={<LayoutGrid className="h-4.5 w-4.5" />}
                    label="Quản lý"
                    onClick={onGoToManagement}
                  />
                  <div className="h-px bg-slate-50 my-1 mx-4" />
                  <GridMenuItem
                    icon={<LogOut className="h-4.5 w-4.5 text-rose-500" />}
                    label="Đăng xuất"
                    onClick={onLogout}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const GridMenuItem = ({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full px-6 py-3.5 flex items-center gap-4 transition-all text-left ${active ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
  >
    <span className={active ? 'text-slate-900' : 'text-slate-500'}>{icon}</span>
    <span className={`text-sm font-normal ${active ? 'text-slate-900' : 'text-slate-700'}`}>
      {label}
    </span>
  </button>
);

export default POSHeaderToolbar;
