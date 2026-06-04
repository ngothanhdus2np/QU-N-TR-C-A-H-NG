import React from 'react';
import {
  Activity,
  ArrowUpRight,
  DollarSign,
  Gauge,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import {
  DailyBreakEvenConfig,
  DashboardBreakEvenAnalysis,
  DashboardFinancialInsights,
  DashboardPreviousInsights,
  RevenueRecord,
} from '../../types';
import DailyBreakEven from '../DailyBreakEven';

interface DashboardKpiOverviewProps {
  insights: DashboardFinancialInsights;
  prevInsights: DashboardPreviousInsights;
  revenue: RevenueRecord[];
  breakEvenAnalysis?: DashboardBreakEvenAnalysis;
  targetDate: string;
  dailyBreakEvenConfig?: DailyBreakEvenConfig;
  onUpdateData: (key: 'dailyBreakEvenConfig', newList: DailyBreakEvenConfig) => void;
}

export const DashboardKpiOverview: React.FC<DashboardKpiOverviewProps> = ({
  insights,
  prevInsights,
  revenue,
  breakEvenAnalysis,
  targetDate,
  dailyBreakEvenConfig,
  onUpdateData,
}) => (
  <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
        <div className="flex items-center justify-between mb-8">
          <div className="p-5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="w-7 h-7" />
          </div>
          <div className="text-right">
            <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest block">
              Net Revenue
            </span>
            <div className="flex items-center justify-end text-emerald-500 gap-1 font-normal text-xs mt-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>
                {prevInsights.rev > 0
                  ? (((insights.periodRev - prevInsights.rev) / prevInsights.rev) * 100).toFixed(0)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
        <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-[0.25em] mb-2">
          Doanh thu
        </h4>
        <p className="text-4xl font-normal text-slate-900 tracking-tighter leading-none">
          {insights.periodRev.toLocaleString()}
          <span className="text-sm ml-1 text-slate-400 font-normal">đ</span>
        </p>
        <p className="text-[9px] text-slate-400 mt-4 font-normal uppercase tracking-widest">
          Kỳ trước: {prevInsights.rev.toLocaleString()} đ
        </p>
      </div>

      <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
        <div className="flex items-center justify-between mb-8">
          <div className="p-5 rounded-2xl bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform duration-500">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <div className="text-right">
            <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest block">
              COGS Ratio
            </span>
            <span className="text-2xs font-normal text-orange-500 uppercase tracking-widest block mt-1">
              {insights.periodRev > 0
                ? ((insights.totalCogs / insights.periodRev) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>
        <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-[0.25em] mb-2">
          Giá vốn (COGS)
        </h4>
        <p className="text-4xl font-normal text-slate-900 tracking-tighter leading-none">
          {insights.totalCogs.toLocaleString()}
          <span className="text-sm ml-1 text-slate-400 font-normal">đ</span>
        </p>
        <div className="h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-1000"
            style={{
              width: `${Math.min(100, insights.periodRev > 0 ? (insights.totalCogs / insights.periodRev) * 100 : 0)}%`,
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
        <div className="flex items-center justify-between mb-8">
          <div className="p-5 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
            <Gauge className="w-7 h-7" />
          </div>
          <div className="text-right">
            <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest block">
              Gross Margin
            </span>
            <div className="flex items-center justify-end text-indigo-500 gap-1 font-normal text-xs mt-1">
              <span>
                {insights.periodRev > 0
                  ? ((insights.periodGross / insights.periodRev) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
        <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-[0.25em] mb-2">
          Lợi nhuận gộp
        </h4>
        <p className="text-4xl font-normal text-indigo-600 tracking-tighter leading-none">
          {insights.periodGross.toLocaleString()}
          <span className="text-sm ml-1 opacity-50 font-normal">đ</span>
        </p>
        <p className="text-[9px] text-slate-400 mt-4 font-normal uppercase tracking-widest">
          Kỳ trước: {prevInsights.gross.toLocaleString()} đ
        </p>
      </div>

      <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
        <div className="flex items-center justify-between mb-8">
          <div className="p-5 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform duration-500">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="text-right">
            <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest block">
              OPEX Ratio
            </span>
            <div className="flex items-center justify-end text-rose-500 gap-1 font-normal text-xs mt-1">
              <span>
                {insights.periodRev > 0
                  ? ((insights.periodExp / insights.periodRev) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
        <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-[0.25em] mb-2">
          Chi phí hoạt động
        </h4>
        <p className="text-4xl font-normal text-slate-900 tracking-tighter leading-none">
          {insights.periodExp.toLocaleString()}
          <span className="text-sm ml-1 text-slate-400 font-normal">đ</span>
        </p>
        <p className="text-[9px] text-slate-400 mt-4 font-normal uppercase tracking-widest">
          Kỳ trước: {prevInsights.exp.toLocaleString()} đ
        </p>
      </div>

      <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
        <div className="flex items-center justify-between mb-8">
          <div className="p-5 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform duration-500">
            <Activity className="w-7 h-7" />
          </div>
          <div className="text-right">
            <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest block">
              EBT Margin
            </span>
            <div className="flex items-center justify-end text-blue-500 gap-1 font-normal text-xs mt-1">
              <span>
                {insights.periodRev > 0
                  ? ((insights.periodProfit / insights.periodRev) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
        <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-[0.25em] mb-2">
          Lợi nhuận trước thuế
        </h4>
        <p className="text-4xl font-normal text-slate-900 tracking-tighter leading-none">
          {insights.periodProfit.toLocaleString()}
          <span className="text-sm ml-1 text-slate-400 font-normal">đ</span>
        </p>
        <p className="text-[9px] text-slate-400 mt-4 font-normal uppercase tracking-widest">
          Sức khỏe tài chính
        </p>
      </div>

      <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
        <div className="flex items-center justify-between mb-8">
          <div className="p-5 rounded-2xl bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform duration-500">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="text-right">
            <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest block">
              Net Profit
            </span>
            <div className="flex items-center justify-end text-teal-500 gap-1 font-normal text-xs mt-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>
                {prevInsights.profit !== 0
                  ? (
                      ((insights.periodProfit - prevInsights.profit) /
                        Math.abs(prevInsights.profit)) *
                      100
                    ).toFixed(0)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
        <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-[0.25em] mb-2">
          Lợi nhuận ròng
        </h4>
        <p
          className={`text-4xl font-normal tracking-tighter leading-none ${
            insights.periodProfit >= 0 ? 'text-teal-600' : 'text-rose-600'
          }`}
        >
          {insights.periodProfit.toLocaleString()}
          <span className="text-sm ml-1 opacity-50 font-normal">đ</span>
        </p>
        <div className="flex items-center gap-1.5 mt-4">
          <div
            className={`w-2 h-2 rounded-full ${insights.periodProfit >= 0 ? 'bg-teal-500 animate-pulse' : 'bg-rose-500'}`}
          />
          <span className="text-[9px] font-normal text-slate-400 uppercase tracking-[0.1em]">
            {insights.periodProfit >= 0 ? 'Có lãi' : 'Đang lỗ'}
          </span>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xs font-semibold text-slate-400 uppercase tracking-[0.25em]">
            Báo cáo P&L
          </h3>
          <p className="text-xl font-normal text-slate-900 mt-1">Kết quả Kinh doanh</p>
        </div>
        <div
          className={`px-4 py-2 rounded-2xl text-xs font-normal uppercase tracking-wider ${
            insights.periodProfit >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {insights.netProfitMargin.toFixed(1)}% Biên LN
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-stretch gap-2">
        <div className="flex-1 bg-emerald-50 rounded-2xl p-5">
          <p className="text-[9px] font-normal text-emerald-600 uppercase tracking-widest mb-2">
            Doanh thu
          </p>
          <p className="text-2xl font-normal text-emerald-700 tracking-tighter">
            {(insights.periodRev / 1e6).toFixed(1)}
            <span className="text-sm font-normal ml-1">M đ</span>
          </p>
          <div className="mt-3 h-1 bg-emerald-200 rounded-full">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>
        <div className="flex items-center justify-center text-slate-300 font-normal text-xl shrink-0 px-1">
          −
        </div>
        <div className="flex-1 bg-orange-50 rounded-2xl p-5">
          <p className="text-[9px] font-normal text-orange-600 uppercase tracking-widest mb-2">
            Giá vốn (COGS)
          </p>
          <p className="text-2xl font-normal text-orange-700 tracking-tighter">
            {(insights.totalCogs / 1e6).toFixed(1)}
            <span className="text-sm font-normal ml-1">M đ</span>
          </p>
          <div className="mt-3 h-1 bg-orange-200 rounded-full">
            <div
              className="h-full bg-orange-500 rounded-full"
              style={{
                width: `${insights.periodRev > 0 ? Math.min(100, (insights.totalCogs / insights.periodRev) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-center text-slate-300 font-normal text-xl shrink-0 px-1">
          −
        </div>
        <div className="flex-1 bg-rose-50 rounded-2xl p-5">
          <p className="text-[9px] font-normal text-rose-600 uppercase tracking-widest mb-2">
            Chi phí OPEX
          </p>
          <p className="text-2xl font-normal text-rose-700 tracking-tighter">
            {(insights.nonPayrollExp / 1e6).toFixed(1)}
            <span className="text-sm font-normal ml-1">M đ</span>
          </p>
          <div className="mt-3 h-1 bg-rose-200 rounded-full">
            <div
              className="h-full bg-rose-500 rounded-full"
              style={{
                width: `${insights.periodRev > 0 ? Math.min(100, (insights.nonPayrollExp / insights.periodRev) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-center text-slate-300 font-normal text-xl shrink-0 px-1">
          −
        </div>
        <div className="flex-1 bg-violet-50 rounded-2xl p-5">
          <p className="text-[9px] font-normal text-violet-600 uppercase tracking-widest mb-2">
            Lương & Thưởng
          </p>
          <p className="text-2xl font-normal text-violet-700 tracking-tighter">
            {(insights.payrollTotal / 1e6).toFixed(1)}
            <span className="text-sm font-normal ml-1">M đ</span>
          </p>
          <div className="mt-3 h-1 bg-violet-200 rounded-full">
            <div
              className="h-full bg-violet-500 rounded-full"
              style={{
                width: `${insights.periodRev > 0 ? Math.min(100, (insights.payrollTotal / insights.periodRev) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-center text-slate-300 font-normal text-xl shrink-0 px-1">
          =
        </div>
        <div
          className={`flex-1 rounded-2xl p-5 ${insights.periodProfit >= 0 ? 'bg-teal-50' : 'bg-rose-100'}`}
        >
          <p
            className={`text-[9px] font-normal uppercase tracking-widest mb-2 ${
              insights.periodProfit >= 0 ? 'text-teal-600' : 'text-rose-600'
            }`}
          >
            Lợi nhuận ròng
          </p>
          <p
            className={`text-2xl font-normal tracking-tighter ${
              insights.periodProfit >= 0 ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            {(insights.periodProfit / 1e6).toFixed(1)}
            <span className="text-sm font-normal ml-1">M đ</span>
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${insights.periodProfit >= 0 ? 'bg-teal-500 animate-pulse' : 'bg-rose-500'}`}
            />
            <span
              className={`text-[9px] font-normal uppercase tracking-wider ${
                insights.periodProfit >= 0 ? 'text-teal-600' : 'text-rose-600'
              }`}
            >
              {insights.periodProfit >= 0 ? 'Có lãi' : 'Đang lỗ'}
            </span>
          </div>
        </div>
      </div>
    </div>

    <DailyBreakEven
      revenue={revenue}
      targetDate={targetDate}
      config={{
        monthlyFixedCosts:
          breakEvenAnalysis?.dailyFixedCost *
            new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() ||
          dailyBreakEvenConfig?.monthlyFixedCosts ||
          50000000,
        grossMarginPercent:
          breakEvenAnalysis?.avgGrossMargin * 100 || dailyBreakEvenConfig?.grossMarginPercent || 35,
      }}
      onUpdateConfig={newConfig => onUpdateData('dailyBreakEvenConfig', newConfig)}
      autoCalculated={!!breakEvenAnalysis}
    />
  </div>
);
