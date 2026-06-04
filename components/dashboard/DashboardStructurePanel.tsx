import React from 'react';
import { BarChart3, ChevronRight, PieChart as PieChartIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DashboardDetailedExpense,
  DashboardExpenseSlice,
  DashboardFinancialInsights,
  DashboardWaterfallItem,
} from '../../types';

interface DashboardStructurePanelProps {
  waterfallData: DashboardWaterfallItem[];
  expensePieData: DashboardExpenseSlice[];
  detailedExpenses: DashboardDetailedExpense[];
  selectedParentCategory: string | null;
  colors: string[];
  insights: DashboardFinancialInsights;
  onSelectParentCategory: (category: string) => void;
  onClearParentCategory: () => void;
}

export const DashboardStructurePanel: React.FC<DashboardStructurePanelProps> = ({
  waterfallData,
  expensePieData,
  detailedExpenses,
  selectedParentCategory,
  colors,
  insights,
  onSelectParentCategory,
  onClearParentCategory,
}) => (
  <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
    <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">
            Thác đổ dòng tiền P&L
          </h3>
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mt-1">
            Phân tích dòng tiền từ doanh thu đến lợi nhuận ròng
          </p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
          <BarChart3 className="w-5 h-5" />
        </div>
      </div>
      <div className="h-[500px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waterfallData} margin={{ top: 40, right: 30, left: 40, bottom: 120 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              tickFormatter={v => (Number(v) / 1000000).toFixed(1) + 'M'}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{
                borderRadius: '1.5rem',
                border: 'none',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
              }}
              formatter={(v: [number, number]) => {
                const val = Math.abs(v[1] - v[0]);
                return [val.toLocaleString() + 'đ', 'Giá trị'];
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} minPointSize={2}>
              {waterfallData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="label"
                position="top"
                style={{ fill: '#64748b', fontSize: '10px', fontWeight: 'bold' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-xl flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">
            Phân bổ chi phí
          </h3>
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mt-1">
            Cơ cấu chi tiêu theo nhóm cha
          </p>
        </div>
        <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
          <PieChartIcon className="w-5 h-5" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-10">
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expensePieData}
                cx="50%"
                cy="50%"
                innerRadius={100}
                outerRadius={140}
                paddingAngle={5}
                dataKey="value"
                onClick={data => onSelectParentCategory(data.name)}
                className="cursor-pointer"
              >
                {expensePieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                    stroke={selectedParentCategory === entry.name ? '#000' : 'none'}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '1rem',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
                formatter={(val: number) => val.toLocaleString() + 'đ'}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3 overflow-y-auto no-scrollbar pr-2 max-h-[400px]">
          {expensePieData.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onSelectParentCategory(item.name)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-colors ${
                selectedParentCategory === item.name
                  ? 'bg-rose-50 border-rose-200 shadow-md'
                  : 'bg-slate-50 border-transparent hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <span className="text-xs font-normal text-slate-700 uppercase truncate max-w-[150px]">
                  {item.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-normal text-slate-900 block">
                  {item.value.toLocaleString()}đ
                </span>
                <span className="text-2xs font-normal text-slate-400">
                  {((item.value / (insights.periodExp || 1)) * 100).toFixed(1)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedParentCategory && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-rose-500" />
              Chi tiết nhóm: {selectedParentCategory}
            </h4>
            <button
              onClick={onClearParentCategory}
              className="text-2xs font-normal text-slate-400 uppercase hover:text-slate-600"
            >
              Đóng chi tiết
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest">
                    Ngày
                  </th>
                  <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest">
                    Danh mục
                  </th>
                  <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest">
                    Nội dung
                  </th>
                  <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest text-right">
                    Số tiền
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {detailedExpenses.length > 0 ? (
                  detailedExpenses.map((exp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-normal text-slate-500">{exp.date}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-normal uppercase">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-normal text-slate-700">
                        {exp.description}
                      </td>
                      <td className="px-6 py-4 text-xs font-normal text-slate-900 text-right">
                        {exp.amount.toLocaleString()}đ
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-slate-400 font-normal uppercase text-2xs"
                    >
                      Không có dữ liệu chi tiết
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </div>
);
