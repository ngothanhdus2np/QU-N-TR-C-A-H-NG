import React from 'react';
import { X } from 'lucide-react';
import { AppDataSurgicalUpdate, Employee, POSCustomer, POSOrder } from '../../types';
import OrderInvoices from '../orders/OrderInvoices';

interface ProcessOrdersModalProps {
  orders: POSOrder[];
  customers: POSCustomer[];
  employees?: Employee[];
  storeName?: string;
  onClose: () => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onReturnInPOS?: (order: POSOrder) => void;
}

export default function ProcessOrdersModal({
  orders,
  customers,
  employees,
  storeName,
  onClose,
  onUpdateSurgical,
  onReturnInPOS,
}: ProcessOrdersModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-modal flex items-center justify-center p-6">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden"
        style={{ height: '85vh' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Xử lý đặt hàng</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <OrderInvoices
            orders={orders}
            customers={customers}
            employees={employees}
            storeName={storeName ?? ''}
            onUpdateSurgical={onUpdateSurgical}
            onReturnInPOS={onReturnInPOS}
          />
        </div>
      </div>
    </div>
  );
}
