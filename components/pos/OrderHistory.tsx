
import React, { useState } from 'react';
import { FileText, Search, Printer, BarChart2, X, ShoppingBag, FileDown } from 'lucide-react';
import { POSOrder } from '../../types';
import EndOfDayReport from './EndOfDayReport';
import { exportToExcel } from '../../services/exportService';

interface OrderHistoryProps {
  orders: POSOrder[];
  storeName?: string;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ orders, storeName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);
  const [showEODReport, setShowEODReport] = useState(false);

  const filteredOrders = orders.filter(o => 
    (o.orderCode?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (o.customerName && o.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePrint = (order: POSOrder) => {
    const printSection = document.getElementById('print-section');
    if (!printSection) return;

    printSection.innerHTML = `
      <div style="font-family: monospace; width: 80mm; padding: 5mm; background: white;">
        <center>
          <h2 style="margin-bottom: 2mm;">CFO BRAIN STORE</h2>
          <p style="font-size: 10px;">Đ/C: 123 Đường Tài Chính, TP. HCM</p>
          <p style="font-size: 10px;">SĐT: 0333.xxx.xxx</p>
          <hr/>
          <h3 style="margin: 3mm 0;">HÓA ĐƠN BÁN LẺ</h3>
          <p style="font-size: 10px;">Mã đơn: ${order.orderCode}</p>
          <p style="font-size: 10px;">Ngày: ${new Date(order.date).toLocaleString('vi-VN')}</p>
        </center>
        <table style="width: 100%; font-size: 10px; border-collapse: collapse; margin-top: 3mm;">
          <tr style="border-bottom: 1px dashed #000;">
            <th align="left">SP</th>
            <th align="center">SL</th>
            <th align="right">Giá</th>
          </tr>
          ${order.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td align="center">${item.quantity}</td>
              <td align="right">${item.total.toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
        <hr style="border-top: 1px dashed #000;"/>
        <div style="font-size: 10px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Tạm tính:</span> <span>${order.totalAmount.toLocaleString()}đ</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Giảm giá:</span> <span>-${order.discount.toLocaleString()}đ</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 2mm;">
            <span>TỔNG CỘNG:</span> <span>${order.finalAmount.toLocaleString()}đ</span>
          </div>
        </div>
        <hr/>
        <center>
          <p style="font-size: 10px; margin-top: 5mm;">Cảm ơn Quý khách!<br/>Hẹn gặp lại!</p>
        </center>
      </div>
    `;
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 gap-6">
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm mã đơn, khách hàng... (F4)" 
              className="w-full md:w-80 pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-400 focus:shadow-lg focus:shadow-indigo-500/5 transition-all shadow-inner placeholder:text-slate-400" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => exportToExcel(
              filteredOrders.map(o => ({
                'Mã hóa đơn': o.orderCode,
                'Ngày giờ': new Date(o.date).toLocaleString('vi-VN'),
                'Khách hàng': o.customerName || 'Khách vãng lai',
                'Tiền hàng': o.totalAmount,
                'Giảm giá': o.discount,
                'Thực thu': o.finalAmount,
                'Phương thức': o.paymentMethod,
                'Loại': o.isReturn ? 'Trả hàng' : 'Bán hàng',
              })),
              'DonHang'
            )}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 text-emerald-600 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest shadow-sm"
          >
            <FileDown className="h-4 w-4" /> Xuất Excel
          </button>
          <button
            onClick={() => setShowEODReport(true)}
            className="flex items-center justify-center gap-3 px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest flex-1 md:flex-none shadow-sm shadow-indigo-500/20 group"
          >
            <BarChart2 className="h-4 w-4" />
            Báo cáo cuối ngày
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-8 py-6 text-left font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Mã hóa đơn</th>
                <th className="px-8 py-6 text-left font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Thời gian giao dịch</th>
                <th className="px-8 py-6 text-left font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Khách hàng</th>
                <th className="px-8 py-6 text-right font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Tổng thanh toán</th>
                <th className="px-8 py-6 text-center font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Hình thức</th>
                <th className="px-8 py-6 text-center font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center text-slate-300 italic">
                    <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <FileText className="h-10 w-10 opacity-20" />
                    </div>
                    <p className="font-black uppercase text-xs tracking-widest leading-loose">Không tìm thấy dữ liệu hóa đơn<br/><span className="text-[10px] opacity-60">Thử thay đổi từ khóa tìm kiếm của bạn</span></p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/80 group cursor-pointer transition-all" onClick={() => setSelectedOrder(order)}>
                    <td className="px-8 py-6 font-mono font-black text-indigo-600 text-sm">
                      <span className="bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">{order.orderCode}</span>
                    </td>
                    <td className="px-8 py-6 text-slate-500 font-bold whitespace-nowrap">{new Date(order.date).toLocaleString('vi-VN')}</td>
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 uppercase tracking-tight">{order.customerName || 'Khách vãng lai'}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hội viên Standard</div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-indigo-600 text-base">{order.finalAmount.toLocaleString()}đ</td>
                    <td className="px-8 py-6 text-center">
                      <span className="bg-slate-100 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest border border-slate-200">{order.paymentMethod}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePrint(order); }}
                        className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-transparent hover:border-indigo-100"
                      >
                        <Printer className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Báo cáo cuối ngày */}
      {showEODReport && (
        <EndOfDayReport
          orders={orders}
          storeName={storeName}
          onClose={() => setShowEODReport(false)}
        />
      )}

      {/* Modal Chi tiết đơn hàng */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-slate-200">
            <div className="bg-slate-50 p-10 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-black text-2xl text-slate-950 uppercase tracking-tighter">Chi tiết giao dịch</h3>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-3">
                   <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-600">{selectedOrder.orderCode}</span>
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                   <span>{new Date(selectedOrder.date).toLocaleString('vi-VN')}</span>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="h-12 w-12 flex items-center justify-center hover:bg-white rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-10">
              <div className="grid grid-cols-2 gap-8 mb-10 p-6 bg-slate-50 rounded-[2rem] border border-slate-200 shadow-inner">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông tin khách hàng</div>
                  <div className="font-black text-slate-900 border-l-4 border-indigo-600 pl-4 uppercase tracking-tight">{selectedOrder.customerName || 'Khách vãng lai'}</div>
                </div>
                <div className="text-right space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Phương thức</div>
                  <div className="font-black text-emerald-600 uppercase tracking-[0.1em]">{selectedOrder.paymentMethod}</div>
                </div>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 no-scrollbar mb-10">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex gap-5 items-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-200 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                         <ShoppingBag className="h-6 w-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <div className="font-black text-slate-900 uppercase text-xs tracking-tight">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{item.price.toLocaleString()}đ × {item.quantity} {(item as any).unit || 'đv'}</div>
                      </div>
                    </div>
                    <div className="font-black text-slate-900 text-base">{item.total.toLocaleString()}đ</div>
                  </div>
                ))}
              </div>

              <div className="bg-indigo-600 p-8 rounded-[2rem] shadow-xl shadow-indigo-600/20 text-white space-y-4">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.1em] opacity-80">
                  <span>Tiền hàng thực tế</span>
                  <span className="tabular-nums">{selectedOrder.totalAmount.toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.1em] opacity-80">
                  <span>Khuyến mãi & Phiếu giảm</span>
                  <span className="tabular-nums">-{selectedOrder.discount.toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between items-end border-t border-white/20 pt-4 mt-2">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-2">Thực thu (Net)</span>
                     <span className="text-sm font-bold opacity-80 italic tracking-wider">Cảm ơn quý khách!</span>
                  </div>
                  <span className="text-4xl font-black tabular-nums tracking-tighter">{selectedOrder.finalAmount.toLocaleString()}đ</span>
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button 
                  onClick={() => handlePrint(selectedOrder)}
                  className="flex-1 py-5 bg-slate-950 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-slate-900 active:scale-95 transition-all flex items-center justify-center gap-4 group"
                >
                  <Printer className="h-5 w-5 text-indigo-400 group-hover:scale-110 transition-transform" /> In hóa đơn điện tử
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
