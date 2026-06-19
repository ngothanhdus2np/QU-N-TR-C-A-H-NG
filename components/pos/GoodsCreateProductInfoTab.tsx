import React from 'react';
import { ChevronRight, Image as ImageIcon, Info, Link2, Trash2, X } from 'lucide-react';
import { POSProduct, ProductGroup } from '../../types';
import { AUTO_SKU_PLACEHOLDER, generateId, isAutoSkuValue } from '../../src/lib';
import { GoodsPriceSetupModal } from './GoodsPriceSetupModal';
import ProductGroupTreePicker from '../shared/ProductGroupTreePicker';

const GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY = 'goods_barcode_manual_mode';
const GOODS_BARCODE_MODE_CHANGED_EVENT = 'goods-barcode-mode-changed';

const getGoodsBarcodeManualMode = () => {
  try {
    return localStorage.getItem(GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

interface GoodsCreateProductInfoTabProps {
  products: POSProduct[];
  productGroups: ProductGroup[];
  editingProduct: POSProduct | null;
  formData: Partial<POSProduct>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<POSProduct>>>;
  showStockSection: boolean;
  setShowStockSection: React.Dispatch<React.SetStateAction<boolean>>;
  showLocationSection: boolean;
  setShowLocationSection: React.Dispatch<React.SetStateAction<boolean>>;
  showUnitsSection: boolean;
  setShowUnitsSection: React.Dispatch<React.SetStateAction<boolean>>;
  addBaseUnit: () => void;
  applyToVariants?: boolean;
  onApplyToVariantsChange?: (checked: boolean) => void;
}

export const GoodsCreateProductInfoTab: React.FC<GoodsCreateProductInfoTabProps> = ({
  products,
  productGroups,
  editingProduct,
  formData,
  setFormData,
  showStockSection,
  setShowStockSection,
  showLocationSection,
  setShowLocationSection,
  showUnitsSection,
  setShowUnitsSection,
  addBaseUnit,
  applyToVariants,
  onApplyToVariantsChange,
}) => {
  const [showPriceSetup, setShowPriceSetup] = React.useState(false);
  const [barcodeManualMode, setBarcodeManualMode] = React.useState(getGoodsBarcodeManualMode);
  const [firstAttributeDraft, setFirstAttributeDraft] = React.useState({
    name: '',
    values: [] as string[],
    currentValue: '',
  });
  const [attributeValueDrafts, setAttributeValueDrafts] = React.useState<Record<string, string>>({});
  const [quickSelectAttributeId, setQuickSelectAttributeId] = React.useState<string | null>(null);

  const attributeQuickValues = React.useMemo(() => {
    const valuesByName = new Map<string, Set<string>>();
    const addValue = (name?: string, value?: string) => {
      const cleanName = String(name || '').trim();
      const cleanValue = String(value || '').trim();
      if (!cleanName || !cleanValue) return;

      const key = cleanName.toLocaleLowerCase('vi-VN');
      if (!valuesByName.has(key)) valuesByName.set(key, new Set());
      valuesByName.get(key)?.add(cleanValue);
    };

    products.forEach(product => {
      (product.attributes || []).forEach(attribute => {
        attribute.values.forEach(value => addValue(attribute.name, value));
      });

      Object.entries(product.variantAttributes || {}).forEach(([name, value]) => {
        addValue(name, value);
      });
    });

    (formData.attributes || []).forEach(attribute => {
      attribute.values.forEach(value => addValue(attribute.name, value));
    });

    firstAttributeDraft.values.forEach(value => addValue(firstAttributeDraft.name, value));

    return valuesByName;
  }, [firstAttributeDraft.name, firstAttributeDraft.values, formData.attributes, products]);

  const getQuickValues = (attributeName?: string) => {
    const key = String(attributeName || '').trim().toLocaleLowerCase('vi-VN');
    return Array.from(attributeQuickValues.get(key) || []).sort((a, b) => a.localeCompare(b, 'vi-VN'));
  };

  React.useEffect(() => {
    const handleBarcodeModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ manualMode?: boolean }>).detail;
      setBarcodeManualMode(
        typeof detail?.manualMode === 'boolean' ? detail.manualMode : getGoodsBarcodeManualMode()
      );
    };

    window.addEventListener(GOODS_BARCODE_MODE_CHANGED_EVENT, handleBarcodeModeChanged);
    return () => window.removeEventListener(GOODS_BARCODE_MODE_CHANGED_EVENT, handleBarcodeModeChanged);
  }, []);

  React.useEffect(() => {
    if (editingProduct) return;

    setFormData(prev => {
      const sku = String(prev.sku || '').trim();
      if (barcodeManualMode && isAutoSkuValue(sku)) {
        return { ...prev, sku: '' };
      }
      if (!barcodeManualMode && !sku) {
        return { ...prev, sku: AUTO_SKU_PLACEHOLDER };
      }
      return prev;
    });
  }, [barcodeManualMode, editingProduct, setFormData]);

  return (
    <div className="space-y-4">
      <GoodsPriceSetupModal
        isOpen={showPriceSetup}
        products={products}
        productGroups={productGroups}
        currentProduct={formData}
        editingProduct={editingProduct}
        onClose={() => setShowPriceSetup(false)}
        onApplyPrice={price => setFormData(prev => ({ ...prev, salePrice: price }))}
      />

    <div className="flex items-stretch gap-6">
      <div className="w-48 shrink-0">
        <div className="flex h-full min-h-[154px] w-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:bg-slate-100">
          <ImageIcon className="h-9 w-9 text-slate-400 mb-2" />
          <span className="text-xs text-slate-500 font-normal">Thêm ảnh</span>
          <span className="text-2xs text-slate-400 mt-1">Mỗi ảnh không quá 2 MB</span>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-normal text-slate-700">
            Mã hàng {barcodeManualMode && <span className="text-rose-500">*</span>}
            <span className="group relative inline-flex h-4 w-4 items-center justify-center text-slate-400">
              <Info className="h-3.5 w-3.5" />
              <span className="pointer-events-none absolute left-1/2 top-full z-modal mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 shadow-xl group-hover:block">
                Vào Cài đặt &gt; Hàng hóa &gt; Mã vạch hàng hóa và tắt chế độ nhập tay nếu muốn hệ thống sinh mã hàng tự động.
              </span>
            </span>
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            value={formData.sku}
            onChange={e => setFormData({ ...formData, sku: e.target.value })}
            placeholder={barcodeManualMode ? 'Nhập hoặc quét mã hàng bạn đang có' : 'Tự động'}
          />
          <p className="mt-1 text-xs font-normal text-slate-400">
            {barcodeManualMode
              ? 'Nhập hoặc quét mã hàng bạn đang có. Bắt buộc khi bật mã vạch hàng hóa.'
              : 'Mã hàng này cũng được dùng để sinh barcode và in tem mã.'}
          </p>
        </div>
        <div>
          <label className="text-sm font-normal text-slate-700 mb-2 block">Tên hàng <span className="text-rose-500">*</span></label>
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
        <label className="text-sm font-normal text-slate-700 mb-2 block">*Nhóm hàng</label>
        <div className="flex gap-2">
          <ProductGroupTreePicker
            groups={productGroups}
            selectedPaths={formData.categoryPath || formData.categoryId ? [formData.categoryPath || formData.categoryId || ''] : []}
            onSelectionChange={paths => {
              const categoryPath = paths[paths.length - 1] || '';
              setFormData({ ...formData, categoryId: categoryPath, categoryPath });
            }}
            placeholder="Chọn nhóm hàng (Bắt buộc)"
            className="flex-1"
          />
          <button className="px-3 py-2 text-sm text-indigo-600 font-normal hover:bg-indigo-50 rounded-lg transition-colors">
            Tạo mới
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm font-normal text-slate-700 mb-2 block">Thương hiệu</label>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            value={formData.brand}
            onChange={e => setFormData({ ...formData, brand: e.target.value })}
            placeholder="Chọn thương hiệu"
          />
          <button className="px-3 py-2 text-sm text-indigo-600 font-normal hover:bg-indigo-50 rounded-lg transition-colors">
            Tạo mới
          </button>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-normal text-slate-700 mb-2 block">Giá vốn</label>
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
          <label className="text-sm font-normal text-slate-700">Giá bán</label>
          <button
            type="button"
            onClick={() => setShowPriceSetup(true)}
            className="px-2 py-1 text-xs text-indigo-600 font-normal hover:bg-indigo-50 rounded transition-colors flex items-center gap-1"
          >
            <Link2 className="h-3.5 w-3.5" />
            Thiết lập giá
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
        <span className="text-sm font-normal text-slate-700">Tồn kho</span>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showStockSection ? 'rotate-90' : ''}`} />
      </button>
      {showStockSection && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mt-3">Quy tắc tự động tính tồn kho và định mức tồn, khi bán hàng hoặc nhập hàng, tồn kho sẽ tự động được cập nhật theo số lượng đã bán hoặc nhập.</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-normal text-slate-700 mb-2 block">Tồn kho</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-indigo-500"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-normal text-slate-700 mb-2 block">Định mức tồn tối thiểu</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-indigo-500"
                value={formData.minStock}
                onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-normal text-slate-700 mb-2 block">Định mức tồn cao nhất</label>
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
      <span className="text-sm font-normal text-slate-700">Tích điểm</span>
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
        <span className="text-sm font-normal text-slate-700">Vị trí, trọng lượng</span>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showLocationSection ? 'rotate-90' : ''}`} />
      </button>
      {showLocationSection && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mt-3">Quy tắc tự động tính vị trí hàng hoá theo vị trí lưu trữ, khi bán hàng hoặc nhập hàng, vị trí sẽ tự động được cập nhật.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-normal text-slate-700 mb-2 block">Vị trí</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Chọn vị trí"
                />
                <button className="px-3 py-2 text-sm text-indigo-600 font-normal hover:bg-indigo-50 rounded-lg transition-colors">
                  Tạo mới
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-normal text-slate-700 mb-2 block">Trọng lượng</label>
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
        <span className="text-sm font-normal text-slate-700">Quyền theo đơn vị tính và thuộc tính</span>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showUnitsSection ? 'rotate-90' : ''}`} />
      </button>
      {showUnitsSection && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-200">
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">Đơn vị tính</h4>
            <p className="text-xs text-slate-500 mb-3">
              Thêm đơn vị bán hoặc nhập như chai, lốc, thùng. Đặt công thức quy đổi để tính nhanh giá và tồn kho. Ví dụ: 1 lốc = 4 chai, 1 thùng = 20 lốc.
            </p>
            <button onClick={addBaseUnit} className="text-sm text-indigo-600 font-normal hover:underline flex items-center gap-1">
              + Thêm đơn vị cơ bản
            </button>

            {formData.units && formData.units.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.units.map((unit, idx) => (
                  <div key={unit.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-sm font-normal text-slate-700 flex-1">{unit.name}</span>
                    <span className="text-xs text-slate-500">Hệ số: {unit.factor}</span>
                    <span className="text-sm font-normal text-slate-700">{unit.price.toLocaleString()}đ</span>
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
                  <select
                    className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 h-[38px]"
                    value={firstAttributeDraft.name}
                    onChange={e => setFirstAttributeDraft(prev => ({ ...prev, name: e.target.value }))}
                  >
                    <option value="">Chọn thuộc tính</option>
                    <option value="Màu sắc">Màu sắc</option>
                    <option value="Kích thước">Kích thước</option>
                    <option value="Hương vị">Hương vị</option>
                    <option value="Dung tích">Dung tích</option>
                  </select>

                  <div className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus-within:border-indigo-500 h-[38px] flex items-center gap-1 flex-wrap">
                    {firstAttributeDraft.values.map((val, valIdx) => (
                      <span key={valIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm font-normal text-slate-700">
                        {val}
                        <button
                          type="button"
                          onClick={() => setFirstAttributeDraft(prev => ({
                            ...prev,
                            values: prev.values.filter((_, i) => i !== valIdx),
                          }))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      className="flex-1 min-w-[100px] outline-none text-sm"
                      disabled={!firstAttributeDraft.name}
                      value={firstAttributeDraft.currentValue}
                      onChange={e => setFirstAttributeDraft(prev => ({ ...prev, currentValue: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const value = firstAttributeDraft.currentValue.trim();
                          if (!value) return;
                          setFirstAttributeDraft(prev => ({
                            ...prev,
                            values: [...prev.values, value],
                            currentValue: '',
                          }));
                        }
                      }}
                      placeholder={firstAttributeDraft.name ? 'Nhập giá trị thuộc tính và enter' : 'Chọn thuộc tính trước'}
                    />
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      disabled={!firstAttributeDraft.name}
                      onClick={() => setQuickSelectAttributeId(prev => prev === '__first__' ? null : '__first__')}
                      className={`px-3 py-2 text-sm border rounded-lg h-[38px] whitespace-nowrap ${
                        firstAttributeDraft.name
                          ? 'text-slate-600 hover:text-slate-800 border-slate-300'
                          : 'text-slate-300 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                    Chọn nhanh
                    </button>
                    {quickSelectAttributeId === '__first__' && firstAttributeDraft.name && (
                      <div className="absolute right-0 top-full z-modal mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                        <div className="max-h-56 overflow-y-auto p-2">
                          {getQuickValues(firstAttributeDraft.name).length > 0 ? (
                            getQuickValues(firstAttributeDraft.name).map(value => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  setFirstAttributeDraft(prev => ({
                                    ...prev,
                                    values: prev.values.includes(value) ? prev.values : [...prev.values, value],
                                  }));
                                  setQuickSelectAttributeId(null);
                                }}
                                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                {value}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-slate-400">Chưa có giá trị đã lưu</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setFirstAttributeDraft({ name: '', values: [], currentValue: '' })}
                    className="p-2 text-slate-400 hover:text-rose-600 h-[38px] w-[38px] flex items-center justify-center"
                  >
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
	                        <span key={valIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm font-normal text-slate-700">
	                          {val}
	                          <button
	                            type="button"
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
	                        disabled={!attr.name}
	                        value={attributeValueDrafts[attr.id] || ''}
	                        onChange={e => setAttributeValueDrafts(prev => ({
	                          ...prev,
	                          [attr.id]: e.target.value,
	                        }))}
	                        placeholder={attr.name ? 'Nhập giá trị và enter' : 'Chọn thuộc tính trước'}
	                        onKeyDown={e => {
	                          if (e.key === 'Enter') {
	                            e.preventDefault();
	                            const value = (attributeValueDrafts[attr.id] || '').trim();
	                            if (value) {
	                              const newAttrs = [...(formData.attributes || [])];
	                              newAttrs[idx] = {
                                ...newAttrs[idx],
	                                values: [...newAttrs[idx].values, value]
	                              };
	                              setFormData({ ...formData, attributes: newAttrs });
	                              setAttributeValueDrafts(prev => ({ ...prev, [attr.id]: '' }));
	                            }
	                          }
	                        }}
	                      />
	                    </div>

	                    <div className="relative">
	                      <button
	                        type="button"
	                        disabled={!attr.name}
	                        onClick={() => setQuickSelectAttributeId(prev => prev === attr.id ? null : attr.id)}
	                        className={`px-3 py-2 text-sm border rounded-lg h-[38px] whitespace-nowrap ${
	                          attr.name
	                            ? 'text-slate-600 hover:text-slate-800 border-slate-300'
	                            : 'text-slate-300 border-slate-200 cursor-not-allowed'
	                        }`}
	                      >
	                        Chọn nhanh
	                      </button>
	                      {quickSelectAttributeId === attr.id && attr.name && (
	                        <div className="absolute right-0 top-full z-modal mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
	                          <div className="max-h-56 overflow-y-auto p-2">
	                            {getQuickValues(attr.name).length > 0 ? (
	                              getQuickValues(attr.name).map(value => (
	                                <button
	                                  key={value}
	                                  type="button"
	                                  onClick={() => {
	                                    const newAttrs = [...(formData.attributes || [])];
	                                    newAttrs[idx] = {
	                                      ...newAttrs[idx],
	                                      values: newAttrs[idx].values.includes(value)
	                                        ? newAttrs[idx].values
	                                        : [...newAttrs[idx].values, value],
	                                    };
	                                    setFormData({ ...formData, attributes: newAttrs });
	                                    setQuickSelectAttributeId(null);
	                                  }}
	                                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
	                                >
	                                  {value}
	                                </button>
	                              ))
	                            ) : (
	                              <div className="px-3 py-2 text-sm text-slate-400">Chưa có giá trị đã lưu</div>
	                            )}
	                          </div>
	                        </div>
	                      )}
	                    </div>

	                    <button
	                      type="button"
	                      onClick={() => {
	                        setFormData({ ...formData, attributes: formData.attributes?.filter((_, i) => i !== idx) });
	                        setAttributeValueDrafts(prev => {
	                          const next = { ...prev };
	                          delete next[attr.id];
	                          return next;
	                        });
	                      }}
	                      className="p-2 text-slate-400 hover:text-rose-600 h-[38px] w-[38px] flex items-center justify-center"
	                    >
	                      <Trash2 className="h-4 w-4" />
	                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const committedValues = [
                  ...firstAttributeDraft.values,
                  firstAttributeDraft.currentValue.trim(),
                ].filter(Boolean);
                const committedFirstAttribute =
                  (!formData.attributes || formData.attributes.length === 0) &&
                  (firstAttributeDraft.name || committedValues.length > 0)
                    ? [{
                        id: generateId(),
                        name: firstAttributeDraft.name,
                        values: committedValues,
                      }]
                    : [];

                const nextBlankAttribute = {
                  id: generateId(),
                  name: '',
                  values: []
                };

                setFormData(prev => {
                  const committedAttributes = (prev.attributes || []).map(attr => {
                    const value = (attributeValueDrafts[attr.id] || '').trim();
                    if (!value) return attr;
                    return {
                      ...attr,
                      values: [...attr.values, value],
                    };
                  });

                  return {
                    ...prev,
                    attributes: [...committedAttributes, ...committedFirstAttribute, nextBlankAttribute]
                  };
                });
                setFirstAttributeDraft({ name: '', values: [], currentValue: '' });
                setAttributeValueDrafts({});
              }}
              className="mt-3 text-sm text-indigo-600 font-normal hover:underline flex items-center gap-1"
            >
              + Thêm thuộc tính
            </button>
          </div>
        </div>
      )}
    </div>

    {editingProduct?.parentId && onApplyToVariantsChange && (
      <label className="flex items-center gap-2 cursor-pointer py-1">
        <input
          type="checkbox"
          className="rounded border-slate-300 text-indigo-600"
          checked={applyToVariants ?? false}
          onChange={(e) => onApplyToVariantsChange(e.target.checked)}
        />
        <span className="text-sm text-slate-600">Áp dụng thay đổi cho các hàng hoá cùng loại</span>
      </label>
    )}
    </div>
  );
};
