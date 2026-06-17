import type { POSProduct, POSProductAttribute } from '../../types';
import { generateId } from './businessLogic.core';

export const cartesianProduct = (arrays: string[][]): string[][] => {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map(v => [v]);
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  return first.flatMap(value => restProduct.map(combination => [value, ...combination]));
};

export const buildVariantProductName = (
  baseName: string,
  variantAttributes?: Record<string, string> | null
): string => {
  const cleanBaseName = String(baseName || '').trim();
  const attributeValues = Object.values(variantAttributes || {})
    .map(value => String(value || '').trim())
    .filter(Boolean);

  if (attributeValues.length === 0) return cleanBaseName;

  const suffix = attributeValues.join(' - ');
  if (!suffix) return cleanBaseName;
  if (cleanBaseName.endsWith(` - ${suffix}`) || cleanBaseName === suffix) return cleanBaseName;
  return `${cleanBaseName} - ${suffix}`;
};

export const stripVariantProductNameSuffix = (
  productName: string,
  variantAttributes?: Record<string, string> | null
): string => {
  const cleanProductName = String(productName || '').trim();
  const attributeValues = Object.values(variantAttributes || {})
    .map(value => String(value || '').trim())
    .filter(Boolean);

  if (attributeValues.length === 0) return cleanProductName;

  const suffix = ` - ${attributeValues.join(' - ')}`;
  if (!cleanProductName.endsWith(suffix)) return cleanProductName;
  return cleanProductName.slice(0, -suffix.length).trim();
};

export const AUTO_SKU_PLACEHOLDER = 'Tự động';
export const INVENTORY_COST_METHOD_STORAGE_KEY = 'inventory_cost_method';
export type InventoryCostMethod = 'fixed' | 'average';

export const isAutoSkuValue = (sku?: string | null): boolean => {
  const value = String(sku || '').trim();
  return value === '' || value === AUTO_SKU_PLACEHOLDER;
};

export const formatAutoSku = (skuNumber: number): string =>
  `SP${String(Math.max(1, skuNumber)).padStart(6, '0')}`;

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
    const variantName = buildVariantProductName(baseProduct.name || '', variantAttributes);

    // Tạo SKU tự động tăng theo chuẩn mã hàng chung của app.
    const variantSKU = formatAutoSku(startingSKU + index);

    return {
      id: generateId(),
      sku: variantSKU,
      name: variantName,
      categoryId: baseProduct.categoryId || '',
      importPrice: baseProduct.importPrice || 0,
      salePrice: baseProduct.salePrice || 0,
      stock: 0,
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

  return skuNumbers.reduce((max, n) => (n > max ? n : max), 0) + 1;
};

export const resolveProductSku = (
  sku: string | undefined | null,
  products: POSProduct[],
  offset = 0
): string => {
  if (!isAutoSkuValue(sku)) return String(sku).trim();
  return formatAutoSku(getNextSKUNumber(products) + offset);
};

export const getInventoryCostMethod = (): InventoryCostMethod => {
  try {
    const saved = localStorage.getItem(INVENTORY_COST_METHOD_STORAGE_KEY);
    return saved === 'fixed' || saved === 'average' ? saved : 'fixed';
  } catch {
    return 'fixed';
  }
};

/**
 * Tính giá vốn đơn vị thực tế sau khi phân bổ chiết khấu toàn đơn vào từng dòng.
 * @param item - Dòng hàng trong phiếu nhập
 * @param billDiscountAmount - Tổng chiết khấu toàn hóa đơn (đã tính ra số tiền)
 * @param itemsNetTotal - Tổng giá trị các dòng trước chiết khấu toàn đơn
 */
export const calcEffectiveUnitPrice = (
  item: { quantity: number; price: number; discount: number },
  billDiscountAmount: number,
  itemsNetTotal: number
): number => {
  const itemNetAmount = item.quantity * item.price - item.discount;
  const itemOrderDiscount =
    itemsNetTotal > 0
      ? Math.round((itemNetAmount / itemsNetTotal) * billDiscountAmount)
      : 0;
  return item.quantity > 0
    ? Math.max(0, (itemNetAmount - itemOrderDiscount) / item.quantity)
    : item.price;
};

/**
 * Tính giá vốn mới sau khi nhập hàng.
 * - `fixed`: Giữ nguyên giá vốn hiện tại. Ngoại lệ: nếu giá vốn hiện tại = 0 (sản phẩm mới),
 *   lấy giá nhập lần đầu để tránh giá vốn = 0 mãi mãi.
 * - `average` (AVCO): Tính bình quân gia quyền theo số lượng tồn kho.
 */
export const calculateNextImportPrice = (
  product: Pick<POSProduct, 'stock' | 'importPrice'>,
  quantity: number,
  purchasePrice: number,
  costMethod: InventoryCostMethod
): number => {
  const currentStock = Number(product.stock) || 0;
  const currentImportPrice = Number(product.importPrice) || 0;
  const incomingQuantity = Math.max(0, Number(quantity) || 0);
  const incomingPrice = Math.max(0, Number(purchasePrice) || 0);

  if (costMethod === 'fixed') {
    return currentImportPrice > 0 ? currentImportPrice : incomingPrice;
  }

  if (incomingQuantity === 0) return currentImportPrice > 0 ? currentImportPrice : incomingPrice;
  if (currentStock <= 0) return incomingPrice;
  const totalQuantity = currentStock + incomingQuantity;
  if (totalQuantity <= 0) return incomingPrice;

  return Math.round(
    ((currentStock * currentImportPrice) + (incomingQuantity * incomingPrice)) / totalQuantity
  );
};
