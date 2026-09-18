import { describe, expect, it } from 'vitest';
import { readableOn } from '../../hooks/useTheme';
import {
  APP_THEMES,
  COLOR_KEYS,
  CUSTOM_LIMITS,
  createCustomization,
  ThemeCustomization,
} from '../../constants/themes';

/**
 * Bộ token chỉnh tay của trang Cài đặt giao diện (ASTRYX-UI-0917, bước 2).
 *
 * Hai bất biến được khoá ở đây, vì phá cái nào cũng hỏng im lặng chứ không ném lỗi:
 *
 * 1. `createCustomization` phải seed ĐẦY ĐỦ mọi trường. Lớp CSS
 *    `html[data-custom="1"][data-theme]` map bằng `var(--ux-*)` KHÔNG có giá trị
 *    dự phòng — thiếu một biến là nguyên khai báo đó vô hiệu, mảng giao diện
 *    tương ứng mất nền/mất viền mà không có cảnh báo nào.
 *
 * 2. `readableOn` quyết định màu chữ nằm trên nền màu nhấn. Sai hàm này thì người
 *    dùng chọn màu nhấn sáng sẽ nhận chữ trắng trên nền trắng — nút vẫn bấm được
 *    nên lỗi không lộ ra cho tới khi có người không đọc nổi chữ trên nút.
 */

describe('createCustomization', () => {
  it('seed đủ mọi trường cho cả 5 theme, không để trống cái nào', () => {
    const requiredKeys: (keyof ThemeCustomization)[] = [
      ...COLOR_KEYS,
      'radius',
      'fontFamily',
      'fontSize',
      'density',
      'duration',
    ];

    APP_THEMES.forEach(theme => {
      const custom = createCustomization(theme);
      requiredKeys.forEach(key => {
        expect(custom[key], `${theme.id} thiếu token "${key}"`).toBeDefined();
        expect(custom[key], `${theme.id} có token "${key}" rỗng`).not.toBe('');
      });
    });
  });

  it('lấy đúng màu từ token của theme', () => {
    const astryx = APP_THEMES.find(theme => theme.id === 'astryx')!;
    const custom = createCustomization(astryx);

    expect(custom.accent).toBe('#1b1b1b');
    expect(custom.body).toBe('#f1f1f1');
    expect(custom.card).toBe('#ffffff');
    expect(custom.fontFamily).toBe('Figtree');
  });

  it('đổi bo góc từ rem sang px, và giữ nguyên nếu vốn đã là px', () => {
    const astryx = APP_THEMES.find(theme => theme.id === 'astryx')!;
    const traework = APP_THEMES.find(theme => theme.id === 'traework')!;

    // 0.75rem = 12px
    expect(astryx.tokens.radius).toBe('0.75rem');
    expect(createCustomization(astryx).radius).toBe(12);

    // 8px giữ nguyên 8
    expect(traework.tokens.radius).toBe('8px');
    expect(createCustomization(traework).radius).toBe(8);
  });

  it('giá trị seed nằm trong giới hạn của ô nhập tay', () => {
    APP_THEMES.forEach(theme => {
      const custom = createCustomization(theme);
      expect(custom.radius).toBeGreaterThanOrEqual(CUSTOM_LIMITS.radius.min);
      expect(custom.radius).toBeLessThanOrEqual(CUSTOM_LIMITS.radius.max);
      expect(custom.fontSize).toBeGreaterThanOrEqual(CUSTOM_LIMITS.fontSize.min);
      expect(custom.fontSize).toBeLessThanOrEqual(CUSTOM_LIMITS.fontSize.max);
      expect(custom.density).toBeGreaterThanOrEqual(CUSTOM_LIMITS.density.min);
      expect(custom.density).toBeLessThanOrEqual(CUSTOM_LIMITS.density.max);
    });
  });
});

describe('readableOn — màu chữ trên nền màu nhấn', () => {
  it('nền tối thì chữ trắng', () => {
    expect(readableOn('#1b1b1b')).toBe('#ffffff');
    expect(readableOn('#000000')).toBe('#ffffff');
    expect(readableOn('#4f46e5')).toBe('#ffffff'); // indigo-600 của theme Classic
    expect(readableOn('#E63329')).toBe('#ffffff'); // đỏ Phúc Sang
  });

  it('nền sáng thì chữ đen', () => {
    expect(readableOn('#ffffff')).toBe('#111111');
    expect(readableOn('#fde047')).toBe('#111111'); // vàng
    expect(readableOn('#f1f1f1')).toBe('#111111');
  });

  it('nhận cả hex 3 ký tự', () => {
    expect(readableOn('#fff')).toBe('#111111');
    expect(readableOn('#000')).toBe('#ffffff');
  });

  it('giá trị không phải hex thì trả chữ trắng thay vì ném lỗi', () => {
    // Token viền của vài theme là rgba(), và ô nhập cho gõ tay chuỗi bất kỳ.
    expect(readableOn('rgba(0, 0, 0, 0.08)')).toBe('#ffffff');
    expect(readableOn('')).toBe('#ffffff');
    expect(readableOn('không phải màu')).toBe('#ffffff');
  });
});
