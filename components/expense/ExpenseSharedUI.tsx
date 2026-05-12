import React from 'react';
import type { LucideIcon } from 'lucide-react';

type ExpenseMetricColor = 'rose' | 'amber' | 'emerald' | 'indigo';

interface ExpenseMetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: ExpenseMetricColor;
  desc?: string;
}

interface ExpenseInputWrapperProps {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
  color?: string;
}

export const ExpenseMetricCard = ({ title, value, icon: Icon, color, desc }: ExpenseMetricCardProps) => {
  const colorMap: Record<ExpenseMetricColor, string> = {
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between transition-all hover:-translate-y-1">
      <div>
        <div className={`p-4 rounded-2xl ${colorMap[color] || 'bg-slate-50 text-slate-600'} w-fit mb-6 shadow-sm`}><Icon className="w-6 h-6" /></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-xl font-black text-slate-900 tabular-nums">{value}</h4>
      </div>
      {desc && <p className="text-[9px] text-slate-400 font-bold mt-4 pt-4 border-t border-slate-50 uppercase tracking-tighter">{desc}</p>}
    </div>
  );
};

export const ExpenseInputWrapper = ({ label, icon: Icon, children, color = 'text-slate-400' }: ExpenseInputWrapperProps) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-blue-500 rounded-xl transition-all shadow-inner overflow-hidden flex items-center">
      <Icon className={`absolute left-3 w-3.5 h-3.5 ${color}`} />
      <div className="pl-9 w-full">{children}</div>
    </div>
  </div>
);
