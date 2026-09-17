import React, { useMemo, useState } from 'react';
import { Check, Monitor, Smartphone, Sparkles } from 'lucide-react';
import { APP_THEMES, AppTheme, AppThemeId, AppThemeTokens } from '../../../constants/themes';

interface AppearanceTabProps {
  activeThemeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
}

type StudioTab = 'base' | 'components' | 'advanced';
type PreviewViewport = 'desktop' | 'mobile';

const STUDIO_TABS: { id: StudioTab; label: string }[] = [
  { id: 'base', label: 'Cơ bản' },
  { id: 'components', label: 'Thành phần' },
  { id: 'advanced', label: 'Nâng cao' },
];

/**
 * Các token được bày ra trong panel trái, kèm tên biến CSS gốc của Astryx
 * để bước 2 nối thẳng vào biến thật mà không phải đặt lại tên.
 */
const TOKEN_ROWS: { key: keyof AppThemeTokens; label: string; cssVar: string }[] = [
  { key: 'accent', label: 'Màu nhấn', cssVar: '--color-accent' },
  { key: 'body', label: 'Nền trang', cssVar: '--color-background-body' },
  { key: 'card', label: 'Nền thẻ', cssVar: '--color-background-card' },
  { key: 'muted', label: 'Nền phụ', cssVar: '--color-background-muted' },
  { key: 'text', label: 'Chữ chính', cssVar: '--color-text-primary' },
  { key: 'textMuted', label: 'Chữ phụ', cssVar: '--color-text-secondary' },
  { key: 'border', label: 'Viền', cssVar: '--color-border' },
];

const PanelSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="border-b border-slate-100 px-4 py-4 last:border-b-0">
    <p className="mb-3 text-xs font-normal text-slate-500">{title}</p>
    {children}
  </section>
);

/** Ô vuông 2 tông giống thẻ theme trên trang Themes của Astryx. */
const ThemeSwatch: React.FC<{ theme: AppTheme }> = ({ theme }) => (
  <span
    className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200"
    aria-hidden="true"
  >
    <span className="w-1/2" style={{ backgroundColor: theme.tokens.accent }} />
    <span className="w-1/2" style={{ backgroundColor: theme.tokens.body }} />
  </span>
);

/* ============================================================
   Khung xem trước — render bằng token của theme ĐANG XEM,
   không phụ thuộc data-theme trên <html>, nên xem được theme
   khác trước khi bấm áp dụng.
   ============================================================ */

