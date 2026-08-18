import React from 'react';
import { PayrollRecord } from '../../types';
import { BookOpen, Archive, RotateCcw, Printer, Info } from 'lucide-react';

interface Props {
  payrolls: PayrollRecord[];
  handleUndoPayroll: (employeeId: string, month: string) => void;
  handlePrintPayslip: (payroll: PayrollRecord) => void;
}

const money = (value?: number) => (value || 0).toLocaleString();

const LedgerTab: React.FC<Props> = ({ payrolls, handleUndoPayroll, handlePrintPayslip }) => {
  const sortedPayrolls = [...payrolls].sort((a, b) => {
    const monthCompare = b.month.localeCompare(a.month);
    if (monthCompare !== 0) return monthCompare;
    return a.employeeName.localeCompare(b.employeeName, 'vi');
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><BookOpen className="w-6 h-6" /></div>
        <div>
          <h3 className="text-2xl font-semibold text-slate-900 tracking-tight uppercase">Sổ Cái Quỹ Lương Đã Chốt</h3>
          <p className="text-sm text-slate-500 font-normal italic">Toàn bộ lịch sử chi trả lương chính thức, mọi tháng.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[650px] no-scrollbar">
          <table className="w-full text-left border-collapse table-fixed min-w-[2400px]">
            <thead className="bg-slate-900 text-white sticky top-0 z-30">
              <tr className="text-2xs font-semibold uppercase tracking-widest">
                <th className="px-4 py-5 sticky left-0 bg-slate-900 z-40 border-r border-white/10 w-[110px]">Tháng</th>
                <th className="px-4 py-5 sticky left-[110px] bg-slate-900 z-40 border-r border-white/10 w-[180px]">Nhân viên</th>
                <th className="px-4 py-5 w-[130px] text-right">Lương CB</th>
                <th className="px-4 py-5 w-[130px] text-right">Phụ cấp</th>
                <th className="px-4 py-5 w-[130px] text-right">Trách nhiệm</th>
                <th className="px-4 py-5 w-[130px] text-right">Hoa hồng</th>
                <th className="px-4 py-5 w-[130px] text-right">Tăng ca</th>
                <th className="px-4 py-5 w-[130px] text-right">Thâm niên</th>
                <th className="px-4 py-5 w-[130px] text-right">Ngày lễ</th>
                <th className="px-4 py-5 w-[130px] text-right">Tết trước</th>
                <th className="px-4 py-5 w-[130px] text-right">Tết sau</th>
                <th className="px-4 py-5 w-[130px] text-right">Tạm ứng</th>
                <th className="px-4 py-5 w-[130px] text-right">Thiếu hụt</th>
                <th className="px-4 py-5 w-[130px] text-right">Phạt</th>
                <th className="px-4 py-5 w-[150px] text-right">Khấu trừ nợ kỳ trước</th>
                <th className="px-4 py-5 w-[150px] text-right">Nợ chuyển kỳ sau</th>
                <th className="px-4 py-5 sticky right-0 bg-slate-900 z-40 border-l border-white/10 w-[150px] text-right">Thực Nhận</th>
                <th className="px-4 py-5 text-center w-[110px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-normal bg-white">
              {sortedPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-20 text-center opacity-40">
                    <Archive className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-sm font-normal text-slate-500 uppercase">Chưa ghi nhận dữ liệu chốt lương tháng nào</p>
                  </td>
                </tr>
              ) : (
                sortedPayrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-5 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-50 text-indigo-600">
                      {p.month.split('-').reverse().join('/')}
                    </td>
                    <td className="px-4 py-5 sticky left-[110px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-50">
                      <p className="text-sm font-normal text-slate-800">{p.employeeName}</p>
                      <p className="text-[9px] text-slate-400 font-normal uppercase">{p.isOfficial ? 'Chính thức' : 'Học việc'}</p>
                      {p.calculationNote && (
                        <div className="mt-2 group/note relative">
                          <div className="flex items-center gap-1 text-[8px] text-indigo-400 font-normal cursor-help">
                            <Info className="w-2.5 h-2.5" /> XEM LOGIC
                          </div>
                          <div className="absolute left-0 top-full mt-1 w-64 p-3 bg-slate-900 text-white rounded-xl text-[9px] font-normal leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-colors z-dropdown shadow-2xl border border-white/10">
                            {p.calculationNote.split(' | ').map((line, i) => (
                              <div key={i} className="mb-1">• {line}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-5 text-right text-slate-600">{money(p.basicSalary)}</td>
                    <td className="px-4 py-5 text-right text-indigo-600">{money(p.allowance)}</td>
                    <td className="px-4 py-5 text-right text-indigo-400">{money(p.responsibilityPay)}</td>
                    <td className="px-4 py-5 text-right text-emerald-600">{money(p.commissionPay)}</td>
                    <td className="px-4 py-5 text-right text-emerald-600">{money(p.overtimePay)}</td>
                    <td className="px-4 py-5 text-right text-slate-600">{money(p.seniorityBonus)}</td>
                    <td className="px-4 py-5 text-right text-slate-600">{money(p.holidayBonus)}</td>
                    <td className="px-4 py-5 text-right text-rose-600">{money(p.tetBonusBefore)}</td>
                    <td className="px-4 py-5 text-right text-amber-600">{money(p.tetBonusAfter)}</td>
                    <td className="px-4 py-5 text-right text-slate-500">{money(p.advance)}</td>
                    <td className="px-4 py-5 text-right text-rose-500">{money(p.shortage)}</td>
                    <td className="px-4 py-5 text-right text-rose-500">{money(p.fine)}</td>
                    <td className="px-4 py-5 text-right text-rose-400">{money(p.carryForwardDeduction)}</td>
                    <td className="px-4 py-5 text-right text-amber-500">{money(p.carryForwardDebtOut)}</td>
                    <td className="px-4 py-5 sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-50 text-right">
                      <span className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-normal shadow-lg">
                        {money(p.netPay)}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-colors">
                        <button onClick={() => handlePrintPayslip(p)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"><Printer className="w-4 h-4" /></button>
                        <button onClick={() => handleUndoPayroll(p.employeeId, p.month)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><RotateCcw className="w-4 h-4" /></button>
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
};

export default LedgerTab;
