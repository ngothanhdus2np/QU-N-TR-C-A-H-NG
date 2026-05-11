import React from 'react';
import { Trash2 } from 'lucide-react';

interface GoodsBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
}

export const GoodsBulkActions: React.FC<GoodsBulkActionsProps> = ({
  selectedCount,
  onClearSelection,
  onBulkDelete,
}) => {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 px-6 py-4 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-8">
      <div className="flex items-center gap-3 border-r border-slate-200 pr-6">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm">
          {selectedCount}
        </div>
        <span className="text-sm font-bold text-slate-600">đã chọn</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onClearSelection} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
          Bỏ chọn
        </button>
        <button onClick={onBulkDelete} className="px-4 py-2 flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-sm font-bold transition-all">
          <Trash2 className="w-4 h-4" />
          Xóa đã chọn
        </button>
      </div>
    </div>
  );
};
