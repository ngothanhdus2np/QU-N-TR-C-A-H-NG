import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Settings,
  Sparkles,
} from 'lucide-react';
import { RevenueSubTab } from '../../types';

interface RevenueSubTabNavProps {
  activeSubTab: RevenueSubTab;
  isShopee?: boolean;
  hiddenSubTabs?: RevenueSubTab[];
  diagnosisLabel?: string;
  onChangeSubTab: (tab: RevenueSubTab) => void;
}

const getButtonClass = (isActive: boolean, activeColor: string, isShopee?: boolean) =>
  `flex h-9 items-center gap-2 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors ${
    isActive
      ? `border border-slate-200 bg-white ${activeColor} shadow-sm`
      : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
  }`;

export const RevenueSubTabNav: React.FC<RevenueSubTabNavProps> = ({
  activeSubTab,
  isShopee,
  hiddenSubTabs = [],
  diagnosisLabel = 'Siêu Chẩn Đoán',
  onChangeSubTab,
}) => {
  const isHidden = (tab: RevenueSubTab) => hiddenSubTabs.includes(tab);

  return (
    <div className="flex w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
      {isShopee ? (
        <>
          {!isHidden('diagnosis') && (
            <button
              onClick={() => onChangeSubTab('diagnosis')}
              className={getButtonClass(activeSubTab === 'diagnosis', 'text-blue-600', isShopee)}
            >
              <Sparkles className="w-4 h-4" /> {diagnosisLabel}
            </button>
          )}
          <button
            onClick={() => onChangeSubTab('source')}
            className={getButtonClass(activeSubTab === 'source', 'text-emerald-600', isShopee)}
          >
            <Database className="w-4 h-4" /> Dữ liệu nguồn
          </button>
          <button
            onClick={() => onChangeSubTab('costs')}
            className={getButtonClass(activeSubTab === 'costs', 'text-amber-600', isShopee)}
          >
            <Settings className="w-4 h-4" /> Chi phí
          </button>
          <button
            onClick={() => onChangeSubTab('inventory_in')}
            className={getButtonClass(activeSubTab === 'inventory_in', 'text-sky-600', isShopee)}
          >
            <ArrowDownToLine className="w-4 h-4" /> Nhập kho
          </button>
          <button
            onClick={() => onChangeSubTab('inventory_out')}
            className={getButtonClass(activeSubTab === 'inventory_out', 'text-rose-600', isShopee)}
          >
            <ArrowUpFromLine className="w-4 h-4" /> Xuất kho
          </button>
          <button
            onClick={() => onChangeSubTab('report')}
            className={getButtonClass(activeSubTab === 'report', 'text-indigo-600', isShopee)}
          >
            <ClipboardList className="w-4 h-4" /> Báo cáo
          </button>
        </>
      ) : (
        <>
          {!isHidden('diagnosis') && (
            <button
              onClick={() => onChangeSubTab('diagnosis')}
              className={getButtonClass(activeSubTab === 'diagnosis', 'text-blue-600')}
            >
              <Sparkles className="w-4 h-4" /> {diagnosisLabel}
            </button>
          )}
          <button
            onClick={() => onChangeSubTab('ledger')}
            className={getButtonClass(activeSubTab === 'ledger', 'text-indigo-600')}
          >
            <FileSpreadsheet className="w-4 h-4" /> Sổ Cái Doanh Thu
          </button>
        </>
      )}
    </div>
  );
};
