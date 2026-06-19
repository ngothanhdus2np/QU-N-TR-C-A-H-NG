import React, { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { POSProduct, InventoryTransaction, POSOrder } from '../../types';
import { GoodsProductTableHeader } from './GoodsProductTableHeader';
import { GoodsSortKey, GoodsSortDirection } from './useGoodsFilters';
import { ProductRow, VariantRow } from './GoodsProductRow';
import { DetailTab, GoodsProductDetailPanel } from './GoodsProductDetailPanel';
import { Package, Plus } from 'lucide-react';

interface GoodsVirtualizedTableProps {
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
  isAllSelected: boolean;
  sortKey: GoodsSortKey;
  sortDirection: GoodsSortDirection;
  onToggleSelectAll: () => void;
  onSort: (key: GoodsSortKey) => void;
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
  onPrintLabel: (product: POSProduct) => void;
  onAddSameType: (product: POSProduct) => void;
  onPurchaseProduct: (product: POSProduct) => void;
  onStopBusiness: (product: POSProduct) => void;
}

interface VirtualRow {
  type: 'product' | 'variant' | 'detail' | 'addMore';
  product: POSProduct;
  parentId?: string;
}

const GoodsVirtualizedTableBase: React.FC<GoodsVirtualizedTableProps> = ({
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
  isAllSelected,
  sortKey,
  sortDirection,
  onToggleSelectAll,
  onSort,
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
  const parentRef = useRef<HTMLDivElement>(null);
  const detailActiveTab: DetailTab = activeFormTab === 'related'
    ? 'channels'
    : (activeFormTab as DetailTab);

  // Flatten products with their variants into virtual rows
  const virtualRows = useMemo<VirtualRow[]>(() => {
    const rows: VirtualRow[] = [];

    currentProducts.forEach(product => {
      // Add parent/product row
      rows.push({ type: 'product', product });

      // If expanded, add variants
      if (expandedParents === product.id && product.isParent) {
        const childVariants = variantsByParentId.get(product.id) ?? [];
        childVariants.forEach(variant => {
          rows.push({ type: 'variant', product: variant, parentId: product.id });

          // If variant is being viewed, add detail panel
          if (viewingProduct?.id === variant.id) {
            rows.push({ type: 'detail', product: variant, parentId: product.id });
          }
        });

        // Add "Add more variants" button row
        if (product.variantCount && product.variantCount > 0) {
          rows.push({ type: 'addMore', product, parentId: product.id });
        }
      }

      // If non-parent product is being viewed, add detail panel
      if (
        viewingProduct?.id === product.id &&
        (!product.isParent || !product.variantCount || product.variantCount === 0)
      ) {
        rows.push({ type: 'detail', product });
      }
    });

    return rows;
  }, [currentProducts, expandedParents, variantsByParentId, viewingProduct]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (row.type === 'detail') return 400; // Detail panel height
      if (row.type === 'addMore') return 60; // Add more button row
      return 60; // Regular row height
    },
    overscan: 10, // Render 10 extra rows above/below viewport
  });

  if (currentProducts.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain no-scrollbar">
          <table className="w-full text-sm">
            <GoodsProductTableHeader
              visibleColumns={visibleColumns}
              isAllSelected={isAllSelected}
              onToggleSelectAll={onToggleSelectAll}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <tbody>
              <tr>
                <td colSpan={colCount} className="py-20 text-center text-slate-400">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-10" />
                  <p className="font-normal text-sm">Không có dữ liệu</p>
                  <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-auto overscroll-contain no-scrollbar"
      >
        <table className="w-full text-sm">
          <GoodsProductTableHeader
            visibleColumns={visibleColumns}
            isAllSelected={isAllSelected}
            onToggleSelectAll={onToggleSelectAll}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
          />
          <tbody
            className="divide-y divide-slate-50"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualItem => {
              const row = virtualRows[virtualItem.index];
              const { product, type, parentId } = row;

              return (
                <React.Fragment key={virtualItem.key}>
                  {type === 'product' && (
                    <tr
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <td colSpan={colCount} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <ProductRow
                              product={product}
                              isSelected={selectedIdSet.has(product.id)}
                              isFavorite={favoriteIdSet.has(product.id)}
                              onSelect={onSelect}
                              onToggleFavorite={onToggleFavorite}
                              onEdit={onOpenEditor}
                              onView={onToggleView}
                              isExpanded={expandedParents === product.id}
                              isViewing={
                                viewingProduct?.id === product.id &&
                                (!product.isParent || !product.variantCount || product.variantCount === 0)
                              }
                              onToggleExpand={onToggleExpanded}
                              visibleColumns={visibleColumns}
                            />
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}

                  {type === 'variant' && (
                    <tr
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <td colSpan={colCount} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <VariantRow
                              variant={product}
                              isSelected={selectedIdSet.has(product.id)}
                              isFavorite={favoriteIdSet.has(product.id)}
                              onSelect={onSelect}
                              onToggleFavorite={onToggleFavorite}
                              onEdit={onOpenEditor}
                              onView={onToggleView}
                              visibleColumns={visibleColumns}
                            />
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}

                  {type === 'detail' && (
                    <tr
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <td colSpan={colCount} className={`p-0 border-l-2 border-r-2 border-indigo-400${!parentId ? ' border-b-2' : ''}`}>
                        <GoodsProductDetailPanel
                          product={product}
                          transactions={transactions}
                          orders={orders}
                          activeTab={detailActiveTab}
                          onTabChange={tab => onChangeDetailTab(tab)}
                          deleteConfirmText={
                            parentId
                              ? 'Bạn có chắc muốn xóa biến thể này?'
                              : 'Bạn có chắc muốn xóa sản phẩm này?'
                          }
                          noBorder={!parentId}
                          showSupplierActions={!parentId}
                          showCopyPrintActions={!parentId}
                          onAddUnit={onAddUnitInView}
                          onAddAttribute={!parentId ? onAddAttributeInView : undefined}
                          onDelete={() => onDeleteViewed(product.id)}
                          onEdit={() => onEditViewed(product)}
                          onClose={() => onToggleView(product)}
                          onPrintLabel={onPrintLabel}
                          onAddSameType={onAddSameType}
                          onPurchaseProduct={onPurchaseProduct}
                          onStopBusiness={onStopBusiness}
                        />
                      </td>
                    </tr>
                  )}

                  {type === 'addMore' && (
                    <tr
                      className="bg-slate-50/40"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <td
                        colSpan={colCount}
                        className="px-4 py-3 text-right border-b-2 border-l-2 border-r-2 border-indigo-400"
                      >
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
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const GoodsVirtualizedTable = React.memo(GoodsVirtualizedTableBase);
