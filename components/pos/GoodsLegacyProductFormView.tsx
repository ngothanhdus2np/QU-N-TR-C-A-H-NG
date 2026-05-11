import React from 'react';
import {
  ArrowLeft, ChevronRight, Edit2, FileText, Grid3X3,
  Image as ImageIcon, Info, Package, Plus, Printer, X
} from 'lucide-react';
import { POSProduct } from '../../types';

type ProductFormTab = 'info' | 'desc' | 'warranty' | 'units' | 'related' | 'channels';

interface GoodsLegacyProductFormViewProps {
  formData: Partial<POSProduct>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<POSProduct>>>;
  editingProduct: POSProduct | null;
  activeFormTab: ProductFormTab;
  setActiveFormTab: React.Dispatch<React.SetStateAction<ProductFormTab>>;
  onBack: () => void;
  onSave: () => void;
  onAddConversionUnit: () => void;
}

const TABS: { id: ProductFormTab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'info', label: 'Thông tin', icon: Info },
  { id: 'desc', label: 'Mô tả, ghi chú', icon: FileText },
  { id: 'warranty', label: 'Thẻ kho', icon: Package },
  { id: 'units', label: 'Tồn kho', icon: Grid3X3 },
  { id: 'related', label: 'Hàng hóa cùng loại', icon: Package },
  { id: 'channels', label: 'Liên kết kênh bán', icon: Package }
];

export const GoodsLegacyProductFormView: React.FC<GoodsLegacyProductFormViewProps> = ({
  formData,
  setFormData,
  editingProduct,
  activeFormTab,
  setActiveFormTab,
  onBack,
  onSave,
  onAddConversionUnit
}) => (
  <div className="h-full flex flex-col bg-white">
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{formData.name || 'Sản phẩm mới'}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span>Nhóm hàng: <span className="font-semibold">{formData.categoryId || 'Chưa phân loại'}</span></span>
                <span className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${formData.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  {formData.status === 'Active' ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2">
            <X className="h-4 w-4" />
            Xóa
          </button>
          <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sao chép
          </button>
          <button onClick={onSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            Chỉnh sửa
          </button>
          <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2">
            <Printer className="h-4 w-4" />
            In tem mã
          </button>
          <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
            <span className="text-lg">...</span>
          </button>
        </div>
      </div>
    </div>

    <div className="border-b border-slate-200 bg-white">
      <div className="flex items-center gap-1 px-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFormTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeFormTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>

    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      {activeFormTab === 'info' && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex gap-6">
              <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 text-slate-400 mx-auto mb-1" />
                  <button className="text-xs text-indigo-600 font-semibold hover:underline">Xem phần tích</button>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Tên hàng hóa</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nhập tên hàng hóa"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Nhóm hàng</label>
                    <div className="relative">
                      <input
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        value={formData.categoryId}
                        onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                        placeholder="Chọn nhóm hàng"
                      />
                      <ChevronRight className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 rotate-90" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Hàng hóa thương</label>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded border-slate-300" />
                      <span className="text-sm text-slate-600">Bán trực tiếp</span>
                      <input type="checkbox" className="rounded border-slate-300 ml-4" />
                      <span className="text-sm text-slate-600">Tích điểm</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Mã hàng</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-indigo-500"
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Giá bán</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-indigo-500"
                    value={formData.salePrice}
                    onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Thương hiệu</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Chưa có"
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Nhà cung cấp</h3>
                <div className="text-sm text-slate-500">HÀ LÊ</div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Tồn kho</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-indigo-500"
                      value={formData.stock}
                      onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                      disabled={!!editingProduct}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Định mức tồn</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-indigo-500"
                      value={formData.minStock}
                      onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                      placeholder="0 - 999,999,999"
                    />
                  </div>
                  <div className="flex items-end">
                    <span className="text-xs text-slate-500 mb-3">0 - 999,999,999</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Giá vốn</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-indigo-500"
                    value={formData.importPrice}
                    onChange={e => setFormData({ ...formData, importPrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Vị trí</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Chưa có"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Trọng lượng</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      value={formData.weight}
                      onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                      placeholder="Chưa có"
                    />
                    <select
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      value={formData.weightUnit}
                      onChange={e => setFormData({ ...formData, weightUnit: e.target.value })}
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <button className="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Thêm đơn vị tính
            </button>
          </div>
        </div>
      )}

      {activeFormTab === 'desc' && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Mô tả chi tiết</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 min-h-[200px]"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Nhập mô tả sản phẩm..."
            />
          </div>
        </div>
      )}

      {activeFormTab === 'warranty' && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Thông tin bảo hành</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 min-h-[150px]"
              value={formData.warranty}
              onChange={e => setFormData({ ...formData, warranty: e.target.value })}
              placeholder="Nhập thông tin bảo hành..."
            />
          </div>
        </div>
      )}

      {activeFormTab === 'units' && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Đơn vị tính quy đổi</h3>
              <button
                onClick={onAddConversionUnit}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Thêm đơn vị
              </button>
            </div>
            <div className="space-y-2">
              {(formData.units || []).map((unit) => (
                <div key={unit.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-semibold text-slate-700 flex-1">{unit.name}</span>
                  <span className="text-sm text-slate-500">Hệ số: {unit.factor}</span>
                  <span className="text-sm text-slate-700 font-semibold">{unit.price.toLocaleString()}đ</span>
                </div>
              ))}
              {(!formData.units || formData.units.length === 0) && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Chưa có đơn vị quy đổi nào
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(activeFormTab === 'related' || activeFormTab === 'channels') && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center py-12">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Tính năng đang phát triển</p>
          </div>
        </div>
      )}
    </div>
  </div>
);
