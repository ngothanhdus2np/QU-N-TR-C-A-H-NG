
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, BrainCircuit, Cloud, CloudOff, RefreshCw, Loader2 } from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isSubItem?: boolean;
}

interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface SidebarProps {
  sections: SidebarSection[];
  activeId: string;
  onSelect: (id: string) => void;
  isCloudConnected?: boolean;
  isSyncing?: boolean;
  onRefresh?: () => void;
  brandLogo?: string;
  brandName?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sections, 
  activeId, 
  onSelect, 
  isCloudConnected, 
  isSyncing, 
  onRefresh,
  brandLogo,
  brandName = "CFO BRAIN"
}) => {
  return (
    <div className="w-64 bg-white h-full flex flex-col border-r border-slate-100 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.02)]">
      <div className="p-8 flex items-center space-x-3">
        <div className="w-11 h-11 bg-indigo-600 rounded-[0.9rem] flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-100">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <BrainCircuit className="text-white w-6 h-6" />
          )}
        </div>
        <div>
          <h1 className="text-slate-900 font-black text-xl leading-none tracking-tighter uppercase">{brandName}</h1>
          <p className="text-indigo-500 text-[10px] uppercase tracking-[0.2em] font-black mt-1">Intelligence</p>
        </div>
      </div>
      
      <nav className="flex-1 py-2 px-4 space-y-7 overflow-y-auto no-scrollbar">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {section.title && (
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              return (
                    <motion.button
                      key={item.id}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelect(item.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                          : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="activeTabIndicator"
                          className="absolute left-0 w-1 h-6 bg-white rounded-r-full" 
                        />
                      )}
                      <Icon className={`w-4.5 h-4.5 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
                      <span className={`text-sm tracking-tight transition-all ${isActive ? 'font-black' : 'font-semibold'}`}>
                        {item.label}
                      </span>
                    </motion.button>
              );
            })}
          </div>
        ))}
      </nav>
      
      <div className="p-6 space-y-4">
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Database</p>
            {onRefresh && (
              <button onClick={onRefresh} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" disabled={isSyncing}>
                {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isCloudConnected ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                <span className="text-[10px] text-slate-700 font-black uppercase flex items-center gap-1.5">
                  <Cloud className="w-3 h-3 text-emerald-500" /> Online
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-500">
                <CloudOff className="w-3 h-3" />
                <span className="text-[10px] font-extrabold uppercase">Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
