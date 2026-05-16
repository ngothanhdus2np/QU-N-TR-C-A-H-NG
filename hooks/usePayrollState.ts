import { useState, useMemo, useEffect } from 'react';
import {
  AppData,
  PayrollRecord,
  Employee,
  PayrollSubTab,
} from '../types';
import { calculateEmployeePayroll, calculateStaffRanking, generateId } from '../src/lib';

interface UsePayrollStateProps {
  data: AppData;
  showResigned: boolean;
  requestedTab?: PayrollSubTab;
}

export const usePayrollState = ({ data, showResigned, requestedTab }: UsePayrollStateProps) => {
  // Tab & Month State
  const [subTab, setSubTab] = useState<PayrollSubTab>('attendance');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Print State
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedPayrollForPrint, setSelectedPayrollForPrint] = useState<PayrollRecord | null>(
    null
  );

  // Settlement State
  const [isProcessingSettlement, setIsProcessingSettlement] = useState<string | null>(null);

  // Sync requested tab from props
  useEffect(() => {
    if (requestedTab) setSubTab(requestedTab);
  }, [requestedTab]);

  // Constants
  const WORKING_DAYS_FIXED = 26;
  const STANDARD_HOURS_PER_DAY = 11;

  // Data shortcuts
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

  // Computed: Archived Payrolls
  const archivedPayrolls = useMemo(() => {
    return data.payroll.filter(p => p.month === selectedMonth);
  }, [data.payroll, selectedMonth]);

  // Computed: Employees (filtered by resigned status and archived)
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

  // Computed: Draft Payrolls
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

  // Computed: Staff Rankings
  const staffRankings = useMemo(() => {
    return calculateStaffRanking(data.sales, employees, selectedMonth);
  }, [data.sales, employees, selectedMonth]);

  // Helper: Get days in month
  const getDaysInMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  // Helper: Check if day is holiday
  const isHoliday = (day: number) => {
    const currentMonthPart = selectedMonth.split('-')[1];
    const dayPart = day.toString().padStart(2, '0');
    const matchStr = `${currentMonthPart}-${dayPart}`;
    return holidays.some(h => h.date === matchStr);
  };

  // Helper: Calculate total hours
  const calculateTotalHours = (employeeId: string) => {
    return data.attendance
      .filter(a => a.employeeId === employeeId && a.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + (record.status === 'Present' ? record.hours : 0), 0);
  };

  // Helper: Calculate total overtime hours
  const calculateTotalOvertimeHours = (employeeId: string) => {
    const totalMinutes = data.overtime
      .filter(ot => ot.employeeId === employeeId && ot.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.hours, 0);
    return Number((totalMinutes / 60).toFixed(1));
  };

  // Helper: Calculate total sales amount
  const calculateTotalSalesAmount = (employeeId: string) => {
    return data.sales
      .filter(s => s.employeeId === employeeId && s.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.salesAmount, 0);
  };

  // Helper: Calculate total shortage amount
  const calculateTotalShortageAmount = (employeeId: string) => {
    return shortages
      .filter(s => s.employeeId === employeeId && s.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.amount, 0);
  };

  // Helper: Calculate total advance amount
  const calculateTotalAdvanceAmount = (employeeId: string) => {
    return advances
      .filter(ad => ad.employeeId === employeeId && ad.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.amount, 0);
  };

  // Helper: Open print preview
  const openPrintPreview = (payroll: PayrollRecord) => {
    setSelectedPayrollForPrint(payroll);
    setShowPrintPreview(true);
  };

  // Helper: Close print preview
  const closePrintPreview = () => {
    setShowPrintPreview(false);
    setSelectedPayrollForPrint(null);
  };

  return {
    // State
    subTab,
    setSubTab,
    selectedMonth,
    setSelectedMonth,
    showPrintPreview,
    selectedPayrollForPrint,
    isProcessingSettlement,
    setIsProcessingSettlement,

    // Constants
    WORKING_DAYS_FIXED,
    STANDARD_HOURS_PER_DAY,

    // Data shortcuts
    policies,
    holidays,
    violationTypes,
    violationOccurrences,
    responsibilityApprovals,
    shortages,
    advances,
    tet,

    // Computed values
    archivedPayrolls,
    employees,
    draftPayrolls,
    staffRankings,

    // Helper functions
    getDaysInMonth,
    isHoliday,
    calculateTotalHours,
    calculateTotalOvertimeHours,
    calculateTotalSalesAmount,
    calculateTotalShortageAmount,
    calculateTotalAdvanceAmount,
    openPrintPreview,
    closePrintPreview,
  };
};
