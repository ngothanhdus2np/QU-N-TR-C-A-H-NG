import React, { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BrainCircuit, Sparkles, Loader2, Lightbulb } from 'lucide-react';
import type { AppData } from '../../types';

interface Props {
  data: AppData;
}

// ─── Formatters ────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtBig = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' triệu';
  return fmt(n);
};
const fmtAxis = (v: number) => {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + 'Tr';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(v);
};

// ─── Previous period helper ────────────────────────────────────
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

type AnalysisTab = 'revenue' | 'returns' | 'net' | 'profit' | 'orders';

const TAB_CONFIG: { id: AnalysisTab; label: string }[] = [
  { id: 'revenue', label: 'Doanh thu' },
  { id: 'returns', label: 'Trả hàng' },
  { id: 'net', label: 'Doanh thu thuần' },
  { id: 'profit', label: 'Lợi nhuận gộp' },
  { id: 'orders', label: 'Số hóa đơn' },
];

interface GroupStat {
  id: string;
  name: string;
  revenue: number;
  returns: number;
  net: number;
  cogs: number;
  qty: number;
}

const getGroupVal = (g: GroupStat, tab: AnalysisTab): number => {
  switch (tab) {
    case 'revenue':
      return g.revenue;
    case 'returns':
      return g.returns;
    case 'net':
      return g.net;
    case 'profit':
      return g.net - g.cogs;
    case 'orders':
      return g.qty;
  }
};

// ─── % badge ──────────────────────────────────────────────────
const PctBadge: React.FC<{ pct: number | null; invert?: boolean }> = ({ pct, invert = false }) => {
  if (pct === null) return <span className="text-slate-400 text-[11px]">—</span>;
  const positive = invert ? pct < 0 : pct > 0;
  const color = positive ? 'text-emerald-600' : pct === 0 ? 'text-slate-400' : 'text-rose-500';
  const sign = pct > 0 ? '+' : '';
  return (
    <span className={`text-[12px] font-medium ${color}`}>
      {sign}
      {pct.toFixed(2)}%
    </span>
  );
};

