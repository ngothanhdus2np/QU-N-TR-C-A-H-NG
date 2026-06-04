import React from 'react';
import DOMPurify from 'dompurify';
import { BarChart3, BrainCircuit, DollarSign, Loader2, Sparkles, Target } from 'lucide-react';
import { marked } from 'marked';

interface PromotionAiPanelProps {
  totalBudget: number;
  totalTarget: number;
  avgROI: string;
  aiAnalysis: string;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
}

const PromotionAiPanel: React.FC<PromotionAiPanelProps> = ({
  totalBudget,
  totalTarget,
  avgROI,
  aiAnalysis,
  isAnalyzing,
  onRunAnalysis,
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-normal text-slate-500 uppercase tracking-wider">Tổng Ngân Sách Năm</p>
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <h3 className="text-2xl font-normal text-slate-900">{totalBudget.toLocaleString()}đ</h3>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-normal text-slate-500 uppercase tracking-wider">Mục Tiêu Doanh Thu</p>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <h3 className="text-2xl font-normal text-slate-900">{totalTarget.toLocaleString()}đ</h3>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-normal text-slate-500 uppercase tracking-wider">ROI Dự Kiến Trung Bình</p>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <BarChart3 className="w-4 h-4" />
          </div>
        </div>
        <h3 className="text-2xl font-normal text-slate-900">{avgROI}x</h3>
      </div>
    </div>

    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Cố vấn Chiến lược Khuyến mãi (AI)</h3>
            <p className="text-sm text-slate-500">Phân tích dữ liệu thực tế để tối ưu hóa ROI</p>
          </div>
        </div>
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-normal text-xs uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-200"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {aiAnalysis ? 'Phân tích lại chiến lược' : 'Bắt đầu phân tích chiến lược'}
        </button>
      </div>

      {isAnalyzing ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-200" />
          <p className="italic animate-pulse">CFO AI đang quét dữ liệu doanh thu và chi phí...</p>
        </div>
      ) : aiAnalysis ? (
        <div className="prose prose-slate max-w-none prose-headings:font-normal prose-headings:text-slate-900 prose-p:text-slate-600 prose-strong:text-indigo-600">
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(aiAnalysis) as string) }} />
        </div>
      ) : (
        <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
          <Sparkles className="w-12 h-12 text-indigo-200 mx-auto mb-4" />
          <p className="text-slate-500 font-normal mb-2">Sẵn sàng phân tích dữ liệu của bạn</p>
          <p className="text-slate-400 text-xs italic mb-6">Nhấn nút phía trên để nhận gợi ý chiến lược từ CFO AI</p>
          <button
            onClick={onRunAnalysis}
            className="px-8 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-normal text-xs uppercase tracking-widest hover:bg-indigo-50 transition-colors"
          >
            Bắt đầu ngay
          </button>
        </div>
      )}
    </div>
  </div>
);

export default PromotionAiPanel;
