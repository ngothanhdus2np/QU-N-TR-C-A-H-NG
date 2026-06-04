import React from 'react';
import { Activity, FolderTree, History, LayoutGrid, Loader2, Pencil, Plus, ShieldAlert, Sparkles, Trash2, TrendingDown } from 'lucide-react';
import { ExpenseCategory } from '../../types';

interface ExpenseCategoriesTabProps {
  categories: ExpenseCategory[];
  categoryTotals: Record<string, number>;
  fixedParent?: ExpenseCategory;
  variableParent?: ExpenseCategory;
  depreciationParent?: ExpenseCategory;
  interestParent?: ExpenseCategory;
  otherParents: ExpenseCategory[];
  isScanning: boolean;
  onSmartScan: () => void;
  setEditingCategory: (category: ExpenseCategory) => void;
  onDeleteCategory: (id: string) => void;
  setActiveParentId: (id: string) => void;
  onStartAddParent: () => void;
  formatNumber: (num: number) => string;
}

const colorClass = {
  fixed: {
    total: 'text-indigo-600',
    icon: 'bg-indigo-600',
    scan: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600',
    tree: 'text-indigo-400',
    amount: 'text-indigo-600',
    border: 'border-indigo-50',
    edit: 'hover:text-indigo-500',
    button: 'hover:border-indigo-200 hover:text-indigo-600'
  },
  variable: {
    total: 'text-amber-600',
    icon: 'bg-amber-500',
    scan: 'bg-amber-50 text-amber-600 hover:bg-amber-600',
    tree: 'text-amber-400',
    amount: 'text-amber-600',
    border: 'border-amber-50',
    edit: 'hover:text-amber-500',
    button: 'hover:border-amber-200 hover:text-amber-600'
  },
  depreciation: {
    total: 'text-emerald-600',
    icon: 'bg-emerald-600',
    edit: 'hover:text-emerald-500',
    button: 'hover:border-emerald-200 hover:text-emerald-600'
  },
  interest: {
    total: 'text-rose-600',
    icon: 'bg-rose-600',
    edit: 'hover:text-rose-500',
    button: 'hover:border-rose-200 hover:text-rose-600'
  }
};

interface TwoLevelColumnProps {
  title: string;
  parent?: ExpenseCategory;
  icon: React.ReactNode;
  tone: 'fixed' | 'variable';
  categories: ExpenseCategory[];
  categoryTotals: Record<string, number>;
  isScanning: boolean;
  onSmartScan: () => void;
  setEditingCategory: (category: ExpenseCategory) => void;
  onDeleteCategory: (id: string) => void;
  setActiveParentId: (id: string) => void;
  formatNumber: (num: number) => string;
}

