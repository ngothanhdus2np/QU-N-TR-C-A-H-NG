import React from 'react';
import { Employee } from '../../types';
import { ListChecks } from 'lucide-react';
import { isStaffActive } from '../../businessLogic';

interface Props {
  employees: Employee[];
  daysArray: number[];
  selectedMonth: string;
  isHoliday: (day: number) => boolean;
  getAttendanceCellValue: (employeeId: string, day: number) => string;
  handleAttendanceInputChange: (emp: Employee, day: number, value: string) => void;
  calculateTotalHours: (employeeId: string) => number;
}

const AttendanceTab: React.FC<Props> = ({
  employees, daysArray, selectedMonth, isHoliday,
  getAttendanceCellValue, handleAttendanceInputChange, calculateTotalHours,
}) => (
  <div className="animate-in fade-in duration-300 space-y-4">
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ListChecks className="w-5 h-5" /></div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Bảng Chấm Công Tháng {selectedMonth}</h3>
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
              <th className="px-3 py-4 text-center text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[60px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {employees.map(emp => {
              return (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                    <p className={`text-sm font-bold truncate ${isStaffActive(emp) ? 'text-slate-800' : 'text-slate-400'}`}>{emp.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                  </td>
                  {daysArray.map(day => (
                    <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                      <input type="text" defaultValue={getAttendanceCellValue(emp.id, day)} onBlur={(e) => handleAttendanceInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-xs font-bold outline-none border-none focus:bg-white" />
                    </td>
                  ))}
                  <td className="bg-indigo-50 text-center font-black text-indigo-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)]">{calculateTotalHours(emp.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default AttendanceTab;
