import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AppData, DashboardWaterfallItem, DashboardExpenseSlice, DashboardFinancialInsights, DashboardDetailedExpense } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';
import { getTopLevelCategory, getCategoryType } from '../../src/lib';
import { DashboardStructurePanel } from '../dashboard/DashboardStructurePanel';

interface Props {
  data: AppData;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtBig = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' triệu';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + ' nghìn';
  return fmt(n);
};

const PIE_COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#f43f5e',
  '#eab308',
  '#06b6d4',
  '#ec4899',
];

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#0ea5e9'];

const getPrevPeriod = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(s.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  return {
    prevStart: prevStart.toLocaleDateString('sv-SE'),
    prevEnd: prevEnd.toLocaleDateString('sv-SE'),
    days,
  };
};

const PctBadge: React.FC<{ pct: number | null; invert?: boolean }> = ({ pct, invert = false }) => {
  if (pct === null) return <span className="text-slate-400 text-xs">--%</span>;
  const positive = invert ? pct < 0 : pct > 0;
  const color = positive ? 'text-emerald-600' : pct === 0 ? 'text-slate-400' : 'text-rose-500';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  );
};

const PLRow: React.FC<{
  label: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
  indent?: boolean;
  note?: string;
}> = ({ label, value, bold, highlight, indent, note }) => (
  <tr className={`border-b border-slate-100 ${highlight ? 'bg-slate-50' : ''}`}>
    <td
      className={`py-3 text-sm ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'} ${indent ? 'pl-8 pr-4' : 'pl-5 pr-4'}`}
    >
      {label}
      {note && <span className="ml-2 text-xs text-slate-400 font-normal">{note}</span>}
    </td>
    <td
      className={`pr-5 pl-4 py-3 text-sm text-right ${bold ? 'font-semibold text-slate-800' : 'text-slate-700'}`}
    >
      {fmt(value)}
    </td>
  </tr>
);

