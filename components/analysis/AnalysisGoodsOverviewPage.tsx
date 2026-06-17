import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import type { AppData } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';
import { calcOrderRevenue } from '../../src/lib/reportCalculations';
import { usePosOrders } from '../../hooks/usePosOrders';
import {
  getLatestOrderDate,
  hasOrdersInDateRange,
  toDateInputValue,
} from '../reports/reportDateDefaults';

interface Props {
  data: AppData;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtAvg = (n: number) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(2) + ' triệu'
    : n >= 1_000
      ? (n / 1_000).toFixed(1) + ' nghìn'
      : n.toFixed(0);

type GroupMetric = 'qty' | 'revenue' | 'profit';
type SpeedTab = 'fast' | 'slow';

const getMonthRange = (anchorDate = new Date()) => {
  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
};

const MiniSparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={44}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const METRIC_TABS: { id: GroupMetric; label: string }[] = [
  { id: 'qty', label: 'Theo số lượng bán' },
  { id: 'revenue', label: 'Theo doanh thu thuần' },
  { id: 'profit', label: 'Theo lợi nhuận gộp' },
];

const AnalysisGoodsOverviewPage: React.FC<Props> = ({ data }) => {
  const initialRange = useMemo(() => getMonthRange(), []);

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [userChangedRange, setUserChangedRange] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [groupTab, setGroupTab] = useState<SpeedTab>('fast');
  const [groupMetric, setGroupMetric] = useState<GroupMetric>('qty');
  const [productTab, setProductTab] = useState<SpeedTab>('fast');
  const [productMetric, setProductMetric] = useState<GroupMetric>('qty');
  const { orders, isLoading: ordersLoading } = usePosOrders(data.posOrders || [], startDate, endDate);

  useEffect(() => {
    if (userChangedRange) return;
    const bootstrapOrders = data.posOrders || [];
    if (bootstrapOrders.length === 0 || hasOrdersInDateRange(bootstrapOrders, startDate, endDate)) return;
    const latestDate = getLatestOrderDate(bootstrapOrders);
    if (!latestDate) return;
    const nextRange = getMonthRange(new Date(`${latestDate}T00:00:00`));
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
  }, [data.posOrders, endDate, startDate, userChangedRange]);

  const groupStats = useMemo(() => {
    const productMap = new Map((data.posProducts || []).map(p => [p.id, p]));

    const splitPath = (s: string) =>
      String(s).split(/\s*(?:>>|>|\/)\s*/g).map(p => p.trim()).filter(Boolean);
    const getGroupName = (catPath: string) => {
      const parts = splitPath(catPath);
      return parts.length > 0 ? parts[0] : 'Chưa phân loại';
    };

    const map = new Map<string, { name: string; qty: number; retQty: number; revenue: number; profit: number }>();

    (orders || []).forEach(o => {
      const orderDate = toDateInputValue(new Date(o.date));
      if (orderDate < startDate || orderDate > endDate) return;
      o.items.forEach(item => {
        const prod = productMap.get(item.productId);
        const groupName = getGroupName(prod?.categoryPath || prod?.categoryId || '');
        const importPrice = prod?.importPrice ?? 0;
        const gp = (item.price - importPrice) * item.quantity - item.discount;
        const prev = map.get(groupName) ?? { name: groupName, qty: 0, retQty: 0, revenue: 0, profit: 0 };
        if (o.isReturn) {
          map.set(groupName, { ...prev, retQty: prev.retQty + item.quantity });
        } else {
          map.set(groupName, {
            name: groupName,
            qty: prev.qty + item.quantity,
            retQty: prev.retQty,
            revenue: prev.revenue + item.total,
            profit: prev.profit + gp,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [orders, data.posProducts, startDate, endDate]);

  // --- Compute from posOrders ---
  const { productStats, cards, dailyRevenue } = useMemo(() => {
    const productMap = new Map((data.posProducts || []).map(p => [p.id, p]));

    const salesOrders = (orders || []).filter(
      o => {
        const orderDate = toDateInputValue(new Date(o.date));
        return !o.isReturn && orderDate >= startDate && orderDate <= endDate;
      }
    );
    const returnOrders = (orders || []).filter(
      o => {
        const orderDate = toDateInputValue(new Date(o.date));
        return o.isReturn && orderDate >= startDate && orderDate <= endDate;
      }
    );

    // Daily revenue for sparkline
    const dailyMap = new Map<string, number>();
    salesOrders.forEach(o => {
      const orderDate = toDateInputValue(new Date(o.date));
      dailyMap.set(orderDate, (dailyMap.get(orderDate) ?? 0) + calcOrderRevenue(o));
    });
    const sortedDays = Array.from(dailyMap.keys()).sort();
    const dailyRevenue = sortedDays.map(d => dailyMap.get(d) ?? 0);

    // Per-product stats
    const pMap = new Map<
      string,
      { name: string; soldQty: number; retQty: number; revenue: number; profit: number }
    >();

    salesOrders.forEach(o => {
      o.items.forEach(item => {
        const prod = productMap.get(item.productId);
        const importPrice = prod?.importPrice ?? 0;
        const gp = (item.price - importPrice) * item.quantity - item.discount;
        const prev = pMap.get(item.productId) ?? {
          name: item.name,
          soldQty: 0,
          retQty: 0,
          revenue: 0,
          profit: 0,
        };
        pMap.set(item.productId, {
          name: item.name,
          soldQty: prev.soldQty + item.quantity,
          retQty: prev.retQty,
          revenue: prev.revenue + item.total,
          profit: prev.profit + gp,
        });
      });
    });

    returnOrders.forEach(o => {
      o.items.forEach(item => {
        const prev = pMap.get(item.productId);
        if (prev) pMap.set(item.productId, { ...prev, retQty: prev.retQty + item.quantity });
      });
    });

    const productStats = Array.from(pMap.values());
    const uniqueSkus = pMap.size;
    const totalQty = productStats.reduce((s, p) => s + p.soldQty - p.retQty, 0);
    const totalRevenue = productStats.reduce((s, p) => s + p.revenue, 0);
    const totalProfit = productStats.reduce((s, p) => s + p.profit, 0);

    return {
      productStats,
      dailyRevenue,
      cards: {
        uniqueSkus,
        totalQty,
        avgRevPerSku: uniqueSkus > 0 ? totalRevenue / uniqueSkus : 0,
        avgProfitPerSku: uniqueSkus > 0 ? totalProfit / uniqueSkus : 0,
      },
    };
  }, [orders, data.posProducts, startDate, endDate]);

  const sortedGroups = useMemo(() => {
    const sorted = [...groupStats].sort((a, b) => {
      if (groupMetric === 'qty') return b.qty - b.retQty - (a.qty - a.retQty);
      if (groupMetric === 'revenue') return b.revenue - a.revenue;
      return b.profit - a.profit;
    });
    return groupTab === 'fast' ? sorted.slice(0, 10) : sorted.reverse().slice(0, 10);
  }, [groupStats, groupTab, groupMetric]);

  const sortedProducts = useMemo(() => {
    const sorted = [...productStats].sort((a, b) => {
      if (productMetric === 'qty') return b.soldQty - b.retQty - (a.soldQty - a.retQty);
      if (productMetric === 'revenue') return b.revenue - a.revenue;
      return b.profit - a.profit;
    });
    return productTab === 'fast' ? sorted.slice(0, 10) : sorted.reverse().slice(0, 10);
  }, [productStats, productTab, productMetric]);

  const CARDS = [
    {
      label: 'Số mặt hàng đã bán',
      value: cards.uniqueSkus.toLocaleString('vi-VN'),
      sparkValues: dailyRevenue.map(() => cards.uniqueSkus),
      color: '#3b82f6',
    },
    {
      label: 'Số lượng thực bán',
      value: cards.totalQty.toLocaleString('vi-VN'),
      sparkValues: dailyRevenue,
      color: '#3b82f6',
    },
    {
      label: 'Doanh thu thuần TB/SP',
      value: fmtAvg(cards.avgRevPerSku),
      sparkValues: dailyRevenue,
      color: '#3b82f6',
    },
    {
      label: 'Lợi nhuận gộp TB/SP',
      value: fmtAvg(cards.avgProfitPerSku),
      sparkValues: dailyRevenue,
      color: '#3b82f6',
    },
  ];

  const handleAiRun = async () => {
    const contextData = {
      period: `${startDate} đến ${endDate}`,
      uniqueSkus: cards.uniqueSkus,
      totalQty: cards.totalQty,
      topFastGroups: [...groupStats].sort((a, b) => b.qty - a.qty).slice(0, 5).map(g => ({ name: g.name, qty: g.qty, revenue: g.revenue })),
      topSlowGroups: [...groupStats].sort((a, b) => a.qty - b.qty).slice(0, 5).map(g => ({ name: g.name, qty: g.qty, revenue: g.revenue })),
      topFastProducts: [...productStats].sort((a, b) => b.soldQty - a.soldQty).slice(0, 5).map(p => ({ name: p.name, soldQty: p.soldQty, revenue: p.revenue })),
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('goods-overview', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/goods-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('goods-overview', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <h1 className="text-base font-semibold text-slate-800">Tổng quan hàng hóa</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => {
              setUserChangedRange(true);
              setStartDate(e.target.value);
            }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-slate-400 text-sm">-</span>
          <input
            type="date"
            value={endDate}
            onChange={e => {
              setUserChangedRange(true);
              setEndDate(e.target.value);
            }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-6">
        {/* 4 Cards */}
        <div className="grid grid-cols-4 gap-4">
          {CARDS.map(card => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 pt-4 pb-2"
            >
              <p className="text-xs text-slate-500 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-slate-800">{card.value}</p>
              {card.sparkValues.length > 1 && (
                <MiniSparkline values={card.sparkValues} color={card.color} />
              )}
            </div>
          ))}
        </div>

        {/* Top nhóm hàng */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Top 10 nhóm hàng</span>
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-50">
            {(['fast', 'slow'] as SpeedTab[]).map(t => (
              <button
                key={t}
                onClick={() => setGroupTab(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  groupTab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t === 'fast' ? 'Bán chạy' : 'Bán chậm'}
              </button>
            ))}
            <div className="ml-auto flex gap-1">
              {METRIC_TABS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setGroupMetric(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    groupMetric === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">
                  Tên nhóm hàng
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Số lượng bán
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Số lượng trả
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Doanh thu thuần
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500">
                  Lợi nhuận gộp
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                    {ordersLoading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu'}
                  </td>
                </tr>
              ) : (
                sortedGroups.map((g, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium">{g.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-right">
                      {g.qty.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 text-right">
                      {g.retQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-right">
                      {fmt(g.revenue)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-right">
                      {fmt(g.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />

        {/* Top hàng hóa */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Top 10 hàng hóa</span>
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-50">
            {(['fast', 'slow'] as SpeedTab[]).map(t => (
              <button
                key={t}
                onClick={() => setProductTab(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  productTab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t === 'fast' ? 'Bán chạy' : 'Bán chậm'}
              </button>
            ))}
            <div className="ml-auto flex gap-1">
              {METRIC_TABS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setProductMetric(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    productMetric === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">
                  Tên hàng
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Số lượng bán
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Số lượng trả
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Doanh thu thuần
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500">
                  Lợi nhuận gộp
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                    {ordersLoading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu'}
                  </td>
                </tr>
              ) : (
                sortedProducts.map((p, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-right">
                      {p.soldQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 text-right">
                      {p.retQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-right">
                      {fmt(p.revenue)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-right">
                      {fmt(p.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalysisGoodsOverviewPage;
