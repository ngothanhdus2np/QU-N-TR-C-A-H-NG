import React from 'react';
import { X, Printer } from 'lucide-react';
import { POSOrder } from '../../types';

interface POSReceiptModalProps {
  order: POSOrder;
  cashReceived: number;
  onClose: () => void;
  onPrint: () => void;
  onFinish: () => void;
}

const POSReceiptModal: React.FC<POSReceiptModalProps> = ({ order, cashReceived, onClose, onPrint, onFinish }) => (
  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
    <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
      <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
        <div>
          <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Hóa đơn thanh toán</h3>
          <p className="text-[10px] font-normal text-slate-400 uppercase tracking-[0.2em] mt-1">{order.orderCode} • {new Date(order.date).toLocaleString('vi-VN')}</p>
        </div>
        <button onClick={onClose} className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-2xl hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar print-area">
        {/* Receipt Header */}
        <div className="text-center mb-8 border-b-2 border-dashed border-slate-200 pb-6">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">CFO BRAIN PROFESSIONAL</h1>
          <p className="text-xs font-normal text-slate-500 mt-2">123 Đường Công Nghệ, Quận 1, TP. HCM</p>
          <p className="text-xs font-normal text-slate-500">Hotline: 1900 1234</p>
        </div>

        {/* Customer Info */}
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-normal text-slate-400 uppercase tracking-wider">Khách hàng:</span>
            <span className="font-normal text-slate-800">{order.customerName || 'Khách vãng lai'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="font-normal text-slate-400 uppercase tracking-wider">Thu ngân:</span>
            <span className="font-normal text-slate-800">{order.staffId}</span>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-xs mb-8">
          <thead className="border-b border-slate-100">
            <tr>
              <th className="py-2 font-black text-slate-400 uppercase text-left">Mặt hàng</th>
              <th className="py-2 font-black text-slate-400 uppercase text-center w-12">SL</th>
              <th className="py-2 font-black text-slate-400 uppercase text-right w-24">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {order.items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-3">
                  <div className="font-normal text-slate-800 uppercase">{item.name}</div>
                  <div className="text-[10px] text-slate-400 font-normal">{item.price.toLocaleString()}đ</div>
                </td>
                <td className="py-3 text-center font-normal text-slate-800">{item.quantity}</td>
                <td className="py-3 text-right font-normal text-indigo-600">{item.total.toLocaleString()}đ</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="space-y-3 border-t-2 border-dashed border-slate-200 pt-6">
          <div className="flex justify-between items-center text-sm">
            <span className="font-normal text-slate-500">Tổng tiền hàng:</span>
            <span className="font-normal text-slate-800">{order.totalAmount.toLocaleString()}đ</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="font-normal text-slate-500">Chiết khấu:</span>
              <span className="font-normal text-rose-500">-{order.discount.toLocaleString()}đ</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 bg-slate-50 px-4 rounded-2xl">
            <span className="font-normal text-slate-900 uppercase text-xs tracking-widest">Tổng thanh toán:</span>
            <span className="text-xl font-normal text-indigo-600 italic leading-none">{order.finalAmount.toLocaleString()}đ</span>
          </div>
          <div className="flex justify-between items-center text-xs pt-2">
            <span className="font-normal text-slate-400 uppercase tracking-widest">Phương thức:</span>
            <span className="font-normal text-slate-700 uppercase">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-normal text-slate-400 uppercase tracking-widest">Khách đưa:</span>
            <span className="font-normal text-slate-700">{(cashReceived || order.finalAmount).toLocaleString()}đ</span>
          </div>
          {(cashReceived || order.finalAmount) > order.finalAmount && (
            <div className="flex justify-between items-center text-xs pt-1">
              <span className="font-normal text-slate-400 uppercase tracking-widest">Tiền thừa:</span>
              <span className="font-normal text-emerald-600">{((cashReceived || order.finalAmount) - order.finalAmount).toLocaleString()}đ</span>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12 mb-4 italic">
          <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Cảm ơn quý khách và hẹn gặp lại!</p>
        </div>
      </div>

      <div className="p-8 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-4 shrink-0">
        <button
          onClick={onPrint}
          className="flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-[1.5rem] font-normal uppercase text-[10px] tracking-[0.2em] shadow-sm hover:border-indigo-400 hover:text-indigo-600 active:scale-95 transition-all"
        >
          <Printer className="h-4 w-4" />
          In hóa đơn
        </button>
        <button
          onClick={onFinish}
          className="bg-slate-950 text-white py-4 rounded-[1.5rem] font-normal uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-slate-950/20 active:scale-95 transition-all hover:bg-indigo-600"
        >
          Hoàn tất
        </button>
      </div>
    </div>
  </div>
);

export default POSReceiptModal;
