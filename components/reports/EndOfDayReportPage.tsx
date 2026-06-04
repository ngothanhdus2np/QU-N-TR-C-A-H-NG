import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  DownloadCloud,
  FileText,
  Maximize2,
  Printer,
  Redo2,
  RefreshCw,
  Search,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Employee, POSOrder, SalesRecord } from '../../types';
import {
  getEndOfDayReportRows,
  toReportDate,
  type EndOfDayReportRow,
} from '../../src/lib/reportCalculations';
import {
  buildPosSalesRecordsForDate,
  calculateStaffSalesForDate,
} from '../../src/lib/posSalesAttribution';
import ReportRangeTimeFilter from './ReportRangeTimeFilter';

interface EndOfDayReportPageProps {
  orders: POSOrder[];
  employees?: Employee[];
  sales?: SalesRecord[];
  onUpdateSales?: (records: SalesRecord[]) => void;
  storeName?: string;
}

type ReportRow = EndOfDayReportRow;
type ReportFocus = 'general' | 'sales';
type DisplayMode = 'vertical' | 'horizontal';
type DropdownKey =
  | 'display'
  | 'focus'
  | 'customer'
  | 'employee'
  | 'creator'
  | 'payment'
  | 'channel';

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

const toDateInputValue = toReportDate;

const getUniqueOptions = (values: Array<string | undefined>): DropdownOption[] =>
  Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map(value => ({ value, label: value }));

const getSelectedLabel = (options: DropdownOption[], value: string, placeholder: string) =>
  options.find(option => option.value === value)?.label || placeholder;

const ToolbarButton: React.FC<{ children: React.ReactNode; label: string; onClick?: () => void }> = ({
  children,
  label,
  onClick,
}) => (
  <button
    aria-label={label}
    title={label}
    onClick={onClick}
    className="inline-flex h-8 w-8 items-center justify-center rounded text-white/85 transition hover:bg-white/10 hover:text-white"
  >
    {children}
  </button>
);

