import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Search,
  Settings,
  X,
} from 'lucide-react';
import type { POSOrder, POSOrderStatus } from '../../types';
import { FilterCheckboxGroup, FilterDateRange, FilterSection } from '../shared';

interface PendingOrdersPageProps {
  orders: POSOrder[];
  isLoading?: boolean;
}

const PAGE_SIZE_OPTIONS = [15, 30, 50] as const;
const STATUS_FILTERS: POSOrderStatus[] = ['draft', 'pending', 'completed', 'cancelled'];

const STATUS_META: Record<POSOrderStatus, { label: string; className: string }> = {
  pending: { label: 'Đang giao hàng', className: 'bg-blue-50 text-blue-700' },
  draft: { label: 'Phiếu tạm', className: 'bg-slate-100 text-slate-600' },
  completed: { label: 'Hoàn thành', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700' },
};

const PAYMENT_LABELS: Record<POSOrder['paymentMethod'], string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Card: 'Thẻ',
  Momo: 'Momo',
  Other: 'Khác',
  Split: 'Kết hợp nhiều PT',
};

const PAYMENT_METHODS: POSOrder['paymentMethod'][] = ['Cash', 'Bank', 'Card', 'Momo', 'Other'];

type OrderExtraFilters = {
  shippingUnit?: string;
  shipDate?: string;
  deliveryArea?: string;
  receiverId?: string;
  receiverName?: string;
};

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

const getOrderStatus = (order: POSOrder): POSOrderStatus => order.status || 'completed';

const getCustomerCode = (order: POSOrder) =>
  order.customerId ? order.customerId.slice(0, 8).toUpperCase() : '—';

const getPaidAmount = (order: POSOrder) => (getOrderStatus(order) === 'completed' ? order.finalAmount : 0);

const getOrderExtra = (order: POSOrder): OrderExtraFilters => order as POSOrder & OrderExtraFilters;

const getCreatedBy = (order: POSOrder) => order.createdBy || order.staffId || '';

const getReceiver = (order: POSOrder) => {
  const extra = getOrderExtra(order);
  return extra.receiverId || extra.receiverName || '';
};

