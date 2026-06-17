import React, { useState, useMemo, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { POSOrder, POSCustomer } from '../../types';

const ReturnInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative">
    <input
      type="text"
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-400"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const PaginationButton = ({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-all">
    {icon}
  </button>
);

interface POSReturnModalProps {
  orders: POSOrder[];
  customers: POSCustomer[];
  onClose: () => void;
  onReturnFast: () => void;
  onSelectOrder: (order: POSOrder) => void;
}

const PAGE_SIZE = 20;

const POSReturnModal: React.FC<POSReturnModalProps> = ({ orders, customers, onClose, onReturnFast, onSelectOrder }) => {
  const [returnSearch, setReturnSearch] = useState({
    invoiceId: '',
    customer: '',
    productId: '',
    productName: '',
    fromDate: '',
    toDate: ''
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [orders, returnSearch, customers]);

  const filteredReturnOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.isReturn) return false;

      const matchInvoiceId = !returnSearch.invoiceId ||
        order.orderCode.toLowerCase().includes(returnSearch.invoiceId.toLowerCase());

      const matchCustomer = !returnSearch.customer ||
        (order.customerName && order.customerName.toLowerCase().includes(returnSearch.customer.toLowerCase())) ||
        (order.customerId && customers.find(c => c.id === order.customerId)?.phone.includes(returnSearch.customer));

      // [FIX m5] So sánh theo local date string — tránh miss đơn do lệch timezone UTC vs VN (+7)
      const orderLocalDate = new Date(order.date).toLocaleDateString('en-CA');
      const matchDate = (!returnSearch.fromDate || orderLocalDate >= returnSearch.fromDate) &&
                        (!returnSearch.toDate || orderLocalDate <= returnSearch.toDate);

      const matchProduct = (!returnSearch.productId && !returnSearch.productName) ||
        order.items.some(item =>
          (!returnSearch.productId || (item.sku || item.productId || '').toLowerCase().includes(returnSearch.productId.toLowerCase())) &&
          (!returnSearch.productName || item.name.toLowerCase().includes(returnSearch.productName.toLowerCase()))
        );

      return matchInvoiceId && matchCustomer && matchDate && matchProduct;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, returnSearch, customers]);

  const totalPages = Math.max(1, Math.ceil(filteredReturnOrders.length / PAGE_SIZE));
  const pagedOrders = filteredReturnOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-modal flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-base text-slate-900 uppercase tracking-tight">Chọn hóa đơn trả hàng</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — 2 cards trên nền slate-50 */}
        <div className="flex-1 flex min-h-0 gap-3 p-3 bg-slate-50 overflow-hidden">

          {/* Card trái — Bộ lọc */}
          <div className="w-64 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 h-11 border-b border-slate-100 shrink-0 flex items-center">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-widest">Bộ lọc</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              <section className="space-y-2">
                <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest px-0.5">Tìm kiếm</p>
                <ReturnInput value={returnSearch.invoiceId} onChange={val => setReturnSearch(prev => ({ ...prev, invoiceId: val }))} placeholder="Theo mã hóa đơn" />
                <ReturnInput value={returnSearch.customer} onChange={val => setReturnSearch(prev => ({ ...prev, customer: val }))} placeholder="Theo khách hàng hoặc ĐT" />
                <ReturnInput value={returnSearch.productId} onChange={val => setReturnSearch(prev => ({ ...prev, productId: val }))} placeholder="Theo mã hàng" />
                <ReturnInput value={returnSearch.productName} onChange={val => setReturnSearch(prev => ({ ...prev, productName: val }))} placeholder="Theo tên hàng" />
              </section>

              <section className="space-y-2">
                <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest px-0.5">Thời gian</p>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                    value={returnSearch.fromDate}
                    onChange={e => setReturnSearch(prev => ({ ...prev, fromDate: e.target.value }))}
                  />
                </div>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                    placeholder="Đến ngày"
                    value={returnSearch.toDate}
                    onChange={e => setReturnSearch(prev => ({ ...prev, toDate: e.target.value }))}
                  />
                </div>
              </section>

            </div>
          </div>

          {/* Card phải — Danh sách hóa đơn */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-600">Mã hóa đơn</th>
                    <th className="px-4 py-3 font-bold text-slate-600 flex items-center gap-1">
                      Thời gian <ChevronDown className="h-3 w-3" />
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-600">Nhân viên</th>
                    <th className="px-4 py-3 font-bold text-slate-600">Khách hàng</th>
                    <th className="px-4 py-3 font-bold text-slate-600 text-right">Tổng cộng</th>
                    <th className="px-4 py-3 font-bold text-slate-600 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedOrders.map((inv) => (
                    <tr key={inv.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-4 py-3 font-normal text-indigo-600 cursor-pointer hover:underline">{inv.orderCode}</td>
                      <td className="px-4 py-3 font-normal text-slate-500">{new Date(inv.date).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 font-normal text-slate-600">{inv.staffName || inv.staffId}</td>
                      <td className="px-4 py-3 font-normal text-slate-600">{inv.customerName || 'Khách lẻ'}</td>
                      <td className="px-4 py-3 font-normal text-slate-800 text-right">{inv.finalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                          onClick={() => onSelectOrder(inv)}
                        >
                          Chọn
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredReturnOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-xs italic">
                        Không tìm thấy hóa đơn phù hợp
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination + action */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <PaginationButton icon={<Undo2 className="h-3.5 w-3.5 rotate-180" />} onClick={() => setPage(1)} />
                <PaginationButton icon={<ChevronRight className="h-3.5 w-3.5 rotate-180" />} onClick={() => setPage(p => Math.max(1, p - 1))} />
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button key={n} onClick={() => setPage(n)} className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-colors ${n === page ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{n}</button>
                    );
                  })}
                </div>
                <PaginationButton icon={<ChevronRight className="h-3.5 w-3.5" />} onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
                <PaginationButton icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setPage(totalPages)} />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{filteredReturnOrders.length} hóa đơn</span>
                <button
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200"
                  onClick={onReturnFast}
                >
                  Trả nhanh
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default POSReturnModal;
