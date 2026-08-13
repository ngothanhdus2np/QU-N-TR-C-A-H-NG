import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Settings,
  RotateCcw,
  Printer,
  Trash2,
  Star,
  Plus,
  Upload,
  ShoppingCart,
} from 'lucide-react';
import { AppData, AppDataSurgicalUpdate, Employee } from '../../types';
import { apiService } from '../../services/apiService';
import { FilterSection, FilterDateRange, FilterCheckboxGroup } from '../shared';
import { openPrintInvoice } from '../pos/printInvoiceFromTemplate';

interface OrderInvoicesProps {
  orders: AppData['posOrders'];
  customers: AppData['posCustomers'];
  employees?: Employee[];
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onDeleteOrders?: (
    orderIds: string[]
  ) => Promise<{ successCount: number; failures: { orderCode: string; error: string }[] }>;
  onEditInPOS?: (order: AppData['posOrders'][number]) => void;
  onReturnInPOS?: (order: AppData['posOrders'][number]) => void;
}

const PAGE_SIZE_OPTIONS = [15, 30, 50] as const;

const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Card: 'Thẻ',
  Momo: 'Momo',
  Other: 'Khác',
  Split: 'Kết hợp nhiều PT',
};

const PAYMENT_METHODS = ['Cash', 'Bank', 'Card', 'Momo', 'Other'] as const;

function fmt(n: number) {
  return n.toLocaleString('vi-VN');
}

function formatOrderDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderInvoices({ orders, customers, storeName, storeAddress, storePhone, employees = [], onUpdateSurgical, onDeleteOrders, onEditInPOS, onReturnInPOS }: OrderInvoicesProps) {
  const getStaffName = (staffId?: string) => {
    if (!staffId) return undefined;
    return employees.find(e => e.id === staffId)?.name;
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const d = new Date();
    return {
      start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      end: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    };
  });
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = React.useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<15 | 30 | 50>(15);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageOrders, setPageOrders] = useState<AppData['posOrders']>([]);
  const [totalOrders, setTotalOrders] = useState(orders.length);
  const [filterSummary, setFilterSummary] = useState({ totalAmount: 0, discount: 0, finalAmount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'payments'>('info');
  const [showToolbarMenu, setShowToolbarMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showPaymentColumn, setShowPaymentColumn] = useState(true);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const timer = window.setTimeout(async () => {
      try {
        const result = await apiService.fetchPosOrdersPage(page, pageSize, {
          search: searchTerm,
          startDate: dateRange.start,
          endDate: dateRange.end,
          typeFilter,
          paymentFilter,
          deliveryTypeFilter,
          statusFilter,
        });
        if (cancelled) return;
        setPageOrders(result.data);
        setTotalOrders(result.total);
        setFilterSummary(result.summary ?? { totalAmount: 0, discount: 0, finalAmount: 0 });
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Không tải được hóa đơn');
        setPageOrders([]);
        setTotalOrders(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, searchTerm ? 300 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dateRange.end, dateRange.start, page, pageSize, paymentFilter, searchTerm, typeFilter, deliveryTypeFilter, statusFilter]);

  const summary = useMemo(() => ({
    totalAmount: pageOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0),
    discount: pageOrders.reduce((s, o) => s + (Number(o.discount) || 0), 0),
    finalAmount: pageOrders.reduce((s, o) => s + (Number(o.finalAmount) || 0), 0),
  }), [pageOrders]);

  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = pageOrders;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Đơn trả/đổi hàng chưa hỗ trợ xóa đúng chuẩn (xem deletePosOrder) → loại khỏi chọn hàng loạt.
  // Đơn đã hủy (soft-delete) cũng loại — không thể hủy 2 lần.
  const selectablePaginated = paginated.filter(o => !o.isReturn && o.status !== 'cancelled');
  const allChecked =
    selectablePaginated.length > 0 && selectablePaginated.every(o => selectedIds.has(o.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectablePaginated.forEach(o => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectablePaginated.forEach(o => next.add(o.id));
        return next;
      });
    }
  };
  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const handleBulkDelete = async () => {
    if (!onDeleteOrders || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !window.confirm(
        `Xóa ${count} đơn hàng đã chọn?\n\nSẽ tự động hoàn lại tồn kho, trừ khỏi doanh thu ngày bán và tính lại doanh số nhân viên. KHÔNG thể hoàn tác.`
      )
    ) {
      return;
    }
    setIsBulkDeleting(true);
    try {
      const { successCount, failures } = await onDeleteOrders(Array.from(selectedIds));
      setSelectedIds(new Set());
      if (failures.length === 0) {
        alert(`Đã xóa ${successCount} đơn hàng.`);
      } else {
        alert(
          `Đã xóa ${successCount}/${count} đơn.\nLỗi ${failures.length} đơn:\n` +
            failures.map(f => `- ${f.orderCode}: ${f.error}`).join('\n')
        );
      }
    } catch (err) {
      console.error('[OrderInvoices] handleBulkDelete failed', err);
      alert('Xóa đơn hàng thất bại. Vui lòng thử lại.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedOrderId(prev => (prev === id ? null : id));
    setDetailTab('info');
  };

  const getOrderCustomer = (order: AppData['posOrders'][number]) =>
    customers.find(c => c.id === order.customerId);

  const customerCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    [...customers]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((customer, index) => {
        map.set(customer.id, `KH${String(index + 1).padStart(6, '0')}`);
      });
    return map;
  }, [customers]);

  const getCustomerCode = (order: AppData['posOrders'][number]) => {
    if (order.customerId && customerCodeMap.has(order.customerId)) {
      return customerCodeMap.get(order.customerId) || '—';
    }
    if (order.customerName) {
      const matchedCustomer = customers.find(customer => customer.name === order.customerName);
      if (matchedCustomer) return customerCodeMap.get(matchedCustomer.id) || '—';
    }
    return '—';
  };

  // checkbox + star + mã HĐ + thời gian + mã trả hàng + mã KH + khách hàng + tổng + giảm + sau giảm + khách trả + [thanh toán]
  const tableColumnCount = showPaymentColumn ? 12 : 11;

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const persistOrder = async (order: AppData['posOrders'][number]) => {
    setPageOrders(prev => prev.map(item => (item.id === order.id ? order : item)));
    if (onUpdateSurgical) {
      await onUpdateSurgical([{ key: 'posOrders', item: order, isDelete: false }]);
    }
  };

  const exportOrders = (rows: AppData['posOrders'], fileName: string) => {
    const csvRows = [
      [
        'Mã hóa đơn',
        'Ngày',
        'Khách hàng',
        'Mã KH',
        'Tổng tiền',
        'Giảm giá',
        'Thanh toán',
        'Phương thức',
        'Loại',
      ].join(','),
      ...rows.map(o =>
        [
          o.orderCode,
          o.date,
          o.customerName || 'Khách lẻ',
          getCustomerCode(o),
          o.totalAmount,
          o.discount,
          o.finalAmount,
          PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod,
          o.isReturn ? 'Trả hàng' : 'Bán hàng',
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob(['﻿' + csvRows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExport = () => {
    const rows =
      selectedIds.size > 0 ? pageOrders.filter(order => selectedIds.has(order.id)) : pageOrders;
    exportOrders(rows, `hoa-don-trang-${safePage}-${todayStr}.csv`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('File không có dữ liệu (cần ít nhất 1 dòng dữ liệu sau header).');

      // Tách cột CSV đúng chuẩn: hỗ trợ quoted fields có dấu phẩy bên trong
      const parseCsvRow = (line: string): string[] => {
        const cols: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let ci = 0; ci < line.length; ci++) {
          const ch = line[ci];
          if (ch === '"') {
            if (inQuotes && line[ci + 1] === '"') { cur += '"'; ci++; }
            else inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            cols.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        cols.push(cur.trim());
        return cols;
      };

      // Bỏ qua BOM (﻿) nếu có
      const header = parseCsvRow(lines[0].replace(/^﻿/, '')).map(h => h.toLowerCase());

      // Map header → index (hỗ trợ cả tiếng Việt lẫn tiếng Anh)
      const idx = (candidates: string[]) => {
        for (const c of candidates) {
          const i = header.findIndex(h => h.includes(c));
          if (i !== -1) return i;
        }
        return -1;
      };
      const iCode    = idx(['mã hóa đơn', 'order_code', 'ordercode', 'mã hd']);
      const iDate    = idx(['ngày', 'thời gian', 'date', 'time']);
      const iCust    = idx(['khách hàng', 'customer_name', 'customer']);
      const iTotal   = idx(['tổng tiền hàng', 'tổng tiền', 'total_amount', 'total']);
      const iDisc    = idx(['giảm giá', 'discount']);
      const iFinal   = idx(['tổng sau giảm', 'tổng thanh toán', 'final_amount', 'final']);
      const iPayment = idx(['phương thức', 'payment_method', 'payment']);
      const iStatus  = idx(['trạng thái', 'status']);

      if (iCode === -1) throw new Error('Không tìm thấy cột "Mã hóa đơn" trong file.');

      const { supabase: supabaseAdmin } = await import('../../services/supabase');
      let inserted = 0, skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvRow(lines[i]);
        const orderCode = cols[iCode];
        if (!orderCode) { skipped++; continue; }

        const row: Record<string, any> = {
          order_code: orderCode,
          date: iDate !== -1 ? cols[iDate] : new Date().toISOString(),
          customer_name: iCust !== -1 ? cols[iCust] : 'Khách lẻ',
          total_amount: iTotal !== -1 ? Number(cols[iTotal]?.replace(/[^0-9.-]/g, '')) || 0 : 0,
          discount: iDisc !== -1 ? Number(cols[iDisc]?.replace(/[^0-9.-]/g, '')) || 0 : 0,
          final_amount: iFinal !== -1 ? Number(cols[iFinal]?.replace(/[^0-9.-]/g, '')) || 0 : 0,
          payment_method: iPayment !== -1 ? cols[iPayment] || 'Cash' : 'Cash',
          status: iStatus !== -1 ? cols[iStatus] || 'completed' : 'completed',
          items: [],
          channel: 'direct',
        };

        const { error } = await supabaseAdmin
          .from('pos_orders')
          .upsert(row, { onConflict: 'order_code' });

        if (error) skipped++;
        else inserted++;
      }

      alert(`✅ Import xong: ${inserted} đơn thành công, ${skipped} bỏ qua.`);
      // Reload trang hiện tại
      setPage(1);
    } catch (err: any) {
      alert(`❌ Lỗi import: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportOne = (order: AppData['posOrders'][number]) => {
    exportOrders([order], `hoa-don-${order.orderCode}-${todayStr}.csv`);
  };

  const handleCancelInvoice = async (order: AppData['posOrders'][number]) => {
    if (order.status === 'cancelled') {
      alert('Hóa đơn này đã hủy.');
      return;
    }
    if (!window.confirm(`Hủy hóa đơn ${order.orderCode}?`)) return;
    try {
      await persistOrder({ ...order, status: 'cancelled' });
    } catch (err) {
      console.error('[OrderInvoices] handleCancelInvoice failed', err);
      alert('Hủy hóa đơn thất bại. Vui lòng thử lại.');
    }
  };

  const handleCopyInvoice = async (order: AppData['posOrders'][number]) => {
    const text = [
      `Hóa đơn: ${order.orderCode}`,
      `Khách hàng: ${order.customerName || 'Khách lẻ'}`,
      `Ngày bán: ${formatOrderDateTime(order.date)}`,
      `Tổng thanh toán: ${fmt(order.finalAmount)}`,
      `Sản phẩm: ${(order.items || []).map(item => `${item.name} x ${item.quantity}`).join('; ')}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('Đã sao chép thông tin hóa đơn.');
    } catch {
      alert(text);
    }
  };

  const handleGoToReturnInPOS = (order: AppData['posOrders'][number]) => {
    if (!onReturnInPOS) return;
    if (order.isReturn) {
      alert('Đây đã là phiếu trả hàng.');
      return;
    }
    if (order.status === 'cancelled') {
      alert('Đơn đã hủy — không thể trả hàng.');
      return;
    }
    // Trả nhiều lần từng phần là hợp lệ — số lượng còn được trả đã có guard chặn trong POS
    // (usePOSReturnFlow trừ số đã trả vào maxQuantity). Ở đây chỉ nhắc để người dùng biết.
    const hasExistingReturn = [...orders, ...pageOrders].some(candidate =>
      candidate.isReturn &&
      candidate.id !== order.id &&
      candidate.status !== 'cancelled' &&
      (candidate.originalOrderId === order.id || (!candidate.originalOrderId && candidate.notes?.includes(order.orderCode)))
    );
    if (hasExistingReturn) {
      const proceed = window.confirm(
        `Hóa đơn ${order.orderCode} đã có phiếu trả hàng trước đó. Số lượng còn được trả sẽ tự trừ phần đã trả. Tiếp tục?`
      );
      if (!proceed) return;
    }
    onReturnInPOS(order);
  };

  const renderOrderDetail = (order: AppData['posOrders'][number]) => {
    const customer = getOrderCustomer(order);
    const totalQuantity = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return (
      <tr>
        <td colSpan={tableColumnCount} className="bg-white p-0">
          <div className="border-y-2 border-indigo-600 bg-white">
            <div className="flex items-center gap-8 border-b border-slate-200 px-5 pt-3">
              <button
                onClick={() => setDetailTab('info')}
                className={`border-b-2 px-1 pb-2 text-sm font-bold ${
                  detailTab === 'info'
                    ? 'border-indigo-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Thông tin
              </button>
              <button
                onClick={() => setDetailTab('payments')}
                className={`border-b-2 px-1 pb-2 text-sm font-bold ${
                  detailTab === 'payments'
                    ? 'border-indigo-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Lịch sử thanh toán
              </button>
            </div>

            {detailTab === 'payments' ? (
              <div className="px-5 py-5">
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold text-slate-700">Thời gian</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-700">Mã phiếu</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-700">Phương thức</th>
                        <th className="px-3 py-3 text-right font-semibold text-slate-700">Số tiền</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-700">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-3 font-normal text-slate-800">
                          {formatOrderDateTime(order.date)}
                        </td>
                        <td className="px-3 py-3 font-normal text-blue-600">TT-{order.orderCode}</td>
                        <td className="px-3 py-3 font-normal text-slate-800">
                          {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                        </td>
                        <td className="px-3 py-3 text-right font-normal text-slate-900">
                          {order.status === 'cancelled' ? '0' : fmt(order.finalAmount)}
                        </td>
                        <td className="px-3 py-3 font-normal text-slate-800">
                          {order.status === 'cancelled' ? 'Đã hủy' : 'Đã thanh toán'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {order.customerName || 'Khách lẻ'}
                    </h3>
                    <span className="text-sm font-normal text-slate-500">{order.orderCode}</span>
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ${
                      order.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-600'
                        : order.status === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {order.status === 'cancelled' ? 'Đã hủy' : order.status === 'pending' ? 'Đang xử lý' : 'Hoàn thành'}
                    </span>
                    {order.isReturn && (
                      <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600">
                        Trả hàng
                      </span>
                    )}
                  </div>
                  {customer?.phone && (
                    <p className="mt-1 text-xs font-normal text-slate-500">SĐT: {customer.phone}</p>
                  )}
                </div>
                <div className="text-sm font-normal text-slate-500">{storeName || 'Chi nhánh trung tâm'}</div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Người tạo:</span>
                  <span className="font-normal text-slate-700">{order.staffName || getStaffName(order.staffId) || order.createdBy || order.staffId || '—'}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Người bán:</span>
                  <span className="font-normal text-slate-700">{order.staffName || getStaffName(order.staffId) || order.createdBy || order.staffId || '—'}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Ngày bán:</span>
                  <div className="inline-flex h-8 w-fit items-center rounded-md bg-slate-100 px-3 text-sm font-normal text-slate-600">
                    {formatOrderDateTime(order.date)}
                  </div>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Kênh bán:</span>
                  <span className="font-normal text-slate-700">{order.channelName || 'Bán trực tiếp'}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Bảng giá:</span>
                  <span className="font-normal text-slate-700">{order.priceBookName || 'Bảng giá chung'}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Thanh toán:</span>
                  <span className="font-normal text-slate-700">
                    {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                  </span>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-md border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-3 text-left font-medium text-slate-500">Mã hàng</th>
                      <th className="px-3 py-3 text-left font-medium text-slate-500">Tên hàng</th>
                      <th className="px-3 py-3 text-right font-medium text-slate-500">Số lượng</th>
                      <th className="px-3 py-3 text-right font-medium text-slate-500">Đơn giá</th>
                      <th className="px-3 py-3 text-right font-medium text-slate-500">Giảm giá</th>
                      <th className="px-3 py-3 text-right font-medium text-slate-500">Giá bán</th>
                      <th className="px-3 py-3 text-right font-medium text-slate-500">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(order.items || []).map((item, index) => (
                      <tr key={`${item.productId || item.sku}-${index}`}>
                        <td className="px-3 py-3 font-medium text-blue-600">{item.sku || item.productId || '—'}</td>
                        <td className="px-3 py-3 font-normal text-slate-900">{item.name}</td>
                        <td className="px-3 py-3 text-right font-normal text-slate-800">{fmt(item.quantity)}</td>
                        <td className="px-3 py-3 text-right font-normal text-slate-800">{fmt(item.price)}</td>
                        <td className="px-3 py-3 text-right font-normal text-slate-500">
                          {item.discount > 0 ? fmt(item.discount) : ''}
                        </td>
                        <td className="px-3 py-3 text-right font-normal text-slate-800">{fmt(item.price)}</td>
                        <td className="px-3 py-3 text-right font-medium text-slate-900">{fmt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid grid-cols-[1fr_280px] gap-6">
                <textarea
                  readOnly
                  placeholder="Ghi chú..."
                  value={order.notes || ''}
                  className="min-h-28 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none read-only:bg-white"
                />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-normal text-slate-500">Tổng tiền hàng ({fmt(totalQuantity)})</span>
                    <span className="font-normal text-slate-700">{fmt(order.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-normal text-slate-500">Giảm giá hóa đơn</span>
                    <span className="font-normal text-slate-700">{order.discount > 0 ? fmt(order.discount) : '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-normal text-slate-500">Khách cần trả</span>
                    <span className="font-normal text-slate-900">{fmt(order.finalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-normal text-slate-500">Khách đã trả</span>
                    <span className="font-normal text-slate-700">{fmt(order.finalAmount)}</span>
                  </div>
                </div>
              </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => handleCancelInvoice(order)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                  Hủy
                </button>
                <button
                  onClick={() => handleCopyInvoice(order)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900"
                >
                  <Copy className="h-4 w-4" />
                  Sao chép
                </button>
                <button
                  onClick={() => handleExportOne(order)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900"
                >
                  <Download className="h-4 w-4" />
                  Xuất file
                </button>
              </div>
              <div className="flex items-center gap-2">
                {onEditInPOS && !order.isReturn && order.status !== 'cancelled' ? (
                  <button
                    onClick={() => onEditInPOS(order)}
                    title="Mở lại đơn này trong máy tính tiền để sửa sản phẩm, số lượng, giá..."
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Chỉnh sửa
                  </button>
                ) : (
                  <span
                    title={
                      order.status === 'cancelled'
                        ? 'Đơn đã hủy — không thể sửa'
                        : 'Chưa hỗ trợ sửa đơn trả/đổi hàng qua máy tính tiền'
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-400 cursor-not-allowed"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Chỉnh sửa
                  </span>
                )}
                <button
                  onClick={() => handleGoToReturnInPOS(order)}
                  title="Mở đơn này trong máy tính tiền để chọn sản phẩm/số lượng cần trả"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-4 w-4" />
                  Trả hàng
                </button>
                <button
                  onClick={() => handlePrintInvoice(order.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  In
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const handlePrintInvoice = (orderId: string) => {
    const order = pageOrders.find(o => o.id === orderId);
    if (!order) return;
    const customer = customers.find(c => c.id === order.customerId);
    openPrintInvoice({
      order,
      storeName: storeName || undefined,
      storeAddress,
      storePhone,
      customerPhone: customer?.phone,
      customerAddress: customer?.address,
      staffName: getStaffName(order.staffId),
    });
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="w-64 shrink-0 h-full min-h-0 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Hóa đơn</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">Quản lý hóa đơn bán hàng</p>
        </div>

        {/* Thời gian */}
        <FilterSection title="Thời gian">
          <FilterDateRange
            startDate={dateRange.start}
            endDate={dateRange.end}
            onStartDateChange={date => { setDateRange(prev => ({ ...prev, start: date })); setPage(1); }}
            onEndDateChange={date => { setDateRange(prev => ({ ...prev, end: date })); setPage(1); }}
          />
        </FilterSection>

        {/* Loại hóa đơn */}
        <FilterSection title="Loại hóa đơn">
          <FilterCheckboxGroup
            label="Loại hóa đơn"
            options={[
              { value: 'no-delivery', label: 'Không giao hàng' },
              { value: 'delivery', label: 'Giao hàng' },
            ]}
            selected={deliveryTypeFilter}
            onChange={v => { setDeliveryTypeFilter(v); setPage(1); }}
            searchable={false}
          />
        </FilterSection>

        {/* Trạng thái hóa đơn */}
        <FilterSection title="Trạng thái hóa đơn">
          <FilterCheckboxGroup
            label="Trạng thái"
            options={[
              { value: 'processing', label: 'Đang xử lý' },
              { value: 'completed', label: 'Hoàn thành' },
              { value: 'failed', label: 'Không giao được' },
              { value: 'cancelled', label: 'Đã hủy' },
            ]}
            selected={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1); }}
            searchable={false}
          />
        </FilterSection>

        {/* Phương thức thanh toán */}
        <FilterSection title="Phương thức thanh toán">
          <FilterCheckboxGroup
            label="Phương thức"
            options={PAYMENT_METHODS.map(m => ({ value: m, label: PAYMENT_LABELS[m] }))}
            selected={paymentFilter}
            onChange={v => { setPaymentFilter(v); setPage(1); }}
            searchable={false}
          />
        </FilterSection>

        {/* Clear filters */}
        {(deliveryTypeFilter.length > 0 ||
          statusFilter.length > 0 ||
          typeFilter.length > 0 ||
          paymentFilter.length > 0) && (
          <div className="px-4 py-3">
            <button
              onClick={() => {
                const d = new Date();
                setDateRange({
                  start: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,
                  end: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
                });
                setDeliveryTypeFilter([]);
                setStatusFilter([]);
                setTypeFilter([]);
                setPaymentFilter([]);
                setPage(1);
              }}
              className="w-full py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </aside>

      {/* ===== MAIN PANEL ===== */}
      <section className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-3 shrink-0">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Theo mã hóa đơn, khách hàng..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>

          <div className="relative flex items-center gap-2 ml-auto">
            <button
              onClick={() => window.location.assign('/pos')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo mới
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => importFileRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Import file CSV"
            >
              <Upload className="w-3.5 h-3.5" />
              {isImporting ? 'Đang import...' : 'Import file'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {selectedIds.size > 0 ? `Xuất ${selectedIds.size} dòng` : 'Xuất file'}
            </button>
            {onDeleteOrders && selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isBulkDeleting ? 'Đang xóa...' : `Xóa ${selectedIds.size} đơn`}
              </button>
            )}
            <button
              onClick={() => {
                setShowToolbarMenu(prev => !prev);
                setShowSettingsMenu(false);
              }}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSettingsMenu(prev => !prev);
                setShowToolbarMenu(false);
              }}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            {showToolbarMenu && (
              <div className="absolute right-10 top-9 z-30 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  onClick={() => {
                    handleExport();
                    setShowToolbarMenu(false);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Xuất dữ liệu đang chọn
                </button>
                <button
                  onClick={() => {
                    setSelectedIds(new Set());
                    setShowToolbarMenu(false);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            )}
            {showSettingsMenu && (
              <div className="absolute right-0 top-9 z-30 w-52 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPaymentColumn}
                    onChange={event => setShowPaymentColumn(event.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Hiển thị cột thanh toán
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="min-w-full text-sm border-collapse">
            {/* Header */}
            <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-2 py-2.5 text-center" />
                <th className="px-3 py-2.5 text-center text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã hóa đơn
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Thời gian
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã trả hàng
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã KH
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Khách hàng
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng tiền hàng
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Giảm giá
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng sau giảm giá
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Khách đã trả
                </th>
                {showPaymentColumn && (
                  <th className="px-3 py-2.5 text-center text-xs font-normal text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Thanh toán
                  </th>
                )}
              </tr>
            </thead>

            {/* Summary row */}
            {paginated.length > 0 && (
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-3 py-2" />
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-xs font-normal text-slate-800">
                    {fmt(summary.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-normal text-slate-800">
                    {fmt(summary.discount)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-normal text-slate-800">
                    {fmt(summary.finalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-normal text-slate-800">
                    {fmt(summary.finalAmount)}
                  </td>
                  {showPaymentColumn && <td className="px-3 py-2" />}
                </tr>
              </tbody>
            )}

            {/* Data rows */}
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-6 py-16 text-center">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                    <p className="text-xs font-bold text-slate-400">
                      {isLoading ? 'Đang tải hóa đơn...' : loadError || 'Không tìm thấy hóa đơn'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map(order => (
                  <React.Fragment key={order.id}>
                    <tr
                      onClick={() => toggleExpanded(order.id)}
                      className={`cursor-pointer transition-colors ${
                        expandedOrderId === order.id
                          ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-500'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5" onClick={event => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleRow(order.id)}
                          disabled={order.isReturn || order.status === 'cancelled'}
                          title={
                            order.isReturn
                              ? 'Chưa hỗ trợ xóa đơn trả/đổi hàng'
                              : order.status === 'cancelled'
                                ? 'Đơn đã hủy'
                                : undefined
                          }
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                        />
                      </td>
                      {/* Star */}
                      <td className="px-2 py-2.5 text-center" onClick={e => toggleStar(order.id, e)}>
                        <Star
                          className={`w-3.5 h-3.5 mx-auto transition-colors ${
                            starredIds.has(order.id)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-slate-200 hover:text-yellow-300'
                          }`}
                        />
                      </td>
                      {/* Mã hóa đơn */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-normal text-indigo-600 text-xs">{order.orderCode}</span>
                        {order.isReturn && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-red-50 text-red-500 text-[9px] font-semibold rounded">
                            TH
                          </span>
                        )}
                        {order.status === 'cancelled' && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-semibold rounded">
                            Đã hủy
                          </span>
                        )}
                      </td>
                      {/* Thời gian */}
                      <td className="px-3 py-2.5 text-center text-xs text-slate-600 font-normal">
                        {formatOrderDateTime(order.date)}
                      </td>
                      {/* Mã trả hàng */}
                      <td className="px-3 py-2.5 text-center text-xs text-slate-400 font-normal">
                        {order.isReturn ? order.orderCode : '—'}
                      </td>
                      {/* Mã KH */}
                      <td className="px-3 py-2.5 text-center text-xs text-slate-500 font-normal">
                        {getCustomerCode(order)}
                      </td>
                      {/* Khách hàng */}
                      <td className="px-3 py-2.5 text-xs text-slate-800 font-normal truncate">
                        {order.customerName || 'Khách lẻ'}
                      </td>
                      {/* Tổng tiền hàng */}
                      <td className="px-3 py-2.5 text-right text-xs font-normal text-slate-800">
                        {fmt(order.totalAmount)}
                      </td>
                      {/* Giảm giá */}
                      <td className="px-3 py-2.5 text-right text-xs font-normal text-slate-500">
                        {order.discount > 0 ? fmt(order.discount) : '0'}
                      </td>
                      {/* Tổng sau giảm giá */}
                      <td className="px-3 py-2.5 text-right text-xs font-normal text-slate-900">
                        {fmt(order.finalAmount)}
                      </td>
                      {/* Khách đã trả */}
                      <td className="px-3 py-2.5 text-right text-xs font-normal text-emerald-700">
                        {fmt((order as any).cashReceived > 0 ? (order as any).cashReceived : order.finalAmount)}
                      </td>
                      {showPaymentColumn && (
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-normal rounded-full">
                            {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                          </span>
                        </td>
                      )}
                    </tr>
                    {expandedOrderId === order.id && renderOrderDetail(order)}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ===== FOOTER PAGINATION ===== */}
        <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-4 shrink-0">
          {/* Page size */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Hiển thị</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value) as 15 | 30 | 50);
                setPage(1);
              }}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
            >
              {PAGE_SIZE_OPTIONS.map(s => (
                <option key={s} value={s}>
                  {s} dòng
                </option>
              ))}
            </select>
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-slate-700">{safePage}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Count */}
          <span className="text-xs font-medium text-slate-500 ml-auto">
            {isLoading ? 'Đang tải...' : totalOrders === 0
              ? '0'
              : `${pageStart + 1}–${Math.min(pageStart + pageSize, totalOrders)}`}{' '}
            trong <span className="font-semibold text-slate-700">{totalOrders}</span> giao
            dịch
          </span>
        </div>
      </section>
    </div>
  );
}
