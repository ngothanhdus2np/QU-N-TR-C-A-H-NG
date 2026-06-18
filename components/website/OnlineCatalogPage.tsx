import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search, List, LayoutGrid, X, Image as ImageIcon, Globe, ShoppingCart, Package } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { GoodsPagination } from '../pos/GoodsPagination';

// ─── Types ────────────────────────────────────────────────────────────────────

type StockFilter = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
type DetailTab = 'info' | 'desc' | 'warranty' | 'units' | 'channels';
type Platform = 'website' | 'shopee';

interface Props {
  navigationSlot?: React.ReactNode;
  onNavigate?: (tab: string) => void;
}

interface RawProduct {
  id: string;
  sku: string;
  name: string;
  category_path: string | null;
  import_price: number;
  stock: number;
  location: string | null;
  brand: string | null;
  parent_id: string | null;
  is_parent: boolean;
  variant_count: number | null;
  status: string;
}

type RootRow =
  | { kind: 'group'; parentId: string; parent: RawProduct; children: RawProduct[] }
  | { kind: 'single'; product: RawProduct };

const PRODUCT_COLUMNS =
  'id, sku, name, category_path, import_price, stock, location, brand, parent_id, is_parent, variant_count, status';

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
// Layout clone từ trang "Danh sách hàng hóa" (GoodsInventory + GoodsFilterSidebar + GoodsToolbar).
// Dữ liệu lấy từ pos_products (cha-con qua parent_id) join shopee_product_variants /
// store_product_variants (is_published=true) để biết SKU nào đang bán nền tảng nào.

