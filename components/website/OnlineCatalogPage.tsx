import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ChevronRight, ChevronDown, Search, List, LayoutGrid, X, Image as ImageIcon, Globe, ShoppingCart, Package, ShoppingBag } from 'lucide-react';
import { GoodsPagination } from '../pos/GoodsPagination';
import { GoodsProductDetailPanel } from '../pos/GoodsProductDetailPanel';
import type { POSProduct } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type StockFilter = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
type DetailTab = 'info' | 'desc' | 'warranty' | 'units' | 'channels';
type Platform = 'website' | 'shopee';

interface Props {
  navigationSlot?: React.ReactNode;
  onNavigate?: (tab: string) => void;
  products: POSProduct[];
}

type RootRow =
  | { kind: 'group'; parentId: string; parent: POSProduct; children: POSProduct[] }
  | { kind: 'single'; product: POSProduct };

const leafCategory = (path?: string | null) => (path ?? '').split('>').pop()?.trim() || '—';

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'desc', label: 'Mô tả, ghi chú' },
  { id: 'warranty', label: 'Thẻ kho' },
  { id: 'units', label: 'Tồn kho' },
  { id: 'channels', label: 'Liên kết kênh bán' },
];

function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === 'website') return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-2xs font-medium text-indigo-700">
      <Globe className="h-3 w-3" /> Web
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-orange-100 bg-orange-50 px-1.5 py-0.5 text-2xs font-medium text-orange-700">
      <ShoppingCart className="h-3 w-3" /> Shopee
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// Dữ liệu sản phẩm lấy từ AppData (posProducts) — luôn đồng bộ với GoodsInventory.
// Chỉ fetch platform links từ /api/channel-links/catalog-links để biết sản phẩm nào đang bán ở đâu.

