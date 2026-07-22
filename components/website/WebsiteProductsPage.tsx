import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { POSProduct } from '../../types';
import { useProductSearchIndex } from '../pos/useProductSearchIndex';
import {
  Plus, Search, X, Check, RefreshCw, Globe, ExternalLink,
  Eye, EyeOff, ChevronRight, ChevronUp, ChevronDown, Save, Loader2, Package, ImageIcon,
  Tag, Link2, FileText, SearchIcon, LayoutGrid, List,
} from 'lucide-react';
import { translateError } from '../../services/errorMessages';
import { adminStoreRequest } from '../../services/adminStoreApi';
import { useToast } from '../ui/Toast';
import { GoodsPagination } from '../pos/GoodsPagination';

interface Props {
  navigationSlot?: React.ReactNode;
  posProducts?: POSProduct[];
}

interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  material: string | null;
  sole_material: string | null;
  origin: string | null;
  care_instructions: string | null;
  size_guide: string | null;
  cover_image_url: string | null;
  gallery: string[] | null;
  video_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
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
  color_hex: string | null;
  compare_at_price: number | null;
  pos_product_id: string;
  is_published: boolean;
  display_order: number;
  website_price_override: number | null;
}

interface VariantDraft {
  pos_product_id: string;
  sku: string;
  size: string;
  color_name: string;
  color_hex: string;
  compare_at_price: string;
  website_price_override: string;
}

type DetailTab = 'info' | 'media' | 'detail' | 'labels' | 'variants' | 'seo';

interface EditForm {
  name: string;
  slug: string;
  short_description: string;
  description: string;
  material: string;
  sole_material: string;
  origin: string;
  care_instructions: string;
  size_guide: string;
  cover_image_url: string;
  gallery: string[];
  video_url: string;
  seo_title: string;
  seo_description: string;
  og_image_url: string;
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
    description: p.description ?? '',
    material: p.material ?? '',
    sole_material: p.sole_material ?? '',
    origin: p.origin ?? '',
    care_instructions: p.care_instructions ?? '',
    size_guide: p.size_guide ?? '',
    cover_image_url: p.cover_image_url ?? '',
    gallery: Array.isArray(p.gallery) ? p.gallery : [],
    video_url: p.video_url ?? '',
    seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '',
    og_image_url: p.og_image_url ?? '',
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
        color_hex: v.color_hex ?? '',
        compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : '',
        website_price_override: v.website_price_override != null ? String(v.website_price_override) : '',
      })),
  };
}

const EMPTY_FORM: EditForm = {
  name: '', slug: '', short_description: '', description: '',
  material: '', sole_material: '', origin: '', care_instructions: '', size_guide: '',
  cover_image_url: '', gallery: [], video_url: '',
  seo_title: '', seo_description: '', og_image_url: '',
  is_featured: false, is_new: false, is_best_seller: false,
  is_published: false, display_order: 0, variantDrafts: [],
};

const TAB_ITEMS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
  { id: 'info', label: 'Thông tin', icon: Package },
  { id: 'media', label: 'Ảnh & Media', icon: ImageIcon },
  { id: 'detail', label: 'Chi tiết', icon: FileText },
  { id: 'labels', label: 'Nhãn', icon: Tag },
  { id: 'variants', label: 'SKU liên kết', icon: Link2 },
  { id: 'seo', label: 'SEO', icon: SearchIcon },
];

async function uploadMediaFile(file: File): Promise<string> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const result = await adminStoreRequest<{ url: string }>('/api/admin/store/media', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64, altText: '' }),
  });
  return result.url;
}

function MediaUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [altText, setAltText] = useState('');
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const result = await adminStoreRequest<{ url: string }>('/api/admin/store/media', {
        method: 'POST', body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64, altText }),
      });
      onUploaded(result.url); setAltText('');
    } catch (error) { alert(translateError(error, 'Không thể upload ảnh')); }
    finally { setUploading(false); }
  };
  return <div className="mt-2 flex flex-wrap items-center gap-2"><input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Alt text ảnh" className="w-40 rounded border border-slate-200 px-2 py-1.5 text-xs"/><label className="cursor-pointer rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"><input type="file" accept="image/webp,image/jpeg,image/png,image/avif" className="hidden" disabled={uploading} onChange={e => upload(e.target.files?.[0])}/>{uploading ? 'Đang upload…' : 'Upload store-media'}</label></div>;
}

