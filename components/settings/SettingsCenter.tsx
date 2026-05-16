import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bold,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  Pencil,
  Plus,
  Package,
  Printer,
  RefreshCw,
  Save,
  Send,
  ServerCog,
  ShieldCheck,
  ShoppingCart,
  SortAsc,
  Sparkles,
  Store,
  Trash2,
  Upload,
  UploadCloud,
  Users,
  WifiOff,
  X,
  XCircle,
  CornerDownLeft,
} from 'lucide-react';
import PaymentsTab from './tabs/PaymentsTab';
import AppearanceTab from './tabs/AppearanceTab';
import GoodsTab from './tabs/GoodsTab';
import PrintTemplatesTab from './tabs/PrintTemplatesTab';
import DOMPurify from 'dompurify';
import { AppThemeId } from '../../constants/themes';
import {
  DEFAULT_POS_INVENTORY_SETTINGS,
  normalizePOSPaymentSettings,
} from '../../constants/defaultData';
import { uploadImage } from '../../services/marketingStorageService';
import { INVENTORY_COST_METHOD_STORAGE_KEY, InventoryCostMethod } from '../../src/lib';
import type {
  AlertConfig,
  BrandProfile,
  POSInventorySettings,
  POSPaymentSettings,
  POSProduct,
} from '../../types';

type SettingsTab =
  | 'store'
  | 'pos'
  | 'goods'
  | 'payments'
  | 'printTemplates'
  | 'appearance'
  | 'notifications'
  | 'integrations'
  | 'sync'
  | 'security';

interface SettingsCenterProps {
  isOpen: boolean;
  onClose: () => void;
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
  onDrainOfflineQueue?: () => Promise<{ synced: number; failed: number }>;
  brandProfile: BrandProfile;
  onUpdateBrand: (profile: BrandProfile) => void;
  paymentSettings?: POSPaymentSettings;
  onUpdatePaymentSettings: (settings: POSPaymentSettings) => Promise<void>;
  inventorySettings?: POSInventorySettings;
  onUpdateInventorySettings: (settings: POSInventorySettings) => Promise<void>;
  products?: POSProduct[];
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
};

const SETTINGS_GROUPS: { title: string; items: SettingsTab[] }[] = [
  { title: 'Cửa hàng', items: ['store', 'appearance'] },
  { title: 'Bán hàng', items: ['pos', 'payments', 'printTemplates'] },
  { title: 'Quản lý', items: ['goods'] },
  { title: 'Tiện ích', items: ['notifications', 'integrations'] },
  { title: 'Dữ liệu', items: ['sync', 'security'] },
];

const SECTION_LINKS: Record<SettingsTab, { id: string; label: string }[]> = {
  store: [{ id: 'store-profile', label: 'Thông tin cửa hàng' }],
  pos: [{ id: 'pos-experience', label: 'Máy tính tiền' }],
  goods: [
    { id: 'goods-info', label: 'Thông tin hàng hóa' },
    { id: 'goods-stock', label: 'Giá vốn, tồn kho' },
    { id: 'goods-other', label: 'Khác' },
  ],
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
};

const getPageMeta = (tab: SettingsTab) => SETTINGS_PAGES[tab] || SETTINGS_PAGES.store;

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
    className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
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

