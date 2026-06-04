import React from 'react';
import { ArrowRight, Bell, Calendar, ChevronDown, Download, FileSpreadsheet, FileText, Layers, Loader2, Plus, Sparkles, Trash2, Upload, Wallet } from 'lucide-react';
import { AppDataSurgicalUpdate, ExpenseCategory, ExpenseRecord } from '../../types';
import { exportToExcel as xlsxExport } from '../../services/exportService';
import { ExpenseInputWrapper } from './ExpenseSharedUI';
import { useExpenseAnalytics } from './useExpenseAnalytics';

type ExpenseAnalytics = ReturnType<typeof useExpenseAnalytics>;
type AiSuggestion = {
  level1Id: string;
  level2Name: string;
  level3Name: string;
  level1Name: string;
};

interface ExpenseLedgerTabProps {
  pendingRecurringCount: number;
  onOpenRecurring: () => void;
  aiSuggestion: AiSuggestion | null;
  setAiSuggestion: React.Dispatch<React.SetStateAction<AiSuggestion | null>>;
  onApplyAISuggestion: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isAnalyzing: boolean;
  formData: {
    date: string;
    category: string;
    amount: string;
    description: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    date: string;
    category: string;
    amount: string;
    description: string;
  }>>;
  parentCategories: ExpenseCategory[];
  categories: ExpenseCategory[];
  onTriggerAIAnalysis: () => void;
  onAddRecord: (event: React.FormEvent) => void;
  timeContext: ExpenseAnalytics['timeContext'];
  processedList: ExpenseRecord[];
  sourceList: ExpenseRecord[];
  onUpdate: (newList: ExpenseRecord[], idToRemove?: string) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  formatNumber: (num: number) => string;
}

