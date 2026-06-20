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
  Star,
  Plus,
  Upload,
} from 'lucide-react';
import { AppData, AppDataSurgicalUpdate, Employee } from '../../types';
import { apiService } from '../../services/apiService';
import { FilterSection, FilterDateRange, FilterCheckboxGroup } from '../shared';

interface OrderInvoicesProps {
  orders: AppData['posOrders'];
  customers: AppData['posCustomers'];
  products: AppData['posProducts'];
  revenue: AppData['revenue'];
  employees?: Employee[];
  storeName: string;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
}

const PAGE_SIZE_OPTIONS = [15, 30, 50] as const;

const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Card: 'Thẻ',
  Momo: 'Momo',
  Other: 'Khác',
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

export default function OrderInvoices({ orders, customers, products, revenue, storeName, employees = [], onUpdateSurgical }: OrderInvoicesProps) {
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
  const [isCreatingReturn, setIsCreatingReturn] = useState(false);
  const [pageOrders, setPageOrders] = useState<AppData['posOrders']>([]);
  const [totalOrders, setTotalOrders] = useState(orders.length);
  const [filterSummary, setFilterSummary] = useState({ totalAmount: 0, discount: 0, finalAmount: 0 });
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

  const summary = filterSummary;

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

      const { supabaseAdmin } = await import('../../services/supabase');
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
    try {
      await persistOrder(updatedOrder);
      setEditingOrderId(null);
    } catch (err) {
      console.error('[OrderInvoices] handleSaveOrder failed', err);
      alert('Lưu thất bại. Vui lòng thử lại.');
    }
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
    if (isCreatingReturn) return;
    if (order.isReturn) {
      alert('Đây đã là phiếu trả hàng.');
      return;
    }
    const hasExistingReturn = [...orders, ...pageOrders].some(candidate =>
      candidate.isReturn &&
      candidate.id !== order.id &&
      candidate.notes?.includes(order.orderCode)
    );
    if (hasExistingReturn) {
      alert(`Hóa đơn ${order.orderCode} đã có phiếu trả hàng. Vui lòng kiểm tra tab trả hàng trước khi tạo thêm.`);
      return;
    }
    if (!window.confirm(`Tạo phiếu trả hàng từ hóa đơn ${order.orderCode}?`)) return;
    setIsCreatingReturn(true);
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

    // Cập nhật tồn kho: cộng lại số lượng từng sản phẩm
    const stockUpdates: AppDataSurgicalUpdate[] = order.items
      .map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return null;
        return {
          key: 'posProducts' as const,
          item: { ...product, stock: (product.stock || 0) + item.quantity },
          isDelete: false,
        };
      })
      .filter((u): u is Exclude<typeof u, null> => u !== null);

    // Ghi inventory transaction kiểu Return
    const inventoryTransaction: AppDataSurgicalUpdate = {
      key: 'inventoryTransactions',
      item: {
        id: crypto.randomUUID(),
        date: returnOrder.date,
        type: 'Return' as const,
        staffId: order.staffId,
        items: order.items.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            previousStock: product?.stock || 0,
            newStock: (product?.stock || 0) + item.quantity,
          };
        }),
        note: `Trả hàng ${returnOrder.orderCode} (từ ${order.orderCode})`,
        referenceId: returnOrder.id,
      },
      isDelete: false,
    };

    // Cập nhật revenue: trừ doanh thu, trừ COGS (hàng trả về kho)
    const returnDateKey = new Date(returnOrder.date).toLocaleDateString('en-CA');
    const existingRevenue = (revenue || []).find(r => r.date === returnDateKey);
    const returnCogs = order.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + (product?.importPrice || 0) * item.quantity;
    }, 0);
    const revenueUpdates: AppDataSurgicalUpdate[] = [];
    // returnsValue = giá trị hàng thực tế trả (totalAmount)
    // netRevenue giảm = totalAmount - discount (chuẩn KiotViet, không trừ điểm)
    const returnTotalValue = order.totalAmount;
    const orderRevenue = Number(order.totalAmount) - Math.abs(Number(order.discount) || 0);
    if (existingRevenue) {
      const updatedNetRevenue = existingRevenue.netRevenue - orderRevenue;
      const updatedTotalCogs = (existingRevenue.totalCogs || 0) - returnCogs;
      const updatedRev = {
        ...existingRevenue,
        returnsValue: (existingRevenue.returnsValue || 0) + returnTotalValue,
        netRevenue: updatedNetRevenue,
        totalCogs: updatedTotalCogs,
        grossProfit: updatedNetRevenue - updatedTotalCogs,
      };
      revenueUpdates.push({ key: 'revenue', item: updatedRev });
    } else {
      const netRevenue = -orderRevenue;
      const totalCogs = -returnCogs;
      revenueUpdates.push({
        key: 'revenue',
        item: {
          id: crypto.randomUUID(),
          date: returnDateKey,
          totalGrossRevenue: 0,
          discount: 0,
          revenueOther: 0,
          returnsValue: returnTotalValue,
          netRevenue,
          totalCogs,
          grossProfit: netRevenue - totalCogs,
        },
      });
    }

    if (!onUpdateSurgical) {
      alert('Không thể lưu phiếu trả hàng: thiếu kết nối dữ liệu.');
      return;
    }
    try {
      await onUpdateSurgical([
        { key: 'posOrders', item: returnOrder, isDelete: false },
        ...stockUpdates,
        inventoryTransaction,
        ...revenueUpdates,
      ]);
      setPageOrders(prev => [returnOrder, ...prev]);
      setTotalOrders(prev => prev + 1);
      setExpandedOrderId(returnOrder.id);
      setDetailTab('info');
    } catch (err) {
      console.error('[OrderInvoices] handleCreateReturn failed', err);
      alert('Tạo phiếu trả hàng thất bại. Vui lòng thử lại.');
    } finally {
      setIsCreatingReturn(false);
    }
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
                  {isEditing ? (
                    <input
                      value={draftOrder.createdBy}
                      onChange={event => setDraftOrder(prev => ({ ...prev, createdBy: event.target.value }))}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
                    />
                  ) : (
                    <span className="font-normal text-slate-700">{order.staffName || getStaffName(order.staffId) || order.createdBy || order.staffId || '—'}</span>
                  )}
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Người bán:</span>
                  <input
                    readOnly={!isEditing}
                    value={isEditing ? draftOrder.createdBy : order.staffName || getStaffName(order.staffId) || order.createdBy || order.staffId || '—'}
                    onChange={event => setDraftOrder(prev => ({ ...prev, createdBy: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-400 read-only:bg-slate-50"
                  />
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Ngày bán:</span>
                  <div className="inline-flex h-8 w-fit items-center rounded-md bg-slate-100 px-3 text-sm font-normal text-slate-600">
                    {formatOrderDateTime(order.date)}
                  </div>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Kênh bán:</span>
                  <select
                    disabled={!isEditing}
                    value={isEditing ? draftOrder.channelName : order.channelName || 'Bán trực tiếp'}
                    onChange={event => setDraftOrder(prev => ({ ...prev, channelName: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-50"
                  >
                    <option>Bán trực tiếp</option>
                    <option>Online</option>
                    <option>Sàn TMĐT</option>
                    <option>Khác</option>
                  </select>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="font-normal text-slate-400">Bảng giá:</span>
                  <input
                    readOnly={!isEditing}
                    value={isEditing ? draftOrder.priceBookName : order.priceBookName || 'Bảng giá chung'}
                    onChange={event => setDraftOrder(prev => ({ ...prev, priceBookName: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-400 read-only:bg-slate-50"
                  />
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
                  disabled={isCreatingReturn}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-4 w-4" />
                  {isCreatingReturn ? 'Đang xử lý...' : 'Trả hàng'}
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
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã hóa đơn
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Thời gian
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã trả hàng
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã KH
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Khách hàng
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng tiền hàng
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Giảm giá
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng sau giảm giá
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Khách đã trả
                </th>
                {showPaymentColumn && (
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
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
                  <td className="px-3 py-2 text-xs font-medium text-slate-500">
                    Tổng trang này
                  </td>
                  <td className="px-3 py-2" />
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
                  <td className="px-3 py-2 text-right text-xs font-medium text-slate-800">
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
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
                        <span className="font-medium text-indigo-600 text-xs">{order.orderCode}</span>
                        {order.isReturn && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-red-50 text-red-500 text-[9px] font-semibold rounded">
                            TH
                          </span>
                        )}
                      </td>
                      {/* Thời gian */}
                      <td className="px-3 py-2.5 text-center text-xs text-slate-600 font-medium">
                        {formatOrderDateTime(order.date)}
                      </td>
                      {/* Mã trả hàng */}
                      <td className="px-3 py-2.5 text-center text-xs text-slate-400 font-medium">
                        {order.isReturn ? order.orderCode : '—'}
                      </td>
                      {/* Mã KH */}
                      <td className="px-3 py-2.5 text-center text-xs text-slate-500 font-medium">
                        {getCustomerCode(order)}
                      </td>
                      {/* Khách hàng */}
                      <td className="px-3 py-2.5 text-xs text-slate-800 font-medium truncate">
                        {order.customerName || 'Khách lẻ'}
                      </td>
                      {/* Tổng tiền hàng */}
                      <td className="px-3 py-2.5 text-right text-xs font-normal text-slate-800">
                        {fmt(order.totalAmount)}
                      </td>
                      {/* Giảm giá */}
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">
                        {order.discount > 0 ? fmt(order.discount) : '0'}
                      </td>
                      {/* Tổng sau giảm giá */}
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-900">
                        {fmt(order.finalAmount)}
                      </td>
                      {/* Khách đã trả */}
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-emerald-700">
                        {fmt((order as any).cashReceived > 0 ? (order as any).cashReceived : order.finalAmount)}
                      </td>
                      {showPaymentColumn && (
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
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
