import React from 'react';
import {
  AppData,
  AttendanceRecord,
  PayrollRecord,
  Employee,
  ExpenseRecord,
  StaffPerformanceRecord,
  PayrollSubTab,
  AppDataSurgicalUpdate,
  UpdateAppData,
} from '../types';
import {
  Activity,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  FileDown,
  Gavel,
  Landmark,
  LayoutList,
  ListChecks,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  calculateSeniority,
  determineCurrentPolicy,
  generateId,
} from '../src/lib';
import { getPayrollSalaryCost } from '../src/lib/staffPerformanceLedger';
import { exportToExcel as xlsxExport } from '../services/exportService';
import AttendanceTab from './payroll/AttendanceTab';
import OvertimeTab from './payroll/OvertimeTab';
import SalesTab from './payroll/SalesTab';
import PenaltiesTab from './payroll/PenaltiesTab';
import SummaryTab from './payroll/SummaryTab';
import LedgerTab from './payroll/LedgerTab';
import { PayrollPrintPreviewModal } from './payroll/PayrollPrintPreviewModal';
import { buildPayrollPayslipHtml } from './payroll/payrollPayslipPrint';
import { usePayrollState } from '../hooks/usePayrollState';
import { useToast } from './ui/Toast';

interface Props {
  data: AppData;
  onUpdateData: UpdateAppData;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  showResigned: boolean;
  setShowResigned: (val: boolean) => void;
  requestedTab?: PayrollSubTab;
  onSelectMainTab?: (tab: string) => void;
}

const PEOPLE_NAV_ITEMS = [
  { id: 'staff', label: 'Danh sách nhân sự', icon: UserPlus },
  { id: 'staff-ledger', label: 'Sổ cái hiệu năng', icon: LayoutList },
];

const PAYROLL_NAV_ITEMS: Array<{ id: PayrollSubTab; label: string; icon: React.ElementType }> = [
  { id: 'attendance', label: 'Chấm công', icon: ListChecks },
  { id: 'overtime', label: 'Tăng ca', icon: Clock },
  { id: 'sales', label: 'Doanh số', icon: TrendingUp },
  { id: 'penalties', label: 'Các khoản khấu trừ', icon: Gavel },
  { id: 'summary', label: 'Bảng lương', icon: Activity },
  { id: 'ledger', label: 'Sổ cái lương', icon: Landmark },
];