const AnalysisBusinessProfitPage: React.FC<Props> = ({ data }) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toLocaleDateString('sv-SE');

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [selectedParentCategory, setSelectedParentCategory] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const { prevStart, prevEnd, days } = getPrevPeriod(startDate, endDate);
    const inCurr = (d: string) => d >= startDate && d <= endDate;
    const inPrev = (d: string) => d >= prevStart && d <= prevEnd;

    // Revenue (store + shopee)
    const allRev = [...(data.revenue || []), ...(data.shopeeRevenue || [])];
    const currRev = allRev.filter(r => inCurr(r.date));
    const prevRev = allRev.filter(r => inPrev(r.date));

    const sumR = (recs: typeof currRev) => ({
      gross: recs.reduce((s, r) => s + r.totalGrossRevenue, 0),
      discount: recs.reduce((s, r) => s + r.discount, 0),
      returns: recs.reduce((s, r) => s + r.returnsValue, 0),
      net: recs.reduce((s, r) => s + r.netRevenue, 0),
      cogs: recs.reduce((s, r) => s + r.totalCogs, 0),
      profit: recs.reduce((s, r) => s + r.grossProfit, 0),
    });

    const curr = sumR(currRev);
    const prev = sumR(prevRev);

    // Expenses
    const currExp = (data.expenses || []).filter(e => inCurr(e.date));
    const prevExp = (data.expenses || []).filter(e => inPrev(e.date));

    // Payroll — dùng field `month` (YYYY-MM), so sánh với startDate/endDate theo tiền tố năm-tháng
    const startYM = startDate.slice(0, 7);
    const endYM = endDate.slice(0, 7);
    const prevStartYM = prevStart.slice(0, 7);
    const prevEndYM = prevEnd.slice(0, 7);
    const currPayroll = (data.payroll || []).filter(p => p.month >= startYM && p.month <= endYM);
    const prevPayroll = (data.payroll || []).filter(p => p.month >= prevStartYM && p.month <= prevEndYM);
    const payrollTotal = currPayroll.reduce((s, p) => s + (p.netPay ?? 0), 0);
    const prevPayrollTotal = prevPayroll.reduce((s, p) => s + (p.netPay ?? 0), 0);

    // Tách salary khỏi ledger trước để tránh double-count khi payroll module đã có dữ liệu
    const expCats = data.expenseCategories || [];
    const SALARY_LABELS = ['Nhân sự', 'Nhân viên', 'Lương'];
    let ledgerSalary = 0;
    const nonSalaryExp = currExp.filter(e => {
      const top = getTopLevelCategory(e.category, expCats);
      if (SALARY_LABELS.includes(top)) { ledgerSalary += e.amount; return false; }
      return true;
    });
    let prevLedgerSalary = 0;
    const prevNonSalaryExp = prevExp.filter(e => {
      const top = getTopLevelCategory(e.category, expCats);
      if (SALARY_LABELS.includes(top)) { prevLedgerSalary += e.amount; return false; }
      return true;
    });

    // Khi payroll module có dữ liệu → dùng nonSalaryExp (tránh double-count lương)
    // Khi chỉ có ledger → dùng toàn bộ currExp (ledgerSalary tính vào)
    const expenseOnly = payrollTotal > 0
      ? nonSalaryExp.reduce((s, e) => s + e.amount, 0)
      : currExp.reduce((s, e) => s + e.amount, 0);
    const prevExpenseOnly = prevPayrollTotal > 0
      ? prevNonSalaryExp.reduce((s, e) => s + e.amount, 0)
      : prevExp.reduce((s, e) => s + e.amount, 0);

    const totalExpenses = expenseOnly + payrollTotal;
    const prevTotalExp = prevExpenseOnly + prevPayrollTotal;

    // Derived
    const operatingProfit = curr.profit - totalExpenses;
    const netProfit = operatingProfit; // No "other income/expense" tracked

    const chg = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null);

    // Expense categories for pie + table (dùng nonSalaryExp khi có payroll module)
    const expForPie = payrollTotal > 0 ? nonSalaryExp : currExp;
    const catMap = new Map<string, number>();
    expForPie.forEach(e => {
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
    });
    if (payrollTotal > 0) catMap.set('Lương nhân viên', payrollTotal);
    const expByCategory = Array.from(catMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Pie: top 7 + "Khác"
    let pieData = expByCategory.slice(0, 7);
    if (expByCategory.length > 7) {
      const rest = expByCategory.slice(7).reduce((s, c) => s + c.amount, 0);
      pieData = [...pieData, { name: 'Khác', amount: rest }];
    }

    // ── Structure charts: waterfall + expense pie ──────────────────
    const personnelTotal = payrollTotal > 0 ? payrollTotal : ledgerSalary;
    let varCosts = 0;
    let fixedCosts2 = personnelTotal;
    let depCosts = 0;
    let intCosts = 0;
    let ledgerCogsVal = 0;
    nonSalaryExp.forEach(e => {
      const type = getCategoryType(e.category, expCats);
      const amt = Number(e.amount) || 0;
      if (type === 'fixed') fixedCosts2 += amt;
      else if (type === 'variable') varCosts += amt;
      else if (type === 'depreciation') depCosts += amt;
      else if (type === 'interest') intCosts += amt;
      else if (type === 'cogs') ledgerCogsVal += amt;
    });
    const totalGrossRev = curr.gross;
    const totalDisc = curr.discount;
    const totalRet = curr.returns;
    const grossProfit2 = curr.profit - ledgerCogsVal;
    const totalCogs2 = curr.cogs + ledgerCogsVal;
    const BLUE = '#1e293b';
    const GREEN = '#10b981';
    let wCurrent = totalGrossRev;
    const waterfallData: DashboardWaterfallItem[] = [
      { name: 'Doanh thu tổng', value: [0, totalGrossRev], fill: BLUE, label: '100%' },
      { name: 'Giảm giá', value: [wCurrent - totalDisc, wCurrent], fill: BLUE, label: totalGrossRev > 0 ? ((totalDisc / totalGrossRev) * 100).toFixed(0) + '%' : '0%' },
    ];
    wCurrent -= totalDisc;
    waterfallData.push({ name: 'Hàng trả lại', value: [wCurrent - totalRet, wCurrent], fill: BLUE, label: totalGrossRev > 0 ? ((totalRet / totalGrossRev) * 100).toFixed(0) + '%' : '0%' });
    wCurrent -= totalRet;
    waterfallData.push({ name: 'Doanh thu thuần', value: [0, curr.net], fill: BLUE, label: totalGrossRev > 0 ? ((curr.net / totalGrossRev) * 100).toFixed(0) + '%' : '0%' });
    wCurrent = curr.net;
    if (totalCogs2 > 0) {
      waterfallData.push({ name: 'Giá vốn', value: [wCurrent - totalCogs2, wCurrent], fill: BLUE, label: curr.net > 0 ? ((totalCogs2 / curr.net) * 100).toFixed(0) + '%' : '0%' });
      wCurrent -= totalCogs2;
    }
    waterfallData.push({ name: 'Lợi nhuận gộp', value: [0, grossProfit2], fill: GREEN, label: curr.net > 0 ? ((grossProfit2 / curr.net) * 100).toFixed(0) + '%' : '0%' });
    wCurrent = grossProfit2;
    if (varCosts > 0) {
      waterfallData.push({ name: 'Chi phí biến đổi', value: [Math.max(0, wCurrent - varCosts), wCurrent], fill: BLUE, label: curr.net > 0 ? ((varCosts / curr.net) * 100).toFixed(0) + '%' : '0%' });
      wCurrent -= varCosts;
    }
    if (fixedCosts2 > 0) {
      waterfallData.push({ name: 'Chi phí cố định', value: [Math.max(0, wCurrent - fixedCosts2), wCurrent], fill: BLUE, label: curr.net > 0 ? ((fixedCosts2 / curr.net) * 100).toFixed(0) + '%' : '0%' });
      wCurrent -= fixedCosts2;
    }
    if (depCosts > 0) {
      waterfallData.push({ name: 'Khấu hao', value: [Math.max(0, wCurrent - depCosts), wCurrent], fill: BLUE, label: curr.net > 0 ? ((depCosts / curr.net) * 100).toFixed(0) + '%' : '0%' });
      wCurrent -= depCosts;
    }
    if (intCosts > 0) {
      waterfallData.push({ name: 'Lãi vay', value: [Math.max(0, wCurrent - intCosts), wCurrent], fill: BLUE, label: curr.net > 0 ? ((intCosts / curr.net) * 100).toFixed(0) + '%' : '0%' });
    }
    waterfallData.push({ name: 'Lợi nhuận ròng', value: [0, operatingProfit], fill: operatingProfit >= 0 ? GREEN : '#f43f5e', label: curr.net > 0 ? ((operatingProfit / curr.net) * 100).toFixed(0) + '%' : '0%' });
    const topCatMap = new Map<string, number>();
    currExp.forEach(e => {
      const top = getTopLevelCategory(e.category, expCats);
      if (SALARY_LABELS.includes(top)) return;
      topCatMap.set(top, (topCatMap.get(top) ?? 0) + e.amount);
    });
    if (personnelTotal > 0) topCatMap.set('Nhân sự', personnelTotal);
    const expensePieData: DashboardExpenseSlice[] = Array.from(topCatMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const insightsForPanel: DashboardFinancialInsights = {
      periodRev: curr.net, periodExp: totalExpenses, periodProfit: operatingProfit,
      periodGross: curr.profit, payrollTotal: personnelTotal,
      nonPayrollExp: totalExpenses - personnelTotal, activeStaffCount: 0,
      netProfitMargin: curr.net > 0 ? (operatingProfit / curr.net) * 100 : 0,
      opExRatio: curr.net > 0 ? (totalExpenses / curr.net) * 100 : 0,
      laborCostRatio: curr.net > 0 ? (personnelTotal / curr.net) * 100 : 0,
      fixedCosts: fixedCosts2, variableCosts: varCosts,
      depreciationCosts: depCosts, interestCosts: intCosts,
      totalCogs: totalCogs2, ledgerCogs: ledgerCogsVal,
    };

    return {
      curr,
      prev,
      totalExpenses,
      prevTotalExp,
      operatingProfit,
      netProfit,
      days,
      expByCategory,
      pieData,
      chg,
      waterfallData,
      expensePieData,
      insightsForPanel,
      currExpFiltered: currExp,
      currPayrollFiltered: currPayroll,
    };
  }, [data, startDate, endDate]);

  const {
    curr,
    prev,
    totalExpenses,
    prevTotalExp,
    operatingProfit,
    netProfit,
    days,
    expByCategory,
    pieData,
    chg,
    waterfallData,
    expensePieData,
    insightsForPanel,
    currExpFiltered,
    currPayrollFiltered,
  } = metrics;

  const detailedExpenses = useMemo((): DashboardDetailedExpense[] => {
    if (!selectedParentCategory) return [];
    if (selectedParentCategory === 'Nhân sự') {
      if (currPayrollFiltered.length > 0) {
        return currPayrollFiltered.map(p => ({
          id: p.id,
          date: p.month,
          category: 'Nhân sự',
          description: `Lương tháng ${p.month} - ${p.employeeName}`,
          amount: Number(p.netPay) || 0,
        }));
      }
      return currExpFiltered
        .filter(e => getTopLevelCategory(e.category, data.expenseCategories || []) === 'Nhân sự')
        .map(e => ({ id: e.id, date: e.date, category: e.category, description: e.description || e.category, amount: e.amount }));
    }
    return currExpFiltered
      .filter(e => getTopLevelCategory(e.category, data.expenseCategories || []) === selectedParentCategory)
      .map(e => ({ id: e.id, date: e.date, category: e.category, description: e.description || e.category, amount: e.amount }));
  }, [selectedParentCategory, currExpFiltered, currPayrollFiltered, data.expenseCategories]);

  const handleAiRun = async () => {
    const contextData = {
      period: `${startDate} đến ${endDate}`,
      netRevenue: curr.net,
      grossProfit: curr.profit,
      totalExpenses,
      operatingProfit,
      costRatio: cpRatio.toFixed(2) + '%',
      topCategories: expByCategory.slice(0, 5).map(c => ({ name: c.name, amount: c.amount })),
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('profit-analysis', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/profit-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('profit-analysis', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const topCards = [
    { label: 'Doanh thu thuần', value: curr.net },
    { label: 'Lợi nhuận gộp', value: curr.profit },
    { label: 'Tổng chi phí', value: totalExpenses },
    { label: 'Thu nhập khác', value: 0 },
    { label: 'Lợi nhuận thuần', value: netProfit },
  ];

  const cpRatio = curr.net > 0 ? (totalExpenses / curr.net) * 100 : 0;
  const prevCpRatio = prev.net > 0 ? (prevTotalExp / prev.net) * 100 : 0;
  const cpRatioChg = prevCpRatio > 0 ? ((cpRatio - prevCpRatio) / prevCpRatio) * 100 : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <h1 className="text-base font-semibold text-slate-800">Chi phí - Lợi nhuận</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-slate-400 text-sm">-</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* 5 summary cards */}
        <div className="grid grid-cols-5 gap-3">
          {topCards.map(card => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-4"
            >
              <p className="text-xs text-slate-500 mb-1">{card.label}</p>
              <p className="text-xl font-bold text-slate-800">{fmtBig(card.value)}</p>
            </div>
          ))}
        </div>

        {/* Waterfall + Expense Pie */}
        <DashboardStructurePanel
          waterfallData={waterfallData}
          expensePieData={expensePieData}
          detailedExpenses={detailedExpenses}
          selectedParentCategory={selectedParentCategory}
          colors={COLORS}
          insights={insightsForPanel}
          onSelectParentCategory={setSelectedParentCategory}
          onClearParentCategory={() => setSelectedParentCategory(null)}
        />

        {/* Chi phí hoạt động + Cơ cấu chi phí */}
        <div className="grid grid-cols-5 gap-4">
          {/* Left: Chi phí hoạt động */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Chi phí hoạt động</span>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                {
                  label: 'Tổng chi phí',
                  value: fmtBig(totalExpenses),
                  pct: chg(totalExpenses, prevTotalExp),
                  invert: true,
                },
                {
                  label: 'Chi phí TB/ngày',
                  value: fmtBig(days > 0 ? totalExpenses / days : 0),
                  pct: chg(totalExpenses / (days || 1), prevTotalExp / (days || 1)),
                  invert: true,
                },
                {
                  label: 'Chi phí/doanh thu',
                  value: cpRatio.toFixed(2) + '%',
                  pct: cpRatioChg,
                  invert: true,
                },
              ].map(row => (
                <div key={row.label} className="px-5 py-4">
                  <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
                  <p className="text-xl font-bold text-slate-800 mb-1">{row.value}</p>
                  <p className="text-xs text-slate-400">
                    So với kỳ trước <PctBadge pct={row.pct} invert={row.invert} />
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Cơ cấu chi phí (pie chart) */}
          <div className="col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Cơ cấu chi phí</span>
            </div>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Không có dữ liệu chi phí
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    outerRadius={85}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v) + 'đ'} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Danh mục chi phí */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Danh mục chi phí</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">
                  Tên chi phí
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Tổng
                </th>
                <th className="text-right pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">
                  % Chi phí/Doanh thu
                </th>
              </tr>
            </thead>
            <tbody>
              {expByCategory.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-slate-400 text-sm">
                    Không có dữ liệu chi phí
                  </td>
                </tr>
              ) : (
                <>
                  {expByCategory.map((cat, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="pl-5 pr-4 py-3 text-sm text-slate-700">{cat.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">
                        {fmt(cat.amount)}
                      </td>
                      <td className="pr-5 pl-4 py-3 text-sm text-slate-600 text-right">
                        {curr.net > 0 ? ((cat.amount / curr.net) * 100).toFixed(2) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold">
                    <td className="pl-5 pr-4 py-3 text-sm text-slate-800">Tổng</td>
                    <td className="px-4 py-3 text-sm text-slate-800 text-right">
                      {fmt(totalExpenses)}
                    </td>
                    <td className="pr-5 pl-4 py-3 text-sm text-slate-800 text-right">
                      {cpRatio.toFixed(2)}%
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Chi tiết hiệu quả (P&L) */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Chi tiết hiệu quả</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500 w-2/3">
                  Khoản mục
                </th>
                <th className="text-right pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">
                  Giá trị
                </th>
              </tr>
            </thead>
            <tbody>
              <PLRow label="Tổng tiền hàng (1)" value={curr.gross} />
              <PLRow label="Giảm trừ doanh thu (2)" value={curr.discount + curr.returns} indent />
              <PLRow label="Doanh thu thuần (3)" value={curr.net} bold highlight />
              <PLRow label="Giá vốn hàng bán (4)" value={curr.cogs} indent />
              <PLRow label="Lợi nhuận gộp về bán hàng (5=3-4)" value={curr.profit} bold highlight />
              <PLRow label="Chi phí hoạt động + lương (6)" value={totalExpenses} indent />
              <PLRow label="Lợi nhuận từ HĐKD (7=5-6)" value={operatingProfit} bold highlight />
              <PLRow label="Thu nhập khác (8)" value={0} indent note="(chưa theo dõi)" />
              <PLRow label="Chi phí khác (9)" value={0} indent note="(chưa theo dõi)" />
              <PLRow label="Lợi nhuận thuần (10=(7+8)-9)" value={netProfit} bold highlight />
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Dữ liệu được tổng hợp đến {endDate} (UTC+07:00)
            </p>
          </div>
        </div>

        <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />
      </div>
    </div>
  );
};

export default AnalysisBusinessProfitPage;
