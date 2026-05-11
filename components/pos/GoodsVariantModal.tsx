import React from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { generateId } from '../../businessLogic';

export type ViewModeAttribute = {
  id: string;
  type: string;
  values: string[];
  currentValue: string;
};

export type PreviewVariant = {
  id: string;
  name: string;
  attributes: Record<string, string>;
  importPrice: number;
  salePrice: number;
  stock: number;
};

interface GoodsVariantModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  previewTitle: string;
  attributes: ViewModeAttribute[];
  setAttributes: React.Dispatch<React.SetStateAction<ViewModeAttribute[]>>;
  previewVariants: PreviewVariant[];
  setPreviewVariants: React.Dispatch<React.SetStateAction<PreviewVariant[]>>;
  generatePreviewVariants: () => void;
  onClose: () => void;
  onSave: () => void;
}

export const GoodsVariantModal: React.FC<GoodsVariantModalProps> = ({
  isOpen,
  title,
  description,
  previewTitle,
  attributes,
  setAttributes,
  previewVariants,
  setPreviewVariants,
  generatePreviewVariants,
  onClose,
  onSave,
}) => {
  if (!isOpen) {
    return null;
  }

  const runPreview = () => setTimeout(generatePreviewVariants, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <p className="text-sm text-slate-600 mb-4">{description}</p>

            <div className="space-y-3">
              {attributes.map((attr, index) => (
                <div key={attr.id} className="flex items-center gap-3">
                  <select
                    value={attr.type}
                    onChange={e => {
                      const newAttrs = [...attributes];
                      newAttrs[index].type = e.target.value;
                      setAttributes(newAttrs);
                      runPreview();
                    }}
                    className="w-40 h-[38px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Chọn thuộc tính</option>
                    <option value="SIZE">SIZE</option>
                    <option value="MÀU">MÀU</option>
                    <option value="Kích thước">Kích thước</option>
                    <option value="Chất liệu">Chất liệu</option>
                    <option value="Kiểu dáng">Kiểu dáng</option>
                  </select>

                  <div className="flex-1 flex flex-wrap gap-2 p-2 border border-slate-300 rounded-lg min-h-[38px] items-center">
                    {attr.values.map((val, valIdx) => (
                      <span key={valIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm font-semibold">
                        {val}
                        <button
                          onClick={() => {
                            const newAttrs = [...attributes];
                            newAttrs[index].values = newAttrs[index].values.filter((_, i) => i !== valIdx);
                            setAttributes(newAttrs);
                            runPreview();
                          }}
                          className="hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="flex-1 min-w-[100px] outline-none text-sm"
                      value={attr.currentValue}
                      onChange={e => {
                        const newAttrs = [...attributes];
                        newAttrs[index].currentValue = e.target.value;
                        setAttributes(newAttrs);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && attr.currentValue.trim()) {
                          e.preventDefault();
                          const newAttrs = [...attributes];
                          newAttrs[index].values = [...newAttrs[index].values, attr.currentValue.trim()];
                          newAttrs[index].currentValue = '';
                          setAttributes(newAttrs);
                          runPreview();
                        }
                      }}
                      placeholder="Nhập và nhấn Enter"
                    />
                  </div>

                  <button className="h-[38px] px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap">
                    Chọn nhanh
                  </button>

                  <button
                    onClick={() => {
                      if (attributes.length > 1) {
                        setAttributes(attributes.filter(a => a.id !== attr.id));
                        runPreview();
                      }
                    }}
                    className="h-[38px] w-[38px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  setAttributes([...attributes, { id: generateId(), type: '', values: [], currentValue: '' }]);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Thêm thuộc tính
              </button>
            </div>
          </div>

          {previewVariants.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-900">{previewTitle}</h4>
                <span className="text-sm text-slate-500">{previewVariants.length} biến thể</span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-600">Giá trị thuộc tính</th>
                      <th className="px-4 py-2 text-center text-xs font-bold text-slate-600">Quy đổi</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-600">Mã hàng</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-slate-600">Giá vốn</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-slate-600">Giá bán</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-slate-600">Tồn kho</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewVariants.map((variant, index) => (
                      <tr key={variant.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-sm font-semibold text-slate-900">
                          {Object.entries(variant.attributes).map(([, value]) => `${value}`).join(' - ')}
                        </td>
                        <td className="px-4 py-2 text-center text-sm text-slate-600">1</td>
                        <td className="px-4 py-2 text-sm text-slate-500">Tự động</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={variant.importPrice}
                            onChange={e => {
                              const newVariants = [...previewVariants];
                              newVariants[index].importPrice = Number(e.target.value);
                              setPreviewVariants(newVariants);
                            }}
                            className="w-full px-2 py-1 text-right border border-slate-200 rounded text-sm focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={variant.salePrice}
                            onChange={e => {
                              const newVariants = [...previewVariants];
                              newVariants[index].salePrice = Number(e.target.value);
                              setPreviewVariants(newVariants);
                            }}
                            className="w-full px-2 py-1 text-right border border-slate-200 rounded text-sm focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={variant.stock}
                            onChange={e => {
                              const newVariants = [...previewVariants];
                              newVariants[index].stock = Number(e.target.value);
                              setPreviewVariants(newVariants);
                            }}
                            className="w-full px-2 py-1 text-right border border-slate-200 rounded text-sm focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setPreviewVariants(previewVariants.filter((_, i) => i !== index))}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Bỏ qua
          </button>
          <button onClick={onSave} className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 rounded-lg transition-colors">
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};
