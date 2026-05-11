import React from 'react';
import { Bell, Check, ListChecks, Plus, Repeat, Save, Trash2 } from 'lucide-react';
import { ExpenseCategory, RecurringExpense } from '../../types';

interface ExpenseRecurringTabProps {
  pendingRecurring: RecurringExpense[];
  recurringExpenses: RecurringExpense[];
  recurringForm: Partial<RecurringExpense>;
  setRecurringForm: React.Dispatch<React.SetStateAction<Partial<RecurringExpense>>>;
  categories: ExpenseCategory[];
  formatNumber: (num: number) => string;
  onPostRecurring: (recurring: RecurringExpense) => void;
  onAddRecurring: () => void;
  onToggleRecurringActive: (id: string) => void;
  onRemoveRecurring: (id: string) => void;
}

export const ExpenseRecurringTab: React.FC<ExpenseRecurringTabProps> = ({
  pendingRecurring,
  recurringExpenses,
  recurringForm,
  setRecurringForm,
  categories,
  formatNumber,
  onPostRecurring,
  onAddRecurring,
  onToggleRecurringActive,
  onRemoveRecurring
}) => (
  <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl">
      <h3 className="text-xl font-black text-slate-900 mb-8 uppercase flex items-center gap-4">
        <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg"><Bell className="w-5 h-5" /></div>
        CHI PHÍ CẦN XÁC NHẬN TRONG THÁNG
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pendingRecurring.length > 0 ? (
          pendingRecurring.map(recurring => (
            <div key={recurring.id} className="p-6 bg-amber-50 border border-amber-100 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all"><Repeat className="w-12 h-12" /></div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="px-3 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase">Ngày {recurring.dayOfMonth} hàng tháng</span>
                  <h4 className="text-sm font-black text-slate-900 mt-2 uppercase">{recurring.name}</h4>
                </div>
              </div>
              <div className="space-y-1 mb-6">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Danh mục: {recurring.category}</p>
                <p className="text-lg font-black text-slate-900 tabular-nums">{formatNumber(recurring.amount)}đ</p>
              </div>
              <button
                onClick={() => onPostRecurring(recurring)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Xác nhận & Ghi sổ
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full py-10 text-center text-slate-400 font-bold uppercase text-xs italic">
            Tất cả chi phí định kỳ tháng này đã được ghi sổ hoặc chưa đến ngày.
          </div>
        )}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl h-fit">
        <h3 className="text-sm font-black text-slate-900 mb-8 uppercase flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg"><Plus className="w-4 h-4" /></div>
          THÊM MẪU CHI PHÍ ĐỊNH KỲ
        </h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tên mẫu chi phí</label>
            <input type="text" value={recurringForm.name} onChange={e => setRecurringForm({ ...recurringForm, name: e.target.value })} placeholder="Ví dụ: Tiền thuê mặt bằng" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Danh mục</label>
            <select value={recurringForm.category} onChange={e => setRecurringForm({ ...recurringForm, category: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="">Chọn danh mục...</option>
              {categories.filter(category => !!category.parentId).map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Số tiền (đ)</label>
              <input type="number" value={recurringForm.amount || ''} onChange={e => setRecurringForm({ ...recurringForm, amount: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ngày trong tháng</label>
              <input type="number" min="1" max="31" value={recurringForm.dayOfMonth || ''} onChange={e => setRecurringForm({ ...recurringForm, dayOfMonth: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ghi chú thêm</label>
            <textarea value={recurringForm.description} onChange={e => setRecurringForm({ ...recurringForm, description: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 h-20" />
          </div>
          <button
            onClick={onAddRecurring}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Lưu mẫu định kỳ
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl">
        <h3 className="text-sm font-black text-slate-900 mb-8 uppercase flex items-center gap-3">
          <div className="p-2 bg-slate-800 text-white rounded-lg"><ListChecks className="w-4 h-4" /></div>
          DANH SÁCH MẪU CHI PHÍ ĐỊNH KỲ
        </h3>
        <div className="space-y-4">
          {recurringExpenses.length > 0 ? (
            recurringExpenses.map(recurring => (
              <div key={recurring.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                    <span className="text-sm font-black">{recurring.dayOfMonth}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase">{recurring.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{recurring.category} • {formatNumber(recurring.amount)}đ</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleRecurringActive(recurring.id)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${recurring.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {recurring.isActive ? 'Đang bật' : 'Đã tắt'}
                  </button>
                  <button onClick={() => onRemoveRecurring(recurring.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs italic">
              Chưa có mẫu chi phí định kỳ nào được tạo.
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
