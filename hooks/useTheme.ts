import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_THEMES, DEFAULT_THEME, AppThemeId } from '../constants/themes';

const STORAGE_KEY = 'cfo-brain-theme';

const isAppThemeId = (value: string | null): value is AppThemeId =>
  value === 'classic' || value === 'codex';

export const useTheme = () => {
  const [themeId, setThemeId] = useState<AppThemeId>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    return isAppThemeId(savedTheme) ? savedTheme : DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    window.localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  const theme = useMemo(
    () => APP_THEMES.find(item => item.id === themeId) ?? APP_THEMES[0],
    [themeId]
  );

  const toggleTheme = useCallback(() => {
    setThemeId(current => current === 'classic' ? 'codex' : 'classic');
  }, []);

  return {
    theme,
    themeId,
    setThemeId,
    toggleTheme,
    themes: APP_THEMES,
  };
};
