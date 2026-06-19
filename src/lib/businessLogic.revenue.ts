import type {
  Employee,
  ProductGroupRevenue,
  ProductGroup,
  ExpenseRecord,
  RevenueRecord,
  ExpenseCategory,
  PayrollRecord,
  AppData,
  SalesRecord,
  OvertimeRecord,
} from '../../types';
import { generateId } from './businessLogic.core';
import { isStaffActive } from './businessLogic.payroll';

export const calculateExecutiveInsights = (data: Partial<AppData>) => {
  const { revenue = [], expenses = [], payroll = [], employees = [], sales = [] } = data;
  const now = new Date();
  // Dùng local time (sv-SE = YYYY-MM-DD format) để tránh sai múi giờ UTC vs GMT+7
  const currentMonthStr = now.toLocaleDateString('sv-SE').slice(0, 7);
  const monthRevList = revenue.filter(r => r.date.startsWith(currentMonthStr));
  const currentMonthRev = monthRevList.reduce(
    (sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0),
    0
  );
  const todayStr = now.toLocaleDateString('sv-SE');
  const todayRevRec = revenue.find(r => r.date === todayStr);
  const todayRev = todayRevRec
    ? (Number(todayRevRec.netRevenue) || 0) + (Number(todayRevRec.revenueOther) || 0)
    : 0;
  const monthExpList = expenses.filter(e => e.date.startsWith(currentMonthStr));
  const currentMonthExp = monthExpList.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );
  const projectedPayroll = payroll
    .filter(p => p.month === currentMonthStr)
    .reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
  const currentMonthGross = monthRevList.reduce(
    (sum, r) => sum + (Number(r.grossProfit) || 0),
    0
  );
  // Tránh double-count lương: nếu payroll module có dữ liệu, lọc salary ra khỏi ledger
  const normExecVN = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[đĐ]/g, 'd');
  const execSalaryKws = ['luong', 'hoa hong', 'thuong doanh so', 'thu nhap nhan su', 'nhan su'];
  const isExecSalaryEntry = (cat: string) => { const n = normExecVN(cat); return execSalaryKws.some(kw => n.includes(kw)); };
  const nonSalaryMonthExp = projectedPayroll > 0
    ? monthExpList.filter(e => !isExecSalaryEntry(e.category)).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    : currentMonthExp;
  const projectedNetProfit = currentMonthGross - nonSalaryMonthExp - projectedPayroll;
  const activeStaff = employees.filter(e => isStaffActive(e));
  const profitPerStaff = activeStaff.length > 0 ? projectedNetProfit / activeStaff.length : 0;
  const monthSalesList = sales.filter(s => s.date.startsWith(currentMonthStr));
  const totalConsulted = monthSalesList.reduce(
    (sum, s) => sum + (Number(s.salesAmount) || 0),
    0
  );
  const coverageRatio = currentMonthRev > 0 ? (totalConsulted / currentMonthRev) * 100 : 0;
  return {
    todayRev,
    currentMonthRev,
    currentMonthExp,
    projectedPayroll,
    projectedNetProfit,
    profitPerStaff,
    coverageRatio,
    activeStaffCount: activeStaff.length,
  };
};

