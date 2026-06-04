
import React, { useMemo, useState } from 'react';
import {
  Users, Search, Plus, Star, Phone, X, Eye, Edit2, Trash2,
  ShoppingBag, MapPin, Mail, FileText, TrendingUp, AlertCircle, FileDown
} from 'lucide-react';
import { AppDataSurgicalUpdate, POSCustomer, POSOrder } from '../../types';
import { exportToExcel } from '../../services/exportService';
import { useToast } from '../ui/Toast';

interface CustomerPointsProps {
  customers: POSCustomer[];
  orders?: POSOrder[];
  onUpdateCustomers: (customers: POSCustomer[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
}

const TIERS = ['Tất cả', 'Standard', 'Silver', 'Gold', 'Diamond'] as const;

const TIER_STYLE: Record<string, { badge: string; accent: string }> = {
  Diamond: { badge: 'bg-indigo-100 text-indigo-700', accent: 'border-b-indigo-500' },
  Gold:    { badge: 'bg-amber-100  text-amber-700',  accent: 'border-b-amber-400'  },
  Silver:  { badge: 'bg-slate-200  text-slate-700',  accent: 'border-b-slate-400'  },
  Standard:{ badge: 'bg-slate-100  text-slate-500',  accent: 'border-b-transparent'},
};

const fmt = (n: number) => n.toLocaleString('vi-VN');

const emptyForm = (): Partial<POSCustomer> => ({
  name: '', phone: '', email: '', address: '', notes: '', points: 0, totalSpent: 0, tier: 'Standard'
});

const CustomerPoints: React.FC<CustomerPointsProps> = ({
  customers, orders = [], onUpdateCustomers, onUpdateSurgical
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('Tất cả');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editCustomer, setEditCustomer]   = useState<POSCustomer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<POSCustomer | null>(null);
  const [detailTab, setDetailTab]         = useState<'info' | 'history'>('info');
  const [formData, setFormData]           = useState<Partial<POSCustomer>>(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const tierCount = { Standard: 0, Silver: 0, Gold: 0, Diamond: 0 };
    let totalPoints = 0, totalSpent = 0;
    customers.forEach(c => {
      tierCount[c.tier] = (tierCount[c.tier] || 0) + 1;
      totalPoints += c.points;
      totalSpent  += c.totalSpent;
    });
    return { total: customers.length, tierCount, totalPoints, totalSpent };
  }, [customers]);

  const filteredCustomers = useMemo(() =>
    customers.filter(c => {
      const matchTier = tierFilter === 'Tất cả' || c.tier === tierFilter;
      const q = searchTerm.toLowerCase();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
      return matchTier && matchSearch;
    })
  , [customers, tierFilter, searchTerm]);

  const customerOrders = useMemo(() =>
    detailCustomer
      ? [...orders.filter(o => o.customerId === detailCustomer.id)]
          .sort((a, b) => b.date.localeCompare(a.date))
      : []
  , [orders, detailCustomer]);

  // ── Handlers ───────────────────────────────────────────────
  const saveCustomer = () => {
    if (!formData.name?.trim() || !formData.phone?.trim()) {
      showToast('Vui lòng nhập tên và số điện thoại!', 'warning');
      return;
    }
    if (editCustomer) {
      const updated = { ...editCustomer, ...formData } as POSCustomer;
      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posCustomers', item: updated }]);
      } else {
        onUpdateCustomers(customers.map(c => c.id === updated.id ? updated : c));
      }
      if (detailCustomer?.id === updated.id) setDetailCustomer(updated);
      setEditCustomer(null);
    } else {
      const newC: POSCustomer = {
        ...formData,
        id: crypto.randomUUID(),
        points: formData.points || 0,
        totalSpent: formData.totalSpent || 0,
        tier: formData.tier || 'Standard',
      } as POSCustomer;
      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posCustomers', item: newC }]);
      } else {
        onUpdateCustomers([...customers, newC]);
      }
      setShowAddModal(false);
    }
    setFormData(emptyForm());
  };

  const openEdit = (c: POSCustomer) => {
    setEditCustomer(c);
    setFormData({ ...c });
  };

  const deleteCustomer = (id: string) => {
    if (onUpdateSurgical) {
      onUpdateSurgical([{ key: 'posCustomers', item: { id }, isDelete: true }]);
    } else {
      onUpdateCustomers(customers.filter(c => c.id !== id));
    }
    setConfirmDeleteId(null);
    if (detailCustomer?.id === id) setDetailCustomer(null);
  };

  const openDetail = (c: POSCustomer) => {
    setDetailCustomer(c);
    setDetailTab('info');
  };

  // ── Sub-components ─────────────────────────────────────────
  const FormModal = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-modal flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-slate-200">
        <div className="bg-slate-50 p-10 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-2xl text-slate-950 uppercase tracking-tighter">{title}</h3>
            <p className="text-2xs font-normal text-slate-400 uppercase tracking-[0.3em] mt-2">Hệ thống CRM · CFO Brain</p>
          </div>
          <button onClick={onClose} className="h-12 w-12 flex items-center justify-center hover:bg-white rounded-2xl text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-slate-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2 space-y-2">
              <label className="text-2xs font-normal text-slate-500 uppercase tracking-widest ml-1">Họ và tên *</label>
              <input placeholder="NGUYỄN VĂN A" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-normal text-slate-900 focus:bg-white focus:border-indigo-400 outline-none transition-all uppercase"
                value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-2xs font-normal text-slate-500 uppercase tracking-widest ml-1">Số điện thoại *</label>
              <input placeholder="03xxxxxxxx" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-normal text-slate-900 focus:bg-white focus:border-indigo-400 outline-none transition-all"
                value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-2xs font-normal text-slate-500 uppercase tracking-widest ml-1">Hạng thành viên</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-normal text-slate-900 focus:bg-white focus:border-indigo-400 outline-none transition-all"
                value={formData.tier || 'Standard'} onChange={e => setFormData({ ...formData, tier: e.target.value as POSCustomer['tier'] })}>
                <option>Standard</option>
                <option>Silver</option>
                <option>Gold</option>
                <option>Diamond</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-2xs font-normal text-slate-500 uppercase tracking-widest ml-1">Email</label>
              <input placeholder="email@example.com" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-normal text-slate-600 focus:bg-white focus:border-indigo-400 outline-none transition-all"
                value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-2xs font-normal text-slate-500 uppercase tracking-widest ml-1">Địa chỉ</label>
              <input placeholder="Số nhà, đường, phường/xã..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-normal text-slate-600 focus:bg-white focus:border-indigo-400 outline-none transition-all"
                value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-2xs font-normal text-slate-500 uppercase tracking-widest ml-1">Ghi chú (sở thích, sinh nhật...)</label>
              <textarea placeholder="VD: Thích giày da, sinh nhật 15/08..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-normal text-slate-600 focus:bg-white focus:border-indigo-400 outline-none transition-all resize-none h-20"
                value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-4 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-8 py-5 text-slate-400 font-normal text-xs uppercase tracking-[0.2em] hover:text-slate-600 transition-colors">
              Hủy
            </button>
            <button onClick={saveCustomer} className="flex-1 py-5 bg-slate-950 text-white rounded-[1.5rem] font-normal text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/30 hover:bg-indigo-600 transition-all active:scale-95">
              {editCustomer ? 'Lưu thay đổi' : 'Đăng ký hội viên'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const DetailModal = () => {
    if (!detailCustomer) return null;
    const c = detailCustomer;
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-modal flex items-center justify-center p-6">
        <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-slate-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-50 p-8 border-b border-slate-200 flex items-start justify-between shrink-0">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center font-normal text-2xl text-indigo-500 uppercase shadow-inner">
                {c.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-normal text-xl text-slate-950 uppercase tracking-tighter">{c.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-2xs font-normal uppercase tracking-wider ${TIER_STYLE[c.tier]?.badge}`}>{c.tier}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-normal mt-1">
                  <Phone className="h-3 w-3 text-emerald-500" />{c.phone}
                </div>
              </div>
            </div>
            <button onClick={() => setDetailCustomer(null)} className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-xl text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 px-8 shrink-0">
            {(['info', 'history'] as const).map(tab => (
              <button key={tab} onClick={() => setDetailTab(tab)}
                className={`px-6 py-4 text-2xs font-normal uppercase tracking-widest border-b-2 transition-all ${detailTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                {tab === 'info' ? 'Thông tin' : `Lịch sử (${customerOrders.length})`}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {detailTab === 'info' && (
              <div className="p-8 space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Điểm tích lũy', value: fmt(c.points), icon: <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> },
                    { label: 'Tổng chi tiêu', value: fmt(c.totalSpent) + 'đ', icon: <TrendingUp className="h-4 w-4 text-indigo-500" /> },
                    { label: 'Số đơn hàng', value: String(customerOrders.length), icon: <ShoppingBag className="h-4 w-4 text-emerald-500" /> },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-2xl p-4 space-y-1">
                      <div className="flex items-center gap-1.5">{s.icon}<span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest">{s.label}</span></div>
                      <div className="font-normal text-slate-900 text-base tabular-nums">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Info fields */}
                <div className="space-y-3">
                  {c.email && (
                    <div className="flex items-start gap-3 text-sm">
                      <Mail className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                      <span className="text-slate-600 font-normal">{c.email}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                      <span className="text-slate-600 font-normal">{c.address}</span>
                    </div>
                  )}
                  {c.notes && (
                    <div className="flex items-start gap-3 text-sm">
                      <FileText className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                      <span className="text-slate-600 font-normal">{c.notes}</span>
                    </div>
                  )}
                  {c.lastVisit && (
                    <div className="text-2xs font-normal text-slate-400 uppercase tracking-widest pt-2">
                      Lần cuối mua: {new Date(c.lastVisit).toLocaleDateString('vi-VN')}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button onClick={() => { openEdit(c); setDetailCustomer(null); }}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-normal uppercase tracking-widest text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all">
                    <Edit2 className="h-4 w-4" /> Sửa thông tin
                  </button>
                  <button onClick={() => setConfirmDeleteId(c.id)}
                    className="flex items-center gap-2 px-6 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-normal uppercase tracking-widest text-rose-500 hover:bg-rose-100 transition-all">
                    <Trash2 className="h-4 w-4" /> Xóa hội viên
                  </button>
                </div>
              </div>
            )}

            {detailTab === 'history' && (
              <div className="p-8">
                {customerOrders.length === 0 ? (
                  <div className="py-16 text-center text-slate-300 flex flex-col items-center gap-3">
                    <ShoppingBag className="h-12 w-12 opacity-30" />
                    <p className="text-xs font-normal uppercase tracking-widest">Chưa có đơn hàng nào</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerOrders.map(o => (
                      <div key={o.id} className="bg-slate-50 rounded-2xl p-5 flex items-center justify-between gap-4 border border-slate-100">
                        <div className="space-y-1">
                          <div className="font-normal text-slate-900 text-sm">{o.orderCode}</div>
                          <div className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
                            {new Date(o.date).toLocaleDateString('vi-VN')} · {o.items.length} sản phẩm · {o.paymentMethod}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-normal text-indigo-600 tabular-nums">{fmt(o.finalAmount)}<span className="text-2xs ml-0.5">đ</span></div>
                          {o.pointsEarned > 0 && (
                            <div className="text-2xs font-normal text-amber-500 flex items-center gap-1 justify-end">
                              <Star className="h-3 w-3 fill-amber-400" />+{o.pointsEarned}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng hội viên', value: String(stats.total), sub: `${stats.tierCount.Diamond} Diamond`, color: 'text-slate-900' },
          { label: 'Tổng điểm tích lũy', value: fmt(stats.totalPoints), sub: 'điểm', color: 'text-amber-600' },
          { label: 'Tổng chi tiêu', value: fmt(stats.totalSpent) + 'đ', sub: 'tất cả hội viên', color: 'text-indigo-600' },
          { label: 'Phân bổ hạng', value: `${stats.tierCount.Gold}G · ${stats.tierCount.Silver}S`, sub: `${stats.tierCount.Standard} Standard`, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-1">
            <div className="text-[9px] font-normal uppercase tracking-[0.2em] text-slate-400">{s.label}</div>
            <div className={`font-normal text-xl tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-2xs text-slate-400 font-normal">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Add */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 gap-5">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Tìm tên, số điện thoại..."
              className="w-full md:w-64 pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal outline-none focus:bg-white focus:border-indigo-400 transition-all placeholder:text-slate-400"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {TIERS.map(t => (
              <button key={t} onClick={() => setTierFilter(t)}
                className={`px-4 py-2 rounded-xl text-2xs font-normal uppercase tracking-widest transition-all ${tierFilter === t ? 'bg-slate-950 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {t === 'Tất cả' ? `${t} (${customers.length})` : `${t} (${stats.tierCount[t as keyof typeof stats.tierCount] ?? 0})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => exportToExcel(
              filteredCustomers.map(c => ({
                'Tên khách hàng': c.name,
                'Số điện thoại': c.phone,
                'Hạng thành viên': c.tier,
                'Điểm tích lũy': c.points,
                'Tổng chi tiêu': c.totalSpent,
                'Lần cuối mua': c.lastVisit ? new Date(c.lastVisit).toLocaleDateString('vi-VN') : '',
                'Địa chỉ': c.address || '',
                'Email': c.email || '',
                'Ghi chú': c.notes || '',
              })),
              'KhachHang'
            )}
            className="px-5 py-4 bg-white border border-slate-200 text-emerald-600 rounded-[1.5rem] font-normal text-xs uppercase tracking-[0.2em] hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-2 active:scale-95 shadow-sm">
            <FileDown className="h-4 w-4" /> Xuất Excel
          </button>
          <button onClick={() => { setShowAddModal(true); setFormData(emptyForm()); setEditCustomer(null); }}
            className="px-8 py-4 bg-slate-950 text-white rounded-[1.5rem] font-normal text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-950/20 hover:bg-indigo-600 transition-all flex items-center gap-3 active:scale-95 w-full md:w-auto justify-center">
            <Plus className="h-5 w-5" /> Đăng ký hội viên
          </button>
        </div>
      </div>

      {/* Customer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-32 text-center text-slate-300 bg-white rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center shadow-inner">
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-100">
              <Users className="h-10 w-10 opacity-20" />
            </div>
            <p className="font-normal uppercase text-xs tracking-[0.3em]">Không tìm thấy hội viên</p>
          </div>
        ) : (
          filteredCustomers.map(c => {
            const style = TIER_STYLE[c.tier];
            return (
              <div key={c.id} className={`bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 flex flex-col relative overflow-hidden group hover:shadow-2xl transition-all border-b-4 ${style.accent}`}>
                <div className={`absolute top-0 right-0 px-5 py-2 rounded-bl-[1.5rem] text-2xs font-normal uppercase tracking-[0.15em] ${style.badge}`}>
                  {c.tier}
                </div>

                <div className="flex items-start gap-5 mb-6">
                  <div className="w-14 h-14 rounded-[1.25rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all font-normal text-xl shadow-inner uppercase shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-normal text-slate-950 uppercase tracking-tighter text-base leading-tight group-hover:text-indigo-600 transition-colors truncate">{c.name}</h3>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-normal mt-1">
                      <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                      {c.phone}
                    </div>
                    {c.notes && (
                      <p className="text-2xs text-slate-400 font-normal mt-1 truncate">{c.notes}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto pt-5 border-t border-slate-100">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-normal text-slate-400 uppercase tracking-[0.2em]">Điểm tích lũy</div>
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      <span className="font-normal text-slate-900 tabular-nums">{fmt(c.points)}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="text-[9px] font-normal text-slate-400 uppercase tracking-[0.2em]">Chi tiêu</div>
                    <div className="font-normal text-indigo-600 tabular-nums">{fmt(c.totalSpent)}<span className="text-2xs ml-0.5">đ</span></div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                  <button onClick={() => openDetail(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-xl text-2xs font-normal uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-all">
                    <Eye className="h-3.5 w-3.5" /> Chi tiết
                  </button>
                  <button onClick={() => openEdit(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-2xs font-normal uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">
                    <Edit2 className="h-3.5 w-3.5" /> Sửa
                  </button>
                  <button onClick={() => setConfirmDeleteId(c.id)}
                    className="w-10 flex items-center justify-center py-2.5 bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 rounded-xl text-slate-400 hover:text-rose-500 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit modal */}
      {(showAddModal || editCustomer) && (
        <FormModal
          title={editCustomer ? 'Sửa thông tin hội viên' : 'Đăng ký hội viên mới'}
          onClose={() => { setShowAddModal(false); setEditCustomer(null); setFormData(emptyForm()); }}
        />
      )}

      {/* Detail modal */}
      <DetailModal />

      {/* Confirm delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-modal flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-200 space-y-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-rose-50 flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-rose-500" />
            </div>
            <div>
              <h4 className="font-semibold text-xl text-slate-900 uppercase tracking-tight">Xác nhận xóa?</h4>
              <p className="text-sm text-slate-500 font-normal mt-2">Hành động này không thể hoàn tác. Lịch sử đơn hàng vẫn được giữ lại.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-normal text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-all">Hủy</button>
              <button onClick={() => deleteCustomer(confirmDeleteId)} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-normal text-xs uppercase tracking-widest hover:bg-rose-600 transition-all active:scale-95">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPoints;
