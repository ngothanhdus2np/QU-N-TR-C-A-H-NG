import React from 'react';
import { Calendar, Eye, EyeOff, FileDown } from 'lucide-react';

interface PayrollToolbarProps {
  selectedMonth: string;
  showResigned: boolean;
  onChangeMonth: (month: string) => void;
  onExportPayroll: () => void;
  onToggleShowResigned: () => void;
}

export const PayrollToolbar: React.FC<PayrollToolbarProps> = ({
  selectedMonth,
  showResigned,
  onChangeMonth,
  onExportPayroll,
  onToggleShowResigned,
}) => (
  <div className="sticky top-0 z-50">
    <div className="flex items-center justify-end gap-4 px-2 py-2">
      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-2 border-slate-200 shadow-sm">
        <Calendar className="w-4 h-4 text-slate-400" />
        <input
          type="month"
          value={selectedMonth}
          onChange={e => onChangeMonth(e.target.value)}
          className="bg-transparent text-sm font-normal text-slate-700 outline-none cursor-pointer"
        />
      </div>
      <button
        onClick={onExportPayroll}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-normal uppercase tracking-widest bg-white border-2 border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 transition-all"
      >
        <FileDown className="w-3.5 h-3.5" /> Xuất Excel
      </button>
      <button
        onClick={onToggleShowResigned}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-normal uppercase tracking-widest transition-all ${
          showResigned
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'bg-white border-2 border-slate-200 text-slate-400 hover:bg-slate-50'
        }`}
      >
        {showResigned ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        {showResigned ? 'Đang hiện nhân sự cũ' : 'Hiện nhân sự cũ'}
      </button>
    </div>
  </div>
);
