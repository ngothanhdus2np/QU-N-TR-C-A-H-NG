import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronUp, Package, ShoppingBag, ArrowLeft, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { POSProduct, ProductGroup } from '../../types';
import ProductGroupTreePicker from '../shared/ProductGroupTreePicker';

const ProductMemoCard = React.memo(({ product, onAdd }: { product: POSProduct; onAdd: (p: POSProduct) => void }) => (
  <button
    onClick={() => onAdd(product)}
    className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] overflow-hidden group flex flex-col h-full"
  >
    <div className="bg-slate-200/50 relative w-full h-[110px] flex-shrink-0 flex items-center justify-center">
      {product.images?.[0] ? (
        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      ) : (
        <ShoppingBag className="h-12 w-12 text-slate-300" strokeWidth={1} />
      )}
      <div className="absolute bottom-2 right-2 px-3 py-1 bg-emerald-500 text-white text-sm font-normal rounded-full shadow-lg">
        {product.salePrice.toLocaleString('vi-VN')}
      </div>
      {product.isParent && product.variantCount && product.variantCount > 0 && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-600 text-white text-2xs font-normal rounded-full shadow-lg">
          {product.variantCount} biến thể
        </div>
      )}
    </div>
    <div className="bg-white px-3 py-2.5 flex-1 flex items-center justify-center">
      <span className="text-xs font-normal text-slate-800 uppercase line-clamp-2 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors text-center w-full">
        {product.name}
      </span>
    </div>
  </button>
));

interface POSConsultantProps {
  showConsultant: boolean;
  setShowConsultant: (v: boolean) => void;
  products: POSProduct[];
  productGroups: ProductGroup[];
  addToCart: (p: POSProduct) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
}

const splitCategoryPath = (value: string) =>
  String(value || '')
    .split(/\s*(?:>>|>|\/)\s*/g)
    .map(part => part.trim())
    .filter(Boolean);

const normalizeCategoryPath = (value: string) => splitCategoryPath(value).join(' >> ');

const productMatchesCategory = (product: POSProduct, categoryPath: string) => {
  if (!categoryPath) return true;
  const productPath = normalizeCategoryPath(product.categoryPath || product.categoryId || '');
  return productPath === categoryPath || productPath.startsWith(`${categoryPath} >> `);
};

