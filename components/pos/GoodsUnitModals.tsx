import React from 'react';
import { X } from 'lucide-react';

type ViewModeUnit = {
  name: string;
  price: number;
  directSale: boolean;
};

interface GoodsBaseUnitModalProps {
  isOpen: boolean;
  name: string;
  price: number;
  directSale: boolean;
  setName: React.Dispatch<React.SetStateAction<string>>;
  setPrice: React.Dispatch<React.SetStateAction<number>>;
  setDirectSale: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onSave: (addMore: boolean) => void;
}

export const GoodsBaseUnitModal: React.FC<GoodsBaseUnitModalProps> = ({
  isOpen,
  name,
  price,
  directSale,
  setName,
  setPrice,
  setDirectSale,
  onClose,
  onSave,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Thêm đơn vị cơ bản</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Đơn vị cơ bản là đơn vị bán phổ biến nhất hoặc đơn vị chính dùng để quản lý tồn kho
          </p>

          <div>
            <label className="text-sm font-normal text-slate-900 mb-2 block">Tên đơn vị cơ bản</label>
            <input
              className="w-full px-3 py-2 border border-indigo-500 rounded-lg text-sm focus:outline-none focus:border-indigo-600"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tên đơn vị cơ bản"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-normal text-slate-900 mb-2 block">Giá bán</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-indigo-500"
              value={price}
              onChange={e => setPrice(Number(e.target.value))}
              placeholder="0"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="directSale"
              checked={directSale}
              onChange={e => setDirectSale(e.target.checked)}
              className="w-5 h-5 rounded border-indigo-500 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="directSale" className="text-sm font-normal text-slate-900">Bán trực tiếp</label>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors">
            Bỏ qua
          </button>
          <button onClick={() => onSave(true)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors">
            Xong & Thêm mới
          </button>
          <button onClick={() => onSave(false)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-normal hover:bg-indigo-700 transition-colors">
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};

interface GoodsViewUnitModalProps {
  isOpen: boolean;
  unit: ViewModeUnit;
  setUnit: React.Dispatch<React.SetStateAction<ViewModeUnit>>;
  onClose: () => void;
  onSave: (addMore: boolean) => void;
}

export const GoodsViewUnitModal: React.FC<GoodsViewUnitModalProps> = ({
  isOpen,
  unit,
  setUnit,
  onClose,
  onSave,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Thêm đơn vị cơ bản</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Đơn vị cơ bản là đơn vị nhỏ nhất dùng để quy đổi và tính toán tồn kho
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-normal text-slate-700 mb-2 block">Tên đơn vị cơ bản</label>
            <input
              type="text"
              autoFocus
              className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              value={unit.name}
              onChange={e => setUnit({ ...unit, name: e.target.value })}
              placeholder="Ví dụ: Cái, Hộp, Thùng..."
            />
          </div>

          <div>
            <label className="text-sm font-normal text-slate-700 mb-2 block">Giá bán</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-indigo-500"
              value={unit.price}
              onChange={e => setUnit({ ...unit, price: Number(e.target.value) })}
              placeholder="0"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="viewDirectSale"
              checked={unit.directSale}
              onChange={e => setUnit({ ...unit, directSale: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="viewDirectSale" className="text-sm font-normal text-slate-700">Bán trực tiếp</label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-normal text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Bỏ qua
          </button>
          <button onClick={() => onSave(true)} className="px-4 py-2 text-sm font-normal text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            Xong & Thêm mới
          </button>
          <button onClick={() => onSave(false)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-normal hover:bg-indigo-700 rounded-lg transition-colors">
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};
