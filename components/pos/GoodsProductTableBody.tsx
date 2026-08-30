import React from 'react';
import { Package, Plus } from 'lucide-react';
import { InventoryTransaction, POSOrder, POSProduct } from '../../types';
import { DetailTab, GoodsProductDetailPanel } from './GoodsProductDetailPanel';
import { ProductRow, VariantRow } from './GoodsProductRow';

interface GoodsProductTableBodyProps {
  currentProducts: POSProduct[];
  variantsByParentId: Map<string, POSProduct[]>;
  transactions?: InventoryTransaction[];
  orders?: POSOrder[];
  colCount: number;
  selectedIdSet: Set<string>;
  favoriteIdSet: Set<string>;
  expandedParents: string | null;
  viewingProduct: POSProduct | null;
  activeFormTab: string;
  visibleColumns: string[];
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onOpenEditor: (product: POSProduct) => void;
  onToggleView: (product: POSProduct) => void;
  onToggleExpanded: (id: string) => void;
  // Thu hẹp 30/08/2026 từ `string`: giá trị thật luôn là DetailTab do
  // GoodsProductDetailPanel sinh ra, còn handler nhận nó (GoodsInventory) khai
  // ProductFormTab — vốn là tập cha của DetailTab. Khai `string` ở giữa chuỗi
  // làm mất kiểm tra kiểu ở cả hai đầu.
  onChangeDetailTab: (tab: DetailTab) => void;
  onDeleteViewed: (id: string) => void;
  onEditViewed: (product: POSProduct) => void;
  onAddMoreVariants: (parentId: string) => void;
  onAddUnitInView: () => void;
  onAddAttributeInView: () => void;
  onPrintLabel: (product: POSProduct) => void;
  onAddSameType: (product: POSProduct) => void;
  onPurchaseProduct: (product: POSProduct) => void;
  onStopBusiness: (product: POSProduct) => void;
}

const GoodsProductTableBodyBase: React.FC<GoodsProductTableBodyProps> = ({
  currentProducts,
  variantsByParentId,
  transactions,
  orders,
  colCount,
  selectedIdSet,
  favoriteIdSet,
  expandedParents,
  viewingProduct,
  activeFormTab,
  visibleColumns,
  onSelect,
  onToggleFavorite,
  onOpenEditor,
  onToggleView,
  onToggleExpanded,
  onChangeDetailTab,
  onDeleteViewed,
  onEditViewed,
  onAddMoreVariants,
  onAddUnitInView,
  onAddAttributeInView,
  onPrintLabel,
  onAddSameType,
  onPurchaseProduct,
  onStopBusiness,
}) => {
  const detailActiveTab: DetailTab = activeFormTab === 'related'
    ? 'channels'
    : (activeFormTab as DetailTab);

  return (
    <tbody className="divide-y divide-slate-100">
      {currentProducts.length === 0 ? (
        <tr>
          <td colSpan={colCount} className="py-20 text-center text-slate-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-10" />
            <p className="font-normal text-sm">Không có dữ liệu</p>
            <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </td>
        </tr>
      ) : (
        currentProducts.map(product => {
          const isExpanded = expandedParents === product.id;
          const childVariants = product.isParent ? (variantsByParentId.get(product.id) ?? []) : [];
          const isParentProduct =
            product.isParent && product.variantCount && product.variantCount > 0;

          const isViewing = viewingProduct?.id === product.id && !isParentProduct;

          return (
            <React.Fragment key={product.id}>
              <ProductRow
                product={product}
                isSelected={selectedIdSet.has(product.id)}
                isFavorite={favoriteIdSet.has(product.id)}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                onEdit={onOpenEditor}
                onView={onToggleView}
                isExpanded={isExpanded}
                isViewing={isViewing}
                onToggleExpand={onToggleExpanded}
                visibleColumns={visibleColumns}
                variants={childVariants}
              />

              {isExpanded &&
                childVariants.map(variant => (
                  <React.Fragment key={variant.id}>
                    <VariantRow
                      variant={variant}
                      isSelected={selectedIdSet.has(variant.id)}
                      isFavorite={favoriteIdSet.has(variant.id)}
                      onSelect={onSelect}
                      onToggleFavorite={onToggleFavorite}
                      onEdit={onOpenEditor}
                      onView={onToggleView}
                      visibleColumns={visibleColumns}
                      inGroup
                    />

                    {viewingProduct?.id === variant.id && (
                      <tr data-viewing-product-panel="true">
                        <td colSpan={colCount} className="p-0 border-l-2 border-r-2 border-indigo-400">
                          <GoodsProductDetailPanel
                            product={viewingProduct}
                            transactions={transactions}
                            orders={orders}
                            activeTab={detailActiveTab}
                            onTabChange={tab => onChangeDetailTab(tab)}
                            deleteConfirmText="Bạn có chắc muốn xóa biến thể này?"
                            onAddUnit={onAddUnitInView}
                            onDelete={() => onDeleteViewed(viewingProduct.id)}
                            onEdit={() => onEditViewed(viewingProduct)}
                            onClose={() => onToggleView(viewingProduct)}
                            onPrintLabel={onPrintLabel}
                            onAddSameType={onAddSameType}
                            onPurchaseProduct={onPurchaseProduct}
                            onStopBusiness={onStopBusiness}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

              {isExpanded && isParentProduct && (
                <tr className="bg-indigo-50/40">
                  <td colSpan={colCount} className="px-4 py-3 text-right border-b-2 border-l-2 border-r-2 border-indigo-400">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onAddMoreVariants(product.id);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-normal hover:bg-indigo-700 transition-colors flex items-center gap-2 ml-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm hàng hóa cùng loại
                    </button>
                  </td>
                </tr>
              )}

              {viewingProduct?.id === product.id && !isParentProduct && (
                <tr data-viewing-product-panel="true">
                  <td colSpan={colCount} className="p-0 border-l-2 border-r-2 border-b-2 border-indigo-400">
                    <GoodsProductDetailPanel
                      product={viewingProduct}
                      transactions={transactions}
                      orders={orders}
                      activeTab={detailActiveTab}
                      onTabChange={tab => onChangeDetailTab(tab)}
                      deleteConfirmText="Bạn có chắc muốn xóa sản phẩm này?"
                      noBorder
                      showSupplierActions
                      showCopyPrintActions
                      onAddUnit={onAddUnitInView}
                      onAddAttribute={onAddAttributeInView}
                      onDelete={() => onDeleteViewed(viewingProduct.id)}
                      onEdit={() => onEditViewed(viewingProduct)}
                      onClose={() => onToggleView(viewingProduct)}
                      onPrintLabel={onPrintLabel}
                      onAddSameType={onAddSameType}
                      onPurchaseProduct={onPurchaseProduct}
                      onStopBusiness={onStopBusiness}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })
      )}
    </tbody>
  );
};

export const GoodsProductTableBody = React.memo(GoodsProductTableBodyBase);
