import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APP_THEMES,
  DEFAULT_THEME,
  AppThemeId,
  FONT_OPTIONS,
  ThemeCustomization,
  createCustomization,
} from '../constants/themes';

const STORAGE_KEY = 'cfo-brain-theme';
const CUSTOM_STORAGE_KEY = 'cfo-brain-theme-custom';

// Suy ra từ APP_THEMES để thêm theme mới không phải sửa 2 chỗ (bản cũ liệt kê tay đã lệch một lần).
const isAppThemeId = (value: string | null): value is AppThemeId =>
  value !== null && APP_THEMES.some(theme => theme.id === value);

type CustomStore = Partial<Record<AppThemeId, ThemeCustomization>>;

const readCustomStore = (): CustomStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomStore) : {};
  } catch {
    // localStorage hỏng hoặc JSON rác — quay về mặc định thay vì làm chết app.
    return {};
  }
};

/**
 * Chữ trên nền màu nhấn phải tự đảo theo độ sáng của nền, nếu không người dùng
 * chọn màu nhấn sáng là chữ trắng trên nền trắng.
 */
export const readableOn = (color: string): string => {
  const hex = color.trim().replace('#', '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(c => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Độ sáng cảm nhận (ITU-R BT.601).
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111111' : '#ffffff';
};

const applyCustomization = (custom: ThemeCustomization | null) => {
  const root = document.documentElement;
  if (!custom) {
    delete root.dataset.custom;
    return;
  }

  const font =
    FONT_OPTIONS.find(option => option.value === custom.fontFamily)?.stack ?? FONT_OPTIONS[0].stack;

  const vars: Record<string, string> = {
    '--ux-accent': custom.accent,
    '--ux-on-accent': readableOn(custom.accent),
    '--ux-body': custom.body,
    '--ux-card': custom.card,
    '--ux-muted': custom.muted,
    '--ux-text': custom.text,
    '--ux-text-muted': custom.textMuted,
    '--ux-border': custom.border,
    '--ux-radius': `${custom.radius}px`,
    '--ux-font': font,
    '--ux-font-size': `${custom.fontSize}px`,
    '--ux-density': String(custom.density),
    '--ux-duration': String(custom.duration),
  };

  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  root.dataset.custom = '1';
};

export const useTheme = () => {
  const [themeId, setThemeId] = useState<AppThemeId>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    return isAppThemeId(savedTheme) ? savedTheme : DEFAULT_THEME;
  });

  const [customStore, setCustomStore] = useState<CustomStore>(readCustomStore);

  const theme = useMemo(
    () => APP_THEMES.find(item => item.id === themeId) ?? APP_THEMES[0],
    [themeId]
  );

  const customization = customStore[themeId] ?? null;

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    window.localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  // Chỉnh tay được lưu RIÊNG cho từng theme, nên đổi theme là áp đúng bộ của theme đó.
  useEffect(() => {
    applyCustomization(customStore[themeId] ?? null);
  }, [customStore, themeId]);

  const persist = useCallback((next: CustomStore) => {
    setCustomStore(next);
    try {
      window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Hết quota hoặc chế độ riêng tư — bỏ qua, giao diện vẫn chạy trong phiên này.
    }
  }, []);

  const updateCustomization = useCallback(
    (patch: Partial<ThemeCustomization>) => {
      const base = customStore[themeId] ?? createCustomization(theme);
      persist({ ...customStore, [themeId]: { ...base, ...patch } });
    },
    [customStore, persist, theme, themeId]
  );

  const resetCustomization = useCallback(() => {
    const next = { ...customStore };
    delete next[themeId];
    persist(next);
  }, [customStore, persist, themeId]);

  const toggleTheme = useCallback(() => {
    setThemeId(current => {
      const idx = APP_THEMES.findIndex(t => t.id === current);
      return APP_THEMES[(idx + 1) % APP_THEMES.length].id;
    });
  }, []);

  return {
    theme,
    themeId,
    setThemeId,
    toggleTheme,
    themes: APP_THEMES,
    customization,
    updateCustomization,
    resetCustomization,
  };
};
