import React, { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import type { AppData } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';

interface Props {
  data: AppData;
}

type ABCClass = 'A' | 'B' | 'C';

interface ClassifiedProduct {
  id: string;
  name: string;
  revenue: number;
  qty: number;
  orders: number;
  pct: number;
  cumPct: number;
  cls: ABCClass;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtBig = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' triệu';
  return fmt(n);
};

const CLS_CONFIG: Record<ABCClass, { label: string; bg: string; text: string; bar: string; desc: string }> = {
  A: {
    label: 'Nhóm A',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    desc: 'Top 80% doanh thu — ưu tiên tồn kho cao',
  },
  B: {
    label: 'Nhóm B',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    bar: 'bg-amber-400',
    desc: '15% doanh thu tiếp theo — duy trì mức trung bình',
  },
  C: {
    label: 'Nhóm C',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    bar: 'bg-rose-400',
    desc: '5% doanh thu cuối — xem xét tối ưu danh mục',
  },
};

const AnalysisGoodsClassifyPage: React.FC<Props> = ({ data }) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const defaultStart = new Date(Date.now() - 29 * 86_400_000).toLocaleDateString('sv-SE');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [filter, setFilter] = useState<ABCClass | 'all'>('all');
  const [search, setSearch] = useState('');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const { classified, summary } = useMemo(() => {
    const orders = (data.posOrders || []).filter(
      o => !o.isReturn && o.status !== 'cancelled' && o.date >= startDate && o.date <= endDate
    );

    const productMap = new Map<string, { name: string; revenue: number; qty: number; orders: number }>();

    orders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const key = item.productId || item.id || item.name || 'unknown';
        const name = item.productName || item.name || key;
        const cur = productMap.get(key) || { name, revenue: 0, qty: 0, orders: 0 };
        const lineTotal =
          item.total ?? item.subtotal ??
          (item.finalPrice ?? item.price ?? 0) * (item.qty ?? item.quantity ?? 1);
        productMap.set(key, {
          name,
          revenue: cur.revenue + lineTotal,
          qty: cur.qty + (item.qty ?? item.quantity ?? 1),
          orders: cur.orders + 1,
        });
      });
    });

    const totalRevenue = Array.from(productMap.values()).reduce((s, v) => s + v.revenue, 0);

    const sorted = Array.from(productMap.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    let cumSum = 0;
    const result: ClassifiedProduct[] = sorted.map(p => {
      const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
      cumSum += pct;
      const cls: ABCClass = cumSum - pct < 80 ? 'A' : cumSum - pct < 95 ? 'B' : 'C';
      return { ...p, pct, cumPct: cumSum, cls };
    });

    const countA = result.filter(p => p.cls === 'A').length;
    const countB = result.filter(p => p.cls === 'B').length;
    const countC = result.filter(p => p.cls === 'C').length;
    const revA = result.filter(p => p.cls === 'A').reduce((s, p) => s + p.revenue, 0);
    const revB = result.filter(p => p.cls === 'B').reduce((s, p) => s + p.revenue, 0);
    const revC = result.filter(p => p.cls === 'C').reduce((s, p) => s + p.revenue, 0);

    return {
      classified: result,
      summary: { countA, countB, countC, revA, revB, revC, total: result.length, totalRevenue },
    };
  }, [data.posOrders, startDate, endDate]);

  const handleAiRun = async () => {
    const contextData = {
      period: `${startDate} đến ${endDate}`,
      totalProducts: summary.total,
      totalRevenue: summary.totalRevenue,
      groupA: { count: summary.countA, revenue: summary.revA, topProducts: classified.filter(p => p.cls === 'A').slice(0, 5).map(p => ({ name: p.name, revenue: p.revenue, pct: p.pct.toFixed(1) + '%' })) },
      groupB: { count: summary.countB, revenue: summary.revB },
      groupC: { count: summary.countC, revenue: summary.revC, bottomProducts: classified.filter(p => p.cls === 'C').slice(-5).map(p => ({ name: p.name, revenue: p.revenue })) },
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('goods-classify', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/goods-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('goods-classify', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const visible = classified.filter(p => {
    if (filter !== 'all' && p.cls !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const maxRevenue = classified[0]?.revenue || 1;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Phân loại hàng hóa (ABC)</h1>
          <p className="text-xs text-slate-400 mt-0.5">Phân tích đóng góp doanh thu theo khoảng thời gian</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as ABCClass[]).map(cls => {
          const cfg = CLS_CONFIG[cls];
          const count = cls === 'A' ? summary.countA : cls === 'B' ? summary.countB : summary.countC;
          const rev = cls === 'A' ? summary.revA : cls === 'B' ? summary.revB : summary.revC;
          const pct = summary.totalRevenue > 0 ? (rev / summary.totalRevenue) * 100 : 0;
          return (
            <div
              key={cls}
              onClick={() => setFilter(filter === cls ? 'all' : cls)}
              className={`bg-white rounded-2xl border p-5 cursor-pointer transition-colors ${
                filter === cls ? 'border-slate-300 shadow-sm' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-2xl font-normal text-slate-900 tabular-nums">{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">sản phẩm · {pct.toFixed(1)}% DT</p>
              <p className="text-xs text-slate-400 mt-1">{fmtBig(rev)}đ</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{cfg.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Tìm sản phẩm..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 bg-white"
        />
        <div className="flex gap-1">
          {(['all', 'A', 'B', 'C'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                filter === f
                  ? 'bg-slate-800 text-white'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {f === 'all' ? 'Tất cả' : `Nhóm ${f}`}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Package className="w-8 h-8" />
            <p className="text-sm">Không có dữ liệu</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {/* Header */}
            <div className="grid grid-cols-[32px_1fr_80px_80px_72px_56px] gap-3 px-5 py-2.5 text-xs text-slate-400 uppercase tracking-wider bg-slate-50">
              <span>#</span>
              <span>Sản phẩm</span>
              <span className="text-right">Doanh thu</span>
              <span className="text-right">SL bán</span>
              <span className="text-right">% DT</span>
              <span className="text-right">Nhóm</span>
            </div>

            {visible.map((p, i) => {
              const cfg = CLS_CONFIG[p.cls];
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[32px_1fr_80px_80px_72px_56px] gap-3 px-5 py-3 items-center hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-xs text-slate-400 tabular-nums">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">{p.name}</p>
                    <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.bar}`}
                        style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-slate-900 tabular-nums text-right">{fmtBig(p.revenue)}đ</span>
                  <span className="text-sm text-slate-600 tabular-nums text-right">{fmt(p.qty)}</span>
                  <span className="text-sm text-slate-600 tabular-nums text-right">{p.pct.toFixed(1)}%</span>
                  <span className={`text-xs font-medium text-right ${cfg.text}`}>{p.cls}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer note */}
      {classified.length === 0 && (
        <div className="bg-slate-50 rounded-2xl p-5 text-center">
          <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Chưa có đơn hàng trong khoảng thời gian đã chọn để phân tích.</p>
        </div>
      )}

      <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />
    </div>
    </div>
  );
};

export default AnalysisGoodsClassifyPage;
