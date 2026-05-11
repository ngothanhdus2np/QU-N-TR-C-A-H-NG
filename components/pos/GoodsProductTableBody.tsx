import React from 'react';
import { Package, Plus } from 'lucide-react';
import { POSProduct } from '../../types';
import { GoodsProductDetailPanel } from './GoodsProductDetailPanel';
import { ProductRow, VariantRow } from './GoodsProductRow';

interface GoodsProductTableBodyProps {
  currentProducts: POSProduct[];
  products: POSProduct[];
  colCount: number;
  selectedIds: string[];
  favoriteIds: string[];
  expandedParents: Set<string>;
  viewingProduct: POSProduct | null;
  activeFormTab: string;
  visibleColumns: string[];
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onOpenEditor: (product: POSProduct) => void;
  onToggleView: (product: POSProduct) => void;
  onToggleExpanded: (id: string) => void;
  onChangeDetailTab: (tab: string) => void;
  onDeleteViewed: (id: string) => void;
  onEditViewed: (product: POSProduct) => void;
  onAddMoreVariants: (parentId: string) => void;
  onAddUnitInView: () => void;
  onAddAttributeInView: () => void;
}

export const GoodsProductTableBody: React.FC<GoodsProductTableBodyProps> = ({
  currentProducts,
  products,
  colCount,
  selectedIds,
  favoriteIds,
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
  onAddAttributeInView
}) => {
  return (
    <tbody className="divide-y divide-slate-50">
      {currentProducts.length === 0 ? (
        <tr>
          <td colSpan={colCount} className="py-20 text-center text-slate-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-10" />
            <p className="font-bold text-sm">Không có dữ liệu</p>
            <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </td>
        </tr>
      ) : (
        currentProducts.map(product => {
          const isExpanded = expandedParents.has(product.id);
          const childVariants = product.isParent ? products.filter(item => item.parentId === product.id) : [];
          const isParentProduct = product.isParent && product.variantCount && product.variantCount > 0;

          return (
            <React.Fragment key={product.id}>
              {isExpanded && childVariants.length > 0 ? (
                <tr>
                  <td colSpan={colCount} className="p-0">
                    <div className="mx-4 my-2 border-2 border-indigo-400 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <tbody>
                          <tr className="bg-slate-100">
                            <td colSpan={colCount} className="p-0">
                              <ProductRow
                                product={product}
                                isSelected={selectedIds.includes(product.id)}
                                isFavorite={favoriteIds.includes(product.id)}
                                onSelect={onSelect}
                                onToggleFavorite={onToggleFavorite}
                                onEdit={onOpenEditor}
                                onView={onToggleView}
                                isExpanded={isExpanded}
                                onToggleExpand={onToggleExpanded}
                                allProducts={products}
                                visibleColumns={visibleColumns}
                              />
                            </td>
                          </tr>

                          {childVariants.map(variant => (
                            <React.Fragment key={variant.id}>
                              <VariantRow
                                variant={variant}
                                isSelected={selectedIds.includes(variant.id)}
                                onSelect={onSelect}
                                onEdit={onOpenEditor}
                                onView={onToggleView}
                                visibleColumns={visibleColumns}
                              />

                              {viewingProduct?.id === variant.id && (
                                <tr>
                                  <td colSpan={colCount} className="p-0">
                                    <GoodsProductDetailPanel
                                      product={viewingProduct}
                                      activeTab={activeFormTab as any}
                                      onTabChange={(tab) => onChangeDetailTab(tab)}
                                      deleteConfirmText="Bạn có chắc muốn xóa biến thể này?"
                                      onDelete={() => onDeleteViewed(viewingProduct.id)}
                                      onEdit={() => onEditViewed(viewingProduct)}
                                      onClose={() => onToggleView(viewingProduct)}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}

                          <tr>
                            <td colSpan={colCount} className="p-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddMoreVariants(product.id);
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 ml-auto"
                              >
                                <Plus className="h-4 w-4" />
                                Thêm hàng hóa cùng loại
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              ) : (
                <ProductRow
                  product={product}
                  isSelected={selectedIds.includes(product.id)}
                  isFavorite={favoriteIds.includes(product.id)}
                  onSelect={onSelect}
                  onToggleFavorite={onToggleFavorite}
                  onEdit={onOpenEditor}
                  onView={onToggleView}
                  isExpanded={isExpanded}
                  onToggleExpand={onToggleExpanded}
                  allProducts={products}
                  visibleColumns={visibleColumns}
                />
              )}

              {viewingProduct?.id === product.id && !isParentProduct && (
                <tr>
                  <td colSpan={colCount} className="p-0">
                    <GoodsProductDetailPanel
                      product={viewingProduct}
                      activeTab={activeFormTab as any}
                      onTabChange={(tab) => onChangeDetailTab(tab)}
                      deleteConfirmText="Bạn có chắc muốn xóa sản phẩm này?"
                      showSupplierActions
                      showCopyPrintActions
                      onAddUnit={onAddUnitInView}
                      onAddAttribute={onAddAttributeInView}
                      onDelete={() => onDeleteViewed(viewingProduct.id)}
                      onEdit={() => onEditViewed(viewingProduct)}
                      onClose={() => onToggleView(viewingProduct)}
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
