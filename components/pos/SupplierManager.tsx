
import React, { useState, useMemo } from 'react';
import { Truck, Plus, Pencil, Trash2, X, Save, CreditCard, TrendingDown, ChevronDown, FileDown } from 'lucide-react';
import { Supplier, SupplierDebtRecord } from '../../types';
import { generateId } from '../../businessLogic';
import { exportToExcel } from '../../services/exportService';

interface Props {
  suppliers: Supplier[];
  supplierDebts: SupplierDebtRecord[];
  onUpdateSuppliers: (list: Supplier[]) => void;
  onUpdateSurgical: (updates: { key: any; item: any; isDelete?: boolean }[]) => Promise<void>;
}

const today = () => new Date().toLocaleDateString('sv-SE');

const emptySupplier = (): Supplier => ({ id: '', name: '', phone: '', address: '', notes: '' });
const emptyDebt = (supplierId = '', supplierName = ''): Omit<SupplierDebtRecord, 'id'> => ({
  supplierId, supplierName, date: today(), type: 'purchase', amount: 0, description: ''
});

const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

const SupplierManager: React.FC<Props> = ({ suppliers, supplierDebts, onUpdateSuppliers, onUpdateSurgical }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'debt'>('list');

  // Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Supplier>(emptySupplier());
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  // Debt form
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtForm, setDebtForm] = useState(emptyDebt());
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');

  // ─── Computed ────────────────────────────────────────────────────────────────

  const debtBySupplier = useMemo(() => {
    const map: Record<string, number> = {};
    supplierDebts.forEach(d => {
      if (!map[d.supplierId]) map[d.supplierId] = 0;
      map[d.supplierId] += d.type === 'purchase' ? d.amount : -d.amount;
    });
    return map;
  }, [supplierDebts]);

  const totalDebt = useMemo(() => (Object.values(debtBySupplier) as number[]).reduce((s, v) => s + v, 0), [debtBySupplier]);

  const filteredDebts = useMemo(() => {
    const list = filterSupplierId === 'all' ? supplierDebts : supplierDebts.filter(d => d.supplierId === filterSupplierId);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [supplierDebts, filterSupplierId]);

  // Running balance for filtered supplier
  const debtsWithBalance = useMemo(() => {
    let balance = 0;
    return [...filteredDebts].reverse().map(d => {
      balance += d.type === 'purchase' ? d.amount : -d.amount;
      return { ...d, runningBalance: balance };
    }).reverse();
  }, [filteredDebts]);

  // ─── Supplier CRUD ────────────────────────────────────────────────────────

  const openAddSupplier = () => {
    setSupplierForm(emptySupplier());
    setEditingSupplierId(null);
    setShowSupplierForm(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setSupplierForm({ ...s });
    setEditingSupplierId(s.id);
    setShowSupplierForm(true);
  };

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) return alert('Vui lòng nhập tên nhà cung cấp');
    const item: Supplier = { ...supplierForm, id: editingSupplierId || generateId() };
    await onUpdateSurgical([{ key: 'suppliers', item }]);
    const updated = editingSupplierId
      ? suppliers.map(s => s.id === editingSupplierId ? item : s)
      : [...suppliers, item];
    onUpdateSuppliers(updated);
    setShowSupplierForm(false);
  };

  const deleteSupplier = async (id: string) => {
    const hasDebts = supplierDebts.some(d => d.supplierId === id);
    if (hasDebts && !confirm('Nhà cung cấp này có dữ liệu công nợ. Xóa sẽ không xóa được lịch sử công nợ. Tiếp tục?')) return;
    if (!confirm('Xác nhận xóa nhà cung cấp này?')) return;
    await onUpdateSurgical([{ key: 'suppliers', item: { id }, isDelete: true }]);
    onUpdateSuppliers(suppliers.filter(s => s.id !== id));
  };

  // ─── Debt CRUD ────────────────────────────────────────────────────────────

  const openAddDebt = (supplierId = '', supplierName = '') => {
    setDebtForm(emptyDebt(supplierId, supplierName));
    setShowDebtForm(true);
  };

  const saveDebt = async () => {
    if (!debtForm.supplierId) return alert('Vui lòng chọn nhà cung cấp');
    if (!debtForm.amount || debtForm.amount <= 0) return alert('Vui lòng nhập số tiền hợp lệ');
    const item: SupplierDebtRecord = { ...debtForm, id: generateId() };
    await onUpdateSurgical([{ key: 'supplierDebts', item }]);
    setShowDebtForm(false);
  };

  const deleteDebt = async (id: string) => {
    if (!confirm('Xóa giao dịch này?')) return;
    await onUpdateSurgical([{ key: 'supplierDebts', item: { id }, isDelete: true }]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600" /> Nhà Cung Cấp
          </h2>
          <p className="text-sm text-slate-500 mt-1">Quản lý danh sách nhà cung cấp và theo dõi công nợ</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Tổng công nợ</p>
          <p className={`text-2xl font-black ${totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(totalDebt)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit gap-1">
        {(['list', 'debt'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab === 'list' ? 'Danh Sách NCC' : 'Sổ Công Nợ'}
          </button>
        ))}
      </div>

      {/* ── Tab: Danh sách NCC ── */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAddSupplier}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> Thêm NCC
            </button>
          </div>

          {suppliers.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Chưa có nhà cung cấp nào</p>
              <p className="text-sm">Nhấn "Thêm NCC" để bắt đầu</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {suppliers.map(s => {
                const debt = debtBySupplier[s.id] || 0;
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-base">{s.name}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {s.phone && <span className="text-xs text-slate-500">{s.phone}</span>}
                        {s.address && <span className="text-xs text-slate-500 truncate max-w-xs">{s.address}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400 font-bold uppercase">Còn nợ</p>
                      <p className={`text-lg font-black ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(debt)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setFilterSupplierId(s.id); setActiveTab('debt'); }}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors" title="Xem công nợ">
                        <CreditCard className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditSupplier(s)}
                        className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteSupplier(s.id)}
                        className="p-2 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Sổ công nợ ── */}
      {activeTab === 'debt' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <select value={filterSupplierId} onChange={e => setFilterSupplierId(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-8 text-sm font-semibold text-slate-700 outline-none shadow-sm cursor-pointer">
                <option value="all">— Tất cả NCC —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportToExcel(
                  debtsWithBalance.map(d => ({
                    'Ngày': d.date,
                    'Nhà cung cấp': d.supplierName,
                    'Loại': d.type === 'purchase' ? 'Mua hàng' : 'Thanh toán',
                    'Mô tả': d.description,
                    'Số tiền': d.amount,
                    'Số dư': d.runningBalance,
                  })),
                  `CongNo_${filterSupplierId === 'all' ? 'TatCa' : suppliers.find(s => s.id === filterSupplierId)?.name ?? filterSupplierId}`
                )}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-50 hover:border-emerald-200 transition-colors shadow-sm"
              >
                <FileDown className="w-4 h-4" /> Xuất Excel
              </button>
              <button onClick={() => {
                const s = suppliers.find(sup => sup.id === filterSupplierId);
                openAddDebt(s?.id || '', s?.name || '');
              }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
                <Plus className="w-4 h-4" /> Ghi nhận
              </button>
            </div>
          </div>

          {/* Summary for filtered supplier */}
          {filterSupplierId !== 'all' && (() => {
            const s = suppliers.find(sup => sup.id === filterSupplierId);
            const debt = debtBySupplier[filterSupplierId] || 0;
            const totalPurchase = supplierDebts.filter(d => d.supplierId === filterSupplierId && d.type === 'purchase').reduce((s, d) => s + d.amount, 0);
            const totalPayment = supplierDebts.filter(d => d.supplierId === filterSupplierId && d.type === 'payment').reduce((s, d) => s + d.amount, 0);
            return (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <p className="text-xs text-slate-400 font-bold uppercase">Tổng phát sinh</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{fmt(totalPurchase)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <p className="text-xs text-slate-400 font-bold uppercase">Đã thanh toán</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">{fmt(totalPayment)}</p>
                </div>
                <div className={`rounded-2xl border p-4 shadow-sm ${debt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className="text-xs text-slate-400 font-bold uppercase">Còn lại</p>
                  <p className={`text-xl font-black mt-1 ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(debt)}</p>
                </div>
              </div>
            );
          })()}

          {/* Table */}
          {debtsWithBalance.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">Chưa có giao dịch nào</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Ngày</th>
                    <th className="px-4 py-3 text-left">Nhà cung cấp</th>
                    <th className="px-4 py-3 text-left">Mô tả</th>
                    <th className="px-4 py-3 text-right">Phát sinh</th>
                    <th className="px-4 py-3 text-right">Thanh toán</th>
                    <th className="px-4 py-3 text-right">Số dư</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {debtsWithBalance.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{d.date.split('-').reverse().join('/')}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{d.supplierName}</td>
                      <td className="px-4 py-3 text-slate-500">{d.description}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">
                        {d.type === 'purchase' ? fmt(d.amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {d.type === 'payment' ? fmt(d.amount) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-black ${d.runningBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {fmt(d.runningBalance)}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteDebt(d.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Supplier Form ── */}
      {showSupplierForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">{editingSupplierId ? 'Sửa NCC' : 'Thêm NCC mới'}</h3>
              <button onClick={() => setShowSupplierForm(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Tên nhà cung cấp *', field: 'name', placeholder: 'VD: Công ty Giày ABC' },
                { label: 'Số điện thoại', field: 'phone', placeholder: '0901234567' },
                { label: 'Địa chỉ', field: 'address', placeholder: 'Địa chỉ kho/văn phòng' },
                { label: 'Ghi chú', field: 'notes', placeholder: 'Điều khoản thanh toán, liên hệ...' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                  <input
                    value={(supplierForm as any)[field] || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSupplierForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                Hủy
              </button>
              <button onClick={saveSupplier}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Debt Form ── */}
      {showDebtForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">Ghi nhận giao dịch</h3>
              <button onClick={() => setShowDebtForm(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              {/* Loại giao dịch */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loại giao dịch</label>
                <div className="flex gap-2 mt-1">
                  {[{ value: 'purchase', label: 'Mua hàng (nợ)' }, { value: 'payment', label: 'Thanh toán (trả)' }].map(opt => (
                    <button key={opt.value}
                      onClick={() => setDebtForm(f => ({ ...f, type: opt.value as any }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${debtForm.type === opt.value
                        ? opt.value === 'purchase' ? 'bg-rose-100 text-rose-700 border-2 border-rose-300' : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-2 border-transparent hover:bg-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* NCC */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nhà cung cấp</label>
                <div className="relative mt-1">
                  <select value={debtForm.supplierId}
                    onChange={e => {
                      const s = suppliers.find(sup => sup.id === e.target.value);
                      setDebtForm(f => ({ ...f, supplierId: e.target.value, supplierName: s?.name || '' }));
                    }}
                    className="appearance-none w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 pr-8">
                    <option value="">— Chọn NCC —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Ngày */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày</label>
                <input type="date" value={debtForm.date}
                  onChange={e => setDebtForm(f => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
              </div>

              {/* Số tiền */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số tiền (đ)</label>
                <input type="number" value={debtForm.amount || ''}
                  onChange={e => setDebtForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  placeholder="0"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
              </div>

              {/* Mô tả */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mô tả</label>
                <input value={debtForm.description}
                  onChange={e => setDebtForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="VD: Nhập 50 đôi giày mùa hè"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDebtForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                Hủy
              </button>
              <button onClick={saveDebt}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManager;