// ─── Variants editor ──────────────────────────────────────────────────────────
// Tìm mã hàng giống ô tìm kiếm ở máy tính tiền (POS): client-side, theo tên/SKU,
// không dấu (useProductSearchIndex), hiện ảnh + tồn kho để chọn nhanh.
const parseSizeFromSku = (sku: string): string => {
  const m = /-(\d{2,3})$/.exec(sku || '');
  return m ? m[1] : '';
};

function VariantsEditor({
  drafts,
  onChange,
  posProducts,
}: {
  drafts: VariantDraft[];
  onChange: (drafts: VariantDraft[]) => void;
  posProducts: POSProduct[];
}) {
  const [skuSearch, setSkuSearch] = useState('');
  const searchable = useMemo(
    () => posProducts.filter(p => p.status === 'Active' && !p.isParent),
    [posProducts],
  );
  const { searchProducts } = useProductSearchIndex(searchable);
  const skuResults = useMemo(
    () => (skuSearch.trim().length >= 2 ? searchProducts(skuSearch).slice(0, 20) : []),
    [skuSearch, searchProducts],
  );
  const skuLoading = false;
  const searchSku = setSkuSearch;
  const clearSearch = useCallback(() => setSkuSearch(''), []);

  const addVariant = (pos: POSProduct) => {
    if (drafts.some(v => v.pos_product_id === pos.id)) return;
    onChange([...drafts, {
      pos_product_id: pos.id, sku: pos.sku,
      size: parseSizeFromSku(pos.sku), color_name: '', color_hex: '', compare_at_price: '', website_price_override: '',
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
                    <div className="flex items-center gap-2 min-w-0">
                      {already && <Check size={13} className="text-green-500 shrink-0" />}
                      {pos.images?.[0]
                        ? <img src={pos.images[0]} alt="" className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0" />
                        : <span className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"><ImageIcon size={13} className="text-slate-300" /></span>}
                      <span className="font-medium text-slate-700 shrink-0">{pos.sku}</span>
                      <span className="text-slate-500 truncate">{pos.name}</span>
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
                <th className="text-left px-3 py-2 font-medium text-slate-500">Tên màu</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Mã màu HEX</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Giá gốc</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Giá web</th>
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
                    <div className="flex items-center gap-1.5">
                      {v.color_hex && (
                        <span
                          className="w-4 h-4 rounded-full border border-slate-200 shrink-0"
                          style={{ backgroundColor: v.color_hex }}
                        />
                      )}
                      <input
                        value={v.color_hex}
                        onChange={e => updateVariant(v.pos_product_id, 'color_hex', e.target.value)}
                        placeholder="#000000"
                        className="w-24 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={v.compare_at_price}
                      onChange={e => updateVariant(v.pos_product_id, 'compare_at_price', e.target.value)}
                      placeholder="Giá gốc"
                      className="w-24 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={v.website_price_override}
                      onChange={e => updateVariant(v.pos_product_id, 'website_price_override', e.target.value)}
                      placeholder="Giá POS"
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
  posProducts,
}: {
  product: StoreProduct;
  onClose: () => void;
  onSaved: () => void;
  posProducts: POSProduct[];
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<DetailTab>('info');
  const [form, setForm] = useState<EditForm>(() => makeEditForm(product));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const setF = (patch: Partial<EditForm>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Nhập tên sản phẩm', 'error'); setTab('info'); return; }
    if (!form.slug.trim()) { showToast('Nhập slug URL', 'error'); setTab('info'); return; }
    setSaving(true);
    try {
      await adminStoreRequest(`/api/admin/store/products/${product.id}`, {
        method: 'PATCH', body: JSON.stringify({ ...form, variants: form.variantDrafts }),
      });

      showToast('Đã cập nhật sản phẩm', 'success');
      setDirty(false);
      onSaved();
    } catch (err: unknown) {
      showToast(translateError(err, 'Không lưu được sản phẩm'), 'error');
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
          <span className="text-sm font-medium text-blue-800">phucsang.com.vn</span>
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
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả ngắn</label>
              <textarea
                value={form.short_description}
                onChange={e => setF({ short_description: e.target.value })}
                placeholder="1-2 câu hiển thị trên trang danh sách"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ảnh bìa (URL)</label>
              <input
                value={form.cover_image_url}
                onChange={e => setF({ cover_image_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setCoverDragOver(true); }}
                onDragLeave={() => setCoverDragOver(false)}
                onDrop={async e => {
                  e.preventDefault();
                  setCoverDragOver(false);
                  const raw = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '';
                  const url = raw.split('\n')[0].trim();
                  if (url.startsWith('http')) { setF({ cover_image_url: url }); return; }
                  const file = e.dataTransfer.files[0];
                  if (file?.type.startsWith('image/')) {
                    setCoverUploading(true);
                    try { setF({ cover_image_url: await uploadMediaFile(file) }); }
                    catch (err) { showToast(translateError(err, 'Không thể upload ảnh'), 'error'); }
                    finally { setCoverUploading(false); }
                  }
                }}
                className={`mt-2 rounded-xl border-2 transition-all ${
                  coverDragOver ? 'border-blue-400 bg-blue-50' : 'border-dashed border-slate-200 hover:border-blue-200'
                }`}
              >
                {coverUploading ? (
                  <div className="h-20 flex items-center justify-center gap-2 text-blue-500 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Đang upload...
                  </div>
                ) : form.cover_image_url ? (
                  <div className="flex items-center gap-3 p-2">
                    <img
                      src={form.cover_image_url}
                      alt="preview"
                      className="h-16 w-16 object-cover rounded-lg border border-slate-200 shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <p className="text-xs text-slate-400">Kéo ảnh mới từ browser vào đây để thay thế</p>
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <ImageIcon size={16} className="text-slate-300" />
                    Kéo ảnh từ browser vào đây
                  </div>
                )}
              </div>
              <MediaUpload onUploaded={url => setF({ cover_image_url: url })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Ảnh bổ sung (gallery)
                <span className="ml-1 text-slate-400 font-normal">— mỗi dòng 1 URL</span>
              </label>
              <div className="space-y-1.5">
                {form.gallery.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={url}
                      onChange={e => {
                        const g = [...form.gallery];
                        g[i] = e.target.value;
                        setF({ gallery: g });
                      }}
                      placeholder="https://..."
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {url && (
                      <img src={url} alt="" className="h-8 w-8 object-cover rounded border border-slate-200 shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <button
                      disabled={i === 0}
                      onClick={() => { const g = [...form.gallery]; [g[i - 1], g[i]] = [g[i], g[i - 1]]; setF({ gallery: g }); }}
                      className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                      aria-label="Đưa ảnh lên"
                    ><ChevronUp size={14} /></button>
                    <button
                      disabled={i === form.gallery.length - 1}
                      onClick={() => { const g = [...form.gallery]; [g[i + 1], g[i]] = [g[i], g[i + 1]]; setF({ gallery: g }); }}
                      className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                      aria-label="Đưa ảnh xuống"
                    ><ChevronDown size={14} /></button>
                    <button onClick={() => setF({ gallery: form.gallery.filter((_, j) => j !== i) })}
                      className="text-slate-300 hover:text-red-500 transition-colors p-0.5 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setF({ gallery: [...form.gallery, ''] })}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors mt-1"
                >
                  <Plus size={12} /> Thêm ảnh
                </button>
                <MediaUpload onUploaded={url => setF({ gallery: [...form.gallery, url] })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL video sản phẩm</label>
              <input
                value={form.video_url}
                onChange={e => setF({ video_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {tab === 'detail' && (
          <div className="space-y-3 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả đầy đủ</label>
              <textarea
                value={form.description}
                onChange={e => setF({ description: e.target.value })}
                placeholder="Mô tả chi tiết hiển thị trên trang sản phẩm..."
                rows={5}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Chất liệu mũ/thân</label>
                <input
                  value={form.material}
                  onChange={e => setF({ material: e.target.value })}
                  placeholder="VD: Da bò thật, Vải canvas..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Chất liệu đế</label>
                <input
                  value={form.sole_material}
                  onChange={e => setF({ sole_material: e.target.value })}
                  placeholder="VD: Cao su thiên nhiên..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Xuất xứ</label>
                <input
                  value={form.origin}
                  onChange={e => setF({ origin: e.target.value })}
                  placeholder="VD: Việt Nam"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hướng dẫn bảo quản</label>
              <textarea
                value={form.care_instructions}
                onChange={e => setF({ care_instructions: e.target.value })}
                placeholder="VD: Không giặt máy, lau bằng vải ẩm..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hướng dẫn chọn size</label>
              <textarea
                value={form.size_guide}
                onChange={e => setF({ size_guide: e.target.value })}
                placeholder="VD: Size 40 = 25.5cm, Size 41 = 26cm..."
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
          <div className="max-w-4xl">
            <VariantsEditor
              drafts={form.variantDrafts}
              onChange={drafts => setF({ variantDrafts: drafts })}
              posProducts={posProducts}
            />
          </div>
        )}

        {tab === 'seo' && (
          <div className="space-y-3 max-w-xl">
            <p className="text-xs text-slate-500">Thông tin SEO hiển thị trên Google và khi chia sẻ link.</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tiêu đề SEO
                <span className="ml-1 text-slate-400 font-normal">— để trống = dùng tên sản phẩm</span>
              </label>
              <input
                value={form.seo_title}
                onChange={e => setF({ seo_title: e.target.value })}
                placeholder={form.name || 'Tiêu đề hiển thị trên Google...'}
                maxLength={60}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-0.5 text-right">{form.seo_title.length}/60</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mô tả SEO
                <span className="ml-1 text-slate-400 font-normal">— để trống = dùng mô tả ngắn</span>
              </label>
              <textarea
                value={form.seo_description}
                onChange={e => setF({ seo_description: e.target.value })}
                placeholder={form.short_description || 'Mô tả hiển thị dưới tiêu đề Google...'}
                maxLength={160}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-0.5 text-right">{form.seo_description.length}/160</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Ảnh Open Graph (OG Image)
                <span className="ml-1 text-slate-400 font-normal">— để trống = dùng ảnh bìa</span>
              </label>
              <input
                value={form.og_image_url}
                onChange={e => setF({ og_image_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.og_image_url && (
                <img src={form.og_image_url} alt="OG preview"
                  className="mt-2 h-20 rounded-lg border border-slate-200 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
            {/* Preview snippet Google */}
            <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl">
              <p className="text-[11px] text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Preview Google</p>
              <p className="text-sm text-blue-700 font-medium truncate">
                {form.seo_title || form.name || 'Tên sản phẩm'}
              </p>
              <p className="text-xs text-green-700">phucsang.com.vn/{form.slug || 'slug'}.html</p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                {form.seo_description || form.short_description || 'Mô tả sản phẩm hiển thị ở đây...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────
function CreateModal({ onClose, onSaved, posProducts }: { onClose: () => void; onSaved: () => void; posProducts: POSProduct[] }) {
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
      await adminStoreRequest('/api/admin/store/products', {
        method: 'POST', body: JSON.stringify({ ...form, variants: form.variantDrafts }),
      });

      showToast('Đã tạo sản phẩm website', 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      showToast(translateError(err), 'error');
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
              posProducts={posProducts}
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

// ─── Grid card ───────────────────────────────────────────────────────────────
const WebsiteGridCard = memo(function WebsiteGridCard({
  product,
  isSelected,
  onClick,
}: {
  product: StoreProduct;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all text-left ${
        isSelected
          ? 'border-blue-400 ring-2 ring-blue-300 shadow-md'
          : 'border-slate-200 hover:border-blue-200 hover:shadow-md'
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
        {product.cover_image_url ? (
          <img
            src={product.cover_image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <Globe size={28} className="text-slate-300" />
          </div>
        )}
        {/* SKU count badge */}
        {product.store_product_variants.length > 0 && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            <Package size={9} />
            <span className="ml-0.5">{product.store_product_variants.length} SKU</span>
          </div>
        )}
        {/* Published status dot */}
        <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white shadow ${product.is_published ? 'bg-green-500' : 'bg-slate-400'}`} />
      </div>

      {/* Footer */}
      <div className="px-2 py-2 bg-white flex flex-col gap-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate leading-tight">{product.name}</p>
        {(product.is_best_seller || product.is_new || product.is_featured) && (
          <div className="flex flex-wrap gap-1">
            {product.is_best_seller && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Best Seller</span>}
            {product.is_new && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Mới</span>}
            {product.is_featured && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Nổi bật</span>}
          </div>
        )}
      </div>
    </button>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WebsiteProductsPage({ navigationSlot, posProducts = [] }: Props) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [gridPopupId, setGridPopupId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminStoreRequest<{ data: StoreProduct[] }>('/api/admin/store/products');
      setProducts(result.data ?? []);
    } catch {
      showToast('Lỗi tải danh sách sản phẩm', 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const togglePublish = async (product: StoreProduct) => {
    try {
      await adminStoreRequest(`/api/admin/store/products/${product.id}/publish`, {
        method: 'POST', body: JSON.stringify({ is_published: !product.is_published }),
      });
      showToast(product.is_published ? 'Đã ẩn khỏi website' : 'Đã xuất bản lên website', 'success');
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_published: !p.is_published } : p));
    } catch {
      showToast('Lỗi cập nhật trạng thái', 'error');
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = selectedId ? products.find(p => p.id === selectedId) ?? null : null;
  const gridPopupProduct = gridPopupId ? products.find(p => p.id === gridPopupId) ?? null : null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageFiltered = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalSkuItems = filtered.reduce((sum, p) => sum + p.store_product_variants.length, 0);

  const openGridPopup = (product: StoreProduct) => setGridPopupId(product.id);
  const closeGridPopup = () => setGridPopupId(null);

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

          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center justify-center w-8 h-8 transition-all ${viewMode === 'table' ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
              title="Xem dạng bảng"
            ><List size={14} /></button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center w-8 h-8 border-l border-slate-200 transition-all ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
              title="Xem dạng lưới ảnh"
            ><LayoutGrid size={14} /></button>
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

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-0">
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
          ) : viewMode === 'grid' ? (
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                {pageFiltered.map(product => (
                  <WebsiteGridCard
                    key={product.id}
                    product={product}
                    isSelected={gridPopupId === product.id}
                    onClick={() => openGridPopup(product)}
                  />
                ))}
              </div>
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
                {pageFiltered.map(product => {
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
                              posProducts={posProducts}
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
        <GoodsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filtered.length}
          totalSkuItems={totalSkuItems}
          setCurrentPage={setCurrentPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
        />
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSaved={loadProducts} posProducts={posProducts} />
      )}

      {/* Grid popup */}
      {gridPopupProduct && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={closeGridPopup}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <Globe size={16} className="text-blue-500 shrink-0" />
                <span className="font-semibold text-slate-800 truncate">{gridPopupProduct.name}</span>
                <span className="text-xs text-slate-400 shrink-0">
                  · {gridPopupProduct.store_product_variants.length} SKU
                </span>
              </div>
              <button
                onClick={closeGridPopup}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0 ml-3 transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            {/* Variant chips */}
            {gridPopupProduct.store_product_variants.length > 0 && (
              <div className="shrink-0 flex gap-2 overflow-x-auto px-5 py-3 border-b border-slate-100">
                {gridPopupProduct.store_product_variants
                  .slice()
                  .sort((a, b) => a.display_order - b.display_order)
                  .map(variant => (
                    <div
                      key={variant.id}
                      className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700"
                    >
                      {variant.color_hex && (
                        <span
                          className="w-3 h-3 rounded-full border border-white shadow-sm shrink-0"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                      )}
                      <span>{[variant.size, variant.color_name].filter(Boolean).join(' · ') || variant.sku}</span>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variant.is_published ? 'bg-green-500' : 'bg-slate-300'}`} />
                    </div>
                  ))}
              </div>
            )}

            {/* Detail panel */}
            <div className="flex-1 overflow-y-auto">
              <DetailPanel
                key={gridPopupProduct.id}
                product={gridPopupProduct}
                onClose={closeGridPopup}
                onSaved={loadProducts}
                posProducts={posProducts}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
