import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Filter,
  Settings,
  Sparkles,
} from 'lucide-react';
import { RevenueSubTab } from '../../types';

interface RevenueSubTabNavProps {
  activeSubTab: RevenueSubTab;
  isShopee?: boolean;
  onChangeSubTab: (tab: RevenueSubTab) => void;
}

const getButtonClass = (isActive: boolean, activeColor: string, isShopee?: boolean) =>
  `flex items-center gap-2 ${isShopee ? 'px-6 py-3' : 'px-8 py-4'} rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
    isActive ? `bg-white ${activeColor} shadow-xl` : 'text-slate-400 hover:text-slate-600'
  }`;

export const RevenueSubTabNav: React.FC<RevenueSubTabNavProps> = ({
  activeSubTab,
  isShopee,
  onChangeSubTab,
}) => (
  <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200 gap-1">
    {isShopee ? (
      <>
        <button
          onClick={() => onChangeSubTab('diagnosis')}
          className={getButtonClass(activeSubTab === 'diagnosis', 'text-blue-600', isShopee)}
        >
          <Sparkles className="w-4 h-4" /> Siêu Chẩn Đoán
        </button>
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
        <button
          onClick={() => onChangeSubTab('diagnosis')}
          className={getButtonClass(activeSubTab === 'diagnosis', 'text-blue-600')}
        >
          <Sparkles className="w-4 h-4" /> Siêu Chẩn Đoán
        </button>
        <button
          onClick={() => onChangeSubTab('matrix')}
          className={getButtonClass(activeSubTab === 'matrix', 'text-emerald-600')}
        >
          <Filter className="w-4 h-4" /> Ma Trận Tài Chính
        </button>
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
