import React from 'react';
import { BarChart3, X as XIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardTrendPoint } from '../../types';

interface DashboardTrendsPanelProps {
  monthlyTrendData: DashboardTrendPoint[];
  dailyTrendData: DashboardTrendPoint[];
  selectedTrendMonth: string | null;
  onSelectMonth: (month: string) => void;
  onClearMonth: () => void;
}

export const DashboardTrendsPanel: React.FC<DashboardTrendsPanelProps> = ({
  monthlyTrendData,
  dailyTrendData,
  selectedTrendMonth,
  onSelectMonth,
  onClearMonth,
}) => (
  <div className="animate-in fade-in zoom-in-95 duration-500">
    <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">
            Xu hướng Tài chính
          </h3>
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mt-1">
            Biến động Doanh thu & Lợi nhuận qua các tháng
          </p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
          <BarChart3 className="w-5 h-5" />
        </div>
      </div>

      <div className="h-[500px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={monthlyTrendData}
            margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
            onClick={data => {
              if (data?.activeLabel) {
                onSelectMonth(data.activeLabel);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
              tickFormatter={val => {
                const [y, m] = String(val).split('-');
                return `${m}/${y}`;
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              tickFormatter={v => (Number(v) / 1000000).toFixed(1) + 'M'}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '1.5rem',
                border: 'none',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
              }}
              formatter={(v: number) => v.toLocaleString() + 'đ'}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{
                fontSize: '10px',
                fontWeight: '900',
                textTransform: 'uppercase',
                paddingBottom: '20px',
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Doanh thu"
              stroke="#6366f1"
              strokeWidth={4}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="grossProfit"
              name="LN Gộp"
              stroke="#10b981"
              strokeWidth={4}
              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="netProfit"
              name="LN Ròng"
              stroke="#f43f5e"
              strokeWidth={4}
              dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {selectedTrendMonth && (
        <div className="mt-12 pt-12 border-t border-slate-100 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">
                Chi tiết tháng {selectedTrendMonth.split('-')[1]}/{selectedTrendMonth.split('-')[0]}
              </h4>
              <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mt-1">
                Biến động chi tiết theo từng ngày
              </p>
            </div>
            <button
              onClick={onClearMonth}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={val => String(val).split('-')[2]}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={v => (Number(v) / 1000000).toFixed(1) + 'M'}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '1rem',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(v: number) => v.toLocaleString() + 'đ'}
                  labelFormatter={label => {
                    const parts = String(label).split('-');
                    return `Ngày ${parts[2]}/${parts[1]}`;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Doanh thu"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
                <Area
                  type="monotone"
                  dataKey="grossProfit"
                  name="LN Gộp"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="netProfit"
                  name="LN Ròng"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  </div>
);
