import React from 'react';
import { FileDown, MoreHorizontal, PackagePlus, Plus, Printer, Search, X } from 'lucide-react';

interface GoodsToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
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
  setFilterStock: React.Dispatch<React.SetStateAction<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>>;
  selectedCount: number;
  onClearSelection: () => void;
  onExportSelected: () => void;
  onPrintSelectedLabels: () => void;
  onPurchaseSelected: () => void;
  onBulkDelete: () => void;
  onResetPage: () => void;
}

export const GoodsToolbar: React.FC<GoodsToolbarProps> = ({
  searchTerm,
  onSearchChange,
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
  onResetPage,
}) => (
  <>
    <div className="px-4 min-h-[52px] flex items-center gap-3 shrink-0">
      <div className="flex-1 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm theo tên, mã hàng..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {selectedCount > 0 ? (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-indigo-700">
                Đã chọn {selectedCount}
              </span>
              <button
                onClick={onClearSelection}
                className="h-5 w-5 flex items-center justify-center rounded-full text-indigo-500 hover:bg-white hover:text-rose-500 transition-colors"
                title="Bỏ chọn"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={onExportSelected}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-wide hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
            >
              <FileDown className="h-3.5 w-3.5" /> Xuất file
            </button>
            <button
              onClick={onPrintSelectedLabels}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-wide hover:bg-slate-50 transition-all shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" /> In tem mã
            </button>
            <button
              onClick={onPurchaseSelected}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wide shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
            >
              <PackagePlus className="h-3.5 w-3.5" /> Nhập hàng
            </button>
            <button
              onClick={onBulkDelete}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
              title="Thao tác khác: xóa hàng đã chọn"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wide shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Tạo mới
            </button>
            {rightControls}
          </>
        )}
      </div>
    </div>

    <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 flex-wrap shrink-0">
      <span className="text-[10px] font-bold text-slate-500">
        Hiển thị <span className="font-black text-slate-800">{filteredCount}</span> / {totalCount} hàng hóa
      </span>
      {filterCategories.map(cat => (
        <span key={cat} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-black text-[9px]">
          {cat}
          <button onClick={() => { setFilterCategories(prev => prev.filter(c => c !== cat)); onResetPage(); }}><X className="h-2.5 w-2.5" /></button>
        </span>
      ))}
      {filterBrand && (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-black text-[9px]">
          {filterBrand}
          <button onClick={() => { setFilterBrand(''); onResetPage(); }}><X className="h-2.5 w-2.5" /></button>
        </span>
      )}
      {filterAttrs.map(attr => (
        <span key={attr} className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-black text-[9px]">
          {attr}
          <button onClick={() => { setFilterAttrs(prev => prev.filter(a => a !== attr)); onResetPage(); }}><X className="h-2.5 w-2.5" /></button>
        </span>
      ))}
      {filterLocation && (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-black text-[9px]">
          {filterLocation}
          <button onClick={() => { setFilterLocation(''); onResetPage(); }}><X className="h-2.5 w-2.5" /></button>
        </span>
      )}
      {filterStock !== 'all' && (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-black text-[9px]">
          {filterStock === 'low_stock' ? 'Sắp hết hàng' : filterStock === 'out_of_stock' ? 'Hết hàng' : 'Còn hàng'}
          <button onClick={() => { setFilterStock('all'); onResetPage(); }}><X className="h-2.5 w-2.5" /></button>
        </span>
      )}
    </div>
  </>
);
