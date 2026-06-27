import React, { useState, useMemo } from 'react';
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
import type {
  AppData,
  DailyBreakEvenConfig,
  DashboardBreakEvenAnalysis,
  DiagnosisRange,
} from '../../types';
import { calculateTimeContext } from '../../src/lib';
import TimeFilter from '../TimeFilter';

interface Props {
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

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDateKey = (date: Date) => date.toLocaleDateString('sv-SE');

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const splitCategoryPath = (value: string) =>
  String(value).split(/\s*(?:>>|>|\/)\s*/g).map(part => part.trim()).filter(Boolean);

const getPrimaryGroupName = (categoryPath: string) => splitCategoryPath(categoryPath)[0] || 'Chưa phân loại';

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
    case 'revenue': return g.revenue;
    case 'returns': return g.returns;
    case 'net': return g.net;
    case 'profit': return g.net - g.cogs;
    case 'orders': return g.qty;
  }
};

const PctBadge: React.FC<{ pct: number | null; invert?: boolean }> = ({ pct, invert = false }) => {
  if (pct === null) return <span className="text-slate-400 text-xs">—</span>;
  const positive = invert ? pct < 0 : pct > 0;
  const color = positive ? 'text-emerald-600' : pct === 0 ? 'text-slate-400' : 'text-rose-500';
  const sign = pct > 0 ? '+' : '';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {sign}{pct.toFixed(2)}%
    </span>
  );
};

