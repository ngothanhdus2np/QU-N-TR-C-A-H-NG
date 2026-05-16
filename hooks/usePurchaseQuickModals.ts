import { useState } from 'react';
import { POSProduct } from '../types';
import { CreateProductModalTab } from '../components/pos/GoodsCreateProductModal';
import { AUTO_SKU_PLACEHOLDER } from '../src/lib';

export function usePurchaseQuickModals() {
  // Quick product modal states
  const [showQuickProductForm, setShowQuickProductForm] = useState(false);
  const [quickProductTarget, setQuickProductTarget] = useState<'purchase' | 'return'>('purchase');
  const [quickProductModalTab, setQuickProductModalTab] = useState<CreateProductModalTab>('info');
  const [showQuickProductStockSection, setShowQuickProductStockSection] = useState(true);
  const [showQuickProductLocationSection, setShowQuickProductLocationSection] = useState(false);
  const [showQuickProductUnitsSection, setShowQuickProductUnitsSection] = useState(false);
  const [quickProductForm, setQuickProductForm] = useState<Partial<POSProduct>>({
    name: '',
    sku: AUTO_SKU_PLACEHOLDER,
    categoryId: '',
    categoryPath: '',
    brand: '',
    importPrice: 0,
    salePrice: 0,
    stock: 0,
    minStock: 0,
    unit: 'Cái',
    description: '',
    status: 'Active',
  });

  // Quick supplier modal states
  const [showQuickSupplierForm, setShowQuickSupplierForm] = useState(false);
  const [quickSupplierTarget, setQuickSupplierTarget] = useState<'purchase' | 'return'>('purchase');

  // Helper functions
  const resetQuickProductForm = () => {
    setQuickProductForm({
      name: '',
      sku: AUTO_SKU_PLACEHOLDER,
      categoryId: '',
      categoryPath: '',
      brand: '',
      importPrice: 0,
      salePrice: 0,
      stock: 0,
      minStock: 0,
      unit: 'Cái',
      description: '',
      status: 'Active',
    });
  };

  return {
    // Quick product
    showQuickProductForm,
    setShowQuickProductForm,
    quickProductTarget,
    setQuickProductTarget,
    quickProductModalTab,
    setQuickProductModalTab,
    showQuickProductStockSection,
    setShowQuickProductStockSection,
    showQuickProductLocationSection,
    setShowQuickProductLocationSection,
    showQuickProductUnitsSection,
    setShowQuickProductUnitsSection,
    quickProductForm,
    setQuickProductForm,
    resetQuickProductForm,

    // Quick supplier
    showQuickSupplierForm,
    setShowQuickSupplierForm,
    quickSupplierTarget,
    setQuickSupplierTarget,
  };
}
