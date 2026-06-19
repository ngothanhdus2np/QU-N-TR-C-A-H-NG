import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { ProductGroup } from '../../types';
import ProductGroupTreePicker from '../shared/ProductGroupTreePicker';

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
  filterSupplier: string[];
  setFilterSupplier: (v: string[]) => void;
  onCollapse: () => void;
  onClearAllFilters: () => void;
  onResetPage: () => void;
  productGroups: ProductGroup[];
  uniqueCategories: string[];
  categoryCounts: Record<string, number>;
  attrValuesByName: Record<string, { values: string[]; counts: Record<string, number> }>;
  uniqueLocations: string[];
  uniqueBrands: string[];
  uniqueSuppliers: string[];
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
  onCollapse: _onCollapse,
  onClearAllFilters,
  onResetPage,
  productGroups,
  categoryCounts,
  attrValuesByName,
  uniqueLocations,
  uniqueBrands,
  uniqueSuppliers,
  lowStockCount,
}) => {
  // Attr popup
  const [showAttrPopup, setShowAttrPopup] = useState(false);
  const [activeAttrName, setActiveAttrName] = useState('');
  const [attrPopupSearch, setAttrPopupSearch] = useState('');
  const [pendingAttrs, setPendingAttrs] = useState<string[]>([]);
  const [attrPopupPos, setAttrPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const attrTriggerRef = useRef<HTMLDivElement>(null);

  // Stock popup
  const [showStockPopup, setShowStockPopup] = useState(false);
  const [stockPopupPos, setStockPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const stockTriggerRef = useRef<HTMLDivElement>(null);

  // Supplier popup
  const [showSupplierPopup, setShowSupplierPopup] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [pendingSuppliers, setPendingSuppliers] = useState<string[]>([]);
  const [supplierPopupPos, setSupplierPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const supplierTriggerRef = useRef<HTMLDivElement>(null);

  // Brand popup
  const [showBrandPopup, setShowBrandPopup] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [pendingBrand, setPendingBrand] = useState('');
  const [brandPopupPos, setBrandPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const brandTriggerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!showSupplierPopup) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('supplier-filter-popup');
      const trigger = supplierTriggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setShowSupplierPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSupplierPopup]);

  useEffect(() => {
    if (!showBrandPopup) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('brand-filter-popup');
      const trigger = brandTriggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setShowBrandPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBrandPopup]);

  const openBrandPopup = () => {
    if (showBrandPopup) {
      setShowBrandPopup(false);
      return;
    }
    if (brandTriggerRef.current) {
      const rect = brandTriggerRef.current.getBoundingClientRect();
      setBrandPopupPos({ top: rect.top, left: rect.right + 12, width: 440 });
    }
    setPendingBrand(filterBrand);
    setBrandSearch('');
    setShowBrandPopup(true);
  };

  const hasActiveFilters =
    filterCategories.length > 0 ||
    filterBrand ||
    filterStock !== 'all' ||
    filterLocation ||
    filterAttrs.length > 0 ||
    filterSupplier.length > 0;

  const productCountByPath = React.useMemo(() => {
    const countMap = new Map<string, number>();
    Object.entries(categoryCounts).forEach(([path, count]) => {
      countMap.set(path, count);
    });
    return countMap;
  }, [categoryCounts]);

  return (
    <>
      {/* === Attr Filter Popup === */}
      {showAttrPopup &&
        (() => {
          const activeAttr = attrValuesByName[activeAttrName];
          const values = activeAttr
            ? activeAttr.values.filter(v => v.toLowerCase().includes(attrPopupSearch.toLowerCase()))
            : [];
          const groupSelectedCount = activeAttr
            ? activeAttr.values.filter(v => pendingAttrs.includes(v)).length
            : 0;
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
                <span className="text-sm font-bold text-slate-800">{activeAttrName}</span>
              </div>
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder={`Tìm giá trị ${activeAttrName.toLowerCase()}...`}
                    value={attrPopupSearch}
                    onChange={e => setAttrPopupSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-72">
                {values.map(val => (
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
                    {activeAttr && (activeAttr.counts[val] ?? 0) > 0 && (
                      <span className="text-xs text-slate-400 tabular-nums">
                        ({activeAttr.counts[val]})
                      </span>
                    )}
                  </label>
                ))}
                {values.length === 0 && (
                  <p className="px-4 py-6 text-sm text-slate-400 text-center">Không tìm thấy</p>
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                <button
                  onClick={() => {
                    if (!activeAttr) return;
                    const groupValues = activeAttr.values;
                    setPendingAttrs(prev =>
                      groupSelectedCount === groupValues.length
                        ? prev.filter(v => !groupValues.includes(v))
                        : Array.from(new Set([...prev, ...groupValues]))
                    );
                  }}
                  className="text-sm text-indigo-600 font-semibold hover:underline"
                >
                  {activeAttr && groupSelectedCount === activeAttr.values.length
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả'}
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
          <div className="px-3 py-2.5 border-b border-slate-100">
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

      {/* === Supplier Filter Popup === */}
      {showSupplierPopup && (
        <div
          id="supplier-filter-popup"
          style={{
            position: 'fixed',
            top: supplierPopupPos.top,
            left: supplierPopupPos.left,
            width: supplierPopupPos.width,
            zIndex: 9999,
          }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-800">Nhà cung cấp</span>
          </div>
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Tìm nhà cung cấp..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-72">
            {uniqueSuppliers
              .filter(s => s.toLowerCase().includes(supplierSearch.toLowerCase()))
              .map(s => (
                <label
                  key={s}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={pendingSuppliers.includes(s)}
                    onChange={() =>
                      setPendingSuppliers(prev =>
                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                      )
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="flex-1 min-w-0 truncate text-sm text-slate-700">{s}</span>
                </label>
              ))}
            {uniqueSuppliers.filter(s => s.toLowerCase().includes(supplierSearch.toLowerCase()))
              .length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">
                {uniqueSuppliers.length === 0 ? 'Chưa có nhà cung cấp' : 'Không tìm thấy'}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <button
              onClick={() =>
                setPendingSuppliers(
                  pendingSuppliers.length === uniqueSuppliers.length ? [] : [...uniqueSuppliers]
                )
              }
              disabled={uniqueSuppliers.length === 0}
              className="text-sm text-indigo-600 font-semibold hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              {pendingSuppliers.length === uniqueSuppliers.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
            <button
              onClick={() => {
                setFilterSupplier(pendingSuppliers);
                onResetPage();
                setShowSupplierPopup(false);
              }}
              className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* === Brand Filter Popup === */}
      {showBrandPopup && (
        <div
          id="brand-filter-popup"
          style={{
            position: 'fixed',
            top: brandPopupPos.top,
            left: brandPopupPos.left,
            width: brandPopupPos.width,
            zIndex: 9999,
          }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-normal outline-none transition-all placeholder:text-slate-300 focus:border-indigo-400"
                placeholder="Tìm thương hiệu"
                value={brandSearch}
                onChange={e => setBrandSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {uniqueBrands
              .filter(brand => brand.toLowerCase().includes(brandSearch.toLowerCase().trim()))
              .map(brand => {
                const isSelected = pendingBrand === brand;
                return (
                  <label
                    key={brand}
                    className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-2.5 hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => setPendingBrand(brand)}
                      className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span
                      className={`flex-1 truncate text-sm ${
                        isSelected ? 'font-normal text-slate-900' : 'font-normal text-slate-700'
                      }`}
                    >
                      {brand}
                    </span>
                  </label>
                );
              })}
            {uniqueBrands.filter(brand =>
              brand.toLowerCase().includes(brandSearch.toLowerCase().trim())
            ).length === 0 && (
              <div className="px-4 py-8 text-center text-sm font-normal text-slate-300">
                {uniqueBrands.length === 0 ? 'Chưa có thương hiệu' : 'Không tìm thấy thương hiệu'}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3">
            <button
              type="button"
              onClick={() => setPendingBrand('')}
              className="text-sm font-normal text-slate-500 transition-colors hover:text-rose-600"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterBrand(pendingBrand);
                onResetPage();
                setShowBrandPopup(false);
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-indigo-700"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* === Filter Aside === */}
      <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 min-h-[44px] border-b border-slate-100 shrink-0 flex items-center justify-between">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hàng hoá</h2>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={onClearAllFilters}
                className="text-2xs text-indigo-600 font-bold hover:underline"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* 1. Nhóm hàng */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500">Nhóm hàng</span>
              <button className="text-2xs text-indigo-500 font-semibold hover:underline">
                Tạo mới
              </button>
            </div>
            <ProductGroupTreePicker
              groups={productGroups}
              selectedPaths={filterCategories}
              onSelectionChange={paths => {
                setFilterCategories(paths);
                onResetPage();
              }}
              productCountByPath={productCountByPath}
              placeholder="Chọn nhóm hàng"
              popupPlacement="right"
              className="w-full"
            />
          </div>

          {/* 2. Nhà cung cấp */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500">Nhà cung cấp</span>
              {filterSupplier.length > 0 && (
                <button
                  onClick={() => { setFilterSupplier([]); onResetPage(); }}
                  className="text-2xs text-indigo-500 font-semibold hover:underline"
                >
                  Xóa
                </button>
              )}
            </div>
            <div
              ref={supplierTriggerRef}
              onClick={() => {
                if (showSupplierPopup) {
                  setShowSupplierPopup(false);
                  return;
                }
                if (supplierTriggerRef.current) {
                  const rect = supplierTriggerRef.current.getBoundingClientRect();
                  setSupplierPopupPos({ top: rect.top, left: rect.right + 8, width: 320 });
                }
                setPendingSuppliers([...filterSupplier]);
                setSupplierSearch('');
                setShowSupplierPopup(true);
              }}
              className="w-full px-3 py-1.5 text-[13px] bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
            >
              <span className={filterSupplier.length > 0 ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                {filterSupplier.length === 0
                  ? 'Chọn nhà cung cấp'
                  : filterSupplier.length === 1
                    ? filterSupplier[0]
                    : `${filterSupplier.length} NCC đã chọn`}
              </span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* 3. Thương hiệu */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500">Thương hiệu</span>
              {filterBrand && (
                <button
                  onClick={() => {
                    setFilterBrand('');
                    onResetPage();
                  }}
                  className="text-2xs text-indigo-500 font-semibold hover:underline"
                >
                  Xóa
                </button>
              )}
            </div>
            <div
              ref={brandTriggerRef}
              onClick={openBrandPopup}
              className="w-full px-3 py-1.5 text-[13px] bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
            >
              <span className={filterBrand ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                {filterBrand || 'Chọn thương hiệu'}
              </span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* 4. Thuộc tính */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 mb-1.5 block">Thuộc tính</span>
            <div className="space-y-1">
              {Object.entries(attrValuesByName).map(([attrName, attrData]) => {
                const selectedCount = attrData.values.filter(v => filterAttrs.includes(v)).length;
                return (
                  <div
                    key={attrName}
                    ref={activeAttrName === attrName ? attrTriggerRef : undefined}
                    onClick={e => {
                      if (showAttrPopup && activeAttrName === attrName) {
                        setShowAttrPopup(false);
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      attrTriggerRef.current = e.currentTarget;
                      setAttrPopupPos({ top: rect.top, left: rect.right + 8, width: 320 });
                      setActiveAttrName(attrName);
                      setPendingAttrs([...filterAttrs]);
                      setAttrPopupSearch('');
                      setShowAttrPopup(true);
                    }}
                    className="w-full px-3 py-1.5 text-[13px] bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-normal text-slate-700">
                        {attrName}
                      </span>
                      {selectedCount > 0 && (
                        <span className="block text-2xs font-bold text-indigo-600">
                          {selectedCount} giá trị đã chọn
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </div>
                );
              })}
              {Object.keys(attrValuesByName).length === 0 && (
                <div className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg text-slate-400">
                  Chưa có thuộc tính
                </div>
              )}
            </div>
          </div>

          {/* 5. Vị trí */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 mb-2 block">Vị trí</span>
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
            <span className="text-xs font-medium text-slate-500 mb-2 block">Tồn kho</span>
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
              className="w-full px-3 py-1.5 text-[13px] bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
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
