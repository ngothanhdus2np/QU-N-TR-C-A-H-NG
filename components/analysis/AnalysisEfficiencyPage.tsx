import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, ShoppingCart, Users, RotateCcw, Zap } from 'lucide-react';
import type { AppData } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';
import { calcOrderRevenue } from '../../src/lib/reportCalculations';

interface Props {
  data: AppData;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtBig = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' triệu';
  return fmt(n);
};

const AnalysisEfficiencyPage: React.FC<Props> = ({ data }) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const defaultStart = new Date(Date.now() - 29 * 86_400_000).toLocaleDateString('sv-SE');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE');

  const stats = useMemo(() => {
    const rangeMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const days = Math.max(1, Math.round(rangeMs / 86_400_000) + 1);
    const prevEnd = new Date(new Date(startDate).getTime() - 86_400_000).toLocaleDateString('sv-SE');
    const prevStart = new Date(new Date(startDate).getTime() - days * 86_400_000).toLocaleDateString('sv-SE');

    const orders = (data.posOrders || []).filter(o => !o.isReturn && o.status !== 'cancelled');
    const returns = (data.posOrders || []).filter(o => o.isReturn);

    const last30 = orders.filter(o => o.date >= startDate && o.date <= endDate);
    const prev30 = orders.filter(o => o.date >= prevStart && o.date <= prevEnd);
    const todayOrders = orders.filter(o => o.date === today);
    const yesterdayOrders = orders.filter(o => o.date === yesterday);

    const totalRevenue30 = last30.reduce((s, o) => s + calcOrderRevenue(o), 0);
    const totalRevenuePrev30 = prev30.reduce((s, o) => s + calcOrderRevenue(o), 0);

    const avgOrderValue = last30.length > 0 ? totalRevenue30 / last30.length : 0;
    const avgOrderValuePrev = prev30.length > 0 ? totalRevenuePrev30 / prev30.length : 0;

    const avgOrdersPerDay = last30.length / days;
    const avgOrdersPerDayPrev = prev30.length / days;

    const returnRate = orders.length > 0 ? (returns.length / (orders.length + returns.length)) * 100 : 0;

    const todayRevenue = todayOrders.reduce((s, o) => s + calcOrderRevenue(o), 0);
    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + calcOrderRevenue(o), 0);

    // Top staff by revenue (last 30 days)
    const employeeNameMap = new Map<string, string>(
      (data.employees || []).map((e: any) => [e.id, e.name || e.fullName || e.id])
    );
    const resolveStaff = (id: string) => employeeNameMap.get(id) || id || 'Không rõ';

    const staffMap = new Map<string, { revenue: number; orders: number }>();
    last30.forEach(o => {
      const rawId = (o as any).createdBy || (o as any).staffId || '';
      const key = resolveStaff(rawId) || 'Không rõ';
      const cur = staffMap.get(key) || { revenue: 0, orders: 0 };
      staffMap.set(key, { revenue: cur.revenue + calcOrderRevenue(o), orders: cur.orders + 1 });
    });
    const topStaff = Array.from(staffMap.entries())
      .map(([name, v]) => ({ name, ...v, avgValue: v.orders > 0 ? v.revenue / v.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Channel breakdown (last 30 days)
    const channelMap = new Map<string, { revenue: number; orders: number }>();
    last30.forEach(o => {
      const key = o.channelName || (o.channel === 'direct' ? 'Trực tiếp' : o.channel === 'online' ? 'Online' : o.channel === 'marketplace' ? 'Sàn TMĐT' : 'Khác');
      const cur = channelMap.get(key) || { revenue: 0, orders: 0 };
      channelMap.set(key, { revenue: cur.revenue + calcOrderRevenue(o), orders: cur.orders + 1 });
    });
    const channels = Array.from(channelMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    const avgDiscountRate = last30.length > 0
      ? last30.reduce((s, o) => s + (o.totalAmount > 0 ? o.discount / o.totalAmount : 0), 0) / last30.length * 100
      : 0;

    return {
      avgOrderValue, avgOrderValuePrev,
      avgOrdersPerDay, avgOrdersPerDayPrev,
      returnRate,
      todayRevenue, yesterdayRevenue,
      todayOrderCount: todayOrders.length,
      yesterdayOrderCount: yesterdayOrders.length,
      totalOrders30: last30.length,
      topStaff,
      channels,
      avgDiscountRate,
      days,
    };
  }, [data.posOrders, data.employees, startDate, endDate, today, yesterday]);

  const handleAiRun = async () => {
    const contextData = {
      period: `${startDate} đến ${endDate} (${stats.days} ngày)`,
      avgOrderValue: stats.avgOrderValue,
      avgOrdersPerDay: stats.avgOrdersPerDay,
      returnRate: stats.returnRate.toFixed(1) + '%',
      avgDiscountRate: stats.avgDiscountRate.toFixed(1) + '%',
      totalOrders: stats.totalOrders30,
      topStaff: stats.topStaff.map(s => ({ name: s.name, revenue: s.revenue, orders: s.orders })),
      channels: stats.channels.map(c => ({ name: c.name, revenue: c.revenue, orders: c.orders })),
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('efficiency', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/efficiency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('efficiency', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const delta = (cur: number, prev: number) => {
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  };

  const DeltaBadge: React.FC<{ cur: number; prev: number; unit?: string }> = ({ cur, prev, unit = '%' }) => {
    const d = delta(cur, prev);
    if (d === null) return null;
    const up = d >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-normal ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(d).toFixed(1)}{unit}
      </span>
    );
  };

  const CHANNEL_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const totalChannelRevenue = stats.channels.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Hiệu quả kinh doanh</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {stats.days} ngày · so sánh với kỳ liền trước cùng độ dài
          </p>
        </div>
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
    <div className="flex-1 p-6 space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-500" />
            </div>
            <span className="text-xs text-slate-500">Giá trị TB / đơn</span>
          </div>
          <p className="text-xl font-normal text-slate-900 tabular-nums">{fmtBig(stats.avgOrderValue)}đ</p>
          <div className="mt-1">
            <DeltaBadge cur={stats.avgOrderValue} prev={stats.avgOrderValuePrev} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-sky-500" />
            </div>
            <span className="text-xs text-slate-500">Đơn hàng / ngày</span>
          </div>
          <p className="text-xl font-normal text-slate-900 tabular-nums">{stats.avgOrdersPerDay.toFixed(1)}</p>
          <div className="mt-1">
            <DeltaBadge cur={stats.avgOrdersPerDay} prev={stats.avgOrdersPerDayPrev} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-rose-500" />
            </div>
            <span className="text-xs text-slate-500">Tỷ lệ trả hàng</span>
          </div>
          <p className="text-xl font-normal text-slate-900 tabular-nums">{stats.returnRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 mt-1">Mục tiêu: &lt;5%</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs text-slate-500">Tỷ lệ chiết khấu TB</span>
          </div>
          <p className="text-xl font-normal text-slate-900 tabular-nums">{stats.avgDiscountRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 mt-1">Trên doanh thu gộp</p>
        </div>
      </div>

      {/* Hôm nay vs Hôm qua */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-xs font-normal text-slate-500 uppercase tracking-widest mb-4">Hôm nay vs Hôm qua</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1">Doanh thu hôm nay</p>
            <p className="text-2xl font-normal text-slate-900 tabular-nums">{fmtBig(stats.todayRevenue)}đ</p>
            <p className="text-xs text-slate-500 mt-1">{stats.todayOrderCount} đơn hàng</p>
            {stats.yesterdayRevenue > 0 && (
              <div className="mt-1">
                <DeltaBadge cur={stats.todayRevenue} prev={stats.yesterdayRevenue} />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Doanh thu hôm qua</p>
            <p className="text-2xl font-normal text-slate-900 tabular-nums">{fmtBig(stats.yesterdayRevenue)}đ</p>
            <p className="text-xs text-slate-500 mt-1">{stats.yesterdayOrderCount} đơn hàng</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top nhân viên */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-xs font-normal text-slate-500 uppercase tracking-widest mb-4">
            Top nhân viên bán hàng <span className="text-slate-300 normal-case">(30 ngày)</span>
          </h3>
          {stats.topStaff.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-3">
              {stats.topStaff.map((s, i) => {
                const maxRev = stats.topStaff[0]?.revenue || 1;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                        <span className="text-sm text-slate-700">{s.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-normal text-slate-900 tabular-nums">{fmtBig(s.revenue)}đ</span>
                        <span className="text-xs text-slate-400 ml-2">({s.orders} đơn)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${(s.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kênh bán */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-xs font-normal text-slate-500 uppercase tracking-widest mb-4">
            Phân bổ kênh bán <span className="text-slate-300 normal-case">(30 ngày)</span>
          </h3>
          {stats.channels.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-3">
              {stats.channels.map((c, i) => {
                const pct = totalChannelRevenue > 0 ? (c.revenue / totalChannelRevenue) * 100 : 0;
                const color = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-slate-700">{c.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-normal text-slate-900 tabular-nums">{pct.toFixed(1)}%</span>
                        <span className="text-xs text-slate-400 ml-2">({fmtBig(c.revenue)}đ)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="bg-slate-50 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-normal text-slate-500 uppercase tracking-widest">Tổng kết 30 ngày</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400">Tổng đơn hàng</p>
            <p className="text-lg font-normal text-slate-900 tabular-nums mt-0.5">{fmt(stats.totalOrders30)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Nhân viên bán</p>
            <p className="text-lg font-normal text-slate-900 tabular-nums mt-0.5">{stats.topStaff.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Kênh bán hoạt động</p>
            <p className="text-lg font-normal text-slate-900 tabular-nums mt-0.5">{stats.channels.length}</p>
          </div>
        </div>
      </div>

      <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />
    </div>
    </div>
  );
};

export default AnalysisEfficiencyPage;