// ─── Main component ────────────────────────────────────────────
const AnalysisBusinessPage: React.FC<Props> = ({ data }) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toLocaleDateString('sv-SE');

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('revenue');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // ── Computed ──────────────────────────────────────────────────
  const { cards, chartData, groupStats, productStats } = useMemo(() => {
    const { prevStart, prevEnd, days } = getPrevPeriod(startDate, endDate);

    const inCurr = (d: string) => d >= startDate && d <= endDate;
    const inPrev = (d: string) => d >= prevStart && d <= prevEnd;

    // Combine store + shopee
    const allRev = [...(data.revenue || []), ...(data.shopeeRevenue || [])];
    const currRev = allRev.filter(r => inCurr(r.date));
    const prevRev = allRev.filter(r => inPrev(r.date));

    const sumRev = (recs: typeof currRev) => ({
      gross: recs.reduce((s, r) => s + r.totalGrossRevenue, 0),
      returns: recs.reduce((s, r) => s + r.returnsValue, 0),
      net: recs.reduce((s, r) => s + r.netRevenue, 0),
      cogs: recs.reduce((s, r) => s + r.totalCogs, 0),
      profit: recs.reduce((s, r) => s + r.grossProfit, 0),
    });

    const curr = sumRev(currRev);
    const prev = sumRev(prevRev);

    // Order count
    const currOrders = (data.posOrders || []).filter(o => !o.isReturn && inCurr(o.date)).length;
    const prevOrders = (data.posOrders || []).filter(o => !o.isReturn && inPrev(o.date)).length;

    const chg = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null);

    const cards = [
      {
        label: 'Số hóa đơn',
        value: currOrders,
        display: currOrders.toLocaleString('vi-VN'),
        avg: days > 0 ? Math.round(currOrders / days) : 0,
        avgLabel: 'TB/ngày',
        pct: chg(currOrders, prevOrders),
        invert: false,
        unit: '',
      },
      {
        label: 'Doanh thu',
        value: curr.gross,
        display: fmtBig(curr.gross),
        avg: days > 0 ? curr.gross / days : 0,
        avgLabel: 'TB/ngày',
        pct: chg(curr.gross, prev.gross),
        invert: false,
        unit: 'đ',
      },
      {
        label: 'Giá trị trả',
        value: curr.returns,
        display: fmtBig(curr.returns),
        avg: days > 0 ? curr.returns / days : 0,
        avgLabel: 'TB/ngày',
        pct: chg(curr.returns, prev.returns),
        invert: true,
        unit: 'đ',
      },
      {
        label: 'Doanh thu thuần',
        value: curr.net,
        display: fmtBig(curr.net),
        avg: days > 0 ? curr.net / days : 0,
        avgLabel: 'TB/ngày',
        pct: chg(curr.net, prev.net),
        invert: false,
        unit: 'đ',
      },
      {
        label: 'Tổng giá vốn',
        value: curr.cogs,
        display: fmtBig(curr.cogs),
        avg: days > 0 ? curr.cogs / days : 0,
        avgLabel: 'TB/ngày',
        pct: chg(curr.cogs, prev.cogs),
        invert: true,
        unit: 'đ',
      },
      {
        label: 'Lợi nhuận gộp',
        value: curr.profit,
        display: fmtBig(curr.profit),
        avg: days > 0 ? curr.profit / days : 0,
        avgLabel: 'TB/ngày',
        pct: chg(curr.profit, prev.profit),
        invert: false,
        unit: 'đ',
      },
    ];

    // ── Daily chart data ────────────────────────────────────────
    const dateSet = new Set(currRev.map(r => r.date));
    const chartData = Array.from(dateSet)
      .sort()
      .map(date => {
        const recs = currRev.filter(r => r.date === date);
        return {
          date: date.slice(5).replace('-', '/'), // MM/DD
          revenue: recs.reduce((s, r) => s + r.totalGrossRevenue, 0),
          returns: recs.reduce((s, r) => s + r.returnsValue, 0),
          cogs: recs.reduce((s, r) => s + r.totalCogs, 0),
          profit: recs.reduce((s, r) => s + r.grossProfit, 0),
        };
      });

    // ── Group stats ─────────────────────────────────────────────
    const allGroups = [
      ...(data.productGroupRevenue || []),
      ...(data.shopeeProductGroupRevenue || []),
    ];
    const buildGroupMap = (recs: typeof allGroups): Map<string, GroupStat> => {
      const m = new Map<string, GroupStat>();
      recs.forEach(r => {
        const p = m.get(r.groupId) ?? {
          id: r.groupId,
          name: r.groupName,
          revenue: 0,
          returns: 0,
          net: 0,
          cogs: 0,
          qty: 0,
        };
        m.set(r.groupId, {
          ...p,
          revenue: p.revenue + r.amount,
          returns: p.returns + (r.returnsValue ?? 0),
          net: p.net + (r.netRevenue ?? r.amount),
          cogs: p.cogs + (r.cogs ?? 0),
          qty: p.qty + (r.quantity ?? 0),
        });
      });
      return m;
    };

    const currGroupMap = buildGroupMap(allGroups.filter(r => inCurr(r.date)));
    const prevGroupMap = buildGroupMap(allGroups.filter(r => inPrev(r.date)));

    const groupStats = Array.from(currGroupMap.values()).map(g => {
      const p = prevGroupMap.get(g.id);
      return { ...g, prevGroup: p ?? null };
    });

    // ── Product stats ──────────────────────────────────────────
    const productMap = new Map((data.posProducts || []).map(p => [p.id, p]));
    const pMap = new Map<
      string,
      { name: string; revenue: number; qty: number; retQty: number; profit: number }
    >();
    const pPrevMap = new Map<string, { revenue: number; qty: number }>();

    (data.posOrders || []).forEach(o => {
      const inC = inCurr(o.date);
      const inP = inPrev(o.date);
      if (!inC && !inP) return;

      o.items.forEach(item => {
        const prod = productMap.get(item.productId);
        const importPrice = prod?.importPrice ?? 0;

        if (inC && !o.isReturn) {
          const p = pMap.get(item.productId) ?? {
            name: item.name,
            revenue: 0,
            qty: 0,
            retQty: 0,
            profit: 0,
          };
          pMap.set(item.productId, {
            name: item.name,
            revenue: p.revenue + item.total,
            qty: p.qty + item.quantity,
            retQty: p.retQty,
            profit: p.profit + (item.price - importPrice) * item.quantity - item.discount,
          });
        }
        if (inC && o.isReturn) {
          const p = pMap.get(item.productId);
          if (p) pMap.set(item.productId, { ...p, retQty: p.retQty + item.quantity });
        }
        if (inP && !o.isReturn) {
          const p = pPrevMap.get(item.productId) ?? { revenue: 0, qty: 0 };
          pPrevMap.set(item.productId, {
            revenue: p.revenue + item.total,
            qty: p.qty + item.quantity,
          });
        }
      });
    });

    const productStats = Array.from(pMap.entries()).map(([id, curr]) => ({
      id,
      ...curr,
      prevRevenue: pPrevMap.get(id)?.revenue ?? 0,
    }));

    return { cards, chartData, groupStats, productStats };
  }, [data, startDate, endDate]);

  // ── Sorted top 10 ──────────────────────────────────────────────
  const top10Groups = useMemo(() => {
    return [...groupStats]
      .sort((a, b) => getGroupVal(b, analysisTab) - getGroupVal(a, analysisTab))
      .slice(0, 10)
      .map(g => {
        const curr = getGroupVal(g, analysisTab);
        const prevVal = g.prevGroup ? getGroupVal(g.prevGroup, analysisTab) : 0;
        const pct = prevVal > 0 ? ((curr - prevVal) / prevVal) * 100 : null;
        const avgPerUnit = g.qty > 0 ? curr / g.qty : 0;
        return { ...g, curr, pct, avgPerUnit };
      });
  }, [groupStats, analysisTab]);

  const top10Products = useMemo(() => {
    return [...productStats]
      .sort((a, b) => {
        if (analysisTab === 'profit') return b.profit - a.profit;
        if (analysisTab === 'orders') return b.qty - b.retQty - (a.qty - a.retQty);
        return b.revenue - a.revenue;
      })
      .slice(0, 10)
      .map(p => {
        const curr =
          analysisTab === 'profit'
            ? p.profit
            : analysisTab === 'orders'
              ? p.qty - p.retQty
              : p.revenue;
        const pct = p.prevRevenue > 0 ? ((p.revenue - p.prevRevenue) / p.prevRevenue) * 100 : null;
        const avgPerUnit = p.qty > 0 ? curr / p.qty : 0;
        return { ...p, curr, pct, avgPerUnit };
      });
  }, [productStats, analysisTab]);

  const colLabel = TAB_CONFIG.find(t => t.id === analysisTab)?.label ?? 'Doanh thu';
  const isOrderTab = analysisTab === 'orders';

  // ── AI analysis ────────────────────────────────────────────────
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const c = cards;
      const contextData = `
NHIỆM VỤ: Phân tích toàn diện tình hình kinh doanh từ ${startDate} đến ${endDate}.

DỮ LIỆU (GỘP CỬA HÀNG + SHOPEE):
- Số hóa đơn: ${c[0].display} (${c[0].pct !== null ? (c[0].pct > 0 ? '+' : '') + c[0].pct?.toFixed(1) + '% so kỳ trước' : 'không có kỳ trước'})
- Doanh thu: ${c[1].display} (${c[1].pct !== null ? (c[1].pct > 0 ? '+' : '') + c[1].pct?.toFixed(1) + '%' : '—'})
- Giá trị trả: ${c[2].display}
- Doanh thu thuần: ${c[3].display}
- Tổng giá vốn: ${c[4].display}
- Lợi nhuận gộp: ${c[5].display} (${c[5].pct !== null ? (c[5].pct > 0 ? '+' : '') + c[5].pct?.toFixed(1) + '%' : '—'})

TOP 5 NHÓM HÀNG (theo doanh thu):
${top10Groups
  .slice(0, 5)
  .map(
    g =>
      `  - ${g.name}: ${fmt(g.revenue)}đ (${g.pct !== null ? (g.pct > 0 ? '+' : '') + g.pct.toFixed(1) + '%' : '—'})`
  )
  .join('\n')}

NGƯỠNG AN TOÀN NGÀNH BÁN LẺ GIÀY DÉP:
- Biên LN Gộp: 35–50%, Biên LN Ròng: 10–20%

YÊU CẦU:
1. ĐÁNH GIÁ tổng thể so với kỳ trước — tốt/xấu hơn ở đâu?
2. NHÓM HÀNG nào đang tăng trưởng, nhóm nào suy giảm?
3. KHUYẾN NGHỊ ít nhất 3 hành động cụ thể để cải thiện.
      `.trim();

      const res = await fetch('/api/ai/business-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });
      const json = await res.json();
      setAnalysisResult(json.result || 'Không có kết quả.');
    } catch {
      setAnalysisResult('Không thể kết nối AI. Vui lòng kiểm tra ANTHROPIC_API_KEY.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* ── Title bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <h1 className="text-base font-semibold text-slate-800">Tổng quan kinh doanh</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => {
              setStartDate(e.target.value);
              setAnalysisResult(null);
            }}
            className="text-[13px] border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-slate-400 text-sm">-</span>
          <input
            type="date"
            value={endDate}
            onChange={e => {
              setEndDate(e.target.value);
              setAnalysisResult(null);
            }}
            className="text-[13px] border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* ── 6 Cards (2×3) ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {cards.map(card => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4"
            >
              <p className="text-[12px] text-slate-500 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-slate-800 mb-2">{card.display}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Trung bình/ngày
                  <span className="ml-1 text-slate-600 font-medium">
                    {card.unit ? fmtBig(card.avg) : Math.round(card.avg).toLocaleString('vi-VN')}
                  </span>
                </span>
                <span>
                  So với kỳ trước <PctBadge pct={card.pct} invert={card.invert} />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Line chart ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">Chỉ số kinh doanh</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(v: number) => fmt(v) + 'đ'}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Doanh thu"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="returns"
                name="Trả hàng"
                stroke="#f43f5e"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cogs"
                name="Tổng giá vốn"
                stroke="#f97316"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Lợi nhuận gộp"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── Phân tích theo tabs ────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-slate-700 mr-2">Phân tích theo</span>
            {TAB_CONFIG.map(t => (
              <button
                key={t.id}
                onClick={() => setAnalysisTab(t.id)}
                className={`px-4 py-1.5 rounded-none text-[13px] transition-colors border-b-2 ${
                  analysisTab === t.id
                    ? 'border-blue-600 text-blue-600 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Top 10 nhóm hàng */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Top 10 nhóm hàng</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left pl-5 pr-4 py-2.5 text-[12px] font-medium text-slate-500">
                    Tên nhóm hàng
                  </th>
                  <th className="text-right px-4 py-2.5 text-[12px] font-medium text-slate-500">
                    {colLabel}
                  </th>
                  <th className="text-right px-4 py-2.5 text-[12px] font-medium text-slate-500">
                    {isOrderTab ? 'Số lượng TB/ngày' : `${colLabel} TB/đơn`}
                  </th>
                  <th className="text-right pr-5 pl-4 py-2.5 text-[12px] font-medium text-slate-500">
                    So với kỳ trước
                  </th>
                </tr>
              </thead>
              <tbody>
                {top10Groups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 text-sm">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  top10Groups.map((g, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="pl-5 pr-4 py-3 text-[13px] text-slate-700 font-medium">
                        {g.name}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-700 text-right">
                        {fmt(g.curr)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500 text-right">
                        {fmt(g.avgPerUnit)}
                      </td>
                      <td className="pr-5 pl-4 py-3 text-right">
                        <PctBadge pct={g.pct} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Top 10 hàng hóa */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Top 10 hàng hóa</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left pl-5 pr-4 py-2.5 text-[12px] font-medium text-slate-500">
                    Tên hàng hóa
                  </th>
                  <th className="text-right px-4 py-2.5 text-[12px] font-medium text-slate-500">
                    {colLabel}
                  </th>
                  <th className="text-right px-4 py-2.5 text-[12px] font-medium text-slate-500">
                    {isOrderTab ? 'Số lượng' : `${colLabel} TB/đơn`}
                  </th>
                  <th className="text-right pr-5 pl-4 py-2.5 text-[12px] font-medium text-slate-500">
                    So với kỳ trước
                  </th>
                </tr>
              </thead>
              <tbody>
                {top10Products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 text-sm">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  top10Products.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="pl-5 pr-4 py-3 text-[13px] text-slate-700 font-medium">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-700 text-right">
                        {fmt(p.curr)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500 text-right">
                        {fmt(p.avgPerUnit)}
                      </td>
                      <td className="pr-5 pl-4 py-3 text-right">
                        <PctBadge pct={p.pct} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── AI Panel ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-indigo-600">
              <BrainCircuit className="w-4 h-4" />
              <span className="text-[13px] font-medium">AI CFO · Phân tích kinh doanh</span>
            </div>
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-medium hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              )}
              {isAnalyzing ? 'Đang phân tích...' : 'Chạy phân tích AI'}
            </button>
          </div>
          <div className="p-6 min-h-[160px]">
            {analysisResult ? (
              <div
                className="markdown-content text-slate-700 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(marked.parse(analysisResult) as string),
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center opacity-40 gap-3">
                <Lightbulb className="w-7 h-7 text-slate-400" />
                <p className="text-[12px] text-slate-500">
                  Nhấn "Chạy phân tích AI" để nhận nhận xét từ CFO AI
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisBusinessPage;
