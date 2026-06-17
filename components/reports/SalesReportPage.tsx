import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import type { POSOrder, POSProduct } from '../../types';
import { usePosOrders } from '../../hooks/usePosOrders';
import {
  getReportTotals,
  getSalesHorizontalRowsByDate,
  getSalesInvoiceDiscountRowsByDate,
  getSalesProfitRowsByDate,
  getSalesRowsByDate,
  getSalesStaffRows,
  type SalesHorizontalReportRow,
  type SalesInvoiceDiscountReportRow,
  type SalesProfitRow,
  type SalesStaffReportRow,
  type SalesTimeRow,
} from '../../src/lib/reportCalculations';
import ReportRangeTimeFilter from './ReportRangeTimeFilter';
import { getLatestOrderDate, getWeekRange, hasOrdersInDateRange } from './reportDateDefaults';

interface SalesReportPageProps {
  orders: POSOrder[];
  products?: POSProduct[];
  storeName?: string;
  employees?: import('../../types').Employee[];
  inventoryTransactions?: import('../../types').InventoryTransaction[];
}

type ViewMode = 'chart' | 'report';
type DateMode = 'week' | 'custom';
type InterestMode = 'time' | 'profit' | 'discount' | 'returns' | 'staff';
type ReportLayout = 'vertical' | 'horizontal';
type SalesDropdownKey = 'layout' | 'interest' | 'priceBook' | 'payment' | 'creator' | 'channel';

interface ReportTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
  total?: React.ReactNode;
}

