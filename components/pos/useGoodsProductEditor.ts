import React from 'react';
import { AppDataSurgicalUpdate, POSProduct } from '../../types';
import {
  AUTO_SKU_PLACEHOLDER,
  generateId,
  generateProductVariants,
  getNextSKUNumber,
  isAutoSkuValue,
  resolveProductSku,
} from '../../src/lib';

type GoodsTab = 'goods' | 'purchase' | 'kho' | 'pricing' | 'warranty' | 'audit_form' | 'product_form';
type ProductFormTab = 'info' | 'desc' | 'warranty' | 'units' | 'related' | 'channels';
type CreateModalTab = 'info' | 'desc' | 'warranty';
type OpenInputModal = (config: {
  title: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number';
  defaultValue?: string | number;
  onConfirm: (val: string) => void;
}) => void;

const emptyProductForm = (sku = ''): Partial<POSProduct> => ({
  name: '',
  sku,
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
  attributes: []
});

const GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY = 'goods_barcode_manual_mode';

const getGoodsBarcodeManualMode = () => {
  try {
    return localStorage.getItem(GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

interface UseGoodsProductEditorArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  activeTab: GoodsTab;
  setActiveTab: React.Dispatch<React.SetStateAction<GoodsTab>>;
  handleAddProductToPurchase: (product: POSProduct) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  openInputModal: OpenInputModal;
  closeInputModal: () => void;
}

export const useGoodsProductEditor = ({
  products,
  onUpdateProducts,
  onUpdateSurgical,
  activeTab,
  setActiveTab,
  handleAddProductToPurchase,
  showToast,
  openInputModal,
  closeInputModal
}: UseGoodsProductEditorArgs) => {
  const [editingProduct, setEditingProduct] = React.useState<POSProduct | null>(null);
  const [formData, setFormData] = React.useState<Partial<POSProduct>>(emptyProductForm());
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showProductModal, setShowProductModal] = React.useState(false);
  const [isQuickAddMode, setIsQuickAddMode] = React.useState(false);
  const [activeFormTab, setActiveFormTab] = React.useState<ProductFormTab>('info');
  const [createModalTab, setCreateModalTab] = React.useState<CreateModalTab>('info');
  const [showStockSection, setShowStockSection] = React.useState(true);
  const [showLocationSection, setShowLocationSection] = React.useState(false);
  const [showUnitsSection, setShowUnitsSection] = React.useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = React.useState(false);
  const [newUnitName, setNewUnitName] = React.useState('');
  const [newUnitPrice, setNewUnitPrice] = React.useState(0);
  const [newUnitDirectSale, setNewUnitDirectSale] = React.useState(true);

  const openCreateProduct = () => {
    setShowCreateModal(true);
    setCreateModalTab('info');
    setFormData(emptyProductForm(getGoodsBarcodeManualMode() ? '' : AUTO_SKU_PLACEHOLDER));
  };

  const openCreateSameType = (product: POSProduct) => {
    setEditingProduct(null);
    setFormData({
      ...emptyProductForm(getGoodsBarcodeManualMode() ? '' : AUTO_SKU_PLACEHOLDER),
      categoryId: product.categoryId,
      unit: product.unit,
    });
    setShowCreateModal(true);
    setCreateModalTab('info');
  };

  const openProductEditor = (product: POSProduct) => {
    setEditingProduct(product);
    setFormData(product);
    setShowCreateModal(true);
    setCreateModalTab('info');
  };

  const handleSaveProduct = (stayOnPage: boolean = false) => {
    if (!formData.name) {
      showToast('Vui lòng nhập tên hàng!', 'error');
      return;
    }

    const hasAttributes = formData.attributes && formData.attributes.length > 0 &&
      formData.attributes.some(attr => attr.values && attr.values.length > 0);
    const normalizedSku = String(formData.sku || '').trim();
    const normalizedBarcode = String(formData.barcode || '').trim();
    const normalizedCategoryId = String(formData.categoryId || '').trim();
    const barcodeManualMode = getGoodsBarcodeManualMode();

    if (!normalizedCategoryId) {
      showToast('Vui lòng chọn hoặc nhập nhóm hàng!', 'error');
      return;
    }

    if ((formData.importPrice ?? 0) < 0 || (formData.salePrice ?? 0) < 0) {
      showToast('Giá vốn và giá bán không được âm!', 'error');
      return;
    }

    if (barcodeManualMode && isAutoSkuValue(normalizedSku)) {
      showToast('Vui lòng nhập hoặc quét mã hàng bạn đang có!', 'error');
      return;
    }

    const duplicateSku = !isAutoSkuValue(normalizedSku)
      ? products.find(
          product => product.sku === normalizedSku && product.id !== editingProduct?.id
        )
      : null;
    if (duplicateSku) {
      showToast(`Mã hàng ${normalizedSku} đã tồn tại ở sản phẩm "${duplicateSku.name}".`, 'error');
      return;
    }

    const duplicateBarcode = normalizedBarcode
      ? products.find(
          product => product.barcode === normalizedBarcode && product.id !== editingProduct?.id
        )
      : null;
    if (duplicateBarcode) {
      showToast(`Mã vạch ${normalizedBarcode} đã tồn tại ở sản phẩm "${duplicateBarcode.name}".`, 'error');
      return;
    }

    if (editingProduct) {
      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posProducts', item: { ...editingProduct, ...formData } as POSProduct }]).catch(err =>
          showToast(`Lỗi lưu sản phẩm: ${err instanceof Error ? err.message : String(err)}`, 'error')
        );
      } else {
        onUpdateProducts(products.map(product => product.id === editingProduct.id ? { ...product, ...formData } as POSProduct : product));
      }
    } else if (hasAttributes) {
      const parentProduct: POSProduct = {
        ...formData,
        id: generateId(),
        sku: '',
        stock: 0,
        status: 'Active',
        categoryId: normalizedCategoryId,
        createdAt: new Date().toISOString(),
        isParent: true,
        variantCount: 0
      } as POSProduct;

      const variantCount = formData.attributes!.reduce((total, attr) => total * (attr.values?.length || 1), 1);
      parentProduct.variantCount = variantCount;

      const nextSKU = getNextSKUNumber(products);
      const variants = generateProductVariants(parentProduct, formData.attributes!, nextSKU);
      const allProducts = [parentProduct, ...variants];

      if (onUpdateSurgical) {
        onUpdateSurgical(allProducts.map(product => ({ key: 'posProducts', item: product }))).catch(err =>
          showToast(`Lỗi tạo sản phẩm: ${err instanceof Error ? err.message : String(err)}`, 'error')
        );
      } else {
        onUpdateProducts([...products, ...allProducts]);
      }

      showToast(`Đã tạo sản phẩm với ${variantCount} biến thể!`);
    } else {
      const newProduct: POSProduct = {
        ...formData,
        id: generateId(),
        sku: resolveProductSku(formData.sku, products),
        status: 'Active',
        categoryId: normalizedCategoryId,
        createdAt: new Date().toISOString(),
        isParent: false,
      } as POSProduct;

      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posProducts', item: newProduct }]).catch(err =>
          showToast(`Lỗi tạo sản phẩm: ${err instanceof Error ? err.message : String(err)}`, 'error')
        );
      } else {
        onUpdateProducts([...products, newProduct]);
      }

      if (isQuickAddMode && activeTab === 'purchase') {
        handleAddProductToPurchase(newProduct);
      }
    }

    if (isQuickAddMode) {
      setShowProductModal(false);
      setShowCreateModal(false);
      setIsQuickAddMode(false);
    } else if (!stayOnPage) {
      setActiveTab('goods');
      setShowCreateModal(false);
    }

    setEditingProduct(null);
    setFormData(emptyProductForm());

    if (stayOnPage) {
      showToast('Đã lưu sản phẩm thành công. Nhập sản phẩm tiếp theo.');
    }
  };

  const handleOpenQuickAddProduct = () => {
    setEditingProduct(null);
    setFormData(emptyProductForm(getGoodsBarcodeManualMode() ? '' : AUTO_SKU_PLACEHOLDER));
    setIsQuickAddMode(true);
    setCreateModalTab('info');
    setShowCreateModal(true);
  };

  const addBaseUnit = () => {
    setShowAddUnitModal(true);
  };

  const handleSaveBaseUnit = (addMore: boolean = false) => {
    if (!newUnitName) {
      showToast('Vui lòng nhập tên đơn vị!', 'error');
      return;
    }

    setFormData({
      ...formData,
      unit: newUnitName,
      units: [
        ...(formData.units || []),
        {
          id: generateId(),
          name: newUnitName,
          factor: 1,
          price: newUnitPrice || formData.salePrice || 0,
          isBase: true
        }
      ]
    });

    if (addMore) {
      setNewUnitName('');
      setNewUnitPrice(0);
      setNewUnitDirectSale(true);
    } else {
      setShowAddUnitModal(false);
      setNewUnitName('');
      setNewUnitPrice(0);
      setNewUnitDirectSale(true);
    }
  };

  const addConversionUnit = () => {
    openInputModal({
      title: 'Thêm đơn vị quy đổi',
      label: 'Tên đơn vị (VD: Đôi, Thùng...)',
      type: 'text',
      onConfirm: (name) => {
        closeInputModal();
        openInputModal({
          title: 'Hệ số quy đổi',
          label: `1 ${name} = ? đơn vị cơ bản`,
          type: 'number',
          placeholder: 'VD: 12',
          onConfirm: (factor) => {
            const numericFactor = Number(factor);
            if (name && numericFactor > 0) {
              setFormData({
                ...formData,
                units: [...(formData.units || []), {
                  id: generateId(),
                  name,
                  factor: numericFactor,
                  price: (formData.salePrice || 0) * numericFactor,
                  isBase: false
                }]
              });
              showToast(`Đã thêm đơn vị ${name} (x${numericFactor})`);
            }
            closeInputModal();
          }
        });
      }
    });
  };

  return {
    editingProduct,
    setEditingProduct,
    formData,
    openCreateSameType,
    setFormData,
    showCreateModal,
    setShowCreateModal,
    showProductModal,
    setShowProductModal,
    isQuickAddMode,
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
    addConversionUnit
  };
};
