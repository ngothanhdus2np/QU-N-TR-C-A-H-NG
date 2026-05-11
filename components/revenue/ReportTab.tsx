import React from 'react';
import { ShopeeSourceItem, ShopeeInventoryOutRecord } from '../../types';
import { ClipboardList } from 'lucide-react';

interface Props {
  shopeeSourceData: ShopeeSourceItem[];
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  timeContext: { start: string; end: string };
  formatNumber: (num: number) => string;
}

const ReportTab: React.FC<Props> = ({ shopeeSourceData, shopeeInventoryOut, timeContext, formatNumber }) => (
  <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl space-y-8">
    <div className="flex items-center justify-between border-b border-slate-100 pb-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><ClipboardList className="w-6 h-6" /></div>
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Báo cáo tổng hợp sản phẩm</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hiệu quả kinh doanh theo từng mã hàng</p>
        </div>
      </div>
      <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khoảng lọc: </span>
        <span className="text-xs font-black text-slate-900 ml-2">
          {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
        </span>
      </div>
    </div>

    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
            <th className="p-6">Mã sản phẩm</th>
            <th className="p-6 text-right">Số lượng bán</th>
            <th className="p-6 text-right">Doanh thu thuần</th>
            <th className="p-6 text-right">Giá vốn tổng</th>
            <th className="p-6 text-right">Phí sàn tổng</th>
            <th className="p-6 text-right">Quảng cáo tổng</th>
            <th className="p-6 text-right font-black bg-emerald-50 text-emerald-800">Lợi nhuận ròng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 text-xs font-bold tabular-nums">
          {shopeeSourceData.length > 0 ? shopeeSourceData.map(skuItem => {
            const skuOrders = shopeeInventoryOut.filter(o => o.sku === skuItem.sku && o.date >= timeContext.start && o.date <= timeContext.end);
            const totalQty = skuOrders.reduce((sum, o) => sum + o.quantity, 0);
            const totalRev = skuOrders.reduce((sum, o) => sum + o.salePrice, 0);
            const totalCogs = totalQty * skuItem.importPrice;
            const totalFees = skuOrders.reduce((sum, o) => sum + o.platformFee + o.paymentFee + o.freeshipExtra + o.handlingFee + o.affiliateFee, 0);
            const totalAds = skuOrders.reduce((sum, o) => sum + o.adsCost + o.adsTax, 0);
            const totalProfit = skuOrders.reduce((sum, o) => sum + o.netProfit, 0);
            return (
              <tr key={skuItem.id} className="hover:bg-slate-50 transition-all">
                <td className="p-6 font-black uppercase text-slate-900">{skuItem.sku}</td>
                <td className="p-6 text-right text-blue-600">{totalQty.toLocaleString()}</td>
                <td className="p-6 text-right">{formatNumber(totalRev)}đ</td>
                <td className="p-6 text-right text-slate-400">{formatNumber(totalCogs)}đ</td>
                <td className="p-6 text-right text-amber-600">{formatNumber(totalFees)}đ</td>
                <td className="p-6 text-right text-rose-400">{formatNumber(totalAds)}đ</td>
                <td className={`p-6 text-right font-black bg-emerald-50/30 ${totalProfit > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatNumber(totalProfit)}đ</td>
              </tr>
            );
          }) : (
            <tr>
              <td colSpan={7} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Chưa có dữ liệu báo cáo</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default ReportTab;
