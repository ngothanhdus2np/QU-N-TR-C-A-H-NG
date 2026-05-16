import React from 'react';
import { RevenueRecord } from '../../types';
import {
  Upload, Plus, DollarSign, Tag, ArrowRightLeft, HandCoins,
  ShoppingCart, Loader2, Trash2, Download, FileSpreadsheet, Calendar,
} from 'lucide-react';
import { InputWrapper } from './helpers';
import { exportToExcel as xlsxExport } from '../../services/exportService';

interface FormData {
  date: string;
  totalGrossRevenue: string;
  discount: string;
  revenueOther: string;
  returnsValue: string;
  totalCogs: string;
}

interface Props {
  formData: FormData;
  setFormData: (data: FormData) => void;
  isSaving: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAdd: (e: React.FormEvent) => Promise<void>;
  filteredListByRange: RevenueRecord[];
  timeContext: { start: string; end: string };
  onUpdate: (newList: RevenueRecord[], idToRemove?: string) => Promise<void>;
  list: RevenueRecord[];
  isShopee: boolean | undefined;
  formatNumber: (num: number) => string;
}

const LedgerTab: React.FC<Props> = ({
  formData, setFormData, isSaving, fileInputRef, handleFileUpload, handleAdd,
  filteredListByRange, timeContext, onUpdate, list, isShopee, formatNumber,
}) => (
  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      <div className="lg:col-span-4 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition-all p-10 shadow-sm relative group flex flex-col items-center justify-center text-center">
        <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 group-hover:border-blue-300 group-hover:bg-white transition-all shadow-sm mb-6"><Upload className="w-8 h-8 text-blue-600" /></button>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Đồng bộ Báo cáo KiotViet</h3>
      </div>
      <div className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
        <h3 className="text-xs font-black text-slate-900 mb-6 flex items-center gap-3"><div className="p-2 bg-blue-600 rounded-lg text-white"><Plus className="w-3.5 h-3.5" /></div> NHẬP NHANH DOANH THU</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputWrapper label="Thời gian" icon={Calendar}><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="input-field py-2.5 font-normal text-[10px] border-none" /></InputWrapper>
            <InputWrapper label="Tiền hàng" icon={DollarSign} color="text-blue-600"><input type="number" placeholder="0" required value={formData.totalGrossRevenue} onChange={e => setFormData({...formData, totalGrossRevenue: e.target.value})} className="input-field py-2.5 font-normal text-[10px] border-none" /></InputWrapper>
            <InputWrapper label="Giảm giá" icon={Tag} color="text-rose-500"><input type="number" placeholder="0" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="input-field py-2.5 font-normal text-[10px] border-none" /></InputWrapper>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputWrapper label="Giá trị trả" icon={ArrowRightLeft} color="text-amber-500"><input type="number" placeholder="0" value={formData.returnsValue} onChange={e => setFormData({...formData, returnsValue: e.target.value})} className="input-field py-2.5 font-normal text-[10px] border-none" /></InputWrapper>
            <InputWrapper label="Doanh thu khác" icon={HandCoins} color="text-indigo-500"><input type="number" placeholder="0" value={formData.revenueOther} onChange={e => setFormData({...formData, revenueOther: e.target.value})} className="input-field py-2.5 font-normal text-[10px] border-none" /></InputWrapper>
            <InputWrapper label="Giá vốn" icon={ShoppingCart} color="text-rose-600"><input type="number" placeholder="0" required value={formData.totalCogs} onChange={e => setFormData({...formData, totalCogs: e.target.value})} className="input-field py-2.5 font-normal text-[10px] border-none" /></InputWrapper>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className={`w-full py-3.5 rounded-xl font-normal text-[9px] uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white'}`}
          >
            {isSaving ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" />ĐANG ĐỒNG BỘ CLOUD...</>) : 'GHI NHẬN DOANH THU'}
          </button>
        </form>
      </div>
    </div>

    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative flex flex-col max-h-[800px]">
      <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sticky top-0 z-20">
        <div className="flex items-center gap-4"><div className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 shadow-sm"><FileSpreadsheet className="w-5 h-5" /></div><h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Sổ cái Doanh thu Đã lọc</h3></div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => xlsxExport(
              filteredListByRange.map(r => ({
                'Ngày': r.date,
                'Tổng tiền hàng': r.totalGrossRevenue,
                'Giảm giá': r.discount,
                'Giá trị trả': r.returnsValue,
                'Doanh thu thuần': r.netRevenue,
                'Doanh thu khác': r.revenueOther,
                'Giá vốn': r.totalCogs,
                'Lợi nhuận gộp': r.grossProfit,
              })),
              isShopee ? 'DoanhThu_Shopee' : 'DoanhThu_CuaHang'
            )}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-emerald-600 rounded-xl font-normal text-[9px] uppercase tracking-widest hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>
        <div className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-normal text-[9px] uppercase tracking-widest">
          Dữ liệu: {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-auto flex-1 no-scrollbar scroll-smooth">
        <table className="w-full text-left border-collapse table-fixed min-w-[1200px] relative">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-6 w-[120px] bg-slate-50/30">Thời gian</th>
              <th className="px-1 py-6 text-right text-blue-600">Tổng tiền hàng</th>
              <th className="px-1 py-6 text-right text-rose-500">Giảm giá</th>
              <th className="px-1 py-6 text-right text-amber-600">Giá trị trả</th>
              <th className="px-1 py-6 text-right font-black bg-blue-50/50 text-blue-800">Doanh thu</th>
              <th className="px-1 py-6 text-right text-indigo-500">Doanh thu khác</th>
              <th className="px-1 py-6 text-right text-rose-600">Tổng giá vốn</th>
              <th className="px-1 py-6 text-right font-black bg-emerald-50 text-emerald-800">Lợi nhuận gộp</th>
              <th className="px-1 py-6 text-center w-[60px] bg-slate-50/30">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 tabular-nums text-[11px] font-normal">
            {filteredListByRange.map(item => (
              <tr key={item.id} className="group hover:bg-slate-50/80 transition-all odd:bg-white even:bg-slate-50/30">
                <td className="px-6 py-5 text-slate-900 bg-slate-50/20">{item.date ? item.date.split('-').reverse().join('/') : 'N/A'}</td>
                <td className="px-1 py-5 text-right text-blue-600">{formatNumber(item.totalGrossRevenue)}</td>
                <td className="px-1 py-5 text-right text-rose-400">{formatNumber(Math.abs(item.discount))}</td>
                <td className="px-1 py-5 text-right text-amber-500">{formatNumber(Math.abs(item.returnsValue))}</td>
                <td className="px-1 py-5 text-right font-normal text-blue-900 bg-blue-50/40">{formatNumber(item.netRevenue)}</td>
                <td className="px-1 py-5 text-right text-indigo-600">{formatNumber(item.revenueOther)}</td>
                <td className="px-1 py-5 text-right text-rose-500">{formatNumber(Math.abs(item.totalCogs))}</td>
                <td className="px-1 py-5 text-right font-normal text-emerald-700 bg-emerald-50/40">{formatNumber(item.grossProfit)}</td>
                <td className="px-1 py-5 text-center bg-slate-50/20"><button onClick={() => onUpdate(list.filter(i => i.id !== item.id), item.id)} className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default LedgerTab;
