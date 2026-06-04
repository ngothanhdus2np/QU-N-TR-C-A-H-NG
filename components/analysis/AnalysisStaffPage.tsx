import React, { useMemo } from 'react';
import { Award, Fingerprint, PieChart, Target, TrendingUp, Users } from 'lucide-react';
import { Cell, Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AppData, Employee } from '../../types';
import {
  calculateMarketingPerformance,
  calculateStaffProductivity,
} from '../../src/lib';

const formatNumber = (num: number) => (num || 0).toLocaleString('vi-VN');

const isResignedStrict = (emp: Employee) => {
  const resignedDate = emp.resignedDate;
  return !!(resignedDate && String(resignedDate).trim() !== '');
};

const AnalyticsCard: React.FC<{
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'emerald' | 'indigo' | 'amber' | 'rose' | 'blue';
  desc: string;
}> = ({ title, value, icon: Icon, color, desc }) => {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl transition-all hover:scale-105">
      <div className={`p-4 rounded-2xl ${colorMap[color]} w-fit mb-6 shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1">
        {title}
      </p>
      <h4 className="text-2xl font-normal text-slate-900 tabular-nums">{value}</h4>
      <p className="text-[9px] text-slate-400 font-normal mt-3 uppercase tracking-tighter leading-relaxed">
        {desc}
      </p>
    </div>
  );
};

interface Props {
  data: AppData;
}

const AnalysisStaffPage: React.FC<Props> = ({ data }) => {
  const activeEmployees = useMemo(
    () =>
      (data.employees || [])
        .filter(employee => !isResignedStrict(employee))
        .sort((a, b) => (b.joinDate || '').localeCompare(a.joinDate || '')),
    [data.employees]
  );

  const staffAnalytics = useMemo(
    () => calculateStaffProductivity(activeEmployees, data.revenue || []),
    [activeEmployees, data.revenue]
  );

  const marketingPerf = useMemo(() => {
    const filteredData = { ...data, employees: activeEmployees };
    return calculateMarketingPerformance(filteredData);
  }, [activeEmployees, data]);

  const funnelData = useMemo(
    () => [
      {
        name: 'Doanh số tư vấn (B)',
        value: marketingPerf.activeRPE * (activeEmployees.length || 1),
        color: '#6366f1',
      },
      { name: 'Khách tự mua (GAP)', value: marketingPerf.selfServiceGap, color: '#f1f5f9' },
    ],
    [marketingPerf, activeEmployees]
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5">
      <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnalyticsCard
            title="Năng suất RPE"
            value={`${formatNumber(Math.round(staffAnalytics?.currentRPE || 0))} đ`}
            icon={TrendingUp}
            color="emerald"
            desc="Trung bình doanh thu / Nhân viên"
          />
          <AnalyticsCard
            title="Tỷ lệ Bao phủ"
            value={`${(marketingPerf?.coverageRatio || 0).toFixed(1)}%`}
            icon={Fingerprint}
            color="blue"
            desc="Doanh số có nhân viên tư vấn"
          />
          <AnalyticsCard
            title="KPI Chiến Thần (Max)"
            value={`${formatNumber(Math.round(marketingPerf?.kpiMax || 0))} đ`}
            icon={Award}
            color="indigo"
            desc="Mục tiêu bùng nổ của Top 20%"
          />
          <AnalyticsCard
            title="Headcount"
            value={activeEmployees.length.toString()}
            icon={Users}
            color="amber"
            desc="Tổng quy mô nhân sự hệ thống"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          <div className="lg:col-span-4 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col">
            <h3 className="text-xl font-semibold text-slate-900 mb-8 uppercase flex items-center gap-4">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
                <PieChart className="w-5 h-5" />
              </div>
              ĐỐI SOÁT TƯ VẤN
            </h3>
            <div className="h-64 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={funnelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${formatNumber(v)}đ`} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900 mb-8 uppercase flex items-center gap-4">
              <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg">
                <Target className="w-5 h-5" />
              </div>
              THƯỚC ĐO HIỆU NĂNG CÁ NHÂN
            </h3>
            <div className="space-y-8 max-h-[400px] overflow-y-auto pr-4 no-scrollbar">
              {marketingPerf?.staffPerformance.map((perf: any) => (
                <div key={perf.id} className="space-y-2 group/staff">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-sm font-normal text-slate-800 uppercase">
                        {perf.name}
                      </span>
                      <p className="text-2xs text-slate-400 font-normal">
                        Thực đạt: {formatNumber(perf.amount)}đ
                      </p>
                    </div>
                    <div className="text-right">
                      {perf.status === 'Elite' && (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-normal uppercase tracking-widest">
                          Elite Player
                        </span>
                      )}
                      {perf.status === 'Under' && (
                        <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-normal uppercase tracking-widest">
                          Action Needed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        perf.amount < (marketingPerf?.kpiMin || 0)
                          ? 'bg-rose-50'
                          : 'bg-emerald-50'
                      }`}
                      style={{
                        width: `${Math.min((perf.amount / (marketingPerf?.kpiMax || 1)) * 100, 100)}%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                      style={{
                        left: `${((marketingPerf?.kpiMin || 0) / (marketingPerf?.kpiMax || 1)) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisStaffPage;
