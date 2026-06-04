import React, { useState } from 'react';
import {
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_POS_PAYMENT_SETTINGS,
  normalizePOSPaymentSettings,
} from '../../../constants/defaultData';
import type {
  POSPaymentAccount,
  POSPaymentAccountType,
  POSPaymentMethod,
  POSPaymentSettings,
} from '../../../types';

interface PaymentsTabProps {
  settings: POSPaymentSettings;
  onSave: (settings: POSPaymentSettings) => Promise<void>;
}

const VIET_BANKS: { code: string; name: string }[] = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VTB', name: 'VietinBank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'MSB', name: 'MSB' },
  { code: 'SHB', name: 'SHB' },
  { code: 'HDB', name: 'HD Bank' },
  { code: 'OCB', name: 'OCB' },
  { code: 'LPB', name: 'LPBank' },
  { code: 'SEAB', name: 'SeABank' },
  { code: 'EIB', name: 'Eximbank' },
  { code: 'NAB', name: 'Nam A Bank' },
  { code: 'NCB', name: 'NCB' },
  { code: 'BAB', name: 'BacABank' },
  { code: 'KLB', name: 'Kienlongbank' },
  { code: 'CAKE', name: 'CAKE' },
  { code: 'UBANK', name: 'Ubank' },
  { code: 'TPBANK', name: 'TIMO (TPBank)' },
];

const emptyPaymentAccount = (type: POSPaymentAccountType): POSPaymentAccount => ({
  id: '',
  type,
  accountNumber: '',
  provider: '',
  bankCode: '',
  accountHolder: '',
  scope: 'Toàn hệ thống',
  note: '',
  qrImage: '',
  enabled: true,
});