export default function OnlineCatalogPage({ navigationSlot, products }: Props) {
  const [filterCategories] = useState<string[]>([]);
  const [filterSupplier] = useState<string[]>([]);
  const [filterBrand] = useState('');
  const [filterAttrs] = useState<string[]>([]);
  const [filterLocation] = useState('');
  const [filterStock, setFilterStock] = useState<StockFilter>('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [platformMap, setPlatformMap] = useState<Record<string, Platform[]>>({});

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');

  const [popupParentId, setPopupParentId] = useState<string | null>(null);
  const [popupVariantId, setPopupVariantId] = useState<string | null>(null);

  // Chỉ fetch platform links — sản phẩm lấy từ AppData (prop products)
  const loadPlatformLinks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/channel-links/catalog-links', { credentials: 'include' });
      const json: { ok: boolean; error?: string; website: string[]; shopee: string[] } = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Lỗi tải danh sách kênh');

      const map: Record<string, Platform[]> = {};
      const add = (id: string, p: Platform) => {
        if (!map[id]) map[id] = [];
        if (!map[id].includes(p)) map[id].push(p);
      };
      json.website.forEach(id => add(id, 'website'));
      json.shopee.forEach(id => add(id, 'shopee'));
      setPlatformMap(map);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as Record<string, unknown>)?.message
          ? String((err as Record<string, unknown>).message)
          : JSON.stringify(err);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlatformLinks(); }, [loadPlatformLinks]);

  // ─── Tính rawVariants, rawParents, enrichedPlatformMap từ AppData ────────────
  const { enrichedPlatformMap, rawVariants, rawParents } = useMemo(() => {
    const linkedIds = Object.keys(platformMap);
    if (linkedIds.length === 0 || products.length === 0) {
      return { enrichedPlatformMap: platformMap, rawVariants: [] as POSProduct[], rawParents: [] as POSProduct[] };
    }

    const byId = new Map(products.map(p => [p.id, p]));
    const enriched: Record<string, Platform[]> = { ...platformMap };

    // Kế thừa platform từ cha xuống con
    for (const [id, platforms] of Object.entries(platformMap)) {
      const p = byId.get(id);
      if (p?.isParent) {
        for (const child of products.filter(c => c.parentId === id && c.status === 'Active')) {
          if (!enriched[child.id]) enriched[child.id] = [];
          for (const pf of platforms) {
            if (!enriched[child.id].includes(pf)) enriched[child.id].push(pf);
          }
        }
      }
    }

    // Xác định biến thể hiển thị
    const visibleIds = new Set<string>();
    for (const [id] of Object.entries(platformMap)) {
      const p = byId.get(id);
      if (!p) continue;
      if (!p.isParent) {
        visibleIds.add(id);
        // Thêm anh em để hiển thị đủ nhóm
        if (p.parentId) {
          for (const s of products.filter(s => s.parentId === p.parentId && s.status === 'Active')) {
            visibleIds.add(s.id);
          }
        }
      } else {
        // Cha được link → hiển thị tất cả con
        for (const child of products.filter(c => c.parentId === id && c.status === 'Active')) {
          visibleIds.add(child.id);
        }
      }
    }

    const rawVariants = products.filter(p => visibleIds.has(p.id));

    // Tập hợp cha cần hiển thị
    const neededParentIds = new Set<string>();
    for (const v of rawVariants) {
      if (v.parentId) neededParentIds.add(v.parentId);
    }
    for (const [id] of Object.entries(platformMap)) {
      const p = byId.get(id);
      if (p?.isParent) neededParentIds.add(id);
    }
    const rawParents = products.filter(p => neededParentIds.has(p.id));

    return { enrichedPlatformMap: enriched, rawVariants, rawParents };
  }, [platformMap, products]);

  // ─── Gom cha-con ───────────────────────────────────────────────────────────
  const rootRows = useMemo<RootRow[]>(() => {
    const parentMap = new Map(rawParents.map(p => [p.id, p]));
    const byParent = new Map<string, POSProduct[]>();
    const standalone: POSProduct[] = [];

    for (const v of rawVariants) {
      if (v.parentId && parentMap.has(v.parentId)) {
        const arr = byParent.get(v.parentId) ?? [];
        arr.push(v);
        byParent.set(v.parentId, arr);
      } else {
        standalone.push(v);
      }
    }

    const groupRows: RootRow[] = Array.from(byParent.entries()).map(([parentId, children]) => ({
      kind: 'group',
      parentId,
      parent: parentMap.get(parentId)!,
      children: children.sort((a, b) => a.sku.localeCompare(b.sku)),
    }));
    const singleRows: RootRow[] = standalone.map(p => ({ kind: 'single', product: p }));

    return [...groupRows, ...singleRows].sort((a, b) => {
      const aKey = a.kind === 'group' ? a.parent.sku : a.product.sku;
      const bKey = b.kind === 'group' ? b.parent.sku : b.product.sku;
      return aKey.localeCompare(bKey);
    });
  }, [rawVariants, rawParents]);

  // ─── Lọc tìm kiếm + tồn kho ────────────────────────────────────────────────
  const matchesFilters = useCallback((p: POSProduct) => {
    const q = searchTerm.trim().toLowerCase();
    if (q && !p.sku.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false;
    if (filterStock === 'in_stock' && !(p.stock > 5)) return false;
    if (filterStock === 'low_stock' && !(p.stock > 0 && p.stock <= 5)) return false;
    if (filterStock === 'out_of_stock' && !(p.stock <= 0)) return false;
    return true;
  }, [searchTerm, filterStock]);

  const filteredRows = useMemo(() => {
    return rootRows
      .map(row => {
        if (row.kind === 'single') return matchesFilters(row.product) ? row : null;
        const children = row.children.filter(matchesFilters);
        if (children.length === 0) return null;
        return { ...row, children };
      })
      .filter((row): row is RootRow => row !== null);
  }, [rootRows, matchesFilters]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStock]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const pageRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const flatVisibleCount = filteredRows.reduce(
    (s, r) => s + (r.kind === 'group' ? r.children.length : 1), 0
  );

  const variantById = useMemo(() => new Map(rawVariants.map(p => [p.id, p])), [rawVariants]);

  const detailProduct = detailId ? variantById.get(detailId) ?? null : null;
  const detailPlatforms = detailId ? enrichedPlatformMap[detailId] ?? [] : [];

  const toggleExpand = (parentId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(parentId) ? next.delete(parentId) : next.add(parentId);
      return next;
    });
  };

  const openDetail = (id: string) => {
    setDetailId(prev => (prev === id ? null : id));
    setDetailTab('info');
  };

  const openGridPopup = (variantId: string, parentId: string | null = null) => {
    setPopupVariantId(variantId);
    setPopupParentId(parentId);
    setDetailTab('info');
  };
  const closeGridPopup = () => { setPopupVariantId(null); setPopupParentId(null); };

  // Dùng AppData trực tiếp thay vì fetch Supabase riêng
  const popupProduct = popupVariantId ? variantById.get(popupVariantId) ?? null : null;

  const hasActiveFilters =
    filterCategories.length > 0 ||
    !!filterBrand ||
    filterStock !== 'all' ||
    !!filterLocation ||
    filterAttrs.length > 0 ||
    filterSupplier.length > 0;

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* === Sidebar lọc === */}
      <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        {navigationSlot && <div className="border-b border-slate-100 p-3">{navigationSlot}</div>}

        <div className="px-4 min-h-[52px] border-b border-slate-100 shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Online</h2>
          {hasActiveFilters && (
            <button onClick={() => setFilterStock('all')} className="text-2xs text-indigo-600 font-bold hover:underline">Xóa lọc</button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Nhóm hàng</span>
            <div className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between">
              <span className="text-slate-400">Chọn nhóm hàng</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Nhà cung cấp</span>
            <div className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between">
              <span className="text-slate-400">Chọn nhà cung cấp</span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400 shrink-0" />
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Thương hiệu</span>
            <div className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between">
              <span className="text-slate-400">Chọn thương hiệu</span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400 shrink-0" />
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Thuộc tính</span>
            <div className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg text-slate-400">
              Chưa có thuộc tính
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Vị trí</span>
            <input
              type="text"
              placeholder="Chọn vị trí"
              disabled
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300"
            />
          </div>

          <div className="px-4 py-3">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Tồn kho</span>
            <div
              onClick={() =>
                setFilterStock(prev =>
                  prev === 'all' ? 'in_stock' : prev === 'in_stock' ? 'out_of_stock' : prev === 'out_of_stock' ? 'low_stock' : 'all'
                )
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
            >
              <span className={filterStock !== 'all' ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                {filterStock === 'all'
                  ? 'Tất cả'
                  : filterStock === 'in_stock'
                    ? 'Còn hàng'
                    : filterStock === 'out_of_stock'
                      ? 'Hết hàng'
                      : 'Sắp hết hàng'}
              </span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400" />
            </div>
          </div>
        </div>
      </aside>

      {/* === Panel chính === */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="flex-1 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã hàng..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center justify-center w-8 h-8 transition-all ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                title="Xem dạng bảng"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center justify-center w-8 h-8 transition-all border-l border-slate-200 ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                title="Xem dạng lưới ảnh"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Dòng tóm tắt */}
        <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-2xs font-bold text-slate-500">
            Hiển thị <span className="font-semibold text-slate-800">{flatVisibleCount}</span> / {rawVariants.length} sản phẩm
          </span>
          {filterStock !== 'all' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-semibold text-[9px]">
              {filterStock === 'low_stock' ? 'Sắp hết hàng' : filterStock === 'out_of_stock' ? 'Hết hàng' : 'Còn hàng'}
              <button onClick={() => setFilterStock('all')}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </div>

        {/* Nội dung chính */}
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain no-scrollbar">
          {viewMode === 'grid' ? (
            loading ? (
              <div className="flex items-center justify-center py-20 text-sm text-slate-400">Đang tải...</div>
            ) : loadError ? (
              <div className="px-6 py-20 text-center text-sm text-rose-500">Lỗi tải dữ liệu: {loadError}</div>
            ) : pageRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Package className="h-10 w-10 mb-3 opacity-10" />
                <p className="text-sm">
                  {rawVariants.length === 0
                    ? 'Chưa có sản phẩm nào được liên kết bán online.'
                    : 'Không có sản phẩm phù hợp với bộ lọc.'}
                </p>
              </div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                  {pageRows.map(row => {
                    if (row.kind === 'single') {
                      const p = row.product;
                      const platforms = enrichedPlatformMap[p.id] ?? [];
                      const stockColor = p.stock <= 0 ? 'text-rose-500 bg-rose-50' : p.stock <= 5 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
                      return (
                        <CatalogGridCard
                          key={p.id}
                          sku={p.sku}
                          name={p.name}
                          thumb={p.images?.[0]}
                          stock={p.stock}
                          stockColor={stockColor}
                          importPrice={p.importPrice}
                          platforms={platforms}
                          variantLabel={null}
                          isSelected={popupVariantId === p.id && !popupParentId}
                          onClick={() => openGridPopup(p.id)}
                        />
                      );
                    }

                    const totalStock = row.children.reduce((s, c) => s + c.stock, 0);
                    const groupPlatforms = Array.from(new Set(row.children.flatMap(c => enrichedPlatformMap[c.id] ?? [])));
                    const thumb = row.parent.images?.[0] ?? row.children.find(c => c.images?.[0])?.images?.[0];
                    const stockColor = totalStock <= 0 ? 'text-rose-500 bg-rose-50' : totalStock <= 5 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
                    const variantCount = row.parent.variantCount ?? row.children.length;
                    return (
                      <CatalogGridCard
                        key={row.parentId}
                        sku={row.parent.sku}
                        name={row.parent.name}
                        thumb={thumb}
                        stock={totalStock}
                        stockColor={stockColor}
                        importPrice={row.children[0]?.importPrice ?? 0}
                        platforms={groupPlatforms}
                        variantLabel={`${variantCount} biến thể`}
                        isSelected={popupParentId === row.parentId}
                        onClick={() => openGridPopup(row.children[0]?.id ?? row.parentId, row.parentId)}
                      />
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            /* ── Chế độ bảng ── */
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" disabled className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="px-2 py-3 w-8"></th>
                  <th className="px-2 py-3 w-20"></th>
                  <th className="px-4 py-3 text-left font-semibold text-2xs uppercase tracking-widest text-slate-500 whitespace-nowrap">
                    Mã hàng
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-2xs uppercase tracking-widest text-slate-500 whitespace-nowrap min-w-[200px]">
                    Nhóm hàng
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-2xs uppercase tracking-widest text-slate-500 whitespace-nowrap">
                    Giá vốn
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-2xs uppercase tracking-widest text-slate-500 whitespace-nowrap">
                    Tồn kho
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-2xs uppercase tracking-widest text-slate-500 whitespace-nowrap w-[80px]">
                    Vị trí
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-2xs uppercase tracking-widest text-slate-500 whitespace-nowrap w-[100px]">
                    Thương hiệu
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-2xs uppercase tracking-widest text-slate-500 whitespace-nowrap">
                    Nền tảng
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-20 text-center text-sm text-slate-400">Đang tải...</td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-20 text-center text-sm text-rose-500">Lỗi tải dữ liệu: {loadError}</td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-20 text-center text-sm text-slate-400">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-10" />
                      {rawVariants.length === 0
                        ? 'Chưa có sản phẩm nào được liên kết bán online — vào trang Sản phẩm Shopee / Sản phẩm Website để liên kết SKU.'
                        : 'Không có sản phẩm phù hợp với bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map(row => {
                    if (row.kind === 'single') {
                      const p = row.product;
                      const platforms = enrichedPlatformMap[p.id] ?? [];
                      return (
                        <tr
                          key={p.id}
                          onClick={() => openDetail(p.id)}
                          className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50 ${detailId === p.id ? 'bg-indigo-50' : ''}`}
                        >
                          <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" disabled className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          </td>
                          <td className="px-2 py-2.5"></td>
                          <td className="px-2 py-2.5">
                            <div className="h-10 w-10 rounded-lg border border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                              {p.images?.[0]
                                ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                                : null}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap">{p.sku}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">{leafCategory(p.categoryPath)}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-slate-700 tabular-nums">{p.importPrice.toLocaleString('vi-VN')}đ</td>
                          <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${p.stock <= 0 ? 'text-rose-500' : p.stock <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>{p.stock}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{p.location || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">{p.brand || '—'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {platforms.map(pf => <PlatformBadge key={pf} platform={pf} />)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5"></td>
                        </tr>
                      );
                    }

                    const isExpanded = expandedIds.has(row.parentId);
                    const groupPlatforms = Array.from(new Set(row.children.flatMap(c => enrichedPlatformMap[c.id] ?? [])));
                    const totalStock = row.children.reduce((s, c) => s + c.stock, 0);

                    return (
                      <React.Fragment key={row.parentId}>
                        <tr
                          onClick={() => toggleExpand(row.parentId)}
                          className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50 ${isExpanded ? 'border-t-2 border-indigo-200 bg-indigo-50/60' : ''}`}
                        >
                          <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" disabled className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          </td>
                          <td className="px-2 py-2.5">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="h-10 w-10 rounded-lg border border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                              {row.parent.images?.[0]
                                ? <img src={row.parent.images[0]} alt={row.parent.name} className="h-full w-full object-cover" />
                                : null}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{row.parent.sku}</span>
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-2xs font-normal text-indigo-700">({row.parent.variantCount ?? row.children.length})</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                            {leafCategory(row.parent.categoryPath ?? row.children[0]?.categoryPath)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-slate-400">—</td>
                          <td className="px-4 py-2.5 text-right text-xs text-slate-700 font-semibold tabular-nums">{totalStock}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">—</td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">{row.parent.brand || row.children[0]?.brand || '—'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {groupPlatforms.map(pf => <PlatformBadge key={pf} platform={pf} />)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5"></td>
                        </tr>
                        {isExpanded && row.children.map(v => (
                          <React.Fragment key={v.id}>
                            <tr
                              onClick={() => openDetail(v.id)}
                              className={`cursor-pointer border-b border-slate-50 bg-indigo-50/40 transition-colors hover:bg-indigo-50 ${detailId === v.id ? 'bg-indigo-50' : ''}`}
                            >
                              <td className="px-4 py-2.5 border-l-2 border-indigo-200" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" disabled className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                              </td>
                              <td className="px-2 py-2.5"></td>
                              <td className="px-2 py-2.5 pl-6">
                                <div className="h-9 w-9 rounded-lg border border-dashed border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                                  {v.images?.[0]
                                    ? <img src={v.images[0]} alt={v.name} className="h-full w-full object-cover" />
                                    : null}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 pl-6 text-xs font-medium text-slate-700 whitespace-nowrap">{v.sku}</td>
                              <td className="px-4 py-2.5 text-xs text-slate-500">{leafCategory(v.categoryPath)}</td>
                              <td className="px-4 py-2.5 text-right text-xs text-slate-700 tabular-nums">{v.importPrice.toLocaleString('vi-VN')}đ</td>
                              <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${v.stock <= 0 ? 'text-rose-500' : v.stock <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>{v.stock}</td>
                              <td className="px-4 py-2.5 text-xs text-slate-500">{v.location || '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-slate-600">{v.brand || '—'}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {(enrichedPlatformMap[v.id] ?? []).map(pf => <PlatformBadge key={pf} platform={pf} />)}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 border-r-2 border-indigo-200"></td>
                            </tr>
                            {detailId === v.id && detailProduct && (
                              <tr>
                                <td colSpan={11} className="p-0">
                                  <DetailPanel
                                    product={detailProduct}
                                    platforms={detailPlatforms}
                                    activeTab={detailTab}
                                    onTabChange={setDetailTab}
                                    onClose={() => setDetailId(null)}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <GoodsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filteredRows.length}
          totalSkuItems={flatVisibleCount}
          setCurrentPage={setCurrentPage}
          onItemsPerPageChange={n => { setItemsPerPage(n); setCurrentPage(1); }}
        />
      </div>

      {/* ── Grid popup modal ── */}
      {popupVariantId && (() => {
        if (!popupProduct) return null;
        const popupPlatforms = enrichedPlatformMap[popupVariantId] ?? [];
        const popupParentRow = popupParentId
          ? rootRows.find((r): r is Extract<RootRow, { kind: 'group' }> => r.kind === 'group' && r.parentId === popupParentId)
          : undefined;
        const popupChildren = popupParentRow?.children ?? null;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={closeGridPopup}
          >
            <div
              className="relative w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {popupParentRow ? popupParentRow.parent.name || popupParentRow.parent.sku : popupProduct.name}
                  </p>
                  {popupChildren && (
                    <p className="text-xs text-slate-400 mt-0.5">{popupChildren.length} biến thể</p>
                  )}
                </div>
                <button onClick={closeGridPopup} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {popupChildren && popupChildren.length > 0 && (
                <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {popupChildren.map(v => {
                      const isActive = popupVariantId === v.id;
                      const stock = v.stock ?? 0;
                      const stockColor = stock <= 0 ? 'text-red-500' : stock <= 5 ? 'text-amber-500' : 'text-emerald-600';
                      return (
                        <button
                          key={v.id}
                          onClick={() => { setPopupVariantId(v.id); setDetailTab('info'); }}
                          className={`flex items-center gap-2 shrink-0 rounded-xl border px-2.5 py-2 transition-colors ${
                            isActive
                              ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                            {v.images?.[0] ? (
                              <img src={v.images[0]} alt={v.name} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-4 h-4 text-slate-300" strokeWidth={1} />
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <p className={`text-2xs font-normal truncate max-w-[120px] ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                              {v.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] font-normal text-indigo-500">
                                {(v.salePrice ?? v.importPrice ?? 0).toLocaleString('vi-VN')}đ
                              </span>
                              <span className={`text-[9px] font-normal ${stockColor}`}>
                                · Tồn: {stock}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col">
                <GoodsProductDetailPanel
                  product={popupProduct}
                  transactions={[]}
                  orders={[]}
                  activeTab={detailTab}
                  onTabChange={setDetailTab}
                  onDelete={() => {}}
                  onEdit={() => {}}
                  onClose={closeGridPopup}
                  deleteConfirmText="Vào trang Hàng hóa để xóa sản phẩm"
                  noBorder
                  fillHeight
                  showCopyPrintActions={false}
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Grid card cho catalog ────────────────────────────────────────────────────

const CatalogGridCard = memo(function CatalogGridCard({
  sku, name, thumb, stock, stockColor, importPrice, platforms, variantLabel, isSelected, onClick,
}: {
  sku: string;
  name: string;
  thumb?: string | null;
  stock: number;
  stockColor: string;
  importPrice: number;
  platforms: Platform[];
  variantLabel: string | null;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-2xl border transition-all active:scale-[0.98] overflow-hidden group flex flex-col text-left ${
        isSelected
          ? 'border-indigo-300 shadow-md shadow-indigo-100'
          : 'border-slate-100 hover:border-indigo-200 hover:shadow-md shadow-sm'
      }`}
    >
      <div className="bg-slate-100/60 relative w-full aspect-square flex-shrink-0 flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <ImageIcon className="h-10 w-10 text-slate-300" strokeWidth={1} />
        )}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-white/90 text-indigo-600 text-2xs font-normal rounded-full shadow-sm border border-indigo-100">
          {importPrice.toLocaleString('vi-VN')}đ
        </div>
        {variantLabel && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-normal rounded-full shadow-sm">
            {variantLabel}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2 flex flex-col gap-1 flex-1">
        <p className="text-xs font-normal text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors text-center">
          {name || sku}
        </p>
        <div className="flex items-center justify-between mt-auto pt-1 gap-1 flex-wrap">
          <span className="text-[9px] text-slate-400 truncate">{sku}</span>
          <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-full ${stockColor}`}>{stock}</span>
        </div>
        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {platforms.map(pf => <PlatformBadge key={pf} platform={pf} />)}
          </div>
        )}
      </div>
    </button>
  );
});

// ─── Detail panel inline trong bảng ──────────────────────────────────────────

function DetailPanel({ product, platforms, activeTab, onTabChange, onClose, bordered = true }: {
  product: POSProduct;
  platforms: Platform[];
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
  bordered?: boolean;
}) {
  return (
    <div className={bordered ? 'bg-white border-2 border-indigo-400 rounded-lg shadow-2xl mx-4 my-2' : 'bg-white'}>
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1 px-6">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-normal border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button onClick={onClose} className="ml-auto rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[600px] overflow-auto bg-slate-50 p-6">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex gap-6">
                <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-normal text-slate-900 mb-2">{product.name}</h2>
                  <p className="text-sm text-slate-600 mb-3">
                    Nhóm hàng: <span className="font-normal">{product.categoryPath || 'Chưa phân loại'}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Mã hàng</label>
                  <div className="text-sm font-normal text-slate-900">{product.sku}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Tồn kho</label>
                  <div className="text-sm font-normal text-slate-900">{product.stock}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Giá vốn</label>
                  <div className="text-sm font-normal text-slate-900">{product.importPrice.toLocaleString('vi-VN')}đ</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Thương hiệu</label>
                  <div className="text-sm text-slate-600">{product.brand || 'Chưa có'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Vị trí</label>
                  <div className="text-sm text-slate-600">{product.location || 'Chưa có'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'desc' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="text-sm font-normal text-slate-700 mb-3 block">Mô tả chi tiết</label>
            <div className="text-sm text-slate-600">{product.description || 'Chưa có mô tả'}</div>
          </div>
        )}

        {activeTab === 'warranty' && (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Chưa có giao dịch thẻ kho</p>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Chưa có dữ liệu tồn kho theo chi nhánh</p>
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-slate-700"><Globe className="h-4 w-4 text-indigo-600" /> Website PHÚC SANG</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${platforms.includes('website') ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {platforms.includes('website') ? 'Đang bán' : 'Chưa liên kết'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-slate-700"><ShoppingCart className="h-4 w-4 text-orange-500" /> Shopee</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${platforms.includes('shopee') ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                {platforms.includes('shopee') ? 'Đang bán' : 'Chưa liên kết'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
