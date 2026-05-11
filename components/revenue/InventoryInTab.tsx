import React from 'react';
import { ShopeeInventoryInRecord } from '../../types';
import { ArrowDownToLine, Plus } from 'lucide-react';

interface Props {
  shopeeInventoryIn: ShopeeInventoryInRecord[];
  formatNumber: (num: number) => string;
}

const InventoryInTab: React.FC<Props> = ({ shopeeInventoryIn, formatNumber }) => (
  <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl space-y-8">
    <div className="flex items-center justify-between border-b border-slate-100 pb-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-sky-600 rounded-2xl text-white shadow-lg"><ArrowDownToLine className="w-6 h-6" /></div>
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nhập kho sản phẩm</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ghi nhận lịch sử nhập hàng hóa</p>
        </div>
      </div>
      <button className="px-6 py-3 bg-sky-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
        <Plus className="w-4 h-4" /> Tạo phiếu nhập
      </button>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
            <th className="p-6">Ngày nhập</th>
            <th className="p-6">Mã sản phẩm</th>
            <th className="p-6 text-right">Số lượng</th>
            <th className="p-6 text-right">Giá nhập</th>
            <th className="p-6 text-right">Thành tiền</th>
            <th className="p-6">Ghi chú</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 text-xs font-bold">
          {shopeeInventoryIn.length > 0 ? shopeeInventoryIn.map(item => (
            <tr key={item.id} className="hover:bg-slate-50 transition-all">
              <td className="p-6 text-slate-900">{item.date.split('-').reverse().join('/')}</td>
              <td className="p-6 text-slate-600 font-black uppercase">{item.sku}</td>
              <td className="p-6 text-right text-blue-600">{item.quantity.toLocaleString()}</td>
              <td className="p-6 text-right text-rose-600">{formatNumber(item.importPrice)}đ</td>
              <td className="p-6 text-right font-black text-slate-900">{formatNumber(item.quantity * item.importPrice)}đ</td>
              <td className="p-6 text-slate-400 italic">{item.note || '-'}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={6} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Chưa có lịch sử nhập kho</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default InventoryInTab;
