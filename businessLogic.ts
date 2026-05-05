
import { Employee, SalaryPolicy, AttendanceRecord, OvertimeRecord, SalesRecord, ShortageRecord, AdvanceRecord, PayrollRecord, Holiday, TetCampaign, ViolationType, ViolationOccurrence, ProductGroupRevenue, ProductGroup, ExpenseRecord, RevenueRecord, DiagnosisRange, ExpenseCategory } from './types';
import * as XLSX from 'xlsx';

export const calculateTimeContext = (range: DiagnosisRange, customStart: string, customEnd: string) => {
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE');
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('sv-SE');

  const last7 = new Date(now);
  last7.setDate(now.getDate() - 7);
  const last7Str = last7.toLocaleDateString('sv-SE');

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthStr = thisMonthStart.toLocaleDateString('sv-SE');

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStartStr = lastMonthStart.toLocaleDateString('sv-SE');
  const lastMonthEndStr = lastMonthEnd.toLocaleDateString('sv-SE');

  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const thisYearStr = thisYearStart.toLocaleDateString('sv-SE');

  let start = todayStr;
  let end = todayStr;

  switch (range) {
    case 'today': start = todayStr; end = todayStr; break;
    case 'yesterday': start = yesterdayStr; end = yesterdayStr; break;
    case 'last7': start = last7Str; end = todayStr; break;
    case 'thisMonth': start = thisMonthStr; end = todayStr; break;
    case 'lastMonth': start = lastMonthStartStr; end = lastMonthEndStr; break;
    case 'thisYear': start = thisYearStr; end = todayStr; break;
    case 'custom': start = customStart; end = customEnd; break;
    case 'all': start = '1900-01-01'; end = '2100-12-31'; break;
  }

  return { start, end };
};

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
  isProRated: false
};

export const isUUID = (id: string): boolean => {
  if (!id) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

export const generateId = () => {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
  } catch (e) {}

  const hexChars = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else {
      const r = Math.random() * 16 | 0;
      uuid += hexChars[i === 19 ? (r & 0x3 | 0x8) : r];
    }
  }
  return uuid;
};

export const isStaffActive = (e: any) => {
  if (!e) return false;
  const resigned = e.resignedDate || e.resigned_date;
  return !resigned || String(resigned).trim() === "";
};

export const getPolicyLogicDescription = (policies: SalaryPolicy[]): string => {
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
  } catch (e) {
    return 0;
  }
  
  const diffTime = targetDate.getTime() - joinDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays < 0 ? 0 : diffDays;
};

export const determineCurrentPolicy = (employee: Employee, policies: SalaryPolicy[], seniorityDays: number): { policy: SalaryPolicy, isOfficial: boolean } => {
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

  const sortedCandidates = candidates.sort((a, b) => (b.startThreshold || 0) - (a.startThreshold || 0));

  const match = sortedCandidates.find(p => {
    const start = p.startThreshold || 0;
    const end = (p.endThreshold === 0 || p.endThreshold === null) ? Infinity : p.endThreshold;
    return seniorityDays >= start && seniorityDays < end;
  });

  const finalPolicy = match || sortedCandidates[sortedCandidates.length - 1] || dummyPolicy;
  
  return { 
    policy: finalPolicy, 
    isOfficial: seniorityDays >= 30 
  };
};

