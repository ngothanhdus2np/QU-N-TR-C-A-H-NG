import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AppData } from '../../types';

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
  if (pct === null) return <span className="text-slate-400 text-[11px]">--%</span>;
  const positive = invert ? pct < 0 : pct > 0;
  const color = positive ? 'text-emerald-600' : pct === 0 ? 'text-slate-400' : 'text-rose-500';
  return (
    <span className={`text-[12px] font-medium ${color}`}>
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
}> = ({ label, value, bold, highlight, indent }) => (
  <tr className={`border-b border-slate-100 ${highlight ? 'bg-slate-50' : ''}`}>
    <td
      className={`pl-5 pr-4 py-3 text-[13px] ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'} ${indent ? 'pl-8' : ''}`}
    >
      {label}
    </td>
    <td
      className={`px-4 py-3 text-[13px] text-right ${bold ? 'font-semibold text-slate-800' : 'text-slate-700'}`}
    >
      {fmt(value)}
    </td>
    <td
      className={`pr-5 pl-4 py-3 text-[13px] text-right ${bold ? 'font-semibold text-slate-800' : 'text-slate-700'}`}
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
    const totalExpenses = currExp.reduce((s, e) => s + e.amount, 0);
    const prevTotalExp = prevExp.reduce((s, e) => s + e.amount, 0);

    // Derived
    const operatingProfit = curr.profit - totalExpenses;
    const netProfit = operatingProfit; // No "other income/expense" tracked

    const chg = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null);

    // Expense categories for pie + table
    const catMap = new Map<string, number>();
    currExp.forEach(e => {
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
    });
    const expByCategory = Array.from(catMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Pie: top 7 + "Khác"
    let pieData = expByCategory.slice(0, 7);
    if (expByCategory.length > 7) {
      const rest = expByCategory.slice(7).reduce((s, c) => s + c.amount, 0);
      pieData = [...pieData, { name: 'Khác', amount: rest }];
    }

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
  } = metrics;

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
            className="text-[13px] border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-slate-400 text-sm">-</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="text-[13px] border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
              <p className="text-[11px] text-slate-500 mb-1">{card.label}</p>
              <p className="text-xl font-bold text-slate-800">{fmtBig(card.value)}</p>
            </div>
          ))}
        </div>

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
                  <p className="text-[11px] text-slate-500 mb-0.5">{row.label}</p>
                  <p className="text-xl font-bold text-slate-800 mb-1">{row.value}</p>
                  <p className="text-[11px] text-slate-400">
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
                <th className="text-left pl-5 pr-4 py-2.5 text-[12px] font-medium text-slate-500">
                  Tên chi phí
                </th>
                <th className="text-right px-4 py-2.5 text-[12px] font-medium text-slate-500">
                  Tổng
                </th>
                <th className="text-right pr-5 pl-4 py-2.5 text-[12px] font-medium text-slate-500">
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
                      <td className="pl-5 pr-4 py-3 text-[13px] text-slate-700">{cat.name}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-700 text-right">
                        {fmt(cat.amount)}
                      </td>
                      <td className="pr-5 pl-4 py-3 text-[13px] text-slate-600 text-right">
                        {curr.net > 0 ? ((cat.amount / curr.net) * 100).toFixed(2) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold">
                    <td className="pl-5 pr-4 py-3 text-[13px] text-slate-800">Tổng</td>
                    <td className="px-4 py-3 text-[13px] text-slate-800 text-right">
                      {fmt(totalExpenses)}
                    </td>
                    <td className="pr-5 pl-4 py-3 text-[13px] text-slate-800 text-right">
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
                <th className="text-left pl-5 pr-4 py-2.5 text-[12px] font-medium text-slate-500 w-1/2">
                  Khoản mục
                </th>
                <th className="text-right px-4 py-2.5 text-[12px] font-medium text-slate-500">
                  Chi nhánh trung tâm
                </th>
                <th className="text-right pr-5 pl-4 py-2.5 text-[12px] font-medium text-slate-500">
                  Tổng
                </th>
              </tr>
            </thead>
            <tbody>
              <PLRow label="Tổng tiền hàng (1)" value={curr.gross} />
              <PLRow label="Giảm trừ doanh thu (2)" value={curr.discount + curr.returns} indent />
              <PLRow label="Doanh thu thuần (3)" value={curr.net} bold highlight />
              <PLRow label="Giá vốn hàng bán (4)" value={curr.cogs} indent />
              <PLRow label="Lợi nhuận gộp về bán hàng (5=3-4)" value={curr.profit} bold highlight />
              <PLRow label="Chi phí (6)" value={totalExpenses} indent />
              <PLRow label="Lợi nhuận từ HĐKD (7=5-6)" value={operatingProfit} bold highlight />
              <PLRow label="Thu nhập khác (8)" value={0} indent />
              <PLRow label="Chi phí khác (9)" value={0} indent />
              <PLRow label="Lợi nhuận thuần (10=(7+8)-9)" value={netProfit} bold highlight />
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              Dữ liệu được tổng hợp đến {endDate} (UTC+07:00)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisBusinessProfitPage;
