import { describe, it, expect } from 'vitest';
import { calcOrderRevenue } from '../../src/lib/reportCalculations';
import type { POSOrder } from '../../types';

/**
 * Bằng chứng cho phát hiện code-review #9:
 * calcOrderRevenue (src/lib/reportCalculations.ts:269) có nhánh fallback
 *   discount = order.discount != null ? abs(discount) : max(0, totalAmount - finalAmount)
 * Khi order.discount == null, phần chênh totalAmount - finalAmount do KHÁCH DÙNG ĐIỂM
 * tích lũy bị tính nhầm thành chiết khấu, trái với quy tắc ghi ngay trong doc comment:
 *   "totalAmount − discount (không trừ điểm tích lũy)".
 *
 * Hai test dưới mô tả CÙNG một tình huống kinh tế (khách trả bằng 20.000đ điểm,
 * không có chiết khấu thật) — chỉ khác field `discount` là 0 hay null/undefined.
 * Nếu logic đúng, doanh thu phải bằng nhau (= 500.000). Hiện tại thì KHÔNG.
 */
const makeOrder = (over: Partial<POSOrder>): POSOrder =>
  ({
    totalAmount: 500000,
    finalAmount: 480000, // khách dùng 20.000đ điểm tích lũy
    isReturn: false,
    ...over,
  }) as POSOrder;

describe('calcOrderRevenue — điểm tích lũy bị tính nhầm thành chiết khấu (#9)', () => {
  it('discount = 0 (đơn mới, đúng chuẩn): doanh thu = totalAmount, KHÔNG trừ điểm', () => {
    const order = makeOrder({ discount: 0 });
    expect(calcOrderRevenue(order)).toBe(500000); // đúng quy tắc
  });

  it('discount = null/undefined (đơn raw/legacy): điểm 20k bị trừ như chiết khấu → SAI', () => {
    const order = makeOrder({ discount: undefined as unknown as number });
    // Hành vi hiện tại: 480000 (đã trừ điểm). Quy tắc đúng phải là 500000.
    expect(calcOrderRevenue(order)).toBe(480000); // chứng minh nhánh fallback sai
  });
});
