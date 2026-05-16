import { describe, it, expect } from 'vitest';
import {
  cartesianProduct,
  buildVariantProductName,
  stripVariantProductNameSuffix,
  generateProductVariants,
  getNextSKUNumber,
} from '../../src/lib/businessLogic.inventory';
import type { POSProduct, POSProductAttribute } from '../../types';

// ─── cartesianProduct ─────────────────────────────────────────────────────

describe('cartesianProduct', () => {
  it('trả về mảng rỗng khi input rỗng', () => {
    expect(cartesianProduct([])).toEqual([[]]);
  });

  it('trả về mảng đơn khi chỉ có 1 thuộc tính', () => {
    expect(cartesianProduct([['Đỏ', 'Xanh']])).toEqual([['Đỏ'], ['Xanh']]);
  });

  it('tạo tổ hợp đúng với 2 thuộc tính', () => {
    const result = cartesianProduct([
      ['Đỏ', 'Xanh'],
      ['S', 'M', 'L'],
    ]);
    expect(result).toEqual([
      ['Đỏ', 'S'],
      ['Đỏ', 'M'],
      ['Đỏ', 'L'],
      ['Xanh', 'S'],
      ['Xanh', 'M'],
      ['Xanh', 'L'],
    ]);
  });

  it('tạo tổ hợp đúng với 3 thuộc tính', () => {
    const result = cartesianProduct([
      ['Đỏ', 'Xanh'],
      ['S', 'M'],
      ['Cotton', 'Polyester'],
    ]);
    expect(result.length).toBe(8); // 2 * 2 * 2
    expect(result[0]).toEqual(['Đỏ', 'S', 'Cotton']);
    expect(result[7]).toEqual(['Xanh', 'M', 'Polyester']);
  });

  it('xử lý đúng khi có thuộc tính chỉ có 1 giá trị', () => {
    const result = cartesianProduct([['Đỏ'], ['S', 'M']]);
    expect(result).toEqual([
      ['Đỏ', 'S'],
      ['Đỏ', 'M'],
    ]);
  });

  it('tính đúng số lượng tổ hợp', () => {
    // 3 màu * 4 size * 2 chất liệu = 24 tổ hợp
    const result = cartesianProduct([
      ['Đỏ', 'Xanh', 'Vàng'],
      ['S', 'M', 'L', 'XL'],
      ['Cotton', 'Polyester'],
    ]);
    expect(result.length).toBe(24);
  });
});

// ─── buildVariantProductName ──────────────────────────────────────────────

describe('buildVariantProductName', () => {
  it('trả về tên gốc khi không có thuộc tính', () => {
    expect(buildVariantProductName('Áo thun', null)).toBe('Áo thun');
    expect(buildVariantProductName('Áo thun', {})).toBe('Áo thun');
  });

  it('nối tên với thuộc tính bằng dấu gạch ngang', () => {
    expect(buildVariantProductName('Áo thun', { Màu: 'Đỏ', Size: 'M' })).toBe('Áo thun - Đỏ - M');
  });

  it('không nhân đôi suffix nếu tên đã có sẵn', () => {
    expect(buildVariantProductName('Áo thun - Đỏ - M', { Màu: 'Đỏ', Size: 'M' })).toBe(
      'Áo thun - Đỏ - M'
    );
  });

  it('xử lý đúng khi chỉ có 1 thuộc tính', () => {
    expect(buildVariantProductName('Áo thun', { Màu: 'Đỏ' })).toBe('Áo thun - Đỏ');
  });

  it('bỏ qua thuộc tính rỗng', () => {
    expect(buildVariantProductName('Áo thun', { Màu: 'Đỏ', Size: '' })).toBe('Áo thun - Đỏ');
  });

  it('xử lý đúng khi tên gốc rỗng', () => {
    expect(buildVariantProductName('', { Màu: 'Đỏ', Size: 'M' })).toBe(' - Đỏ - M');
  });

  it('trim khoảng trắng thừa', () => {
    expect(buildVariantProductName('  Áo thun  ', { Màu: '  Đỏ  ', Size: '  M  ' })).toBe(
      'Áo thun - Đỏ - M'
    );
  });

  it('xử lý đúng khi tên = suffix (edge case)', () => {
    expect(buildVariantProductName('Đỏ - M', { Màu: 'Đỏ', Size: 'M' })).toBe('Đỏ - M');
  });
});

