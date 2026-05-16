import React from 'react';
import {
  AppData,
  PayrollRecord,
  ViolationOccurrence,
  ViolationType,
  ResponsibilityApproval,
  SalaryPolicy,
} from '../../types';
import { calculateSeniority, determineCurrentPolicy } from '../../src/lib';
import {
  BadgeCheck,
  Check,
  Info,
  PartyPopper,
  Printer,
  Save,
  UserMinus,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface Props {
  draftPayrolls: PayrollRecord[];
  archivedPayrolls: PayrollRecord[];
  data: AppData;
  selectedMonth: string;
  violationOccurrences: ViolationOccurrence[];
  violationTypes: ViolationType[];
  responsibilityApprovals: ResponsibilityApproval[];
  policies: SalaryPolicy[];
  isProcessingSettlement: string | null;
  toggleResponsibilityApproval: (employeeId: string) => void;
  handlePrintPayslip: (payroll: PayrollRecord) => void;
  handleFinalizeIndividual: (payroll: PayrollRecord) => void;
  handleSettlementAndResignation: (payroll: PayrollRecord) => void;
}

const AccruedDetail = ({
  label,
  value,
  isCut = false,
}: {
  label: string;
  value: number;
  isCut?: boolean;
}) => (
  <div className="flex justify-between items-center py-1 text-[10px] border-b border-slate-50/50">
    <span className={`font-normal ${isCut ? 'text-rose-400' : 'text-slate-600'}`}>{label}</span>
    <div className="text-right">
      <span className={`font-normal ${isCut ? 'text-rose-500' : 'text-indigo-600'}`}>
        {(value || 0).toLocaleString()}đ
      </span>
      {!isCut && value > 0 && (
        <p className="text-[7px] text-slate-400 uppercase font-normal tracking-tighter leading-none">
          Tích lũy
        </p>
      )}
    </div>
  </div>
);

const PaySlipDetail = ({
  label,
  value,
  isCut = false,
}: {
  label: string;
  value: number;
  isCut?: boolean;
}) => (
  <div className="flex justify-between items-center py-0.5 text-[10px]">
    <span className={`font-normal ${isCut ? 'text-rose-500' : 'text-slate-400'}`}>{label}:</span>
    <span className={`font-normal ${isCut ? 'text-rose-600' : 'text-slate-600'}`}>
      {(value || 0).toLocaleString()}
    </span>
  </div>
);

const SummaryTab: React.FC<Props> = ({
  draftPayrolls,
  archivedPayrolls,
  data,
  selectedMonth,
  violationOccurrences,
  violationTypes,
  responsibilityApprovals,
  policies,
  isProcessingSettlement,
  toggleResponsibilityApproval,
  handlePrintPayslip,
  handleFinalizeIndividual,
  handleSettlementAndResignation,
}) => (
  <div className="animate-in fade-in duration-500 space-y-16 pb-20">
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
            <BadgeCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              Phiếu Lương Dự Thảo (Tích lũy đến hôm nay)
            </h3>
            <p className="text-sm text-slate-500 font-normal italic">
              Số tiền tích lũy tăng dần theo ngày công thực tế.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
        {draftPayrolls.map(payroll => {
          const isArchived = archivedPayrolls.some(ap => ap.employeeId === payroll.employeeId);
          const emp = data.employees.find(e => e.id === payroll.employeeId);
          const seniorityDays = emp ? calculateSeniority(emp.joinDate) : 0;
          const { policy: currentPolicy } = determineCurrentPolicy(emp!, policies, seniorityDays);
          const isApproved = responsibilityApprovals.some(
            ra => ra.employeeId === payroll.employeeId && ra.month === selectedMonth
          );

          if (!currentPolicy) return null;

          const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
          const daysInMonthTotal = new Date(yearNum, monthNum, 0).getDate();
          const monthAttendance = data.attendance.filter(
            a => a.employeeId === payroll.employeeId && a.date.startsWith(selectedMonth)
          );
          const workingDays = monthAttendance.filter(a => a.status === 'Present').length;
          const proRateFactor = daysInMonthTotal > 0 ? workingDays / daysInMonthTotal : 0;

          const employeeViolations = violationOccurrences.filter(
            vo => vo.employeeId === payroll.employeeId && vo.month === selectedMonth
          );
          const checkPenalty = (keyword: string) =>
            employeeViolations.some(vo => {
              const vt = violationTypes.find(v => v.id === vo.violationTypeId);
              if (!vt) return false;
              const pStr = (
                vo.occurrence === 1
                  ? vt.fine1
                  : vo.occurrence === 2
                    ? vt.fine2
                    : vo.occurrence === 3
                      ? vt.fine3
                      : ''
              ).toLowerCase();
              return pStr.includes(keyword);
            });

          const isAttendanceCut = checkPenalty('chuyên cần');
          const isCleaningCut = checkPenalty('vệ sinh');
          const isCSKHCut = checkPenalty('cskh');
          const isDinnerCut = checkPenalty('ăn tối');
          const isHousingCut =
            checkPenalty('hỗ trợ ở') || checkPenalty('nhà ở') || checkPenalty('mất ở');
          const isResponsibilityCut = checkPenalty('trách nhiệm');

          const isProcessing = isProcessingSettlement === payroll.employeeId;
          const isResigned = emp
            ? !!(emp.resignedDate && String(emp.resignedDate).trim() !== '')
            : false;

          return (
            <div
              key={payroll.employeeId}
              className={`bg-white border border-slate-200 flex flex-col h-full rounded-[2.5rem] relative transition-all hover:shadow-2xl hover:border-slate-300 overflow-hidden ${isResigned ? 'bg-slate-50 opacity-80' : ''}`}
            >
              <div className="p-8 border-b border-slate-100 flex flex-col items-center relative">
                {isArchived && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[8px] font-normal bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Đã chốt
                    </span>
                  </div>
                )}
                <h4
                  className={`font-normal text-xl uppercase tracking-tight text-center ${isResigned ? 'text-slate-400' : 'text-slate-900'}`}
                >
                  {payroll.employeeName}
                </h4>
                <div className="mt-2">
                  <span
                    className={`text-[10px] font-normal uppercase tracking-widest px-3 py-1 border ${payroll.isOfficial ? 'border-emerald-200 text-emerald-600' : 'border-amber-200 text-amber-600'}`}
                  >
                    {currentPolicy.name}
                  </span>
                </div>
                {isResigned && (
                  <div className="mt-2 bg-rose-600 text-white px-3 py-1 rounded-full text-[8px] font-normal uppercase">
                    ĐÃ NGHỈ VIỆC
                  </div>
                )}
              </div>

              <div className="p-6 space-y-3 flex-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-normal text-slate-700">Lương Cơ Bản (Thực nhận)</span>
                  <span className="font-normal text-slate-900">
                    {(payroll.basicSalary || 0).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center text-[11px] font-normal text-indigo-600 uppercase border-b border-slate-50 pb-1">
                    <span>Phụ Cấp (Tích lũy theo công)</span>
                    <span>{(payroll.allowance || 0).toLocaleString()}</span>
                  </div>
                  <div className="pl-4 space-y-1">
                    {currentPolicy.attendanceAllowance > 0 && (
                      <AccruedDetail
                        label="Chuyên cần"
                        value={Math.round(
                          (isAttendanceCut ? 0 : currentPolicy.attendanceAllowance) * proRateFactor
                        )}
                        isCut={isAttendanceCut}
                      />
                    )}
                    {currentPolicy.cleaningAllowance > 0 && (
                      <AccruedDetail
                        label="Vệ sinh"
                        value={Math.round(
                          (isCleaningCut ? 0 : currentPolicy.cleaningAllowance) * proRateFactor
                        )}
                        isCut={isCleaningCut}
                      />
                    )}
                    {currentPolicy.customerServiceAllowance > 0 && (
                      <AccruedDetail
                        label="CSKH"
                        value={Math.round(
                          (isCSKHCut ? 0 : currentPolicy.customerServiceAllowance) * proRateFactor
                        )}
                        isCut={isCSKHCut}
                      />
                    )}
                    {currentPolicy.dinnerAllowance > 0 && (
                      <AccruedDetail
                        label="Ăn tối"
                        value={Math.round(
                          (isDinnerCut ? 0 : currentPolicy.dinnerAllowance) * workingDays
                        )}
                        isCut={isDinnerCut}
                      />
                    )}
                    {currentPolicy.housingAllowance > 0 && (
                      <AccruedDetail
                        label="Hỗ trợ ở"
                        value={Math.round(
                          (isHousingCut ? 0 : currentPolicy.housingAllowance) * proRateFactor
                        )}
                        isCut={isHousingCut}
                      />
                    )}
                    {currentPolicy.responsibilityAllowance > 0 && (
                      <div className="flex justify-between items-center py-1 group/resp">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleResponsibilityApproval(payroll.employeeId)}
                            className={`transition-all ${isApproved ? 'text-indigo-600' : 'text-slate-300'}`}
                          >
                            {isApproved ? (
                              <ToggleRight className="w-6 h-6" />
                            ) : (
                              <ToggleLeft className="w-6 h-6" />
                            )}
                          </button>
                          <span
                            className={`text-[10px] font-normal uppercase tracking-tighter ${isApproved && !isResponsibilityCut ? 'text-indigo-600' : 'text-slate-400'} ${isResponsibilityCut ? 'text-rose-400' : ''}`}
                          >
                            Trách nhiệm
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-normal ${isApproved && !isResponsibilityCut ? 'text-indigo-600' : 'text-slate-500'}`}
                        >
                          {Math.round(
                            (isResponsibilityCut ? 0 : currentPolicy.responsibilityAllowance || 0) *
                              proRateFactor
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="font-normal text-slate-700">
                    Hoa Hồng ({currentPolicy.commissionRate || 0}%)
                  </span>
                  <span className="font-normal text-emerald-600">
                    {(payroll.commissionPay || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-normal text-slate-700">Tăng Ca (OT)</span>
                  <span className="font-normal text-amber-600">
                    {(payroll.overtimePay || 0).toLocaleString()}
                  </span>
                </div>

                {payroll.holidayBonus > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-normal text-slate-700">Thưởng Lễ</span>
                    <span className="font-normal text-amber-600">
                      {(payroll.holidayBonus || 0).toLocaleString()}
                    </span>
                  </div>
                )}

                {payroll.tetBonus > 0 && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2 mt-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10">
                      <PartyPopper className="w-12 h-12 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-1 relative z-10">
                      <PartyPopper className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[9px] font-normal text-amber-800 uppercase tracking-widest">
                        Phúc lợi Tết Nguyên Đán
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] relative z-10">
                      <span className="font-normal text-amber-700">Trước Tết (Xe & Trực chiến)</span>
                      <span className="font-normal text-amber-900">
                        {(payroll.tetBonusBefore || 0).toLocaleString()}đ
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] relative z-10">
                      <span className="font-normal text-amber-700">Sau Tết (Lì xì & Chuyên cần)</span>
                      <span className="font-normal text-amber-900">
                        {(payroll.tetBonusAfter || 0).toLocaleString()}đ
                      </span>
                    </div>
                  </div>
                )}

                {payroll.seniorityBonus > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-normal text-slate-700">Thâm Niên</span>
                    <span className="font-normal text-indigo-600">
                      {(payroll.seniorityBonus || 0).toLocaleString()}
                    </span>
                  </div>
                )}

                {(payroll.fine > 0 || payroll.shortage > 0 || payroll.advance > 0) && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-50 mt-2">
                    <div className="flex justify-between items-center text-[11px] font-normal text-rose-500 uppercase pb-1">
                      <span>Khấu Trừ Tài Chính</span>
                      <span>
                        -
                        {(
                          (payroll.fine || 0) +
                          (payroll.shortage || 0) +
                          (payroll.advance || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="pl-4 space-y-1">
                      {payroll.fine > 0 && (
                        <PaySlipDetail
                          label="Vi phạm / Kỷ luật / vắng"
                          value={payroll.fine}
                          isCut={true}
                        />
                      )}
                      {payroll.shortage > 0 && (
                        <PaySlipDetail label="Tiền thiếu" value={payroll.shortage} isCut={true} />
                      )}
                      {payroll.advance > 0 && (
                        <PaySlipDetail
                          label="Tiền tạm ứng trong tháng"
                          value={payroll.advance}
                          isCut={true}
                        />
                      )}
                    </div>
                  </div>
                )}

                {payroll.calculationNote && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1.5 text-slate-400">
                      <Info className="w-3 h-3" />
                      <span className="text-[9px] font-normal uppercase tracking-widest">
                        Diễn giải cách tính
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal leading-relaxed italic">
                      {payroll.calculationNote.split(' | ').map((note, i) => (
                        <div key={i} className="flex items-start gap-1">
                          <span className="opacity-40">•</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-900 space-y-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-normal text-slate-400 uppercase tracking-[0.2em] mb-1">
                    Tổng lương thực nhận
                  </span>
                  <div className="text-3xl font-normal text-white tabular-nums">
                    {(payroll.netPay || 0).toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-500">VNĐ</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePrintPayslip(payroll)}
                      className="py-3 rounded-xl font-normal text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Printer className="w-3.5 h-3.5" /> In Phiếu
                    </button>
                    <button
                      onClick={() => handleFinalizeIndividual(payroll)}
                      disabled={isArchived}
                      className={`py-3 rounded-xl font-normal text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        isArchived
                          ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-white text-slate-900 hover:bg-indigo-50'
                      }`}
                    >
                      {isArchived ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      {isArchived ? 'Đã Chốt' : 'Chốt & Lưu'}
                    </button>
                  </div>
                  {!isResigned || isProcessing ? (
                    <button
                      onClick={() => handleSettlementAndResignation(payroll)}
                      disabled={isProcessing || isArchived}
                      className={`w-full py-3.5 rounded-xl font-normal text-[9px] uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border ${
                        isArchived
                          ? 'border-slate-700 text-slate-600 bg-slate-800/20 cursor-not-allowed'
                          : 'border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500 hover:text-white'
                      } disabled:opacity-50`}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4" />
                      )}
                      QUYẾT TOÁN NGHỈ VIỆC
                    </button>
                  ) : (
                    <div className="w-full py-3.5 bg-rose-900/40 text-rose-200 border-rose-800 border rounded-xl text-center">
                      <p className="text-[10px] font-normal uppercase tracking-widest flex items-center justify-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5" /> ĐÃ QUYẾT TOÁN
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  </div>
);

export default SummaryTab;