const buildOptions = (orders: POSOrder[], getValue: (order: POSOrder) => string) => {
  const counts = new Map<string, number>();
  orders.forEach(order => {
    const value = getValue(order);
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
};

const PlaceholderFilter: React.FC<{ label: string }> = ({ label }) => (
  <div className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-400">
    {label}
  </div>
);

export default function PendingOrdersPage({ orders, isLoading = false }: PendingOrdersPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [deliveryDateRange, setDeliveryDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [shippingPartnerFilter, setShippingPartnerFilter] = useState<string[]>([]);
  const [deliveryAreaFilter, setDeliveryAreaFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);
  const [receiverFilter, setReceiverFilter] = useState<string[]>([]);
  const [channelFilter, setChannelFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<15 | 30 | 50>(15);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);
  const [showToolbarMenu, setShowToolbarMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showChannelColumn, setShowChannelColumn] = useState(true);
  const [showPaymentInDetail, setShowPaymentInDetail] = useState(true);

  const pendingOrders = useMemo(
    () => orders.filter(order => !order.isReturn && getOrderStatus(order) !== 'completed'),
    [orders]
  );

  const shippingPartnerOptions = useMemo(
    () => buildOptions(pendingOrders, order => getOrderExtra(order).shippingUnit || ''),
    [pendingOrders]
  );

  const deliveryAreaOptions = useMemo(
    () => buildOptions(pendingOrders, order => getOrderExtra(order).deliveryArea || ''),
    [pendingOrders]
  );

  const creatorOptions = useMemo(
    () => buildOptions(pendingOrders, order => getCreatedBy(order)),
    [pendingOrders]
  );

  const receiverOptions = useMemo(
    () => buildOptions(pendingOrders, order => getReceiver(order)),
    [pendingOrders]
  );

  const channelOptions = useMemo(
    () => buildOptions(pendingOrders, order => order.channelName || order.channel || 'Khác'),
    [pendingOrders]
  );

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return pendingOrders
      .filter(order => {
        const status = getOrderStatus(order);
        return statusFilter.length === 0 || statusFilter.includes(status);
      })
      .filter(order => {
        if (!dateRange.start && !dateRange.end) return true;
        const dateOnly = order.date.slice(0, 10);
        if (dateRange.start && dateOnly < dateRange.start) return false;
        if (dateRange.end && dateOnly > dateRange.end) return false;
        return true;
      })
      .filter(order => {
        if (channelFilter.length === 0) return true;
        return channelFilter.includes(order.channelName || order.channel || 'Khác');
      })
      .filter(order => {
        if (shippingPartnerFilter.length === 0) return true;
        return shippingPartnerFilter.includes(getOrderExtra(order).shippingUnit || '');
      })
      .filter(order => {
        if (!deliveryDateRange.start && !deliveryDateRange.end) return true;
        const shipDate = getOrderExtra(order).shipDate;
        if (!shipDate) return false;
        const dateOnly = shipDate.slice(0, 10);
        if (deliveryDateRange.start && dateOnly < deliveryDateRange.start) return false;
        if (deliveryDateRange.end && dateOnly > deliveryDateRange.end) return false;
        return true;
      })
      .filter(order => {
        if (deliveryAreaFilter.length === 0) return true;
        return deliveryAreaFilter.includes(getOrderExtra(order).deliveryArea || '');
      })
      .filter(order => {
        if (paymentFilter.length === 0) return true;
        return paymentFilter.includes(order.paymentMethod);
      })
      .filter(order => {
        if (creatorFilter.length === 0) return true;
        return creatorFilter.includes(getCreatedBy(order));
      })
      .filter(order => {
        if (receiverFilter.length === 0) return true;
        return receiverFilter.includes(getReceiver(order));
      })
      .filter(order => {
        if (!term) return true;
        return (
          (order.orderCode || '').toLowerCase().includes(term) ||
          (order.customerName || '').toLowerCase().includes(term) ||
          getCustomerCode(order).toLowerCase().includes(term) ||
          (order.channelName || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    channelFilter,
    creatorFilter,
    dateRange.end,
    dateRange.start,
    deliveryAreaFilter,
    deliveryDateRange.end,
    deliveryDateRange.start,
    paymentFilter,
    pendingOrders,
    receiverFilter,
    searchTerm,
    shippingPartnerFilter,
    statusFilter,
  ]);

  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filteredOrders.slice(pageStart, pageStart + pageSize);

  const summary = useMemo(
    () => ({
      finalAmount: paginated.reduce((sum, order) => sum + order.finalAmount, 0),
      paidAmount: paginated.reduce((sum, order) => sum + getPaidAmount(order), 0),
    }),
    [paginated]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const allChecked = paginated.length > 0 && paginated.every(order => selectedIds.has(order.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(order => next.delete(order.id));
        return next;
      });
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      paginated.forEach(order => next.add(order.id));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const rowsToExport =
      selectedIds.size > 0 ? filteredOrders.filter(order => selectedIds.has(order.id)) : paginated;
    const rows = [
      [
        'Mã đặt hàng',
        'Thời gian',
        'Mã KH',
        'Khách hàng',
        'Khách cần trả',
        'Khách đã trả',
        'Trạng thái',
        'Kênh',
      ].join(','),
      ...rowsToExport.map(order =>
        [
          order.orderCode || order.id,
          order.date,
          order.customerId || '',
          order.customerName || 'Khách lẻ',
          order.finalAmount,
          getPaidAmount(order),
          STATUS_META[getOrderStatus(order)].label,
          order.channelName || order.channel || '',
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = selectedIds.size > 0 ? `dat-hang-da-chon.csv` : `dat-hang-trang-${safePage}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
    setDeliveryDateRange({ start: '', end: '' });
    setStatusFilter([]);
    setShippingPartnerFilter([]);
    setDeliveryAreaFilter([]);
    setPaymentFilter([]);
    setCreatorFilter([]);
    setReceiverFilter([]);
    setChannelFilter([]);
    setSearchTerm('');
    setPage(1);
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      <aside className="w-64 shrink-0 h-full min-h-0 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Đặt hàng</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">Quản lý đơn đặt hàng từ khách</p>
        </div>

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

        <FilterSection title="Trạng thái">
          <FilterCheckboxGroup
            label="Trạng thái"
            options={STATUS_FILTERS.map(status => ({
              value: status,
              label: STATUS_META[status].label,
              count: pendingOrders.filter(order => getOrderStatus(order) === status).length,
            }))}
            selected={statusFilter}
            onChange={value => {
              setStatusFilter(value);
              setPage(1);
            }}
            searchable={false}
          />
        </FilterSection>

        <FilterSection title="Đối tác giao hàng">
          {shippingPartnerOptions.length > 0 ? (
            <FilterCheckboxGroup
              label="Đối tác giao hàng"
              options={shippingPartnerOptions}
              selected={shippingPartnerFilter}
              onChange={value => {
                setShippingPartnerFilter(value);
                setPage(1);
              }}
              placeholder="Chọn đối tác giao hàng"
            />
          ) : (
            <PlaceholderFilter label="Chọn đối tác giao hàng" />
          )}
        </FilterSection>

        <FilterSection title="Thời gian giao hàng">
          <div className="space-y-3">
            <button
              onClick={() => {
                setDeliveryDateRange({ start: '', end: '' });
                setPage(1);
              }}
              className="w-full px-3 py-2 text-left text-sm bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-indigo-400 transition-all"
            >
              Toàn thời gian
            </button>
            <FilterDateRange
              startDate={deliveryDateRange.start}
              endDate={deliveryDateRange.end}
              onStartDateChange={date => {
                setDeliveryDateRange(prev => ({ ...prev, start: date }));
                setPage(1);
              }}
              onEndDateChange={date => {
                setDeliveryDateRange(prev => ({ ...prev, end: date }));
                setPage(1);
              }}
            />
          </div>
        </FilterSection>

        <FilterSection title="Khu vực giao hàng">
          {deliveryAreaOptions.length > 0 ? (
            <FilterCheckboxGroup
              label="Khu vực giao hàng"
              options={deliveryAreaOptions}
              selected={deliveryAreaFilter}
              onChange={value => {
                setDeliveryAreaFilter(value);
                setPage(1);
              }}
              placeholder="Chọn Tỉnh/TP - Quận/Huyện"
            />
          ) : (
            <PlaceholderFilter label="Chọn Tỉnh/TP - Quận/Huyện" />
          )}
        </FilterSection>

        <FilterSection title="Phương thức thanh toán">
          <FilterCheckboxGroup
            label="Phương thức thanh toán"
            options={PAYMENT_METHODS.map(method => ({
              value: method,
              label: PAYMENT_LABELS[method],
              count: pendingOrders.filter(order => order.paymentMethod === method).length,
            }))}
            selected={paymentFilter}
            onChange={value => {
              setPaymentFilter(value);
              setPage(1);
            }}
            searchable={false}
          />
        </FilterSection>

        <FilterSection title="Người tạo">
          {creatorOptions.length > 0 ? (
            <FilterCheckboxGroup
              label="Người tạo"
              options={creatorOptions}
              selected={creatorFilter}
              onChange={value => {
                setCreatorFilter(value);
                setPage(1);
              }}
              placeholder="Chọn người tạo"
            />
          ) : (
            <PlaceholderFilter label="Chọn người tạo" />
          )}
        </FilterSection>

        <FilterSection title="Người nhận đặt">
          {receiverOptions.length > 0 ? (
            <FilterCheckboxGroup
              label="Người nhận đặt"
              options={receiverOptions}
              selected={receiverFilter}
              onChange={value => {
                setReceiverFilter(value);
                setPage(1);
              }}
              placeholder="Chọn người nhận đặt"
            />
          ) : (
            <PlaceholderFilter label="Chọn người nhận đặt" />
          )}
        </FilterSection>

        <FilterSection title="Kênh bán">
          <FilterCheckboxGroup
            label="Kênh bán"
            options={channelOptions}
            selected={channelFilter}
            onChange={value => {
              setChannelFilter(value);
              setPage(1);
            }}
            searchable={false}
          />
        </FilterSection>

        {(dateRange.start ||
          dateRange.end ||
          deliveryDateRange.start ||
          deliveryDateRange.end ||
          statusFilter.length > 0 ||
          shippingPartnerFilter.length > 0 ||
          deliveryAreaFilter.length > 0 ||
          paymentFilter.length > 0 ||
          creatorFilter.length > 0 ||
          receiverFilter.length > 0 ||
          channelFilter.length > 0 ||
          searchTerm.trim()) && (
          <div className="px-4 py-3">
            <button
              onClick={clearFilters}
              className="w-full py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </aside>

      <section className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Theo mã đặt hàng, khách hàng..."
              value={searchTerm}
              onChange={event => {
                setSearchTerm(event.target.value);
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
              <div className="absolute right-0 top-9 z-30 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showChannelColumn}
                    onChange={event => setShowChannelColumn(event.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Hiển thị cột kênh
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPaymentInDetail}
                    onChange={event => setShowPaymentInDetail(event.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Hiển thị thanh toán trong chi tiết
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[1040px] text-sm border-collapse">
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
                  Mã đặt hàng
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
                  Khách cần trả
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Khách đã trả
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Trạng thái
                </th>
                {showChannelColumn && (
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Kênh
                  </th>
                )}
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>

            {paginated.length > 0 && (
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-xs font-semibold text-slate-500">
                    Tổng trang này
                  </td>
                  {showChannelColumn && <td className="px-3 py-2" />}
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800">
                    {fmt(summary.finalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800">
                    {fmt(summary.paidAmount)}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            )}

            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={showChannelColumn ? 10 : 9} className="px-6 py-16 text-center">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                    <p className="text-xs font-bold text-slate-400">
                      Không tìm thấy đơn đặt hàng
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map(order => {
                  const status = getOrderStatus(order);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleRow(order.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-bold text-indigo-600 text-xs">
                          {order.orderCode || order.id}
                        </span>
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
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {fmt(order.finalAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap">
                        {fmt(getPaidAmount(order))}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${STATUS_META[status].className}`}
                        >
                          {STATUS_META[status].label}
                        </span>
                      </td>
                      {showChannelColumn && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500 font-medium">
                          {order.channelName || order.channel || '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-2xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Hiển thị</span>
            <select
              value={pageSize}
              onChange={event => {
                setPageSize(Number(event.target.value) as 15 | 30 | 50);
                setPage(1);
              }}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size} dòng
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(value => Math.max(1, value - 1))}
              disabled={safePage === 1}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-slate-700">{safePage}</span>
            <button
              onClick={() => setPage(value => Math.min(totalPages, value + 1))}
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

          <span className="text-xs font-medium text-slate-500 ml-auto">
            {totalOrders === 0 ? '0' : `${pageStart + 1}-${Math.min(pageStart + pageSize, totalOrders)}`}{' '}
            trong <span className="font-semibold text-slate-700">{totalOrders}</span> giao dịch
          </span>
        </div>
      </section>

      {selectedOrder && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Chi tiết đặt hàng
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  {selectedOrder.orderCode || selectedOrder.id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto px-5 py-4">
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-slate-400">Khách hàng</p>
                  <p className="mt-1 text-xs font-bold text-slate-900">
                    {selectedOrder.customerName || 'Khách lẻ'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-slate-400">Thời gian</p>
                  <p className="mt-1 text-xs font-bold text-slate-900">
                    {formatOrderDateTime(selectedOrder.date)}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-100">
                {(selectedOrder.items || []).map(item => (
                  <div
                    key={`${item.productId}-${item.sku}`}
                    className="flex items-center justify-between gap-4 border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.sku} · {fmt(item.price)} x {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-bold text-slate-900">
                      {fmt(item.total)}
                    </p>
                  </div>
                ))}
              </div>

              {selectedOrder.notes && (
                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-slate-400">Ghi chú</p>
                  <p className="mt-1 text-xs text-slate-700">{selectedOrder.notes}</p>
                </div>
              )}
              {showPaymentInDetail && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-xs font-medium text-slate-400">Phương thức thanh toán</p>
                    <p className="mt-1 text-xs font-bold text-slate-900">
                      {PAYMENT_LABELS[selectedOrder.paymentMethod] || selectedOrder.paymentMethod}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-xs font-medium text-slate-400">Khách đã trả</p>
                    <p className="mt-1 text-xs font-bold text-slate-900">
                      {fmt(getPaidAmount(selectedOrder))}đ
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
              <span className="text-xs text-slate-500">Tổng giá trị</span>
              <span className="text-lg font-semibold text-indigo-600">
                {fmt(selectedOrder.finalAmount)}đ
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