export const calculateFinancialHealthScore = (data: Partial<AppData>) => {
  const { revenue = [], expenses = [], payroll = [], employees = [], sales = [] } = data;
  if (!revenue || revenue.length === 0) return { score: 0, factors: ['Chưa có dữ liệu'] };
  let score = 70;
  const factors: string[] = [];
  const totalRev = revenue.reduce(
    (sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0),
    0
  );
  const totalGross = revenue.reduce((sum, r) => sum + (Number(r.grossProfit) || 0), 0);

  // Tránh double-count: dùng payroll module nếu có, ngược lại dùng ledger salary entries
  const payrollModuleTotal = (payroll || []).reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
  const salaryCategoryKeywords = ['luong', 'hoa hong', 'thuong doanh so', 'thu nhap nhan su', 'nhan su'];
  // Chuẩn hóa tiếng Việt để so sánh keyword không phụ thuộc dấu
  const normVNStr = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[đĐ]/g, 'd');
  const isSalaryCategory = (cat: string) => {
    const normalized = normVNStr(cat);
    return salaryCategoryKeywords.some(kw => normalized.includes(kw));
  };
  const ledgerSalaryTotal = (expenses || []).reduce((sum, e) =>
    isSalaryCategory(e.category) ? sum + (Number(e.amount) || 0) : sum, 0);
  const totalPayroll = payrollModuleTotal > 0 ? payrollModuleTotal : ledgerSalaryTotal;
  // Lọc bỏ salary entries khỏi expenses để tránh cộng hai lần
  const nonSalaryExpenses = (expenses || []).filter(e => !isSalaryCategory(e.category));
  const totalOpEx = nonSalaryExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + totalPayroll;
  const netProfit = totalGross - totalOpEx;
  const netMargin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
  if (netMargin > 20) {
    score += 15;
    factors.push('Biên lợi nhuận ròng xuất sắc');
  }
  const activeStaff = employees.filter(e => isStaffActive(e));
  const rpe = activeStaff.length > 0 ? totalRev / activeStaff.length : 0;
  const totalConsultedSales = (sales || []).reduce(
    (sum, s) => sum + (Number(s.salesAmount) || 0),
    0
  );
  const coverageRatio = totalRev > 0 ? (totalConsultedSales / totalRev) * 100 : 0;
  if (coverageRatio > 50) {
    score += 10;
    factors.push('Đội ngũ sale chủ động tốt (>50% độ phủ)');
  }
  const payrollRatio = totalRev > 0 ? (totalPayroll / totalRev) * 100 : 0;
  return {
    score: Math.min(Math.max(score, 0), 100),
    factors,
    netMargin,
    rpe,
    payrollRatio,
    totalRev,
    netProfit,
    totalConsultedSales,
    coverageRatio,
  };
};

export const auditFinancials = (data: Partial<AppData>) => {
  const leaks = [];
  const {
    revenue = [],
    expenses = [],
    overtime = [],
    employees = [],
    payroll = [],
    sales = [],
  } = data;
  const totalRevenue = revenue.reduce(
    (sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0),
    0
  );
  const totalConsulted = sales.reduce(
    (sum, s) => sum + (Number(s.salesAmount) || 0),
    0
  );
  if (totalRevenue > 0 && totalConsulted / totalRevenue < 0.3)
    leaks.push('🟡 Tỷ lệ khách tự mua cao (Độ phủ sale < 30%). Cần đẩy mạnh tư vấn.');
  const totalOTMinutes = overtime.reduce(
    (sum, ot: OvertimeRecord) => sum + (Number(ot.hours) || 0),
    0
  );
  const activeStaff = employees.filter(e => isStaffActive(e));
  if (activeStaff.length > 0 && totalOTMinutes > activeStaff.length * 20 * 60)
    leaks.push('🔴 Tỷ lệ tăng ca (OT) cao.');
  const payrollModuleTotal2 = (payroll || []).reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
  const normVNAudit = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[đĐ]/g, 'd');
  const auditSalaryCatKws = ['luong', 'hoa hong', 'thuong doanh so', 'thu nhap nhan su', 'nhan su'];
  const auditLedgerSalary = (expenses || []).reduce((sum, e) => {
    const norm = normVNAudit(e.category);
    return auditSalaryCatKws.some(kw => norm.includes(kw)) ? sum + (Number(e.amount) || 0) : sum;
  }, 0);
  // Tránh double-count: dùng module payroll nếu có, không thì dùng ledger
  const finalizedPayrollTotal = payrollModuleTotal2 > 0 ? payrollModuleTotal2 : auditLedgerSalary;
  if (totalRevenue > 0 && finalizedPayrollTotal / totalRevenue > 0.4)
    leaks.push('🔴 Quỹ lương hạch toán chiếm tỷ trọng cao.');
  return leaks;
};

