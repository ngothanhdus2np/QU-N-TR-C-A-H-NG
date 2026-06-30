import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  Search, X, Check, RefreshCw, ExternalLink,
  Eye, EyeOff, ChevronRight, Save, Loader2, Package, ShoppingBag, Store,
  Image as ImageIcon, Video, Edit2, Download, LayoutGrid, List,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../ui/Toast';
import { GoodsPagination } from '../pos/GoodsPagination';

interface ShopeeShop { id: string; name: string; slug: string; }

interface ShopeeVariant {
  id: string; sku: string; pos_sku: string; size: string | null; color_name: string | null;
  shopee_price_override: number | null; pos_product_id: string;
  is_published: boolean; display_order: number;
}

interface ShopEntry {
  id: string;
  name: string;
  shop_id: string | null;
  shopee_item_id: string | null;
  is_published: boolean;
  cover_image_url: string | null;
  display_order: number;
  description: string | null;
  gallery: string[] | null;
  shopee_product_variants: ShopeeVariant[];
}

interface CatalogProduct {
  pos_product_id: string;
  name: string;
  group_name?: string;
  shopee_entries: ShopEntry[];
}

interface PosProduct { id: string; sku: string; name: string; sale_price: number; stock: number; }

interface VariantDraft {
  id: string;
  pos_product_id: string; sku: string; pos_sku: string; size: string; color_name: string; shopee_price_override: string;
}

interface EditForm {
  // ẩn — giữ để save vẫn hoạt động
  cover_image_url: string; shopee_item_id: string; shop_id: string;
  is_published: boolean; display_order: number;
  // hiển thị
  product_name: string;       // tên sản phẩm Shopee (tối đa 120 ký tự)
  description: string;        // mô tả sản phẩm
  other_images: string[];     // tối đa 6 ảnh thường
  category: string;           // ngành hàng
  variantDrafts: VariantDraft[];
}

// Màu theo index shop — giống trang vận đơn
const SHOP_COLORS = [
  { badge: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-400', border: 'border-indigo-200', activeBg: 'bg-indigo-50/60', row: 'bg-indigo-50/30 hover:bg-indigo-50/60' },
  { badge: 'bg-violet-50 text-violet-700', dot: 'bg-violet-400', border: 'border-violet-200', activeBg: 'bg-violet-50/60', row: 'bg-violet-50/20 hover:bg-violet-50/50' },
];
function shopColor(idx: number) { return SHOP_COLORS[idx % SHOP_COLORS.length]; }

function makeEditForm(entry: ShopEntry, productName: string): EditForm {
  return {
    cover_image_url: entry.cover_image_url ?? '',
    shopee_item_id: entry.shopee_item_id ?? '',
    shop_id: entry.shop_id ?? '',
    is_published: entry.is_published,
    display_order: entry.display_order,
    product_name: entry.name || productName,
    description: entry.description ?? '',
    other_images: entry.gallery ?? [],
    category: '',
    variantDrafts: [...entry.shopee_product_variants]
      .sort((a, b) => a.display_order - b.display_order)
      .map(v => ({
        id: v.id,
        pos_product_id: v.pos_product_id,
        sku: v.sku,
        pos_sku: v.pos_sku ?? '',
        size: v.size ?? '',
        color_name: v.color_name ?? '',
        shopee_price_override: v.shopee_price_override != null ? String(v.shopee_price_override) : '',
      })),
  };
}

// ─── SKU search hook ──────────────────────────────────────────────────────────
function useSkuSearch() {
  const [skuSearch, setSkuSearch] = useState('');
  const [skuResults, setSkuResults] = useState<PosProduct[]>([]);
  const [skuLoading, setSkuLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searchSku = useCallback((q: string) => {
    setSkuSearch(q);
    clearTimeout(timerRef.current);
    if (!q.trim()) { setSkuResults([]); return; }
    setSkuLoading(true);
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('pos_products')
        .select('id, sku, name, sale_price, stock')
        .ilike('sku', `%${q}%`)
        .eq('status', 'Active')
        .order('sku')
        .limit(20);
      setSkuResults((data as PosProduct[]) ?? []);
      setSkuLoading(false);
    }, 300);
  }, []);

  const clearSearch = useCallback(() => { setSkuSearch(''); setSkuResults([]); }, []);
  return { skuSearch, skuResults, skuLoading, searchSku, clearSearch };
}

