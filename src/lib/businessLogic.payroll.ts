import type {
  Employee,
  SalaryPolicy,
  AttendanceRecord,
  OvertimeRecord,
  SalesRecord,
  ShortageRecord,
  AdvanceRecord,
  PayrollRecord,
  Holiday,
  TetCampaign,
  ViolationType,
  ViolationOccurrence,
} from '../../types';
import { generateId } from './businessLogic.core';

export const dummyPolicy: SalaryPolicy = {
  id: 'dummy',
  name: 'Chưa thiết lập',
  salaryType: 'monthly',
  baseSalary: 0,
  startThreshold: 0,
  endThreshold: 0,
  otRate: 0,
  commissionRate: 0,
  seniorityBonusPerYear: 0,
  attendanceAllowance: 0,
  cleaningAllowance: 0,
  customerServiceAllowance: 0,
  dinnerAllowance: 0,
  housingAllowance: 0,
  responsibilityAllowance: 0,
  isProRated: false,
};

export const isStaffActive = (e: Pick<Employee, 'resignedDate'> | null | undefined) => {
  if (!e) return false;
  const resigned = e.resignedDate;
  return !resigned || String(resigned).trim() === '';
};

export const getPolicyLogicDescription = (_policies: SalaryPolicy[]): string => {
  return "Hệ thống áp dụng logic 'Top-Down Range Matching': Ưu tiên mốc Bắt đầu cao nhất trước. Mốc kết thúc 0 được hiểu là Vô cực (∞).";
};

export const calculateSeniority = (joinDateStr: string, asOfDateStr?: string): number => {
  if (!joinDateStr) return 0;
  const joinDate = new Date(joinDateStr);
  const targetDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  if (isNaN(joinDate.getTime()) || isNaN(targetDate.getTime())) return 0;

  try {
    joinDate.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
  } catch {
    return 0;
  }

  const diffTime = targetDate.getTime() - joinDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays < 0 ? 0 : diffDays;
};

export const determineCurrentPolicy = (
  employee: Employee,
  policies: SalaryPolicy[],
  seniorityDays: number
): { policy: SalaryPolicy; isOfficial: boolean } => {
  const safePolicies = (policies || []).filter(Boolean);
  if (safePolicies.length === 0) return { policy: dummyPolicy, isOfficial: false };

  if (employee && employee.assignedPolicyId) {
    const assigned = safePolicies.find(p => p.id === employee.assignedPolicyId);
    if (assigned) return { policy: assigned, isOfficial: true };
  }

  let candidates = [...safePolicies];
  if (employee.position === 'Nhân viên') {
    candidates = candidates.filter(p => !p.name.toLowerCase().includes('quản lý'));
  }

  const sortedCandidates = candidates.sort(
    (a, b) => (b.startThreshold || 0) - (a.startThreshold || 0)
  );

  const match = sortedCandidates.find(p => {
    const start = p.startThreshold || 0;
    const end = p.endThreshold === 0 || p.endThreshold === null ? Infinity : p.endThreshold;
    return seniorityDays >= start && seniorityDays < end;
  });

  const finalPolicy = match || sortedCandidates[sortedCandidates.length - 1] || dummyPolicy;

  return {
    policy: finalPolicy,
    isOfficial: seniorityDays >= 30,
  };
};

