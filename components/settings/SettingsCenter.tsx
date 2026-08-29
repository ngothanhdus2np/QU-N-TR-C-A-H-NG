import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  CreditCard,
  Database,
  Fingerprint,
  History,
  KeyRound,
  Loader2,
  Mail,
  MessageSquare,
  Palette,
  Plus,
  Package,
  Printer,
  RefreshCw,
  Save,
  Send,
  ServerCog,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Upload,
  UploadCloud,
  User,
  Users,
  WifiOff,
  XCircle,
  Crown,
  Gem,
  Star,
  Info,
} from 'lucide-react';
import { AppThemeId } from '../../constants/themes';
import {
  DEFAULT_POS_INVENTORY_SETTINGS,
  normalizePOSPaymentSettings,
} from '../../constants/defaultData';
import { uploadImage } from '../../services/marketingStorageService';
import { apiService } from '../../services/apiService';
import { useToast } from '../ui/Toast';
import type {
  AlertConfig,
  BrandProfile,
  POSInventorySettings,
  POSKeyboardAction,
  POSKeyboardShortcut,
  POSPaymentSettings,
  POSProduct,
} from '../../types';
import { DEFAULT_POS_KEYBOARD_SHORTCUTS } from '../../types';

const PaymentsTab = lazy(() => import('./tabs/PaymentsTab'));
const AppearanceTab = lazy(() => import('./tabs/AppearanceTab'));
const GoodsTab = lazy(() => import('./tabs/GoodsTab'));
const PrintTemplatesTab = lazy(() => import('./tabs/PrintTemplatesTab'));
const MigrationTab = lazy(() => import('./tabs/MigrationTab'));
const AccountsTab = lazy(() => import('./tabs/AccountsTab'));
const ActivityLogTab = lazy(() => import('../audit/ActivityLogPage'));

type SettingsTab =
  | 'store'
  | 'pos'
  | 'goods'
  | 'customers'
  | 'payments'
  | 'printTemplates'
  | 'appearance'
  | 'notifications'
  | 'integrations'
  | 'sync'
  | 'migration'
  | 'security'
  | 'accounts'
  | 'activityLog';

interface SettingsCenterProps {
  onNavigate: (id: string) => void;
  activeThemeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
  isCloudConnected: boolean;
  isSyncing: boolean;
  syncErrors: string[] | null;
  lastSyncTime: string | null;
  pendingCount?: number;
  offlinePendingCount?: number;
  onRefresh: () => void;
  onImportRefresh?: () => void;
  onDrainOfflineQueue?: () => Promise<{ synced: number; failed: number }>;
  brandProfile: BrandProfile;
  onUpdateBrand: (profile: BrandProfile) => void;
  paymentSettings?: POSPaymentSettings;
  onUpdatePaymentSettings: (settings: POSPaymentSettings) => Promise<void>;
  inventorySettings?: POSInventorySettings;
  onUpdateInventorySettings: (settings: POSInventorySettings) => Promise<void>;
  products?: POSProduct[];
  userRole?: string;
}

const SETTINGS_PAGES: Record<
  SettingsTab,
  { label: string; description: string; icon: React.ElementType }
> = {
  store: {
    label: 'Cửa hàng',
    description: 'Thông tin cửa hàng, giao diện và nhận diện',
    icon: Store,
  },
  pos: {
    label: 'Bán hàng / POS',
    description: 'Thanh toán, hóa đơn và trải nghiệm máy tính tiền',
    icon: ShoppingCart,
  },
  goods: {
    label: 'Hàng hóa',
    description: 'Mã vạch, thuộc tính, tồn kho và bảo hành',
    icon: Package,
  },
  customers: {
    label: 'Khách hàng',
    description: 'Nhóm khách hàng, tiêu chí phân hạng và ngưỡng',
    icon: Users,
  },
  payments: {
    label: 'Thanh toán POS',
    description: 'Tài khoản ngân hàng, ví điện tử và QR',
    icon: CreditCard,
  },
  printTemplates: {
    label: 'Mẫu in',
    description: 'Quản lý mẫu in hóa đơn và các loại phiếu',
    icon: Printer,
  },
  appearance: { label: 'Giao diện', description: 'Theme và trải nghiệm', icon: Palette },
  notifications: { label: 'Thông báo', description: 'Email, Zalo và ngưỡng cảnh báo', icon: Bell },
  integrations: { label: 'Tích hợp', description: 'AI và dịch vụ ngoài', icon: ServerCog },
  sync: {
    label: 'Dữ liệu & đồng bộ',
    description: 'Cloud, offline queue và trạng thái sync',
    icon: Database,
  },
  security: {
    label: 'Bảo mật',
    description: 'API key status, quyền truy cập và audit',
    icon: ShieldCheck,
  },
  migration: {
    label: 'Chuyển dữ liệu',
    description: 'Import từ KiotViet và xóa dữ liệu test',
    icon: Upload,
  },
  accounts: {
    label: 'Quản lý tài khoản',
    description: 'Tạo, sửa mật khẩu và xóa tài khoản đăng nhập',
    icon: User,
  },
  activityLog: {
    label: 'Nhật ký hoạt động',
    description: 'Ai đã thêm/sửa/xóa dữ liệu gì trong hệ thống — chỉ chủ cửa hàng xem được',
    icon: History,
  },
};

const SETTINGS_GROUPS: { title: string; items: SettingsTab[] }[] = [
  { title: 'Cửa hàng', items: ['store', 'appearance'] },
  { title: 'Bán hàng', items: ['pos', 'payments', 'printTemplates'] },
  { title: 'Quản lý', items: ['goods', 'customers'] },
  { title: 'Tiện ích', items: ['notifications', 'integrations'] },
  { title: 'Dữ liệu', items: ['sync', 'security', 'migration'] },
  { title: 'Tài khoản', items: ['accounts', 'activityLog'] },
];

