export type AppThemeId = 'classic' | 'codex' | 'phuc-sang';

export interface AppTheme {
  id: AppThemeId;
  name: string;
  description: string;
  previewBg: string;
  previewAccent: string;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Giao diện hiện tại với màu indigo, bo góc lớn và hiệu ứng nổi bật.',
    previewBg: '#6366f1',
    previewAccent: '#c7d2fe',
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Giao diện trung tính, gọn, ít shadow và tập trung vào workspace.',
    previewBg: '#18181b',
    previewAccent: '#e4e4e7',
  },
  {
    id: 'phuc-sang',
    name: 'Phúc Sang',
    description: 'Giao diện thương hiệu Giày Dép Phúc Sang — đỏ chủ đạo, trắng sạch, chuẩn cảm ứng.',
    previewBg: '#E63329',
    previewAccent: '#F8C21C',
  },
];

export const DEFAULT_THEME: AppThemeId = 'classic';
