import React from 'react';
import DOMPurify from 'dompurify';
import { FileText, X as XIcon } from 'lucide-react';
import { marked } from 'marked';

interface DashboardEodBannerProps {
  report: { date: string; summary: string };
  onDismiss: () => void;
}

export const DashboardEodBanner: React.FC<DashboardEodBannerProps> = ({ report, onDismiss }) => (
  <div className="mb-6 mt-4 p-5 bg-indigo-50 border border-indigo-100 rounded-[2rem] flex gap-4 items-start">
    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
      <FileText className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-normal text-indigo-500 uppercase tracking-widest mb-1">
        Báo cáo hôm qua — {report.date}
      </p>
      <div
        className="text-sm text-slate-700 leading-relaxed markdown-content"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(marked.parse(report.summary) as string),
        }}
      />
    </div>
    <button
      onClick={onDismiss}
      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-indigo-100 rounded-lg transition-all shrink-0"
    >
      <XIcon className="w-4 h-4" />
    </button>
  </div>
);
