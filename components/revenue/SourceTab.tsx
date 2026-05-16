import React from 'react';
import { ShopeeSourceItem } from '../../types';
import { Database, Plus, Trash2 } from 'lucide-react';

interface Props {
  shopeeSourceData: ShopeeSourceItem[];
  formatNumber: (num: number) => string;
}

const SourceTab: React.FC<Props> = ({ shopeeSourceData, formatNumber }) => (
  <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl space-y-8">
    <div className="flex items-center justify-between border-b border-slate-100 pb-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg"><Database className="w-6 h-6" /></div>
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Dữ liệu nguồn SKU</h3>
          <p className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">Quản lý danh mục sản phẩm và giá nhập</p>
        </div>
      </div>
      <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-normal text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
        <Plus className="w-4 h-4" /> Thêm SKU mới
      </button>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
            <th className="p-6">Mã sản phẩm</th>
            <th className="p-6">Tên sản phẩm</th>
            <th className="p-6 text-right">Giá nhập</th>
            <th className="p-6 text-right">Giá bán</th>
            <th className="p-6 text-center">Tình trạng</th>
            <th className="p-6 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 text-xs font-normal">
          {shopeeSourceData.length > 0 ? shopeeSourceData.map(item => (
            <tr key={item.id} className="hover:bg-slate-50 transition-all">
              <td className="p-6 text-slate-900">{item.sku}</td>
              <td className="p-6 text-slate-600">{item.name}</td>
              <td className="p-6 text-right text-rose-600">{formatNumber(item.importPrice)}đ</td>
              <td className="p-6 text-right text-blue-600">{formatNumber(item.salePrice)}đ</td>
              <td className="p-6 text-center">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] uppercase font-normal">{item.status}</span>
              </td>
              <td className="p-6 text-center">
                <button className="p-2 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={6} className="p-20 text-center text-slate-400 font-normal uppercase tracking-widest">Chưa có dữ liệu nguồn</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default SourceTab;
