import React from 'react';
import { FileDown, Printer, X } from 'lucide-react';
import { InventoryTransaction } from '../../types';

interface PurchaseOrderDetailModalProps {
  transaction: InventoryTransaction;
  onClose: () => void;
  onExport: (transactions: InventoryTransaction[]) => void;
  onPrint: (transaction: InventoryTransaction) => void;
}

const formatDateTime = (value?: string) => (
  value ? new Date(value).toLocaleString('vi-VN') : '—'
);

const getLineTotal = (item: InventoryTransaction['items'][number]) => {
  const withPrice = item as typeof item & { price?: number; discount?: number };
  return item.quantity * (withPrice.price || 0) - (withPrice.discount || 0);
};

const PurchaseOrderDetailModal: React.FC<PurchaseOrderDetailModalProps> = ({
  transaction,
  onClose,
  onExport,
  onPrint,
}) => {
  const totalAmount = transaction.totalAmount || transaction.items.reduce((sum, item) => sum + getLineTotal(item), 0);
  const isPurchaseReturn = transaction.type === 'PurchaseReturn';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-normal text-indigo-500 uppercase tracking-widest">
              {isPurchaseReturn ? 'Phiếu trả hàng nhập' : 'Phiếu nhập hàng'}
            </p>
            <h3 className="text-lg font-black text-slate-900 font-mono">{transaction.id}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Ngày tạo: {formatDateTime(transaction.date)} | NCC: {transaction.supplierName || 'NCC vãng lai'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport([transaction])}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 text-xs font-normal hover:bg-indigo-100"
            >
              <FileDown className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => onPrint(transaction)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-normal hover:bg-slate-50"
            >
              <Printer className="w-4 h-4" />
              In phiếu
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-normal uppercase text-slate-400">Trạng thái</p>
              <p className="text-sm font-normal text-slate-800 mt-1">{transaction.status || 'completed'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-normal uppercase text-slate-400">Người tạo</p>
              <p className="text-sm font-normal text-slate-800 mt-1">{transaction.staffId || '—'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-normal uppercase text-slate-400">Số dòng</p>
              <p className="text-sm font-normal text-slate-800 mt-1">{transaction.items.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[9px] font-normal uppercase text-emerald-500">
                {isPurchaseReturn ? 'NCC cần trả' : 'Cần trả NCC'}
              </p>
              <p className="text-sm font-normal text-emerald-700 mt-1">{totalAmount.toLocaleString('vi-VN')}đ</p>
            </div>
          </div>

          {transaction.note && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-900 font-normal">
              {transaction.note}
            </div>
          )}

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] font-black uppercase text-slate-400">
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Tên hàng</th>
                  <th className="px-4 py-3 text-right">SL</th>
                  <th className="px-4 py-3 text-right">Đơn giá</th>
                  <th className="px-4 py-3 text-right">Giảm</th>
                  <th className="px-4 py-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transaction.items.map((item) => {
                  const withPrice = item as typeof item & { price?: number; discount?: number };
                  const price = withPrice.price || 0;
                  const discount = withPrice.discount || 0;
                  return (
                    <tr key={`${item.productId}-${item.sku}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-indigo-600 font-normal">{item.sku || '—'}</td>
                      <td className="px-4 py-3 font-normal text-slate-800">{item.name || item.productId}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{price.toLocaleString('vi-VN')}đ</td>
                      <td className="px-4 py-3 text-right">{discount.toLocaleString('vi-VN')}đ</td>
                      <td className="px-4 py-3 text-right font-normal text-emerald-600">{getLineTotal(item).toLocaleString('vi-VN')}đ</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetailModal;
