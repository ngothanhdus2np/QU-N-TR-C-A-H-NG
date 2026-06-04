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
import type { ExpenseRecord, InventoryTransaction, PayrollRecord, POSOrder, POSProduct } from '../../types';
import ReportRangeTimeFilter from './ReportRangeTimeFilter';
import ReportDropdownFilter from './ReportDropdownFilter';

interface FinanceReportPageProps {
  orders: POSOrder[];
  products: POSProduct[];
  expenses: ExpenseRecord[];
  payroll: PayrollRecord[];
  inventoryTransactions: InventoryTransaction[];
  storeName?: string;
}

interface FinanceMonth {
  key: string;
  label: string;
  grossRevenue: number;
  discount: number;
  returnsValue: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  voucherCost: number;
  deliveryFee: number;
  customerRefund: number;
  disposalCost: number;
  loyaltyPayment: number;
  paymentDiscount: number;
  payrollCost: number;
  roundingPurchase: number;
  roundingSales: number;
  returnFee: number;
  supplierPaymentDiscount: number;
  otherOperatingExpense: number;
  otherExpense: number;
  revenueOther: number;
}

type ViewMode = 'chart' | 'report';
type DateMode = 'month' | 'custom';

const BLUE = '#0f5bed';
const formatNumber = (value: number) => value.toLocaleString('vi-VN');
const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;
const toDateInputValue = (date: Date) => date.toLocaleDateString('en-CA');

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const monthKeyFromDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getInitialRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(now),
  };
};

const getMonthLabel = (key: string) => {
  const [year, month] = key.split('-');
  return `T${Number(month)}.${year}`;
};

const getExpenseBucket = (expense: ExpenseRecord) => {
  const text = `${expense.category || ''} ${expense.description || ''}`.toLowerCase();
  if (text.includes('voucher')) return 'voucherCost';
  if (text.includes('đtgh') || text.includes('dtgh') || text.includes('giao hàng') || text.includes('ship')) {
    return 'deliveryFee';
  }
  if (text.includes('hoàn') || text.includes('hoan') || text.includes('refund')) return 'customerRefund';
  return 'otherExpense';
};

const getYearFromMonth = (month: string) => Number(month.slice(0, 4));

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

