import React from 'react';
import { Printer, X as LucideX } from 'lucide-react';
import {
  AppData,
  PayrollRecord,
  ResponsibilityApproval,
  SalaryPolicy,
  ViolationOccurrence,
  ViolationType,
} from '../../types';
import {
  calculateSeniority,
  determineCurrentPolicy,
  shouldCutAttendanceAllowanceByLeave,
} from '../../src/lib';

interface PayrollPrintPreviewModalProps {
  payroll: PayrollRecord;
  data: AppData;
  selectedMonth: string;
  policies: SalaryPolicy[];
  violationOccurrences: ViolationOccurrence[];
  violationTypes: ViolationType[];
  responsibilityApprovals: ResponsibilityApproval[];
  onClose: () => void;
  onConfirmPrint: () => void;
}

export const PayrollPrintPreviewModal: React.FC<PayrollPrintPreviewModalProps> = ({
  payroll,
  data,
  selectedMonth,
  policies,
  violationOccurrences,
  violationTypes,
  responsibilityApprovals,
  onClose,
  onConfirmPrint,
}) => {
  const emp = data.employees.find(e => e.id === payroll.employeeId);
  const seniorityDays = payroll.seniorityDays || (emp ? calculateSeniority(emp.joinDate) : 0);
  const { policy: currentPolicy } = determineCurrentPolicy(emp!, policies, seniorityDays);

  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonthTotal = new Date(yearNum, monthNum, 0).getDate();
  const monthAttendance = data.attendance.filter(
    a => a.employeeId === payroll.employeeId && a.date.startsWith(selectedMonth)
  );
  const workingDays = monthAttendance.filter(a => a.status === 'Present').length;
  const totalHoursWorked = monthAttendance
    .filter(a => a.status === 'Present')
    .reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
  const proRateFactor = daysInMonthTotal > 0 ? workingDays / daysInMonthTotal : 0;

  const employeeViolations = violationOccurrences.filter(
    vo => vo.employeeId === payroll.employeeId && vo.month === selectedMonth
  );
  const checkPenalty = (keyword: string) =>
    employeeViolations.some(vo => {
      const vt = violationTypes.find(v => v.id === vo.violationTypeId);
      if (!vt) return false;
      const pStr = (
        vo.occurrence === 1 ? vt.fine1 : vo.occurrence === 2 ? vt.fine2 : vt.fine3
      ).toLowerCase();
      return pStr.includes(keyword);
    });

  const isAttendanceCut =
    checkPenalty('chuyên cần') || shouldCutAttendanceAllowanceByLeave(monthAttendance);
  const isCleaningCut = checkPenalty('vệ sinh');
  const isCSKHCut = checkPenalty('cskh');
  const isDinnerCut = checkPenalty('ăn tối');
  const isHousingCut = checkPenalty('hỗ trợ ở') || checkPenalty('nhà ở') || checkPenalty('mất ở');
  const isResponsibilityCut = checkPenalty('trách nhiệm');
  const isApproved = responsibilityApprovals.some(
    ra => ra.employeeId === payroll.employeeId && ra.month === selectedMonth
  );

  const otMinutes = data.overtime
    .filter(ot => ot.employeeId === payroll.employeeId && ot.date.startsWith(selectedMonth))
    .reduce((sum, record) => sum + record.hours, 0);
  const otHours = Number((otMinutes / 60).toFixed(1));

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">
              Xem trước Phiếu lương
            </h3>
            <p className="text-xs text-slate-500 font-normal uppercase">
              Khổ giấy 80mm - Máy in nhiệt
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm"
          >
            <LucideX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50 flex justify-center">
          <div
            style={{ width: '80mm' }}
            className="bg-white shadow-xl p-5 text-xs text-black leading-tight border border-slate-200"
          >
            <div className="text-center border-b border-dashed border-black pb-3 mb-3">
              <h1 className="text-[14px] font-semibold m-0">PHÚC SANG</h1>
              <p className="text-2xs my-0.5">PHIẾU THANH TOÁN LƯƠNG</p>
              <p className="text-xs font-normal my-0.5">Tháng: {payroll.month}</p>
            </div>

            <div className="mb-3 text-2xs">
              <p className="my-0.5">
                <b>NV:</b> {payroll.employeeName}
              </p>
              <p className="my-0.5">
                <b>CV:</b> {emp?.position || 'Nhân viên'} ({currentPolicy?.name})
              </p>
              <p className="my-0.5">
                <b>Loại:</b> {payroll.isOfficial ? 'Chính thức' : 'Thử việc'}
              </p>
              <p className="my-0.5">
                <b>Ngày công:</b> {workingDays}/{daysInMonthTotal} ({totalHoursWorked}h)
              </p>
            </div>

            <div className="border-t border-b border-dashed border-black py-2 mb-3">
              <div className="flex justify-between mb-1 font-normal">
                <span>Lương cơ bản:</span>
                <span>{(payroll.basicSalary || 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between mb-1 font-normal">
                <span>Phụ cấp (Theo công):</span>
                <span>{(payroll.allowance || 0).toLocaleString()}</span>
              </div>

              <div className="pl-3 space-y-0.5 text-2xs">
                {currentPolicy?.attendanceAllowance! > 0 && (
                  <div
                    className={`flex justify-between ${isAttendanceCut ? 'line-through opacity-50' : ''}`}
                  >
                    <span>- Chuyên cần:</span>
                    <span>
                      {Math.round(
                        (isAttendanceCut ? 0 : currentPolicy?.attendanceAllowance!) * proRateFactor
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {currentPolicy?.cleaningAllowance! > 0 && (
                  <div
                    className={`flex justify-between ${isCleaningCut ? 'line-through opacity-50' : ''}`}
                  >
                    <span>- Vệ sinh:</span>
                    <span>
                      {Math.round(
                        (isCleaningCut ? 0 : currentPolicy?.cleaningAllowance!) * proRateFactor
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {currentPolicy?.customerServiceAllowance! > 0 && (
                  <div
                    className={`flex justify-between ${isCSKHCut ? 'line-through opacity-50' : ''}`}
                  >
                    <span>- CSKH:</span>
                    <span>
                      {Math.round(
                        (isCSKHCut ? 0 : currentPolicy?.customerServiceAllowance!) * proRateFactor
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {currentPolicy?.dinnerAllowance! > 0 && (
                  <div
                    className={`flex justify-between ${isDinnerCut ? 'line-through opacity-50' : ''}`}
                  >
                    <span>- Ăn tối:</span>
                    <span>
                      {Math.round(
                        (isDinnerCut ? 0 : currentPolicy?.dinnerAllowance!) * workingDays
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {currentPolicy?.housingAllowance! > 0 && (
                  <div
                    className={`flex justify-between ${isHousingCut ? 'line-through opacity-50' : ''}`}
                  >
                    <span>- Hỗ trợ ở:</span>
                    <span>
                      {Math.round(
                        (isHousingCut ? 0 : currentPolicy?.housingAllowance!) * proRateFactor
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {currentPolicy?.responsibilityAllowance! > 0 && (
                <div
                  className={`flex justify-between mt-1 font-normal ${!isApproved || isResponsibilityCut ? 'line-through opacity-50' : ''}`}
                >
                  <span>Trách nhiệm:</span>
                  <span>
                    {Math.round(
                      (isResponsibilityCut ? 0 : currentPolicy?.responsibilityAllowance || 0) *
                        proRateFactor
                    ).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex justify-between mt-1">
                <span>Hoa hồng ({currentPolicy?.commissionRate}%):</span>
                <span>{(payroll.commissionPay || 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between">
                <span>Tăng ca ({otHours}h):</span>
                <span>{(payroll.overtimePay || 0).toLocaleString()}</span>
              </div>

              {payroll.holidayBonus > 0 && (
                <div className="flex justify-between">
                  <span>Thưởng Lễ:</span>
                  <span>{(payroll.holidayBonus || 0).toLocaleString()}</span>
                </div>
              )}

              {payroll.tetBonus > 0 && (
                <div className="mt-1">
                  <div className="flex justify-between">
                    <span>Thưởng Tết (Trước):</span>
                    <span>{(payroll.tetBonusBefore || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thưởng Tết (Sau):</span>
                    <span>{(payroll.tetBonusAfter || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {payroll.seniorityBonus > 0 && (
                <div className="flex justify-between">
                  <span>Thâm niên:</span>
                  <span>{(payroll.seniorityBonus || 0).toLocaleString()}</span>
                </div>
              )}

              {(payroll.fine > 0 || payroll.shortage > 0 || payroll.advance > 0) && (
                <div className="mt-2 border-t border-dashed border-black pt-1">
                  <div className="flex justify-between font-normal">
                    <span>Khấu trừ:</span>
                    <span>
                      -
                      {(
                        (payroll.fine || 0) +
                        (payroll.shortage || 0) +
                        (payroll.advance || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="pl-3 space-y-0.5 text-2xs">
                    {payroll.fine > 0 && (
                      <div className="flex justify-between">
                        <span>- Vi phạm/Vắng:</span>
                        <span>{payroll.fine.toLocaleString()}</span>
                      </div>
                    )}
                    {payroll.shortage > 0 && (
                      <div className="flex justify-between">
                        <span>- Tiền thiếu:</span>
                        <span>{payroll.shortage.toLocaleString()}</span>
                      </div>
                    )}
                    {payroll.advance > 0 && (
                      <div className="flex justify-between">
                        <span>- Tạm ứng:</span>
                        <span>{payroll.advance.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between text-[14px] font-normal mb-4">
              <span>THỰC NHẬN:</span>
              <span>{(payroll.netPay || 0).toLocaleString()}</span>
            </div>

            <div className="text-center text-[9px] mt-3 border-t border-dashed border-black pt-2">
              <p className="my-0.5">Cảm ơn bạn đã đồng hành!</p>
              <p className="my-0.5 italic">Hệ thống Quản trị Phúc Sang</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 px-6 rounded-2xl font-normal text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200"
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirmPrint}
            className="flex-[2] py-4 px-6 rounded-2xl font-normal text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Xác nhận In Phiếu
          </button>
        </div>
      </div>
    </div>
  );
};