const PreviewCanvas: React.FC<{ tokens: AppThemeTokens; viewport: PreviewViewport }> = ({
  tokens,
  viewport,
}) => {
  const vars = {
    '--p-accent': tokens.accent,
    '--p-body': tokens.body,
    '--p-card': tokens.card,
    '--p-muted': tokens.muted,
    '--p-text': tokens.text,
    '--p-text-muted': tokens.textMuted,
    '--p-border': tokens.border,
    '--p-radius': tokens.radius,
    fontFamily: `'${tokens.font}', ui-sans-serif, system-ui, sans-serif`,
  } as React.CSSProperties;

  const rows = [
    { name: 'Sandal bé trai 0068', group: 'Dép trẻ em', status: 'Đang bán', stock: '42' },
    { name: 'Giày thể thao nam 2210', group: 'Giày nam', status: 'Đang bán', stock: '8' },
    { name: 'Dép quai ngang nữ 115', group: 'Dép nữ', status: 'Ngừng bán', stock: '0' },
  ];

  return (
    <div
      className="mx-auto w-full transition-all"
      style={{ maxWidth: viewport === 'mobile' ? 390 : '100%' }}
    >
      <div className="overflow-hidden p-4" style={{ ...vars, backgroundColor: 'var(--p-body)' }}>
        {/* Thanh điều hướng */}
        <div
          className="mb-3 flex items-center justify-between px-3 py-2"
          style={{
            backgroundColor: 'var(--p-card)',
            border: '1px solid var(--p-border)',
            borderRadius: 'var(--p-radius)',
          }}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--p-text)' }}>
            Quản lý hàng hóa
          </span>
          <span
            className="px-3 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--p-accent)',
              color: '#ffffff',
              borderRadius: 'var(--p-radius)',
            }}
          >
            Thêm hàng
          </span>
        </div>

        {/* Thẻ số liệu */}
        <div
          className={`mb-3 grid gap-2 ${viewport === 'mobile' ? 'grid-cols-2' : 'grid-cols-3'}`}
        >
          {[
            { label: 'Doanh thu hôm nay', value: '12.480.000' },
            { label: 'Số đơn', value: '37' },
            { label: 'Tồn kho', value: '1.284' },
          ].map(stat => (
            <div
              key={stat.label}
              className="px-3 py-2.5"
              style={{
                backgroundColor: 'var(--p-card)',
                border: '1px solid var(--p-border)',
                borderRadius: 'var(--p-radius)',
              }}
            >
              <p className="text-[11px]" style={{ color: 'var(--p-text-muted)' }}>
                {stat.label}
              </p>
              <p className="mt-1 text-base font-bold" style={{ color: 'var(--p-text)' }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Thanh công cụ */}
        <div className="mb-3 flex gap-2">
          <div
            className="flex-1 px-3 py-2 text-xs"
            style={{
              backgroundColor: 'var(--p-card)',
              border: '1px solid var(--p-border)',
              borderRadius: 'var(--p-radius)',
              color: 'var(--p-text-muted)',
            }}
          >
            Tìm theo tên, mã hàng...
          </div>
          <div
            className="px-3 py-2 text-xs"
            style={{
              backgroundColor: 'var(--p-muted)',
              border: '1px solid var(--p-border)',
              borderRadius: 'var(--p-radius)',
              color: 'var(--p-text)',
            }}
          >
            Bộ lọc
          </div>
        </div>

        {/* Bảng */}
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: 'var(--p-card)',
            border: '1px solid var(--p-border)',
            borderRadius: 'var(--p-radius)',
          }}
        >
          <div
            className={`grid gap-2 px-3 py-2 text-[11px] font-bold ${
              viewport === 'mobile' ? 'grid-cols-[1fr_70px]' : 'grid-cols-[1.4fr_1fr_1fr_70px]'
            }`}
            style={{ backgroundColor: 'var(--p-muted)', color: 'var(--p-text)' }}
          >
            <span>Tên hàng</span>
            {viewport === 'desktop' && <span>Nhóm</span>}
            {viewport === 'desktop' && <span>Trạng thái</span>}
            <span className="text-right">Tồn</span>
          </div>
          {rows.map(row => (
            <div
              key={row.name}
              className={`grid items-center gap-2 px-3 py-2.5 text-xs ${
                viewport === 'mobile' ? 'grid-cols-[1fr_70px]' : 'grid-cols-[1.4fr_1fr_1fr_70px]'
              }`}
              style={{ borderTop: '1px solid var(--p-border)', color: 'var(--p-text)' }}
            >
              <span className="truncate">{row.name}</span>
              {viewport === 'desktop' && (
                <span style={{ color: 'var(--p-text-muted)' }}>{row.group}</span>
              )}
              {viewport === 'desktop' && (
                <span
                  className="w-fit whitespace-nowrap px-2 py-0.5 text-[11px]"
                  style={{
                    borderRadius: 999,
                    backgroundColor: row.stock === '0' ? '#ffc4be' : '#bce0bb',
                    color: row.stock === '0' ? '#76000c' : '#00490b',
                  }}
                >
                  {row.status}
                </span>
              )}
              <span className="text-right">{row.stock}</span>
            </div>
          ))}
        </div>

        {/* Nút */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className="px-3 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--p-accent)',
              color: '#ffffff',
              borderRadius: 'var(--p-radius)',
            }}
          >
            Lưu thay đổi
          </span>
          <span
            className="px-3 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--p-card)',
              border: '1px solid var(--p-border)',
              color: 'var(--p-text)',
              borderRadius: 'var(--p-radius)',
            }}
          >
            Hủy
          </span>
          <span
            className="px-3 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--p-card)',
              border: '1px solid #ffaea7',
              color: '#76000c',
              borderRadius: 'var(--p-radius)',
            }}
          >
            Xóa
          </span>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Nội dung 3 tab của panel trái
   ============================================================ */

