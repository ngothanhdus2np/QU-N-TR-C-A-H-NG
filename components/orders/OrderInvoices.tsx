import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Eye,
  Copy,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Settings,
  Save,
  RotateCcw,
  Printer,
  Trash2,
} from 'lucide-react';
import { AppData, AppDataSurgicalUpdate } from '../../types';
import { apiService } from '../../services/apiService';
import { FilterSection, FilterDateRange, FilterCheckboxGroup } from '../shared';

interface OrderInvoicesProps {
  orders: AppData['posOrders'];
  customers: AppData['posCustomers'];
  storeName: string;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
}

const PAGE_SIZE_OPTIONS = [15, 30, 50] as const;

const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Momo: 'Momo',
  Other: 'Khác',
};

const PAYMENT_METHODS = ['Cash', 'Bank', 'Momo', 'Other'] as const;

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

export default function OrderInvoices({ orders, customers, storeName, onUpdateSurgical }: OrderInvoicesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<15 | 30 | 50>(15);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageOrders, setPageOrders] = useState<AppData['posOrders']>([]);
  const [totalOrders, setTotalOrders] = useState(orders.length);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'payments'>('info');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState({
    createdBy: '',
    channelName: '',
    priceBookName: '',
    notes: '',
  });
  const [showToolbarMenu, setShowToolbarMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showPaymentColumn, setShowPaymentColumn] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

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
        });
        if (cancelled) return;
        setPageOrders(result.data);
        setTotalOrders(result.total);
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
  }, [dateRange.end, dateRange.start, page, pageSize, paymentFilter, searchTerm, typeFilter]);

  const summary = useMemo(
    () => ({
      totalAmount: pageOrders.reduce((s, o) => s + o.totalAmount, 0),
      discount: pageOrders.reduce((s, o) => s + o.discount, 0),
      finalAmount: pageOrders.reduce((s, o) => s + o.finalAmount, 0),
    }),
    [pageOrders]
  );

  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = pageOrders;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const allChecked = paginated.length > 0 && paginated.every(o => selectedIds.has(o.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(o => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(o => next.add(o.id));
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

  const tableColumnCount = showPaymentColumn ? 10 : 9;

  const persistOrder = async (order: AppData['posOrders'][number]) => {
    setPageOrders(prev => prev.map(item => (item.id === order.id ? order : item)));
    if (onUpdateSurgical) {
      await onUpdateSurgical([{ key: 'posOrders', item: order, isDelete: false }]);
    }
  };

  const addOrder = async (order: AppData['posOrders'][number]) => {
    setPageOrders(prev => [order, ...prev]);
    setTotalOrders(prev => prev + 1);
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

  const handleExportOne = (order: AppData['posOrders'][number]) => {
    exportOrders([order], `hoa-don-${order.orderCode}-${todayStr}.csv`);
  };

  const handleStartEdit = (order: AppData['posOrders'][number]) => {
    setEditingOrderId(order.id);
    setDraftOrder({
      createdBy: order.createdBy || order.staffId || '',
      channelName: order.channelName || 'Bán trực tiếp',
      priceBookName: order.priceBookName || 'Bảng giá chung',
      notes: order.notes || '',
    });
  };

  const handleSaveOrder = async (order: AppData['posOrders'][number]) => {
    if (editingOrderId !== order.id) {
      alert('Bấm Chỉnh sửa trước khi lưu thay đổi.');
      return;
    }
    const updatedOrder: AppData['posOrders'][number] = {
      ...order,
      createdBy: draftOrder.createdBy,
      staffId: draftOrder.createdBy || order.staffId,
      channelName: draftOrder.channelName,
      priceBookName: draftOrder.priceBookName,
      notes: draftOrder.notes,
    };
    await persistOrder(updatedOrder);
    setEditingOrderId(null);
  };

  const handleCancelInvoice = async (order: AppData['posOrders'][number]) => {
    if (order.status === 'cancelled') {
      alert('Hóa đơn này đã hủy.');
      return;
    }
    if (!window.confirm(`Hủy hóa đơn ${order.orderCode}?`)) return;
    await persistOrder({ ...order, status: 'cancelled' });
  };

  const handleCopyInvoice = async (order: AppData['posOrders'][number]) => {
    const text = [
      `Hóa đơn: ${order.orderCode}`,
      `Khách hàng: ${order.customerName || 'Khách lẻ'}`,
      `Ngày bán: ${formatOrderDateTime(order.date)}`,
      `Tổng thanh toán: ${fmt(order.finalAmount)}`,
      `Sản phẩm: ${order.items.map(item => `${item.name} x ${item.quantity}`).join('; ')}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('Đã sao chép thông tin hóa đơn.');
    } catch {
      alert(text);
    }
  };

  const handleCreateReturn = async (order: AppData['posOrders'][number]) => {
    if (order.isReturn) {
      alert('Đây đã là phiếu trả hàng.');
      return;
    }
    if (!window.confirm(`Tạo phiếu trả hàng từ hóa đơn ${order.orderCode}?`)) return;
    const suffix = order.orderCode.replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6);
    const returnOrder: AppData['posOrders'][number] = {
      ...order,
      id: crypto.randomUUID(),
      orderCode: `TH${suffix}`,
      date: new Date().toISOString(),
      status: 'completed',
      isReturn: true,
      notes: `Trả hàng từ hóa đơn ${order.orderCode}${order.notes ? `. ${order.notes}` : ''}`,
    };
    await addOrder(returnOrder);
    setExpandedOrderId(returnOrder.id);
    setDetailTab('info');
  };

  const renderOrderDetail = (order: AppData['posOrders'][number]) => {
    const customer = getOrderCustomer(order);
    const totalQuantity = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const isEditing = editingOrderId === order.id;
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
                    <span className="text-sm font-bold text-slate-600">{order.orderCode}</span>
                    <span className={`rounded-md px-2 py-1 text-xs font-bold ${
                      order.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-600'
                        : order.status === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {order.status === 'cancelled' ? 'Đã hủy' : order.status === 'pending' ? 'Đang xử lý' : 'Hoàn thành'}
                    </span>
                    {order.isReturn && (
                      <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600">
                        Trả hàng
                      </span>
                    )}
                  </div>
                  {customer?.phone && (
                    <p className="mt-1 text-xs font-medium text-slate-500">SĐT: {customer.phone}</p>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-700">{storeName || 'Chi nhánh trung tâm'}</div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-bold text-slate-500">Người tạo:</span>
                  {isEditing ? (
                    <input
                      value={draftOrder.createdBy}
                      onChange={event => setDraftOrder(prev => ({ ...prev, createdBy: event.target.value }))}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                    />
                  ) : (
                    <span className="font-semibold text-slate-800">{order.createdBy || order.staffId || '—'}</span>
                  )}
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-bold text-slate-500">Người bán:</span>
                  <input
                    readOnly={!isEditing}
                    value={isEditing ? draftOrder.createdBy : order.createdBy || order.staffId || '—'}
                    onChange={event => setDraftOrder(prev => ({ ...prev, createdBy: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 read-only:bg-slate-50"
                  />
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="font-bold text-slate-500">Ngày bán:</span>
                  <div className="inline-flex h-8 w-fit items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-600">
                    {formatOrderDateTime(order.date)}
                  </div>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-bold text-slate-500">Kênh bán:</span>
                  <select
                    disabled={!isEditing}
                    value={isEditing ? draftOrder.channelName : order.channelName || 'Bán trực tiếp'}
                    onChange={event => setDraftOrder(prev => ({ ...prev, channelName: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-50"
                  >
                    <option>Bán trực tiếp</option>
                    <option>Online</option>
                    <option>Sàn TMĐT</option>
                    <option>Khác</option>
                  </select>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-bold text-slate-500">Bảng giá:</span>
                  <input
                    readOnly={!isEditing}
                    value={isEditing ? draftOrder.priceBookName : order.priceBookName || 'Bảng giá chung'}
                    onChange={event => setDraftOrder(prev => ({ ...prev, priceBookName: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 read-only:bg-slate-50"
                  />
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="font-bold text-slate-500">Thanh toán:</span>
                  <span className="font-semibold text-slate-800">
                    {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                  </span>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-md border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Mã hàng</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Tên hàng</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-700">Số lượng</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-700">Đơn giá</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-700">Giảm giá</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-700">Giá bán</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-700">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item, index) => (
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
                  readOnly={!isEditing}
                  placeholder="Ghi chú..."
                  value={isEditing ? draftOrder.notes : order.notes || ''}
                  onChange={event => setDraftOrder(prev => ({ ...prev, notes: event.target.value }))}
                  className="min-h-28 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 read-only:bg-white"
                />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Tổng tiền hàng ({fmt(totalQuantity)})</span>
                    <span className="font-medium text-slate-900">{fmt(order.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Giảm giá hóa đơn</span>
                    <span className="font-medium text-slate-900">{order.discount > 0 ? fmt(order.discount) : '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Khách cần trả</span>
                    <span className="font-medium text-slate-900">{fmt(order.finalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Khách đã trả</span>
                    <span className="font-medium text-slate-900">{fmt(order.finalAmount)}</span>
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
                <button
                  onClick={() => handleStartEdit(order)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  <Edit3 className="h-4 w-4" />
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => handleSaveOrder(order)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Save className="h-4 w-4" />
                  Lưu
                </button>
                <button
                  onClick={() => handleCreateReturn(order)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const customer = customers.find(c => c.id === order.customerId);
    printWindow.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hóa đơn ${order.orderCode}</title><style>body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:0;padding:20px;max-width:800px;margin:0 auto}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #333;padding-bottom:20px}.header h1{margin:0;font-size:24px}.info{display:flex;justify-content:space-between;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}th{background:#f5f5f5}.text-right{text-align:right}.totals{margin-top:20px;text-align:right}.final{font-size:18px;font-weight:bold;color:#4f46e5}.footer{margin-top:40px;text-align:center;color:#666;font-size:12px}.actions{text-align:center;margin-top:20px}.actions button{padding:10px 20px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer}@media print{.actions{display:none}}</style></head><body><div class="header"><h1>${storeName || 'Cửa hàng'}</h1><p>HÓA ĐƠN BÁN HÀNG</p><p>Số: ${order.orderCode}</p></div><div class="info"><div><h3>Khách hàng</h3><p>${order.customerName || 'Khách lẻ'}</p>${customer?.phone ? `<p>${customer.phone}</p>` : ''}</div><div><h3>Thông tin</h3><p>Thời gian: ${formatOrderDateTime(order.date)}</p><p>Thanh toán: ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</p></div></div><table><thead><tr><th>STT</th><th>Sản phẩm</th><th class="text-right">SL</th><th class="text-right">Đơn giá</th><th class="text-right">Thành tiền</th></tr></thead><tbody>${order.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.name}</td><td class="text-right">${item.quantity}</td><td class="text-right">${item.price.toLocaleString('vi-VN')}đ</td><td class="text-right">${(item.quantity * item.price).toLocaleString('vi-VN')}đ</td></tr>`).join('')}</tbody></table><div class="totals"><div>Tổng tiền hàng: <strong>${order.totalAmount.toLocaleString('vi-VN')}đ</strong></div>${order.discount ? `<div>Giảm giá: <strong>-${order.discount.toLocaleString('vi-VN')}đ</strong></div>` : ''}<div class="final">Tổng thanh toán: ${order.finalAmount.toLocaleString('vi-VN')}đ</div></div><div class="footer"><p>Cảm ơn quý khách!</p><p>In lúc: ${new Date().toLocaleString('vi-VN')}</p></div><div class="actions"><button id="print-invoice-button" type="button">In hóa đơn</button></div><script>function printInvoice(){window.focus();setTimeout(function(){window.print();},50);}document.addEventListener('DOMContentLoaded',function(){var button=document.getElementById('print-invoice-button');if(button)button.addEventListener('click',printInvoice);});</script></body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="w-64 shrink-0 h-full min-h-0 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-700">Bộ lọc</span>
        </div>

        {/* Thời gian */}
        <FilterSection title="Thời gian">
          <FilterDateRange
            startDate={dateRange.start}
            endDate={dateRange.end}
            onStartDateChange={date => {
              setDateRange(prev => ({ ...prev, start: date }));
              setPage(1);
            }}
            onEndDateChange={date => {
              setDateRange(prev => ({ ...prev, end: date }));
              setPage(1);
            }}
          />
        </FilterSection>

        {/* Loại hóa đơn */}
        <FilterSection title="Loại hóa đơn">
          <FilterCheckboxGroup
            label="Loại hóa đơn"
            options={[
              { value: 'sale', label: 'Bán hàng' },
              { value: 'return', label: 'Trả hàng' },
            ]}
            selected={typeFilter}
            onChange={v => {
              setTypeFilter(v);
              setPage(1);
            }}
            searchable={false}
          />
        </FilterSection>

        {/* Phương thức thanh toán */}
        <FilterSection title="Phương thức thanh toán">
          <FilterCheckboxGroup
            label="Phương thức"
            options={PAYMENT_METHODS.map(m => ({ value: m, label: PAYMENT_LABELS[m] }))}
            selected={paymentFilter}
            onChange={v => {
              setPaymentFilter(v);
              setPage(1);
            }}
            searchable={false}
          />
        </FilterSection>

        {/* Clear filters */}
        {(dateRange.start ||
          dateRange.end ||
          typeFilter.length > 0 ||
          paymentFilter.length > 0) && (
          <div className="px-4 py-3">
            <button
              onClick={() => {
                setDateRange({ start: '', end: '' });
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
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {selectedIds.size > 0 ? `Xuất ${selectedIds.size} dòng` : 'Xuất trang'}
            </button>
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
          <table className="w-full text-sm border-collapse">
            {/* Header */}
            <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã hóa đơn
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Thời gian
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã KH
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Khách hàng
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng tiền hàng
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Giảm giá
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng sau giá
                </th>
                {showPaymentColumn && (
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Thanh toán
                  </th>
                )}
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>

            {/* Summary row */}
            {paginated.length > 0 && (
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-xs font-medium text-slate-500">
                    Tổng trang này
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-xs font-medium text-slate-800">
                    {fmt(summary.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-slate-800">
                    {fmt(summary.discount)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-slate-800">
                    {fmt(summary.finalAmount)}
                  </td>
                  {showPaymentColumn && <td className="px-3 py-2" />}
                  <td className="px-3 py-2" />
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
                      <td className="px-3 py-2.5" onClick={event => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleRow(order.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-indigo-600 text-xs">{order.orderCode}</span>
                        {order.isReturn && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-red-50 text-red-500 text-[9px] font-semibold rounded">
                            TH
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600 font-medium">
                        {formatOrderDateTime(order.date)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500 font-medium">
                        {getCustomerCode(order)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-800 font-medium">
                        {order.customerName || 'Khách lẻ'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-normal text-slate-800 whitespace-nowrap">
                        {fmt(order.totalAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap">
                        {order.discount > 0 ? fmt(order.discount) : '0'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-900 whitespace-nowrap">
                        {fmt(order.finalAmount)}
                      </td>
                      {showPaymentColumn && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                            {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center" onClick={event => event.stopPropagation()}>
                        <button
                          onClick={() => handlePrintInvoice(order.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-2xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Xem
                        </button>
                      </td>
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
