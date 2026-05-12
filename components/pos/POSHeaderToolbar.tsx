import React from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  Eye,
  FileInput,
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
  StickyNote,
  Undo2,
  X,
} from 'lucide-react';
import { POSProduct } from '../../types';
import type { InvoiceTab } from './POSComputer';

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
}

const POS_TAB_MIN_WIDTH = 140;
const POS_ADD_TAB_WIDTH = 64;

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
}) => {
  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const tabStripRef = React.useRef<HTMLDivElement | null>(null);
  const [visibleTabCount, setVisibleTabCount] = React.useState(tabs.length);
  const sortOptions = [
    { value: 'skuDesc' as const, label: 'Theo mã hàng', helper: 'Cao - thấp' },
    { value: 'priceDesc' as const, label: 'Theo giá tiền', helper: 'Cao - thấp' },
  ];

  React.useEffect(() => {
    const element = tabStripRef.current;
    if (!element) return;

    const updateVisibleTabCount = () => {
      const availableWidth = Math.max(0, element.clientWidth - POS_ADD_TAB_WIDTH);
      const nextCount = Math.max(1, Math.min(tabs.length, Math.floor(availableWidth / POS_TAB_MIN_WIDTH)));
      setVisibleTabCount(prev => (prev === nextCount ? prev : nextCount));
    };

    updateVisibleTabCount();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateVisibleTabCount);
      return () => window.removeEventListener('resize', updateVisibleTabCount);
    }

    const observer = new ResizeObserver(updateVisibleTabCount);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tabs.length]);

  const normalizedVisibleTabCount = Math.min(tabs.length, visibleTabCount);
  const activeTabIndex = Math.max(0, tabs.findIndex(tab => tab.id === activeTabId));
  const visibleTabStart = Math.max(0, Math.min(activeTabIndex - normalizedVisibleTabCount + 1, tabs.length - normalizedVisibleTabCount));
  const visibleTabs = tabs.slice(visibleTabStart, visibleTabStart + normalizedVisibleTabCount);
  const hiddenTabCount = Math.max(0, tabs.length - visibleTabs.length);

  return (
  <div className="bg-slate-100 h-14 flex items-center px-4 gap-2 shrink-0 shadow-sm z-50 border-b border-slate-200">
    <div className="relative w-[300px]">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center text-slate-400">
        <Search className="h-4 w-4" />
      </div>
      <input
        ref={productSearchRef}
        type="text"
        placeholder={mode === 'return' ? 'Dùng ô tìm hàng trả / hàng đổi bên dưới' : 'Tìm hàng hóa (F3)'}
        disabled={mode === 'return'}
        className={`w-full pl-10 pr-11 py-2 border rounded-lg text-sm outline-none font-bold transition-all placeholder:font-medium ${
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
        onChange={(e) => {
          if (mode === 'return') return;
          setSearchTerm(e.target.value);
        }}
        onKeyDown={(e) => {
          if (mode === 'return') return;
          if (showProductResults && searchFilteredProducts.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedResultIndex(prev => (prev + 1) % searchFilteredProducts.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedResultIndex(prev => (prev - 1 + searchFilteredProducts.length) % searchFilteredProducts.length);
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
        <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-[0_16px_40px_rgba(15,23,42,0.16)] overflow-hidden z-[70] p-1">
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
                productSearchSort === option.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>
                <span className="block text-xs font-black">{option.label}</span>
                <span className="block text-[10px] font-bold text-slate-400">{option.helper}</span>
              </span>
              {productSearchSort === option.value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {mode !== 'return' && showProductResults && searchFilteredProducts.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden z-[60] max-h-[400px] overflow-y-auto no-scrollbar">
          {searchFilteredProducts.map((p, idx) => (
            <button
              key={p.id}
              ref={(el) => { searchResultRefs.current[idx] = el; }}
              onClick={() => {
                addToCart(p);
                setSearchTerm('');
                setDebouncedSearchTerm('');
                setShowProductResults(false);
              }}
              onMouseEnter={() => setSelectedResultIndex(idx)}
              className={`w-full px-4 py-3 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-all text-left ${idx === selectedResultIndex ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-100">
                {p.images && p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <PackageOpen className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-sm font-bold truncate ${idx === selectedResultIndex ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {p.name}
                  </span>
                  <span className="text-indigo-600 font-mono text-[10px] font-bold shrink-0">{p.salePrice.toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{p.sku}</span>
                  <span className={`text-[10px] font-bold ${p.stock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Tồn: {p.stock}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>

    <div ref={tabStripRef} className="flex items-center self-stretch ml-2 min-w-0 flex-1 overflow-hidden">
      <div className="flex items-center self-stretch min-w-0 overflow-hidden">
        {visibleTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`h-full px-5 flex items-center gap-3 rounded-none font-bold text-sm border-t-2 transition-all cursor-pointer shadow-sm min-w-[140px] max-w-[160px] justify-between group ${activeTabId === tab.id ? 'bg-white text-indigo-600 border-indigo-500' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{tab.name}</span>
            </div>
            <X
              className={`h-4 w-4 shrink-0 text-slate-300 hover:text-rose-500 transition-colors ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={(e) => closeTab(e, tab.id)}
            />
          </div>
        ))}
      </div>
      <div
        onClick={addNewTab}
        className="relative h-full w-16 shrink-0 flex items-center justify-center text-slate-500 hover:text-indigo-600 cursor-pointer border-l border-slate-200 bg-slate-50 hover:bg-white transition-all"
        title={hiddenTabCount > 0 ? `${hiddenTabCount} hóa đơn đang ẩn` : 'Thêm hóa đơn'}
      >
        <Plus className="h-5 w-5" />
        {hiddenTabCount > 0 && (
          <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center border border-white">
            {hiddenTabCount}
          </span>
        )}
      </div>
    </div>

    <div className="flex items-center gap-4 px-2 text-slate-600">
      <button title="Lượt khách" className="hover:text-indigo-600 transition-colors"><ShoppingBag className="h-4.5 w-4.5" /></button>
      <button
        title="Đổi trả"
        onClick={() => setShowReturnModal(true)}
        className="hover:text-indigo-600 transition-colors"
      >
        <RotateCcw className="h-4.5 w-4.5" />
      </button>
      <button title="Đồng bộ" className={`relative hover:text-indigo-600 transition-colors ${isDraining ? 'text-indigo-600' : ''}`}>
        <RefreshCw className={`h-4.5 w-4.5 ${isDraining ? 'animate-spin' : ''}`} />
        {offlinePendingCount > 0 && !isDraining && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border-2 border-white">
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
          <span className="text-xs font-black text-slate-700 uppercase">admin</span>
          <ChevronDown className="h-3 w-3" />
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
              <div className="fixed inset-0 z-[100]" onClick={() => setShowGridMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 z-[101] overflow-hidden py-2 animate-in fade-in slide-in-from-top-4 duration-200">
                <GridMenuItem icon={<Activity className="h-4.5 w-4.5" />} label="Xem báo cáo cuối ngày" />
                <GridMenuItem icon={<ShoppingBag className="h-4.5 w-4.5" />} label="Xử lý đặt hàng" />
                <GridMenuItem icon={<Undo2 className="h-4.5 w-4.5" />} label="Chọn hóa đơn trả hàng" />
                <GridMenuItem icon={<PenTool className="h-4.5 w-4.5" />} label="Xử lý yêu cầu sửa chữa" />
                <GridMenuItem icon={<StickyNote className="h-4.5 w-4.5 text-indigo-600" />} label="Lập phiếu thu" active />
                <GridMenuItem icon={<FileInput className="h-4.5 w-4.5" />} label="Import file" />
                <GridMenuItem icon={<Eye className="h-4.5 w-4.5" />} label="Tùy chọn hiển thị" />
                <GridMenuItem icon={<Keyboard className="h-4.5 w-4.5" />} label="Phím tắt" />
                <GridMenuItem icon={<LayoutGrid className="h-4.5 w-4.5" />} label="Quản lý" onClick={onGoToManagement} />
                <div className="h-px bg-slate-50 my-1 mx-4" />
                <GridMenuItem icon={<LogOut className="h-4.5 w-4.5 text-rose-500" />} label="Đăng xuất" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};

const GridMenuItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full px-6 py-3.5 flex items-center gap-4 transition-all text-left ${active ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
    <span className={active ? 'text-slate-900' : 'text-slate-500'}>
      {icon}
    </span>
    <span className={`text-[13px] font-bold ${active ? 'text-slate-900' : 'text-slate-700'}`}>
      {label}
    </span>
  </button>
);

export default POSHeaderToolbar;
