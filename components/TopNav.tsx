import React, { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Bell,
  Settings,
  HelpCircle,
  UserCircle,
  CheckCircle2,
  PackageX,
  AlertTriangle,
  TrendingDown,
  WifiOff,
  Upload,
  ShoppingCart,
  ChevronDown,
  Palette,
  LogOut,
} from 'lucide-react';
import type { AppThemeId } from '../constants/themes';
import { APP_THEMES } from '../constants/themes';
import type { AppAlert } from '../types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
  groups?: { header: string; itemIds: string[] }[];
}

interface TopNavProps {
  sections: NavSection[];
  activeId: string;
  onSelect: (id: string) => void;
  isCloudConnected: boolean;
  isSyncing: boolean;
  syncErrors: string[] | null;
  lastSyncTime: string | null;
  onRefresh: () => void;
  onImportRefresh?: () => void;
  alerts?: AppAlert[];
  pendingCount?: number;
  offlinePendingCount?: number;
  onDrainOfflineQueue?: () => Promise<{ synced: number; failed: number }>;
  activeThemeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
  onSignOut?: () => void;
  currentUserName?: string;
  currentUserRole?: string;
}

const ALERT_ICONS: Record<string, React.ElementType> = {
  low_stock: PackageX,
  overdue_debt: AlertTriangle,
  revenue_drop: TrendingDown,
};

const ROLE_LABEL: Record<string, string> = {
  cashier: 'Thu ngân',
  manager: 'Quản lý',
  owner: 'Chủ cửa hàng',
};

