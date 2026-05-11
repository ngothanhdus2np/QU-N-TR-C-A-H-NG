export type AppThemeId = 'classic' | 'codex';

export interface AppTheme {
  id: AppThemeId;
  name: string;
  description: string;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Giao diện hiện tại với màu indigo, bo góc lớn và hiệu ứng nổi bật.',
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Giao diện trung tính, gọn, ít shadow và tập trung vào workspace.',
  },
];

export const DEFAULT_THEME: AppThemeId = 'classic';