interface DropdownOption {
  value: string;
  label: string;
}

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const formatCurrencyAxis = (value: number) => {
  if (value >= 1_000_000_000) return `${Number((value / 1_000_000_000).toFixed(1))} tỷ`;
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))} tr`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
};


const getUniqueOptions = (values: Array<string | undefined>): DropdownOption[] =>
  Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map(value => ({ value, label: value }));

const getSelectedLabel = (options: DropdownOption[], value: string, placeholder: string) =>
  options.find(option => option.value === value)?.label || placeholder;

const SalesReportPage: React.FC<SalesReportPageProps> = ({
  orders: bootstrapOrders,
  products = [],
  storeName = 'Chi nhánh trung tâm',
  employees = [],
  inventoryTransactions = [],
}) => {
  const weekRange = useMemo(() => getWeekRange(), []);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [dateMode, setDateMode] = useState<DateMode>('week');
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [priceBookQuery, setPriceBookQuery] = useState('');
  const [channelQuery, setChannelQuery] = useState('');
  const [createdByQuery, setCreatedByQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [interestMode, setInterestMode] = useState<InterestMode>('time');
  const [reportLayout, setReportLayout] = useState<ReportLayout>('vertical');
  const [openDropdown, setOpenDropdown] = useState<SalesDropdownKey | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
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
  }, [endDate, orders, startDate, dateMode]);
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

  const buckets = useMemo<SalesTimeRow[]>(
    () =>
      getSalesRowsByDate(orders, { startDate, endDate }, {
        priceBookQuery,
        channelQuery,
        createdByQuery,
        paymentMethod: paymentMethodFilter,
      }),
    [channelQuery, createdByQuery, endDate, orders, paymentMethodFilter, priceBookQuery, startDate]
  );

  const profitBuckets = useMemo<SalesProfitRow[]>(
    () =>
      getSalesProfitRowsByDate(orders, products, { startDate, endDate }, {
        priceBookQuery,
        channelQuery,
        createdByQuery,
        paymentMethod: paymentMethodFilter,
      }, inventoryTransactions),
    [channelQuery, createdByQuery, endDate, inventoryTransactions, orders, paymentMethodFilter, priceBookQuery, products, startDate]
  );

  const horizontalRows = useMemo<SalesHorizontalReportRow[]>(
    () =>
      getSalesHorizontalRowsByDate(orders, { startDate, endDate }, {
        priceBookQuery,
        channelQuery,
        createdByQuery,
        paymentMethod: paymentMethodFilter,
      }),
    [channelQuery, createdByQuery, endDate, orders, paymentMethodFilter, priceBookQuery, startDate]
  );

  const staffRows = useMemo<SalesStaffReportRow[]>(
    () =>
      getSalesStaffRows(orders, { startDate, endDate }, {
        priceBookQuery,
        channelQuery,
        createdByQuery,
        paymentMethod: paymentMethodFilter,
      }, employees),
    [channelQuery, createdByQuery, endDate, orders, paymentMethodFilter, priceBookQuery, startDate]
  );

  const discountRows = useMemo<SalesInvoiceDiscountReportRow[]>(
    () =>
      getSalesInvoiceDiscountRowsByDate(orders, { startDate, endDate }, {
        priceBookQuery,
        channelQuery,
        createdByQuery,
        paymentMethod: paymentMethodFilter,
      }),
    [channelQuery, createdByQuery, endDate, orders, paymentMethodFilter, priceBookQuery, startDate]
  );

  const totals = useMemo(() => getReportTotals(buckets), [buckets]);
  const horizontalTotals = useMemo(
    () =>
      horizontalRows.reduce(
        (sum, row) => ({
          saleOrderCount: sum.saleOrderCount + row.saleOrderCount,
          grossAmount: sum.grossAmount + row.grossAmount,
          discount: sum.discount + row.discount,
          revenue: sum.revenue + row.revenue,
          returnOrderCount: sum.returnOrderCount + row.returnOrderCount,
          returnValue: sum.returnValue + row.returnValue,
          returnRefund: sum.returnRefund + row.returnRefund,
          netRevenue: sum.netRevenue + row.netRevenue,
        }),
        {
          saleOrderCount: 0,
          grossAmount: 0,
          discount: 0,
          revenue: 0,
          returnOrderCount: 0,
          returnValue: 0,
          returnRefund: 0,
          netRevenue: 0,
        }
      ),
    [horizontalRows]
  );

  const maxNet = Math.max(...buckets.map(bucket => bucket.netRevenue), 0);
  const maxProfitChart = Math.max(
    ...profitBuckets.flatMap(bucket => [bucket.revenue, bucket.cogs, bucket.profit]),
    0
  );
  const chartMax = interestMode === 'profit' ? maxProfitChart : maxNet;
  const yMax = chartMax > 0 ? Math.ceil(chartMax / 300000) * 300000 : 0;
  const yTicks = yMax > 0 ? Array.from({ length: 6 }, (_, index) => (yMax / 5) * index) : [];
  const titleRange =
    dateMode === 'week'
      ? 'tuần này'
      : `từ ${formatDate(startDate)} đến ${formatDate(endDate)}`;
  const chartTitle = `${interestMode === 'profit' ? 'Lợi nhuận' : 'Doanh thu thuần'} ${titleRange}`;

  const staffTotals = useMemo(
    () =>
      staffRows.reduce(
        (sum, row) => ({
          saleOrderCount: sum.saleOrderCount + row.saleOrderCount,
          revenue: sum.revenue + row.revenue,
          returnOrderCount: sum.returnOrderCount + row.returnOrderCount,
          returnValue: sum.returnValue + row.returnValue,
          netRevenue: sum.netRevenue + row.netRevenue,
        }),
        {
          saleOrderCount: 0,
          revenue: 0,
          returnOrderCount: 0,
          returnValue: 0,
          netRevenue: 0,
        }
      ),
    [staffRows]
  );

  const discountTotals = useMemo(
    () =>
      discountRows.reduce(
        (sum, row) => ({
          invoiceCount: sum.invoiceCount + row.invoiceCount,
          invoiceValue: sum.invoiceValue + row.invoiceValue,
          discountValue: sum.discountValue + row.discountValue,
        }),
        { invoiceCount: 0, invoiceValue: 0, discountValue: 0 }
      ),
    [discountRows]
  );

  const reportTitle =
    interestMode === 'discount'
      ? 'Báo cáo tổng hợp giảm giá hóa đơn'
      : 'Báo cáo bán hàng theo thời gian';

  const layoutOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'vertical', label: 'Hiển thị dọc' },
      { value: 'horizontal', label: 'Hiển thị ngang' },
    ],
    []
  );

  const interestOptions = useMemo<DropdownOption[]>(
    () =>
      viewMode === 'chart'
        ? [
            { value: 'time', label: 'Thời gian' },
            { value: 'profit', label: 'Lợi nhuận' },
          ]
        : [
            { value: 'time', label: 'Thời gian' },
            { value: 'profit', label: 'Lợi nhuận' },
            { value: 'discount', label: 'Giảm giá HĐ' },
            { value: 'returns', label: 'Trả hàng' },
            { value: 'staff', label: 'Nhân viên' },
          ],
    [viewMode]
  );

  const priceBookOptions = useMemo(
    () => getUniqueOptions(orders.map(order => order.priceBookName || order.priceBookId)),
    [orders]
  );

  const creatorOptions = useMemo(
    () => getUniqueOptions(orders.map(order => order.createdBy || order.staffId)),
    [orders]
  );

  const channelOptions = useMemo(
    () => getUniqueOptions(orders.map(order => order.channelName || order.channel)),
    [orders]
  );

  const paymentOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'Cash', label: 'Tiền mặt' },
      { value: 'Bank', label: 'Chuyển khoản' },
      { value: 'Card', label: 'Thẻ' },
      { value: 'Momo', label: 'Momo' },
      { value: 'Other', label: 'Khác' },
    ],
    []
  );

  useEffect(() => {
    if (viewMode === 'chart' && !['time', 'profit'].includes(interestMode)) {
      setInterestMode('time');
    }
  }, [interestMode, viewMode]);

  // Reset về trang 1 khi đổi chế độ hoặc khoảng ngày
  useEffect(() => { setPage(1); }, [interestMode, reportLayout, startDate, endDate, viewMode]);

  const applyWeek = () => {
    setDateMode('week');
    setStartDate(weekRange.start);
    setEndDate(weekRange.end);
  };

  const handleDownload = () => {
    const header = ['Thời gian', 'Doanh thu', 'Giá trị trả', 'Doanh thu thuần'];
    const csvRows = [
      header.join(','),
      ...buckets.map(b => [b.hour, b.revenue, b.returned, b.netRevenue].join(',')),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-ban-hang-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderDropdownFilter = ({
    dropdownKey,
    value,
    placeholder,
    options,
    onChange,
    allowAll = true,
  }: {
    dropdownKey: SalesDropdownKey;
    value: string;
    placeholder: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    allowAll?: boolean;
  }) => {
    const isOpen = openDropdown === dropdownKey;
    const visibleOptions = allowAll && options.length > 0 ? [{ value: '', label: 'Tất cả' }, ...options] : options;

    return (
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setOpenDropdown(isOpen ? null : dropdownKey)}
          className={`flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm transition ${
            isOpen ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-slate-200'
          } ${value ? 'text-slate-700' : 'text-slate-400'}`}
        >
          <span className="truncate">
            {value ? getSelectedLabel(options, value, placeholder) : placeholder}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
            {visibleOptions.length > 0 ? (
              visibleOptions.map(option => (
                <button
                  key={`${dropdownKey}-${option.value || 'all'}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpenDropdown(null);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left transition hover:bg-blue-50 ${
                    option.value === value ? 'font-semibold text-blue-600' : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-slate-400">Chưa có dữ liệu</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReportTable = <T extends { key: string }>(
    rows: T[],
    columns: ReportTableColumn<T>[],
    textSize = 'text-sm',
    minWidth = ''
  ) => (
    <table className={`mt-10 w-full border-collapse ${textSize} ${minWidth}`}>
      <thead>
        <tr className="bg-[#a9dff3] text-slate-800">
          {columns.map(column => (
            <th
              key={column.key}
              className={`border border-[#a7bac5] px-3 py-3 font-bold ${
                column.align === 'right' ? 'text-center' : 'text-left'
              }`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="bg-[#f5f0cf] font-bold text-slate-800">
          {columns.map(column => (
            <td
              key={column.key}
              className={`border border-[#c3c4ba] px-3 py-3 ${
                column.align === 'right' ? 'text-center' : 'text-left'
              } ${column.key === 'netRevenue' ? 'text-blue-700' : ''}`}
            >
              {column.total ?? ''}
            </td>
          ))}
        </tr>
        {rows.map(row => (
          <tr key={row.key} className="font-semibold text-slate-800">
            {columns.map(column => (
              <td
                key={column.key}
                className={`border-b border-slate-300 px-3 py-3 ${
                  column.align === 'right' ? 'text-center' : 'text-left'
                } ${column.key === 'label' || column.key === 'staffName' ? 'text-blue-700' : ''}`}
              >
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const timeVerticalColumns: ReportTableColumn<SalesTimeRow & { key: string }>[] = [
    {
      key: 'label',
      label: 'Thời gian',
      render: row => (
        <>
          <span className="mr-2 inline-flex h-4 w-4 items-center justify-center border border-slate-800 text-xs leading-none text-slate-800">
            +
          </span>
          {row.hour}
        </>
      ),
    },
    {
      key: 'revenue',
      label: 'Doanh thu',
      align: 'right',
      render: row => formatNumber(row.revenue),
      total: formatNumber(totals.revenue),
    },
    {
      key: 'returned',
      label: 'Giá trị trả',
      align: 'right',
      render: row => (row.returned > 0 ? `-${formatNumber(row.returned)}` : '0'),
      total: totals.returned > 0 ? `-${formatNumber(totals.returned)}` : '0',
    },
    {
      key: 'netRevenue',
      label: 'Doanh thu thuần',
      align: 'right',
      render: row => formatNumber(row.netRevenue),
      total: formatNumber(totals.netRevenue),
    },
  ];

  const horizontalColumns: ReportTableColumn<SalesHorizontalReportRow>[] = [
    { key: 'label', label: 'Thời gian', render: row => row.label },
    { key: 'saleOrderCount', label: 'SL đơn bán', align: 'right', render: row => formatNumber(row.saleOrderCount), total: formatNumber(horizontalTotals.saleOrderCount) },
    { key: 'grossAmount', label: 'Tổng tiền hàng', align: 'right', render: row => formatNumber(row.grossAmount), total: formatNumber(horizontalTotals.grossAmount) },
    { key: 'discount', label: 'Giảm giá', align: 'right', render: row => (row.discount > 0 ? `-${formatNumber(row.discount)}` : '0'), total: horizontalTotals.discount > 0 ? `-${formatNumber(horizontalTotals.discount)}` : '0' },
    { key: 'revenue', label: 'Doanh thu', align: 'right', render: row => formatNumber(row.revenue), total: formatNumber(horizontalTotals.revenue) },
    { key: 'returnOrderCount', label: 'SL đơn trả', align: 'right', render: row => formatNumber(row.returnOrderCount), total: formatNumber(horizontalTotals.returnOrderCount) },
    { key: 'returnValue', label: 'Giá trị trả', align: 'right', render: row => (row.returnValue > 0 ? `-${formatNumber(row.returnValue)}` : '0'), total: horizontalTotals.returnValue > 0 ? `-${formatNumber(horizontalTotals.returnValue)}` : '0' },
    { key: 'returnRefund', label: 'Tiền trả khách', align: 'right', render: row => (row.returnRefund > 0 ? `-${formatNumber(row.returnRefund)}` : '0'), total: horizontalTotals.returnRefund > 0 ? `-${formatNumber(horizontalTotals.returnRefund)}` : '0' },
    { key: 'netRevenue', label: 'Doanh thu thuần', align: 'right', render: row => formatNumber(row.netRevenue), total: formatNumber(horizontalTotals.netRevenue) },
  ];

  const discountColumns: ReportTableColumn<SalesInvoiceDiscountReportRow>[] = [
    { key: 'label', label: 'Thời gian', render: row => row.label },
    {
      key: 'invoiceCount',
      label: 'Tổng hóa đơn',
      align: 'right',
      render: row => formatNumber(row.invoiceCount),
      total: formatNumber(discountTotals.invoiceCount),
    },
    {
      key: 'invoiceValue',
      label: 'Giá trị hóa đơn',
      align: 'right',
      render: row => formatNumber(row.invoiceValue),
      total: formatNumber(discountTotals.invoiceValue),
    },
    {
      key: 'discountValue',
      label: 'Giảm giá HĐ',
      align: 'right',
      render: row => formatNumber(row.discountValue),
      total: formatNumber(discountTotals.discountValue),
    },
  ];

  const returnsColumns: ReportTableColumn<SalesHorizontalReportRow>[] = [
    { key: 'label', label: 'Thời gian', render: row => row.label },
    { key: 'returnOrderCount', label: 'SL đơn trả', align: 'right', render: row => formatNumber(row.returnOrderCount), total: formatNumber(horizontalTotals.returnOrderCount) },
    { key: 'returnValue', label: 'Giá trị trả', align: 'right', render: row => (row.returnValue > 0 ? `-${formatNumber(row.returnValue)}` : '0'), total: horizontalTotals.returnValue > 0 ? `-${formatNumber(horizontalTotals.returnValue)}` : '0' },
    { key: 'returnRefund', label: 'Tiền trả khách', align: 'right', render: row => (row.returnRefund > 0 ? `-${formatNumber(row.returnRefund)}` : '0'), total: horizontalTotals.returnRefund > 0 ? `-${formatNumber(horizontalTotals.returnRefund)}` : '0' },
    { key: 'netRevenue', label: 'Ảnh hưởng doanh thu thuần', align: 'right', render: row => formatNumber(row.netRevenue), total: formatNumber(horizontalTotals.netRevenue) },
  ];

  const staffColumns: ReportTableColumn<SalesStaffReportRow>[] = [
    { key: 'staffName', label: 'Nhân viên', render: row => row.staffName },
    { key: 'saleOrderCount', label: 'SL đơn bán', align: 'right', render: row => formatNumber(row.saleOrderCount), total: formatNumber(staffTotals.saleOrderCount) },
    { key: 'revenue', label: 'Doanh thu', align: 'right', render: row => formatNumber(row.revenue), total: formatNumber(staffTotals.revenue) },
    { key: 'returnOrderCount', label: 'SL đơn trả', align: 'right', render: row => formatNumber(row.returnOrderCount), total: formatNumber(staffTotals.returnOrderCount) },
    { key: 'returnValue', label: 'Giá trị trả', align: 'right', render: row => (row.returnValue > 0 ? `-${formatNumber(row.returnValue)}` : '0'), total: staffTotals.returnValue > 0 ? `-${formatNumber(staffTotals.returnValue)}` : '0' },
    { key: 'netRevenue', label: 'Doanh thu thuần', align: 'right', render: row => formatNumber(row.netRevenue), total: formatNumber(staffTotals.netRevenue) },
  ];

  const timeRows = buckets.map(bucket => ({ ...bucket, key: bucket.hour }));

  const renderActiveReportTable = () => {
    const start = (page - 1) * PAGE_SIZE;
    const end = page * PAGE_SIZE;

    let totalRows = 0;
    let tableJSX: React.ReactNode;

    if (interestMode === 'discount') {
      totalRows = discountRows.length;
      tableJSX = renderReportTable(discountRows.slice(start, end), discountColumns);
    } else if (interestMode === 'returns') {
      totalRows = horizontalRows.length;
      tableJSX = renderReportTable(horizontalRows.slice(start, end), returnsColumns);
    } else if (interestMode === 'staff') {
      totalRows = staffRows.length;
      tableJSX = renderReportTable(staffRows.slice(start, end), staffColumns);
    } else if (reportLayout === 'horizontal') {
      totalRows = horizontalRows.length;
      tableJSX = renderReportTable(horizontalRows.slice(start, end), horizontalColumns, 'text-xs', 'min-w-[1040px]');
    } else {
      totalRows = timeRows.length;
      tableJSX = renderReportTable(timeRows.slice(start, end), timeVerticalColumns);
    }

    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

    return (
      <>
        {tableJSX}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`rounded-md border px-4 py-2 font-semibold transition ${
                page === 1
                  ? 'cursor-not-allowed border-slate-200 text-slate-300'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              ← Trước
            </button>
            <span className="text-slate-500">
              Trang <span className="font-bold text-slate-800">{page}</span> / {totalPages}
              <span className="ml-2 text-slate-400">({totalRows} dòng)</span>
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`rounded-md border px-4 py-2 font-semibold transition ${
                page === totalPages
                  ? 'cursor-not-allowed border-slate-200 text-slate-300'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Sau →
            </button>
          </div>
        )}
      </>
    );
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
              <div className="mb-6">
                {renderDropdownFilter({
                  dropdownKey: 'layout',
                  value: reportLayout,
                  placeholder: 'Hiển thị dọc',
                  options: layoutOptions,
                  onChange: value => setReportLayout(value as ReportLayout),
                  allowAll: false,
                })}
              </div>
            )}

            <label className="block text-sm font-bold">Mối quan tâm</label>
            {renderDropdownFilter({
              dropdownKey: 'interest',
              value: interestMode,
              placeholder: 'Chọn mối quan tâm',
              options: interestOptions,
              onChange: value => setInterestMode(value as InterestMode),
              allowAll: false,
            })}

            <div className="mt-6">
              <label className="block text-sm font-bold">Bảng giá</label>
              {renderDropdownFilter({
                dropdownKey: 'priceBook',
                value: priceBookQuery,
                placeholder: 'Chọn bảng giá',
                options: priceBookOptions,
                onChange: setPriceBookQuery,
              })}
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
              <label className="block text-sm font-bold">Phương thức thanh toán</label>
              {renderDropdownFilter({
                dropdownKey: 'payment',
                value: paymentMethodFilter,
                placeholder: 'Chọn phương thức thanh toán',
                options: paymentOptions,
                onChange: setPaymentMethodFilter,
              })}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Người tạo</label>
              {renderDropdownFilter({
                dropdownKey: 'creator',
                value: createdByQuery,
                placeholder: 'Chọn người tạo',
                options: creatorOptions,
                onChange: setCreatedByQuery,
              })}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Kênh bán</label>
              {renderDropdownFilter({
                dropdownKey: 'channel',
                value: channelQuery,
                placeholder: 'Chọn kênh bán',
                options: channelOptions,
                onChange: setChannelQuery,
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h1 className="mb-5 flex items-center gap-3 text-2xl font-bold">
            Báo cáo bán hàng
            {ordersLoading && <span className="text-sm font-normal text-slate-400">Đang tải...</span>}
          </h1>
          {viewMode === 'chart' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-5">
              <div className="min-h-[420px] bg-white p-6">
                <h2 className="text-center text-lg font-medium text-slate-700">{chartTitle}</h2>
                <div className="mt-4 flex h-[360px] gap-3">
                  <div className="flex w-12 flex-col-reverse justify-between pb-7 text-right text-xs text-slate-600">
                    {yTicks.map(tick => (
                      <span key={tick}>{formatCurrencyAxis(tick)}</span>
                    ))}
                  </div>
                  <div className="relative flex-1 border-b border-l border-slate-300">
                    {yTicks.map(tick => (
                      <div
                        key={tick}
                        className="absolute left-0 right-0 border-t border-slate-200"
                        style={{ bottom: yMax > 0 ? `${(tick / yMax) * 100}%` : 0 }}
                      />
                    ))}
                    {(interestMode === 'profit' ? profitBuckets : buckets).length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                        Không có dữ liệu trong khoảng thời gian đã chọn
                      </div>
                    ) : interestMode === 'profit' ? (
                      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-around gap-5 px-8 pb-7">
                        {profitBuckets.map(bucket => (
                          <div key={bucket.label} className="flex h-full min-w-16 flex-1 flex-col items-center justify-end">
                            <div className="flex h-full items-end justify-center gap-1.5">
                              {[
                                { label: 'Doanh thu', value: bucket.revenue, className: 'bg-indigo-600' },
                                { label: 'Giá vốn', value: bucket.cogs, className: 'bg-slate-500' },
                                { label: 'Lợi nhuận', value: bucket.profit, className: 'bg-emerald-600' },
                              ].map(series => (
                                <div
                                  key={series.label}
                                  className={`w-5 ${series.className}`}
                                  style={{
                                    height: yMax > 0 ? `${Math.max((Math.max(series.value, 0) / yMax) * 100, series.value > 0 ? 1 : 0)}%` : 0,
                                  }}
                                  title={`${bucket.label} - ${series.label}: ${formatNumber(series.value)}`}
                                />
                              ))}
                            </div>
                            <span className="mt-2 text-xs text-slate-600">{bucket.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-around gap-5 px-8 pb-7">
                        {buckets.map(bucket => (
                          <div key={bucket.hour} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end">
                            <div
                              className="w-9 bg-indigo-600"
                              style={{
                                height:
                                  yMax > 0 ? `${Math.max((bucket.netRevenue / yMax) * 100, 1)}%` : 0,
                              }}
                              title={`${bucket.hour}: ${formatNumber(bucket.netRevenue)}`}
                            />
                            <span className="mt-2 text-xs text-slate-600">{bucket.hour}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {interestMode === 'profit' && (
                  <div className="mt-3 flex items-center justify-center gap-5 text-xs font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
                      Doanh thu
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-slate-500" />
                      Giá vốn
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                      Lợi nhuận
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-slate-800">
                <div className="font-bold">Muốn tăng doanh thu, tăng vốn ngay</div>
                <div className="mt-1">4,500+ shop đã vay, 1,500+ tỷ giải ngân</div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mb-5 text-center">
                <div className="mb-1 text-xs text-slate-400">Ngày lập: {createdAt}</div>
                <h2 className="text-xl font-bold text-slate-800">{reportTitle}</h2>
                <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                  <p>Từ ngày {formatDate(startDate)} đến ngày {formatDate(endDate)}</p>
                  <p>Chi nhánh: {storeName}</p>
                </div>
              </div>
              {renderActiveReportTable()}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SalesReportPage;
