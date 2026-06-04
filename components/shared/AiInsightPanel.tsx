import React from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Sparkles, Loader2, BrainCircuit } from 'lucide-react';

interface Props {
  isLoading: boolean;
  result: string | null;
  onRun: () => void;
  label?: string;
  fromCache?: boolean;
}

export const AiInsightPanel: React.FC<Props> = ({
  isLoading,
  result,
  onRun,
  label = 'Phân tích AI',
  fromCache = false,
}) => {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">AI Insight</span>
          {fromCache && result && (
            <span className="text-[9px] bg-indigo-100 text-indigo-500 px-2 py-0.5 rounded-full">Từ cache</span>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {isLoading ? 'Đang phân tích...' : label}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-indigo-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          AI đang đọc số liệu và phân tích...
        </div>
      )}

      {!isLoading && result && (
        <div
          className="prose prose-sm max-w-none text-slate-700 prose-headings:text-indigo-800 prose-strong:text-slate-800 prose-li:marker:text-indigo-400"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(marked.parse(result) as string),
          }}
        />
      )}

      {!isLoading && !result && (
        <p className="text-xs text-indigo-400 py-2">
          Bấm nút để AI phân tích số liệu hiện tại và đưa ra nhận xét.
        </p>
      )}
    </div>
  );
};
