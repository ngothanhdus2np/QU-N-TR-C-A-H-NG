import React, { useMemo } from 'react';
import { ShopeeCostConfig, ShopeeInventoryOutRecord } from '../../types';
import { DollarSign, Plus, Target, X, Zap } from 'lucide-react';

interface Props {
  shopeeCosts: ShopeeCostConfig | undefined;
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  totalFixedCosts: number;
  totalVariableCosts: number;
  fixedCostPerOrder: number;
  formatNumber: (num: number) => string;
  handleUpdateShopeeCostConfig: (updates: Partial<ShopeeCostConfig>) => void;
  handleAddShopeeCostItem: (type: 'fixed' | 'variable') => void;
  handleUpdateShopeeCostItem: (
    type: 'fixed' | 'variable',
    id: string,
    field: string,
    value: string | number | boolean
  ) => void;
  handleRemoveShopeeCostItem: (type: 'fixed' | 'variable', id: string) => void;
}

const CostTable = ({
  title,
  description,
  type,
  items,
  accentClass,
  onAdd,
  onUpdate,
  onRemove,
  formatNumber,
}: {
  title: string;
  description: string;
  type: 'fixed' | 'variable';
  items: ShopeeCostConfig['fixedCosts'];
  accentClass: string;
  onAdd: (type: 'fixed' | 'variable') => void;
  onUpdate: Props['handleUpdateShopeeCostItem'];
  onRemove: Props['handleRemoveShopeeCostItem'];
  formatNumber: (num: number) => string;
}) => (
  <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => onAdd(type)}
        className={`flex h-8 w-8 items-center justify-center rounded-md ${accentClass}`}
        title={`Thêm ${title.toLowerCase()}`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
    <div className="overflow-auto max-h-64">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
            <th className="w-12 px-4 py-3">STT</th>
            <th className="px-4 py-3">Nội dung chi</th>
            <th className="w-20 px-4 py-3 text-center">SL</th>
            <th className="w-32 px-4 py-3 text-right">Đơn giá</th>
            <th className="w-32 px-4 py-3 text-right">Tổng cộng</th>
            <th className="w-12 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <tr key={item.id} className="group hover:bg-slate-50">
              <td className="px-4 py-3 text-xs text-slate-400">{idx + 1}</td>
              <td className="px-4 py-3">
                <input
                  type="text"
                  value={item.name}
                  onChange={event => onUpdate(type, item.id, 'name', event.target.value)}
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-700 outline-none focus:border-slate-200 focus:bg-white"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={event =>
                    onUpdate(type, item.id, 'quantity', Number(event.target.value))
                  }
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-center text-sm text-slate-700 outline-none focus:border-slate-200 focus:bg-white"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={event =>
                    onUpdate(type, item.id, 'unitPrice', Number(event.target.value))
                  }
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm text-slate-700 outline-none focus:border-slate-200 focus:bg-white"
                />
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                {formatNumber(item.quantity * item.unitPrice)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onRemove(type, item.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  title="Xóa khoản chi"
                >
                  <X className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const StatCard = ({
  label,
  value,
  sub,
  color = 'text-slate-900',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className={`mt-2 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
  </div>
);

const CostsTab: React.FC<Props> = ({
  shopeeCosts,
  shopeeInventoryOut,
  totalFixedCosts,
  totalVariableCosts,
  fixedCostPerOrder,
  formatNumber,
  handleUpdateShopeeCostConfig,
  handleAddShopeeCostItem,
  handleUpdateShopeeCostItem,
  handleRemoveShopeeCostItem,
}) => {
  // Tính % thực tế từ đơn đã giao (status OK)
  const feeStats = useMemo(() => {
    const delivered = shopeeInventoryOut.filter(
      r => r.status === 'OK' && r.salePrice > 0
    );
    if (delivered.length === 0) return null;

    const avg = (fn: (r: ShopeeInventoryOutRecord) => number) =>
      (delivered.reduce((s, r) => s + fn(r), 0) / delivered.length) * 100;

    const platformPct = avg(r => r.platformFee / r.salePrice);
    const paymentPct = avg(r => r.paymentFee / r.salePrice);
    const freeshipPct = avg(r => r.freeshipExtra / r.salePrice);
    const affiliatePct = avg(r => r.affiliateFee / r.salePrice);

    const withAds = delivered.filter(r => r.adsCost > 0);
    const adsTaxPct =
      withAds.length > 0
        ? (withAds.reduce((s, r) => s + r.adsTax / r.adsCost, 0) / withAds.length) * 100
        : 0;

    return { platformPct, paymentPct, freeshipPct, affiliatePct, adsTaxPct, count: delivered.length };
  }, [shopeeInventoryOut]);

  return (
    <div className="space-y-4">
      {/* Hàng 1: Định phí & Biến phí / Đơn hàng */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Định phí & Biến phí / Đơn hàng</p>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">Tổng định phí</p>
              <DollarSign className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="mt-3 text-xl font-semibold tabular-nums text-slate-900">
              {formatNumber(totalFixedCosts)}đ
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">Định phí / đơn</p>
              <Target className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-3 text-xl font-semibold tabular-nums text-emerald-700">
              {formatNumber(fixedCostPerOrder)}đ
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Mục tiêu {shopeeCosts?.targetOrders || 0} đơn
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">Biến phí / đơn</p>
              <Zap className="h-4 w-4 text-rose-500" />
            </div>
            <p className="mt-3 text-xl font-semibold tabular-nums text-rose-600">
              {formatNumber(totalVariableCosts)}đ
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Ước tính mục tiêu đơn hàng
            </label>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="number"
                value={shopeeCosts?.targetOrders || 0}
                onChange={event =>
                  handleUpdateShopeeCostConfig({ targetOrders: Number(event.target.value) })
                }
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
              />
              <span className="text-xs text-slate-500">đơn</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hàng 2: % Phí Shopee Thực Tế */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
          % Phí Shopee Thực Tế
          {feeStats && <span className="ml-2 normal-case font-normal text-slate-400">— trung bình từ {feeStats.count} đơn đã giao</span>}
        </p>
        {feeStats ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Phí sàn" value={`${feeStats.platformPct.toFixed(2)}%`} sub="trên giá bán" color="text-indigo-700" />
            <StatCard label="Phí thanh toán" value={`${feeStats.paymentPct.toFixed(2)}%`} sub="trên giá bán" color="text-indigo-700" />
            <StatCard label="Freeship Extra" value={`${feeStats.freeshipPct.toFixed(2)}%`} sub="trên giá bán" color="text-indigo-700" />
            <StatCard label="Phí Affiliate" value={`${feeStats.affiliatePct.toFixed(2)}%`} sub="trên giá bán" color="text-indigo-700" />
          </div>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white py-6 text-center text-sm text-slate-400">
            Chưa có đơn đã giao để tính % thực tế
          </p>
        )}
      </div>

      {/* Cost tables */}
      <section className="min-w-0 space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <CostTable
            title="Định phí"
            description="Chi phí cố định hàng tháng"
            type="fixed"
            items={shopeeCosts?.fixedCosts || []}
            accentClass="bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            onAdd={handleAddShopeeCostItem}
            onUpdate={handleUpdateShopeeCostItem}
            onRemove={handleRemoveShopeeCostItem}
            formatNumber={formatNumber}
          />
          <CostTable
            title="Biến phí"
            description="Chi phí cho mỗi đơn hàng"
            type="variable"
            items={shopeeCosts?.variableCosts || []}
            accentClass="bg-rose-50 text-rose-600 hover:bg-rose-100"
            onAdd={handleAddShopeeCostItem}
            onUpdate={handleUpdateShopeeCostItem}
            onRemove={handleRemoveShopeeCostItem}
            formatNumber={formatNumber}
          />
        </div>
      </section>

    </div>
  );
};

export default CostsTab;