const SECTION_LINKS: Record<SettingsTab, { id: string; label: string }[]> = {
  store: [{ id: 'store-profile', label: 'Thông tin cửa hàng' }],
  pos: [
    { id: 'pos-experience', label: 'Máy tính tiền' },
    { id: 'pos-keyboard', label: 'Phím tắt' },
  ],
  goods: [
    { id: 'goods-info', label: 'Thông tin hàng hóa' },
    { id: 'goods-stock', label: 'Giá vốn, tồn kho' },
    { id: 'goods-other', label: 'Khác' },
  ],
  customers: [{ id: 'customer-tiers', label: 'Phân hạng khách hàng' }],
  payments: [{ id: 'payment-accounts', label: 'Tài khoản thu chi' }],
  printTemplates: [
    { id: 'print-template-editor', label: 'Mẫu hóa đơn' },
    { id: 'print-template-preview', label: 'Xem trước' },
  ],
  appearance: [
    { id: 'appearance-theme', label: 'Theme giao diện' },
    { id: 'appearance-typography', label: 'Typography' },
    { id: 'appearance-colors', label: 'Màu sắc' },
    { id: 'appearance-components', label: 'Thành phần UI' },
  ],
  notifications: [
    { id: 'notification-channels', label: 'Kênh thông báo' },
    { id: 'notification-alerts', label: 'Ngưỡng cảnh báo' },
  ],
  integrations: [
    { id: 'integration-ai', label: 'Claude AI' },
    { id: 'integration-marketing', label: 'Marketing & Facebook' },
  ],
  sync: [{ id: 'sync-status', label: 'Trạng thái đồng bộ' }],
  security: [
    { id: 'security-secrets', label: 'Secrets' },
    { id: 'security-audit', label: 'Audit' },
  ],
  migration: [
    { id: 'migration-guide', label: 'Quy trình' },
    { id: 'migration-import', label: 'Import dữ liệu' },
    { id: 'migration-delete', label: 'Xóa dữ liệu test' },
  ],
  accounts: [
    { id: 'accounts-create', label: 'Tạo tài khoản' },
  ],
  activityLog: [],
};

const getPageMeta = (tab: SettingsTab) => SETTINGS_PAGES[tab] || SETTINGS_PAGES.store;

const POS_KB_STORAGE_KEY = 'pos_keyboard_shortcuts';
const CUSTOMER_TIER_STORAGE_KEY = 'customer_tier_settings';

type TierKey = 'Silver' | 'Gold' | 'Diamond';
type TierConfig = { minSpend: number; minOrders: number };
type CustomerTierMap = Record<TierKey, TierConfig>;

const DEFAULT_TIER_SETTINGS: CustomerTierMap = {
  Silver: { minSpend: 5, minOrders: 5 },
  Gold: { minSpend: 20, minOrders: 20 },
  Diamond: { minSpend: 100, minOrders: 50 },
};

const TIER_UI: {
  key: TierKey | 'Standard';
  icon: React.ElementType;
  label: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  border: string;
  isBase: boolean;
}[] = [
  {
    key: 'Standard',
    icon: User,
    label: 'Standard',
    subtitle: 'Mặc định — khách mới hoặc chưa đạt ngưỡng',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    border: 'border-slate-200',
    isBase: true,
  },
  {
    key: 'Silver',
    icon: Star,
    label: 'Silver',
    subtitle: 'Hạng Bạc',
    iconBg: 'bg-slate-200',
    iconColor: 'text-slate-600',
    border: 'border-slate-300',
    isBase: false,
  },
  {
    key: 'Gold',
    icon: Crown,
    label: 'Gold',
    subtitle: 'Hạng Vàng',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    border: 'border-yellow-200',
    isBase: false,
  },
  {
    key: 'Diamond',
    icon: Gem,
    label: 'Diamond',
    subtitle: 'Hạng Kim Cương',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'border-blue-200',
    isBase: false,
  },
];

const KEY_DISPLAY: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: '↵ Enter',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: 'Del',
  Home: 'Home',
  End: 'End',
  Tab: 'Tab',
  Shift: '⇧ Shift',
  ' ': 'Space',
};
const formatKey = (key: string, modifiers?: { shift?: boolean; ctrl?: boolean }): string => {
  const parts: string[] = [];
  if (modifiers?.ctrl) parts.push('Ctrl');
  if (modifiers?.shift) parts.push('⇧');
  parts.push(KEY_DISPLAY[key] ?? key);
  return parts.join('+');
};

const KB_ACTIONS: { value: POSKeyboardAction; label: string }[] = [
  { value: 'addTab', label: 'Thêm hóa đơn mới' },
  { value: 'toggleAutoPrint', label: 'Bật/tắt in tự động' },
  { value: 'focusSearch', label: 'Tìm hàng hóa' },
  { value: 'openConsultant', label: 'Mở tư vấn bán hàng' },
  { value: 'focusCustomer', label: 'Tìm khách hàng' },
  { value: 'checkout', label: 'Thanh toán' },
  { value: 'toggleFullscreen', label: 'Toàn màn hình' },
  { value: 'cartQtyUp', label: 'Tăng số lượng item chọn' },
  { value: 'cartQtyDown', label: 'Giảm số lượng item chọn' },
  { value: 'cartNextItem', label: 'Chọn item tiếp theo' },
  { value: 'cartPrevItem', label: 'Chọn item trước' },
  { value: 'cartSelectFirst', label: 'Chọn item đầu tiên' },
];

