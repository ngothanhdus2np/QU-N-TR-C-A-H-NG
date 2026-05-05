
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, UserCircle, Settings, Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import ApiKeySettings from './ApiKeySettings';

interface HeaderProps {
  activeTitle: string;
  syncErrors: string[] | null;
  isSyncing: boolean;
  isCloudConnected: boolean;
  lastSyncTime: string | null;
  onRefresh: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeTitle, syncErrors, isSyncing, isCloudConnected, lastSyncTime, onRefresh }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const categorizedErrors = useMemo(() => {
    if (!syncErrors) return {};
    
    const categories: Record<string, string[]> = {
      'Cơ sở dữ liệu': [],
      'Dữ liệu Shopee': [],
      'Hệ thống': []
    };

    syncErrors.forEach(err => {
      if (err.toLowerCase().includes('shopee')) {
        categories['Dữ liệu Shopee'].push(err);
      } else if (err.toLowerCase().includes('table') || err.toLowerCase().includes('cache') || err.toLowerCase().includes('supabase')) {
        categories['Cơ sở dữ liệu'].push(err);
      } else {
        categories['Hệ thống'].push(err);
      }
    });

    // Remove empty categories
    return Object.fromEntries(Object.entries(categories).filter(([_, v]) => v.length > 0));
  }, [syncErrors]);

  const errorCount = syncErrors?.length || 0;

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-10 sticky top-0 z-40">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{activeTitle}</h2>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Intelligence System</p>
      </div>
      
      <div className="flex items-center space-x-8">
        {/* Sync Status Indicator */}
        <div className="hidden lg:flex items-center px-5 py-2 bg-slate-50/50 rounded-2xl border border-slate-100 gap-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            ) : isCloudConnected ? (
              <div className="relative">
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              </div>
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest ${isSyncing ? 'text-indigo-600' : isCloudConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
              {isSyncing ? 'Syncing...' : isCloudConnected ? 'Cloud Active' : 'Offline'}
            </span>
          </div>
          {lastSyncTime && !isSyncing && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                Last: {new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        <div className="relative hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search Intelligence..." 
            className="pl-11 pr-5 py-2.5 bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 rounded-2xl text-sm transition-all outline-none w-72 font-medium"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-2xl transition-all group"
          >
            <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
          </motion.button>

          <div className="relative">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`p-3 rounded-2xl transition-all relative ${isNotificationsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Bell className="w-5 h-5" />
              {errorCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-lg">
                  {errorCount}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-96 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-50"
                >
                  <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Notification Intelligence</h3>
                  {errorCount > 0 && <span className="text-[9px] bg-rose-100 text-rose-600 px-3 py-1 rounded-full font-black uppercase">{errorCount} Alert</span>}
                </div>
                
                <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                  {errorCount === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      </div>
                      <p className="text-sm text-slate-800 font-bold">Tất cả đều ổn!</p>
                      <p className="text-xs text-slate-400 mt-1">Không có sự cố nào được ghi nhận.</p>
                    </div>
                  ) : (
                    Object.entries(categorizedErrors).map(([category, errors]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">{category}</h4>
                        <div className="space-y-1.5">
                          {(errors as string[]).map((err, idx) => (
                            <div key={idx} className="p-4 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-4 transition-all group">
                              <div className="mt-1 w-2 h-2 bg-rose-500 rounded-full flex-shrink-0 animate-pulse" />
                              <p className="text-xs text-slate-600 font-bold leading-relaxed">{err}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
        
        <div className="flex items-center space-x-4 border-l pl-8 border-slate-100">
          <div className="text-right hidden xl:block">
            <p className="text-sm font-black text-slate-900 tracking-tight">Ngô Thành Du</p>
            <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">Admin CFO</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
            <UserCircle className="w-full h-full text-slate-300" />
          </div>
        </div>
      </div>

      <ApiKeySettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </header>
  );
};

export default Header;