export const calculateEmployeePayroll = (emp: Employee, selectedMonth: string, policies: SalaryPolicy[], holidays: Holiday[], attendance: AttendanceRecord[], overtime: OvertimeRecord[], sales: SalesRecord[], tetConfig?: TetCampaign, workingDaysFixed: number = 26, violationTypes: ViolationType[] = [], violationOccurrences: ViolationOccurrence[] = [], isResponsibilityApproved: boolean = false, shortages: ShortageRecord[] = [], advances: AdvanceRecord[] = [], existingId?: string): PayrollRecord => {
  const parts = (selectedMonth || "").split('-');
  if (parts.length < 2) {
    return { id: existingId || generateId(), employeeId: emp.id, employeeName: emp.name, month: selectedMonth || "", basicSalary: 0, allowance: 0, responsibilityPay: 0, overtimePay: 0, commissionPay: 0, seniorityBonus: 0, holidayBonus: 0, tetBonus: 0, tetBonusBefore: 0, tetBonusAfter: 0, advance: 0, shortage: 0, fine: 0, netPay: 0, seniorityDays: 0, isOfficial: false, hasTetCommitment: false };
  }
  
  const [year, month] = parts.map(Number);
  if (isNaN(year) || isNaN(month)) {
    return { id: existingId || generateId(), employeeId: emp.id, employeeName: emp.name, month: selectedMonth || "", basicSalary: 0, allowance: 0, responsibilityPay: 0, overtimePay: 0, commissionPay: 0, seniorityBonus: 0, holidayBonus: 0, tetBonus: 0, tetBonusBefore: 0, tetBonusAfter: 0, advance: 0, shortage: 0, fine: 0, netPay: 0, seniorityDays: 0, isOfficial: false, hasTetCommitment: false };
  }

  // 1. Seniority as of the 15th of the month
  const referenceDate = `${selectedMonth}-15`;
  const seniorityAtReference = calculateSeniority(emp.joinDate, referenceDate);
  const { policy: currentPolicy, isOfficial } = determineCurrentPolicy(emp, policies, seniorityAtReference);
  
  // 2. Attendance Stats
  const monthAttendance = attendance.filter(a => a.employeeId === emp.id && a.date.startsWith(selectedMonth));
  const workingDays = monthAttendance.filter(a => a.status === 'Present').length || 0;
  const totalHoursWorked = monthAttendance.filter(a => a.status === 'Present').reduce((sum, a) => sum + (Number(a.hours) || 0), 0) || 0;
  
  const dateObj = new Date(year, month, 0);
  const daysInMonthTotal = isNaN(dateObj.getTime()) ? 30 : dateObj.getDate();
  const currentMonthStr = month.toString().padStart(2, '0');
  
  let monthHolidaysCount = 0;
  for (let d = 1; d <= (daysInMonthTotal || 30); d++) { 
    if (holidays.some(h => h.date === `${currentMonthStr}-${d.toString().padStart(2, '0')}`)) monthHolidaysCount++; 
  }
  
  // 3. Disciplinary Deductions
  let notes: string[] = [];
  notes.push(`Bậc lương: ${currentPolicy.name} (Thâm niên 15/${month}: ${seniorityAtReference} ngày)`);

  let lostAttendance = false, lostCleaning = false, lostCSKH = false, lostDinner = false, lostHousing = false, lostResponsibility = false;
  let disciplinaryDeduction = 0;
  
  violationOccurrences.filter(vo => vo.employeeId === emp.id && vo.month === selectedMonth).forEach(vo => {
    const vType = violationTypes.find(vt => vt.id === vo.violationTypeId);
    if (vType) {
      const rawPenaltyStr = (vo.occurrence === 1 ? vType.fine1 : (vo.occurrence === 2 ? vType.fine2 : vType.fine3)) || '';
      const pStr = String(rawPenaltyStr).toLowerCase();
      if (pStr.includes('chuyên cần')) lostAttendance = true;
      if (pStr.includes('vệ sinh')) lostCleaning = true;
      if (pStr.includes('cskh')) lostCSKH = true;
      if (pStr.includes('ăn tối')) lostDinner = true;
      if (pStr.includes('hỗ trợ ở') || pStr.includes('nhà ở') || pStr.includes('mất ở')) lostHousing = true;
      if (pStr.includes('trách nhiệm')) lostResponsibility = true;
      
      const match = pStr.match(/\d+/g);
      if (match) { 
        const n = parseInt(match.join('')); 
        const amount = (n < 1000 ? n * 1000 : n);
        disciplinaryDeduction += amount;
        notes.push(`Phạt: ${vType.name} (${amount.toLocaleString()}đ)`);
      }
    }
  });
  
  // 4. Basic Salary Calculation
  const baseSalary = Number(currentPolicy.baseSalary) || 0;
  const salaryType = currentPolicy.salaryType || 'monthly';
  let basicActual = 0;
  const proRateFactor = daysInMonthTotal > 0 ? (workingDays / daysInMonthTotal) : 0;

  if (salaryType === 'daily') {
    basicActual = Math.round((baseSalary / 11) * totalHoursWorked);
    notes.push(`Lương cơ bản (Theo giờ): ${baseSalary.toLocaleString()}đ/ca 11h. Thực tính: ${totalHoursWorked}h.`);
  } else {
    basicActual = Math.round((baseSalary / (daysInMonthTotal || 30)) * workingDays);
    notes.push(`Lương cơ bản (Tháng): ${baseSalary.toLocaleString()}đ. Pro-rated: ${workingDays}/${daysInMonthTotal} ngày.`);
  }
  
  // 5. Allowances
  let totalAllowance = 0;
  const attAll = lostAttendance ? 0 : (Number(currentPolicy.attendanceAllowance) || 0);
  const cleanAll = lostCleaning ? 0 : (Number(currentPolicy.cleaningAllowance) || 0);
  const csAll = lostCSKH ? 0 : (Number(currentPolicy.customerServiceAllowance) || 0);
  const houseAll = lostHousing ? 0 : (Number(currentPolicy.housingAllowance) || 0);
  const dinnerAll = lostDinner ? 0 : (Number(currentPolicy.dinnerAllowance) || 0);

  if (salaryType === 'monthly') {
    totalAllowance = Math.round((attAll + cleanAll + csAll + houseAll) * proRateFactor) + Math.round(dinnerAll * workingDays);
    notes.push(`Phụ cấp tháng (Chuyên cần, VS, CSKH, Nhà): Pro-rated. Cơm: ${dinnerAll.toLocaleString()}đ x ${workingDays} ngày.`);
  } else {
    totalAllowance = Math.round(dinnerAll * workingDays);
    notes.push(`Phụ cấp cơm: ${dinnerAll.toLocaleString()}đ x ${workingDays} ngày.`);
  }
  
  // 6. Responsibility Pay
  let responsibilityPay = 0;
  if (isResponsibilityApproved) {
    if (!lostResponsibility) {
      responsibilityPay = Math.round(((Number(currentPolicy.responsibilityAllowance) || 0) / (daysInMonthTotal || 30)) * workingDays);
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
  const commPay = Math.round(sales.filter(s => s.employeeId === emp.id && s.date.startsWith(selectedMonth)).reduce((sum, s) => sum + (Number(s.salesAmount) || 0), 0) * ((Number(currentPolicy.commissionRate) || 0) / 100));
  const otHours = overtime.filter(ot => ot.employeeId === emp.id && ot.date.startsWith(selectedMonth)).reduce((sum, ot) => sum + (Number(ot.hours) || 0), 0) / 60;
  const otPay = Math.round(otHours * (Number(currentPolicy.otRate) || 0));
  const holidayBonus = Math.round(monthHolidaysCount * (salaryType === 'daily' ? baseSalary : (baseSalary / (daysInMonthTotal || 30))));
  
  if (otPay > 0) notes.push(`Tăng ca: ${otHours.toFixed(1)}h x ${currentPolicy.otRate.toLocaleString()}đ/h.`);
  if (commPay > 0) notes.push(`Hoa hồng: ${commPay.toLocaleString()}đ.`);

  // 8. Tet Bonus
  let tetBonusBefore = 0;
  let tetBonusAfter = 0;
  if (tetConfig) {
    const monthStr = selectedMonth;
    if (tetConfig.date28Tet && monthStr === tetConfig.date28Tet.slice(0, 7)) {
       if (monthAttendance.some(a => a.date === tetConfig.date28Tet && a.status === 'Present')) tetBonusBefore += (Number(tetConfig.carAllowance) || 0);
    }
    if (tetConfig.date29Tet && monthStr === tetConfig.date29Tet.slice(0, 7)) {
       if (monthAttendance.some(a => a.date === tetConfig.date29Tet && a.status === 'Present')) tetBonusBefore += (Number(tetConfig.bonus29Tet) || 0);
    }
    if (tetConfig.date30Tet && monthStr === tetConfig.date30Tet.slice(0, 7)) {
       if (monthAttendance.some(a => a.date === tetConfig.date30Tet && a.status === 'Present')) tetBonusBefore += (Number(tetConfig.bonus30Tet) || 0);
    }
    if (tetConfig.beforeTetExtraDays && tetConfig.beforeTetExtraDays.length > 0) {
      if (tetConfig.beforeTetExtraDays.every(d => monthAttendance.some(a => a.date === d && a.status === 'Present'))) {
        if (monthStr === tetConfig.beforeTetExtraDays[0].slice(0, 7)) tetBonusBefore += (Number(tetConfig.beforeTetExtraBonus) || 0);
      }
    }
    if (tetConfig.afterTetDate && monthStr === tetConfig.afterTetDate.slice(0, 7)) {
       if (monthAttendance.some(a => a.date === tetConfig.afterTetDate && a.status === 'Present')) tetBonusAfter += (Number(tetConfig.lixiBonus) || 0);
    }
    if (tetConfig.afterTetExtraDays && tetConfig.afterTetExtraDays.length > 0) {
      if (tetConfig.afterTetExtraDays.every(d => monthAttendance.some(a => a.date === d && a.status === 'Present'))) {
        if (monthStr === tetConfig.afterTetExtraDays[0].slice(0, 7)) tetBonusAfter += (Number(tetConfig.afterTetExtraBonus) || 0);
      }
    }
  }
  
  let lastDayOfMonth = '';
  try {
      const lastDayObj = new Date(year, month, 0);
      if (!isNaN(lastDayObj.getTime())) lastDayOfMonth = lastDayObj.toISOString().split('T')[0];
  } catch (e) {}

  const seniorityAtMonthEnd = calculateSeniority(emp.joinDate, lastDayOfMonth);
  const seniorityBonus = (isOfficial) ? Math.floor(seniorityAtMonthEnd / 365) * (Number(currentPolicy.seniorityBonusPerYear) || 0) : 0;
  if (seniorityBonus > 0) notes.push(`Thưởng thâm niên: ${Math.floor(seniorityAtMonthEnd / 365)} năm.`);

  const shortageAmount = shortages.filter(s => s.employeeId === emp.id && s.date.startsWith(selectedMonth)).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalAdvance = advances.filter(ad => ad.employeeId === emp.id && ad.date.startsWith(selectedMonth)).reduce((sum, ad) => sum + (Number(ad.amount) || 0), 0);
  
  if (totalAdvance > 0) notes.push(`ỨNG LƯƠNG: -${totalAdvance.toLocaleString()}đ.`);
  if (shortageAmount > 0) notes.push(`THIẾU HỤT: -${shortageAmount.toLocaleString()}đ.`);

  const tetTotal = tetBonusBefore + tetBonusAfter;
  const rawNet = Math.round(basicActual + totalAllowance + responsibilityPay + otPay + commPay + seniorityBonus + holidayBonus + tetTotal - disciplinaryDeduction - shortageAmount - totalAdvance);
  const netPay = (Number(rawNet) || 0);
  
  return { 
    id: existingId || generateId(), employeeId: emp.id, employeeName: emp.name, month: selectedMonth, 
    basicSalary: Number(basicActual) || 0, allowance: Number(totalAllowance) || 0, responsibilityPay: Number(responsibilityPay) || 0, 
    overtimePay: Number(otPay) || 0, commissionPay: Number(commPay) || 0, seniorityBonus: Number(seniorityBonus) || 0, 
    holidayBonus: Number(holidayBonus) || 0, tetBonus: tetTotal, tetBonusBefore, tetBonusAfter,
    advance: Number(totalAdvance) || 0, shortage: Number(shortageAmount) || 0, fine: Number(disciplinaryDeduction) || 0, 
    netPay: isNaN(netPay) ? 0 : netPay, seniorityDays: Number(seniorityAtMonthEnd) || 0, isOfficial, hasTetCommitment: true,
    calculationNote: notes.join(' | ')
  };
};

export const calculateStaffRanking = (sales: SalesRecord[], employees: Employee[], month: string) => {
  const monthSales = sales.filter(s => s.date.startsWith(month));
  const totalStoreSales = monthSales.reduce((sum, s) => sum + (Number(s.salesAmount) || 0), 0);
  const rankings = employees.map(emp => {
    const empSales = monthSales.filter(s => s.employeeId === emp.id);
    const totalAmount = empSales.reduce((sum, s) => sum + (Number(s.salesAmount) || 0), 0);
    const contribution = totalStoreSales > 0 ? (totalAmount / totalStoreSales) * 100 : 0;
    return { id: emp.id, name: emp.name, totalAmount, contribution, photoUrl: emp.photoUrl };
  }).filter(r => r.totalAmount > 0).sort((a, b) => b.totalAmount - a.totalAmount);
  return rankings.map((r, idx) => ({ ...r, rank: idx + 1 }));
};

export const normalizeHeader = (val: any): string => {
  if (val === null || val === undefined) return '';
  // Chuẩn hóa chuỗi: bỏ dấu, bỏ khoảng trắng, chuyển chữ thường
  return String(val).toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export const cleanVNNumber = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let s = val.toString().trim();
  if (s === '' || s === '---' || s === '0') return 0;
  let cleanStr = s.replace(/[^\d.,-]/g, '');
  if (cleanStr.includes('.') && cleanStr.includes(',')) { cleanStr = cleanStr.replace(/\./g, '').replace(',', '.'); } 
  else if (cleanStr.includes(',')) {
    const parts = cleanStr.split(',');
    if (parts[parts.length - 1].length === 3) { cleanStr = cleanStr.replace(/,/g, ''); } 
    else { cleanStr = cleanStr.replace(',', '.'); }
  }
  else if (cleanStr.includes('.')) {
    const parts = cleanStr.split('.');
    if (parts.length > 2 || parts[parts.length - 1].length === 3) { cleanStr = cleanStr.replace(/\./g, ''); }
  }
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const parseVNDate = (dateStr: any): string => {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  
  // Handle Javascript Date objects directly
  if (Object.prototype.toString.call(dateStr) === '[object Date]' || dateStr instanceof Date) {
    const d = dateStr as Date;
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  if (typeof dateStr === 'number') {
    try {
        // Excel serial date to JS Date
        const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch (e) { return ''; }
  }
  
  const rawStr = String(dateStr).trim();
  if (!rawStr) return '';
  
  // Bỏ phần thời gian nếu có (vd: 2024-04-18 15:30:00 -> 2024-04-18)
  const sRaw = rawStr.split(' ')[0];
  const s = sRaw.replace(/[^\d\/\-\.]/g, '');
  if (!s) return '';
  
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let d = 0, m = 0, y = 0;
    const p0 = parseInt(parts[0]);
    const p1 = parseInt(parts[1]);
    const p2 = parseInt(parts[2]);

    if (p0 > 1000) { // YYYY-MM-DD
      y = p0; m = p1; d = p2;
    } else if (p2 > 1000) { // DD-MM-YYYY hoặc MM-DD-YYYY
      y = p2;
      // Thông thường ở VN là DD-MM-YYYY.
      // Nếu p0 > 12 thì chắc chắn p0 là ngày, p1 là tháng.
      if (p0 > 12) { d = p0; m = p1; }
      // Nếu p1 > 12 thì chắc chắn p1 là ngày, p0 là tháng (MM-DD-YYYY).
      else if (p1 > 12) { d = p1; m = p0; }
      // Còn lại (vd: 01/02/2024) thì mặc định theo VN là DD/MM/YYYY
      else { d = p0; m = p1; }
    }
    
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y > 1900 && y < 2100) { 
      return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`; 
    } 
  }
  return '';
};

export const parseHierarchyGroups = (rawPath: any) => {
  const pathStr = (rawPath === null || rawPath === undefined) ? '' : String(rawPath).trim();
  if (!pathStr) return [];
  const parts = pathStr.split(' >> ');
  const nodes: { fullPath: string; name: string; level: number }[] = [];
  let currentPath = '';
  parts.forEach((part, index) => {
    const trimmedPart = part.trim();
    if (trimmedPart) {
      currentPath = currentPath ? `${currentPath} >> ${trimmedPart}` : trimmedPart;
      nodes.push({ fullPath: currentPath, name: trimmedPart, level: index + 1 });
    }
  });
  return nodes;
};

export const processExcelRawData = (data: ArrayBuffer | string, isExcel: boolean): any[] => {
  let rows: any[][] = [];
  try {
    if (isExcel) {
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }); 
    } else {
      let text = (data as string).replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const delimiter = (lines.join('\n').match(/;/g) || []).length > (lines.join('\n').match(/,/g) || []).length ? ';' : ',';
      rows = lines.map(line => line.split(delimiter));
    }
    if (rows.length === 0) return [];
    
    let headerRowIndex = -1;
    // Tìm dòng tiêu đề dựa trên mật độ từ khóa KiotViet/Standard
    const keywords = ['thoigian', 'ngay', 'time', 'nhomhang', 'doanhthu', 'slban', 'soluong', 'tennhom', 'giavon', 'doanhthuthuan', 'loinhuangop'];
    let maxMatch = 0;

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const cells = rows[i].map(c => normalizeHeader(c));
      const matchCount = cells.filter(c => keywords.includes(c)).length;
      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        headerRowIndex = i;
      }
      if (matchCount >= 2) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) return [];
    
    const headers = rows[headerRowIndex].map(h => normalizeHeader(h));
    const dataRows = rows.slice(headerRowIndex + 1);
    
    return dataRows.map(row => {
      const obj: any = {};
      headers.forEach((h, idx) => { 
        if (h) {
          const val = row[idx];
          obj[h] = (val === null || val === undefined) ? '' : val;
        }
      });
      return obj;
    }).filter(o => Object.values(o).some(v => v !== null && v !== '')); // Bỏ dòng rỗng hoàn toàn
  } catch (err) {
    console.error("Lỗi processExcelRawData:", err);
    return [];
  }
};

export const calculateExecutiveInsights = (data: any) => {
  const { revenue = [], expenses = [], payroll = [], employees = [], sales = [] } = data;
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  const monthRevList = revenue.filter((r: any) => r.date.startsWith(currentMonthStr));
  const currentMonthRev = monthRevList.reduce((sum: number, r: any) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
  const todayStr = now.toLocaleDateString('sv-SE');
  const todayRevRec = revenue.find((r: any) => r.date === todayStr);
  const todayRev = todayRevRec ? (Number(todayRevRec.netRevenue) || 0) + (Number(todayRevRec.revenueOther) || 0) : 0;
  const monthExpList = expenses.filter((e: any) => e.date.startsWith(currentMonthStr));
  const currentMonthExp = monthExpList.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const projectedPayroll = payroll.filter((p: any) => p.month === currentMonthStr).reduce((sum: number, p: any) => sum + (Number(p.netPay) || 0), 0);
  const currentMonthGross = monthRevList.reduce((sum: number, r: any) => sum + (Number(r.grossProfit) || 0), 0);
  const projectedNetProfit = currentMonthGross - currentMonthExp;
  const activeStaff = employees.filter((e:any) => isStaffActive(e));
  const profitPerStaff = activeStaff.length > 0 ? projectedNetProfit / activeStaff.length : 0;
  const monthSalesList = sales.filter((s: any) => s.date.startsWith(currentMonthStr));
  const totalConsulted = monthSalesList.reduce((sum: number, s: any) => sum + (Number(s.salesAmount) || 0), 0);
  const coverageRatio = currentMonthRev > 0 ? (totalConsulted / currentMonthRev) * 100 : 0;
  return { todayRev, currentMonthRev, currentMonthExp, projectedPayroll, projectedNetProfit, profitPerStaff, coverageRatio, activeStaffCount: activeStaff.length };
};

export const calculateFinancialHealthScore = (data: any) => {
  const { revenue = [], expenses = [], payroll = [], employees = [], sales = [] } = data;
  if (!revenue || revenue.length === 0) return { score: 0, factors: ["Chưa có dữ liệu"] };
  let score = 70; const factors = [];
  const totalRev = revenue.reduce((sum: number, r: any) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
  const totalGross = revenue.reduce((sum: number, r: any) => sum + (Number(r.grossProfit) || 0), 0);
  const totalPayroll = (payroll || []).reduce((sum: number, p: any) => sum + (Number(p.netPay) || 0), 0);
  const totalOpEx = (expenses || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0) + totalPayroll;
  const netProfit = totalGross - totalOpEx;
  const netMargin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
  if (netMargin > 20) { score += 15; factors.push("Biên lợi nhuận ròng xuất sắc"); }
  const activeStaff = employees.filter((e: any) => isStaffActive(e));
  const rpe = activeStaff.length > 0 ? totalRev / activeStaff.length : 0;
  const totalConsultedSales = (sales || []).reduce((sum: number, s: any) => sum + (Number(s.salesAmount) || 0), 0);
  const coverageRatio = totalRev > 0 ? (totalConsultedSales / totalRev) * 100 : 0;
  if (coverageRatio > 50) { score += 10; factors.push("Đội ngũ sale chủ động tốt (>50% độ phủ)"); }
  const finalizedPayrollTotal = (expenses || []).filter(e => ['Lương cơ bản', 'Hoa hồng', 'Thưởng doanh số', 'Lương nhân viên', 'Lương & Thưởng', 'Thu nhập nhân sự (Biến đổi)'].includes(e.category)).reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + totalPayroll;
  const payrollRatio = totalRev > 0 ? (finalizedPayrollTotal / totalRev) * 100 : 0;
  return { score: Math.min(Math.max(score, 0), 100), factors, netMargin, rpe, payrollRatio, totalRev, netProfit, totalConsultedSales, coverageRatio };
};

export const auditFinancials = (data: any) => {
  const leaks = [];
  const { revenue = [], expenses = [], overtime = [], employees = [], payroll = [], sales = [] } = data;
  const totalRevenue = revenue.reduce((sum: number, r: any) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
  const totalConsulted = sales.reduce((sum: number, s: any) => sum + (Number(s.salesAmount) || 0), 0);
  if (totalRevenue > 0 && totalConsulted / totalRevenue < 0.3) leaks.push("🟡 Tỷ lệ khách tự mua cao (Độ phủ sale < 30%). Cần đẩy mạnh tư vấn.");
  const totalOTMinutes = overtime.reduce((sum: number, ot: any) => sum + (Number(ot.hours) || 0), 0);
  const activeStaff = employees.filter((e: any) => isStaffActive(e));
  if (activeStaff.length > 0 && totalOTMinutes > (activeStaff.length * 20 * 60)) leaks.push("🔴 Tỷ lệ tăng ca (OT) cao.");
  const totalPayroll = (payroll || []).reduce((sum: number, p: any) => sum + (Number(p.netPay) || 0), 0);
  const finalizedPayrollTotal = (expenses || []).filter(e => ['Lương cơ bản', 'Hoa hồng', 'Thưởng doanh số', 'Lương nhân viên', 'Lương & Thưởng', 'Thu nhập nhân sự (Biến đổi)'].includes(e.category)).reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + totalPayroll;
  if (totalRevenue > 0 && finalizedPayrollTotal / totalRevenue > 0.4) leaks.push("🔴 Quỹ lương hạch toán chiếm tỷ trọng cao.");
  return leaks;
};

export const calculateMarketingPerformance = (data: any) => {
  const { sales = [], revenue = [], employees = [] } = data;
  const totalRevenue = revenue.reduce((sum: number, r: any) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
  const totalConsulted = sales.reduce((sum: number, s: any) => sum + (Number(s.salesAmount) || 0), 0);
  const coverageRatio = totalRevenue > 0 ? (totalConsulted / totalRevenue) * 100 : 0;
  const selfServiceGap = totalRevenue - totalConsulted;
  const salesByStaff: Record<string, number> = {};
  sales.forEach((s: any) => { salesByStaff[s.employeeId] = (salesByStaff[s.employeeId] || 0) + (Number(s.salesAmount) || 0); });
  const activeStaffIds = Object.keys(salesByStaff);
  const activeRPE = activeStaffIds.length > 0 ? totalConsulted / activeStaffIds.length : 0;
  const allMonthlySales: number[] = Object.values(salesByStaff);
  let kpiMin = 0, kpiMax = 0;
  if (allMonthlySales.length > 0) {
    const mean = allMonthlySales.reduce((a, b) => a + b, 0) / allMonthlySales.length;
    const variance = allMonthlySales.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allMonthlySales.length;
    kpiMin = Math.max(mean - Math.sqrt(variance), mean * 0.5); 
    const sortedSales = [...allMonthlySales].sort((a, b) => b - a);
    const top20Count = Math.max(Math.ceil(sortedSales.length * 0.2), 1);
    kpiMax = sortedSales.slice(0, top20Count).reduce((a, b) => a + b, 0) / top20Count;
  }
  const activeStaff = employees.filter((e: any) => isStaffActive(e));
  const staffPerformance = activeStaff.map((emp: any) => ({
    id: emp.id, name: emp.name, amount: salesByStaff[emp.id] || 0,
    status: (salesByStaff[emp.id] || 0) >= kpiMax ? 'Elite' : ((salesByStaff[emp.id] || 0) >= kpiMin ? 'Safety' : 'Under')
  })).sort((a: any, b: any) => b.amount - a.amount);
  return { coverageRatio, activeRPE, selfServiceGap, kpiMin, kpiMax, staffPerformance };
};

export const calculateStaffProductivity = (employees: Employee[], revenue: RevenueRecord[]) => {
  const activeStaff = employees.filter((e: any) => isStaffActive(e));
  const staffCount = activeStaff.length;
  if (staffCount === 0) return { currentRPE: 0, trend: [] };
  const monthlyRevenue: Record<string, number> = {};
  revenue.forEach(r => { const month = r.date.slice(0, 7); monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0); });
  const sortedMonths = Object.keys(monthlyRevenue).sort();
  const latestMonth = sortedMonths[sortedMonths.length - 1];
  const currentRPE = latestMonth ? monthlyRevenue[latestMonth] / staffCount : 0;
  const trend = sortedMonths.map(m => ({ month: m, rpe: monthlyRevenue[m] / staffCount, revenue: monthlyRevenue[m] }));
  return { currentRPE, trend, totalStaff: staffCount };
};

export const getCategoryType = (catName: string, categories: ExpenseCategory[]): 'fixed' | 'variable' | 'depreciation' | 'interest' | 'cogs' => {
  const lowerName = catName.toLowerCase();
  
  // 1. Tìm khớp trong danh mục
  let current = (categories || []).find(c => c.name === catName);
  if (!current) {
    current = (categories || []).find(c => 
      c.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(c.name.toLowerCase())
    );
  }

  if (!current) return 'variable';
  
  // 2. Truy vết ngược lên danh mục cha cao nhất
  let safety = 0;
  let temp = current;
  while (temp && temp.parentId && safety < 10) {
    const parent = (categories || []).find(c => c.id === temp.parentId);
    if (!parent) break;
    temp = parent;
    safety++;
  }
  
  // 3. Phân loại dựa trên ID hoặc Tên của danh mục gốc (Root Category)
  const rootId = temp.id;
  const rootName = temp.name.toLowerCase();
  
  if (rootId === 'cat-fixed' || rootName.includes('cố định')) return 'fixed';
  if (rootId === 'cat-depreciation-root' || rootName.includes('khấu hao')) return 'depreciation';
  if (rootId === 'cat-interest-root' || rootName.includes('lãi vay') || rootName.includes('lãi ngân hàng')) return 'interest';
  if (rootName.includes('giá vốn') || rootName.includes('cogs')) return 'cogs';
  
  return 'variable';
};

export const getTopLevelCategory = (catName: string, categories: ExpenseCategory[]): string => {
  const lowerName = catName.toLowerCase();
  
  // 1. Tìm khớp trong danh mục
  let current = (categories || []).find(c => c.name === catName);
  if (!current) {
    current = (categories || []).find(c => 
      c.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(c.name.toLowerCase())
    );
  }

  if (!current) return 'Khác';

  // 2. Truy vết ngược lên danh mục cha cao nhất
  let safety = 0;
  let temp = current;
  while (temp && temp.parentId && safety < 10) {
    const parent = (categories || []).find(c => c.id === temp.parentId);
    if (!parent) break;
    temp = parent;
    safety++;
  }
  
  return temp.name;
};

export const calculateExpenseAnalysis = (expenses: ExpenseRecord[], revenue: RevenueRecord[], payrolls: PayrollRecord[], categories: ExpenseCategory[]) => {
  const totalRev = (revenue || []).reduce((sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
  
  // Smart Priority for Personnel Costs
  const salaryKeywords = ['lương', 'hoa hồng', 'thưởng doanh số', 'thưởng nhân viên', 'phụ cấp', 'tăng ca', 'thực nhận'];
  
  // 1. Calculate from Payroll Ledger (Net Pay)
  const payrollNetPayTotal = (payrolls || []).reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
  
  // 2. Calculate from General Ledger (Salary-related entries)
  const ledgerSalaryTotal = (expenses || []).reduce((sum, e) => {
    const catLower = e.category.toLowerCase();
    if (salaryKeywords.some(kw => catLower.includes(kw))) {
      return sum + (Number(e.amount) || 0);
    }
    return sum;
  }, 0);

  // Use Payroll if available, otherwise use Ledger
  const totalPayroll = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;
  
  // Filter out salary-related expenses from the general ledger to avoid double counting
  const filteredExpenses = (expenses || []).filter(e => {
    const catLower = e.category.toLowerCase();
    return !salaryKeywords.some(kw => catLower.includes(kw));
  });

  const totalOpEx = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + totalPayroll;
  const totalCogs = (revenue || []).reduce((sum, r) => sum + (Number(r.totalCogs) || 0), 0);
  
  const cats: Record<string, number> = {};
  // Personnel is now treated as a FIXED cost as requested by user
  let fixedCosts = totalPayroll; 
  let variableCosts = 0;
  let depreciationCosts = 0;
  let interestCosts = 0;

  // Initialize personnel category in the breakdown
  if (totalPayroll > 0) cats['Nhân sự (Thực nhận)'] = totalPayroll;

  filteredExpenses.forEach(e => {
    cats[e.category] = (cats[e.category] || 0) + (Number(e.amount) || 0);

    const type = getCategoryType(e.category, categories);
    if (type === 'fixed') fixedCosts += Number(e.amount);
    else if (type === 'variable') variableCosts += Number(e.amount);
    else if (type === 'depreciation') depreciationCosts += Number(e.amount);
    else if (type === 'interest') interestCosts += Number(e.amount);
  });
  
  const analysis = Object.entries(cats).map(([name, amount]) => ({
    name,
    amount,
    ratio: totalRev > 0 ? (amount / totalRev) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  // Recalculate break-even
  const totalFixedForBreakEven = fixedCosts + depreciationCosts + interestCosts;
  const variableRatio = totalRev > 0 ? (totalCogs + variableCosts) / totalRev : 0;
  const contributionMarginRatio = 1 - variableRatio;
  const breakEvenRevenue = contributionMarginRatio > 0 ? (totalFixedForBreakEven / contributionMarginRatio) : 0;

  return { 
    analysis, 
    totalOpEx, 
    totalCogs,
    totalCost: totalOpEx,
    payrollRatio: totalRev > 0 ? (totalPayroll / totalRev) * 100 : 0, 
    breakEvenRevenue, 
    safetyMargin: totalRev > 0 ? ((totalRev - breakEvenRevenue) / totalRev) * 100 : 0 
  };
};

export interface MISMetrics {
  benchmarks: {
    name: string;
    actual: number;
    target: number;
    status: 'safe' | 'warning' | 'alert';
    desc: string;
  }[];
  hotspots: {
    category: string;
    currentAmount: number;
    previousAmount: number;
    diff: number;
    diffPercent: number;
  }[];
  allCategories: {
    name: string;
    amount: number;
    ratio: number;
  }[];
}

export const calculateMISMetrics = (
  currentData: { expenses: ExpenseRecord[], revenue: number, payroll: number, cogs: number, categories: ExpenseCategory[] },
  previousData: { expenses: ExpenseRecord[], revenue: number, payroll: number, cogs: number }
): MISMetrics => {
  // 1. Benchmarking Logic
  // Industry Standards (Retail)
  const standards = [
    { name: 'Giá vốn (COGS)', key: 'cogs', target: 65, range: [60, 75] },
    { name: 'Nhân sự (Labor)', key: 'labor', target: 12, range: [10, 18] },
    { name: 'Mặt bằng (Rent)', key: 'rent', target: 10, range: [8, 15] },
    { name: 'Marketing', key: 'marketing', target: 5, range: [3, 8] },
    { name: 'Vận hành (OpEx)', key: 'opex', target: 30, range: [25, 40] }
  ];

  // Calculate actuals
  const currentExpenses = currentData.expenses;
  const currentRev = currentData.revenue;
  const categories = currentData.categories;

  const getMetricActual = (key: string) => {
    if (currentRev <= 0) return 0;
    let amount = 0;
    if (key === 'cogs') amount = currentData.cogs;
    else if (key === 'labor') amount = currentData.payroll;
    else if (key === 'opex') {
      amount = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + currentData.payroll;
    } else {
      // Find categories matching the name
      const matchingCats = categories.filter(c => {
        const name = c.name.toLowerCase();
        if (key === 'rent') return name.includes('mặt bằng') || name.includes('thuê') || name.includes('địa điểm');
        if (key === 'marketing') return name.includes('marketing') || name.includes('quảng cáo') || name.includes('ads');
        return false;
      });
      const catIds = matchingCats.map(c => c.id);
      amount = currentExpenses.filter(e => {
        const cat = categories.find(c => c.name === e.category);
        return cat && (catIds.includes(cat.id) || catIds.includes(cat.parentId || ''));
      }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    }
    return (amount / currentRev) * 100;
  };

  const benchmarks = standards.map(s => {
    const actual = getMetricActual(s.key);
    let status: 'safe' | 'warning' | 'alert' = 'safe';
    if (actual > s.range[1]) status = 'alert';
    else if (actual > s.target) status = 'warning';
    
    return {
      name: s.name,
      actual,
      target: s.target,
      status,
      desc: status === 'safe' ? 'Tối ưu tốt' : status === 'warning' ? 'Chạm ngưỡng' : 'Đang lãng phí'
    };
  });

  // 2. Hotspots Logic (Comparison with previous period)
  const currentCatTotals: Record<string, number> = {};
  currentExpenses.forEach(e => {
    currentCatTotals[e.category] = (currentCatTotals[e.category] || 0) + (Number(e.amount) || 0);
  });

  // Add Labor to current categories analysis
  if (currentData.payroll > 0) {
    currentCatTotals['Nhân sự (Lương)'] = currentData.payroll;
  }

  const previousCatTotals: Record<string, number> = {};
  previousData.expenses.forEach(e => {
    previousCatTotals[e.category] = (previousCatTotals[e.category] || 0) + (Number(e.amount) || 0);
  });
  if (previousData.payroll > 0) {
    previousCatTotals['Nhân sự (Lương)'] = previousData.payroll;
  }

  const hotspots = Object.keys(currentCatTotals).map(cat => {
    const curr = currentCatTotals[cat];
    const prev = previousCatTotals[cat] || 0;
    const diff = curr - prev;
    const diffPercent = prev > 0 ? (diff / prev) * 100 : 100;
    return { category: cat, currentAmount: curr, previousAmount: prev, diff, diffPercent };
  })
  .filter(h => h.diff > 0)
  .sort((a, b) => b.diff - a.diff)
  .slice(0, 3);

  // 3. All Categories Breakdown
  const allCategories = Object.keys(currentCatTotals).map(cat => ({
    name: cat,
    amount: currentCatTotals[cat],
    ratio: currentRev > 0 ? (currentCatTotals[cat] / currentRev) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  return { benchmarks, hotspots, allCategories };
};

export const calculateDailyBreakEven = (revenue: RevenueRecord[], config: { monthlyFixedCosts: number, grossMarginPercent: number }, targetDate?: string) => {
  const now = targetDate ? new Date(targetDate) : new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyFixedCost = config.monthlyFixedCosts / daysInMonth;
  const dailyBreakEvenRevenue = config.grossMarginPercent > 0 ? (dailyFixedCost / (config.grossMarginPercent / 100)) : 0;
  
  const todayStr = now.toISOString().split('T')[0];
  const todayRevenue = revenue.find(r => r.date === todayStr);
  const currentRevenue = todayRevenue ? (Number(todayRevenue.netRevenue) || 0) + (Number(todayRevenue.revenueOther) || 0) : 0;
  
  const progress = dailyBreakEvenRevenue > 0 ? Math.min((currentRevenue / dailyBreakEvenRevenue) * 100, 100) : 0;
  const isProfitable = currentRevenue >= dailyBreakEvenRevenue;
  
  // Monthly trend analysis (all days in the target month)
  const monthlyTrend = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
    const rev = revenue.find(r => r.date === dStr);
    const amount = rev ? (Number(rev.netRevenue) || 0) + (Number(rev.revenueOther) || 0) : 0;
    const profit = rev ? (Number(rev.grossProfit) || 0) : (amount * (config.grossMarginPercent / 100));
    return { 
      date: dStr, 
      amount, 
      profit,
      isProfitable: amount >= dailyBreakEvenRevenue 
    };
  });

  let cumulativeProfit = 0;
  let breakEvenDay: number | null = null;
  for (let i = 0; i < monthlyTrend.length; i++) {
    cumulativeProfit += monthlyTrend[i].profit;
    if (breakEvenDay === null && cumulativeProfit >= config.monthlyFixedCosts) {
      breakEvenDay = i + 1;
    }
  }

  return {
    dailyFixedCost,
    dailyBreakEvenRevenue,
    currentRevenue,
    progress,
    isProfitable,
    trend: monthlyTrend,
    breakEvenDay,
    cumulativeProfit,
    monthlyFixedCosts: config.monthlyFixedCosts
  };
};

export const calculateStrategicSuggestions = (groupRevenue: ProductGroupRevenue[], nextMonthNum: number, viewMode: 'revenue' | 'quantity' = 'revenue') => {
  const yearsSet = new Set<string>();
  groupRevenue.forEach(r => yearsSet.add(r.date.split('-')[0]));
  const yearsCount = Math.max(yearsSet.size, 1);
  
  const data = groupRevenue.filter(r => parseInt(r.date.split('-')[1]) === nextMonthNum);
  
  const groupsMap: Record<string, { name: string, rev: number, qty: number }> = {};
  data.forEach(r => {
    if (!groupsMap[r.groupName]) groupsMap[r.groupName] = { name: r.groupName, rev: 0, qty: 0 };
    groupsMap[r.groupName].rev += (r.netRevenue || (r.amount - (r.returnsValue || 0)));
    groupsMap[r.groupName].qty += (r.quantity || 0);
  });

  return Object.values(groupsMap)
    .map(g => ({
      id: generateId(),
      name: g.name,
      avgRev: g.rev / yearsCount,
      avgQty: g.qty / yearsCount,
      target: '',
      highlights: ''
    }))
    .sort((a, b) => viewMode === 'revenue' ? b.avgRev - a.avgRev : b.avgQty - a.avgQty)
    .slice(0, 10);
};

export const calculateSeasonalityAnalysis = (groupRevenue: ProductGroupRevenue[], groups: ProductGroup[]) => {
  return (groups || []).map(g => {
    const groupRev = groupRevenue.filter(r => r.groupId === g.id || r.groupName === g.name);
    const totalHistorical = groupRev.reduce((sum, r) => sum + (r.netRevenue || (r.amount - (r.returnsValue || 0))), 0);
    const totalQty = groupRev.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalRetQty = groupRev.reduce((sum, r) => sum + (r.returnsQuantity || 0), 0);
    const avgReturnRate = totalQty > 0 ? (totalRetQty / totalQty) * 100 : 0;
    
    return { id: g.id, name: g.name, totalHistorical, abcClass: 'C', bcgStatus: 'Dog', avgReturnRate, inventoryExpection: 0 };
  });
};
