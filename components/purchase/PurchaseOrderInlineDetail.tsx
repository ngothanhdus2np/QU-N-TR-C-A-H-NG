import React, { useState } from 'react';
import { FileDown, Printer, Copy, Tag, MoreHorizontal, Ban, ExternalLink, Save, RotateCcw } from 'lucide-react';
import { Employee, InventoryTransaction } from '../../types';
import { supabase } from '../../services/supabase';
import { resolveStaffName } from '../shared/staff';

interface PurchaseOrderInlineDetailProps {
  transaction: InventoryTransaction;
  employees?: Employee[];
  onClose: () => void;
  onExport: (transactions: InventoryTransaction[]) => void;
  onPrint: (transaction: InventoryTransaction) => void;
  onOpenOrder?: (transaction: InventoryTransaction) => void;
}

const fmt = (v?: string) =>
  v
    ? new Date(v).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const getLineTotal = (item: InventoryTransaction['items'][number]) => {
  const i = item as typeof item & { price?: number; discount?: number };
  return item.quantity * (i.price || 0) - (i.discount || 0);
};

const getImportPrice = (item: InventoryTransaction['items'][number]) => {
  const i = item as typeof item & { price?: number; discount?: number };
  const price = i.price || 0;
  const discount = i.discount || 0;
  if (item.quantity > 0 && discount > 0) {
    return Math.round((price * item.quantity - discount) / item.quantity);
  }
  return price;
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Phiếu tạm',    cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  completed: { label: 'Đã nhập hàng', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  cancelled: { label: 'Đã hủy',       cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const PurchaseOrderInlineDetail: React.FC<PurchaseOrderInlineDetailProps> = ({
  transaction,
  employees = [],
  onClose,
  onExport,
  onPrint,
  onOpenOrder,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'payment'>('info');
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    const { error } = await supabase
      .from('inventory_transactions')
      .update({ note: noteText.trim() })
      .eq('id', transaction.id);
    setNoteSaving(false);
    if (!error) {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
  };

  const isPurchaseReturn = transaction.type === 'PurchaseReturn';
  const code = transaction.referenceId || transaction.id.slice(0, 12);
  const status = statusLabel[transaction.status || 'completed'] ?? statusLabel.completed;

  const totalAmount =
    transaction.totalAmount ?? transaction.items.reduce((s, i) => s + getLineTotal(i), 0);
  const totalQty = transaction.items.reduce((s, i) => s + i.quantity, 0);
  const totalDiscount = transaction.items.reduce((s, i) => {
    const it = i as typeof i & { discount?: number };
    return s + (it.discount || 0);
  }, 0);
  const itemCount = transaction.items.length;
  const grossTotal = totalAmount + totalDiscount;

  return (
    <div className="bg-white border border-slate-200 border-t-0">
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 px-6">
        {(['info', 'payment'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2.5 px-1 mr-6 text-sm font-normal border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'info' ? 'Thông tin' : 'Lịch sử thanh toán'}
          </button>
        ))}
      </div>

      {activeTab === 'info' ? (
        <>
          {/* Header row: code + status + branch */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-900 text-base">{code}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-normal ${status.cls}`}>
                {status.label}
              </span>
              {isPurchaseReturn && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-normal bg-rose-100 text-rose-600 border border-rose-200">
                  Trả hàng nhập
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">Chi nhánh trung tâm</span>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-start gap-x-10 gap-y-2 px-6 pb-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Người tạo:</span>
              <span className="text-slate-700">{resolveStaffName(transaction.staffId, employees) || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Người nhập:</span>
              <span className="text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs">
                {resolveStaffName(transaction.staffId, employees) || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Ngày nhập:</span>
              <span className="text-slate-700">{fmt(transaction.date)}</span>
            </div>
          </div>
          <div className="px-6 pb-4 text-sm">
            <span className="text-slate-400 text-xs">Tên NCC: </span>
            <span className="text-indigo-600 font-normal cursor-pointer hover:underline">
              {transaction.supplierName || 'NCC vãng lai'}
            </span>
          </div>

          {/* Content: table + summary */}
          <div className="flex gap-0 px-6 pb-0">
            {/* Left: table */}
            <div className="flex-1 min-w-0">
              {/* Table header area with "Thiết lập giá" link */}
              <div className="flex justify-end mb-1">
                <button className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                  <Tag className="w-3 h-3" />
                  Thiết lập giá
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-xs font-normal text-slate-500">
                      <th className="px-3 py-2.5 text-left">Mã hàng</th>
                      <th className="px-3 py-2.5 text-left">Tên hàng</th>
                      <th className="px-3 py-2.5 text-right">Số lượng</th>
                      <th className="px-3 py-2.5 text-right">Đơn giá</th>
                      <th className="px-3 py-2.5 text-right">Giảm giá</th>
                      <th className="px-3 py-2.5 text-right">Giá nhập</th>
                      <th className="px-3 py-2.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transaction.items.map((item, idx) => {
                      const it = item as typeof item & { price?: number; discount?: number };
                      return (
                        <tr key={`${item.productId}-${idx}`} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 text-xs">
                            {item.productId ? (
                              <button
                                type="button"
                                onClick={() => window.open(`/goods?view=${item.productId}`, '_blank')}
                                className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-normal"
                                title="Mở chi tiết sản phẩm"
                              >
                                {item.sku || '—'}
                              </button>
                            ) : (
                              <span className="text-indigo-600 font-normal">{item.sku || '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-800 text-sm">
                            {item.name || item.productId}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700 text-sm">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700 text-sm">
                            {(it.price || 0).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500 text-sm">
                            {(it.discount || 0) > 0
                              ? (it.discount || 0).toLocaleString('vi-VN')
                              : ''}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700 text-sm">
                            {getImportPrice(item).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-sm">
                            {getLineTotal(item).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Note field */}
              <div className="mt-3 mb-4">
                <div className="flex gap-2 items-end">
                  <textarea
                    rows={2}
                    placeholder="Ghi chú..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim() || noteSaving}
                    className="shrink-0 px-3 py-2 rounded-lg text-xs font-normal bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {noteSaving ? 'Đang lưu...' : noteSaved ? 'Đã lưu ✓' : 'Lưu'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: summary */}
            <div className="w-60 shrink-0 ml-6 space-y-2 text-sm pt-8">
              <div className="flex justify-between text-slate-500">
                <span>Số lượng mặt hàng</span>
                <span className="text-slate-700 font-normal">{itemCount}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tổng tiền hàng ({totalQty})</span>
                <span className="text-slate-700 font-normal">{grossTotal.toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span className="flex items-center gap-1">
                  Giảm giá
                </span>
                <span className="text-slate-700 font-normal">
                  {totalDiscount > 0 ? totalDiscount.toLocaleString('vi-VN') : '0'}
                </span>
              </div>
              <div className="flex justify-between text-slate-700 font-normal border-t border-slate-200 pt-2">
                <span>Tổng cộng</span>
                <span>{totalAmount.toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tiền đã trả NCC</span>
                <span className="text-slate-700 font-normal">{totalAmount.toLocaleString('vi-VN')}</span>
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50">
            {/* Left actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-600 hover:bg-white transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                Hủy
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-600 hover:bg-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Sao chép
              </button>
              <button
                onClick={() => onExport([transaction])}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-600 hover:bg-white transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                Xuất file
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenOrder?.(transaction)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 rounded-lg text-xs font-normal text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở phiếu
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-600 hover:bg-white transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Lưu
              </button>
              <button
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-normal hover:bg-indigo-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Trả hàng nhập
              </button>
              <button
                onClick={() => onPrint(transaction)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-600 hover:bg-white transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                In tem mã
              </button>
              <button
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="px-6 py-10 text-center text-sm text-slate-400">
          Chưa có lịch sử thanh toán
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderInlineDetail;
