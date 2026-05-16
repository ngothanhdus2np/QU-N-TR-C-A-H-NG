import React from 'react';
import { AppDataSurgicalUpdate, POSProduct } from '../../types';
import { cartesianProduct, formatAutoSku, generateId, getNextSKUNumber } from '../../src/lib';

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
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  viewingProduct: POSProduct | null;
  setViewingProduct: React.Dispatch<React.SetStateAction<POSProduct | null>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const emptyAttribute = (): ViewModeAttribute => ({
  id: generateId(),
  type: '',
  values: [],
  currentValue: '',
});

const normalizeText = (value: string) => String(value || '').trim();
const normalizeKey = (value: string) => normalizeText(value).toLocaleLowerCase('vi-VN');

const getCommittedAttributes = (attributes: ViewModeAttribute[]) =>
  attributes
    .map(attribute => {
      const type = normalizeText(attribute.type);
      const values = [...attribute.values, attribute.currentValue]
        .map(normalizeText)
        .filter(Boolean)
        .filter(
          (value, index, arr) =>
            arr.findIndex(item => normalizeKey(item) === normalizeKey(value)) === index
        );

      return { ...attribute, type, values, currentValue: '' };
    })
    .filter(attribute => attribute.type && attribute.values.length > 0);

const getAttributeSignature = (attributes: Record<string, string>) =>
  Object.entries(attributes)
    .map(([key, value]) => [normalizeKey(key), normalizeKey(value)] as const)
    .filter(([key, value]) => key && value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

const isAttributeSubset = (subset: Record<string, string>, superset: Record<string, string>) => {
  const subsetEntries = Object.entries(subset).filter(([, value]) => normalizeText(value));
  if (subsetEntries.length === 0) return false;
  if (subsetEntries.length >= Object.keys(superset).length) return false;
  const normalizedSuperset = new Map(
    Object.entries(superset).map(([key, value]) => [normalizeKey(key), normalizeKey(value)])
  );

  return subsetEntries.every(
    ([key, value]) => normalizedSuperset.get(normalizeKey(key)) === normalizeKey(value)
  );
};

const hasDuplicateAttributeNames = (attributes: ViewModeAttribute[]) => {
  const keys = attributes.map(attribute => normalizeKey(attribute.type)).filter(Boolean);
  return new Set(keys).size !== keys.length;
};

const getExistingAttributeNamesForParent = (products: POSProduct[], parentId: string) => {
  const names = new Map<string, string>();
  products
    .filter(product => product.parentId === parentId)
    .forEach(product => {
      Object.keys(product.variantAttributes || {}).forEach(name => {
        const cleanName = normalizeText(name);
        if (cleanName) names.set(normalizeKey(cleanName), cleanName);
      });
    });

  return Array.from(names.values());
};

const buildPreviewVariants = (
  referenceProduct: POSProduct,
  validAttributes: ViewModeAttribute[]
): PreviewVariant[] => {
  const attributeValues = validAttributes.map(attr => attr.values);
  const combinations = cartesianProduct(attributeValues);

  return combinations.map(combination => {
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
      stock: referenceProduct.stock || 0,
    };
  });
};

