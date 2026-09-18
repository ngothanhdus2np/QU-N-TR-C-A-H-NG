import React, { useMemo, useState } from 'react';
import { Check, Copy, Monitor, RotateCcw, Smartphone } from 'lucide-react';
import {
  APP_THEMES,
  AppTheme,
  AppThemeId,
  AppThemeTokens,
  COLOR_KEYS,
  CUSTOM_LIMITS,
  DENSITY_PRESETS,
  DURATION_PRESETS,
  FONT_OPTIONS,
  FONT_SIZE_PRESETS,
  RADIUS_PRESETS,
  ThemeColorKey,
  ThemeCustomization,
  createCustomization,
} from '../../../constants/themes';

interface AppearanceTabProps {
  activeThemeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
  customization: ThemeCustomization | null;
  onCustomizationChange: (patch: Partial<ThemeCustomization>) => void;
  onCustomizationReset: () => void;
}

type StudioTab = 'base' | 'components' | 'advanced';
type PreviewViewport = 'desktop' | 'mobile';

const STUDIO_TABS: { id: StudioTab; label: string }[] = [
  { id: 'base', label: 'Cơ bản' },
  { id: 'components', label: 'Thành phần' },
  { id: 'advanced', label: 'Nâng cao' },
];

/** Tên biến CSS gốc của Astryx, bày ra để đối chiếu được với tài liệu của họ. */
const COLOR_LABELS: Record<ThemeColorKey, { label: string; cssVar: string }> = {
  accent: { label: 'Màu nhấn', cssVar: '--color-accent' },
  body: { label: 'Nền trang', cssVar: '--color-background-body' },
  card: { label: 'Nền thẻ', cssVar: '--color-background-card' },
  muted: { label: 'Nền phụ', cssVar: '--color-background-muted' },
  text: { label: 'Chữ chính', cssVar: '--color-text-primary' },
  textMuted: { label: 'Chữ phụ', cssVar: '--color-text-secondary' },
  border: { label: 'Viền', cssVar: '--color-border' },
};

/** `<input type="color">` chỉ nhận #rrggbb — token dạng rgba() phải có giá trị thay thế. */
const toHexInput = (value: string): string =>
  /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : '#000000';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const PanelSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="border-b border-slate-100 px-4 py-4 last:border-b-0">
    <p className="mb-3 text-xs font-normal text-slate-500">{title}</p>
    {children}
  </section>
);

const ThemeSwatch: React.FC<{ theme: AppTheme }> = ({ theme }) => (
  <span
    className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200"
    aria-hidden="true"
  >
    <span className="w-1/2" style={{ backgroundColor: theme.tokens.accent }} />
    <span className="w-1/2" style={{ backgroundColor: theme.tokens.body }} />
  </span>
);

