import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Printer, Undo2, X } from 'lucide-react';
import { POSCustomer, POSOrder } from '../../types';
import { FilterDateRange } from '../shared';
import { openPrintInvoice } from './printInvoiceFromTemplate';

interface SelectInvoiceModalProps {
  orders: POSOrder[];
  customers: POSCustomer[];
  onClose: () => void;
}

const todayStr = () => new Date().toLocaleDateString('en-CA');

function printOrder(order: POSOrder) {
  openPrintInvoice({ order });
}

const ReturnInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) => (
  <input
    type="text"
    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-normal text-slate-800 outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 tracking-tight"
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
  />
);

const PaginationButton = ({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-all"
  >
    {icon}
  </button>
);

const PAGE_SIZE = 20;

export default function SelectInvoiceModal({
  orders,
  customers,
  onClose,
}: SelectInvoiceModalProps) {
  const today = todayStr();
  const [search, setSearch] = useState({
    invoiceId: '',
    customer: '',
    productId: '',
    productName: '',
    fromDate: today,
    toDate: '',
  });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return orders
      .filter(o => {
        if (o.isReturn) return false;
        if (search.invoiceId && !o.orderCode.toLowerCase().includes(search.invoiceId.toLowerCase()))
          return false;
        if (
          search.customer &&
          !(o.customerName || '').toLowerCase().includes(search.customer.toLowerCase()) &&
          !customers.find(c => c.id === o.customerId)?.phone.includes(search.customer)
        )
          return false;
        if (
          search.productId &&
          !o.items.some(i => i.sku.toLowerCase().includes(search.productId.toLowerCase()))
        )
          return false;
        if (
          search.productName &&
          !o.items.some(i => i.name.toLowerCase().includes(search.productName.toLowerCase()))
        )
          return false;
        if (search.fromDate && o.date.slice(0, 10) < search.fromDate) return false;
        if (search.toDate && o.date.slice(0, 10) > search.toDate) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setField = (key: keyof typeof search, val: string) => {
    setSearch(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-modal flex items-center justify-center p-6">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="font-semibold text-xl text-slate-900 uppercase tracking-tight">
            Chọn hóa đơn
          </h3>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 rounded-xl hover:text-rose-500 transition-all border border-transparent hover:border-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-[300px] border-r border-slate-100 p-6 space-y-8 overflow-y-auto no-scrollbar shrink-0 bg-slate-50/50">
            <section className="space-y-4">
              <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-widest px-2">
                Tìm kiếm
              </h4>
              <div className="space-y-2">
                <ReturnInput
                  value={search.invoiceId}
                  onChange={v => setField('invoiceId', v)}
                  placeholder="Theo mã hóa đơn"
                />
                <ReturnInput
                  value={search.customer}
                  onChange={v => setField('customer', v)}
                  placeholder="Theo khách hàng hoặc ĐT"
                />
                <ReturnInput
                  value={search.productId}
                  onChange={v => setField('productId', v)}
                  placeholder="Theo mã hàng"
                />
                <ReturnInput
                  value={search.productName}
                  onChange={v => setField('productName', v)}
                  placeholder="Theo tên hàng"
                />
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-widest px-2">
                Thời gian
              </h4>
              <FilterDateRange
                startDate={search.fromDate}
                endDate={search.toDate}
                onStartDateChange={date => setField('fromDate', date)}
                onEndDateChange={date => setField('toDate', date)}
              />
            </section>
          </div>

          {/* Table */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-indigo-500 text-white z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold">Mã hóa đơn</th>
                    <th className="px-6 py-4 font-bold flex items-center gap-1">
                      Thời gian <ChevronDown className="h-3 w-3" />
                    </th>
                    <th className="px-6 py-4 font-bold">Nhân viên</th>
                    <th className="px-6 py-4 font-bold">Khách hàng</th>
                    <th className="px-6 py-4 font-bold text-right">Tổng cộng</th>
                    <th className="px-6 py-4 font-bold text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 italic">
                  {paginated.map(inv => (
                    <tr key={inv.id} className="hover:bg-indigo-50/50 group transition-all">
                      <td className="px-6 py-4 font-normal text-indigo-600">
                        {inv.orderCode}
                      </td>
                      <td className="px-6 py-4 font-normal text-slate-600">
                        {new Date(inv.date).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 font-normal text-slate-700">{inv.staffId}</td>
                      <td className="px-6 py-4 font-normal text-slate-600">
                        {inv.customerName || 'Khách lẻ'}
                      </td>
                      <td className="px-6 py-4 font-normal text-slate-900 text-right">
                        {inv.finalAmount.toLocaleString()}đ
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-normal uppercase text-slate-600 hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all shadow-sm"
                          onClick={() => printOrder(inv)}
                        >
                          <Printer className="h-3 w-3" />
                          In hóa đơn
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-20 text-center text-slate-300 font-normal uppercase tracking-widest"
                      >
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
                <PaginationButton
                  icon={<Undo2 className="h-4 w-4 rotate-180" />}
                  onClick={() => setPage(1)}
                />
                <PaginationButton
                  icon={<ChevronRight className="h-4 w-4 rotate-180" />}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                />
                <div className="flex items-center gap-1">
                  {(() => {
                    const windowSize = Math.min(5, totalPages);
                    const startPage = Math.max(
                      1,
                      Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1)
                    );
                    return Array.from({ length: windowSize }, (_, i) => {
                      const p = startPage + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg font-normal text-xs flex items-center justify-center transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          {p}
                        </button>
                      );
                    });
                  })()}
                  {totalPages > 5 && page < totalPages - 2 && (
                    <span className="text-slate-300 mx-1">...</span>
                  )}
                </div>
                <PaginationButton
                  icon={<ChevronRight className="h-4 w-4" />}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                />
                <PaginationButton
                  icon={<Undo2 className="h-4 w-4" />}
                  onClick={() => setPage(totalPages)}
                />
              </div>
              <div className="text-xs font-normal text-slate-400">
                Hiển thị {filtered.length} hóa đơn
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
