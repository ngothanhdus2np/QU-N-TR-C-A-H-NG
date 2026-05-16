import React from 'react';
import { AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { ExpenseRecord, PromotionPlan, RevenueRecord } from '../../types';

interface PromotionLedgerTableProps {
  promotions: PromotionPlan[];
  revenue: RevenueRecord[];
  expenses: ExpenseRecord[];
}

const calculatePerformance = (promotion: PromotionPlan, revenue: RevenueRecord[], expenses: ExpenseRecord[]) => {
  const start = new Date(promotion.startDate);
  const end = new Date(promotion.endDate);
  const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const actualRev = revenue
    .filter((record) => {
      const date = new Date(record.date);
      return date >= start && date <= end;
    })
    .reduce((sum, record) => sum + record.netRevenue, 0);

  const thirtyDaysBefore = new Date(start);
  thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);

  const baselineRevenueData = revenue.filter((record) => {
    const date = new Date(record.date);
    return date >= thirtyDaysBefore && date < start;
  });

  const avgDailyBaseline =
    baselineRevenueData.length > 0
      ? baselineRevenueData.reduce((sum, record) => sum + record.netRevenue, 0) / baselineRevenueData.length
      : 0;

  const expectedRevenue = avgDailyBaseline * durationDays;
  const incrementalRev = actualRev - expectedRevenue;

  let actCost = promotion.actualCost || 0;
  if (actCost === 0) {
    actCost = expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        const category = expense.category.toLowerCase();
        const isMarketing =
          category.includes('marketing') || category.includes('khuyến mãi') || category.includes('promotion');
        return date >= start && date <= end && isMarketing;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  if (actCost === 0 && promotion.status === 'Completed') actCost = promotion.budget;

  const roi = actCost > 0 ? incrementalRev / actCost : 0;

  return { actualRev, incrementalRev, actCost, roi };
};

const PromotionLedgerTable: React.FC<PromotionLedgerTableProps> = ({ promotions, revenue, expenses }) => {
  const sortedPromotions = [...promotions].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-lg font-black text-slate-900">Sổ cái & Hiệu quả Khuyến mãi</h3>
          <p className="text-xs text-slate-500 mt-1">So sánh kết quả thực tế với mục tiêu đề ra</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-normal uppercase tracking-widest text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Hiệu quả tốt
          </div>
          <div className="flex items-center gap-2 text-[10px] font-normal uppercase tracking-widest text-slate-400">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div> Cần tối ưu
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Chương trình
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                Doanh thu thực tế
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                Doanh thu tăng thêm
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                Chi phí thực tế
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                ROI Thực tế
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                Đánh giá
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedPromotions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                  Chưa có dữ liệu khuyến mãi.
                </td>
              </tr>
            ) : (
              sortedPromotions.map((promotion) => {
                const perf = calculatePerformance(promotion, revenue, expenses);
                const isPositive = perf.roi > 2;
                const isWarning = perf.roi < 1 && promotion.status === 'Completed';

                return (
                  <tr key={promotion.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-normal text-slate-900">{promotion.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(promotion.startDate).toLocaleDateString('vi-VN')} -{' '}
                          {new Date(promotion.endDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-normal text-slate-700">{perf.actualRev.toLocaleString()}đ</span>
                      <div className="text-[9px] font-normal text-slate-400">
                        Mục tiêu: {promotion.targetRevenue.toLocaleString()}đ
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`text-sm font-normal ${
                          perf.incrementalRev > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {perf.incrementalRev > 0 ? '+' : ''}
                        {perf.incrementalRev.toLocaleString()}đ
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-normal text-slate-700">{perf.actCost.toLocaleString()}đ</span>
                      <div className="text-[9px] font-normal text-slate-400">
                        Ngân sách: {promotion.budget.toLocaleString()}đ
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div
                        className={`inline-block px-3 py-1 rounded-lg border font-normal text-xs ${
                          isPositive
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : isWarning
                              ? 'bg-rose-50 text-rose-600 border-rose-100'
                              : 'bg-slate-50 text-slate-600 border-slate-100'
                        }`}
                      >
                        {perf.roi.toFixed(2)}x
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {promotion.status !== 'Completed' && promotion.status !== 'Active' ? (
                        <span className="text-[10px] font-normal text-slate-400 italic">Chưa diễn ra</span>
                      ) : (
                        <div className="flex justify-center">
                          {isPositive ? (
                            <div className="flex items-center gap-1 text-emerald-600 font-normal text-[10px] uppercase">
                              <TrendingUp className="w-3 h-3" /> Hiệu quả cao
                            </div>
                          ) : isWarning ? (
                            <div className="flex items-center gap-1 text-rose-600 font-normal text-[10px] uppercase">
                              <AlertCircle className="w-3 h-3" /> Cần xem lại
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600 font-normal text-[10px] uppercase">
                              <Clock className="w-3 h-3" /> Đạt yêu cầu
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PromotionLedgerTable;
