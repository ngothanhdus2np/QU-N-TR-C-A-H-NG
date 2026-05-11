import React from 'react';
import { History, Image as ImageIcon, Package, Plus, X } from 'lucide-react';
import { POSProduct } from '../../types';

interface GoodsProductFormProps {
  isOpen: boolean;
  formData: Partial<POSProduct>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<POSProduct>>>;
  onClose: () => void;
  onSave: () => void;
}

export const GoodsProductForm: React.FC<GoodsProductFormProps> = ({
  isOpen,
  formData,
  setFormData,
  onClose,
  onSave,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 bg-white border-b flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-600" />
            Thêm hàng hóa nhanh vào phiếu nhập
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="h-6 w-6 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <h3 className="font-black text-[10px] uppercase text-slate-400 flex items-center gap-2 italic"><Package className="h-3 w-3" /> Định danh & Tài chính</h3>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Tên sản phẩm *</label>
                    <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold outline-none focus:border-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Mã SKU *</label>
                      <input className="w-full p-2 bg-slate-50 border rounded-lg font-mono text-indigo-600 font-bold outline-none focus:border-indigo-500" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Giá nhập</label>
                      <input type="number" className="w-full p-2 bg-slate-50 border rounded-lg text-right font-black outline-none focus:border-indigo-500" value={formData.importPrice} onChange={e => setFormData({ ...formData, importPrice: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Giá bán lẻ</label>
                    <input type="number" className="w-full p-3 bg-indigo-50 border-indigo-100 border rounded-xl text-right font-black text-indigo-600 text-lg outline-none" value={formData.salePrice} onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <h3 className="font-black text-[10px] uppercase text-slate-400 flex items-center gap-2 italic"><History className="h-3 w-3" /> Phân loại & Quy cách</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Nhóm hàng</label><input className="w-full p-2 bg-slate-50 border rounded-lg outline-none" value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} placeholder="V.d: Mỹ phẩm" /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Thương hiệu</label><input className="w-full p-2 bg-slate-50 border rounded-lg outline-none" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} placeholder="V.d: Nike" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Đơn vị tính</label><input className="w-full p-2 bg-slate-50 border rounded-lg outline-none" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Tồn hiện tại</label><input type="number" className="w-full p-2 bg-slate-50 border rounded-lg text-right font-bold outline-none" value={formData.stock} onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })} /></div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <h3 className="font-black text-[10px] uppercase text-slate-400 flex items-center gap-2 italic"><ImageIcon className="h-3 w-3" /> Thông tin khác</h3>
                  <textarea rows={4} className="w-full p-3 bg-slate-50 border rounded-xl text-sm outline-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Mô tả sản phẩm..." />
                  <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 border rounded-lg font-black text-xs uppercase hover:bg-slate-50 transition-all">
            Hủy bỏ
          </button>
          <button onClick={onSave} className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black text-xs uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
            Lưu & Thêm vào phiếu
          </button>
        </div>
      </div>
    </div>
  );
};
