import { describe, it, expect } from 'vitest';
import {
  parseInvoiceDetailRow,
  accumulateInvoiceDayAgg,
  orderRevenue,
  emptyDayAgg,
  resolveReturnColumns,
  parseReturnRow,
  type SpreadsheetRow,
} from '../../routes/importParsers';

// Helper: tạo row thưa, set giá trị tại các index chỉ định
const rowOf = (vals: Record<number, unknown>): SpreadsheetRow => {
  const max = Math.max(...Object.keys(vals).map(Number));
  const r: SpreadsheetRow = Array(max + 1).fill(null);
  for (const [i, v] of Object.entries(vals)) r[Number(i)] = v as never;
  return r;
};

// ─── parseInvoiceDetailRow (Chi tiết hóa đơn) — characterization ───────────────

describe('parseInvoiceDetailRow', () => {
  it('đơn bán bình thường: parse đúng các trường tài chính + item', () => {
    const p = parseInvoiceDetailRow(rowOf({
      1: 'HD001', 6: '2026-01-15 10:00', 12: '', 13: 'Khách lẻ',
      21: 'NV A', 22: 'Bán trực tiếp', 38: 500000, 39: 20000, 41: 480000,
      42: 480000, 44: 0, 45: 0, 46: 0, 50: 'Hoàn thành',
      52: 'SP1', 53: 'Giày da', 57: 2, 58: 240000, 60: 0, 61: 250000, 62: 480000,
    }));
    expect(p.orderCode).toBe('HD001');
    expect(p.isReturn).toBe(false);
    expect(p.totalGross).toBe(500000);
    expect(p.discount).toBe(20000);
    expect(p.finalAmount).toBe(480000);
    expect(p.cashReceived).toBe(480000); // col42 = "Khách đã trả" (đã xác nhận)
    expect(p.paymentMethod).toBe('Cash');
    expect(p.channel).toBe('direct');
    expect(p.item).toEqual({ sku: 'SP1', name: 'Giày da', quantity: 2, price: 250000, discount: 0, total: 480000 });
  });

  it('đơn trả CHỈ nhận diện qua mã bắt đầu "TH"; có "Mã trả hàng" (col11) vẫn là đơn BÁN', () => {
    expect(parseInvoiceDetailRow(rowOf({ 1: 'TH001', 6: '2026-01-15' })).isReturn).toBe(true);
    // Hóa đơn bán liên kết phiếu trả (col11 có giá trị) → KHÔNG phải đơn trả, nhưng có hasReturnLink
    const linked = parseInvoiceDetailRow(rowOf({ 1: 'HD009', 11: 'TH001982', 6: '2026-01-15' }));
    expect(linked.isReturn).toBe(false);
    expect(linked.hasReturnLink).toBe(true);
  });

  it('payment method: thẻ → Card, kênh online → online', () => {
    const p = parseInvoiceDetailRow(rowOf({ 1: 'HD002', 6: '2026-01-15', 22: 'Bán Online', 44: 100000 }));
    expect(p.paymentMethod).toBe('Card');
    expect(p.channel).toBe('online');
  });

  it('item null khi thiếu sku/tên/số lượng', () => {
    expect(parseInvoiceDetailRow(rowOf({ 1: 'HD003', 6: '2026-01-15', 52: '', 53: '', 57: 0 })).item).toBeNull();
  });
});

// ─── #6: doanh thu — đơn bán dùng "Khách cần trả", đơn đổi/trả dùng "Khách đã trả" ──

describe('orderRevenue — cơ sở doanh thu theo loại đơn', () => {
  it('đơn bán thường → "Khách cần trả" (finalAmount)', () => {
    expect(orderRevenue({ isReturn: false, hasReturnLink: false, totalGross: 500000, finalAmount: 480000, cashReceived: 0 })).toBe(480000);
  });
  it('đơn ĐỔI/trả (có Mã trả hàng) → "Khách đã trả" (cashReceived)', () => {
    expect(orderRevenue({ isReturn: false, hasReturnLink: true, totalGross: 8000000, finalAmount: 8000000, cashReceived: 0 })).toBe(0);
  });
  it('đơn trả thuần (TH) → âm theo giá trị hàng', () => {
    expect(orderRevenue({ isReturn: true, hasReturnLink: false, totalGross: 300000, finalAmount: 0, cashReceived: 0 })).toBe(-300000);
  });
});

