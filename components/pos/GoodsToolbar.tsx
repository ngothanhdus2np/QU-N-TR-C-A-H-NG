import React from 'react';
import { Plus, Search, X, FileDown, Printer, PackageIcon, MoreHorizontal, List, LayoutGrid, Link2 } from 'lucide-react';

interface GoodsToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchTags?: string[];
  onTagRemove?: (tag: string) => void;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOpenCreate: () => void;
  rightControls: React.ReactNode;
  filteredCount: number;
  totalCount: number;
  filterCategories: string[];
  setFilterCategories: React.Dispatch<React.SetStateAction<string[]>>;
  filterBrand: string;
  setFilterBrand: React.Dispatch<React.SetStateAction<string>>;
  filterAttrs: string[];
  setFilterAttrs: React.Dispatch<React.SetStateAction<string[]>>;
  filterLocation: string;
  setFilterLocation: React.Dispatch<React.SetStateAction<string>>;
  filterStock: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
  setFilterStock: React.Dispatch<
    React.SetStateAction<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>
  >;
  selectedCount: number;
  onClearSelection: () => void;
  onExportSelected: () => void;
  onPrintSelectedLabels: () => void;
  onPurchaseSelected: () => void;
  onBulkDelete: () => void;
  onBulkStopBusiness: () => void;
  onBulkChangeGroup: () => void;
  onBulkChannelLink: () => void;
  onGoToWarranty: () => void;
  onResetPage: () => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
}

export const GoodsToolbar: React.FC<GoodsToolbarProps> = ({
  searchTerm,
  onSearchChange,
  searchTags = [],
  onTagRemove,
  onSearchKeyDown,
  onOpenCreate,
  rightControls,
  filteredCount,
  totalCount,
  filterCategories,
  setFilterCategories,
  filterBrand,
  setFilterBrand,
  filterAttrs,
  setFilterAttrs,
  filterLocation,
  setFilterLocation,
  filterStock,
  setFilterStock,
  selectedCount,
  onClearSelection,
  onExportSelected,
  onPrintSelectedLabels,
  onPurchaseSelected,
  onBulkDelete,
  onBulkStopBusiness,
  onBulkChangeGroup,
  onBulkChannelLink,
  onGoToWarranty,
  onResetPage,
  viewMode,
  onViewModeChange,
}) => {
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  const btnBase =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-normal transition-all border';

  return (
  <>
    <div className="px-4 min-h-[44px] border-b border-slate-200 flex items-center gap-2 shrink-0">
      <div className="flex-1 relative max-w-xl">
        <div className="flex flex-wrap items-center gap-1 pl-9 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-md focus-within:border-indigo-400 focus-within:bg-white transition-all min-h-[34px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          {searchTags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium shrink-0">
              {tag}
              <button
                type="button"
                onClick={() => onTagRemove?.(tag)}
                className="hover:text-indigo-900 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={searchTags.length > 0 ? 'Thêm mã khác...' : 'Tìm theo tên, mã hàng... (Enter để lọc nhiều mã)'}
            className="flex-1 min-w-[120px] bg-transparent text-sm font-normal outline-none placeholder:text-slate-400"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-sm font-normal border border-indigo-200">
            Đã chọn {selectedCount}
            <button onClick={onClearSelection} className="hover:text-indigo-900 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </span>
          <button
            onClick={onExportSelected}
            className={`${btnBase} bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm`}
          >
            <FileDown className="h-3.5 w-3.5" /> Xuất file
          </button>
          <button
            onClick={onPrintSelectedLabels}
            className={`${btnBase} bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm`}
          >
            <Printer className="h-3.5 w-3.5" /> In tem mã
          </button>
          <button
            onClick={onPurchaseSelected}
            className={`${btnBase} bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm`}
          >
            <PackageIcon className="h-3.5 w-3.5" /> Nhập hàng
          </button>
          <button
            onClick={onBulkChannelLink}
            className={`${btnBase} bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 shadow-sm`}
          >
            <Link2 className="h-3.5 w-3.5" /> Liên kết kênh
          </button>
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className={`${btnBase} bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm px-2.5`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                <button
                  onClick={() => { onPurchaseSelected(); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Đặt hàng nhập
                </button>
                <button
                  onClick={() => { onBulkChangeGroup(); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Đổi nhóm hàng
                </button>
                <button
                  onClick={() => { onGoToWarranty(); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Sửa bảo hành, bảo trì
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => { onBulkStopBusiness(); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 transition-all"
                >
                  Ngừng kinh doanh
                </button>
                <button
                  onClick={() => { onBulkDelete(); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center border border-slate-200 rounded-md overflow-hidden shrink-0">
            <button
              onClick={() => onViewModeChange('table')}
              className={`flex items-center justify-center w-8 h-8 transition-all ${
                viewMode === 'table'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
              title="Xem dạng bảng"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              className={`flex items-center justify-center w-8 h-8 transition-all border-l border-slate-200 ${
                viewMode === 'grid'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
              title="Xem dạng lưới ảnh"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-normal hover:bg-indigo-700 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Tạo mới
          </button>
          {rightControls}
        </div>
      )}
    </div>

    <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap shrink-0">
      <span className="text-xs font-normal text-slate-500">
        Hiển thị <span className="font-medium text-slate-700">{filteredCount}</span> / {totalCount}{' '}
        hàng hóa
      </span>
      {filterCategories.map(cat => (
        <span
          key={cat}
          className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold text-[9px]"
        >
          {cat}
          <button
            onClick={() => {
              setFilterCategories(prev => prev.filter(c => c !== cat));
              onResetPage();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {filterBrand && (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold text-[9px]">
          {filterBrand}
          <button
            onClick={() => {
              setFilterBrand('');
              onResetPage();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
      {filterAttrs.map(attr => (
        <span
          key={attr}
          className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-semibold text-[9px]"
        >
          {attr}
          <button
            onClick={() => {
              setFilterAttrs(prev => prev.filter(a => a !== attr));
              onResetPage();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {filterLocation && (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold text-[9px]">
          {filterLocation}
          <button
            onClick={() => {
              setFilterLocation('');
              onResetPage();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
      {filterStock !== 'all' && (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-semibold text-[9px]">
          {filterStock === 'low_stock'
            ? 'Sắp hết hàng'
            : filterStock === 'out_of_stock'
              ? 'Hết hàng'
              : 'Còn hàng'}
          <button
            onClick={() => {
              setFilterStock('all');
              onResetPage();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
    </div>
  </>
  );
};