const SettingLine: React.FC<{
  title: string;
  description: string;
  value?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}> = ({ title, description, value, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full px-5 py-4 text-left border-b border-slate-100 last:border-b-0 flex items-center justify-between gap-4 ${onClick ? 'hover:bg-slate-50' : 'cursor-default'}`}
  >
    <span className="min-w-0">
      <span className="block text-sm font-normal text-slate-900">{title}</span>
      <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{description}</span>
    </span>
    <span className="shrink-0 text-sm font-normal text-slate-700">{children || value}</span>
  </button>
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

const RightAnchor: React.FC<{ activeTab: SettingsTab }> = ({ activeTab }) => {
  const links = SECTION_LINKS[activeTab] || [];
  if (links.length <= 1) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-6 rounded-xl bg-white border border-slate-100 shadow-sm p-3">
        {links.map((link, index) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            className={`block rounded-lg px-3 py-2 text-xs font-normal ${index === 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            {link.label}
          </a>
        ))}
      </div>
    </aside>
  );
};

const SettingsTabLoader = () => (
  <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
    Đang mở cài đặt...
  </div>
);

// Tab chỉ dành cho chủ cửa hàng (owner) — ẩn khỏi nav với role khác để tránh bấm vào rồi
// nhận 403 (backend /api/data/audit-logs cũng chặn owner-only, xem routes/data.ts).
const OWNER_ONLY_TABS = new Set<SettingsTab>(['activityLog']);
const isTabVisible = (tab: SettingsTab, role?: string) =>
  !OWNER_ONLY_TABS.has(tab) || role === 'owner';

