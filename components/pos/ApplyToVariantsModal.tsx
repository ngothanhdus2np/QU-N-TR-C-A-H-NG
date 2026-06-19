import React from 'react';
import { X } from 'lucide-react';
import { POSProduct } from '../../types';

interface ApplyToVariantsModalProps {
  isOpen: boolean;
  siblings: POSProduct[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ApplyToVariantsModal: React.FC<ApplyToVariantsModalProps> = ({
  isOpen,
  siblings,
  selectedIds,
  onToggle,
  onToggleAll,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const allChecked = siblings.length > 0 && selectedIds.length === siblings.length;
  const someChecked = selectedIds.length > 0 && !allChecked;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Áp dụng thay đổi cho hàng cùng loại</h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600"
              checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = someChecked; }}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
            <span className="text-sm font-medium text-slate-700">Chọn tất cả ({siblings.length} sản phẩm)</span>
          </label>
        </div>

        <div className="overflow-y-auto max-h-64 px-5 py-2 divide-y divide-slate-50">
          {siblings.map((product) => (
            <label key={product.id} className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-slate-50 -mx-5 px-5 transition-colors">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-indigo-600"
                checked={selectedIds.includes(product.id)}
                onChange={() => onToggle(product.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{product.name}</p>
                <p className="text-xs text-slate-400">{product.sku}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="border-t border-slate-200 px-5 py-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Bỏ qua
          </button>
          <button
            onClick={onConfirm}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Đồng ý ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};
