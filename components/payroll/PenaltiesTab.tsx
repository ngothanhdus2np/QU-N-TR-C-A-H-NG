import React from 'react';
import { Employee, ViolationType } from '../../types';
import { Wallet2, HandCoins, Gavel, Check } from 'lucide-react';
import { isStaffActive } from '../../src/lib';

interface Props {
  employees: Employee[];
  daysArray: number[];
  selectedMonth: string;
  isHoliday: (day: number) => boolean;
  violationTypes: ViolationType[];
  getShortageCellValue: (employeeId: string, day: number) => string;
  handleShortageInputChange: (emp: Employee, day: number, value: string) => void;
  calculateTotalShortageAmount: (employeeId: string) => number;
  getAdvanceCellValue: (employeeId: string, day: number) => string;
  handleAdvanceInputChange: (emp: Employee, day: number, value: string) => void;
  calculateTotalAdvanceAmount: (employeeId: string) => number;
  toggleViolation: (employeeId: string, violationTypeId: string, occurrence: 1 | 2 | 3) => void;
  isViolationChecked: (employeeId: string, violationTypeId: string, occurrence: 1 | 2 | 3) => boolean;
}

const PenaltiesTab: React.FC<Props> = ({
  employees, daysArray, selectedMonth, isHoliday, violationTypes,
  getShortageCellValue, handleShortageInputChange, calculateTotalShortageAmount,
  getAdvanceCellValue, handleAdvanceInputChange, calculateTotalAdvanceAmount,
  toggleViolation, isViolationChecked,
}) => (
  <div className="animate-in fade-in duration-500 space-y-12">
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Wallet2 className="w-5 h-5" /></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Bảng theo dõi tiền thiếu tháng {selectedMonth}</h3>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[50vh]">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-30 backdrop-blur-sm bg-slate-50/90">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase sticky left-0 top-0 bg-slate-50 z-40 border-r border-slate-100 w-[200px]">Nhân viên</th>
                {daysArray.map(day => (
                  <th key={day} className={`px-1 py-4 text-center text-[10px] font-black w-[50px] border-r border-slate-100/50 ${isHoliday(day) ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>{day}</th>
                ))}
                <th className="px-3 py-4 text-center text-[10px] font-black text-orange-600 uppercase bg-orange-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[100px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Tổng Thiếu</th>
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
                        <input type="text" defaultValue={getShortageCellValue(emp.id, day)} onBlur={(e) => handleShortageInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-[10px] font-normal outline-none border-none focus:bg-orange-50/50" />
                      </td>
                    ))}
                    <td className="bg-orange-50 text-center font-normal text-orange-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)] truncate">{(calculateTotalShortageAmount(emp.id) || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><HandCoins className="w-5 h-5" /></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Bảng theo dõi tạm ứng tháng {selectedMonth}</h3>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[50vh]">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-30 backdrop-blur-sm bg-slate-50/90">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase sticky left-0 top-0 bg-slate-50 z-40 border-r border-slate-100 w-[200px]">Nhân viên</th>
                {daysArray.map(day => (
                  <th key={day} className={`px-1 py-4 text-center text-[10px] font-black w-[50px] border-r border-slate-100/50 ${isHoliday(day) ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>{day}</th>
                ))}
                <th className="px-3 py-4 text-center text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[100px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Tổng Tạm Ứng</th>
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
                        <input type="text" defaultValue={getAdvanceCellValue(emp.id, day)} onBlur={(e) => handleAdvanceInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-[10px] font-normal outline-none border-none focus:bg-indigo-50/50" />
                      </td>
                    ))}
                    <td className="bg-indigo-50 text-center font-normal text-indigo-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)] truncate">{(calculateTotalAdvanceAmount(emp.id) || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><Gavel className="w-5 h-5" /></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Ma Trận Khấu Trừ Kỷ Luật Tháng {selectedMonth}</h3>
        </div>
      </div>
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-30 backdrop-blur-sm bg-slate-50/90">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase border-r border-slate-100 w-[240px] sticky left-0 top-0 bg-slate-50 z-40">Hạng mục khấu trừ</th>
                {employees.map(emp => (
                  <th key={emp.id} className="px-2 py-5 text-center border-r border-slate-100 min-w-[120px]">
                    <p className="text-[10px] font-normal text-slate-800 uppercase truncate px-2">{emp.name}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {violationTypes.map(vt => (
                <tr key={vt.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 bg-white sticky left-0 z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.01)]">
                    <p className="text-xs font-normal text-slate-700">{vt.name}</p>
                  </td>
                  {employees.map(emp => (
                    <td key={emp.id} className="p-0 border-r border-slate-100 h-14">
                      <div className="flex h-full items-center justify-center gap-4 px-2">
                        {[1, 2, 3].map((num) => (
                          <button
                            key={num}
                            onClick={() => toggleViolation(emp.id, vt.id, num as 1 | 2 | 3)}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                              isViolationChecked(emp.id, vt.id, num as 1 | 2 | 3)
                                ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                                : 'bg-white border-slate-200 hover:border-rose-300'
                            }`}
                          >
                            {isViolationChecked(emp.id, vt.id, num as 1 | 2 | 3) && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

export default PenaltiesTab;
