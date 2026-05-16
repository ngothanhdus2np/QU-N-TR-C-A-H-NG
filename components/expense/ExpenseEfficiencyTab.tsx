import React from 'react';
import { Activity, AlertTriangle, ArrowUpRight, ListChecks, ShieldAlert, Sparkles, Target, Wallet, Zap } from 'lucide-react';
import { ExpenseMetricCard } from './ExpenseSharedUI';
import { useExpenseAnalytics } from './useExpenseAnalytics';

type ExpenseAnalytics = ReturnType<typeof useExpenseAnalytics>;

interface ExpenseEfficiencyTabProps {
  timeContext: ExpenseAnalytics['timeContext'];
  efficiencyData: ExpenseAnalytics['efficiencyData'];
  misMetrics: ExpenseAnalytics['misMetrics'];
  formatNumber: (num: number) => string;
}

export const ExpenseEfficiencyTab: React.FC<ExpenseEfficiencyTabProps> = ({
  timeContext,
  efficiencyData,
  misMetrics,
  formatNumber
}) => (
  <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ExpenseMetricCard title="Tổng Chi Vận Hành (OpEx)" value={formatNumber(efficiencyData.totalOpEx) + 'đ'} icon={Wallet} color="rose" desc={`Trong kỳ: ${timeContext.start.split('-').reverse().slice(0, 2).join('/')} - ${timeContext.end.split('-').reverse().slice(0, 2).join('/')}`} />
      <ExpenseMetricCard title="Điểm Hòa Vốn (Doanh thu)" value={formatNumber(Math.round(efficiencyData.breakEvenRevenue)) + 'đ'} icon={Target} color="amber" desc="Mức thu cần thiết để bù đắp OpEx" />
      <ExpenseMetricCard title="Biên Độ An Toàn" value={efficiencyData.safetyMargin.toFixed(1) + '%'} icon={ShieldAlert} color={efficiencyData.safetyMargin > 15 ? 'emerald' : 'rose'} desc="Khoảng cách an toàn tới điểm lỗ" />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <div className="xl:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5"><Activity className="w-40 h-40" /></div>
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Đối soát định mức ngành</h3>
            <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-1">So sánh thực tế với tiêu chuẩn ngành bán lẻ</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ShieldAlert className="w-6 h-6" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {misMetrics.benchmarks.map((benchmark, index) => (
            <div key={index} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-normal text-slate-400 uppercase">{benchmark.name}</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h4 className="text-2xl font-normal text-slate-900">{benchmark.actual.toFixed(1)}%</h4>
                    <span className="text-[10px] font-normal text-slate-400">/ {benchmark.target}% định mức</span>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-normal uppercase ${
                  benchmark.status === 'safe' ? 'bg-emerald-100 text-emerald-700' :
                    benchmark.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {benchmark.desc}
                </div>
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      benchmark.status === 'safe' ? 'bg-emerald-500' :
                        benchmark.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(benchmark.actual, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[9px] font-normal text-slate-400 uppercase px-1">
                  <span>0%</span>
                  <div className="relative">
                    <div className="absolute -top-1 left-1.2 w-0.5 h-3 bg-slate-400"></div>
                    <span className="ml-2">Chuẩn {benchmark.target}%</span>
                  </div>
                  <span>100%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden h-full">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-24 h-24 text-rose-500" /></div>
          <h3 className="text-xl font-black uppercase tracking-tight mb-8">Điểm nóng chi phí</h3>

          <div className="space-y-4">
            {misMetrics.hotspots.length > 0 ? (
              misMetrics.hotspots.map((hotspot, index) => (
                <div key={index} className="p-6 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl group-hover:scale-110 transition-transform"><AlertTriangle className="w-5 h-5" /></div>
                    <div className="flex items-center gap-2 text-rose-500 font-normal">
                      <ArrowUpRight className="w-4 h-4" />
                      <span className="text-sm">+{formatNumber(hotspot.diff)}đ</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-normal text-slate-200 uppercase">{hotspot.category}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-normal">Tăng {hotspot.diffPercent.toFixed(1)}% so với kỳ trước</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-slate-500 italic font-normal">Không có hạng mục tăng bất thường.</div>
            )}
          </div>

          <div className="mt-10 p-6 bg-indigo-600 rounded-[2.5rem] shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span className="text-[10px] font-normal uppercase text-indigo-100">AI Financial Recommendation</span>
            </div>
            <p className="text-xs text-indigo-50 leading-relaxed font-normal">
              {misMetrics.hotspots.length > 0
                ? `Rà soát ngay ${misMetrics.hotspots[0].category}. Chi phí này đang có dấu hiệu mất kiểm soát ảnh hưởng trực tiếp tới biên lợi nhuận ròng.`
                : 'Sức khỏe dòng tiền ổn định. Hãy duy trì kiểm soát định mức nhân sự để tối ưu hóa EBTIDA.'}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cơ cấu chi tiết Chi phí Vận hành</h3>
          <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-1">Danh sách đầy đủ tất cả các nhóm chi phí có phát sinh trong kỳ</p>
        </div>
        <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><ListChecks className="w-6 h-6" /></div>
      </div>

      <div className="space-y-6">
        {misMetrics.allCategories.map((category, index) => (
          <div key={index} className="group p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-lg transition-all duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-[250px]">
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-normal">
                  {index + 1}
                </div>
                <div>
                  <h4 className="text-sm font-normal text-slate-800 uppercase leading-none">{category.name}</h4>
                  <p className="text-[10px] text-slate-400 font-normal mt-1">Tổng chi: {formatNumber(category.amount)}đ</p>
                </div>
              </div>

              <div className="flex-1 flex items-center gap-6">
                <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(category.ratio * 3.3, 100)}%` }}
                  ></div>
                </div>
                <div className="text-right min-w-[80px]">
                  <span className="text-base font-normal text-slate-900">{category.ratio.toFixed(1)}%</span>
                  <p className="text-[8px] font-normal text-slate-400 uppercase tracking-tighter">/ Doanh thu</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {misMetrics.allCategories.length === 0 && (
          <div className="py-20 text-center">
            <div className="inline-block p-6 bg-slate-50 rounded-full mb-4">
              <ListChecks className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-sm font-normal text-slate-400 italic">Không có phát sinh chi phí vận hành trong kỳ này.</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
