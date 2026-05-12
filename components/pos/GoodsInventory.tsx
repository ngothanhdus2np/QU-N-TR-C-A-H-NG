import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppData, AppDataSurgicalUpdate, POSProduct, InventoryTransaction } from '../../types';
import { GoodsKhoHistory, GoodsAuditForm } from './GoodsAuditForm';
import { GoodsPurchaseForm } from './GoodsPurchaseForm';
import { ImportStatus } from './GoodsImportExport';
import { useGoodsFilters } from './useGoodsFilters';
import { GoodsPagination } from './GoodsPagination';
import { GoodsBulkActions } from './GoodsBulkActions';
import { GoodsProductTableHeader } from './GoodsProductTableHeader';
import { GoodsProductTableBody } from './GoodsProductTableBody';
import { GoodsLegacyProductFormView } from './GoodsLegacyProductFormView';
import { DEFAULT_VISIBLE_COLS, COLUMN_PREFS_KEY } from './GoodsInventoryColumns';
import { GoodsInventoryFeedback } from './GoodsInventoryFeedback';
import { GoodsInventoryModals } from './GoodsInventoryModals';
import { GoodsInventorySecondaryToolbar } from './GoodsInventoryNavigation';
import { GoodsProductsWorkspace } from './GoodsProductsWorkspace';
import { useGoodsExcelImport } from './useGoodsExcelImport';
import { useGoodsPurchase } from './useGoodsPurchase';
import { useGoodsAudit } from './useGoodsAudit';
import { useGoodsVariantWorkflow } from './useGoodsVariantWorkflow';
import { useGoodsSelection } from './useGoodsSelection';
import { useGoodsProductEditor } from './useGoodsProductEditor';

