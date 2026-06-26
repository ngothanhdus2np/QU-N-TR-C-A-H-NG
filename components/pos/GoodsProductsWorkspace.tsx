import React from 'react';
import { POSProduct, ProductGroup } from '../../types';
import { GoodsColumnSettings } from './GoodsColumnSettings';
import { GoodsFilterSidebar } from './GoodsFilterSidebar';
import { GoodsImportExport, ImportStatus } from './GoodsImportExport';
import { GoodsToolbar } from './GoodsToolbar';
import { ALL_COLUMNS, DEFAULT_VISIBLE_COLS } from './GoodsInventoryColumns';

type FilterStock = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';

interface GoodsProductsWorkspaceProps {
  children: React.ReactNode;
  products: POSProduct[];
  filteredProducts: POSProduct[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchTags?: string[];
  onTagRemove?: (tag: string) => void;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOpenCreate: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  importStatus: ImportStatus | null;
  setImportStatus: React.Dispatch<React.SetStateAction<ImportStatus | null>>;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  visibleColumns: string[];
  setVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>;
  showColumnPopup: boolean;
  setShowColumnPopup: React.Dispatch<React.SetStateAction<boolean>>;
  columnPopupPos: { top: number; left: number; width: number };
  setColumnPopupPos: React.Dispatch<
    React.SetStateAction<{ top: number; left: number; width: number }>
  >;
  columnTriggerRef: React.RefObject<HTMLButtonElement>;
  filterCategories: string[];
  setFilterCategories: React.Dispatch<React.SetStateAction<string[]>>;
  filterBrand: string;
  setFilterBrand: React.Dispatch<React.SetStateAction<string>>;
  filterAttrs: string[];
  setFilterAttrs: React.Dispatch<React.SetStateAction<string[]>>;
  filterLocation: string;
  setFilterLocation: React.Dispatch<React.SetStateAction<string>>;
  filterStock: FilterStock;
  setFilterStock: React.Dispatch<React.SetStateAction<FilterStock>>;
  filterSupplier: string[];
  setFilterSupplier: React.Dispatch<React.SetStateAction<string[]>>;
  filterPlatforms: string[];
  setFilterPlatforms: (v: string[]) => void;
  availablePlatforms: { key: string; label: string }[];
  productGroups: ProductGroup[];
  uniqueCategories: string[];
  categoryCounts: Record<string, number>;
  attrValuesByName: Record<string, { values: string[]; counts: Record<string, number> }>;
  uniqueLocations: string[];
  uniqueBrands: string[];
  uniqueSuppliers: string[];
  lowStockCount: number;
  selectedCount: number;
  onClearSelection: () => void;
  onExportSelected: () => void;
  onPrintSelectedLabels: () => void;
  onPurchaseSelected: () => void;
  onBulkDelete: () => void;
  onBulkStopBusiness: () => void;
  onBulkChangeGroup: () => void;
  onBulkChannelLink: () => void;
  onGoToWarranty: () => void;
  onResetPage: () => void;
  onCreateGroup: () => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
  sidebarTitle?: string;
  sidebarDescription?: string;
}

export const GoodsProductsWorkspace: React.FC<GoodsProductsWorkspaceProps> = ({
  children,
  products,
  filteredProducts,
  searchTerm,
  onSearchChange,
  searchTags = [],
  onTagRemove,
  onSearchKeyDown,
  onOpenCreate,
  fileInputRef,
  importStatus,
  setImportStatus,
  onImportChange,
  visibleColumns,
  setVisibleColumns,
  showColumnPopup,
  setShowColumnPopup,
  columnPopupPos,
  setColumnPopupPos,
  columnTriggerRef,
  filterCategories,
  setFilterCategories,
  filterBrand,
  setFilterBrand,
  filterAttrs,
  setFilterAttrs,
  filterLocation,
  setFilterLocation,
  filterStock,
  setFilterStock,
  filterSupplier,
  setFilterSupplier,
  filterPlatforms,
  setFilterPlatforms,
  availablePlatforms,
  productGroups,
  uniqueCategories,
  categoryCounts,
  attrValuesByName,
  uniqueLocations,
  uniqueBrands,
  uniqueSuppliers,
  lowStockCount,
  selectedCount,
  onClearSelection,
  onExportSelected,
  onPrintSelectedLabels,
  onPurchaseSelected,
  onBulkDelete,
  onBulkStopBusiness,
  onBulkChangeGroup,
  onBulkChannelLink,
  onGoToWarranty,
  onResetPage,
  onCreateGroup,
  viewMode,
  onViewModeChange,
  sidebarTitle,
  sidebarDescription,
}) => (
  <div className="flex flex-1 min-h-0 gap-4">
    <GoodsFilterSidebar
      filterCategories={filterCategories}
      setFilterCategories={setFilterCategories}
      filterBrand={filterBrand}
      setFilterBrand={setFilterBrand}
      filterStock={filterStock}
      setFilterStock={setFilterStock}
      filterLocation={filterLocation}
      setFilterLocation={setFilterLocation}
      filterAttrs={filterAttrs}
      setFilterAttrs={setFilterAttrs}
      filterSupplier={filterSupplier}
      setFilterSupplier={setFilterSupplier}
      filterPlatforms={filterPlatforms}
      setFilterPlatforms={setFilterPlatforms}
      availablePlatforms={availablePlatforms}
      onCollapse={() => {}}
      onClearAllFilters={() => {
        setFilterCategories([]);
        setFilterBrand('');
        setFilterStock('all');
        setFilterLocation('');
        setFilterAttrs([]);
        setFilterSupplier([]);
        setFilterPlatforms([]);
        onResetPage();
      }}
      onResetPage={onResetPage}
      productGroups={productGroups}
      uniqueCategories={uniqueCategories}
      categoryCounts={categoryCounts}
      attrValuesByName={attrValuesByName}
      uniqueLocations={uniqueLocations}
      uniqueBrands={uniqueBrands}
      uniqueSuppliers={uniqueSuppliers}
      lowStockCount={lowStockCount}
      onCreateGroup={onCreateGroup}
      sidebarTitle={sidebarTitle}
      sidebarDescription={sidebarDescription}
    />

    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <GoodsToolbar
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        searchTags={searchTags}
        onTagRemove={onTagRemove}
        onSearchKeyDown={onSearchKeyDown}
        onOpenCreate={onOpenCreate}
        rightControls={
          <>
            <GoodsImportExport
              products={filteredProducts}
              fileInputRef={fileInputRef}
              importStatus={importStatus}
              setImportStatus={setImportStatus}
              onImportChange={onImportChange}
            />
            <GoodsColumnSettings
              columns={ALL_COLUMNS}
              defaultVisibleColumns={DEFAULT_VISIBLE_COLS}
              visibleColumns={visibleColumns}
              setVisibleColumns={setVisibleColumns}
              isOpen={showColumnPopup}
              setIsOpen={setShowColumnPopup}
              popupPos={columnPopupPos}
              setPopupPos={setColumnPopupPos}
              triggerRef={columnTriggerRef}
            />
          </>
        }
        filteredCount={filteredProducts.length}
        totalCount={products.length}
        filterCategories={filterCategories}
        setFilterCategories={setFilterCategories}
        filterBrand={filterBrand}
        setFilterBrand={setFilterBrand}
        filterAttrs={filterAttrs}
        setFilterAttrs={setFilterAttrs}
        filterLocation={filterLocation}
        setFilterLocation={setFilterLocation}
        filterStock={filterStock}
        setFilterStock={setFilterStock}
        selectedCount={selectedCount}
        onClearSelection={onClearSelection}
        onExportSelected={onExportSelected}
        onPrintSelectedLabels={onPrintSelectedLabels}
        onPurchaseSelected={onPurchaseSelected}
        onBulkDelete={onBulkDelete}
        onBulkStopBusiness={onBulkStopBusiness}
        onBulkChangeGroup={onBulkChangeGroup}
        onBulkChannelLink={onBulkChannelLink}
        onGoToWarranty={onGoToWarranty}
        onResetPage={onResetPage}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {children}
    </div>
  </div>
);
