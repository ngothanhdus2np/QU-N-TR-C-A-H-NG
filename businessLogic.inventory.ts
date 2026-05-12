import type { POSProduct, POSProductAttribute } from './types';
import { generateId } from './businessLogic.core';

export const cartesianProduct = (arrays: string[][]): string[][] => {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map(v => [v]);
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  return first.flatMap(value => restProduct.map(combination => [value, ...combination]));
};

/**
 * Sinh các biến thể sản phẩm từ thuộc tính
 * @param baseProduct - Sản phẩm gốc
 * @param attributes - Mảng thuộc tính với giá trị
 * @param startingSKU - SKU bắt đầu (số)
 * @returns Mảng các sản phẩm biến thể
 */
export const generateProductVariants = (
  baseProduct: Partial<POSProduct>,
  attributes: POSProductAttribute[],
  startingSKU: number
): POSProduct[] => {
  if (!attributes || attributes.length === 0) {
    return [];
  }

  // Lọc các thuộc tính có giá trị
  const validAttributes = attributes.filter(attr => attr.values && attr.values.length > 0);

  if (validAttributes.length === 0) {
    return [];
  }

  // Dùng hàm cartesianProduct đã export ở trên
  const attributeValues = validAttributes.map(attr => attr.values);
  const combinations = cartesianProduct(attributeValues);

  // Tạo các sản phẩm biến thể
  const variants: POSProduct[] = combinations.map((combination, index) => {
    // Tạo variantAttributes object
    const variantAttributes: Record<string, string> = {};
    validAttributes.forEach((attr, attrIndex) => {
      variantAttributes[attr.name] = combination[attrIndex];
    });

    // Tạo tên biến thể
    const variantName = `${baseProduct.name} - ${combination.join(' - ')}`;

    // Tạo SKU tự động tăng
    const variantSKU = `SP${String(startingSKU + index).padStart(6, '0')}`;

    return {
      id: generateId(),
      sku: variantSKU,
      name: variantName,
      categoryId: baseProduct.categoryId || '',
      importPrice: baseProduct.importPrice || 0,
      salePrice: baseProduct.salePrice || 0,
      stock: baseProduct.stock || 0,
      minStock: baseProduct.minStock || 0,
      maxStock: baseProduct.maxStock,
      unit: baseProduct.unit || 'Cái',
      brand: baseProduct.brand,
      description: baseProduct.description,
      warranty: baseProduct.warranty,
      allowPoints: baseProduct.allowPoints,
      weight: baseProduct.weight,
      weightUnit: baseProduct.weightUnit,
      location: baseProduct.location,
      images: baseProduct.images,
      status: 'Active',
      parentId: baseProduct.id, // Liên kết với sản phẩm cha
      variantAttributes: variantAttributes,
      createdAt: new Date().toISOString(),
    } as POSProduct;
  });

  return variants;
};

/**
 * Tính SKU tiếp theo dựa trên danh sách sản phẩm hiện có
 */
export const getNextSKUNumber = (products: POSProduct[]): number => {
  const skuNumbers = products
    .map(p => p.sku)
    .filter(sku => sku && sku.startsWith('SP'))
    .map(sku => parseInt(sku.substring(2)))
    .filter(num => !isNaN(num));

  if (skuNumbers.length === 0) {
    return 1;
  }

  return Math.max(...skuNumbers) + 1;
};
