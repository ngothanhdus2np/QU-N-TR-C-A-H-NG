import React from 'react';
import { POSProduct } from '../../types';
import { GoodsCreateProductInfoTab } from './GoodsCreateProductInfoTab';
import { GoodsCreateProductModal } from './GoodsCreateProductModal';
import { GoodsCreateProductTextTab } from './GoodsCreateProductTextTab';
import { GoodsProductForm } from './GoodsProductForm';
import { GoodsBaseUnitModal, GoodsViewUnitModal } from './GoodsUnitModals';
import { GoodsVariantModal } from './GoodsVariantModal';

type CreateModalTab = 'info' | 'desc' | 'warranty';
type ViewModeUnit = { name: string; price: number; directSale: boolean };
type ViewModeAttribute = { id: string; type: string; values: string[]; currentValue: string };
type PreviewVariant = {
  id: string;
  name: string;
  attributes: Record<string, string>;
  importPrice: number;
  salePrice: number;
  stock: number;
};

interface GoodsInventoryModalsProps {
  showProductModal: boolean;
  formData: Partial<POSProduct>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<POSProduct>>>;
  onCloseProductModal: () => void;
  onSaveProductModal: () => void;
  showAddUnitModal: boolean;
  newUnitName: string;
  newUnitPrice: number;
  newUnitDirectSale: boolean;
  setNewUnitName: React.Dispatch<React.SetStateAction<string>>;
  setNewUnitPrice: React.Dispatch<React.SetStateAction<number>>;
  setNewUnitDirectSale: React.Dispatch<React.SetStateAction<boolean>>;
  onCloseAddUnitModal: () => void;
  onSaveBaseUnit: (addMore?: boolean) => void;
  showCreateModal: boolean;
  editingProduct: POSProduct | null;
  createModalTab: CreateModalTab;
  setCreateModalTab: React.Dispatch<React.SetStateAction<CreateModalTab>>;
  onCloseCreateModal: () => void;
  onSaveAndCreateMore: () => void;
  onSaveCreateModal: () => void;
  showStockSection: boolean;
  setShowStockSection: React.Dispatch<React.SetStateAction<boolean>>;
  showLocationSection: boolean;
  setShowLocationSection: React.Dispatch<React.SetStateAction<boolean>>;
  showUnitsSection: boolean;
  setShowUnitsSection: React.Dispatch<React.SetStateAction<boolean>>;
  addBaseUnit: () => void;
  showAddUnitInView: boolean;
  viewModeNewUnit: ViewModeUnit;
  setViewModeNewUnit: React.Dispatch<React.SetStateAction<ViewModeUnit>>;
  onCloseAddUnitInView: () => void;
  onSaveAddUnitInView: (addMore?: boolean) => void;
  showAddAttributeInView: boolean;
  viewModeAttributes: ViewModeAttribute[];
  setViewModeAttributes: React.Dispatch<React.SetStateAction<ViewModeAttribute[]>>;
  previewVariants: PreviewVariant[];
  setPreviewVariants: React.Dispatch<React.SetStateAction<PreviewVariant[]>>;
  generatePreviewVariants: () => void;
  onCloseAddAttributeInView: () => void;
  onSaveAddAttributeInView: () => void;
  showAddMoreVariants: boolean;
  addingToParentId: string | null;
  onCloseAddMoreVariants: () => void;
  onSaveMoreVariants: () => void;
}