const MobileSettingsNav: React.FC<{
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  userRole?: string;
}> = ({ activeTab, setActiveTab, userRole }) => (
  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
    {Object.entries(SETTINGS_PAGES)
      .filter(([id]) => isTabVisible(id as SettingsTab, userRole))
      .map(([id, page]) => (
      <button
        key={id}
        type="button"
        onClick={() => setActiveTab(id as SettingsTab)}
        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-normal ${
          id === activeTab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {page.label}
      </button>
    ))}
  </div>
);

const SettingsSidebar: React.FC<{
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  userRole?: string;
}> = ({ activeTab, setActiveTab, userRole }) => (
  <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
    <div className="p-4 border-b border-slate-100 shrink-0">
      <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3">
        <ServerCog className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Thiết lập</h2>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
        Cấu hình nền cho cửa hàng và vận hành.
      </p>
    </div>

    <nav className="flex-1 overflow-y-auto p-3 space-y-4">
      {SETTINGS_GROUPS.map(group => {
        const visibleItems = group.items.filter(itemId => isTabVisible(itemId, userRole));
        if (visibleItems.length === 0) return null;
        return (
        <div key={group.title}>
          <div className="px-3 pb-1 text-xs font-normal uppercase tracking-wider text-slate-400">
            {group.title}
          </div>
          <div className="space-y-1">
            {visibleItems.map(itemId => {
              const item = SETTINGS_PAGES[itemId];
              const Icon = item.icon;
              const isActive = itemId === activeTab;
              return (
                <button
                  key={itemId}
                  type="button"
                  onClick={() => setActiveTab(itemId)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-normal transition-all ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        );
      })}
    </nav>
  </aside>
);

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

const FieldRow: React.FC<{
  label: string;
  helper?: string;
  children: React.ReactNode;
}> = ({ label, helper, children }) => (
  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-3 border-b border-slate-100 last:border-b-0">
    <div className="min-w-0">
      <p className="text-sm font-normal text-slate-800">{label}</p>
      {helper && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{helper}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const StatusPill: React.FC<{
  ok: boolean | null;
  loadingLabel?: string;
  okLabel: string;
  offLabel: string;
}> = ({ ok, loadingLabel = 'Đang kiểm tra', okLabel, offLabel }) => {
  if (ok === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        {loadingLabel}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? okLabel : offLabel}
    </span>
  );
};

const SettingsCenter: React.FC<SettingsCenterProps> = ({
  onNavigate,
  activeThemeId,
  onThemeChange,
  isCloudConnected,
  isSyncing,
  syncErrors,
  lastSyncTime,
  pendingCount = 0,
  offlinePendingCount = 0,
  onRefresh,
  onImportRefresh,
  onDrainOfflineQueue,
  brandProfile,
  onUpdateBrand,
  paymentSettings,
  onUpdatePaymentSettings,
  inventorySettings,
  onUpdateInventorySettings,
  products = [],
  userRole,
}) => {
  const { showToast } = useToast();
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<SettingsTab>('store');

  const handleSetActiveTab = useCallback((tab: SettingsTab) => {
    startTransition(() => setActiveTab(tab));
  }, []);
  const [logoUploading, setLogoUploading] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState<'idle' | 'testing' | 'success' | 'error'>(
    'idle'
  );
  const [claudeMessage, setClaudeMessage] = useState('');
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [emailTo, setEmailTo] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');
  const [zaloConfigured, setZaloConfigured] = useState<boolean | null>(null);
  const [zaloFollowerId, setZaloFollowerId] = useState<string | null>(null);
  const [zaloStatus, setZaloStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [zaloMessage, setZaloMessage] = useState('');
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    defaultMinStock: 5,
    debtOverdueDays: 30,
    revenueDropPct: 50,
  });
  const [alertSaveStatus, setAlertSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [inventoryForm, setInventoryForm] = useState<POSInventorySettings>({
    ...DEFAULT_POS_INVENTORY_SETTINGS,
    ...(inventorySettings || {}),
  });
  const [inventorySaveStatus, setInventorySaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [tierSettings, setTierSettings] = useState<CustomerTierMap>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_TIER_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as CustomerTierMap;
    } catch {}
    return { ...DEFAULT_TIER_SETTINGS };
  });
  const [tierSaveStatus, setTierSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [brandSaveStatus, setBrandSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [kbShortcuts, setKbShortcuts] = useState<POSKeyboardShortcut[]>(() => {
    try {
      const saved = localStorage.getItem(POS_KB_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as POSKeyboardShortcut[];
        const merged = DEFAULT_POS_KEYBOARD_SHORTCUTS.map(def => {
          const user = parsed.find(u => u.id === def.id);
          return user
            ? { ...def, key: user.key, modifiers: user.modifiers, enabled: user.enabled }
            : def;
        });
        const custom = parsed.filter(u => !u.isDefault);
        return [...merged, ...custom];
      }
    } catch {}
    return [...DEFAULT_POS_KEYBOARD_SHORTCUTS];
  });
  const [kbRecordingId, setKbRecordingId] = useState<string | null>(null);
  const [kbAddingNew, setKbAddingNew] = useState(false);
  const [kbNewAction, setKbNewAction] = useState<POSKeyboardAction>('focusSearch');
  const [kbNewKey, setKbNewKey] = useState('');
  const [kbNewModifiers, setKbNewModifiers] = useState<{ shift?: boolean; ctrl?: boolean }>({});
  const [kbNewRecording, setKbNewRecording] = useState(false);

  const errorCount = syncErrors?.length ?? 0;
  const activeTabMeta = useMemo(() => getPageMeta(activeTab), [activeTab]);
  const normalizedPaymentSettings = useMemo(
    () => normalizePOSPaymentSettings(paymentSettings),
    [paymentSettings]
  );

  useEffect(() => {
    setInventoryForm({
      ...DEFAULT_POS_INVENTORY_SETTINGS,
      ...(inventorySettings || {}),
    });
  }, [inventorySettings]);

  const saveKbShortcuts = (shortcuts: POSKeyboardShortcut[]) => {
    localStorage.setItem(POS_KB_STORAGE_KEY, JSON.stringify(shortcuts));
    window.dispatchEvent(new Event('pos_keyboard_settings_changed'));
    setKbShortcuts(shortcuts);
  };

  const addCustomShortcut = () => {
    if (!kbNewKey) return;
    const label = KB_ACTIONS.find(a => a.value === kbNewAction)?.label ?? kbNewAction;
    const mods = kbNewModifiers.shift || kbNewModifiers.ctrl ? kbNewModifiers : undefined;
    saveKbShortcuts([
      ...kbShortcuts,
      {
        id: crypto.randomUUID(),
        key: kbNewKey,
        modifiers: mods,
        label,
        action: kbNewAction,
        enabled: true,
        isDefault: false,
      },
    ]);
    setKbAddingNew(false);
    setKbNewKey('');
    setKbNewModifiers({});
  };

  useEffect(() => {
    if (kbRecordingId === null && !kbNewRecording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setKbRecordingId(null);
        setKbNewRecording(false);
        return;
      }
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      const mods: { shift?: boolean; ctrl?: boolean } = {};
      if (e.shiftKey) mods.shift = true;
      if (e.ctrlKey) mods.ctrl = true;
      if (kbRecordingId !== null) {
        saveKbShortcuts(
          kbShortcuts.map(s =>
            s.id === kbRecordingId
              ? { ...s, key: e.key, modifiers: Object.keys(mods).length ? mods : undefined }
              : s
          )
        );
        setKbRecordingId(null);
      } else {
        setKbNewKey(e.key);
        setKbNewModifiers(mods);
        setKbNewRecording(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [kbRecordingId, kbNewRecording, kbShortcuts]);

  // Removed eager preloading - tabs now load on-demand when user clicks them
  // This eliminates unnecessary computation for tabs user may never visit
  // Performance improvement: ~150-200ms faster initial load

  // Lazy load notification status - only fetch when user visits notifications tab
  useEffect(() => {
    if (activeTab !== 'notifications') return;

    fetch('/api/notifications/status')
      .then(r => r.json())
      .then(d => {
        setEmailConfigured(d.emailConfigured);
        setEmailTo(d.emailTo);
        setZaloConfigured(d.zaloConfigured);
        setZaloFollowerId(d.zaloFollowerId);
      })
      .catch(() => {
        setEmailConfigured(false);
        setZaloConfigured(false);
      });
  }, [activeTab]);

  // Lazy load alert config - only fetch when user visits notifications tab
  useEffect(() => {
    if (activeTab !== 'notifications') return;

    fetch('/api/alerts/config')
      .then(r => r.json())
      .then(d => setAlertConfig(d))
      .catch(() => {});
  }, [activeTab]);

  const handleNavigateAndClose = useCallback(
    (id: string) => {
      onNavigate(id);
    },
    [onNavigate]
  );

  const handleGoodsSetActiveTab = useCallback(
    (tab: string) => handleSetActiveTab(tab as SettingsTab),
    [handleSetActiveTab]
  );

  const navigateAndClose = handleNavigateAndClose;

  const processAndUploadLogo = async (file: File) => {
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 800;
        if (width > height) {
          if (width > max) {
            height *= max / width;
            width = max;
          }
        } else if (height > max) {
          width *= max / height;
          height = max;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          async blob => {
            if (!blob) {
              setLogoUploading(false);
              return;
            }
            const publicUrl = await uploadImage(
              'brand-assets',
              'images',
              `logo_${Date.now()}_${file.name}`,
              blob
            );
            if (publicUrl) onUpdateBrand({ ...brandProfile, logo: publicUrl });
            else showToast('Lỗi tải ảnh lên Cloud!', 'error');
            setLogoUploading(false);
          },
          'image/jpeg',
          0.7
        );
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => setLogoUploading(false);
    reader.readAsDataURL(file);
  };

  const saveAlertConfig = async () => {
    setAlertSaveStatus('saving');
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertConfig),
      });
      const data = await res.json();
      setAlertSaveStatus(data.ok ? 'saved' : 'error');
      setTimeout(() => setAlertSaveStatus('idle'), 2000);
    } catch {
      setAlertSaveStatus('error');
      setTimeout(() => setAlertSaveStatus('idle'), 2000);
    }
  };

  const testClaude = async () => {
    setClaudeStatus('testing');
    setClaudeMessage('');
    try {
      const res = await fetch('/api/ai/test-connection');
      const data = await res.json();
      if (data.ok) {
        setClaudeStatus('success');
        setClaudeMessage(data.message || 'Kết nối thành công.');
      } else {
        setClaudeStatus('error');
        setClaudeMessage(data.error || 'Claude API không phản hồi.');
      }
    } catch {
      setClaudeStatus('error');
      setClaudeMessage('Không thể kết nối với server. Đảm bảo server đang chạy.');
    }
  };

  const sendTestEmail = async () => {
    setEmailStatus('sending');
    setEmailMessage('');
    try {
      const res = await fetch('/api/notifications/test-email', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setEmailStatus('success');
        setEmailMessage(data.message);
      } else {
        setEmailStatus('error');
        setEmailMessage(data.error);
      }
    } catch {
      setEmailStatus('error');
      setEmailMessage('Không thể gửi email. Kiểm tra lại cấu hình.');
    }
  };

  const sendTestZalo = async () => {
    setZaloStatus('sending');
    setZaloMessage('');
    try {
      const res = await fetch('/api/notifications/test-zalo', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setZaloStatus('success');
        setZaloMessage(data.message);
      } else {
        setZaloStatus('error');
        setZaloMessage(data.error);
      }
    } catch {
      setZaloStatus('error');
      setZaloMessage('Không thể gửi Zalo. Kiểm tra lại cấu hình.');
    }
  };

  const saveInventorySettings = async (settings: POSInventorySettings = inventoryForm) => {
    setInventorySaveStatus('saving');
    try {
      await onUpdateInventorySettings(settings);
      setInventorySaveStatus('saved');
      setTimeout(() => setInventorySaveStatus('idle'), 2000);
    } catch {
      setInventorySaveStatus('error');
      setTimeout(() => setInventorySaveStatus('idle'), 2500);
    }
  };

  const toggleAllowSellOutOfStock = () => {
    const nextSettings = {
      ...inventoryForm,
      allowSellOutOfStock: !inventoryForm.allowSellOutOfStock,
    };
    setInventoryForm(nextSettings);
    void saveInventorySettings(nextSettings);
  };

  const toggleShowSalesAdvisor = () => {
    const nextSettings = {
      ...inventoryForm,
      showSalesAdvisor: !(inventoryForm.showSalesAdvisor ?? true),
    };
    setInventoryForm(nextSettings);
    void saveInventorySettings(nextSettings);
  };

  const handleSaveBrand = async () => {
    setBrandSaveStatus('saving');
    try {
      await apiService.upsertItem('brandProfile', brandProfile);
      setBrandSaveStatus('saved');
      showToast('Đã lưu hồ sơ cửa hàng', 'success');
      setTimeout(() => setBrandSaveStatus('idle'), 2000);
    } catch (e) {
      setBrandSaveStatus('error');
      showToast('Lỗi lưu hồ sơ cửa hàng', 'error');
      setTimeout(() => setBrandSaveStatus('idle'), 3000);
    }
  };

  const renderStoreTab = () => (
    <div className="space-y-4">
      <Section
        id="store-profile"
        title="Hồ sơ cửa hàng"
        description="Thông tin này đang dùng cho logo, nội dung Marketing AI và thông tin liên hệ."
        icon={Fingerprint}
      >
        <input
          type="file"
          ref={logoUploadRef}
          className="hidden"
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) processAndUploadLogo(file);
          }}
        />
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <p className="mb-3 text-xs font-normal uppercase tracking-wider text-slate-500">
              Logo cửa hàng
            </p>
            <button
              type="button"
              onClick={() => logoUploadRef.current?.click()}
              className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-indigo-300"
            >
              {logoUploading && (
                <span className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </span>
              )}
              {brandProfile.logo ? (
                <img
                  src={brandProfile.logo}
                  alt="Logo cửa hàng"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UploadCloud className="h-8 w-8 text-slate-300" />
              )}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Tên cửa hàng</span>
              <input
                value={brandProfile.name || ''}
                onChange={e => onUpdateBrand({ ...brandProfile, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
                placeholder="Tên cửa hàng"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Số điện thoại</span>
              <input
                value={brandProfile.phone || ''}
                onChange={e => onUpdateBrand({ ...brandProfile, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
                placeholder="Số điện thoại"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-500">Địa chỉ</span>
              <input
                value={brandProfile.address || ''}
                onChange={e => onUpdateBrand({ ...brandProfile, address: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
                placeholder="Địa chỉ cửa hàng"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-500">Hashtag</span>
              <input
                value={brandProfile.hashtags || ''}
                onChange={e => onUpdateBrand({ ...brandProfile, hashtags: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
                placeholder="#Hashtag"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-normal text-slate-800">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Giọng văn thương hiệu
            </span>
            <textarea
              value={brandProfile.voice}
              onChange={e => onUpdateBrand({ ...brandProfile, voice: e.target.value })}
              className="min-h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
              placeholder="Thân thiện, bình dân, chân thành..."
            />
          </label>
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-normal text-slate-800">
              <Users className="h-4 w-4 text-emerald-500" />
              Khách hàng mục tiêu
            </span>
            <textarea
              value={brandProfile.targetAudience}
              onChange={e => onUpdateBrand({ ...brandProfile, targetAudience: e.target.value })}
              className="min-h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
              placeholder="Nội trợ, học sinh, công nhân..."
            />
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="flex items-center gap-2 text-sm font-normal text-slate-800">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Câu chuyện thương hiệu
            </span>
            <textarea
              value={brandProfile.story}
              onChange={e => onUpdateBrand({ ...brandProfile, story: e.target.value })}
              className="min-h-32 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
              placeholder="Lý do cửa hàng ra đời và giá trị mang lại cho khách hàng."
            />
          </label>
        </div>
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSaveBrand}
            disabled={brandSaveStatus === 'saving'}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {brandSaveStatus === 'saving' ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
            ) : brandSaveStatus === 'saved' ? (
              <><Check className="h-4 w-4" /> Đã lưu</>
            ) : (
              <><Save className="h-4 w-4" /> Lưu hồ sơ cửa hàng</>
            )}
          </button>
        </div>
      </Section>
    </div>
  );

  const renderPosTab = () => (
    <div className="space-y-4">
      <Section
        id="pos-experience"
        title="Máy tính tiền"
        description="Các tùy chọn trải nghiệm POS sẽ được nối dần khi cần."
        icon={ShoppingCart}
      >
        <SettingLine
          title="Tư vấn bán hàng"
          description="Box tư vấn sản phẩm trong POS đang dùng cấu hình hàng hóa hiện tại."
          onClick={toggleShowSalesAdvisor}
        >
          <TogglePill enabled={inventoryForm.showSalesAdvisor ?? true} />
        </SettingLine>
      </Section>

      <Section
        id="pos-keyboard"
        title="Phím tắt"
        description="Bật/tắt hoặc gán lại phím cho từng hành động trong POS. Nhấn vào badge phím để ghi lại phím mới."
        icon={KeyRound}
      >
        <div className="space-y-0.5">
          {kbShortcuts.map(sc => (
            <div
              key={sc.id}
              className="flex items-center gap-3 px-1 py-2.5 border-b border-slate-50 last:border-b-0 group"
            >
              <button
                type="button"
                onClick={() =>
                  saveKbShortcuts(
                    kbShortcuts.map(s => (s.id === sc.id ? { ...s, enabled: !s.enabled } : s))
                  )
                }
              >
                <TogglePill enabled={sc.enabled} />
              </button>
              <span
                className={`flex-1 text-sm font-normal ${sc.enabled ? 'text-slate-800' : 'text-slate-400'}`}
              >
                {sc.label}
              </span>
              <button
                type="button"
                title="Nhấn để gán lại phím"
                onClick={() => setKbRecordingId(sc.id)}
                className={`px-3 py-1 rounded-lg text-xs border transition-all min-w-[90px] text-center ${
                  kbRecordingId === sc.id
                    ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {kbRecordingId === sc.id ? 'Đang chờ...' : formatKey(sc.key, sc.modifiers)}
              </button>
              {!sc.isDefault ? (
                <button
                  type="button"
                  onClick={() => saveKbShortcuts(kbShortcuts.filter(s => s.id !== sc.id))}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <div className="w-4 h-4 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {kbAddingNew && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Thêm phím tắt mới
            </p>
            <div className="flex items-center gap-3">
              <select
                value={kbNewAction}
                onChange={e => setKbNewAction(e.target.value as POSKeyboardAction)}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-indigo-400"
              >
                {KB_ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setKbNewRecording(true)}
                className={`px-4 py-2 rounded-lg text-xs border transition-all min-w-[130px] text-center ${
                  kbNewRecording
                    ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse'
                    : kbNewKey
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-slate-600'
                }`}
              >
                {kbNewRecording
                  ? 'Đang chờ phím...'
                  : kbNewKey
                    ? formatKey(kbNewKey, kbNewModifiers)
                    : 'Nhấn phím...'}
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setKbAddingNew(false);
                  setKbNewKey('');
                  setKbNewModifiers({});
                }}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={addCustomShortcut}
                disabled={!kbNewKey}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg disabled:opacity-40 hover:bg-indigo-700"
              >
                Thêm
              </button>
            </div>
          </div>
        )}

        {!kbAddingNew && (
          <button
            type="button"
            onClick={() => setKbAddingNew(true)}
            className="mt-4 flex items-center gap-2 text-sm font-normal text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Thêm phím tắt
          </button>
        )}
      </Section>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-4">
      <Section
        id="notification-channels"
        title="Kênh thông báo"
        description="Kiểm tra trạng thái email và Zalo OA cho báo cáo/cảnh báo."
        icon={Bell}
      >
        <FieldRow
          label="Email báo cáo 21:00"
          helper={emailTo ? `Gửi đến: ${emailTo}` : 'Cấu hình qua .env.local trên server.'}
        >
          <div className="flex items-center gap-2">
            <StatusPill ok={emailConfigured} okLabel="Đã cấu hình" offLabel="Chưa cấu hình" />
            {emailConfigured && (
              <button
                type="button"
                onClick={sendTestEmail}
                disabled={emailStatus === 'sending'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-xs text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                {emailStatus === 'sending' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Gửi thử
              </button>
            )}
          </div>
        </FieldRow>
        {emailMessage && (
          <p
            className={`mt-3 rounded-lg border p-2 text-xs ${emailStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}
          >
            {emailMessage}
          </p>
        )}
        <FieldRow
          label="Zalo OA"
          helper={
            zaloFollowerId
              ? `Follower: ${zaloFollowerId}`
              : 'Cấu hình access token và follower ID qua .env.local.'
          }
        >
          <div className="flex items-center gap-2">
            <StatusPill ok={zaloConfigured} okLabel="Đã cấu hình" offLabel="Chưa cấu hình" />
            {zaloConfigured && (
              <button
                type="button"
                onClick={sendTestZalo}
                disabled={zaloStatus === 'sending'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 bg-white text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-50"
              >
                {zaloStatus === 'sending' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Gửi thử
              </button>
            )}
          </div>
        </FieldRow>
        {zaloMessage && (
          <p
            className={`mt-3 rounded-lg border p-2 text-xs ${zaloStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}
          >
            {zaloMessage}
          </p>
        )}
      </Section>

      <Section
        id="notification-alerts"
        title="Ngưỡng cảnh báo"
        description="Các ngưỡng đang được alert agent dùng khi kiểm tra dữ liệu."
        icon={AlertTriangle}
      >
        <div className="space-y-1">
          <FieldRow
            label="Tồn kho tối thiểu mặc định"
            helper="Áp dụng cho sản phẩm chưa có ngưỡng riêng."
          >
            <input
              type="number"
              min={1}
              max={100}
              value={alertConfig.defaultMinStock}
              onChange={e =>
                setAlertConfig(c => ({ ...c, defaultMinStock: Number(e.target.value) }))
              }
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-normal outline-none focus:border-amber-400"
            />
          </FieldRow>
          <FieldRow
            label="Công nợ NCC quá hạn sau"
            helper="Cảnh báo nếu còn nợ và không có hoạt động trong X ngày."
          >
            <input
              type="number"
              min={7}
              max={365}
              value={alertConfig.debtOverdueDays}
              onChange={e =>
                setAlertConfig(c => ({ ...c, debtOverdueDays: Number(e.target.value) }))
              }
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-normal outline-none focus:border-amber-400"
            />
          </FieldRow>
          <FieldRow label="Doanh thu giảm dưới" helper="So với trung bình 6 ngày trước.">
            <input
              type="number"
              min={10}
              max={90}
              value={alertConfig.revenueDropPct}
              onChange={e =>
                setAlertConfig(c => ({ ...c, revenueDropPct: Number(e.target.value) }))
              }
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-normal outline-none focus:border-amber-400"
            />
          </FieldRow>
        </div>
        <button
          type="button"
          onClick={saveAlertConfig}
          disabled={alertSaveStatus === 'saving'}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-normal text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {alertSaveStatus === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {alertSaveStatus === 'saved'
            ? 'Đã lưu'
            : alertSaveStatus === 'error'
              ? 'Lỗi lưu'
              : 'Lưu ngưỡng'}
        </button>
      </Section>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="space-y-4">
      <Section
        id="integration-ai"
        title="Claude AI"
        description="API key chỉ nằm trên server, không lưu trong browser."
        icon={BrainCircuit}
      >
        <FieldRow
          label="Trạng thái kết nối"
          helper="Dùng cho CFO chat, phân tích và nội dung marketing."
        >
          <button
            type="button"
            onClick={testClaude}
            disabled={claudeStatus === 'testing'}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-normal text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {claudeStatus === 'testing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrainCircuit className="h-4 w-4" />
            )}
            Kiểm tra Claude
          </button>
        </FieldRow>
        {claudeMessage && (
          <p
            className={`mt-3 rounded-lg border p-2 text-xs ${claudeStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}
          >
            {claudeMessage}
          </p>
        )}
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            Secrets như Anthropic, Email, Zalo và Supabase service role vẫn cấu hình qua .env.local
            trên backend.
          </p>
        </div>
      </Section>

      <Section
        id="integration-marketing"
        title="Marketing & Facebook"
        description="Các kết nối fanpage hiện nằm trong module Nội dung Fanpage."
        icon={Mail}
      >
        <button
          type="button"
          onClick={() => navigateAndClose('marketing')}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-normal text-slate-700 hover:bg-slate-50"
        >
          Mở Nội dung Fanpage
        </button>
      </Section>
    </div>
  );

  const renderSyncTab = () => (
    <div className="space-y-4">
      <Section
        id="sync-status"
        title="Trạng thái đồng bộ"
        description="Theo dõi cloud sync, hàng đợi local và lỗi gần nhất."
        icon={Database}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            {isCloudConnected ? (
              <Cloud className="h-5 w-5 text-emerald-600 mb-3" />
            ) : (
              <CloudOff className="h-5 w-5 text-rose-600 mb-3" />
            )}
            <p className="text-sm text-slate-900">{isCloudConnected ? 'Online' : 'Offline'}</p>
            <p className="text-xs text-slate-500 mt-1">Kết nối Supabase/cloud.</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <RefreshCw
              className={`h-5 w-5 text-indigo-600 mb-3 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <p className="text-sm text-slate-900">{isSyncing ? 'Đang đồng bộ' : 'Sẵn sàng'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {lastSyncTime
                ? new Date(lastSyncTime).toLocaleString('vi-VN')
                : 'Chưa có thời gian sync.'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <WifiOff className="h-5 w-5 text-amber-600 mb-3" />
            <p className="text-sm text-slate-900">{offlinePendingCount} chờ đồng bộ</p>
            <p className="text-xs text-slate-500 mt-1">{pendingCount} thay đổi chờ sync.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Đồng bộ lại
          </button>
          {offlinePendingCount > 0 && (
            <button
              type="button"
              onClick={() => onDrainOfflineQueue?.()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-normal text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Đẩy thao tác chờ đồng bộ
            </button>
          )}
        </div>

        {errorCount > 0 && (
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-sm text-rose-700 mb-2">Có {errorCount} lỗi đồng bộ</p>
            <div className="space-y-2">
              {(syncErrors || []).slice(0, 5).map((error, index) => (
                <p key={`${error}-${index}`} className="text-xs text-rose-700 leading-relaxed">
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-4">
      <Section
        id="security-secrets"
        title="Secrets"
        description="Trạng thái cấu hình khóa và dịch vụ nhạy cảm."
        icon={KeyRound}
      >
        <SettingLine
          title="API keys"
          description="Claude, Supabase service role, Email và Zalo vẫn được cấu hình qua .env.local ở server."
          value="Không lưu browser"
        />
        <SettingLine
          title="Quyền truy cập API ghi dữ liệu"
          description="Các endpoint ghi dữ liệu đang đi qua backend và requireAuth."
          value="Đã bật"
        />
      </Section>

      <Section
        id="security-audit"
        title="Audit"
        description="Theo dõi thay đổi dữ liệu quan trọng và lịch sử thao tác."
        icon={History}
      >
        <SettingLine
          title="Audit log"
          description="Các bảng tài chính, lương, tồn kho và nhà cung cấp đã ghi audit ở backend."
          value="Đang ghi"
        />
      </Section>
    </div>
  );

  const saveTierSettings = () => {
    localStorage.setItem(CUSTOMER_TIER_STORAGE_KEY, JSON.stringify(tierSettings));
    setTierSaveStatus('saved');
    setTimeout(() => setTierSaveStatus('idle'), 2000);
  };

  const renderCustomersTab = () => (
    <div className="space-y-4">
      <Section
        id="customer-tiers"
        title="Phân hạng khách hàng"
        description="Ngưỡng tối thiểu để khách được xếp vào từng nhóm. Thỏa một trong hai điều kiện là đủ điều kiện lên hạng. Việc gán thủ công trong form khách hàng vẫn được ưu tiên."
        icon={Users}
      >
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Hệ thống tự động nâng hạng sau mỗi đơn hàng dựa trên tổng chi tiêu tích lũy. Chỉ nâng hạng, không tự động hạ. Gán thủ công trong form khách hàng vẫn được ưu tiên.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {TIER_UI.map(tier => {
            const TierIcon = tier.icon;
            const cfg = tier.isBase ? null : tierSettings[tier.key as TierKey];
            return (
              <div
                key={tier.key}
                className={`rounded-xl border-2 ${tier.border} bg-white p-4 space-y-4`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${tier.iconBg} ${tier.iconColor} flex items-center justify-center shrink-0`}>
                    <TierIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{tier.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{tier.subtitle}</p>
                  </div>
                </div>

                {tier.isBase ? (
                  <p className="text-xs text-slate-400 italic">
                    Không có ngưỡng — áp dụng mặc định cho tất cả khách mới.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-normal uppercase tracking-wider text-slate-400">
                      Thỏa 1 trong 2 điều kiện
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600">Tổng chi tiêu tối thiểu</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={cfg!.minSpend}
                          onChange={e =>
                            setTierSettings(prev => ({
                              ...prev,
                              [tier.key]: { ...prev[tier.key as TierKey], minSpend: Number(e.target.value) },
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right font-normal outline-none focus:border-indigo-300"
                        />
                        <span className="text-xs text-slate-500 shrink-0">triệu đ</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600">Số đơn hàng tối thiểu</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={cfg!.minOrders}
                          onChange={e =>
                            setTierSettings(prev => ({
                              ...prev,
                              [tier.key]: { ...prev[tier.key as TierKey], minOrders: Number(e.target.value) },
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right font-normal outline-none focus:border-indigo-300"
                        />
                        <span className="text-xs text-slate-500 shrink-0">đơn</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={saveTierSettings}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white hover:bg-indigo-700"
          >
            <Save className="h-4 w-4" />
            {tierSaveStatus === 'saved' ? 'Đã lưu!' : 'Lưu cài đặt'}
          </button>
          {tierSaveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đã lưu vào thiết bị này
            </span>
          )}
        </div>
      </Section>
    </div>
  );

  // Inline-only tabs (cheap to remount)
  const renderInlineTab = () => {
    if (activeTab === 'store') return renderStoreTab();
    if (activeTab === 'pos') return renderPosTab();
    if (activeTab === 'customers') return renderCustomersTab();
    if (activeTab === 'notifications') return renderNotificationsTab();
    if (activeTab === 'integrations') return renderIntegrationsTab();
    if (activeTab === 'security') return renderSecurityTab();
    if (activeTab === 'sync') return renderSyncTab();
    return null;
  };

  const isComponentTab = (tab: SettingsTab) =>
    tab === 'goods' ||
    tab === 'payments' ||
    tab === 'printTemplates' ||
    tab === 'appearance' ||
    tab === 'migration' ||
    tab === 'accounts' ||
    tab === 'activityLog';

  const ActiveIcon = activeTabMeta.icon;

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-4 md:px-8 bg-slate-50">
      <div className="flex flex-1 min-h-0 gap-4">
        <SettingsSidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} userRole={userRole} />

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <header className="shrink-0 border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <ActiveIcon className="h-4 w-4" />
              <span className="text-xs font-normal uppercase tracking-widest">Cài đặt</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{activeTabMeta.label}</h2>
            <p className="text-sm text-slate-500 mt-1">{activeTabMeta.description}</p>

            <MobileSettingsNav activeTab={activeTab} setActiveTab={handleSetActiveTab} userRole={userRole} />
          </header>

          <main
            className={`min-h-0 flex-1 overflow-y-auto p-4 md:p-6 transition-opacity duration-150 ${isPending ? 'opacity-50' : ''}`}
          >
            <div className="flex gap-5">
              <div className="min-w-0 flex-1 space-y-4">
                {!isComponentTab(activeTab) && renderInlineTab()}

                <Suspense fallback={<SettingsTabLoader />}>
                  {activeTab === 'goods' && (
                    <GoodsTab
                      products={products}
                      alertConfig={alertConfig}
                      inventorySettings={inventorySettings || DEFAULT_POS_INVENTORY_SETTINGS}
                      onUpdateInventorySettings={onUpdateInventorySettings}
                      onNavigate={handleNavigateAndClose}
                      onSetActiveTab={handleGoodsSetActiveTab}
                      onRefresh={onRefresh}
                    />
                  )}
                  {activeTab === 'payments' && (
                    <PaymentsTab
                      settings={normalizedPaymentSettings}
                      onSave={onUpdatePaymentSettings}
                    />
                  )}
                  {activeTab === 'printTemplates' && (
                    <PrintTemplatesTab brandProfile={brandProfile} />
                  )}
                  {activeTab === 'appearance' && (
                    <AppearanceTab activeThemeId={activeThemeId} onThemeChange={onThemeChange} />
                  )}
                  {activeTab === 'migration' && (
                    <MigrationTab onRefresh={onImportRefresh ?? onRefresh} />
                  )}
                  {activeTab === 'accounts' && <AccountsTab />}
                  {activeTab === 'activityLog' && userRole === 'owner' && <ActivityLogTab />}
                </Suspense>
              </div>
              {activeTab !== 'printTemplates' && <RightAnchor activeTab={activeTab} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsCenter;
