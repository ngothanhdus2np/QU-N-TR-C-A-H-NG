export type AppThemeId = 'classic' | 'codex' | 'phuc-sang' | 'traework' | 'astryx';

/**
 * Token hiển thị của một theme.
 * Bước 1: chỉ dùng để vẽ bảng màu và khung xem trước trong Cài đặt giao diện.
 * Bước 2: các giá trị này sẽ thành điều khiển chỉnh được và ghi thẳng lên <html>.
 */
export interface AppThemeTokens {
  /** Màu nhấn — nút chính, tab active, focus. */
  accent: string;
  /** Nền trang. */
  body: string;
  /** Nền thẻ/panel nổi trên nền trang. */
  card: string;
  /** Nền phụ — hàng bảng, vùng chìm. */
  muted: string;
  /** Chữ chính. */
  text: string;
  /** Chữ phụ. */
  textMuted: string;
  /** Viền mặc định. */
  border: string;
  /** Bo góc thẻ/panel (đơn vị CSS). */
  radius: string;
  /** Font chữ hiển thị trong bảng token. */
  font: string;
}

export interface AppTheme {
  id: AppThemeId;
  name: string;
  description: string;
  previewBg: string;
  previewAccent: string;
  tokens: AppThemeTokens;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Giao diện hiện tại với màu indigo, bo góc lớn và hiệu ứng nổi bật.',
    previewBg: '#6366f1',
    previewAccent: '#c7d2fe',
    tokens: {
      accent: '#4f46e5',
      body: '#f8fafc',
      card: '#ffffff',
      muted: '#eef2ff',
      text: '#0f172a',
      textMuted: '#64748b',
      border: '#f1f5f9',
      radius: '0.75rem',
      font: 'Inter',
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Giao diện trung tính, gọn, ít shadow và tập trung vào workspace.',
    previewBg: '#18181b',
    previewAccent: '#e4e4e7',
    tokens: {
      accent: '#18181b',
      body: '#f7f7f5',
      card: '#ffffff',
      muted: '#f4f4f5',
      text: '#18181b',
      textMuted: '#71717a',
      border: '#e4e4e7',
      radius: '0.875rem',
      font: 'Inter',
    },
  },
  {
    id: 'phuc-sang',
    name: 'Đỏ Cam',
    description: 'Giao diện đỏ chủ đạo, trắng sạch, chuẩn cảm ứng.',
    previewBg: '#E63329',
    previewAccent: '#F8C21C',
    tokens: {
      accent: '#E63329',
      body: '#f8fafc',
      card: '#ffffff',
      muted: '#FEF2F2',
      text: '#0f172a',
      textMuted: '#64748b',
      border: '#f1f5f9',
      radius: '0.75rem',
      font: 'Inter',
    },
  },
  {
    id: 'traework',
    name: 'TraeWork',
    description:
      'Giao diện Light hiện đại từ TRAE — trung tính, gọn, token-first, không shadow thừa.',
    previewBg: '#4B3FE3',
    previewAccent: '#F5F5F5',
    tokens: {
      accent: '#4B3FE3',
      body: '#F5F5F5',
      card: '#FFFFFF',
      muted: '#F5F5F5',
      text: '#171717',
      textMuted: '#737373',
      border: 'rgba(115, 115, 115, 0.18)',
      radius: '8px',
      font: 'Inter',
    },
  },
  {
    id: 'astryx',
    name: 'Astryx Neutral',
    description:
      'Bộ token gốc của design system Astryx (Meta) — trung tính, viền mảnh, font Figtree.',
    previewBg: '#1b1b1b',
    previewAccent: '#f1f1f1',
    // Giá trị lấy nguyên từ @astryxdesign/theme-neutral@0.6.2 (nhánh sáng của light-dark()).
    tokens: {
      accent: '#1b1b1b',
      body: '#f1f1f1',
      card: '#ffffff',
      muted: '#f1f1f1',
      text: '#000000',
      textMuted: '#474747',
      border: 'rgba(0, 0, 0, 0.08)',
      radius: '0.75rem',
      font: 'Figtree',
    },
  },
];

