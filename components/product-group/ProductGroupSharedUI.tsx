import React from 'react';
import { LucideIcon } from 'lucide-react';

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
