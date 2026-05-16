import React from 'react';
import { Employee } from '../../types';
import { TrendingUp, Trophy, Crown, Medal } from 'lucide-react';
import { isStaffActive } from '../../src/lib';

interface StaffRanking {
  id: string;
  name: string;
  totalAmount: number;
  rank?: number;
}

interface Props {
  employees: Employee[];
  daysArray: number[];
  selectedMonth: string;
  isHoliday: (day: number) => boolean;
  staffRankings: StaffRanking[];
  getSalesCellValue: (employeeId: string, day: number) => string;
  handleSalesInputChange: (emp: Employee, day: number, value: string) => void;
  calculateTotalSalesAmount: (employeeId: string) => number;
}

const SalesTab: React.FC<Props> = ({
  employees, daysArray, selectedMonth, isHoliday,
  staffRankings, getSalesCellValue, handleSalesInputChange, calculateTotalSalesAmount,
}) => (
  <div className="animate-in fade-in duration-300 space-y-10">
    {staffRankings.length > 0 && (
      <div className="space-y-6">
        <div className="flex items-center gap-4 px-2">
          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xl"><Trophy className="w-6 h-6" /></div>
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bảng Vàng Doanh Số Tháng {selectedMonth.split('-').reverse().join('/')}</h3>
            <p className="text-[10px] text-slate-400 font-normal uppercase tracking-widest mt-0.5">Xếp hạng hiệu quả đóng góp doanh thu của nhân sự</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {staffRankings.slice(0, 3).map((r, idx) => {
            const colors = [
              { bg: 'bg-amber-500', text: 'text-amber-500', icon: Crown, label: 'QUÁN QUÂN' },
              { bg: 'bg-slate-400', text: 'text-slate-400', icon: Medal, label: 'Á QUÂN' },
              { bg: 'bg-orange-400', text: 'text-orange-400', icon: Medal, label: 'VỀ BA' },
            ];
            const theme = colors[idx];
            return (
              <div key={r.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-all">
                <div className={`absolute top-0 right-0 w-32 h-32 ${theme.bg}/5 rounded-full -translate-y-1/2 translate-x-1/2`}></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className={`w-14 h-14 rounded-2xl ${theme.bg} text-white flex items-center justify-center shadow-lg`}>
                    <theme.icon className="w-8 h-8" />
                  </div>
                  <span className={`text-[10px] font-normal uppercase tracking-[0.2em] ${theme.text}`}>{theme.label}</span>
                </div>
                <div className="relative z-10">
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{r.name}</h4>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-2xl font-normal text-slate-800 tabular-nums">{(r.totalAmount || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-normal text-slate-400 mb-1.5">VNĐ</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Ghi nhận doanh số chi tiết (Đơn vị: Nghìn đồng)</h3>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-30 backdrop-blur-sm bg-slate-50/90">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase sticky left-0 top-0 bg-slate-50 z-40 border-r border-slate-100 w-[200px]">Nhân viên</th>
                {daysArray.map(day => (
                  <th key={day} className={`px-1 py-4 text-center text-[10px] font-black w-[55px] border-r border-slate-100/50 ${isHoliday(day) ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>{day}</th>
                ))}
                <th className="px-3 py-4 text-center text-[10px] font-black text-amber-600 uppercase bg-amber-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[100px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map(emp => {
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                      <p className={`text-sm font-normal truncate ${isStaffActive(emp) ? 'text-slate-800' : 'text-slate-400'}`}>{emp.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                    </td>
                    {daysArray.map(day => (
                      <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                        <input type="text" defaultValue={getSalesCellValue(emp.id, day)} onBlur={(e) => handleSalesInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-[10px] font-normal outline-none border-none focus:bg-amber-50/50" />
                      </td>
                    ))}
                    <td className="bg-amber-50 text-center font-normal text-amber-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)] truncate">{(calculateTotalSalesAmount(emp.id) || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

export default SalesTab;
