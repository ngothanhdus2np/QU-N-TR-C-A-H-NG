import React, { useState } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { InventoryTransaction, POSOrder, POSProduct } from '../../types';
import { DetailTab, GoodsProductDetailPanel } from './GoodsProductDetailPanel';

interface GoodsGridDetailModalProps {
  product: POSProduct;
  siblings?: POSProduct[];
  parentName?: string;
  transactions: InventoryTransaction[];
  orders: POSOrder[];
  onClose: () => void;
  onEdit: (product: POSProduct) => void;
  onDelete: (id: string) => void;
  onStopBusiness: (product: POSProduct) => void;
  onPrintLabel: (product: POSProduct) => void;
  onAddSameType: (product: POSProduct) => void;
  onPurchaseProduct: (product: POSProduct) => void;
  onAddUnit?: () => void;
  onAddAttribute?: () => void;
}

export const GoodsGridDetailModal: React.FC<GoodsGridDetailModalProps> = ({
  product,
  siblings,
  parentName,
  transactions,
  orders,
  onClose,
  onEdit,
  onDelete,
  onStopBusiness,
  onPrintLabel,
  onAddSameType,
  onPurchaseProduct,
  onAddUnit,
  onAddAttribute,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [activeProduct, setActiveProduct] = useState<POSProduct>(product);

  const handleSelectSibling = (sibling: POSProduct) => {
    setActiveProduct(sibling);
    setActiveTab('info');
  };

  const hasSiblings = siblings && siblings.length > 1;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-5xl max-h-[95vh] bg-white rounded-2xl shadow-lg shadow-slate-300/60 overflow-hidden flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 bg-white hover:bg-slate-100 rounded-lg transition-colors shadow-sm border border-slate-100"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>

        {hasSiblings && (
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800 mb-2.5">
              {parentName ?? product.name}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {siblings.map(sibling => {
                const isActive = activeProduct.id === sibling.id;
                const stock = sibling.stock ?? 0;
                const stockColor =
                  stock <= 0 ? 'text-red-500' : stock <= 5 ? 'text-amber-500' : 'text-emerald-600';

                return (
                  <button
                    key={sibling.id}
                    onClick={() => handleSelectSibling(sibling)}
                    className={`flex items-center gap-2 shrink-0 rounded-xl border px-2.5 py-2 transition-colors ${
                      isActive
                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                      {sibling.images?.[0] ? (
                        <img
                          src={sibling.images[0]}
                          alt={sibling.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="w-4 h-4 text-slate-300" strokeWidth={1} />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className={`text-2xs font-normal truncate max-w-[120px] ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {sibling.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-normal text-indigo-500">
                          {(sibling.salePrice || 0).toLocaleString('vi-VN')}đ
                        </span>
                        <span className={`text-[9px] font-normal ${stockColor}`}>
                          · Tồn: {stock}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <GoodsProductDetailPanel
            product={activeProduct}
            transactions={transactions}
            orders={orders}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            deleteConfirmText="Bạn có chắc muốn xóa sản phẩm này?"
            showSupplierActions
            showCopyPrintActions
            onDelete={() => onDelete(activeProduct.id)}
            onEdit={() => onEdit(activeProduct)}
            onClose={onClose}
            onPrintLabel={onPrintLabel}
            onAddSameType={onAddSameType}
            onPurchaseProduct={onPurchaseProduct}
            onStopBusiness={onStopBusiness}
            onAddUnit={onAddUnit}
            onAddAttribute={onAddAttribute}
          />
        </div>
      </div>
    </div>
  );
};
