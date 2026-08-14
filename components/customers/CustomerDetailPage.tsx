import React, { useState } from 'react';
import { X, User, Edit2, Trash2, TrendingUp, Phone, Mail, FileText, Lock, CreditCard } from 'lucide-react';
import type { POSCustomer, POSOrder, CustomerDebtRecord } from '../../types';
import { generateId } from '../../src/lib/businessLogic.core';
import { getCurrentStaffId } from '../shared/staff';

type DetailTab = 'info' | 'addresses' | 'orders' | 'debt' | 'points';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'addresses', label: 'Thông tin xuất hóa đơn' },
  { id: 'orders', label: 'Lịch sử bán/trả hàng' },
  { id: 'debt', label: 'Nợ cần thu từ khách' },
  { id: 'points', label: 'Lịch sử tích điểm' },
];

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('vi-VN');
  } catch {
    return d;
  }
};
const fmtDateTime = (d: string) => {
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('vi-VN')} ${dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return d;
  }
};

interface Props {
  customer: POSCustomer;
  customerCode: string;
  orders: POSOrder[];
  customerDebtHistory: CustomerDebtRecord[];
  orderStats: { sold: number; returned: number } | undefined;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAnalyze: () => void;
  onToggleStatus: () => void;
  onRecordPayment?: (record: CustomerDebtRecord) => Promise<void>;
  onRecordAdjustment?: (record: CustomerDebtRecord) => Promise<void>;
  onRecordDiscount?: (record: CustomerDebtRecord) => Promise<void>;
}

const FieldRow: React.FC<{ label: string; value?: string | number | null }> = ({
  label,
  value,
}) => (
  <div className="py-3 border-b border-slate-100">
    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
    <p className={`text-[14px] ${value ? 'text-slate-800' : 'text-slate-400'}`}>
      {value || 'Chưa có'}
    </p>
  </div>
);

