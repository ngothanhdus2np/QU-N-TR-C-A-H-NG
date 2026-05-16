import React from 'react';
import { ShopeeCostConfig } from '../../types';
import { DollarSign, Target, Zap, Settings, Package, Plus, X, Hash } from 'lucide-react';
import { InputWrapper } from './helpers';

interface Props {
  shopeeCosts: ShopeeCostConfig | undefined;
  totalFixedCosts: number;
  totalVariableCosts: number;
  fixedCostPerOrder: number;
  formatNumber: (num: number) => string;
  handleUpdateShopeeCostConfig: (updates: Partial<ShopeeCostConfig>) => void;
  handleAddShopeeCostItem: (type: 'fixed' | 'variable') => void;
  handleUpdateShopeeCostItem: (type: 'fixed' | 'variable', id: string, field: string, value: string | number | boolean) => void;
  handleRemoveShopeeCostItem: (type: 'fixed' | 'variable', id: string) => void;
}

const CostsTab: React.FC<Props> = ({
  shopeeCosts, totalFixedCosts, totalVariableCosts, fixedCostPerOrder, formatNumber,
  handleUpdateShopeeCostConfig, handleAddShopeeCostItem, handleUpdateShopeeCostItem, handleRemoveShopeeCostItem,
}) => (
  <div className="space-y-8 animate-in fade-in duration-700">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col items-center text-center">
        <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl mb-4"><DollarSign className="w-6 h-6" /></div>
        <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-1">Tổng chi phí vận hành</p>
        <h4 className="text-2xl font-normal text-slate-900">{formatNumber(totalFixedCosts)}đ</h4>
      </div>
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col items-center text-center">
        <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl mb-4"><Target className="w-6 h-6" /></div>
        <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-1">Định phí / Đơn hàng</p>
        <h4 className="text-2xl font-black text-emerald-600">{formatNumber(fixedCostPerOrder)}đ</h4>
        <p className="text-[9px] text-slate-400 font-normal mt-2 italic">Dựa trên mục tiêu {shopeeCosts?.targetOrders || 0} đơn</p>
      </div>
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col items-center text-center">
        <div className="p-4 bg-rose-100 text-rose-600 rounded-2xl mb-4"><Zap className="w-6 h-6" /></div>
        <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-1">Biến phí / Đơn hàng</p>
        <h4 className="text-2xl font-normal text-rose-600">{formatNumber(totalVariableCosts)}đ</h4>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><Settings className="w-6 h-6" /></div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">ĐỊNH PHÍ</h3>
              <p className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">Chi phí cố định hàng tháng</p>
            </div>
          </div>
          <button onClick={() => handleAddShopeeCostItem('fixed')} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="pb-4 w-12">STT</th>
                <th className="pb-4">Nội dung chi</th>
                <th className="pb-4 text-center w-20">SL</th>
                <th className="pb-4 text-right w-32">Đơn giá</th>
                <th className="pb-4 text-right w-32">Tổng cộng</th>
                <th className="pb-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(shopeeCosts?.fixedCosts || []).map((item, idx) => (
                <tr key={item.id} className="group">
                  <td className="py-4 text-[10px] font-normal text-slate-300">{idx + 1}</td>
                  <td className="py-4"><input type="text" value={item.name} onChange={(e) => handleUpdateShopeeCostItem('fixed', item.id, 'name', e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-normal text-slate-700 focus:text-indigo-600" /></td>
                  <td className="py-4"><input type="number" value={item.quantity} onChange={(e) => handleUpdateShopeeCostItem('fixed', item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none outline-none text-xs font-normal text-center text-slate-600" /></td>
                  <td className="py-4"><input type="number" value={item.unitPrice} onChange={(e) => handleUpdateShopeeCostItem('fixed', item.id, 'unitPrice', Number(e.target.value))} className="w-full bg-transparent border-none outline-none text-xs font-normal text-right text-slate-600" /></td>
                  <td className="py-4 text-right text-xs font-normal text-slate-900">{formatNumber(item.quantity * item.unitPrice)}</td>
                  <td className="py-4 text-right"><button onClick={() => handleRemoveShopeeCostItem('fixed', item.id)} className="p-1 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-auto pt-8 border-t border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Ước tính mục tiêu đơn hàng</span>
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <input type="number" value={shopeeCosts?.targetOrders || 0} onChange={(e) => handleUpdateShopeeCostConfig({ targetOrders: Number(e.target.value) })} className="w-16 bg-transparent border-none outline-none text-sm font-normal text-indigo-600 text-center" />
              <span className="text-[10px] font-normal text-slate-400 uppercase">Đơn</span>
            </div>
          </div>
          <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-normal uppercase opacity-60">Định phí / Đơn hàng</p>
              <h4 className="text-2xl font-black mt-1">{formatNumber(fixedCostPerOrder)}đ</h4>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-normal uppercase opacity-60">Tổng chi vận hành</p>
              <p className="text-sm font-normal mt-1">{formatNumber(totalFixedCosts)}đ</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-600 rounded-2xl text-white shadow-lg"><Package className="w-6 h-6" /></div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">BIẾN PHÍ</h3>
              <p className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">Chi phí cho mỗi đơn hàng</p>
            </div>
          </div>
          <button onClick={() => handleAddShopeeCostItem('variable')} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="pb-4 w-12">STT</th>
                <th className="pb-4">Nội dung chi</th>
                <th className="pb-4 text-center w-20">SL</th>
                <th className="pb-4 text-right w-32">Đơn giá</th>
                <th className="pb-4 text-right w-32">Tổng cộng</th>
                <th className="pb-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(shopeeCosts?.variableCosts || []).map((item, idx) => (
                <tr key={item.id} className="group">
                  <td className="py-4 text-[10px] font-normal text-slate-300">{idx + 1}</td>
                  <td className="py-4"><input type="text" value={item.name} onChange={(e) => handleUpdateShopeeCostItem('variable', item.id, 'name', e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-normal text-slate-700 focus:text-rose-600" /></td>
                  <td className="py-4"><input type="number" value={item.quantity} onChange={(e) => handleUpdateShopeeCostItem('variable', item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none outline-none text-xs font-normal text-center text-slate-600" /></td>
                  <td className="py-4"><input type="number" value={item.unitPrice} onChange={(e) => handleUpdateShopeeCostItem('variable', item.id, 'unitPrice', Number(e.target.value))} className="w-full bg-transparent border-none outline-none text-xs font-normal text-right text-slate-600" /></td>
                  <td className="py-4 text-right text-xs font-normal text-slate-900">{formatNumber(item.quantity * item.unitPrice)}</td>
                  <td className="py-4 text-right"><button onClick={() => handleRemoveShopeeCostItem('variable', item.id)} className="p-1 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-auto pt-8 border-t border-slate-100">
          <div className="p-6 bg-rose-600 rounded-3xl text-white shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-normal uppercase opacity-60">Biến phí / Đơn hàng</p>
              <h4 className="text-2xl font-normal mt-1">{formatNumber(totalVariableCosts)}đ</h4>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-normal uppercase opacity-60">Tổng cộng</p>
              <p className="text-sm font-normal mt-1">{formatNumber(totalVariableCosts)}đ</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-200">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-slate-900 rounded-2xl text-white"><Settings className="w-5 h-5" /></div>
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Cấu hình phí sàn Shopee (%)</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <InputWrapper label="Phí sàn" icon={Hash} color="text-slate-600">
          <input type="number" value={shopeeCosts?.platformFeePercent || 0} onChange={e => handleUpdateShopeeCostConfig({ platformFeePercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-normal" />
        </InputWrapper>
        <InputWrapper label="Phí thanh toán" icon={Hash} color="text-slate-600">
          <input type="number" value={shopeeCosts?.paymentFeePercent || 0} onChange={e => handleUpdateShopeeCostConfig({ paymentFeePercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-normal" />
        </InputWrapper>
        <InputWrapper label="Freeship Extra" icon={Hash} color="text-slate-600">
          <input type="number" value={shopeeCosts?.freeshipExtraPercent || 0} onChange={e => handleUpdateShopeeCostConfig({ freeshipExtraPercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-normal" />
        </InputWrapper>
        <InputWrapper label="Phí vận hành" icon={DollarSign} color="text-slate-600">
          <div className="text-xs font-normal text-slate-900">{formatNumber(totalVariableCosts)} đ</div>
        </InputWrapper>
        <InputWrapper label="Thuế TNCN" icon={Hash} color="text-slate-600">
          <input type="number" value={shopeeCosts?.taxPercent || 0} onChange={e => handleUpdateShopeeCostConfig({ taxPercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-normal" />
        </InputWrapper>
        <InputWrapper label="Thuế QC" icon={Hash} color="text-slate-600">
          <input type="number" value={shopeeCosts?.adsTaxPercent || 0} onChange={e => handleUpdateShopeeCostConfig({ adsTaxPercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-normal" />
        </InputWrapper>
      </div>
    </div>
  </div>
);

export default CostsTab;
