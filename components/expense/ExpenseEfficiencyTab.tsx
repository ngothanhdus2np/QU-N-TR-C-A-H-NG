import React from 'react';
import { AlertTriangle, ArrowUpRight, ListChecks, ShieldAlert, Target, Wallet } from 'lucide-react';
import { useExpenseAnalytics } from './useExpenseAnalytics';

type ExpenseAnalytics = ReturnType<typeof useExpenseAnalytics>;

interface ExpenseEfficiencyTabProps {
  timeContext: ExpenseAnalytics['timeContext'];
  efficiencyData: ExpenseAnalytics['efficiencyData'];
  misMetrics: ExpenseAnalytics['misMetrics'];
  formatNumber: (num: number) => string;
}

const statusClass: Record<string, string> = {
  safe: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  alert: 'bg-rose-50 text-rose-600',
};

export const ExpenseEfficiencyTab: React.FC<ExpenseEfficiencyTabProps> = ({
  timeContext,
  efficiencyData,
  misMetrics,
  formatNumber,
}) => {
  const periodLabel = `${timeContext.start.split('-').reverse().slice(0, 2).join('/')} - ${timeContext.end.split('-').reverse().slice(0, 2).join('/')}`;
  const kpis = [
    {
      label: 'Tổng chi vận hành',
      value: `${formatNumber(efficiencyData.totalOpEx)}đ`,
      desc: `Trong kỳ ${periodLabel}`,
      Icon: Wallet,
    },
    {
      label: 'Điểm hòa vốn',
      value: `${formatNumber(Math.round(efficiencyData.breakEvenRevenue))}đ`,
      desc: 'Doanh thu cần đạt để bù chi phí',
      Icon: Target,
    },
    {
      label: 'Biên độ an toàn',
      value: `${efficiencyData.safetyMargin.toFixed(1)}%`,
      desc: efficiencyData.safetyMargin > 15 ? 'Vùng an toàn tốt' : 'Cần theo dõi sát',
      Icon: ShieldAlert,
    },
  ];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(({ label, value, desc, Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mb-2">{value}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 text-slate-400">
                <Icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Đối soát định mức ngành</span>
            <p className="text-xs text-slate-400 mt-0.5">So sánh tỷ lệ chi phí thực tế với chuẩn bán lẻ</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">Chỉ số</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Thực tế</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Định mức</th>
                <th className="text-left pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {misMetrics.benchmarks.map(benchmark => (
                <tr key={benchmark.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="pl-5 pr-4 py-3 text-sm text-slate-700 font-medium">{benchmark.name}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700 font-semibold">{benchmark.actual.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-500">{benchmark.target}%</td>
                  <td className="pr-5 pl-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusClass[benchmark.status]}`}>
                      {benchmark.desc}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Điểm nóng chi phí</span>
            <p className="text-xs text-slate-400 mt-0.5">Các khoản tăng mạnh so với kỳ trước</p>
          </div>
          <div className="divide-y divide-slate-100">
            {misMetrics.hotspots.length > 0 ? (
              misMetrics.hotspots.map(hotspot => (
                <div key={hotspot.category} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-500 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 font-medium truncate">{hotspot.category}</p>
                      <p className="text-xs text-slate-400">Tăng {hotspot.diffPercent.toFixed(1)}% so với kỳ trước</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-rose-500 text-xs font-semibold shrink-0">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {formatNumber(hotspot.diff)}đ
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-12 text-center text-sm text-slate-400">Không có hạng mục tăng bất thường.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-slate-700">Cơ cấu chi phí vận hành</span>
            <p className="text-xs text-slate-400 mt-0.5">Danh sách các nhóm chi phí phát sinh trong kỳ</p>
          </div>
          <ListChecks className="w-4 h-4 text-slate-400" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">Khoản mục</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Tổng chi</th>
              <th className="text-right pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">Tỷ lệ / doanh thu</th>
            </tr>
          </thead>
          <tbody>
            {misMetrics.allCategories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center text-sm text-slate-400">
                  Không có phát sinh chi phí vận hành trong kỳ này.
                </td>
              </tr>
            ) : (
              misMetrics.allCategories.map(category => (
                <tr key={category.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="pl-5 pr-4 py-3 text-sm text-slate-700 font-medium">{category.name}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700 font-semibold">{formatNumber(category.amount)}đ</td>
                  <td className="pr-5 pl-4 py-3 text-right text-sm text-slate-500">{category.ratio.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