const POSConsultant: React.FC<POSConsultantProps> = ({
  showConsultant,
  setShowConsultant,
  products,
  productGroups,
  addToCart,
  searchRef,
}) => {
  const [consultantSearch, setConsultantSearch] = useState('');
  const [debouncedConsultantSearch, setDebouncedConsultantSearch] = useState('');
  const [consultantCategory, setConsultantCategory] = useState('');
  const [consultantSort, setConsultantSort] = useState<'none' | 'price_desc' | 'price_asc'>('none');
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selectedParent, setSelectedParent] = useState<POSProduct | null>(null);
  const [viewMode, setViewMode] = useState<'parent' | 'variants'>('parent');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedConsultantSearch(consultantSearch), 300);
    return () => clearTimeout(timer);
  }, [consultantSearch]);

  // Reset display limit when search or category changes
  useEffect(() => {
    setDisplayLimit(100);
  }, [debouncedConsultantSearch, consultantCategory]);

  const categoryGroups = useMemo<ProductGroup[]>(() => {
    if (productGroups.length > 0) return productGroups;
    const paths = new Set<string>();
    products.forEach(product => {
      const parts = splitCategoryPath(product.categoryPath || product.categoryId || '');
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        paths.add(currentPath);
      });
    });
    return Array.from(paths)
      .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
      .map(path => ({ id: path, name: path }));
  }, [productGroups, products]);

  const productCountByPath = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach(product => {
      if (product.status !== 'Active' || product.parentId) return;
      const parts = splitCategoryPath(product.categoryPath || product.categoryId || '');
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        counts.set(currentPath, (counts.get(currentPath) || 0) + 1);
      });
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = debouncedConsultantSearch.toLowerCase();
    // Chỉ hiển thị sản phẩm cha hoặc sản phẩm độc lập (không có parentId)
    const filtered = products.filter(p =>
      p.status === 'Active' &&
      !p.parentId && // Loại bỏ sản phẩm con
      productMatchesCategory(p, consultantCategory) &&
      ((p.name?.toLowerCase() || '').includes(search) ||
        (p.sku?.toLowerCase() || '').includes(search) ||
        (p.barcode && p.barcode.includes(search)))
    );

    filtered.sort((a, b) => {
      if (consultantSort === 'price_desc') {
        return (b.salePrice || 0) - (a.salePrice || 0);
      } else if (consultantSort === 'price_asc') {
        return (a.salePrice || 0) - (b.salePrice || 0);
      }
      return (a.sku || '').localeCompare(b.sku || '');
    });

    return filtered;
  }, [products, debouncedConsultantSearch, consultantCategory, consultantSort]);

  // Lấy danh sách biến thể con của sản phẩm cha đang chọn
  const variantProducts = useMemo(() => {
    if (!selectedParent) return [];
    return products.filter(p => p.parentId === selectedParent.id && p.status === 'Active');
  }, [products, selectedParent]);

  const handleProductClick = (product: POSProduct) => {
    // Nếu là sản phẩm cha có biến thể → chuyển sang view biến thể
    if (product.isParent && product.variantCount && product.variantCount > 0) {
      setSelectedParent(product);
      setViewMode('variants');
    } else {
      // Sản phẩm độc lập → thêm trực tiếp vào giỏ
      addToCart(product);
    }
  };

  const handleVariantSelect = (variant: POSProduct) => {
    addToCart(variant);
  };

  const handleBackToParents = () => {
    setViewMode('parent');
    setSelectedParent(null);
  };

  const togglePriceSort = () => {
    if (consultantSort === 'none') {
      setConsultantSort('price_desc');
    } else if (consultantSort === 'price_desc') {
      setConsultantSort('price_asc');
    } else {
      setConsultantSort('none');
    }
  };

  return (
    <div className={`bg-slate-200/50 transition-all duration-300 ease-in-out ${showConsultant ? 'h-[380px]' : 'h-10'} flex flex-col border-t border-slate-200`}>
      <div
        className={`bg-white flex items-center px-8 ${viewMode === 'parent' ? 'cursor-pointer hover:bg-slate-50' : ''} transition-all shrink-0 border-b border-slate-200 gap-8 ${showConsultant ? 'h-14' : 'h-10 justify-center'}`}
        onClick={viewMode === 'parent' ? () => setShowConsultant(!showConsultant) : undefined}
      >
        {showConsultant ? (
          <>
            {viewMode === 'variants' && (
              <button
                onClick={handleBackToParents}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
              >
                <ArrowLeft className="h-4 w-4 text-slate-600" />
                <span className="text-xs font-normal text-slate-700 uppercase">Quay lại</span>
              </button>
            )}

            <div className="flex items-center gap-4 shrink-0">
              <span className="text-[14px] font-normal uppercase text-slate-800 tracking-tight">
                {viewMode === 'parent' ? 'TƯ VẤN BÁN HÀNG' : selectedParent?.name || 'CHỌN BIẾN THỂ'}
              </span>
              {viewMode === 'parent' && (
                <span className="text-[9px] font-normal text-slate-400 uppercase tracking-wider">(Click để ẩn)</span>
              )}
              {viewMode === 'variants' && selectedParent && (
                <span className="text-2xs font-normal text-slate-500">({variantProducts.length} biến thể)</span>
              )}
            </div>

            {viewMode === 'parent' && (
              <div className="flex flex-1 items-center gap-4">
                <div className="relative flex-1 max-w-xl group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="(Shift + F3) Tìm kiếm"
                    className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-normal text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={consultantSearch}
                    onChange={e => setConsultantSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div onClick={e => e.stopPropagation()}>
                    <ProductGroupTreePicker
                      groups={categoryGroups}
                      selectedPaths={consultantCategory ? [consultantCategory] : []}
                      onSelectionChange={paths => setConsultantCategory(paths[paths.length - 1] || '')}
                      productCountByPath={productCountByPath}
                      placeholder="Lọc theo nhóm hàng hóa"
                      className="w-64"
                    />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePriceSort();
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      consultantSort !== 'none'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}
                    title={
                      consultantSort === 'none'
                        ? 'Sắp xếp theo giá'
                        : consultantSort === 'price_desc'
                        ? 'Giá cao → thấp'
                        : 'Giá thấp → cao'
                    }
                  >
                    {consultantSort === 'price_asc' ? (
                      <ArrowUpNarrowWide className="h-4 w-4" />
                    ) : (
                      <ArrowDownWideNarrow className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[9px] font-bold uppercase tracking-widest">Ấn để mở bảng tư vấn trực quan</span>
            <ChevronUp className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {showConsultant && (
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-6 auto-rows-[160px] gap-3 overflow-x-hidden animate-in fade-in slide-in-from-bottom-6 duration-500 custom-scrollbar">
          {viewMode === 'parent' ? (
            <>
              {filteredProducts.slice(0, displayLimit).map(p => (
                <ProductMemoCard key={p.id} product={p} onAdd={handleProductClick} />
              ))}
              {filteredProducts.length > displayLimit && (
                <div className="col-span-6 flex items-center justify-center">
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 100)}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
                  >
                    <span className="text-sm font-normal">
                      Xem thêm {Math.min(100, filteredProducts.length - displayLimit)} sản phẩm ({filteredProducts.length - displayLimit} còn lại)
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {variantProducts.map(variant => (
                <ProductMemoCard key={variant.id} product={variant} onAdd={handleVariantSelect} />
              ))}
              {variantProducts.length === 0 && (
                <div className="col-span-6 flex flex-col items-center justify-center py-12 text-slate-400">
                  <Package className="h-16 w-16 mb-4" strokeWidth={1} />
                  <p className="text-sm">Không tìm thấy biến thể nào</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default POSConsultant;
