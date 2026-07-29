import React, { useEffect, useMemo, useState } from 'react';
import { usePosOrders } from '../../hooks/usePosOrders';
import {
  CalendarDays,
  ChevronDown,
  FileText,
} from 'lucide-react';
import type { POSOrder, POSProduct } from '../../types';
import {
  getOrderedGoodsReportRows,
  type OrderedGoodsReportRow,
} from '../../src/lib/reportCalculations';
import {
  formatCurrencyAxis,
  formatReportNumber as formatNumber,
  formatReportDate as formatDate,
} from '../../src/lib/formatCurrency';
import ReportRangeTimeFilter from './ReportRangeTimeFilter';
import ReportDropdownFilter, { getReportDropdownOptions } from './ReportDropdownFilter';
import { getLatestOrderDate, getWeekRange, hasOrdersInDateRange } from './reportDateDefaults';

interface OrderReportPageProps {
  orders: POSOrder[];
  products?: POSProduct[];
  storeName?: string;
}

type ProductRow = OrderedGoodsReportRow;

type ViewMode = 'chart' | 'report';
type DateMode = 'week' | 'custom';

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

const FilterTextInput: React.FC<{
  label: string;
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}> = ({ label, placeholder, value = '', onChange, disabled }) => (
  <div className="mt-6">
    <label className="block text-sm font-bold">{label}</label>
    <input
      value={value}
      onChange={event => onChange?.(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={`mt-2 h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none ${
        disabled ? 'cursor-not-allowed bg-white text-slate-400' : 'bg-white text-slate-700'
      }`}
    />
  </div>
);

const OrderReportPage: React.FC<OrderReportPageProps> = ({
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
  const [customerQuery, setCustomerQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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

  const orderReportOrders = useMemo(
    // Lấy tất cả đơn bán (không phải trả hàng); getOrderedGoodsReportRows tự filter theo statusFilter
    () => orders.filter(order => !order.isReturn),
    [orders]
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
  const customerOptions = useMemo(
    () => getReportDropdownOptions(orderReportOrders.map(order => order.customerName || order.customerId)),
    [orderReportOrders]
  );
  const productOptions = useMemo(
    () =>
      getReportDropdownOptions([
        ...products.map(product => product.name || product.sku),
        ...orderReportOrders.flatMap(order => (order.items || []).map(item => item.name || item.sku)),
      ]),
    [orderReportOrders, products]
  );
  const statusOptions = useMemo(
    () => [
      { value: 'completed', label: 'Hoàn thành' },
      { value: 'pending', label: 'Đang xử lý' },
      { value: 'draft', label: 'Nháp' },
      { value: 'cancelled', label: 'Đã hủy' },
    ],
    []
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

  const productRows = useMemo<ProductRow[]>(
    () =>
      getOrderedGoodsReportRows(orderReportOrders, { startDate, endDate }, { customerQuery, productQuery, mergeSameGoods, status: statusFilter, allowedProductIds }),
    [allowedProductIds, customerQuery, endDate, mergeSameGoods, orderReportOrders, productQuery, startDate, statusFilter]
  );

  const topRows = productRows.slice(0, 10);
  const maxValue = Math.max(...topRows.map(row => row.value), 0);
  const xMax = maxValue > 0 ? Math.ceil(maxValue / 1_000_000) * 1_000_000 : 0;
  const titleRange =
    dateMode === 'week'
      ? 'tuần này'
      : `từ ${formatDate(startDate)} đến ${formatDate(endDate)}`;

  const applyWeek = () => {
    setDateMode('week');
    setStartDate(weekRange.start);
    setEndDate(weekRange.end);
  };


  const handleDownload = () => {
    const header = ['Mã hàng', 'Tên hàng', 'SL đặt', 'Giá trị'];
    const csvRows = [
      header.join(','),
      ...productRows.map(row =>
        [row.sku, `"${row.name}"`, row.quantity, row.value].join(',')
      ),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-dat-hang-${startDate}-${endDate}.csv`;
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
              value="goods"
              placeholder="Hàng hóa"
              options={[{ value: 'goods', label: 'Hàng hóa' }]}
              onChange={() => undefined}
              allowAll={false}
            />

            <label className="mt-6 block text-sm font-bold">Thời gian đặt hàng</label>
            <div className="mt-2">
              <ReportRangeTimeFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onCustomMode={() => setDateMode('custom')}
              />
            </div>

            <label className="mt-6 block text-sm font-bold">Thời gian giao hàng</label>
            <ReportDropdownFilter
              value="all"
              placeholder="Toàn thời gian"
              options={[{ value: 'all', label: 'Toàn thời gian' }]}
              onChange={() => undefined}
              allowAll={false}
            />

            <div className="mt-6">
              <label className="block text-sm font-bold">Trạng thái</label>
              <ReportDropdownFilter
                value={statusFilter}
                placeholder="Tất cả"
                options={statusOptions}
                onChange={setStatusFilter}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Khách hàng</label>
              <ReportDropdownFilter
                value={customerQuery}
                placeholder="Theo mã, tên, số điện thoại"
                options={customerOptions}
                onChange={setCustomerQuery}
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
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h1 className="mb-5 flex items-center gap-3 text-2xl font-bold">
            Báo cáo đặt hàng
            {ordersLoading && <span className="text-sm font-normal text-slate-400">Đang tải...</span>}
          </h1>
          {viewMode === 'chart' ? (
            <div className="min-h-0 flex-1 bg-white p-6">
              <h2 className="text-center text-lg font-medium text-slate-700">
                Top 10 hàng hóa được đặt nhiều nhất
              </h2>
              <div className="mt-4 h-[500px] border-b border-l border-r border-slate-300 px-4 py-6">
                {topRows.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Không có dữ liệu trong khoảng thời gian đã chọn
                  </div>
                ) : (
                  <div className="flex h-full flex-col justify-center gap-3">
                    {topRows.map(row => (
                      <div key={row.key} className="grid grid-cols-[220px_1fr_88px] items-center gap-3 text-sm">
                        <div className="truncate text-right text-slate-700" title={row.name}>
                          {row.name}
                        </div>
                        <div className="h-6 bg-slate-100">
                          <div
                            className="h-full bg-indigo-600"
                            style={{ width: xMax > 0 ? `${Math.max((row.value / xMax) * 100, 1)}%` : 0 }}
                          />
                        </div>
                        <div className="text-right text-slate-600">{formatNumber(row.quantity)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>0</span>
                <span>{formatCurrencyAxis(xMax)}</span>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mb-5 text-center">
                <div className="mb-1 text-xs text-slate-400">Ngày lập: {createdAt}</div>
                <h2 className="text-xl font-bold text-slate-800">Báo cáo đặt hàng theo hàng hóa</h2>
                <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                  <p>Từ ngày {formatDate(startDate)} đến ngày {formatDate(endDate)}</p>
                  <p>Chi nhánh: {storeName}</p>
                </div>
              </div>

                  <table className="mt-10 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#a9dff3] text-slate-800">
                        <th className="border border-[#a7bac5] px-3 py-3 text-left font-bold">
                          Mã hàng
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-left font-bold">
                          Tên hàng
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          SL đặt
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          Giá trị hàng đặt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.length === 0 ? (
                        <tr className="bg-[#f5f0cf]">
                          <td
                            colSpan={4}
                            className="border border-[#c3c4ba] px-3 py-4 text-center italic text-slate-700"
                          >
                            Báo cáo không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        productRows.map(row => (
                          <tr key={row.key} className="font-semibold text-slate-800">
                            <td className="border-b border-slate-300 px-3 py-3">{row.sku}</td>
                            <td className="border-b border-slate-300 px-3 py-3">{row.name}</td>
                            <td className="border-b border-slate-300 px-3 py-3 text-right">
                              {formatNumber(row.quantity)}
                            </td>
                            <td className="border-b border-slate-300 px-3 py-3 text-right">
                              {formatNumber(row.value)}
                            </td>
                          </tr>
                        ))
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

export default OrderReportPage;
