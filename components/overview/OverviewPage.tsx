import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BadgeDollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  RotateCcw,
  Clock,
  ChevronDown,
} from 'lucide-react';
import type { AppData, POSOrder } from '../../types';
import { calcOrderRevenue } from '../../src/lib/reportCalculations';
import { usePosOrders } from '../../hooks/usePosOrders';

interface Props {
  data: AppData;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)} tr`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(0)} k`
      : n.toLocaleString('vi-VN');

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

const fmtPct = (n: number) =>
  n.toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const localDateKey = (date: Date) => date.toLocaleDateString('sv-SE');

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const money = (value?: number) => (Number.isFinite(value) ? Number(value) : 0);

const orderDateKey = (order: POSOrder) => order.date?.slice(0, 10) || '';

const netOrderAmount = (order: POSOrder) => calcOrderRevenue(order);

const orderItemAmount = (item: POSOrder['items'][number], isReturn = false) => {
  const quantity = money(item.quantity);
  const discount = money(item.discount);
  const directAmount = money(item.total);
  const unitPrice = money(item.price) || directAmount;
  if (isReturn) return Math.max(0, unitPrice * quantity - discount);
  return Math.max(0, (directAmount || unitPrice * quantity) - discount);
};

const sameDatePreviousYear = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year - 1, month - 1, day));
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  return `${Math.floor(diffHr / 24)} ngày trước`;
};

type ChartTab = 'day' | 'hour' | 'weekday';
type RevenuePeriod = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear';
type ProductTopMetric = 'quantity' | 'netRevenue';

