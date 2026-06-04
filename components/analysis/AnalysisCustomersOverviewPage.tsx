import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AppData } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';

interface Props {
  data: AppData;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtBig = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' triệu';
  return fmt(n);
};

function defaultRange() {
  const end = new Date();
  const start = new Date(Date.now() - 29 * 86400_000);
  return {
    start: start.toLocaleDateString('sv-SE'),
    end: end.toLocaleDateString('sv-SE'),
  };
}

const SEG_COLORS = { cu: '#3b82f6', moi: '#22c55e', le: '#94a3b8' };

interface PieSegment {
  name: string;
  value: number;
  color: string;
}

interface PieCardProps {
  title: string;
  total: number;
  unit?: string;
  formatTotal?: (n: number) => string;
  data: PieSegment[];
  formatValue: (n: number) => string;
}

const PieCard: React.FC<PieCardProps> = ({
  title,
  total,
  unit,
  formatTotal,
  data,
  formatValue,
}) => {
  const totalVal = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-800 mb-4">
        {formatTotal ? formatTotal(total) : fmt(total)}
        {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
      </p>
      <div className="flex items-center gap-5">
        <div className="w-36 h-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={34}
                outerRadius={62}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 flex flex-col gap-2.5 border-t border-slate-50 pt-1">
          {data.map(seg => {
            const pct = totalVal > 0 ? ((seg.value / totalVal) * 100).toFixed(2) : '0.00';
            return (
              <div key={seg.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: seg.color }}
                  />
                  <span className="text-sm text-slate-600">{seg.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                  <span className="text-sm font-medium text-slate-700 w-24 text-right">
                    {formatValue(seg.value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface DailyPoint {
  day: string;
  customers: number;
  revenue: number;
}

interface BarCardProps {
  title: string;
  data: DailyPoint[];
  dataKey: 'customers' | 'revenue';
  formatTooltip: (v: number) => string;
}

const BarCard: React.FC<BarCardProps> = ({ title, data, dataKey, formatTooltip }) => (
  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
    <div className="px-5 py-3 border-b border-slate-100">
      <span className="text-sm font-semibold text-slate-700">{title}</span>
    </div>
    <div className="px-4 py-4" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={6} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(0, Math.ceil(data.length / 8) - 1)}
          />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v: number) => [formatTooltip(v), title]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey={dataKey} fill="#94a3b8" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const AnalysisCustomersOverviewPage: React.FC<Props> = ({ data }) => {
  const { start: defStart, end: defEnd } = defaultRange();
  const [startDate, setStartDate] = useState(defStart);
  const [endDate, setEndDate] = useState(defEnd);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const stats = useMemo(() => {
    const orders = (data.posOrders || []).filter(
      o => !o.isReturn && o.date >= startDate && o.date <= endDate
    );

    // First order date per customer across all time
    const allOrders = (data.posOrders || []).filter(o => !o.isReturn);
    const firstOrderDate = new Map<string, string>();
    allOrders.forEach(o => {
      if (o.customerId) {
        const cur = firstOrderDate.get(o.customerId);
        if (!cur || o.date < cur) firstOrderDate.set(o.customerId, o.date);
      }
    });

    let cuCount = 0,
      cuRevenue = 0;
    let moiCount = 0,
      moiRevenue = 0;
    let leCount = 0,
      leRevenue = 0;

    const dayCustomersSet = new Map<string, Set<string>>();
    const dayRevenue = new Map<string, number>();

    orders.forEach(o => {
      const day = o.date;
      if (!dayCustomersSet.has(day)) dayCustomersSet.set(day, new Set());

      if (!o.customerId) {
        leCount++;
        leRevenue += o.finalAmount;
        dayCustomersSet.get(day)!.add(`le_${o.id}`);
      } else {
        const first = firstOrderDate.get(o.customerId);
        if (first && first >= startDate) {
          moiCount++;
          moiRevenue += o.finalAmount;
        } else {
          cuCount++;
          cuRevenue += o.finalAmount;
        }
        dayCustomersSet.get(day)!.add(o.customerId);
      }
      dayRevenue.set(day, (dayRevenue.get(day) || 0) + o.finalAmount);
    });

    // Build daily series
    const allDays: string[] = [];
    const d = new Date(startDate);
    const endD = new Date(endDate);
    while (d <= endD) {
      allDays.push(d.toLocaleDateString('sv-SE'));
      d.setDate(d.getDate() + 1);
    }

    const dailyData: DailyPoint[] = allDays.map(day => ({
      day: day.slice(5).replace('-', '/'),
      customers: dayCustomersSet.get(day)?.size || 0,
      revenue: dayRevenue.get(day) || 0,
    }));

    return {
      totalCustomers: cuCount + moiCount + leCount,
      totalRevenue: cuRevenue + moiRevenue + leRevenue,
      cuCount,
      cuRevenue,
      moiCount,
      moiRevenue,
      leCount,
      leRevenue,
      dailyData,
    };
  }, [data.posOrders, startDate, endDate]);

  const handleAiRun = async () => {
    const contextData = {
      period: `${startDate} đến ${endDate}`,
      totalCustomers: stats.totalCustomers,
      totalRevenue: stats.totalRevenue,
      returning: { count: stats.cuCount, revenue: stats.cuRevenue },
      new: { count: stats.moiCount, revenue: stats.moiRevenue },
      walk_in: { count: stats.leCount, revenue: stats.leRevenue },
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('customers-overview', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/customers-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('customers-overview', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const pieDataCount: PieSegment[] = [
    { name: 'Khách cũ', value: stats.cuCount, color: SEG_COLORS.cu },
    { name: 'Khách mới', value: stats.moiCount, color: SEG_COLORS.moi },
    { name: 'Khách lẻ', value: stats.leCount, color: SEG_COLORS.le },
  ];
  const pieDataRevenue: PieSegment[] = [
    { name: 'Khách cũ', value: stats.cuRevenue, color: SEG_COLORS.cu },
    { name: 'Khách mới', value: stats.moiRevenue, color: SEG_COLORS.moi },
    { name: 'Khách lẻ', value: stats.leRevenue, color: SEG_COLORS.le },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <h1 className="text-base font-semibold text-slate-800">Tổng quan khách hàng</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1 text-slate-700"
          />
          <span className="text-slate-400 text-sm">–</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1 text-slate-700"
          />
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* 2 pie cards */}
        <div className="grid grid-cols-2 gap-4">
          <PieCard
            title="Tổng lượng khách"
            total={stats.totalCustomers}
            unit="khách"
            data={pieDataCount}
            formatValue={fmt}
          />
          <PieCard
            title="Tổng doanh thu"
            total={stats.totalRevenue}
            formatTotal={fmtBig}
            data={pieDataRevenue}
            formatValue={fmtBig}
          />
        </div>

        {/* 2 bar charts */}
        <div className="grid grid-cols-2 gap-4">
          <BarCard
            title="Lượng khách"
            data={stats.dailyData}
            dataKey="customers"
            formatTooltip={v => `${v} khách`}
          />
          <BarCard
            title="Doanh thu"
            data={stats.dailyData}
            dataKey="revenue"
            formatTooltip={v => fmtBig(v)}
          />
        </div>

        <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />
      </div>
    </div>
  );
};

export default AnalysisCustomersOverviewPage;