// ─── Variants editor ──────────────────────────────────────────────────────────
function VariantsEditor({ drafts, onChange }: { drafts: VariantDraft[]; onChange: (d: VariantDraft[]) => void }) {
  const { skuSearch, skuResults, skuLoading, searchSku, clearSearch } = useSkuSearch();

  const addVariant = (pos: PosProduct) => {
    onChange([...drafts, { id: crypto.randomUUID(), pos_product_id: pos.id, sku: '', pos_sku: pos.sku, size: '', color_name: '', shopee_price_override: '' }]);
    clearSearch();
  };
  const removeVariant = (id: string) => onChange(drafts.filter(v => v.id !== id));
  const updateVariant = (id: string, field: keyof Omit<VariantDraft, 'id' | 'pos_product_id' | 'sku'>, value: string) =>
    onChange(drafts.map(v => v.id === id ? { ...v, [field]: value } : v));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={skuSearch}
          onChange={e => searchSku(e.target.value)}
          placeholder="Tìm SKU trong POS để thêm..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {(skuResults.length > 0 || skuLoading) && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {skuLoading ? (
              <div className="p-3 text-sm text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tìm...</div>
            ) : skuResults.map(pos => {
              const already = drafts.some(v => v.pos_product_id === pos.id);
              return (
                <button key={pos.id} onClick={() => addVariant(pos)} disabled={already}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left">
                  <div className="flex items-center gap-2">
                    {already && <Check size={13} className="text-green-500" />}
                    <span className="font-medium text-slate-700">{pos.sku}</span>
                    <span className="text-slate-500 truncate max-w-[140px]">{pos.name}</span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">{pos.stock} tồn</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {drafts.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
          Chưa có SKU nào được liên kết.
        </p>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2 font-medium text-slate-500">SKU</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">SKU Shopee</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Size</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Màu</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Giá Shopee</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {drafts.map(v => (
                <tr key={v.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 text-slate-700 font-medium">{v.pos_sku || <span className="text-slate-300 italic">chưa link</span>}</td>
                  <td className="px-3 py-2 text-slate-500">{v.sku || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2">
                    <input value={v.size} onChange={e => updateVariant(v.id, 'size', e.target.value)}
                      placeholder="40" className="w-14 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={v.color_name} onChange={e => updateVariant(v.id, 'color_name', e.target.value)}
                      placeholder="Đen" className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={v.shopee_price_override}
                      onChange={e => updateVariant(v.id, 'shopee_price_override', e.target.value)}
                      placeholder="Giá POS" className="w-24 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => removeVariant(v.id)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5">
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type ShopeeTab = 'co-ban' | 'chi-tiet' | 'mo-ta' | 'ban-hang' | 'van-chuyen' | 'khac';

const SHOPEE_TABS: { id: ShopeeTab; label: string }[] = [
  { id: 'co-ban',     label: 'Thông tin cơ bản' },
  { id: 'chi-tiet',   label: 'Thông tin chi tiết' },
  { id: 'mo-ta',      label: 'Mô tả' },
  { id: 'ban-hang',   label: 'Thông tin bán hàng' },
  { id: 'van-chuyen', label: 'Vận chuyển' },
  { id: 'khac',       label: 'Thông tin khác' },
];

// ─── Detail panel cho 1 shop entry ───────────────────────────────────────────
function ShopDetailPanel({
  entry, shops, colorIdx, onSaved, productName,
}: { entry: ShopEntry; shops: ShopeeShop[]; colorIdx: number; onSaved: () => void; productName: string }) {
  const { showToast } = useToast();
  const colors = shopColor(colorIdx);
  const [tab, setTab] = useState<ShopeeTab>('co-ban');
  const [form, setForm] = useState<EditForm>(() => makeEditForm(entry, productName));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { setForm(makeEditForm(entry, productName)); setDirty(false); setTab('co-ban'); }, [entry.id]);

  const setF = (patch: Partial<EditForm>) => { setForm(prev => ({ ...prev, ...patch })); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/shopee-products/${entry.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Lỗi lưu');
      showToast('Đã cập nhật', 'success');
      setDirty(false);
      onSaved();
    } catch (err: unknown) {
      showToast('Lỗi: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally { setSaving(false); }
  };

  const handleSync = async () => {
    const shopSlug = shops.find(s => s.id === entry.shop_id)?.slug;
    setSyncing(true);
    try {
      const res = await fetch('/api/shopee-sync/all', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopSlug }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Bot không phản hồi');
      showToast('Đã kích hoạt quét Shop — biến thể sẽ được cập nhật tự động (xem pm2 logs)', 'success');
    } catch (err: unknown) {
      showToast('Sync lỗi: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const shopeeUrl = entry.shopee_item_id ? `https://shopee.vn/product/${entry.shopee_item_id}` : null;

  return (
    <div className={`border-l-2 ${colors.border} bg-white`}>
      {/* Tab bar — 6 tab giống Shopee Seller Center */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4">
        <div className="flex overflow-x-auto">
          {SHOPEE_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}>
              {t.label}
              {t.id === 'ban-hang' && form.variantDrafts.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                  {form.variantDrafts.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          {shopeeUrl && (
            <a href={shopeeUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 whitespace-nowrap">
              <ExternalLink size={12} /> Xem Shopee
            </a>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Quét toàn bộ sản phẩm & biến thể của shop từ Shopee Seller Center"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 rounded-lg transition-colors whitespace-nowrap"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Sync Shopee
          </button>
          <button onClick={handleSave} disabled={saving || !dirty}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-default text-white rounded-lg transition-colors whitespace-nowrap">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Lưu
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Thông tin cơ bản */}
        {tab === 'co-ban' && (
          <div className="space-y-8">

            {/* ── Tên sản phẩm + Ngành hàng ── */}
            <section>
              <div className="flex gap-4">
                <div className="flex-[2]">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    <span className="text-red-500 mr-1">*</span>Tên sản phẩm
                  </label>
                  <div className="relative">
                    <input
                      value={form.product_name}
                      onChange={e => setF({ product_name: e.target.value.slice(0, 120) })}
                      placeholder="Nhập tên sản phẩm Shopee..."
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 tabular-nums">
                      {form.product_name.length}/120
                    </span>
                  </div>
                </div>
                <div className="flex-[1]">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    <span className="text-red-500 mr-1">*</span>Ngành hàng
                  </label>
                  <div className="flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-lg bg-white">
                    <span className={`text-sm truncate ${form.category ? 'text-slate-700' : 'text-slate-300'}`}>
                      {form.category || 'Chưa chọn'}
                    </span>
                    <button
                      onClick={() => {
                        const val = window.prompt('Nhập ngành hàng:', form.category);
                        if (val !== null) setF({ category: val });
                      }}
                      className="text-slate-400 hover:text-orange-500 transition-colors ml-2 shrink-0"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 3 cột: Ảnh | Video | Mô tả ── */}
            <div className="flex gap-5 items-stretch">

              {/* CỘT 1: Ảnh sản phẩm */}
              <div className="flex-1 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Hình ảnh</h3>
                {/* Ảnh bìa */}
                <div className="relative group aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/10 transition-colors overflow-hidden cursor-pointer"
                  onClick={() => document.getElementById('cover-upload')?.click()}>
                  {form.cover_image_url ? (
                    <>
                      <img src={form.cover_image_url} alt="ảnh bìa" className="w-full h-full object-contain bg-white" />
                      <button
                        onClick={e => { e.stopPropagation(); setF({ cover_image_url: '' }); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <X size={11} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-orange-500/90 text-white text-[9px] text-center py-0.5 font-medium">★ Ảnh bìa</div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full gap-2">
                      <ImageIcon size={28} className="text-slate-300" />
                      <span className="text-xs text-slate-400 text-center px-3">Bấm để tải lên ảnh bìa</span>
                    </div>
                  )}
                </div>
                <input id="cover-upload" type="file" accept="image/*" className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setF({ cover_image_url: URL.createObjectURL(file) });
                    e.target.value = '';
                  }} />
                {/* Nhập URL ảnh bìa */}
                <input
                  type="url"
                  placeholder="Hoặc dán URL ảnh..."
                  defaultValue={form.cover_image_url.startsWith('blob:') ? '' : form.cover_image_url}
                  onBlur={e => { if (e.target.value.trim()) setF({ cover_image_url: e.target.value.trim() }); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-600 placeholder:text-slate-300"
                />
                {/* Thumbnails — hàng ngang */}
                <span className="text-[10px] text-slate-400">Ảnh phụ ({form.other_images.length}/6)</span>
                <div className="flex gap-1.5 flex-wrap">
                  {form.other_images.map((url, idx) => (
                    <div key={idx} className="relative group/thumb w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <img src={url} alt="" className="w-full h-full object-contain" />
                      <button
                        onClick={() => setF({ other_images: form.other_images.filter((_, i) => i !== idx) })}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/50 rounded-full text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                  {form.other_images.length < 6 && (
                    <button
                      onClick={() => document.getElementById('images-upload')?.click()}
                      className="w-12 h-12 shrink-0 rounded-lg border-2 border-dashed border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/30 transition-colors flex flex-col items-center justify-center gap-0.5"
                    >
                      <ImageIcon size={12} className="text-slate-300" />
                      <span className="text-[9px] text-slate-400">Thêm</span>
                    </button>
                  )}
                </div>
                <input id="images-upload" type="file" accept="image/*" multiple className="sr-only"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    const remaining = 6 - form.other_images.length;
                    const urls = files.slice(0, remaining).map(f => URL.createObjectURL(f));
                    setF({ other_images: [...form.other_images, ...urls] });
                    e.target.value = '';
                  }} />
              </div>

              {/* CỘT 2: Video sản phẩm */}
              <div className="flex-1 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Video</h3>
                <div className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-orange-300 rounded-xl bg-white cursor-pointer hover:bg-orange-50/30 transition-colors">
                  <Video size={28} className="text-orange-400 mb-1.5" />
                  <span className="text-[10px] text-orange-500 font-medium">Thêm video</span>
                  <span className="text-[9px] text-slate-300 mt-1">Max 30MB · MP4 · 10s–60s</span>
                </div>
              </div>

              {/* CỘT 3: Mô tả sản phẩm */}
              <div className="flex-1 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Mô tả sản phẩm</h3>
                <textarea
                  value={form.description}
                  onChange={e => setF({ description: e.target.value.slice(0, 3000) })}
                  placeholder="Nhập mô tả sản phẩm..."
                  className="w-full flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  style={{ minHeight: 0 }}
                />
                <span className="text-[10px] text-slate-400 text-right tabular-nums">{form.description.length}/3000</span>
              </div>

            </div>


          </div>
        )}

        {/* Thông tin bán hàng — SKU liên kết */}
        {tab === 'ban-hang' && (
          <div className="max-w-2xl">
            <VariantsEditor drafts={form.variantDrafts} onChange={drafts => setF({ variantDrafts: drafts })} />
          </div>
        )}

        {/* Các tab chưa có nội dung — placeholder */}
        {(tab === 'chi-tiet' || tab === 'mo-ta' || tab === 'van-chuyen' || tab === 'khac') && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-300">
            <Package size={28} className="mb-2" />
            <p className="text-sm">Chưa có nội dung — sẽ cập nhật sau</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 1 dòng tab shop (giống tab Thông tin / SKU liên kết) ───────────────────
function ShopTabsRow({
  shops, entries, activeEntryId, colCount, onSelect,
}: {
  shops: ShopeeShop[];
  entries: ShopEntry[];
  activeEntryId: string | null;
  colCount: number;
  onSelect: (entryId: string | null) => void;
}) {
  return (
    <tr className="border-b border-orange-100 bg-orange-50/40">
      <td colSpan={colCount} className="px-4 py-0">
        <div className="flex items-center gap-1">
          {shops.map((shop, idx) => {
            const colors = shopColor(idx);
            // match theo shop_id, fallback theo index khi shop_id chưa gán
            const entry =
              entries.find(e => e.shop_id === shop.id) ??
              (entries[idx]?.shop_id == null ? entries[idx] : null) ??
              null;
            const isActive = entry != null && activeEntryId === entry.id;

            return (
              <button
                key={shop.id}
                onClick={() => entry && onSelect(isActive ? null : entry.id)}
                disabled={!entry}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Store size={12} />
                {shop.name}
                {entry && (
                  <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
                    entry.is_published ? colors.dot : 'bg-slate-300'
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ShopeeProductsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [shops, setShops] = useState<ShopeeShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [skuMatching, setSkuMatching] = useState(false);

  // table mode
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  // grid popup
  const [gridPopupProduct, setGridPopupProduct] = useState<CatalogProduct | null>(null);
  const [gridActiveEntryId, setGridActiveEntryId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/channel-links/shopee-catalog', { credentials: 'include' });
      const json: { ok: boolean; error?: string; products: CatalogProduct[]; shops: ShopeeShop[] } = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Lỗi tải dữ liệu');
      setProducts(json.products);
      setShops(json.shops);
    } catch {
      showToast('Lỗi tải danh sách sản phẩm Shopee', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleSkuMatch = async () => {
    // Preview trước
    try {
      const previewRes = await fetch('/api/shopee-products/sku-match?preview=true', {
        method: 'POST', credentials: 'include',
      });
      const previewJson: { ok: boolean; matches: Array<{ catalogName: string; syncedName: string; matchedSku: string }>; total: number } = await previewRes.json();
      if (!previewJson.ok) throw new Error('Lỗi preview');
      if (previewJson.total === 0) {
        showToast('Không tìm thấy sản phẩm nào có SKU trùng khớp.', 'error');
        return;
      }
      const confirmed = window.confirm(
        `Tìm thấy ${previewJson.total} sản phẩm có thể ghép:\n\n` +
        previewJson.matches.slice(0, 5).map(m => `• ${m.catalogName} ← ${m.syncedName} (SKU: ${m.matchedSku})`).join('\n') +
        (previewJson.total > 5 ? `\n... và ${previewJson.total - 5} sản phẩm khác` : '') +
        '\n\nXác nhận cập nhật ảnh + mô tả từ Shopee vào catalog?'
      );
      if (!confirmed) return;
    } catch {
      showToast('Lỗi khi preview SKU match', 'error');
      return;
    }

    setSkuMatching(true);
    try {
      const res = await fetch('/api/shopee-products/sku-match', {
        method: 'POST', credentials: 'include',
      });
      const json: { ok: boolean; updated: number; total: number; error?: string } = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Lỗi');
      showToast(`Đã cập nhật ${json.updated}/${json.total} sản phẩm từ Shopee!`, 'success');
      loadProducts();
    } catch (err: unknown) {
      showToast('Lỗi SKU match: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setSkuMatching(false);
    }
  };

  const shopMap = new Map(shops.map(s => [s.id, s]));

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.shopee_entries.some(e => (e.shopee_item_id ?? '').includes(search))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageFiltered = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openGridPopup = (product: CatalogProduct) => {
    setGridPopupProduct(product);
    setGridActiveEntryId(product.shopee_entries[0]?.id ?? null);
  };
  const closeGridPopup = () => { setGridPopupProduct(null); setGridActiveEntryId(null); };

  const toggleProduct = (posId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(posId)) { next.delete(posId); setActiveEntryId(null); }
      else next.add(posId);
      return next;
    });
  };

  const toggleEntry = (entryId: string) => {
    setActiveEntryId(prev => prev === entryId ? null : entryId);
  };

  const totalEntries = products.reduce((s, p) => s + p.shopee_entries.length, 0);
  const publishedEntries = products.reduce((s, p) => s + p.shopee_entries.filter(e => e.is_published).length, 0);

  // số cột cố định trong bảng (checkbox + tên + shop chips + SKU + trạng thái)
  const COL_COUNT = 6;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); }}
            placeholder="Tìm tên hoặc Item ID..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {products.length} sản phẩm · {totalEntries} listing · {publishedEntries} đang bán
          </span>
          <button onClick={loadProducts} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Tải lại">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={handleSkuMatch}
            disabled={skuMatching}
            title="Tự động ghép ảnh + mô tả từ Shopee vào catalog theo SKU"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap"
          >
            {skuMatching ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Auto Fill SKU
          </button>
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center justify-center w-8 h-8 transition-all ${viewMode === 'table' ? 'bg-orange-50 text-orange-600' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
              title="Xem dạng bảng"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center w-8 h-8 border-l border-slate-200 transition-all ${viewMode === 'grid' ? 'bg-orange-50 text-orange-600' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
              title="Xem dạng lưới ảnh"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Nội dung chính */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Đang tải...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <ShoppingBag size={32} className="mb-2 opacity-40" />
            <p className="text-sm">{search ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm Shopee nào.'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
              {pageFiltered.map(product => (
                <ShopeeGridCard
                  key={product.pos_product_id}
                  product={product}
                  shops={shops}
                  shopMap={shopMap}
                  isSelected={gridPopupProduct?.pos_product_id === product.pos_product_id}
                  onClick={() => openGridPopup(product)}
                />
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-8" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sản phẩm</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nhóm hàng</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Shop</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {pageFiltered.map(product => {
                const isExpanded = expandedIds.has(product.pos_product_id);

                // Deduplicate shops: mỗi shop_id chỉ hiện 1 chip, ghi nhận có bất kỳ entry nào đang bán không
                const shopChips = product.shopee_entries
                  .filter(e => e.shop_id)
                  .reduce<{ shop_id: string; listingCount: number; anyPublished: boolean }[]>((acc, e) => {
                    const existing = acc.find(a => a.shop_id === e.shop_id);
                    if (existing) {
                      existing.listingCount++;
                      if (e.is_published) existing.anyPublished = true;
                    } else {
                      acc.push({ shop_id: e.shop_id!, listingCount: 1, anyPublished: e.is_published });
                    }
                    return acc;
                  }, []);

                // Đếm unique pos_product_id thực sự (tránh đếm trùng qua nhiều listings)
                const uniqueSkuCount = new Set(
                  product.shopee_entries.flatMap(e => e.shopee_product_variants.map(v => v.pos_product_id))
                ).size;

                const publishedCount = shopChips.filter(c => c.anyPublished).length;

                return (
                  <React.Fragment key={product.pos_product_id}>
                    {/* ── Dòng sản phẩm cha ── */}
                    <tr
                      onClick={() => toggleProduct(product.pos_product_id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors group ${
                        isExpanded ? 'bg-orange-50/60 border-b-orange-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Mũi tên expand */}
                      <td className="px-3 py-3 text-center w-8">
                        <ChevronRight size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-orange-500' : ''}`} />
                      </td>

                      {/* Tên sản phẩm */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.shopee_entries[0]?.cover_image_url ? (
                            <img src={product.shopee_entries[0].cover_image_url} alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                              <ShoppingBag size={14} className="text-orange-300" />
                            </div>
                          )}
                          <span className={`font-semibold ${isExpanded ? 'text-orange-700' : 'text-slate-800'}`}>
                            {product.name}
                          </span>
                        </div>
                      </td>

                      {/* Nhóm hàng */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">
                          {product.group_name
                            ? (product.group_name.split('>').pop()?.trim() || product.group_name)
                            : <span className="text-slate-300">—</span>}
                        </span>
                      </td>

                      {/* Chips shop — deduplicated theo shop_id */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {shopChips.map(chip => {
                            const shop = shopMap.get(chip.shop_id);
                            const shopIdx = shops.findIndex(s => s.id === chip.shop_id);
                            const colors = shopColor(shopIdx >= 0 ? shopIdx : 0);
                            return (
                              <span key={chip.shop_id}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                  chip.anyPublished ? colors.badge : 'bg-slate-100 text-slate-400'
                                }`}>
                                <Store size={10} />
                                {shop?.name ?? chip.shop_id}
                              </span>
                            );
                          })}
                          {shopChips.length === 0 && (
                            <span className="text-xs text-slate-300">Chưa gán shop</span>
                          )}
                        </div>
                      </td>

                      {/* SKU count — unique pos_product_id */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-slate-600 font-medium">{uniqueSkuCount}</span>
                        <span className="text-xs text-slate-400 ml-1">SKU</span>
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3 text-center">
                        {shopChips.length === 0 ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : publishedCount === shopChips.length ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-orange-100 text-orange-700">
                            <Eye size={11} /> Đang bán
                          </span>
                        ) : publishedCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-500">
                            <EyeOff size={11} /> Đã ẩn
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-yellow-100 text-yellow-700">
                            <Eye size={11} /> {publishedCount}/{shopChips.length} shop
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* ── Tab bar shop (1 dòng, khi expanded) ── */}
                    {isExpanded && (
                      <ShopTabsRow
                        shops={shops}
                        entries={product.shopee_entries}
                        activeEntryId={activeEntryId}
                        colCount={COL_COUNT}
                        onSelect={toggleEntry}
                      />
                    )}

                    {/* ── Panel chi tiết shop đang chọn ── */}
                    {isExpanded && (() => {
                      const activeEntry = product.shopee_entries.find(e => e.id === activeEntryId);
                      if (!activeEntry) return null;
                      const entryIdx = shops.findIndex(s => s.id === activeEntry.shop_id);
                      const colorIdx = entryIdx >= 0 ? entryIdx
                        : product.shopee_entries.indexOf(activeEntry);
                      return (
                        <tr>
                          <td colSpan={COL_COUNT} className="p-0 border-b border-slate-100">
                            <ShopDetailPanel
                              key={activeEntry.id}
                              entry={activeEntry}
                              shops={shops}
                              colorIdx={colorIdx}
                              onSaved={loadProducts}
                              productName={product.name}
                            />
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <GoodsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={filtered.length}
        totalSkuItems={filtered.length}
        setCurrentPage={setCurrentPage}
        onItemsPerPageChange={n => { setItemsPerPage(n); setCurrentPage(1); }}
      />

      {/* Grid popup modal */}
      {gridPopupProduct && (() => {
        const activeEntry = gridPopupProduct.shopee_entries.find(e => e.id === gridActiveEntryId) ?? null;
        const entryIdx = activeEntry ? shops.findIndex(s => s.id === activeEntry.shop_id) : -1;
        const colorIdx = entryIdx >= 0 ? entryIdx
          : activeEntry ? gridPopupProduct.shopee_entries.indexOf(activeEntry) : 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={closeGridPopup}
          >
            <div
              className="relative w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{gridPopupProduct.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {gridPopupProduct.shopee_entries.length} shop · {new Set(gridPopupProduct.shopee_entries.flatMap(e => e.shopee_product_variants.map(v => v.pos_product_id))).size} SKU
                  </p>
                </div>
                <button onClick={closeGridPopup} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Shop entry selector — giống variant selector của Catalog */}
              {gridPopupProduct.shopee_entries.length > 0 && (
                <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {gridPopupProduct.shopee_entries.map((entry, idx) => {
                      const shop = shopMap.get(entry.shop_id ?? '');
                      const shopIdx = shops.findIndex(s => s.id === entry.shop_id);
                      const colors = shopColor(shopIdx >= 0 ? shopIdx : idx);
                      const isActive = gridActiveEntryId === entry.id;
                      const skuCount = entry.shopee_product_variants.length;
                      return (
                        <button
                          key={entry.id}
                          onClick={() => setGridActiveEntryId(entry.id)}
                          className={`flex items-center gap-2 shrink-0 rounded-xl border px-2.5 py-2 transition-colors ${
                            isActive
                              ? `${colors.border} ${colors.activeBg} shadow-sm`
                              : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                            {entry.cover_image_url ? (
                              <img src={entry.cover_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-4 h-4 text-slate-300" strokeWidth={1} />
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <p className={`text-2xs font-normal truncate max-w-[120px] ${isActive ? 'text-orange-700' : 'text-slate-700'}`}>
                              {shop?.name ?? `Shop ${idx + 1}`}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${entry.is_published ? colors.dot : 'bg-slate-300'}`} />
                              <span className="text-[9px] font-normal text-slate-400">
                                {skuCount} SKU
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ShopDetailPanel cho entry đang chọn */}
              <div className="flex-1 min-h-0 overflow-auto">
                {activeEntry ? (
                  <ShopDetailPanel
                    key={activeEntry.id}
                    entry={activeEntry}
                    shops={shops}
                    colorIdx={colorIdx}
                    onSaved={() => { loadProducts(); }}
                    productName={gridPopupProduct.name}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <Store size={32} className="mb-2" />
                    <p className="text-sm">Chọn shop để xem chi tiết</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Grid card cho Shopee ────────────────────────────────────────────────────

const ShopeeGridCard = memo(function ShopeeGridCard({
  product, shops, shopMap, isSelected, onClick,
}: {
  product: CatalogProduct;
  shops: ShopeeShop[];
  shopMap: Map<string, ShopeeShop>;
  isSelected: boolean;
  onClick: () => void;
}) {
  const coverImage = product.shopee_entries[0]?.cover_image_url ?? null;

  const shopChips = product.shopee_entries
    .filter(e => e.shop_id)
    .reduce<{ shop_id: string; anyPublished: boolean }[]>((acc, e) => {
      const existing = acc.find(a => a.shop_id === e.shop_id);
      if (existing) { if (e.is_published) existing.anyPublished = true; }
      else acc.push({ shop_id: e.shop_id!, anyPublished: e.is_published });
      return acc;
    }, []);

  const publishedCount = shopChips.filter(c => c.anyPublished).length;
  const uniqueSkuCount = new Set(
    product.shopee_entries.flatMap(e => e.shopee_product_variants.map(v => v.pos_product_id))
  ).size;

  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-2xl border transition-all active:scale-[0.98] overflow-hidden group flex flex-col text-left ${
        isSelected
          ? 'border-orange-300 shadow-md shadow-orange-100'
          : 'border-slate-100 hover:border-orange-200 hover:shadow-md shadow-sm'
      }`}
    >
      {/* Ảnh bìa */}
      <div className="bg-slate-100/60 relative w-full aspect-square flex-shrink-0 flex items-center justify-center overflow-hidden">
        {coverImage ? (
          <img src={coverImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <ShoppingBag className="h-10 w-10 text-slate-300" strokeWidth={1} />
        )}
        {/* Trạng thái badge */}
        {shopChips.length > 0 && (
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-medium shadow-sm ${
            publishedCount === shopChips.length
              ? 'bg-orange-500 text-white'
              : publishedCount === 0
                ? 'bg-slate-200 text-slate-500'
                : 'bg-yellow-400 text-white'
          }`}>
            {publishedCount === shopChips.length ? 'Đang bán' : publishedCount === 0 ? 'Đã ẩn' : `${publishedCount}/${shopChips.length}`}
          </div>
        )}
        {uniqueSkuCount > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-white/90 text-slate-600 text-[9px] font-normal rounded-full shadow-sm border border-slate-100">
            {uniqueSkuCount} SKU
          </div>
        )}
      </div>

      {/* Thông tin */}
      <div className="px-2.5 py-2 flex flex-col gap-1 flex-1">
        <p className="text-xs font-normal text-slate-800 line-clamp-2 leading-tight group-hover:text-orange-600 transition-colors text-center">
          {product.name}
        </p>
        {/* Shop chips */}
        {shopChips.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-auto pt-1 justify-center">
            {shopChips.map((chip, idx) => {
              const shop = shopMap.get(chip.shop_id);
              const shopIdx = shops.findIndex(s => s.id === chip.shop_id);
              const colors = shopColor(shopIdx >= 0 ? shopIdx : idx);
              return (
                <span key={chip.shop_id}
                  className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    chip.anyPublished ? colors.badge : 'bg-slate-100 text-slate-400'
                  }`}>
                  <Store size={8} />
                  {shop?.name ?? `Shop ${idx + 1}`}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
});
