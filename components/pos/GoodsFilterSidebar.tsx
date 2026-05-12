import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, ChevronRight } from 'lucide-react';

interface GoodsFilterSidebarProps {
  filterCategories: string[];
  setFilterCategories: (v: string[]) => void;
  filterBrand: string;
  setFilterBrand: (v: string) => void;
  filterStock: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
  setFilterStock: (v: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock') => void;
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  filterAttrs: string[];
  setFilterAttrs: (v: string[]) => void;
  filterSupplier: string;
  setFilterSupplier: (v: string) => void;
  onClearAllFilters: () => void;
  onResetPage: () => void;
  uniqueCategories: string[];
  categoryCounts: Record<string, number>;
  attrValuesByName: Record<string, { values: string[]; counts: Record<string, number> }>;
  uniqueLocations: string[];
  uniqueBrands: string[];
  lowStockCount: number;
}

export const GoodsFilterSidebar: React.FC<GoodsFilterSidebarProps> = ({
  filterCategories,
  setFilterCategories,
  filterBrand,
  setFilterBrand,
  filterStock,
  setFilterStock,
  filterLocation,
  setFilterLocation,
  filterAttrs,
  setFilterAttrs,
  filterSupplier,
  setFilterSupplier,
  onClearAllFilters,
  onResetPage,
  uniqueCategories,
  categoryCounts,
  attrValuesByName,
  uniqueLocations,
  uniqueBrands,
  lowStockCount,
}) => {
  // Category popup
  const [showCategoryPopup, setShowCategoryPopup] = useState(false);
  const [categoryPopupSearch, setCategoryPopupSearch] = useState('');
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [categoryPopupPos, setCategoryPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const categoryTriggerRef = useRef<HTMLDivElement>(null);

  // Attr popup
  const [showAttrPopup, setShowAttrPopup] = useState(false);
  const [attrPopupSearch, setAttrPopupSearch] = useState('');
  const [pendingAttrs, setPendingAttrs] = useState<string[]>([]);
  const [attrPopupPos, setAttrPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const attrTriggerRef = useRef<HTMLDivElement>(null);

  // Stock popup
  const [showStockPopup, setShowStockPopup] = useState(false);
  const [stockPopupPos, setStockPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const stockTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCategoryPopup) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('category-filter-popup');
      const trigger = categoryTriggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setShowCategoryPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCategoryPopup]);

  useEffect(() => {
    if (!showAttrPopup) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('attr-filter-popup');
      const trigger = attrTriggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setShowAttrPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAttrPopup]);

  useEffect(() => {
    if (!showStockPopup) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('stock-filter-popup');
      const trigger = stockTriggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setShowStockPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStockPopup]);

  const hasActiveFilters =
    filterCategories.length > 0 ||
    filterBrand ||
    filterStock !== 'all' ||
    filterLocation ||
    filterAttrs.length > 0;

  return (
    <>
      {/* === Category Filter Popup === */}
      {showCategoryPopup && (
        <div
          id="category-filter-popup"
          style={{
            position: 'fixed',
            top: categoryPopupPos.top,
            left: categoryPopupPos.left,
            width: categoryPopupPos.width,
            zIndex: 9999,
          }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-800">Nhóm hàng</span>
            <button className="text-xs text-indigo-600 font-semibold flex items-center gap-1 hover:underline">
              <Plus className="h-3 w-3" /> Tạo mới
            </button>
          </div>
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Tìm kiếm"
                value={categoryPopupSearch}
                onChange={e => setCategoryPopupSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-64">
            {uniqueCategories
              .filter(cat => cat.toLowerCase().includes(categoryPopupSearch.toLowerCase()))
              .map(cat => (
                <label
                  key={cat}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={pendingCategories.includes(cat)}
                    onChange={() =>
                      setPendingCategories(prev =>
                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                      )
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="flex-1 text-sm text-slate-700">{cat}</span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    ({categoryCounts[cat] || 0})
                  </span>
                </label>
              ))}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <button
              onClick={() =>
                setPendingCategories(
                  pendingCategories.length === uniqueCategories.length ? [] : [...uniqueCategories]
                )
              }
              className="text-sm text-indigo-600 font-semibold hover:underline"
            >
              {pendingCategories.length === uniqueCategories.length
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả'}
            </button>
            <button
              onClick={() => {
                setFilterCategories(pendingCategories);
                onResetPage();
                setShowCategoryPopup(false);
              }}
              className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* === Attr Filter Popup === */}
      {showAttrPopup &&
        (() => {
          const attrGroups = Object.entries(attrValuesByName)
            .map(([name, { values, counts }]) => ({
              name,
              values: values.filter(v => v.toLowerCase().includes(attrPopupSearch.toLowerCase())),
              counts,
            }))
            .filter(
              g =>
                g.values.length > 0 || g.name.toLowerCase().includes(attrPopupSearch.toLowerCase())
            );
          const allValues = Object.values(attrValuesByName).flatMap(g => g.values);
          return (
            <div
              id="attr-filter-popup"
              style={{
                position: 'fixed',
                top: attrPopupPos.top,
                left: attrPopupPos.left,
                width: attrPopupPos.width,
                zIndex: 9999,
              }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-bold text-slate-800">Thuộc tính</span>
              </div>
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Tìm giá trị thuộc tính..."
                    value={attrPopupSearch}
                    onChange={e => setAttrPopupSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-72">
                {attrGroups.map(group => (
                  <div key={group.name}>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {group.name}
                      </span>
                    </div>
                    {group.values.map(val => (
                      <label
                        key={val}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={pendingAttrs.includes(val)}
                          onChange={() =>
                            setPendingAttrs(prev =>
                              prev.includes(val) ? prev.filter(a => a !== val) : [...prev, val]
                            )
                          }
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="flex-1 text-sm text-slate-700">{val}</span>
                        {(group.counts[val] ?? 0) > 0 && (
                          <span className="text-xs text-slate-400 tabular-nums">
                            ({group.counts[val]})
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                ))}
                {attrGroups.length === 0 && (
                  <p className="px-4 py-6 text-sm text-slate-400 text-center">Không tìm thấy</p>
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                <button
                  onClick={() =>
                    setPendingAttrs(pendingAttrs.length === allValues.length ? [] : [...allValues])
                  }
                  className="text-sm text-indigo-600 font-semibold hover:underline"
                >
                  {pendingAttrs.length === allValues.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <button
                  onClick={() => {
                    setFilterAttrs(pendingAttrs);
                    onResetPage();
                    setShowAttrPopup(false);
                  }}
                  className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          );
        })()}

      {/* === Stock Filter Popup === */}
      {showStockPopup && (
        <div
          id="stock-filter-popup"
          style={{
            position: 'fixed',
            top: stockPopupPos.top,
            left: stockPopupPos.left,
            width: stockPopupPos.width,
            zIndex: 9999,
          }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-800">Tồn kho</span>
          </div>
          <div className="py-1">
            {(
              [
                { v: 'all', l: 'Tất cả' },
                { v: 'in_stock', l: 'Còn hàng' },
                { v: 'out_of_stock', l: 'Hết hàng' },
                {
                  v: 'low_stock',
                  l: lowStockCount > 0 ? `Sắp hết hàng (${lowStockCount})` : 'Sắp hết hàng',
                },
              ] as const
            ).map(opt => (
              <button
                key={opt.v}
                onClick={() => {
                  setFilterStock(opt.v);
                  onResetPage();
                  setShowStockPopup(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${filterStock === opt.v ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span
                  className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${filterStock === opt.v ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}
                >
                  {filterStock === opt.v && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === Filter Aside === */}
      <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 min-h-[52px] border-b border-slate-100 shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Hàng hoá</h2>
          {hasActiveFilters && (
            <button
              onClick={onClearAllFilters}
              className="text-[10px] text-indigo-600 font-bold hover:underline"
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* 1. Nhóm hàng */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Nhóm hàng</span>
              <button className="text-[10px] text-indigo-500 font-semibold hover:underline">
                Tạo mới
              </button>
            </div>
            <div
              ref={categoryTriggerRef}
              onClick={() => {
                if (showCategoryPopup) {
                  setShowCategoryPopup(false);
                  return;
                }
                if (categoryTriggerRef.current) {
                  const rect = categoryTriggerRef.current.getBoundingClientRect();
                  setCategoryPopupPos({ top: rect.top, left: rect.right + 8, width: 320 });
                }
                setPendingCategories([...filterCategories]);
                setCategoryPopupSearch('');
                setShowCategoryPopup(true);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all text-slate-400 flex items-center justify-between"
            >
              <span className={filterCategories.length > 0 ? 'text-slate-700 font-semibold' : ''}>
                {filterCategories.length === 0
                  ? 'Chọn nhóm hàng'
                  : filterCategories.length === 1
                    ? filterCategories[0]
                    : `${filterCategories.length} nhóm đã chọn`}
              </span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400" />
            </div>
          </div>

          {/* 2. Nhà cung cấp */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Nhà cung cấp</span>
            <input
              type="text"
              placeholder="Chọn nhà cung cấp"
              value={filterSupplier}
              onChange={e => {
                setFilterSupplier(e.target.value);
                onResetPage();
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300"
            />
          </div>

          {/* 3. Thương hiệu */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Thương hiệu</span>
            <input
              type="text"
              placeholder="Chọn thương hiệu"
              value={filterBrand}
              onChange={e => {
                setFilterBrand(e.target.value);
                onResetPage();
              }}
              list="brand-list"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300"
            />
            <datalist id="brand-list">
              {uniqueBrands.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          {/* 4. Thuộc tính */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Thuộc tính</span>
            <div
              ref={attrTriggerRef}
              onClick={() => {
                if (showAttrPopup) {
                  setShowAttrPopup(false);
                  return;
                }
                if (attrTriggerRef.current) {
                  const rect = attrTriggerRef.current.getBoundingClientRect();
                  setAttrPopupPos({ top: rect.top, left: rect.right + 8, width: 320 });
                }
                setPendingAttrs([...filterAttrs]);
                setAttrPopupSearch('');
                setShowAttrPopup(true);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all text-slate-400 flex items-center justify-between"
            >
              <span className={filterAttrs.length > 0 ? 'text-slate-700 font-semibold' : ''}>
                {filterAttrs.length === 0
                  ? 'Chọn giá trị'
                  : filterAttrs.length === 1
                    ? filterAttrs[0]
                    : `${filterAttrs.length} giá trị đã chọn`}
              </span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400" />
            </div>
          </div>

          {/* 5. Vị trí */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Vị trí</span>
            <input
              type="text"
              placeholder="Chọn vị trí"
              value={filterLocation}
              onChange={e => {
                setFilterLocation(e.target.value);
                onResetPage();
              }}
              list="location-list"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300"
            />
            <datalist id="location-list">
              {uniqueLocations.map(l => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          {/* 6. Tồn kho */}
          <div className="px-4 py-3">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Tồn kho</span>
            <div
              ref={stockTriggerRef}
              onClick={() => {
                if (showStockPopup) {
                  setShowStockPopup(false);
                  return;
                }
                if (stockTriggerRef.current) {
                  const rect = stockTriggerRef.current.getBoundingClientRect();
                  setStockPopupPos({ top: rect.top, left: rect.right + 8, width: 240 });
                }
                setShowStockPopup(true);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
            >
              <span
                className={
                  filterStock !== 'all' ? 'text-slate-700 font-semibold' : 'text-slate-400'
                }
              >
                {filterStock === 'all'
                  ? 'Tất cả'
                  : filterStock === 'in_stock'
                    ? 'Còn hàng'
                    : filterStock === 'out_of_stock'
                      ? 'Hết hàng'
                      : `Sắp hết hàng${lowStockCount > 0 ? ` (${lowStockCount})` : ''}`}
              </span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
