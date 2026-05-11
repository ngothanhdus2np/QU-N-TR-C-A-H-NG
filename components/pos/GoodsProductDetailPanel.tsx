import React from 'react';
import { Edit2, FileText, Image as ImageIcon, Package, Printer, Trash2, X } from 'lucide-react';
import { POSProduct } from '../../types';

type DetailTab = 'info' | 'desc' | 'warranty' | 'units' | 'channels';

interface GoodsProductDetailPanelProps {
  product: POSProduct;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onDelete: () => void;
  onEdit: () => void;
  onClose: () => void;
  deleteConfirmText: string;
  showSupplierActions?: boolean;
  showCopyPrintActions?: boolean;
  onAddUnit?: () => void;
  onAddAttribute?: () => void;
}

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'desc', label: 'Mô tả, ghi chú' },
  { id: 'warranty', label: 'Thẻ kho' },
  { id: 'units', label: 'Tồn kho' },
  { id: 'channels', label: 'Liên kết kênh bán' }
];

export const GoodsProductDetailPanel: React.FC<GoodsProductDetailPanelProps> = ({
  product,
  activeTab,
  onTabChange,
  onDelete,
  onEdit,
  onClose,
  deleteConfirmText,
  showSupplierActions = false,
  showCopyPrintActions = false,
  onAddUnit,
  onAddAttribute
}) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(deleteConfirmText)) {
      onDelete();
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="bg-white border-2 border-indigo-400 rounded-lg shadow-2xl mx-4 my-2 animate-in slide-in-from-top-4 duration-300">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1 px-6">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
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

      <div className="max-h-[600px] overflow-auto bg-slate-50 p-6">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex gap-6">
                <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{product.name}</h2>
                  <p className="text-sm text-slate-600 mb-3">Nhóm hàng: <span className="font-semibold">{product.categoryId || 'Chưa phân loại'}</span></p>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked readOnly disabled className="rounded border-slate-300" />
                      Hàng hóa thương
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked readOnly disabled className="rounded border-slate-300" />
                      Bán trực tiếp
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={product.allowPoints} readOnly disabled className="rounded border-slate-300" />
                      Tích điểm
                    </span>
                  </div>
                  {product.variantAttributes ? (
                    <div className="mb-3">
                      <span className="text-sm text-slate-500 font-semibold">Thuộc tính: </span>
                      {Object.entries(product.variantAttributes).map(([key, value]) => (
                        <span key={key} className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold mr-2">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <button className="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                      🔗 Xem phần tích
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Mã hàng</label>
                  <div className="text-sm font-bold text-slate-900">{product.sku}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Tồn kho</label>
                  <div className="text-sm font-bold text-slate-900">{product.stock}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Định mức tồn</label>
                  <div className="text-sm font-bold text-slate-900">{product.minStock ?? 0} - {product.maxStock ?? 999999999}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Giá vốn</label>
                  <div className="text-sm font-bold text-slate-900">{product.importPrice.toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Giá bán</label>
                  <div className="text-sm font-bold text-slate-900">{product.salePrice.toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Thương hiệu</label>
                  <div className="text-sm text-slate-600">{product.brand || 'Chưa có'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Vị trí</label>
                  <div className="text-sm text-slate-600">{product.location || 'Chưa có'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-2 block">Trọng lượng</label>
                  <div className="text-sm text-slate-600">
                    {product.weight ? `${product.weight} ${product.weightUnit || 'g'}` : 'Chưa có'}
                  </div>
                </div>
              </div>
            </div>

            {showSupplierActions && (
              <>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Nhà cung cấp</h3>
                  <div className="text-sm text-slate-900 font-semibold">CHỈ DAN BÌNH</div>
                </div>

                <div className="space-y-2">
                  <button onClick={onAddUnit} className="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                    🔗 Thêm đơn vị tính
                  </button>
                  <button onClick={onAddAttribute} className="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                    🔗 Thêm thuộc tính
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'desc' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="text-sm font-semibold text-slate-700 mb-3 block">Mô tả chi tiết</label>
            <div className="text-sm text-slate-600 whitespace-pre-wrap">
              {product.description || 'Chưa có mô tả'}
            </div>
          </div>
        )}

        {activeTab === 'warranty' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="text-sm font-semibold text-slate-700 mb-3 block">Thông tin bảo hành</label>
            <div className="text-sm text-slate-600 whitespace-pre-wrap">
              {product.warranty || 'Chưa có thông tin bảo hành'}
            </div>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Đơn vị tính quy đổi</h3>
            {product.units && product.units.length > 0 ? (
              <div className="space-y-2">
                {product.units.map((unit) => (
                  <div key={unit.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700 flex-1">{unit.name}</span>
                    <span className="text-sm text-slate-500">Hệ số: {unit.factor}</span>
                    <span className="text-sm text-slate-700 font-semibold">{unit.price.toLocaleString()}đ</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                Chưa có đơn vị quy đổi nào
              </div>
            )}
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center py-12">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Tính năng đang phát triển</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between rounded-b-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Xóa
          </button>
          {showCopyPrintActions && (
            <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Sao chép
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEdit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Chỉnh sửa
          </button>
          {showCopyPrintActions && (
            <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              <Printer className="h-4 w-4" />
              In tem mã
            </button>
          )}
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
