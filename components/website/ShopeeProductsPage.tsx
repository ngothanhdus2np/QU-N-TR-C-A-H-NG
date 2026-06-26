import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, X, Check, RefreshCw, ExternalLink,
  Eye, EyeOff, ChevronRight, Save, Loader2, Package, ShoppingBag, Store,
  Image as ImageIcon, Video, Edit2, Download,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../ui/Toast';

interface ShopeeShop { id: string; name: string; slug: string; }

interface ShopeeVariant {
  id: string; sku: string; size: string | null; color_name: string | null;
  shopee_price_override: number | null; pos_product_id: string;
  is_published: boolean; display_order: number;
}

interface ShopEntry {
  id: string;
  shop_id: string | null;
  shopee_item_id: string | null;
  is_published: boolean;
  cover_image_url: string | null;
  display_order: number;
  shopee_product_variants: ShopeeVariant[];
}

interface CatalogProduct {
  pos_product_id: string;
  name: string;
  shopee_entries: ShopEntry[];
}

interface PosProduct { id: string; sku: string; name: string; sale_price: number; stock: number; }

interface VariantDraft {
  pos_product_id: string; sku: string; size: string; color_name: string; shopee_price_override: string;
}

interface EditForm {
  // ẩn — giữ để save vẫn hoạt động
  cover_image_url: string; shopee_item_id: string; shop_id: string;
  is_published: boolean; display_order: number;
  // hiển thị
  product_name: string;       // tên sản phẩm Shopee (tối đa 120 ký tự)
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
    product_name: productName,
    other_images: [],
    category: '',
    variantDrafts: [...entry.shopee_product_variants]
      .sort((a, b) => a.display_order - b.display_order)
      .map(v => ({
        pos_product_id: v.pos_product_id,
        sku: v.sku,
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
    if (drafts.some(v => v.pos_product_id === pos.id)) return;
    onChange([...drafts, { pos_product_id: pos.id, sku: pos.sku, size: '', color_name: '', shopee_price_override: '' }]);
    clearSearch();
  };
  const removeVariant = (posId: string) => onChange(drafts.filter(v => v.pos_product_id !== posId));
  const updateVariant = (posId: string, field: keyof Omit<VariantDraft, 'pos_product_id' | 'sku'>, value: string) =>
    onChange(drafts.map(v => v.pos_product_id === posId ? { ...v, [field]: value } : v));

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
                <th className="text-left px-3 py-2 font-medium text-slate-500">Size</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Màu</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Giá Shopee</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {drafts.map(v => (
                <tr key={v.pos_product_id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 text-slate-700 font-medium">{v.sku}</td>
                  <td className="px-3 py-2">
                    <input value={v.size} onChange={e => updateVariant(v.pos_product_id, 'size', e.target.value)}
                      placeholder="40" className="w-14 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={v.color_name} onChange={e => updateVariant(v.pos_product_id, 'color_name', e.target.value)}
                      placeholder="Đen" className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={v.shopee_price_override}
                      onChange={e => updateVariant(v.pos_product_id, 'shopee_price_override', e.target.value)}
                      placeholder="Giá POS" className="w-24 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => removeVariant(v.pos_product_id)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5">
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
    if (!form.shopee_item_id) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/shopee-sync', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopIdx: colorIdx,
          itemId: form.shopee_item_id,
          shopeeProductId: entry.id,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Bot không phản hồi');

      // Cập nhật form với data vừa lấy về từ Shopee
      const patch: Partial<EditForm> = {};
      if (json.coverImage)         patch.cover_image_url = json.coverImage;
      if (json.name)               patch.product_name    = json.name;
      if (json.gallery?.length)    patch.other_images    = json.gallery.slice(0, 6);
      if (Object.keys(patch).length) { setF(patch); }

      showToast(`Sync xong — lấy được ${json.totalImages ?? 0} ảnh`, 'success');
      onSaved(); // refresh danh sách (thumbnail)
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
            disabled={syncing || !form.shopee_item_id}
            title={!form.shopee_item_id ? 'Cần điền Item ID trước' : 'Lấy ảnh & tên từ Shopee Seller Center'}
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
          <div className="max-w-3xl space-y-8">

            {/* ── Hình ảnh sản phẩm ── */}
            <section>
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Hình ảnh sản phẩm</h3>
              <div className="flex items-start gap-4">

                {/* Ảnh bìa — tối đa 1 */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">Ảnh bìa</span>
                  <div className="relative group w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-orange-400 hover:bg-orange-50/30 transition-colors overflow-hidden cursor-pointer"
                    onClick={() => document.getElementById('cover-upload')?.click()}>
                    {form.cover_image_url ? (
                      <>
                        <img src={form.cover_image_url} alt="ảnh bìa" className="w-full h-full object-cover" />
                        <button
                          onClick={e => { e.stopPropagation(); setF({ cover_image_url: '' }); }}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X size={10} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-orange-500/90 text-white text-[9px] text-center py-0.5 font-medium">★ Ảnh bìa</div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full gap-1">
                        <ImageIcon size={22} className="text-slate-300" />
                        <span className="text-[10px] text-slate-400 text-center px-2">Bấm để tải lên</span>
                      </div>
                    )}
                  </div>
                  <input id="cover-upload" type="file" accept="image/*" className="sr-only"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = URL.createObjectURL(file);
                      setF({ cover_image_url: url });
                      e.target.value = '';
                    }} />
                  <span className="text-[10px] text-slate-400">1 ảnh</span>
                </div>

                {/* Ảnh thường — tối đa 6 */}
                <div className="flex flex-col gap-1.5 flex-1">
                  <span className="text-xs text-slate-500 font-medium">Hình ảnh <span className="text-slate-300">({form.other_images.length}/6)</span></span>
                  <div className="flex flex-nowrap gap-2 p-3 h-[116px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-orange-300 transition-colors overflow-x-auto">
                    {form.other_images.map((url, idx) => (
                      <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setF({ other_images: form.other_images.filter((_, i) => i !== idx) })}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {form.other_images.length < 6 && (
                      <button
                        onClick={() => document.getElementById('images-upload')?.click()}
                        className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/30 transition-colors flex flex-col items-center justify-center gap-1 shrink-0"
                      >
                        <ImageIcon size={20} className="text-slate-300" />
                        <span className="text-[10px] text-slate-400">Thêm ảnh</span>
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
                  <span className="text-[10px] text-slate-400">Tối đa 6 ảnh</span>
                </div>

              </div>
            </section>

            {/* ── Video sản phẩm ── */}
            <section>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Video sản phẩm</h3>
              <div className="flex items-start gap-4 p-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 w-fit">
                <div className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-orange-300 rounded-lg bg-white cursor-pointer hover:bg-orange-50/30 transition-colors shrink-0">
                  <Video size={20} className="text-orange-400 mb-1" />
                  <span className="text-[9px] text-orange-500 font-medium">Thêm video</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-0.5 mt-1">
                  <li>Size: Max 30MB, resolution should not less than 1x1px</li>
                  <li>Độ dài: 10s–60s</li>
                  <li>Định dạng: MP4</li>
                  <li className="text-slate-300">Lưu ý: sản phẩm có thể hiển thị trong khi video đang được xử lý.</li>
                </ul>
              </div>
            </section>

            {/* ── Tên sản phẩm ── */}
            <section>
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
            </section>

            {/* ── Ngành hàng ── */}
            <section>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                <span className="text-red-500 mr-1">*</span>Ngành hàng
              </label>
              <div className="flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-lg bg-white">
                <span className={`text-sm ${form.category ? 'text-slate-700' : 'text-slate-300'}`}>
                  {form.category || 'Chưa chọn ngành hàng'}
                </span>
                <button
                  onClick={() => {
                    const val = window.prompt('Nhập ngành hàng:', form.category);
                    if (val !== null) setF({ category: val });
                  }}
                  className="text-slate-400 hover:text-orange-500 transition-colors ml-2"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            </section>

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

  // set chứa pos_product_id đang expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // entry đang mở detail panel (shopee_product_id)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

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

  const shopMap = new Map(shops.map(s => [s.id, s]));

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.shopee_entries.some(e => (e.shopee_item_id ?? '').includes(search))
  );

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
  const COL_COUNT = 5;

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
        </div>
      </div>

      {/* Table */}
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
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-8" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sản phẩm</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Shop</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const isExpanded = expandedIds.has(product.pos_product_id);
                const publishedCount = product.shopee_entries.filter(e => e.is_published).length;
                const totalVariants = product.shopee_entries.reduce((s, e) => s + e.shopee_product_variants.length, 0);

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

                      {/* Chips shop tóm tắt */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {product.shopee_entries
                            .filter(e => e.shop_id)
                            .map((entry) => {
                              const shop = shopMap.get(entry.shop_id!);
                              const shopIdx = shops.findIndex(s => s.id === entry.shop_id);
                              const colors = shopColor(shopIdx >= 0 ? shopIdx : 0);
                              return (
                                <span key={entry.id}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                    entry.is_published ? colors.badge : 'bg-slate-100 text-slate-400'
                                  }`}>
                                  <Store size={10} />
                                  {shop?.name ?? entry.shop_id}
                                </span>
                              );
                            })}
                          {product.shopee_entries.every(e => !e.shop_id) && (
                            <span className="text-xs text-slate-300">Chưa gán shop</span>
                          )}
                        </div>
                      </td>

                      {/* SKU count */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-slate-600 font-medium">{totalVariants}</span>
                        <span className="text-xs text-slate-400 ml-1">SKU</span>
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3 text-center">
                        {product.shopee_entries.length === 0 ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : publishedCount === product.shopee_entries.length ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-orange-100 text-orange-700">
                            <Eye size={11} /> Đang bán
                          </span>
                        ) : publishedCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-500">
                            <EyeOff size={11} /> Đã ẩn
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-yellow-100 text-yellow-700">
                            <Eye size={11} /> {publishedCount}/{product.shopee_entries.length} shop
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
    </div>
  );
}