// ─── Main component ────────────────────────────────────────────
const AnalysisBusinessPage: React.FC<Props> = ({
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
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('revenue');
  const [groupMode, setGroupMode] = useState<'collapsed' | 'expanded'>('collapsed');

  // ── Time context (shared for KPI/Trends/Structure/AI/Business tabs) ──────
  const timeContext = useMemo(
    () => calculateTimeContext(diagnosisRange, diagStartDate, diagEndDate),
    [diagnosisRange, diagStartDate, diagEndDate]
  );

  // ── Business tab: cards + chart + group/product stats ─────────────────────
  const { cards, chartData, productStats } = useMemo(() => {
    const startDate = timeContext.start;
    const endDate = timeContext.end;

    const startD = new Date(startDate);
    const endD = new Date(endDate);
    const days = Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1;
    const prevEnd = new Date(startD.getTime() - 86_400_000);
    const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
    const prevStartStr = prevStart.toLocaleDateString('sv-SE');
    const prevEndStr = prevEnd.toLocaleDateString('sv-SE');

    const inCurr = (d: string) => d >= startDate && d <= endDate;
    const inPrev = (d: string) => d >= prevStartStr && d <= prevEndStr;

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

    const currOrders = (data.posOrders || []).filter(o => !o.isReturn && inCurr(o.date)).length;
    const prevOrders = (data.posOrders || []).filter(o => !o.isReturn && inPrev(o.date)).length;

    const chg = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null);

    const cards = [
      { label: 'Số hóa đơn', value: currOrders, display: currOrders.toLocaleString('vi-VN'), avg: days > 0 ? Math.round(currOrders / days) : 0, pct: chg(currOrders, prevOrders), invert: false, unit: '' },
      { label: 'Doanh thu', value: curr.gross, display: fmtBig(curr.gross), avg: days > 0 ? curr.gross / days : 0, pct: chg(curr.gross, prev.gross), invert: false, unit: 'đ' },
      { label: 'Giá trị trả', value: curr.returns, display: fmtBig(curr.returns), avg: days > 0 ? curr.returns / days : 0, pct: chg(curr.returns, prev.returns), invert: true, unit: 'đ' },
      { label: 'Doanh thu thuần', value: curr.net, display: fmtBig(curr.net), avg: days > 0 ? curr.net / days : 0, pct: chg(curr.net, prev.net), invert: false, unit: 'đ' },
      { label: 'Tổng giá vốn', value: curr.cogs, display: fmtBig(curr.cogs), avg: days > 0 ? curr.cogs / days : 0, pct: chg(curr.cogs, prev.cogs), invert: true, unit: 'đ' },
      { label: 'Lợi nhuận gộp', value: curr.profit, display: fmtBig(curr.profit), avg: days > 0 ? curr.profit / days : 0, pct: chg(curr.profit, prev.profit), invert: false, unit: 'đ' },
    ];

    const dateSet = new Set(currRev.map(r => r.date));
    const chartData = Array.from(dateSet).sort().map(date => {
      const recs = currRev.filter(r => r.date === date);
      return {
        date: date.slice(5).replace('-', '/'),
        revenue: recs.reduce((s, r) => s + r.totalGrossRevenue, 0),
        returns: recs.reduce((s, r) => s + r.returnsValue, 0),
        net: recs.reduce((s, r) => s + r.netRevenue, 0),
        cogs: recs.reduce((s, r) => s + r.totalCogs, 0),
        profit: recs.reduce((s, r) => s + r.grossProfit, 0),
      };
    });

    const productMap = new Map((data.posProducts || []).map(p => [p.id, p]));

    const pMap = new Map<string, { name: string; catPath: string; revenue: number; qty: number; retQty: number; retRevenue: number; profit: number; cogs: number }>();
    const pPrevMap = new Map<string, { revenue: number; qty: number; retRevenue: number; cogs: number }>();

    (data.posOrders || []).forEach(o => {
      const inC = inCurr(o.date);
      const inP = inPrev(o.date);
      if (!inC && !inP) return;
      (o.items || []).forEach(item => {
        const prod = productMap.get(item.productId);
        const importPrice = prod?.importPrice ?? 0;
        const catPath = prod?.categoryPath || prod?.categoryId || '';

        if (inC && !o.isReturn) {
          const p = pMap.get(item.productId) ?? { name: item.name, catPath, revenue: 0, qty: 0, retQty: 0, retRevenue: 0, profit: 0, cogs: 0 };
          pMap.set(item.productId, { name: item.name, catPath, revenue: p.revenue + item.total, qty: p.qty + item.quantity, retQty: p.retQty, retRevenue: p.retRevenue, profit: p.profit + (item.price - importPrice) * item.quantity - item.discount, cogs: p.cogs + importPrice * item.quantity });
        }
        if (inC && o.isReturn) {
          const p = pMap.get(item.productId);
          if (p) pMap.set(item.productId, { ...p, retQty: p.retQty + item.quantity, retRevenue: p.retRevenue + item.total });
        }
        if (inP && !o.isReturn) {
          const p = pPrevMap.get(item.productId) ?? { revenue: 0, qty: 0, retRevenue: 0, cogs: 0 };
          pPrevMap.set(item.productId, { revenue: p.revenue + item.total, qty: p.qty + item.quantity, retRevenue: p.retRevenue, cogs: p.cogs + importPrice * item.quantity });
        }
        if (inP && o.isReturn) {
          const p = pPrevMap.get(item.productId) ?? { revenue: 0, qty: 0, retRevenue: 0, cogs: 0 };
          pPrevMap.set(item.productId, { ...p, retRevenue: p.retRevenue + item.total });
        }
      });
    });

    const productStats = Array.from(pMap.entries()).map(([id, curr]) => ({
      id,
      ...curr,
      prevRevenue: pPrevMap.get(id)?.revenue ?? 0,
      prevRetRevenue: pPrevMap.get(id)?.retRevenue ?? 0,
      prevCogs: pPrevMap.get(id)?.cogs ?? 0,
    }));

    return { cards, chartData, productStats };
  }, [data, timeContext]);

  const strategicForecast = useMemo(() => {
    const startDate = timeContext.start;
    const endDate = timeContext.end;
    const startD = new Date(startDate);
    const endD = new Date(endDate);
    const days = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1);
    const nextDays = clamp(days, 7, 30);
    const prevEnd = addDays(startD, -1);
    const prevStart = addDays(prevEnd, -(days - 1));
    const nextStart = addDays(endD, 1);

    const prevStartStr = toDateKey(prevStart);
    const prevEndStr = toDateKey(prevEnd);
    const inCurr = (date: string) => date >= startDate && date <= endDate;
    const inPrev = (date: string) => date >= prevStartStr && date <= prevEndStr;

    const allRev = [...(data.revenue || []), ...(data.shopeeRevenue || [])];
    const currRev = allRev.filter(record => inCurr(record.date));
    const prevRev = allRev.filter(record => inPrev(record.date));
    const currOrders = (data.posOrders || []).filter(order => !order.isReturn && inCurr(order.date)).length;
    const prevOrders = (data.posOrders || []).filter(order => !order.isReturn && inPrev(order.date)).length;

    const sumRev = (records: typeof currRev) => ({
      gross: records.reduce((sum, record) => sum + record.totalGrossRevenue, 0),
      returns: records.reduce((sum, record) => sum + record.returnsValue, 0),
      net: records.reduce((sum, record) => sum + record.netRevenue, 0),
      profit: records.reduce((sum, record) => sum + record.grossProfit, 0),
    });

    const curr = sumRev(currRev);
    const prev = sumRev(prevRev);
    const changePct = prev.gross > 0 ? ((curr.gross - prev.gross) / prev.gross) * 100 : null;
    const trendFactor = changePct === null ? 1 : clamp(1 + changePct / 100, 0.65, 1.45);
    const forecastFactor = nextDays * trendFactor;
    const dailyRevenue = curr.gross / days;
    const dailyProfit = curr.profit / days;
    const dailyOrders = currOrders / days;
    const dailyReturns = curr.returns / days;
    const actualDayCount = new Set(currRev.map(record => record.date)).size;
    const hasEnoughData = actualDayCount >= 3 && curr.gross > 0;

    const projectedRevenue = hasEnoughData ? dailyRevenue * forecastFactor : 0;
    const projectedProfit = hasEnoughData ? dailyProfit * forecastFactor : 0;
    const projectedOrders = hasEnoughData ? dailyOrders * forecastFactor : 0;
    const projectedReturns = hasEnoughData ? dailyReturns * forecastFactor : 0;
    const projectedRevenueChange =
      curr.gross > 0 && hasEnoughData ? ((projectedRevenue - curr.gross) / curr.gross) * 100 : null;

    const status =
      !hasEnoughData
        ? { label: 'Thiếu dữ liệu', className: 'bg-slate-100 text-slate-500' }
        : changePct === null
          ? { label: 'Ổn định', className: 'bg-slate-100 text-slate-600' }
          : changePct >= 8
            ? { label: 'Tăng trưởng', className: 'bg-emerald-50 text-emerald-600' }
            : changePct <= -8
              ? { label: 'Giảm tốc', className: 'bg-rose-50 text-rose-600' }
              : { label: 'Ổn định', className: 'bg-blue-50 text-blue-600' };

    const actualByDate = new Map<string, number>();
    currRev.forEach(record => {
      actualByDate.set(record.date, (actualByDate.get(record.date) || 0) + record.totalGrossRevenue);
    });

    const actualPoints = Array.from({ length: Math.min(days, 31) }, (_, index) => {
      const key = toDateKey(addDays(startD, index));
      return {
        date: key.slice(5).replace('-', '/'),
        actual: actualByDate.get(key) || 0,
        forecast: null as number | null,
      };
    });

    const forecastDailyRevenue = hasEnoughData ? projectedRevenue / nextDays : 0;
    const forecastPoints = Array.from({ length: nextDays }, (_, index) => {
      const key = toDateKey(addDays(nextStart, index));
      return {
        date: key.slice(5).replace('-', '/'),
        actual: null as number | null,
        forecast: forecastDailyRevenue,
      };
    });

    return {
      hasEnoughData,
      nextDays,
      status,
      changePct,
      projectedRevenue,
      projectedProfit,
      projectedOrders,
      projectedReturns,
      projectedRevenueChange,
      previousRevenue: prev.gross,
      chart: [...actualPoints, ...forecastPoints],
      breakEvenGap:
        breakEvenAnalysis && projectedRevenue > 0
          ? projectedRevenue -
            ((breakEvenAnalysis.avgGrossMargin > 0
              ? breakEvenAnalysis.dailyFixedCost / breakEvenAnalysis.avgGrossMargin
              : 0) *
              nextDays)
          : null,
    };
  }, [breakEvenAnalysis, data, timeContext]);

  const seasonalGroupForecast = useMemo(() => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const targetMonth = target.getMonth();
    const targetYear = target.getFullYear();
    const targetMonthLabel = `Tháng ${targetMonth + 1}/${targetYear}`;
    const productMap = new Map((data.posProducts || []).map(product => [product.id, product]));
    const groups = new Map<
      string,
      { name: string; revenue: number; qty: number; profit: number; years: Set<number>; lastYearRevenue: number }
    >();

    (data.posOrders || []).forEach(order => {
      if (order.isReturn) return;
      const orderDate = new Date(order.date);
      if (Number.isNaN(orderDate.getTime())) return;
      const orderYear = orderDate.getFullYear();
      if (orderDate.getMonth() !== targetMonth || orderYear >= targetYear) return;

      (order.items || []).forEach(item => {
        const product = productMap.get(item.productId);
        const groupName = getPrimaryGroupName(product?.categoryPath || product?.categoryId || '');
        const importPrice = product?.importPrice || 0;
        const current = groups.get(groupName) ?? {
          name: groupName,
          revenue: 0,
          qty: 0,
          profit: 0,
          years: new Set<number>(),
          lastYearRevenue: 0,
        };
        const itemProfit = (item.price - importPrice) * item.quantity - item.discount;
        current.revenue += item.total;
        current.qty += item.quantity;
        current.profit += itemProfit;
        current.years.add(orderYear);
        if (orderYear === targetYear - 1) current.lastYearRevenue += item.total;
        groups.set(groupName, current);
      });
    });

    const sourceYearCount = new Set(
      Array.from(groups.values()).flatMap(group => Array.from(group.years))
    ).size;

    const rows = Array.from(groups.values())
      .map(group => {
        const years = group.years.size;
        const avgRevenue = years > 0 ? group.revenue / years : 0;
        const avgQty = years > 0 ? group.qty / years : 0;
        const margin = group.revenue > 0 ? (group.profit / group.revenue) * 100 : 0;
        const score = avgRevenue * (1 + Math.min(years, 3) * 0.12) + group.lastYearRevenue * 0.2;
        const suggestion =
          years >= 2 && margin >= 25
            ? 'Ưu tiên nhập'
            : years >= 2
              ? 'Giữ tồn kho'
              : group.lastYearRevenue > 0
                ? 'Theo dõi thêm'
                : 'Kiểm tra nhu cầu';
        return { ...group, years, avgRevenue, avgQty, margin, score, suggestion };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      targetMonthLabel,
      rows,
      sourceYearCount,
    };
  }, [data.posOrders, data.posProducts]);

  const groupStats = useMemo(() => {
    const getKey = (catPath: string) => {
      const parts = splitCategoryPath(catPath);
      if (parts.length === 0) return 'Chưa phân loại';
      if (groupMode === 'collapsed' || parts.length < 2) return parts[0];
      return `${parts[0]} >> ${parts[1]}`;
    };
    const currMap = new Map<string, GroupStat>();
    const prevMap = new Map<string, GroupStat>();
    productStats.forEach(p => {
      const key = getKey(p.catPath);
      const cg = currMap.get(key) ?? { id: key, name: key, revenue: 0, returns: 0, net: 0, cogs: 0, qty: 0 };
      currMap.set(key, { ...cg, revenue: cg.revenue + p.revenue, returns: cg.returns + p.retRevenue, net: cg.net + p.revenue - p.retRevenue, cogs: cg.cogs + p.cogs, qty: cg.qty + p.qty - p.retQty });
      if (p.prevRevenue > 0 || p.prevRetRevenue > 0) {
        const pg = prevMap.get(key) ?? { id: key, name: key, revenue: 0, returns: 0, net: 0, cogs: 0, qty: 0 };
        prevMap.set(key, { ...pg, revenue: pg.revenue + p.prevRevenue, returns: pg.returns + p.prevRetRevenue, net: pg.net + p.prevRevenue - p.prevRetRevenue, cogs: pg.cogs + p.prevCogs, qty: pg.qty });
      }
    });
    return Array.from(currMap.values()).map(g => ({ ...g, prevGroup: prevMap.get(g.id) ?? null }));
  }, [productStats, groupMode]);

  const top10Groups = useMemo(() => {
    return [...groupStats].sort((a, b) => getGroupVal(b, analysisTab) - getGroupVal(a, analysisTab)).slice(0, 10).map(g => {
      const curr = getGroupVal(g, analysisTab);
      const prevVal = g.prevGroup ? getGroupVal(g.prevGroup, analysisTab) : 0;
      const pct = prevVal > 0 ? ((curr - prevVal) / prevVal) * 100 : null;
      const avgPerUnit = analysisTab === 'orders' ? 0 : (g.qty > 0 ? curr / g.qty : 0);
      return { ...g, curr, pct, avgPerUnit };
    });
  }, [groupStats, analysisTab]);

  const top10Products = useMemo(() => {
    return [...productStats].sort((a, b) => {
      if (analysisTab === 'profit') return b.profit - a.profit;
      if (analysisTab === 'orders') return (b.qty - b.retQty) - (a.qty - a.retQty);
      if (analysisTab === 'returns') return b.retRevenue - a.retRevenue;
      if (analysisTab === 'net') return (b.revenue - b.retRevenue) - (a.revenue - a.retRevenue);
      return b.revenue - a.revenue;
    }).slice(0, 10).map(p => {
      const netRevenue = p.revenue - p.retRevenue;
      const netQty = p.qty - p.retQty;
      let curr: number;
      let prevCurr: number;
      if (analysisTab === 'profit') { curr = p.profit; prevCurr = 0; }
      else if (analysisTab === 'orders') { curr = netQty; prevCurr = 0; }
      else if (analysisTab === 'returns') { curr = p.retRevenue; prevCurr = p.prevRetRevenue; }
      else if (analysisTab === 'net') { curr = netRevenue; prevCurr = p.prevRevenue - p.prevRetRevenue; }
      else { curr = p.revenue; prevCurr = p.prevRevenue; }
      const pct = prevCurr > 0 ? ((curr - prevCurr) / prevCurr) * 100 : null;
      const avgPerUnit = analysisTab === 'orders' ? 0 : (p.qty > 0 ? curr / p.qty : 0);
      return { ...p, curr, pct, avgPerUnit };
    });
  }, [productStats, analysisTab]);

  const colLabel = TAB_CONFIG.find(t => t.id === analysisTab)?.label ?? 'Doanh thu';
  const isOrderTab = analysisTab === 'orders';

  const strategicActions = useMemo(() => {
    if (!strategicForecast.hasEnoughData) {
      return [
        'Cần tối thiểu 3 ngày có doanh thu trong kỳ để dự báo ổn định hơn.',
        'Hãy kiểm tra lại dữ liệu bán hàng và trả hàng trước khi ra quyết định nhập hàng.',
        'Tiếp tục theo dõi doanh thu theo ngày để xác định xu hướng kỳ tới.',
      ];
    }

    const actions: string[] = [];
    const topGroup = top10Groups[0];
    const topProduct = top10Products[0];
    if (topGroup) {
      actions.push(`Ưu tiên nguồn lực cho nhóm "${topGroup.name}" vì đang dẫn đầu theo ${colLabel.toLowerCase()}.`);
    }
    if (topProduct) {
      actions.push(`Theo dõi tồn kho của "${topProduct.name}" để tránh thiếu hàng nếu tốc độ bán giữ nguyên.`);
    }
    if (strategicForecast.changePct !== null && strategicForecast.changePct < -8) {
      actions.push('Doanh thu đang giảm tốc so với kỳ trước, cần rà soát chương trình bán hàng và nhóm hàng sụt giảm.');
    } else if (strategicForecast.changePct !== null && strategicForecast.changePct >= 8) {
      actions.push('Xu hướng đang tăng, có thể giữ nhịp nhập hàng và ưu tiên sản phẩm biên lợi nhuận tốt.');
    } else {
      actions.push('Xu hướng tương đối ổn định, nên tối ưu biên lợi nhuận thay vì chỉ tăng doanh số.');
    }
    if (strategicForecast.breakEvenGap !== null) {
      actions.push(
        strategicForecast.breakEvenGap >= 0
          ? 'Dự báo kỳ tới đang vượt mức hòa vốn, tiếp tục kiểm soát chi phí để giữ biên lợi nhuận.'
          : 'Dự báo kỳ tới thấp hơn mức hòa vốn, cần tăng doanh thu/ngày hoặc giảm chi phí cố định.'
      );
    }
    return actions.slice(0, 4);
  }, [colLabel, strategicForecast, top10Groups, top10Products]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="flex min-h-[58px] items-center justify-end border-b border-slate-100 bg-slate-50 px-4 shrink-0">
        <TimeFilter
          diagnosisRange={diagnosisRange}
          setDiagnosisRange={setDiagnosisRange}
          diagStartDate={diagStartDate}
          setDiagStartDate={setDiagStartDate}
          diagEndDate={diagEndDate}
          setDiagEndDate={setDiagEndDate}
          variant="range"
        />
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      <div className="flex-1 p-6">
        <div className="flex flex-col gap-5">
            {/* 6 KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
              {cards.map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
                  <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mb-2">{card.display}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Trung bình/ngày{' '}
                      <span className="ml-1 text-slate-600 font-medium">
                        {card.unit ? fmtBig(card.avg) : Math.round(card.avg).toLocaleString('vi-VN')}
                      </span>
                    </span>
                    <span>So với kỳ trước <PctBadge pct={card.pct} invert={card.invert} /></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Strategic forecast */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-700">Dự báo chiến lược</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kỳ tới {strategicForecast.nextDays} ngày, dựa trên kỳ đang chọn và kỳ liền trước
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${strategicForecast.status.className}`}>
                  {strategicForecast.status.label}
                </span>
              </div>

              <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                {[
                  {
                    label: 'Doanh thu dự kiến',
                    value: strategicForecast.hasEnoughData ? fmtBig(strategicForecast.projectedRevenue) : '—',
                    pct: strategicForecast.projectedRevenueChange,
                    invert: false,
                  },
                  {
                    label: 'Lợi nhuận gộp dự kiến',
                    value: strategicForecast.hasEnoughData ? fmtBig(strategicForecast.projectedProfit) : '—',
                    pct: strategicForecast.previousRevenue > 0 ? strategicForecast.changePct : null,
                    invert: false,
                  },
                  {
                    label: 'Số hóa đơn dự kiến',
                    value: strategicForecast.hasEnoughData ? Math.round(strategicForecast.projectedOrders).toLocaleString('vi-VN') : '—',
                    pct: strategicForecast.changePct,
                    invert: false,
                  },
                  {
                    label: 'Trả hàng dự kiến',
                    value: strategicForecast.hasEnoughData ? fmtBig(strategicForecast.projectedReturns) : '—',
                    pct: strategicForecast.changePct,
                    invert: true,
                  },
                ].map(item => (
                  <div key={item.label} className="px-5 py-4">
                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                    <p className="text-xl font-bold text-slate-800 mb-2">{item.value}</p>
                    <div className="text-xs text-slate-400">
                      So với kỳ hiện tại <PctBadge pct={item.pct} invert={item.invert} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[1.35fr_1fr] divide-x divide-slate-100">
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-600">Thực tế và dự báo doanh thu/ngày</span>
                    {strategicForecast.breakEvenGap !== null && (
                      <span className={`text-xs font-medium ${strategicForecast.breakEvenGap >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {strategicForecast.breakEvenGap >= 0 ? 'Vượt hòa vốn' : 'Dưới hòa vốn'} {fmtBig(Math.abs(strategicForecast.breakEvenGap))}
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={170}>
                    <LineChart data={strategicForecast.chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip formatter={(v: number) => fmt(v) + 'đ'} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="actual" name="Thực tế" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="forecast" name="Dự báo" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="px-5 py-4">
                  <span className="text-xs font-semibold text-slate-600 block mb-3">Gợi ý hành động</span>
                  <div className="space-y-2.5">
                    {strategicActions.map((action, index) => (
                      <div key={index} className="flex gap-2 text-xs leading-5 text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-600">
                      Nhóm hàng dự kiến bán chạy tháng sau
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {seasonalGroupForecast.targetMonthLabel} · tổng hợp cùng tháng từ các năm trước
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-400">
                    {seasonalGroupForecast.sourceYearCount > 0
                      ? `${seasonalGroupForecast.sourceYearCount} năm dữ liệu`
                      : 'Chưa có dữ liệu lịch sử'}
                  </span>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">Nhóm hàng</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Doanh thu lịch sử</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">SL bán TB/năm</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Số năm</th>
                      <th className="text-left pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">Gợi ý chuẩn bị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonalGroupForecast.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                          Chưa đủ dữ liệu cùng tháng các năm trước để xếp hạng nhóm hàng.
                        </td>
                      </tr>
                    ) : (
                      seasonalGroupForecast.rows.map(group => (
                        <tr key={group.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="pl-5 pr-4 py-3 text-sm text-slate-700 font-medium">{group.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 text-right">{fmtBig(group.avgRevenue)}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 text-right">{fmt(group.avgQty)}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 text-right">{group.years}</td>
                          <td className="pr-5 pl-4 py-3 text-xs text-slate-600">{group.suggestion}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Line chart */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <span className="text-sm font-semibold text-slate-700 block mb-4">Chỉ số kinh doanh</span>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(v: number) => fmt(v) + 'đ'} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="returns" name="Trả hàng" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="net" name="Doanh thu thuần" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cogs" name="Tổng giá vốn" stroke="#f97316" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="profit" name="Lợi nhuận gộp" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Analysis tabs */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-slate-700 mr-2">Phân tích theo</span>
                {TAB_CONFIG.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAnalysisTab(t.id)}
                    className={`px-4 py-1.5 rounded-none text-sm transition-colors border-b-2 ${
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
                  <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                    {(['collapsed', 'expanded'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setGroupMode(mode)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          groupMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {mode === 'collapsed' ? 'Gộp' : 'Tách'}
                      </button>
                    ))}
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">Tên nhóm hàng</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">{colLabel}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">{isOrderTab ? 'Số lượng TB/ngày' : `${colLabel} TB/đơn`}</th>
                      <th className="text-right pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">So với kỳ trước</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Groups.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Không có dữ liệu</td></tr>
                    ) : (
                      top10Groups.map((g, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="pl-5 pr-4 py-3 text-sm text-slate-700 font-medium">{g.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 text-right">{fmt(g.curr)}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 text-right">{fmt(g.avgPerUnit)}</td>
                          <td className="pr-5 pl-4 py-3 text-right"><PctBadge pct={g.pct} /></td>
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
                      <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">Tên hàng hóa</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">{colLabel}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">{isOrderTab ? 'Số lượng' : `${colLabel} TB/đơn`}</th>
                      <th className="text-right pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">So với kỳ trước</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Products.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Không có dữ liệu</td></tr>
                    ) : (
                      top10Products.map((p, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="pl-5 pr-4 py-3 text-sm text-slate-700 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 text-right">{fmt(p.curr)}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 text-right">{fmt(p.avgPerUnit)}</td>
                          <td className="pr-5 pl-4 py-3 text-right"><PctBadge pct={p.pct} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default AnalysisBusinessPage;
