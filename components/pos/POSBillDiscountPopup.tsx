import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface POSBillDiscountPopupProps {
  rect: DOMRect | null;
  totalBeforeDiscount: number;
  discountValue: number;
  discountType: 'fixed' | 'percent';
  onUpdate: (updates: { discountValue?: number; discountType?: 'fixed' | 'percent' }) => void;
  onClose: () => void;
}

const POSBillDiscountPopup: React.FC<POSBillDiscountPopupProps> = ({
  rect,
  totalBeforeDiscount,
  discountValue,
  discountType,
  onUpdate,
  onClose,
}) => {
  useEffect(() => {
    if (!rect) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('bill-discount-popup');
      if (popup && !popup.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [!!rect, onClose]);

  if (!rect) return null;

  const popupH = 220;
  const top = rect.bottom + popupH > window.innerHeight ? rect.top - popupH - 8 : rect.bottom + 8;
  const left = Math.min(rect.left, window.innerWidth - 300 - 16);
  const previewDiscount = discountType === 'fixed' ? discountValue : Math.round(totalBeforeDiscount * discountValue / 100);

  return (
    <div
      id="bill-discount-popup"
      className="fixed z-[200] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[300px] p-4 animate-in fade-in zoom-in-95 duration-150"
      style={{ top, left }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Chiết khấu hóa đơn</span>
        <button onMouseDown={onClose} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Tiền hàng</span>
          <span className="font-bold text-slate-800">{totalBeforeDiscount.toLocaleString()}</span>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-0.5">
          <button
            onMouseDown={(e) => { e.preventDefault(); onUpdate({ discountType: 'fixed' }); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${discountType === 'fixed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >VNĐ</button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onUpdate({ discountType: 'percent' }); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${discountType === 'percent' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >%</button>
        </div>
        <input
          type="number"
          autoFocus
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
          value={discountValue || ''}
          onChange={(e) => onUpdate({ discountValue: Number(e.target.value) })}
          onKeyDown={(e) => { if (e.key === 'Enter') onClose(); }}
        />
        <div className="flex justify-between text-xs border-t border-slate-100 pt-2">
          <span className="text-slate-500">Cần thanh toán</span>
          <span className="font-black text-indigo-600 tabular-nums">
            {Math.max(0, totalBeforeDiscount - previewDiscount).toLocaleString()}
          </span>
        </div>
        <button
          onMouseDown={onClose}
          className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
        >Xác nhận</button>
      </div>
    </div>
  );
};

export default POSBillDiscountPopup;
