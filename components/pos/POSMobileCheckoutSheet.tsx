import React, { useState, useEffect } from 'react';
import { X, User, Search, Check, ChevronDown } from 'lucide-react';
import { POSCustomer, POSOrderItem } from '../../types';

type PaymentMethod = 'Cash' | 'Bank' | 'Momo' | 'Other' | 'Card';

interface POSMobileCheckoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cart: POSOrderItem[];
  netPayable: number;
  totalBeforeDiscount: number;
  totalDiscount: number;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cashReceived: number;
  onCashReceivedChange: (amount: number) => void;
  cashSuggestions: number[];
  selectedCustomer: POSCustomer | null;
  customerSearch: string;
  setCustomerSearch: (v: string) => void;
  filteredCustomers: POSCustomer[];
  onSelectCustomer: (c: POSCustomer) => void;
  onClearCustomer: () => void;
  onConfirm: () => void;
  isCheckoutLocked: boolean;
  isEditMode?: boolean;
}

const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; emoji: string }[] = [
  { key: 'Cash', label: 'Tiền mặt', emoji: '💵' },
  { key: 'Bank', label: 'Chuyển khoản', emoji: '🏦' },
  { key: 'Momo', label: 'Momo', emoji: '💜' },
];

const POSMobileCheckoutSheet: React.FC<POSMobileCheckoutSheetProps> = ({
  isOpen,
  onClose,
  cart,
  netPayable,
  totalBeforeDiscount,
  totalDiscount,
  paymentMethod,
  onPaymentMethodChange,
  cashReceived,
  onCashReceivedChange,
  cashSuggestions,
  selectedCustomer,
  customerSearch,
  setCustomerSearch,
  filteredCustomers,
  onSelectCustomer,
  onClearCustomer,
  onConfirm,
  isCheckoutLocked,
  isEditMode = false,
}) => {
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const isCash = paymentMethod === 'Cash';
  const effectiveCash = cashReceived > 0 ? cashReceived : netPayable;
  const change = effectiveCash - netPayable;

  useEffect(() => {
    if (!isOpen) setShowCustomerSearch(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl max-h-[92vh] flex flex-col">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800 text-lg">{isEditMode ? 'Lưu thay đổi' : 'Thanh toán'}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5 pb-8">
          {/* Order Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            {cart.map(item => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="text-slate-600 flex-1 truncate pr-2">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-semibold text-slate-800 shrink-0">{fmt(item.total)}</span>
              </div>
            ))}
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="text-emerald-600">Giảm giá</span>
                <span className="text-emerald-600 font-semibold">-{fmt(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-slate-200">
              <span className="text-slate-800">Cần trả</span>
              <span className="text-indigo-600">{fmt(netPayable)}</span>
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Khách hàng (tùy chọn)
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-indigo-50 rounded-2xl px-4 py-3 border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{selectedCustomer.name}</p>
                    <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <button
                  onClick={onClearCustomer}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-400 hover:border-slate-300"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Tìm khách hàng...</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showCustomerSearch ? 'rotate-180' : ''}`}
                  />
                </button>
                {showCustomerSearch && (
                  <div className="mt-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        placeholder="Tên hoặc số điện thoại..."
                        autoFocus
                        className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400"
                      />
                    </div>
                    {filteredCustomers.length > 0 && (
                      <div className="mt-1 bg-white border border-slate-100 rounded-xl shadow max-h-44 overflow-y-auto">
                        {filteredCustomers.slice(0, 10).map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              onSelectCustomer(c);
                              setShowCustomerSearch(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-50 last:border-0 text-left"
                          >
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                              <p className="font-semibold text-sm text-slate-800">{c.name}</p>
                              <p className="text-xs text-slate-400">{c.phone}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Phương thức thanh toán
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(method => {
                const active = paymentMethod === method.key;
                return (
                  <button
                    key={method.key}
                    onClick={() => onPaymentMethodChange(method.key)}
                    className={`flex flex-col items-center py-3.5 px-2 rounded-2xl border-2 transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <span className="text-2xl mb-1">{method.emoji}</span>
                    <span className="text-xs font-bold text-center leading-tight">
                      {method.label}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash received */}
          {isCash && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Tiền khách đưa
              </label>
              <input
                type="number"
                value={cashReceived || ''}
                onChange={e => onCashReceivedChange(Number(e.target.value))}
                placeholder={String(netPayable)}
                inputMode="numeric"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold outline-none focus:border-indigo-400 focus:bg-white transition-colors"
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {cashSuggestions
                  .filter(s => s > 0)
                  .slice(0, 6)
                  .map(s => (
                    <button
                      key={s}
                      onClick={() => onCashReceivedChange(s)}
                      className={`py-2.5 px-1 rounded-xl text-xs font-bold border transition-all ${
                        cashReceived === s
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {s >= 1000000
                        ? (s / 1000000).toFixed(s % 1000000 === 0 ? 0 : 1) + 'tr'
                        : (s / 1000).toFixed(0) + 'k'}
                    </button>
                  ))}
              </div>
              {cashReceived > 0 && (
                <div
                  className={`mt-3 flex justify-between px-4 py-3 rounded-xl font-bold text-sm ${
                    change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  <span>{change >= 0 ? 'Tiền thừa trả khách' : 'Còn thiếu'}</span>
                  <span>{fmt(Math.abs(change))}</span>
                </div>
              )}
            </div>
          )}

          {/* Confirm */}
          <button
            onClick={onConfirm}
            disabled={isCheckoutLocked || cart.length === 0}
            className="w-full py-4 bg-indigo-600 text-white font-semibold text-base rounded-2xl disabled:opacity-50 active:bg-indigo-700 transition-colors"
          >
            {isCheckoutLocked ? 'Đang xử lý...' : `${isEditMode ? 'Lưu' : 'Xác nhận'} · ${fmt(netPayable)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSMobileCheckoutSheet;
