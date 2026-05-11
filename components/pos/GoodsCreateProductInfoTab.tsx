import React from 'react';
import { ChevronRight, Image as ImageIcon, Trash2, X } from 'lucide-react';
import { POSProduct } from '../../types';
import { generateId } from '../../businessLogic';

interface GoodsCreateProductInfoTabProps {
  formData: Partial<POSProduct>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<POSProduct>>>;
  showStockSection: boolean;
  setShowStockSection: React.Dispatch<React.SetStateAction<boolean>>;
  showLocationSection: boolean;
  setShowLocationSection: React.Dispatch<React.SetStateAction<boolean>>;
  showUnitsSection: boolean;
  setShowUnitsSection: React.Dispatch<React.SetStateAction<boolean>>;
  addBaseUnit: () => void;
}

export const GoodsCreateProductInfoTab: React.FC<GoodsCreateProductInfoTabProps> = ({
  formData,
  setFormData,
  showStockSection,
  setShowStockSection,
  showLocationSection,
  setShowLocationSection,
  showUnitsSection,
  setShowUnitsSection,
  addBaseUnit,
}) => (
  <div className="space-y-4">
    <div className="flex gap-6">
      <div className="w-32 shrink-0">
        <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
          <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
          <span className="text-xs text-slate-500 font-semibold">Thêm ảnh</span>
          <span className="text-[10px] text-slate-400 mt-1">Mỗi ảnh không quá 2 MB</span>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-2 block">Mã hàng</label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            value={formData.sku}
            onChange={e => setFormData({ ...formData, sku: e.target.value })}
            placeholder="Tự động"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-2 block">Tên hàng <span className="text-rose-500">*</span></label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Bắt buộc"
          />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-2 block">*Nhóm hàng</label>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            value={formData.categoryId}
            onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
            placeholder="Chọn nhóm hàng (Bắt buộc)"
          />
          <button className="px-3 py-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50 rounded-lg transition-colors">
            Tạo mới
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-2 block">Thương hiệu</label>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            value={formData.brand}
            onChange={e => setFormData({ ...formData, brand: e.target.value })}
            placeholder="Chọn thương hiệu"
          />
          <button className="px-3 py-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50 rounded-lg transition-colors">
            Tạo mới
          </button>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-2 block">Giá vốn</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-indigo-500"
          value={formData.importPrice}
          onChange={e => setFormData({ ...formData, importPrice: Number(e.target.value) })}
          placeholder="0"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-700">Giá bán</label>
          <button className="px-2 py-1 text-xs text-indigo-600 font-semibold hover:bg-indigo-50 rounded transition-colors flex items-center gap-1">
            🔗 Thiết lập giá
          </button>
        </div>
        <input
          type="number"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-indigo-500"
          value={formData.salePrice}
          onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })}
          placeholder="0"
        />
      </div>
    </div>

    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setShowStockSection(!showStockSection)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">Tồn kho</span>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showStockSection ? 'rotate-90' : ''}`} />
      </button>
      {showStockSection && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mt-3">Quy tắc tự động tính tồn kho và định mức tồn, khi bán hàng hoặc nhập hàng, tồn kho sẽ tự động được cập nhật theo số lượng đã bán hoặc nhập.</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Tồn kho</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-indigo-500"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Định mức tồn tối thiểu</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-indigo-500"
                value={formData.minStock}
                onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Định mức tồn cao nhất</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-indigo-500"
                value={formData.maxStock}
                onChange={e => setFormData({ ...formData, maxStock: Number(e.target.value) })}
                placeholder="999,999,999"
              />
            </div>
          </div>
        </div>
      )}
    </div>

    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-semibold text-slate-700">Tích điểm</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={formData.allowPoints}
          onChange={e => setFormData({ ...formData, allowPoints: e.target.checked })}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
      </label>
    </div>

    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setShowLocationSection(!showLocationSection)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">Vị trí, trọng lượng</span>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showLocationSection ? 'rotate-90' : ''}`} />
      </button>
      {showLocationSection && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mt-3">Quy tắc tự động tính vị trí hàng hoá theo vị trí lưu trữ, khi bán hàng hoặc nhập hàng, vị trí sẽ tự động được cập nhật.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Vị trí</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Chọn vị trí"
                />
                <button className="px-3 py-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50 rounded-lg transition-colors">
                  Tạo mới
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Trọng lượng</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  value={formData.weight}
                  onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                  placeholder="0"
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
      )}
    </div>

    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setShowUnitsSection(!showUnitsSection)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">Quyền theo đơn vị tính và thuộc tính</span>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showUnitsSection ? 'rotate-90' : ''}`} />
      </button>
      {showUnitsSection && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-200">
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">Đơn vị tính</h4>
            <p className="text-xs text-slate-500 mb-3">
              Thêm đơn vị bán hoặc nhập như chai, lốc, thùng. Đặt công thức quy đổi để tính nhanh giá và tồn kho. Ví dụ: 1 lốc = 4 chai, 1 thùng = 20 lốc.
            </p>
            <button onClick={addBaseUnit} className="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
              + Thêm đơn vị cơ bản
            </button>

            {formData.units && formData.units.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.units.map((unit, idx) => (
                  <div key={unit.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-sm font-semibold text-slate-700 flex-1">{unit.name}</span>
                    <span className="text-xs text-slate-500">Hệ số: {unit.factor}</span>
                    <span className="text-sm font-semibold text-slate-700">{unit.price.toLocaleString()}đ</span>
                    <button
                      onClick={() => setFormData({ ...formData, units: formData.units?.filter((_, i) => i !== idx) })}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">Thuộc tính</h4>
            <p className="text-xs text-slate-500 mb-3">
              Thêm đặc điểm như hương vị, dung tích, màu sắc
            </p>

            <div className="space-y-2">
              {(!formData.attributes || formData.attributes.length === 0) ? (
                <div className="flex gap-2 items-center">
                  <select className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 h-[38px]" defaultValue="">
                    <option value="">Chọn thuộc tính</option>
                    <option value="Màu sắc">Màu sắc</option>
                    <option value="Kích thước">Kích thước</option>
                    <option value="Hương vị">Hương vị</option>
                    <option value="Dung tích">Dung tích</option>
                  </select>

                  <div className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus-within:border-indigo-500 h-[38px] flex items-center gap-1 flex-wrap">
                    <input className="flex-1 min-w-[100px] outline-none text-sm" placeholder="Nhập giá trị thuộc tính và enter" />
                  </div>

                  <button className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg h-[38px] whitespace-nowrap">
                    Chọn nhanh
                  </button>

                  <button className="p-2 text-slate-400 hover:text-rose-600 h-[38px] w-[38px] flex items-center justify-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                formData.attributes.map((attr, idx) => (
                  <div key={attr.id} className="flex gap-2 items-center">
                    <select
                      className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 h-[38px]"
                      value={attr.name}
                      onChange={e => {
                        const newAttrs = [...(formData.attributes || [])];
                        newAttrs[idx] = { ...newAttrs[idx], name: e.target.value };
                        setFormData({ ...formData, attributes: newAttrs });
                      }}
                    >
                      <option value="">Chọn thuộc tính</option>
                      <option value="Màu sắc">Màu sắc</option>
                      <option value="Kích thước">Kích thước</option>
                      <option value="Hương vị">Hương vị</option>
                      <option value="Dung tích">Dung tích</option>
                    </select>

                    <div className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-sm focus-within:border-indigo-500 min-h-[38px] flex items-center gap-1 flex-wrap">
                      {attr.values.map((val, valIdx) => (
                        <span key={valIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm font-semibold text-slate-700">
                          {val}
                          <button
                            onClick={() => {
                              const newAttrs = [...(formData.attributes || [])];
                              newAttrs[idx] = {
                                ...newAttrs[idx],
                                values: newAttrs[idx].values.filter((_, i) => i !== valIdx)
                              };
                              setFormData({ ...formData, attributes: newAttrs });
                            }}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        className="flex-1 min-w-[100px] outline-none text-sm py-1"
                        placeholder="Nhập giá trị và enter"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (value) {
                              const newAttrs = [...(formData.attributes || [])];
                              newAttrs[idx] = {
                                ...newAttrs[idx],
                                values: [...newAttrs[idx].values, value]
                              };
                              setFormData({ ...formData, attributes: newAttrs });
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </div>

                    <button className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg h-[38px] whitespace-nowrap">
                      Chọn nhanh
                    </button>

                    <button
                      onClick={() => setFormData({ ...formData, attributes: formData.attributes?.filter((_, i) => i !== idx) })}
                      className="p-2 text-slate-400 hover:text-rose-600 h-[38px] w-[38px] flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => {
                setFormData({
                  ...formData,
                  attributes: [...(formData.attributes || []), {
                    id: generateId(),
                    name: '',
                    values: []
                  }]
                });
              }}
              className="mt-3 text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1"
            >
              + Thêm thuộc tính
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);
