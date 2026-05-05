
import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Target, DollarSign, Settings, Save, AlertCircle, Sparkles } from 'lucide-react';
import { RevenueRecord, DailyBreakEvenConfig } from '../types';
import { calculateDailyBreakEven } from '../businessLogic';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface DailyBreakEvenProps {
  revenue: RevenueRecord[];
  config: DailyBreakEvenConfig;
  onUpdateConfig: (config: DailyBreakEvenConfig) => void;
  targetDate?: string;
  autoCalculated?: boolean;
}

const DailyBreakEven: React.FC<DailyBreakEvenProps> = ({ revenue, config, onUpdateConfig, targetDate, autoCalculated }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempConfig, setTempConfig] = useState(config);

  const stats = calculateDailyBreakEven(revenue, config, targetDate);

  const handleSave = () => {
    onUpdateConfig(tempConfig);
    setIsEditing(false);
  };

  const chartData = stats.trend.map(day => ({
    date: day.date.split('-')[2], // Just the day number
    fullDate: day.date,
    revenue: day.amount,
    profit: day.profit
  }));

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-indigo-50 w-fit px-3 py-1 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-wider">
            <Target size={12} /> Mục tiêu lợi nhuận
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Điểm hòa vốn hàng ngày</h2>
          {autoCalculated && (
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 mt-1 w-fit">
              <Sparkles className="w-3 h-3" /> DỮ LIỆU TỰ ĐỘNG THEO CHI PHÍ THÁNG
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
        >
          <Settings size={20} />
        </button>
      </div>

      {isEditing && (
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col md:flex-row gap-6 items-end animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tổng chi phí cố định / tháng</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="number"
                value={tempConfig.monthlyFixedCosts}
                onChange={(e) => setTempConfig({ ...tempConfig, monthlyFixedCosts: Number(e.target.value) })}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 font-bold transition-all"
                placeholder="Ví dụ: 50000000"
              />
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tỷ lệ lợi nhuận gộp (%)</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">%</div>
              <input 
                type="number"
                value={tempConfig.grossMarginPercent}
                onChange={(e) => setTempConfig({ ...tempConfig, grossMarginPercent: Number(e.target.value) })}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 font-bold transition-all"
                placeholder="Ví dụ: 35"
              />
            </div>
          </div>
          <button 
            onClick={handleSave}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Save size={18} /> Lưu cấu hình
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hòa vốn ngày</span>
          <div className="text-2xl font-black text-slate-900">
            {stats.dailyBreakEvenRevenue.toLocaleString('vi-VN')} <span className="text-xs text-slate-400">đ</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Cần đạt để bù đắp {stats.dailyFixedCost.toLocaleString('vi-VN')}đ chi phí</p>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doanh thu ngày chọn</span>
          <div className="text-2xl font-black text-indigo-600">
            {stats.currentRevenue.toLocaleString('vi-VN')} <span className="text-xs text-slate-400">đ</span>
          </div>
          <div className="flex items-center gap-2">
            {stats.isProfitable ? (
              <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase">
                <TrendingUp size={12} /> Đã có lãi
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600 text-[10px] font-black uppercase">
                <TrendingDown size={12} /> Chưa hòa vốn
              </div>
            )}
          </div>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày hòa vốn tháng</span>
          <div className="text-2xl font-black text-slate-900">
            {stats.breakEvenDay ? `Ngày ${stats.breakEvenDay}` : 'Chưa đạt'}
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-out ${stats.breakEvenDay ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min((stats.cumulativeProfit / (stats.monthlyFixedCosts || 1)) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-[9px] text-slate-400 font-medium">
            {stats.breakEvenDay 
              ? `Hòa vốn tại ngày ${stats.breakEvenDay}` 
              : `Đã đạt ${((stats.cumulativeProfit / (stats.monthlyFixedCosts || 1)) * 100).toFixed(1)}% chi phí tháng`}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Xu hướng doanh thu & lợi nhuận trong tháng</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
              />
              <YAxis 
                hide 
                domain={[0, 'auto']}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                formatter={(val: number) => val.toLocaleString('vi-VN') + 'đ'}
                labelFormatter={(label) => `Ngày ${label}`}
              />
              <Legend 
                verticalAlign="top" 
                align="right" 
                iconType="circle"
                wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', paddingBottom: '10px' }}
              />
              <ReferenceLine 
                y={stats.dailyBreakEvenRevenue} 
                stroke="#f43f5e" 
                strokeDasharray="3 3" 
                label={{ position: 'right', value: 'Hòa vốn', fill: '#f43f5e', fontSize: 8, fontWeight: 900 }} 
              />
              <Bar dataKey="revenue" name="Doanh thu" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Lợi nhuận" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!stats.isProfitable && stats.dailyBreakEvenRevenue > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3 text-amber-700">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-xs font-medium">
            Bạn cần thêm <span className="font-black">{(stats.dailyBreakEvenRevenue - stats.currentRevenue).toLocaleString('vi-VN')}đ</span> doanh thu nữa để bắt đầu có lợi nhuận trong ngày này.
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyBreakEven;