const Section: React.FC<{
  id?: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ id, title, description, icon: Icon, children }) => (
  <section
    id={id}
    className="scroll-mt-6 bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden"
  >
    <div className="min-h-[88px] px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && (
          <p className="min-h-10 text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const PaymentsTab: React.FC<PaymentsTabProps> = ({ settings, onSave }) => {
  const [paymentForm, setPaymentForm] = useState<POSPaymentSettings>(
    normalizePOSPaymentSettings(settings)
  );
  const [paymentSaveStatus, setPaymentSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [paymentAccountTab, setPaymentAccountTab] = useState<POSPaymentAccountType>('bank');
  const [editingAccount, setEditingAccount] = useState<POSPaymentAccount | null>(null);
  const [accountModalTab, setAccountModalTab] = useState<'info' | 'scope'>('info');

  const savePaymentSettings = async (settingsToSave: POSPaymentSettings = paymentForm) => {
    setPaymentSaveStatus('saving');
    try {
      await onSave(settingsToSave);
      setPaymentSaveStatus('saved');
      setTimeout(() => setPaymentSaveStatus('idle'), 2000);
    } catch {
      setPaymentSaveStatus('error');
      setTimeout(() => setPaymentSaveStatus('idle'), 2500);
    }
  };

  const openPaymentAccountModal = (type: POSPaymentAccountType, account?: POSPaymentAccount) => {
    setPaymentAccountTab(type);
    setEditingAccount(account ? { ...account } : emptyPaymentAccount(type));
    setAccountModalTab('info');
  };

  const updateEditingAccount = <K extends keyof POSPaymentAccount>(
    key: K,
    value: POSPaymentAccount[K]
  ) => {
    setEditingAccount(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveEditingAccount = () => {
    if (!editingAccount) return;
    const account: POSPaymentAccount = {
      ...editingAccount,
      id: editingAccount.id || `${editingAccount.type}-${Date.now()}`,
      scope: editingAccount.scope || 'Toàn hệ thống',
      provider: editingAccount.provider.trim(),
      accountNumber: editingAccount.accountNumber.trim(),
      accountHolder: editingAccount.accountHolder.trim(),
    };
    const key = account.type === 'bank' ? 'bankAccounts' : 'walletAccounts';
    setPaymentForm(prev => {
      const current = prev[key] || [];
      const exists = current.some(item => item.id === account.id);
      return {
        ...prev,
        [key]: exists
          ? current.map(item => (item.id === account.id ? account : item))
          : [...current, account],
      };
    });
    setEditingAccount(null);
  };

  const deletePaymentAccount = (account: POSPaymentAccount) => {
    const key = account.type === 'bank' ? 'bankAccounts' : 'walletAccounts';
    setPaymentForm(prev => ({
      ...prev,
      [key]: prev[key].filter(item => item.id !== account.id),
    }));
  };

  const renderAccountTable = (type: POSPaymentAccountType) => {
    const accounts = type === 'bank' ? paymentForm.bankAccounts : paymentForm.walletAccounts;
    const emptyLabel = type === 'bank' ? 'Chưa có tài khoản ngân hàng.' : 'Chưa có ví điện tử.';

    return (
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-sm text-slate-900">
            <tr>
              <th className="px-4 py-3 font-bold">
                {type === 'bank' ? 'Số tài khoản' : 'Mã ví/SĐT'}
              </th>
              <th className="px-4 py-3 font-bold">
                {type === 'bank' ? 'Ngân hàng' : 'Ví điện tử'}
              </th>
              <th className="px-4 py-3 font-bold">Chủ tài khoản</th>
              <th className="px-4 py-3 font-bold">Phạm vi áp dụng</th>
              <th className="px-4 py-3 font-bold">Ghi chú</th>
              <th className="px-4 py-3 text-right font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              accounts.map(account => (
                <tr key={account.id} className={!account.enabled ? 'opacity-50' : ''}>
                  <td className="px-4 py-4 text-sm text-slate-900">
                    {account.accountNumber || '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-900">{account.provider}</td>
                  <td className="px-4 py-4 text-sm text-slate-900">{account.accountHolder}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{account.scope}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">{account.note || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openPaymentAccountModal(type, account)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                        title="Sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePaymentAccount(account)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Section
        id="payment-defaults"
        title="Mặc định POS"
        description="Các lựa chọn thanh toán được áp dụng khi tạo hóa đơn mới."
        icon={ShoppingCart}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Phương thức mặc định</span>
            <select
              value={paymentForm.defaultMethod}
              onChange={e =>
                setPaymentForm(prev => ({
                  ...prev,
                  defaultMethod: e.target.value as POSPaymentMethod,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-300"
            >
              <option value="Cash">Tiền mặt</option>
              <option value="Bank">Chuyển khoản</option>
              <option value="Other">Thẻ</option>
              <option value="Momo">Ví</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 mt-5 md:mt-0 md:self-end">
            <input
              type="checkbox"
              checked={paymentForm.allowSplitPayment}
              onChange={e =>
                setPaymentForm(prev => ({ ...prev, allowSplitPayment: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-normal text-slate-700">
              Cho phép chia nhiều phương thức
            </span>
          </label>
        </div>
      </Section>

      <Section
        id="payment-methods"
        title="Phương thức thanh toán"
        description="Chọn phương thức nào hiển thị trên màn hình thu ngân."
        icon={CreditCard}
      >
        {(
          [
            { key: 'Cash', label: 'Tiền mặt', desc: 'Nhận tiền mặt trực tiếp' },
            { key: 'Bank', label: 'Chuyển khoản', desc: 'QR hoặc chuyển khoản ngân hàng' },
            { key: 'Other', label: 'Thẻ', desc: 'Thẻ tín dụng / ghi nợ' },
            { key: 'Momo', label: 'Ví điện tử', desc: 'Momo, ZaloPay và ví khác' },
          ] as { key: POSPaymentMethod; label: string; desc: string }[]
        ).map(({ key, label, desc }) => {
          const enabled = paymentForm.enabledMethods?.includes(key) ?? true;
          return (
            <label
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:border-indigo-200 transition-colors"
            >
              <div>
                <p className="text-sm font-normal text-slate-800">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => {
                  const methods = paymentForm.enabledMethods ?? ['Cash', 'Bank', 'Other', 'Momo'];
                  setPaymentForm(prev => ({
                    ...prev,
                    enabledMethods: e.target.checked
                      ? ([...new Set([...methods, key])] as POSPaymentMethod[])
                      : methods.filter(m => m !== key),
                  }));
                }}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          );
        })}
      </Section>

      <Section
        id="payment-accounts"
        title="Quản lý tài khoản thu chi"
        description="Quản lý các tài khoản ngân hàng và ví điện tử dùng cho giao dịch thu chi của cửa hàng."
        icon={CreditCard}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setPaymentAccountTab('bank')}
              className={`pb-3 text-sm font-normal ${paymentAccountTab === 'bank' ? 'border-b-2 border-indigo-600 text-blue-600' : 'text-slate-600'}`}
            >
              Tài khoản ngân hàng
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                {paymentForm.bankAccounts.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentAccountTab('wallet')}
              className={`pb-3 text-sm font-normal ${paymentAccountTab === 'wallet' ? 'border-b-2 border-indigo-600 text-blue-600' : 'text-slate-600'}`}
            >
              Ví điện tử
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {paymentForm.walletAccounts.length}
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => openPaymentAccountModal(paymentAccountTab)}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-normal text-slate-800 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Thêm tài khoản
          </button>
        </div>

        {renderAccountTable(paymentAccountTab)}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void savePaymentSettings()}
            disabled={paymentSaveStatus === 'saving'}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {paymentSaveStatus === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {paymentSaveStatus === 'saved'
              ? 'Đã lưu'
              : paymentSaveStatus === 'error'
                ? 'Lỗi lưu'
                : 'Lưu thanh toán POS'}
          </button>
          <button
            type="button"
            onClick={() =>
              setPaymentForm(normalizePOSPaymentSettings(DEFAULT_POS_PAYMENT_SETTINGS))
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-normal text-slate-700 hover:bg-slate-50"
          >
            Khôi phục mặc định
          </button>
          <p className="text-xs text-slate-500">
            Thông tin sau khi lưu sẽ hiển thị ngay trong màn hình POS.
          </p>
        </div>
      </Section>

      {editingAccount && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5">
              <h3 className="text-2xl font-bold text-slate-900">
                {editingAccount.id
                  ? 'Sửa tài khoản'
                  : `Thêm ${editingAccount.type === 'bank' ? 'tài khoản ngân hàng' : 'ví điện tử'}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-200 px-6">
              <button
                type="button"
                onClick={() => setAccountModalTab('info')}
                className={`mr-8 py-3 text-base font-normal ${accountModalTab === 'info' ? 'border-b-2 border-indigo-600 text-blue-600' : 'text-slate-600'}`}
              >
                Thông tin
              </button>
              <button
                type="button"
                onClick={() => setAccountModalTab('scope')}
                className={`py-3 text-base font-normal ${accountModalTab === 'scope' ? 'border-b-2 border-indigo-600 text-blue-600' : 'text-slate-600'}`}
              >
                Phạm vi áp dụng
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {accountModalTab === 'info' ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-sm text-slate-800">
                      {editingAccount.type === 'bank' ? 'Số tài khoản' : 'Mã ví/Số điện thoại'}
                    </span>
                    <input
                      value={editingAccount.accountNumber}
                      onChange={e => updateEditingAccount('accountNumber', e.target.value)}
                      placeholder={
                        editingAccount.type === 'bank'
                          ? 'Nhập số tài khoản'
                          : 'Nhập mã ví hoặc số điện thoại'
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm text-slate-800">
                      {editingAccount.type === 'bank' ? 'Ngân hàng' : 'Ví điện tử'}
                    </span>
                    {editingAccount.type === 'bank' ? (
                      <select
                        value={editingAccount.bankCode || ''}
                        onChange={e => {
                          const bank = VIET_BANKS.find(b => b.code === e.target.value);
                          updateEditingAccount('bankCode', e.target.value);
                          if (bank) updateEditingAccount('provider', bank.name);
                        }}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="">-- Chọn ngân hàng --</option>
                        {VIET_BANKS.map(b => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={editingAccount.provider}
                        onChange={e => updateEditingAccount('provider', e.target.value)}
                        placeholder="Nhập tên ví điện tử"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-blue-500"
                      />
                    )}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm text-slate-800">Chủ tài khoản</span>
                    <input
                      value={editingAccount.accountHolder}
                      onChange={e => updateEditingAccount('accountHolder', e.target.value)}
                      placeholder="Nhập tên chủ tài khoản"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm text-slate-800">Ghi chú</span>
                    <textarea
                      value={editingAccount.note || ''}
                      onChange={e => updateEditingAccount('note', e.target.value)}
                      placeholder="Nhập ghi chú"
                      className="min-h-24 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm text-slate-800">URL ảnh QR</span>
                    <input
                      value={editingAccount.qrImage || ''}
                      onChange={e => updateEditingAccount('qrImage', e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                </>
              ) : (
                <div className="space-y-4">
                  <label className="block space-y-1">
                    <span className="text-sm text-slate-800">Phạm vi áp dụng</span>
                    <select
                      value={editingAccount.scope}
                      onChange={e => updateEditingAccount('scope', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-blue-500"
                    >
                      <option>Toàn hệ thống</option>
                      <option>Quầy trung tâm</option>
                      <option>POS cửa hàng</option>
                      <option>Online/Shopee</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={editingAccount.enabled}
                      onChange={e => updateEditingAccount('enabled', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-normal text-slate-700">
                      Hiển thị tài khoản này trong máy tính tiền
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-normal text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveEditingAccount}
                className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-normal text-white hover:bg-indigo-700"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PaymentsTab);
