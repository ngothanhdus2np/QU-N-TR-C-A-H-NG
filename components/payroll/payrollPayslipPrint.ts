import {
  AppData,
  PayrollRecord,
  ResponsibilityApproval,
  SalaryPolicy,
  ViolationOccurrence,
  ViolationType,
} from '../../types';
import { calculateSeniority, determineCurrentPolicy } from '../../businessLogic';

interface BuildPayrollPayslipHtmlArgs {
  payroll: PayrollRecord;
  data: AppData;
  selectedMonth: string;
  policies: SalaryPolicy[];
  violationOccurrences: ViolationOccurrence[];
  violationTypes: ViolationType[];
  responsibilityApprovals: ResponsibilityApproval[];
}

const buildAllowanceLine = (label: string, amount: number, isCut: boolean) => `
                <div class="flex-between ${isCut ? 'cut' : ''}">
                  <span>- ${label}:</span>
                  <span>${Math.round(amount).toLocaleString()}</span>
                </div>`;

export const buildPayrollPayslipHtml = ({
  payroll,
  data,
  selectedMonth,
  policies,
  violationOccurrences,
  violationTypes,
  responsibilityApprovals,
}: BuildPayrollPayslipHtmlArgs): string | null => {
  const emp = data.employees.find(e => e.id === payroll.employeeId);
  if (!emp) return null;

  const seniorityDays = payroll.seniorityDays || calculateSeniority(emp.joinDate);
  const { policy: currentPolicy } = determineCurrentPolicy(emp, policies, seniorityDays);
  if (!currentPolicy) return null;

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

  const isAttendanceCut = checkPenalty('chuyên cần');
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

  return `
      <html>
        <head>
          <title>In Phiếu Lương - ${payroll.employeeName}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 0; background: white; }
            .receipt {
              width: 80mm;
              padding: 5mm;
              font-family: 'Courier New', Courier, monospace;
              color: #000;
              line-height: 1.2;
              font-size: 11px;
              box-sizing: border-box;
            }
            .center { text-align: center; }
            .dashed-border { border-bottom: 1px dashed #000; }
            .flex-between { display: flex; justify-content: space-between; }
            .bold { font-weight: 900; }
            .margin-y-2 { margin: 2px 0; }
            .indent { padding-left: 10px; font-size: 10px; }
            .cut { text-decoration: line-through; opacity: 0.6; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center dashed-border" style="padding-bottom: 10px; margin-bottom: 10px;">
              <h1 style="font-size: 14px; font-weight: 900; margin: 0;">PHÚC SANG</h1>
              <p style="font-size: 10px; margin: 2px 0;">PHIẾU THANH TOÁN LƯƠNG</p>
              <p style="font-size: 12px; font-weight: 700; margin: 2px 0;">Tháng: ${payroll.month}</p>
            </div>

            <div style="margin-bottom: 10px; font-size: 10px;">
              <p class="margin-y-2"><b>NV:</b> ${payroll.employeeName}</p>
              <p class="margin-y-2"><b>CV:</b> ${emp.position || 'Nhân viên'} (${currentPolicy.name})</p>
              <p class="margin-y-2"><b>Loại:</b> ${payroll.isOfficial ? 'Chính thức' : 'Thử việc'}</p>
              <p class="margin-y-2"><b>Ngày công:</b> ${workingDays}/${daysInMonthTotal} (${totalHoursWorked}h)</p>
            </div>

            <div class="dashed-border" style="border-top: 1px dashed #000; padding: 5px 0; margin-bottom: 10px;">
              <div class="flex-between" style="margin-bottom: 3px;">
                <span class="bold">Lương cơ bản:</span>
                <span class="bold">${(payroll.basicSalary || 0).toLocaleString()}</span>
              </div>

              <div class="flex-between" style="margin-bottom: 2px;">
                <span class="bold">Phụ cấp (Theo công):</span>
                <span class="bold">${(payroll.allowance || 0).toLocaleString()}</span>
              </div>

              <div class="indent">
                ${
                  currentPolicy.attendanceAllowance > 0
                    ? buildAllowanceLine(
                        'Chuyên cần',
                        (isAttendanceCut ? 0 : currentPolicy.attendanceAllowance) * proRateFactor,
                        isAttendanceCut
                      )
                    : ''
                }
                ${
                  currentPolicy.cleaningAllowance > 0
                    ? buildAllowanceLine(
                        'Vệ sinh',
                        (isCleaningCut ? 0 : currentPolicy.cleaningAllowance) * proRateFactor,
                        isCleaningCut
                      )
                    : ''
                }
                ${
                  currentPolicy.customerServiceAllowance > 0
                    ? buildAllowanceLine(
                        'CSKH',
                        (isCSKHCut ? 0 : currentPolicy.customerServiceAllowance) * proRateFactor,
                        isCSKHCut
                      )
                    : ''
                }
                ${
                  currentPolicy.dinnerAllowance > 0
                    ? buildAllowanceLine(
                        'Ăn tối',
                        (isDinnerCut ? 0 : currentPolicy.dinnerAllowance) * workingDays,
                        isDinnerCut
                      )
                    : ''
                }
                ${
                  currentPolicy.housingAllowance > 0
                    ? buildAllowanceLine(
                        'Hỗ trợ ở',
                        (isHousingCut ? 0 : currentPolicy.housingAllowance) * proRateFactor,
                        isHousingCut
                      )
                    : ''
                }
              </div>

              ${
                currentPolicy.responsibilityAllowance > 0
                  ? `
              <div class="flex-between ${!isApproved || isResponsibilityCut ? 'cut' : ''}" style="margin-top: 3px;">
                <span class="bold">Trách nhiệm:</span>
                <span class="bold">${Math.round((isResponsibilityCut ? 0 : currentPolicy.responsibilityAllowance || 0) * proRateFactor).toLocaleString()}</span>
              </div>`
                  : ''
              }

              <div class="flex-between" style="margin-top: 3px;">
                <span>Hoa hồng (${currentPolicy.commissionRate}%):</span>
                <span>${(payroll.commissionPay || 0).toLocaleString()}</span>
              </div>

              <div class="flex-between">
                <span>Tăng ca (${otHours}h):</span>
                <span>${(payroll.overtimePay || 0).toLocaleString()}</span>
              </div>

              ${
                payroll.holidayBonus > 0
                  ? `
              <div class="flex-between">
                <span>Thưởng Lễ:</span>
                <span>${(payroll.holidayBonus || 0).toLocaleString()}</span>
              </div>`
                  : ''
              }

              ${
                payroll.tetBonus > 0
                  ? `
              <div style="margin-top: 3px;">
                <div class="flex-between">
                  <span>Thưởng Tết (Trước):</span>
                  <span>${(payroll.tetBonusBefore || 0).toLocaleString()}</span>
                </div>
                <div class="flex-between">
                  <span>Thưởng Tết (Sau):</span>
                  <span>${(payroll.tetBonusAfter || 0).toLocaleString()}</span>
                </div>
              </div>`
                  : ''
              }

              ${
                payroll.seniorityBonus > 0
                  ? `
              <div class="flex-between">
                <span>Thâm niên:</span>
                <span>${(payroll.seniorityBonus || 0).toLocaleString()}</span>
              </div>`
                  : ''
              }

              ${
                payroll.fine > 0 || payroll.shortage > 0 || payroll.advance > 0
                  ? `
              <div style="margin-top: 5px; border-top: 1px dashed #000; padding-top: 3px;">
                <div class="flex-between bold">
                  <span>Khấu trừ:</span>
                  <span>-${((payroll.fine || 0) + (payroll.shortage || 0) + (payroll.advance || 0)).toLocaleString()}</span>
                </div>
                <div class="indent">
                  ${payroll.fine > 0 ? `<div class="flex-between"><span>- Vi phạm/Vắng:</span><span>${payroll.fine.toLocaleString()}</span></div>` : ''}
                  ${payroll.shortage > 0 ? `<div class="flex-between"><span>- Tiền thiếu:</span><span>${payroll.shortage.toLocaleString()}</span></div>` : ''}
                  ${payroll.advance > 0 ? `<div class="flex-between"><span>- Tạm ứng:</span><span>${payroll.advance.toLocaleString()}</span></div>` : ''}
                </div>
              </div>`
                  : ''
              }
            </div>

            <div class="flex-between" style="font-size: 14px; font-weight: 900; margin-bottom: 15px;">
              <span>THỰC NHẬN:</span>
              <span>${(payroll.netPay || 0).toLocaleString()}</span>
            </div>

            <div class="center" style="font-size: 9px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px;">
              <p class="margin-y-2">Cảm ơn bạn đã đồng hành!</p>
              <p class="margin-y-2" style="font-style: italic;">Hệ thống Quản trị Phúc Sang</p>
              <p style="margin: 5px 0 0 0;">Ngày in: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
};
