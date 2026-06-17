import React, { useEffect, useMemo, useState } from 'react';
import { usePosOrders } from '../../hooks/usePosOrders';
import {
  ChevronDown,
  FileText,
} from 'lucide-react';
import type { POSOrder, POSProduct } from '../../types';
import {
  getGoodsReportRows,
  type GoodsReportRow,
} from '../../src/lib/reportCalculations';
import ReportRangeTimeFilter from './ReportRangeTimeFilter';
import ReportDropdownFilter, { getReportDropdownOptions } from './ReportDropdownFilter';
import { getLatestOrderDate, getWeekRange, hasOrdersInDateRange } from './reportDateDefaults';

interface GoodsReportPageProps {
  orders: POSOrder[];
  products?: POSProduct[];
  storeName?: string;
}

type GoodsRow = GoodsReportRow;

type ViewMode = 'chart' | 'report';
type DateMode = 'week' | 'custom';

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const formatAxis = (value: number) => {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))} tr`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
};


const SelectButton: React.FC<{
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ children, active, disabled, onClick }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm ${
      active ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-slate-200'
    } ${disabled ? 'cursor-not-allowed text-slate-400' : 'text-slate-700'}`}
  >
    <span>{children}</span>
    <ChevronDown className="h-4 w-4 text-slate-500" />
  </button>
);

