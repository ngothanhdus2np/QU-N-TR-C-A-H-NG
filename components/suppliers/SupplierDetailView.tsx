import React, { useState, useMemo } from 'react';
import { X, Edit2, Trash2, Truck, Package, CreditCard, FileText, Lock, Unlock } from 'lucide-react';
import { Supplier, SupplierDebtRecord, InventoryTransaction } from '../../types';

interface SupplierDetailViewProps {
  supplier: Supplier;
  supplierDebts: SupplierDebtRecord[];
  purchaseTransactions: InventoryTransaction[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onToggleStatus?: (supplier: Supplier) => void;
}

type DetailTab = 'info' | 'invoice' | 'history' | 'debt';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'invoice', label: 'Thông tin xuất hóa đơn' },
  { id: 'history', label: 'Lịch sử nhập/trả hàng' },
  { id: 'debt', label: 'Nợ cần trả nhà cung cấp' },
];

const FieldRow = ({ label, value }: { label: string; value?: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-slate-400">{label}</span>
    <span className="text-sm text-slate-700">{value || '—'}</span>
  </div>
);

const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
};
const normalizeSupplierKey = (value?: string | null) => value?.trim().toLowerCase() || '';

const SupplierDetailView: React.FC<SupplierDetailViewProps> = ({
  supplier,
  supplierDebts,
  purchaseTransactions,
  onEdit,
  onDelete,
  onClose,
  onToggleStatus,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const matchesSupplier = (supplierId?: string, supplierName?: string) => {
    if (supplierId) return supplierId === supplier.id;
    const supplierText = normalizeSupplierKey(supplierName);
    return (
      supplierText !== '' &&
      (supplierText === normalizeSupplierKey(supplier.name) ||
        supplierText === normalizeSupplierKey(supplier.code))
    );
  };

  const debts = useMemo(() => {
    return supplierDebts
      .filter(d => matchesSupplier(d.supplierId, d.supplierName))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [supplierDebts, supplier.id, supplier.name, supplier.code]);

  const debtsWithBalance = useMemo(() => {
    let balance = 0;
    return [...debts]
      .reverse()
      .map(d => {
        balance += d.type === 'purchase' ? d.amount : -d.amount;
        return { ...d, runningBalance: balance };
      })
      .reverse();
  }, [debts]);

  const supplierTransactions = useMemo(() => {
    return purchaseTransactions
      .filter(
        t =>
          (t.type === 'Import' || t.type === 'PurchaseReturn') &&
          matchesSupplier(t.supplierId, t.supplierName)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [purchaseTransactions, supplier.id, supplier.name, supplier.code]);
  const currentDebt = debtsWithBalance[0]?.runningBalance ?? supplier.currentDebt ?? 0;

  const isActive = supplier.status !== 'inactive';

  const renderInfoTab = () => (
    <div className="p-6 space-y-5">
      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex gap-5">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <Truck className="w-10 h-10 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-bold text-slate-900">{supplier.name}</h2>
            <span className="text-sm text-slate-400 block mt-0.5">
              {supplier.code || supplier.id.slice(0, 8)}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 mt-1">
              <span>Người tạo: —</span>
              <span>|</span>
              <span>Ngày tạo: —</span>
              {supplier.group && (
                <>
                  <span>|</span>
                  <span>Nhóm: {supplier.group}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-3 gap-x-10 gap-y-4">
          <FieldRow label="Điện thoại" value={supplier.phone} />
          <FieldRow label="Email" value={supplier.email} />
          <FieldRow label="Nhóm" value={supplier.group} />
          <FieldRow label="Công ty xuất hóa đơn" value={supplier.companyName} />
          <FieldRow label="Mã số thuế" value={supplier.taxCode} />
        </div>
        {supplier.address && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <FieldRow label="Địa chỉ" value={supplier.address} />
          </div>
        )}
      </div>

      {/* Notes */}
      {supplier.notes && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-2 text-slate-600">
            <FileText className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
            <span className="text-sm whitespace-pre-wrap">{supplier.notes}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderInvoiceTab = () => (
    <div className="p-6 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
          <FileText className="mt-0.5 h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Thông tin đơn vị xuất hóa đơn</h3>
            <p className="mt-1 text-xs text-slate-400">
              Dữ liệu này được cập nhật sau khi xác nhận hóa đơn VAT upload.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-10 gap-y-4">
          <FieldRow label="Tên đơn vị xuất hóa đơn" value={supplier.invoiceCompanyName || supplier.companyName} />
          <FieldRow label="Mã số thuế" value={supplier.invoiceTaxCode || supplier.taxCode} />
          <FieldRow label="Số điện thoại đơn vị" value={supplier.invoicePhone} />
          <FieldRow label="Địa chỉ xuất hóa đơn" value={supplier.invoiceAddress} />
        </div>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="p-6">
      {supplierTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Chưa có phiếu nhập/trả hàng</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Mã phiếu
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Loại
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Ngày
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Số lượng SP
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Tổng tiền
                  </th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierTransactions.map(purchase => (
                  <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-indigo-600 text-xs">
                        {purchase.referenceId || purchase.id.slice(0, 12)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase ${
                          purchase.type === 'Import'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {purchase.type === 'Import' ? 'Nhập hàng' : 'Trả hàng'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(purchase.date)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{purchase.items.length}</td>
                    <td
                      className={`px-4 py-3 text-right ${
                        purchase.type === 'Import' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatMoney(purchase.totalAmount || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase ${
                          purchase.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-500'
                            : purchase.status === 'draft'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {purchase.status === 'cancelled'
                          ? 'Đã hủy'
                          : purchase.status === 'draft'
                            ? 'Phiếu tạm'
                            : 'Đã nhập'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderDebtTab = () => (
    <div className="p-6">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-400">Nợ cần trả hiện tại</p>
        <p className={`mt-1 text-[18px] font-bold ${currentDebt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
          {formatMoney(currentDebt)}
        </p>
      </div>
      {debtsWithBalance.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CreditCard className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Chưa có giao dịch công nợ</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Ngày
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Loại
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Mô tả
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Số tiền
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">
                    Số dư
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debtsWithBalance.map(debt => (
                  <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(debt.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase ${
                          debt.type === 'purchase'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {debt.type === 'purchase' ? 'Mua hàng' : 'Thanh toán'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{debt.description}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={debt.type === 'purchase' ? 'text-rose-600' : 'text-emerald-600'}
                      >
                        {debt.type === 'purchase' ? '+' : '-'}
                        {debt.amount.toLocaleString()}đ
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {debt.runningBalance.toLocaleString()}đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white animate-in slide-in-from-top-2 duration-200">
      {/* Tabs + close */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center px-4">
          {TABS.map(tab => {
            const count =
              tab.id === 'history'
                ? supplierTransactions.length
                : tab.id === 'debt'
                  ? debts.length
                  : null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-normal border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {count !== null ? ` (${count})` : ''}
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[600px] overflow-auto bg-slate-50">
        {activeTab === 'info' && renderInfoTab()}
        {activeTab === 'invoice' && renderInvoiceTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'debt' && renderDebtTab()}
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Xóa
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Chỉnh sửa
          </button>
          {onToggleStatus && (
            <button
              onClick={() => onToggleStatus(supplier)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              {isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierDetailView;
