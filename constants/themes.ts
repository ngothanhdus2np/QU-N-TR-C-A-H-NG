export type AppThemeId = 'classic' | 'codex' | 'prestige' | 'clarity';

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
    id: 'prestige',
    name: 'Prestige',
    description: 'Giao diện tối cao cấp với tông màu đen ấm và điểm nhấn đỏ thương hiệu.',
    previewBg: '#1A1612',
    previewAccent: '#C8161E',
  },
  {
    id: 'clarity',
    name: 'Clarity',
    description: 'Giao diện phẳng, xanh dương đậm, border mỏng — tập trung vào dữ liệu.',
    previewBg: '#1565C0',
    previewAccent: '#E3F2FD',
  },
];

export const DEFAULT_THEME: AppThemeId = 'classic';
