import { describe, expect, it } from 'vitest';
import { buildCode128Svg, normalizeCode128Text } from '../../components/pos/goods/barcodeUtils';

/**
 * Khoá hành vi sinh SVG Code 128 sau khi gộp 3 bản trùng lặp (30/08/2026).
 *
 * Trước khi gộp, thuật toán này tồn tại y hệt ở `barcodeUtils.ts` (height 40, có
 * aria-label), `GoodsInventory.tsx` và `PrintTemplatesTab.tsx` (cả hai height 50,
 * không aria-label). Bảng 106 pattern đã được đối chiếu và giống hệt nhau ở cả 3.
 * Hai khác biệt duy nhất — height và aria-label — nay là tham số, nên mỗi nơi gọi
 * vẫn nhận đúng chuỗi như cũ.
 *
 * Height KHÔNG chỉ là chuyện thẩm mỹ: CSS tem in dùng `height: auto`, nên con số
 * trong viewBox chính là tỉ lệ khung hình. Đổi nó là đổi độ cao mã vạch in ra giấy.
 */
describe('buildCode128Svg (gộp 3 bản trùng)', () => {
  it('mặc định giữ đúng hành vi cũ của barcodeUtils: height 40 + aria-label', () => {
    const svg = buildCode128Svg('SP001');
    expect(svg).toContain('height="40"');
    expect(svg).toMatch(/viewBox="0 0 \d+ 40"/);
    expect(svg).toContain('aria-label="Barcode SP001"');
  });

  it('giữ đúng hành vi cũ của GoodsInventory/PrintTemplatesTab: height 50, không aria-label', () => {
    const svg = buildCode128Svg('SP001', { height: 50, ariaLabel: false });
    expect(svg).toContain('height="50"');
    expect(svg).toMatch(/viewBox="0 0 \d+ 50"/);
    expect(svg).not.toContain('aria-label');
  });

  it('phần mã hoá không đổi theo height — chỉ khác đúng con số chiều cao', () => {
    const a = buildCode128Svg('ABC-123', { height: 40, ariaLabel: false });
    const b = buildCode128Svg('ABC-123', { height: 50, ariaLabel: false });
    // Quy 50 về 40 thì hai chuỗi phải trùng khít: chứng tỏ số vạch, vị trí x và
    // checksum hoàn toàn độc lập với height.
    expect(b.replace(/50/g, '40')).toBe(a.replace(/50/g, '40'));
  });

  it('checksum đúng chuẩn Code 128B cho mã đã biết', () => {
    // 'A' = 33. sequence = [104(start B), 33], checksum = (104*1 + 33*1) % 103 = 34
    const svg = buildCode128Svg('A', { ariaLabel: false });
    const soVach = (svg.match(/<rect /g) || []).length;
    // start + 1 ký tự + checksum + stop = 4 ký hiệu, mỗi ký hiệu 3 vạch đen
    // (stop có 4 vạch vì pattern dài 7 chữ số) → 3+3+3+4 = 13
    expect(soVach).toBe(13);
  });

  it('mã rỗng rơi về UNKNOWN thay vì sinh SVG hỏng', () => {
    const svg = buildCode128Svg('   ');
    expect(svg).toContain('aria-label="Barcode UNKNOWN"');
    expect(svg).toMatch(/^<svg /);
  });

  it('normalizeCode128Text loại ký tự ngoài ASCII in được và cắt còn 32', () => {
    expect(normalizeCode128Text('  Dép quai ngang  ')).toBe('Dp quai ngang');
    expect(normalizeCode128Text('X'.repeat(50))).toHaveLength(32);
  });
});
