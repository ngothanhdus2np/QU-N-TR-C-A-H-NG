import React from 'react';
import DOMPurify from 'dompurify';
import { BrainCircuit, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import { marked } from 'marked';

interface DashboardAiAdvisorProps {
  isDiagnosing: boolean;
  diagnosisResult: string | null;
  onRunExecutiveBriefing: () => void;
}

export const DashboardAiAdvisor: React.FC<DashboardAiAdvisorProps> = ({
  isDiagnosing,
  diagnosisResult,
  onRunExecutiveBriefing,
}) => (
  <div className="animate-in fade-in zoom-in-95 duration-500">
    <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200 relative overflow-hidden text-slate-900 flex flex-col min-h-[600px]">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-8 text-indigo-600 font-black uppercase text-[12px] tracking-[0.4em]">
          <BrainCircuit className="w-6 h-6" /> AI CFO Advisor
        </div>
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-8">
          Phân tích chiến lược
        </h2>

        <button
          onClick={onRunExecutiveBriefing}
          disabled={isDiagnosing}
          className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-4 disabled:opacity-50 mb-10"
        >
          {isDiagnosing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 text-indigo-400" />
          )}
          {isDiagnosing ? 'Đang phân tích...' : 'Phân tích dữ liệu giai đoạn này'}
        </button>

        <div className="flex-1 bg-slate-50 rounded-[2rem] p-10 border border-slate-200 overflow-y-auto no-scrollbar">
          {diagnosisResult ? (
            <div
              className="markdown-content text-slate-700 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(marked.parse(diagnosisResult) as string),
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <Lightbulb className="w-12 h-12 mb-6 text-slate-400" />
              <p className="text-[12px] font-black uppercase tracking-widest text-slate-500">
                Nhấn nút bên trên để nhận phân tích từ AI
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