export const useGoodsVariantWorkflow = ({
  products,
  onUpdateProducts,
  onUpdateSurgical,
  viewingProduct,
  setViewingProduct,
  showToast,
}: UseGoodsVariantWorkflowArgs) => {
  const [showAddUnitInView, setShowAddUnitInView] = React.useState(false);
  const [showAddAttributeInView, setShowAddAttributeInView] = React.useState(false);
  const [viewModeNewUnit, setViewModeNewUnit] = React.useState<ViewModeUnit>({
    name: '',
    price: 0,
    directSale: true,
  });
  const [viewModeAttributes, setViewModeAttributes] = React.useState<ViewModeAttribute[]>([
    emptyAttribute(),
  ]);
  const [previewVariants, setPreviewVariants] = React.useState<PreviewVariant[]>([]);
  const [showAddMoreVariants, setShowAddMoreVariants] = React.useState(false);
  const [addingToParentId, setAddingToParentId] = React.useState<string | null>(null);
  const [addMoreVariantSource, setAddMoreVariantSource] = React.useState<'table' | 'detail'>(
    'table'
  );

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
      isBase: true,
    };

    const updatedProduct = {
      ...viewingProduct,
      units: [...(viewingProduct.units || []), newUnit],
    };

    if (onUpdateSurgical) {
      onUpdateSurgical([{ key: 'posProducts', item: updatedProduct }]);
    } else {
      onUpdateProducts(
        products.map(product => (product.id === viewingProduct.id ? updatedProduct : product))
      );
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

    const validAttributes = getCommittedAttributes(viewModeAttributes);
    if (hasDuplicateAttributeNames(validAttributes)) {
      showToast('Tên thuộc tính bị trùng. Vui lòng gộp giá trị vào cùng một thuộc tính.', 'error');
      return;
    }
    const newAttributes = validAttributes.map(attr => ({
      id: generateId(),
      name: attr.type,
      values: attr.values,
    }));

    const parentProduct = {
      ...viewingProduct,
      attributes: newAttributes,
      isParent: true,
      sku: '',
      variantCount: previewVariants.length,
    };

    const nextSKU = getNextSKUNumber(products);
    const variants: POSProduct[] = previewVariants.map((preview, index) => ({
      id: generateId(),
      sku: formatAutoSku(nextSKU + index),
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
      createdAt: new Date().toISOString(),
    }));

    const allProducts = [parentProduct, ...variants];

    if (onUpdateSurgical) {
      onUpdateSurgical(allProducts.map(product => ({ key: 'posProducts', item: product })));
    } else {
      onUpdateProducts([
        ...products.filter(product => product.id !== viewingProduct.id),
        ...allProducts,
      ]);
    }

    setShowAddAttributeInView(false);
    setViewModeAttributes([emptyAttribute()]);
    setPreviewVariants([]);
    setViewingProduct(null);
    showToast(`Đã tạo ${variants.length} biến thể từ sản phẩm!`);
  };

  const generatePreviewVariants = () => {
    const referenceProduct =
      viewingProduct ||
      (addingToParentId ? products.find(product => product.id === addingToParentId) : null);
    if (!referenceProduct) return;

    const validAttributes = getCommittedAttributes(viewModeAttributes);
    if (validAttributes.length === 0) {
      setPreviewVariants([]);
      return;
    }

    setPreviewVariants(buildPreviewVariants(referenceProduct, validAttributes));
  };

  const openAddMoreVariants = (
    parentId: string,
    source: 'table' | 'detail' = 'table',
    variantAttributes?: Record<string, string>
  ) => {
    const existingAttributeNames = getExistingAttributeNamesForParent(products, parentId);
    setAddingToParentId(parentId);
    setAddMoreVariantSource(source);
    setShowAddMoreVariants(true);
    if (source === 'detail' && existingAttributeNames.length > 0) {
      setViewModeAttributes(
        existingAttributeNames.map(name => {
          const existingValue = variantAttributes
            ? Object.entries(variantAttributes).find(
                ([k]) => normalizeKey(k) === normalizeKey(name)
              )?.[1]
            : undefined;
          return {
            ...emptyAttribute(),
            type: name,
            values: existingValue ? [existingValue] : [],
          };
        })
      );
    } else if (source === 'table' && existingAttributeNames.length === 1) {
      setViewModeAttributes([{ ...emptyAttribute(), type: existingAttributeNames[0] }]);
    } else {
      setViewModeAttributes([emptyAttribute()]);
    }
    setPreviewVariants([]);
  };

  const closeAddMoreVariantsModal = () => {
    setShowAddMoreVariants(false);
    setAddingToParentId(null);
    setAddMoreVariantSource('table');
    setViewModeAttributes([emptyAttribute()]);
    setPreviewVariants([]);
  };

  const closeAddAttributeInViewModal = () => {
    setShowAddAttributeInView(false);
    setViewModeAttributes([emptyAttribute()]);
    setPreviewVariants([]);
  };

  const handleSaveMoreVariants = () => {
    const committedAttributes = getCommittedAttributes(viewModeAttributes);

    if (addMoreVariantSource === 'detail' && addingToParentId) {
      const requiredNames = getExistingAttributeNamesForParent(products, addingToParentId);
      for (const name of requiredNames) {
        const found = committedAttributes.find(a => normalizeKey(a.type) === normalizeKey(name));
        if (!found || found.values.length === 0) {
          showToast(`Vui lòng nhập giá trị cho thuộc tính "${name}".`, 'error');
          return;
        }
      }
    }

    if (hasDuplicateAttributeNames(committedAttributes)) {
      showToast('Tên thuộc tính bị trùng. Vui lòng gộp giá trị vào cùng một thuộc tính.', 'error');
      return;
    }

    if (!addingToParentId) {
      alert('Vui lòng tạo ít nhất 1 biến thể!');
      return;
    }

    const parentProduct = products.find(product => product.id === addingToParentId);
    if (!parentProduct) return;

    const existingAttributeNames = getExistingAttributeNamesForParent(products, addingToParentId);
    if (addMoreVariantSource === 'table' && existingAttributeNames.length === 1) {
      const onlyAttributeName = existingAttributeNames[0];
      const usesOnlyExistingAttribute =
        committedAttributes.length === 1 &&
        normalizeKey(committedAttributes[0].type) === normalizeKey(onlyAttributeName);

      if (!usesOnlyExistingAttribute) {
        showToast(
          `Nhóm hàng này chỉ dùng thuộc tính ${onlyAttributeName}. Vui lòng chỉ thêm giá trị cho thuộc tính này.`,
          'error'
        );
        return;
      }
    }

    const variantsToSave =
      previewVariants.length > 0
        ? previewVariants
        : buildPreviewVariants(parentProduct, committedAttributes);

    if (variantsToSave.length === 0) {
      alert('Vui lòng tạo ít nhất 1 biến thể!');
      return;
    }

    const existingVariants = products.filter(product => product.parentId === addingToParentId);
    const existingSignatures = new Set(
      existingVariants.map(product => getAttributeSignature(product.variantAttributes || {}))
    );
    const previewSignatures = new Set<string>();
    const duplicatePreview = variantsToSave.find(preview => {
      const signature = getAttributeSignature(preview.attributes);
      if (!signature) return false;
      if (previewSignatures.has(signature)) return true;
      previewSignatures.add(signature);
      return false;
    });
    if (duplicatePreview) {
      showToast('Danh sách thêm mới có biến thể trùng thuộc tính. Vui lòng kiểm tra lại.', 'error');
      return;
    }

    const duplicatedExisting = variantsToSave.find(preview =>
      existingSignatures.has(getAttributeSignature(preview.attributes))
    );
    if (duplicatedExisting) {
      const label = Object.entries(duplicatedExisting.attributes)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' - ');
      showToast(`Biến thể ${label} đã tồn tại. Không thể thêm trùng.`, 'error');
      return;
    }

    const hasDetailLevelOverlap = variantsToSave.some(preview =>
      existingVariants.some(existing => {
        const existingAttrs = existing.variantAttributes || {};
        return (
          isAttributeSubset(existingAttrs, preview.attributes) ||
          isAttributeSubset(preview.attributes, existingAttrs)
        );
      })
    );
    if (
      hasDetailLevelOverlap &&
      !confirm(
        'Đã có biến thể dùng một phần thuộc tính giống nhau. Bạn vẫn muốn thêm biến thể mới cùng cấp dưới sản phẩm cha?'
      )
    ) {
      return;
    }

    const nextSKU = getNextSKUNumber(products);
    const newVariants: POSProduct[] = variantsToSave.map((preview, index) => ({
      id: generateId(),
      sku: formatAutoSku(nextSKU + index),
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
      createdAt: new Date().toISOString(),
    }));

    const attributeMap = new Map<string, Set<string>>();
    (parentProduct.attributes || []).forEach(attribute => {
      const key = normalizeText(attribute.name);
      if (!key) return;
      if (!attributeMap.has(key)) attributeMap.set(key, new Set());
      attribute.values.forEach(value => attributeMap.get(key)?.add(value));
    });
    committedAttributes.forEach(attribute => {
      if (!attributeMap.has(attribute.type)) attributeMap.set(attribute.type, new Set());
      attribute.values.forEach(value => attributeMap.get(attribute.type)?.add(value));
    });

    const updatedParent = {
      ...parentProduct,
      attributes: Array.from(attributeMap.entries()).map(([name, values]) => ({
        id: generateId(),
        name,
        values: Array.from(values),
      })),
      variantCount: (parentProduct.variantCount || 0) + newVariants.length,
    };

    if (onUpdateSurgical) {
      onUpdateSurgical([
        { key: 'posProducts', item: updatedParent },
        ...newVariants.map(
          (variant): AppDataSurgicalUpdate => ({ key: 'posProducts', item: variant })
        ),
      ]);
    } else {
      onUpdateProducts([
        ...products.filter(product => product.id !== addingToParentId),
        updatedParent,
        ...newVariants,
      ]);
    }

    closeAddMoreVariantsModal();
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
    addMoreVariantSource,
    handleAddUnitInViewMode,
    handleAddAttributeInViewMode,
    generatePreviewVariants,
    openAddMoreVariants,
    closeAddMoreVariantsModal,
    closeAddAttributeInViewModal,
    handleSaveMoreVariants,
  };
};