export const calculateMarketingPerformance = (data: Partial<AppData>) => {
  const { sales = [], revenue = [], employees = [] } = data;
  const totalRevenue = revenue.reduce(
    (sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0),
    0
  );
  const totalConsulted = sales.reduce(
    (sum, s) => sum + (Number(s.salesAmount) || 0),
    0
  );
  const coverageRatio = totalRevenue > 0 ? (totalConsulted / totalRevenue) * 100 : 0;
  const selfServiceGap = totalRevenue - totalConsulted;
  const salesByStaff: Record<string, number> = {};
  sales.forEach((s: SalesRecord) => {
    salesByStaff[s.employeeId] = (salesByStaff[s.employeeId] || 0) + (Number(s.salesAmount) || 0);
  });
  const activeStaffIds = Object.keys(salesByStaff);
  const activeRPE = activeStaffIds.length > 0 ? totalConsulted / activeStaffIds.length : 0;
  const allMonthlySales: number[] = Object.values(salesByStaff);
  let kpiMin = 0,
    kpiMax = 0;
  if (allMonthlySales.length > 0) {
    const mean = allMonthlySales.reduce((a, b) => a + b, 0) / allMonthlySales.length;
    const variance =
      allMonthlySales.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allMonthlySales.length;
    kpiMin = Math.max(mean - Math.sqrt(variance), mean * 0.5);
    const sortedSales = [...allMonthlySales].sort((a, b) => b - a);
    const top20Count = Math.max(Math.ceil(sortedSales.length * 0.2), 1);
    kpiMax = sortedSales.slice(0, top20Count).reduce((a, b) => a + b, 0) / top20Count;
  }
  const activeStaff = employees.filter(e => isStaffActive(e));
  const staffPerformance = activeStaff
    .map(emp => ({
      id: emp.id,
      name: emp.name,
      amount: salesByStaff[emp.id] || 0,
      status:
        (salesByStaff[emp.id] || 0) >= kpiMax
          ? 'Elite'
          : (salesByStaff[emp.id] || 0) >= kpiMin
            ? 'Safety'
            : 'Under',
    }))
    .sort((a, b) => b.amount - a.amount);
  return { coverageRatio, activeRPE, selfServiceGap, kpiMin, kpiMax, staffPerformance };
};

export const calculateStaffProductivity = (employees: Employee[], revenue: RevenueRecord[]) => {
  const activeStaff = employees.filter(e => isStaffActive(e));
  const staffCount = activeStaff.length;
  if (staffCount === 0) return { currentRPE: 0, trend: [] };
  const monthlyRevenue: Record<string, number> = {};
  revenue.forEach(r => {
    const month = r.date.slice(0, 7);
    monthlyRevenue[month] =
      (monthlyRevenue[month] || 0) + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
  });
  const sortedMonths = Object.keys(monthlyRevenue).sort();
  const latestMonth = sortedMonths[sortedMonths.length - 1];
  const currentRPE = latestMonth ? monthlyRevenue[latestMonth] / staffCount : 0;
  const trend = sortedMonths.map(m => ({
    month: m,
    rpe: monthlyRevenue[m] / staffCount,
    revenue: monthlyRevenue[m],
  }));
  return { currentRPE, trend, totalStaff: staffCount };
};