interface GoodsInventoryProps {
  products: POSProduct[];
  transactions: InventoryTransaction[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onPushBatch?: (key: keyof AppData, items: unknown[]) => Promise<void>;
  onAddTransaction?: (transaction: InventoryTransaction) => void;
  requestedTab?: 'goods' | 'purchase' | 'kho';
}

const PAGE_SIZE_STORAGE_KEY = 'goods_items_per_page';
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 15;

const GoodsInventory: React.FC<GoodsInventoryProps> = ({
  products,
  transactions,
  onUpdateProducts,
  onUpdateSurgical,
  onPushBatch,
  onAddTransaction,
  requestedTab,
}) => {
  // === Toast & Modal State ===
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'number';
    defaultValue?: string | number;
    onConfirm: (val: string) => void;
  }>({ isOpen: false, title: '', label: '', onConfirm: () => {} });
  const openInputModal = (config: Omit<typeof inputModal, 'isOpen'>) =>
    setInputModal({ ...config, isOpen: true });
  const closeInputModal = () => setInputModal(prev => ({ ...prev, isOpen: false }));
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const openConfirm = (config: Omit<typeof confirmDialog, 'isOpen'>) =>
    setConfirmDialog({ ...config, isOpen: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };
  const [viewingProduct, setViewingProduct] = useState<POSProduct | null>(null);
  const [activeTab, setActiveTab] = useState<
    'goods' | 'purchase' | 'kho' | 'audit_form' | 'product_form'
  >('goods');

  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab);
  }, [requestedTab]);
  const {
    showPurchaseForm,
    setShowPurchaseForm,
    purchaseItems,
    purchaseSupplier,
    setPurchaseSupplier,
    purchaseNote,
    setPurchaseNote,
    handleAddProductToPurchase,
    updatePurchaseItem,
    removePurchaseItem,
    handleCompletePurchase,
  } = useGoodsPurchase({ products, onUpdateProducts, onAddTransaction, showToast });
  const {
    auditSearchTerm,
    setAuditSearchTerm,
    auditItems,
    setAuditItems,
    handleConfirmAudit,
    cancelAudit,
  } = useGoodsAudit({ products, onUpdateProducts, onAddTransaction, showToast, setActiveTab });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
      return PAGE_SIZE_OPTIONS.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
    } catch {
      return DEFAULT_PAGE_SIZE;
    }
  });
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStock, setFilterStock] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>(
    'all'
  );
  const [filterLocation, setFilterLocation] = useState('');
  const [filterAttrs, setFilterAttrs] = useState<string[]>([]);
  const [filterSupplier, setFilterSupplier] = useState('');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(COLUMN_PREFS_KEY);
      return s ? JSON.parse(s) : DEFAULT_VISIBLE_COLS;
    } catch {
      return DEFAULT_VISIBLE_COLS;
    }
  });
  const [showColumnPopup, setShowColumnPopup] = useState(false);
  const [columnPopupPos, setColumnPopupPos] = useState({ top: 0, left: 0, width: 340 });
  const columnTriggerRef = useRef<HTMLButtonElement>(null);

  const {
    showAddUnitInView,
    setShowAddUnitInView,
    showAddAttributeInView,
    setShowAddAttributeInView,
    viewModeNewUnit,
    setViewModeNewUnit,
    viewModeAttributes,
    setViewModeAttributes,
    previewVariants,
    setPreviewVariants,
    showAddMoreVariants,
    addingToParentId,
    handleAddUnitInViewMode,
    handleAddAttributeInViewMode,
    generatePreviewVariants,
    openAddMoreVariants,
    closeAddMoreVariantsModal,
    closeAddAttributeInViewModal,
    handleSaveMoreVariants,
  } = useGoodsVariantWorkflow({
    products,
    onUpdateProducts,
    onUpdateSurgical,
    viewingProduct,
    setViewingProduct,
    showToast,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const { handleExcelImport, downloadTemplate } = useGoodsExcelImport({
    products,
    onUpdateProducts,
    onPushBatch,
    setImportStatus,
    fileInputRef,
  });

  const {
    editingProduct,
    setEditingProduct,
    formData,
    setFormData,
    showCreateModal,
    setShowCreateModal,
    showProductModal,
    setShowProductModal,
    setIsQuickAddMode,
    activeFormTab,
    setActiveFormTab,
    createModalTab,
    setCreateModalTab,
    showStockSection,
    setShowStockSection,
    showLocationSection,
    setShowLocationSection,
    showUnitsSection,
    setShowUnitsSection,
    showAddUnitModal,
    setShowAddUnitModal,
    newUnitName,
    setNewUnitName,
    newUnitPrice,
    setNewUnitPrice,
    newUnitDirectSale,
    setNewUnitDirectSale,
    openCreateProduct,
    openProductEditor,
    handleSaveProduct,
    handleOpenQuickAddProduct,
    addBaseUnit,
    handleSaveBaseUnit,
    addConversionUnit,
  } = useGoodsProductEditor({
    products,
    onUpdateProducts,
    onUpdateSurgical,
    activeTab,
    setActiveTab,
    handleAddProductToPurchase,
    showToast,
    openInputModal,
    closeInputModal,
  });

  React.useEffect(() => {
    localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  React.useEffect(() => {
    if (!showColumnPopup) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('column-visibility-popup');
      const trigger = columnTriggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setShowColumnPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnPopup]);

  const {
    lowStockProducts,
    uniqueCategories,
    uniqueBrands,
    uniqueLocations,
    attrValuesByName,
    categoryCounts,
    filteredProducts,
    sellableSkuCount,
    totalPages,
    currentProducts,
    variantsByParentId,
  } = useGoodsFilters({
    products,
    debouncedSearchTerm,
    filterCategories,
    filterBrand,
    filterStock,
    filterLocation,
    filterAttrs,
    currentPage,
    itemsPerPage,
  });

  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // 5 fixed cols (checkbox + star + sku + name + actions) + N visible cols
  const colCount = 5 + visibleColumns.length;
  const {
    selectedIds,
    setSelectedIds,
    favoriteIds,
    expandedParents,
    toggleSelectAll,
    toggleSelectOne,
    toggleFavorite,
    toggleExpandedParent,
    handleBulkDelete,
  } = useGoodsSelection({
    products,
    filteredProducts,
    onUpdateProducts,
    onUpdateSurgical,
    openConfirm,
    showToast,
  });

  const handleToggleView = useCallback(
    (prod: POSProduct) => {
      if (viewingProduct?.id === prod.id) {
        setViewingProduct(null);
      } else {
        setViewingProduct(prod);
        setActiveFormTab('info');
      }
    },
    [viewingProduct?.id]
  );

  const handleChangeDetailTab = useCallback((tab: string) => {
    setActiveFormTab(tab as any);
  }, []);

  const handleDeleteViewed = useCallback(
    (id: string) => {
      onUpdateProducts(products.filter(prod => prod.id !== id));
      setViewingProduct(null);
    },
    [onUpdateProducts, products]
  );

  const handleEditViewed = useCallback(
    (prod: POSProduct) => {
      openProductEditor(prod);
      setViewingProduct(null);
    },
    [openProductEditor]
  );

  const handleAddUnitInView = useCallback(() => setShowAddUnitInView(true), []);

  const handleAddAttributeInView = useCallback(() => setShowAddAttributeInView(true), []);

  const handleItemsPerPageChange = useCallback((nextItemsPerPage: number) => {
    setItemsPerPage(nextItemsPerPage);
    setCurrentPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(nextItemsPerPage));
    } catch {
      // Page size is a device preference; ignore storage failures.
    }
  }, []);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'goods':
        return (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain no-scrollbar">
              <table className="w-full text-sm">
                <GoodsProductTableHeader
                  visibleColumns={visibleColumns}
                  isAllSelected={
                    selectedIds.length === filteredProducts.length && filteredProducts.length > 0
                  }
                  onToggleSelectAll={toggleSelectAll}
                />
                <GoodsProductTableBody
                  currentProducts={currentProducts}
                  variantsByParentId={variantsByParentId}
                  colCount={colCount}
                  selectedIds={selectedIds}
                  favoriteIds={favoriteIds}
                  expandedParents={expandedParents}
                  viewingProduct={viewingProduct}
                  activeFormTab={activeFormTab}
                  visibleColumns={visibleColumns}
                  onSelect={toggleSelectOne}
                  onToggleFavorite={toggleFavorite}
                  onOpenEditor={openProductEditor}
                  onToggleView={handleToggleView}
                  onToggleExpanded={toggleExpandedParent}
                  onChangeDetailTab={handleChangeDetailTab}
                  onDeleteViewed={handleDeleteViewed}
                  onEditViewed={handleEditViewed}
                  onAddMoreVariants={openAddMoreVariants}
                  onAddUnitInView={handleAddUnitInView}
                  onAddAttributeInView={handleAddAttributeInView}
                />
              </table>
            </div>
            <GoodsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={filteredProducts.length}
              totalSkuItems={sellableSkuCount}
              setCurrentPage={setCurrentPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />

            <GoodsBulkActions
              selectedCount={selectedIds.length}
              onClearSelection={() => setSelectedIds([])}
              onBulkDelete={handleBulkDelete}
            />
          </div>
        );
      case 'purchase':
        return (
          <GoodsPurchaseForm
            showPurchaseForm={showPurchaseForm}
            setShowPurchaseForm={setShowPurchaseForm}
            purchaseItems={purchaseItems}
            purchaseSupplier={purchaseSupplier}
            setPurchaseSupplier={setPurchaseSupplier}
            purchaseNote={purchaseNote}
            setPurchaseNote={setPurchaseNote}
            products={products}
            transactions={transactions}
            onClickFileInput={() => fileInputRef.current?.click()}
            onOpenQuickAddProduct={handleOpenQuickAddProduct}
            onAddProductToPurchase={handleAddProductToPurchase}
            onUpdatePurchaseItem={updatePurchaseItem}
            onRemovePurchaseItem={removePurchaseItem}
            onCompletePurchase={handleCompletePurchase}
            onDownloadTemplate={downloadTemplate}
          />
        );
      case 'kho':
        return <GoodsKhoHistory transactions={transactions} />;
      case 'audit_form':
        return (
          <GoodsAuditForm
            products={products}
            lowStockProducts={lowStockProducts}
            auditItems={auditItems}
            setAuditItems={setAuditItems}
            auditSearchTerm={auditSearchTerm}
            setAuditSearchTerm={setAuditSearchTerm}
            onConfirmAudit={handleConfirmAudit}
            onCancel={cancelAudit}
          />
        );
      case 'product_form':
        return (
          <GoodsLegacyProductFormView
            formData={formData}
            setFormData={setFormData}
            editingProduct={editingProduct}
            activeFormTab={activeFormTab}
            setActiveFormTab={setActiveFormTab}
            onBack={() => setActiveTab('goods')}
            onSave={() => handleSaveProduct(false)}
            onAddConversionUnit={addConversionUnit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={activeTab === 'goods' ? 'flex flex-col h-full' : 'space-y-6'}>
      <GoodsInventoryFeedback
        toast={toast}
        inputModal={inputModal}
        confirmDialog={confirmDialog}
        onCloseInput={closeInputModal}
        onCloseConfirm={closeConfirm}
      />

      {activeTab === 'goods' ? (
        <GoodsProductsWorkspace
          products={products}
          filteredProducts={filteredProducts}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onOpenCreate={openCreateProduct}
          fileInputRef={fileInputRef}
          importStatus={importStatus}
          setImportStatus={setImportStatus}
          onImportChange={handleExcelImport}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
          showColumnPopup={showColumnPopup}
          setShowColumnPopup={setShowColumnPopup}
          columnPopupPos={columnPopupPos}
          setColumnPopupPos={setColumnPopupPos}
          columnTriggerRef={columnTriggerRef}
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
          filterSupplier={filterSupplier}
          setFilterSupplier={setFilterSupplier}
          uniqueCategories={uniqueCategories}
          categoryCounts={categoryCounts}
          attrValuesByName={attrValuesByName}
          uniqueLocations={uniqueLocations}
          uniqueBrands={uniqueBrands}
          lowStockCount={lowStockProducts.length}
          selectedCount={selectedIds.length}
          onResetPage={() => setCurrentPage(1)}
        >
          {renderMainContent()}
        </GoodsProductsWorkspace>
      ) : (
        <>
          {activeTab !== 'product_form' && activeTab !== 'audit_form' && (
            <GoodsInventorySecondaryToolbar
              activeTab={activeTab}
              showPurchaseForm={showPurchaseForm}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              setActiveTab={setActiveTab}
              setShowPurchaseForm={setShowPurchaseForm}
            />
          )}
          {renderMainContent()}
        </>
      )}

      <GoodsInventoryModals
        showProductModal={showProductModal}
        formData={formData}
        setFormData={setFormData}
        onCloseProductModal={() => {
          setShowProductModal(false);
          setIsQuickAddMode(false);
        }}
        onSaveProductModal={() => handleSaveProduct(false)}
        showAddUnitModal={showAddUnitModal}
        newUnitName={newUnitName}
        newUnitPrice={newUnitPrice}
        newUnitDirectSale={newUnitDirectSale}
        setNewUnitName={setNewUnitName}
        setNewUnitPrice={setNewUnitPrice}
        setNewUnitDirectSale={setNewUnitDirectSale}
        onCloseAddUnitModal={() => setShowAddUnitModal(false)}
        onSaveBaseUnit={handleSaveBaseUnit}
        showCreateModal={showCreateModal}
        editingProduct={editingProduct}
        createModalTab={createModalTab}
        setCreateModalTab={setCreateModalTab}
        onCloseCreateModal={() => {
          setShowCreateModal(false);
          setEditingProduct(null);
        }}
        onSaveAndCreateMore={() => {
          handleSaveProduct(true);
          setFormData({
            name: '',
            sku: 'Tự động',
            categoryId: '',
            brand: '',
            importPrice: 0,
            salePrice: 0,
            stock: 0,
            minStock: 0,
            maxStock: 999999999,
            unit: 'Cái',
            description: '',
            warranty: '',
            allowPoints: true,
            weight: 0,
            weightUnit: 'g',
            location: '',
            relatedSku: '',
            images: [],
            status: 'Active',
            units: [],
            attributes: [],
          });
        }}
        onSaveCreateModal={() => {
          handleSaveProduct(false);
          setShowCreateModal(false);
        }}
        showStockSection={showStockSection}
        setShowStockSection={setShowStockSection}
        showLocationSection={showLocationSection}
        setShowLocationSection={setShowLocationSection}
        showUnitsSection={showUnitsSection}
        setShowUnitsSection={setShowUnitsSection}
        addBaseUnit={addBaseUnit}
        showAddUnitInView={showAddUnitInView}
        viewModeNewUnit={viewModeNewUnit}
        setViewModeNewUnit={setViewModeNewUnit}
        onCloseAddUnitInView={() => setShowAddUnitInView(false)}
        onSaveAddUnitInView={handleAddUnitInViewMode}
        showAddAttributeInView={showAddAttributeInView}
        viewModeAttributes={viewModeAttributes}
        setViewModeAttributes={setViewModeAttributes}
        previewVariants={previewVariants}
        setPreviewVariants={setPreviewVariants}
        generatePreviewVariants={generatePreviewVariants}
        onCloseAddAttributeInView={closeAddAttributeInViewModal}
        onSaveAddAttributeInView={handleAddAttributeInViewMode}
        showAddMoreVariants={showAddMoreVariants}
        addingToParentId={addingToParentId}
        onCloseAddMoreVariants={closeAddMoreVariantsModal}
        onSaveMoreVariants={handleSaveMoreVariants}
      />
    </div>
  );
};

export default GoodsInventory;
