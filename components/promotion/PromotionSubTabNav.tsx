import React from 'react';
import { Library, MessageSquareText, Plus } from 'lucide-react';

export type PromotionSubTab = 'ai' | 'setup' | 'ledger';

interface PromotionSubTabNavProps {
  activeSubTab: PromotionSubTab;
  onChange: (tab: PromotionSubTab) => void;
}

const tabs: Array<{
  id: PromotionSubTab;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'ai', label: 'Phân tích & Gợi ý (AI)', icon: <MessageSquareText className="w-4 h-4" /> },
  { id: 'setup', label: 'Thiết lập chương trình', icon: <Plus className="w-4 h-4" /> },
  { id: 'ledger', label: 'Sổ cái khuyến mãi', icon: <Library className="w-4 h-4" /> },
];

const PromotionSubTabNav: React.FC<PromotionSubTabNavProps> = ({ activeSubTab, onChange }) => (
  <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200 mb-10">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
          activeSubTab === tab.id ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        {tab.icon} {tab.label}
      </button>
    ))}
  </div>
);

export default PromotionSubTabNav;