export const getCategoryType = (
  catName: string,
  categories: ExpenseCategory[]
): 'fixed' | 'variable' | 'depreciation' | 'interest' | 'cogs' => {
  const lowerName = catName.toLowerCase();

  // 1. Tìm khớp trong danh mục
  let current = (categories || []).find(c => c.name === catName);
  if (!current) {
    current = (categories || []).find(
      c => c.name.toLowerCase().includes(lowerName) || lowerName.includes(c.name.toLowerCase())
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
  if (
    rootId === 'cat-interest-root' ||
    rootName.includes('lãi vay') ||
    rootName.includes('lãi ngân hàng')
  )
    return 'interest';
  if (rootName.includes('giá vốn') || rootName.includes('cogs')) return 'cogs';

  return 'variable';
};

export const getTopLevelCategory = (catName: string, categories: ExpenseCategory[]): string => {
  const lowerName = catName.toLowerCase();

  // 1. Tìm khớp trong danh mục
  let current = (categories || []).find(c => c.name === catName);
  if (!current) {
    current = (categories || []).find(
      c => c.name.toLowerCase().includes(lowerName) || lowerName.includes(c.name.toLowerCase())
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

export const calculateExpenseAnalysis = (
  expenses: ExpenseRecord[],
  revenue: RevenueRecord[],
  payrolls: PayrollRecord[],
  categories: ExpenseCategory[]
) => {
  const totalRev = (revenue || []).reduce(
    (sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0),
    0
  );

  // Smart Priority for Personnel Costs — dùng keyword không dấu để tránh miss-match dấu/không dấu
  const normVNExp = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[đĐ]/g, 'd');
  const salaryKeywords = ['luong', 'hoa hong', 'thuong doanh so', 'thuong nhan vien', 'phu cap', 'tang ca', 'thuc nhan', 'nhan su'];
  const isSalaryExp = (cat: string) => { const n = normVNExp(cat); return salaryKeywords.some(kw => n.includes(kw)); };
  const isCogsExp = (cat: string) => { const n = normVNExp(cat); return n.includes('gia von') || n.includes('cogs'); };

  // 1. Calculate from Payroll Ledger (Net Pay)
  const payrollNetPayTotal = (payrolls || []).reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);

  // 2. Calculate from General Ledger (Salary-related entries)
  const ledgerSalaryTotal = (expenses || []).reduce((sum, e) =>
    isSalaryExp(e.category) ? sum + (Number(e.amount) || 0) : sum, 0);

  // Use Payroll if available, otherwise use Ledger
  const totalPayroll = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;

  // Filter out salary-related AND COGS expenses (giá vốn) from the general ledger to avoid double counting
  // COGS is tracked separately via revenue.totalCogs, so counting it in OpEx inflates costs
  const filteredExpenses = (expenses || []).filter(e => !isSalaryExp(e.category) && !isCogsExp(e.category));

  const totalOpEx =
    filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + totalPayroll;
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

  const analysis = Object.entries(cats)
    .map(([name, amount]) => ({
      name,
      amount,
      ratio: totalRev > 0 ? (amount / totalRev) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Recalculate break-even
  const totalFixedForBreakEven = fixedCosts + depreciationCosts + interestCosts;
  const variableRatio = totalRev > 0 ? (totalCogs + variableCosts) / totalRev : 0;
  const contributionMarginRatio = 1 - variableRatio;
  // contributionMarginRatio <= 0 = biến phí >= 100% doanh thu → không thể đạt hòa vốn
  const canBreakEven = contributionMarginRatio > 0;
  const breakEvenRevenue = canBreakEven ? totalFixedForBreakEven / contributionMarginRatio : 0;

  return {
    analysis,
    totalOpEx,
    totalCogs,
    totalCost: totalOpEx,
    payrollRatio: totalRev > 0 ? (totalPayroll / totalRev) * 100 : 0,
    breakEvenRevenue,
    canBreakEven,
    safetyMargin: canBreakEven && totalRev > 0 ? ((totalRev - breakEvenRevenue) / totalRev) * 100 : 0,
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
  currentData: {
    expenses: ExpenseRecord[];
    revenue: number;
    payroll: number;
    cogs: number;
    categories: ExpenseCategory[];
  },
  previousData: { expenses: ExpenseRecord[]; revenue: number; payroll: number; cogs: number }
): MISMetrics => {
  // 1. Benchmarking Logic
  // Industry Standards (Retail)
  const standards = [
    { name: 'Giá vốn (COGS)', key: 'cogs', target: 65, range: [60, 75] },
    { name: 'Nhân sự (Labor)', key: 'labor', target: 12, range: [10, 18] },
    { name: 'Mặt bằng (Rent)', key: 'rent', target: 10, range: [8, 15] },
    { name: 'Marketing', key: 'marketing', target: 5, range: [3, 8] },
    { name: 'Vận hành (OpEx)', key: 'opex', target: 30, range: [25, 40] },
  ];

  // Calculate actuals
  const currentExpenses = currentData.expenses;
  const currentRev = currentData.revenue;
  const categories = currentData.categories;

  // Lọc salary/COGS khỏi expenses để tránh double-count khi cộng payroll module
  const normMIS = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[đĐ]/g, 'd');
  const misSalaryKws = ['luong', 'hoa hong', 'thuong doanh so', 'thu nhap nhan su', 'nhan su'];
  const isMISSalary = (cat: string) => { const n = normMIS(cat); return misSalaryKws.some(kw => n.includes(kw)); };
  const isMISCogs = (cat: string) => { const n = normMIS(cat); return n.includes('gia von') || n.includes('cogs'); };
  const filteredMISExpenses = currentExpenses.filter(e => !isMISSalary(e.category) && !isMISCogs(e.category));

  const getMetricActual = (key: string) => {
    if (currentRev <= 0) return 0;
    let amount = 0;
    if (key === 'cogs') amount = currentData.cogs;
    else if (key === 'labor') amount = currentData.payroll;
    else if (key === 'opex') {
      // Dùng filteredMISExpenses (đã loại salary + cogs) rồi cộng payroll một lần — tránh double-count
      amount =
        filteredMISExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + currentData.payroll;
    } else {
      // Find categories matching the name
      const matchingCats = categories.filter(c => {
        const name = c.name.toLowerCase();
        if (key === 'rent')
          return name.includes('mặt bằng') || name.includes('thuê') || name.includes('địa điểm');
        if (key === 'marketing')
          return name.includes('marketing') || name.includes('quảng cáo') || name.includes('ads');
        return false;
      });
      const catIds = matchingCats.map(c => c.id);
      amount = currentExpenses
        .filter(e => {
          const cat = categories.find(c => c.name === e.category);
          return cat && (catIds.includes(cat.id) || catIds.includes(cat.parentId || ''));
        })
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
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
      desc:
        status === 'safe' ? 'Tối ưu tốt' : status === 'warning' ? 'Chạm ngưỡng' : 'Đang lãng phí',
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

  const hotspots = Object.keys(currentCatTotals)
    .map(cat => {
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
  const allCategories = Object.keys(currentCatTotals)
    .map(cat => ({
      name: cat,
      amount: currentCatTotals[cat],
      ratio: currentRev > 0 ? (currentCatTotals[cat] / currentRev) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { benchmarks, hotspots, allCategories };
};

export const calculateDailyBreakEven = (
  revenue: RevenueRecord[],
  config: { monthlyFixedCosts: number; grossMarginPercent: number },
  targetDate?: string
) => {
  const now = targetDate ? new Date(targetDate) : new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyFixedCost = config.monthlyFixedCosts / daysInMonth;
  const dailyBreakEvenRevenue =
    config.grossMarginPercent > 0 ? dailyFixedCost / (config.grossMarginPercent / 100) : 0;

  const todayStr = now.toLocaleDateString('sv-SE');
  const todayRevenue = revenue.find(r => r.date === todayStr);
  const currentRevenue = todayRevenue
    ? (Number(todayRevenue.netRevenue) || 0) + (Number(todayRevenue.revenueOther) || 0)
    : 0;

  const progress =
    dailyBreakEvenRevenue > 0 ? Math.min((currentRevenue / dailyBreakEvenRevenue) * 100, 100) : 0;
  const isProfitable = currentRevenue >= dailyBreakEvenRevenue;

  // Monthly trend analysis (all days in the target month)
  const monthlyTrend = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
    const rev = revenue.find(r => r.date === dStr);
    const amount = rev ? (Number(rev.netRevenue) || 0) + (Number(rev.revenueOther) || 0) : 0;
    const profit = rev ? Number(rev.grossProfit) || 0 : amount * (config.grossMarginPercent / 100);
    return {
      date: dStr,
      amount,
      profit,
      isProfitable: amount >= dailyBreakEvenRevenue,
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
    monthlyFixedCosts: config.monthlyFixedCosts,
  };
};

export const calculateStrategicSuggestions = (
  groupRevenue: ProductGroupRevenue[],
  nextMonthNum: number,
  viewMode: 'revenue' | 'quantity' = 'revenue'
) => {
  const data = groupRevenue.filter(r => parseInt(r.date.split('-')[1]) === nextMonthNum);
  // Chỉ đếm số năm có dữ liệu cho tháng cụ thể này — tránh chia nhầm cho số năm toàn dataset
  const yearsSet = new Set<string>();
  data.forEach(r => yearsSet.add(r.date.split('-')[0]));
  const yearsCount = Math.max(yearsSet.size, 1);

  const groupsMap: Record<string, { name: string; rev: number; qty: number }> = {};
  data.forEach(r => {
    if (!groupsMap[r.groupName]) groupsMap[r.groupName] = { name: r.groupName, rev: 0, qty: 0 };
    groupsMap[r.groupName].rev += r.netRevenue || r.amount - (r.returnsValue || 0);
    groupsMap[r.groupName].qty += r.quantity || 0;
  });

  return Object.values(groupsMap)
    .map(g => ({
      id: generateId(),
      name: g.name,
      avgRev: g.rev / yearsCount,
      avgQty: g.qty / yearsCount,
      target: '',
      highlights: '',
    }))
    .sort((a, b) => (viewMode === 'revenue' ? b.avgRev - a.avgRev : b.avgQty - a.avgQty))
    .slice(0, 10);
};

export const calculateSeasonalityAnalysis = (
  groupRevenue: ProductGroupRevenue[],
  groups: ProductGroup[]
) => {
  // Bước 1: tính doanh thu tổng và tốc độ tăng trưởng từng nhóm
  const rows = (groups || []).map(g => {
    const groupRev = groupRevenue.filter(r => r.groupId === g.id || r.groupName === g.name);
    const totalHistorical = groupRev.reduce(
      (sum, r) => sum + (r.netRevenue || r.amount - (r.returnsValue || 0)),
      0
    );
    const totalQty = groupRev.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalRetQty = groupRev.reduce((sum, r) => sum + (r.returnsQuantity || 0), 0);
    const avgReturnRate = totalQty > 0 ? (totalRetQty / totalQty) * 100 : 0;

    // Tính tăng trưởng: so sánh nửa sau vs nửa đầu lịch sử
    const sorted = [...groupRev].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid).reduce((s, r) => s + (r.netRevenue || r.amount - (r.returnsValue || 0)), 0);
    const secondHalf = sorted.slice(mid).reduce((s, r) => s + (r.netRevenue || r.amount - (r.returnsValue || 0)), 0);
    const growthRate = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    return { id: g.id, name: g.name, totalHistorical, avgReturnRate, growthRate };
  });

  // Bước 2: ABC — tính theo phần trăm tích luỹ doanh thu
  const totalAllRev = rows.reduce((s, r) => s + r.totalHistorical, 0);
  const sortedByRev = [...rows].sort((a, b) => b.totalHistorical - a.totalHistorical);
  let cumulative = 0;
  const abcMap: Record<string, 'A' | 'B' | 'C'> = {};
  sortedByRev.forEach(r => {
    cumulative += r.totalHistorical;
    const pct = totalAllRev > 0 ? (cumulative / totalAllRev) * 100 : 100;
    abcMap[r.id] = pct <= 70 ? 'A' : pct <= 90 ? 'B' : 'C';
  });

  // Bước 3: BCG — thị phần tương đối vs tốc độ tăng trưởng
  const avgRev = rows.length > 0 ? totalAllRev / rows.length : 0;
  const avgGrowth = rows.length > 0 ? rows.reduce((s, r) => s + r.growthRate, 0) / rows.length : 0;

  return rows.map(r => {
    const highShare = r.totalHistorical >= avgRev;
    const highGrowth = r.growthRate >= avgGrowth;
    const bcgStatus =
      highShare && highGrowth ? 'Star' :
      highShare && !highGrowth ? 'Cash Cow' :
      !highShare && highGrowth ? 'Question Mark' : 'Dog';

    return {
      id: r.id,
      name: r.name,
      totalHistorical: r.totalHistorical,
      abcClass: abcMap[r.id] ?? 'C',
      bcgStatus,
      avgReturnRate: r.avgReturnRate,
      inventoryExpection: 0,
    };
  });
};
