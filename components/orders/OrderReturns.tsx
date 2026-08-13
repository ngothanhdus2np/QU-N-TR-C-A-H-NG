import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  X,
  AlertCircle,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Plus,
  Printer,
  Save,
  Trash2,
} from 'lucide-react';
import { AppData, AppDataSurgicalUpdate } from '../../types';
import {
  ListPageLayout,
  ListPageToolbar,
  ListPagePagination,
  FilterSection,
  FilterDateRange,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';

interface OrderReturnsProps {
  orders: AppData['posOrders'];
  products: AppData['posProducts'];
  customers: AppData['posCustomers'];
  transactions?: AppData['inventoryTransactions'];
  onUpdateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  // Hủy phiếu trả — đi qua service chuẩn (processCancelReturn / processCancelLegacyReturnTransaction)
  onCancelReturn: (orderId: string) => Promise<void>;
  onCancelLegacyReturn: (transactionId: string) => Promise<void>;
  // Tạo phiếu trả mới — điều hướng sang tab Trả hàng trong POS (luồng chuẩn duy nhất)
  onReturnInPOS: (order: AppData['posOrders'][number]) => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Momo: 'Momo',
  Other: 'Khác',
  Split: 'Kết hợp nhiều PT',
};

function fmt(n: number) {
  return n.toLocaleString('vi-VN');
}

const isReturnInvoice = (order: AppData['posOrders'][number]) =>
  order.isReturn === true ||
  /^TH/i.test(order.orderCode || '') ||
  Number(order.finalAmount || 0) < 0;

const absMoney = (value: number | undefined) => Math.abs(Number(value || 0));

// Inline checkbox cho sidebar
function SidebarCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0"
      />
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  );
}

