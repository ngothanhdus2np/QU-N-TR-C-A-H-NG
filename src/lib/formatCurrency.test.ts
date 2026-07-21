import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyAxis } from './formatCurrency';

describe('formatCurrency', () => {
  it('làm tròn về đồng, phân tách hàng nghìn kiểu VN, hậu tố đ', () => {
    expect(formatCurrency(1234567.8)).toBe('1.234.568đ');
    expect(formatCurrency(0)).toBe('0đ');
    expect(formatCurrency(1000)).toBe('1.000đ');
  });

  it('xử lý số âm (đơn trả/điều chỉnh)', () => {
    expect(formatCurrency(-50000)).toBe('-50.000đ');
  });
});

describe('formatCurrencyAxis', () => {
  it('rút gọn theo tỷ / tr / k', () => {
    expect(formatCurrencyAxis(1_500_000_000)).toBe('1.5 tỷ');
    expect(formatCurrencyAxis(2_000_000)).toBe('2 tr');
    expect(formatCurrencyAxis(1_500_000)).toBe('1.5 tr');
    expect(formatCurrencyAxis(15000)).toBe('15k');
    expect(formatCurrencyAxis(500)).toBe('500');
  });

  it('mốc chuyển đơn vị', () => {
    expect(formatCurrencyAxis(1000)).toBe('1k');
    expect(formatCurrencyAxis(1_000_000)).toBe('1 tr');
    expect(formatCurrencyAxis(1_000_000_000)).toBe('1 tỷ');
    expect(formatCurrencyAxis(999)).toBe('999');
  });
});
