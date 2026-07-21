import { describe, it, expect } from 'vitest';
import { buildCostHistoryBySku, findHistoricalCostBySku } from './costHistoryLookup';

describe('buildCostHistoryBySku', () => {
  it('gom bản ghi theo sku, trim khoảng trắng, ép kiểu số', () => {
    const map = buildCostHistoryBySku([
      { sku: ' A ', import_price: '100', effective_date: '2026-01-01' },
      { sku: 'A', import_price: 120, effective_date: '2026-02-01' },
      { sku: 'B', import_price: 50, effective_date: '2026-01-15' },
    ]);
    expect(map.get('A')).toEqual([
      { date: '2026-01-01', price: 100 },
      { date: '2026-02-01', price: 120 },
    ]);
    expect(map.get('B')).toEqual([{ date: '2026-01-15', price: 50 }]);
  });

  it('bỏ qua dòng thiếu sku (rỗng/null)', () => {
    const map = buildCostHistoryBySku([
      { sku: '', import_price: 10, effective_date: '2026-01-01' },
      { sku: null, import_price: 10, effective_date: '2026-01-01' },
      { sku: 'X', import_price: 10, effective_date: '2026-01-01' },
    ]);
    expect(map.size).toBe(1);
    expect(map.has('X')).toBe(true);
  });

  it('xử lý input null/undefined trả map rỗng', () => {
    expect(buildCostHistoryBySku(null).size).toBe(0);
    expect(buildCostHistoryBySku(undefined).size).toBe(0);
  });

  it('giá/ngày thiếu → 0 / chuỗi rỗng, không ném lỗi', () => {
    const map = buildCostHistoryBySku([{ sku: 'A', import_price: null, effective_date: null }]);
    expect(map.get('A')).toEqual([{ date: '', price: 0 }]);
  });
});

describe('findHistoricalCostBySku', () => {
  const map = buildCostHistoryBySku([
    { sku: 'A', import_price: 100, effective_date: '2026-01-01' },
    { sku: 'A', import_price: 120, effective_date: '2026-03-01' },
    { sku: 'A', import_price: 150, effective_date: '2026-06-01' },
  ]);

  it('lấy giá gần nhất <= ngày bán', () => {
    expect(findHistoricalCostBySku(map, 'A', '2026-04-15')).toBe(120);
    expect(findHistoricalCostBySku(map, 'A', '2026-06-01')).toBe(150);
    expect(findHistoricalCostBySku(map, 'A', '2027-01-01')).toBe(150);
  });

  it('ngày bán trước mọi bản ghi → 0', () => {
    expect(findHistoricalCostBySku(map, 'A', '2025-12-31')).toBe(0);
  });

  it('sku không có lịch sử → 0', () => {
    expect(findHistoricalCostBySku(map, 'KHONG-CO', '2026-04-15')).toBe(0);
  });

  it('BỎ QUA bản ghi giá 0, giữ giá hợp lệ trước đó (điểm dễ sai khi refactor)', () => {
    const withZero = buildCostHistoryBySku([
      { sku: 'Z', import_price: 80, effective_date: '2026-01-01' },
      { sku: 'Z', import_price: 0, effective_date: '2026-05-01' },
    ]);
    // Bán ngày 2026-06-01: bản ghi gần nhất là giá 0 (bỏ qua) → giữ 80
    expect(findHistoricalCostBySku(withZero, 'Z', '2026-06-01')).toBe(80);
  });

  it('toàn bộ bản ghi <= ngày đều giá 0 → 0', () => {
    const allZero = buildCostHistoryBySku([
      { sku: 'Z', import_price: 0, effective_date: '2026-01-01' },
    ]);
    expect(findHistoricalCostBySku(allZero, 'Z', '2026-06-01')).toBe(0);
  });
});
