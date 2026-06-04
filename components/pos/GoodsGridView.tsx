import React, { useRef, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import { POSProduct } from '../../types';

interface GoodsGridViewProps {
  products: POSProduct[];
  viewingProductId?: string | null;
  onToggleView: (product: POSProduct) => void;
  onCardWidthChange?: (width: number) => void;
}

const GoodsGridCard = React.memo(
  ({
    product,
    isSelected,
    onToggleView,
  }: {
    product: POSProduct;
    isSelected: boolean;
    onToggleView: (p: POSProduct) => void;
  }) => {
    const stockQty = product.stock ?? 0;
    const stockColor =
      stockQty <= 0
        ? 'text-red-500 bg-red-50'
        : stockQty <= 5
          ? 'text-amber-600 bg-amber-50'
          : 'text-emerald-600 bg-emerald-50';

    return (
      <button
        onClick={() => onToggleView(product)}
        className={`w-full bg-white rounded-2xl border transition-all active:scale-[0.98] overflow-hidden group flex flex-col h-full text-left ${
          isSelected
            ? 'border-indigo-300 shadow-md shadow-indigo-100'
            : 'border-slate-100 hover:border-indigo-200 hover:shadow-md shadow-sm'
        }`}
      >
        <div className="bg-slate-100/60 relative w-full aspect-square flex-shrink-0 flex items-center justify-center overflow-hidden">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <ShoppingBag className="h-10 w-10 text-slate-300" strokeWidth={1} />
          )}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-white/90 text-indigo-600 text-2xs font-normal rounded-full shadow-sm border border-indigo-100">
            {(product.salePrice || 0).toLocaleString('vi-VN')}đ
          </div>
          {product.isParent && product.variantCount && product.variantCount > 0 && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-normal rounded-full shadow-sm">
              {product.variantCount} biến thể
            </div>
          )}
          {product.status === 'Inactive' && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
              <span className="text-[9px] font-normal text-slate-400 bg-white/80 px-2 py-0.5 rounded-full">
                Ngừng KD
              </span>
            </div>
          )}
        </div>

        <div className="px-2.5 py-2 flex flex-col gap-1 flex-1">
          <p className="text-xs font-normal text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
            {product.name}
          </p>
          <div className="flex items-center justify-between mt-auto pt-1">
            {product.sku && (
              <span className="font-mono text-[9px] text-slate-400 truncate">{product.sku}</span>
            )}
            <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-full ml-auto ${stockColor}`}>
              Tồn: {stockQty}
            </span>
          </div>
        </div>
      </button>
    );
  }
);

GoodsGridCard.displayName = 'GoodsGridCard';

export const GoodsGridView: React.FC<GoodsGridViewProps> = ({
  products,
  viewingProductId,
  onToggleView,
  onCardWidthChange,
}) => {
  const firstCellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = firstCellRef.current;
    if (!el || !onCardWidthChange) return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) onCardWidthChange(width);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [onCardWidthChange]);

  if (products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-200" strokeWidth={1} />
          <p className="text-xs font-normal">Không tìm thấy sản phẩm nào</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
      {products.map((product, index) => (
        <div key={product.id} ref={index === 0 ? firstCellRef : undefined} className="w-full h-full">
          <GoodsGridCard
            product={product}
            isSelected={viewingProductId === product.id}
            onToggleView={onToggleView}
          />
        </div>
      ))}
    </div>
  );
};
