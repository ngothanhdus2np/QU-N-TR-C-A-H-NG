import React, { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { POSOrder, POSCustomer } from '../../types';

const ReturnInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative group">
    <input
      type="text"
      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 border-b-2 tracking-tight"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const PaginationButton = ({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-all">
    {icon}
  </button>
);

interface POSReturnModalProps {
  orders: POSOrder[];
  customers: POSCustomer[];
  onClose: () => void;
  onReturnFast: () => void;
}

const POSReturnModal: React.FC<POSReturnModalProps> = ({ orders, customers, onClose, onReturnFast }) => {
  const [returnSearch, setReturnSearch] = useState({
    invoiceId: '',
    trackingId: '',
    customer: '',
    productId: '',
    productName: '',
    fromDate: '2026-04-04',
    toDate: ''
  });

  const filteredReturnOrders = useMemo(() => {
    return orders.filter(order => {
      const matchInvoiceId = !returnSearch.invoiceId ||
        order.orderCode.toLowerCase().includes(returnSearch.invoiceId.toLowerCase());

      const matchCustomer = !returnSearch.customer ||
        (order.customerName && order.customerName.toLowerCase().includes(returnSearch.customer.toLowerCase())) ||
        (order.customerId && customers.find(c => c.id === order.customerId)?.phone.includes(returnSearch.customer));

      const matchDate = (!returnSearch.fromDate || new Date(order.date) >= new Date(returnSearch.fromDate)) &&
                        (!returnSearch.toDate || new Date(order.date) <= new Date(returnSearch.toDate));

      return matchInvoiceId && matchCustomer && matchDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, returnSearch, customers]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[160] flex items-center justify-center p-6">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Chọn hóa đơn trả hàng</h3>
          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 rounded-xl hover:text-rose-500 transition-all border border-transparent hover:border-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Filters */}
          <div className="w-[300px] border-r border-slate-100 p-6 space-y-8 overflow-y-auto no-scrollbar shrink-0 bg-slate-50/50">
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tìm kiếm</h4>
              <div className="space-y-2">
                <ReturnInput value={returnSearch.invoiceId} onChange={val => setReturnSearch(prev => ({ ...prev, invoiceId: val }))} placeholder="Theo mã hóa đơn" />
                <ReturnInput value={returnSearch.trackingId} onChange={val => setReturnSearch(prev => ({ ...prev, trackingId: val }))} placeholder="Theo mã vận đơn bán" />
                <ReturnInput value={returnSearch.customer} onChange={val => setReturnSearch(prev => ({ ...prev, customer: val }))} placeholder="Theo khách hàng hoặc ĐT" />
                <ReturnInput value={returnSearch.productId} onChange={val => setReturnSearch(prev => ({ ...prev, productId: val }))} placeholder="Theo mã hàng" />
                <ReturnInput value={returnSearch.productName} onChange={val => setReturnSearch(prev => ({ ...prev, productName: val }))} placeholder="Theo tên hàng" />
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Thời gian</h4>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                    value={returnSearch.fromDate}
                    onChange={e => setReturnSearch(prev => ({ ...prev, fromDate: e.target.value }))}
                  />
                </div>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                    placeholder="Đến ngày"
                    value={returnSearch.toDate}
                    onChange={e => setReturnSearch(prev => ({ ...prev, toDate: e.target.value }))}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Main content - Results table */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-indigo-500 text-white z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold">Mã hóa đơn</th>
                    <th className="px-6 py-4 font-bold flex items-center gap-1">Thời gian <ChevronDown className="h-3 w-3" /></th>
                    <th className="px-6 py-4 font-bold">Nhân viên</th>
                    <th className="px-6 py-4 font-bold">Khách hàng</th>
                    <th className="px-6 py-4 font-bold text-right">Tổng cộng</th>
                    <th className="px-6 py-4 font-bold text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 italic">
                  {filteredReturnOrders.map((inv) => (
                    <tr key={inv.id} className="hover:bg-indigo-50/50 group transition-all">
                      <td className="px-6 py-4 font-black text-indigo-600 cursor-pointer hover:underline">{inv.orderCode}</td>
                      <td className="px-6 py-4 font-bold text-slate-600">{new Date(inv.date).toLocaleString('vi-VN')}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{inv.staffId}</td>
                      <td className="px-6 py-4 font-bold text-slate-600">{inv.customerName || 'Khách lẻ'}</td>
                      <td className="px-6 py-4 font-black text-slate-900 text-right">{inv.finalAmount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          className="px-4 py-1.5 border border-slate-200 rounded-lg text-[11px] font-black uppercase text-slate-600 hover:bg-slate-950 hover:text-white transition-all shadow-sm"
                          onClick={onClose}
                        >
                          Chọn
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredReturnOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest">
                        Không tìm thấy hóa đơn phù hợp
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-8 py-6 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <PaginationButton icon={<Undo2 className="h-4 w-4 rotate-180" />} />
                <PaginationButton icon={<ChevronRight className="h-4 w-4 rotate-180" />} />
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">1</button>
                  <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">2</button>
                  <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">3</button>
                  <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">4</button>
                  <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">5</button>
                  <span className="text-slate-300 mx-1">...</span>
                </div>
                <PaginationButton icon={<ChevronRight className="h-4 w-4" />} />
                <PaginationButton icon={<Undo2 className="h-4 w-4" />} />
              </div>
              <div className="text-[11px] font-bold text-slate-400">Hiển thị {filteredReturnOrders.length} hóa đơn</div>
            </div>
          </div>
        </div>

        {/* Footer action */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all"
            onClick={onReturnFast}
          >
            Trả nhanh
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSReturnModal;
