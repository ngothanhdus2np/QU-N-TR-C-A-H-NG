import React, { useMemo, useState } from 'react';
import MatrixTab from '../revenue/MatrixTab';
import TimeFilter from '../TimeFilter';
import type { AppData, DiagnosisRange } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';
import { DashboardTrendsPanel } from '../dashboard/DashboardTrendsPanel';

interface Props {
  data: AppData;
}

const FINANCIAL_METRICS = [
  { key: 'totalGrossRevenue', label: 'Tổng tiền hàng' },
  { key: 'discount', label: 'Giảm giá' },
  { key: 'revenueOther', label: 'Doanh thu khác' },
  { key: 'returnsValue', label: 'Giá trị trả hàng' },
  { key: 'netRevenue', label: 'Doanh thu thuần' },
  { key: 'totalCogs', label: 'Tổng giá vốn' },
  { key: 'grossProfit', label: 'Lợi nhuận gộp' },
];

const toDateString = (date: Date) => date.toLocaleDateString('sv-SE');

const AnalysisFinancialMatrixPage: React.FC<Props> = ({ data }) => {
  const today = toDateString(new Date());
  const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  const [matrixRange, setMatrixRange] = useState<DiagnosisRange>('thisMonth');
  const [startDate, setStartDate] = useState(toDateString(firstOfMonth));
  const [endDate, setEndDate] = useState(today);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [selectedTrendMonth, setSelectedTrendMonth] = useState<string | null>(null);


  // Tránh double-count lương: nếu payroll module có data thì loại salary ra khỏi expenses
  const salaryKws = ['luong', 'hoa hong', 'thu nhap nhan su', 'nhan su', 'thuong doanh so'];
  const normVNMatrix = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd');
  const isSalaryMatrix = (cat: string) => salaryKws.some(kw => normVNMatrix(cat).includes(kw));
  const payrollModuleTotal = (data.payroll || []).reduce((s, p) => s + (Number(p.netPay) || 0), 0);
  const nonSalaryExpenses = payrollModuleTotal > 0
    ? (data.expenses || []).filter(e => !isSalaryMatrix(e.category))
    : (data.expenses || []);

  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; grossProfit: number; netProfit: number }> = {};
    data.revenue.forEach(r => {
      const k = r.date.substring(0, 7);
      if (!months[k]) months[k] = { month: k, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[k].revenue += (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
      months[k].grossProfit += Number(r.grossProfit) || 0;
    });
    nonSalaryExpenses.forEach(e => {
      const k = e.date.substring(0, 7);
      if (!months[k]) months[k] = { month: k, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[k].netProfit -= Number(e.amount);
    });
    data.payroll.forEach(p => {
      const k = p.month;
      if (!months[k]) months[k] = { month: k, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[k].netProfit -= Number(p.netPay);
    });
    Object.keys(months).forEach(k => { months[k].netProfit += months[k].grossProfit; });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [data.revenue, nonSalaryExpenses, data.payroll]);

  const dailyTrendData = useMemo(() => {
    if (!selectedTrendMonth) return [];
    const days: Record<string, { date: string; revenue: number; grossProfit: number; netProfit: number }> = {};
    data.revenue.filter(r => r.date.startsWith(selectedTrendMonth)).forEach(r => {
      if (!days[r.date]) days[r.date] = { date: r.date, revenue: 0, grossProfit: 0, netProfit: 0 };
      days[r.date].revenue += (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
      days[r.date].grossProfit += Number(r.grossProfit) || 0;
    });
    nonSalaryExpenses.filter(e => e.date.startsWith(selectedTrendMonth)).forEach(e => {
      if (!days[e.date]) days[e.date] = { date: e.date, revenue: 0, grossProfit: 0, netProfit: 0 };
      days[e.date].netProfit -= Number(e.amount);
    });
    Object.keys(days).forEach(k => { days[k].netProfit += days[k].grossProfit; });
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.revenue, nonSalaryExpenses, selectedTrendMonth]);

  const currentYear = new Date().getFullYear();
  const isValidYear = (y: string) =>
    /^\d{4}$/.test(y) && Number(y) >= 2000 && Number(y) <= currentYear;

  // Ma trận tài chính luôn dùng revenue_records (KiotViet monthly sync) cho tất cả năm
  // → khớp chính xác với báo cáo KiotViet, kể cả returns_value và gross revenue

  const timeContext = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const last7 = new Date(now);
    last7.setDate(now.getDate() - 6);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const thisYearStart = new Date(now.getFullYear(), 0, 1);

    switch (matrixRange) {
      case 'today':
        return { start: toDateString(now), end: toDateString(now) };
      case 'yesterday':
        return { start: toDateString(yesterday), end: toDateString(yesterday) };
      case 'last7':
        return { start: toDateString(last7), end: toDateString(now) };
      case 'thisMonth':
        return { start: toDateString(thisMonthStart), end: toDateString(now) };
      case 'lastMonth':
        return { start: toDateString(lastMonthStart), end: toDateString(lastMonthEnd) };
      case 'thisYear':
        return { start: toDateString(thisYearStart), end: toDateString(now) };
      case 'custom':
        return { start: startDate || '1900-01-01', end: endDate || '2100-12-31' };
      case 'all':
        return { start: '1900-01-01', end: '2100-12-31' };
    }
  }, [matrixRange, startDate, endDate]);

  const years = useMemo(() => {
    const yearSet = new Set<string>();
    (data.revenue || []).forEach(r => {
      const y = r.date?.slice(0, 4);
      if (y && isValidYear(y)) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [data.revenue]);

  const financialMatrixData = useMemo(() => {
    const [, startMonth, startDay] = timeContext.start.split('-');
    const [, endMonth, endDay] = timeContext.end.split('-');

    const metricsByYear: Record<string, Record<string, number>> = {};
    years.forEach(year => {
      const startOfTarget = `${year}-${startMonth || '01'}-${startDay || '01'}`;
      const endOfTarget = `${year}-${endMonth || '12'}-${endDay || '31'}`;

      const seenDates = new Set<string>();
      const recs = (data.revenue || []).filter(r => {
        if (r.date < startOfTarget || r.date > endOfTarget) return false;
        const dateKey = r.date.slice(0, 10);
        if (seenDates.has(dateKey)) return false;
        seenDates.add(dateKey);
        return true;
      });
      const sum = (key: string) => recs.reduce((s, r) => s + (Number((r as any)[key]) || 0), 0);
      metricsByYear[year] = {
        totalGrossRevenue: sum('totalGrossRevenue'),
        discount:          Math.abs(sum('discount')),
        revenueOther:      sum('revenueOther'),
        returnsValue:      Math.abs(sum('returnsValue')),
        netRevenue:        sum('netRevenue'),
        totalCogs:         sum('totalCogs'),
        grossProfit:       sum('grossProfit'),
      };
    });

    return FINANCIAL_METRICS.map(metric => ({
      ...metric,
      yearValues: Object.fromEntries(years.map(y => [y, metricsByYear[y]?.[metric.key] ?? 0])) as Record<string, number>,
    }));
  }, [data.revenue, years, timeContext]);

  const maxFinancialValue = useMemo(() => {
    let max = 0;
    financialMatrixData.forEach(row => {
      Object.values(row.yearValues).forEach(value => {
        if (value > max) max = value;
      });
    });
    return max || 1;
  }, [financialMatrixData]);

  const getHeatmapColor = (value: number) => {
    if (value <= 0) return 'transparent';
    const intensity = value / maxFinancialValue;
    if (intensity > 0.8) return 'bg-emerald-500 text-white font-normal';
    if (intensity > 0.5) return 'bg-emerald-400 text-white font-normal';
    if (intensity > 0.3) return 'bg-emerald-200 text-emerald-900 font-normal';
    if (intensity > 0.1) return 'bg-emerald-100 text-emerald-800 font-normal';
    return 'bg-emerald-50 text-emerald-700 font-normal';
  };

  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');

  const handleAiRun = async () => {
    const contextData = {
      period: matrixRange,
      years,
      metrics: financialMatrixData.map(m => ({ label: m.label, yearValues: m.yearValues })),
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('financial-matrix', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/financial-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('financial-matrix', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="flex min-h-[58px] items-center justify-end border-b border-slate-100 bg-slate-50 px-4 shrink-0">
        <TimeFilter
          diagnosisRange={matrixRange}
          setDiagnosisRange={setMatrixRange}
          diagStartDate={startDate}
          setDiagStartDate={setStartDate}
          diagEndDate={endDate}
          setDiagEndDate={setEndDate}
          variant="range"
        />
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        <DashboardTrendsPanel
          monthlyTrendData={monthlyTrendData}
          dailyTrendData={dailyTrendData}
          selectedTrendMonth={selectedTrendMonth}
          onSelectMonth={setSelectedTrendMonth}
          onClearMonth={() => setSelectedTrendMonth(null)}
        />
        <MatrixTab
          isShopee={false}
          productGroups={data.productGroups || []}
          groupRevenue={data.productGroupRevenue || []}
          timeContext={timeContext}
          years={years}
          financialMatrixData={financialMatrixData}
          getHeatmapColor={getHeatmapColor}
          formatNumber={formatNumber}
        />
        <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />
      </div>
    </div>
  );
};

export default AnalysisFinancialMatrixPage;
