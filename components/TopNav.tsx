
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Cloud, CloudOff, RefreshCw, Bell, Settings, UserCircle, CheckCircle2, PackageX, AlertTriangle, TrendingDown, WifiOff, Upload } from 'lucide-react';
import ApiKeySettings from './ApiKeySettings';
import ThemeSwitcher from './ui/ThemeSwitcher';
import type { AppThemeId } from '../constants/themes';
import type { AppAlert } from '../types';

interface NavSection {
  title: string;
  items: { id: string; label: string; icon: React.ElementType }[];
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
  brandLogo?: string;
  alerts?: AppAlert[];
  pendingCount?: number;
  offlinePendingCount?: number;
  onDrainOfflineQueue?: () => Promise<{ synced: number; failed: number }>;
  activeThemeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
}

const ALERT_ICONS: Record<string, React.ElementType> = {
  low_stock: PackageX,
  overdue_debt: AlertTriangle,
  revenue_drop: TrendingDown,
};

const TopNav: React.FC<TopNavProps> = ({
  sections, activeId, onSelect,
  isCloudConnected, isSyncing, syncErrors, lastSyncTime, onRefresh, brandLogo, alerts = [], pendingCount = 0,
  offlinePendingCount = 0, onDrainOfflineQueue, activeThemeId, onThemeChange
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const activeSection = useMemo(
    () => sections.find(s => s.items.some(i => i.id === activeId)) ?? sections[0],
    [sections, activeId]
  );

  const errorCount = syncErrors?.length ?? 0;
  const totalBadge = errorCount + alerts.length;

  const categorizedErrors = useMemo(() => {
    if (!syncErrors) return {};
    const cats: Record<string, string[]> = { 'Cơ sở dữ liệu': [], 'Dữ liệu Shopee': [], 'Hệ thống': [] };
    syncErrors.forEach(err => {
      if (err.toLowerCase().includes('shopee')) cats['Dữ liệu Shopee'].push(err);
      else if (err.toLowerCase().includes('table') || err.toLowerCase().includes('supabase')) cats['Cơ sở dữ liệu'].push(err);
      else cats['Hệ thống'].push(err);
    });
    return Object.fromEntries(Object.entries(cats).filter(([, v]) => v.length > 0));
  }, [syncErrors]);

  const handleSectionClick = (section: NavSection) => {
    const target = section.items.find(i => i.id !== 'pos') ?? section.items[0];
    onSelect(target.id);
  };

  return (
    <>
      {/* Row 1 — Main nav */}
      <header className="h-14 bg-white border-b border-slate-100 flex items-center px-4 md:px-6 gap-2 z-40 shrink-0 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mr-4 shrink-0">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center overflow-hidden shadow-md shadow-indigo-200 shrink-0">
            {brandLogo
              ? <img src={brandLogo} className="w-full h-full object-cover" alt="logo" />
              : <BrainCircuit className="w-5 h-5 text-white" />
            }
          </div>
          <div className="hidden sm:block leading-none">
            <div className="text-sm font-black text-slate-900 uppercase tracking-tight">CFO Brain</div>
            <div className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">Intelligence</div>
          </div>
        </div>

        {/* Section tabs */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar">
          {sections.map(section => {
            const isActive = section === activeSection;
            return (
              <button
                key={section.title}
                onClick={() => handleSectionClick(section)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {section.title}
              </button>
            );
          })}
        </nav>

        {/* Right area */}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {/* Sync status */}
          <div className="hidden lg:flex items-center gap-2.5 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 mr-2">
            {isSyncing
              ? <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              : isCloudConnected
                ? <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                : <CloudOff className="w-3.5 h-3.5 text-rose-500" />
            }
            <span className={`text-[10px] font-black uppercase tracking-widest ${isSyncing ? 'text-indigo-600' : isCloudConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
              {isSyncing ? 'Syncing' : isCloudConnected ? 'Online' : 'Offline'}
            </span>
            {lastSyncTime && !isSyncing && (
              <span className="text-[9px] text-slate-400 font-bold border-l border-slate-200 pl-2.5">
                {new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {pendingCount > 0 && !isSyncing && (
              <span className="text-[9px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-lg border border-amber-200 border-l border-slate-200 ml-1">
                {pendingCount} chờ sync
              </span>
            )}
          </div>

          {/* Offline Queue Badge + Sync Button */}
          {offlinePendingCount > 0 && (
            <button
              onClick={() => onDrainOfflineQueue?.()}
              disabled={isSyncing}
              title={`${offlinePendingCount} đơn hàng chờ sync — Bấm để đồng bộ ngay`}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm shadow-amber-200 animate-pulse"
            >
              <WifiOff className="w-3 h-3" />
              {offlinePendingCount} offline
              <Upload className="w-3 h-3" />
            </button>
          )}

          {/* Refresh */}
          <button onClick={onRefresh}
            className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          {/* Settings */}
          <button onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all">
            <Settings className="w-4 h-4" />
          </button>

          <ThemeSwitcher activeThemeId={activeThemeId} onChange={onThemeChange} />

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setIsNotificationsOpen(v => !v)}
              className={`p-2.5 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
              <Bell className="w-4 h-4" />
              {totalBadge > 0 && (
                <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border border-white">
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
                    <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Thông báo hệ thống</h3>
                    {totalBadge > 0 && <span className="text-[9px] bg-rose-100 text-rose-600 px-3 py-1 rounded-full font-black uppercase">{totalBadge} cảnh báo</span>}
                  </div>
                  <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                    {totalBadge === 0 ? (
                      <div className="py-10 text-center">
                        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        </div>
                        <p className="text-sm font-bold text-slate-800">Tất cả đều ổn!</p>
                        <p className="text-xs text-slate-400 mt-1">Không có sự cố nào.</p>
                      </div>
                    ) : (
                      <>
                        {alerts.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Cảnh báo AI</h4>
                            {alerts.map(alert => {
                              const Icon = ALERT_ICONS[alert.type] ?? AlertTriangle;
                              const isCritical = alert.severity === 'critical';
                              return (
                                <div key={alert.id} className={`p-4 rounded-2xl flex items-start gap-3 border ${isCritical ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isCritical ? 'text-rose-500' : 'text-amber-500'}`} />
                                  <div>
                                    <p className="text-xs font-black text-slate-800">{alert.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{alert.message}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {errorCount > 0 && Object.entries(categorizedErrors).map(([cat, errs]) => (
                          <div key={cat} className="space-y-2">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">{cat}</h4>
                            {(errs as string[]).map((err, i) => (
                              <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-start gap-3">
                                <div className="mt-1.5 w-2 h-2 bg-rose-500 rounded-full shrink-0 animate-pulse" />
                                <p className="text-xs text-slate-600 font-bold leading-relaxed">{err}</p>
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
            <div className="hidden xl:block text-right">
              <p className="text-xs font-black text-slate-900 tracking-tight leading-none">Ngô Thành Du</p>
              <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-0.5">Admin CFO</p>
            </div>
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
              <UserCircle className="w-full h-full text-slate-300" />
            </div>
          </div>
        </div>
      </header>

      {/* Row 2 — Sub-nav */}
      <div className="h-11 bg-slate-50 border-b border-slate-100 flex items-end px-4 md:px-6 gap-0.5 z-30 shrink-0 overflow-x-auto no-scrollbar">
        {activeSection.items.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider whitespace-nowrap rounded-t-lg border-b-2 transition-all ${
                isActive
                  ? 'text-indigo-600 border-indigo-600 bg-white shadow-sm'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>

      <ApiKeySettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

export default TopNav;
