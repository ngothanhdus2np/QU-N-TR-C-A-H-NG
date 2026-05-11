import React from 'react';
import { Activity, FileSpreadsheet, Layers, Repeat } from 'lucide-react';

type ExpenseSubTab = 'efficiency' | 'categories' | 'ledger' | 'recurring';

interface ExpenseTabsProps {
  activeSubTab: ExpenseSubTab;
  setActiveSubTab: React.Dispatch<React.SetStateAction<ExpenseSubTab>>;
  pendingRecurringCount: number;
}

export const ExpenseTabs: React.FC<ExpenseTabsProps> = ({
  activeSubTab,
  setActiveSubTab,
  pendingRecurringCount
}) => (
  <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200">
    <button
      onClick={() => setActiveSubTab('efficiency')}
      className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
        activeSubTab === 'efficiency' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Activity className="w-4 h-4" /> Hiệu Quả MIS
    </button>
    <button
      onClick={() => setActiveSubTab('categories')}
      className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
        activeSubTab === 'categories' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Layers className="w-4 h-4" /> Danh Mục Chi Phí
    </button>
    <button
      onClick={() => setActiveSubTab('ledger')}
      className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
        activeSubTab === 'ledger' ? 'bg-white text-rose-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <FileSpreadsheet className="w-4 h-4" /> Sổ Cái Chi Phí
    </button>
    <button
      onClick={() => setActiveSubTab('recurring')}
      className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all relative ${
        activeSubTab === 'recurring' ? 'bg-white text-amber-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Repeat className="w-4 h-4" /> Chi Phí Định Kỳ
      {pendingRecurringCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white animate-bounce">
          {pendingRecurringCount}
        </span>
      )}
    </button>
  </div>
);