const PayrollManager: React.FC<Props> = ({
  data,
  onUpdateData,
  onUpdateSurgical,
  showResigned,
  setShowResigned,
  requestedTab,
  onSelectMainTab,
}) => {
  const { showToast } = useToast();
  const {
    subTab,
    setSubTab,
    selectedMonth,
    setSelectedMonth,
    showPrintPreview,
    selectedPayrollForPrint,
    isProcessingSettlement,
    setIsProcessingSettlement,
    WORKING_DAYS_FIXED,
    STANDARD_HOURS_PER_DAY,
    policies,
    holidays,
    violationTypes,
    violationOccurrences,
    responsibilityApprovals,
    shortages,
    advances,
    tet,
    archivedPayrolls,
    archivedEmployeeIds,
    employees,
    draftPayrolls,
    staffRankings,
    getDaysInMonth,
    isHoliday,
    calculateTotalHours,
    calculateTotalOvertimeHours,
    calculateTotalSalesAmount,
    calculateTotalShortageAmount,
    calculateTotalAdvanceAmount,
    openPrintPreview,
    closePrintPreview,
  } = usePayrollState({ data, showResigned, requestedTab });

  const handlePrintPayslip = (payroll: PayrollRecord) => {
    openPrintPreview(payroll);
  };

  const handleConfirmPrint = () => {
    if (!selectedPayrollForPrint) return;
    const printHtml = buildPayrollPayslipHtml({
      payroll: selectedPayrollForPrint,
      data,
      selectedMonth,
      policies,
      violationOccurrences,
      violationTypes,
      responsibilityApprovals,
    });

    if (!printHtml) return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    } else {
      showToast('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in phiếu lương.', 'warning');
    }

    closePrintPreview();
  };

  const handleFinalizeIndividual = async (
    payroll: PayrollRecord,
    isSettlement: boolean = false
  ) => {
    const isAlreadyArchived = archivedPayrolls.some(ap => ap.employeeId === payroll.employeeId);
    if (isAlreadyArchived && !isSettlement) {
      if (
        !confirm(
          `Nhân viên ${payroll.employeeName} đã có dữ liệu chốt lương tháng ${selectedMonth}. Bạn có muốn cập nhật lại bản lưu không?`
        )
      )
        return;
    }

    const netPayVal = Math.round(Number(payroll.netPay) || 0);
    if (isNaN(netPayVal)) {
      showToast(
        'Lỗi: Giá trị thực nhận không hợp lệ (NaN). Vui lòng kiểm tra lại bảng chấm công của nhân viên này.',
        'error'
      );
      return;
    }

    const salaryCost = getPayrollSalaryCost(payroll);
    const totalSales = calculateTotalSalesAmount(payroll.employeeId);
    const roi = salaryCost > 0 ? totalSales / salaryCost : 0;
    const rankObj = staffRankings.find(r => r.id === payroll.employeeId);

    // Create Performance Record
    const existingPerf = (data.staffPerformance || []).find(
      p => p.employeeId === payroll.employeeId && p.month === selectedMonth
    );
    const perfRecord: StaffPerformanceRecord = {
      id: existingPerf?.id || generateId(),
      employeeId: payroll.employeeId,
      employeeName: payroll.employeeName,
      month: selectedMonth,
      totalSales,
      totalIncome: salaryCost,
      roi,
      rank: rankObj?.rank,
    };

    const today = new Date().toISOString().split('T')[0];
    const expenseDate = isSettlement
      ? today
      : `${selectedMonth}-${getDaysInMonth(selectedMonth).toString().padStart(2, '0')}`;
    const expenseDesc = `${isSettlement ? 'Quyết toán lương nghỉ việc' : 'Chi lương tháng ' + selectedMonth.split('-').reverse().join('/')} - ${payroll.employeeName}`;

    const existingExpense = data.expenses.find(e => e.description === expenseDesc);
    const newExpense: ExpenseRecord = {
      id: existingExpense?.id || generateId(),
      date: expenseDate,
      category: 'Lương & Thưởng',
      amount: salaryCost,
      description: expenseDesc,
    };

    const currentPayrollEntry = data.payroll.find(
      p => p.employeeId === payroll.employeeId && p.month === selectedMonth
    );
    const finalPayroll = {
      ...payroll,
      id: currentPayrollEntry?.id || payroll.id,
      netPay: netPayVal,
    };

    // Cập nhật nợ chuyển kỳ cho nhân viên sau khi chốt lương
    const emp = data.employees.find(e => e.id === payroll.employeeId);
    const updatedEmpForDebt = emp
      ? { ...emp, carryForwardDebt: payroll.carryForwardDebtOut || 0 }
      : null;

    try {
      if (onUpdateSurgical) {
        const updates: Parameters<typeof onUpdateSurgical>[0] = [
          { key: 'payroll', item: finalPayroll },
          { key: 'expenses', item: newExpense },
          { key: 'staffPerformance', item: perfRecord },
        ];
        if (updatedEmpForDebt) updates.push({ key: 'employees', item: updatedEmpForDebt });
        await onUpdateSurgical(updates);
      } else {
        const updatedPayroll = data.payroll.filter(
          p => !(p.month === selectedMonth && p.employeeId === payroll.employeeId)
        );
        const updatedExpenses = (data.expenses || []).filter(e => e.description !== expenseDesc);
        const updatedPerf = (data.staffPerformance || []).filter(
          pf => !(pf.month === selectedMonth && pf.employeeId === payroll.employeeId)
        );
        onUpdateData('payroll', [...updatedPayroll, finalPayroll]);
        onUpdateData('expenses', [...updatedExpenses, newExpense]);
        onUpdateData('staffPerformance', [...updatedPerf, perfRecord]);
      }
      if (!isSettlement)
        showToast(`✅ Đã chốt lương & đúc hồ sơ hiệu năng cho ${payroll.employeeName} thành công!`, 'success');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      showToast(`❌ LỖI SAO LƯU: Không thể lưu dữ liệu lên Cloud. Chi tiết: ${message}`, 'error');
    }
  };

  const handleSettlementAndResignation = async (payroll: PayrollRecord) => {
    const today = new Date().toISOString().split('T')[0];
    const originalEmpId = payroll.employeeId;

    const netPayVal = Math.round(Number(payroll.netPay) || 0);
    if (isNaN(netPayVal)) {
      showToast('LỖI DỮ LIỆU: Giá trị thực nhận không hợp lệ. Hãy kiểm tra bảng công.', 'error');
      return;
    }

    const emp = data.employees.find(e => e.id === originalEmpId);
    if (!emp) {
      showToast('LỖI: Không tìm thấy hồ sơ nhân sự.', 'error');
      return;
    }

    const salaryCost = getPayrollSalaryCost(payroll);
    const confirmMsg = `XÁC NHẬN QUYẾT TOÁN VÀ CHO NGHỈ VIỆC\n\n- Nhân viên: ${payroll.employeeName}\n- Thực nhận: ${netPayVal.toLocaleString()}đ\n- Tổng chi lương: ${salaryCost.toLocaleString()}đ\n\nSau khi bấm OK:\n1. Lưu sổ cái lương tháng ${selectedMonth}.\n2. Ghi chi phí lương.\n3. Lưu hồ sơ hiệu năng tháng cuối.\n4. Đóng hồ sơ nhân sự ngay hôm nay (${today.split('-').reverse().join('/')}).`;

    if (!confirm(confirmMsg)) return;

    setIsProcessingSettlement(originalEmpId);

    try {
      const updates: AppDataSurgicalUpdate[] = [];
      const expenseDesc = `Quyết toán lương nghỉ việc - ${payroll.employeeName}`;

      const currentPayrollEntry = data.payroll.find(
        p => p.employeeId === originalEmpId && p.month === selectedMonth
      );
      const finalPayroll = {
        ...payroll,
        id: currentPayrollEntry?.id || generateId(),
        netPay: netPayVal,
      };
      updates.push({ key: 'payroll', item: finalPayroll });

      const existingExpense = data.expenses.find(e => e.description === expenseDesc);
      const newExpense: ExpenseRecord = {
        id: existingExpense?.id || generateId(),
        date: today,
        category: 'Lương & Thưởng',
        amount: salaryCost,
        description: expenseDesc,
      };
      updates.push({ key: 'expenses', item: newExpense });

      // Add performance capture for last month
      const totalSales = calculateTotalSalesAmount(originalEmpId);
      const roi = salaryCost > 0 ? totalSales / salaryCost : 0;
      const existingPerf = (data.staffPerformance || []).find(
        p => p.employeeId === originalEmpId && p.month === selectedMonth
      );
      updates.push({
        key: 'staffPerformance',
        item: {
          id: existingPerf?.id || generateId(),
          employeeId: originalEmpId,
          employeeName: payroll.employeeName,
          month: selectedMonth,
          totalSales,
          totalIncome: salaryCost,
          roi,
        },
      });

      const updatedEmployee = {
        ...emp,
        resignedDate: today,
      };
      updates.push({ key: 'employees', item: updatedEmployee });

      if (onUpdateSurgical) {
        await onUpdateSurgical(updates);
        showToast(
          `✅ Đã quyết toán thành công cho ${payroll.employeeName}!\n\nHồ sơ đã được đóng và Headcount đã cập nhật.`,
          'success'
        );
      } else {
        onUpdateData('payroll', [
          ...data.payroll.filter(
            p => !(p.month === selectedMonth && p.employeeId === originalEmpId)
          ),
          finalPayroll,
        ]);
        onUpdateData('expenses', [
          ...(data.expenses || []).filter(e => e.description !== expenseDesc),
          newExpense,
        ]);
        onUpdateData(
          'employees',
          data.employees.map(e => (e.id === originalEmpId ? updatedEmployee : e))
        );
        // staffPerformance update logic simplified if no onUpdateSurgical
      }
    } catch (err) {
      console.error('Critical Settlement Error:', err);
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      showToast(`Lỗi hệ thống: ${message}`, 'error');
    } finally {
      setIsProcessingSettlement(null);
    }
  };

  const handleUndoPayroll = (employeeId?: string) => {
    if (employeeId) {
      const payrollToUndo = data.payroll.find(
        p => p.month === selectedMonth && p.employeeId === employeeId
      );
      if (payrollToUndo) {
        const regularExpenseDesc = `Chi lương tháng ${selectedMonth.split('-').reverse().join('/')} - ${payrollToUndo.employeeName}`;
        const settlementExpenseDesc = `Quyết toán lương nghỉ việc - ${payrollToUndo.employeeName}`;
        onUpdateData(
          'expenses',
          data.expenses.filter(e => e.description !== regularExpenseDesc && e.description !== settlementExpenseDesc)
        );
        onUpdateData(
          'staffPerformance',
          (data.staffPerformance || []).filter(
            pf => !(pf.month === selectedMonth && pf.employeeId === employeeId)
          )
        );
      }
      onUpdateData(
        'payroll',
        data.payroll.filter(p => !(p.month === selectedMonth && p.employeeId === employeeId))
      );
    } else {
      if (
        !confirm(
          `Bạn có chắc muốn HỦY CHỐT toàn bộ bảng lương tháng ${selectedMonth}? Dữ liệu chi phí và hiệu năng tương ứng cũng sẽ bị xóa.`
        )
      )
        return;

      const monthPrefix = `Chi lương tháng ${selectedMonth.split('-').reverse().join('/')}`;
      const settlementNamesThisMonth = data.payroll
        .filter(p => p.month === selectedMonth)
        .map(p => `Quyết toán lương nghỉ việc - ${p.employeeName}`);
      onUpdateData(
        'expenses',
        data.expenses.filter(
          e => !e.description.startsWith(monthPrefix) && !settlementNamesThisMonth.includes(e.description)
        )
      );
      onUpdateData(
        'staffPerformance',
        (data.staffPerformance || []).filter(pf => pf.month !== selectedMonth)
      );
      onUpdateData(
        'payroll',
        data.payroll.filter(p => p.month !== selectedMonth)
      );
    }
  };

  const toggleResponsibilityApproval = (employeeId: string) => {
    const existing = responsibilityApprovals.find(
      ra => ra.employeeId === employeeId && ra.month === selectedMonth
    );
    let newList = [...responsibilityApprovals];
    if (existing) {
      newList = newList.filter(ra => !(ra.employeeId === employeeId && ra.month === selectedMonth));
    } else {
      newList.push({ employeeId, month: selectedMonth });
    }
    onUpdateData('responsibilityApprovals', newList);
  };

  const handleAttendanceInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = data.attendance.findIndex(
      a => a.employeeId === employee.id && a.date === dateStr
    );
    const newList = [...data.attendance];
    const val = value.trim().toUpperCase();

    if (val === '') {
      if (existingIndex > -1) {
        const deletedId = data.attendance[existingIndex].id;
        newList.splice(existingIndex, 1);
        onUpdateData('attendance', newList, deletedId);
      }
      return;
    }

    let status: AttendanceRecord['status'] | null = null;
    let hours = 0;
    const normalizedVal = val.replace(',', '.');

    if (val.startsWith('C')) {
      status = 'AuthorizedLeave';
      hours = 0;
    } else if (val.startsWith('K') || val.startsWith('V')) {
      status = 'UnauthorizedLeave';
      hours = 0;
    } else if (val.startsWith('X')) {
      status = 'Present';
      hours = STANDARD_HOURS_PER_DAY;
    } else if (val.startsWith('L')) {
      status = 'Holiday';
      hours = 0;
    } else if (!isNaN(Number(normalizedVal)) && normalizedVal !== '') {
      status = 'Present';
      hours = Math.min(Number(normalizedVal), STANDARD_HOURS_PER_DAY);
    }

    if (!status) return;

    if (existingIndex > -1) {
      newList[existingIndex] = { ...newList[existingIndex], status, hours };
    } else {
      newList.push({
        id: generateId(),
        employeeId: employee.id,
        employeeName: employee.name,
        date: dateStr,
        status,
        hours,
      });
    }
    onUpdateData('attendance', newList);
  };

  const handleOvertimeInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = data.overtime.findIndex(
      ot => ot.employeeId === employee.id && ot.date === dateStr
    );
    const newList = [...data.overtime];
    const val = value.trim().replace(',', '.');

    if (val === '') {
      if (existingIndex > -1) {
        const deletedId = data.overtime[existingIndex].id;
        newList.splice(existingIndex, 1);
        onUpdateData('overtime', newList, deletedId);
      }
      return;
    }

    if (!isNaN(Number(val)) && val !== '') {
      const minutes = Math.round(Number(val));
      const multiplier = 1.0;
      if (existingIndex > -1) {
        newList[existingIndex] = { ...newList[existingIndex], hours: minutes, multiplier };
      } else {
        newList.push({
          id: generateId(),
          employeeId: employee.id,
          employeeName: employee.name,
          date: dateStr,
          hours: minutes,
          multiplier,
        });
      }
      onUpdateData('overtime', newList);
    }
  };

  const handleSalesInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = data.sales.findIndex(
      s => s.employeeId === employee.id && s.date === dateStr
    );
    const newList = [...data.sales];
    const val = value.trim().replace(',', '.');

    if (val === '') {
      if (existingIndex > -1) {
        const deletedId = data.sales[existingIndex].id;
        newList.splice(existingIndex, 1);
        onUpdateData('sales', newList, deletedId);
      }
      return;
    }

    if (!isNaN(Number(val)) && val !== '') {
      const amount = Number(val) * 1000;
      const seniorityDays = calculateSeniority(employee.joinDate);
      const { policy: currentPolicy } = determineCurrentPolicy(employee, policies, seniorityDays);
      const rate = currentPolicy?.commissionRate || 0;
      const earned = Math.round(amount * (rate / 100));

      if (existingIndex > -1) {
        newList[existingIndex] = {
          ...newList[existingIndex],
          salesAmount: amount,
          commissionRate: rate,
          commissionEarned: earned,
        };
      } else {
        newList.push({
          id: generateId(),
          employeeId: employee.id,
          employeeName: employee.name,
          date: dateStr,
          salesAmount: amount,
          commissionRate: rate,
          commissionEarned: earned,
        });
      }
      onUpdateData('sales', newList);
    }
  };

  const handleShortageInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = shortages.findIndex(
      s => s.employeeId === employee.id && s.date === dateStr
    );
    const newList = [...shortages];
    const val = value.trim().replace(',', '.');

    if (val === '') {
      if (existingIndex > -1) {
        const deletedId = shortages[existingIndex].id;
        newList.splice(existingIndex, 1);
        onUpdateData('shortages', newList, deletedId);
      }
      return;
    }

    if (!isNaN(Number(val)) && val !== '') {
      const amount = Number(val) * 1000;
      if (existingIndex > -1) {
        newList[existingIndex] = { ...newList[existingIndex], amount };
      } else {
        newList.push({
          id: generateId(),
          employeeId: employee.id,
          employeeName: employee.name,
          date: dateStr,
          amount,
        });
      }
      onUpdateData('shortages', newList);
    }
  };

  const handleAdvanceInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = advances.findIndex(
      ad => ad.employeeId === employee.id && ad.date === dateStr
    );
    const newList = [...advances];
    const val = value.trim().replace(',', '.');

    if (val === '') {
      if (existingIndex > -1) {
        const deletedId = advances[existingIndex].id;
        newList.splice(existingIndex, 1);
        onUpdateData('advances', newList, deletedId);
      }
      return;
    }

    if (!isNaN(Number(val)) && val !== '') {
      const amount = Number(val) * 1000;
      if (existingIndex > -1) {
        newList[existingIndex] = { ...newList[existingIndex], amount };
      } else {
        newList.push({
          id: generateId(),
          employeeId: employee.id,
          employeeName: employee.name,
          date: dateStr,
          amount,
        });
      }
      onUpdateData('advances', newList);
    }
  };

  const getAttendanceCellValue = (employeeId: string, day: number) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const record = data.attendance.find(a => a.employeeId === employeeId && a.date === dateStr);
    if (isHoliday(day)) {
      if (!record) return 'L';
      return record.status === 'Present'
        ? record.hours.toString().replace('.', ',')
        : record.status === 'AuthorizedLeave'
          ? 'CP'
          : 'L';
    }
    if (!record) return '';
    if (record.status === 'AuthorizedLeave') return 'CP';
    if (record.status === 'UnauthorizedLeave') return 'KP';
    if (record.status === 'Holiday') return 'L';
    return record.hours.toString().replace('.', ',');
  };

  const getOvertimeCellValue = (employeeId: string, day: number) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const record = data.overtime.find(ot => ot.employeeId === employeeId && ot.date === dateStr);
    return record ? record.hours.toString() : '';
  };

  const getSalesCellValue = (employeeId: string, day: number) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const record = data.sales.find(s => s.employeeId === employeeId && s.date === dateStr);
    return record ? (record.salesAmount / 1000).toString().replace('.', ',') : '';
  };

  const getShortageCellValue = (employeeId: string, day: number) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const record = shortages.find(s => s.employeeId === employeeId && s.date === dateStr);
    return record ? (record.amount / 1000).toString().replace('.', ',') : '';
  };

  const getAdvanceCellValue = (employeeId: string, day: number) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const record = advances.find(ad => ad.employeeId === employeeId && ad.date === dateStr);
    return record ? (record.amount / 1000).toString().replace('.', ',') : '';
  };

  const toggleViolation = (employeeId: string, violationTypeId: string, occurrence: 1 | 2 | 3) => {
    const existing = violationOccurrences.find(
      vo =>
        vo.employeeId === employeeId &&
        vo.violationTypeId === violationTypeId &&
        vo.occurrence === occurrence &&
        vo.month === selectedMonth
    );
    let newList = [...violationOccurrences];

    if (existing) {
      newList = newList.filter(
        vo =>
          !(
            vo.employeeId === employeeId &&
            vo.violationTypeId === violationTypeId &&
            vo.occurrence === occurrence &&
            vo.month === selectedMonth
          )
      );
    } else {
      newList.push({ employeeId, violationTypeId, occurrence, month: selectedMonth });
    }
    onUpdateData('violationOccurrences', newList);
  };

  const isViolationChecked = (
    employeeId: string,
    violationTypeId: string,
    occurrence: 1 | 2 | 3
  ) => {
    return violationOccurrences.some(
      vo =>
        vo.employeeId === employeeId &&
        vo.violationTypeId === violationTypeId &&
        vo.occurrence === occurrence &&
        vo.month === selectedMonth
    );
  };

  const handleRecalculateCarryForwardDebt = async () => {
    if (
      !confirm(
        'Tính lại nợ chuyển kỳ cho toàn bộ lịch sử lương?\n\nHệ thống sẽ xử lý từng nhân viên theo thứ tự thời gian, tính lại số nợ tích lũy. Thao tác này không thể hoàn tác.'
      )
    )
      return;

    const allEmployees = data.employees;
    const allPayrolls = [...data.payroll].sort((a, b) => a.month.localeCompare(b.month));
    const updates: AppDataSurgicalUpdate[] = [];

    for (const emp of allEmployees) {
      const empPayrolls = allPayrolls.filter(r => r.employeeId === emp.id);
      let accDebt = 0;

      for (const record of empPayrolls) {
        // record.netPay là rawNet trước carry-forward (với dữ liệu cũ chưa có carry-forward)
        const rawNetEst =
          (record.carryForwardDeduction || 0) > 0
            ? record.netPay + (record.carryForwardDeduction || 0) // đã có carry-forward → hồi phục rawNet
            : record.netPay;

        const available = Math.max(0, rawNetEst);
        const deduction = Math.min(available, accDebt);
        const finalNetPay = available - deduction;
        const newDebtThisPeriod = Math.max(0, -rawNetEst);
        const newAccDebt = accDebt - deduction + newDebtThisPeriod;

        updates.push({
          key: 'payroll',
          item: {
            ...record,
            netPay: finalNetPay,
            carryForwardDeduction: deduction,
            carryForwardDebtOut: newAccDebt,
          },
        });

        accDebt = newAccDebt;
      }

      updates.push({ key: 'employees', item: { ...emp, carryForwardDebt: accDebt } });
    }

    try {
      if (onUpdateSurgical) {
        // Chia nhỏ để tránh quá tải
        const chunkSize = 50;
        for (let i = 0; i < updates.length; i += chunkSize) {
          await onUpdateSurgical(updates.slice(i, i + chunkSize));
        }
        showToast('✅ Đã tính lại nợ chuyển kỳ cho toàn bộ nhân viên!', 'success');
      } else {
        showToast('Chức năng này cần kết nối cloud để lưu dữ liệu.', 'warning');
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      showToast(`❌ Lỗi khi tính lại: ${message}`, 'error');
    }
  };

  const handleRecalculateExpensesWithAdvance = async () => {
    if (
      !confirm(
        'Cập nhật lại chi phí lương toàn bộ lịch sử?\n\nHệ thống sẽ cộng thêm tiền tạm ứng vào từng bản ghi chi phí đã chốt. Thao tác này không thể hoàn tác.'
      )
    )
      return;

    const updates: AppDataSurgicalUpdate[] = [];

    for (const record of data.payroll) {
      const [y, m] = record.month.split('-');
      const mmyyyy = `${m}/${y}`;
      const expenseDesc = `Chi lương tháng ${mmyyyy} - ${record.employeeName}`;
      const existingExpense = data.expenses.find(e => e.description === expenseDesc);
      if (!existingExpense) continue;

      const correctedAmount = Math.round(Number(record.netPay) || 0) + Math.round(Number(record.advance) || 0);
      if (existingExpense.amount === correctedAmount) continue;

      updates.push({ key: 'expenses', item: { ...existingExpense, amount: correctedAmount } });
    }

    if (updates.length === 0) {
      showToast('Không có bản ghi nào cần cập nhật.', 'info');
      return;
    }

    try {
      if (onUpdateSurgical) {
        const chunkSize = 50;
        for (let i = 0; i < updates.length; i += chunkSize) {
          await onUpdateSurgical(updates.slice(i, i + chunkSize));
        }
        showToast(`✅ Đã cập nhật ${updates.length} bản ghi chi phí lương!`, 'success');
      } else {
        showToast('Chức năng này cần kết nối cloud để lưu dữ liệu.', 'warning');
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      showToast(`❌ Lỗi khi cập nhật: ${message}`, 'error');
    }
  };

  const daysArray = Array.from({ length: getDaysInMonth(selectedMonth) }, (_, i) => i + 1);

  const handleExportPayroll = () => {
    xlsxExport(
      archivedPayrolls.map(p => ({
        Tháng: p.month,
        'Nhân viên': p.employeeName,
        'Lương cơ bản': p.basicSalary,
        'Phụ cấp': p.allowance,
        'Tăng ca': p.overtimePay,
        'Hoa hồng': p.commissionPay,
        'Thâm niên': p.seniorityBonus,
        'Thưởng Tết': p.tetBonus,
        'Tạm ứng': p.advance,
        Phạt: p.fine,
        'Thực lãnh': p.netPay,
      })),
      `BangLuong_${selectedMonth}`
    );
  };

  const activePayrollMeta = PAYROLL_NAV_ITEMS.find(item => item.id === subTab);

  return (
    <div className="flex h-full min-h-0 gap-4">
      <aside className="w-64 shrink-0 h-full min-h-0 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">
              {activePayrollMeta?.label || 'Lương & Thưởng'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">Quản lý lương thưởng và chấm công</p>
          </div>
          <div className="p-3 space-y-5">
            <div className="space-y-2">
              <p className="px-1 text-sm font-normal text-slate-600">
                Nhân sự
              </p>
              <div className="space-y-1">
                {PEOPLE_NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectMainTab?.(item.id)}
                      className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-normal text-slate-500 transition-colors hover:border-slate-100 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <p className="px-1 text-sm font-normal text-slate-600">
                Lương & Thưởng
              </p>
              <div className="space-y-1">
                {PAYROLL_NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = subTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSubTab(item.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-normal transition-colors ${
                        isActive
                          ? 'border-indigo-100 bg-indigo-50 text-indigo-700 shadow-sm'
                          : 'border-transparent text-slate-500 hover:border-slate-100 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center justify-between">
            <h3 className="line-clamp-2 text-sm font-medium leading-5 text-slate-700">Bộ lọc</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-2xs font-normal uppercase tracking-widest text-slate-400">
                Tháng
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal text-slate-700 outline-none"
                />
              </div>
            </div>
            <button
              onClick={() => setShowResigned(!showResigned)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-2xs font-normal uppercase tracking-widest transition-colors ${
                showResigned
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {showResigned ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {showResigned ? 'Đang hiện nhân sự cũ' : 'Hiện nhân sự cũ'}
            </button>
            <button
              onClick={handleExportPayroll}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-2xs font-normal uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <FileDown className="h-3.5 w-3.5" /> Xuất Excel
            </button>
          </div>
        </div>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 overflow-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="space-y-6 max-w-full mx-auto pb-20">

      {subTab === 'attendance' && (
        <AttendanceTab
          employees={employees}
          archivedEmployeeIds={archivedEmployeeIds}
          daysArray={daysArray}
          selectedMonth={selectedMonth}
          isHoliday={isHoliday}
          getAttendanceCellValue={getAttendanceCellValue}
          handleAttendanceInputChange={handleAttendanceInputChange}
          calculateTotalHours={calculateTotalHours}
        />
      )}

      {subTab === 'overtime' && (
        <OvertimeTab
          employees={employees}
          archivedEmployeeIds={archivedEmployeeIds}
          daysArray={daysArray}
          selectedMonth={selectedMonth}
          isHoliday={isHoliday}
          getOvertimeCellValue={getOvertimeCellValue}
          handleOvertimeInputChange={handleOvertimeInputChange}
          calculateTotalOvertimeHours={calculateTotalOvertimeHours}
        />
      )}

      {subTab === 'sales' && (
        <SalesTab
          employees={employees}
          archivedEmployeeIds={archivedEmployeeIds}
          daysArray={daysArray}
          selectedMonth={selectedMonth}
          isHoliday={isHoliday}
          staffRankings={staffRankings}
          getSalesCellValue={getSalesCellValue}
          handleSalesInputChange={handleSalesInputChange}
          calculateTotalSalesAmount={calculateTotalSalesAmount}
        />
      )}
      {subTab === 'penalties' && (
        <PenaltiesTab
          employees={employees}
          archivedEmployeeIds={archivedEmployeeIds}
          daysArray={daysArray}
          selectedMonth={selectedMonth}
          isHoliday={isHoliday}
          violationTypes={violationTypes}
          getShortageCellValue={getShortageCellValue}
          handleShortageInputChange={handleShortageInputChange}
          calculateTotalShortageAmount={calculateTotalShortageAmount}
          getAdvanceCellValue={getAdvanceCellValue}
          handleAdvanceInputChange={handleAdvanceInputChange}
          calculateTotalAdvanceAmount={calculateTotalAdvanceAmount}
          toggleViolation={toggleViolation}
          isViolationChecked={isViolationChecked}
        />
      )}
      {subTab === 'summary' && (
        <>
          <SummaryTab
            draftPayrolls={draftPayrolls}
            archivedPayrolls={archivedPayrolls}
            data={data}
            selectedMonth={selectedMonth}
            violationOccurrences={violationOccurrences}
            violationTypes={violationTypes}
            responsibilityApprovals={responsibilityApprovals}
            policies={policies}
            isProcessingSettlement={isProcessingSettlement}
            toggleResponsibilityApproval={toggleResponsibilityApproval}
            handlePrintPayslip={handlePrintPayslip}
            handleFinalizeIndividual={handleFinalizeIndividual}
            handleSettlementAndResignation={handleSettlementAndResignation}
          />
          <div className="flex justify-end gap-2 mt-4 px-2">
            <button
              onClick={handleRecalculateExpensesWithAdvance}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-2xs font-normal uppercase tracking-widest bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 transition-colors"
            >
              Cập nhật chi phí lương + tạm ứng (lịch sử)
            </button>
            <button
              onClick={handleRecalculateCarryForwardDebt}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-2xs font-normal uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Tính lại nợ chuyển kỳ (toàn bộ lịch sử)
            </button>
          </div>
        </>
      )}
      {subTab === 'ledger' && (
        <LedgerTab
          archivedPayrolls={archivedPayrolls}
          selectedMonth={selectedMonth}
          handleUndoPayroll={handleUndoPayroll}
          handlePrintPayslip={handlePrintPayslip}
        />
      )}
      {showPrintPreview && selectedPayrollForPrint && (
        <PayrollPrintPreviewModal
          payroll={selectedPayrollForPrint}
          data={data}
          selectedMonth={selectedMonth}
          policies={policies}
          violationOccurrences={violationOccurrences}
          violationTypes={violationTypes}
          responsibilityApprovals={responsibilityApprovals}
          onClose={closePrintPreview}
          onConfirmPrint={handleConfirmPrint}
        />
      )}
        </div>
      </section>
    </div>
  );
};

export default PayrollManager;
