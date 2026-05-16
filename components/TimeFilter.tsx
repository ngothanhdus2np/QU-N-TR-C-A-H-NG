
import React from 'react';
import { Calendar, ArrowRightLeft } from 'lucide-react';
import { DiagnosisRange } from '../types';

interface TimeFilterProps {
  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
}

const TimeFilter: React.FC<TimeFilterProps> = ({
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate,
}) => {
  return (
    <div className="flex flex-col gap-6 items-center">
      <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-white rounded-3xl border border-slate-200 shadow-sm w-fit mx-auto">
        <Calendar className="w-4 h-4 text-slate-400 mx-2" />
        {[
          { id: 'today', label: 'Hôm nay' },
          { id: 'yesterday', label: 'Hôm qua' },
          { id: 'last7', label: '7 ngày qua' },
          { id: 'thisMonth', label: 'Tháng này' },
          { id: 'lastMonth', label: 'Tháng trước' },
          { id: 'thisYear', label: 'Năm nay' },
          { id: 'custom', label: 'Tùy chỉnh' },
          { id: 'all', label: 'Tất cả' }
        ].map(range => (
          <button
            key={range.id}
            onClick={() => setDiagnosisRange(range.id as DiagnosisRange)}
            className={`px-4 py-2 rounded-2xl text-[10px] font-normal uppercase tracking-widest transition-all ${diagnosisRange === range.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {diagnosisRange === 'custom' && (
        <div className="flex items-center gap-4 bg-white p-3 px-6 rounded-[2rem] border border-indigo-100 shadow-xl animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-normal text-slate-400 uppercase">Từ ngày:</span>
            <input 
              type="date" 
              value={diagStartDate} 
              onChange={e => setDiagStartDate(e.target.value)} 
              className="bg-slate-50 px-3 py-1.5 rounded-xl text-[10px] font-normal outline-none focus:ring-2 ring-indigo-100 transition-all" 
            />
          </div>
          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-300" />
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-normal text-slate-400 uppercase">Đến ngày:</span>
            <input 
              type="date" 
              value={diagEndDate} 
              onChange={e => setDiagEndDate(e.target.value)} 
              className="bg-slate-50 px-3 py-1.5 rounded-xl text-[10px] font-normal outline-none focus:ring-2 ring-indigo-100 transition-all" 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeFilter;