export default function OnlineCatalogPage({ navigationSlot }: Props) {
  // Filter sidebar — Nhóm hàng/Nhà cung cấp/Thương hiệu/Thuộc tính/Vị trí vẫn là placeholder
  // tĩnh (chưa nối logic lọc thật), chỉ Tồn kho + ô tìm kiếm là lọc thật trên data đã tải.
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
  const [rawVariants, setRawVariants] = useState<RawProduct[]>([]);
  const [rawParents, setRawParents] = useState<RawProduct[]>([]);
  const [platformMap, setPlatformMap] = useState<Record<string, Platform[]>>({});

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Đọc qua backend (service role) để bypass RLS trên shopee_product_variants
      const catalogRes = await fetch('/api/channel-links/catalog-links', { credentials: 'include' });
      const catalogJson: { ok: boolean; error?: string; website: string[]; shopee: string[] } = await catalogRes.json();
      if (!catalogJson.ok) throw new Error(catalogJson.error ?? 'Lỗi tải danh sách kênh');

      // Gom platform theo pos_product_id
      const platformMap: Record<string, Platform[]> = {};
      const addPlatform = (id: string, p: Platform) => {
        if (!platformMap[id]) platformMap[id] = [];
        if (!platformMap[id].includes(p)) platformMap[id].push(p);
      };
      catalogJson.website.forEach(id => addPlatform(id, 'website'));
      catalogJson.shopee.forEach(id => addPlatform(id, 'shopee'));

      const linkedIds = Object.keys(platformMap);
      if (linkedIds.length === 0) {
        setRawVariants([]);
        setRawParents([]);
        setPlatformMap({});
        return;
      }

      // Fetch các pos_products được link (có thể là cha hoặc con)
      const { data: linkedData, error: linkedErr } = await supabase
        .from('pos_products')
        .select(PRODUCT_COLUMNS)
        .in('id', linkedIds);
      if (linkedErr) throw linkedErr;

      const linkedProducts = (linkedData ?? []) as RawProduct[];

      // Tách: sản phẩm cha được link trực tiếp → cần fetch con của chúng
      const directParents = linkedProducts.filter(p => p.is_parent);
      // Sản phẩm con / đơn lẻ được link trực tiếp
      const directChildren = linkedProducts.filter(p => !p.is_parent);

      // Fetch tất cả con của các sản phẩm cha được link
      let parentChildren: RawProduct[] = [];
      if (directParents.length > 0) {
        const { data: childData } = await supabase
          .from('pos_products')
          .select(PRODUCT_COLUMNS)
          .in('parent_id', directParents.map(p => p.id))
          .eq('status', 'Active');
        parentChildren = (childData ?? []) as RawProduct[];
      }

      // Kế thừa platform từ cha xuống con (nếu cha được link thì con cũng mang platform đó)
      const enrichedPlatformMap: Record<string, Platform[]> = { ...platformMap };
      for (const parent of directParents) {
        const parentPlatforms = platformMap[parent.id] ?? [];
        for (const child of parentChildren.filter(c => c.parent_id === parent.id)) {
          if (!enrichedPlatformMap[child.id]) enrichedPlatformMap[child.id] = [];
          for (const pf of parentPlatforms) {
            if (!enrichedPlatformMap[child.id].includes(pf)) {
              enrichedPlatformMap[child.id].push(pf);
            }
          }
        }
      }

      // rawVariants = tất cả biến thể/sản phẩm đơn cần hiển thị
      const variantSet = new Map<string, RawProduct>();
      for (const p of [...parentChildren, ...directChildren]) {
        variantSet.set(p.id, p);
      }

      // rawParents = các sản phẩm cha
      const parentSet = new Map<string, RawProduct>();
      for (const p of directParents) parentSet.set(p.id, p);

      // Fetch cha của các con được link trực tiếp (nếu có)
      const missingParentIds = Array.from(
        new Set(directChildren.map(c => c.parent_id).filter((id): id is string => !!id && !parentSet.has(id)))
      );
      if (missingParentIds.length > 0) {
        const { data: extraParents } = await supabase
          .from('pos_products')
          .select(PRODUCT_COLUMNS)
          .in('id', missingParentIds);
        for (const p of (extraParents ?? []) as RawProduct[]) parentSet.set(p.id, p);
      }

      // Nếu con được link trực tiếp có anh em chưa được link → cũng fetch để hiển thị đầy đủ nhóm
      const groupParentIds = Array.from(new Set(directChildren.map(c => c.parent_id).filter(Boolean))) as string[];
      if (groupParentIds.length > 0) {
        const { data: siblings } = await supabase
          .from('pos_products')
          .select(PRODUCT_COLUMNS)
          .in('parent_id', groupParentIds)
          .eq('status', 'Active');
        for (const s of (siblings ?? []) as RawProduct[]) {
          if (!variantSet.has(s.id)) variantSet.set(s.id, s);
        }
      }

      // Các sản phẩm đơn lẻ được link mà không thuộc nhóm nào
      const standaloneLinked = directChildren.filter(c => !c.parent_id);
      for (const s of standaloneLinked) {
        if (!enrichedPlatformMap[s.id]) enrichedPlatformMap[s.id] = platformMap[s.id] ?? [];
      }

      setRawVariants(Array.from(variantSet.values()));
      setRawParents(Array.from(parentSet.values()));
      setPlatformMap(enrichedPlatformMap);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Gom cha-con ───────────────────────────────────────────────────────────
  const rootRows = useMemo<RootRow[]>(() => {
    const parentMap = new Map(rawParents.map(p => [p.id, p]));
    const byParent = new Map<string, RawProduct[]>();
    const standalone: RawProduct[] = [];

    for (const v of rawVariants) {
      if (v.parent_id && parentMap.has(v.parent_id)) {
        const arr = byParent.get(v.parent_id) ?? [];
        arr.push(v);
        byParent.set(v.parent_id, arr);
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

  // ─── Lọc tìm kiếm + tồn kho (áp dụng ở cấp biến thể) ─────────────────────────
  const matchesFilters = useCallback((p: RawProduct) => {
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

  const detailProduct = detailId ? rawVariants.find(p => p.id === detailId) ?? null : null;
  const detailPlatforms = detailId ? platformMap[detailId] ?? [] : [];

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

  const hasActiveFilters =
    filterCategories.length > 0 ||
    !!filterBrand ||
    filterStock !== 'all' ||
    !!filterLocation ||
    filterAttrs.length > 0 ||
    filterSupplier.length > 0;

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* === Sidebar lọc — clone GoodsFilterSidebar === */}
      <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        {navigationSlot && <div className="border-b border-slate-100 p-3">{navigationSlot}</div>}

        <div className="px-4 min-h-[52px] border-b border-slate-100 shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Online</h2>
          {hasActiveFilters && (
            <button onClick={() => setFilterStock('all')} className="text-2xs text-indigo-600 font-bold hover:underline">Xóa lọc</button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* 1. Nhóm hàng */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Nhóm hàng</span>
            <div className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between">
              <span className="text-slate-400">Chọn nhóm hàng</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* 2. Nhà cung cấp */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Nhà cung cấp</span>
            <div className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between">
              <span className="text-slate-400">Chọn nhà cung cấp</span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* 3. Thương hiệu */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Thương hiệu</span>
            <div className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between">
              <span className="text-slate-400">Chọn thương hiệu</span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* 4. Thuộc tính */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Thuộc tính</span>
            <div className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg text-slate-400">
              Chưa có thuộc tính
            </div>
          </div>

          {/* 5. Vị trí */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 mb-2 block">Vị trí</span>
            <input
              type="text"
              placeholder="Chọn vị trí"
              disabled
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300"
            />
          </div>

          {/* 6. Tồn kho */}
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

      {/* === Panel chính — clone GoodsToolbar + bảng + GoodsPagination === */}
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

        {/* Dòng tóm tắt + filter chips */}
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

        {/* Bảng — clone GoodsProductTableHeader */}
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain no-scrollbar">
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
                    const platforms = platformMap[p.id] ?? [];
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
                          <div className="h-10 w-10 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap">{p.sku}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">{leafCategory(p.category_path)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-700 tabular-nums">{p.import_price.toLocaleString('vi-VN')}đ</td>
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
                  const groupPlatforms = Array.from(new Set(row.children.flatMap(c => platformMap[c.id] ?? [])));
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
                          <div className="h-10 w-10 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{row.parent.sku}</span>
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-2xs font-normal text-indigo-700">({row.parent.variant_count ?? row.children.length})</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                          {leafCategory(row.parent.category_path ?? row.children[0]?.category_path)}
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
                              <div className="h-9 w-9 rounded-lg border border-dashed border-slate-200 bg-white" />
                            </td>
                            <td className="px-4 py-2.5 pl-6 text-xs font-medium text-slate-700 whitespace-nowrap">{v.sku}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{leafCategory(v.category_path)}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-slate-700 tabular-nums">{v.import_price.toLocaleString('vi-VN')}đ</td>
                            <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${v.stock <= 0 ? 'text-rose-500' : v.stock <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>{v.stock}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{v.location || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-600">{v.brand || '—'}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {(platformMap[v.id] ?? []).map(pf => <PlatformBadge key={pf} platform={pf} />)}
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
    </div>
  );
}

// ─── Bảng chi tiết — clone chrome từ GoodsProductDetailPanel.tsx ───────────────

function DetailPanel({ product, platforms, activeTab, onTabChange, onClose }: {
  product: RawProduct;
  platforms: Platform[];
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-white border-2 border-indigo-400 rounded-lg shadow-2xl mx-4 my-2">
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
                    Nhóm hàng: <span className="font-normal">{product.category_path || 'Chưa phân loại'}</span>
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
                  <div className="text-sm font-normal text-slate-900">{product.import_price.toLocaleString('vi-VN')}đ</div>
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
            <div className="text-sm text-slate-600">Chưa có mô tả</div>
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
