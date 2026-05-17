import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Printer, Undo2, X } from 'lucide-react';
import { POSCustomer, POSOrder } from '../../types';

interface SelectInvoiceModalProps {
  orders: POSOrder[];
  customers: POSCustomer[];
  onClose: () => void;
}

const todayStr = () => new Date().toLocaleDateString('en-CA');

function printOrder(order: POSOrder) {
  const html = `
    <html>
      <head>
        <title>In Hóa Đơn - ${order.orderCode}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 12px; }
          .receipt { width: 80mm; padding: 5mm; box-sizing: border-box; }
          .center { text-align: center; }
          .dashed { border-bottom: 2px dashed #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .bold { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th { border-bottom: 1px solid #000; text-align: left; padding: 4px 0; font-size: 10px; color: #666; }
          td { padding: 6px 0; vertical-align: top; }
          .grand { font-size: 16px; font-weight: 900; margin-top: 8px; border-top: 1px solid #000; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <h1 style="font-size:18px;margin:0;font-weight:900;">CFO BRAIN PROFESSIONAL</h1>
            <p style="font-size:10px;margin:4px 0;">123 Đường Công Nghệ, Quận 1, TP. HCM</p>
            <p style="font-size:10px;margin:0;">Hotline: 1900 1234</p>
          </div>
          <div class="dashed"></div>
          <div style="font-size:11px;">
            <div class="row"><span>Số HD:</span><span class="bold">${order.orderCode}</span></div>
            <div class="row"><span>Ngày:</span><span>${new Date(order.date).toLocaleString('vi-VN')}</span></div>
            <div class="row"><span>Khách:</span><span class="bold">${order.customerName || 'KHÁCH VÃNG LAI'}</span></div>
            <div class="row"><span>Thu ngân:</span><span>${order.staffId}</span></div>
          </div>
          <table>
            <thead><tr>
              <th>MẶT HÀNG</th>
              <th style="text-align:center;width:40px;">SL</th>
              <th style="text-align:right;width:80px;">T.TIỀN</th>
            </tr></thead>
            <tbody>
              ${order.items
                .map(
                  i => `<tr>
                <td><div class="bold">${i.name}</div><div style="font-size:10px;color:#666;">${i.price.toLocaleString()}đ</div></td>
                <td style="text-align:center;">${i.quantity}</td>
                <td style="text-align:right;" class="bold">${i.total.toLocaleString()}đ</td>
              </tr>`
                )
                .join('')}
            </tbody>
          </table>
          <div class="dashed"></div>
          <div>
            <div class="row"><span>Tiền hàng:</span><span class="bold">${order.totalAmount.toLocaleString()}đ</span></div>
            ${order.discount > 0 ? `<div class="row"><span>Chiết khấu:</span><span class="bold">-${order.discount.toLocaleString()}đ</span></div>` : ''}
            <div class="row grand"><span>TỔNG CỘNG:</span><span class="bold">${order.finalAmount.toLocaleString()}đ</span></div>
            <div class="row" style="margin-top:10px;"><span>Thanh toán:</span><span class="bold">${order.paymentMethod}</span></div>
          </div>
          <div class="center" style="margin-top:16px;">
            <p style="font-size:10px;font-weight:bold;margin:0;">NHẬN TRỌN NIỀM TIN - TRAO TRỌN CHẤT LƯỢNG</p>
            <p style="font-size:9px;margin:4px 0;">Cảm ơn quý khách và hẹn gặp lại!</p>
            <div style="font-size:8px;color:#999;margin-top:8px;">In lại lúc: ${new Date().toLocaleString('vi-VN')}</div>
          </div>
        </div>
        <script>window.onload=function(){window.print();setTimeout(()=>window.close(),100);}</script>
      </body>
    </html>`;
  const w = window.open('', '_blank', 'width=450,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[160] flex items-center justify-center p-6">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">
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
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
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
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                Thời gian
              </h4>
              <div className="space-y-2">
                <input
                  type="date"
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-normal text-slate-700 outline-none focus:border-indigo-500 transition-all"
                  value={search.fromDate}
                  onChange={e => setField('fromDate', e.target.value)}
                />
                <input
                  type="date"
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-normal text-slate-700 outline-none focus:border-indigo-500 transition-all"
                  value={search.toDate}
                  onChange={e => setField('toDate', e.target.value)}
                />
              </div>
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
                      <td className="px-6 py-4 font-mono font-normal text-indigo-600">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] font-normal uppercase text-slate-600 hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all shadow-sm"
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
              <div className="text-[11px] font-normal text-slate-400">
                Hiển thị {filtered.length} hóa đơn
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