const BaseStylesTab: React.FC<{
  themes: AppTheme[];
  previewTheme: AppTheme;
  activeThemeId: AppThemeId;
  onPreview: (id: AppThemeId) => void;
}> = ({ themes, previewTheme, activeThemeId, onPreview }) => (
  <>
    <PanelSection title="Theme">
      <div className="space-y-2">
        {themes.map(theme => {
          const isPreviewing = theme.id === previewTheme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onPreview(theme.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
                isPreviewing
                  ? 'border-indigo-200 bg-indigo-50'
                  : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ThemeSwatch theme={theme} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="block truncate text-sm font-normal text-slate-800">
                    {theme.name}
                  </span>
                  {theme.id === activeThemeId && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                      đang dùng
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {theme.tokens.font} · bo góc {theme.tokens.radius}
                </span>
              </span>
              {isPreviewing && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
            </button>
          );
        })}
      </div>
    </PanelSection>

    <PanelSection title="Màu">
      <div className="space-y-1.5">
        {TOKEN_ROWS.map(row => {
          const value = previewTheme.tokens[row.key];
          return (
            <div key={row.key} className="flex items-center gap-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-slate-700">{row.label}</span>
                <span className="block truncate font-mono text-[10px] text-slate-400">
                  {row.cssVar}
                </span>
              </span>
              <span
                className="h-6 w-6 shrink-0 rounded-md border border-slate-200"
                style={{ backgroundColor: value }}
              />
              <span className="w-[112px] shrink-0 truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-right font-mono text-[10px] text-slate-600">
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </PanelSection>

    <PanelSection title="Kiểu chữ & bo góc">
      <div className="space-y-1.5">
        {[
          { label: 'Font chữ', value: previewTheme.tokens.font },
          { label: 'Bo góc thẻ', value: previewTheme.tokens.radius },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-700">{item.label}</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-600">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Bước 2 sẽ mở khoá chỉnh tay từng token (màu, bo góc, mật độ, cỡ chữ) và ghi thẳng ra
          toàn app.
        </span>
      </p>
    </PanelSection>
  </>
);

const ComponentsTab: React.FC = () => (
  <>
    <PanelSection title="Nút">
      <div className="flex flex-wrap gap-2">
        <button className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-normal text-white">
          Lưu thay đổi
        </button>
        <button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-normal text-slate-700">
          Hủy
        </button>
        <button className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-normal text-rose-600">
          Xóa
        </button>
      </div>
    </PanelSection>

    <PanelSection title="Badge trạng thái">
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
    </PanelSection>

    <PanelSection title="Form">
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-indigo-300"
        placeholder="Nhập tên cấu hình"
      />
      <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
        />
        Đang bật
      </label>
    </PanelSection>
  </>
);

const AdvancedTab: React.FC = () => (
  <>
    <PanelSection title="Cấp chữ">
      <div className="space-y-2.5">
        {[
          { name: 'Tiêu đề trang', sample: 'Quản lý hàng hóa', cls: 'text-xl font-bold text-slate-950' },
          { name: 'Tiêu đề section', sample: 'Thông tin hàng hóa', cls: 'text-base font-bold text-slate-900' },
          { name: 'Tiêu đề cột bảng', sample: 'Số tài khoản', cls: 'text-xs font-bold text-slate-900' },
          { name: 'Nội dung thường', sample: 'VietinBank - 1058844239173', cls: 'text-xs font-normal text-slate-800' },
          { name: 'Mô tả / helper', sample: 'Áp dụng cho toàn hệ thống', cls: 'text-[11px] font-normal text-slate-500' },
        ].map(item => (
          <div key={item.name}>
            <p className="text-[10px] text-slate-400">{item.name}</p>
            <p className={item.cls}>{item.sample}</p>
          </div>
        ))}
      </div>
    </PanelSection>

    <PanelSection title="Màu trạng thái nghiệp vụ">
      <div className="space-y-2">
        {[
          { name: 'Thành công / Lãi', token: 'Emerald', bg: 'bg-emerald-600', usage: 'Lãi, hoàn tất, online.' },
          { name: 'Cảnh báo', token: 'Amber', bg: 'bg-amber-500', usage: 'Tồn kho thấp, cần chú ý.' },
          { name: 'Lỗi / Lỗ', token: 'Rose', bg: 'bg-rose-600', usage: 'Lỗi, lỗ, xóa dữ liệu.' },
        ].map(color => (
          <div key={color.name} className="flex items-start gap-2.5">
            <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-lg ${color.bg}`} />
            <span className="min-w-0">
              <span className="block text-xs text-slate-800">
                {color.name}{' '}
                <span className="font-mono text-[10px] text-slate-400">{color.token}</span>
              </span>
              <span className="block text-[11px] leading-relaxed text-slate-500">
                {color.usage}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
        Màu trạng thái nghiệp vụ được giữ nguyên nghĩa ở mọi theme — đổi màu lãi/lỗ theo theme là
        rủi ro đọc sai số liệu.
      </p>
    </PanelSection>
  </>
);

/* ============================================================ */

const AppearanceTab: React.FC<AppearanceTabProps> = ({ activeThemeId, onThemeChange }) => {
  const [studioTab, setStudioTab] = useState<StudioTab>('base');
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [previewThemeId, setPreviewThemeId] = useState<AppThemeId>(activeThemeId);

  const previewTheme = useMemo(
    () => APP_THEMES.find(theme => theme.id === previewThemeId) ?? APP_THEMES[0],
    [previewThemeId]
  );

  const isApplied = previewThemeId === activeThemeId;

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:flex-row xl:items-start">
      {/* ---------- Panel điều khiển ---------- */}
      <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm xl:w-80">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Giao diện</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Chọn theme rồi xem trước bên phải trước khi áp dụng cho toàn app.
          </p>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-2 py-2">
          {STUDIO_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStudioTab(tab.id)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                studioTab === tab.id
                  ? 'bg-slate-100 font-normal text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="max-h-[560px] overflow-y-auto">
          {studioTab === 'base' && (
            <BaseStylesTab
              themes={APP_THEMES}
              previewTheme={previewTheme}
              activeThemeId={activeThemeId}
              onPreview={setPreviewThemeId}
            />
          )}
          {studioTab === 'components' && <ComponentsTab />}
          {studioTab === 'advanced' && <AdvancedTab />}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <button
            type="button"
            disabled={isApplied}
            onClick={() => onThemeChange(previewThemeId)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-normal transition-colors ${
              isApplied
                ? 'cursor-default bg-slate-100 text-slate-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isApplied ? 'Đang dùng theme này' : `Áp dụng ${previewTheme.name}`}
          </button>
          {!isApplied && (
            <button
              type="button"
              onClick={() => setPreviewThemeId(activeThemeId)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-600 hover:bg-slate-50"
            >
              Bỏ
            </button>
          )}
        </div>
      </aside>

      {/* ---------- Khung xem trước ---------- */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">Xem trước</p>
            <p className="truncate text-xs text-slate-500">
              {previewTheme.name} — {previewTheme.description}
            </p>
          </div>
          <div className="flex shrink-0 gap-1 rounded-lg bg-slate-100 p-0.5">
            {[
              { id: 'desktop' as const, icon: Monitor, label: 'Máy tính' },
              { id: 'mobile' as const, icon: Smartphone, label: 'Điện thoại' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={viewport === item.id}
                onClick={() => setViewport(item.id)}
                className={`rounded-md p-1.5 transition-colors ${
                  viewport === item.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <item.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-100/60 p-4">
          <PreviewCanvas tokens={previewTheme.tokens} viewport={viewport} />
        </div>
      </div>
    </div>
  );
};

export default React.memo(AppearanceTab);