const MobileSettingsNav: React.FC<{
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}> = ({ activeTab, setActiveTab }) => (
  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
    {Object.entries(SETTINGS_PAGES).map(([id, page]) => (
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
}> = ({ activeTab, setActiveTab }) => (
  <aside className="hidden w-72 shrink-0 border-r border-slate-100 bg-white p-4 lg:block">
    <div className="px-2 pb-4">
      <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3">
        <ServerCog className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Thiết lập</h2>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
        Cấu hình nền cho cửa hàng và vận hành.
      </p>
    </div>

    <nav className="space-y-4">
      {SETTINGS_GROUPS.map(group => (
        <div key={group.title}>
          <div className="px-3 pb-1 text-[11px] font-normal uppercase tracking-wider text-slate-400">
            {group.title}
          </div>
          <div className="space-y-1">
            {group.items.map(itemId => {
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
      ))}
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
  isOpen,
  onClose,
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
  onDrainOfflineQueue,
  brandProfile,
  onUpdateBrand,
  paymentSettings,
  onUpdatePaymentSettings,
  inventorySettings,
  onUpdateInventorySettings,
  products = [],
}) => {
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<SettingsTab>('store');
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTab>>(() => new Set(['store']));

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
  const [costMethod, setCostMethod] = useState<InventoryCostMethod>(() => {
    try {
      const saved = localStorage.getItem(INVENTORY_COST_METHOD_STORAGE_KEY);
      return saved === 'fixed' || saved === 'average' ? saved : 'fixed';
    } catch {
      return 'fixed';
    }
  });

  const errorCount = syncErrors?.length ?? 0;
  const activeTabMeta = useMemo(() => getPageMeta(activeTab), [activeTab]);
  const normalizedPaymentSettings = useMemo(
    () => normalizePOSPaymentSettings(paymentSettings),
    [paymentSettings]
  );

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  useEffect(() => {
    setInventoryForm({
      ...DEFAULT_POS_INVENTORY_SETTINGS,
      ...(inventorySettings || {}),
    });
  }, [inventorySettings]);

  // Preload heavy tabs after modal is open — printTemplates loads on-click only
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      startTransition(() => {
        setVisitedTabs(prev => {
          const next = new Set(prev);
          next.add('goods');
          next.add('payments');
          next.add('appearance');
          return next;
        });
      });
    }, 300);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

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

    fetch('/api/alerts/config')
      .then(r => r.json())
      .then(d => setAlertConfig(d))
      .catch(() => {});
  }, [isOpen]);

  const handleNavigateAndClose = useCallback(
    (id: string) => {
      onNavigate(id);
      onClose();
    },
    [onNavigate, onClose]
  );

  const handleGoodsSetActiveTab = useCallback(
    (tab: string) => handleSetActiveTab(tab as SettingsTab),
    [handleSetActiveTab]
  );

  if (!isOpen) return null;

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
            else window.alert('Lỗi tải ảnh lên Cloud!');
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
              placeholder="Lý do Phúc Sang ra đời và giá trị mang lại cho khách hàng."
            />
          </label>
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
          value="Đang bật"
        />
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
            <p className="text-sm text-slate-900">{offlinePendingCount} offline</p>
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
              Đẩy đơn offline
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

  // Inline-only tabs (cheap to remount)
  const renderInlineTab = () => {
    if (activeTab === 'store') return renderStoreTab();
    if (activeTab === 'pos') return renderPosTab();
    if (activeTab === 'notifications') return renderNotificationsTab();
    if (activeTab === 'integrations') return renderIntegrationsTab();
    if (activeTab === 'security') return renderSecurityTab();
    if (activeTab === 'sync') return renderSyncTab();
    return null;
  };

  const isComponentTab = (tab: SettingsTab) =>
    tab === 'goods' || tab === 'payments' || tab === 'printTemplates' || tab === 'appearance';

  const ActiveIcon = activeTabMeta.icon;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/45 p-3 backdrop-blur-sm md:p-6">
      <div className="mx-auto flex h-full max-h-[900px] w-full max-w-[1500px] overflow-hidden rounded-xl bg-slate-100 shadow-2xl">
        <SettingsSidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-slate-100 bg-white px-4 py-4 md:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <ActiveIcon className="h-4 w-4" />
                  <span className="text-xs font-normal uppercase tracking-widest">Cài đặt</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{activeTabMeta.label}</h2>
                <p className="text-sm text-slate-500 mt-1">{activeTabMeta.description}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <MobileSettingsNav activeTab={activeTab} setActiveTab={handleSetActiveTab} />
          </header>

          <main
            className={`min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6 transition-opacity duration-150 ${isPending ? 'opacity-50' : ''}`}
          >
            <div className="flex gap-5">
              <div className="min-w-0 flex-1 space-y-4">
                {/* Inline tabs — conditionally rendered (cheap) */}
                {!isComponentTab(activeTab) && renderInlineTab()}

                {/* Component tabs — kept mounted after first visit to avoid expensive remount */}
                {visitedTabs.has('goods') && (
                  <div style={{ display: activeTab === 'goods' ? undefined : 'none' }}>
                    <GoodsTab
                      products={products}
                      alertConfig={alertConfig}
                      inventorySettings={inventorySettings || DEFAULT_POS_INVENTORY_SETTINGS}
                      onUpdateInventorySettings={onUpdateInventorySettings}
                      onNavigate={handleNavigateAndClose}
                      onSetActiveTab={handleGoodsSetActiveTab}
                    />
                  </div>
                )}
                {visitedTabs.has('payments') && (
                  <div style={{ display: activeTab === 'payments' ? undefined : 'none' }}>
                    <PaymentsTab
                      settings={normalizedPaymentSettings}
                      onSave={onUpdatePaymentSettings}
                    />
                  </div>
                )}
                {visitedTabs.has('printTemplates') && (
                  <div style={{ display: activeTab === 'printTemplates' ? undefined : 'none' }}>
                    <PrintTemplatesTab brandProfile={brandProfile} />
                  </div>
                )}
                {visitedTabs.has('appearance') && (
                  <div style={{ display: activeTab === 'appearance' ? undefined : 'none' }}>
                    <AppearanceTab activeThemeId={activeThemeId} onThemeChange={onThemeChange} />
                  </div>
                )}
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
