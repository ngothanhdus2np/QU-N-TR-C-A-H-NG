import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Copy, RefreshCw, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  CONTENT_PLATFORMS,
  OBJECTIVE_LABELS,
  type ContentObjective,
} from '../../constants/contentPlatformPublic';
import {
  generateProductContent,
  type ProductContentInput,
  type ContentWarning,
} from '../../services/productContentService';

interface SimpleProduct {
  id: string;
  sku: string;
  name: string;
  category_path: string | null;
  sale_price: number;
  brand: string | null;
  description: string | null;
  warranty: string | null;
  is_parent: boolean | null;
  parent_id: string | null;
}

const PLATFORM_CHANNEL: Record<string, 'shopee' | 'website' | 'all'> = {
  shopee_product_description: 'shopee',
  website_product_description: 'website',
  facebook_product_caption: 'all',
  blog_seo_article: 'all',
};

const ProductContentTab: React.FC = () => {
  const [allProducts, setAllProducts] = useState<SimpleProduct[]>([]);
  const [shopeeIds, setShopeeIds] = useState<Set<string>>(new Set());
  const [websiteIds, setWebsiteIds] = useState<Set<string>>(new Set());
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SimpleProduct | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [platformId, setPlatformId] = useState('shopee_product_description');
  const [objective, setObjective] = useState<ContentObjective>('sell_fast');
  const [extraInstruction, setExtraInstruction] = useState('');
  const [manualMaterial, setManualMaterial] = useState('');
  const [manualColors, setManualColors] = useState('');
  const [manualSizeRange, setManualSizeRange] = useState('');

  const [output, setOutput] = useState('');
  const [warnings, setWarnings] = useState<ContentWarning[]>([]);
  const [parseError, setParseError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const activePlatform = CONTENT_PLATFORMS.find(p => p.id === platformId);

  // Load channel links, sau đó fetch đúng sản phẩm theo ID (giống OnlineCatalogPage)
  useEffect(() => {
    const fetchAll = async () => {
      setLoadingProducts(true);
      try {
        const catalogRes = await fetch('/api/channel-links/catalog-links', { credentials: 'include' });
        if (!catalogRes.ok) return;
        const json: { ok: boolean; shopee: string[]; website: string[] } = await catalogRes.json();
        if (!json.ok) return;

        setShopeeIds(new Set(json.shopee));
        setWebsiteIds(new Set(json.website));

        // Gom tất cả ID cần fetch (shopee + website, dedup)
        const allIds = [...new Set([...json.shopee, ...json.website])];
        if (allIds.length === 0) return;

        // Chunk 30 ID/request để tránh URI too long
        const CHUNK = 30;
        const chunks: string[][] = [];
        for (let i = 0; i < allIds.length; i += CHUNK) chunks.push(allIds.slice(i, i + CHUNK));

        const results = await Promise.all(
          chunks.map(chunk =>
            supabase
              .from('pos_products')
              .select('id, sku, name, category_path, sale_price, brand, description, warranty, is_parent, parent_id')
              .in('id', chunk)
          )
        );
        const fetched = results.flatMap(r => (r.data ?? []) as SimpleProduct[]);
        fetched.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setAllProducts(fetched);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lọc theo kênh của platform đang chọn
  // Bao gồm cả con của sản phẩm cha được link kênh (giống OnlineCatalogPage)
  const channel = PLATFORM_CHANNEL[platformId] ?? 'all';
  const products = (() => {
    if (channel === 'all') return allProducts;
    const ids = channel === 'shopee' ? shopeeIds : websiteIds;
    const parentIds = new Set(
      allProducts.filter(p => ids.has(p.id) && p.is_parent).map(p => p.id)
    );
    return allProducts.filter(
      p => ids.has(p.id) || (p.parent_id != null && parentIds.has(p.parent_id))
    );
  })();

  const filteredProducts = productSearch.trim()
    ? products.filter(
        p =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.sku.toLowerCase().includes(productSearch.toLowerCase())
      )
    : products;

  const buildInput = (): ProductContentInput | null => {
    const name = selectedProduct?.name?.trim() || productSearch.trim() || selectedProduct?.sku;
    if (!name) return null;

    const colors = manualColors
      ? manualColors.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    return {
      name,
      sku: selectedProduct?.sku ?? 'N/A',
      category: selectedProduct?.category_path ?? 'Giày dép',
      price: selectedProduct?.sale_price ?? 0,
      brandName: selectedProduct?.brand ?? undefined,
      material: manualMaterial || undefined,
      colors: colors?.length ? colors : undefined,
      sizeRange: manualSizeRange || undefined,
      warrantyPolicy: selectedProduct?.warranty ?? undefined,
      description: selectedProduct?.description ?? undefined,
    };
  };

  const handleGenerate = async () => {
    if (loading) return;

    // Kiểm tra điều kiện bắt buộc trước — hiện thông báo thay vì im lặng
    if (!hasProduct) {
      setWarnings([{ type: 'missing_data', message: 'Cần nhập tên sản phẩm hoặc chọn sản phẩm từ danh sách trước khi sinh nội dung.' }]);
      return;
    }

    const input = buildInput();
    if (!input) {
      setWarnings([{ type: 'missing_data', message: 'Không đủ thông tin sản phẩm để sinh nội dung.' }]);
      return;
    }

    setLoading(true);
    setOutput('');
    setWarnings([]);
    setParseError(false);

    try {
      const res = await generateProductContent(input, platformId, objective, extraInstruction || undefined);
      setOutput(res.result);
      setWarnings(res.warnings ?? []);
      setParseError(res.parseError ?? false);
    } catch (err) {
      setWarnings([{
        type: 'format_violation',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectPlatform = (id: string) => {
    const platform = CONTENT_PLATFORMS.find(p => p.id === id);
    setPlatformId(id);
    if (platform) setObjective(platform.supportedObjectives[0]);
    setOutput('');
    setWarnings([]);
    setParseError(false);
    // Reset product selection vì mỗi platform có danh sách sản phẩm riêng
    setSelectedProduct(null);
    setProductSearch('');
    setShowDropdown(false);
  };

  const charCount = output.length;
  const maxLen = activePlatform?.output.maxLength;
  const hasProduct = !!(selectedProduct || productSearch.trim());
  const canGenerate = !loading && hasProduct;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Platform sub-tabs */}
      <div className="flex gap-1.5 px-5 py-3 border-b border-slate-100 bg-white shrink-0">
        {CONTENT_PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelectPlatform(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-normal transition-all ${
              platformId === p.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.icon} {p.name}
          </button>
        ))}
        {activePlatform && (
          <span className="ml-auto text-2xs text-slate-400 self-center uppercase tracking-wide">
            {activePlatform.output.format.toUpperCase()}
            {maxLen ? ` · tối đa ${maxLen.toLocaleString('vi-VN')} ký tự` : ''}
          </span>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: Input panel */}
        <div className="w-72 shrink-0 border-r border-slate-100 bg-white flex flex-col">
          {/* Product search — KHÔNG nằm trong overflow container để dropdown không bị clip */}
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div ref={dropdownRef} className="relative">
              <label className="block text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1">
                Sản phẩm <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Gõ tên hoặc mã SKU để tìm..."
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setSelectedProduct(null);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
                />
                {productSearch && (
                  <button
                    onMouseDown={() => {
                      setProductSearch('');
                      setSelectedProduct(null);
                      setShowDropdown(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors text-base leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full border border-slate-200 rounded-lg max-h-56 overflow-y-auto bg-white shadow-xl">
                  {productSearch.trim() && (
                    <div className="px-3 py-1.5 text-2xs text-slate-400 border-b border-slate-50">
                      {filteredProducts.length > 25
                        ? `Hiển thị 25 / ${filteredProducts.length} kết quả`
                        : `${filteredProducts.length} sản phẩm`}
                    </div>
                  )}
                  {filteredProducts.slice(0, 25).map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => {
                        setSelectedProduct(p);
                        setProductSearch(p.name?.trim() || p.sku);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="font-normal text-slate-800 truncate">{p.name}</div>
                      <div className="text-slate-400 text-2xs">{p.sku} · {p.sale_price.toLocaleString('vi-VN')}đ</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && (
                <div className="mt-1 px-2.5 py-1 bg-indigo-50 rounded-lg text-2xs text-indigo-700 flex items-center gap-1.5">
                  <span className="text-indigo-400">✓</span>
                  <span className="flex-1 truncate">{selectedProduct.sku} · {selectedProduct.sale_price.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              {loadingProducts && (
                <div className="mt-1 text-2xs text-slate-400">Đang tải sản phẩm...</div>
              )}
              {!loadingProducts && !selectedProduct && !productSearch && (
                <div className="mt-1 text-2xs text-slate-400">
                  {products.length > 0
                    ? `${products.length} sản phẩm ${channel === 'shopee' ? 'Shopee' : channel === 'website' ? 'Website' : 'trong kho'}`
                    : channel === 'shopee'
                      ? 'Chưa có sản phẩm nào link kênh Shopee'
                      : channel === 'website'
                        ? 'Chưa có sản phẩm nào link kênh Website'
                        : 'Kho trống'}
                </div>
              )}
            </div>
          </div>

          {/* Phần còn lại cuộn được */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">

          {/* Manual fields */}
          <div>
            <label className="block text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1">
              Chất liệu
            </label>
            <input
              type="text"
              placeholder="VD: Da PU, vải canvas..."
              value={manualMaterial}
              onChange={e => setManualMaterial(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1">
              Màu sắc (cách nhau dấu phẩy)
            </label>
            <input
              type="text"
              placeholder="VD: Đen, Nâu, Trắng"
              value={manualColors}
              onChange={e => setManualColors(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1">
              Dải size
            </label>
            <input
              type="text"
              placeholder="VD: 36-44"
              value={manualSizeRange}
              onChange={e => setManualSizeRange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400 transition-all"
            />
          </div>

          {/* Objective */}
          {activePlatform && (
            <div>
              <label className="block text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1.5">
                Mục tiêu
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {activePlatform.supportedObjectives.map(obj => (
                  <button
                    key={obj}
                    onClick={() => setObjective(obj)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-normal text-center transition-all ${
                      objective === obj
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {OBJECTIVE_LABELS[obj]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extra instruction */}
          <div>
            <label className="block text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1">
              Dặn thêm cho AI
            </label>
            <textarea
              placeholder="VD: Nhấn mạnh đế êm, phù hợp đi bộ nhiều giờ..."
              value={extraInstruction}
              onChange={e => setExtraInstruction(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none resize-none focus:border-indigo-400 transition-all"
            />
          </div>
          </div>{/* end scroll wrapper */}
        </div>

        {/* Right: Output panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-normal disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all shadow-sm"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {loading ? 'Đang sinh...' : 'Sinh nội dung'}
            </button>
            <div className="flex items-center gap-2">
              {output && (
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs hover:bg-slate-200 transition-all"
                >
                  <RefreshCw size={12} />
                  Sinh lại
                </button>
              )}
              {output && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs hover:bg-slate-200 transition-all"
                >
                  {copied
                    ? <CheckCircle size={12} className="text-green-500" />
                    : <Copy size={12} />}
                  {copied ? 'Đã copy' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 shrink-0 space-y-0.5">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-2xs text-amber-700">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Output */}
          <textarea
            value={output}
            onChange={e => setOutput(e.target.value)}
            placeholder={
              loading
                ? 'Đang sinh nội dung...'
                : 'Nội dung AI sinh ra sẽ hiển thị ở đây.\nChọn sản phẩm bên trái rồi nhấn "Sinh nội dung".'
            }
            className="flex-1 w-full bg-white p-5 text-sm font-normal resize-none outline-none border-0 leading-relaxed"
          />

          {/* Footer */}
          {(output || parseError) && (
            <div className="flex items-center justify-between px-5 py-2 border-t border-slate-100 bg-white text-2xs text-slate-400 shrink-0">
              <span>
                {charCount.toLocaleString('vi-VN')} ký tự
                {maxLen && (
                  <span className={charCount > maxLen ? ' text-rose-500' : ''}>
                    {' '}/ {maxLen.toLocaleString('vi-VN')} tối đa
                    {charCount > maxLen && ' — vượt giới hạn'}
                  </span>
                )}
              </span>
              {parseError && (
                <span className="text-amber-500">⚠ JSON chưa hợp lệ — chỉnh tay trước khi dùng</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductContentTab;
