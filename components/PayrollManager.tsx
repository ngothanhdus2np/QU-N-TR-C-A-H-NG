
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, AttendanceRecord, PayrollRecord, Employee, SalaryPolicy, Holiday, TetCampaign, ViolationType, ViolationOccurrence, ResponsibilityApproval, ShortageRecord, AdvanceRecord, ExpenseRecord, StaffPerformanceRecord } from '../types';
import { 
  Calculator, Clock, TrendingUp, ListChecks, 
  Trash2, Calendar, DollarSign, Plus, Check, Banknote, HeartHandshake, Home, Utensils, Sparkles,
  Info, PartyPopper, Gift, Save, CalendarCheck, Flame, BadgeCheck, UserMinus,
  Archive, RotateCcw, Printer, PrinterCheck, ChevronRight, ChevronLeft, Gavel, AlertOctagon, ToggleLeft, ToggleRight, Wallet2,
  ChevronDown, Layers, Globe, HandCoins, Star, MapPin, X as LucideX, ArrowLeft, ArrowRight, Trophy, Medal, Crown, BarChart2, BookOpen,
  Loader2, ShieldCheck, Eye, EyeOff
} from 'lucide-react';
import { 
  calculateEmployeePayroll, 
  calculateSeniority, 
  determineCurrentPolicy,
  calculateStaffRanking,
  generateId,
  isUUID
} from '../businessLogic';

const ResponsibilityIcon = ShieldCheck;

interface Props {
  data: AppData;
  onUpdateData: (key: keyof AppData, newList: any, idToRemove?: string) => void;
  onUpdateSurgical?: (updates: { key: keyof AppData, item: any, isDelete?: boolean }[]) => Promise<void>;
  showResigned: boolean;
  setShowResigned: (val: boolean) => void;
}

