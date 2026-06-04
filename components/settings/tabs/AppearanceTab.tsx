import React from 'react';
import { Check, MessageSquare, Palette, ServerCog } from 'lucide-react';
import { APP_THEMES, AppThemeId } from '../../../constants/themes';

interface AppearanceTabProps {
  activeThemeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
}

const Section: React.FC<{
  id?: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ id, title, description, icon: Icon, children }) => (
  <section
    id={id}
    className="scroll-mt-6 bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden"
  >
    <div className="min-h-[88px] px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && (
          <p className="min-h-10 text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const TogglePill: React.FC<{ enabled: boolean }> = ({ enabled }) => (
  <span
    className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
  >
    <span
      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </span>
);

const AppearanceTab: React.FC<AppearanceTabProps> = ({ activeThemeId, onThemeChange }) => {
  return (
    <div className="space-y-4">
      <Section
        id="appearance-theme"
        title="Theme giao diện"
        description="Chọn giao diện mặc định cho máy đang dùng."
        icon={Palette}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {APP_THEMES.map(theme => {
            const isActive = theme.id === activeThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onThemeChange(theme.id)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  isActive
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-normal">{theme.name}</span>
                    <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                      {theme.description}
                    </span>
                  </span>
                  <span
                    className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isActive && <Check className="h-3.5 w-3.5" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        id="appearance-typography"
        title="Typography"
        description="Các cấp chữ chuẩn đang dùng trong app để màn hình quản lý dễ đọc và nhất quán."
        icon={MessageSquare}
      >
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
          {[
            {
              name: 'Tiêu đề trang',
              sample: 'Quản lý hàng hóa',
              className: 'text-2xl font-bold text-slate-950',
              note: 'Dùng cho đầu trang/module chính.',
            },
            {
              name: 'Tiêu đề section',
              sample: 'Thông tin hàng hóa',
              className: 'text-lg font-bold text-slate-900',
              note: 'Dùng cho nhóm nội dung lớn.',
            },
            {
              name: 'Tiêu đề cột bảng',
              sample: 'Số tài khoản',
              className: 'text-sm font-bold text-slate-900',
              note: 'Chỉ header bảng được in đậm.',
            },
            {
              name: 'Nội dung thường',
              sample: 'VietinBank - 1058844239173',
              className: 'text-sm font-normal text-slate-800',
              note: 'Dùng cho dữ liệu, label, button, form.',
            },
            {
              name: 'Mô tả / helper',
              sample: 'Áp dụng cho toàn hệ thống',
              className: 'text-xs font-normal text-slate-500',
              note: 'Dùng cho mô tả phụ và hướng dẫn ngắn.',
            },
            {
              name: 'Badge / trạng thái',
              sample: 'Đang bật',
              className: 'text-xs font-normal uppercase tracking-wider text-emerald-700',
              note: 'Dùng màu/icon để nhấn, không lạm dụng bold.',
            },
          ].map(item => (
            <div
              key={item.name}
              className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[170px_1fr_220px] md:items-center"
            >
              <p className="text-xs text-slate-500">{item.name}</p>
              <p className={item.className}>{item.sample}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{item.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="appearance-colors"
        title="Màu sắc"
        description="Màu chủ đạo và màu trạng thái dùng xuyên suốt dashboard, POS, bảng dữ liệu và cảnh báo."
        icon={Palette}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              name: 'Chủ đạo',
              token: 'Indigo 600',
              bg: 'bg-indigo-600',
              text: 'text-indigo-700',
              soft: 'bg-indigo-50',
              usage: 'Nút chính, tab active, focus.',
            },
            {
              name: 'Nền trung tính',
              token: 'Slate',
              bg: 'bg-slate-700',
              text: 'text-slate-700',
              soft: 'bg-slate-50',
              usage: 'Nền app, bảng, chữ phụ.',
            },
            {
              name: 'Thành công / Lãi',
              token: 'Emerald',
              bg: 'bg-emerald-600',
              text: 'text-emerald-700',
              soft: 'bg-emerald-50',
              usage: 'Lãi, hoàn tất, online.',
            },
            {
              name: 'Cảnh báo',
              token: 'Amber',
              bg: 'bg-amber-500',
              text: 'text-amber-700',
              soft: 'bg-amber-50',
              usage: 'Tồn kho thấp, cần chú ý.',
            },
            {
              name: 'Lỗi / Lỗ',
              token: 'Rose',
              bg: 'bg-rose-600',
              text: 'text-rose-700',
              soft: 'bg-rose-50',
              usage: 'Lỗi, lỗ, xóa dữ liệu.',
            },
            {
              name: 'Thông tin',
              token: 'Blue',
              bg: 'bg-indigo-600',
              text: 'text-blue-700',
              soft: 'bg-blue-50',
              usage: 'Liên kết, hướng dẫn, trạng thái info.',
            },
          ].map(color => (
            <div
              key={color.name}
              className={`rounded-xl border border-slate-100 ${color.soft} p-4`}
            >
              <div className={`h-10 w-10 rounded-xl ${color.bg} shadow-sm`} />
              <p className={`mt-3 text-sm font-normal ${color.text}`}>{color.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{color.token}</p>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">{color.usage}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="appearance-components"
        title="Thành phần UI"
        description="Preview nhanh các control nền tảng để giữ giao diện nhất quán khi mở rộng app."
        icon={ServerCog}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-900">Buttons & badges</p>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white">
                Lưu thay đổi
              </button>
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-normal text-slate-700">
                Hủy
              </button>
              <button className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-normal text-rose-600">
                Xóa
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-normal text-emerald-700">
                Hoàn tất
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-normal text-amber-700">
                Cần kiểm tra
              </span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-normal text-rose-700">
                Lỗi
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-900">Form controls</p>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
              placeholder="Nhập tên cấu hình"
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Đang bật
              </label>
              <TogglePill enabled={true} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white xl:col-span-2 overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_120px] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900">
              <span>Tên hàng</span>
              <span>Nhóm</span>
              <span>Trạng thái</span>
              <span className="text-right">Tồn kho</span>
            </div>
            <div className="grid grid-cols-[1.2fr_1fr_1fr_120px] px-4 py-3 text-sm text-slate-700 border-t border-slate-100">
              <span>Sandal bé trai 0068</span>
              <span>Dép trẻ em</span>
              <span className="text-emerald-600">Đang bán</span>
              <span className="text-right">42</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default React.memo(AppearanceTab);
