import { describe, expect, it } from 'vitest';
import { planExcelImport, stripStockForUpdate } from './useGoodsExcelImport';
import { POSProduct } from '../../types';

const makeProduct = (overrides: Partial<POSProduct>): POSProduct => ({
  id: 'id-1',
  sku: 'DQND01',
  name: 'Dép quai ngang',
  categoryId: 'Dép',
  importPrice: 50000,
  salePrice: 100000,
  stock: 7,
  minStock: 0,
  unit: 'Đôi',
  status: 'Active',
  ...overrides,
});

describe('planExcelImport — [IMPORT-02] SKU đã có → cập nhật, SKU mới → thêm', () => {
  it('SKU trùng → cập nhật sản phẩm cũ (giữ id), không tạo mới', () => {
    const existing = makeProduct({ id: 'id-1', sku: 'DQND01' });
    const { toCreate, toUpdate } = planExcelImport(
      [existing],
      [{ 'Mã hàng': 'DQND01', 'Tên sản phẩm': 'Dép quai ngang mới', 'Giá bán': 120000 }]
    );

    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0].id).toBe('id-1');
    expect(toUpdate[0].name).toBe('Dép quai ngang mới');
    expect(toUpdate[0].salePrice).toBe(120000);
  });

  it('cập nhật GIỮ NGUYÊN tồn kho dù file có cột Tồn kho', () => {
    const existing = makeProduct({ stock: 7 });
    const { toUpdate } = planExcelImport(
      [existing],
      [{ 'Mã hàng': 'DQND01', 'Tên sản phẩm': 'Dép', 'Tồn kho': 99 }]
    );

    expect(toUpdate[0].stock).toBe(7);
  });

  it('cột không có trong file → giữ giá trị cũ, không ghi đè thành 0/rỗng', () => {
    const existing = makeProduct({ importPrice: 50000, salePrice: 100000, unit: 'Đôi' });
    const { toUpdate } = planExcelImport(
      [existing],
      [{ 'Mã hàng': 'DQND01', 'Tên sản phẩm': 'Tên mới' }]
    );

    expect(toUpdate[0].importPrice).toBe(50000);
    expect(toUpdate[0].salePrice).toBe(100000);
    expect(toUpdate[0].unit).toBe('Đôi');
  });

  it('SKU mới → tạo sản phẩm mới với đúng SKU và tồn kho từ file', () => {
    const { toCreate, toUpdate } = planExcelImport(
      [makeProduct({})],
      [{ 'Mã hàng': 'DQND99', 'Tên sản phẩm': 'Dép mới', 'Giá vốn': 40000, 'Giá bán': 90000, 'Tồn kho': 5 }]
    );

    expect(toUpdate).toHaveLength(0);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].sku).toBe('DQND99');
    expect(toCreate[0].stock).toBe(5);
    expect(toCreate[0].importPrice).toBe(40000);
  });

  it('SKU trống → sinh mã SPxxxxxx tự động, không đè SKU đã dùng', () => {
    const { toCreate } = planExcelImport(
      [makeProduct({ sku: 'SP000005' })],
      [{ 'Tên sản phẩm': 'Hàng không mã', 'Giá bán': 10000 }]
    );

    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].sku).toBe('SP000006');
  });

  it('import cùng file 2 lần không nhân đôi: lần 2 toàn bộ thành cập nhật', () => {
    const rows = [
      { 'Mã hàng': 'A01', 'Tên sản phẩm': 'SP A', 'Giá bán': 10000, 'Tồn kho': 3 },
      { 'Mã hàng': 'B02', 'Tên sản phẩm': 'SP B', 'Giá bán': 20000, 'Tồn kho': 4 },
    ];
    const first = planExcelImport([], rows);
    expect(first.toCreate).toHaveLength(2);
    expect(first.toUpdate).toHaveLength(0);

    const second = planExcelImport(first.toCreate, rows);
    expect(second.toCreate).toHaveLength(0);
    expect(second.toUpdate).toHaveLength(2);
    expect(second.toUpdate.map(p => p.id).sort()).toEqual(
      first.toCreate.map(p => p.id).sort()
    );
  });

  it('2 dòng trùng SKU trong cùng file → chỉ 1 sản phẩm, dòng sau ghi đè dòng trước', () => {
    const { toCreate } = planExcelImport(
      [],
      [
        { 'Mã hàng': 'C03', 'Tên sản phẩm': 'Bản 1', 'Giá bán': 10000 },
        { 'Mã hàng': 'C03', 'Tên sản phẩm': 'Bản 2', 'Giá bán': 15000 },
      ]
    );

    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].name).toBe('Bản 2');
    expect(toCreate[0].salePrice).toBe(15000);
  });

  it('dòng rác (không tên, không khớp SKU) → bỏ qua', () => {
    const { toCreate, toUpdate } = planExcelImport(
      [makeProduct({})],
      [{ 'Mã hàng': 'XYZ', 'Tên sản phẩm': '   ' }, { 'Ghi chú': 'dòng lạc loài' }]
    );

    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
  });

  it('giá trị không phải số (vd "abc") → không ghi đè giá cũ, sản phẩm mới về 0', () => {
    const existing = makeProduct({ salePrice: 100000 });
    const { toUpdate, toCreate } = planExcelImport(
      [existing],
      [
        { 'Mã hàng': 'DQND01', 'Tên sản phẩm': 'Dép', 'Giá bán': 'abc' },
        { 'Mã hàng': 'M01', 'Tên sản phẩm': 'Mới', 'Giá bán': 'xyz' },
      ]
    );

    expect(toUpdate[0].salePrice).toBe(100000);
    expect(toCreate[0].salePrice).toBe(0);
  });

  it('tồn kho âm trong file → sản phẩm mới nhận 0 [FIX M6]', () => {
    const { toCreate } = planExcelImport(
      [],
      [{ 'Mã hàng': 'N01', 'Tên sản phẩm': 'SP', 'Tồn kho': -5 }]
    );

    expect(toCreate[0].stock).toBe(0);
  });
});

describe('stripStockForUpdate — [IMPORT-02] không ghi đè tồn kho DB khi cập nhật', () => {
  it('bỏ hẳn field stock khỏi payload cập nhật (giữ các field khác)', () => {
    const products = [
      makeProduct({ id: 'a', sku: 'A01', name: 'A', stock: 7, salePrice: 120000 }),
      makeProduct({ id: 'b', sku: 'B02', name: 'B', stock: 3, importPrice: 40000 }),
    ];

    const payload = stripStockForUpdate(products);

    // Không còn cột stock → apiService.sanitizeItem sẽ bỏ qua → PostgREST giữ tồn kho DB
    expect(payload[0]).not.toHaveProperty('stock');
    expect(payload[1]).not.toHaveProperty('stock');
    // Các field cần cập nhật vẫn còn nguyên
    expect(payload[0].id).toBe('a');
    expect(payload[0].name).toBe('A');
    expect(payload[0].salePrice).toBe(120000);
    expect(payload[1].importPrice).toBe(40000);
  });

  it('mảng rỗng → trả mảng rỗng, không lỗi', () => {
    expect(stripStockForUpdate([])).toEqual([]);
  });
});
