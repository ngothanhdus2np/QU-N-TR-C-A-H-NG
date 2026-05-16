import React from 'react';
import { FileDown, Printer, X } from 'lucide-react';
import { InventoryTransaction } from '../../types';

interface AuditDetailModalProps {
  transaction: InventoryTransaction;
  onClose: () => void;
  onExport: (transactions: InventoryTransaction[]) => void;
  onPrint: (transaction: InventoryTransaction) => void;
}

const formatDateTime = (value?: string) => (
  value ? new Date(value).toLocaleString('vi-VN') : '—'
);

const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
  transaction,
  onClose,
  onExport,
  onPrint,
}) => {
  const totalDiff = transaction.totalDiff || 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-normal text-indigo-500 uppercase tracking-widest">Phiếu kiểm kho</p>
            <h3 className="text-lg font-black text-slate-900 font-mono">{transaction.id}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Tạo: {formatDateTime(transaction.date)} | Cân bằng: {formatDateTime(transaction.balancedDate)}
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-normal uppercase text-slate-400">Trạng thái</p>
              <p className="text-sm font-normal text-slate-800 mt-1">{transaction.status || 'balanced'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-normal uppercase text-slate-400">SL thực tế</p>
              <p className="text-sm font-normal text-slate-800 mt-1">{transaction.totalActualQty || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-normal uppercase text-slate-400">Tổng lệch</p>
              <p className={`text-sm font-normal mt-1 ${totalDiff > 0 ? 'text-emerald-600' : totalDiff < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                {totalDiff > 0 ? '+' : ''}{totalDiff}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[9px] font-normal uppercase text-emerald-500">Lệch tăng</p>
              <p className="text-sm font-normal text-emerald-700 mt-1">{transaction.increaseCount || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
              <p className="text-[9px] font-normal uppercase text-rose-500">Lệch giảm</p>
              <p className="text-sm font-normal text-rose-700 mt-1">{transaction.decreaseCount || 0}</p>
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
                  <th className="px-4 py-3 text-right">Tồn HT</th>
                  <th className="px-4 py-3 text-right">Thực tế</th>
                  <th className="px-4 py-3 text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transaction.items.map((item) => {
                  const diff = item.quantity || (item.newStock || 0) - (item.previousStock || 0);
                  return (
                    <tr key={`${item.productId}-${item.sku}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-indigo-600 font-normal">{item.sku || '—'}</td>
                      <td className="px-4 py-3 font-normal text-slate-800">{item.name || item.productId}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.previousStock || 0}</td>
                      <td className="px-4 py-3 text-right text-slate-900 font-normal">{item.newStock || 0}</td>
                      <td className={`px-4 py-3 text-right font-normal ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </td>
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

export default AuditDetailModal;
