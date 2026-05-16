import React from 'react';
import { LucideIcon } from 'lucide-react';

type MetricColor = 'indigo' | 'rose' | 'emerald' | 'amber';

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: MetricColor;
  desc: string;
}

const METRIC_COLOR_CLASS: Record<MetricColor, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
};

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, color, desc }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between transition-all hover:-translate-y-1">
    <div>
      <div className={`p-4 rounded-2xl ${METRIC_COLOR_CLASS[color]} w-fit mb-6 shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <h4 className="text-xl font-normal text-slate-900 tabular-nums">{value}</h4>
    </div>
    <p className="text-[8px] font-normal text-slate-400 uppercase tracking-tighter mt-4 pt-4 border-t border-slate-50 leading-relaxed">{desc}</p>
  </div>
);

interface InputWrapperProps {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
  color?: string;
}

export const InputWrapper: React.FC<InputWrapperProps> = ({ label, icon: Icon, children, color = 'text-slate-400' }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-blue-500 rounded-xl transition-all shadow-inner overflow-hidden flex items-center">
      <Icon className={`absolute left-3 w-3.5 h-3.5 ${color}`} />
      <div className="pl-9 w-full">{children}</div>
    </div>
  </div>
);