// ─── stripVariantProductNameSuffix ────────────────────────────────────────

describe('stripVariantProductNameSuffix', () => {
  it('bỏ suffix thuộc tính khỏi tên sản phẩm', () => {
    expect(stripVariantProductNameSuffix('Áo thun - Đỏ - M', { Màu: 'Đỏ', Size: 'M' })).toBe(
      'Áo thun'
    );
  });

  it('giữ nguyên tên khi không có thuộc tính', () => {
    expect(stripVariantProductNameSuffix('Áo thun - Đỏ - M', null)).toBe('Áo thun - Đỏ - M');
    expect(stripVariantProductNameSuffix('Áo thun - Đỏ - M', {})).toBe('Áo thun - Đỏ - M');
  });

  it('giữ nguyên tên khi suffix không khớp', () => {
    expect(stripVariantProductNameSuffix('Áo thun - Đỏ - M', { Màu: 'Xanh', Size: 'L' })).toBe(
      'Áo thun - Đỏ - M'
    );
  });

  it('xử lý đúng khi chỉ có 1 thuộc tính', () => {
    expect(stripVariantProductNameSuffix('Áo thun - Đỏ', { Màu: 'Đỏ' })).toBe('Áo thun');
  });

  it('bỏ qua thuộc tính rỗng khi strip', () => {
    expect(stripVariantProductNameSuffix('Áo thun - Đỏ', { Màu: 'Đỏ', Size: '' })).toBe('Áo thun');
  });

  it('xử lý đúng với tên có nhiều dấu gạch ngang', () => {
    expect(
      stripVariantProductNameSuffix('Áo thun - Cao cấp - Đỏ - M', { Màu: 'Đỏ', Size: 'M' })
    ).toBe('Áo thun - Cao cấp');
  });

  it('trim khoảng trắng sau khi strip', () => {
    expect(stripVariantProductNameSuffix('Áo thun  - Đỏ - M', { Màu: 'Đỏ', Size: 'M' })).toBe(
      'Áo thun'
    );
  });

  it('xử lý đúng khi tên rỗng', () => {
    expect(stripVariantProductNameSuffix('', { Màu: 'Đỏ', Size: 'M' })).toBe('');
  });
});

// ─── generateProductVariants ──────────────────────────────────────────────

