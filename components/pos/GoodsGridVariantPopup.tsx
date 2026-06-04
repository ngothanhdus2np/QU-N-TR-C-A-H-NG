import React from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { POSProduct } from '../../types';

interface GoodsGridVariantPopupProps {
  parent: POSProduct;
  variants: POSProduct[];
  cardWidth: number;
  onSelectVariant: (variant: POSProduct) => void;
  onClose: () => void;
}

const CARD_GAP = 12;
const POPUP_PADDING = 32;

export const GoodsGridVariantPopup: React.FC<GoodsGridVariantPopupProps> = ({
  parent,
  variants,
  cardWidth,
  onSelectVariant,
  onClose,
}) => {
  const cols = Math.min(variants.length, 5);
  const popupWidth = cols * cardWidth + (cols - 1) * CARD_GAP + POPUP_PADDING;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl shadow-slate-300/60 overflow-hidden"
        style={{ width: popupWidth, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-2xs font-normal text-slate-400 uppercase tracking-wide">
              Chọn biến thể
            </p>
            <h3 className="text-sm font-normal text-slate-800 mt-0.5 truncate">{parent.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {variants.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 italic">
              Không có biến thể nào
            </p>
          ) : (
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${cardWidth}px)`,
                gap: CARD_GAP,
              }}
            >
              {variants.map(variant => {
                const stock = variant.stock ?? 0;
                const stockColor =
                  stock <= 0
                    ? 'text-red-500'
                    : stock <= 5
                      ? 'text-amber-600'
                      : 'text-emerald-600';

                return (
                  <button
                    key={variant.id}
                    onClick={() => onSelectVariant(variant)}
                    className="flex flex-col items-center bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-xl p-2 transition-all active:scale-[0.97]"
                    style={{ width: cardWidth }}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center mb-2">
                      {variant.images?.[0] ? (
                        <img
                          src={variant.images[0]}
                          alt={variant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-slate-300" strokeWidth={1} />
                      )}
                    </div>
                    <p className="text-2xs font-normal text-slate-700 line-clamp-2 leading-tight text-center w-full">
                      {variant.name}
                    </p>
                    <p className="text-2xs font-normal text-indigo-600 mt-1">
                      {(variant.salePrice || 0).toLocaleString('vi-VN')}đ
                    </p>
                    <p className={`text-[9px] font-normal mt-0.5 ${stockColor}`}>
                      Tồn: {stock}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
