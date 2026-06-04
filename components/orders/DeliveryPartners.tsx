import React, { useEffect, useMemo, useState } from 'react';
import { Bike, Edit2, MapPin, Phone, Plus, Search, Star, Trash2, X } from 'lucide-react';

type PartnerStatus = 'active' | 'inactive';

interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  area: string;
  feeTotal: number;
  orderCount: number;
  status: PartnerStatus;
  isFavorite: boolean;
  note?: string;
}

const STORAGE_KEY = 'deliveryPartners';

const emptyPartner = (): DeliveryPartner => ({
  id: '',
  name: '',
  phone: '',
  area: '',
  feeTotal: 0,
  orderCount: 0,
  status: 'active',
  isFavorite: false,
  note: '',
});

const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

interface Props {
  navigationSlot?: React.ReactNode;
}

export default function DeliveryPartners({ navigationSlot }: Props) {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPartners(JSON.parse(raw));
    } catch {
      setPartners([]);
    }
  }, []);

  const persist = (next: DeliveryPartner[]) => {
    setPartners(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const filteredPartners = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(partner =>
      [partner.name, partner.phone, partner.area, partner.note || '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [partners, searchTerm]);

  const stats = useMemo(
    () => ({
      total: partners.length,
      active: partners.filter(partner => partner.status === 'active').length,
      orders: partners.reduce((sum, partner) => sum + partner.orderCount, 0),
      fees: partners.reduce((sum, partner) => sum + partner.feeTotal, 0),
    }),
    [partners]
  );

  const handleSave = (partner: DeliveryPartner) => {
    if (!partner.name.trim()) {
      alert('Vui lòng nhập tên đối tác giao hàng.');
      return;
    }
    const item = {
      ...partner,
      id: partner.id || crypto.randomUUID(),
      name: partner.name.trim(),
      phone: partner.phone.trim(),
      area: partner.area.trim(),
      note: partner.note?.trim() || '',
      feeTotal: Number(partner.feeTotal) || 0,
      orderCount: Number(partner.orderCount) || 0,
    };
    persist(partner.id ? partners.map(p => (p.id === item.id ? item : p)) : [item, ...partners]);
    setEditingPartner(null);
  };

  const handleDelete = (id: string) => {
    const partner = partners.find(item => item.id === id);
    if (!partner) return;
    if (!window.confirm(`Xóa đối tác giao hàng "${partner.name}"?`)) return;
    persist(partners.filter(item => item.id !== id));
  };

  const toggleFavorite = (id: string) => {
    persist(
      partners.map(item => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
    );
  };

  const toggleStatus = (id: string) => {
    persist(
      partners.map(item =>
        item.id === id
          ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' }
          : item
      )
    );
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex h-full min-h-0 flex-col gap-4">
        {navigationSlot}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Bike className="h-5 w-5" />
            </div>
            <h1 className="text-base font-semibold text-slate-900">Đối tác giao hàng</h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý đối tác vận chuyển và chi phí theo tháng.
            </p>
          </div>

          <button
            onClick={() => setEditingPartner(emptyPartner())}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Thêm đối tác
          </button>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {[
              { label: 'Tổng đối tác', value: stats.total, Icon: Bike },
              { label: 'Đang hoạt động', value: stats.active, Icon: Star },
              { label: 'Đơn hàng tháng này', value: stats.orders, Icon: MapPin },
              { label: 'Chi phí vận chuyển', value: formatMoney(stats.fees), Icon: Phone },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                  <Icon className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="mt-3 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tên, số điện thoại, khu vực..."
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <th className="px-4 py-3 text-left">Đối tác</th>
                <th className="px-4 py-3 text-left">Liên hệ</th>
                <th className="px-4 py-3 text-left">Khu vực</th>
                <th className="px-4 py-3 text-right">Đơn</th>
                <th className="px-4 py-3 text-right">Chi phí</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <Bike className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                    <p className="text-sm font-semibold">Chưa có đối tác giao hàng</p>
                  </td>
                </tr>
              ) : (
                filteredPartners.map(partner => (
                  <tr key={partner.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleFavorite(partner.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
                          title={partner.isFavorite ? 'Bỏ ưu tiên' : 'Đánh dấu ưu tiên'}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              partner.isFavorite
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                        <div>
                          <p className="font-semibold text-slate-900">{partner.name}</p>
                          {partner.note && <p className="text-xs text-slate-400">{partner.note}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{partner.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{partner.area || '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {partner.orderCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {formatMoney(partner.feeTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleStatus(partner.id)}
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          partner.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {partner.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingPartner(partner)}
                        className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                        title="Sửa đối tác"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(partner.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50"
                        title="Xóa đối tác"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingPartner && (
        <PartnerModal
          partner={editingPartner}
          onClose={() => setEditingPartner(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function PartnerModal({
  partner,
  onClose,
  onSave,
}: {
  partner: DeliveryPartner;
  onClose: () => void;
  onSave: (partner: DeliveryPartner) => void;
}) {
  const [form, setForm] = useState(partner);
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {partner.id ? 'Sửa đối tác giao hàng' : 'Thêm đối tác giao hàng'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          {[
            ['name', 'Tên đối tác'],
            ['phone', 'Điện thoại'],
            ['area', 'Khu vực'],
            ['note', 'Ghi chú'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
              <input
                value={String(form[key as keyof DeliveryPartner] || '')}
                onChange={event => setForm(prev => ({ ...prev, [key]: event.target.value }))}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Số đơn tháng này
              </label>
              <input
                type="number"
                value={form.orderCount}
                onChange={event =>
                  setForm(prev => ({ ...prev, orderCount: Number(event.target.value) || 0 }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Chi phí vận chuyển
              </label>
              <input
                type="number"
                value={form.feeTotal}
                onChange={event =>
                  setForm(prev => ({ ...prev, feeTotal: Number(event.target.value) || 0 }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Bỏ qua
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
