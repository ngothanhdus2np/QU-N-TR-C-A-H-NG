import React from 'react';
import { ProductGroup, ProductGroupRevenue } from '../../types';
import { Filter } from 'lucide-react';

interface FinancialMetricRow {
  key: string;
  label: string;
  yearValues: Record<string, number>;
}

interface Props {
  isShopee: boolean;
  productGroups: ProductGroup[];
  groupRevenue: ProductGroupRevenue[];
  timeContext: { start: string; end: string };
  years: string[];
  financialMatrixData: FinancialMetricRow[];
  getHeatmapColor: (value: number) => string;
  formatNumber: (num: number) => string;
}

const MatrixTab: React.FC<Props> = ({
  isShopee, productGroups, groupRevenue, timeContext, years, financialMatrixData, getHeatmapColor, formatNumber,
}) => (
  <div className="bg-white rounded-[3.5rem] p-8 md:p-12 border border-slate-200 shadow-xl flex flex-col gap-10">
    <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-10">
      <div className="flex items-center gap-5">
        <div className="p-4 bg-emerald-600 rounded-[1.5rem] text-white shadow-lg"><Filter className="w-6 h-6" /></div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {isShopee ? 'Tổng hợp Số lượng bán Shopee' : 'Ma Trận Tài Chính Liên Năm'}
          </h3>
          <p className="text-[10px] text-emerald-600 font-normal uppercase tracking-widest mt-1">
            {isShopee ? 'Thống kê chi tiết sản phẩm trong khoảng lọc' : 'So sánh hiệu suất cùng kỳ lọc (Tháng-Ngày) qua các năm'}
          </p>
        </div>
      </div>
      <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
        <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Giai đoạn: </span>
        <span className="text-xs font-normal text-slate-900 ml-2">
          {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
        </span>
      </div>
    </div>

    {isShopee ? (
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
              <th className="p-6 text-left">Mã Nhóm / Sản phẩm</th>
              <th className="p-6 text-right">Số lượng bán</th>
              <th className="p-6 text-right">Số lượng trả</th>
              <th className="p-6 text-right">Doanh thu thuần</th>
              <th className="p-6 text-right">Giá vốn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {productGroups.map(group => {
              const groupRev = groupRevenue.filter(r => r.groupId === group.id && r.date >= timeContext.start && r.date <= timeContext.end);
              const totalQty = groupRev.reduce((sum, r) => sum + (r.quantity || 0), 0);
              const totalRetQty = groupRev.reduce((sum, r) => sum + (r.returnsQuantity || 0), 0);
              const totalNet = groupRev.reduce((sum, r) => sum + (r.netRevenue || 0), 0);
              const totalCogs = groupRev.reduce((sum, r) => sum + (r.cogs || 0), 0);
              return (
                <tr key={group.id} className="hover:bg-slate-50 transition-all">
                  <td className="p-6 font-normal text-slate-700 uppercase text-xs">{group.name}</td>
                  <td className="p-6 text-right tabular-nums font-normal text-blue-600">{totalQty.toLocaleString()}</td>
                  <td className="p-6 text-right tabular-nums font-normal text-rose-500">{totalRetQty.toLocaleString()}</td>
                  <td className="p-6 text-right tabular-nums font-normal text-emerald-600">{totalNet.toLocaleString()}đ</td>
                  <td className="p-6 text-right tabular-nums font-normal text-slate-500">{totalCogs.toLocaleString()}đ</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
              <th className="p-6 text-left min-w-[280px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Chỉ số (Cùng kỳ lọc)</th>
              {years.map(y => <th key={y} className="p-6 text-center w-[180px] border-r border-slate-100">Năm {y}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {financialMatrixData.map((row) => (
              <tr key={row.key} className="group hover:bg-slate-50/80 transition-all">
                <td className="p-5 sticky left-0 z-10 border-r border-slate-100 bg-white group-hover:bg-slate-50"><span className="text-xs uppercase font-normal text-slate-700">{row.label}</span></td>
                {years.map(y => {
                  const val = row.yearValues[y] || 0;
                  return <td key={y} className={`p-5 text-center tabular-nums text-xs border-r border-slate-50 transition-all ${getHeatmapColor(val)}`}>{val !== 0 ? formatNumber(val) : '0'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default MatrixTab;
