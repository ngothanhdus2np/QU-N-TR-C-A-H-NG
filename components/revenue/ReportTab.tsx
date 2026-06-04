import React from 'react';
import { ShopeeInventoryOutRecord, ShopeeSourceItem } from '../../types';

interface Props {
  shopeeSourceData: ShopeeSourceItem[];
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  timeContext: { start: string; end: string };
  formatNumber: (num: number) => string;
}

const ReportTab: React.FC<Props> = ({
  shopeeSourceData,
  shopeeInventoryOut,
  timeContext,
  formatNumber,
}) => (
  <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Báo cáo sản phẩm</h3>
        <p className="text-xs text-slate-500">
          {timeContext.start.split('-').reverse().join('/')} {'->'}{' '}
          {timeContext.end.split('-').reverse().join('/')}
        </p>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
            <th className="px-4 py-3">Mã sản phẩm</th>
            <th className="px-4 py-3 text-right">Số lượng bán</th>
            <th className="px-4 py-3 text-right">Doanh thu thuần</th>
            <th className="px-4 py-3 text-right">Giá vốn tổng</th>
            <th className="px-4 py-3 text-right">Phí sàn tổng</th>
            <th className="px-4 py-3 text-right">Quảng cáo tổng</th>
            <th className="px-4 py-3 text-right text-emerald-800">Lợi nhuận ròng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums">
          {shopeeSourceData.length > 0 ? (
            shopeeSourceData.map(skuItem => {
              const skuOrders = shopeeInventoryOut.filter(
                o =>
                  o.sku === skuItem.sku && o.date >= timeContext.start && o.date <= timeContext.end
              );
              const totalSkuQty = skuOrders.reduce((sum, o) => sum + o.quantity, 0);
              const totalRev = skuOrders.reduce((sum, o) => sum + o.salePrice, 0);
              const totalCogs = totalSkuQty * skuItem.importPrice;
              const totalFees = skuOrders.reduce(
                (sum, o) =>
                  sum +
                  o.platformFee +
                  o.paymentFee +
                  o.freeshipExtra +
                  o.handlingFee +
                  o.affiliateFee,
                0
              );
              const totalAds = skuOrders.reduce((sum, o) => sum + o.adsCost + o.adsTax, 0);
              const skuProfit = skuOrders.reduce((sum, o) => sum + o.netProfit, 0);
              return (
                <tr key={skuItem.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold uppercase text-slate-900">
                    {skuItem.sku}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-600">
                    {totalSkuQty.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">{formatNumber(totalRev)}đ</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {formatNumber(totalCogs)}đ
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {formatNumber(totalFees)}đ
                  </td>
                  <td className="px-4 py-3 text-right text-rose-500">{formatNumber(totalAds)}đ</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      skuProfit > 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {formatNumber(skuProfit)}đ
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-400">
                Chưa có dữ liệu báo cáo
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);

export default ReportTab;
