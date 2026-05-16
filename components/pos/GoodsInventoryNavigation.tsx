import React from 'react';
import { Search } from 'lucide-react';

type GoodsTab = 'goods' | 'purchase' | 'kho' | 'pricing' | 'warranty' | 'audit_form' | 'product_form';

interface GoodsInventoryTabBarProps {
  activeTab: GoodsTab;
  setActiveTab: React.Dispatch<React.SetStateAction<GoodsTab>>;
  setShowPurchaseForm: React.Dispatch<React.SetStateAction<boolean>>;
}

interface GoodsInventorySecondaryToolbarProps {
  activeTab: GoodsTab;
  showPurchaseForm: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onStartAudit: (mode: 'actual' | 'damaged') => void;
  setShowPurchaseForm: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GoodsInventoryTabBar: React.FC<GoodsInventoryTabBarProps> = ({
  activeTab,
  setActiveTab,
  setShowPurchaseForm,
}) => (
  <div className="flex bg-white rounded-2xl shadow-sm border border-slate-200 p-1.5 w-fit shrink-0 gap-1">
    <button
      onClick={() => setActiveTab('goods')}
      className={`px-6 py-2.5 rounded-xl text-[11px] font-normal uppercase tracking-widest transition-all ${activeTab === 'goods' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
    >
      Danh mục hàng
    </button>
    <button
      onClick={() => {
        setActiveTab('purchase');
        setShowPurchaseForm(false);
      }}
      className={`px-6 py-2.5 rounded-xl text-[11px] font-normal uppercase tracking-widest transition-all ${activeTab === 'purchase' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
    >
      Nhập hàng (F2)
    </button>
    <button
      onClick={() => setActiveTab('kho')}
      className={`px-6 py-2.5 rounded-xl text-[11px] font-normal uppercase tracking-widest transition-all ${activeTab === 'kho' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
    >
      Số dư tồn kho
    </button>
  </div>
);

export const GoodsInventorySecondaryToolbar: React.FC<GoodsInventorySecondaryToolbarProps> = ({
  activeTab,
  showPurchaseForm,
  searchTerm,
  onSearchChange,
  onStartAudit,
  setShowPurchaseForm,
}) => (
  <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 gap-6 mb-8">
    <div className="relative w-full md:w-80">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
      <input
        type="text"
        placeholder="Tìm hàng hóa, mã SKU..."
        className="w-full pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl outline-none text-sm font-normal border border-slate-200 focus:bg-white focus:border-indigo-400 transition-all placeholder:text-slate-300 shadow-inner"
        value={searchTerm}
        onChange={e => onSearchChange(e.target.value)}
      />
    </div>
    <div className="flex gap-3 w-full md:w-auto">
      {activeTab === 'purchase' && !showPurchaseForm && (
        <button
          onClick={() => setShowPurchaseForm(true)}
          className="flex-1 md:flex-none px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-normal text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-slate-950 transition-all"
        >
          + Phiếu nhập hàng
        </button>
      )}
      {activeTab === 'kho' && (
        <>
          <button
            onClick={() => onStartAudit('actual')}
            className="flex-1 md:flex-none px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-normal text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-950 transition-all"
          >
            + Phiếu kiểm kho
          </button>
          <button
            onClick={() => onStartAudit('damaged')}
            className="flex-1 md:flex-none px-8 py-3.5 bg-rose-600 text-white rounded-2xl font-normal text-[11px] uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-slate-950 transition-all"
          >
            + Phiếu trừ hàng lỗi/hư
          </button>
        </>
      )}
    </div>
  </div>
);