export const DEFAULT_THEME: AppThemeId = 'classic';

/* ============================================================
   Bước 2 — token chỉnh tay
   Giá trị người dùng chỉnh được ghi thẳng lên <html> dưới dạng
   biến CSS `--ux-*`, và khối `html[data-custom="1"][data-theme]`
   ở cuối index.css map chúng ra toàn app.
   ============================================================ */

export interface ThemeCustomization {
  accent: string;
  body: string;
  card: string;
  muted: string;
  text: string;
  textMuted: string;
  border: string;
  /** Bo góc thẻ/panel, đơn vị px. */
  radius: number;
  /** Tên font (khớp một mục trong FONT_OPTIONS). */
  fontFamily: string;
  /** Cỡ chữ nền, đơn vị px. */
  fontSize: number;
  /** Hệ số mật độ — nhân vào padding/gap của các lớp hay dùng. */
  density: number;
  /** Hệ số thời lượng chuyển động. */
  duration: number;
}

export const COLOR_KEYS = [
  'accent',
  'body',
  'card',
  'muted',
  'text',
  'textMuted',
  'border',
] as const;

export type ThemeColorKey = (typeof COLOR_KEYS)[number];

export const FONT_OPTIONS: { label: string; value: string; stack: string }[] = [
  { label: 'Inter', value: 'Inter', stack: "'Inter', ui-sans-serif, system-ui, sans-serif" },
  { label: 'Figtree', value: 'Figtree', stack: "'Figtree', 'Inter', ui-sans-serif, sans-serif" },
  { label: 'Hệ thống', value: 'system', stack: 'ui-sans-serif, system-ui, -apple-system, sans-serif' },
];

export const RADIUS_PRESETS = [
  { label: 'S', value: 4 },
  { label: 'M', value: 8 },
  { label: 'L', value: 12 },
  { label: 'XL', value: 20 },
];

export const FONT_SIZE_PRESETS = [
  { label: 'S', value: 13 },
  { label: 'M', value: 14.5 },
  { label: 'L', value: 16 },
  { label: 'XL', value: 18 },
];

export const DENSITY_PRESETS = [
  { label: 'Gọn', value: 0.85 },
  { label: 'Mặc định', value: 1 },
  { label: 'Thoáng', value: 1.15 },
];

export const DURATION_PRESETS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '1.5×', value: 1.5 },
  { label: '2×', value: 2 },
];

/** Giới hạn để ô nhập tay không đẩy giao diện ra ngoài vùng dùng được. */
export const CUSTOM_LIMITS = {
  radius: { min: 0, max: 28 },
  fontSize: { min: 12, max: 19 },
  density: { min: 0.85, max: 1.15 },
  duration: { min: 0.5, max: 2 },
};

const radiusToPx = (radius: string): number => {
  const value = parseFloat(radius);
  if (Number.isNaN(value)) return 12;
  return radius.includes('rem') ? Math.round(value * 16) : Math.round(value);
};

/**
 * Bộ token chỉnh tay luôn được seed ĐẦY ĐỦ từ theme đang dùng, không để trống
 * phần nào — vì CSS map bằng `var(--ux-*)` không có fallback, thiếu một biến là
 * nguyên khai báo đó hỏng.
 */
export const createCustomization = (theme: AppTheme): ThemeCustomization => ({
  accent: theme.tokens.accent,
  body: theme.tokens.body,
  card: theme.tokens.card,
  muted: theme.tokens.muted,
  text: theme.tokens.text,
  textMuted: theme.tokens.textMuted,
  border: theme.tokens.border,
  radius: radiusToPx(theme.tokens.radius),
  fontFamily: theme.tokens.font === 'Figtree' ? 'Figtree' : 'Inter',
  fontSize: 14.5,
  density: 1,
  duration: 1,
});
