import React, { useState } from 'react';
import { X, User, Edit2, Trash2, TrendingUp, Phone, Mail, FileText, Lock } from 'lucide-react';
import type { POSCustomer, POSOrder, CustomerDebtRecord } from '../../types';

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
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');

  const customerOrders = orders
    .filter(o => o.customerId === customer.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const debtRecords = customerDebtHistory
    .filter(d => d.customerId === customer.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const netSpent = orderStats ? orderStats.sold - orderStats.returned : 0;

  const customerDebt = Math.max(0, customerOrders.reduce((sum, o) => {
    const finalAmt = Number(o.finalAmount) || 0;
    const cashRecv = Number(o.cashReceived) || 0;
    const debt = finalAmt - cashRecv;
    return sum + (o.isReturn ? -debt : debt);
  }, 0));

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
        {activeTab === 'orders' && <OrdersTab orders={customerOrders} />}
        {activeTab === 'debt' && (
          <DebtTab records={debtRecords} currentDebt={customerDebt} />
        )}
        {activeTab === 'points' && <PointsTab points={customer.points} />}
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
      </div>
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
const OrdersTab: React.FC<{ orders: POSOrder[] }> = ({ orders }) => {
  if (orders.length === 0) {
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
              <th className="px-4 py-3 text-right font-medium text-slate-600">Tổng cộng</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(order => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Tab: Nợ cần thu từ khách ───────────────────────────────────── */
const DebtTab: React.FC<{ records: CustomerDebtRecord[]; currentDebt: number }> = ({
  records,
  currentDebt,
}) => (
  <div className="p-3 space-y-3">
    {/* Summary */}
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
      <span className="text-sm text-slate-600">Nợ hiện tại</span>
      <span
        className={`text-[18px] font-bold tabular-nums ${currentDebt > 0 ? 'text-rose-600' : 'text-slate-500'}`}
      >
        {fmt(currentDebt)}
      </span>
    </div>

    {records.length === 0 ? (
      <div className="bg-white rounded-xl border border-slate-200 py-5 px-4 text-center flex items-center gap-3 justify-center">
        <Phone className="w-5 h-5 text-slate-300 shrink-0" />
        <span className="text-sm text-slate-500">Chưa có lịch sử công nợ</span>
      </div>
    ) : (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Ngày</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Loại</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Số tiền</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map(rec => (
              <tr key={rec.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{fmtDate(rec.date)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      rec.type === 'debt'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {rec.type === 'debt' ? 'Ghi nợ' : 'Thu nợ'}
                  </span>
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-medium ${
                    rec.type === 'debt' ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {rec.type === 'debt' ? '+' : '-'}
                  {fmt(rec.amount)}
                </td>
                <td className="px-4 py-3 text-slate-500">{rec.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

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