const PayrollManager: React.FC<Props> = ({ data, onUpdateData, onUpdateSurgical, showResigned, setShowResigned }) => {
  const [subTab, setSubTab] = useState<'attendance' | 'overtime' | 'sales' | 'penalties' | 'summary' | 'ledger'>('attendance');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isProcessingSettlement, setIsProcessingSettlement] = useState<string | null>(null);

  const archivedPayrolls = useMemo(() => {
    return data.payroll.filter(p => p.month === selectedMonth);
  }, [data.payroll, selectedMonth]);

  const employees = useMemo(() => {
    return data.employees.filter(emp => {
      const alreadyArchived = archivedPayrolls.some(p => p.employeeId === emp.id);
      const isResigned = (emp.resignedDate && String(emp.resignedDate).trim() !== "") || (emp.resigned_date && String(emp.resigned_date).trim() !== "");
      
      if (!showResigned) {
        if (isResigned || alreadyArchived) return false;
        return true;
      }
      
      const resDate = emp.resignedDate || emp.resigned_date;
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
    commitmentDate: '', carAllowance: 1000000, beforeTetExtraBonus: 500000, 
    afterTetDate: '', lixiBonus: 200000, beforeTetExtraDays: [], afterTetExtraDays: [], afterTetExtraBonus: 300000 
  };

  const WORKING_DAYS_FIXED = 26;
  const STANDARD_HOURS_PER_DAY = 11;

  const draftPayrolls = useMemo(() => {
    return employees.map(emp => {
      const isResponsibilityApproved = responsibilityApprovals.some(ra => ra.employeeId === emp.id && ra.month === selectedMonth);
      const existingPayroll = data.payroll.find(p => p.employeeId === emp.id && p.month === selectedMonth);
      
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
  }, [employees, selectedMonth, policies, holidays, data.attendance, data.overtime, data.sales, tet, violationTypes, violationOccurrences, responsibilityApprovals, shortages, advances, data.payroll]);

  const staffRankings = useMemo(() => {
    return calculateStaffRanking(data.sales, employees, selectedMonth);
  }, [data.sales, employees, selectedMonth]);

  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedPayrollForPrint, setSelectedPayrollForPrint] = useState<PayrollRecord | null>(null);

  const handlePrintPayslip = (payroll: PayrollRecord) => {
    setSelectedPayrollForPrint(payroll);
    setShowPrintPreview(true);
  };

  const handleConfirmPrint = () => {
    if (!selectedPayrollForPrint) return;
    const payroll = selectedPayrollForPrint;
    const emp = data.employees.find(e => e.id === payroll.employeeId);
    
    if (!emp) return;

    const seniorityDays = payroll.seniorityDays || calculateSeniority(emp.joinDate);
    const { policy: currentPolicy } = determineCurrentPolicy(emp, policies, seniorityDays);

    if (!currentPolicy) return;

    // Recalculate details for printing to match draft card
    const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
    const daysInMonthTotal = new Date(yearNum, monthNum, 0).getDate();
    const monthAttendance = data.attendance.filter(a => a.employeeId === payroll.employeeId && a.date.startsWith(selectedMonth));
    const workingDays = monthAttendance.filter(a => a.status === 'Present').length;
    const totalHoursWorked = monthAttendance.filter(a => a.status === 'Present').reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
    const proRateFactor = daysInMonthTotal > 0 ? (workingDays / daysInMonthTotal) : 0;

    const employeeViolations = violationOccurrences.filter(vo => vo.employeeId === payroll.employeeId && vo.month === selectedMonth);
    const checkPenalty = (keyword: string) => employeeViolations.some(vo => {
        const vt = violationTypes.find(v => v.id === vo.violationTypeId);
        if (!vt) return false;
        const pStr = (vo.occurrence === 1 ? vt.fine1 : vo.occurrence === 2 ? vt.fine2 : vt.fine3).toLowerCase();
        return pStr.includes(keyword);
    });

    const isAttendanceCut = checkPenalty('chuyên cần');
    const isCleaningCut = checkPenalty('vệ sinh');
    const isCSKHCut = checkPenalty('cskh');
    const isDinnerCut = checkPenalty('ăn tối');
    const isHousingCut = checkPenalty('hỗ trợ ở') || checkPenalty('nhà ở') || checkPenalty('mất ở');
    const isResponsibilityCut = checkPenalty('trách nhiệm');
    const isApproved = responsibilityApprovals.some(ra => ra.employeeId === payroll.employeeId && ra.month === selectedMonth);

    const otMinutes = data.overtime
      .filter(ot => ot.employeeId === payroll.employeeId && ot.date.startsWith(selectedMonth))
      .reduce((sum, record) => sum + record.hours, 0);
    const otHours = Number((otMinutes / 60).toFixed(1));

    const printHtml = `
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
              <p class="margin-y-2"><b>CV:</b> ${emp?.position || 'Nhân viên'} (${currentPolicy.name})</p>
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
                ${currentPolicy.attendanceAllowance > 0 ? `
                <div class="flex-between ${isAttendanceCut ? 'cut' : ''}">
                  <span>- Chuyên cần:</span>
                  <span>${Math.round((isAttendanceCut ? 0 : currentPolicy.attendanceAllowance) * proRateFactor).toLocaleString()}</span>
                </div>` : ''}
                ${currentPolicy.cleaningAllowance > 0 ? `
                <div class="flex-between ${isCleaningCut ? 'cut' : ''}">
                  <span>- Vệ sinh:</span>
                  <span>${Math.round((isCleaningCut ? 0 : currentPolicy.cleaningAllowance) * proRateFactor).toLocaleString()}</span>
                </div>` : ''}
                ${currentPolicy.customerServiceAllowance > 0 ? `
                <div class="flex-between ${isCSKHCut ? 'cut' : ''}">
                  <span>- CSKH:</span>
                  <span>${Math.round((isCSKHCut ? 0 : currentPolicy.customerServiceAllowance) * proRateFactor).toLocaleString()}</span>
                </div>` : ''}
                ${currentPolicy.dinnerAllowance > 0 ? `
                <div class="flex-between ${isDinnerCut ? 'cut' : ''}">
                  <span>- Ăn tối:</span>
                  <span>${Math.round((isDinnerCut ? 0 : currentPolicy.dinnerAllowance) * workingDays).toLocaleString()}</span>
                </div>` : ''}
                ${currentPolicy.housingAllowance > 0 ? `
                <div class="flex-between ${isHousingCut ? 'cut' : ''}">
                  <span>- Hỗ trợ ở:</span>
                  <span>${Math.round((isHousingCut ? 0 : currentPolicy.housingAllowance) * proRateFactor).toLocaleString()}</span>
                </div>` : ''}
              </div>

              ${currentPolicy.responsibilityAllowance > 0 ? `
              <div class="flex-between ${(!isApproved || isResponsibilityCut) ? 'cut' : ''}" style="margin-top: 3px;">
                <span class="bold">Trách nhiệm:</span>
                <span class="bold">${Math.round((isResponsibilityCut ? 0 : (currentPolicy.responsibilityAllowance || 0)) * proRateFactor).toLocaleString()}</span>
              </div>` : ''}

              <div class="flex-between" style="margin-top: 3px;">
                <span>Hoa hồng (${currentPolicy.commissionRate}%):</span>
                <span>${(payroll.commissionPay || 0).toLocaleString()}</span>
              </div>

              <div class="flex-between">
                <span>Tăng ca (${otHours}h):</span>
                <span>${(payroll.overtimePay || 0).toLocaleString()}</span>
              </div>

              ${payroll.holidayBonus > 0 ? `
              <div class="flex-between">
                <span>Thưởng Lễ:</span>
                <span>${(payroll.holidayBonus || 0).toLocaleString()}</span>
              </div>` : ''}

              ${payroll.tetBonus > 0 ? `
              <div style="margin-top: 3px;">
                <div class="flex-between">
                  <span>Thưởng Tết (Trước):</span>
                  <span>${(payroll.tetBonusBefore || 0).toLocaleString()}</span>
                </div>
                <div class="flex-between">
                  <span>Thưởng Tết (Sau):</span>
                  <span>${(payroll.tetBonusAfter || 0).toLocaleString()}</span>
                </div>
              </div>` : ''}

              ${payroll.seniorityBonus > 0 ? `
              <div class="flex-between">
                <span>Thâm niên:</span>
                <span>${(payroll.seniorityBonus || 0).toLocaleString()}</span>
              </div>` : ''}
              
              ${(payroll.fine > 0 || payroll.shortage > 0 || payroll.advance > 0) ? `
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
              </div>` : ''}
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

  const handleFinalizeIndividual = async (payroll: PayrollRecord, isSettlement: boolean = false) => {
    const isAlreadyArchived = archivedPayrolls.some(ap => ap.employeeId === payroll.employeeId);
    if (isAlreadyArchived && !isSettlement) {
      if (!confirm(`Nhân viên ${payroll.employeeName} đã có dữ liệu chốt lương tháng ${selectedMonth}. Bạn có muốn cập nhật lại bản lưu không?`)) return;
    }

    const netPayVal = Math.round(Number(payroll.netPay) || 0);
    if (isNaN(netPayVal)) {
        alert("Lỗi: Giá trị thực nhận không hợp lệ (NaN). Vui lòng kiểm tra lại bảng chấm công của nhân viên này.");
        return;
    }

    const totalSales = calculateTotalSalesAmount(payroll.employeeId);
    const roi = netPayVal > 0 ? totalSales / netPayVal : 0;
    const rankObj = staffRankings.find(r => r.id === payroll.employeeId);

    // Create Performance Record
    const existingPerf = (data.staffPerformance || []).find(p => p.employeeId === payroll.employeeId && p.month === selectedMonth);
    const perfRecord: StaffPerformanceRecord = {
      id: existingPerf?.id || generateId(),
      employeeId: payroll.employeeId,
      employeeName: payroll.employeeName,
      month: selectedMonth,
      totalSales,
      totalIncome: netPayVal,
      roi,
      rank: rankObj?.rank
    };

    const today = new Date().toISOString().split('T')[0];
    const expenseDate = isSettlement ? today : `${selectedMonth}-${getDaysInMonth(selectedMonth).toString().padStart(2, '0')}`;
    const expenseDesc = `${isSettlement ? 'Quyết toán lương nghỉ việc' : 'Chi lương tháng ' + selectedMonth.split('-').reverse().join('/')} - ${payroll.employeeName}`;
    
    const existingExpense = data.expenses.find(e => e.description === expenseDesc);
    const newExpense: ExpenseRecord = {
      id: existingExpense?.id || generateId(),
      date: expenseDate,
      category: 'Lương & Thưởng',
      amount: netPayVal,
      description: expenseDesc
    };

    const currentPayrollEntry = data.payroll.find(p => p.employeeId === payroll.employeeId && p.month === selectedMonth);
    const finalPayroll = { ...payroll, id: currentPayrollEntry?.id || payroll.id, netPay: netPayVal };

    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([
          { key: 'payroll', item: finalPayroll },
          { key: 'expenses', item: newExpense },
          { key: 'staffPerformance', item: perfRecord }
        ]);
      } else {
        const updatedPayroll = data.payroll.filter(p => !(p.month === selectedMonth && p.employeeId === payroll.employeeId));
        const updatedExpenses = (data.expenses || []).filter(e => e.description !== expenseDesc);
        const updatedPerf = (data.staffPerformance || []).filter(pf => !(pf.month === selectedMonth && pf.employeeId === payroll.employeeId));
        onUpdateData('payroll', [...updatedPayroll, finalPayroll]);
        onUpdateData('expenses', [...updatedExpenses, newExpense]);
        onUpdateData('staffPerformance', [...updatedPerf, perfRecord]);
      }
      if (!isSettlement) alert(`✅ Đã chốt lương & đúc hồ sơ hiệu năng cho ${payroll.employeeName} thành công!`);
    } catch (err: any) {
      console.error(err);
      alert(`❌ LỖI SAO LƯU: Không thể lưu dữ liệu lên Cloud. Chi tiết: ${err.message || 'Lỗi kết nối'}`);
    }
  };

  const handleSettlementAndResignation = async (payroll: PayrollRecord) => {
    const today = new Date().toISOString().split('T')[0];
    const originalEmpId = payroll.employeeId;
    
    const netPayVal = Math.round(Number(payroll.netPay) || 0);
    if (isNaN(netPayVal)) {
        alert("LỖI DỮ LIỆU: Giá trị thực nhận không hợp lệ. Hãy kiểm tra bảng công.");
        return;
    }

    const emp = data.employees.find(e => e.id === originalEmpId);
    if (!emp) {
        alert("LỖI: Không tìm thấy hồ sơ nhân sự.");
        return;
    }

    const confirmMsg = `XÁC NHẬN QUYẾT TOÁN VÀ CHO NGHỈ VIỆC\n\n- Nhân viên: ${payroll.employeeName}\n- Thực nhận: ${netPayVal.toLocaleString()}đ\n\nSau khi bấm OK:\n1. Lưu sổ cái lương tháng ${selectedMonth}.\n2. Ghi chi phí lương.\n3. Lưu hồ sơ hiệu năng tháng cuối.\n4. Đóng hồ sơ nhân sự ngay hôm nay (${today.split('-').reverse().join('/')}).`;
    
    if (!confirm(confirmMsg)) return;

    setIsProcessingSettlement(originalEmpId);

    try {
        const updates: { key: keyof AppData, item: any, isDelete?: boolean }[] = [];
        const expenseDesc = `Quyết toán lương nghỉ việc - ${payroll.employeeName}`;
        
        const currentPayrollEntry = data.payroll.find(p => p.employeeId === originalEmpId && p.month === selectedMonth);
        const finalPayroll = { 
            ...payroll, 
            id: currentPayrollEntry?.id || generateId(),
            netPay: netPayVal 
        };
        updates.push({ key: 'payroll', item: finalPayroll });

        const existingExpense = data.expenses.find(e => e.description === expenseDesc);
        const newExpense: ExpenseRecord = {
            id: existingExpense?.id || generateId(),
            date: today,
            category: 'Lương & Thưởng',
            amount: netPayVal,
            description: expenseDesc
        };
        updates.push({ key: 'expenses', item: newExpense });

        // Add performance capture for last month
        const totalSales = calculateTotalSalesAmount(originalEmpId);
        const roi = netPayVal > 0 ? totalSales / netPayVal : 0;
        const existingPerf = (data.staffPerformance || []).find(p => p.employeeId === originalEmpId && p.month === selectedMonth);
        updates.push({
          key: 'staffPerformance',
          item: {
            id: existingPerf?.id || generateId(),
            employeeId: originalEmpId,
            employeeName: payroll.employeeName,
            month: selectedMonth,
            totalSales,
            totalIncome: netPayVal,
            roi
          }
        });

        const updatedEmployee = { 
          ...emp, 
          resignedDate: today,
          resigned_date: today 
        };
        updates.push({ key: 'employees', item: updatedEmployee });

        if (onUpdateSurgical) {
            await onUpdateSurgical(updates);
            alert(`✅ Đã quyết toán thành công cho ${payroll.employeeName}!\n\nHồ sơ đã được đóng và Headcount đã cập nhật.`);
        } else {
            onUpdateData('payroll', [...data.payroll.filter(p => !(p.month === selectedMonth && p.employeeId === originalEmpId)), finalPayroll]);
            onUpdateData('expenses', [...(data.expenses || []).filter(e => e.description !== expenseDesc), newExpense]);
            onUpdateData('employees', data.employees.map(e => e.id === originalEmpId ? updatedEmployee : e));
            // staffPerformance update logic simplified if no onUpdateSurgical
        }
    } catch (err: any) {
        console.error("Critical Settlement Error:", err);
        alert(`Lỗi hệ thống: ${err.message}`);
    } finally {
        setIsProcessingSettlement(null);
    }
  };

  const handleUndoPayroll = (employeeId?: string) => {
    if (employeeId) {
      const payrollToUndo = data.payroll.find(p => p.month === selectedMonth && p.employeeId === employeeId);
      if (payrollToUndo) {
        const expenseDesc = `Chi lương tháng ${selectedMonth.split('-').reverse().join('/')} - ${payrollToUndo.employeeName}`;
        onUpdateData('expenses', data.expenses.filter(e => e.description !== expenseDesc));
        onUpdateData('staffPerformance', (data.staffPerformance || []).filter(pf => !(pf.month === selectedMonth && pf.employeeId === employeeId)));
      }
      onUpdateData('payroll', data.payroll.filter(p => !(p.month === selectedMonth && p.employeeId === employeeId)));
    } else {
      if (!confirm(`Bạn có chắc muốn HỦY CHỐT toàn bộ bảng lương tháng ${selectedMonth}? Dữ liệu chi phí và hiệu năng tương ứng cũng sẽ bị xóa.`)) return;
      
      const monthPrefix = `Chi lương tháng ${selectedMonth.split('-').reverse().join('/')}`;
      onUpdateData('expenses', data.expenses.filter(e => !e.description.startsWith(monthPrefix)));
      onUpdateData('staffPerformance', (data.staffPerformance || []).filter(pf => pf.month !== selectedMonth));
      onUpdateData('payroll', data.payroll.filter(p => p.month !== selectedMonth));
    }
  };

  const toggleResponsibilityApproval = (employeeId: string) => {
    const existing = responsibilityApprovals.find(ra => ra.employeeId === employeeId && ra.month === selectedMonth);
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
    const existingIndex = data.attendance.findIndex(a => a.employeeId === employee.id && a.date === dateStr);
    let newList = [...data.attendance];
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

    if (val.startsWith('C')) { status = 'AuthorizedLeave'; hours = 0; } 
    else if (val.startsWith('K') || val.startsWith('V')) { status = 'UnauthorizedLeave'; hours = 0; } 
    else if (val.startsWith('X')) { status = 'Present'; hours = STANDARD_HOURS_PER_DAY; } 
    else if (val.startsWith('L')) { status = 'Holiday'; hours = 0; }
    else if (!isNaN(Number(normalizedVal)) && normalizedVal !== '') { 
      status = 'Present'; 
      hours = Math.min(Number(normalizedVal), STANDARD_HOURS_PER_DAY);
    }

    if (!status) return;

    if (existingIndex > -1) {
      newList[existingIndex] = { ...newList[existingIndex], status, hours };
    } else {
      newList.push({ id: generateId(), employeeId: employee.id, employeeName: employee.name, date: dateStr, status, hours });
    }
    onUpdateData('attendance', newList);
  };

  const handleOvertimeInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = data.overtime.findIndex(ot => ot.employeeId === employee.id && ot.date === dateStr);
    let newList = [...data.overtime];
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
        newList.push({ id: generateId(), employeeId: employee.id, employeeName: employee.name, date: dateStr, hours: minutes, multiplier });
      }
      onUpdateData('overtime', newList);
    }
  };

  const handleSalesInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = data.sales.findIndex(s => s.employeeId === employee.id && s.date === dateStr);
    let newList = [...data.sales];
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
        newList[existingIndex] = { ...newList[existingIndex], salesAmount: amount, commissionRate: rate, commissionEarned: earned };
      } else {
        newList.push({ id: generateId(), employeeId: employee.id, employeeName: employee.name, date: dateStr, salesAmount: amount, commissionRate: rate, commissionEarned: earned });
      }
      onUpdateData('sales', newList);
    }
  };

  const handleShortageInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = shortages.findIndex(s => s.employeeId === employee.id && s.date === dateStr);
    let newList = [...shortages];
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
        newList.push({ id: generateId(), employeeId: employee.id, employeeName: employee.name, date: dateStr, amount });
      }
      onUpdateData('shortages', newList);
    }
  };

  const handleAdvanceInputChange = (employee: Employee, day: number, value: string) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existingIndex = advances.findIndex(ad => ad.employeeId === employee.id && ad.date === dateStr);
    let newList = [...advances];
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
        newList.push({ id: generateId(), employeeId: employee.id, employeeName: employee.name, date: dateStr, amount });
      }
      onUpdateData('advances', newList);
    }
  };

  const getAttendanceCellValue = (employeeId: string, day: number) => {
    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const record = data.attendance.find(a => a.employeeId === employeeId && a.date === dateStr);
    if (isHoliday(day)) {
        if (!record) return 'L';
        return record.status === 'Present' ? record.hours.toString().replace('.', ',') : (record.status === 'AuthorizedLeave' ? 'CP' : 'L');
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
    const existing = violationOccurrences.find(vo => vo.employeeId === employeeId && vo.violationTypeId === violationTypeId && vo.occurrence === occurrence && vo.month === selectedMonth);
    let newList = [...violationOccurrences];
    
    if (existing) {
      newList = newList.filter(vo => !(vo.employeeId === employeeId && vo.violationTypeId === violationTypeId && vo.occurrence === occurrence && vo.month === selectedMonth));
    } else {
      newList.push({ employeeId, violationTypeId, occurrence, month: selectedMonth });
    }
    onUpdateData('violationOccurrences', newList);
  };

  const isViolationChecked = (employeeId: string, violationTypeId: string, occurrence: 1 | 2 | 3) => {
    return violationOccurrences.some(vo => vo.employeeId === employeeId && vo.violationTypeId === violationTypeId && vo.occurrence === occurrence && vo.month === selectedMonth);
  };

  const daysArray = Array.from({ length: getDaysInMonth(selectedMonth) }, (_, i) => i + 1);

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20">
      <div className="sticky top-0 z-50 space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar backdrop-blur-md bg-white/80">
          <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar min-max">
            <SubTabBtn active={subTab === 'attendance'} onClick={() => setSubTab('attendance')} icon={ListChecks} label="Chấm Công" />
            <SubTabBtn active={subTab === 'overtime'} onClick={() => setSubTab('overtime')} icon={Clock} label="Tăng Ca" />
            <SubTabBtn active={subTab === 'sales'} onClick={() => setSubTab('sales')} icon={TrendingUp} label="Doanh Số" />
            <SubTabBtn active={subTab === 'penalties'} onClick={() => setSubTab('penalties')} icon={Gavel} label="Các khoản khấu trừ" />
            <SubTabBtn active={subTab === 'summary'} onClick={() => setSubTab('summary')} icon={Calculator} label="Bảng Lương" />
            <SubTabBtn active={subTab === 'ledger'} onClick={() => setSubTab('ledger')} icon={BookOpen} label="Sổ Cái Lương" />
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-4 px-2">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-2 border-slate-200 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" />
          </div>
          <button 
            onClick={() => setShowResigned(!showResigned)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showResigned ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-400 hover:bg-slate-50'}`}
          >
            {showResigned ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showResigned ? 'Đang hiện nhân sự cũ' : 'Hiện nhân sự cũ'}
          </button>
        </div>
      </div>

      {subTab === 'attendance' && (
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
                        const isResigned = (emp.resignedDate && String(emp.resignedDate).trim() !== "") || (emp.resigned_date && String(emp.resigned_date).trim() !== "");
                        return (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                            <p className={`text-sm font-bold truncate ${isResigned ? 'text-slate-400' : 'text-slate-800'}`}>{emp.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                          </td>
                          {daysArray.map(day => (
                            <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                              <input type="text" defaultValue={getAttendanceCellValue(emp.id, day)} onBlur={(e) => handleAttendanceInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-xs font-bold outline-none border-none focus:bg-white" />
                            </td>
                          ))}
                          <td className="bg-indigo-50 text-center font-black text-indigo-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)]">{calculateTotalHours(emp.id)}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
        </div>
      )}

      {subTab === 'overtime' && (
        <div className="animate-in fade-in duration-300 space-y-4">
           <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                 <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Ghi Nhận Tăng Ca (Đơn vị: Phút)</h3>
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
                        <th className="px-3 py-4 text-center text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[60px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Giờ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {employees.map(emp => {
                        const isResigned = (emp.resignedDate && String(emp.resignedDate).trim() !== "") || (emp.resigned_date && String(emp.resigned_date).trim() !== "");
                        return (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                            <p className={`text-sm font-bold truncate ${isResigned ? 'text-slate-400' : 'text-slate-800'}`}>{emp.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                          </td>
                          {daysArray.map(day => (
                            <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                              <input type="text" defaultValue={getOvertimeCellValue(emp.id, day)} onBlur={(e) => handleOvertimeInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-xs font-bold outline-none border-none focus:bg-emerald-50/50" />
                            </td>
                          ))}
                          <td className="bg-emerald-50 text-center font-black text-emerald-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)]">{calculateTotalOvertimeHours(emp.id)}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
        </div>
      )}

      {subTab === 'sales' && (
        <div className="animate-in fade-in duration-300 space-y-10">
           {staffRankings.length > 0 && (
              <div className="space-y-6">
                 <div className="flex items-center gap-4 px-2">
                    <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xl"><Trophy className="w-6 h-6" /></div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bảng Vàng Doanh Số Tháng {selectedMonth.split('-').reverse().join('/')}</h3>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Xếp hạng hiệu quả đóng góp doanh thu của nhân sự</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {staffRankings.slice(0, 3).map((r, idx) => {
                       const colors = [
                          { bg: 'bg-amber-500', text: 'text-amber-500', icon: Crown, label: 'QUÁN QUÂN' },
                          { bg: 'bg-slate-400', text: 'text-slate-400', icon: Medal, label: 'Á QUÂN' },
                          { bg: 'bg-orange-400', text: 'text-orange-400', icon: Medal, label: 'VỀ BA' }
                       ];
                       const theme = colors[idx];
                       return (
                          <div key={r.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-all">
                             <div className={`absolute top-0 right-0 w-32 h-32 ${theme.bg}/5 rounded-full -translate-y-1/2 translate-x-1/2`}></div>
                             <div className="flex items-center justify-between mb-6 relative z-10">
                                <div className={`w-14 h-14 rounded-2xl ${theme.bg} text-white flex items-center justify-center shadow-lg shadow-${theme.text}/20`}>
                                   <theme.icon className="w-8 h-8" />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.text}`}>{theme.label}</span>
                             </div>
                             <div className="relative z-10">
                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{r.name}</h4>
                                <div className="mt-4 flex items-end gap-2">
                                   <span className="text-2xl font-black text-slate-800 tabular-nums">{(r.totalAmount || 0).toLocaleString()}</span>
                                   <span className="text-[10px] font-bold text-slate-400 mb-1.5">VNĐ</span>
                                </div>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
           )}

           <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Ghi nhận doanh số chi tiết (Đơn vị: Nghìn đồng)</h3>
                 </div>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="overflow-x-auto max-h-[70vh]">
                     <table className="w-full text-left border-collapse table-fixed">
                       <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-30 backdrop-blur-sm bg-slate-50/90">
                         <tr>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase sticky left-0 top-0 bg-slate-50 z-40 border-r border-slate-100 w-[200px]">Nhân viên</th>
                           {daysArray.map(day => (
                             <th key={day} className={`px-1 py-4 text-center text-[10px] font-black w-[55px] border-r border-slate-100/50 ${isHoliday(day) ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>{day}</th>
                           ))}
                           <th className="px-3 py-4 text-center text-[10px] font-black text-amber-600 uppercase bg-amber-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[100px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Tổng</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                         {employees.map(emp => {
                           const isResigned = (emp.resignedDate && String(emp.resignedDate).trim() !== "") || (emp.resigned_date && String(emp.resigned_date).trim() !== "");
                           return (
                           <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                               <p className={`text-sm font-bold truncate ${isResigned ? 'text-slate-400' : 'text-slate-800'}`}>{emp.name}</p>
                               <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                             </td>
                             {daysArray.map(day => (
                               <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                                 <input type="text" defaultValue={getSalesCellValue(emp.id, day)} onBlur={(e) => handleSalesInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-[10px] font-bold outline-none border-none focus:bg-amber-50/50" />
                               </td>
                             ))}
                             <td className="bg-amber-50 text-center font-black text-amber-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)] truncate">{(calculateTotalSalesAmount(emp.id) || 0).toLocaleString()}</td>
                           </tr>
                         )})}
                       </tbody>
                     </table>
                   </div>
                 </div>
           </div>
        </div>
      )}

      {subTab === 'penalties' && (
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
                        const isResigned = (emp.resignedDate && String(emp.resignedDate).trim() !== "") || (emp.resigned_date && String(emp.resigned_date).trim() !== "");
                        return (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                            <p className={`text-sm font-bold truncate ${isResigned ? 'text-slate-400' : 'text-slate-800'}`}>{emp.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                          </td>
                          {daysArray.map(day => (
                            <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                              <input type="text" defaultValue={getShortageCellValue(emp.id, day)} onBlur={(e) => handleShortageInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-[10px] font-bold outline-none border-none focus:bg-orange-50/50" />
                            </td>
                          ))}
                          <td className="bg-orange-50 text-center font-black text-orange-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)] truncate">{(calculateTotalShortageAmount(emp.id) || 0).toLocaleString()}</td>
                        </tr>
                      )})}
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
                        <th className="px-3 py-4 text-center text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[100px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Tổng Tạm Ưng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {employees.map(emp => {
                        const isResigned = (emp.resignedDate && String(emp.resignedDate).trim() !== "") || (emp.resigned_date && String(emp.resigned_date).trim() !== "");
                        return (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                            <p className={`text-sm font-bold truncate ${isResigned ? 'text-slate-400' : 'text-slate-800'}`}>{emp.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                          </td>
                          {daysArray.map(day => (
                            <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                              <input type="text" defaultValue={getAdvanceCellValue(emp.id, day)} onBlur={(e) => handleAdvanceInputChange(emp, day, e.target.value)} className="w-full h-full bg-transparent text-center text-[10px] font-bold outline-none border-none focus:bg-indigo-50/50" />
                            </td>
                          ))}
                          <td className="bg-indigo-50 text-center font-black text-indigo-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)] truncate">{(calculateTotalAdvanceAmount(emp.id) || 0).toLocaleString()}</td>
                        </tr>
                      )})}
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
                            <p className="text-[10px] font-black text-slate-800 uppercase truncate px-2">{emp.name}</p>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {violationTypes.map(vt => (
                        <tr key={vt.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 bg-white sticky left-0 z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.01)]">
                             <p className="text-xs font-bold text-slate-700">{vt.name}</p>
                          </td>
                          {employees.map(emp => (
                            <td key={emp.id} className="p-0 border-r border-slate-100 h-14">
                               <div className="flex h-full items-center justify-center gap-4 px-2">
                                  {[1, 2, 3].map((num) => (
                                    <button 
                                      key={num}
                                      onClick={() => toggleViolation(emp.id, vt.id, num as 1|2|3)}
                                      className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                                        isViolationChecked(emp.id, vt.id, num as 1|2|3)
                                          ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                                          : 'bg-white border-slate-200 hover:border-rose-300'
                                      }`}
                                    >
                                      {isViolationChecked(emp.id, vt.id, num as 1|2|3) && <Check className="w-3 h-3 stroke-[3]" />}
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
      )}

      {subTab === 'summary' && (
        <div className="animate-in fade-in duration-500 space-y-16 pb-20">
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                  <BadgeCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Phiếu Lương Dự Thảo (Tích lũy đến hôm nay)</h3>
                  <p className="text-sm text-slate-500 font-medium italic">Số tiền tích lũy tăng dần theo ngày công thực tế.</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
              {draftPayrolls.map((payroll) => {
                const isArchived = archivedPayrolls.some(ap => ap.employeeId === payroll.employeeId);
                const emp = data.employees.find(e => e.id === payroll.employeeId);
                const seniorityDays = emp ? calculateSeniority(emp.joinDate) : 0;
                const { policy: currentPolicy } = determineCurrentPolicy(emp!, policies, seniorityDays);
                const isApproved = responsibilityApprovals.some(ra => ra.employeeId === payroll.employeeId && ra.month === selectedMonth);

                if (!currentPolicy) return null;

                const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
                const daysInMonthTotal = new Date(yearNum, monthNum, 0).getDate();
                const monthAttendance = data.attendance.filter(a => a.employeeId === payroll.employeeId && a.date.startsWith(selectedMonth));
                const workingDays = monthAttendance.filter(a => a.status === 'Present').length;
                const proRateFactor = daysInMonthTotal > 0 ? (workingDays / daysInMonthTotal) : 0;

                const employeeViolations = violationOccurrences.filter(vo => vo.employeeId === payroll.employeeId && vo.month === selectedMonth);
                const checkPenalty = (keyword: string) => employeeViolations.some(vo => {
                    const vt = violationTypes.find(v => v.id === vo.violationTypeId);
                    if (!vt) return false;
                    const pStr = (vo.occurrence === 1 ? vt.fine1 : vo.occurrence === 2 ? vt.fine2 : vo.occurrence === 3 ? vt.fine3 : '').toLowerCase();
                    return pStr.includes(keyword);
                });

                const isAttendanceCut = checkPenalty('chuyên cần');
                const isCleaningCut = checkPenalty('vệ sinh');
                const isCSKHCut = checkPenalty('cskh');
                const isDinnerCut = checkPenalty('ăn tối');
                const isHousingCut = checkPenalty('hỗ trợ ở') || checkPenalty('nhà ở') || checkPenalty('mất ở');
                const isResponsibilityCut = checkPenalty('trách nhiệm');

                const isProcessing = isProcessingSettlement === payroll.employeeId;
                const isResigned = emp ? ((emp.resignedDate && String(emp.resignedDate).trim() !== "") || (emp.resigned_date && String(emp.resigned_date).trim() !== "")) : false;

                return (
                  <div key={payroll.employeeId} className={`bg-white border border-slate-200 flex flex-col h-full rounded-[2.5rem] relative transition-all hover:shadow-2xl hover:border-slate-300 overflow-hidden ${isResigned ? 'bg-slate-50 opacity-80' : ''}`}>
                    <div className="p-8 border-b border-slate-100 flex flex-col items-center relative">
                      {isArchived && (
                        <div className="absolute top-4 right-4">
                          <span className="text-[8px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Đã chốt
                          </span>
                        </div>
                      )}
                      <h4 className={`font-black text-xl uppercase tracking-tight text-center ${isResigned ? 'text-slate-400' : 'text-slate-900'}`}>{payroll.employeeName}</h4>
                      <div className="mt-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 border ${payroll.isOfficial ? 'border-emerald-200 text-emerald-600' : 'border-amber-200 text-amber-600'}`}>
                          {currentPolicy.name}
                        </span>
                      </div>
                      {isResigned && (
                         <div className="mt-2 bg-rose-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">ĐÃ NGHỈ VIỆC</div>
                      )}
                    </div>

                    <div className="p-6 space-y-3 flex-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Lương Cơ Bản (Thực nhận)</span>
                        <span className="font-black text-slate-900">{(payroll.basicSalary || 0).toLocaleString()}</span>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between items-center text-[11px] font-black text-indigo-600 uppercase border-b border-slate-50 pb-1">
                          <span>Phụ Cấp (Tích lũy theo công)</span>
                          <span>{(payroll.allowance || 0).toLocaleString()}</span>
                        </div>
                        <div className="pl-4 space-y-1">
                          {currentPolicy.attendanceAllowance > 0 && (
                            <AccruedDetail 
                              label="Chuyên cần" 
                              value={Math.round((isAttendanceCut ? 0 : currentPolicy.attendanceAllowance) * proRateFactor)} 
                              isCut={isAttendanceCut} 
                            />
                          )}
                          {currentPolicy.cleaningAllowance > 0 && (
                            <AccruedDetail 
                              label="Vệ sinh" 
                              value={Math.round((isCleaningCut ? 0 : currentPolicy.cleaningAllowance) * proRateFactor)} 
                              isCut={isCleaningCut} 
                            />
                          )}
                          {currentPolicy.customerServiceAllowance > 0 && (
                            <AccruedDetail 
                              label="CSKH" 
                              value={Math.round((isCSKHCut ? 0 : currentPolicy.customerServiceAllowance) * proRateFactor)} 
                              isCut={isCSKHCut} 
                            />
                          )}
                          {currentPolicy.dinnerAllowance > 0 && (
                            <AccruedDetail 
                              label="Ăn tối" 
                              value={Math.round((isDinnerCut ? 0 : currentPolicy.dinnerAllowance) * workingDays)} 
                              isCut={isDinnerCut} 
                            />
                          )}
                          {currentPolicy.housingAllowance > 0 && (
                            <AccruedDetail 
                              label="Hỗ trợ ở" 
                              value={Math.round((isHousingCut ? 0 : currentPolicy.housingAllowance) * proRateFactor)} 
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
                                    {isApproved ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                  </button>
                                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${isApproved && !isResponsibilityCut ? 'text-indigo-600' : 'text-slate-400'} ${isResponsibilityCut ? 'text-rose-400' : ''}`}>
                                    Trách nhiệm
                                  </span>
                               </div>
                               <span className={`text-[10px] font-black ${isApproved && !isResponsibilityCut ? 'text-indigo-600' : 'text-slate-500'}`}>
                                 {Math.round((isResponsibilityCut ? 0 : (currentPolicy.responsibilityAllowance || 0)) * proRateFactor).toLocaleString()}
                               </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2">
                        <span className="font-bold text-slate-700">Hoa Hồng ({(currentPolicy.commissionRate || 0)}%)</span>
                        <span className="font-black text-emerald-600">{(payroll.commissionPay || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Tăng Ca (OT)</span>
                        <span className="font-black text-amber-600">{(payroll.overtimePay || 0).toLocaleString()}</span>
                      </div>

                      {payroll.holidayBonus > 0 && (
                        <div className="flex justify-between items-center text-xs">
                           <span className="font-bold text-slate-700">Thưởng Lễ</span>
                           <span className="font-black text-amber-600">{(payroll.holidayBonus || 0).toLocaleString()}</span>
                        </div>
                      )}

                      {payroll.tetBonus > 0 && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2 mt-4 relative overflow-hidden">
                          <div className="absolute top-0 right-0 opacity-10"><PartyPopper className="w-12 h-12 text-amber-600" /></div>
                          <div className="flex items-center gap-2 mb-1 relative z-10">
                            <PartyPopper className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest">Phúc lợi Tết Nguyên Đán</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] relative z-10">
                            <span className="font-bold text-amber-700">Trước Tết (Xe & Trực chiến)</span>
                            <span className="font-black text-amber-900">{(payroll.tetBonusBefore || 0).toLocaleString()}đ</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] relative z-10">
                            <span className="font-bold text-amber-700">Sau Tết (Lì xì & Chuyên cần)</span>
                            <span className="font-black text-amber-900">{(payroll.tetBonusAfter || 0).toLocaleString()}đ</span>
                          </div>
                        </div>
                      )}

                      {payroll.seniorityBonus > 0 && (
                        <div className="flex justify-between items-center text-xs">
                           <span className="font-bold text-slate-700">Thâm Niên</span>
                           <span className="font-black text-indigo-600">{(payroll.seniorityBonus || 0).toLocaleString()}</span>
                        </div>
                      )}

                      {(payroll.fine > 0 || payroll.shortage > 0 || payroll.advance > 0) && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-50 mt-2">
                          <div className="flex justify-between items-center text-[11px] font-black text-rose-500 uppercase pb-1">
                            <span>Khấu Trừ Tài Chính</span>
                            <span>-{((payroll.fine || 0) + (payroll.shortage || 0) + (payroll.advance || 0)).toLocaleString()}</span>
                          </div>
                          <div className="pl-4 space-y-1">
                            {payroll.fine > 0 && <PaySlipDetail label="Vi phạm / Kỷ luật / vắng" value={payroll.fine} isCut={true} />}
                            {payroll.shortage > 0 && <PaySlipDetail label="Tiền thiếu" value={payroll.shortage} isCut={true} />}
                            {payroll.advance > 0 && <PaySlipDetail label="Tiền tạm ứng trong tháng" value={payroll.advance} isCut={true} />}
                          </div>
                        </div>
                      )}

                      {payroll.calculationNote && (
                        <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-1.5 mb-1.5 text-slate-400">
                            <Info className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Diễn giải cách tính</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
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
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tổng lương thực nhận</span>
                        <div className="text-3xl font-black text-white tabular-nums">
                          {(payroll.netPay || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">VNĐ</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                             onClick={() => handlePrintPayslip(payroll)}
                             className="py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 bg-white/5 text-white hover:bg-white/10"
                           >
                             <Printer className="w-3.5 h-3.5" /> In Phiếu
                           </button>
                           <button 
                             onClick={() => handleFinalizeIndividual(payroll)}
                             disabled={isArchived}
                             className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                               isArchived 
                                 ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700' 
                                 : 'bg-white text-slate-900 hover:bg-indigo-50'
                             }`}
                           >
                             {isArchived ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                             {isArchived ? 'Đã Chốt' : 'Chốt & Lưu'}
                           </button>
                        </div>
                        
                        {(!isResigned || isProcessing) ? (
                          <button 
                            onClick={() => handleSettlementAndResignation(payroll)}
                            disabled={isProcessing || isArchived}
                            className={`w-full py-3.5 rounded-xl font-black text-[9px] uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border ${
                              isArchived 
                                ? 'border-slate-700 text-slate-600 bg-slate-800/20 cursor-not-allowed' 
                                : 'border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500 hover:text-white'
                            } disabled:opacity-50`}
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                            QUYẾT TOÁN NGHỈ VIỆC
                          </button>
                        ) : (
                          <div className="w-full py-3.5 bg-rose-900/40 text-rose-200 border-rose-800 border rounded-xl text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
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
      )}

      {subTab === 'ledger' && (
        <div className="animate-in fade-in duration-500 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
                <BookOpen className="w-6 h-6" />
              </div>
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
      )}
      {/* Print Preview Modal */}
      {showPrintPreview && selectedPayrollForPrint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Xem trước Phiếu lương</h3>
                <p className="text-xs text-slate-500 font-bold uppercase">Khổ giấy 80mm - Máy in nhiệt</p>
              </div>
              <button 
                onClick={() => setShowPrintPreview(false)}
                className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm"
              >
                <LucideX className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50 flex justify-center">
              {/* Thermal Receipt Preview */}
              <div 
                style={{ width: '80mm' }}
                className="bg-white shadow-xl p-5 font-mono text-[11px] text-black leading-tight border border-slate-200"
              >
                {(() => {
                  const emp = data.employees.find(e => e.id === selectedPayrollForPrint.employeeId);
                  const seniorityDays = selectedPayrollForPrint.seniorityDays || (emp ? calculateSeniority(emp.joinDate) : 0);
                  const { policy: currentPolicy } = determineCurrentPolicy(emp!, policies, seniorityDays);
                  
                  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
                  const daysInMonthTotal = new Date(yearNum, monthNum, 0).getDate();
                  const monthAttendance = data.attendance.filter(a => a.employeeId === selectedPayrollForPrint.employeeId && a.date.startsWith(selectedMonth));
                  const workingDays = monthAttendance.filter(a => a.status === 'Present').length;
                  const totalHoursWorked = monthAttendance.filter(a => a.status === 'Present').reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
                  const proRateFactor = daysInMonthTotal > 0 ? (workingDays / daysInMonthTotal) : 0;

                  const employeeViolations = violationOccurrences.filter(vo => vo.employeeId === selectedPayrollForPrint.employeeId && vo.month === selectedMonth);
                  const checkPenalty = (keyword: string) => employeeViolations.some(vo => {
                      const vt = violationTypes.find(v => v.id === vo.violationTypeId);
                      if (!vt) return false;
                      const pStr = (vo.occurrence === 1 ? vt.fine1 : vo.occurrence === 2 ? vt.fine2 : vt.fine3).toLowerCase();
                      return pStr.includes(keyword);
                  });

                  const isAttendanceCut = checkPenalty('chuyên cần');
                  const isCleaningCut = checkPenalty('vệ sinh');
                  const isCSKHCut = checkPenalty('cskh');
                  const isDinnerCut = checkPenalty('ăn tối');
                  const isHousingCut = checkPenalty('hỗ trợ ở') || checkPenalty('nhà ở') || checkPenalty('mất ở');
                  const isResponsibilityCut = checkPenalty('trách nhiệm');
                  const isApproved = responsibilityApprovals.some(ra => ra.employeeId === selectedPayrollForPrint.employeeId && ra.month === selectedMonth);

                  const otMinutes = data.overtime
                    .filter(ot => ot.employeeId === selectedPayrollForPrint.employeeId && ot.date.startsWith(selectedMonth))
                    .reduce((sum, record) => sum + record.hours, 0);
                  const otHours = Number((otMinutes / 60).toFixed(1));

                  return (
                    <>
                      <div className="text-center border-b border-dashed border-black pb-3 mb-3">
                        <h1 className="text-[14px] font-black m-0">PHÚC SANG</h1>
                        <p className="text-[10px] my-0.5">PHIẾU THANH TOÁN LƯƠNG</p>
                        <p className="text-[12px] font-bold my-0.5">Tháng: {selectedPayrollForPrint.month}</p>
                      </div>

                      <div className="mb-3 text-[10px]">
                        <p className="my-0.5"><b>NV:</b> {selectedPayrollForPrint.employeeName}</p>
                        <p className="my-0.5"><b>CV:</b> {emp?.position || 'Nhân viên'} ({currentPolicy?.name})</p>
                        <p className="my-0.5"><b>Loại:</b> {selectedPayrollForPrint.isOfficial ? 'Chính thức' : 'Thử việc'}</p>
                        <p className="my-0.5"><b>Ngày công:</b> {workingDays}/{daysInMonthTotal} ({totalHoursWorked}h)</p>
                      </div>

                      <div className="border-t border-b border-dashed border-black py-2 mb-3">
                        <div className="flex justify-between mb-1 font-bold">
                          <span>Lương cơ bản:</span>
                          <span>{(selectedPayrollForPrint.basicSalary || 0).toLocaleString()}</span>
                        </div>
                        
                        <div className="flex justify-between mb-1 font-bold">
                          <span>Phụ cấp (Theo công):</span>
                          <span>{(selectedPayrollForPrint.allowance || 0).toLocaleString()}</span>
                        </div>
                        
                        <div className="pl-3 space-y-0.5 text-[10px]">
                          {currentPolicy?.attendanceAllowance! > 0 && (
                            <div className={`flex justify-between ${isAttendanceCut ? 'line-through opacity-50' : ''}`}>
                              <span>- Chuyên cần:</span>
                              <span>{Math.round((isAttendanceCut ? 0 : currentPolicy?.attendanceAllowance!) * proRateFactor).toLocaleString()}</span>
                            </div>
                          )}
                          {currentPolicy?.cleaningAllowance! > 0 && (
                            <div className={`flex justify-between ${isCleaningCut ? 'line-through opacity-50' : ''}`}>
                              <span>- Vệ sinh:</span>
                              <span>{Math.round((isCleaningCut ? 0 : currentPolicy?.cleaningAllowance!) * proRateFactor).toLocaleString()}</span>
                            </div>
                          )}
                          {currentPolicy?.customerServiceAllowance! > 0 && (
                            <div className={`flex justify-between ${isCSKHCut ? 'line-through opacity-50' : ''}`}>
                              <span>- CSKH:</span>
                              <span>{Math.round((isCSKHCut ? 0 : currentPolicy?.customerServiceAllowance!) * proRateFactor).toLocaleString()}</span>
                            </div>
                          )}
                          {currentPolicy?.dinnerAllowance! > 0 && (
                            <div className={`flex justify-between ${isDinnerCut ? 'line-through opacity-50' : ''}`}>
                              <span>- Ăn tối:</span>
                              <span>{Math.round((isDinnerCut ? 0 : currentPolicy?.dinnerAllowance!) * workingDays).toLocaleString()}</span>
                            </div>
                          )}
                          {currentPolicy?.housingAllowance! > 0 && (
                            <div className={`flex justify-between ${isHousingCut ? 'line-through opacity-50' : ''}`}>
                              <span>- Hỗ trợ ở:</span>
                              <span>{Math.round((isHousingCut ? 0 : currentPolicy?.housingAllowance!) * proRateFactor).toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {currentPolicy?.responsibilityAllowance! > 0 && (
                          <div className={`flex justify-between mt-1 font-bold ${(!isApproved || isResponsibilityCut) ? 'line-through opacity-50' : ''}`}>
                            <span>Trách nhiệm:</span>
                            <span>{Math.round((isResponsibilityCut ? 0 : (currentPolicy?.responsibilityAllowance || 0)) * proRateFactor).toLocaleString()}</span>
                          </div>
                        )}

                        <div className="flex justify-between mt-1">
                          <span>Hoa hồng ({currentPolicy?.commissionRate}%):</span>
                          <span>{(selectedPayrollForPrint.commissionPay || 0).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Tăng ca ({otHours}h):</span>
                          <span>{(selectedPayrollForPrint.overtimePay || 0).toLocaleString()}</span>
                        </div>

                        {selectedPayrollForPrint.holidayBonus > 0 && (
                          <div className="flex justify-between">
                            <span>Thưởng Lễ:</span>
                            <span>{(selectedPayrollForPrint.holidayBonus || 0).toLocaleString()}</span>
                          </div>
                        )}

                        {selectedPayrollForPrint.tetBonus > 0 && (
                          <div className="mt-1">
                            <div className="flex justify-between">
                              <span>Thưởng Tết (Trước):</span>
                              <span>{(selectedPayrollForPrint.tetBonusBefore || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Thưởng Tết (Sau):</span>
                              <span>{(selectedPayrollForPrint.tetBonusAfter || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        )}

                        {selectedPayrollForPrint.seniorityBonus > 0 && (
                          <div className="flex justify-between">
                            <span>Thâm niên:</span>
                            <span>{(selectedPayrollForPrint.seniorityBonus || 0).toLocaleString()}</span>
                          </div>
                        )}
                        
                        {(selectedPayrollForPrint.fine > 0 || selectedPayrollForPrint.shortage > 0 || selectedPayrollForPrint.advance > 0) && (
                          <div className="mt-2 border-t border-dashed border-black pt-1">
                            <div className="flex justify-between font-bold">
                              <span>Khấu trừ:</span>
                              <span>-{((selectedPayrollForPrint.fine || 0) + (selectedPayrollForPrint.shortage || 0) + (selectedPayrollForPrint.advance || 0)).toLocaleString()}</span>
                            </div>
                            <div className="pl-3 space-y-0.5 text-[10px]">
                              {selectedPayrollForPrint.fine > 0 && <div className="flex justify-between"><span>- Vi phạm/Vắng:</span><span>{selectedPayrollForPrint.fine.toLocaleString()}</span></div>}
                              {selectedPayrollForPrint.shortage > 0 && <div className="flex justify-between"><span>- Tiền thiếu:</span><span>{selectedPayrollForPrint.shortage.toLocaleString()}</span></div>}
                              {selectedPayrollForPrint.advance > 0 && <div className="flex justify-between"><span>- Tạm ứng:</span><span>{selectedPayrollForPrint.advance.toLocaleString()}</span></div>}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between text-[14px] font-black mb-4">
                        <span>THỰC NHẬN:</span>
                        <span>{(selectedPayrollForPrint.netPay || 0).toLocaleString()}</span>
                      </div>

                      <div className="text-center text-[9px] mt-3 border-t border-dashed border-black pt-2">
                        <p className="my-0.5">Cảm ơn bạn đã đồng hành!</p>
                        <p className="my-0.5 italic">Hệ thống Quản trị Phúc Sang</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
              <button 
                onClick={() => setShowPrintPreview(false)}
                className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all border border-slate-200"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmPrint}
                className="flex-[2] py-4 px-6 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Xác nhận In Phiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AccruedDetail = ({ label, value, isCut = false }: { label: string; value: number; isCut?: boolean }) => (
  <div className="flex justify-between items-center py-1 text-[10px] border-b border-slate-50/50">
    <span className={`font-semibold ${isCut ? 'text-rose-400' : 'text-slate-600'}`}>
      {label}
    </span>
    <div className="text-right">
       <span className={`font-black ${isCut ? 'text-rose-500' : 'text-indigo-600'}`}>
         {(value || 0).toLocaleString()}đ
       </span>
       {!isCut && value > 0 && <p className="text-[7px] text-slate-400 uppercase font-bold tracking-tighter leading-none">Tích lũy</p>}
    </div>
  </div>
);

const PaySlipDetail = ({ label, value, isCut = false }: { label: string; value: number; isCut?: boolean }) => (
  <div className="flex justify-between items-center py-0.5 text-[10px]">
    <span className={`font-medium ${isCut ? 'text-rose-500' : 'text-slate-400'}`}>
      {label}:
    </span>
    <span className={`font-bold ${isCut ? 'text-rose-600' : 'text-slate-600'}`}>{(value || 0).toLocaleString()}</span>
  </div>
);

const SubTabBtn = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-[11px] uppercase tracking-tighter whitespace-nowrap ${active ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-100' : 'text-slate-500 hover:text-slate-800'}`}>
    <Icon className="w-4 h-4" /> {label}
  </button>
);

export default PayrollManager;