const EndOfDayReportPage: React.FC<EndOfDayReportPageProps> = ({
  orders,
  employees = [],
  sales = [],
  onUpdateSales,
  storeName = 'Chi nhánh trung tâm',
}) => {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [staffQuery, setStaffQuery] = useState('');
  const [createdByQuery, setCreatedByQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [channelQuery, setChannelQuery] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('vertical');
  const [reportFocus, setReportFocus] = useState<ReportFocus>('general');
  const [salesWriteStatus, setSalesWriteStatus] = useState('');
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

  const scopedOrders = useMemo(() => {
    return orders.filter(order => {
      if (customerQuery) {
        const customerText = `${order.customerId || ''} ${order.customerName || ''}`.toLowerCase();
        if (!customerText.includes(customerQuery.toLowerCase())) return false;
      }
      if (staffQuery) {
        const staffText = `${order.staffId || ''} ${order.createdBy || ''}`.toLowerCase();
        if (!staffText.includes(staffQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [customerQuery, orders, staffQuery]);

  const rows = useMemo<ReportRow[]>(
    () =>
      getEndOfDayReportRows(scopedOrders, selectedDate, {
        createdByQuery,
        paymentMethod: paymentMethodFilter,
        channelQuery,
      }),
    [channelQuery, createdByQuery, paymentMethodFilter, scopedOrders, selectedDate]
  );

  const filteredOrders = useMemo(() => {
    return scopedOrders.filter(order => {
      if (toReportDate(new Date(order.date)) !== selectedDate) return false;
      if (paymentMethodFilter && order.paymentMethod !== paymentMethodFilter) return false;
      if (createdByQuery.trim()) {
        const haystack = `${order.createdBy || ''} ${order.staffId || ''}`.toLowerCase();
        if (!haystack.includes(createdByQuery.trim().toLowerCase())) return false;
      }
      if (channelQuery.trim()) {
        const haystack = `${order.channelName || ''} ${order.channel || ''}`.toLowerCase();
        if (!haystack.includes(channelQuery.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [channelQuery, createdByQuery, paymentMethodFilter, scopedOrders, selectedDate]);

  const salesOrders = useMemo(() => filteredOrders.filter(order => !order.isReturn), [filteredOrders]);
  const staffSalesSummary = useMemo(
    () => calculateStaffSalesForDate(orders, selectedDate, employees),
    [employees, orders, selectedDate]
  );
  const hasRecordedStaffSales = useMemo(
    () =>
      staffSalesSummary.length > 0 &&
      staffSalesSummary.every(row =>
        sales.some(record => record.id === `pos-sales-${selectedDate}-${row.employeeId}`)
      ),
    [sales, selectedDate, staffSalesSummary]
  );

  const generalSummary = useMemo(() => {
    const base = { cash: 0, bank: 0, card: 0, wallet: 0, points: 0, voucher: 0 };
    const counts = { ...base };
    const payments = salesOrders.reduce((acc, order) => {
      const amount = Number(order.finalAmount) || 0;
      if (order.paymentMethod === 'Cash') acc.cash += amount;
      else if (order.paymentMethod === 'Bank') acc.bank += amount;
      else if (order.paymentMethod === 'Momo') acc.wallet += amount;
      else acc.card += amount;
      return acc;
    }, { ...base });

    salesOrders.forEach(order => {
      if (order.paymentMethod === 'Cash') counts.cash += 1;
      else if (order.paymentMethod === 'Bank') counts.bank += 1;
      else if (order.paymentMethod === 'Momo') counts.wallet += 1;
      else counts.card += 1;
    });

    const uniqueProducts = new Set<string>();
    const productQty = salesOrders.reduce((sum, order) => {
      order.items.forEach(item => uniqueProducts.add(item.productId || item.sku || item.name));
      return sum + order.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0);
    }, 0);
    const paymentTotal = payments.cash + payments.bank + payments.card + payments.wallet;

    return {
      payments,
      counts,
      paymentTotal,
      salesValue: salesOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0),
      invoiceCount: salesOrders.length,
      uniqueProductCount: uniqueProducts.size,
      productQty,
    };
  }, [salesOrders]);

  const invoiceRow = useMemo(
    () => rows.find(row => row.kind === 'invoice') ?? {
      kind: 'invoice',
      label: 'Hóa đơn',
      count: 0,
      quantity: 0,
      revenue: 0,
      discount: 0,
      actual: 0,
    },
    [rows]
  );

  const displayOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'vertical', label: 'Hiển thị dọc' },
      { value: 'horizontal', label: 'Hiển thị ngang' },
    ],
    []
  );
  const focusOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'general', label: 'Tổng quát' },
      { value: 'sales', label: 'Bán hàng' },
    ],
    []
  );
  const customerOptions = useMemo(
    () => getUniqueOptions(orders.map(order => order.customerName || order.customerId)),
    [orders]
  );
  const employeeOptions = useMemo(
    () => getUniqueOptions(orders.map(order => order.createdBy || order.staffId)),
    [orders]
  );
  const creatorOptions = useMemo(
    () => getUniqueOptions(orders.map(order => order.createdBy)),
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
      { value: 'Momo', label: 'Momo' },
      { value: 'Other', label: 'Khác' },
    ],
    []
  );

  const saleDate = formatDate(selectedDate);

  const renderDropdownFilter = ({
    dropdownKey,
    value,
    placeholder,
    options,
    onChange,
    allowAll = true,
  }: {
    dropdownKey: DropdownKey;
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

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const header = ['Loại', 'Số lượng', 'Doanh thu', 'Chiết khấu', 'Thực thu'];
    const csvRows = [
      header.join(','),
      ...rows.map(row =>
        [row.label, row.quantity, row.revenue, row.discount, row.actual].join(',')
      ),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-cuoi-ngay-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRecordStaffSales = () => {
    if (!onUpdateSales || staffSalesSummary.length === 0) return;
    const records = buildPosSalesRecordsForDate(sales, orders, selectedDate, employees);
    onUpdateSales(records);
    setSalesWriteStatus(`Đã ghi nhận doanh số nhân viên ngày ${saleDate}.`);
  };

  const staffSalesSection = (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold">Doanh số nhân viên</h3>
        <button
          type="button"
          onClick={handleRecordStaffSales}
          disabled={!onUpdateSales || staffSalesSummary.length === 0}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {hasRecordedStaffSales ? 'Ghi nhận lại doanh số' : 'Ghi nhận doanh số'}
        </button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#a9dff3] text-slate-800">
            {['Nhân viên', 'Số đơn', 'SL sản phẩm', 'Doanh số ghi nhận'].map((label, index) => (
              <th key={label} className={`border border-[#a7bac5] px-2.5 py-2 font-bold ${index === 0 ? 'text-left' : 'text-right'}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staffSalesSummary.length > 0 ? (
            staffSalesSummary.map(row => (
              <tr key={row.employeeId}>
                <td className="border-b border-slate-300 px-2.5 py-2 font-semibold text-slate-700">
                  {row.employeeName}
                </td>
                <td className="border-b border-slate-300 px-2.5 py-2 text-right">{row.orderCount}</td>
                <td className="border-b border-slate-300 px-2.5 py-2 text-right">{formatNumber(row.quantity)}</td>
                <td className="border-b border-slate-300 px-2.5 py-2 text-right font-semibold text-blue-600">
                  {formatNumber(row.salesAmount)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="border-b border-slate-300 px-2.5 py-3 text-center text-slate-400">
                Chưa có doanh số nhân viên trong ngày này
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {salesWriteStatus && (
        <p className="mt-2 text-right text-xs font-semibold text-emerald-600">{salesWriteStatus}</p>
      )}
    </section>
  );

  return (
    <div className="h-full min-h-0 text-slate-900">
      <div className="flex h-full min-h-0 w-full gap-4 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="h-full overflow-y-auto px-4 py-4">
            <h2 className="text-base font-bold">Kiểu hiển thị</h2>
            <button className="mt-3 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">
              Báo cáo
            </button>

            <div className="my-5 h-px bg-slate-200" />

            {renderDropdownFilter({
              dropdownKey: 'display',
              value: displayMode,
              placeholder: 'Hiển thị dọc',
              options: displayOptions,
              onChange: value => setDisplayMode(value as DisplayMode),
              allowAll: false,
            })}

            <label className="mt-6 block text-sm font-bold">Mối quan tâm</label>
            {renderDropdownFilter({
              dropdownKey: 'focus',
              value: reportFocus,
              placeholder: 'Chọn mối quan tâm',
              options: focusOptions,
              onChange: value => setReportFocus(value as ReportFocus),
              allowAll: false,
            })}

            <label className="mt-6 block text-sm font-bold">Thời gian</label>
            <div className="mt-2 space-y-2">
              <ReportRangeTimeFilter
                startDate={selectedDate}
                endDate={selectedDate}
                onStartDateChange={setSelectedDate}
                onEndDateChange={setSelectedDate}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Khách hàng</label>
              {renderDropdownFilter({
                dropdownKey: 'customer',
                value: customerQuery,
                placeholder: 'Theo mã, tên, số điện thoại',
                options: customerOptions,
                onChange: setCustomerQuery,
              })}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Nhân viên</label>
              {renderDropdownFilter({
                dropdownKey: 'employee',
                value: staffQuery,
                placeholder: 'Chọn nhân viên',
                options: employeeOptions,
                onChange: setStaffQuery,
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
              <label className="block text-sm font-bold">Phương thức thanh toán</label>
              {renderDropdownFilter({
                dropdownKey: 'payment',
                value: paymentMethodFilter,
                placeholder: 'Tất cả',
                options: paymentOptions,
                onChange: setPaymentMethodFilter,
              })}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Phương thức bán hàng</label>
              {renderDropdownFilter({
                dropdownKey: 'channel',
                value: channelQuery,
                placeholder: 'Chọn phương thức bán hàng',
                options: channelOptions,
                onChange: setChannelQuery,
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h1 className="mb-5 text-2xl font-bold">Báo cáo cuối ngày</h1>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#748090]">
            <div className="flex h-10 shrink-0 items-center justify-center gap-2 bg-[#748090] text-white">
              <ToolbarButton label="Hoàn tác">
                <Undo2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Làm lại">
                <Redo2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Tải lại">
                <RefreshCw className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Trang đầu">
                <ChevronsLeft className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Trang trước">
                <ChevronLeft className="h-4 w-4" />
              </ToolbarButton>
              <div className="flex items-center gap-1 text-sm font-bold">
                <span className="flex h-8 w-11 items-center justify-center rounded-md bg-white text-slate-700">
                  1
                </span>
                <span>/ 1</span>
              </div>
              <ToolbarButton label="Trang sau">
                <ChevronsRight className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Tài liệu">
                <FileText className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Tải xuống" onClick={handleDownload}>
                <DownloadCloud className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="In" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Thu nhỏ">
                <ZoomOut className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Tìm kiếm">
                <Search className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Phóng to">
                <ZoomIn className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Toàn màn hình">
                <Maximize2 className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-8 pb-10">
              <article
                className={`mx-auto min-h-[820px] w-full bg-white px-4 pb-12 pt-5 shadow-sm ${
                  displayMode === 'horizontal' && reportFocus === 'sales' ? 'max-w-[1180px]' : 'max-w-[820px]'
                }`}
              >
                <div className="px-1 text-xs text-slate-700">Ngày lập: {createdAt}</div>
                <h2 className="mt-2 text-center text-2xl font-bold">
                  Báo cáo cuối ngày về bán hàng
                </h2>
                <div className="mt-4 space-y-3 text-center text-sm text-slate-800">
                  <p>Ngày bán: &nbsp;{saleDate}</p>
                  <p>Ngày thanh toán: {saleDate}</p>
                  <p>Chi nhánh: {storeName}</p>
                </div>

                {reportFocus === 'general' ? (
                  <div className="mt-14 space-y-9">
                    <section>
                      <h3 className="mb-2 text-xl font-bold">Tổng kết thu chi</h3>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-[#a9dff3] text-slate-800">
                            {['Thu/Chi', 'Tiền mặt', 'CK', 'Thẻ', 'Ví', 'Điểm', 'Voucher', 'Tổng thực thu'].map((label, index) => (
                              <th key={label} className={`border border-[#a7bac5] px-2.5 py-3 font-bold ${index === 0 ? 'text-left' : 'text-right'}`}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[#f5f0cf] font-bold">
                            <td className="border border-[#c3c4ba] px-2.5 py-4" />
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.cash)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.bank)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.card)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.wallet)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">0</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">0</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right text-blue-600">{formatNumber(generalSummary.paymentTotal)}</td>
                          </tr>
                          <tr>
                            <td className="border-b border-slate-300 px-2.5 py-4 font-bold text-blue-600">Tổng thu</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.cash)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.bank)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.card)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.wallet)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">0</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">0</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.paymentTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    {staffSalesSection}

                    <section>
                      <h3 className="mb-2 text-xl font-bold">Tổng kết bán hàng</h3>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-[#a9dff3] text-slate-800">
                            {['Giao dịch', 'Giá trị', 'Tiền mặt', 'CK', 'Thẻ', 'Ví', 'Điểm', 'Voucher', 'Tổng thực thu'].map((label, index) => (
                              <th key={label} className={`border border-[#a7bac5] px-2.5 py-3 font-bold ${index === 0 ? 'text-left' : 'text-right'}`}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[#f5f0cf] font-bold">
                            <td className="border border-[#c3c4ba] px-2.5 py-4" />
                            <td className="border border-[#c3c4ba] px-2.5 py-4" />
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.cash)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.bank)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.card)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.wallet)}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">0</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">0</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right text-blue-600">{formatNumber(generalSummary.paymentTotal)}</td>
                          </tr>
                          <tr>
                            <td className="border-b border-slate-300 px-2.5 py-4 font-bold text-blue-600">Hóa đơn</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.salesValue)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.cash)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.bank)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.card)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.payments.wallet)}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">0</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">0</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{formatNumber(generalSummary.paymentTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    <section>
                      <h3 className="mb-2 text-xl font-bold">Số lượng giao dịch</h3>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-[#a9dff3] text-slate-800">
                            {['Giao dịch', 'Số giao dịch', 'Tiền mặt', 'CK', 'Thẻ', 'Ví', 'Điểm', 'Voucher'].map((label, index) => (
                              <th key={label} className={`border border-[#a7bac5] px-2.5 py-3 font-bold ${index === 0 ? 'text-left' : 'text-right'}`}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[#f5f0cf] font-bold">
                            <td className="border border-[#c3c4ba] px-2.5 py-4" />
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{generalSummary.invoiceCount}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{generalSummary.counts.cash}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{generalSummary.counts.bank}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{generalSummary.counts.card}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{generalSummary.counts.wallet}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">0</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">0</td>
                          </tr>
                          <tr>
                            <td className="border-b border-slate-300 px-2.5 py-4 font-bold text-blue-600">Hóa đơn</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{generalSummary.invoiceCount}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{generalSummary.counts.cash}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{generalSummary.counts.bank}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{generalSummary.counts.card}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{generalSummary.counts.wallet}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">0</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">0</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    <section>
                      <h3 className="mb-2 text-xl font-bold">Hàng hóa</h3>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-[#a9dff3] text-slate-800">
                            {['Giao dịch', 'Số mặt hàng', 'SL sản phẩm'].map((label, index) => (
                              <th key={label} className={`border border-[#a7bac5] px-2.5 py-3 font-bold ${index === 0 ? 'text-left' : 'text-right'}`}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[#f5f0cf] font-bold">
                            <td className="border border-[#c3c4ba] px-2.5 py-4" />
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{generalSummary.uniqueProductCount || ''}</td>
                            <td className="border border-[#c3c4ba] px-2.5 py-4 text-right">{generalSummary.productQty || ''}</td>
                          </tr>
                          <tr>
                            <td className="border-b border-slate-300 px-2.5 py-4 font-bold text-blue-600">Hóa đơn</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{generalSummary.uniqueProductCount}</td>
                            <td className="border-b border-slate-300 px-2.5 py-4 text-right">{generalSummary.productQty}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>
                  </div>
                ) : displayMode === 'horizontal' ? (
                  <div className="mt-16 overflow-x-auto">
                    <table className="w-full min-w-[1080px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#a9dff3] text-slate-800">
                          {[
                            ['Mã chứng từ', 'text-left w-[120px]'],
                            ['Khách hàng', 'text-left w-[110px]'],
                            ['Nhân viên', 'text-left w-[110px]'],
                            ['Thời gian', 'text-center w-[70px]'],
                            ['SL', 'text-right w-[55px]'],
                            ['Tổng tiền hàng', 'text-right w-[115px]'],
                            ['Giảm giá', 'text-right w-[85px]'],
                            ['Doanh thu', 'text-right w-[105px]'],
                            ['Thu khác', 'text-right w-[75px]'],
                            ['VAT', 'text-right w-[55px]'],
                            ['Làm tròn', 'text-right w-[65px]'],
                            ['Phí trả hàng', 'text-right w-[75px]'],
                            ['Thực thu', 'text-right w-[105px]'],
                            ['Ghi nợ', 'text-right w-[80px]'],
                          ].map(([label, className]) => (
                            <th
                              key={label}
                              className={`border border-[#a7bac5] px-2 py-2.5 font-bold ${className}`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-[#f5f0cf] font-bold text-slate-800">
                          <td className="border border-[#c3c4ba] px-2 py-4">
                            <span className="mr-2 inline-flex h-4 w-4 items-center justify-center border border-slate-700 text-xs leading-none">
                              +
                            </span>
                            Hóa đơn: {invoiceRow.count}
                          </td>
                          <td className="border border-[#c3c4ba] px-2 py-4" />
                          <td className="border border-[#c3c4ba] px-2 py-4" />
                          <td className="border border-[#c3c4ba] px-2 py-4" />
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">
                            {formatNumber(invoiceRow.quantity)}
                          </td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">
                            {formatNumber(invoiceRow.revenue)}
                          </td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">
                            {formatNumber(invoiceRow.discount)}
                          </td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">
                            {formatNumber(Math.max(0, invoiceRow.revenue - invoiceRow.discount))}
                          </td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">0</td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">0</td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">0</td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">0</td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">
                            {formatNumber(invoiceRow.actual)}
                          </td>
                          <td className="border border-[#c3c4ba] px-2 py-4 text-right">0</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <table className="mt-24 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#a9dff3] text-slate-800">
                        {[
                          ['Mã giao dịch', 'text-left w-[170px]'],
                          ['Thời gian', 'text-left w-[150px]'],
                          ['SL', 'text-right w-[75px]'],
                          ['Doanh thu', 'text-right w-[130px]'],
                          ['Chiết khấu', 'text-right w-[110px]'],
                          ['Thực thu', 'text-right w-[120px]'],
                        ].map(([label, className]) => (
                          <th
                            key={label}
                            className={`border border-[#a7bac5] px-2.5 py-2.5 font-bold ${className}`}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={row.kind} className="bg-[#f5f0cf] font-bold text-slate-800">
                          <td className="border border-[#c3c4ba] px-2.5 py-3">
                            <span className="mr-2 inline-flex h-4 w-4 items-center justify-center border border-slate-800 text-xs leading-none">
                              +
                            </span>
                            {row.label}: {row.count}
                          </td>
                          <td className="border border-[#c3c4ba] px-2.5 py-3" />
                          <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                            {formatNumber(row.quantity)}
                          </td>
                          <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                            {formatNumber(row.revenue)}
                          </td>
                          <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                            {formatNumber(row.discount)}
                          </td>
                          <td className="border border-[#c3c4ba] px-2.5 py-3 text-right">
                            {formatNumber(row.actual)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </article>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EndOfDayReportPage;
