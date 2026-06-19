import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, X, Check, RefreshCw, Globe, ExternalLink,
  Eye, EyeOff, ChevronRight, Save, Loader2, Package, ImageIcon,
  Tag, Link2,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../ui/Toast';

interface Props {
  navigationSlot?: React.ReactNode;
}

interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  is_published: boolean;
  display_order: number;
  store_product_variants: StoreVariant[];
}

interface StoreVariant {
  id: string;
  sku: string;
  size: string | null;
  color_name: string | null;
  pos_product_id: string;
  is_published: boolean;
  display_order: number;
  website_price_override: number | null;
}

interface PosProduct {
  id: string;
  sku: string;
  name: string;
  sale_price: number;
  stock: number;
}

interface VariantDraft {
  pos_product_id: string;
  sku: string;
  size: string;
  color_name: string;
  website_price_override: string;
}

type DetailTab = 'info' | 'media' | 'labels' | 'variants';

interface EditForm {
  name: string;
  slug: string;
  short_description: string;
  cover_image_url: string;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  is_published: boolean;
  display_order: number;
  variantDrafts: VariantDraft[];
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function makeEditForm(p: StoreProduct): EditForm {
  return {
    name: p.name,
    slug: p.slug,
    short_description: p.short_description ?? '',
    cover_image_url: p.cover_image_url ?? '',
    is_featured: p.is_featured,
    is_new: p.is_new,
    is_best_seller: p.is_best_seller,
    is_published: p.is_published,
    display_order: p.display_order,
    variantDrafts: p.store_product_variants
      .sort((a, b) => a.display_order - b.display_order)
      .map(v => ({
        pos_product_id: v.pos_product_id,
        sku: v.sku,
        size: v.size ?? '',
        color_name: v.color_name ?? '',
        website_price_override: v.website_price_override != null ? String(v.website_price_override) : '',
      })),
  };
}

const EMPTY_FORM: EditForm = {
  name: '', slug: '', short_description: '', cover_image_url: '',
  is_featured: false, is_new: false, is_best_seller: false,
  is_published: false, display_order: 0, variantDrafts: [],
};

const TAB_ITEMS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
  { id: 'info', label: 'Thông tin', icon: Package },
  { id: 'media', label: 'Ảnh & Mô tả', icon: ImageIcon },
  { id: 'labels', label: 'Nhãn', icon: Tag },
  { id: 'variants', label: 'SKU liên kết', icon: Link2 },
];

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

  const clearSearch = useCallback((_unused?: string) => {
    setSkuSearch('');
    setSkuResults([]);
  }, []);

  return { skuSearch, skuResults, skuLoading, searchSku, clearSearch };
}

