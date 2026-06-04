import React from 'react';
import { X, Printer, RefreshCw } from 'lucide-react';

interface ExchangeItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
  reason?: string;
}

interface POSExchangeOrder {
  orderCode: string;
  originalOrderCode: string;
  date: string;
  customerName?: string;
  staffId: string;
  returnItems: ExchangeItem[];
  newItems: ExchangeItem[];
  returnTotal: number;
  newTotal: number;
  difference: number;
  paymentMethod?: string;
  notes?: string;
}

interface POSExchangeReceiptModalProps {
  order: POSExchangeOrder;
  onClose: () => void;
  onPrint: () => void;
  onFinish: () => void;
}

const POSExchangeReceiptModal: React.FC<POSExchangeReceiptModalProps> = ({ 
  order, 
  onClose, 
  onPrint, 
  onFinish 
}) => (
  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-modal flex items-center justify-center p-4">
    <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
      <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
        <div>
          <h3 className="font-semibold text-lg text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            Phiếu đổi hàng
          </h3>
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-[0.2em] mt-1">
            {order.orderCode} • {new Date(order.date).toLocaleString('vi-VN')}
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-2xl hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar print-area">
        {/* Receipt Header */}
        <div className="text-center mb-8 border-b-2 border-dashed border-slate-200 pb-6">
          <h1 className="text-2xl font-semibold text-slate-900 uppercase tracking-tighter">CFO BRAIN PROFESSIONAL</h1>
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
            <span className="font-normal text-slate-400 uppercase tracking-wider">Hóa đơn gốc:</span>
            <span className="font-normal text-amber-600">{order.originalOrderCode}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="font-normal text-slate-400 uppercase tracking-wider">Thu ngân:</span>
            <span className="font-normal text-slate-800">{order.staffId}</span>
          </div>
        </div>

        {/* Return Items Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-slate-200"></div>
            <h4 className="text-2xs font-semibold text-rose-500 uppercase tracking-[0.2em]">Hàng trả lại</h4>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          <table className="w-full text-xs">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="py-2 font-semibold text-slate-400 uppercase text-left">Mặt hàng</th>
                <th className="py-2 font-semibold text-slate-400 uppercase text-center w-12">SL</th>
                <th className="py-2 font-semibold text-slate-400 uppercase text-right w-24">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {order.returnItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3">
                    <div className="font-normal text-slate-800 uppercase">{item.name}</div>
                    <div className="text-2xs text-slate-400 font-normal">{item.price.toLocaleString()}đ</div>
                    {item.reason && (
                      <div className="text-2xs text-rose-500 font-normal italic mt-1">Lý do: {item.reason}</div>
                    )}
                  </td>
                  <td className="py-3 text-center font-normal text-slate-800">{item.quantity}</td>
                  <td className="py-3 text-right font-normal text-rose-600">{item.total.toLocaleString()}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-3 text-sm bg-rose-50 px-4 py-2 rounded-xl">
            <span className="font-normal text-rose-700 uppercase text-xs tracking-wider">Tổng trả lại:</span>
            <span className="font-normal text-rose-600">{order.returnTotal.toLocaleString()}đ</span>
          </div>
        </div>

        {/* New Items Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-slate-200"></div>
            <h4 className="text-2xs font-semibold text-emerald-500 uppercase tracking-[0.2em]">Hàng mới</h4>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          <table className="w-full text-xs">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="py-2 font-semibold text-slate-400 uppercase text-left">Mặt hàng</th>
                <th className="py-2 font-semibold text-slate-400 uppercase text-center w-12">SL</th>
                <th className="py-2 font-semibold text-slate-400 uppercase text-right w-24">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {order.newItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3">
                    <div className="font-normal text-slate-800 uppercase">{item.name}</div>
                    <div className="text-2xs text-slate-400 font-normal">{item.price.toLocaleString()}đ</div>
                  </td>
                  <td className="py-3 text-center font-normal text-slate-800">{item.quantity}</td>
                  <td className="py-3 text-right font-normal text-emerald-600">{item.total.toLocaleString()}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-3 text-sm bg-emerald-50 px-4 py-2 rounded-xl">
            <span className="font-normal text-emerald-700 uppercase text-xs tracking-wider">Tổng hàng mới:</span>
            <span className="font-normal text-emerald-600">{order.newTotal.toLocaleString()}đ</span>
          </div>
        </div>

        {/* Difference Calculation */}
        <div className="space-y-3 border-t-2 border-dashed border-slate-200 pt-6">
          <div className="flex justify-between items-center py-3 bg-slate-50 px-4 rounded-2xl">
            <span className="font-normal text-slate-900 uppercase text-xs tracking-widest">
              {order.difference >= 0 ? 'Khách cần trả thêm:' : 'Hoàn lại khách:'}
            </span>
            <span className={`text-xl font-normal italic leading-none ${
              order.difference >= 0 ? 'text-indigo-600' : 'text-emerald-600'
            }`}>
              {Math.abs(order.difference).toLocaleString()}đ
            </span>
          </div>
          {order.difference > 0 && order.paymentMethod && (
            <div className="flex justify-between items-center text-xs pt-2">
              <span className="font-normal text-slate-400 uppercase tracking-widest">Phương thức:</span>
              <span className="font-normal text-slate-700 uppercase">{order.paymentMethod}</span>
            </div>
          )}
          {order.notes && (
            <div className="mt-4 p-3 bg-amber-50 rounded-xl">
              <p className="text-2xs font-normal text-slate-400 uppercase tracking-wider mb-1">Ghi chú:</p>
              <p className="text-xs font-normal text-slate-700">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12 mb-4 italic">
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest">Cảm ơn quý khách và hẹn gặp lại!</p>
          <p className="text-[9px] font-normal text-slate-300 uppercase tracking-widest mt-2">
            Vui lòng giữ phiếu này để đổi trả trong vòng 7 ngày
          </p>
        </div>
      </div>

      <div className="p-8 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-4 shrink-0">
        <button
          onClick={onPrint}
          className="flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-[1.5rem] font-normal uppercase text-2xs tracking-[0.2em] shadow-sm hover:border-indigo-400 hover:text-indigo-600 active:scale-95 transition-all"
        >
          <Printer className="h-4 w-4" />
          In phiếu
        </button>
        <button
          onClick={onFinish}
          className="bg-slate-950 text-white py-4 rounded-[1.5rem] font-normal uppercase text-2xs tracking-[0.2em] shadow-2xl shadow-slate-950/20 active:scale-95 transition-all hover:bg-indigo-600"
        >
          Hoàn tất
        </button>
      </div>
    </div>
  </div>
);

export default POSExchangeReceiptModal;