const TwoLevelCategoryColumn: React.FC<TwoLevelColumnProps> = ({
  title,
  parent,
  icon,
  tone,
  categories,
  categoryTotals,
  isScanning,
  onSmartScan,
  setEditingCategory,
  onDeleteCategory,
  setActiveParentId,
  formatNumber
}) => {
  const colors = colorClass[tone];

  return (
    <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col">
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 ${colors.icon} text-white rounded-2xl shadow-lg`}>{icon}</div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight uppercase">{title}</h3>
          </div>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[9px] font-normal text-slate-400 uppercase">Tổng cộng</p>
            <p className={`text-lg font-normal ${colors.total} tabular-nums`}>{formatNumber(categoryTotals[parent?.id || ''] || 0)}đ</p>
          </div>
          <button
            onClick={onSmartScan}
            disabled={isScanning}
            className={`flex items-center gap-2 px-2 py-1 ${colors.scan} rounded-lg text-[8px] font-normal uppercase hover:text-white transition-colors`}
          >
            {isScanning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
            Quét
          </button>
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar max-h-[500px] pr-1">
        {parent && (
          <div className="space-y-6">
            {categories.filter(category => category.parentId === parent.id).map(level2 => (
              <div key={level2.id} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <FolderTree className={`w-3 h-3 ${colors.tree}`} />
                    <span className="text-[9px] font-normal text-slate-800 uppercase tracking-wider">{level2.name}</span>
                    <span className={`text-[9px] font-normal ${colors.amount} ml-2`}>{formatNumber(categoryTotals[level2.id] || 0)}đ</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingCategory(level2)} className={`p-1 hover:bg-slate-100 rounded ${colors.amount}`}><Pencil className="w-2.5 h-2.5" /></button>
                    <button onClick={() => onDeleteCategory(level2.id)} className="p-1 hover:bg-slate-100 rounded text-rose-400"><Trash2 className="w-2.5 h-2.5" /></button>
                  </div>
                </div>
                <div className={`grid grid-cols-1 gap-2 pl-3 border-l-2 ${colors.border}`}>
                  {categories.filter(category => category.parentId === level2.id).map(level3 => (
                    <div key={level3.id} className="group flex items-center justify-between p-3 bg-slate-50 hover:bg-white hover:shadow-md rounded-xl border border-slate-100 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-2xs font-normal text-slate-600">{level3.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-normal text-slate-400">{formatNumber(categoryTotals[level3.id] || 0)}đ</span>
                        <button onClick={() => setEditingCategory(level3)} className={`p-1 text-slate-200 ${colors.edit} opacity-0 group-hover:opacity-100 transition-colors`}><Pencil className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => setActiveParentId(parent.id)}
              className={`w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[9px] font-normal text-slate-400 uppercase ${colors.button} transition-colors flex items-center justify-center gap-2`}
            >
              <Plus className="w-3 h-3" /> Thêm nhóm
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface FlatColumnProps {
  title: string;
  parent?: ExpenseCategory;
  icon: React.ReactNode;
  tone: 'depreciation' | 'interest';
  categories: ExpenseCategory[];
  categoryTotals: Record<string, number>;
  setEditingCategory: (category: ExpenseCategory) => void;
  onDeleteCategory: (id: string) => void;
  setActiveParentId: (id: string) => void;
  formatNumber: (num: number) => string;
}

const FlatCategoryColumn: React.FC<FlatColumnProps> = ({
  title,
  parent,
  icon,
  tone,
  categories,
  categoryTotals,
  setEditingCategory,
  onDeleteCategory,
  setActiveParentId,
  formatNumber
}) => {
  const colors = colorClass[tone];

  return (
    <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col">
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 ${colors.icon} text-white rounded-2xl shadow-lg`}>{icon}</div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight uppercase">{title}</h3>
          </div>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[9px] font-normal text-slate-400 uppercase">Tổng cộng</p>
            <p className={`text-lg font-normal ${colors.total} tabular-nums`}>{formatNumber(categoryTotals[parent?.id || ''] || 0)}đ</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar max-h-[500px] pr-1">
        {parent && (
          <div className="space-y-6">
            {categories.filter(category => category.parentId === parent.id).map(level2 => (
              <div key={level2.id} className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-md rounded-2xl border border-slate-100 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-normal text-slate-600">{level2.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xs font-normal text-slate-400">{formatNumber(categoryTotals[level2.id] || 0)}đ</span>
                  <button onClick={() => setEditingCategory(level2)} className={`p-1.5 text-slate-200 ${colors.edit} opacity-0 group-hover:opacity-100 transition-colors`}><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDeleteCategory(level2.id)} className="p-1.5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setActiveParentId(parent.id)}
              className={`w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[9px] font-normal text-slate-400 uppercase ${colors.button} transition-colors flex items-center justify-center gap-2`}
            >
              <Plus className="w-3 h-3" /> Thêm mục
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ExpenseCategoriesTab: React.FC<ExpenseCategoriesTabProps> = ({
  categories,
  categoryTotals,
  fixedParent,
  variableParent,
  depreciationParent,
  interestParent,
  otherParents,
  isScanning,
  onSmartScan,
  setEditingCategory,
  onDeleteCategory,
  setActiveParentId,
  onStartAddParent,
  formatNumber
}) => (
  <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <TwoLevelCategoryColumn title="Cố Định" parent={fixedParent} icon={<ShieldAlert className="w-5 h-5" />} tone="fixed" categories={categories} categoryTotals={categoryTotals} isScanning={isScanning} onSmartScan={onSmartScan} setEditingCategory={setEditingCategory} onDeleteCategory={onDeleteCategory} setActiveParentId={setActiveParentId} formatNumber={formatNumber} />
      <TwoLevelCategoryColumn title="Biến Đổi" parent={variableParent} icon={<Activity className="w-5 h-5" />} tone="variable" categories={categories} categoryTotals={categoryTotals} isScanning={isScanning} onSmartScan={onSmartScan} setEditingCategory={setEditingCategory} onDeleteCategory={onDeleteCategory} setActiveParentId={setActiveParentId} formatNumber={formatNumber} />
      <FlatCategoryColumn title="Khấu Hao" parent={depreciationParent} icon={<History className="w-5 h-5" />} tone="depreciation" categories={categories} categoryTotals={categoryTotals} setEditingCategory={setEditingCategory} onDeleteCategory={onDeleteCategory} setActiveParentId={setActiveParentId} formatNumber={formatNumber} />
      <FlatCategoryColumn title="Lãi Vay" parent={interestParent} icon={<TrendingDown className="w-5 h-5" />} tone="interest" categories={categories} categoryTotals={categoryTotals} setEditingCategory={setEditingCategory} onDeleteCategory={onDeleteCategory} setActiveParentId={setActiveParentId} formatNumber={formatNumber} />
    </div>

    {otherParents.length > 0 && (
      <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-900 mb-8 uppercase flex items-center gap-3">
          <div className="p-2 bg-slate-800 text-white rounded-lg"><LayoutGrid className="w-4 h-4" /></div>
          CÁC NHÓM CHI PHÍ KHÁC
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {otherParents.map(parent => (
            <div key={parent.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group relative">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-normal text-slate-800 uppercase">{parent.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditingCategory(parent)} className="p-1.5 bg-white text-indigo-600 rounded-lg shadow-sm"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => onDeleteCategory(parent.id)} className="p-1.5 bg-white text-rose-500 rounded-lg shadow-sm"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="space-y-2">
                {categories.filter(category => category.parentId === parent.id).map(child => (
                  <div key={child.id} className="flex justify-between items-center text-2xs font-normal text-slate-500 group/child">
                    <span>{child.name}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatNumber(categoryTotals[child.id] || 0)}đ</span>
                      <button onClick={() => setEditingCategory(child)} className="opacity-0 group-hover/child:opacity-100 p-1 hover:bg-white rounded transition-colors"><Pencil className="w-2.5 h-2.5 text-indigo-400" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    <button onClick={onStartAddParent} className="p-8 rounded-[2.5rem] border-4 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-slate-400 hover:text-indigo-600 transition-colors flex flex-col items-center justify-center gap-4 w-full font-normal uppercase tracking-widest text-2xs">
      <Plus className="w-8 h-8" /> THÊM NHÓM CHI PHÍ CHA MỚI
    </button>
  </div>
);
