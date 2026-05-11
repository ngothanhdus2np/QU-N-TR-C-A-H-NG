import React from 'react';
import { ChevronRight, Info, X } from 'lucide-react';
import { POSProduct } from '../../types';

export type CreateProductModalTab = 'info' | 'desc' | 'warranty';

interface GoodsCreateProductModalProps {
  isOpen: boolean;
  editingProduct: POSProduct | null;
  activeTab: CreateProductModalTab;
  setActiveTab: React.Dispatch<React.SetStateAction<CreateProductModalTab>>;
  onClose: () => void;
  onSaveAndCreateMore: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

export const GoodsCreateProductModal: React.FC<GoodsCreateProductModalProps> = ({
  isOpen,
  editingProduct,
  activeTab,
  setActiveTab,
  onClose,
  onSaveAndCreateMore,
  onSave,
  children,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {editingProduct ? 'Chỉnh sửa hàng hóa' : 'Tạo hàng hóa'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex px-6">
            {[
              { id: 'info', label: 'Thông tin' },
              { id: 'desc', label: 'Mô tả' },
              { id: 'warranty', label: 'Bảo hành, bảo trì' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as CreateProductModalTab)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-slate-300" />
            <span className="text-sm text-slate-600">Bán trực tiếp</span>
            <button className="text-slate-400 hover:text-slate-600">
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Bỏ qua
            </button>
            <button
              onClick={onSaveAndCreateMore}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              Lưu & Tạo thêm hàng
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={onSave}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              {editingProduct ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