export const ExpenseLedgerTab: React.FC<ExpenseLedgerTabProps> = ({
  pendingRecurringCount,
  onOpenRecurring,
  aiSuggestion,
  setAiSuggestion,
  onApplyAISuggestion,
  fileInputRef,
  isAnalyzing,
  formData,
  setFormData,
  parentCategories,
  categories,
  onTriggerAIAnalysis,
  onAddRecord,
  timeContext,
  processedList,
  sourceList,
  onUpdate,
  onUpdateSurgical,
  formatNumber
}) => (
  <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
    {pendingRecurringCount > 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg animate-pulse"><Bell className="w-5 h-5" /></div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 uppercase">Bạn có {pendingRecurringCount} khoản chi phí định kỳ cần xác nhận</h4>
            <p className="text-2xs font-normal text-slate-500 uppercase">Các khoản chi này đã đến ngày thanh toán trong tháng này</p>
          </div>
        </div>
        <button
          onClick={onOpenRecurring}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl text-2xs font-normal uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-lg flex items-center gap-2"
        >
          Xem chi tiết <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    )}

    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      <div className="lg:col-span-4 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 hover:border-rose-400 hover:bg-rose-50/20 transition-colors p-10 shadow-sm relative group flex flex-col items-center justify-center text-center">
        {aiSuggestion ? (
          <div className="w-full space-y-4 animate-in zoom-in-95 duration-300">
            <div className="p-4 bg-rose-100 text-rose-600 rounded-2xl flex flex-col items-center">
              <Sparkles className="w-6 h-6 mb-2" />
              <p className="text-2xs font-normal uppercase">AI Gợi ý phân loại 3 cấp</p>
              <div className="text-center mt-2 space-y-1">
                <p className="text-[9px] font-normal opacity-60 uppercase">{aiSuggestion.level1Name}</p>
                <ChevronDown className="w-3 h-3 mx-auto opacity-30" />
                <p className="text-2xs font-normal uppercase text-rose-500">{aiSuggestion.level2Name}</p>
                <ChevronDown className="w-3 h-3 mx-auto opacity-30" />
                <h4 className="text-sm font-bold">"{aiSuggestion.level3Name}"</h4>
              </div>
            </div>
            <button onClick={onApplyAISuggestion} className="w-full py-3 bg-rose-600 text-white rounded-xl font-normal text-2xs uppercase tracking-widest shadow-lg">Áp dụng cấu trúc này</button>
            <button onClick={() => setAiSuggestion(null)} className="text-[9px] font-normal text-slate-400 uppercase">Bỏ qua</button>
          </div>
        ) : (
          <>
            <input type="file" ref={fileInputRef} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 group-hover:border-rose-300 group-hover:bg-white transition-colors shadow-sm mb-6">
              <Upload className="w-8 h-8 text-rose-600" />
            </button>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Tải lên hóa đơn chi phí</h3>
            {isAnalyzing && (
              <div className="mt-4 flex items-center gap-2 text-rose-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[9px] font-normal uppercase">AI Đang phân tích...</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="lg:col-span-6 bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
        <h3 className="text-xs font-semibold text-slate-900 mb-8 flex items-center gap-3">
          <div className="p-2 bg-rose-600 rounded-lg text-white"><Plus className="w-3.5 h-3.5" /></div>
          NHẬP NHANH CHI PHÍ
        </h3>
        <form onSubmit={onAddRecord} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ExpenseInputWrapper label="Ngày chi" icon={Calendar}><input type="date" required value={formData.date} onChange={event => setFormData({ ...formData, date: event.target.value })} className="input-field py-3 font-normal text-2xs border-none" /></ExpenseInputWrapper>
            <ExpenseInputWrapper label="Phân loại" icon={Layers}>
              <select value={formData.category} onChange={event => setFormData({ ...formData, category: event.target.value })} className="input-field py-3 font-normal text-2xs border-none appearance-none bg-transparent">
                {parentCategories.map(level1 => (
                  <optgroup key={level1.id} label={level1.name.toUpperCase()}>
                    {categories.filter(category => category.parentId === level1.id).map(level2 => (
                      <React.Fragment key={level2.id}>
                        <option key={level2.id} value={level2.name} className="font-normal text-slate-900">
                          {level2.name} (Nhóm)
                        </option>
                        {categories.filter(category => category.parentId === level2.id).map(level3 => (
                          <option key={level3.id} value={level3.name}>&nbsp;&nbsp;&nbsp;• {level3.name}</option>
                        ))}
                      </React.Fragment>
                    ))}
                  </optgroup>
                ))}
              </select>
            </ExpenseInputWrapper>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ExpenseInputWrapper label="Số tiền" icon={Wallet} color="text-rose-600"><input type="number" required placeholder="0" value={formData.amount} onChange={event => setFormData({ ...formData, amount: event.target.value })} className="input-field py-3 font-normal text-2xs border-none" /></ExpenseInputWrapper>
            <ExpenseInputWrapper label="Mô tả" icon={FileText}>
              <div className="relative flex items-center w-full">
                <input
                  type="text"
                  required
                  placeholder="Nội dung chi..."
                  value={formData.description}
                  onChange={event => setFormData({ ...formData, description: event.target.value })}
                  className="input-field py-3 font-normal text-2xs border-none w-full pr-10"
                />
                <button
                  type="button"
                  onClick={onTriggerAIAnalysis}
                  disabled={isAnalyzing || formData.description.length < 5}
                  className={`absolute right-2 p-1.5 rounded-lg transition-colors ${
                    formData.description.length >= 5
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title="AI Gợi ý phân loại"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </button>
              </div>
            </ExpenseInputWrapper>
          </div>
          <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-normal text-2xs uppercase tracking-widest transition-colors shadow-xl">GHI NHẬN SỔ CÁI</button>
        </form>
      </div>
    </div>

    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
      <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-lg"><FileSpreadsheet className="w-5 h-5" /></div>
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Sổ Cái Chi Phí Đã Lọc</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-normal text-[9px] uppercase tracking-widest shadow-sm">
            Dữ liệu: {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
          </div>
          <button
            onClick={() => xlsxExport(
              processedList.map(expense => ({
                Ngày: expense.date,
                'Danh mục': expense.category,
                'Mô tả': expense.description,
                'Số tiền': expense.amount,
              })),
              'ChiPhi'
            )}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 rounded-xl font-normal text-[9px] uppercase tracking-widest transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
              <th className="px-8 py-6">Ngày tháng</th>
              <th className="px-8 py-6">Danh mục</th>
              <th className="px-8 py-6">Nội dung ghi chú</th>
              <th className="px-8 py-6 text-right">Số tiền (VNĐ)</th>
              <th className="px-8 py-6 text-center w-[100px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs font-normal tabular-nums">
            {processedList.length > 0 ? (
              processedList.map(item => (
                <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-5 text-slate-600">{item.date.split('-').reverse().join('/')}</td>
                  <td className="px-8 py-5"><span className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-normal uppercase border border-rose-100">{item.category}</span></td>
                  <td className="px-8 py-5 text-slate-700">{item.description}</td>
                  <td className="px-8 py-5 text-right font-normal text-rose-600 text-sm">{formatNumber(item.amount)}</td>
                  <td className="px-8 py-5 text-center">
                    <button
                      onClick={() => {
                        if (onUpdateSurgical) {
                          onUpdateSurgical([{ key: 'expenses', item, isDelete: true }]);
                        } else {
                          onUpdate(sourceList.filter(expense => expense.id !== item.id), item.id);
                        }
                      }}
                      className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-20 text-center text-slate-400 font-normal uppercase text-xs">Không tìm thấy bản kê chi phí trong kỳ lọc này.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
