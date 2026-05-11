import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Package, ShoppingBag } from 'lucide-react';
import { POSProduct } from '../../types';

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
      <div className="absolute bottom-2 right-2 px-3 py-1 bg-emerald-500 text-white text-sm font-black rounded-full shadow-lg">
        {product.salePrice.toLocaleString('vi-VN')}
      </div>
    </div>
    <div className="bg-white px-3 py-2.5 flex-1 flex items-center justify-center">
      <span className="text-xs font-bold text-slate-800 uppercase line-clamp-2 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors text-center w-full">
        {product.name}
      </span>
    </div>
  </button>
));

interface POSConsultantProps {
  showConsultant: boolean;
  setShowConsultant: (v: boolean) => void;
  products: POSProduct[];
  addToCart: (p: POSProduct) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
}

const POSConsultant: React.FC<POSConsultantProps> = ({
  showConsultant,
  setShowConsultant,
  products,
  addToCart,
  searchRef,
}) => {
  const [consultantSearch, setConsultantSearch] = useState('');
  const [debouncedConsultantSearch, setDebouncedConsultantSearch] = useState('');
  const [consultantCategory, setConsultantCategory] = useState('All');
  const [consultantSort] = useState<'sku_asc' | 'price_desc'>('sku_asc');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedConsultantSearch(consultantSearch), 300);
    return () => clearTimeout(timer);
  }, [consultantSearch]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.categoryId || 'Khác')));
    return ['All', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = debouncedConsultantSearch.toLowerCase();
    const filtered = products.filter(p =>
      p.status === 'Active' &&
      (consultantCategory === 'All' || p.categoryId === consultantCategory) &&
      ((p.name?.toLowerCase() || '').includes(search) ||
        (p.sku?.toLowerCase() || '').includes(search) ||
        (p.barcode && p.barcode.includes(search)))
    );

    filtered.sort((a, b) => {
      if (consultantSort === 'price_desc') {
        return (b.salePrice || 0) - (a.salePrice || 0);
      }
      return (a.sku || '').localeCompare(b.sku || '');
    });

    return filtered.slice(0, 48);
  }, [products, debouncedConsultantSearch, consultantCategory, consultantSort]);

  return (
    <div className={`bg-slate-200/50 transition-all duration-300 ease-in-out ${showConsultant ? 'h-[380px]' : 'h-10'} flex flex-col border-t border-slate-200`}>
      <div
        className="h-14 bg-white flex items-center px-8 cursor-pointer hover:bg-slate-50 transition-all shrink-0 border-b border-slate-200 gap-8"
        onClick={() => setShowConsultant(!showConsultant)}
      >
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-[14px] font-black uppercase text-slate-800 tracking-tight">TƯ VẤN BÁN HÀNG</span>
        </div>

        {showConsultant ? (
          <div className="flex flex-1 items-center gap-4" onClick={e => e.stopPropagation()}>
            <div className="relative flex-1 max-w-xl group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                ref={searchRef}
                type="text"
                placeholder="(Shift + F3) Tìm kiếm"
                className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                value={consultantSearch}
                onChange={e => setConsultantSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative w-56">
                <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
                <select
                  className="w-full pl-10 pr-8 py-1.5 bg-white border border-indigo-400 rounded-lg text-xs font-bold text-indigo-600 outline-none appearance-none hover:bg-indigo-50 transition-all cursor-pointer shadow-sm"
                  value={consultantCategory}
                  onChange={e => setConsultantCategory(e.target.value)}
                >
                  <option value="All">Lọc theo nhóm hàng hóa</option>
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 pointer-events-none" />
              </div>

              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowConsultant(false);
                }}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all active:scale-95"
                title="Ẩn bảng tư vấn"
              >
                <ChevronDown className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 ml-auto">
            <span className="text-[9px] font-bold uppercase tracking-widest">Ấn để mở bảng tư vấn trực quan</span>
            <ChevronUp className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {showConsultant && (
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-6 auto-rows-[160px] gap-3 overflow-x-hidden animate-in fade-in slide-in-from-bottom-6 duration-500 custom-scrollbar">
          {filteredProducts.map(p => (
            <ProductMemoCard key={p.id} product={p} onAdd={addToCart} />
          ))}
        </div>
      )}
    </div>
  );
};

export default POSConsultant;
