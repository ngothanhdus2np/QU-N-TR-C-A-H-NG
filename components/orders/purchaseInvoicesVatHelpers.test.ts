import { describe, it, expect } from 'vitest';
import { vatGroupMatchesSourceText } from './purchaseInvoicesVatHelpers';

describe('vatGroupMatchesSourceText', () => {
  it('khớp khi text nguồn chứa toàn bộ tên nhóm (bỏ dấu, thường hóa)', () => {
    expect(vatGroupMatchesSourceText('Giày dép', 'Hóa đơn Giày Dép Nam')).toBe(true);
  });

  it('không khớp khi nhóm khác hẳn text nguồn', () => {
    expect(vatGroupMatchesSourceText('Túi xách', 'giày dép')).toBe(false);
  });

  it('khớp 1 phần đường dẫn nhóm (tách theo > hoặc /), phần >= 4 ký tự', () => {
    expect(vatGroupMatchesSourceText('Thời trang > Giày dép', 'giày dép nam')).toBe(true);
    expect(vatGroupMatchesSourceText('Phụ kiện / Túi xách', 'túi xách da')).toBe(true);
  });

  it('bỏ qua phần đường dẫn < 4 ký tự (tránh khớp nhầm)', () => {
    // 'mu' (2 ký tự sau chuẩn hóa) bị lọc → không khớp
    expect(vatGroupMatchesSourceText('Áo > Mũ', 'mũ len')).toBe(false);
  });

  it('text nguồn rỗng → false', () => {
    expect(vatGroupMatchesSourceText('Giày dép', '')).toBe(false);
  });
});