export const calculateEmployeePayroll = (
  emp: Employee,
  selectedMonth: string,
  policies: SalaryPolicy[],
  holidays: Holiday[],
  attendance: AttendanceRecord[],
  overtime: OvertimeRecord[],
  sales: SalesRecord[],
  tetConfig?: TetCampaign,
  _workingDaysFixed: number = 26,
  violationTypes: ViolationType[] = [],
  violationOccurrences: ViolationOccurrence[] = [],
  isResponsibilityApproved: boolean = false,
  shortages: ShortageRecord[] = [],
  advances: AdvanceRecord[] = [],
  existingId?: string
): PayrollRecord => {
  const parts = (selectedMonth || '').split('-');
  if (parts.length < 2) {
    return {
      id: existingId || generateId(),
      employeeId: emp.id,
      employeeName: emp.name,
      month: selectedMonth || '',
      basicSalary: 0,
      allowance: 0,
      responsibilityPay: 0,
      overtimePay: 0,
      commissionPay: 0,
      seniorityBonus: 0,
      holidayBonus: 0,
      tetBonus: 0,
      tetBonusBefore: 0,
      tetBonusAfter: 0,
      advance: 0,
      shortage: 0,
      fine: 0,
      netPay: 0,
      seniorityDays: 0,
      isOfficial: false,
      hasTetCommitment: false,
    };
  }

  const [year, month] = parts.map(Number);
  if (isNaN(year) || isNaN(month)) {
    return {
      id: existingId || generateId(),
      employeeId: emp.id,
      employeeName: emp.name,
      month: selectedMonth || '',
      basicSalary: 0,
      allowance: 0,
      responsibilityPay: 0,
      overtimePay: 0,
      commissionPay: 0,
      seniorityBonus: 0,
      holidayBonus: 0,
      tetBonus: 0,
      tetBonusBefore: 0,
      tetBonusAfter: 0,
      advance: 0,
      shortage: 0,
      fine: 0,
      netPay: 0,
      seniorityDays: 0,
      isOfficial: false,
      hasTetCommitment: false,
    };
  }

  // 1. Seniority as of the 15th of the month
  const referenceDate = `${selectedMonth}-15`;
  const seniorityAtReference = calculateSeniority(emp.joinDate, referenceDate);
  const { policy: currentPolicy, isOfficial } = determineCurrentPolicy(
    emp,
    policies,
    seniorityAtReference
  );

  // 2. Attendance Stats
  const monthAttendance = attendance.filter(
    a => a.employeeId === emp.id && a.date.startsWith(selectedMonth)
  );
  const workingDays = monthAttendance.filter(a => a.status === 'Present').length || 0;
  const totalHoursWorked =
    monthAttendance
      .filter(a => a.status === 'Present')
      .reduce((sum, a) => sum + (Number(a.hours) || 0), 0) || 0;

  const dateObj = new Date(year, month, 0);
  const daysInMonthTotal = isNaN(dateObj.getTime()) ? 30 : dateObj.getDate();
  const currentMonthStr = month.toString().padStart(2, '0');

  let monthHolidaysCount = 0;
  for (let d = 1; d <= (daysInMonthTotal || 30); d++) {
    if (holidays.some(h => h.date === `${currentMonthStr}-${d.toString().padStart(2, '0')}`))
      monthHolidaysCount++;
  }

  // 3. Disciplinary Deductions
  const notes: string[] = [];
  notes.push(
    `Bậc lương: ${currentPolicy.name} (Thâm niên 15/${month}: ${seniorityAtReference} ngày)`
  );

  let lostAttendance = false,
    lostCleaning = false,
    lostCSKH = false,
    lostDinner = false,
    lostHousing = false,
    lostResponsibility = false;
  let disciplinaryDeduction = 0;

  // Chuẩn hóa chuỗi phạt: bỏ dấu, lowercase, giữ spaces — tránh miss-match do lỗi gõ dấu
  const normVN = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd');

  violationOccurrences
    .filter(vo => vo.employeeId === emp.id && vo.month === selectedMonth)
    .forEach(vo => {
      const vType = violationTypes.find(vt => vt.id === vo.violationTypeId);
      if (vType) {
        const rawPenaltyStr =
          (vo.occurrence === 1 ? vType.fine1 : vo.occurrence === 2 ? vType.fine2 : vType.fine3) ||
          '';
        const pStr = normVN(String(rawPenaltyStr));
        if (pStr.includes('chuyen can')) lostAttendance = true;
        if (pStr.includes('ve sinh')) lostCleaning = true;
        if (pStr.includes('cskh')) lostCSKH = true;
        if (pStr.includes('an toi')) lostDinner = true;
        if (pStr.includes('nha o') || pStr.includes('ho tro o') || pStr.includes('mat o'))
          lostHousing = true;
        if (pStr.includes('trach nhiem')) lostResponsibility = true;

        const match = pStr.match(/\d+/g);
        if (match) {
          const n = parseInt(match.join(''));
          const amount = n < 1000 ? n * 1000 : n;
          disciplinaryDeduction += amount;
          notes.push(`Phạt: ${vType.name} (${amount.toLocaleString()}đ)`);
        }
      }
    });

  // 4. Basic Salary Calculation
  const baseSalary = Number(currentPolicy.baseSalary) || 0;
  const salaryType = currentPolicy.salaryType || 'monthly';
  let basicActual = 0;
  const proRateFactor = daysInMonthTotal > 0 ? workingDays / daysInMonthTotal : 0;

  if (salaryType === 'daily') {
    basicActual = Math.round((baseSalary / 11) * totalHoursWorked);
    notes.push(
      `Lương cơ bản (Theo giờ): ${baseSalary.toLocaleString()}đ/ca 11h. Thực tính: ${totalHoursWorked}h.`
    );
  } else {
    basicActual = Math.round((baseSalary / (daysInMonthTotal || 30)) * workingDays);
    notes.push(
      `Lương cơ bản (Tháng): ${baseSalary.toLocaleString()}đ. Pro-rated: ${workingDays}/${daysInMonthTotal} ngày.`
    );
  }

  // 5. Allowances
  let totalAllowance = 0;
  const attAll = lostAttendance ? 0 : Number(currentPolicy.attendanceAllowance) || 0;
  const cleanAll = lostCleaning ? 0 : Number(currentPolicy.cleaningAllowance) || 0;
  const csAll = lostCSKH ? 0 : Number(currentPolicy.customerServiceAllowance) || 0;
  const houseAll = lostHousing ? 0 : Number(currentPolicy.housingAllowance) || 0;
  const dinnerAll = lostDinner ? 0 : Number(currentPolicy.dinnerAllowance) || 0;

  if (salaryType === 'monthly') {
    totalAllowance =
      Math.round((attAll + cleanAll + csAll + houseAll) * proRateFactor) +
      Math.round(dinnerAll * workingDays);
    notes.push(
      `Phụ cấp tháng (Chuyên cần, VS, CSKH, Nhà): Pro-rated. Cơm: ${dinnerAll.toLocaleString()}đ x ${workingDays} ngày.`
    );
  } else {
    totalAllowance = Math.round(dinnerAll * workingDays);
    notes.push(`Phụ cấp cơm: ${dinnerAll.toLocaleString()}đ x ${workingDays} ngày.`);
  }

  // 6. Responsibility Pay
  let responsibilityPay = 0;
  if (isResponsibilityApproved) {
    if (!lostResponsibility) {
      responsibilityPay = Math.round(
        ((Number(currentPolicy.responsibilityAllowance) || 0) / (daysInMonthTotal || 30)) *
          workingDays
      );
      notes.push(`Lương trách nhiệm: Duyệt OK. Thực tính pro-rated theo ngày công.`);
    } else {
      notes.push(`Lương trách nhiệm: Bị tước do vi phạm kỷ luật.`);
    }
  } else {
    if ((Number(currentPolicy.responsibilityAllowance) || 0) > 0) {
      notes.push(`Lương trách nhiệm: Chưa có phê duyệt (responsibilityApprovals).`);
    }
  }

  // 7. OT, Commission, Seniority
  const commPay = Math.round(
    sales
      .filter(s => s.employeeId === emp.id && s.date.startsWith(selectedMonth))
      .reduce((sum, s) => sum + (Number(s.salesAmount) || 0), 0) *
      ((Number(currentPolicy.commissionRate) || 0) / 100)
  );
  const otHours =
    overtime
      .filter(ot => ot.employeeId === emp.id && ot.date.startsWith(selectedMonth))
      .reduce((sum, ot) => sum + (Number(ot.hours) || 0), 0) / 60;
  const otPay = Math.round(otHours * (Number(currentPolicy.otRate) || 0));
  const holidayBonus = Math.round(
    monthHolidaysCount *
      (salaryType === 'daily' ? baseSalary : baseSalary / (daysInMonthTotal || 30))
  );

  if (otPay > 0)
    notes.push(`Tăng ca: ${otHours.toFixed(1)}h x ${currentPolicy.otRate.toLocaleString()}đ/h.`);
  if (commPay > 0) notes.push(`Hoa hồng: ${commPay.toLocaleString()}đ.`);

  // 8. Tet Bonus
  let tetBonusBefore = 0;
  let tetBonusAfter = 0;
  if (tetConfig) {
    const monthStr = selectedMonth;
    if (tetConfig.date28Tet && monthStr === tetConfig.date28Tet.slice(0, 7)) {
      if (monthAttendance.some(a => a.date === tetConfig.date28Tet && a.status === 'Present'))
        tetBonusBefore += Number(tetConfig.carAllowance) || 0;
    }
    if (tetConfig.date29Tet && monthStr === tetConfig.date29Tet.slice(0, 7)) {
      if (monthAttendance.some(a => a.date === tetConfig.date29Tet && a.status === 'Present'))
        tetBonusBefore += Number(tetConfig.bonus29Tet) || 0;
    }
    if (tetConfig.date30Tet && monthStr === tetConfig.date30Tet.slice(0, 7)) {
      if (monthAttendance.some(a => a.date === tetConfig.date30Tet && a.status === 'Present'))
        tetBonusBefore += Number(tetConfig.bonus30Tet) || 0;
    }
    if (tetConfig.beforeTetExtraDays && tetConfig.beforeTetExtraDays.length > 0) {
      if (
        tetConfig.beforeTetExtraDays.every(d =>
          monthAttendance.some(a => a.date === d && a.status === 'Present')
        )
      ) {
        if (monthStr === tetConfig.beforeTetExtraDays[0].slice(0, 7))
          tetBonusBefore += Number(tetConfig.beforeTetExtraBonus) || 0;
      }
    }
    if (tetConfig.afterTetDate && monthStr === tetConfig.afterTetDate.slice(0, 7)) {
      if (monthAttendance.some(a => a.date === tetConfig.afterTetDate && a.status === 'Present'))
        tetBonusAfter += Number(tetConfig.lixiBonus) || 0;
    }
    if (tetConfig.afterTetExtraDays && tetConfig.afterTetExtraDays.length > 0) {
      if (
        tetConfig.afterTetExtraDays.every(d =>
          monthAttendance.some(a => a.date === d && a.status === 'Present')
        )
      ) {
        if (monthStr === tetConfig.afterTetExtraDays[0].slice(0, 7))
          tetBonusAfter += Number(tetConfig.afterTetExtraBonus) || 0;
      }
    }
  }

  let lastDayOfMonth = '';
  try {
    const lastDayObj = new Date(year, month, 0);
    if (!isNaN(lastDayObj.getTime())) lastDayOfMonth = lastDayObj.toISOString().split('T')[0];
  } catch (error) {
    console.error(`Lỗi khi tính ngày cuối tháng cho ${selectedMonth}:`, error);
    // Fallback: sử dụng ngày cuối tháng mặc định
    lastDayOfMonth = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
  }

  const seniorityAtMonthEnd = calculateSeniority(emp.joinDate, lastDayOfMonth);
  const seniorityBonus = isOfficial
    ? Math.floor(seniorityAtMonthEnd / 365) * (Number(currentPolicy.seniorityBonusPerYear) || 0)
    : 0;
  if (seniorityBonus > 0)
    notes.push(`Thưởng thâm niên: ${Math.floor(seniorityAtMonthEnd / 365)} năm.`);

  const shortageAmount = shortages
    .filter(s => s.employeeId === emp.id && s.date.startsWith(selectedMonth))
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalAdvance = advances
    .filter(ad => ad.employeeId === emp.id && ad.date.startsWith(selectedMonth))
    .reduce((sum, ad) => sum + (Number(ad.amount) || 0), 0);

  if (totalAdvance > 0) notes.push(`ỨNG LƯƠNG: -${totalAdvance.toLocaleString()}đ.`);
  if (shortageAmount > 0) notes.push(`THIẾU HỤT: -${shortageAmount.toLocaleString()}đ.`);

  const tetTotal = tetBonusBefore + tetBonusAfter;
  const rawNet = Math.round(
    basicActual +
      totalAllowance +
      responsibilityPay +
      otPay +
      commPay +
      seniorityBonus +
      holidayBonus +
      tetTotal -
      disciplinaryDeduction -
      shortageAmount -
      totalAdvance
  );
  const netPay = Number(rawNet) || 0;

  return {
    id: existingId || generateId(),
    employeeId: emp.id,
    employeeName: emp.name,
    month: selectedMonth,
    basicSalary: Number(basicActual) || 0,
    allowance: Number(totalAllowance) || 0,
    responsibilityPay: Number(responsibilityPay) || 0,
    overtimePay: Number(otPay) || 0,
    commissionPay: Number(commPay) || 0,
    seniorityBonus: Number(seniorityBonus) || 0,
    holidayBonus: Number(holidayBonus) || 0,
    tetBonus: tetTotal,
    tetBonusBefore,
    tetBonusAfter,
    advance: Number(totalAdvance) || 0,
    shortage: Number(shortageAmount) || 0,
    fine: Number(disciplinaryDeduction) || 0,
    netPay: isNaN(netPay) ? 0 : netPay,
    seniorityDays: Number(seniorityAtMonthEnd) || 0,
    isOfficial,
    hasTetCommitment: true,
    calculationNote: notes.join(' | '),
  };
};

export const calculateStaffRanking = (
  sales: SalesRecord[],
  employees: Employee[],
  month: string
) => {
  const monthSales = sales.filter(s => s.date.startsWith(month));
  const totalStoreSales = monthSales.reduce((sum, s) => sum + (Number(s.salesAmount) || 0), 0);
  const rankings = employees
    .map(emp => {
      const empSales = monthSales.filter(s => s.employeeId === emp.id);
      const totalAmount = empSales.reduce((sum, s) => sum + (Number(s.salesAmount) || 0), 0);
      const contribution = totalStoreSales > 0 ? (totalAmount / totalStoreSales) * 100 : 0;
      return { id: emp.id, name: emp.name, totalAmount, contribution, photoUrl: emp.photoUrl };
    })
    .filter(r => r.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);
  return rankings.map((r, idx) => ({ ...r, rank: idx + 1 }));
};
