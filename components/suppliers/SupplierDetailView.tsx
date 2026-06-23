import React, { useState, useMemo } from 'react';
import { X, Edit2, Trash2, Truck, Package, CreditCard, FileText, Lock, Unlock } from 'lucide-react';
import { Supplier, SupplierDebtRecord, InventoryTransaction } from '../../types';
import { getCurrentStaffId } from '../shared/staff';

interface SupplierDetailViewProps {
  supplier: Supplier;
  supplierDebts: SupplierDebtRecord[];
  purchaseTransactions: InventoryTransaction[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onToggleStatus?: (supplier: Supplier) => void;
  onRecordPayment?: (payment: { amount: number; date: string; description: string; method?: string }) => Promise<void>;
  onRecordAdjustment?: (data: { targetDebt: number; currentDebt: number; date: string; description: string }) => Promise<void>;
  onRecordDiscount?: (data: { amount: number; date: string; description: string }) => Promise<void>;
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
  onRecordPayment,
  onRecordAdjustment,
  onRecordDiscount,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [showAllocation, setShowAllocation] = useState(true);
  const [invoicePayments, setInvoicePayments] = useState<Record<string, number>>({});

  // Adjust modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDate, setAdjustDate] = useState(new Date().toISOString().slice(0, 10));
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Discount modal state
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountDate, setDiscountDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountNote, setDiscountNote] = useState('');
  const [discountAllocation, setDiscountAllocation] = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);

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
        if (d.type === 'purchase') {
          balance += d.amount;
        } else if (d.type === 'adjustment') {
          balance += d.amount; // amount can be negative for debt reduction
        } else {
          balance -= d.amount; // payment, discount
        }
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

  // FIFO invoice allocation for payment/discount popup
  const fifoInvoices = useMemo(() => {
    const imports = purchaseTransactions
      .filter(
        t =>
          t.type === 'Import' &&
          matchesSupplier(t.supplierId, t.supplierName) &&
          t.status !== 'cancelled'
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalPaid = debts
      .filter(d => d.type === 'payment' || d.type === 'discount')
      .reduce((sum, d) => sum + d.amount, 0);

    let remainingPayments = totalPaid;
    return imports
      .map(inv => {
        const amount = inv.totalAmount || 0;
        const paid = Math.min(remainingPayments, amount);
        remainingPayments -= paid;
        return {
          id: inv.id,
          refCode: inv.referenceId || inv.id.slice(0, 12),
          date: inv.date,
          totalAmount: amount,
          alreadyPaid: paid,
          remainingAmount: amount - paid,
        };
      })
      .filter(inv => inv.remainingAmount > 0);
  }, [purchaseTransactions, debts, supplier.id, supplier.name, supplier.code]);

  // Payment handlers
  const handlePaymentAmountChange = (value: string) => {
    setPaymentAmount(value);
    const total = parseFloat(value) || 0;
    if (showAllocation) {
      let remaining = total;
      const newAmounts: Record<string, number> = {};
      fifoInvoices.forEach(inv => {
        const pay = Math.min(remaining, inv.remainingAmount);
        newAmounts[inv.id] = pay;
        remaining -= pay;
      });
      setInvoicePayments(newAmounts);
    }
  };

  const handleInvoicePaymentChange = (invId: string, value: number) => {
    const inv = fifoInvoices.find(i => i.id === invId);
    if (!inv) return;
    const clamped = Math.max(0, Math.min(value, inv.remainingAmount));
    const newAmounts = { ...invoicePayments, [invId]: clamped };
    setInvoicePayments(newAmounts);
    const total = Object.values(newAmounts).reduce((s, v) => s + v, 0);
    setPaymentAmount(String(total));
  };

  const handleOpenPaymentModal = () => {
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNote('');
    setPaymentMethod('cash');
    setShowAllocation(true);
    setInvoicePayments({});
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !onRecordPayment) return;
    setPaymentSaving(true);
    try {
      const methodLabel = paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt';
      await onRecordPayment({
        amount,
        date: paymentDate,
        description: paymentNote.trim() || `Thanh toán NCC ${supplier.name} (${methodLabel})`,
        method: paymentMethod,
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setInvoicePayments({});
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleOpenAdjustModal = () => {
    setAdjustAmount(String(currentDebt));
    setAdjustDate(new Date().toISOString().slice(0, 10));
    setAdjustNote('');
    setShowAdjustModal(true);
  };

  const handleSubmitAdjustment = async () => {
    const targetDebt = parseFloat(adjustAmount);
    if (isNaN(targetDebt) || !onRecordAdjustment) return;
    setAdjustSaving(true);
    try {
      await onRecordAdjustment({
        targetDebt,
        currentDebt,
        date: adjustDate,
        description: adjustNote.trim() || `Điều chỉnh công nợ NCC ${supplier.name}`,
      });
      setShowAdjustModal(false);
    } finally {
      setAdjustSaving(false);
    }
  };

  const handleOpenDiscountModal = () => {
    setDiscountAmount('');
    setDiscountDate(new Date().toISOString().slice(0, 10));
    setDiscountNote('');
    setDiscountAllocation(false);
    setShowDiscountModal(true);
  };

  const handleSubmitDiscount = async () => {
    const amount = parseFloat(discountAmount);
    if (!amount || amount <= 0 || !onRecordDiscount) return;
    setDiscountSaving(true);
    try {
      await onRecordDiscount({
        amount,
        date: discountDate,
        description: discountNote.trim() || `Chiết khấu từ NCC ${supplier.name}`,
      });
      setShowDiscountModal(false);
    } finally {
      setDiscountSaving(false);
    }
  };

  const currentStaff = getCurrentStaffId();

  const renderInfoTab = () => (
    <div className="p-6 space-y-5">
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
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">Mã phiếu</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">Loại</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">Ngày</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">Số lượng SP</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">Tổng tiền</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-widest text-slate-500">Trạng thái</th>
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
                      <span className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase ${
                        purchase.type === 'Import' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {purchase.type === 'Import' ? 'Nhập hàng' : 'Trả hàng'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(purchase.date)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{purchase.items.length}</td>
                    <td className={`px-4 py-3 text-right ${purchase.type === 'Import' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatMoney(purchase.totalAmount || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase ${
                        purchase.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                        purchase.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {purchase.status === 'cancelled' ? 'Đã hủy' : purchase.status === 'draft' ? 'Phiếu tạm' : 'Đã nhập'}
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

  const renderDebtTab = () => {
    const getDebtTypeBadge = (type: string) => {
      switch (type) {
        case 'purchase': return { label: 'Nhập hàng', cls: 'bg-rose-100 text-rose-700' };
        case 'payment': return { label: 'Thanh toán', cls: 'bg-emerald-100 text-emerald-700' };
        case 'discount': return { label: 'Chiết khấu', cls: 'bg-amber-100 text-amber-700' };
        case 'adjustment': return { label: 'Điều chỉnh', cls: 'bg-blue-100 text-blue-700' };
        default: return { label: type, cls: 'bg-slate-100 text-slate-600' };
      }
    };

    return (
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
                    <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">Mã phiếu</th>
                    <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">Thời gian</th>
                    <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-widest text-slate-500">Loại</th>
                    <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">Giá trị</th>
                    <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">Nợ cần trả NCC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debtsWithBalance.map(debt => {
                    const refCode = /[A-Z]+\d+/.exec(debt.description || '')?.[0] || debt.id.slice(0, 10);
                    const badge = getDebtTypeBadge(debt.type);
                    const isIncrease = debt.type === 'purchase' || (debt.type === 'adjustment' && debt.amount > 0);
                    const displayAmount = debt.type === 'adjustment' ? Math.abs(debt.amount) : debt.amount;
                    return (
                      <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-indigo-600 text-xs font-normal">{refCode}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-sm">{formatDate(debt.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={isIncrease ? 'text-rose-600' : 'text-emerald-600'}>
                            {isIncrease ? '+' : '-'}{displayAmount.toLocaleString('vi-VN')}đ
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium">
                          {debt.runningBalance.toLocaleString('vi-VN')}đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const hasDebtActions = onRecordPayment || onRecordAdjustment || onRecordDiscount;

  return (
    <div className="bg-white animate-in slide-in-from-top-2 duration-200">
      {/* Tabs + close */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center px-4">
          {TABS.map(tab => {
            const count =
              tab.id === 'history' ? supplierTransactions.length :
              tab.id === 'debt' ? debts.length : null;
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
                {tab.label}{count !== null ? ` (${count})` : ''}
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

      {/* Context-sensitive bottom action bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
        {activeTab === 'debt' && hasDebtActions ? (
          <>
            <div />
            <div className="flex items-center gap-2">
              {onRecordAdjustment && (
                <button
                  onClick={handleOpenAdjustModal}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Điều chỉnh
                </button>
              )}
              {onRecordDiscount && (
                <button
                  onClick={handleOpenDiscountModal}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Chiết khấu thanh toán
                </button>
              )}
              {onRecordPayment && (
                <button
                  onClick={handleOpenPaymentModal}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Thanh toán
                </button>
              )}
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* ── POPUP THANH TOÁN ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">Thanh toán</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {supplier.name} · Nợ hiện tại:{' '}
                  <span className="text-rose-600 font-semibold">{formatMoney(currentDebt)}</span>
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Row 1: date + staff */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Thời gian</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Người chi</label>
                  <input
                    type="text"
                    value={currentStaff}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                  />
                </div>
              </div>

              {/* Row 2: payment method */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Phương thức thanh toán</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors bg-white"
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                </select>
              </div>

              {/* Row 3: amount + remaining */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Số tiền</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={e => handlePaymentAmountChange(e.target.value)}
                    placeholder="0"
                    min="0"
                    autoFocus
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Nợ còn lại</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50">
                    <span className={currentDebt - (parseFloat(paymentAmount) || 0) < 0 ? 'text-emerald-600' : 'text-slate-700'}>
                      {formatMoney(Math.max(0, currentDebt - (parseFloat(paymentAmount) || 0)))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Ghi chú</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  placeholder={`Thanh toán NCC ${supplier.name}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              {/* Allocation toggle */}
              {fifoInvoices.length > 0 && (
                <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAllocation}
                    onChange={e => setShowAllocation(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Phân bổ vào phiếu nhập và phiếu mua dịch vụ
                </label>
              )}

              {/* Invoice allocation table */}
              {showAllocation && fifoInvoices.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-2xs font-semibold uppercase text-slate-500">Mã hóa đơn</th>
                        <th className="px-3 py-2.5 text-left text-2xs font-semibold uppercase text-slate-500">Thời gian</th>
                        <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase text-slate-500">Giá trị phiếu</th>
                        <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase text-slate-500">Đã trả trước</th>
                        <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase text-slate-500">Còn cần trả</th>
                        <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase text-slate-500">Tiền trả</th>
                        <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase text-slate-500">Còn nợ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Summary totals row */}
                      <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                        <td colSpan={4} className="px-3 py-2" />
                        <td className="px-3 py-2 text-right">
                          {fifoInvoices.reduce((s, i) => s + i.remainingAmount, 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-3 py-2 text-right">
                          {Object.values(invoicePayments).reduce((s, v) => s + v, 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-3 py-2 text-right">
                          {fifoInvoices
                            .reduce((s, i) => s + Math.max(0, i.remainingAmount - (invoicePayments[i.id] || 0)), 0)
                            .toLocaleString('vi-VN')}đ
                        </td>
                      </tr>
                      {fifoInvoices.map(inv => {
                        const paying = invoicePayments[inv.id] || 0;
                        const stillOwed = Math.max(0, inv.remainingAmount - paying);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <span className="text-indigo-600 text-xs">{inv.refCode}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 text-xs">{formatDate(inv.date)}</td>
                            <td className="px-3 py-2 text-right text-slate-700 text-xs">
                              {inv.totalAmount.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500 text-xs">
                              {inv.alreadyPaid.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700 text-xs">
                              {inv.remainingAmount.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                value={paying || ''}
                                onChange={e => handleInvoicePaymentChange(inv.id, parseFloat(e.target.value) || 0)}
                                min="0"
                                max={inv.remainingAmount}
                                placeholder="0"
                                className="w-28 px-2 py-1 border border-slate-200 rounded text-xs text-right outline-none focus:border-indigo-400 transition-colors"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700 text-xs">
                              {stillOwed.toLocaleString('vi-VN')}đ
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {fifoInvoices.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Không tìm thấy phiếu nhập còn nợ để phân bổ.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-5 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentSaving}
                className="px-5 py-2.5 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paymentSaving ? 'Đang lưu...' : 'Tạo phiếu chi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP ĐIỀU CHỈNH ── */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Điều chỉnh công nợ</h2>
                <p className="text-sm text-slate-500 mt-0.5">{supplier.name}</p>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Current debt info */}
              <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                <span className="text-sm text-slate-600">Nợ cần trả hiện tại</span>
                <span className="text-base font-bold text-rose-600">{formatMoney(currentDebt)}</span>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Ngày điều chỉnh</label>
                <input
                  type="date"
                  value={adjustDate}
                  onChange={e => setAdjustDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Số nợ điều chỉnh thành</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="Nhập số nợ mới"
                  min="0"
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
                {adjustAmount !== '' && !isNaN(parseFloat(adjustAmount)) && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Chênh lệch:{' '}
                    <span className={parseFloat(adjustAmount) - currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {parseFloat(adjustAmount) - currentDebt > 0 ? '+' : ''}{(parseFloat(adjustAmount) - currentDebt).toLocaleString('vi-VN')}đ
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Mô tả</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder={`Điều chỉnh công nợ NCC ${supplier.name}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="px-5 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleSubmitAdjustment}
                disabled={adjustAmount === '' || isNaN(parseFloat(adjustAmount)) || adjustSaving}
                className="px-5 py-2.5 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adjustSaving ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP CHIẾT KHẤU THANH TOÁN ── */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Chiết khấu thanh toán</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {supplier.name} · Nợ hiện tại:{' '}
                  <span className="text-rose-600 font-semibold">{formatMoney(currentDebt)}</span>
                </p>
              </div>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Thời gian</label>
                  <input
                    type="date"
                    value={discountDate}
                    onChange={e => setDiscountDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Người thực hiện</label>
                  <input
                    type="text"
                    value={currentStaff}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Chiết khấu từ nhà cung cấp</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={e => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
                {discountAmount && parseFloat(discountAmount) > 0 && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Nợ còn:{' '}
                    <span className="text-emerald-600 font-medium">
                      {formatMoney(Math.max(0, currentDebt - parseFloat(discountAmount)))}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Ghi chú</label>
                <input
                  type="text"
                  value={discountNote}
                  onChange={e => setDiscountNote(e.target.value)}
                  placeholder={`Chiết khấu từ NCC ${supplier.name}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              {fifoInvoices.length > 0 && (
                <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={discountAllocation}
                    onChange={e => setDiscountAllocation(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Phân bổ vào phiếu nhập hàng
                </label>
              )}

              {discountAllocation && fifoInvoices.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-slate-500">Mã phiếu</th>
                        <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-slate-500">Còn cần trả</th>
                        <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-slate-500">Chiết khấu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fifoInvoices.map(inv => {
                        const total = parseFloat(discountAmount) || 0;
                        const totalRemaining = fifoInvoices.reduce((s, i) => s + i.remainingAmount, 0);
                        const allocated = totalRemaining > 0
                          ? Math.round((inv.remainingAmount / totalRemaining) * total)
                          : 0;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-indigo-600">{inv.refCode}</td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {inv.remainingAmount.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3 py-2 text-right text-amber-600">
                              {allocated.toLocaleString('vi-VN')}đ
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowDiscountModal(false)}
                className="px-5 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleSubmitDiscount}
                disabled={!discountAmount || parseFloat(discountAmount) <= 0 || discountSaving}
                className="px-5 py-2.5 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {discountSaving ? 'Đang lưu...' : 'Tạo phiếu chiết khấu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierDetailView;
