import React from 'react';
import { Undo2 } from 'lucide-react';
import PrintReceiptLayout from './PrintReceiptLayout';

interface ReturnItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
  reason?: string;
}

interface POSReturnOrder {
  orderCode: string;
  originalOrderCode: string;
  date: string;
  customerName?: string;
  staffId: string;
  returnItems: ReturnItem[];
  returnTotal: number;
  refundMethod?: string;
  notes?: string;
}

interface POSReturnReceiptModalProps {
  order: POSReturnOrder;
  onClose: () => void;
  onPrint: () => void;
  onFinish: () => void;
}

const POSReturnReceiptModal: React.FC<POSReturnReceiptModalProps> = ({ 
  order, 
  onClose, 
  onPrint, 
  onFinish 
}) => (
  <PrintReceiptLayout
    title="Phiếu trả hàng"
    titleIcon={Undo2}
    titleIconColor="text-rose-500"
    orderCode={order.orderCode}
    date={order.date}
    onClose={onClose}
    onPrint={onPrint}
    onFinish={onFinish}
    printButtonText="In phiếu trả hàng"
  >
    {/* Customer Info */}
    <div className="mb-6 space-y-2">
      <div className="flex justify-between text-xs">
        <span className="font-normal text-slate-400 uppercase tracking-wider">Khách hàng:</span>
        <span className="font-normal text-slate-800">{order.customerName || 'Khách vãng lai'}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="font-normal text-slate-400 uppercase tracking-wider">Hóa đơn gốc:</span>
        <span className="font-normal text-rose-600">{order.originalOrderCode}</span>
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
    </div>

    {/* Refund Total */}
    <div className="space-y-3 border-t-2 border-dashed border-slate-200 pt-6">
      <div className="flex justify-between items-center py-3 bg-rose-50 px-4 rounded-2xl">
        <span className="font-normal text-rose-900 uppercase text-xs tracking-widest">Tổng hoàn trả:</span>
        <span className="text-xl font-normal text-rose-600 italic leading-none">
          {order.returnTotal.toLocaleString()}đ
        </span>
      </div>
      {order.refundMethod && (
        <div className="flex justify-between items-center text-xs pt-2">
          <span className="font-normal text-slate-400 uppercase tracking-widest">Phương thức hoàn:</span>
          <span className="font-normal text-slate-700 uppercase">{order.refundMethod}</span>
        </div>
      )}
      {order.notes && (
        <div className="mt-4 p-3 bg-amber-50 rounded-xl">
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-wider mb-1">Ghi chú:</p>
          <p className="text-xs font-normal text-slate-700">{order.notes}</p>
        </div>
      )}
    </div>

    {/* Additional Footer Note */}
    <div className="text-center mt-8">
      <p className="text-[9px] font-normal text-slate-300 uppercase tracking-widest">
        Phiếu trả hàng đã được xử lý
      </p>
    </div>
  </PrintReceiptLayout>
);

export default POSReturnReceiptModal;