describe('accumulateInvoiceDayAgg — doanh thu (#6)', () => {
  it('đơn bán thường online/COD: netRev = "Khách cần trả" dù chưa thu tiền', () => {
    // cần trả 480k, đã trả 0 (COD chưa thu) → vẫn ghi nhận ĐỦ 480k
    const agg = accumulateInvoiceDayAgg(emptyDayAgg(), { isReturn: false, hasReturnLink: false, totalGross: 500000, discount: 20000, finalAmount: 480000, cashReceived: 0 });
    expect(agg.netRev).toBe(480000);
    expect(agg.totalGross).toBe(500000);
  });

  it('đơn ĐỔI NGANG (mua 8M, có Mã trả hàng, Khách đã trả 0) → netRev = 0 (không phình)', () => {
    const agg = accumulateInvoiceDayAgg(emptyDayAgg(), { isReturn: false, hasReturnLink: true, totalGross: 8000000, discount: 0, finalAmount: 8000000, cashReceived: 0 });
    expect(agg.netRev).toBe(0);           // trước đây bị tính -8.000.000 (nhận nhầm là đơn trả)
    expect(agg.totalGross).toBe(8000000);
  });

  it('đơn ĐỔI có thu thêm (mua 399k, đã trả 399k) → netRev = 399k', () => {
    const agg = accumulateInvoiceDayAgg(emptyDayAgg(), { isReturn: false, hasReturnLink: true, totalGross: 399000, discount: 0, finalAmount: 399000, cashReceived: 399000 });
    expect(agg.netRev).toBe(399000);
  });
});

// ─── #7: thành tiền dòng trả hàng phải là "Thành tiền", không phải "Giá bán" ────

describe('resolveReturnColumns + parseReturnRow — thành tiền dòng (#7)', () => {
  const baseHeader = (extra: Record<number, unknown>) => rowOf({
    1: 'Mã phiếu trả', 6: 'Thời gian', 13: 'Tổng tiền hàng trả', 18: 'Cần trả khách',
    19: 'Đã trả khách', 26: 'Mã hàng', 27: 'Tên hàng', 31: 'Số lượng', 11: 'Mã hóa đơn', ...extra,
  });

  it('có cột "Thành tiền": dùng thành tiền (KHÔNG lấy đơn giá "Giá bán")', () => {
    const cols = resolveReturnColumns(baseHeader({ 32: 'Thành tiền', 33: 'Giá bán' }));
    expect(cols.iLineTotal).toBe(32);
    expect(cols.lineTotalIsUnitPrice).toBe(false);
    const p = parseReturnRow(cols, rowOf({ 1: 'TH001', 6: '2026-01-15', 31: 3, 32: 150000, 33: 50000, 26: 'SP1', 27: 'Giày' }));
    expect(p.quantity).toBe(3);
    expect(p.lineTotal).toBe(150000); // trước fix: lấy "Giá bán"=50000 (sai)
  });

  it('chỉ có "Giá bán" (đơn giá), không có "Thành tiền": nhân số lượng để ra thành tiền', () => {
    const cols = resolveReturnColumns(baseHeader({ 33: 'Giá bán' }));
    expect(cols.lineTotalIsUnitPrice).toBe(true);
    const p = parseReturnRow(cols, rowOf({ 1: 'TH002', 6: '2026-01-15', 31: 3, 33: 50000, 26: 'SP1', 27: 'Giày' }));
    expect(p.lineTotal).toBe(150000); // 50000 × 3
  });

  it('iCode guard: "Mã phiếu trả" ở index 1 vẫn chọn đúng index 1 (không rơi sang "Mã trả hàng")', () => {
    const cols = resolveReturnColumns(rowOf({ 1: 'Mã phiếu trả', 3: 'Mã trả hàng', 6: 'Thời gian' }));
    expect(cols.iCode).toBe(1); // trước fix: rơi sang index 3 (sai)
  });

  it('Phương án 2: cashRefunded = |Đã trả khách| (cơ sở doanh thu đơn trả)', () => {
    const cols = resolveReturnColumns(baseHeader({ 32: 'Giá bán' }));
    expect(cols.iCashRefunded).toBe(19);
    // hoàn tiền thật: "Đã trả khách" âm trong file → cashRefunded dương 20000
    const refund = parseReturnRow(cols, rowOf({ 1: 'TH001', 6: '2026-01-15', 13: 240000, 19: -20000, 31: 1, 32: 240000, 26: 'SP1', 27: 'Giày' }));
    expect(refund.cashRefunded).toBe(20000);
    expect(refund.totalAmount).toBe(240000); // giá trị hàng vẫn giữ để đối chiếu
    // đơn ĐỔI (không hoàn tiền): Đã trả khách = 0 → cashRefunded = 0 → doanh thu 0
    const swap = parseReturnRow(cols, rowOf({ 1: 'TH002', 6: '2026-01-15', 13: 440000, 19: 0, 31: 1, 32: 440000, 26: 'SP2', 27: 'Dép' }));
    expect(swap.cashRefunded).toBe(0);
  });
});
