import React from 'react';
import { Search, X, ClipboardCheck, AlertCircle, History } from 'lucide-react';
import { POSProduct, InventoryTransaction } from '../../types';

export interface AuditItem {
  productId: string;
  currentStock: number;
  actualStock: number;
  note: string;
}

// --- Lịch sử kiểm kho (tab 'kho') ---

interface GoodsKhoHistoryProps {
  transactions: InventoryTransaction[];
}

export const GoodsKhoHistory: React.FC<GoodsKhoHistoryProps> = ({ transactions }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
    <table className="w-full text-sm">
      <thead className="bg-[#fff9f0] border-b font-black uppercase text-[10px]">
        <tr>
          <th className="p-4 text-left">Mã phiếu</th>
          <th className="p-4 text-left">Ngày</th>
          <th className="p-4 text-right">Lệch</th>
          <th className="p-4 text-center">Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {transactions.filter(t => t.type === 'Check').map(t => (
          <tr key={t.id} className="border-b">
            <td className="p-4 font-mono text-indigo-600 font-black">#{t.id.slice(0, 8)}</td>
            <td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
            <td className="p-4 text-right font-black">{t.items.reduce((s, i) => s + i.quantity, 0)}</td>
            <td className="p-4 text-center">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase">Đã cân bằng</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// --- Form kiểm kê thực tế (tab 'audit_form') ---

interface GoodsAuditFormProps {
  products: POSProduct[];
  lowStockProducts: POSProduct[];
  auditItems: AuditItem[];
  setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>>;
  auditSearchTerm: string;
  setAuditSearchTerm: (v: string) => void;
  onConfirmAudit: () => void;
  onCancel: () => void;
}

export const GoodsAuditForm: React.FC<GoodsAuditFormProps> = ({
  products,
  lowStockProducts,
  auditItems,
  setAuditItems,
  auditSearchTerm,
  setAuditSearchTerm,
  onConfirmAudit,
  onCancel,
}) => {
  const mismatchCount = auditItems.filter(i => i.actualStock !== i.currentStock).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Phiếu kiểm kê thực tế</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const allActive = products.filter(p => p.status !== 'Inactive');
              const existing = new Set(auditItems.map(i => i.productId));
              const toAdd = allActive
                .filter(p => !existing.has(p.id))
                .map(p => ({ productId: p.id, currentStock: p.stock, actualStock: p.stock, note: '' }));
              setAuditItems(prev => [...prev, ...toAdd]);
            }}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-xs uppercase tracking-wide hover:bg-indigo-100 transition-colors"
          >
            + Nạp tất cả hàng hóa
          </button>
          <button
            onClick={() => {
              const lowStock = lowStockProducts.filter(p => !auditItems.find(i => i.productId === p.id));
              setAuditItems(prev => [
                ...prev,
                ...lowStock.map(p => ({ productId: p.id, currentStock: p.stock, actualStock: p.stock, note: '' })),
              ]);
            }}
            className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl font-black text-xs uppercase tracking-wide hover:bg-rose-100 transition-colors"
          >
            + Hàng sắp hết ({lowStockProducts.length})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-all"
            placeholder="Tìm từng mặt hàng để thêm vào phiếu kiểm..."
            value={auditSearchTerm}
            onChange={e => {
              setAuditSearchTerm(e.target.value);
              const term = e.target.value.toLowerCase();
              if (term.length < 2) return;
              const p = products.find(
                p => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
              );
              if (p && !auditItems.find(i => i.productId === p.id)) {
                setAuditItems(prev => [
                  ...prev,
                  { productId: p.id, currentStock: p.stock, actualStock: p.stock, note: '' },
                ]);
                setAuditSearchTerm('');
              }
            }}
          />
        </div>
      </div>

      {/* Bảng kiểm kê */}
      {auditItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 font-bold text-sm">Chưa có mặt hàng nào</p>
          <p className="text-slate-300 text-xs mt-1">Bấm "Nạp tất cả" hoặc tìm từng mặt hàng phía trên</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Mặt hàng</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Tồn HT</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Thực tế</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Chênh lệch</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Ghi chú</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditItems.map((item, idx) => {
                  const prod = products.find(p => p.id === item.productId);
                  const diff = item.actualStock - item.currentStock;
                  return (
                    <tr key={idx} className={diff !== 0 ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 text-sm">{prod?.name || item.productId}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{prod?.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-700">{item.currentStock}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          className="w-20 text-center border border-slate-200 rounded-xl py-1.5 font-black text-slate-800 outline-none focus:border-indigo-400 transition-all bg-white"
                          value={item.actualStock}
                          onChange={e => {
                            const nl = [...auditItems];
                            nl[idx] = { ...nl[idx], actualStock: Number(e.target.value) };
                            setAuditItems(nl);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {diff === 0 ? (
                          <span className="text-slate-300 font-black text-sm">—</span>
                        ) : (
                          <span className={`font-black text-sm ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          className="w-full border border-slate-100 rounded-xl py-1.5 px-2 text-xs text-slate-600 outline-none focus:border-indigo-300 bg-slate-50 transition-all"
                          placeholder="Ghi chú..."
                          value={item.note}
                          onChange={e => {
                            const nl = [...auditItems];
                            nl[idx] = { ...nl[idx], note: e.target.value };
                            setAuditItems(nl);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setAuditItems(auditItems.filter((_, i) => i !== idx))}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400 font-bold">{auditItems.length} mặt hàng</span>
          {mismatchCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 font-black">
              <AlertCircle className="h-4 w-4" />
              {mismatchCount} mặt hàng lệch
            </span>
          )}
          {mismatchCount === 0 && auditItems.length > 0 && (
            <span className="text-emerald-600 font-black text-sm">✓ Tất cả khớp</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-slate-100 rounded-xl font-black text-xs uppercase text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onConfirmAudit}
            disabled={auditItems.length === 0}
            className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-wide shadow-lg shadow-amber-200 hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Xác nhận kiểm kê {mismatchCount > 0 ? `(${mismatchCount} lệch)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
