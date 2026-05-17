import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Check,
  X,
  AlertCircle,
  ChevronRight,
  Calendar,
  Download,
  Plus,
} from 'lucide-react';
import { AppData } from '../../types';
import {
  ListPageLayout,
  ListPageToolbar,
  ListPagePagination,
  FilterSection,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';

interface OrderReturnsProps {
  orders: AppData['posOrders'];
  products: AppData['posProducts'];
  customers: AppData['posCustomers'];
  onUpdateSurgical: (updates: any[]) => Promise<void>;
}

interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  originalPrice: number;
  refundAmount: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Momo: 'Momo',
  Other: 'Khác',
};

function fmt(n: number) {
  return n.toLocaleString('vi-VN');
}

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

// Inline radio cho sidebar
function SidebarRadio({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0"
      />
      <span className="text-sm text-slate-600 flex-1">{label}</span>
      {icon && <span className="text-slate-400">{icon}</span>}
    </label>
  );
}

export default function OrderReturns({
  orders,
  products,
  customers,
  onUpdateSurgical,
}: OrderReturnsProps) {
  // Sidebar filter state
  const [returnTypeFilter, setReturnTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<'month' | 'custom'>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Pagination + search
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Create return form (split-view right panel)
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AppData['posOrders'][0] | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Derived dates
  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  // Returns list: orders with isReturn === true
  const allReturns = useMemo(
    () => orders.filter(o => o.isReturn === true).sort((a, b) => b.date.localeCompare(a.date)),
    [orders]
  );

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

      if (dateMode === 'month') {
        if (o.date < thisMonthStart || o.date > todayStr) return false;
      } else {
        if (customFrom && o.date < customFrom) return false;
        if (customTo && o.date > customTo) return false;
      }

      return true;
    });
  }, [allReturns, searchTerm, dateMode, thisMonthStart, todayStr, customFrom, customTo]);

  const summary = useMemo(
    () => ({
      total: filteredReturns.reduce((s, o) => s + (o.totalAmount || 0), 0),
      needRefund: filteredReturns.reduce((s, o) => s + (o.finalAmount || 0), 0),
      refunded: filteredReturns.reduce((s, o) => s + (o.finalAmount || 0), 0),
    }),
    [filteredReturns]
  );

  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredReturns.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasActiveFilters =
    returnTypeFilter.length > 0 ||
    statusFilter.length > 0 ||
    dateMode === 'custom' ||
    !!customFrom ||
    !!customTo;

  const handleClearFilters = () => {
    setReturnTypeFilter([]);
    setStatusFilter([]);
    setDateMode('month');
    setCustomFrom('');
    setCustomTo('');
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
          !o.isReturn &&
          (!q ||
            o.orderCode.toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q))
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  }, [orders, orderSearch]);

  const handleSelectOrder = (order: AppData['posOrders'][0]) => {
    setSelectedOrder(order);
    setReturnItems(
      order.items.map(item => ({
        productId: item.productId,
        productName: item.name,
        quantity: 0,
        originalPrice: item.price,
        refundAmount: 0,
      }))
    );
    setReturnReason('');
  };

  const handleUpdateQty = (idx: number, raw: string) => {
    const max = selectedOrder?.items[idx]?.quantity || 0;
    const qty = Math.min(Math.max(0, Number(raw) || 0), max);
    setReturnItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: qty, refundAmount: qty * next[idx].originalPrice };
      return next;
    });
  };

  const totalRefund = useMemo(
    () => returnItems.reduce((s, i) => s + i.refundAmount, 0),
    [returnItems]
  );

  const handleProcessReturn = async () => {
    if (!selectedOrder) return;
    const itemsToReturn = returnItems.filter(i => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      alert('Vui lòng chọn ít nhất 1 sản phẩm để trả hàng');
      return;
    }
    if (!returnReason.trim()) {
      alert('Vui lòng nhập lý do trả hàng');
      return;
    }
    setIsProcessing(true);
    try {
      const updates: any[] = [];

      for (const ri of itemsToReturn) {
        const product = products.find(p => p.id === ri.productId);
        if (product)
          updates.push({
            key: 'posProducts',
            item: { ...product, stock: (product.stock || 0) + ri.quantity },
            isDelete: false,
          });
      }

      updates.push({
        key: 'inventoryTransactions',
        item: {
          id: crypto.randomUUID(),
          date: todayStr,
          type: 'return' as const,
          items: itemsToReturn.map(i => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            price: i.originalPrice,
          })),
          note: `Trả hàng từ đơn ${selectedOrder.orderCode}. Lý do: ${returnReason}`,
          referenceId: selectedOrder.id,
          staffId: selectedOrder.staffId,
          totalAmount: totalRefund,
          status: 'completed',
        },
        isDelete: false,
      });

      if (selectedOrder.customerId && selectedOrder.pointsEarned) {
        const customer = customers.find(c => c.id === selectedOrder.customerId);
        if (customer) {
          const pts = Math.floor(
            (totalRefund / (selectedOrder.finalAmount || 1)) * (selectedOrder.pointsEarned || 0)
          );
          updates.push({
            key: 'posCustomers',
            item: {
              ...customer,
              points: Math.max(0, (customer.points || 0) - pts),
              totalSpent: Math.max(0, (customer.totalSpent || 0) - totalRefund),
            },
            isDelete: false,
          });
        }
      }

      await onUpdateSurgical(updates);
      alert(`Đã xử lý trả hàng thành công!\nSố tiền hoàn: ${fmt(totalRefund)}đ`);
      setShowCreatePanel(false);
      setSelectedOrder(null);
      setReturnItems([]);
      setReturnReason('');
      setOrderSearch('');
    } catch {
      alert('Có lỗi xảy ra khi xử lý trả hàng. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
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
            onChange={() => toggleArr(returnTypeFilter, value, setReturnTypeFilter)}
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
            onChange={() => toggleArr(statusFilter, value, setStatusFilter)}
          />
        ))}
      </FilterSection>

      {/* Thời gian */}
      <FilterSection title="Thời gian">
        <SidebarRadio
          label="Tháng này"
          checked={dateMode === 'month'}
          onChange={() => {
            setDateMode('month');
            setCurrentPage(1);
          }}
          icon={<ChevronRight className="w-3.5 h-3.5" />}
        />
        <SidebarRadio
          label="Tùy chỉnh"
          checked={dateMode === 'custom'}
          onChange={() => {
            setDateMode('custom');
            setCurrentPage(1);
          }}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        {dateMode === 'custom' && (
          <div className="mt-2 space-y-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => {
                setCustomFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all"
            />
            <input
              type="date"
              value={customTo}
              onChange={e => {
                setCustomTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all"
            />
          </div>
        )}
      </FilterSection>

      {/* Người tạo */}
      <FilterSection title="Người tạo">
        <input
          type="text"
          placeholder="Chọn người tạo"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 text-slate-600 placeholder:text-slate-400 transition-all"
        />
      </FilterSection>

      {/* Người nhận trả */}
      <FilterSection title="Người nhận trả">
        <input
          type="text"
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
              setSelectedOrder(null);
              setReturnItems([]);
              setReturnReason('');
              setOrderSearch('');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-normal hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Trả hàng
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors">
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
      sidebarTitle="Bộ lọc"
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
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="w-8 px-2 py-2.5" />
                <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã trả hàng
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Người bán
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Thời gian
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Mã KH
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide">
                  Khách hàng
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Tổng tiền hàng
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Cần trả khách
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
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
                  <td colSpan={5} className="px-4 py-2 text-[11px] font-black text-slate-500">
                    {filteredReturns.length} giao dịch
                  </td>
                  <td className="px-4 py-2 text-right text-[11px] font-black text-slate-800 whitespace-nowrap">
                    {fmt(summary.total)}
                  </td>
                  <td className="px-4 py-2 text-right text-[11px] font-black text-slate-800 whitespace-nowrap">
                    {fmt(summary.needRefund)}
                  </td>
                  <td className="px-4 py-2 text-right text-[11px] font-black text-slate-800 whitespace-nowrap">
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
                paginated.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <button className="text-slate-300 hover:text-yellow-400 transition-colors">
                        ★
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-xs text-indigo-600">{order.orderCode}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 font-medium">
                      {order.staffId || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 font-medium">
                      {new Date(order.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {order.customerId ? order.customerId.slice(0, 8).toUpperCase() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-800 font-medium">
                      {order.customerName || 'Khách lẻ'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                      {fmt(order.totalAmount || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 whitespace-nowrap">
                      {fmt(order.finalAmount || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-green-700 whitespace-nowrap">
                      {fmt(order.finalAmount || 0)}
                    </td>
                  </tr>
                ))
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
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                    Tạo phiếu trả hàng
                  </p>
                  {selectedOrder && (
                    <p className="text-sm font-black text-indigo-600 mt-0.5">
                      {selectedOrder.orderCode}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowCreatePanel(false);
                    setSelectedOrder(null);
                    setReturnItems([]);
                    setReturnReason('');
                    setOrderSearch('');
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!selectedOrder ? (
                /* Step 1: Select order */
                <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
                    Chọn đơn hàng cần trả
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
                          <span className="text-xs font-black text-indigo-600">
                            {order.orderCode}
                          </span>
                          <span className="text-[11px] font-bold text-slate-800">
                            {fmt(order.finalAmount)}đ
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {order.customerName || 'Khách lẻ'} •{' '}
                          {new Date(order.date).toLocaleDateString('vi-VN')}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {order.items.length} sản phẩm •{' '}
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
              ) : (
                /* Step 2: Choose items & confirm */
                <>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
                    {/* Order info */}
                    <div className="bg-indigo-50 rounded-xl p-3 mb-3">
                      <p className="text-xs font-bold text-indigo-700">
                        {selectedOrder.customerName || 'Khách lẻ'}
                      </p>
                      <p className="text-[11px] text-indigo-500 mt-0.5">
                        {new Date(selectedOrder.date).toLocaleDateString('vi-VN')} •{' '}
                        {fmt(selectedOrder.finalAmount)}đ
                      </p>
                      <button
                        onClick={() => {
                          setSelectedOrder(null);
                          setReturnItems([]);
                        }}
                        className="text-[10px] text-indigo-600 font-bold mt-1 hover:underline"
                      >
                        Đổi đơn hàng
                      </button>
                    </div>

                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
                      Sản phẩm trả
                    </p>
                    {returnItems.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-xs font-bold text-slate-800 truncate mb-1">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-slate-400 mb-2">
                          {fmt(item.originalPrice)}đ • Đã mua:{' '}
                          {selectedOrder.items[idx]?.quantity || 0}
                        </p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-500 mb-1">SL trả</p>
                            <input
                              type="number"
                              min={0}
                              max={selectedOrder.items[idx]?.quantity || 0}
                              value={item.quantity}
                              onChange={e => handleUpdateQty(idx, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-500 mb-1">Hoàn tiền</p>
                            <div className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-bold">
                              {fmt(item.refundAmount)}đ
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Reason */}
                    <div className="pt-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
                        Lý do trả <span className="text-red-400">*</span>
                      </p>
                      <textarea
                        value={returnReason}
                        onChange={e => setReturnReason(e.target.value)}
                        placeholder="Lỗi sản phẩm, không vừa ý..."
                        rows={3}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 resize-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Total + Actions */}
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Cần trả khách</span>
                      <span className="text-base font-black text-indigo-600">
                        {fmt(totalRefund)}đ
                      </span>
                    </div>
                    <button
                      onClick={handleProcessReturn}
                      disabled={isProcessing || totalRefund === 0 || !returnReason.trim()}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        'Đang xử lý...'
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Xác nhận trả hàng
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </ListPageLayout>
  );
}
