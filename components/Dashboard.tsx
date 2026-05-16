import React, { useMemo, useState, useEffect } from 'react';
import {
  AppData,
  DailyBreakEvenConfig,
  DashboardBreakEvenAnalysis,
  DiagnosisRange,
} from '../types';
import { BrainCircuit, Gauge, Briefcase, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { calculateTimeContext, getCategoryType, getTopLevelCategory } from '../src/lib';
import { DashboardAiAdvisor } from './dashboard/DashboardAiAdvisor';
import { DashboardEodBanner } from './dashboard/DashboardEodBanner';
import { DashboardKpiOverview } from './dashboard/DashboardKpiOverview';
import { DashboardStructurePanel } from './dashboard/DashboardStructurePanel';
import { DashboardTrendsPanel } from './dashboard/DashboardTrendsPanel';
import TimeFilter from './TimeFilter';

interface DashboardProps {
  data: AppData;
  breakEvenAnalysis?: DashboardBreakEvenAnalysis;
  onUpdateData: (key: 'dailyBreakEvenConfig', newList: DailyBreakEvenConfig) => void;
  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  data,
  breakEvenAnalysis,
  onUpdateData,
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate,
}) => {
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'kpi' | 'trends' | 'ai' | 'structure'>('kpi');
  const [selectedParentCategory, setSelectedParentCategory] = useState<string | null>(null);
  const [selectedTrendMonth, setSelectedTrendMonth] = useState<string | null>(null);
  const [isShrunk, setIsShrunk] = useState(false);
  const [eodReport, setEodReport] = useState<{ date: string; summary: string } | null>(null);
  const [eodDismissed, setEodDismissed] = useState(false);

  useEffect(() => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    fetch(`/api/eod-report?date=${yesterday}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.summary) setEodReport(data);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const mainContainer = document.querySelector('main');
    if (!mainContainer) return;

    const handleScroll = () => {
      setIsShrunk(mainContainer.scrollTop > 10);
    };

    mainContainer.addEventListener('scroll', handleScroll);
    return () => mainContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const timeContext = useMemo(() => {
    return calculateTimeContext(diagnosisRange, diagStartDate, diagEndDate);
  }, [diagnosisRange, diagStartDate, diagEndDate]);

  // LOGIC LỌC DỮ LIỆU THEO KHOẢNG THỜI GIAN
  const filteredData = useMemo(() => {
    const { start, end } = timeContext;

    const filterFn = (item: { date: string }) => item.date >= start && item.date <= end;

    // Payroll usually has a 'month' field (YYYY-MM)
    // We'll try to match it if the range covers the whole month or contains it
    const payrollFilterFn = (p: { month: string }) => {
      const monthStart = `${p.month}-01`;
      const monthEnd = `${p.month}-31`; // Rough check
      return (
        (monthStart >= start && monthStart <= end) ||
        (monthEnd >= start && monthEnd <= end) ||
        (start >= monthStart && start <= monthEnd)
      );
    };

    return {
      ...data,
      revenue: data.revenue.filter(filterFn),
      expenses: data.expenses.filter(filterFn),
      sales: data.sales.filter(filterFn),
      attendance: data.attendance.filter(filterFn),
      overtime: data.overtime.filter(filterFn),
      payroll: data.payroll.filter(payrollFilterFn),
      timeContext,
    };
  }, [data, timeContext]);

  // RE-CALCULATE INSIGHTS BASED ON FILTERED DATA
  const insights = useMemo(() => {
    const revList = filteredData.revenue;
    const expenseCategories = data.expenseCategories || [];

    let ledgerSalaryTotal = 0;
    const expList = filteredData.expenses.filter(e => {
      const topLevel = getTopLevelCategory(e.category, expenseCategories);
      const isSalary = topLevel === 'Nhân sự' || topLevel === 'Nhân viên' || topLevel === 'Lương';
      if (isSalary) ledgerSalaryTotal += Number(e.amount) || 0;
      return !isSalary;
    });
    const payrollList = filteredData.payroll;

    const totalRev = revList.reduce(
      (sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0),
      0
    );
    const payrollNetPayTotal = payrollList.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);

    // Smart Priority: Use payroll records if available, otherwise use ledger entries marked as Personnel
    const finalPersonnelTotal = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;

    const totalExp =
      expList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + finalPersonnelTotal;
    const totalGross = revList.reduce((sum, r) => sum + (Number(r.grossProfit) || 0), 0);

    const activeStaff = data.employees.filter(e => {
      const resigned = e.resignedDate;
      return !resigned || String(resigned).trim() === '';
    });

    const totalCogsFromRevenue = revList.reduce((sum, r) => sum + (Number(r.totalCogs) || 0), 0);

    // Breakdown costs strictly by user-defined category type
    let fixedCosts = finalPersonnelTotal; // Default personnel to fixed, but respect ledger categorization if it's there
    let variableCosts = 0;
    let depreciationCosts = 0;
    let interestCosts = 0;
    let ledgerCogs = 0;

    expList.forEach(e => {
      const type = getCategoryType(e.category, expenseCategories);
      const amount = Number(e.amount) || 0;
      if (type === 'fixed') fixedCosts += amount;
      else if (type === 'variable') variableCosts += amount;
      else if (type === 'depreciation') depreciationCosts += amount;
      else if (type === 'interest') interestCosts += amount;
      else if (type === 'cogs') ledgerCogs += amount;
    });

    const totalCogs = totalCogsFromRevenue + ledgerCogs;
    const finalNetProfitCorrect = totalGross - totalExp; // totalGross is from revenue records, totalExp is all expenses + payroll

    return {
      periodRev: totalRev,
      periodExp: totalExp,
      periodProfit: finalNetProfitCorrect,
      periodGross: totalGross,
      payrollTotal: finalPersonnelTotal,
      nonPayrollExp: totalExp - finalPersonnelTotal,
      activeStaffCount: activeStaff.length,
      netProfitMargin: totalRev > 0 ? (finalNetProfitCorrect / totalRev) * 100 : 0,
      opExRatio: totalRev > 0 ? (totalExp / totalRev) * 100 : 0,
      laborCostRatio: totalRev > 0 ? (finalPersonnelTotal / totalRev) * 100 : 0,
      fixedCosts,
      variableCosts,
      depreciationCosts,
      interestCosts,
      totalCogs,
      ledgerCogs,
    };
  }, [filteredData, data.employees, data.expenseCategories]);

  // CALCULATE PREVIOUS PERIOD DATA FOR COMPARISON
  const prevInsights = useMemo(() => {
    const { start, end } = timeContext;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());

    const prevEnd = new Date(startDate.getTime() - 86400000); // Day before current start
    const prevStart = new Date(prevEnd.getTime() - diffTime);

    const pStart = prevStart.toISOString().split('T')[0];
    const pEnd = prevEnd.toISOString().split('T')[0];

    const filterFn = (item: { date: string }) => item.date >= pStart && item.date <= pEnd;

    const pRev = data.revenue.filter(filterFn);
    const pExp = data.expenses.filter(filterFn);

    const totalRev = pRev.reduce(
      (sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0),
      0
    );
    const totalGross = pRev.reduce((sum, r) => sum + (Number(r.grossProfit) || 0), 0);
    const totalExp = pExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = totalGross - totalExp;

    return {
      rev: totalRev,
      profit: netProfit,
      gross: totalGross,
      exp: totalExp,
    };
  }, [data, timeContext]);

  const monthlyTrendData = useMemo(() => {
    const months: Record<
      string,
      { month: string; revenue: number; grossProfit: number; netProfit: number }
    > = {};

    // Process all revenue
    data.revenue.forEach(r => {
      const monthKey = r.date.substring(0, 7);
      if (!months[monthKey])
        months[monthKey] = { month: monthKey, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[monthKey].revenue += (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
      months[monthKey].grossProfit += Number(r.grossProfit) || 0;
    });

    // Process expenses - Ensure months with only expenses are included
    data.expenses.forEach(e => {
      const monthKey = e.date.substring(0, 7);
      if (!months[monthKey])
        months[monthKey] = { month: monthKey, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[monthKey].netProfit -= Number(e.amount);
    });

    // Process payroll
    data.payroll.forEach(p => {
      const monthKey = p.month;
      if (!months[monthKey])
        months[monthKey] = { month: monthKey, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[monthKey].netProfit -= Number(p.netPay);
    });

    // Finalize net profit
    Object.keys(months).forEach(key => {
      months[key].netProfit += months[key].grossProfit;
    });

    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [data.revenue, data.expenses, data.payroll]);

  const dailyTrendData = useMemo(() => {
    if (!selectedTrendMonth) return [];

    const days: Record<
      string,
      { date: string; revenue: number; grossProfit: number; netProfit: number }
    > = {};

    // Filter revenue for the selected month
    data.revenue
      .filter(r => r.date.startsWith(selectedTrendMonth))
      .forEach(r => {
        if (!days[r.date])
          days[r.date] = { date: r.date, revenue: 0, grossProfit: 0, netProfit: 0 };
        days[r.date].revenue += (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
        days[r.date].grossProfit += Number(r.grossProfit) || 0;
      });

    // Filter expenses for the selected month
    data.expenses
      .filter(e => e.date.startsWith(selectedTrendMonth))
      .forEach(e => {
        if (!days[e.date])
          days[e.date] = { date: e.date, revenue: 0, grossProfit: 0, netProfit: 0 };
        days[e.date].netProfit -= Number(e.amount);
      });

    // Note: Payroll is usually monthly, so we don't distribute it daily here for simplicity,
    // or we could distribute it evenly if needed. For now, we'll focus on revenue/expenses.

    Object.keys(days).forEach(key => {
      days[key].netProfit += days[key].grossProfit;
    });

    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.revenue, data.expenses, selectedTrendMonth]);

  const expensePieData = useMemo(() => {
    const cats: Record<string, number> = {};
    const expenseCategories = data.expenseCategories || [];

    let ledgerSalaryTotal = 0;
    filteredData.expenses.forEach(e => {
      const topLevel = getTopLevelCategory(e.category, expenseCategories);
      if (topLevel === 'Nhân sự' || topLevel === 'Nhân viên' || topLevel === 'Lương') {
        ledgerSalaryTotal += Number(e.amount) || 0;
      } else {
        cats[topLevel] = (cats[topLevel] || 0) + Number(e.amount);
      }
    });

    const payrollNetPayTotal = filteredData.payroll.reduce(
      (sum, p) => sum + (Number(p.netPay) || 0),
      0
    );
    const finalPersonnelTotal = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;

    if (finalPersonnelTotal > 0) {
      cats['Nhân sự'] = finalPersonnelTotal;
    }

    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData.expenses, filteredData.payroll, data.expenseCategories]);

  const detailedExpenses = useMemo(() => {
    if (!selectedParentCategory) return [];

    if (selectedParentCategory === 'Nhân sự') {
      const payrollList = filteredData.payroll;
      if (payrollList.length > 0) {
        // Return payroll records as detailed items
        return payrollList.map(p => ({
          id: p.id,
          date: p.month,
          category: 'Nhân sự',
          description: `Lương tháng ${p.month} - ${p.employeeName}`,
          amount: Number(p.netPay) || 0,
        }));
      } else {
        // Fallback to ledger items
        return filteredData.expenses.filter(e => {
          const topLevel = getTopLevelCategory(e.category, data.expenseCategories || []);
          return topLevel === 'Nhân sự';
        });
      }
    }

    return filteredData.expenses.filter(e => {
      const topLevel = getTopLevelCategory(e.category, data.expenseCategories || []);
      return topLevel === selectedParentCategory;
    });
  }, [selectedParentCategory, filteredData.expenses, filteredData.payroll, data.expenseCategories]);

  const waterfallData = useMemo(() => {
    const revList = filteredData.revenue;
    const totalGrossBeforeLeak = revList.reduce(
      (sum, r) => sum + (Number(r.totalGrossRevenue) || 0) + (Number(r.revenueOther) || 0),
      0
    );
    const totalDisc = revList.reduce((sum, r) => sum + (Number(r.discount) || 0), 0);
    const totalRet = revList.reduce((sum, r) => sum + (Number(r.returnsValue) || 0), 0);
    const totalRev = insights.periodRev;
    const totalCogs = insights.totalCogs;
    const grossProfit = insights.periodGross - (insights.ledgerCogs || 0);

    const varCosts = insights.variableCosts;
    const fixedCosts = insights.fixedCosts;
    const depCosts = insights.depreciationCosts;
    const intCosts = insights.interestCosts;
    const netProfit = insights.periodProfit;

    const data = [];
    const blueColor = '#1e293b'; // Dark Navy/Blue
    const greenColor = '#10b981'; // Green

    // 1. Doanh thu tổng (100%)
    data.push({
      name: 'Doanh thu tổng',
      value: [0, totalGrossBeforeLeak],
      fill: blueColor,
      label: '100%',
    });

    // 2. Giảm giá
    let current = totalGrossBeforeLeak;
    const discPerc =
      totalGrossBeforeLeak > 0 ? ((totalDisc / totalGrossBeforeLeak) * 100).toFixed(0) + '%' : '0%';
    data.push({
      name: 'Giảm giá',
      value: [current - totalDisc, current],
      fill: blueColor,
      label: discPerc,
    });
    current -= totalDisc;

    // 3. Hàng trả lại
    const retPerc =
      totalGrossBeforeLeak > 0 ? ((totalRet / totalGrossBeforeLeak) * 100).toFixed(0) + '%' : '0%';
    data.push({
      name: 'Hàng trả lại',
      value: [current - totalRet, current],
      fill: blueColor,
      label: retPerc,
    });
    current -= totalRet;

    // 4. Doanh thu thuần
    const netRevPerc =
      totalGrossBeforeLeak > 0 ? ((totalRev / totalGrossBeforeLeak) * 100).toFixed(0) + '%' : '0%';
    data.push({
      name: 'Doanh thu thuần',
      value: [0, totalRev],
      fill: blueColor,
      label: netRevPerc,
    });

    // 5. Giá vốn
    current = totalRev;
    if (totalCogs > 0) {
      const perc = totalRev > 0 ? ((totalCogs / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({
        name: 'Giá vốn',
        value: [current - totalCogs, current],
        fill: blueColor,
        label: perc,
      });
      current -= totalCogs;
    }

    // 6. Lợi nhuận gộp
    const grossPerc = totalRev > 0 ? ((grossProfit / totalRev) * 100).toFixed(0) + '%' : '0%';
    data.push({
      name: 'Lợi nhuận gộp',
      value: [0, grossProfit],
      fill: greenColor,
      label: grossPerc,
    });

    // 7. Chi phí biến đổi
    current = grossProfit;
    if (varCosts > 0) {
      const perc = totalRev > 0 ? ((varCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({
        name: 'Chi phí biến đổi',
        value: [Math.max(0, current - varCosts), current],
        fill: blueColor,
        label: perc,
      });
      current -= varCosts;
    }

    // 8. Chi phí cố định
    if (fixedCosts > 0) {
      const perc = totalRev > 0 ? ((fixedCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({
        name: 'Chi phí cố định',
        value: [Math.max(0, current - fixedCosts), current],
        fill: blueColor,
        label: perc,
      });
      current -= fixedCosts;
    }

    // 9. Khấu hao
    if (depCosts > 0) {
      const perc = totalRev > 0 ? ((depCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({
        name: 'Khấu hao',
        value: [Math.max(0, current - depCosts), current],
        fill: blueColor,
        label: perc,
      });
      current -= depCosts;
    }

    // 10. Lãi vay
    if (intCosts > 0) {
      const perc = totalRev > 0 ? ((intCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({
        name: 'Lãi vay',
        value: [Math.max(0, current - intCosts), current],
        fill: blueColor,
        label: perc,
      });
      current -= intCosts;
    }

    // 11. Lợi nhuận ròng
    const netPerc = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(0) + '%' : '0%';
    const roseColor = '#f43f5e'; // Red for negative
    data.push({
      name: 'Lợi nhuận ròng',
      value: [0, netProfit],
      fill: netProfit >= 0 ? greenColor : roseColor,
      label: netPerc,
    });

    return data;
  }, [filteredData.revenue, insights]);

  const COLORS = [
    '#6366f1',
    '#f43f5e',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#0ea5e9',
  ];

  const runExecutiveBriefing = async () => {
    setIsDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const revGrowth =
        prevInsights.rev > 0
          ? (((insights.periodRev - prevInsights.rev) / prevInsights.rev) * 100).toFixed(1)
          : 'N/A';
      const profitGrowth =
        prevInsights.profit !== 0
          ? (
              ((insights.periodProfit - prevInsights.profit) / Math.abs(prevInsights.profit)) *
              100
            ).toFixed(1)
          : 'N/A';

      const contextData = `
        NHIỆM VỤ: Phân tích sâu sắc, so sánh và đưa ra giải pháp thực thi cho giai đoạn ${timeContext.start} đến ${timeContext.end}.

        DỮ LIỆU TÀI CHÍNH HIỆN TẠI:
        - Doanh thu thuần: ${insights.periodRev.toLocaleString()}đ (Tăng trưởng so kỳ trước: ${revGrowth}%)
        - Lợi nhuận ròng: ${insights.periodProfit.toLocaleString()}đ (Tăng trưởng: ${profitGrowth}%)
        - Biên LN Gộp: ${((insights.periodGross / insights.periodRev) * 100).toFixed(1)}%
        - Biên LN Ròng: ${insights.netProfitMargin.toFixed(1)}%

        CƠ CẤU CHI PHÍ TRÊN DOANH THU:
        - Giá vốn hàng bán (COGS): ${((insights.totalCogs / insights.periodRev) * 100).toFixed(1)}%
        - Chi phí nhân sự: ${insights.laborCostRatio.toFixed(1)}%
        - Chi phí cố định khác: ${((insights.fixedCosts / insights.periodRev) * 100).toFixed(1)}%
        - Chi phí biến đổi: ${((insights.variableCosts / insights.periodRev) * 100).toFixed(1)}%

        NGƯỠNG AN TOÀN NGÀNH BÁN LẺ GIÀY DÉP (THAM CHIẾU):
        - COGS: 50–60% (> 65% là nguy hiểm)
        - Chi phí nhân sự: 10–15% (> 20% là quá cao)
        - Chi phí cố định: 5–10%
        - Biên LN Ròng: 10–20%

        YÊU CẦU:
        1. SO SÁNH & ĐÁNH GIÁ: So sánh từng chỉ số với ngưỡng an toàn. Chỉ rõ chỉ số nào "Báo động đỏ".
        2. PHÂN TÍCH CHI PHÍ: Nhóm nào tăng quá mức hoặc chiếm tỷ trọng bất hợp lý?
        3. NHẬN XÉT SẮC BÉN: Đánh giá thẳng thắn sức khỏe tài chính (vd: "Đang bán lỗ để lấy doanh thu").
        4. HƯỚNG GIẢI QUYẾT: Ít nhất 3 giải pháp thực tế để đưa chỉ số về ngưỡng an toàn.
      `;

      const response = await fetch('/api/ai/executive-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });

      if (!response.ok) throw new Error(`Lỗi server: ${response.status}`);
      const data = await response.json();
      setDiagnosisResult(data.result || 'Lỗi khởi tạo bản tin.');
    } catch {
      setDiagnosisResult(
        'Không thể kết nối AI Advisor. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local'
      );
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Auto-run Executive Briefing once per day when data loads
  useEffect(() => {
    if (diagnosisResult || isDiagnosing) return;
    if (data.revenue.length < 3 && data.expenses.length < 3) return;
    const today = new Date().toISOString().split('T')[0];
    const lastRun = localStorage.getItem('dashboard_briefing_date');
    if (lastRun === today) return;
    localStorage.setItem('dashboard_briefing_date', today);
    runExecutiveBriefing();
  }, [data.revenue.length, data.expenses.length]);

  const hasData = data.revenue.length > 0 || data.employees.length > 0;

  if (!hasData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
          <Briefcase className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-3xl font-black text-slate-800 mb-4 uppercase tracking-tight">
          Hệ Thống Đang Sẵn Sàng
        </h3>
        <p className="text-slate-400 max-w-md mx-auto font-normal">
          Chào mừng bạn đến với <strong>CFO Brain</strong>. Vui lòng nhập liệu hoặc đồng bộ dữ liệu
          KiotViet để bắt đầu nhận phân tích chiến lược.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20 max-w-[1600px] mx-auto">
      {/* EOD REPORT BANNER */}
      {eodReport && !eodDismissed && (
        <DashboardEodBanner report={eodReport} onDismiss={() => setEodDismissed(true)} />
      )}

      {/* STICKY CONTROL PANEL (FILTERS + SUB-TABS) */}
      <div
        className={`sticky top-0 z-30 -mx-8 px-8 transition-all duration-500 ease-in-out ${
          isShrunk
            ? 'py-2 bg-white/95 backdrop-blur-2xl border-b border-slate-200 shadow-xl'
            : 'pt-6 pb-6 bg-transparent'
        }`}
      >
        {/* TOP FILTER BAR - Shrinks when scrolled */}
        <div
          className={`transition-all duration-500 origin-top ${isShrunk ? 'scale-90 opacity-70 -mb-5' : 'mb-6 opacity-100'}`}
        >
          <TimeFilter
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        </div>

        {/* SUB-TAB NAVIGATION */}
        <div
          className={`flex bg-slate-100/50 rounded-[2.5rem] w-fit mx-auto border border-white/50 shadow-sm backdrop-blur-md transition-all duration-500 ${
            isShrunk ? 'p-0.5 scale-90 opacity-95' : 'p-1.5'
          }`}
        >
          <button
            onClick={() => setActiveSubTab('kpi')}
            className={`flex items-center gap-3 rounded-[2rem] font-normal text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'kpi'
                ? 'bg-white text-emerald-600 shadow-md scale-105'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Gauge className={isShrunk ? 'w-3 h-3' : 'w-4 h-4'} /> Tổng quan KPI
          </button>
          <button
            onClick={() => setActiveSubTab('trends')}
            className={`flex items-center gap-3 rounded-[2rem] font-normal text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'trends'
                ? 'bg-white text-indigo-600 shadow-md scale-105'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className={isShrunk ? 'w-3 h-3' : 'w-4 h-4'} /> Xu hướng
          </button>
          <button
            onClick={() => setActiveSubTab('structure')}
            className={`flex items-center gap-3 rounded-[2rem] font-normal text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'structure'
                ? 'bg-white text-orange-600 shadow-md scale-105'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <PieChartIcon className={isShrunk ? 'w-3 h-3' : 'w-4 h-4'} /> Cơ cấu
          </button>
          <button
            onClick={() => setActiveSubTab('ai')}
            className={`flex items-center gap-3 rounded-[2rem] font-normal text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'ai'
                ? 'bg-white text-slate-900 shadow-md scale-105'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BrainCircuit className={isShrunk ? 'w-3 h-3' : 'w-4 h-4'} /> AI CFO Advisor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeSubTab === 'kpi' && (
          <DashboardKpiOverview
            insights={insights}
            prevInsights={prevInsights}
            revenue={data.revenue}
            breakEvenAnalysis={breakEvenAnalysis}
            targetDate={timeContext.start}
            dailyBreakEvenConfig={data.dailyBreakEvenConfig}
            onUpdateData={onUpdateData}
          />
        )}

        {activeSubTab === 'trends' && (
          <DashboardTrendsPanel
            monthlyTrendData={monthlyTrendData}
            dailyTrendData={dailyTrendData}
            selectedTrendMonth={selectedTrendMonth}
            onSelectMonth={setSelectedTrendMonth}
            onClearMonth={() => setSelectedTrendMonth(null)}
          />
        )}

        {activeSubTab === 'structure' && (
          <DashboardStructurePanel
            waterfallData={waterfallData}
            expensePieData={expensePieData}
            detailedExpenses={detailedExpenses}
            selectedParentCategory={selectedParentCategory}
            colors={COLORS}
            insights={insights}
            onSelectParentCategory={setSelectedParentCategory}
            onClearParentCategory={() => setSelectedParentCategory(null)}
          />
        )}

        {activeSubTab === 'ai' && (
          <DashboardAiAdvisor
            isDiagnosing={isDiagnosing}
            diagnosisResult={diagnosisResult}
            onRunExecutiveBriefing={runExecutiveBriefing}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