const CustomerDetailPage: React.FC<Props> = ({
  customer,
  customerCode,
  orders,
  customerDebtHistory,
  orderStats,
  onClose,
  onEdit,
  onDelete,
  onAnalyze,
  onToggleStatus,
  onRecordPayment,
  onRecordAdjustment,
  onRecordDiscount,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');

  // Thu nợ modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Điều chỉnh modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDate, setAdjustDate] = useState(new Date().toISOString().slice(0, 10));
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Ghi giảm nợ modal
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountDate, setDiscountDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountNote, setDiscountNote] = useState('');
  const [discountSaving, setDiscountSaving] = useState(false);

  const currentStaff = getCurrentStaffId();

  const customerOrders = orders
    .filter(o => o.customerId === customer.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const debtRecords = customerDebtHistory
    .filter(d => d.customerId === customer.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const netSpent = orderStats ? orderStats.sold - orderStats.returned : 0;

  // Nợ = (tiền hàng − khách đưa) theo đơn + các bản ghi điều chỉnh/thu nợ (repay trừ, debt cộng),
  // ép sàn 0. Phải khớp đúng công thức debtStats ở CustomerListPage, nếu không 2 trang lệch nhau.
  const orderDebt = customerOrders.reduce((sum, o) => {
    const finalAmt = Number(o.finalAmount) || 0;
    const cashRecv = Number(o.cashReceived) || 0;
    const debt = finalAmt - cashRecv;
    return sum + (o.isReturn ? -debt : debt);
  }, 0);
  // Bản ghi 'debt' gắn với 1 đơn còn tồn tại đã được tính qua orderDebt ở trên — bỏ qua để
  // tránh đếm trùng, chỉ cộng điều chỉnh nợ thủ công (không gắn đơn) + mọi khoản thu nợ.
  const orderIdSet = new Set(customerOrders.map(o => o.id));
  const recordDelta = debtRecords.reduce((sum, r) => {
    if (r.type === 'debt' && r.orderId && orderIdSet.has(r.orderId)) return sum;
    return sum + (r.type === 'repay' ? -r.amount : r.amount);
  }, 0);
  const customerDebt = Math.max(0, orderDebt + recordDelta);

  const handleOpenPaymentModal = () => {
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNote('');
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !onRecordPayment) return;
    setPaymentSaving(true);
    try {
      const methodLabel = paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt';
      await onRecordPayment({
        id: generateId(),
        customerId: customer.id,
        date: paymentDate,
        type: 'repay',
        amount,
        note: paymentNote.trim() || `Thu nợ ${customer.name} (${methodLabel})`,
      });
      setShowPaymentModal(false);
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleOpenAdjustModal = () => {
    setAdjustAmount(String(customerDebt));
    setAdjustDate(new Date().toISOString().slice(0, 10));
    setAdjustNote('');
    setShowAdjustModal(true);
  };

  const handleSubmitAdjustment = async () => {
    const targetDebt = parseFloat(adjustAmount);
    if (isNaN(targetDebt) || !onRecordAdjustment) return;
    setAdjustSaving(true);
    try {
      const diff = targetDebt - customerDebt;
      await onRecordAdjustment({
        id: generateId(),
        customerId: customer.id,
        date: adjustDate,
        type: diff >= 0 ? 'debt' : 'repay',
        amount: Math.abs(diff),
        note: adjustNote.trim() || `Điều chỉnh công nợ ${customer.name}`,
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
    setShowDiscountModal(true);
  };

  const handleSubmitDiscount = async () => {
    const amount = parseFloat(discountAmount);
    if (!amount || amount <= 0 || !onRecordDiscount) return;
    setDiscountSaving(true);
    try {
      await onRecordDiscount({
        id: generateId(),
        customerId: customer.id,
        date: discountDate,
        type: 'repay',
        amount,
        note: discountNote.trim() || `Ghi giảm nợ ${customer.name}`,
      });
      setShowDiscountModal(false);
    } finally {
      setDiscountSaving(false);
    }
  };

  return (
    <div className="bg-white animate-in slide-in-from-top-2 duration-200">
      {/* Tabs + close */}
      <div className="border-b border-slate-200 bg-white rounded-t-lg">
        <div className="flex items-center px-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-normal border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.id === 'debt' && customerDebt > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                  !
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-h-[600px] overflow-auto bg-slate-50">
        {activeTab === 'info' && (
          <InfoTab
            customer={customer}
            customerCode={customerCode}
            onAnalyze={onAnalyze}
            onEdit={onEdit}
          />
        )}
        {activeTab === 'addresses' && <InvoiceInfoTab customer={customer} />}
        {activeTab === 'orders' && <OrdersTab orders={customerOrders} records={debtRecords} />}
        {activeTab === 'debt' && (
          <DebtTab orders={customerOrders} records={debtRecords} />
        )}
        {activeTab === 'points' && <PointsTab points={customer.points} />}
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
        {activeTab === 'debt' && (onRecordPayment || onRecordAdjustment || onRecordDiscount) ? (
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
                  Ghi giảm nợ
                </button>
              )}
              {onRecordPayment && (
                <button
                  onClick={handleOpenPaymentModal}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Thu nợ
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
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Chỉnh sửa
              </button>
              <button
                onClick={onToggleStatus}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                {customer.status === 'inactive' ? 'Mở hoạt động' : 'Ngừng hoạt động'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── POPUP THU NỢ ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Thu nợ</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {customer.name} · Nợ hiện tại:{' '}
                  <span className="text-rose-600 font-semibold">{fmt(customerDebt)}</span>
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
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
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Người thu</label>
                  <input
                    type="text"
                    value={currentStaff}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Phương thức</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors bg-white"
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Số tiền thu</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    autoFocus
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">Nợ còn lại</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50">
                    <span className={customerDebt - (parseFloat(paymentAmount) || 0) < 0 ? 'text-emerald-600' : 'text-slate-700'}>
                      {fmt(Math.max(0, customerDebt - (parseFloat(paymentAmount) || 0)))}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Ghi chú</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  placeholder={`Thu nợ ${customer.name}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
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
                {paymentSaving ? 'Đang lưu...' : 'Xác nhận thu nợ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP ĐIỀU CHỈNH ── */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Điều chỉnh công nợ</h2>
                <p className="text-sm text-slate-500 mt-0.5">{customer.name}</p>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                <span className="text-sm text-slate-600">Nợ cần thu hiện tại</span>
                <span className="text-base font-bold text-rose-600">{fmt(customerDebt)}</span>
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
                    <span className={parseFloat(adjustAmount) - customerDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {parseFloat(adjustAmount) - customerDebt > 0 ? '+' : ''}{(parseFloat(adjustAmount) - customerDebt).toLocaleString('vi-VN')}đ
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
                  placeholder={`Điều chỉnh công nợ ${customer.name}`}
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

      {/* ── POPUP GHI GIẢM NỢ ── */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Ghi giảm nợ</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {customer.name} · Nợ hiện tại:{' '}
                  <span className="text-rose-600 font-semibold">{fmt(customerDebt)}</span>
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
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Số tiền giảm nợ</label>
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
                    Nợ còn lại:{' '}
                    <span className="text-emerald-600 font-medium">
                      {fmt(Math.max(0, customerDebt - parseFloat(discountAmount)))}
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
                  placeholder={`Ghi giảm nợ ${customer.name}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
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
                {discountSaving ? 'Đang lưu...' : 'Xác nhận ghi giảm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Tab: Thông tin ─────────────────────────────────────────────── */
const InfoTab: React.FC<{
  customer: POSCustomer;
  customerCode: string;
  onAnalyze: () => void;
  onEdit: () => void;
}> = ({
  customer,
  customerCode,
  onAnalyze,
  onEdit,
}) => (
  <div className="p-3 space-y-3">
    {/* Profile header */}
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex gap-5">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="w-10 h-10 text-slate-400 fill-slate-300" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-[18px] font-bold text-slate-900">{customer.name}</h2>
            <span className="text-sm text-slate-400">{customerCode}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
            <span>
              Người tạo: <span className="text-slate-700">{customer.createdBy || '—'}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Ngày tạo:{' '}
              <span className="text-slate-700">
                {customer.createdAt ? fmtDate(customer.createdAt) : '—'}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Nhóm khách:{' '}
              <span className={customer.tier !== 'Standard' ? 'text-slate-700' : 'text-slate-400'}>
                {customer.tier !== 'Standard' ? customer.tier : 'Chưa có'}
              </span>
            </span>
          </div>
          <button
            onClick={onAnalyze}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Xem phân tích
          </button>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">Chi nhánh trung tâm</p>
        </div>
      </div>
    </div>

    {/* Fields */}
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="grid grid-cols-3 gap-x-6">
        <FieldRow label="Điện thoại" value={customer.phone} />
        <FieldRow label="Sinh nhật" value={customer.birthday ? fmtDate(customer.birthday) : null} />
        <FieldRow
          label="Giới tính"
          value={customer.gender === 'male' ? 'Nam' : customer.gender === 'female' ? 'Nữ' : null}
        />
        <FieldRow label="Email" value={customer.email} />
        <FieldRow label="Facebook" value={null} />
        <div />
      </div>
      <FieldRow label="Địa chỉ" value={customer.address} />
    </div>

    {/* Notes */}
    <button
      onClick={onEdit}
      className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
    >
      <FileText className="w-4 h-4" />
      {customer.notes || 'Chưa có ghi chú'}
    </button>
  </div>
);

/* ── Tab: Thông tin xuất hóa đơn ────────────────────────────────── */
const InvoiceInfoTab: React.FC<{ customer: POSCustomer }> = ({ customer }) => {
  const [type, setType] = useState<'individual' | 'organization'>(
    customer.customerType === 'company' ? 'organization' : 'individual'
  );
  const [form, setForm] = useState({
    buyerName: customer.name || '',
    taxCode: customer.taxCode || '',
    companyName: customer.companyName || '',
    address: customer.address || '',
    city: '',
    ward: '',
    cccd: '',
    passport: '',
    unitCode: '',
    email: customer.email || '',
    phone: customer.phone || '',
    bank: '',
    bankAccount: '',
  });
  const upd = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const lookupTaxCode = () => {
    const taxCode = form.taxCode.trim();
    if (!taxCode) {
      window.alert('Vui lòng nhập mã số thuế trước khi tra cứu.');
      return;
    }
    const query = encodeURIComponent(`mã số thuế ${taxCode}`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:border-blue-400';

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      {children}
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      {/* Loại khách hàng */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600 shrink-0">Loại khách hàng</span>
        {(['individual', 'organization'] as const).map(t => (
          <label key={t} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={type === t}
              onChange={() => setType(t)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-slate-700">
              {t === 'individual' ? 'Cá nhân' : 'Tổ chức/ Hộ kinh doanh'}
            </span>
          </label>
        ))}
      </div>

      {type === 'individual' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tên người mua">
              <input
                className={inputCls}
                placeholder="Nhập tên người mua"
                value={form.buyerName}
                onChange={e => upd('buyerName', e.target.value)}
              />
            </Field>
            <Field label="Mã số thuế">
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Nhập mã số thuế"
                  value={form.taxCode}
                  onChange={e => upd('taxCode', e.target.value)}
                />
                <button
                  onClick={lookupTaxCode}
                  className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 whitespace-nowrap shrink-0"
                >
                  Tra cứu MST
                </button>
              </div>
            </Field>
          </div>
          <Field label="Địa chỉ">
            <input
              className={inputCls}
              placeholder="Nhập địa chỉ"
              value={form.address}
              onChange={e => upd('address', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tỉnh/Thành phố">
              <input
                className={inputCls}
                placeholder="Tìm Tỉnh/Thành phố"
                value={form.city}
                onChange={e => upd('city', e.target.value)}
              />
            </Field>
            <Field label="Phường/Xã">
              <input
                className={inputCls}
                placeholder="Tìm Phường/Xã"
                value={form.ward}
                onChange={e => upd('ward', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Số CCCD/CMND">
              <input
                className={inputCls}
                placeholder="Nhập số CCCD/CMND"
                value={form.cccd}
                onChange={e => upd('cccd', e.target.value)}
              />
            </Field>
            <Field label="Số hộ chiếu">
              <input
                className={inputCls}
                placeholder="Nhập số hộ chiếu"
                value={form.passport}
                onChange={e => upd('passport', e.target.value)}
              />
            </Field>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mã số thuế">
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Bắt buộc"
                  value={form.taxCode}
                  onChange={e => upd('taxCode', e.target.value)}
                />
                <button
                  onClick={lookupTaxCode}
                  className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 whitespace-nowrap shrink-0"
                >
                  Tra cứu MST
                </button>
              </div>
            </Field>
            <Field label="Tên công ty">
              <input
                className={inputCls}
                placeholder="Nhập tên công ty"
                value={form.companyName}
                onChange={e => upd('companyName', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Địa chỉ">
            <input
              className={inputCls}
              placeholder="Bắt buộc"
              value={form.address}
              onChange={e => upd('address', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tỉnh/Thành phố">
              <input
                className={inputCls}
                placeholder="Tìm Tỉnh/Thành phố"
                value={form.city}
                onChange={e => upd('city', e.target.value)}
              />
            </Field>
            <Field label="Phường/Xã">
              <input
                className={inputCls}
                placeholder="Tìm Phường/Xã"
                value={form.ward}
                onChange={e => upd('ward', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tên người mua">
              <input
                className={inputCls}
                placeholder="Nhập tên người mua"
                value={form.buyerName}
                onChange={e => upd('buyerName', e.target.value)}
              />
            </Field>
            <Field label="Mã ĐVQHNS">
              <input
                className={inputCls}
                placeholder="Nhập mã đơn vị"
                value={form.unitCode}
                onChange={e => upd('unitCode', e.target.value)}
              />
            </Field>
          </div>
        </>
      )}

      {/* Chung: Email | Phone */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email">
          <input
            className={inputCls}
            placeholder="email@gmail.com"
            value={form.email}
            onChange={e => upd('email', e.target.value)}
          />
        </Field>
        <Field label="Số điện thoại">
          <input
            className={inputCls}
            placeholder="Nhập số điện thoại"
            value={form.phone}
            onChange={e => upd('phone', e.target.value)}
          />
        </Field>
      </div>

      {/* Chung: Bank | Account */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ngân hàng">
          <select
            className={inputCls}
            value={form.bank}
            onChange={e => upd('bank', e.target.value)}
          >
            <option value="">Chọn ngân hàng</option>
            <option>Vietcombank</option>
            <option>Techcombank</option>
            <option>MB Bank</option>
            <option>BIDV</option>
            <option>Agribank</option>
            <option>VPBank</option>
            <option>ACB</option>
            <option>TPBank</option>
          </select>
        </Field>
        <Field label="Số tài khoản ngân hàng">
          <input
            className={inputCls}
            placeholder="Nhập số tài khoản ngân hàng"
            value={form.bankAccount}
            onChange={e => upd('bankAccount', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
};

/* ── Tab: Lịch sử bán/trả hàng ─────────────────────────────────── */
const OrdersTab: React.FC<{ orders: POSOrder[]; records?: CustomerDebtRecord[] }> = ({ orders, records = [] }) => {
  type OrderRow =
    | { kind: 'order'; data: POSOrder }
    | { kind: 'debt'; data: CustomerDebtRecord };

  const rows: OrderRow[] = [
    ...orders.map(o => ({ kind: 'order' as const, data: o })),
    ...records.map(r => ({ kind: 'debt' as const, data: r })),
  ].sort((a, b) => {
    const da = a.kind === 'order' ? a.data.date : a.data.date;
    const db = b.kind === 'order' ? b.data.date : b.data.date;
    return db.localeCompare(da);
  });

  if (rows.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-white rounded-xl border border-slate-200 py-5 px-4 text-center flex items-center gap-3 justify-center">
          <FileText className="w-5 h-5 text-slate-300 shrink-0" />
          <span className="text-sm text-slate-500">Chưa có lịch sử giao dịch</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Mã hóa đơn</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Thời gian</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Người bán</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Giá trị</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => {
              if (row.kind === 'order') {
                const order = row.data;
                return (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{order.orderCode}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDateTime(order.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{order.staffName || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {fmt(order.finalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      {order.isReturn ? (
                        <span className="text-amber-600 font-medium text-xs">Đã trả hàng</span>
                      ) : order.status === 'completed' ? (
                        <span className="text-emerald-600 font-medium text-xs">Hoàn thành</span>
                      ) : (
                        <span className="text-slate-500 font-medium text-xs">{order.status || 'Hoàn thành'}</span>
                      )}
                    </td>
                  </tr>
                );
              } else {
                const r = row.data;
                const prefix = r.type === 'repay' ? 'TN' : 'DC';
                const datePart = r.date.replace(/-/g, '').slice(2);
                const shortId = r.id.replace(/-/g, '').slice(0, 4).toUpperCase();
                const refCode = `${prefix}-${datePart}-${shortId}`;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-indigo-600">{refCode}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 text-slate-400">—</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {fmt(r.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {r.type === 'repay' ? (
                        <span className="text-emerald-600 font-medium text-xs">Thu nợ</span>
                      ) : (
                        <span className="text-slate-500 font-medium text-xs">Ghi nợ</span>
                      )}
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Tab: Nợ cần thu từ khách ───────────────────────────────────── */
const DebtTab: React.FC<{ orders: POSOrder[]; records: CustomerDebtRecord[] }> = ({
  orders,
  records,
}) => {
  type DebtRowType = 'sale' | 'return' | 'repay' | 'debt_manual';

  const getTypeBadge = (type: DebtRowType) => {
    switch (type) {
      case 'sale':        return { label: 'Đơn hàng',   cls: 'bg-rose-100 text-rose-700' };
      case 'return':      return { label: 'Trả hàng',   cls: 'bg-amber-100 text-amber-700' };
      case 'repay':       return { label: 'Thu nợ',     cls: 'bg-emerald-100 text-emerald-700' };
      case 'debt_manual': return { label: 'Ghi nợ',     cls: 'bg-slate-100 text-slate-600' };
    }
  };

  // Build unified rows from orders + manual records
  const orderIdSet = new Set(orders.map(o => o.id));
  const orderRows = orders.map(o => {
    const delta = Math.max(0, (Number(o.finalAmount) || 0) - (Number(o.cashReceived) || 0));
    return {
      id: o.id,
      date: o.date,
      refCode: o.orderCode || o.id.slice(0, 10),
      type: (o.isReturn ? 'return' : 'sale') as DebtRowType,
      delta: o.isReturn ? -delta : delta,
    };
  });

  // Bỏ bản ghi 'debt' gắn với 1 đơn đã có ở orderRows (dòng "Đơn hàng") — nếu giữ sẽ ra 2 dòng
  // (Đơn hàng + Ghi nợ) cho cùng 1 khoản tiền, cộng trùng vào công nợ.
  const manualRows = records
    .filter(r => !(r.type === 'debt' && r.orderId && orderIdSet.has(r.orderId)))
    .map(r => {
      const prefix = r.type === 'repay' ? 'TN' : 'DC';
      const datePart = r.date.replace(/-/g, '').slice(2);
      const shortId = r.id.replace(/-/g, '').slice(0, 4).toUpperCase();
      return {
        id: r.id,
        date: r.date,
        refCode: `${prefix}-${datePart}-${shortId}`,
        type: (r.type === 'repay' ? 'repay' : 'debt_manual') as DebtRowType,
        delta: r.type === 'repay' ? -r.amount : r.amount,
        note: r.note,
      };
    });

  const allRows = [...orderRows, ...manualRows]
    .filter(r => r.delta !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let balance = 0;
  const rowsWithBalance = allRows.map(r => {
    balance += r.delta;
    return { ...r, runningBalance: Math.max(0, balance) };
  });

  const currentDebt = rowsWithBalance[rowsWithBalance.length - 1]?.runningBalance ?? 0;

  return (
    <div className="p-6">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-400">Nợ cần thu hiện tại</p>
        <p className={`mt-1 text-[18px] font-bold ${currentDebt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
          {fmt(currentDebt)}
        </p>
      </div>

      {rowsWithBalance.length === 0 ? (
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
                  <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-widest text-slate-500">Nợ cần thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...rowsWithBalance].reverse().map(row => {
                  const badge = getTypeBadge(row.type);
                  const isIncrease = row.delta > 0;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-indigo-600 text-xs font-normal">{row.refCode}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{fmtDate(row.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={isIncrease ? 'text-rose-600' : 'text-emerald-600'}>
                          {isIncrease ? '+' : '-'}{Math.abs(row.delta).toLocaleString('vi-VN')}đ
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        {row.runningBalance.toLocaleString('vi-VN')}đ
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

/* ── Tab: Lịch sử tích điểm ─────────────────────────────────────── */
const PointsTab: React.FC<{ points: number }> = ({ points }) => (
  <div className="p-4 space-y-2">
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
      <span className="text-sm text-slate-600">Điểm hiện tại</span>
      <span className="text-[16px] font-bold tabular-nums text-amber-600">{fmt(points)}</span>
    </div>
    <div className="bg-white rounded-xl border border-slate-200 py-5 px-4 flex items-center gap-3 justify-center">
      <Mail className="w-5 h-5 text-slate-300 shrink-0" />
      <span className="text-sm text-slate-500">Chưa có lịch sử tích điểm</span>
    </div>
  </div>
);

export default CustomerDetailPage;