export const GoodsInventoryModals: React.FC<GoodsInventoryModalsProps> = ({
  showProductModal,
  formData,
  setFormData,
  onCloseProductModal,
  onSaveProductModal,
  showAddUnitModal,
  newUnitName,
  newUnitPrice,
  newUnitDirectSale,
  setNewUnitName,
  setNewUnitPrice,
  setNewUnitDirectSale,
  onCloseAddUnitModal,
  onSaveBaseUnit,
  showCreateModal,
  editingProduct,
  createModalTab,
  setCreateModalTab,
  onCloseCreateModal,
  onSaveAndCreateMore,
  onSaveCreateModal,
  showStockSection,
  setShowStockSection,
  showLocationSection,
  setShowLocationSection,
  showUnitsSection,
  setShowUnitsSection,
  addBaseUnit,
  showAddUnitInView,
  viewModeNewUnit,
  setViewModeNewUnit,
  onCloseAddUnitInView,
  onSaveAddUnitInView,
  showAddAttributeInView,
  viewModeAttributes,
  setViewModeAttributes,
  previewVariants,
  setPreviewVariants,
  generatePreviewVariants,
  onCloseAddAttributeInView,
  onSaveAddAttributeInView,
  showAddMoreVariants,
  addingToParentId,
  onCloseAddMoreVariants,
  onSaveMoreVariants
}) => (
  <>
    <GoodsProductForm
      isOpen={showProductModal}
      formData={formData}
      setFormData={setFormData}
      onClose={onCloseProductModal}
      onSave={onSaveProductModal}
    />

    <GoodsBaseUnitModal
      isOpen={showAddUnitModal}
      name={newUnitName}
      price={newUnitPrice}
      directSale={newUnitDirectSale}
      setName={setNewUnitName}
      setPrice={setNewUnitPrice}
      setDirectSale={setNewUnitDirectSale}
      onClose={onCloseAddUnitModal}
      onSave={onSaveBaseUnit}
    />

    <GoodsCreateProductModal
      isOpen={showCreateModal}
      editingProduct={editingProduct}
      activeTab={createModalTab}
      setActiveTab={setCreateModalTab}
      onClose={onCloseCreateModal}
      onSaveAndCreateMore={onSaveAndCreateMore}
      onSave={onSaveCreateModal}
    >
      {createModalTab === 'info' && (
        <GoodsCreateProductInfoTab
          formData={formData}
          setFormData={setFormData}
          showStockSection={showStockSection}
          setShowStockSection={setShowStockSection}
          showLocationSection={showLocationSection}
          setShowLocationSection={setShowLocationSection}
          showUnitsSection={showUnitsSection}
          setShowUnitsSection={setShowUnitsSection}
          addBaseUnit={addBaseUnit}
        />
      )}

      {createModalTab === 'desc' && (
        <GoodsCreateProductTextTab
          formData={formData}
          setFormData={setFormData}
          field="description"
          label="Mô tả chi tiết"
          placeholder="Nhập mô tả sản phẩm..."
        />
      )}

      {createModalTab === 'warranty' && (
        <GoodsCreateProductTextTab
          formData={formData}
          setFormData={setFormData}
          field="warranty"
          label="Thông tin bảo hành, bảo trì"
          placeholder="Nhập thông tin bảo hành..."
        />
      )}
    </GoodsCreateProductModal>

    <GoodsViewUnitModal
      isOpen={showAddUnitInView}
      unit={viewModeNewUnit}
      setUnit={setViewModeNewUnit}
      onClose={onCloseAddUnitInView}
      onSave={onSaveAddUnitInView}
    />

    <GoodsVariantModal
      isOpen={showAddAttributeInView}
      title="Thuộc tính"
      description="Thêm đặc điểm như hương vị, dung tích, màu sắc..."
      previewTitle="Hàng cùng loại"
      attributes={viewModeAttributes}
      setAttributes={setViewModeAttributes}
      previewVariants={previewVariants}
      setPreviewVariants={setPreviewVariants}
      generatePreviewVariants={generatePreviewVariants}
      onClose={onCloseAddAttributeInView}
      onSave={onSaveAddAttributeInView}
    />

    <GoodsVariantModal
      isOpen={showAddMoreVariants && !!addingToParentId}
      title="Thêm hàng hóa cùng loại"
      description="Thêm giá trị mới cho các thuộc tính hiện có"
      previewTitle="Hàng cùng loại mới"
      attributes={viewModeAttributes}
      setAttributes={setViewModeAttributes}
      previewVariants={previewVariants}
      setPreviewVariants={setPreviewVariants}
      generatePreviewVariants={generatePreviewVariants}
      onClose={onCloseAddMoreVariants}
      onSave={onSaveMoreVariants}
    />
  </>
);
