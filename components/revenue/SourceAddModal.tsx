import React, { useState } from 'react';
import { POSProduct, ShopeeSourceItem } from '../../types';
import { GoodsCreateProductModal } from '../pos/GoodsCreateProductModal';
import { GoodsCreateProductInfoTab } from '../pos/GoodsCreateProductInfoTab';
import { GoodsCreateProductTextTab } from '../pos/GoodsCreateProductTextTab';

interface Props {
  onClose: () => void;
  onSave: (item: ShopeeSourceItem) => Promise<void>;
}

const SourceAddModal: React.FC<Props> = ({ onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'desc' | 'warranty'>('info');
  const [formData, setFormData] = useState<Partial<POSProduct>>({
    sku: '',
    name: '',
    importPrice: 0,
    salePrice: 0,
    status: 'Active',
  });
  const [showStockSection, setShowStockSection] = useState(false);
  const [showLocationSection, setShowLocationSection] = useState(false);
  const [showUnitsSection, setShowUnitsSection] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (createMore = false) => {
    if (!formData.name?.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: crypto.randomUUID(),
        sku: formData.sku?.trim() || crypto.randomUUID().slice(0, 8).toUpperCase(),
        name: formData.name.trim(),
        importPrice: formData.importPrice || 0,
        salePrice: formData.salePrice || 0,
        status: 'active',
        description: formData.description?.trim() || undefined,
        groupId: formData.categoryId || undefined,
      });
      if (!createMore) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <GoodsCreateProductModal
      isOpen={true}
      editingProduct={null}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onClose={onClose}
      onSaveAndCreateMore={() => handleSave(true)}
      onSave={() => handleSave(false)}
    >
      {activeTab === 'info' && (
        <GoodsCreateProductInfoTab
          products={[]}
          productGroups={[]}
          editingProduct={null}
          formData={formData}
          setFormData={setFormData}
          showStockSection={showStockSection}
          setShowStockSection={setShowStockSection}
          showLocationSection={showLocationSection}
          setShowLocationSection={setShowLocationSection}
          showUnitsSection={showUnitsSection}
          setShowUnitsSection={setShowUnitsSection}
          addBaseUnit={() => {}}
        />
      )}
      {activeTab === 'desc' && (
        <GoodsCreateProductTextTab
          formData={formData}
          setFormData={setFormData}
          field="description"
          label="Mô tả chi tiết"
          placeholder="Nhập mô tả sản phẩm..."
        />
      )}
      {activeTab === 'warranty' && (
        <GoodsCreateProductTextTab
          formData={formData}
          setFormData={setFormData}
          field="warranty"
          label="Thông tin bảo hành, bảo trì"
          placeholder="Nhập thông tin bảo hành..."
        />
      )}
    </GoodsCreateProductModal>
  );
};

export default SourceAddModal;
