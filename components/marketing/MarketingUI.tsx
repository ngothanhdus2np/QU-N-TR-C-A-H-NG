
import React from 'react';
import { 
  Camera, 
  Globe
} from 'lucide-react';
import { STRATEGY_COLORS } from '../../constants/marketing';
import { ContentPlanItem, ContentStrategy } from '../../types';

export const SkeletonPost = () => (
  <div className="animate-pulse bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col gap-4">
    <div className="flex justify-between">
      <div className="h-4 w-20 bg-slate-100 rounded"></div>
      <div className="h-4 w-16 bg-slate-100 rounded-full"></div>
    </div>
    <div className="h-6 w-3/4 bg-slate-200 rounded"></div>
    <div className="h-32 bg-slate-50 rounded-2xl"></div>
    <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
  </div>
);

interface StrategyBadgeProps {
  type: string;
  strategies: ContentStrategy[];
}

export const StrategyBadge: React.FC<StrategyBadgeProps> = ({ type, strategies }) => {
  const strategy = strategies.find(s => s.name === type);
  const style = strategy ? STRATEGY_COLORS[strategy.color] : STRATEGY_COLORS['slate'];
  return (
    <span className={`text-[8px] md:text-[9px] font-normal px-2 py-0.5 rounded-full border w-fit uppercase tracking-tighter ${style.bg} ${style.text} ${style.border}`}>
      {type}
    </span>
  );
};

export const FacebookPreview: React.FC<{ post: ContentPlanItem, brandLogo?: string }> = ({ post, brandLogo }) => (
  <div className="w-full max-w-[550px] bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden text-[#050505]">
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-normal text-xs border border-slate-100 shadow-sm overflow-hidden shrink-0">
          {brandLogo ? <img src={brandLogo} className="w-full h-full object-cover" /> : "PS"}
        </div>
        <div className="flex flex-col">
          <span className="text-[14px] font-normal leading-tight">Giày Dép Phúc Sang</span>
          <div className="flex items-center gap-1 text-[12px] text-[#65676b] font-normal">
            <span>{post.date.split('-').reverse().join('/')}</span> • <Globe size={12}/>
          </div>
        </div>
      </div>
    </div>
    <div className="px-4 pb-3">
      <h3 className="font-normal text-[15px] mb-1">{post.topic}</h3>
      <div className="text-[15px] whitespace-pre-wrap leading-snug">{post.caption}</div>
    </div>
    <div className="bg-slate-50 min-h-[300px] flex items-center justify-center overflow-hidden border-t border-slate-100 relative">
      {post.image ? (
        <img src={post.image} className="w-full h-auto object-cover" alt="Preview" />
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-10 gap-4">
          <Camera size={60} className="text-slate-200" />
          <div>
            <span className="text-[10px] font-normal text-indigo-600 uppercase tracking-widest mb-1 block">Gợi ý chụp ảnh</span>
            <p className="text-xs text-slate-400 italic font-normal leading-relaxed max-w-[280px]">
              {post.imageInstruction}
            </p>
          </div>
        </div>
      )}
    </div>
  </div>
);
