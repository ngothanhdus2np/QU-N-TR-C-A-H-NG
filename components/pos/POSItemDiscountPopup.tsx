import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type ItemDiscountPopupState = {
  productId: string;
  price: number;
  discount: number;
  rect: DOMRect;
};

interface POSItemDiscountPopupProps {
  popup: ItemDiscountPopupState | null;
  onConfirm: (productId: string, discountAmount: number) => void;
  onClose: () => void;
}

const POSItemDiscountPopup: React.FC<POSItemDiscountPopupProps> = ({ popup, onConfirm, onClose }) => {
  const [input, setInput] = useState(0);
  const [type, setType] = useState<'fixed' | 'percent'>('fixed');
  const commitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!popup) return;
    setInput(popup.discount);
    setType('fixed');
  }, [popup]);

  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('item-discount-popup');
      if (el && !el.contains(e.target as Node)) commitRef.current();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [!!popup]);

  if (!popup) return null;

  const { productId, price, rect } = popup;
  const discountAmount = type === 'fixed' ? input : Math.round(price * input / 100);
  const effectivePrice = Math.max(0, price - discountAmount);

  commitRef.current = () => {
    onConfirm(productId, discountAmount);
    onClose();
  };

  const popupH = 180;
  const top = rect.bottom + popupH > window.innerHeight ? rect.top - popupH - 8 : rect.bottom + 8;
  const left = Math.min(rect.left, window.innerWidth - 280 - 16);

  return (
    <div
      id="item-discount-popup"
      className="fixed z-modal bg-white rounded-2xl shadow-2xl border border-slate-200 w-[280px] p-4 animate-in fade-in zoom-in-95 duration-150"
      style={{ top, left }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-normal text-slate-700 uppercase tracking-wider">Giảm giá sản phẩm</span>
        <button onMouseDown={() => commitRef.current()} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Đơn giá</span>
          <span className="font-normal text-slate-800">{price.toLocaleString()}</span>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-0.5">
          <button
            onMouseDown={(e) => { e.preventDefault(); setType('fixed'); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-normal transition-colors ${type === 'fixed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >VNĐ</button>
          <button
            onMouseDown={(e) => { e.preventDefault(); setType('percent'); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-normal transition-colors ${type === 'percent' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >%</button>
        </div>
        <input
          type="number"
          autoFocus
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
          value={input || ''}
          onChange={(e) => setInput(Number(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') commitRef.current(); }}
        />
        <div className="flex justify-between text-xs border-t border-slate-100 pt-2">
          <span className="text-slate-500">Giá bán</span>
          <span className="font-normal text-indigo-600 tabular-nums">{effectivePrice.toLocaleString()}</span>
        </div>
        <button
          onMouseDown={() => commitRef.current()}
          className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-normal uppercase tracking-wider transition-colors"
        >Xác nhận</button>
      </div>
    </div>
  );
};

export default POSItemDiscountPopup;
