import React, { useState, useMemo, useEffect } from 'react';
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
  calculateEmployeePayroll,
  calculateSeniority,
  determineCurrentPolicy,
  calculateStaffRanking,
  generateId,
} from '../businessLogic';
import { exportToExcel as xlsxExport } from '../services/exportService';
import AttendanceTab from './payroll/AttendanceTab';
import OvertimeTab from './payroll/OvertimeTab';
import SalesTab from './payroll/SalesTab';
import PenaltiesTab from './payroll/PenaltiesTab';
import SummaryTab from './payroll/SummaryTab';
import LedgerTab from './payroll/LedgerTab';
import { PayrollPrintPreviewModal } from './payroll/PayrollPrintPreviewModal';
import { PayrollToolbar } from './payroll/PayrollToolbar';
import { buildPayrollPayslipHtml } from './payroll/payrollPayslipPrint';

interface Props {
  data: AppData;
  onUpdateData: UpdateAppData;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  showResigned: boolean;
  setShowResigned: (val: boolean) => void;
  requestedTab?: PayrollSubTab;
}

const PayrollManager: React.FC<Props> = ({
  data,
  onUpdateData,
  onUpdateSurgical,
  showResigned,
  setShowResigned,
  requestedTab,
}) => {
  const [subTab, setSubTab] = useState<PayrollSubTab>('attendance');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (requestedTab) setSubTab(requestedTab);
  }, [requestedTab]);
  const [isProcessingSettlement, setIsProcessingSettlement] = useState<string | null>(null);

  const archivedPayrolls = useMemo(() => {
    return data.payroll.filter(p => p.month === selectedMonth);
  }, [data.payroll, selectedMonth]);

  const employees = useMemo(() => {
    return data.employees.filter(emp => {
      const alreadyArchived = archivedPayrolls.some(p => p.employeeId === emp.id);
      const isResigned = emp.resignedDate && String(emp.resignedDate).trim() !== '';

      if (!showResigned) {
        if (isResigned || alreadyArchived) return false;
        return true;
      }

      const resDate = emp.resignedDate;
      const isResignedInPast = resDate && resDate < `${selectedMonth}-01`;
      return !isResignedInPast;
    });
  }, [data.employees, selectedMonth, showResigned, archivedPayrolls]);

  const policies = data.salaryPolicies || [];
  const holidays = data.holidays || [];
  const violationTypes = data.violationTypes || [];
  const violationOccurrences = data.violationOccurrences || [];
  const responsibilityApprovals = data.responsibilityApprovals || [];
  const shortages = data.shortages || [];
  const advances = data.advances || [];

  const tet = data.tetCampaign || {
    commitmentDate: '',
    carAllowance: 1000000,
    beforeTetExtraBonus: 500000,
    afterTetDate: '',
    lixiBonus: 200000,
    beforeTetExtraDays: [],
    afterTetExtraDays: [],
    afterTetExtraBonus: 300000,
  };

  const WORKING_DAYS_FIXED = 26;
  const STANDARD_HOURS_PER_DAY = 11;

  const draftPayrolls = useMemo(() => {
    return employees.map(emp => {
      const isResponsibilityApproved = responsibilityApprovals.some(
        ra => ra.employeeId === emp.id && ra.month === selectedMonth
      );
      const existingPayroll = data.payroll.find(
        p => p.employeeId === emp.id && p.month === selectedMonth
      );

      return calculateEmployeePayroll(
        emp,
        selectedMonth,
        policies,
        holidays,
        data.attendance,
        data.overtime,
        data.sales,
        tet,
        WORKING_DAYS_FIXED,
        violationTypes,
        violationOccurrences,
        isResponsibilityApproved,
        shortages,
        advances,
        existingPayroll?.id
      );
    });
  }, [
    employees,
    selectedMonth,
    policies,
    holidays,
    data.attendance,
    data.overtime,
    data.sales,
    tet,
    violationTypes,
    violationOccurrences,
    responsibilityApprovals,
    shortages,
    advances,
    data.payroll,
  ]);

  const staffRankings = useMemo(() => {
    return calculateStaffRanking(data.sales, employees, selectedMonth);
  }, [data.sales, employees, selectedMonth]);

  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedPayrollForPrint, setSelectedPayrollForPrint] = useState<PayrollRecord | null>(
    null
  );

  const handlePrintPayslip = (payroll: PayrollRecord) => {
    setSelectedPayrollForPrint(payroll);
    setShowPrintPreview(true);
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
      alert('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in phiếu lương.');
    }

    setShowPrintPreview(false);
  };

  const getDaysInMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const isHoliday = (day: number) => {
    const currentMonthPart = selectedMonth.split('-')[1];
    const dayPart = day.toString().padStart(2, '0');
    const matchStr = `${currentMonthPart}-${dayPart}`;
    return holidays.some(h => h.date === matchStr);
  };

  const calculateTotalHours = (employeeId: string) => {
    return data.attendance
      .filter(a => a.employeeId === employeeId && a.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + (record.status === 'Present' ? record.hours : 0), 0);
  };

  const calculateTotalOvertimeHours = (employeeId: string) => {
    const totalMinutes = data.overtime
      .filter(ot => ot.employeeId === employeeId && ot.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.hours, 0);
    return Number((totalMinutes / 60).toFixed(1));
  };

  const calculateTotalSalesAmount = (employeeId: string) => {
    return data.sales
      .filter(s => s.employeeId === employeeId && s.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.salesAmount, 0);
  };

  const calculateTotalShortageAmount = (employeeId: string) => {
    return shortages
      .filter(s => s.employeeId === employeeId && s.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.amount, 0);
  };

  const calculateTotalAdvanceAmount = (employeeId: string) => {
    return advances
      .filter(ad => ad.employeeId === employeeId && ad.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.amount, 0);
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
      alert(
        'Lỗi: Giá trị thực nhận không hợp lệ (NaN). Vui lòng kiểm tra lại bảng chấm công của nhân viên này.'
      );
      return;
    }

    const totalSales = calculateTotalSalesAmount(payroll.employeeId);
    const roi = netPayVal > 0 ? totalSales / netPayVal : 0;
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
      totalIncome: netPayVal,
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
      amount: netPayVal,
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

    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([
          { key: 'payroll', item: finalPayroll },
          { key: 'expenses', item: newExpense },
          { key: 'staffPerformance', item: perfRecord },
        ]);
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
        alert(`✅ Đã chốt lương & đúc hồ sơ hiệu năng cho ${payroll.employeeName} thành công!`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      alert(`❌ LỖI SAO LƯU: Không thể lưu dữ liệu lên Cloud. Chi tiết: ${message}`);
    }
  };

  const handleSettlementAndResignation = async (payroll: PayrollRecord) => {
    const today = new Date().toISOString().split('T')[0];
    const originalEmpId = payroll.employeeId;

    const netPayVal = Math.round(Number(payroll.netPay) || 0);
    if (isNaN(netPayVal)) {
      alert('LỖI DỮ LIỆU: Giá trị thực nhận không hợp lệ. Hãy kiểm tra bảng công.');
      return;
    }

    const emp = data.employees.find(e => e.id === originalEmpId);
    if (!emp) {
      alert('LỖI: Không tìm thấy hồ sơ nhân sự.');
      return;
    }

    const confirmMsg = `XÁC NHẬN QUYẾT TOÁN VÀ CHO NGHỈ VIỆC\n\n- Nhân viên: ${payroll.employeeName}\n- Thực nhận: ${netPayVal.toLocaleString()}đ\n\nSau khi bấm OK:\n1. Lưu sổ cái lương tháng ${selectedMonth}.\n2. Ghi chi phí lương.\n3. Lưu hồ sơ hiệu năng tháng cuối.\n4. Đóng hồ sơ nhân sự ngay hôm nay (${today.split('-').reverse().join('/')}).`;

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
        amount: netPayVal,
        description: expenseDesc,
      };
      updates.push({ key: 'expenses', item: newExpense });

      // Add performance capture for last month
      const totalSales = calculateTotalSalesAmount(originalEmpId);
      const roi = netPayVal > 0 ? totalSales / netPayVal : 0;
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
          totalIncome: netPayVal,
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
        alert(
          `✅ Đã quyết toán thành công cho ${payroll.employeeName}!\n\nHồ sơ đã được đóng và Headcount đã cập nhật.`
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
      alert(`Lỗi hệ thống: ${message}`);
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
        const expenseDesc = `Chi lương tháng ${selectedMonth.split('-').reverse().join('/')} - ${payrollToUndo.employeeName}`;
        onUpdateData(
          'expenses',
          data.expenses.filter(e => e.description !== expenseDesc)
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
      onUpdateData(
        'expenses',
        data.expenses.filter(e => !e.description.startsWith(monthPrefix))
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

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20">
      <PayrollToolbar
        selectedMonth={selectedMonth}
        showResigned={showResigned}
        onChangeMonth={setSelectedMonth}
        onExportPayroll={handleExportPayroll}
        onToggleShowResigned={() => setShowResigned(!showResigned)}
      />

      {subTab === 'attendance' && (
        <AttendanceTab
          employees={employees}
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
          onClose={() => setShowPrintPreview(false)}
          onConfirmPrint={handleConfirmPrint}
        />
      )}
    </div>
  );
};

export default PayrollManager;
