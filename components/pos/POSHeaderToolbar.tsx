import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  ChevronDown,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Keyboard,
  LayoutGrid,
  LogOut,
  Package,
  PackageOpen,
  Palette,
  PenTool,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Truck,
  Receipt,
  Undo2,
  X,
} from 'lucide-react';
import { POSProduct, BrandProfile } from '../../types';
import type { InvoiceTab } from './types';
import type { POSPrintSettings } from '../../hooks/usePOSState';
import { APP_THEMES, AppThemeId } from '../../constants/themes';
import { adminStoreRequest } from '../../services/adminStoreApi';

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
  printSettings: POSPrintSettings;
  setPrintSettings: (updater: POSPrintSettings | ((prev: POSPrintSettings) => POSPrintSettings)) => void;
  brandProfile?: BrandProfile;
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
  onCreateExpense?: () => void;
  onLogout?: () => void;
  activeThemeId?: AppThemeId;
  onThemeChange?: (id: AppThemeId) => void;
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
  printSettings,
  setPrintSettings,
  brandProfile,
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
  onCreateExpense,
  onLogout,
  activeThemeId,
  onThemeChange,
}) => {
  const navigate = useNavigate();

  const [onlinePendingCount, setOnlinePendingCount] = useState(() => {
    try { return parseInt(localStorage.getItem('online_pending_count') || '0', 10) || 0; } catch { return 0; }
  });

  useEffect(() => {
    const sync = () => {
      try { setOnlinePendingCount(parseInt(localStorage.getItem('online_pending_count') || '0', 10) || 0); } catch {}
    };
    window.addEventListener('online_pending_count_changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('online_pending_count_changed', sync); window.removeEventListener('storage', sync); };
  }, []);

  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const [showThemePicker, setShowThemePicker] = React.useState(false);
  const [showPrintMenu, setShowPrintMenu] = React.useState(false);
  const [showPrintPreview, setShowPrintPreview] = React.useState(false);
  const [showWarrantyModeMenu, setShowWarrantyModeMenu] = React.useState(false);
  const [displayLimit, setDisplayLimit] = React.useState(50);
  const [showMobileQR, setShowMobileQR] = React.useState(false);
  const [showOnlineOrdersPopup, setShowOnlineOrdersPopup] = React.useState(false);
  const [lanIp, setLanIp] = React.useState<string>('');
  const [mobileToken, setMobileToken] = React.useState<string>('');
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseMobileUrl = isLocalhost && lanIp
    ? `http://${lanIp}:${window.location.port || 3000}/pos-quick`
    : window.location.origin + '/pos-quick';
  // Chỉ phát QR khi đã có token — tránh tạo link mở API mobile không bảo vệ
  const mobileUrl = mobileToken
    ? `${baseMobileUrl}?t=${encodeURIComponent(mobileToken)}`
    : baseMobileUrl;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mobileUrl)}`;

  React.useEffect(() => {
    if (isLocalhost && !lanIp) {
      fetch('/api/local-ip').then(r => r.json()).then(d => { if (d.ip) setLanIp(d.ip); }).catch(() => {});
    }
  }, [isLocalhost, lanIp]);

  React.useEffect(() => {
    adminStoreRequest<{ token: string }>('/api/pos-mobile/token')
      .then(d => { if (d?.token) setMobileToken(d.token); })
      .catch(() => {});
  }, []);
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
                      <span className="text-indigo-600 text-sm font-normal shrink-0">
                        {p.salePrice.toLocaleString()}đ
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="uppercase">{p.sku}</span>
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
            title="Đơn hàng online"
            onClick={() => setShowOnlineOrdersPopup(open => !open)}
            className={`relative hover:text-indigo-600 transition-colors ${showOnlineOrdersPopup ? 'text-indigo-600' : ''}`}
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            {onlinePendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1 py-0 rounded-full min-w-[15px] h-[15px] flex items-center justify-center border border-white leading-none">
                {onlinePendingCount > 99 ? '99+' : onlinePendingCount}
              </span>
            )}
          </button>
          {showOnlineOrdersPopup && (
            <OnlineOrdersMiniPopup onClose={() => setShowOnlineOrdersPopup(false)} />
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
                {isLocalhost && !lanIp ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mb-3">
                    Đang lấy IP mạng LAN...
                  </p>
                ) : (
                  <>
                    <img
                      src={qrImageUrl}
                      alt="QR Code"
                      className="w-[180px] h-[180px] mx-auto mb-3 rounded-xl"
                    />
                    <p className="text-xs text-center text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 mb-3 break-all">
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
        {onThemeChange && (
          <div className="relative">
            <button
              title="Đổi giao diện"
              onClick={() => setShowThemePicker(v => !v)}
              className={`transition-all hover:text-indigo-600 ${showThemePicker ? 'text-indigo-600' : ''}`}
            >
              <Palette className="h-4.5 w-4.5" />
            </button>
            {showThemePicker && (
              <>
                <div className="fixed inset-0 z-modal" onClick={() => setShowThemePicker(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 z-modal overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="p-3">
                    <p className="text-xs text-slate-400 font-medium px-1 mb-2">Chọn giao diện</p>
                    <div className="space-y-1">
                      {APP_THEMES.map(theme => (
                        <button
                          key={theme.id}
                          onClick={() => { onThemeChange(theme.id); setShowThemePicker(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${activeThemeId === theme.id ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <span
                            className="w-6 h-6 rounded-full shrink-0 border-2 border-white shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${theme.previewBg} 50%, ${theme.previewAccent} 50%)` }}
                          />
                          <span className="font-medium">{theme.name}</span>
                          {activeThemeId === theme.id && <Check className="h-3.5 w-3.5 ml-auto text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
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
        <div className="relative">
          <button
            title="Cài đặt in"
            onClick={() => setShowPrintMenu(v => !v)}
            className={`transition-all hover:text-indigo-600 ${printSettings.autoPrintInvoice ? 'text-indigo-600' : ''}`}
          >
            <Printer className="h-4.5 w-4.5" />
          </button>

          {showPrintMenu && (
            <>
              <div className="fixed inset-0 z-modal" onClick={() => setShowPrintMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 z-modal overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="p-4 space-y-3">
                  {/* Tự động in hóa đơn */}
                  <PrintToggleRow
                    label="Tự động in hóa đơn"
                    checked={printSettings.autoPrintInvoice}
                    onChange={v => setPrintSettings(p => ({ ...p, autoPrintInvoice: v }))}
                  />

                  {printSettings.autoPrintInvoice && (
                    <>
                      {/* Gộp hàng cùng loại */}
                      <PrintToggleRow
                        label="Gộp hàng cùng loại"
                        checked={printSettings.mergeItems}
                        onChange={v => setPrintSettings(p => ({ ...p, mergeItems: v }))}
                      />

                      {/* Số bản in hóa đơn */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">Số bản in (Liên)</span>
                        <PrintCopiesInput
                          value={printSettings.invoiceCopies}
                          onChange={v => setPrintSettings(p => ({ ...p, invoiceCopies: v }))}
                        />
                      </div>

                      {/* Chọn mẫu in */}
                      <div>
                        <p className="text-sm text-slate-500 mb-1.5">Chọn mẫu in</p>
                        <button
                          onClick={() => setShowPrintPreview(true)}
                          className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg font-normal hover:bg-indigo-700 transition-colors"
                        >
                          A. Mẫu in hóa đơn
                        </button>
                      </div>
                    </>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-slate-100" />

                  {/* Tự động in phiếu bảo hành */}
                  <PrintToggleRow
                    label="Tự động in phiếu bảo hành"
                    checked={printSettings.autoPrintWarranty}
                    onChange={v => setPrintSettings(p => ({ ...p, autoPrintWarranty: v }))}
                  />

                  {printSettings.autoPrintWarranty && (
                    <>
                      {/* Cho mỗi hàng hóa — custom dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setShowWarrantyModeMenu(v => !v)}
                          className="w-full flex items-center justify-between text-sm text-slate-700 py-1.5 hover:text-indigo-600 transition-colors"
                        >
                          <span>{printSettings.warrantyMode === 'per_item' ? 'Cho mỗi hàng hóa' : 'Danh sách hàng bảo hành'}</span>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showWarrantyModeMenu ? 'rotate-180' : ''}`} />
                        </button>
                        {showWarrantyModeMenu && (
                          <>
                            <div className="fixed inset-0 z-[9999]" onClick={() => setShowWarrantyModeMenu(false)} />
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-[9999] overflow-hidden">
                              {([
                                { value: 'per_item', label: 'Cho mỗi hàng hóa' },
                                { value: 'per_order', label: 'Danh sách hàng bảo hành' },
                              ] as const).map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setPrintSettings(p => ({ ...p, warrantyMode: opt.value })); setShowWarrantyModeMenu(false); }}
                                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                >
                                  <span>{opt.label}</span>
                                  {printSettings.warrantyMode === opt.value && <Check className="h-4 w-4 text-indigo-600" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Số bản in bảo hành */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">Số bản in (Liên)</span>
                        <PrintCopiesInput
                          value={printSettings.warrantyCopies}
                          onChange={v => setPrintSettings(p => ({ ...p, warrantyCopies: v }))}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex border-t border-slate-100">
                  <button
                    onClick={() => setShowPrintMenu(false)}
                    className="flex-1 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-100"
                  >
                    Bỏ qua
                  </button>
                  <button
                    onClick={() => setShowPrintMenu(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    Xong
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Popup xem trước hóa đơn */}
        {showPrintPreview && (
          <PrintPreviewModal
            brandProfile={brandProfile}
            onClose={() => setShowPrintPreview(false)}
          />
        )}

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
                  <GridMenuItem
                    icon={<Receipt className="h-4.5 w-4.5" />}
                    label="Lập phiếu chi"
                    onClick={onCreateExpense}
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

const SAMPLE_ORDER = {
  orderCode: 'HD000001',
  date: new Date().toISOString(),
  customerName: 'Nguyễn Văn A',
  staffName: 'Thu ngân',
  items: [
    { name: 'Giày thể thao nam', price: 450000, quantity: 1, total: 450000 },
    { name: 'Dép sandal nữ size 37', price: 280000, quantity: 2, total: 560000 },
  ],
  totalAmount: 1010000,
  discount: 50000,
  finalAmount: 960000,
  cashReceived: 1000000,
  paymentMethod: 'cash' as const,
};

const PrintPreviewModal = ({
  brandProfile,
  onClose,
}: {
  brandProfile?: BrandProfile;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div>
          <p className="text-sm font-semibold text-slate-800">Xem trước mẫu in</p>
          <p className="text-xs text-slate-400 mt-0.5">A. Mẫu in hóa đơn</p>
        </div>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-500 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview area — dashed border như tờ in thật */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="border border-dashed border-slate-300 rounded-xl p-5 text-xs space-y-3">
          {/* Store header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-200">
            {brandProfile?.logo && (
              <img
                src={brandProfile.logo}
                alt="logo"
                className="w-13 h-13 rounded-full object-cover mx-auto mb-2 border border-slate-100"
                style={{ width: 52, height: 52 }}
              />
            )}
            <p className="text-sm font-bold">{brandProfile?.name || 'TÊN CỬA HÀNG'}</p>
            {brandProfile?.address && <p className="text-slate-500">{brandProfile.address}</p>}
            {brandProfile?.phone && <p className="text-slate-500">ĐT: {brandProfile.phone}</p>}
            <p className="text-slate-400 text-[10px] pt-1 uppercase tracking-wide">Hóa đơn bán hàng</p>
          </div>

          {/* Order info */}
          <div className="space-y-1 pb-2 border-b border-dashed border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-400">Mã HĐ:</span>
              <span className="font-medium">{SAMPLE_ORDER.orderCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ngày:</span>
              <span>{new Date(SAMPLE_ORDER.date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Khách hàng:</span>
              <span>{SAMPLE_ORDER.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Thu ngân:</span>
              <span>{SAMPLE_ORDER.staffName}</span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1.5 pb-2 border-b border-dashed border-slate-200">
            {SAMPLE_ORDER.items.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-indigo-600 shrink-0">{item.total.toLocaleString()}đ</span>
                </div>
                <div className="text-slate-400 text-[10px]">{item.price.toLocaleString()}đ × {item.quantity}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Tiền hàng:</span>
              <span>{SAMPLE_ORDER.totalAmount.toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Giảm giá:</span>
              <span className="text-rose-500">-{SAMPLE_ORDER.discount.toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1.5 mt-0.5 border-t-2 border-slate-300">
              <span>Cần thanh toán:</span>
              <span className="text-indigo-600">{SAMPLE_ORDER.finalAmount.toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tiền khách đưa:</span>
              <span>{SAMPLE_ORDER.cashReceived.toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tiền thừa:</span>
              <span>{(SAMPLE_ORDER.cashReceived - SAMPLE_ORDER.finalAmount).toLocaleString()}đ</span>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-400 text-[10px] pt-2 border-t border-dashed border-slate-200">
            Cảm ơn quý khách. Hẹn gặp lại!
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="px-5 py-3 border-t border-slate-100 shrink-0">
        <button
          onClick={onClose}
          className="w-full py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
);

const PrintToggleRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-700">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  </div>
);

const PrintCopiesInput = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center gap-1">
    <button
      onClick={() => onChange(Math.max(1, value - 1))}
      className="w-6 h-6 text-slate-400 hover:text-slate-700 flex items-center justify-center text-base leading-none transition-colors"
    >
      −
    </button>
    <span className="w-5 text-center text-sm text-slate-700 select-none">{value}</span>
    <button
      onClick={() => onChange(Math.min(9, value + 1))}
      className="w-6 h-6 text-slate-400 hover:text-slate-700 flex items-center justify-center text-base leading-none transition-colors"
    >
      +
    </button>
  </div>
);

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

// ─── Online Orders Mini Popup ─────────────────────────────────────────────────

type OnlineDisplayStatus = 'waiting_confirm' | 'pending' | 'shipping' | 'delivered' | 'cancelled' | 'return' | 'other';
type OnlinePlatform = 'shopee' | 'website';
type OnlinePlatformFilter = 'all' | 'shopee' | 'website';

interface OnlineOrder {
  key: string;
  platform: OnlinePlatform;
  shopLabel?: string;
  shopBadgeClass?: string;
  shopDotClass?: string;
  date_ts: number;
  has_exact_time: boolean;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  product_summary: string;
  sku_summary: string;
  amount: number;
  location: string;
  carrier: string;
  display_status: OnlineDisplayStatus;
  status_label: string;
}

interface WebsiteOrderRaw {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  created_at: string;
  store_order_addresses: { district: string | null; province: string | null }[];
  shipments: { provider: string | null; created_at: string }[];
  items: { productName: string; sku: string }[];
}

const ONLINE_SHOPS = [
  { id: 1, api: 'http://localhost:3001/api/orders', label: 'Giày Dép Da Phúc Sang',      badgeClass: 'bg-indigo-50 text-indigo-700',  dotClass: 'bg-indigo-400' },
  { id: 2, api: 'http://localhost:3002/api/orders', label: 'Phúc Sang_Đồ Da Cao Cấp 93', badgeClass: 'bg-violet-50 text-violet-700', dotClass: 'bg-violet-400' },
];

const SHOPEE_STATUS_MAP_POP: Record<string, OnlineDisplayStatus> = {
  UNPAID: 'other', PROCESSED: 'other',
  READY_TO_SHIP: 'pending', RETRY_SHIP: 'pending',
  SHIPPED: 'shipping', TO_CONFIRM_RECEIVE: 'shipping',
  COMPLETED: 'delivered', CANCELLED: 'cancelled', IN_CANCEL: 'cancelled',
  TO_RETURN: 'return',
};

function shopeeToDisplayPop(status: string): OnlineDisplayStatus {
  if (SHOPEE_STATUS_MAP_POP[status]) return SHOPEE_STATUS_MAP_POP[status];
  if (status.includes('Chờ xác nhận')) return 'waiting_confirm';
  if (status.includes('Chờ lấy hàng')) return 'pending';
  if (status.includes('Đã giao cho ĐVVC') || status.includes('Đang giao')) return 'shipping';
  if (status.includes('Đã nhận được hàng') || status.includes('Đã giao')) return 'delivered';
  if (status.includes('Trả hàng') || status.includes('Hoàn tiền') || status.includes('hoàn trả')) return 'return';
  if (status.toLowerCase().includes('hủy')) return 'cancelled';
  return 'other';
}

const WEBSITE_STATUS_MAP_POP: Record<string, OnlineDisplayStatus> = {
  pending: 'waiting_confirm', confirmed: 'waiting_confirm',
  packing: 'pending', ready_to_ship: 'pending',
  shipping: 'shipping', completed: 'delivered',
  cancelled: 'cancelled', return_requested: 'return', returned: 'return',
};

const WEBSITE_STATUS_LABELS_POP: Record<string, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói', ready_to_ship: 'Sẵn sàng giao',
  shipping: 'Đang giao', completed: 'Hoàn thành',
  cancelled: 'Đã hủy', return_requested: 'Đang hoàn hàng', returned: 'Đã hoàn hàng',
};

const STATUS_META_POP: Record<OnlineDisplayStatus, { label: string; dot: string; badge: string }> = {
  waiting_confirm: { label: 'Chờ xác nhận', dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700' },
  pending:         { label: 'Chờ lấy hàng', dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700' },
  shipping:        { label: 'Đang giao',     dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700' },
  delivered:       { label: 'Đã giao',       dot: 'bg-emerald-400',badge: 'bg-emerald-50 text-emerald-700' },
  cancelled:       { label: 'Đã hủy',        dot: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-500' },
  return:          { label: 'Hoàn hàng',     dot: 'bg-rose-400',   badge: 'bg-rose-50 text-rose-700' },
  other:           { label: 'Khác',          dot: 'bg-purple-300', badge: 'bg-purple-50 text-purple-700' },
};

const ORDER_WINDOW_MS = 25 * 24 * 60 * 60 * 1000;
const RETURN_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;

function snToTs(sn: string, createTimeUnix: number, orderDate: string): number {
  // Ưu tiên create_time_unix (Unix timestamp thực từ Shopee API)
  if (createTimeUnix && createTimeUnix > 0) return createTimeUnix * 1000;
  // Fallback: parse DD/MM/YYYY hoặc DD/M/YYYY từ order_date
  if (orderDate) {
    const m = orderDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) { const t = Date.parse(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`); if (!isNaN(t)) return t; }
  }
  // Fallback cuối: parse YYMMDD từ SN
  const snM = sn.match(/^(\d{2})(\d{2})(\d{2})/);
  if (snM) { const t = Date.parse(`20${snM[1]}-${snM[2]}-${snM[3]}`); if (!isNaN(t)) return t; }
  return Date.now();
}

function fmtDate(ts: number, hasExactTime: boolean) {
  const d = new Date(ts);
  return {
    time: hasExactTime ? d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null,
    date: d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
}

const fmtMoney = (v: number) => (v ? `${v.toLocaleString('vi-VN')}đ` : '—');

const OnlineOrdersMiniPopup = ({ onClose }: { onClose: () => void }) => {
  const [shopeeOrders, setShopeeOrders] = useState<OnlineOrder[]>([]);
  const [websiteOrders, setWebsiteOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<OnlinePlatformFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | OnlineDisplayStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadShopee = useCallback(async () => {
    const PAGE_SIZE = 200;
    const results: OnlineOrder[] = [];
    for (const shop of ONLINE_SHOPS) {
      try {
        let offset = 0;
        while (true) {
          const res = await fetch(`${shop.api}?limit=${PAGE_SIZE}&offset=${offset}`);
          const json = await res.json();
          if (!json.ok || !Array.isArray(json.data) || json.data.length === 0) break;
          for (const o of json.data) {
            const hasExact = !!(o.create_time_unix && o.create_time_unix > 0);
            const ts = snToTs(o.order_sn ?? '', o.create_time_unix ?? 0, o.order_date ?? '');
            const now = Date.now();
            if (now - ts > ORDER_WINDOW_MS) continue;
            const ds = shopeeToDisplayPop(o.status ?? '');
            if (ds === 'cancelled') continue;
            if (o.status === 'Đã nhận được hàng' && o.first_delivered_at) {
              if (now - new Date(o.first_delivered_at).getTime() > RETURN_WINDOW_MS) continue;
            }
            results.push({
              key: `shopee-${shop.id}-${o.order_sn}`,
              platform: 'shopee',
              shopLabel: shop.label,
              shopBadgeClass: shop.badgeClass,
              shopDotClass: shop.dotClass,
              date_ts: ts,
              has_exact_time: hasExact,
              order_id: o.order_sn ?? '',
              customer_name: o.buyer_name ?? '',
              customer_phone: o.buyer_phone ?? '',
              product_summary: o.product_name ?? '',
              sku_summary: [o.product_sku, o.variation].filter(Boolean).join(' · '),
              amount: o.buyer_paid ?? 0,
              location: o.province ?? '',
              carrier: o.shipping_carrier ?? '',
              display_status: ds,
              status_label: STATUS_META_POP[ds]?.label ?? o.status,
            });
          }
          if (json.data.length < PAGE_SIZE) break;
          offset += json.data.length;
        }
      } catch { /* Shopee monitor chưa chạy */ }
    }
    setShopeeOrders(results);
  }, []);

  const loadWebsite = useCallback(async () => {
    try {
      const result = await adminStoreRequest<{ data: WebsiteOrderRaw[] }>('/api/admin/store/orders');
      const rows = (result.data ?? []).map((o): OnlineOrder => {
        const ds: OnlineDisplayStatus = WEBSITE_STATUS_MAP_POP[o.status] ?? 'other';
        const addr = o.store_order_addresses?.[0];
        const shipment = o.shipments?.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        const items = o.items ?? [];
        const productSummary = items.length === 0 ? ''
          : items.length === 1 ? items[0].productName
          : `${items[0].productName} + ${items.length - 1} sản phẩm khác`;
        return {
          key: `website-${o.id}`,
          platform: 'website',
          date_ts: new Date(o.created_at).getTime(),
          has_exact_time: true,
          order_id: o.order_code,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          product_summary: productSummary,
          sku_summary: items[0]?.sku ?? '',
          amount: o.total_amount,
          location: [addr?.district, addr?.province].filter(Boolean).join(', '),
          carrier: shipment?.provider ?? '',
          display_status: ds,
          status_label: WEBSITE_STATUS_LABELS_POP[o.status] ?? o.status,
        };
      });
      setWebsiteOrders(rows);
    } catch { /* lỗi load website */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadShopee(), loadWebsite()]);
    setLoading(false);
  }, [loadShopee, loadWebsite]);

  useEffect(() => { load(); }, [load]);

  // Reset status filter when platform changes
  useEffect(() => { setStatusFilter('all'); }, [platformFilter]);

  const allOrders = useMemo(
    () => [...shopeeOrders, ...websiteOrders].sort((a, b) => b.date_ts - a.date_ts),
    [shopeeOrders, websiteOrders]
  );

  // Platform-filtered only (used for stat cards)
  const platformFiltered = useMemo(() => {
    if (platformFilter === 'all') return allOrders;
    return allOrders.filter(o => o.platform === platformFilter);
  }, [allOrders, platformFilter]);

  const stats = useMemo(() => ({
    pending:  platformFiltered.filter(o => o.display_status === 'pending').length,
    shipping: platformFiltered.filter(o => o.display_status === 'shipping').length,
    delivered:platformFiltered.filter(o => o.display_status === 'delivered').length,
    waiting:  platformFiltered.filter(o => o.display_status === 'waiting_confirm').length,
    returning:platformFiltered.filter(o => o.display_status === 'return').length,
    cancelled:platformFiltered.filter(o => o.display_status === 'cancelled').length,
    total:    platformFiltered.length,
    shopee:   shopeeOrders.length,
    website:  websiteOrders.length,
  }), [platformFiltered, shopeeOrders, websiteOrders]);

  // Final filtered (platform + status + search)
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return platformFiltered.filter(o => {
      if (statusFilter !== 'all' && o.display_status !== statusFilter) return false;
      if (!q) return true;
      return [o.order_id, o.customer_name, o.customer_phone, o.product_summary, o.sku_summary, o.location, o.carrier, o.shopLabel ?? '']
        .join(' ').toLowerCase().includes(q);
    });
  }, [platformFiltered, statusFilter, searchTerm]);

  const toggleStatus = (s: 'all' | OnlineDisplayStatus) =>
    setStatusFilter(prev => prev === s ? 'all' : s);

  const platformTabs: { value: OnlinePlatformFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all',     label: 'Tất cả',  icon: <Package className="h-3.5 w-3.5" /> },
    { value: 'shopee',  label: 'Shopee',  icon: <ShoppingCart className="h-3.5 w-3.5" /> },
    { value: 'website', label: 'Website', icon: <Globe className="h-3.5 w-3.5" /> },
  ];

  const statusTabs: { value: OnlineDisplayStatus; label: string; count: number }[] = [
    { value: 'waiting_confirm', label: 'Chờ xác nhận', count: stats.waiting },
    { value: 'pending',         label: 'Chờ lấy hàng', count: stats.pending },
    { value: 'shipping',        label: 'Đang giao',     count: stats.shipping },
    { value: 'delivered',       label: 'Đã giao',       count: stats.delivered },
    { value: 'return',          label: 'Hoàn hàng',     count: stats.returning },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-modal flex items-center justify-center p-6">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-semibold text-xl text-slate-900 uppercase tracking-tight">Đơn hàng Online</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tổng hợp từ Shopee và Website · Chỉ xem</p>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 rounded-xl hover:text-rose-500 transition-all border border-transparent hover:border-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-[220px] border-r border-slate-100 p-5 space-y-5 overflow-y-auto no-scrollbar shrink-0 bg-slate-50/50 flex flex-col">
            {/* Kênh bán */}
            <section className="space-y-1.5">
              <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-widest px-1 mb-2">Kênh bán</h4>
              {platformTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setPlatformFilter(tab.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                    platformFilter === tab.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <span className="flex items-center gap-2">{tab.icon}{tab.label}</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    platformFilter === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>{stats.total === 0 && tab.value === 'all' ? allOrders.length : tab.value === 'all' ? stats.total : tab.value === 'shopee' ? stats.shopee : stats.website}</span>
                </button>
              ))}
            </section>

            {/* Trạng thái */}
            <section className="space-y-1.5">
              <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-widest px-1 mb-2">Trạng thái</h4>
              <button
                onClick={() => setStatusFilter('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                  statusFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />Tất cả</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{stats.total}</span>
              </button>
              {statusTabs.map(tab => {
                const meta = STATUS_META_POP[tab.value];
                return (
                  <button
                    key={tab.value}
                    onClick={() => toggleStatus(tab.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                      statusFilter === tab.value ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      {tab.label}
                    </span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${statusFilter === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
                  </button>
                );
              })}
            </section>

            <div className="mt-auto pt-2">
              <button
                onClick={load}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs text-slate-500 hover:bg-white transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Tải lại
              </button>
            </div>
          </div>

          {/* Table area */}
          <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
            {/* Stat cards — giống AllOrdersPage */}
            <div className="border-b border-slate-200 p-4 space-y-3 shrink-0">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { label: 'Chờ lấy hàng', value: stats.pending,   Icon: Package,      filter: 'pending'   as OnlineDisplayStatus, iconCls: 'text-amber-400',   activeCls: 'border-amber-300 bg-amber-50' },
                  { label: 'Đang giao',     value: stats.shipping,  Icon: Truck,        filter: 'shipping'  as OnlineDisplayStatus, iconCls: 'text-blue-400',    activeCls: 'border-blue-300 bg-blue-50' },
                  { label: 'Đã giao',       value: stats.delivered, Icon: CheckCircle,  filter: 'delivered' as OnlineDisplayStatus, iconCls: 'text-emerald-400', activeCls: 'border-emerald-300 bg-emerald-50' },
                ] as const).map(({ label, value, Icon, filter, iconCls, activeCls }) => (
                  <button
                    key={label}
                    onClick={() => toggleStatus(filter)}
                    className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === filter ? activeCls : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium leading-tight text-slate-500">{label}</p>
                      <Icon className={`h-4 w-4 shrink-0 ${iconCls}`} />
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {([
                  { label: 'Chờ xác nhận', value: stats.waiting,   Icon: Clock,        filter: 'waiting_confirm' as OnlineDisplayStatus, activeCls: 'border-orange-300 bg-orange-50' },
                  { label: 'Hoàn hàng',    value: stats.returning, Icon: RotateCcw,    filter: 'return'          as OnlineDisplayStatus, activeCls: 'border-rose-300 bg-rose-50' },
                  { label: 'Đã hủy',       value: stats.cancelled, Icon: AlertCircle,  filter: 'cancelled'       as OnlineDisplayStatus, activeCls: 'border-slate-300 bg-slate-100' },
                  { label: 'Tổng đơn',     value: stats.total,     Icon: FileText,     filter: 'all'             as 'all',               activeCls: 'border-indigo-300 bg-indigo-50' },
                ] as const).map(({ label, value, Icon, filter, activeCls }) => (
                  <button
                    key={label}
                    onClick={() => toggleStatus(filter as 'all' | OnlineDisplayStatus)}
                    className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === filter ? activeCls : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium leading-tight text-slate-500">{label}</p>
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Table header bar */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Mã đơn, khách hàng, sản phẩm..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-indigo-400 focus:bg-white transition-all w-64"
                  />
                </div>
                <p className="text-xs text-slate-500">{filtered.length} kết quả · chỉ xem</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                  <ShoppingCart className="h-3 w-3" /> Shopee {stats.shopee}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  <Globe className="h-3 w-3" /> Website {stats.website}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  <span className="text-sm">Đang tải đơn hàng...</span>
                </div>
              ) : (
                <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 100 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 130 }} />
                  </colgroup>
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                      <th className="px-4 py-3 text-left">Ngày đặt</th>
                      <th className="px-4 py-3 text-left">Kênh</th>
                      <th className="px-4 py-3 text-left">Mã đơn</th>
                      <th className="px-4 py-3 text-left">Khách hàng</th>
                      <th className="px-4 py-3 text-left">Sản phẩm</th>
                      <th className="px-4 py-3 text-left">Địa điểm / ĐVVC</th>
                      <th className="px-4 py-3 text-right">Thanh toán</th>
                      <th className="px-4 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                          <p className="text-sm font-semibold">Không có đơn nào</p>
                        </td>
                      </tr>
                    ) : filtered.map(order => {
                      const meta = STATUS_META_POP[order.display_status];
                      const { time, date } = fmtDate(order.date_ts, order.has_exact_time);
                      return (
                        <tr key={order.key} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs">
                            {time && <div className="font-medium text-slate-700">{time}</div>}
                            <div className={time ? 'text-slate-400' : 'font-medium text-slate-700'}>{date}</div>
                          </td>
                          <td className="px-4 py-3">
                            {order.platform === 'shopee' ? (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold max-w-full overflow-hidden ${order.shopBadgeClass}`}>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${order.shopDotClass}`} />
                                <span className="truncate">{order.shopLabel}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                <Globe className="h-3 w-3 shrink-0" />
                                Website
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-indigo-600 truncate">{order.order_id}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 truncate">{order.customer_name || '—'}</p>
                            {order.customer_phone && <p className="text-xs text-slate-500">{order.customer_phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="truncate text-slate-800">{order.product_summary || '—'}</p>
                            {order.sku_summary && <p className="text-xs text-slate-400 truncate">{order.sku_summary}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <p className="truncate">{order.location || '—'}</p>
                            {order.carrier && <p className="text-xs text-slate-400 truncate">{order.carrier}</p>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-800">{fmtMoney(order.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {order.status_label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSHeaderToolbar;