describe('generateProductVariants', () => {
  const baseProduct: Partial<POSProduct> = {
    id: 'base-1',
    name: 'Áo thun',
    categoryId: 'cat-1',
    importPrice: 50000,
    salePrice: 100000,
    stock: 0,
    minStock: 5,
    maxStock: 100,
    unit: 'Cái',
    brand: 'Nike',
    description: 'Áo thun cao cấp',
    warranty: '6 tháng',
    allowPoints: true,
  };

  it('trả về mảng rỗng khi không có thuộc tính', () => {
    expect(generateProductVariants(baseProduct, [], 1)).toEqual([]);
    expect(generateProductVariants(baseProduct, null as any, 1)).toEqual([]);
  });

  it('trả về mảng rỗng khi thuộc tính không có giá trị', () => {
    const attributes: POSProductAttribute[] = [
      { name: 'Màu', values: [] },
      { name: 'Size', values: [] },
    ];
    expect(generateProductVariants(baseProduct, attributes, 1)).toEqual([]);
  });

  it('tạo biến thể đúng với 1 thuộc tính', () => {
    const attributes: POSProductAttribute[] = [{ name: 'Màu', values: ['Đỏ', 'Xanh'] }];
    const variants = generateProductVariants(baseProduct, attributes, 1);

    expect(variants.length).toBe(2);
    expect(variants[0].name).toBe('Áo thun - Đỏ');
    expect(variants[0].sku).toBe('SP000001');
    expect(variants[0].variantAttributes).toEqual({ Màu: 'Đỏ' });
    expect(variants[0].parentId).toBe('base-1');

    expect(variants[1].name).toBe('Áo thun - Xanh');
    expect(variants[1].sku).toBe('SP000002');
    expect(variants[1].variantAttributes).toEqual({ Màu: 'Xanh' });
  });

  it('tạo biến thể đúng với 2 thuộc tính', () => {
    const attributes: POSProductAttribute[] = [
      { name: 'Màu', values: ['Đỏ', 'Xanh'] },
      { name: 'Size', values: ['S', 'M', 'L'] },
    ];
    const variants = generateProductVariants(baseProduct, attributes, 1);

    expect(variants.length).toBe(6); // 2 màu * 3 size
    expect(variants[0].name).toBe('Áo thun - Đỏ - S');
    expect(variants[0].variantAttributes).toEqual({ Màu: 'Đỏ', Size: 'S' });
    expect(variants[5].name).toBe('Áo thun - Xanh - L');
    expect(variants[5].variantAttributes).toEqual({ Màu: 'Xanh', Size: 'L' });
  });

  it('tạo SKU tự động tăng đúng', () => {
    const attributes: POSProductAttribute[] = [{ name: 'Màu', values: ['Đỏ', 'Xanh', 'Vàng'] }];
    const variants = generateProductVariants(baseProduct, attributes, 100);

    expect(variants[0].sku).toBe('SP000100');
    expect(variants[1].sku).toBe('SP000101');
    expect(variants[2].sku).toBe('SP000102');
  });

  it('kế thừa thuộc tính từ sản phẩm gốc', () => {
    const attributes: POSProductAttribute[] = [{ name: 'Màu', values: ['Đỏ'] }];
    const variants = generateProductVariants(baseProduct, attributes, 1);

    expect(variants[0].categoryId).toBe('cat-1');
    expect(variants[0].importPrice).toBe(50000);
    expect(variants[0].salePrice).toBe(100000);
    expect(variants[0].stock).toBe(0);
    expect(variants[0].minStock).toBe(5);
    expect(variants[0].maxStock).toBe(100);
    expect(variants[0].unit).toBe('Cái');
    expect(variants[0].brand).toBe('Nike');
    expect(variants[0].description).toBe('Áo thun cao cấp');
    expect(variants[0].warranty).toBe('6 tháng');
    expect(variants[0].allowPoints).toBe(true);
    expect(variants[0].status).toBe('Active');
  });

  it('tạo ID unique cho mỗi biến thể', () => {
    const attributes: POSProductAttribute[] = [{ name: 'Màu', values: ['Đỏ', 'Xanh'] }];
    const variants = generateProductVariants(baseProduct, attributes, 1);

    const ids = variants.map(v => v.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(2); // tất cả ID phải unique
  });

  it('lọc bỏ thuộc tính không có giá trị', () => {
    const attributes: POSProductAttribute[] = [
      { name: 'Màu', values: ['Đỏ', 'Xanh'] },
      { name: 'Size', values: [] }, // không có giá trị
      { name: 'Chất liệu', values: ['Cotton'] },
    ];
    const variants = generateProductVariants(baseProduct, attributes, 1);

    expect(variants.length).toBe(2); // chỉ Màu * Chất liệu
    expect(variants[0].name).toBe('Áo thun - Đỏ - Cotton');
    expect(variants[0].variantAttributes).toEqual({ Màu: 'Đỏ', 'Chất liệu': 'Cotton' });
  });

  it('xử lý đúng khi sản phẩm gốc thiếu một số thuộc tính', () => {
    const minimalProduct: Partial<POSProduct> = {
      id: 'base-2',
      name: 'Sản phẩm tối giản',
    };
    const attributes: POSProductAttribute[] = [{ name: 'Màu', values: ['Đỏ'] }];
    const variants = generateProductVariants(minimalProduct, attributes, 1);

    expect(variants.length).toBe(1);
    expect(variants[0].name).toBe('Sản phẩm tối giản - Đỏ');
    expect(variants[0].categoryId).toBe('');
    expect(variants[0].importPrice).toBe(0);
    expect(variants[0].salePrice).toBe(0);
    expect(variants[0].unit).toBe('Cái');
  });

  it('tạo nhiều biến thể với 3 thuộc tính', () => {
    const attributes: POSProductAttribute[] = [
      { name: 'Màu', values: ['Đỏ', 'Xanh'] },
      { name: 'Size', values: ['S', 'M'] },
      { name: 'Chất liệu', values: ['Cotton', 'Polyester'] },
    ];
    const variants = generateProductVariants(baseProduct, attributes, 1);

    expect(variants.length).toBe(8); // 2 * 2 * 2
    expect(variants[0].name).toBe('Áo thun - Đỏ - S - Cotton');
    expect(variants[7].name).toBe('Áo thun - Xanh - M - Polyester');
  });

  it('có createdAt timestamp', () => {
    const attributes: POSProductAttribute[] = [{ name: 'Màu', values: ['Đỏ'] }];
    const variants = generateProductVariants(baseProduct, attributes, 1);

    expect(variants[0].createdAt).toBeDefined();
    expect(new Date(variants[0].createdAt).getTime()).toBeGreaterThan(0);
  });
});

// ─── getNextSKUNumber ─────────────────────────────────────────────────────

describe('getNextSKUNumber', () => {
  it('trả về 1 khi không có sản phẩm', () => {
    expect(getNextSKUNumber([])).toBe(1);
  });

  it('trả về 1 khi không có SKU nào bắt đầu bằng SP', () => {
    const products = [
      { sku: 'ABC123' },
      { sku: 'XYZ456' },
      { sku: 'CUSTOM' },
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(1);
  });

  it('tính đúng SKU tiếp theo', () => {
    const products = [
      { sku: 'SP000001' },
      { sku: 'SP000002' },
      { sku: 'SP000003' },
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(4);
  });

  it('tìm số lớn nhất khi SKU không liên tục', () => {
    const products = [
      { sku: 'SP000001' },
      { sku: 'SP000005' },
      { sku: 'SP000003' },
      { sku: 'SP000010' },
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(11);
  });

  it('bỏ qua SKU không hợp lệ', () => {
    const products = [
      { sku: 'SP000001' },
      { sku: 'SPABCDEF' }, // không phải số
      { sku: 'SP000003' },
      { sku: 'SP' }, // thiếu số
      { sku: null }, // null
      { sku: '' }, // rỗng
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(4);
  });

  it('xử lý đúng với SKU có số lớn', () => {
    const products = [
      { sku: 'SP999999' },
      { sku: 'SP000001' },
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(1000000);
  });

  it('xử lý đúng khi có SKU trùng nhau', () => {
    const products = [
      { sku: 'SP000005' },
      { sku: 'SP000005' },
      { sku: 'SP000005' },
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(6);
  });

  it('bỏ qua sản phẩm không có SKU', () => {
    const products = [
      { sku: 'SP000001' },
      { sku: undefined },
      { sku: 'SP000003' },
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(4);
  });

  it('xử lý đúng với mix SKU SP và non-SP', () => {
    const products = [
      { sku: 'SP000001' },
      { sku: 'CUSTOM123' },
      { sku: 'SP000005' },
      { sku: 'ABC' },
      { sku: 'SP000003' },
    ] as POSProduct[];
    expect(getNextSKUNumber(products)).toBe(6);
  });
});