// ─── Variants editor ──────────────────────────────────────────────────────────
function VariantsEditor({
  drafts,
  onChange,
}: {
  drafts: VariantDraft[];
  onChange: (drafts: VariantDraft[]) => void;
}) {
  const { skuSearch, skuResults, skuLoading, searchSku, clearSearch } = useSkuSearch();

  const addVariant = (pos: PosProduct) => {
    if (drafts.some(v => v.pos_product_id === pos.id)) return;
    onChange([...drafts, {
      pos_product_id: pos.id, sku: pos.sku,
      size: '', color_name: '', website_price_override: '',
    }]);
    clearSearch();
  };

  const removeVariant = (posId: string) =>
    onChange(drafts.filter(v => v.pos_product_id !== posId));

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
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(skuResults.length > 0 || skuLoading) && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {skuLoading ? (
              <div className="p-3 text-sm text-slate-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Đang tìm...
              </div>
            ) : (
              skuResults.map(pos => {
                const already = drafts.some(v => v.pos_product_id === pos.id);
                return (
                  <button
                    key={pos.id}
                    onClick={() => addVariant(pos)}
                    disabled={already}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {already && <Check size={13} className="text-green-500" />}
                      <span className="font-medium text-slate-700">{pos.sku}</span>
                      <span className="text-slate-500 truncate max-w-[140px]">{pos.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{pos.stock} tồn</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {drafts.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
          Chưa có SKU nào được liên kết. Tìm và thêm ở trên.
        </p>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2 font-medium text-slate-500">SKU</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Size</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Màu</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Giá web (để trống = lấy giá POS)</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {drafts.map(v => (
                <tr key={v.pos_product_id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 text-slate-700 font-medium">{v.sku}</td>
                  <td className="px-3 py-2">
                    <input
                      value={v.size}
                      onChange={e => updateVariant(v.pos_product_id, 'size', e.target.value)}
                      placeholder="40"
                      className="w-14 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={v.color_name}
                      onChange={e => updateVariant(v.pos_product_id, 'color_name', e.target.value)}
                      placeholder="Đen"
                      className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={v.website_price_override}
                      onChange={e => updateVariant(v.pos_product_id, 'website_price_override', e.target.value)}
                      placeholder="0"
                      className="w-24 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => removeVariant(v.pos_product_id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                    >
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

// ─── Inline detail panel ──────────────────────────────────────────────────────
function DetailPanel({
  product,
  onClose,
  onSaved,
}: {
  product: StoreProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<DetailTab>('info');
  const [form, setForm] = useState<EditForm>(() => makeEditForm(product));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const setF = (patch: Partial<EditForm>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Nhập tên sản phẩm', 'error'); setTab('info'); return; }
    if (!form.slug.trim()) { showToast('Nhập slug URL', 'error'); setTab('info'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('store_products').update({
        name: form.name,
        slug: form.slug,
        short_description: form.short_description || null,
        cover_image_url: form.cover_image_url || null,
        is_featured: form.is_featured,
        is_new: form.is_new,
        is_best_seller: form.is_best_seller,
        is_published: form.is_published,
        display_order: form.display_order,
        updated_at: new Date().toISOString(),
      }).eq('id', product.id);
      if (error) throw error;

      await supabase.from('store_product_variants').delete().eq('store_product_id', product.id);
      if (form.variantDrafts.length > 0) {
        const { error: varErr } = await supabase.from('store_product_variants').insert(
          form.variantDrafts.map((v, i) => ({
            store_product_id: product.id,
            pos_product_id: v.pos_product_id,
            sku: v.sku,
            size: v.size || null,
            color_name: v.color_name || null,
            website_price_override: v.website_price_override ? Number(v.website_price_override) : null,
            is_published: true,
            display_order: i,
          }))
        );
        if (varErr) throw varErr;
      }

      showToast('Đã cập nhật sản phẩm', 'success');
      setDirty(false);
      onSaved();
    } catch (err: unknown) {
      showToast('Lỗi lưu: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-50 border-t border-blue-100">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className="text-blue-400" />
          <span className="text-sm font-medium text-blue-800 truncate max-w-[280px]">{product.name}</span>
          {dirty && <span className="text-[10px] text-orange-500 font-medium bg-orange-50 px-1.5 py-0.5 rounded">Chưa lưu</span>}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://phucsang.com.vn/${product.slug}.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            <ExternalLink size={12} />
            Xem web
          </a>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-default text-white rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Lưu thay đổi
          </button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-slate-200 bg-white px-4">
        {TAB_ITEMS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon size={13} />
              {t.label}
              {t.id === 'variants' && (
                <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                  {form.variantDrafts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'info' && (
          <div className="grid grid-cols-2 gap-3 max-w-xl">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tên sản phẩm <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={e => {
                  const name = e.target.value;
                  setF({ name });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Slug URL <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 shrink-0">phucsang.com.vn/</span>
                <input
                  value={form.slug}
                  onChange={e => setF({ slug: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400 shrink-0">.html</span>
              </div>
              <button
                onClick={() => setF({ slug: slugify(form.name) })}
                className="mt-1 text-xs text-blue-500 hover:underline"
              >
                Tự tạo từ tên →
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Thứ tự hiển thị</label>
              <input
                type="number"
                value={form.display_order}
                onChange={e => setF({ display_order: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={e => setF({ is_published: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Hiển thị trên website</span>
              </label>
            </div>
          </div>
        )}

        {tab === 'media' && (
          <div className="space-y-3 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL ảnh bìa</label>
              <input
                value={form.cover_image_url}
                onChange={e => setF({ cover_image_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.cover_image_url && (
                <img
                  src={form.cover_image_url}
                  alt="preview"
                  className="mt-2 h-24 w-24 object-cover rounded-lg border border-slate-200"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả ngắn</label>
              <textarea
                value={form.short_description}
                onChange={e => setF({ short_description: e.target.value })}
                placeholder="Mô tả 1-2 câu hiển thị trên trang danh sách"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {tab === 'labels' && (
          <div className="space-y-3 max-w-sm">
            <p className="text-xs text-slate-500">Nhãn hiển thị trên trang sản phẩm và danh sách.</p>
            {([
              { key: 'is_featured' as const, label: 'Nổi bật', color: 'text-blue-700 bg-blue-100' },
              { key: 'is_new' as const, label: 'Mới', color: 'text-green-700 bg-green-100' },
              { key: 'is_best_seller' as const, label: 'Best Seller', color: 'text-amber-700 bg-amber-100' },
            ]).map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => setF({ [key]: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                  <span className="text-sm text-slate-600">
                    {key === 'is_featured' && 'Hiển thị trong khu vực nổi bật'}
                    {key === 'is_new' && 'Gắn nhãn "Mới" trên sản phẩm'}
                    {key === 'is_best_seller' && 'Gắn nhãn "Best Seller"'}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}

        {tab === 'variants' && (
          <div className="max-w-2xl">
            <VariantsEditor
              drafts={form.variantDrafts}
              onChange={drafts => setF({ variantDrafts: drafts })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────
function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState<EditForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<DetailTab>('info');

  const setF = (patch: Partial<EditForm>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Nhập tên sản phẩm', 'error'); setTab('info'); return; }
    if (!form.slug.trim()) { showToast('Nhập slug URL', 'error'); setTab('info'); return; }
    if (form.variantDrafts.length === 0) { showToast('Thêm ít nhất 1 SKU liên kết', 'error'); setTab('variants'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('store_products').insert({
        name: form.name,
        slug: form.slug,
        short_description: form.short_description || null,
        cover_image_url: form.cover_image_url || null,
        is_featured: form.is_featured,
        is_new: form.is_new,
        is_best_seller: form.is_best_seller,
        is_published: form.is_published,
        display_order: form.display_order,
      }).select('id').single();
      if (error) throw error;
      const productId = data.id;

      const { error: varErr } = await supabase.from('store_product_variants').insert(
        form.variantDrafts.map((v, i) => ({
          store_product_id: productId,
          pos_product_id: v.pos_product_id,
          sku: v.sku,
          size: v.size || null,
          color_name: v.color_name || null,
          website_price_override: v.website_price_override ? Number(v.website_price_override) : null,
          is_published: true,
          display_order: i,
        }))
      );
      if (varErr) throw varErr;

      showToast('Đã tạo sản phẩm website', 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      showToast('Lỗi: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Thêm sản phẩm website</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={17} />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-5 shrink-0">
          {TAB_ITEMS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={12} />
                {t.label}
                {t.id === 'variants' && form.variantDrafts.length > 0 && (
                  <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                    {form.variantDrafts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'info' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tên sản phẩm <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value;
                    setF({ name, slug: slugify(name) });
                  }}
                  placeholder="VD: Dép Thể Thao Nam PS001"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Slug URL <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 shrink-0">phucsang.com.vn/</span>
                  <input
                    value={form.slug}
                    onChange={e => setF({ slug: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-400 shrink-0">.html</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={e => setF({ display_order: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={e => setF({ is_published: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Hiển thị ngay trên website</span>
              </label>
            </div>
          )}
          {tab === 'media' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">URL ảnh bìa</label>
                <input
                  value={form.cover_image_url}
                  onChange={e => setF({ cover_image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả ngắn</label>
                <textarea
                  value={form.short_description}
                  onChange={e => setF({ short_description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}
          {tab === 'labels' && (
            <div className="space-y-2">
              {([
                { key: 'is_featured' as const, label: 'Nổi bật' },
                { key: 'is_new' as const, label: 'Mới' },
                { key: 'is_best_seller' as const, label: 'Best Seller' },
              ]).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => setF({ [key]: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          )}
          {tab === 'variants' && (
            <VariantsEditor
              drafts={form.variantDrafts}
              onChange={drafts => setF({ variantDrafts: drafts })}
            />
          )}
        </div>

        <div className="shrink-0 px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? 'Đang tạo...' : 'Tạo sản phẩm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WebsiteProductsPage({ navigationSlot }: Props) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('store_products')
      .select(`
        id, name, slug, short_description, cover_image_url,
        is_featured, is_new, is_best_seller, is_published, display_order,
        store_product_variants (
          id, sku, size, color_name, pos_product_id, is_published, display_order, website_price_override
        )
      `)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    if (error) {
      showToast('Lỗi tải danh sách sản phẩm', 'error');
    } else {
      setProducts((data as StoreProduct[]) ?? []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const togglePublish = async (product: StoreProduct) => {
    const { error } = await supabase
      .from('store_products')
      .update({ is_published: !product.is_published, updated_at: new Date().toISOString() })
      .eq('id', product.id);
    if (error) {
      showToast('Lỗi cập nhật trạng thái', 'error');
    } else {
      showToast(product.is_published ? 'Đã ẩn khỏi website' : 'Đã xuất bản lên website', 'success');
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_published: !p.is_published } : p));
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = selectedId ? products.find(p => p.id === selectedId) ?? null : null;

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10">
      {/* Sidebar */}
      <aside className="flex h-full min-h-0 flex-col gap-4">
        {navigationSlot}
      </aside>

      {/* Main */}
      <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedId(null); }}
              placeholder="Tìm tên hoặc slug..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {products.length} sản phẩm · {products.filter(p => p.is_published).length} đang hiển thị
            </span>
            <button onClick={loadProducts} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Tải lại">
              <RefreshCw size={15} />
            </button>
            <a
              href="https://phucsang.com.vn/products.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
            >
              <Globe size={13} />
              Xem web
              <ExternalLink size={11} />
            </a>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} />
              Thêm sản phẩm
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
              <Globe size={32} className="mb-2 opacity-40" />
              <p className="text-sm">{search ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm website nào.'}</p>
              {!search && (
                <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-blue-500 hover:underline">
                  Thêm sản phẩm đầu tiên →
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sản phẩm</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Slug</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nhãn</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => {
                  const isSelected = selectedId === product.id;
                  return (
                    <React.Fragment key={product.id}>
                      <tr
                        onClick={() => setSelectedId(prev => prev === product.id ? null : product.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border-b-blue-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <ChevronRight
                            size={14}
                            className={`text-slate-400 transition-transform ${isSelected ? 'rotate-90 text-blue-500' : ''}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.cover_image_url ? (
                              <img src={product.cover_image_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <Globe size={14} className="text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className={`font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                                {product.name}
                              </p>
                              {product.short_description && (
                                <p className="text-xs text-slate-400 truncate max-w-[200px]">{product.short_description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-500">{product.slug}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-slate-600 font-medium">{product.store_product_variants.length}</span>
                          <span className="text-xs text-slate-400 ml-1">SKU</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {product.is_best_seller && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Best Seller</span>}
                            {product.is_new && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Mới</span>}
                            {product.is_featured && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Nổi bật</span>}
                            {!product.is_best_seller && !product.is_new && !product.is_featured && (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => togglePublish(product)}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
                              product.is_published
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {product.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                            {product.is_published ? 'Hiển thị' : 'Đang ẩn'}
                          </button>
                        </td>
                      </tr>

                      {isSelected && selectedProduct && (
                        <tr>
                          <td colSpan={6} className="p-0 border-b border-blue-100">
                            <DetailPanel
                              key={product.id}
                              product={selectedProduct}
                              onClose={() => setSelectedId(null)}
                              onSaved={loadProducts}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSaved={loadProducts} />
      )}
    </div>
  );
}
