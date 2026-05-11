import React from 'react';
import { POSProduct } from '../../types';
import { cartesianProduct, generateId, getNextSKUNumber } from '../../businessLogic';

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

interface UseGoodsVariantWorkflowArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: { key: any, item: any, isDelete?: boolean }[]) => Promise<void>;
  viewingProduct: POSProduct | null;
  setViewingProduct: React.Dispatch<React.SetStateAction<POSProduct | null>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const emptyAttribute = (): ViewModeAttribute => ({ id: generateId(), type: '', values: [], currentValue: '' });

export const useGoodsVariantWorkflow = ({
  products,
  onUpdateProducts,
  onUpdateSurgical,
  viewingProduct,
  setViewingProduct,
  showToast
}: UseGoodsVariantWorkflowArgs) => {
  const [showAddUnitInView, setShowAddUnitInView] = React.useState(false);
  const [showAddAttributeInView, setShowAddAttributeInView] = React.useState(false);
  const [viewModeNewUnit, setViewModeNewUnit] = React.useState<ViewModeUnit>({ name: '', price: 0, directSale: true });
  const [viewModeAttributes, setViewModeAttributes] = React.useState<ViewModeAttribute[]>([emptyAttribute()]);
  const [previewVariants, setPreviewVariants] = React.useState<PreviewVariant[]>([]);
  const [showAddMoreVariants, setShowAddMoreVariants] = React.useState(false);
  const [addingToParentId, setAddingToParentId] = React.useState<string | null>(null);

  const handleAddUnitInViewMode = (addMore: boolean = false) => {
    if (!viewModeNewUnit.name || !viewingProduct) {
      alert('Vui lòng nhập tên đơn vị!');
      return;
    }

    const newUnit = {
      id: generateId(),
      name: viewModeNewUnit.name,
      factor: 1,
      price: viewModeNewUnit.price || viewingProduct.salePrice || 0,
      isBase: true
    };

    const updatedProduct = {
      ...viewingProduct,
      units: [...(viewingProduct.units || []), newUnit]
    };

    if (onUpdateSurgical) {
      onUpdateSurgical([{ key: 'posProducts', item: updatedProduct }]);
    } else {
      onUpdateProducts(products.map(product => product.id === viewingProduct.id ? updatedProduct : product));
    }

    setViewingProduct(updatedProduct);

    if (addMore) {
      setViewModeNewUnit({ name: '', price: 0, directSale: true });
    } else {
      setShowAddUnitInView(false);
      setViewModeNewUnit({ name: '', price: 0, directSale: true });
    }
  };

  const handleAddAttributeInViewMode = () => {
    if (!viewingProduct || previewVariants.length === 0) {
      showToast('Vui lòng tạo ít nhất 1 biến thể!', 'error');
      return;
    }

    const validAttributes = viewModeAttributes.filter(attr => attr.type && attr.values.length > 0);
    const newAttributes = validAttributes.map(attr => ({
      id: generateId(),
      name: attr.type,
      values: attr.values
    }));

    const parentProduct = {
      ...viewingProduct,
      attributes: newAttributes,
      isParent: true,
      sku: '',
      variantCount: previewVariants.length
    };

    const nextSKU = getNextSKUNumber(products);
    const variants: POSProduct[] = previewVariants.map((preview, index) => ({
      id: generateId(),
      sku: `SP${String(nextSKU + index).padStart(6, '0')}`,
      name: preview.name,
      categoryId: viewingProduct.categoryId || '',
      importPrice: preview.importPrice,
      salePrice: preview.salePrice,
      stock: preview.stock,
      minStock: viewingProduct.minStock || 0,
      maxStock: viewingProduct.maxStock,
      unit: viewingProduct.unit || 'Cái',
      brand: viewingProduct.brand,
      description: viewingProduct.description,
      warranty: viewingProduct.warranty,
      allowPoints: viewingProduct.allowPoints,
      weight: viewingProduct.weight,
      weightUnit: viewingProduct.weightUnit,
      location: viewingProduct.location,
      images: viewingProduct.images,
      status: 'Active',
      parentId: viewingProduct.id,
      variantAttributes: preview.attributes,
      createdAt: new Date().toISOString()
    }));

    const allProducts = [parentProduct, ...variants];

    if (onUpdateSurgical) {
      onUpdateSurgical(allProducts.map(product => ({ key: 'posProducts', item: product })));
    } else {
      onUpdateProducts([...products.filter(product => product.id !== viewingProduct.id), ...allProducts]);
    }

    setShowAddAttributeInView(false);
    setViewModeAttributes([emptyAttribute()]);
    setPreviewVariants([]);
    setViewingProduct(null);
    showToast(`Đã tạo ${variants.length} biến thể từ sản phẩm!`);
  };

  const generatePreviewVariants = () => {
    const referenceProduct = viewingProduct || (addingToParentId ? products.find(product => product.id === addingToParentId) : null);
    if (!referenceProduct) return;

    const validAttributes = viewModeAttributes.filter(attr => attr.type && attr.values.length > 0);
    if (validAttributes.length === 0) {
      setPreviewVariants([]);
      return;
    }

    const attributeValues = validAttributes.map(attr => attr.values);
    const combinations = cartesianProduct(attributeValues);

    const variants = combinations.map(combination => {
      const variantAttributes: Record<string, string> = {};
      validAttributes.forEach((attr, attrIndex) => {
        variantAttributes[attr.type] = combination[attrIndex];
      });

      return {
        id: generateId(),
        name: `${referenceProduct.name} - ${combination.join(' - ')}`,
        attributes: variantAttributes,
        importPrice: referenceProduct.importPrice || 0,
        salePrice: referenceProduct.salePrice || 0,
        stock: referenceProduct.stock || 0
      };
    });

    setPreviewVariants(variants);
  };

  const openAddMoreVariants = (parentId: string) => {
    setAddingToParentId(parentId);
    setShowAddMoreVariants(true);
    setViewModeAttributes([emptyAttribute()]);
    setPreviewVariants([]);
  };

  const closeAddMoreVariantsModal = () => {
    setShowAddMoreVariants(false);
    setAddingToParentId(null);
    setViewModeAttributes([emptyAttribute()]);
    setPreviewVariants([]);
  };

  const closeAddAttributeInViewModal = () => {
    setShowAddAttributeInView(false);
    setViewModeAttributes([emptyAttribute()]);
    setPreviewVariants([]);
  };

  const handleSaveMoreVariants = () => {
    if (!addingToParentId || previewVariants.length === 0) {
      alert('Vui lòng tạo ít nhất 1 biến thể!');
      return;
    }

    const parentProduct = products.find(product => product.id === addingToParentId);
    if (!parentProduct) return;

    const nextSKU = getNextSKUNumber(products);
    const newVariants: POSProduct[] = previewVariants.map((preview, index) => ({
      id: generateId(),
      sku: `SP${String(nextSKU + index).padStart(6, '0')}`,
      name: preview.name,
      categoryId: parentProduct.categoryId || '',
      importPrice: preview.importPrice,
      salePrice: preview.salePrice,
      stock: preview.stock,
      minStock: parentProduct.minStock || 0,
      maxStock: parentProduct.maxStock,
      unit: parentProduct.unit || 'Cái',
      brand: parentProduct.brand,
      description: parentProduct.description,
      warranty: parentProduct.warranty,
      allowPoints: parentProduct.allowPoints,
      weight: parentProduct.weight,
      weightUnit: parentProduct.weightUnit,
      location: parentProduct.location,
      images: parentProduct.images,
      status: 'Active',
      parentId: addingToParentId,
      variantAttributes: preview.attributes,
      createdAt: new Date().toISOString()
    }));

    const updatedParent = {
      ...parentProduct,
      variantCount: (parentProduct.variantCount || 0) + newVariants.length
    };

    if (onUpdateSurgical) {
      onUpdateSurgical([
        { key: 'posProducts', item: updatedParent },
        ...newVariants.map(variant => ({ key: 'posProducts', item: variant }))
      ]);
    } else {
      onUpdateProducts([
        ...products.filter(product => product.id !== addingToParentId),
        updatedParent,
        ...newVariants
      ]);
    }

    closeAddMoreVariantsModal();
    alert(`Đã thêm ${newVariants.length} biến thể mới!`);
  };

  return {
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
    handleSaveMoreVariants
  };
};