/** Hàng chọn màu: ô màu + ô hex gõ tay. */
const ColorRow: React.FC<{
  colorKey: ThemeColorKey;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}> = ({ colorKey, value, editable, onChange }) => {
  const meta = COLOR_LABELS[colorKey];
  return (
    <div className="flex items-center gap-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-slate-700">{meta.label}</span>
        <span className="block truncate font-mono text-[10px] text-slate-400">{meta.cssVar}</span>
      </span>
      <span className="relative h-6 w-6 shrink-0">
        <span
          className="block h-6 w-6 rounded-md border border-slate-200"
          style={{ backgroundColor: value }}
        />
        {editable && (
          <input
            type="color"
            aria-label={meta.label}
            value={toHexInput(value)}
            onChange={event => onChange(event.target.value)}
            className="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
          />
        )}
      </span>
      <input
        type="text"
        aria-label={`${meta.label} — mã màu`}
        value={value}
        readOnly={!editable}
        onChange={event => onChange(event.target.value)}
        className={`w-[112px] shrink-0 rounded-md border px-2 py-1 text-right font-mono text-[10px] outline-none ${
          editable
            ? 'border-slate-200 bg-white text-slate-700 focus:border-indigo-300'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}
      />
    </div>
  );
};

/** Hàng preset S/M/L/XL kèm ô số gõ tay — đúng dạng điều khiển của Astryx. */
const ScaleRow: React.FC<{
  label: string;
  presets: { label: string; value: number }[];
  value: number;
  unit: string;
  step?: number;
  limits: { min: number; max: number };
  editable: boolean;
  onChange: (value: number) => void;
}> = ({ label, presets, value, unit, step = 1, limits, editable, onChange }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-xs text-slate-700">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          aria-label={label}
          value={value}
          step={step}
          min={limits.min}
          max={limits.max}
          disabled={!editable}
          onChange={event => {
            const next = parseFloat(event.target.value);
            if (!Number.isNaN(next)) onChange(clamp(next, limits.min, limits.max));
          }}
          className={`w-16 rounded-md border px-2 py-1 text-right font-mono text-[10px] outline-none ${
            editable
              ? 'border-slate-200 bg-white text-slate-700 focus:border-indigo-300'
              : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
        />
        <span className="w-3 font-mono text-[10px] text-slate-400">{unit}</span>
      </span>
    </div>
    <div className="flex gap-1">
      {presets.map(preset => (
        <button
          key={preset.label}
          type="button"
          disabled={!editable}
          onClick={() => onChange(preset.value)}
          className={`flex-1 rounded-md border px-1 py-1 text-[11px] transition-colors ${
            value === preset.value
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600'
          } ${editable ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-60'}`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  </div>
);

/* ============================================================
   Khung xem trước
   ============================================================ */

const PreviewCanvas: React.FC<{
  tokens: AppThemeTokens;
  fontSize: number;
  viewport: PreviewViewport;
}> = ({ tokens, fontSize, viewport }) => {
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
    fontSize: `${fontSize}px`,
  } as React.CSSProperties;

  const rows = [
    { name: 'Sandal bé trai 0068', group: 'Dép trẻ em', status: 'Đang bán', stock: '42' },
    { name: 'Giày thể thao nam 2210', group: 'Giày nam', status: 'Đang bán', stock: '8' },
    { name: 'Dép quai ngang nữ 115', group: 'Dép nữ', status: 'Ngừng bán', stock: '0' },
  ];

  const boxed = {
    backgroundColor: 'var(--p-card)',
    border: '1px solid var(--p-border)',
    borderRadius: 'var(--p-radius)',
  };

  return (
    <div
      className="mx-auto w-full transition-all"
      style={{ maxWidth: viewport === 'mobile' ? 390 : '100%' }}
    >
      <div className="overflow-hidden p-4" style={{ ...vars, backgroundColor: 'var(--p-body)' }}>
        <div className="mb-3 flex items-center justify-between px-3 py-2" style={boxed}>
          <span className="font-bold" style={{ color: 'var(--p-text)' }}>
            Quản lý hàng hóa
          </span>
          <span
            className="px-3 py-1.5"
            style={{
              backgroundColor: 'var(--p-accent)',
              color: '#ffffff',
              borderRadius: 'var(--p-radius)',
              fontSize: '0.85em',
            }}
          >
            Thêm hàng
          </span>
        </div>

        <div className={`mb-3 grid gap-2 ${viewport === 'mobile' ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {[
            { label: 'Doanh thu hôm nay', value: '12.480.000' },
            { label: 'Số đơn', value: '37' },
            { label: 'Tồn kho', value: '1.284' },
          ].map(stat => (
            <div key={stat.label} className="px-3 py-2.5" style={boxed}>
              <p style={{ color: 'var(--p-text-muted)', fontSize: '0.8em' }}>{stat.label}</p>
              <p className="mt-1 font-bold" style={{ color: 'var(--p-text)', fontSize: '1.1em' }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-3 flex gap-2">
          <div
            className="flex-1 px-3 py-2"
            style={{ ...boxed, color: 'var(--p-text-muted)', fontSize: '0.85em' }}
          >
            Tìm theo tên, mã hàng...
          </div>
          <div
            className="px-3 py-2"
            style={{
              ...boxed,
              backgroundColor: 'var(--p-muted)',
              color: 'var(--p-text)',
              fontSize: '0.85em',
            }}
          >
            Bộ lọc
          </div>
        </div>

        <div className="overflow-hidden" style={boxed}>
          <div
            className={`grid gap-2 px-3 py-2 font-bold ${
              viewport === 'mobile' ? 'grid-cols-[1fr_70px]' : 'grid-cols-[1.4fr_1fr_1fr_70px]'
            }`}
            style={{
              backgroundColor: 'var(--p-muted)',
              color: 'var(--p-text)',
              fontSize: '0.8em',
            }}
          >
            <span>Tên hàng</span>
            {viewport === 'desktop' && <span>Nhóm</span>}
            {viewport === 'desktop' && <span>Trạng thái</span>}
            <span className="text-right">Tồn</span>
          </div>
          {rows.map(row => (
            <div
              key={row.name}
              className={`grid items-center gap-2 px-3 py-2.5 ${
                viewport === 'mobile' ? 'grid-cols-[1fr_70px]' : 'grid-cols-[1.4fr_1fr_1fr_70px]'
              }`}
              style={{
                borderTop: '1px solid var(--p-border)',
                color: 'var(--p-text)',
                fontSize: '0.85em',
              }}
            >
              <span className="truncate">{row.name}</span>
              {viewport === 'desktop' && (
                <span style={{ color: 'var(--p-text-muted)' }}>{row.group}</span>
              )}
              {viewport === 'desktop' && (
                <span
                  className="w-fit whitespace-nowrap px-2 py-0.5"
                  style={{
                    borderRadius: 999,
                    backgroundColor: row.stock === '0' ? '#ffc4be' : '#bce0bb',
                    color: row.stock === '0' ? '#76000c' : '#00490b',
                    fontSize: '0.9em',
                  }}
                >
                  {row.status}
                </span>
              )}
              <span className="text-right">{row.stock}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2" style={{ fontSize: '0.85em' }}>
          <span
            className="px-3 py-1.5"
            style={{
              backgroundColor: 'var(--p-accent)',
              color: '#ffffff',
              borderRadius: 'var(--p-radius)',
            }}
          >
            Lưu thay đổi
          </span>
          <span className="px-3 py-1.5" style={{ ...boxed, color: 'var(--p-text)' }}>
            Hủy
          </span>
          <span
            className="px-3 py-1.5"
            style={{ ...boxed, border: '1px solid #ffaea7', color: '#76000c' }}
          >
            Xóa
          </span>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Tab "Cơ bản" — nơi chỉnh token
   ============================================================ */

const BaseStylesTab: React.FC<{
  previewTheme: AppTheme;
  activeThemeId: AppThemeId;
  values: ThemeCustomization;
  editable: boolean;
  onPreview: (id: AppThemeId) => void;
  onApplyPreview: () => void;
  onChange: (patch: Partial<ThemeCustomization>) => void;
}> = ({ previewTheme, activeThemeId, values, editable, onPreview, onApplyPreview, onChange }) => (
  <>
    <PanelSection title="Theme">
      <div className="space-y-2">
        {APP_THEMES.map(theme => {
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

    {!editable && (
      <div className="border-b border-slate-100 bg-amber-50/60 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-slate-600">
          Đang xem trước <strong>{previewTheme.name}</strong>. Muốn chỉnh tay các token bên dưới
          thì áp dụng theme này trước.
        </p>
        <button
          type="button"
          onClick={onApplyPreview}
          className="mt-2 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-indigo-700"
        >
          Áp dụng để chỉnh
        </button>
      </div>
    )}

    <PanelSection title="Màu">
      <div className="space-y-1.5">
        {COLOR_KEYS.map(key => (
          <ColorRow
            key={key}
            colorKey={key}
            value={values[key]}
            editable={editable}
            onChange={value => onChange({ [key]: value })}
          />
        ))}
      </div>
    </PanelSection>

    <PanelSection title="Kiểu chữ">
      <label className="mb-3 block">
        <span className="mb-1.5 block text-xs text-slate-700">Font chữ</span>
        <select
          value={values.fontFamily}
          disabled={!editable}
          onChange={event => onChange({ fontFamily: event.target.value })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-500"
        >
          {FONT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <ScaleRow
        label="Cỡ chữ"
        presets={FONT_SIZE_PRESETS}
        value={values.fontSize}
        unit="px"
        step={0.5}
        limits={CUSTOM_LIMITS.fontSize}
        editable={editable}
        onChange={fontSize => onChange({ fontSize })}
      />
    </PanelSection>

    <PanelSection title="Hình khối">
      <div className="space-y-3.5">
        <ScaleRow
          label="Bo góc"
          presets={RADIUS_PRESETS}
          value={values.radius}
          unit="px"
          limits={CUSTOM_LIMITS.radius}
          editable={editable}
          onChange={radius => onChange({ radius })}
        />
        <ScaleRow
          label="Mật độ"
          presets={DENSITY_PRESETS}
          value={values.density}
          unit="×"
          step={0.05}
          limits={CUSTOM_LIMITS.density}
          editable={editable}
          onChange={density => onChange({ density })}
        />
        <ScaleRow
          label="Chuyển động"
          presets={DURATION_PRESETS}
          value={values.duration}
          unit="×"
          step={0.1}
          limits={CUSTOM_LIMITS.duration}
          editable={editable}
          onChange={duration => onChange({ duration })}
        />
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
        Mật độ chỉ nới/thu khung chứa, <strong>không đụng nút và ô nhập</strong> — đổi padding của
        chúng là đổi vùng chạm trên máy bán hàng.
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

const AdvancedTab: React.FC<{ values: ThemeCustomization; hasCustom: boolean }> = ({
  values,
  hasCustom,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <PanelSection title="Cấu hình hiện tại">
        <pre className="max-h-48 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-2.5 font-mono text-[10px] leading-relaxed text-slate-600">
          {JSON.stringify(values, null, 2)}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
        >
          <Copy className="h-3 w-3" />
          {copied ? 'Đã chép' : 'Chép cấu hình'}
        </button>
        {!hasCustom && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Đây là giá trị gốc của theme — chưa có chỉnh tay nào được lưu.
          </p>
        )}
      </PanelSection>

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
          Màu trạng thái nghiệp vụ <strong>không chỉnh được</strong> và giữ nguyên nghĩa ở mọi
          theme — đổi màu lãi/lỗ là rủi ro đọc sai số liệu.
        </p>
      </PanelSection>
    </>
  );
};

/* ============================================================ */

const AppearanceTab: React.FC<AppearanceTabProps> = ({
  activeThemeId,
  onThemeChange,
  customization,
  onCustomizationChange,
  onCustomizationReset,
}) => {
  const [studioTab, setStudioTab] = useState<StudioTab>('base');
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [previewThemeId, setPreviewThemeId] = useState<AppThemeId>(activeThemeId);

  const previewTheme = useMemo(
    () => APP_THEMES.find(theme => theme.id === previewThemeId) ?? APP_THEMES[0],
    [previewThemeId]
  );

  const isApplied = previewThemeId === activeThemeId;

  // Chỉ chỉnh được token của theme ĐANG DÙNG — chỉnh token của theme chỉ-đang-xem
  // sẽ không thấy tác dụng gì trên app, rất dễ tưởng là hỏng.
  const editable = isApplied;

  const values = useMemo<ThemeCustomization>(
    () => (editable && customization ? customization : createCustomization(previewTheme)),
    [customization, editable, previewTheme]
  );

  // Khung xem trước dùng đúng giá trị đang hiển thị trong panel.
  const previewTokens = useMemo<AppThemeTokens>(
    () => ({
      accent: values.accent,
      body: values.body,
      card: values.card,
      muted: values.muted,
      text: values.text,
      textMuted: values.textMuted,
      border: values.border,
      radius: `${values.radius}px`,
      font: values.fontFamily === 'system' ? 'Inter' : values.fontFamily,
    }),
    [values]
  );

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:flex-row xl:items-start">
      {/* ---------- Panel điều khiển ---------- */}
      <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm xl:w-80">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Giao diện</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Chỉnh token ở đây là toàn app đổi theo ngay.
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
              previewTheme={previewTheme}
              activeThemeId={activeThemeId}
              values={values}
              editable={editable}
              onPreview={setPreviewThemeId}
              onApplyPreview={() => onThemeChange(previewThemeId)}
              onChange={onCustomizationChange}
            />
          )}
          {studioTab === 'components' && <ComponentsTab />}
          {studioTab === 'advanced' && (
            <AdvancedTab values={values} hasCustom={Boolean(editable && customization)} />
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          {isApplied ? (
            <button
              type="button"
              disabled={!customization}
              onClick={onCustomizationReset}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-normal transition-colors ${
                customization
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'cursor-default bg-slate-100 text-slate-400'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {customization ? 'Khôi phục mặc định' : 'Chưa có chỉnh tay nào'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onThemeChange(previewThemeId)}
                className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-normal text-white hover:bg-indigo-700"
              >
                Áp dụng {previewTheme.name}
              </button>
              <button
                type="button"
                onClick={() => setPreviewThemeId(activeThemeId)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-600 hover:bg-slate-50"
              >
                Bỏ
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ---------- Khung xem trước ---------- */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">Xem trước</p>
            <p className="truncate text-xs text-slate-500">
              {previewTheme.name}
              {editable && customization ? ' — đã chỉnh tay' : ` — ${previewTheme.description}`}
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
          <PreviewCanvas
            tokens={previewTokens}
            fontSize={values.fontSize}
            viewport={viewport}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(AppearanceTab);
