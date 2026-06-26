import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ChevronUp, Package, ShoppingBag, ArrowLeft, ArrowDownWideNarrow, ArrowUpNarrowWide, X, Maximize2, Minimize2 } from 'lucide-react';
import { POSProduct, ProductGroup } from '../../types';
import { fuzzyMatch } from '../../src/lib/fuzzySearch';
import { CardSkeleton } from '../shared/ui/Skeleton';

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
  isDataReady?: boolean;
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
  isDataReady = true,
}) => {
  const [consultantSearch, setConsultantSearch] = useState('');
  const [debouncedConsultantSearch, setDebouncedConsultantSearch] = useState('');
  const [consultantCategory, setConsultantCategory] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const categoryBoxRef = useRef<HTMLDivElement>(null);
  const [consultantSort, setConsultantSort] = useState<'none' | 'price_desc' | 'price_asc'>('none');
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Click-outside để đóng suggestions
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryBoxRef.current && !categoryBoxRef.current.contains(e.target as Node)) {
        setShowCategorySuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const categorySuggestions = useMemo(() => {
    const term = categoryInput.toLowerCase().trim();
    const allPaths = categoryGroups
      .map(g => g.name || g.id)
      .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
    const filtered = term
      ? allPaths.filter(path => fuzzyMatch(path, term))
      : allPaths;
    return filtered.map(path => {
      const parts = path.split('>>').map(p => p.trim());
      return { path, depth: parts.length - 1, label: parts[parts.length - 1] };
    });
  }, [categoryGroups, categoryInput]);

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
    const search = debouncedConsultantSearch;
    const filtered = products.filter(p =>
      p.status === 'Active' &&
      !p.parentId &&
      productMatchesCategory(p, consultantCategory) &&
      (fuzzyMatch(p.name || '', search) ||
        fuzzyMatch(p.sku || '', search) ||
        (p.barcode && fuzzyMatch(p.barcode, search)))
    );

    filtered.sort((a, b) => {
      if (consultantSort === 'price_desc') {
        return (b.salePrice || 0) - (a.salePrice || 0);
      } else if (consultantSort === 'price_asc') {
        return (a.salePrice || 0) - (b.salePrice || 0);
      }
      const numA = Number(((a.sku || '').match(/\d+/) || [0])[0] || 0);
      const numB = Number(((b.sku || '').match(/\d+/) || [0])[0] || 0);
      if (numA !== numB) return numB - numA;
      return (a.name || '').localeCompare(b.name || '', 'vi');
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
    <div className={`bg-slate-200/50 transition-all duration-300 ease-in-out ${showConsultant ? (isExpanded ? 'h-[760px]' : 'h-[380px]') : 'h-10'} flex flex-col border-t border-slate-200`}>
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
                  <div
                    ref={categoryBoxRef}
                    className="relative w-56"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      <input
                        ref={categoryInputRef}
                        type="text"
                        placeholder="Lọc nhóm hàng..."
                        className="w-full pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-normal text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        value={categoryInput}
                        onChange={e => {
                          setCategoryInput(e.target.value);
                          setShowCategorySuggestions(true);
                        }}
                        onFocus={() => setShowCategorySuggestions(true)}
                      />
                      {(categoryInput || consultantCategory) && (
                        <button
                          className="absolute right-2 text-slate-400 hover:text-slate-600"
                          onMouseDown={e => {
                            e.preventDefault();
                            setCategoryInput('');
                            setConsultantCategory('');
                            setShowCategorySuggestions(false);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {showCategorySuggestions && categorySuggestions.length > 0 && (
                      <div className="absolute top-full left-0 z-50 mt-1 w-72 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {categorySuggestions.map(({ path, depth, label }) => {
                          const isSelected = consultantCategory === path;
                          const count = productCountByPath.get(path);
                          return (
                            <button
                              key={path}
                              type="button"
                              className={`w-full text-left py-1.5 pr-3 text-xs transition-colors border-b border-slate-50 last:border-0 flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : depth === 0
                                  ? 'text-slate-800 font-medium hover:bg-slate-50'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                              style={{ paddingLeft: `${12 + depth * 14}px` }}
                              onMouseDown={e => {
                                e.preventDefault();
                                setConsultantCategory(path);
                                setCategoryInput(label);
                                setShowCategorySuggestions(false);
                              }}
                            >
                              {depth > 0 && (
                                <span className="text-slate-300 shrink-0">└</span>
                              )}
                              <span className="truncate">{label}</span>
                              {count !== undefined && (
                                <span className="ml-auto shrink-0 text-slate-400">{count}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
            <button
              onClick={e => { e.stopPropagation(); setIsExpanded(v => !v); }}
              className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
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
          {!isDataReady ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : viewMode === 'parent' ? (
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