const SelectButton: React.FC<{ children: React.ReactNode; active?: boolean; disabled?: boolean; onClick?: () => void }> = ({
  children,
  active,
  disabled,
  onClick,
}) => (
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

const emptyMonth = (key: string): FinanceMonth => ({
  key,
  label: getMonthLabel(key),
  grossRevenue: 0,
  discount: 0,
  returnsValue: 0,
  netRevenue: 0,
  cogs: 0,
  grossProfit: 0,
  voucherCost: 0,
  deliveryFee: 0,
  customerRefund: 0,
  disposalCost: 0,
  loyaltyPayment: 0,
  paymentDiscount: 0,
  payrollCost: 0,
  roundingPurchase: 0,
  roundingSales: 0,
  returnFee: 0,
  supplierPaymentDiscount: 0,
  otherOperatingExpense: 0,
  otherExpense: 0,
  revenueOther: 0,
});

const FinanceReportPage: React.FC<FinanceReportPageProps> = ({
  orders,
  products,
  expenses,
  payroll,
  inventoryTransactions,
  storeName = 'Chi nhánh trung tâm',
}) => {
  const initialRange = useMemo(() => getInitialRange(), []);
  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [dateMode, setDateMode] = useState<DateMode>('month');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
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

  const yearOptions = useMemo(() => {
    const set = new Set<number>([currentYear]);
    orders.forEach(order => {
      const year = new Date(order.date).getFullYear();
      if (year) set.add(year);
    });
    expenses.forEach(expense => {
      const year = new Date(expense.date).getFullYear();
      if (year) set.add(year);
    });
    payroll.forEach(record => {
      const year = getYearFromMonth(record.month);
      if (year) set.add(year);
    });
    inventoryTransactions.forEach(transaction => {
      const year = new Date(transaction.date).getFullYear();
      if (year) set.add(year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [currentYear, expenses, inventoryTransactions, orders, payroll]);
  const yearDropdownOptions = useMemo(
    () => yearOptions.map(year => ({ value: String(year), label: String(year) })),
    [yearOptions]
  );
  const timeModeOptions = useMemo(
    () => [
      { value: 'month', label: 'Theo Tháng' },
      { value: 'custom', label: 'Tùy chỉnh' },
    ],
    []
  );

  const productCostById = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(product => {
      const cost = Number(product.importPrice) || 0;
      if (cost <= 0) return;
      map.set(product.id, cost);
      if (product.sku) map.set(product.sku, cost);
    });
    return map;
  }, [products]);

  const costByProduct = useMemo(() => {
    const totals = new Map<string, { qty: number; amount: number }>();
    inventoryTransactions.forEach(transaction => {
      if (transaction.status === 'cancelled' || transaction.type !== 'Import') return;
      transaction.items.forEach(item => {
        const key = item.productId || item.sku;
        if (!key) return;
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        if (qty <= 0 || price <= 0) return;
        const current = totals.get(key) ?? { qty: 0, amount: 0 };
        current.qty += qty;
        current.amount += qty * Math.max(0, price - (Number(item.discount) || 0));
        totals.set(key, current);
      });
    });

    const map = new Map<string, number>();
    totals.forEach((value, key) => {
      if (value.qty > 0) map.set(key, value.amount / value.qty);
    });
    return map;
  }, [inventoryTransactions]);

  const months = useMemo(() => {
    const monthCount =
      selectedYear === currentYear ? new Date().getMonth() + 1 : 12;
    return Array.from({ length: monthCount }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return `${selectedYear}-${month}`;
    });
  }, [currentYear, selectedYear]);

  const financeRows = useMemo(() => {
    const map = new Map<string, FinanceMonth>();
    months.forEach(key => map.set(key, emptyMonth(key)));

    orders.forEach(order => {
      const key = monthKeyFromDate(order.date);
      const row = map.get(key);
      if (!row) return;
      const amount = Number(order.finalAmount) || 0;
      if (order.isReturn) {
        row.returnsValue += amount;
        order.items.forEach(item => {
          const unitCost =
            productCostById.get(item.productId) ??
            productCostById.get(item.sku) ??
            costByProduct.get(item.productId) ??
            costByProduct.get(item.sku) ??
            0;
          row.cogs -= unitCost * (Number(item.quantity) || 0);
        });
      } else {
        row.grossRevenue += Number(order.totalAmount) || amount;
        row.discount += Number(order.discount) || 0;
        row.netRevenue += amount;
        order.items.forEach(item => {
          const unitCost =
            productCostById.get(item.productId) ??
            productCostById.get(item.sku) ??
            costByProduct.get(item.productId) ??
            costByProduct.get(item.sku) ??
            0;
          row.cogs += unitCost * (Number(item.quantity) || 0);
        });
      }
      row.grossProfit = row.netRevenue - row.cogs;
    });

    expenses.forEach(expense => {
      const key = monthKeyFromDate(expense.date);
      const row = map.get(key);
      if (!row) return;
      const bucket = getExpenseBucket(expense);
      row[bucket] += Number(expense.amount) || 0;
    });

    payroll.forEach(record => {
      const key = record.month;
      const row = map.get(key);
      if (!row) return;
      row.payrollCost += Number(record.netPay) || 0;
    });

    inventoryTransactions.forEach(transaction => {
      const key = monthKeyFromDate(transaction.date);
      const row = map.get(key);
      if (!row || transaction.status === 'cancelled') return;
      const normalizedType = String(transaction.type).toLowerCase();
      if (normalizedType !== 'disposal' && normalizedType !== 'internal_use') return;
      row.disposalCost +=
        Number(transaction.totalAmount) ||
        transaction.items.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          return sum + qty * price;
        }, 0);
    });

    return months.map(key => {
      const row = map.get(key) ?? emptyMonth(key);
      if (row.grossProfit === 0 && (row.netRevenue !== 0 || row.cogs !== 0)) {
        row.grossProfit = row.netRevenue - row.cogs;
      }
      return row;
    });
  }, [costByProduct, expenses, inventoryTransactions, months, orders, payroll, productCostById]);

  const visibleRows = useMemo(() => {
    if (dateMode === 'month') return financeRows;
    return financeRows.filter(row => {
      const firstDay = `${row.key}-01`;
      const lastDay = new Date(Number(row.key.slice(0, 4)), Number(row.key.slice(5, 7)), 0)
        .toLocaleDateString('en-CA');
      return lastDay >= startDate && firstDay <= endDate;
    });
  }, [dateMode, endDate, financeRows, startDate]);

  const reportRows = useMemo(() => [...visibleRows].reverse(), [visibleRows]);

  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (sum, row) => ({
          grossRevenue: sum.grossRevenue + row.grossRevenue,
          discount: sum.discount + row.discount,
          returnsValue: sum.returnsValue + row.returnsValue,
          netRevenue: sum.netRevenue + row.netRevenue,
          cogs: sum.cogs + row.cogs,
          grossProfit: sum.grossProfit + row.grossProfit,
          voucherCost: sum.voucherCost + row.voucherCost,
          deliveryFee: sum.deliveryFee + row.deliveryFee,
          customerRefund: sum.customerRefund + row.customerRefund,
          disposalCost: sum.disposalCost + row.disposalCost,
      loyaltyPayment: sum.loyaltyPayment + row.loyaltyPayment,
      paymentDiscount: sum.paymentDiscount + row.paymentDiscount,
      payrollCost: sum.payrollCost + row.payrollCost,
      roundingPurchase: sum.roundingPurchase + row.roundingPurchase,
      roundingSales: sum.roundingSales + row.roundingSales,
      returnFee: sum.returnFee + row.returnFee,
      supplierPaymentDiscount: sum.supplierPaymentDiscount + row.supplierPaymentDiscount,
      otherOperatingExpense: sum.otherOperatingExpense + row.otherOperatingExpense,
      otherExpense: sum.otherExpense + row.otherExpense,
      revenueOther: sum.revenueOther + row.revenueOther,
        }),
        {
          grossRevenue: 0,
          discount: 0,
          returnsValue: 0,
          netRevenue: 0,
          cogs: 0,
          grossProfit: 0,
          voucherCost: 0,
          deliveryFee: 0,
          customerRefund: 0,
          disposalCost: 0,
          loyaltyPayment: 0,
      paymentDiscount: 0,
      payrollCost: 0,
      roundingPurchase: 0,
      roundingSales: 0,
      returnFee: 0,
      supplierPaymentDiscount: 0,
      otherOperatingExpense: 0,
      otherExpense: 0,
      revenueOther: 0,
        }
      ),
    [visibleRows]
  );

  const getTotalExpense = (row: FinanceMonth | typeof totals) =>
    row.voucherCost +
    row.deliveryFee +
    row.customerRefund +
    row.disposalCost +
    row.loyaltyPayment +
    row.paymentDiscount +
    row.payrollCost +
    row.roundingPurchase +
    row.roundingSales +
    row.otherOperatingExpense;

  const getBusinessProfit = (row: FinanceMonth | typeof totals) => row.grossProfit - getTotalExpense(row);
  const getOtherIncome = (row: FinanceMonth | typeof totals) =>
    row.revenueOther + row.returnFee + row.roundingPurchase + row.roundingSales + row.supplierPaymentDiscount;
  const getNetProfit = (row: FinanceMonth | typeof totals) =>
    getBusinessProfit(row) + getOtherIncome(row) - row.otherExpense;
  const maxProfit = Math.max(...visibleRows.map(row => Math.max(getBusinessProfit(row), 0)), 0);
  const axisMax = maxProfit > 0 ? Math.ceil(maxProfit / 40000000) * 40000000 : 400000000;
  const yTicks = Array.from({ length: 6 }, (_, index) => (axisMax / 5) * (5 - index));
  const hasChartData = visibleRows.some(row => getBusinessProfit(row) !== 0);

  const reportDefinitions = [
    { label: 'Doanh thu bán hàng (1)', getValue: (row: FinanceMonth | typeof totals) => row.grossRevenue, blue: true },
    { label: 'Giảm trừ Doanh thu (2 = 2.1+2.2)', getValue: (row: FinanceMonth | typeof totals) => row.discount + row.returnsValue },
    { label: 'Chiết khấu hóa đơn (2.1)', getValue: (row: FinanceMonth | typeof totals) => row.discount, indent: true, blue: true },
    { label: 'Giá trị hàng bán bị trả lại (2.2)', getValue: (row: FinanceMonth | typeof totals) => row.returnsValue, indent: true, blue: true },
    { label: 'Doanh thu thuần (3=1-2)', getValue: (row: FinanceMonth | typeof totals) => row.netRevenue },
    { label: 'Giá vốn hàng bán (4)', getValue: (row: FinanceMonth | typeof totals) => row.cogs },
    { label: 'Lợi nhuận gộp về bán hàng (5=3-4)', getValue: (row: FinanceMonth | typeof totals) => row.grossProfit },
    { label: 'Chi phí (6)', getValue: getTotalExpense },
    { label: 'Chi phí voucher', getValue: (row: FinanceMonth | typeof totals) => row.voucherCost, indent: true },
    { label: 'Phí trả ĐTGH', getValue: (row: FinanceMonth | typeof totals) => row.deliveryFee, indent: true },
    { label: 'Hoàn tiền cho khách', getValue: (row: FinanceMonth | typeof totals) => row.customerRefund, indent: true },
    { label: 'Xuất hủy hàng hóa', getValue: (row: FinanceMonth | typeof totals) => row.disposalCost, indent: true },
    { label: 'Giá trị thanh toán bằng điểm', getValue: (row: FinanceMonth | typeof totals) => row.loyaltyPayment, indent: true },
    { label: 'Chiết khấu thanh toán cho khách', getValue: (row: FinanceMonth | typeof totals) => row.paymentDiscount, indent: true },
    { label: 'Chi trả lương NV', getValue: (row: FinanceMonth | typeof totals) => row.payrollCost, indent: true },
    { label: 'Chênh lệch làm tròn nhập hàng', getValue: (row: FinanceMonth | typeof totals) => row.roundingPurchase, indent: true },
    { label: 'Chênh lệch làm tròn bán hàng', getValue: (row: FinanceMonth | typeof totals) => row.roundingSales, indent: true },
    { label: 'Lợi nhuận từ hoạt động kinh doanh (7=5-6)', getValue: getBusinessProfit },
    { label: 'Thu nhập khác (8)', getValue: getOtherIncome },
    { label: 'Doanh thu khác (*)', getValue: (row: FinanceMonth | typeof totals) => row.revenueOther, indent: true },
    { label: 'Phí trả hàng', getValue: (row: FinanceMonth | typeof totals) => row.returnFee, indent: true },
    { label: 'Chênh lệch làm tròn nhập hàng', getValue: (row: FinanceMonth | typeof totals) => row.roundingPurchase, indent: true },
    { label: 'Chênh lệch làm tròn bán hàng', getValue: (row: FinanceMonth | typeof totals) => row.roundingSales, indent: true },
    { label: 'Chiết khấu thanh toán từ NCC', getValue: (row: FinanceMonth | typeof totals) => row.supplierPaymentDiscount, indent: true },
    { label: 'Chi phí khác (9)', getValue: (row: FinanceMonth | typeof totals) => row.otherExpense },
    { label: 'Lợi nhuận thuần (10=(7+8)-9)', getValue: getNetProfit },
  ];

  const applyYear = (year: number) => {
    setSelectedYear(year);
    setDateMode('month');
    setStartDate(`${year}-01-01`);
    const endMonth = year === currentYear ? new Date().getMonth() + 1 : 12;
    const end = new Date(year, endMonth, 0);
    setEndDate(toDateInputValue(end));
  };

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const header = ['Chỉ tiêu', ...reportRows.map(r => r.label), 'Tổng'];
    const csvRows = [
      header.join(','),
      ...reportDefinitions.map(def =>
        [
          `"${def.label}"`,
          ...reportRows.map(r => Math.round(def.getValue(r))),
          Math.round(def.getValue(totals)),
        ].join(',')
      ),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-tai-chinh-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full min-h-0 text-slate-900">
      <div className="flex h-full min-h-0 w-full gap-4 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="h-full overflow-y-auto px-4 py-4">
            <div className="mb-4 font-semibold">Kiểu hiển thị</div>
            <div className="mb-5 flex gap-2">
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
            <div className="mb-5 border-t border-slate-100" />

            <div className="mb-3 flex items-center gap-1 font-semibold">
              Thời gian <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            </div>
            <ReportDropdownFilter
              value={String(selectedYear)}
              placeholder="Chọn năm"
              options={yearDropdownOptions}
              onChange={value => applyYear(Number(value))}
              allowAll={false}
            />
            <div className="mb-3 mt-3">
              <ReportDropdownFilter
                value={dateMode}
                placeholder="Chọn kiểu thời gian"
                options={timeModeOptions}
                onChange={value => {
                  if (value === 'month') applyYear(selectedYear);
                  else setDateMode('custom');
                }}
                allowAll={false}
              />
            </div>
            {dateMode === 'custom' && (
              <div className="pl-6">
                <ReportRangeTimeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onCustomMode={() => setDateMode('custom')}
                />
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h1 className="mb-5 text-2xl font-bold">Báo cáo tài chính</h1>

          {viewMode === 'chart' ? (
            <section className="bg-white p-6">
              <h2 className="mb-4 text-center text-lg font-medium text-slate-700">Lợi nhuận theo tháng</h2>
              <div className="grid h-[480px] grid-cols-[48px_1fr] grid-rows-[1fr_34px]">
                <div className="relative border-r border-slate-200">
                  {yTicks.map(tick => (
                    <div key={tick} className="absolute right-2 text-xs text-slate-600" style={{ top: `${((axisMax - tick) / axisMax) * 100}%`, transform: 'translateY(-50%)' }}>
                      {tick >= 1000000 ? `${Math.round(tick / 1000000)} tr` : formatNumber(tick)}
                    </div>
                  ))}
                </div>
                <div className="relative border-b border-slate-200">
                  {yTicks.map(tick => (
                    <div
                      key={tick}
                      className="absolute left-0 right-0 border-t border-slate-200"
                      style={{ top: `${((axisMax - tick) / axisMax) * 100}%` }}
                    />
                  ))}
                  {hasChartData ? (
                    <div className="relative z-10 flex h-full items-end justify-around gap-4 px-10">
                      {visibleRows.map(row => {
                        const profit = Math.max(getBusinessProfit(row), 0);
                        const height = axisMax > 0 ? `${Math.max((profit / axisMax) * 100, profit > 0 ? 4 : 0)}%` : '0%';
                        return (
                          <div key={row.key} className="flex h-full flex-1 items-end justify-center">
                            <div
                              className="w-full max-w-[78px]"
                              style={{ height, backgroundColor: BLUE }}
                              title={`${row.label}: ${formatNumber(getBusinessProfit(row))}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div />
                <div className="flex items-center justify-around px-10 text-sm text-slate-600">
                  {visibleRows.map(row => (
                    <span key={row.key}>{row.label}</span>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-center gap-2 text-sm text-slate-700">
                <span className="mt-1 h-3 w-3" style={{ backgroundColor: BLUE }} />
                {storeName}
              </div>
            </section>
          ) : (
            <section className="overflow-hidden bg-[#7b8796]">
              <div className="flex h-10 items-center justify-center gap-4 bg-[#7b8796] px-4">
                <ToolbarButton label="Hoàn tác"><Undo2 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Làm lại"><Redo2 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Tải lại"><RefreshCw className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Trang đầu"><ChevronsLeft className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Trang trước"><ChevronLeft className="h-4 w-4" /></ToolbarButton>
                <div className="flex items-center gap-1 text-white">
                  <span className="flex h-8 w-11 items-center justify-center rounded-md bg-white font-semibold text-slate-700">1</span>
                  <span>/ 1</span>
                </div>
                <ToolbarButton label="Trang sau"><ChevronsRight className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Tài liệu"><FileText className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Tải xuống" onClick={handleDownload}><DownloadCloud className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="In" onClick={handlePrint}><Printer className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Thu nhỏ"><ZoomOut className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Phóng to"><ZoomIn className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Tìm kiếm"><Search className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Toàn màn hình"><Maximize2 className="h-4 w-4" /></ToolbarButton>
              </div>

              <div className="mx-auto min-h-[900px] w-[1160px] bg-white px-6 py-5 text-sm shadow-sm">
                <h2 className="mx-auto mb-2 max-w-[520px] text-center text-2xl font-bold leading-tight">
                  Báo cáo kết quả hoạt động kinh doanh
                </h2>
                <div className="mb-4 text-xs">Ngày lập: {createdAt}</div>
                <p className="mb-8 text-sm">{storeName}</p>

                <table className="w-full border-collapse text-right">
                  <thead>
                    <tr className="bg-sky-200 text-slate-900">
                      <th className="w-[330px] px-3 py-3 text-left font-semibold"></th>
                      {reportRows.map(row => (
                        <th key={row.key} className="min-w-[118px] px-3 py-3 font-semibold">{row.label}</th>
                      ))}
                      <th className="min-w-[132px] px-3 py-3 font-semibold">Tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportDefinitions.map((definition, index) => (
                      <tr key={`${definition.label}-${index}`} className="border-b border-slate-200">
                        <td className={`px-3 py-3 text-left ${definition.indent ? 'pl-8' : ''}`}>
                          {definition.label}
                        </td>
                        {reportRows.map(row => (
                          <td key={row.key} className={`px-3 py-3 ${definition.blue ? 'font-semibold text-blue-700' : ''}`}>
                            {formatCurrency(definition.getValue(row))}
                          </td>
                        ))}
                        <td className="px-3 py-3">{formatCurrency(definition.getValue(totals))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-xs text-slate-500">(*) Chưa ghi nhận trong phiên bản hiện tại</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default FinanceReportPage;