const HorizontalBarChart: React.FC<{
  title: string;
  rows: GoodsRow[];
  valueKey: 'netRevenue' | 'soldQty';
  valueLabel: (row: GoodsRow) => string;
}> = ({ title, rows, valueKey, valueLabel }) => {
  const maxValue = Math.max(...rows.map(row => row[valueKey]), 0);
  const axisMax = maxValue > 0 ? Math.ceil(maxValue / (valueKey === 'soldQty' ? 5 : 40000)) * (valueKey === 'soldQty' ? 5 : 40000) : 0;
  const ticks = axisMax > 0 ? Array.from({ length: 6 }, (_, index) => (axisMax / 5) * index) : [];

  return (
    <div className="bg-white px-6 py-5">
      <h2 className="text-center text-lg font-medium text-slate-700">{title}</h2>
      <div className="mt-4 grid min-h-[360px] grid-cols-[320px_1fr]">
        <div className="flex flex-col justify-around gap-2 pr-3 text-right text-sm text-slate-700">
          {rows.length === 0
            ? null
            : rows.map(row => (
                <div key={row.key} className="truncate" title={row.name}>
                  {row.name}
                </div>
              ))}
        </div>
        <div className="relative border-b border-l border-r border-slate-300">
          {ticks.map(tick => (
            <div
              key={tick}
              className="absolute bottom-0 top-0 border-l border-slate-200"
              style={{ left: axisMax > 0 ? `${(tick / axisMax) * 100}%` : 0 }}
            />
          ))}
          {rows.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Không có dữ liệu trong khoảng thời gian đã chọn
            </div>
          ) : (
            <div className="relative z-10 flex h-full flex-col justify-around gap-2 py-2">
              {rows.map(row => (
                <div key={row.key} className="h-7">
                  <div
                    className="h-full bg-indigo-600"
                    style={{
                      width:
                        axisMax > 0
                          ? `${Math.max((row[valueKey] / axisMax) * 100, 1)}%`
                          : 0,
                    }}
                    title={`${row.name}: ${valueLabel(row)}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="ml-[320px] flex justify-between text-xs text-slate-600">
        {ticks.length > 0 ? ticks.map(tick => <span key={tick}>{formatAxis(tick)}</span>) : <span>0</span>}
      </div>
    </div>
  );
};

const GoodsReportPage: React.FC<GoodsReportPageProps> = ({
  orders: bootstrapOrders,
  products = [],
  storeName = 'Chi nhánh trung tâm',
}) => {
  const weekRange = useMemo(() => getWeekRange(), []);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [dateMode, setDateMode] = useState<DateMode>('week');
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [mergeSameGoods, setMergeSameGoods] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [priceBookQuery, setPriceBookQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const { orders, isLoading: ordersLoading } = usePosOrders(bootstrapOrders, startDate, endDate);
  useEffect(() => {
    if (dateMode === 'custom') return;
    if (orders.length === 0 || hasOrdersInDateRange(orders, startDate, endDate)) return;
    const latestDate = getLatestOrderDate(orders);
    if (!latestDate) return;
    const nextRange = getWeekRange(new Date(`${latestDate}T00:00:00`));
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
    setDateMode('week');
  }, [endDate, orders, startDate]);
  const createdAt = useMemo(
    () =>
      new Date().toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of products) {
      const cat = p.categoryPath || p.categoryId || '';
      if (cat && !seen.has(cat)) { seen.add(cat); list.push(cat); }
    }
    return list.sort();
  }, [products]);

  const brands = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of products) {
      if (p.brand && !seen.has(p.brand)) { seen.add(p.brand); list.push(p.brand); }
    }
    return list.sort();
  }, [products]);
  const priceBookOptions = useMemo(
    () => getReportDropdownOptions(orders.map(order => order.priceBookName || order.priceBookId)),
    [orders]
  );
  const productOptions = useMemo(
    () =>
      getReportDropdownOptions([
        ...products.map(product => product.name || product.sku),
        ...orders.flatMap(order => order.items.map(item => item.name || item.sku)),
      ]),
    [orders, products]
  );
  const categoryOptions = useMemo(
    () => categories.map(category => ({ value: category, label: category })),
    [categories]
  );
  const brandOptions = useMemo(
    () => brands.map(brand => ({ value: brand, label: brand })),
    [brands]
  );

  const allowedProductIds = useMemo<Set<string> | undefined>(() => {
    if (!categoryFilter && !brandFilter) return undefined;
    const ids = new Set<string>();
    for (const p of products) {
      if (categoryFilter && (p.categoryPath || p.categoryId || '') !== categoryFilter) continue;
      if (brandFilter && p.brand !== brandFilter) continue;
      if (p.id) ids.add(p.id);
    }
    return ids;
  }, [products, categoryFilter, brandFilter]);

  const goodsRows = useMemo<GoodsRow[]>(
    () =>
      getGoodsReportRows(orders, { startDate, endDate }, { query: productQuery, mergeSameGoods, priceBookQuery, allowedProductIds }),
    [allowedProductIds, endDate, mergeSameGoods, orders, priceBookQuery, productQuery, startDate]
  );

  const totals = useMemo(
    () =>
      goodsRows.reduce(
        (sum, row) => ({
          soldQty: sum.soldQty + row.soldQty,
          revenue: sum.revenue + row.revenue,
          returnQty: sum.returnQty + row.returnQty,
          returnValue: sum.returnValue + row.returnValue,
          netRevenue: sum.netRevenue + row.netRevenue,
        }),
        { soldQty: 0, revenue: 0, returnQty: 0, returnValue: 0, netRevenue: 0 }
      ),
    [goodsRows]
  );

  const topRevenueRows = goodsRows.slice(0, 10);
  const topQuantityRows = [...goodsRows].sort((a, b) => b.soldQty - a.soldQty || b.netRevenue - a.netRevenue).slice(0, 10);

  const applyWeek = () => {
    setDateMode('week');
    setStartDate(weekRange.start);
    setEndDate(weekRange.end);
  };


  const handleDownload = () => {
    const header = ['Mã hàng', 'Tên hàng', 'SL Bán', 'Doanh thu', 'SL Trả', 'Giá trị trả', 'Doanh thu thuần'];
    const csvRows = [
      header.join(','),
      ...goodsRows.map(row =>
        [row.sku, `"${row.name}"`, row.soldQty, row.revenue, row.returnQty, row.returnValue, row.netRevenue].join(',')
      ),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-hang-hoa-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full min-h-0 text-slate-900">
      <div className="flex h-full min-h-0 w-full gap-4 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="h-full overflow-y-auto px-4 py-4">
            {viewMode === 'report' && (
              <button onClick={handleDownload} className="mb-5 flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 px-3 text-left text-sm font-bold text-slate-700">
                <FileText className="h-4 w-4" />
                Xuất tất cả
              </button>
            )}

            <h2 className="text-base font-bold">Kiểu hiển thị</h2>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setViewMode('chart')}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  viewMode === 'chart'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Biểu đồ
              </button>
              <button
                onClick={() => setViewMode('report')}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  viewMode === 'report'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Báo cáo
              </button>
            </div>

            <div className="my-5 h-px bg-slate-200" />

            {viewMode === 'report' && (
              <div className="mb-4">
                <ReportDropdownFilter
                  value="vertical"
                  placeholder="Hiển thị dọc"
                  options={[{ value: 'vertical', label: 'Hiển thị dọc' }]}
                  onChange={() => undefined}
                  allowAll={false}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={mergeSameGoods}
                onChange={event => setMergeSameGoods(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              Gộp hàng hóa cùng loại
            </label>
            {viewMode === 'report' && (
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Gộp theo nhóm hàng
              </label>
            )}

            <label className="mt-6 block text-sm font-bold">Mối quan tâm</label>
            <ReportDropdownFilter
              value="sales"
              placeholder="Bán hàng"
              options={[{ value: 'sales', label: 'Bán hàng' }]}
              onChange={() => undefined}
              allowAll={false}
            />

            <div className="mt-6">
              <label className="block text-sm font-bold">Bảng giá</label>
              <ReportDropdownFilter
                value={priceBookQuery}
                placeholder="Chọn bảng giá"
                options={priceBookOptions}
                onChange={setPriceBookQuery}
              />
            </div>

            <label className="mt-6 block text-sm font-bold">Thời gian</label>
            <div className="mt-2">
              <ReportRangeTimeFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onCustomMode={() => setDateMode('custom')}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Hàng hóa</label>
              <ReportDropdownFilter
                value={productQuery}
                placeholder="Theo mã, tên hàng"
                options={productOptions}
                onChange={setProductQuery}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Loại hàng</label>
              <ReportDropdownFilter
                value={categoryFilter}
                placeholder="Tất cả"
                options={categoryOptions}
                onChange={setCategoryFilter}
              />
            </div>
            <div className="mt-6">
              <label className="block text-sm font-bold">Thương hiệu</label>
              <ReportDropdownFilter
                value={brandFilter}
                placeholder="Tất cả"
                options={brandOptions}
                onChange={setBrandFilter}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Thuộc tính</label>
              <div className="mt-2 space-y-2">
                <ReportDropdownFilter value="" placeholder="--- SIZE ---" options={[]} onChange={() => undefined} allowAll={false} />
                <ReportDropdownFilter value="" placeholder="--- MÀU ---" options={[]} onChange={() => undefined} allowAll={false} />
                <ReportDropdownFilter value="" placeholder="--- MÀU SẮC ---" options={[]} onChange={() => undefined} allowAll={false} />
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h1 className="mb-5 flex items-center gap-3 text-2xl font-bold">
            Báo cáo hàng hóa
            {ordersLoading && <span className="text-sm font-normal text-slate-400">Đang tải...</span>}
          </h1>
          {viewMode === 'chart' ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-auto">
              <HorizontalBarChart
                title="Top 10 sản phẩm doanh thu cao nhất (đã trừ trả hàng)"
                rows={topRevenueRows}
                valueKey="netRevenue"
                valueLabel={row => formatNumber(row.netRevenue)}
              />
              <HorizontalBarChart
                title="Top 10 sản phẩm bán chạy theo số lượng (đã trừ trả hàng)"
                rows={topQuantityRows}
                valueKey="soldQty"
                valueLabel={row => formatNumber(row.soldQty)}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mb-5 text-center">
                <div className="mb-1 text-xs text-slate-400">Ngày lập: {createdAt}</div>
                <h2 className="text-xl font-bold text-slate-800">Báo cáo bán hàng theo hàng hóa</h2>
                <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                  <p>Từ ngày {formatDate(startDate)} đến ngày {formatDate(endDate)}</p>
                  <p>Chi nhánh: {storeName}</p>
                </div>
              </div>

                  <table className="mt-4 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#a9dff3] text-slate-800">
                        <th className="border border-[#a7bac5] px-2.5 py-3 text-left font-bold">
                          Mã hàng
                        </th>
                        <th className="border border-[#a7bac5] px-2.5 py-3 text-left font-bold">
                          Tên hàng
                        </th>
                        <th className="border border-[#a7bac5] px-2.5 py-3 text-right font-bold">
                          SL Bán
                        </th>
                        <th className="border border-[#a7bac5] px-2.5 py-3 text-right font-bold">
                          Doanh thu
                        </th>
                        <th className="border border-[#a7bac5] px-2.5 py-3 text-right font-bold">
                          SL Trả
                        </th>
                        <th className="border border-[#a7bac5] px-2.5 py-3 text-right font-bold">
                          Giá trị trả
                        </th>
                        <th className="border border-[#a7bac5] px-2.5 py-3 text-right font-bold">
                          Doanh thu thuần
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {goodsRows.length === 0 ? (
                        <tr className="bg-[#f5f0cf]">
                          <td
                            colSpan={7}
                            className="border border-[#c3c4ba] px-3 py-4 text-center italic text-slate-700"
                          >
                            Báo cáo không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        <>
                          <tr className="bg-[#f5f0cf] font-bold text-slate-800">
                            <td className="border border-[#c3c4ba] px-2.5 py-3" colSpan={2}>
                              SL mặt hàng: {goodsRows.length}
                            </td>
                            <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                              {formatNumber(totals.soldQty)}
                            </td>
                            <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                              {formatNumber(totals.revenue)}
                            </td>
                            <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                              {formatNumber(totals.returnQty)}
                            </td>
                            <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                              {totals.returnValue > 0 ? `-${formatNumber(totals.returnValue)}` : '0'}
                            </td>
                            <td className="border border-[#c3c4ba] px-2.5 py-3 text-right text-blue-700">
                              {formatNumber(totals.netRevenue)}
                            </td>
                          </tr>
                          {goodsRows.map(row => (
                            <tr key={row.key} className="font-semibold text-slate-800">
                              <td className="border-b border-slate-300 px-2.5 py-3 text-blue-700">
                                {row.sku}
                              </td>
                              <td className="border-b border-slate-300 px-2.5 py-3">{row.name}</td>
                              <td className="border-b border-slate-300 px-2.5 py-3 text-right">
                                {formatNumber(row.soldQty)}
                              </td>
                              <td className="border-b border-slate-300 px-2.5 py-3 text-right">
                                {formatNumber(row.revenue)}
                              </td>
                              <td className="border-b border-slate-300 px-2.5 py-3 text-right">
                                {formatNumber(row.returnQty)}
                              </td>
                              <td className="border-b border-slate-300 px-2.5 py-3 text-right">
                                {row.returnValue > 0 ? `-${formatNumber(row.returnValue)}` : '0'}
                              </td>
                              <td className="border-b border-slate-300 px-2.5 py-3 text-right">
                                {formatNumber(row.netRevenue)}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default GoodsReportPage;
