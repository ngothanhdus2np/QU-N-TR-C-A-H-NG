export type AppThemeId = 'classic' | 'codex' | 'phuc-sang' | 'traework';

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
    name: 'Đỏ Cam',
    description: 'Giao diện đỏ chủ đạo, trắng sạch, chuẩn cảm ứng.',
    previewBg: '#E63329',
    previewAccent: '#F8C21C',
  },
  {
    id: 'traework',
    name: 'TraeWork',
    description: 'Giao diện Light hiện đại từ TRAE — trung tính, gọn, token-first, không shadow thừa.',
    previewBg: '#4B3FE3',
    previewAccent: '#F5F5F5',
  },
];

export const DEFAULT_THEME: AppThemeId = 'classic';