const REVENUE_PERIODS: { id: RevenuePeriod; label: string; title: string }[] = [
  { id: 'today', label: 'Hôm nay', title: 'hôm nay' },
  { id: 'yesterday', label: 'Hôm qua', title: 'hôm qua' },
  { id: 'last7', label: '7 ngày', title: '7 ngày qua' },
  { id: 'thisMonth', label: 'Tháng này', title: 'tháng này' },
  { id: 'lastMonth', label: 'Tháng trước', title: 'tháng trước' },
  { id: 'thisYear', label: 'Năm nay', title: 'năm nay' },
];

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`);

const OverviewPage: React.FC<Props> = ({ data }) => {
  const [chartTab, setChartTab] = useState<ChartTab>('day');
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('thisMonth');
  const [productTopMetric, setProductTopMetric] = useState<ProductTopMetric>('quantity');
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isMetricOpen, setIsMetricOpen] = useState(false);
  const orders: POSOrder[] = data.posOrders || [];

  const productLookup = useMemo(() => {
    const byId = new Map<string, AppData['posProducts'][number]>();
    const bySku = new Map<string, AppData['posProducts'][number]>();
    (data.posProducts || []).forEach(product => {
      byId.set(product.id, product);
      if (product.sku) bySku.set(product.sku, product);
    });
    return { byId, bySku };
  }, [data.posProducts]);

  const today = new Date();
  const todayStr = localDateKey(today);

  const completedOrders = useMemo(
    () => orders.filter(o => o.status === 'completed' || !o.status),
    [orders]
  );

  const revenueRange = useMemo(() => {
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const ranges: Record<RevenuePeriod, { start: string; end: string }> = {
      today: { start: todayStr, end: todayStr },
      yesterday: {
        start: localDateKey(addDays(today, -1)),
        end: localDateKey(addDays(today, -1)),
      },
      last7: { start: localDateKey(addDays(today, -6)), end: todayStr },
      thisMonth: { start: localDateKey(startOfThisMonth), end: todayStr },
      lastMonth: { start: localDateKey(startOfLastMonth), end: localDateKey(endOfLastMonth) },
      thisYear: { start: localDateKey(new Date(today.getFullYear(), 0, 1)), end: todayStr },
    };
    return ranges[revenuePeriod];
  }, [revenuePeriod, today, todayStr]);

  const { orders: periodOrders, isLoading: top10Loading } = usePosOrders(
    orders,
    revenueRange.start,
    revenueRange.end
  );

  const previousRevenueRange = useMemo(() => {
    if (['thisMonth', 'lastMonth', 'thisYear'].includes(revenuePeriod)) {
      return {
        start: sameDatePreviousYear(revenueRange.start),
        end: sameDatePreviousYear(revenueRange.end),
      };
    }

    const start = new Date(`${revenueRange.start}T00:00:00`);
    const end = new Date(`${revenueRange.end}T00:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(days - 1));
    return {
      start: localDateKey(previousStart),
      end: localDateKey(previousEnd),
    };
  }, [revenuePeriod, revenueRange]);

  const selectedPeriod = REVENUE_PERIODS.find(period => period.id === revenuePeriod);

  // Nếu đang ở "tháng này" nhưng không có đơn nào → tự chuyển sang "tháng trước"
  useEffect(() => {
    if (revenuePeriod !== 'thisMonth' || orders.length === 0) return;
    const currentYearMonth = revenueRange.start.slice(0, 7);
    const hasOrdersThisMonth = orders.some(o => o.date?.slice(0, 7) === currentYearMonth);
    if (!hasOrdersThisMonth) setRevenuePeriod('lastMonth');
  }, [orders, revenuePeriod, revenueRange.start]);

  // ── Today stats ──────────────────────────────────────────────
  const todayOrders = useMemo(
    () => completedOrders.filter(o => o.date?.startsWith(todayStr) && !o.isReturn),
    [completedOrders, todayStr]
  );
  const todayReturns = useMemo(
    () => completedOrders.filter(o => o.date?.startsWith(todayStr) && o.isReturn),
    [completedOrders, todayStr]
  );
  const orderCogs = React.useCallback(
    (order: POSOrder) =>
      (order.items || []).reduce((sum, item) => {
        const product = productLookup.byId.get(item.productId) || productLookup.bySku.get(item.sku);
        return sum + (product?.importPrice || 0) * item.quantity;
      }, 0),
    [productLookup]
  );
  const netOrderProfit = React.useCallback(
    (order: POSOrder) => {
      const cogs = orderCogs(order);
      if (order.isReturn) return -(Math.abs(money(order.totalAmount)) - cogs);
      return calcOrderRevenue(order) - cogs;
    },
    [orderCogs]
  );
  const todayRevenue = todayOrders.reduce((s, o) => s + netOrderAmount(o), 0);
  const todayReturnAmt = todayReturns.reduce((s, o) => s + Math.abs(money(o.totalAmount)), 0);
  const todayNet = todayRevenue - todayReturnAmt;
  const todaySalesCogs = todayOrders.reduce((s, o) => s + orderCogs(o), 0);
  const todayReturnCogs = todayReturns.reduce((s, o) => s + orderCogs(o), 0);
  const todayProfit = todayRevenue - todaySalesCogs - (todayReturnAmt - todayReturnCogs);
  const todayMargin = todayNet > 0 ? (todayProfit / todayNet) * 100 : null;

  // Compare with same day last month — dùng cùng công thức với todayNet (đã trừ trả hàng)
  const sameDayLastMonth = localDateKey(
    new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
  );
  const lastMonthSameDay = (() => {
    const sameDayOrders = completedOrders.filter(o => o.date?.startsWith(sameDayLastMonth));
    const sales = sameDayOrders.filter(o => !o.isReturn).reduce((s, o) => s + calcOrderRevenue(o), 0);
    const returns = sameDayOrders.filter(o => o.isReturn).reduce((s, o) => s + Math.abs(money(o.totalAmount)), 0);
    return sales - returns;
  })();
  const netChangePct =
    lastMonthSameDay > 0 ? ((todayNet - lastMonthSameDay) / lastMonthSameDay) * 100 : null;

  const revenueOrders = useMemo(
    () =>
      completedOrders.filter(order => {
        const key = orderDateKey(order);
        return key >= revenueRange.start && key <= revenueRange.end;
      }),
    [completedOrders, revenueRange]
  );

  // ── Chart data ───────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (chartTab === 'day') {
      if (revenuePeriod === 'thisYear') {
        const map = new Map<number, { value: number; profit: number }>();
        revenueOrders.forEach(order => {
          const month = Number(orderDateKey(order).slice(5, 7));
          if (!month) return;
          const current = map.get(month) || { value: 0, profit: 0 };
          map.set(month, {
            value: current.value + netOrderAmount(order),
            profit: current.profit + netOrderProfit(order),
          });
        });
        const endMonth = Number(revenueRange.end.slice(5, 7)) || 12;
        return Array.from({ length: endMonth }, (_, i) => ({
          label: `T${i + 1}`,
          value: map.get(i + 1)?.value ?? 0,
          profit: map.get(i + 1)?.profit ?? 0,
        }));
      }

      const map = new Map<string, { value: number; profit: number }>();
      revenueOrders.forEach(order => {
        const key = orderDateKey(order);
        const current = map.get(key) || { value: 0, profit: 0 };
        map.set(key, {
          value: current.value + netOrderAmount(order),
          profit: current.profit + netOrderProfit(order),
        });
      });
      const start = new Date(`${revenueRange.start}T00:00:00`);
      const end = new Date(`${revenueRange.end}T00:00:00`);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      return Array.from({ length: days }, (_, i) => {
        const key = localDateKey(addDays(start, i));
        return {
          label: key.slice(8, 10),
          value: map.get(key)?.value ?? 0,
          profit: map.get(key)?.profit ?? 0,
        };
      });
    }
    if (chartTab === 'hour') {
      const map = new Map<number, { value: number; profit: number }>();
      revenueOrders.forEach(o => {
        const hour = new Date(o.date).getHours();
        const current = map.get(hour) || { value: 0, profit: 0 };
        map.set(hour, {
          value: current.value + netOrderAmount(o),
          profit: current.profit + netOrderProfit(o),
        });
      });
      return HOUR_LABELS.map((label, i) => ({
        label,
        value: map.get(i)?.value ?? 0,
        profit: map.get(i)?.profit ?? 0,
      }));
    }
    // weekday
    const map = new Map<number, { value: number; profit: number }>();
    revenueOrders.forEach(o => {
      if (!o.date) return;
      const d = new Date(o.date);
      const weekday = d.getDay();
      const current = map.get(weekday) || { value: 0, profit: 0 };
      map.set(weekday, {
        value: current.value + netOrderAmount(o),
        profit: current.profit + netOrderProfit(o),
      });
    });
    return WEEKDAY_LABELS.map((label, i) => ({
      label,
      value: map.get(i)?.value ?? 0,
      profit: map.get(i)?.profit ?? 0,
    }));
  }, [chartTab, netOrderProfit, revenueOrders, revenueRange, revenuePeriod]);

  // ── Top 10 products ──────────────────────────────────────────
  const top10Products = useMemo(() => {
    const map = new Map<string, { id: string; name: string; revenue: number; quantity: number }>();
    periodOrders.filter(o => {
      const key = orderDateKey(o);
      return (
        (o.status === 'completed' || !o.status) &&
        key >= revenueRange.start &&
        key <= revenueRange.end
      );
    }).forEach(o =>
      o.items?.forEach(item => {
        const key = item.sku || item.productId || item.name;
        if (!key) return;
        const name = item.name || item.sku || 'Không xác định';
        const prev = map.get(key) ?? { id: key, name, revenue: 0, quantity: 0 };
        const sign = o.isReturn ? -1 : 1;
        map.set(key, {
          id: key,
          name,
          revenue: prev.revenue + sign * orderItemAmount(item, o.isReturn),
          quantity: prev.quantity + sign * money(item.quantity),
        });
      })
    );
    return [...map.values()]
      .filter(row => row.quantity > 0 && row.revenue > 0)
      .sort((a, b) =>
        productTopMetric === 'quantity'
          ? b.quantity - a.quantity || b.revenue - a.revenue
          : b.revenue - a.revenue || b.quantity - a.quantity
      )
      .slice(0, 10);
  }, [periodOrders, productTopMetric, revenueRange]);

  const maxProductValue =
    top10Products[0]?.[productTopMetric === 'quantity' ? 'quantity' : 'revenue'] ?? 1;

  // ── Top 10 customers ─────────────────────────────────────────
  const top10Customers = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number }>();
    periodOrders.filter(o => {
      const key = orderDateKey(o);
      return (
        !!o.customerId &&
        (o.status === 'completed' || !o.status) &&
        key >= revenueRange.start &&
        key <= revenueRange.end
      );
    }).forEach(o => {
      const key = o.customerId;
      const name = o.customerName || o.customerId;
      const prev = map.get(key) ?? { name, revenue: 0 };
      const sign = o.isReturn ? -1 : 1;
      map.set(key, { name, revenue: prev.revenue + sign * Math.abs(netOrderAmount(o)) });
    });
    return [...map.values()]
      .filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [periodOrders, revenueRange]);

  const maxCustomerRevenue = top10Customers[0]?.revenue ?? 1;

  // ── Recent activity ──────────────────────────────────────────
  const recentOrders = useMemo(
    () =>
      [...completedOrders]
        .filter(o => o.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 25),
    [completedOrders]
  );

  // ── Revenue total ────────────────────────────────────────────
  const revenueNet = revenueOrders.reduce((s, o) => s + netOrderAmount(o), 0);
  const previousRevenueNet = completedOrders
    .filter(order => {
      const key = orderDateKey(order);
      return key >= previousRevenueRange.start && key <= previousRevenueRange.end;
    })
    .reduce((s, o) => s + netOrderAmount(o), 0);
  const revenueChangePct =
    previousRevenueNet > 0 ? ((revenueNet - previousRevenueNet) / previousRevenueNet) * 100 : null;

  return (
    <div className="flex h-full min-h-0 gap-4 bg-slate-50">
      {/* ── Main column ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-5">

        {/* Today card */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Kết quả bán hàng hôm nay</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Doanh thu */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4.5 h-4.5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Doanh thu</p>
                <p className="text-lg font-bold text-slate-800">{fmtFull(todayRevenue)}</p>
                <p className="text-xs text-slate-400">{todayOrders.length} đơn</p>
              </div>
            </div>
            {/* Trả hàng */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4.5 h-4.5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Trả hàng</p>
                <p className="text-lg font-bold text-slate-800">{fmtFull(todayReturnAmt)}</p>
                <p className="text-xs text-slate-400">{todayReturns.length} đơn</p>
              </div>
            </div>
            {/* Doanh thu thuần */}
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  netChangePct !== null && netChangePct < 0 ? 'bg-red-50' : 'bg-emerald-50'
                }`}
              >
                {netChangePct !== null && netChangePct < 0 ? (
                  <TrendingDown className="w-4.5 h-4.5 text-red-400" />
                ) : (
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-500" />
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Doanh thu thuần</p>
                <p className="text-lg font-bold text-slate-800">{fmtFull(todayNet)}</p>
                {netChangePct !== null && (
                  <p
                    className={`text-xs font-medium ${
                      netChangePct < 0 ? 'text-red-500' : 'text-emerald-600'
                    }`}
                  >
                    {netChangePct > 0 ? '+' : ''}
                    {fmtPct(netChangePct)}% so với cùng kỳ tháng trước
                  </p>
                )}
              </div>
            </div>
            {/* Lợi nhuận */}
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  todayProfit < 0 ? 'bg-red-50' : 'bg-violet-50'
                }`}
              >
                <BadgeDollarSign
                  className={`w-4.5 h-4.5 ${todayProfit < 0 ? 'text-red-400' : 'text-violet-500'}`}
                />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Lợi nhuận</p>
                <p className="text-lg font-bold text-slate-800">{fmtFull(todayProfit)}</p>
                <p className="text-xs text-slate-400">
                  {todayMargin !== null ? `${todayMargin.toFixed(1)}% biên gộp` : 'Sau giá vốn'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue chart */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <span className="text-sm text-slate-500">
                Doanh thu thuần {selectedPeriod?.title || 'tháng này'}{' '}
              </span>
              <span className="text-base font-bold text-blue-600">{fmtFull(revenueNet)}</span>
              {revenueChangePct !== null && (
                <span
                  className={`ml-2 text-xs font-medium ${
                    revenueChangePct < 0 ? 'text-red-500' : 'text-emerald-600'
                  }`}
                >
                  {revenueChangePct > 0 ? '+' : ''}
                  {fmtPct(revenueChangePct)}%
                </span>
              )}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsPeriodOpen(open => !open)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                aria-haspopup="menu"
                aria-expanded={isPeriodOpen}
              >
                {selectedPeriod?.label || 'Tháng này'}
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${
                    isPeriodOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isPeriodOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {REVENUE_PERIODS.map(period => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => {
                        setRevenuePeriod(period.id);
                        setIsPeriodOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm ${
                        revenuePeriod === period.id
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-slate-100">
            {([
              { id: 'day', label: 'Theo ngày' },
              { id: 'hour', label: 'Theo giờ' },
              { id: 'weekday', label: 'Theo thứ' },
            ] as { id: ChartTab; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setChartTab(t.id)}
                className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
                  chartTab === t.id
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} barSize={chartTab === 'day' ? 14 : 20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                interval={chartTab === 'day' ? 1 : 0}
              />
              <YAxis
                tickFormatter={fmt}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  fmtFull(v),
                  name === 'profit' ? 'Lợi nhuận' : 'Doanh thu thuần',
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#7c3aed', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 tables */}
        <div className="grid grid-cols-2 gap-5">
          {/* Top 10 products */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Top 10 hàng bán chạy</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMetricOpen(o => !o)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {productTopMetric === 'quantity' ? 'Theo số lượng' : 'Theo doanh thu thuần'}
                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isMetricOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isMetricOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {(['quantity', 'netRevenue'] as ProductTopMetric[]).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setProductTopMetric(m); setIsMetricOpen(false); }}
                          className={`block w-full px-3 py-2 text-left text-xs ${productTopMetric === m ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          {m === 'quantity' ? 'Theo số lượng' : 'Theo doanh thu thuần'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                  {selectedPeriod?.label || 'Tháng này'}
                </span>
              </div>
            </div>
            {top10Products.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                {top10Loading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {top10Products.map(p => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs text-slate-600 truncate max-w-[65%]"
                        title={p.name}
                      >
                        {p.name}
                      </span>
                      <span className="text-xs font-medium text-slate-700 shrink-0">
                        {productTopMetric === 'quantity'
                          ? `${fmtFull(p.quantity)} SP`
                          : fmt(p.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full"
                        style={{
                          width: `${
                            ((productTopMetric === 'quantity' ? p.quantity : p.revenue) /
                              maxProductValue) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top 10 customers */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Top 10 khách mua nhiều nhất
              </h3>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                {selectedPeriod?.label || 'Tháng này'}
              </span>
            </div>
            {top10Customers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                {top10Loading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {top10Customers.map(c => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs text-slate-600 truncate max-w-[65%]"
                        title={c.name}
                      >
                        {c.name}
                      </span>
                      <span className="text-xs font-medium text-slate-700 shrink-0">
                        {fmt(c.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${(c.revenue / maxCustomerRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────── */}
      <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-100 bg-white">
        <div className="flex min-h-[58px] items-center border-b border-slate-100 px-4">
          <h3 className="text-sm font-semibold text-slate-700">Hoạt động gần đây</h3>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/70 p-3">
          {recentOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Chưa có đơn hàng</p>
            </div>
          ) : (
            recentOrders.map(o => (
              <div
                key={o.id}
                className="rounded-xl border border-slate-100 bg-white px-3 py-3 transition-colors hover:border-indigo-100 hover:bg-indigo-50/30"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      o.isReturn ? 'bg-orange-50' : 'bg-blue-50'
                    }`}
                  >
                    {o.isReturn ? (
                      <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                    ) : (
                      <ShoppingCart className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-snug">
                      <span className="font-medium">{o.customerName || 'Khách lẻ'}</span>{' '}
                      {o.isReturn ? 'trả hàng' : 'mua hàng'} với giá trị{' '}
                      <span className="font-semibold text-slate-800">
                        {fmtFull(o.isReturn ? Math.abs(money(o.totalAmount)) : calcOrderRevenue(o))}
                      </span>
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span className="text-xs text-slate-400">{fmtTime(o.date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

export default OverviewPage;
