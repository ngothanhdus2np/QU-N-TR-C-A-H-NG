import React from 'react';
import { Employee } from '../../types';
import { Clock } from 'lucide-react';
import { isStaffActive } from '../../src/lib';

interface Props {
  employees: Employee[];
  daysArray: number[];
  selectedMonth: string;
  isHoliday: (day: number) => boolean;
  getOvertimeCellValue: (employeeId: string, day: number) => string;
  handleOvertimeInputChange: (emp: Employee, day: number, value: string) => void;
  calculateTotalOvertimeHours: (employeeId: string) => number;
}

const OvertimeTab: React.FC<Props> = ({
  employees, daysArray, isHoliday,
  getOvertimeCellValue, handleOvertimeInputChange, calculateTotalOvertimeHours,
}) => (
  <div className="animate-in fade-in duration-300 space-y-4">
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Clock className="w-5 h-5" /></div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Ghi Nhận Tăng Ca (Đơn vị: Phút)</h3>
      </div>
    </div>
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-30 backdrop-blur-sm bg-slate-50/90">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase sticky left-0 top-0 bg-slate-50 z-40 border-r border-slate-100 w-[200px]">Nhân viên</th>
              {daysArray.map(day => (
                <th key={day} className={`px-1 py-4 text-center text-[10px] font-black w-[42px] border-r border-slate-100/50 ${isHoliday(day) ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>{day}</th>
              ))}
              <th className="px-3 py-4 text-center text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[60px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Giờ</th>
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
                      <input type="text" defaultValue={getOvertimeCellValue(emp.id, day)} onBlur={(e) => handleOvertimeInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-xs font-normal outline-none border-none focus:bg-emerald-50/50" />
                    </td>
                  ))}
                  <td className="bg-emerald-50 text-center font-normal text-emerald-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)]">{calculateTotalOvertimeHours(emp.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default OvertimeTab;
