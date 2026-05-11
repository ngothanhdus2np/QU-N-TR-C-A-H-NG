import React from 'react';
import { PayrollRecord } from '../../types';
import { BookOpen, Archive, RotateCcw, Printer, Info } from 'lucide-react';

interface Props {
  archivedPayrolls: PayrollRecord[];
  selectedMonth: string;
  handleUndoPayroll: (employeeId?: string) => void;
  handlePrintPayslip: (payroll: PayrollRecord) => void;
}

const LedgerTab: React.FC<Props> = ({
  archivedPayrolls, selectedMonth, handleUndoPayroll, handlePrintPayslip,
}) => (
  <div className="animate-in fade-in duration-500 space-y-8">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><BookOpen className="w-6 h-6" /></div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Sổ Cái Quỹ Lương Đã Chốt</h3>
          <p className="text-sm text-slate-500 font-medium italic">Lịch sử chi trả lương chính thức tháng {selectedMonth}.</p>
        </div>
      </div>
      {archivedPayrolls.length > 0 && (
        <button
          onClick={() => handleUndoPayroll()}
          className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-rose-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Hủy chốt toàn bộ tháng
        </button>
      )}
    </div>

    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto max-h-[650px] no-scrollbar">
        <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
          <thead className="bg-slate-900 text-white sticky top-0 z-30">
            <tr className="text-[10px] font-black uppercase tracking-widest">
              <th className="px-6 py-5 sticky left-0 bg-slate-900 z-40 border-r border-white/10 w-[200px]">Nhân viên</th>
              <th className="px-6 py-5 w-[150px]">Lương CB</th>
              <th className="px-6 py-5 w-[200px]">Phụ Cấp</th>
              <th className="px-6 py-5 w-[200px]">Thưởng Tết</th>
              <th className="px-6 py-5 w-[150px]">Khấu trừ</th>
              <th className="px-6 py-5 sticky right-0 bg-slate-900 z-40 border-l border-white/10 w-[150px]">Thực Nhận</th>
              <th className="px-6 py-5 text-center w-[150px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px] font-bold bg-white">
            {archivedPayrolls.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center opacity-40">
                  <Archive className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm font-black text-slate-500 uppercase">Chưa ghi nhận dữ liệu chốt lương cho tháng {selectedMonth}</p>
                </td>
              </tr>
            ) : (
              archivedPayrolls.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-5 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-50 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                    <p className="text-sm font-black text-slate-800">{p.employeeName}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{p.isOfficial ? 'Chính thức' : 'Học việc'}</p>
                    {p.calculationNote && (
                      <div className="mt-2 group/note relative">
                        <div className="flex items-center gap-1 text-[8px] text-indigo-400 font-black cursor-help">
                          <Info className="w-2.5 h-2.5" /> XEM LOGIC
                        </div>
                        <div className="absolute left-0 top-full mt-1 w-64 p-3 bg-slate-900 text-white rounded-xl text-[9px] font-medium leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[99] shadow-2xl border border-white/10">
                          {p.calculationNote.split(' | ').map((line, i) => (
                            <div key={i} className="mb-1">• {line}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5 text-slate-600">{(p.basicSalary || 0).toLocaleString()}</td>
                  <td className="px-6 py-5">
                    <p className="text-indigo-600">P.Cấp: {(p.allowance || 0).toLocaleString()}</p>
                    <p className="text-indigo-400">T.Nhiệm: {(p.responsibilityPay || 0).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-rose-600 font-black">Trước: {(p.tetBonusBefore || 0).toLocaleString()}</p>
                    <p className="text-amber-600 font-black">Sau: {(p.tetBonusAfter || 0).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-5 text-rose-500">
                    <p>VP: {(p.fine || 0).toLocaleString()}</p>
                    <p className="opacity-70">Thiếu: {(p.shortage || 0).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-5 sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-50 shadow-[-2px_0_5_rgba(0,0,0,0.02)]">
                    <span className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-black shadow-lg">
                      {(p.netPay || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => handlePrintPayslip(p)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => handleUndoPayroll(p.employeeId)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><RotateCcw className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default LedgerTab;
