import React from 'react';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  CheckCircle2,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import {
  POSCustomer,
  POSOrderItem,
  POSPaymentAccount,
  POSPaymentChannelSettings,
  POSPaymentSettings,
  POSProduct,
} from '../../types';
import { normalizePOSPaymentSettings } from '../../constants/defaultData';
import { InvoiceTab } from './types';

const PaymentMethodRadio = ({
  method,
  current,
  set,
  label,
}: {
  method: string;
  current: string;
  set: (m: string) => void;
  label: string;
}) => (
  <label className="flex items-center gap-2 cursor-pointer group">
    <div
      onClick={() => set(method)}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${current === method ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}
    >
      {current === method && <div className="w-2 h-2 rounded-full bg-white" />}
    </div>
    <span
      className={`text-sm font-normal ${current === method ? 'text-slate-900' : 'text-slate-600'}`}
    >
      {label}
    </span>
  </label>
);

const QuickCashButton: React.FC<{ amount: number; onClick: () => void }> = ({
  amount,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:border-indigo-400 hover:bg-slate-50 transition-all shadow-sm"
  >
    {amount.toLocaleString()}
  </button>
);

const accountToChannel = (
  account: POSPaymentAccount,
  paymentMethod: string
): POSPaymentChannelSettings => ({
  enabled: account.enabled,
  displayName: account.provider,
  accountLabel: [account.provider, account.accountNumber, account.accountHolder]
    .filter(Boolean)
    .join(' - '),
  actionLabel: paymentMethod === 'Momo' ? 'Hiện mã thanh toán' : 'Hiện mã QR',
  helperText: paymentMethod === 'Momo' ? 'Kiểm tra trạng thái ví?' : 'Nhận thông báo tiền về?',
  qrImage: account.qrImage,
  notes: account.note,
});

const getPaymentAccounts = (
  paymentSettings: POSPaymentSettings,
  paymentMethod: string
): POSPaymentAccount[] => {
  if (paymentMethod === 'Momo')
    return paymentSettings.walletAccounts.filter(account => account.enabled);
  if (paymentMethod === 'Bank')
    return paymentSettings.bankAccounts.filter(account => account.enabled);
  return [];
};

const PROVIDER_TO_BANK_CODE: Record<string, string> = {
  vietcombank: 'VCB',
  vcb: 'VCB',
  techcombank: 'TCB',
  tcb: 'TCB',
  'mb bank': 'MB',
  mb: 'MB',
  mbbank: 'MB',
  'quân đội': 'MB',
  acb: 'ACB',
  bidv: 'BIDV',
  vietinbank: 'ICB',
  vietnbank: 'ICB',
  vtb: 'ICB',
  icb: 'ICB',
  'công thương': 'ICB',
  vpbank: 'VPB',
  vpb: 'VPB',
  sacombank: 'STB',
  stb: 'STB',
  tpbank: 'TPB',
  tpb: 'TPB',
  msb: 'MSB',
  shb: 'SHB',
  'hd bank': 'HDB',
  hdbank: 'HDB',
  hdb: 'HDB',
  ocb: 'OCB',
  lpbank: 'LPB',
  lpb: 'LPB',
  lienvietpostbank: 'LPB',
  seabank: 'SEAB',
  seab: 'SEAB',
  eximbank: 'EIB',
  eib: 'EIB',
  'nam a bank': 'NAB',
  nab: 'NAB',
  ncb: 'NCB',
  bacabank: 'BAB',
  bab: 'BAB',
  kienlongbank: 'KLB',
  klb: 'KLB',
  cake: 'CAKE',
  ubank: 'UBANK',
};

const resolveBankCode = (account: POSPaymentAccount): string => {
  if (account.bankCode) return account.bankCode;
  const key = (account.provider || '').toLowerCase().trim();
  return PROVIDER_TO_BANK_CODE[key] || '';
};

const removeVietnameseDiacritics = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();

const buildVietQrUrl = (account: POSPaymentAccount, amount: number): string | null => {
  const bankCode = resolveBankCode(account);
  if (!bankCode || !account.accountNumber) return null;
  const params = new URLSearchParams();
  if (amount > 0) params.set('amount', String(amount));
  if (account.accountHolder)
    params.set('accountName', removeVietnameseDiacritics(account.accountHolder).toUpperCase());
  params.set('addInfo', 'Thanh toan');
  return `https://img.vietqr.io/image/${bankCode}-${account.accountNumber}-compact2.jpg?${params.toString()}`;
};

const NonCashPaymentPanel: React.FC<{
  fallbackConfig: POSPaymentChannelSettings;
  accounts: POSPaymentAccount[];
  paymentMethod: string;
  amount: number;
}> = ({ fallbackConfig, accounts, paymentMethod, amount }) => {
  const [selectedAccountId, setSelectedAccountId] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [qrExpanded, setQrExpanded] = React.useState(false);
  const selectedAccount = accounts.find(account => account.id === selectedAccountId) || accounts[0];
  const config = selectedAccount
    ? accountToChannel(selectedAccount, paymentMethod)
    : fallbackConfig;
  const dynamicQrUrl =
    selectedAccount && paymentMethod === 'Bank' ? buildVietQrUrl(selectedAccount, amount) : null;
  const qrSrc = dynamicQrUrl || config.qrImage;

  React.useEffect(() => {
    if (!accounts.some(account => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0]?.id || '');
    }
  }, [accounts, selectedAccountId]);

  const { showToast } = useToast();
  const copyPaymentInfo = async () => {
    const text = [
      config.accountLabel,
      amount > 0 ? `Số tiền: ${amount.toLocaleString('vi-VN')}đ` : '',
      config.notes || '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Đã sao chép thông tin thanh toán.', 'success');
    } catch {
      showToast(text, 'info');
    }
  };

  return (
    <>
      {/* QR phóng to overlay */}
      {qrExpanded && qrSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setQrExpanded(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 mx-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={qrSrc}
              alt={config.displayName}
              className="w-72 h-72 object-contain rounded-xl"
            />
            <p className="text-center text-sm text-slate-500 mt-3">Chạm ra ngoài để đóng</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-slate-100 border border-slate-200 p-3 flex gap-3 relative">
        <button
          type="button"
          onClick={() => qrSrc && setQrExpanded(true)}
          className={`h-24 w-24 bg-white rounded-xl border border-slate-200 p-2 shrink-0 ${qrSrc ? 'cursor-pointer hover:border-indigo-300 transition-colors' : ''}`}
        >
          {qrSrc ? (
            <img
              src={qrSrc}
              alt={config.displayName}
              className="h-full w-full object-contain rounded-lg"
            />
          ) : (
            <div className="grid h-full w-full grid-cols-5 gap-1">
              {Array.from({ length: 25 }).map((_, index) => (
                <span
                  key={index}
                  className={`rounded-[2px] ${[0, 1, 2, 5, 10, 11, 12, 14, 17, 18, 20, 22, 23, 24].includes(index) ? 'bg-slate-950' : 'bg-white'}`}
                />
              ))}
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0 space-y-2">
          <button
            type="button"
            onClick={() => accounts.length > 1 && setIsOpen(open => !open)}
            className="w-full h-11 bg-white rounded-xl border border-slate-100 px-4 flex items-center justify-between gap-3 text-left hover:border-indigo-200 transition-colors"
          >
            <span className="text-sm font-normal text-slate-900 truncate">
              {config.accountLabel}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
          </button>
          {isOpen && accounts.length > 1 && (
            <div className="absolute left-[120px] right-3 top-[58px] z-30 rounded-xl border border-slate-100 bg-white shadow-xl overflow-hidden">
              {accounts.map(account => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(account.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-indigo-50 ${selectedAccount?.id === account.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                >
                  <span className="block text-sm font-normal">
                    {account.provider} {account.accountNumber}
                  </span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {account.accountHolder}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => qrSrc && setQrExpanded(true)}
              className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-sm font-normal text-slate-700 hover:border-indigo-200 hover:text-indigo-600 transition-colors flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              {config.actionLabel}
            </button>
            <button
              type="button"
              onClick={copyPaymentInfo}
              className="text-sm font-normal text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
            >
              {config.helperText}
            </button>
          </div>
          {config.notes && (
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
              {config.notes}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

const parseCurrencyInput = (value: string): number => {
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly ? Number(digitsOnly) : 0;
};

const formatSplitCurrency = (value: number): string => value.toLocaleString('en-US');
const formatCurrencyInput = (value: number): string =>
  value > 0 ? formatSplitCurrency(value) : '';

type SplitPayment = { cash: number; bank: number; card: number; momo: number };
type POSStaffOption = { id: string; name: string };

const getSplitPaymentTotal = (splitPayment: SplitPayment): number =>
  splitPayment.cash + splitPayment.bank + splitPayment.card + splitPayment.momo;

interface POSCheckoutProps {
  // Customer
  customerSearch: string;
  setCustomerSearch: (v: string) => void;
  customerSearchRef: React.RefObject<HTMLInputElement>;
  selectedCustomer: POSCustomer | null;
  filteredCustomers: POSCustomer[];
  onSelectCustomer: (c: POSCustomer) => void;
  onClearCustomer: () => void;
  onOpenAddCustomer: () => void;
  // Cart data
  mode: 'sales' | 'return';
  cart: POSOrderItem[];
  returnCart: POSOrderItem[];
  products: POSProduct[];
  // Computed totals
  totalBeforeDiscount: number;
  totalDiscount: number;
  netPayable: number;
  otherFees: number;
  totalReturnBeforeDiscount: number;
  finalReturnAmount: number;
  amountToPayCustomer: number;
  customerPaysDifference: number;
  returnDiscount: number;
  returnFee: number;
  returnOtherRefund: number;
  currentCashReceived: number;
  isDebtMode: boolean;
  pointsEarned: number;
  // Payment
  paymentMethod: string;
  paymentSettings?: POSPaymentSettings;
  useSplitPayment: boolean;
  setUseSplitPayment: (v: boolean) => void;
  splitPayment: SplitPayment;
  cashSuggestions: number[];
  staffOptions?: POSStaffOption[];
  currentStaffId?: string;
  currentStaffName?: string;
  onCurrentStaffChange?: (staffId: string) => void;
  // Actions
  onUpdateTab: (updates: Partial<InvoiceTab>) => void;
  onBillDiscountClick: (rect: DOMRect) => void;
  onCheckout: () => void;
  isCheckoutLocked?: boolean;
  isEditMode?: boolean;
}

const POSCheckout: React.FC<POSCheckoutProps> = ({
  customerSearch,
  setCustomerSearch,
  customerSearchRef,
  selectedCustomer,
  filteredCustomers,
  onSelectCustomer,
  onClearCustomer,
  onOpenAddCustomer,
  mode,
  cart,
  returnCart,
  products,
  totalBeforeDiscount,
  totalDiscount,
  netPayable,
  otherFees,
  totalReturnBeforeDiscount,
  finalReturnAmount,
  amountToPayCustomer,
  customerPaysDifference,
  returnDiscount,
  returnFee,
  returnOtherRefund,
  currentCashReceived,
  isDebtMode,
  pointsEarned,
  paymentMethod,
  paymentSettings,
  useSplitPayment,
  setUseSplitPayment,
  splitPayment,
  cashSuggestions,
  staffOptions = [],
  currentStaffId,
  currentStaffName = 'Nhân viên',
  onCurrentStaffChange,
  onUpdateTab,
  onBillDiscountClick,
  onCheckout,
  isCheckoutLocked = false,
  isEditMode = false,
}) => {
  const [showPaymentMore, setShowPaymentMore] = React.useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = React.useState(false);
  const staffDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showStaffDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(e.target as Node)) {
        setShowStaffDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStaffDropdown]);
  const resolvedPaymentSettings = normalizePOSPaymentSettings(paymentSettings);
  const canUseSplitPayment = resolvedPaymentSettings.allowSplitPayment;
  const isSplitPaymentActive = canUseSplitPayment && useSplitPayment;
  const paymentAccounts = getPaymentAccounts(resolvedPaymentSettings, paymentMethod);
  const nonCashFallback =
    paymentMethod === 'Momo'
      ? resolvedPaymentSettings.wallet
      : paymentMethod === 'Other' || paymentMethod === 'Card'
        ? resolvedPaymentSettings.card
        : resolvedPaymentSettings.bank;
  const paymentMethods = React.useMemo(() => {
    const enabled = resolvedPaymentSettings.enabledMethods ?? ['Cash', 'Bank', 'Other', 'Momo'];
    return [
      { method: 'Cash' as const, label: 'Tiền mặt', enabled: enabled.includes('Cash') },
      {
        method: 'Bank' as const,
        label: resolvedPaymentSettings.bank.displayName || 'Chuyển khoản',
        enabled:
          enabled.includes('Bank') && resolvedPaymentSettings.bankAccounts.some(a => a.enabled),
      },
      {
        method: 'Card' as const,
        label: resolvedPaymentSettings.card.displayName || 'Thẻ',
        enabled: (enabled.includes('Card') || enabled.includes('Other')) && resolvedPaymentSettings.card.enabled,
      },
      {
        method: 'Momo' as const,
        label: resolvedPaymentSettings.wallet.displayName || 'Ví',
        enabled:
          enabled.includes('Momo') && resolvedPaymentSettings.walletAccounts.some(a => a.enabled),
      },
    ];
  }, [resolvedPaymentSettings]);
  const splitPaymentMethods = React.useMemo(
    () =>
      [
        { key: 'cash' as const, label: 'Tiền mặt', enabled: true },
        {
          key: 'bank' as const,
          label: resolvedPaymentSettings.bank.displayName || 'Chuyển khoản',
          enabled: resolvedPaymentSettings.bankAccounts.some(account => account.enabled),
        },
        {
          key: 'card' as const,
          label: resolvedPaymentSettings.card.displayName || 'Thẻ',
          enabled: resolvedPaymentSettings.card.enabled,
        },
        {
          key: 'momo' as const,
          label: resolvedPaymentSettings.wallet.displayName || 'Ví',
          enabled: resolvedPaymentSettings.walletAccounts.some(account => account.enabled),
        },
      ].filter(method => method.enabled),
    [resolvedPaymentSettings]
  );
  const hasCheckoutItems =
    mode === 'return'
      ? returnCart.some(item => item.quantity > 0) || cart.length > 0
      : cart.length > 0;
  // Kiểm tra xem có sản phẩm nào trong giỏ được thiết lập tích điểm không
  const pointsEligibleProductIds = React.useMemo(
    () =>
      new Set(products.filter(product => product.allowPoints !== false).map(product => product.id)),
    [products]
  );
  const hasPointsEligibleProducts = cart.some(item => pointsEligibleProductIds.has(item.productId));

  // Chỉ hiển thị điểm thưởng khi có khách hàng VÀ có sản phẩm tích điểm
  const shouldShowPoints = selectedCustomer !== null && hasPointsEligibleProducts;

  React.useEffect(() => {
    if (!canUseSplitPayment && useSplitPayment) {
      setUseSplitPayment(false);
    }
  }, [canUseSplitPayment, setUseSplitPayment, useSplitPayment]);

  const editOtherFees = () => {
    const raw = window.prompt('Nhập phí khác', otherFees > 0 ? String(otherFees) : '');
    if (raw === null) return;
    onUpdateTab({ otherFees: parseCurrencyInput(raw) });
  };

  return (
    <div
      className="w-[480px] bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden relative z-20"
      style={{
        width: '480px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Active User Header */}
      <div className="px-4 h-10 flex items-center justify-between bg-white border-b border-slate-100">
        <div ref={staffDropdownRef} className="relative flex items-center gap-2 group">
          <button
            type="button"
            onClick={() => setShowStaffDropdown(value => !value)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-slate-50"
          >
            <span className="text-xs font-normal text-slate-700">{currentStaffName}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition ${showStaffDropdown ? 'rotate-180' : ''}`}
            />
          </button>
          {showStaffDropdown && (
            <div className="absolute left-0 top-[calc(100%+4px)] z-modal min-w-[150px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              {staffOptions.map(staff => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => {
                    onCurrentStaffChange?.(staff.id);
                    setShowStaffDropdown(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-xs transition hover:bg-indigo-50 ${
                    staff.id === currentStaffId
                      ? 'font-semibold text-indigo-600'
                      : 'font-normal text-slate-700'
                  }`}
                >
                  {staff.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="text-2xs font-normal text-slate-500">
          {new Date().toLocaleDateString('vi-VN')}{' '}
          {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Customer Search Section */}
      <div className="p-3 border-b border-slate-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            ref={customerSearchRef}
            type="text"
            placeholder="Tìm khách hàng (F4)"
            className="w-full pl-9 pr-10 py-1.5 bg-slate-100 border border-slate-100 rounded-lg text-sm font-normal outline-none focus:bg-white focus:border-indigo-300 transition-all"
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
          />
          <button
            onClick={onOpenAddCustomer}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all"
            title="Thêm khách hàng mới"
          >
            <Plus className="h-5 w-5" />
          </button>

          {/* Customer Dropdown */}
          {!selectedCustomer && filteredCustomers.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-100 z-modal mt-1 animate-in fade-in slide-in-from-top-2">
              <div className="p-2 bg-slate-50/50 border-b border-slate-100 text-[8px] font-normal uppercase text-slate-400 tracking-wider">
                Kết quả tìm kiếm
              </div>
              <div className="max-h-[200px] overflow-y-auto no-scrollbar">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    className="w-full px-4 py-2 text-left hover:bg-indigo-50/50 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-all"
                    onClick={() => onSelectCustomer(c)}
                  >
                    <div>
                      <div className="font-normal text-xs text-slate-800 group-hover:text-indigo-700 uppercase">
                        {c.name}
                      </div>
                      <div className="text-[9px] text-slate-400 font-normal group-hover:text-indigo-400 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-indigo-300"></span>
                        {c.phone}
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-slate-200 group-hover:text-indigo-300" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Customer Card */}
        {selectedCustomer && (
          <div className="mt-2 bg-indigo-50/50 border border-indigo-100 p-2 rounded-xl flex items-center justify-between animate-in zoom-in-95 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-normal text-xs shadow-md">
                {selectedCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-normal text-indigo-950 uppercase tracking-tight leading-none">
                  {selectedCustomer.name}
                </div>
                <div className="text-[9px] font-normal text-indigo-500/80 flex items-center gap-2 mt-1">
                  <span>{selectedCustomer.phone}</span>
                  <span className="w-1 h-1 rounded-full bg-indigo-200"></span>
                  <span>ĐIỂM: {selectedCustomer.points.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClearCustomer}
              className="h-6 w-6 flex items-center justify-center text-indigo-300 hover:text-rose-500 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Billing Values */}
      <div className="flex-1 p-4 flex flex-col font-normal overflow-y-auto no-scrollbar relative space-y-4">
        {mode === 'return' ? (
          <>
            {/* Trả hàng Section */}
            <div>
              <h3 className="text-emerald-500 font-semibold text-lg mb-2 uppercase tracking-tight">
                Trả hàng
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-normal">Tổng tiền hàng trả</span>
                  <div className="flex items-center gap-4">
                    <span className="font-normal text-slate-400">
                      {returnCart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                    <span className="font-normal text-slate-900">
                      {totalReturnBeforeDiscount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div
                  className="flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 py-0.5 transition-colors"
                  onClick={() => {
                    const raw = window.prompt('Nhập giảm giá trả hàng', returnDiscount > 0 ? String(returnDiscount) : '');
                    if (raw === null) return;
                    onUpdateTab({ returnDiscount: parseCurrencyInput(raw) });
                  }}
                >
                  <span className="text-slate-600 font-normal">Giảm giá</span>
                  <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                  <span className="font-normal text-slate-900 border-b border-dashed border-slate-300 min-w-[48px] text-right">
                    {returnDiscount > 0 ? returnDiscount.toLocaleString() : '0'}
                  </span>
                </div>
                <div
                  className="flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 py-0.5 transition-colors"
                  onClick={() => {
                    const raw = window.prompt('Nhập phí trả hàng', returnFee > 0 ? String(returnFee) : '');
                    if (raw === null) return;
                    onUpdateTab({ returnFee: parseCurrencyInput(raw) });
                  }}
                >
                  <span className="text-slate-600 font-normal">Phí trả hàng</span>
                  <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                  <span className="font-normal text-slate-900 border-b border-dashed border-slate-300 min-w-[48px] text-right">
                    {returnFee > 0 ? returnFee.toLocaleString() : '0'}
                  </span>
                </div>
                <div
                  className="flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 py-0.5 transition-colors"
                  onClick={() => {
                    const raw = window.prompt('Nhập hoàn trả thu khác', returnOtherRefund > 0 ? String(returnOtherRefund) : '');
                    if (raw === null) return;
                    onUpdateTab({ returnOtherRefund: parseCurrencyInput(raw) });
                  }}
                >
                  <span className="text-slate-600 font-normal">Hoàn trả thu khác</span>
                  <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                  <span className="font-normal text-slate-900 border-b border-dashed border-slate-300 min-w-[48px] text-right">
                    {returnOtherRefund > 0 ? returnOtherRefund.toLocaleString() : '0'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-xs font-normal uppercase text-slate-400">
                    Tổng tiền trả
                  </span>
                  <span className="text-lg font-normal text-slate-950">
                    {finalReturnAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 border-b-2 border-dotted border-slate-200 my-2" />

            {/* Mua hàng Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-emerald-500 font-semibold text-lg uppercase tracking-tight">
                  Mua hàng
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-normal">Tổng tiền hàng</span>
                  <div className="flex items-center gap-4">
                    <span className="font-normal text-slate-400">
                      {cart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                    <span className="font-normal text-slate-900">
                      {totalBeforeDiscount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-normal">Giảm giá</span>
                  <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                  <span className="font-normal text-slate-900">
                    -{totalDiscount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-normal">Thu khác</span>
                  <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                  <span className="font-normal text-slate-900">{otherFees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-xs font-normal uppercase text-slate-400">
                    Tổng tiền mua
                  </span>
                  <span className="text-lg font-normal text-slate-950">
                    {netPayable.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {finalReturnAmount > 0 && (
              <div className="pt-4">
                {customerPaysDifference > 0 ? (
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-sm font-normal uppercase text-slate-950 tracking-tight">
                      Khách thanh toán
                    </span>
                    <div className="flex-1 border-b-2 border-slate-200 mx-6" />
                    <span className="text-xl font-normal text-slate-400 tabular-nums">
                      {customerPaysDifference.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-sm font-normal uppercase text-slate-950 tracking-tight">
                      Tiền trả khách
                    </span>
                    <div className="flex-1 border-b-2 border-slate-200 mx-6" />
                    <span className="text-xl font-normal text-slate-400 tabular-nums">
                      {amountToPayCustomer.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2 flex flex-col flex-1">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-sm font-normal text-slate-600 uppercase tracking-wide">
                Tiền hàng
              </span>
              <div className="flex items-center gap-6">
                <span className="text-sm font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
                <span className="text-sm font-normal text-slate-900 tabular-nums">
                  {totalBeforeDiscount.toLocaleString()}
                </span>
              </div>
            </div>

            <div
              className="flex justify-between items-center py-0.5 pt-1 border-t border-slate-50 cursor-pointer group"
              onClick={e =>
                onBillDiscountClick((e.currentTarget as HTMLDivElement).getBoundingClientRect())
              }
            >
              <span className="text-sm font-normal text-slate-600 uppercase tracking-wide">
                Giảm giá
              </span>
              <span className="text-sm font-normal text-slate-700 tabular-nums border-b border-dashed border-slate-300 w-32 text-right">
                -{totalDiscount.toLocaleString()}
              </span>
            </div>

            <div
              className="flex justify-between items-center py-0.5 border-b border-slate-50 pb-1 cursor-pointer group"
              onClick={editOtherFees}
            >
              <span className="text-sm font-normal text-slate-600 uppercase tracking-wide">
                Phí khác
              </span>
              <span className="text-sm font-normal text-slate-900 tabular-nums border-b border-dashed border-slate-300 w-32 text-right">
                {otherFees.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 bg-indigo-50/30 px-3 rounded-xl border border-indigo-100">
              <span className="text-xs font-normal text-indigo-900 uppercase tracking-widest">
                Cần thanh toán
              </span>
              <span className="text-xl font-normal text-indigo-600 tracking-tighter italic">
                {netPayable.toLocaleString()}
              </span>
            </div>

            {paymentMethod === 'Cash' && (
              <div className="flex justify-between items-center pt-2 px-1">
                <span className="text-sm font-normal text-slate-500 uppercase tracking-wider">
                  Khách đưa
                </span>
                <span className="text-lg font-normal text-slate-900 tabular-nums">
                  {currentCashReceived.toLocaleString()}
                </span>
              </div>
            )}

            {hasCheckoutItems && (
            <div className="pt-1 space-y-3">
              {/* Toggle Split Payment */}
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-normal text-slate-500 uppercase tracking-wider">
                  Phương thức thanh toán
                </span>
                {canUseSplitPayment && (
                  <button
                    onClick={() => setUseSplitPayment(!useSplitPayment)}
                    className="text-2xs font-normal text-indigo-600 hover:text-indigo-700 uppercase tracking-wide flex items-center gap-1"
                  >
                    {useSplitPayment ? '← Đơn giản' : 'Chia nhiều →'}
                  </button>
                )}
              </div>

              {!isSplitPaymentActive ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    {paymentMethods
                      .filter(method => method.enabled)
                      .map(({ method, label }) => (
                        <PaymentMethodRadio
                          key={method}
                          method={method}
                          current={paymentMethod}
                          set={m =>
                            onUpdateTab({ paymentMethod: m as InvoiceTab['paymentMethod'] })
                          }
                          label={label}
                        />
                      ))}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPaymentMore(open => !open)}
                        className="text-slate-400 hover:text-slate-600 px-1"
                        title="Tùy chọn thanh toán"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {showPaymentMore && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setShowPaymentMore(false)}
                          />
                          <div className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateTab({ cashReceived: netPayable, isDebtMode: false });
                                setShowPaymentMore(false);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              Nhận đúng số tiền
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateTab({
                                  cashReceived: 0,
                                  isDebtMode: false,
                                  splitPayment: { cash: 0, bank: 0, card: 0, momo: 0 },
                                });
                                setShowPaymentMore(false);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              Xóa tiền đã nhận
                            </button>
                            {selectedCustomer && mode === 'sales' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateTab({ isDebtMode: true, cashReceived: 0 });
                                  setShowPaymentMore(false);
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
                              >
                                Chuyển sang ghi nợ
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {paymentMethod === 'Cash' ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {cashSuggestions.map((amount, idx) => (
                          <QuickCashButton
                            key={idx}
                            amount={amount}
                            onClick={() => onUpdateTab({ cashReceived: amount, isDebtMode: false })}
                          />
                        ))}
                      </div>
                      {selectedCustomer && mode === 'sales' && (
                        <button
                          onClick={() => onUpdateTab({ isDebtMode: !isDebtMode, cashReceived: 0 })}
                          className={`w-full py-2 rounded-xl text-xs font-normal uppercase tracking-wider border transition-all ${
                            isDebtMode
                              ? 'bg-rose-50 border-rose-300 text-rose-600'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-500'
                          }`}
                        >
                          {isDebtMode ? '✓ Đang ghi nợ — Bấm để huỷ' : 'Ghi nợ khách hàng'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <NonCashPaymentPanel
                      fallbackConfig={nonCashFallback}
                      accounts={paymentAccounts}
                      paymentMethod={paymentMethod}
                      amount={netPayable}
                    />
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-normal text-slate-500 uppercase tracking-wider">
                      Chia thanh toán
                    </span>
                    <span className="text-xs font-normal text-slate-400">
                      Nhập số tiền theo từng phương thức
                    </span>
                  </div>

                  <div className="space-y-2">
                    {splitPaymentMethods.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between gap-4 py-0.5">
                        <span className="text-sm font-normal text-slate-600 uppercase tracking-wide shrink-0">
                          {label}
                        </span>
                        <div className="w-44 h-10 rounded-xl border border-slate-200 bg-white px-3 flex items-center gap-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatCurrencyInput(splitPayment[key])}
                            onChange={e =>
                              onUpdateTab({
                                splitPayment: {
                                  ...splitPayment,
                                  [key]: parseCurrencyInput(e.target.value),
                                },
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent border-0 text-sm font-normal text-slate-900 outline-none text-right tabular-nums"
                            placeholder="0"
                          />
                          <span className="text-xs font-normal text-slate-400 shrink-0">đ</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs font-normal text-slate-700 uppercase tracking-wider">
                      Tổng đã nhận
                    </span>
                    <span
                      className={`text-base font-normal tabular-nums ${
                        getSplitPaymentTotal(splitPayment) >= netPayable
                          ? 'text-emerald-600'
                          : 'text-rose-500'
                      }`}
                    >
                      {formatSplitCurrency(getSplitPaymentTotal(splitPayment))}đ
                    </span>
                  </div>

                  {(() => {
                    const totalReceived = getSplitPaymentTotal(splitPayment);
                    const diff = totalReceived - netPayable;
                    if (diff < 0)
                      return (
                        <div className="flex items-center justify-between py-1.5 px-2 bg-rose-50 border border-rose-100 rounded-lg">
                          <span className="text-2xs font-normal text-rose-700 uppercase tracking-wider">
                            Còn thiếu
                          </span>
                          <span className="text-sm font-normal text-rose-600 tabular-nums">
                            {formatSplitCurrency(Math.abs(diff))}đ
                          </span>
                        </div>
                      );
                    if (diff > 0)
                      return (
                        <div className="flex items-center justify-between py-1.5 px-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                          <span className="text-2xs font-normal text-emerald-700 uppercase tracking-wider">
                            Tiền thừa
                          </span>
                          <span className="text-sm font-normal text-emerald-600 tabular-nums">
                            {formatSplitCurrency(diff)}đ
                          </span>
                        </div>
                      );
                    return null;
                  })()}
                </div>
              )}

              {/* Tiền thừa cho Single Payment Mode */}
              {!isSplitPaymentActive && !isDebtMode && currentCashReceived > netPayable && (
                <div className="flex justify-between items-center py-1.5 px-3 bg-emerald-50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-top-1">
                  <span className="text-xs font-normal text-emerald-800 uppercase tracking-widest">
                    Tiền thừa
                  </span>
                  <span className="text-lg font-normal text-emerald-600 tabular-nums">
                    {(currentCashReceived - netPayable).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Tính vào công nợ */}
              {!isSplitPaymentActive && isDebtMode && selectedCustomer && mode === 'sales' && (
                <div className="flex justify-between items-center py-1.5 px-3 bg-rose-50 border border-rose-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                  <span className="text-xs font-normal text-rose-700 uppercase tracking-widest">
                    Tính vào công nợ
                  </span>
                  <span className="text-lg font-normal text-rose-600 tabular-nums">
                    -{netPayable.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </div>

      {/* Checkout Button */}
      <div className="p-4 shrink-0 bg-white border-t border-slate-100">
        <button
          onClick={onCheckout}
          disabled={!hasCheckoutItems || isCheckoutLocked}
          className={`w-full py-4 bg-slate-950 hover:bg-slate-900 text-white rounded-[1.5rem] font-normal shadow-xl active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-0.5 group px-4 ${!hasCheckoutItems || isCheckoutLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-lg tracking-widest uppercase">
              {isCheckoutLocked ? 'ĐANG XỬ LÝ' : isEditMode ? 'LƯU (F9)' : 'THANH TOÁN (F9)'}
            </span>
          </div>
          {shouldShowPoints && (
            <span className="text-[9px] font-normal text-slate-500 uppercase tracking-widest">
              + {pointsEarned.toLocaleString()} ĐIỂM THƯỞNG
            </span>
          )}
        </button>
        <p className="text-center text-[7px] text-slate-300 mt-3 uppercase font-normal tracking-[0.4em] opacity-40 italic">
          CFO Brain POS • v2.0 Terminal
        </p>
      </div>
    </div>
  );
};
export default POSCheckout;