export default function OrderReturns({
  orders,
  products,
  customers,
  transactions = [],
  onUpdateSurgical,
  onCancelReturn,
  onCancelLegacyReturn,
  onReturnInPOS,
}: OrderReturnsProps) {
  // Sidebar filter state
  const [returnTypeFilter, setReturnTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Pagination + search
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedReturnId, setExpandedReturnId] = useState<string | null>(null);
  const [selectedReturnIds, setSelectedReturnIds] = useState<Set<string>>(new Set());
  const [starredReturnIds, setStarredReturnIds] = useState<Set<string>>(new Set());
  const [creatorFilter, setCreatorFilter] = useState('');
  const [receiverFilter, setReceiverFilter] = useState('');

  // Create return panel (split-view right panel) — chỉ còn bước chọn đơn,
  // chọn xong điều hướng sang tab Trả hàng trong POS (luồng chuẩn duy nhất)
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');

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

  // Derived dates
  const todayStr = new Date().toISOString().split('T')[0];

  const getReturnTransactionCode = (transaction: AppData['inventoryTransactions'][number]) => {
    const noteCode = transaction.note?.match(/(?:đơn|hàng)\s+([A-Z]{2,}-?\d+)/i)?.[1];
    return noteCode || transaction.referenceId || transaction.id.slice(0, 12).toUpperCase();
  };

  // Returns list: pos return invoices plus legacy return stock transactions.
  const allReturns = useMemo(() => {
    const returnOrders = orders.filter(isReturnInvoice);
    const orderIds = new Set(returnOrders.map(o => o.id));
    const legacyReturnTransactions = transactions
      .filter(t => (t.type === 'Return' || t.type === 'return') && !orderIds.has(t.id))
      .map(t => ({
        id: t.id,
        orderCode: getReturnTransactionCode(t),
        date: t.date,
        customerId: '',
        customerName: t.note?.match(/Khách hàng: ([^\n]+)/)?.[1] || 'Khách lẻ',
        items: (t.items || []).map(item => ({
          productId: item.productId,
          sku: item.sku || '',
          name: item.name || item.productName || item.productId,
          quantity: item.quantity,
          price: item.price || 0,
          discount: item.discount || 0,
          total: Math.max(0, item.quantity * (item.price || 0) - (item.discount || 0)),
        })),
        totalAmount:
          t.totalAmount ||
          (t.items || []).reduce((sum, item) => sum + Math.max(0, item.quantity * (item.price || 0) - (item.discount || 0)), 0),
        discount: 0,
        finalAmount:
          t.totalAmount ||
          (t.items || []).reduce((sum, item) => sum + Math.max(0, item.quantity * (item.price || 0) - (item.discount || 0)), 0),
        paymentMethod: 'Other' as const,
        staffId: t.staffId || '',
        channelName: 'Bán trực tiếp',
        priceBookName: 'Bảng giá chung',
        status: t.status === 'cancelled' ? 'cancelled' as const : 'completed' as const,
        notes: t.note,
        pointsEarned: 0,
        isReturn: true,
      }));

    return [...returnOrders, ...legacyReturnTransactions].sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, transactions]);

  const returnSourceMap = useMemo(() => {
    const map = new Map<string, 'order' | 'transaction'>();
    orders.filter(isReturnInvoice).forEach(order => map.set(order.id, 'order'));
    transactions
      .filter(transaction => transaction.type === 'Return' || transaction.type === 'return')
      .forEach(transaction => {
        if (!map.has(transaction.id)) map.set(transaction.id, 'transaction');
      });
    return map;
  }, [orders, transactions]);

  const filteredReturns = useMemo(() => {
    return allReturns.filter(o => {
      const q = searchTerm.toLowerCase();
      if (
        q &&
        !o.orderCode.toLowerCase().includes(q) &&
        !(o.customerName || '').toLowerCase().includes(q) &&
        !(o.customerId || '').toLowerCase().includes(q)
      )
        return false;

      if (customFrom && o.date < customFrom) return false;
      if (customTo && o.date > `${customTo}T23:59:59`) return false;

      if (returnTypeFilter.length > 0) {
        const source = returnSourceMap.get(o.id);
        const type = source === 'order' ? 'invoice' : 'quick';
        if (!returnTypeFilter.includes(type)) return false;
      }

      if (statusFilter.length > 0) {
        const status = o.status === 'cancelled' ? 'cancelled' : 'returned';
        if (!statusFilter.includes(status)) return false;
      }

      const staffText = `${o.staffId || ''} ${'createdBy' in o ? o.createdBy || '' : ''}`.toLowerCase();
      if (creatorFilter.trim() && !staffText.includes(creatorFilter.trim().toLowerCase())) return false;
      if (receiverFilter.trim() && !staffText.includes(receiverFilter.trim().toLowerCase())) return false;

      return true;
    });
  }, [
    allReturns,
    searchTerm,
    customFrom,
    customTo,
    returnTypeFilter,
    returnSourceMap,
    statusFilter,
    creatorFilter,
    receiverFilter,
  ]);

  const summary = useMemo(
    () => ({
      total: filteredReturns.reduce((s, o) => s + absMoney(o.totalAmount), 0),
      needRefund: filteredReturns.reduce((s, o) => s + absMoney(o.finalAmount), 0),
      refunded: filteredReturns.reduce((s, o) => s + (o.status === 'cancelled' ? 0 : absMoney(o.finalAmount)), 0),
    }),
    [filteredReturns]
  );

  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredReturns.slice((safePage - 1) * pageSize, safePage * pageSize);

  const productLookup = useMemo(
    () => new Map(products.map(product => [product.id, product] as const)),
    [products]
  );

  const hasActiveFilters =
    returnTypeFilter.length > 0 ||
    statusFilter.length > 0 ||
    !!customFrom ||
    !!customTo ||
    !!creatorFilter ||
    !!receiverFilter;

  const handleClearFilters = () => {
    setReturnTypeFilter([]);
    setStatusFilter([]);
    setCustomFrom('');
    setCustomTo('');
    setCreatorFilter('');
    setReceiverFilter('');
    setCurrentPage(1);
  };

  const toggleArr = (arr: string[], val: string, set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  // Orders available to create return from (non-return orders)
  const availableOrders = useMemo(() => {
    const q = orderSearch.toLowerCase();
    return orders
      .filter(
        o =>
          !isReturnInvoice(o) &&
          (!q ||
            o.orderCode.toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q))
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  }, [orders, orderSearch]);

  // Chọn đơn trong panel → điều hướng sang tab Trả hàng trong POS (luồng chuẩn duy nhất,
  // xử lý qua processReturnOrder — thay bản tự chế cũ từng ghi đè doanh thu/tồn kho tại chỗ)
  const handleSelectOrder = (order: AppData['posOrders'][0]) => {
    setShowCreatePanel(false);
    setOrderSearch('');
    onReturnInPOS(order);
  };

  const toggleReturnSelection = (id: string) => {
    setSelectedReturnIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageAllSelected = paginated.length > 0 && paginated.every(order => selectedReturnIds.has(order.id));
  const togglePageSelection = () => {
    setSelectedReturnIds(prev => {
      const next = new Set(prev);
      if (pageAllSelected) paginated.forEach(order => next.delete(order.id));
      else paginated.forEach(order => next.add(order.id));
      return next;
    });
  };

  const toggleStarred = (id: string) => {
    setStarredReturnIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getExportRows = () => {
    const selected = selectedReturnIds.size > 0
      ? filteredReturns.filter(order => selectedReturnIds.has(order.id))
      : filteredReturns;
    return selected;
  };

  const handleExportReturns = () => {
    const rows = getExportRows();
    const csvRows = [
      ['Mã trả hàng', 'Người bán', 'Thời gian', 'Mã KH', 'Khách hàng', 'Tổng tiền hàng', 'Cần trả khách', 'Đã trả khách', 'Trạng thái'].join(','),
      ...rows.map(order =>
        [
          order.orderCode,
          order.staffId || '',
          order.date,
          getCustomerCode(order),
          order.customerName || 'Khách lẻ',
          absMoney(order.totalAmount),
          absMoney(order.finalAmount),
          order.status === 'cancelled' ? 0 : absMoney(order.finalAmount),
          order.status === 'cancelled' ? 'Đã hủy' : 'Đã trả',
        ].join(',')
      ),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tra-hang-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePrintReturn = (order: AppData['posOrders'][number]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const itemsHtml = (order.items || [])
      .map(
        (item, index) =>
          `<tr><td>${index + 1}</td><td>${item.sku || item.productId || ''}</td><td>${item.name}</td><td class="right">${item.quantity}</td><td class="right">${fmt(item.price)}</td><td class="right">${fmt(Math.abs(item.total || item.quantity * item.price - item.discount))}</td></tr>`
      )
      .join('');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Phiếu trả hàng ${order.orderCode}</title><style>body{font-family:Inter,Arial,sans-serif;margin:24px;color:#0f172a}h1{text-align:center;font-size:22px;margin:0 0 8px}.meta{text-align:center;color:#475569;margin-bottom:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:20px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:10px;text-align:left}th{background:#f1f5f9}.right{text-align:right}.totals{margin-top:20px;margin-left:auto;width:280px}.totals div{display:flex;justify-content:space-between;padding:6px 0}.bold{font-weight:700}.actions{text-align:center;margin-top:24px}.actions button{border:1px solid #cbd5e1;border-radius:8px;background:#2563eb;color:white;font-weight:700;padding:9px 16px;cursor:pointer}@media print{.actions{display:none}}</style></head><body><h1>PHIẾU TRẢ HÀNG</h1><div class="meta">${order.orderCode} - ${new Date(order.date).toLocaleString('vi-VN')}</div><div class="grid"><div>Khách hàng: <b>${order.customerName || 'Khách lẻ'}</b></div><div>Mã KH: ${getCustomerCode(order)}</div><div>Người nhận trả: ${order.staffId || '—'}</div><div>Trạng thái: ${order.status === 'cancelled' ? 'Đã hủy' : 'Đã trả'}</div></div><table><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng</th><th class="right">SL</th><th class="right">Giá trả</th><th class="right">Thành tiền</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="totals"><div><span>Tổng tiền hàng trả</span><b>${fmt(absMoney(order.totalAmount))}</b></div><div><span>Cần trả khách</span><b>${fmt(absMoney(order.finalAmount))}</b></div><div><span>Đã trả khách</span><b>${order.status === 'cancelled' ? '0' : fmt(absMoney(order.finalAmount))}</b></div></div><div class="actions"><button id="print-return-button" type="button">In phiếu</button></div><script>function printReturnReceipt(){window.focus();setTimeout(function(){window.print();},50);}document.addEventListener('DOMContentLoaded',function(){var button=document.getElementById('print-return-button');if(button)button.addEventListener('click',printReturnReceipt);});</script></body></html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  // Hủy phiếu trả — toàn bộ phép đảo (tồn kho qua RPC atomic, doanh thu delta, điểm/chi tiêu
  // khách, doanh số NV) nằm trong service chuẩn; component chỉ điều phối và hiển thị lỗi.
  const handleCancelReturn = async (order: AppData['posOrders'][number]) => {
    if (order.status === 'cancelled') {
      alert('Phiếu trả hàng này đã hủy.');
      return;
    }
    if (
      !window.confirm(
        `Hủy phiếu trả hàng ${order.orderCode}? Tồn kho, doanh thu, điểm khách và doanh số nhân viên sẽ được điều chỉnh lại.`
      )
    )
      return;

    try {
      const source = returnSourceMap.get(order.id);
      if (source === 'order') {
        await onCancelReturn(order.id);
      } else {
        await onCancelLegacyReturn(order.id);
      }
      setExpandedReturnId(null);
    } catch (err) {
      console.error('[OrderReturns] handleCancelReturn failed', err);
      alert(err instanceof Error ? err.message : 'Hủy phiếu trả hàng thất bại. Vui lòng thử lại.');
    }
  };

  const handleCopyReturn = async (order: AppData['posOrders'][number]) => {
    const text = [
      `Phiếu trả hàng: ${order.orderCode}`,
      `Khách hàng: ${order.customerName || 'Khách lẻ'}`,
      `Ngày: ${new Date(order.date).toLocaleString('vi-VN')}`,
      `Cần trả khách: ${fmt(absMoney(order.finalAmount))}`,
      `Sản phẩm: ${(order.items || []).map(item => `${item.name} x ${item.quantity}`).join('; ')}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('Đã sao chép thông tin phiếu trả hàng.');
    } catch {
      window.prompt('Sao chép thông tin phiếu trả hàng:', text);
    }
  };

  const handleSaveReturn = async (order: AppData['posOrders'][number]) => {
    try {
      const source = returnSourceMap.get(order.id);
      if (source === 'order') {
        await onUpdateSurgical([{ key: 'posOrders', item: order, isDelete: false }]);
      } else {
        const transaction = transactions.find(t => t.id === order.id);
        if (transaction) {
          await onUpdateSurgical([{ key: 'inventoryTransactions', item: transaction, isDelete: false }]);
        }
      }
      alert('Đã lưu phiếu trả hàng.');
    } catch (err) {
      console.error('[OrderReturns] handleSaveReturn failed', err);
      alert('Lưu phiếu trả hàng thất bại. Vui lòng thử lại.');
    }
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebar = (
    <>
      {/* Loại trả hàng */}
      <FilterSection title="Loại trả hàng">
        {[
          { value: 'invoice', label: 'Theo hóa đơn' },
          { value: 'quick', label: 'Trả nhanh' },
          { value: 'transfer', label: 'Chuyển hoàn' },
        ].map(({ value, label }) => (
          <SidebarCheckbox
            key={value}
            label={label}
            checked={returnTypeFilter.includes(value)}
            onChange={() => { toggleArr(returnTypeFilter, value, setReturnTypeFilter); setCurrentPage(1); }}
          />
        ))}
      </FilterSection>

      {/* Trạng thái */}
      <FilterSection title="Trạng thái">
        {[
          { value: 'returned', label: 'Đã trả' },
          { value: 'cancelled', label: 'Đã hủy' },
        ].map(({ value, label }) => (
          <SidebarCheckbox
            key={value}
            label={label}
            checked={statusFilter.includes(value)}
            onChange={() => { toggleArr(statusFilter, value, setStatusFilter); setCurrentPage(1); }}
          />
        ))}
      </FilterSection>

      {/* Thời gian */}
      <FilterSection title="Thời gian">
        <FilterDateRange
          startDate={customFrom}
          endDate={customTo}
          onStartDateChange={date => {
            setCustomFrom(date);
            setCurrentPage(1);
          }}
          onEndDateChange={date => {
            setCustomTo(date);
            setCurrentPage(1);
          }}
        />
      </FilterSection>

      {/* Người tạo */}
      <FilterSection title="Người tạo">
        <input
          type="text"
          value={creatorFilter}
          onChange={event => {
            setCreatorFilter(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="Chọn người tạo"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 text-slate-600 placeholder:text-slate-400 transition-all"
        />
      </FilterSection>

      {/* Người nhận trả */}
      <FilterSection title="Người nhận trả">
        <input
          type="text"
          value={receiverFilter}
          onChange={event => {
            setReceiverFilter(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="Chọn người nhận trả"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 text-slate-600 placeholder:text-slate-400 transition-all"
        />
      </FilterSection>
    </>
  );

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={v => {
        setSearchTerm(v);
        setCurrentPage(1);
      }}
      searchPlaceholder="Theo mã phiếu trả..."
      rightActions={
        <>
          <button
            onClick={() => {
              setShowCreatePanel(v => !v);
              setOrderSearch('');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-normal hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Trả hàng
          </button>
          <button
            onClick={handleExportReturns}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Xuất file
          </button>
        </>
      }
    />
  );

  // ── Pagination ────────────────────────────────────────────────────────────
  const pagination = (
    <ListPagePagination
      currentPage={safePage}
      totalPages={totalPages}
      pageSize={pageSize}
      totalItems={filteredReturns.length}
      onPageChange={setCurrentPage}
      onPageSizeChange={s => {
        setPageSize(s);
        setCurrentPage(1);
      }}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  );

  return (
    <ListPageLayout
      sidebar={sidebar}
      toolbar={toolbar}
      pagination={filteredReturns.length > 0 ? pagination : undefined}
      sidebarTitle="Trả hàng"
      sidebarDescription="Quản lý đơn trả và hoàn tiền"
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
    >
      {/* ── Split view ─────────────────────────────────────────────────────── */}
      <div className="flex h-full min-h-0">
        {/* Left: Returns list table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
              <tr>
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={pageAllSelected}
                    onChange={togglePageSelection}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="w-8 px-2 py-2.5" />
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã trả hàng
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Người bán
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Thời gian
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã KH
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Khách hàng
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng tiền hàng
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Cần trả khách
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Đã trả khách
                </th>
              </tr>
            </thead>

            {/* Summary row */}
            {filteredReturns.length > 0 && (
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-4 py-2" />
                  <td className="px-2 py-2" />
                  <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-slate-500">
                    {filteredReturns.length} giao dịch
                  </td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {fmt(summary.total)}
                  </td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {fmt(summary.needRefund)}
                  </td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {fmt(summary.refunded)}
                  </td>
                </tr>
              </tbody>
            )}

            {/* Data rows */}
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <RotateCcw className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                    <p className="text-xs font-bold text-slate-400">
                      {filteredReturns.length === 0 && allReturns.length === 0
                        ? 'Chưa có phiếu trả hàng nào'
                        : 'Không tìm thấy phiếu trả hàng'}
                    </p>
                    {allReturns.length === 0 && (
                      <button
                        onClick={() => setShowCreatePanel(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tạo phiếu trả hàng
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map(order => {
                  const isExpanded = expandedReturnId === order.id;
                  const orderItems = order.items || [];
                  const returnCogs = orderItems.reduce((sum, item) => {
                    const product = productLookup.get(item.productId);
                    return sum + (product?.importPrice || 0) * item.quantity;
                  }, 0);
                  const returnProfitImpact = absMoney(order.totalAmount) - returnCogs;
                  const originalOrder = [...orders]
                    .filter(
                      candidate =>
                        !isReturnInvoice(candidate) &&
                        candidate.date <= order.date &&
                        absMoney(candidate.finalAmount) === absMoney(order.finalAmount) &&
                        (!order.customerId || candidate.customerId === order.customerId)
                    )
                    .sort((a, b) => b.date.localeCompare(a.date))[0];

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        onClick={() => setExpandedReturnId(isExpanded ? null : order.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedReturnIds.has(order.id)}
                            onClick={e => e.stopPropagation()}
                            onChange={() => toggleReturnSelection(order.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              toggleStarred(order.id);
                            }}
                            className={`transition-colors ${
                              starredReturnIds.has(order.id)
                                ? 'text-amber-400'
                                : 'text-slate-300 hover:text-yellow-400'
                            }`}
                          >
                            ★
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-90 text-indigo-500' : ''
                              }`}
                            />
                            <span className="font-medium text-xs text-indigo-600">
                              {order.orderCode}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 font-medium">
                          {order.staffId || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 font-medium">
                          {new Date(order.date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-medium">
                          {getCustomerCode(order)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-800 font-medium">
                          {order.customerName || 'Khách lẻ'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-normal text-slate-900 whitespace-nowrap">
                          {fmt(absMoney(order.totalAmount))}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-normal text-slate-700 whitespace-nowrap">
                          {fmt(absMoney(order.finalAmount))}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-normal text-green-700 whitespace-nowrap">
                          {fmt(absMoney(order.finalAmount))}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50 border-b border-indigo-100">
                          <td colSpan={10} className="px-0 py-0">
                            <div className="mx-4 mb-4 border border-indigo-200 bg-white shadow-sm">
                              <div className="border-b border-slate-200 px-5 pt-3">
                                <button className="border-b-2 border-indigo-600 px-0 pb-2 text-sm font-bold text-indigo-600">
                                  Thông tin
                                </button>
                              </div>

                              <div className="px-5 py-4">
                                <div className="mb-5 flex items-start justify-between gap-4">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <h3 className="truncate text-lg font-semibold text-slate-900">
                                      {order.customerName || 'Khách lẻ'}
                                    </h3>
                                    <button
                                      onClick={() => {
                                        if (order.customerName) setSearchTerm(order.customerName);
                                        setExpandedReturnId(null);
                                      }}
                                      className="text-indigo-500 hover:text-indigo-700"
                                      title="Lọc theo khách hàng này"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </button>
                                    <span className="text-sm font-bold text-slate-600">
                                      {order.orderCode}
                                    </span>
                                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                                      Đã trả
                                    </span>
                                  </div>
                                  <span className="shrink-0 text-xs font-medium text-slate-500">
                                    {order.channelName || 'Chi nhánh trung tâm'}
                                  </span>
                                </div>

                                <div className="mb-5 grid grid-cols-4 gap-x-8 gap-y-3 text-xs">
                                  <div>
                                    <p className="text-slate-400">Người tạo</p>
                                    <p className="mt-1 font-bold text-slate-700">
                                      {order.staffId || '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Người nhận trả</p>
                                    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-bold text-slate-700">
                                      {order.staffId || '—'}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Ngày trả</p>
                                    <div className="mt-1 rounded-lg bg-slate-100 px-3 py-1.5 font-bold text-slate-700">
                                      {new Date(order.date).toLocaleString('vi-VN')}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Trạng thái</p>
                                    <p className="mt-1 font-bold text-emerald-700">Đã trả</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Mã hóa đơn</p>
                                    {originalOrder ? (
                                      <button
                                        onClick={() => {
                                          setSearchTerm(originalOrder.orderCode);
                                          setExpandedReturnId(null);
                                        }}
                                        className="mt-1 font-bold text-indigo-600 hover:underline"
                                      >
                                        {originalOrder.orderCode}
                                      </button>
                                    ) : (
                                      <p className="mt-1 font-bold text-slate-500">—</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Kênh bán</p>
                                    <p className="mt-1 font-bold text-slate-700">
                                      {order.channelName || 'Bán trực tiếp'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Bảng giá</p>
                                    <p className="mt-1 font-bold text-slate-700">
                                      {order.priceBookName || 'Bảng giá chung'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Số dòng</p>
                                    <p className="mt-1 font-bold text-slate-700">
                                      {orderItems.length}
                                    </p>
                                  </div>
                                </div>

                              {orderItems.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                  <AlertCircle className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                                  <p className="text-xs font-bold text-slate-400">
                                    Phiếu này chưa có chi tiết hàng hóa
                                  </p>
                                </div>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">
                                        Mã hàng
                                      </th>
                                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">
                                        Tên hàng
                                      </th>
                                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                                        Số lượng
                                      </th>
                                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                                        Giá trả hàng
                                      </th>
                                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                                        Giảm giá
                                      </th>
                                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                                        Giá nhập lại
                                      </th>
                                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                                        Thành tiền
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {orderItems.map((item, idx) => {
                                      const product = productLookup.get(item.productId);
                                      const importPrice = product?.importPrice || 0;
                                      const itemTotal =
                                        item.total || item.quantity * item.price - item.discount;
                                      return (
                                        <tr key={`${item.productId}-${item.sku}-${idx}`}>
                                          <td className="px-4 py-2.5 font-medium text-indigo-600 whitespace-nowrap">
                                            {item.sku || product?.sku || '—'}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-700">
                                            {item.name || product?.name || item.productId}
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-normal text-slate-800 tabular-nums">
                                            {fmt(item.quantity)}
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">
                                            {fmt(item.price)}
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                                            {fmt(item.discount || 0)}
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                                            {fmt(importPrice)}
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums">
                                            {fmt(Math.abs(itemTotal))}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}

                                <div className="grid grid-cols-[minmax(0,1fr)_17rem] gap-8 px-0 py-5">
                                  <textarea
                                    value={order.notes || ''}
                                    readOnly
                                    placeholder="Ghi chú..."
                                    className="h-28 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 outline-none placeholder:text-slate-400"
                                  />
                                  <div className="space-y-3 text-sm">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-500">
                                        Tổng tiền hàng trả ({orderItems.reduce((s, item) => s + item.quantity, 0)})
                                      </span>
                                      <span className="font-medium text-slate-900">
                                        {fmt(absMoney(order.totalAmount))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-500">Giảm giá phiếu trả</span>
                                      <span className="font-medium text-slate-900">
                                        {fmt(absMoney(order.discount))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-500">Phí trả hàng</span>
                                      <span className="font-medium text-slate-900">0</span>
                                    </div>
                                    <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
                                      <span className="font-bold text-slate-700">
                                        Cần trả khách
                                      </span>
                                      <span className="font-medium text-slate-900">
                                        {fmt(absMoney(order.finalAmount))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="font-bold text-slate-700">
                                        Đã trả khách
                                      </span>
                                      <span className="font-medium text-emerald-700">
                                        {fmt(absMoney(order.finalAmount))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-xs">
                                      <span className="text-slate-400">Giá vốn hoàn</span>
                                      <span className="font-medium text-slate-600">
                                        {fmt(returnCogs)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-xs">
                                      <span className="text-slate-400">Giảm lợi nhuận</span>
                                      <span className="font-medium text-rose-600">
                                        {fmt(returnProfitImpact)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCancelReturn(order)}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Hủy
                                  </button>
                                  <button
                                    onClick={() => handleCopyReturn(order)}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                                  >
                                    <Copy className="h-4 w-4" />
                                    Sao chép
                                  </button>
                                  <button
                                    onClick={handleExportReturns}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                                  >
                                    <Download className="h-4 w-4" />
                                    Xuất file
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleSaveReturn(order)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                                  >
                                    <Save className="h-4 w-4" />
                                    Lưu
                                  </button>
                                  <button
                                    onClick={() => handlePrintReturn(order)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Printer className="h-4 w-4" />
                                    In
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Create return panel */}
        <div
          className={`shrink-0 border-l border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${
            showCreatePanel ? 'w-96' : 'w-0'
          }`}
        >
          {showCreatePanel && (
            <>
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
                <p className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">
                  Tạo phiếu trả hàng
                </p>
                <button
                  onClick={() => {
                    setShowCreatePanel(false);
                    setOrderSearch('');
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chọn đơn → mở tab Trả hàng trong POS (chọn sản phẩm/số lượng ở đó) */}
              <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
                <p className="text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Chọn đơn hàng cần trả — sẽ mở ở máy tính tiền
                </p>
                <input
                  type="text"
                  placeholder="Tìm mã đơn hoặc khách hàng..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl mb-3 focus:outline-none focus:border-indigo-400"
                />
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                  {availableOrders.map(order => (
                    <div
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className="p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-all"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-semibold text-indigo-600">
                          {order.orderCode}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {fmt(order.finalAmount)}đ
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {order.customerName || 'Khách lẻ'} •{' '}
                        {new Date(order.date).toLocaleDateString('vi-VN')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(order.items || []).length} sản phẩm •{' '}
                        {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                      </p>
                    </div>
                  ))}
                  {availableOrders.length === 0 && (
                    <div className="text-center py-8">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                      <p className="text-xs text-slate-400">Không tìm thấy đơn hàng</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ListPageLayout>
  );
}
