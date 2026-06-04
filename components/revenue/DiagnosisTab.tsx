import React from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  DollarSign, Target, Zap, ShieldAlert, PieChart as PieChartIcon,
  Sparkles, Loader2, Activity, TrendingUp, FileText, X,
} from 'lucide-react';
import { MetricCard } from './helpers';

interface RevenueAnalytics {
  totalRev: number;
  totalDisc: number;
  totalRet: number;
  totalCogs: number;
  leakRatio: number;
  margin: number;
  salesVelocity: number;
  netProfit: number;
  daysCount: number;
  totalGrossBeforeLeak: number;
}

interface Props {
  revenueAnalytics: RevenueAnalytics | null;
  structureData: { name: string; value: number; color: string }[];
  formatNumber: (num: number) => string;
  runRevenueDiagnosis: () => Promise<void>;
  isDiagnosing: boolean;
  diagnosisResult: string | null;
  setDiagnosisResult: (result: string | null) => void;
}

const DiagnosisTab: React.FC<Props> = ({
  revenueAnalytics, structureData, formatNumber, runRevenueDiagnosis, isDiagnosing, diagnosisResult, setDiagnosisResult,
}) => (
  <div className="space-y-10 animate-in fade-in duration-700">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard title="Doanh thu thực nhận" value={formatNumber(revenueAnalytics?.totalRev || 0) + 'đ'} icon={DollarSign} color="indigo" desc={`Tổng thu trong khoảng lọc`} />
      <MetricCard title="Biên lợi nhuận gộp" value={(revenueAnalytics?.margin || 0).toFixed(1) + '%'} icon={Target} color="emerald" desc="Hiệu suất sinh lời dòng tiền" />
      <MetricCard title="Vận tốc doanh thu" value={formatNumber(revenueAnalytics?.salesVelocity || 0) + 'đ'} icon={Zap} color="sky" desc="Doanh thu trung bình mỗi ngày" />
      <MetricCard title="Tỷ lệ Rò rỉ (Leakage)" value={(revenueAnalytics?.leakRatio || 0).toFixed(1) + '%'} icon={ShieldAlert} color={(revenueAnalytics?.leakRatio || 0) > 10 ? "rose" : "emerald"} desc="Thất thoát do chiết khấu & trả hàng" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
      <div className="lg:col-span-6 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
        <h3 className="text-xl font-semibold text-slate-900 mb-8 uppercase flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><PieChartIcon className="w-5 h-5" /></div>
          CẤU TRÚC DÒNG TIỀN DOANH THU
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={structureData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                {structureData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => formatNumber(v) + 'đ'} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col">
        <div className="absolute top-0 right-0 p-10 opacity-10"><Sparkles className="w-32 h-32" /></div>
        <h3 className="text-xl font-semibold uppercase tracking-tight mb-8 flex items-center gap-4 relative z-10">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Activity className="w-6 h-6" /></div>
          REVENUE AI ADVISOR
        </h3>
        <div className="space-y-6 flex-1 relative z-10">
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-4">
            <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-xl"><TrendingUp className="w-5 h-5" /></div>
            <div><h5 className="text-sm font-semibold text-emerald-400 uppercase">Tối ưu biên gộp</h5><p className="text-xs text-slate-300 mt-1 leading-relaxed">Biên lợi nhuận trong khoảng này là {(revenueAnalytics?.margin || 0).toFixed(1)}%.</p></div>
          </div>
        </div>
        <div className="mt-10 pt-8 border-t border-white/10 relative z-10">
          <button onClick={runRevenueDiagnosis} disabled={isDiagnosing || !revenueAnalytics} className="w-full px-8 py-5 bg-indigo-600 hover:bg-blue-500 text-white rounded-3xl font-normal text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
            {isDiagnosing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isDiagnosing ? "Đang giải mã dữ liệu..." : "Bắt đầu Siêu Chẩn Đoán"}
          </button>
        </div>
      </div>
    </div>

    {diagnosisResult && (
      <div className="bg-white rounded-[3.5rem] p-12 shadow-2xl border border-slate-100 animate-in slide-in-from-top-4 duration-500">
        <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-8">
          <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><FileText className="w-6 h-6" /></div><h4 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">Báo Cáo Chẩn Đoán Doanh Thu</h4></div>
          <button onClick={() => setDiagnosisResult(null)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="markdown-content text-slate-800" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(diagnosisResult) as string) }} />
      </div>
    )}
  </div>
);

export default DiagnosisTab;
