import React from 'react';
import { AppDataSurgicalUpdate, POSProduct } from '../../types';
import { generateId, generateProductVariants, getNextSKUNumber } from '../../businessLogic';

type GoodsTab = 'goods' | 'purchase' | 'kho' | 'audit_form' | 'product_form';
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
    setFormData(emptyProductForm('Tự động'));
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

    if (editingProduct) {
      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posProducts', item: { ...editingProduct, ...formData } as POSProduct }]);
      } else {
        onUpdateProducts(products.map(product => product.id === editingProduct.id ? { ...product, ...formData } as POSProduct : product));
      }
    } else if (hasAttributes) {
      const parentProduct: POSProduct = {
        ...formData,
        id: generateId(),
        sku: '',
        status: 'Active',
        categoryId: formData.categoryId || 'Chưa phân loại',
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
        onUpdateSurgical(allProducts.map(product => ({ key: 'posProducts', item: product })));
      } else {
        onUpdateProducts([...products, ...allProducts]);
      }

      showToast(`Đã tạo sản phẩm với ${variantCount} biến thể!`);
    } else {
      if (!formData.sku) {
        showToast('Vui lòng nhập mã hàng!', 'error');
        return;
      }

      const newProduct: POSProduct = {
        ...formData,
        id: generateId(),
        status: 'Active',
        categoryId: formData.categoryId || 'Chưa phân loại',
        createdAt: new Date().toISOString()
      } as POSProduct;

      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posProducts', item: newProduct }]);
      } else {
        onUpdateProducts([...products, newProduct]);
      }

      if (isQuickAddMode && activeTab === 'purchase') {
        handleAddProductToPurchase(newProduct);
      }
    }

    if (isQuickAddMode) {
      setShowProductModal(false);
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
    setFormData(emptyProductForm(`HH-${Date.now().toString().slice(-6)}`));
    setIsQuickAddMode(true);
    setShowProductModal(true);
  };

  const addBaseUnit = () => {
    setShowAddUnitModal(true);
  };

  const handleSaveBaseUnit = (addMore: boolean = false) => {
    if (!newUnitName) {
      alert('Vui lòng nhập tên đơn vị!');
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
