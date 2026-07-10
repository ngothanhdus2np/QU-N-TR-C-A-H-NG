import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminStoreRequest } from '../../services/adminStoreApi';
import { TableSkeleton } from '../ui/Skeleton';

interface DayMetrics {
  impression: number;
  click: number;
  cost_vnd: number;
  gmv_vnd: number;
  roi: number;
  orders: number;
}

interface Props {
  shopFilter?: number | null;
  timeContext: { start: string; end: string };
  formatNumber: (num: number) => string;
}

const SHOP_IDS = ['1', '2'];

function mergeDays(reports: Record<string, DayMetrics>[]): Record<string, DayMetrics> {
  const merged: Record<string, DayMetrics> = {};
  for (const report of reports) {
    for (const [date, m] of Object.entries(report)) {
      const acc = merged[date] || { impression: 0, click: 0, cost_vnd: 0, gmv_vnd: 0, roi: 0, orders: 0 };
      acc.impression += m.impression;
      acc.click += m.click;
      acc.cost_vnd += m.cost_vnd;
      acc.gmv_vnd += m.gmv_vnd;
      acc.orders += m.orders;
      merged[date] = acc;
    }
  }
  for (const acc of Object.values(merged)) {
    acc.roi = acc.cost_vnd > 0 ? Number((acc.gmv_vnd / acc.cost_vnd).toFixed(2)) : 0;
  }
  return merged;
}

const AdsTab: React.FC<Props> = ({ shopFilter, timeContext, formatNumber }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [byDate, setByDate] = useState<Record<string, DayMetrics>>({});

  useEffect(() => {
    let cancelled = false;
    const shopIds = shopFilter === null || shopFilter === undefined ? SHOP_IDS : [String(shopFilter + 1)];

    setLoading(true);
    setError(null);

    Promise.all(
      shopIds.map(id =>
        adminStoreRequest<{ ok: boolean; data: Record<string, DayMetrics>; error?: string }>(
          `/api/shopee-ads-report/${id}`
        )
      )
    )
      .then(results => {
        if (cancelled) return;
        const failed = results.find(r => !r.ok);
        if (failed) {
          setError(failed.error || 'Không lấy được dữ liệu quảng cáo');
          setByDate({});
          return;
        }
        setByDate(mergeDays(results.map(r => r.data)));
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setByDate({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shopFilter]);

  const rows = useMemo(
    () =>
      Object.entries(byDate)
        .filter(([date]) => date >= timeContext.start && date <= timeContext.end)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, m]) => ({ date, ...m })),
    [byDate, timeContext]
  );

  const totals = useMemo(() => {
    const cost = rows.reduce((sum, r) => sum + r.cost_vnd, 0);
    const gmv = rows.reduce((sum, r) => sum + r.gmv_vnd, 0);
    return {
      cost,
      gmv,
      roi: cost > 0 ? Number((gmv / cost).toFixed(2)) : 0,
    };
  }, [rows]);

  const chartData = useMemo(
    () =>
      rows.map(r => ({
        date: r.date.slice(5).split('-').reverse().join('/'),
        'Chi phí': r.cost_vnd,
        GMV: r.gmv_vnd,
      })),
    [rows]
  );

  if (loading) {
    return (
      <div className="h-full overflow-auto rounded-lg border border-slate-200 bg-white p-4">
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    );
  }

  return (
    <section className="flex h-full min-w-0 flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Tổng chi phí</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatNumber(totals.cost)}đ</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Tổng GMV</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatNumber(totals.gmv)}đ</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">ROI trung bình</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{totals.roi.toFixed(2)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Chưa có dữ liệu quảng cáo trong khoảng thời gian này
        </div>
      ) : (
        <>
          <div>
            <h3 className="mb-2 ml-1 text-2xs font-semibold uppercase tracking-widest text-slate-400">
              Xu hướng chi phí & GMV theo ngày
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                    formatter={(val: number) => val.toLocaleString('vi-VN') + 'đ'}
                    labelFormatter={label => `Ngày ${label}`}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', paddingBottom: '10px' }}
                  />
                  <Bar dataKey="Chi phí" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="GMV" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3 text-right">Hiển thị</th>
                  <th className="px-4 py-3 text-right">Click</th>
                  <th className="px-4 py-3 text-right">Chi phí</th>
                  <th className="px-4 py-3 text-right">GMV</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                  <th className="px-4 py-3 text-right">Đơn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {[...rows].reverse().map(r => (
                  <tr key={r.date} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {r.date.split('-').reverse().join('/')}
                    </td>
                    <td className="px-4 py-2 text-right">{formatNumber(r.impression)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(r.click)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(r.cost_vnd)}đ</td>
                    <td className="px-4 py-2 text-right">{formatNumber(r.gmv_vnd)}đ</td>
                    <td className="px-4 py-2 text-right text-emerald-700">{r.roi.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{r.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default AdsTab;
