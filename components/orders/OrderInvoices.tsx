import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Settings,
} from 'lucide-react';
import { AppData } from '../../types';
import { FilterSection, FilterDateRange, FilterCheckboxGroup } from '../shared';

interface OrderInvoicesProps {
  orders: AppData['posOrders'];
  customers: AppData['posCustomers'];
  storeName: string;
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

export default function OrderInvoices({ orders, customers, storeName }: OrderInvoicesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<15 | 30 | 50>(15);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredOrders = useMemo(() => {
    return orders
      .filter(order => {
        const q = searchTerm.toLowerCase();
        if (
          q &&
          !order.orderCode.toLowerCase().includes(q) &&
          !(order.customerName || '').toLowerCase().includes(q) &&
          !(order.customerId || '').toLowerCase().includes(q)
        )
          return false;

        if (dateRange.start && order.date < dateRange.start) return false;
        if (dateRange.end && order.date > dateRange.end) return false;

        if (typeFilter.length > 0) {
          const key = order.isReturn ? 'return' : 'sale';
          if (!typeFilter.includes(key)) return false;
        }

        if (paymentFilter.length > 0 && !paymentFilter.includes(order.paymentMethod)) return false;

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, searchTerm, dateRange, typeFilter, paymentFilter]);

  const summary = useMemo(
    () => ({
      totalAmount: filteredOrders.reduce((s, o) => s + o.totalAmount, 0),
      discount: filteredOrders.reduce((s, o) => s + o.discount, 0),
      finalAmount: filteredOrders.reduce((s, o) => s + o.finalAmount, 0),
    }),
    [filteredOrders]
  );

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filteredOrders.slice(pageStart, pageStart + pageSize);

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

  const handlePrintInvoice = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const customer = customers.find(c => c.id === order.customerId);
    printWindow.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hóa đơn ${order.orderCode}</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #333;padding-bottom:20px}.header h1{margin:0;font-size:24px}.info{display:flex;justify-content:space-between;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}th{background:#f5f5f5}.text-right{text-align:right}.totals{margin-top:20px;text-align:right}.final{font-size:18px;font-weight:bold;color:#4f46e5}.footer{margin-top:40px;text-align:center;color:#666;font-size:12px}@media print{button{display:none}}</style></head><body><div class="header"><h1>${storeName || 'Cửa hàng'}</h1><p>HÓA ĐƠN BÁN HÀNG</p><p>Số: ${order.orderCode}</p></div><div class="info"><div><h3>Khách hàng</h3><p>${order.customerName || 'Khách lẻ'}</p>${customer?.phone ? `<p>${customer.phone}</p>` : ''}</div><div><h3>Thông tin</h3><p>Ngày: ${new Date(order.date).toLocaleDateString('vi-VN')}</p><p>Thanh toán: ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</p></div></div><table><thead><tr><th>STT</th><th>Sản phẩm</th><th class="text-right">SL</th><th class="text-right">Đơn giá</th><th class="text-right">Thành tiền</th></tr></thead><tbody>${order.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.name}</td><td class="text-right">${item.quantity}</td><td class="text-right">${item.price.toLocaleString('vi-VN')}đ</td><td class="text-right">${(item.quantity * item.price).toLocaleString('vi-VN')}đ</td></tr>`).join('')}</tbody></table><div class="totals"><div>Tổng tiền hàng: <strong>${order.totalAmount.toLocaleString('vi-VN')}đ</strong></div>${order.discount ? `<div>Giảm giá: <strong>-${order.discount.toLocaleString('vi-VN')}đ</strong></div>` : ''}<div class="final">Tổng thanh toán: ${order.finalAmount.toLocaleString('vi-VN')}đ</div></div><div class="footer"><p>Cảm ơn quý khách!</p><p>In lúc: ${new Date().toLocaleString('vi-VN')}</p></div><div style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 20px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">In hóa đơn</button></div></body></html>`
    );
    printWindow.document.close();
  };

  const handleExport = () => {
    const rows = [
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
      ...filteredOrders.map(o =>
        [
          o.orderCode,
          o.date,
          o.customerName || 'Khách lẻ',
          o.customerId || '',
          o.totalAmount,
          o.discount,
          o.finalAmount,
          PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod,
          o.isReturn ? 'Trả hàng' : 'Bán hàng',
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hoa-don-${todayStr}.csv`;
    a.click();
  };

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      {/* ===== LEFT SIDEBAR ===== */}
      <div className="w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-black text-slate-700">Bộ lọc</span>
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
              { value: 'sale', label: 'Bán hàng', count: orders.filter(o => !o.isReturn).length },
              {
                value: 'return',
                label: 'Trả hàng',
                count: orders.filter(o => !!o.isReturn).length,
              },
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
            options={PAYMENT_METHODS.map(m => ({
              value: m,
              label: PAYMENT_LABELS[m],
              count: orders.filter(o => o.paymentMethod === m).length,
            }))}
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
              className="w-full py-1.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* ===== MAIN PANEL ===== */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
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

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất file
            </button>
            <button className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <button className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
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
                <th className="px-3 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã hóa đơn
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Thời gian
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã KH
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide">
                  Khách hàng
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng tiền hàng
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Giảm giá
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng sau giá
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Thanh toán
                </th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>

            {/* Summary row */}
            {filteredOrders.length > 0 && (
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-[11px] font-black text-slate-500">
                    {filteredOrders.length} giao dịch
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-[11px] font-black text-slate-800">
                    {fmt(summary.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] font-black text-slate-800">
                    {fmt(summary.discount)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] font-black text-slate-800">
                    {fmt(summary.finalAmount)}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            )}

            {/* Data rows */}
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                    <p className="text-xs font-bold text-slate-400">Không tìm thấy hóa đơn</p>
                  </td>
                </tr>
              ) : (
                paginated.map(order => (
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
                      <span className="font-bold text-indigo-600 text-xs">{order.orderCode}</span>
                      {order.isReturn && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-red-50 text-red-500 text-[9px] font-black rounded">
                          TH
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600 font-medium">
                      {new Date(order.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {order.customerId ? order.customerId.slice(0, 8).toUpperCase() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-800 font-medium">
                      {order.customerName || 'Khách lẻ'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-800 whitespace-nowrap">
                      {fmt(order.totalAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap">
                      {order.discount > 0 ? fmt(order.discount) : '0'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                      {fmt(order.finalAmount)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-full">
                        {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handlePrintInvoice(order.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Xem
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ===== FOOTER PAGINATION ===== */}
        <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-4 shrink-0">
          {/* Page size */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Hiển thị</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value) as 15 | 30 | 50);
                setPage(1);
              }}
              className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
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
            <span className="px-3 py-1 text-[11px] font-black text-slate-700">{safePage}</span>
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
          <span className="text-[11px] font-medium text-slate-500 ml-auto">
            {filteredOrders.length === 0
              ? '0'
              : `${pageStart + 1}–${Math.min(pageStart + pageSize, filteredOrders.length)}`}{' '}
            trong <span className="font-black text-slate-700">{filteredOrders.length}</span> giao
            dịch
          </span>
        </div>
      </div>
    </div>
  );
}