const TopNav: React.FC<TopNavProps> = ({
  sections,
  activeId,
  onSelect,
  isCloudConnected,
  isSyncing,
  syncErrors,
  lastSyncTime,
  onRefresh,
  onImportRefresh,
  alerts = [],
  pendingCount = 0,
  offlinePendingCount = 0,
  onDrainOfflineQueue,
  activeThemeId,
  onThemeChange,
  onSignOut,
  currentUserName = '',
  currentUserRole = 'owner',
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justNavigated = useRef(false);

  // Đóng dropdown khi chuyển tab
  React.useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);

    // Force close và đánh dấu vừa navigate
    justNavigated.current = true;
    setOpenSection(null);

    // Đặc biệt: khi về trang POS, luôn đóng dropdown
    if (activeId === 'pos') {
      setOpenSection(null);
    }
  }, [activeId]);

  const openDropdown = (title: string) => {
    // Reset flag khi user hover lại (sau khi đã rời khỏi)
    justNavigated.current = false;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenSection(title);
  };
  const toggleDropdown = (title: string) => {
    justNavigated.current = false;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenSection(prev => (prev === title ? null : title));
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const closeDropdown = () => {
    // Chỉ đóng nếu không phải vừa navigate
    if (!justNavigated.current) {
      closeTimer.current = setTimeout(() => setOpenSection(null), 150);
    }
  };

  const activeSection = useMemo(
    () => sections.find(s => s.items.some(i => i.id === activeId)) ?? sections[0],
    [sections, activeId]
  );

  const errorCount = syncErrors?.length ?? 0;
  const totalBadge = errorCount + alerts.length;
  const hasOfflineQueue = offlinePendingCount > 0;
  const syncStatusLabel = isSyncing
    ? 'Syncing'
    : isCloudConnected
      ? hasOfflineQueue
        ? 'Online'
        : 'Online'
      : 'Offline';

  const categorizedErrors = useMemo(() => {
    if (!syncErrors) return {};
    const cats: Record<string, string[]> = {
      'Cơ sở dữ liệu': [],
      'Dữ liệu Shopee': [],
      'Hệ thống': [],
    };
    syncErrors.forEach(err => {
      if (err.toLowerCase().includes('shopee')) cats['Dữ liệu Shopee'].push(err);
      else if (err.toLowerCase().includes('table') || err.toLowerCase().includes('supabase'))
        cats['Cơ sở dữ liệu'].push(err);
      else cats['Hệ thống'].push(err);
    });
    return Object.fromEntries(Object.entries(cats).filter(([, v]) => v.length > 0));
  }, [syncErrors]);

  return (
    <>
      {/* Row 1 — Logo + Utility */}
      <header className="h-12 bg-white border-b border-slate-100 flex items-center px-4 md:px-6 gap-2 relative z-[60] shrink-0 shadow-sm">
        {/* Logo */}
        <div className="shrink-0 mr-2">
          <img src="/logo.png" className="h-10 w-auto object-contain" alt="logo" />
        </div>

        <div className="flex-1" />

        {/* Right area */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Sync status */}
          <div className="hidden lg:flex items-center gap-2.5 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 mr-2">
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            ) : isCloudConnected ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span
              className={`text-2xs font-normal uppercase tracking-widest ${isSyncing ? 'text-indigo-600' : isCloudConnected ? 'text-emerald-700' : 'text-rose-600'}`}
            >
              {syncStatusLabel}
            </span>
            {lastSyncTime && !isSyncing && (
              <span className="text-[9px] text-slate-400 font-normal border-l border-slate-200 pl-2.5">
                {new Date(lastSyncTime).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {pendingCount > 0 && !isSyncing && (
              <span className="text-[9px] bg-amber-100 text-amber-700 font-normal px-2 py-0.5 rounded-lg border border-amber-200 border-l border-slate-200 ml-1">
                {pendingCount} chờ sync
              </span>
            )}
          </div>

          {/* Offline queue badge */}
          {offlinePendingCount > 0 && (
            <button
              onClick={() => onDrainOfflineQueue?.()}
              disabled={isSyncing}
              title={`${offlinePendingCount} thao tác chờ đồng bộ — Bấm để đồng bộ ngay`}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-2xs font-normal uppercase tracking-wider transition-all shadow-sm shadow-amber-200 animate-pulse"
            >
              <WifiOff className="w-3 h-3" />
              {offlinePendingCount} chờ đồng bộ
              <Upload className="w-3 h-3" />
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            title="Tải lại từ database và đẩy dữ liệu local còn thiếu lên cloud"
            aria-label="Tải lại dữ liệu và đồng bộ database"
            className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          {/* Theme Picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className={`p-2.5 rounded-xl transition-all ${showThemePicker ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
              title="Chọn giao diện"
            >
              <Palette className="w-4 h-4" />
            </button>
            {showThemePicker && (
              <>
                <div className="fixed inset-0 z-modal" onClick={() => setShowThemePicker(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-modal overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-3 border-b border-slate-50">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Giao diện
                    </p>
                  </div>
                  <div className="p-2">
                    {APP_THEMES.map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          onThemeChange(theme.id);
                          setShowThemePicker(false);
                        }}
                        className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all ${activeThemeId === theme.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                      >
                        <div
                          className="mt-0.5 w-8 h-8 rounded-lg shrink-0 overflow-hidden border border-slate-200 flex-col"
                          style={{ background: theme.previewBg }}
                        >
                          <div className="h-2.5 w-full" style={{ background: theme.previewAccent }} />
                          <div className="px-1 pt-1 space-y-0.5">
                            <div className="h-1 rounded-sm" style={{ background: theme.previewAccent, opacity: 0.7 }} />
                            <div className="h-1 rounded-sm w-3/4" style={{ background: theme.previewAccent, opacity: 0.4 }} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-bold ${activeThemeId === theme.id ? 'text-indigo-700' : 'text-slate-800'}`}
                          >
                            {theme.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                            {theme.description}
                          </p>
                        </div>
                        {activeThemeId === theme.id && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Help */}
          <button
            onClick={() => onSelect('help')}
            className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button
            onClick={() => onSelect('settings')}
            className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(v => !v)}
              className={`p-2.5 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              <Bell className="w-4 h-4" />
              {totalBadge > 0 && (
                <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-normal flex items-center justify-center rounded-full border border-white">
                  {totalBadge > 9 ? '9+' : totalBadge}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-96 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden z-50"
                >
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 uppercase text-2xs tracking-widest">
                      Thông báo hệ thống
                    </h3>
                    {totalBadge > 0 && (
                      <span className="text-[9px] bg-rose-100 text-rose-600 px-3 py-1 rounded-full font-normal uppercase">
                        {totalBadge} cảnh báo
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                    {totalBadge === 0 ? (
                      <div className="py-10 text-center">
                        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        </div>
                        <p className="text-sm font-normal text-slate-800">Tất cả đều ổn!</p>
                        <p className="text-xs text-slate-400 mt-1">Không có sự cố nào.</p>
                      </div>
                    ) : (
                      <>
                        {alerts.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest px-2">
                              Cảnh báo AI
                            </h4>
                            {alerts.map(alert => {
                              const Icon = ALERT_ICONS[alert.type] ?? AlertTriangle;
                              const isCritical = alert.severity === 'critical';
                              return (
                                <div
                                  key={alert.id}
                                  className={`p-4 rounded-2xl flex items-start gap-3 border ${isCritical ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}
                                >
                                  <Icon
                                    className={`w-4 h-4 mt-0.5 shrink-0 ${isCritical ? 'text-rose-500' : 'text-amber-500'}`}
                                  />
                                  <div>
                                    <p className="text-xs font-normal text-slate-800">
                                      {alert.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                      {alert.message}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {errorCount > 0 &&
                          Object.entries(categorizedErrors).map(([cat, errs]) => (
                            <div key={cat} className="space-y-2">
                              <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest px-2">
                                {cat}
                              </h4>
                              {(errs as string[]).map((err, i) => (
                                <div
                                  key={i}
                                  className="p-4 bg-white border border-slate-100 rounded-2xl flex items-start gap-3"
                                >
                                  <div className="mt-1.5 w-2 h-2 bg-rose-500 rounded-full shrink-0 animate-pulse" />
                                  <p className="text-xs text-slate-600 font-normal leading-relaxed">
                                    {err}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User */}
          <div className="flex items-center gap-2.5 ml-1 pl-3 border-l border-slate-100">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors"
              >
                <div className="hidden xl:block text-right">
                  <p className="text-xs font-normal text-slate-900 tracking-tight leading-none">
                    {currentUserName || 'Người dùng'}
                  </p>
                  <p className="text-[9px] text-indigo-500 font-normal uppercase tracking-widest mt-0.5">
                    {ROLE_LABEL[currentUserRole] || currentUserRole}
                  </p>
                </div>
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                  <UserCircle className="w-full h-full text-slate-300" />
                </div>
              </button>

              {/* Dropdown đăng xuất */}
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
                    {onSignOut && (
                      <button
                        onClick={() => { setShowUserMenu(false); onSignOut(); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Đăng xuất
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Row 2 — Hover dropdown nav + Bán hàng CTA */}
      <div className="h-12 bg-indigo-600 flex items-center px-4 md:px-6 relative z-50 shrink-0 shadow-sm overflow-visible">
        <nav className="flex items-center gap-0.5 flex-1">
          {activeId !== 'pos' &&
            sections.map(section => {
              const isActive = section === activeSection;
              const itemMap = Object.fromEntries(section.items.map(i => [i.id, i]));
              const isSingleItem = section.items.length === 1;

              const isOpen = openSection === section.title;

              // Single-item section: navigate directly, no dropdown
              if (isSingleItem) {
                return (
                  <button
                    key={section.title}
                    onClick={() => {
                      justNavigated.current = true;
                      setOpenSection(null);
                      onSelect(section.items[0].id);
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-normal uppercase tracking-wider whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-indigo-800 text-white'
                        : 'text-indigo-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {section.title}
                  </button>
                );
              }

              return (
                <div
                  key={section.title}
                  className="relative"
                  onMouseEnter={() => openDropdown(section.title)}
                  onMouseLeave={closeDropdown}
                >
                  <button
                    onClick={() => toggleDropdown(section.title)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-normal uppercase tracking-wider whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-indigo-800 text-white'
                        : 'text-indigo-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {section.title}
                    <ChevronDown
                      className={`w-3 h-3 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <div
                    onMouseEnter={cancelClose}
                    onMouseLeave={closeDropdown}
                    className={`absolute left-0 top-full pt-1 transition-all duration-150 z-50 ${section.groups?.length === 3 ? 'min-w-[580px]' : section.groups ? 'min-w-[380px]' : 'min-w-[220px]'} ${isOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-1'}`}
                  >
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                      {section.groups ? (
                        <div className={`grid ${section.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          {section.groups.map((group, groupIndex) => {
                            const isLast = groupIndex === section.groups!.length - 1;
                            const isThickDivider = section.groups!.length === 3 && groupIndex === 0;
                            const isThinDivider = section.groups!.length === 3 && groupIndex === 1;
                            const borderClass = isLast || isThinDivider
                              ? ''
                              : isThickDivider
                                ? 'border-r-2 border-slate-300'
                                : 'border-r border-slate-100';
                            return (
                            <div key={group.header || `group-${groupIndex}`} className={`py-2 ${borderClass}`}>
                              {group.header ? (
                                <div className="px-4 pb-1 pt-2 text-2xs font-normal text-slate-400 uppercase tracking-widest">
                                  {group.header}
                                </div>
                              ) : (
                                <div className="px-4 pb-1 pt-2 text-2xs leading-none select-none">&nbsp;</div>
                              )}
                              <div className={isThinDivider ? 'border-r border-slate-100' : ''}>
                              {group.itemIds.map(itemId => {
                                const item = itemMap[itemId];
                                if (!item) return null;
                                const Icon = item.icon;
                                const isItemActive = item.id === activeId;
                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => {
                                      onSelect(item.id);
                                      setOpenSection(null);
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-normal text-left transition-colors whitespace-nowrap ${
                                      isItemActive
                                        ? 'bg-indigo-50 text-indigo-600'
                                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge && (
                                      <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-normal leading-none">
                                        {item.badge}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Single-column layout */
                        <div className="py-1">
                          {section.items.map(item => {
                            const Icon = item.icon;
                            const isItemActive = item.id === activeId;
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  onSelect(item.id);
                                  setOpenSection(null);
                                }}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-normal text-left transition-colors whitespace-nowrap ${
                                  isItemActive
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                  <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-normal leading-none">
                                    {item.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </nav>

        <button
          onClick={() => {
            setOpenSection(null);
            justNavigated.current = true;
            onSelect('pos');
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-normal uppercase tracking-wider whitespace-nowrap transition-all hover:bg-indigo-50 shadow-sm shrink-0 ml-2"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Bán hàng
        </button>
      </div>

    </>
  );
};

export default TopNav;
