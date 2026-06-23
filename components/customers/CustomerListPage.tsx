import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import {
  ListPageLayout,
  ListPageTable,
  ListPagePagination,
  FilterSection,
  FilterDateRange,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  type TableColumn,
} from '../shared';
import type { POSCustomer, POSOrder, CustomerDebtRecord, AppDataSurgicalUpdate } from '../../types';
import { generateId } from '../../src/lib';
import { calcOrderRevenue } from '../../src/lib/reportCalculations';
import POSQuickCustomerModal, { type QuickCustomerForm } from '../pos/POSQuickCustomerModal';
import CustomerDetailPage from './CustomerDetailPage';

interface Props {
  customers: POSCustomer[];
  orders: POSOrder[];
  customerDebtHistory?: CustomerDebtRecord[];
  onUpdateCustomers: (list: POSCustomer[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const parseMoney = (s: string) => {
  const n = parseFloat(s.replace(/\./g, '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
};
const toTime = (value?: string) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};
const inDateRange = (value: string | undefined, from: string, to: string) => {
  const time = toTime(value);
  if (time == null) return false;
  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toTimeValue = to ? new Date(`${to}T23:59:59`).getTime() : null;
  if (fromTime != null && time < fromTime) return false;
  if (toTimeValue != null && time > toTimeValue) return false;
  return true;
};

const TIER_OPTIONS = ['Tất cả các nhóm', 'Standard', 'Silver', 'Gold', 'Diamond'] as const;
const TIER_BADGE: Record<string, string> = {
  Diamond: 'bg-indigo-100 text-indigo-700',
  Gold: 'bg-amber-100 text-amber-700',
  Silver: 'bg-slate-200 text-slate-600',
  Standard: 'bg-slate-100 text-slate-500',
};

const emptyForm = (): Partial<POSCustomer> => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  points: 0,
  totalSpent: 0,
  debtAmount: 0,
  tier: 'Standard',
});

const emptyPOSForm = (): QuickCustomerForm => ({
  code: '',
  name: '',
  phone: '',
  group: '',
  birthday: '',
  gender: '',
  address: '',
  province: '',
  district: '',
  ward: '',
  taxCode: '',
  email: '',
  facebook: '',
  notes: '',
});

const CustomerListPage: React.FC<Props> = ({
  customers,
  orders,
  customerDebtHistory = [],
  onUpdateCustomers,
  onUpdateSurgical,
}) => {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('Tất cả các nhóm');
  const [customerType, setCustomerType] = useState<'all' | 'individual' | 'company'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [birthdayFrom, setBirthdayFrom] = useState('');
  const [birthdayTo, setBirthdayTo] = useState('');
  const [lastTxnFrom, setLastTxnFrom] = useState('');
  const [lastTxnTo, setLastTxnTo] = useState('');
  const [spentFrom, setSpentFrom] = useState('');
  const [spentTo, setSpentTo] = useState('');
  const [minSpent, setMinSpent] = useState('');
  const [maxSpent, setMaxSpent] = useState('');
  const [minDebt, setMinDebt] = useState('');
  const [maxDebt, setMaxDebt] = useState('');
  const [minPoints, setMinPoints] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [posForm, setPosForm] = useState<QuickCustomerForm>(emptyPOSForm());
  const [editCustomer, setEditCustomer] = useState<POSCustomer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<POSCustomer | null>(null);
  const [formData, setFormData] = useState<Partial<POSCustomer>>(emptyForm());

  // Stable code map (sorted by id for consistency)
  const codeMap = useMemo(() => {
    const map = new Map<string, string>();
    [...customers]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((c, i) => map.set(c.id, `KH${String(i + 1).padStart(6, '0')}`));
    return map;
  }, [customers]);

  // Per-customer order stats
  const orderStats = useMemo(() => {
    const map = new Map<string, { sold: number; returned: number }>();
    orders.forEach(o => {
      if (!o.customerId) return;
      const cur = map.get(o.customerId) || { sold: 0, returned: 0 };
      if (o.isReturn) cur.returned += Math.abs(Number(o.totalAmount) || 0);
      else cur.sold += calcOrderRevenue(o);
      map.set(o.customerId, cur);
    });
    return map;
  }, [orders]);

  // Per-customer debt from orders: debt = finalAmount - cashReceived
  const debtStats = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => {
      if (!o.customerId) return;
      const finalAmt = Number(o.finalAmount) || 0;
      const cashRecv = Number(o.cashReceived) || 0;
      const orderDebt = o.isReturn ? -(finalAmt - cashRecv) : (finalAmt - cashRecv);
      if (orderDebt !== 0) {
        map.set(o.customerId, (map.get(o.customerId) || 0) + orderDebt);
      }
    });
    return map;
  }, [orders]);

  const lastTransactionMap = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(order => {
      if (!order.customerId) return;
      const prev = map.get(order.customerId);
      if (!prev || new Date(order.date).getTime() > new Date(prev).getTime()) {
        map.set(order.customerId, order.date);
      }
    });
    return map;
  }, [orders]);

  const spentInRangeMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!spentFrom && !spentTo) return map;
    orders.forEach(order => {
      if (!order.customerId || order.isReturn || !inDateRange(order.date, spentFrom, spentTo)) return;
      map.set(order.customerId, (map.get(order.customerId) || 0) + calcOrderRevenue(order));
    });
    return map;
  }, [orders, spentFrom, spentTo]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (codeMap.get(c.id) || '').toLowerCase().includes(q)
      );
    }
    if (groupFilter !== 'Tất cả các nhóm') list = list.filter(c => c.tier === groupFilter);
    if (customerType !== 'all') {
      list = list.filter(c => {
        const type = c.customerType || (c.taxCode || c.companyName ? 'company' : 'individual');
        return type === customerType;
      });
    }
    if (genderFilter !== 'all') list = list.filter(c => c.gender === genderFilter);
    if (statusFilter !== 'all') {
      list = list.filter(c => (c.status || 'active') === statusFilter);
    }
    if (createdFrom || createdTo) {
      list = list.filter(c => inDateRange(c.createdAt, createdFrom, createdTo));
    }
    if (birthdayFrom || birthdayTo) {
      list = list.filter(c => inDateRange(c.birthday, birthdayFrom, birthdayTo));
    }
    if (lastTxnFrom || lastTxnTo) {
      list = list.filter(c => inDateRange(c.lastVisit || lastTransactionMap.get(c.id), lastTxnFrom, lastTxnTo));
    }
    const minS = parseMoney(minSpent);
    const maxS = parseMoney(maxSpent);
    if (spentFrom || spentTo) {
      // Khi có date range, minSpent/maxSpent áp dụng cho spending trong khoảng — không phải all-time
      list = list.filter(c => {
        const rangeSpent = spentInRangeMap.get(c.id) || 0;
        if (rangeSpent <= 0) return false;
        if (minS != null && rangeSpent < minS) return false;
        if (maxS != null && rangeSpent > maxS) return false;
        return true;
      });
    } else {
      if (minS != null) list = list.filter(c => (orderStats.get(c.id)?.sold ?? 0) >= minS);
      if (maxS != null) list = list.filter(c => (orderStats.get(c.id)?.sold ?? 0) <= maxS);
    }
    if (creatorSearch.trim()) {
      const q = creatorSearch.toLowerCase();
      list = list.filter(c => (c.createdBy || '').toLowerCase().includes(q));
    }

    const minD = parseMoney(minDebt);
    const maxD = parseMoney(maxDebt);
    if (minD != null) list = list.filter(c => (debtStats.get(c.id) ?? 0) >= minD);
    if (maxD != null) list = list.filter(c => (debtStats.get(c.id) ?? 0) <= maxD);

    const minP = parseMoney(minPoints);
    const maxP = parseMoney(maxPoints);
    if (minP != null) list = list.filter(c => c.points >= minP);
    if (maxP != null) list = list.filter(c => c.points <= maxP);

    if (deliveryArea.trim()) {
      const q = deliveryArea.toLowerCase();
      list = list.filter(c => c.address?.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let av: string | number = 0,
        bv: string | number = 0;
      if (sortKey === 'name') {
        av = a.name;
        bv = b.name;
      } else if (sortKey === 'phone') {
        av = a.phone;
        bv = b.phone;
      } else if (sortKey === 'debt') {
        av = debtStats.get(a.id) ?? 0;
        bv = debtStats.get(b.id) ?? 0;
      } else if (sortKey === 'spent') {
        av = orderStats.get(a.id)?.sold ?? 0;
        bv = orderStats.get(b.id)?.sold ?? 0;
      } else if (sortKey === 'net') {
        const sa = orderStats.get(a.id);
        const sb = orderStats.get(b.id);
        av = sa ? sa.sold - sa.returned : 0;
        bv = sb ? sb.sold - sb.returned : 0;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [
    customers,
    search,
    groupFilter,
    customerType,
    genderFilter,
    statusFilter,
    createdFrom,
    createdTo,
    birthdayFrom,
    birthdayTo,
    lastTxnFrom,
    lastTxnTo,
    lastTransactionMap,
    spentFrom,
    spentTo,
    spentInRangeMap,
    creatorSearch,
    minSpent,
    maxSpent,
    minDebt,
    maxDebt,
    minPoints,
    maxPoints,
    deliveryArea,
    sortKey,
    sortDir,
    codeMap,
    orderStats,
  ]);

  // Summary totals (all filtered, not just current page)
  const totals = useMemo(
    () => ({
      debt: filtered.reduce((s, c) => s + (debtStats.get(c.id) ?? 0), 0),
      spent: filtered.reduce((s, c) => s + (orderStats.get(c.id)?.sold ?? 0), 0),
      net: filtered.reduce((s, c) => {
        const st = orderStats.get(c.id);
        return s + (st ? st.sold - st.returned : 0);
      }, 0),
    }),
    [filtered, orderStats]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasActiveFilters =
    groupFilter !== 'Tất cả các nhóm' ||
    customerType !== 'all' ||
    genderFilter !== 'all' ||
    statusFilter !== 'all' ||
    !!createdFrom ||
    !!createdTo ||
    !!birthdayFrom ||
    !!birthdayTo ||
    !!lastTxnFrom ||
    !!lastTxnTo ||
    !!spentFrom ||
    !!spentTo ||
    !!minSpent ||
    !!maxSpent ||
    !!minDebt ||
    !!maxDebt ||
    !!minPoints ||
    !!maxPoints ||
    !!deliveryArea ||
    !!creatorSearch;

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) return;
    if (editCustomer) {
      const updated = customers.map(c =>
        c.id === editCustomer.id ? { ...editCustomer, ...formData } : c
      );
      onUpdateCustomers(updated);
      if (onUpdateSurgical) {
        try {
          await onUpdateSurgical([{ key: 'posCustomers', item: { ...editCustomer, ...formData } }]);
        } catch (err) {
          console.error('[CustomerListPage] handleSave edit failed', err);
        }
      }
      setEditCustomer(null);
    } else {
      const newCustomer: POSCustomer = {
        id: generateId(),
        name: formData.name!,
        phone: formData.phone || '',
        email: formData.email || '',
        address: formData.address || '',
        notes: formData.notes || '',
        points: 0,
        totalSpent: 0,
        debtAmount: 0,
        tier: formData.tier || 'Standard',
        lastVisit: undefined,
        status: 'active',
        customerType: 'individual',
        createdAt: new Date().toISOString(),
      };
      onUpdateCustomers([...customers, newCustomer]);
      if (onUpdateSurgical) {
        try {
          await onUpdateSurgical([{ key: 'posCustomers', item: newCustomer }]);
        } catch (err) {
          console.error('[CustomerListPage] handleSave add failed', err);
        }
      }
    }
    setFormData(emptyForm());
    setShowAddModal(false);
  };

  const handleSaveFromPOS = async () => {
    if (!posForm.name.trim()) return;
    const addressParts = [posForm.address, posForm.ward, posForm.district, posForm.province].filter(Boolean);
    if (editCustomer) {
      const updated: POSCustomer = {
        ...editCustomer,
        name: posForm.name,
        phone: posForm.phone,
        email: posForm.email || undefined,
        address: addressParts.join(', ') || undefined,
        notes: posForm.notes || undefined,
        customerType: posForm.taxCode ? 'company' : editCustomer.customerType || 'individual',
        gender: posForm.gender || undefined,
        birthday: posForm.birthday || undefined,
        taxCode: posForm.taxCode || undefined,
        facebook: posForm.facebook || undefined,
      };
      onUpdateCustomers(customers.map(c => c.id === editCustomer.id ? updated : c));
      if (onUpdateSurgical) {
        try {
          await onUpdateSurgical([{ key: 'posCustomers', item: updated }]);
        } catch (err) {
          console.error('[CustomerListPage] handleSaveFromPOS edit failed', err);
        }
      }
      setEditCustomer(null);
    } else {
      const newCustomer: POSCustomer = {
        id: generateId(),
        name: posForm.name,
        phone: posForm.phone,
        email: posForm.email || undefined,
        address: addressParts.join(', ') || undefined,
        notes: posForm.notes || undefined,
        points: 0,
        totalSpent: 0,
        debtAmount: 0,
        tier: 'Standard',
        status: 'active',
        customerType: posForm.taxCode ? 'company' : 'individual',
        gender: posForm.gender || undefined,
        birthday: posForm.birthday || undefined,
        taxCode: posForm.taxCode || undefined,
        facebook: posForm.facebook || undefined,
        createdAt: new Date().toISOString(),
      };
      onUpdateCustomers([...customers, newCustomer]);
      if (onUpdateSurgical) {
        try {
          await onUpdateSurgical([{ key: 'posCustomers', item: newCustomer }]);
        } catch (err) {
          console.error('[CustomerListPage] handleSaveFromPOS add failed', err);
        }
      }
    }
    setShowPOSModal(false);
    setPosForm(emptyPOSForm());
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    onUpdateCustomers(customers.filter(c => c.id !== deleteId));
    if (onUpdateSurgical) {
      try {
        await onUpdateSurgical([{ key: 'posCustomers', item: { id: deleteId }, isDelete: true }]);
      } catch (err) {
        console.error('[CustomerListPage] handleDelete failed', err);
      }
    }
    setDeleteId(null);
  };

  const handleToggleStatus = async (customer: POSCustomer) => {
    const updated: POSCustomer = {
      ...customer,
      status: customer.status === 'inactive' ? 'active' : 'inactive',
    };
    onUpdateCustomers(customers.map(c => (c.id === customer.id ? updated : c)));
    if (onUpdateSurgical) {
      try {
        await onUpdateSurgical([{ key: 'posCustomers', item: updated }]);
      } catch (err) {
        console.error('[CustomerListPage] handleToggleStatus failed', err);
      }
    }
    setDetailCustomer(updated);
  };

  // Table columns
  const columns: TableColumn<POSCustomer>[] = [
    {
      key: 'code',
      label: 'Mã khách hàng',
      width: 'w-[160px]',
      render: c => (
        <span className="text-blue-600 font-medium text-sm">{codeMap.get(c.id) || '—'}</span>
      ),
    },
    {
      key: 'name',
      label: 'Tên khách hàng',
      sortable: true,
      render: c => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-800">{c.name}</span>
          {c.tier !== 'Standard' && (
            <span
              className={`text-2xs px-1.5 py-0.5 rounded font-medium shrink-0 ${TIER_BADGE[c.tier]}`}
            >
              {c.tier}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Điện thoại',
      width: 'w-[160px]',
      sortable: true,
      render: c => <span className="text-sm text-slate-600">{c.phone || '—'}</span>,
    },
    {
      key: 'debt',
      label: 'Nợ hiện tại',
      width: 'w-[160px]',
      align: 'right',
      sortable: true,
      render: c => {
        const debt = debtStats.get(c.id) ?? 0;
        return (
          <span
            className={`text-sm font-medium tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-slate-400'}`}
          >
            {fmt(debt)}
          </span>
        );
      },
    },
    {
      key: 'spent',
      label: 'Tổng bán',
      width: 'w-[160px]',
      align: 'right',
      sortable: true,
      render: c => (
        <span className="text-sm tabular-nums text-slate-700">{fmt(orderStats.get(c.id)?.sold ?? 0)}</span>
      ),
    },
    {
      key: 'net',
      label: 'Tổng bán trừ trả hàng',
      width: 'w-[200px]',
      align: 'right',
      sortable: true,
      render: c => {
        const st = orderStats.get(c.id);
        const net = st ? st.sold - st.returned : 0;
        return <span className="text-sm tabular-nums text-slate-700">{fmt(net)}</span>;
      },
    },
  ];

  const pillClass = (active: boolean) =>
    `text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'border-slate-200 text-slate-600 hover:border-blue-300'
    }`;

  const rangeInputs = (
    min: string,
    setMin: (v: string) => void,
    max: string,
    setMax: (v: string) => void
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
        <span className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border-r border-slate-200 shrink-0">
          Từ
        </span>
        <input
          type="text"
          placeholder="Nhập giá trị"
          value={min}
          onChange={e => {
            setMin(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-2.5 py-2 text-xs text-slate-700 placeholder-slate-300 focus:outline-none"
        />
      </div>
      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
        <span className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border-r border-slate-200 shrink-0">
          Tới
        </span>
        <input
          type="text"
          placeholder="Nhập giá trị"
          value={max}
          onChange={e => {
            setMax(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-2.5 py-2 text-xs text-slate-700 placeholder-slate-300 focus:outline-none"
        />
      </div>
    </div>
  );

  const dateRangeInputs = (
    from: string,
    setFrom: (v: string) => void,
    to: string,
    setTo: (v: string) => void
  ) => (
    <FilterDateRange
      startDate={from}
      endDate={to}
      onStartDateChange={date => {
        setFrom(date);
        setPage(1);
      }}
      onEndDateChange={date => {
        setTo(date);
        setPage(1);
      }}
    />
  );

  const sidebar = (
    <div className="flex flex-col overflow-y-auto h-full">
      {/* Nhóm khách hàng */}
      <FilterSection
        title="Nhóm khách hàng"
        action={
          <button
            onClick={() => {
              setFormData(emptyForm());
              setShowAddModal(true);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            Tạo mới
          </button>
        }
      >
        <select
          value={groupFilter}
          onChange={e => {
            setGroupFilter(e.target.value);
            setPage(1);
          }}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-300"
        >
          {TIER_OPTIONS.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* Ngày tạo */}
      <FilterSection title="Ngày tạo">
        {dateRangeInputs(createdFrom, setCreatedFrom, createdTo, setCreatedTo)}
      </FilterSection>

      {/* Người tạo */}
      <FilterSection title="Người tạo">
        <input
          type="text"
          placeholder="Chọn người tạo"
          value={creatorSearch}
          onChange={e => setCreatorSearch(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-300"
        />
      </FilterSection>

      {/* Loại khách hàng */}
      <FilterSection title="Loại khách hàng">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Tất cả'],
              ['individual', 'Cá nhân'],
              ['company', 'Công ty'],
            ] as const
          ).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => {
                setCustomerType(v);
                setPage(1);
              }}
              className={pillClass(customerType === v)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Giới tính */}
      <FilterSection title="Giới tính">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Tất cả'],
              ['male', 'Nam'],
              ['female', 'Nữ'],
            ] as const
          ).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => {
                setGenderFilter(v);
                setPage(1);
              }}
              className={pillClass(genderFilter === v)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Sinh nhật */}
      <FilterSection title="Sinh nhật">
        {dateRangeInputs(birthdayFrom, setBirthdayFrom, birthdayTo, setBirthdayTo)}
      </FilterSection>

      {/* Ngày giao dịch cuối */}
      <FilterSection title="Ngày giao dịch cuối">
        {dateRangeInputs(lastTxnFrom, setLastTxnFrom, lastTxnTo, setLastTxnTo)}
      </FilterSection>

      {/* Tổng bán */}
      <FilterSection title="Tổng bán">
        <p className="text-xs text-slate-400 mb-1.5">Giá trị</p>
        {rangeInputs(minSpent, setMinSpent, maxSpent, setMaxSpent)}
        <p className="text-xs text-slate-400 mt-3 mb-1.5">Thời gian</p>
        {dateRangeInputs(spentFrom, setSpentFrom, spentTo, setSpentTo)}
      </FilterSection>

      {/* Nợ hiện tại */}
      <FilterSection title="Nợ hiện tại">
        {rangeInputs(minDebt, setMinDebt, maxDebt, setMaxDebt)}
      </FilterSection>

      {/* Điểm hiện tại */}
      <FilterSection title="Điểm hiện tại">
        {rangeInputs(minPoints, setMinPoints, maxPoints, setMaxPoints)}
      </FilterSection>

      {/* Khu vực giao hàng */}
      <FilterSection title="Khu vực giao hàng">
        <input
          type="text"
          placeholder="Chọn Tỉnh/TP - Quận/Huyện"
          value={deliveryArea}
          onChange={e => {
            setDeliveryArea(e.target.value);
            setPage(1);
          }}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-300"
        />
      </FilterSection>

      {/* Trạng thái */}
      <FilterSection title="Trạng thái">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Tất cả'],
              ['active', 'Đang hoạt động'],
              ['inactive', 'Ngừng hoạt động'],
            ] as const
          ).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => {
                setStatusFilter(v);
                setPage(1);
              }}
              className={pillClass(statusFilter === v)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </FilterSection>
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-100 shrink-0">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Theo mã, tên, số điện thoại"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-300"
        />
      </div>
      <div className="flex-1" />
      <button
        onClick={() => {
          setPosForm(emptyPOSForm());
          setShowPOSModal(true);
        }}
        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Khách hàng
      </button>
    </div>
  );

  return (
    <>
      <ListPageLayout
        sidebar={sidebar}
        toolbar={toolbar}
        sidebarTitle="Khách hàng"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => {
          setGroupFilter('Tất cả các nhóm');
          setCustomerType('all');
          setGenderFilter('all');
          setStatusFilter('all');
          setCreatedFrom('');
          setCreatedTo('');
          setBirthdayFrom('');
          setBirthdayTo('');
          setLastTxnFrom('');
          setLastTxnTo('');
          setSpentFrom('');
          setSpentTo('');
          setMinSpent('');
          setMaxSpent('');
          setMinDebt('');
          setMaxDebt('');
          setMinPoints('');
          setMaxPoints('');
          setDeliveryArea('');
          setCreatorSearch('');
          setPage(1);
        }}
        pagination={
          <ListPagePagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={size => {
              setPageSize(size);
              setPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        }
      >
        {/* Totals summary row */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-6 px-5 py-2 bg-white border-b border-slate-100 text-xs text-slate-500">
            <span className="flex-1 text-slate-700 font-medium">{filtered.length} khách hàng</span>
            <span>
              Nợ:{' '}
              <strong className={totals.debt > 0 ? 'text-rose-600' : 'text-slate-700'}>
                {fmt(totals.debt)}
              </strong>
            </span>
            <span>
              Tổng bán: <strong className="text-slate-700">{fmt(totals.spent)}</strong>
            </span>
            <span>
              Trừ trả hàng: <strong className="text-slate-700">{fmt(totals.net)}</strong>
            </span>
          </div>
        )}

        <ListPageTable
          columns={columns}
          data={paginated}
          keyExtractor={c => c.id}
          sortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
          onRowClick={c => setDetailCustomer(prev => (prev?.id === c.id ? null : c))}
          rowClassName={() => 'group'}
          expandedRowId={detailCustomer?.id}
          expandedRowContent={
            detailCustomer ? (
              <CustomerDetailPage
                customer={detailCustomer}
                customerCode={codeMap.get(detailCustomer.id) || '—'}
                orders={orders}
                customerDebtHistory={customerDebtHistory}
                orderStats={orderStats.get(detailCustomer.id)}
                onClose={() => setDetailCustomer(null)}
                onEdit={() => {
                  setPosForm({
                    code: codeMap.get(detailCustomer.id) || '',
                    name: detailCustomer.name,
                    phone: detailCustomer.phone,
                    email: detailCustomer.email || '',
                    address: detailCustomer.address || '',
                    province: '',
                    district: '',
                    ward: '',
                    group: detailCustomer.tier,
                    birthday: '',
                    gender: '',
                    taxCode: '',
                    facebook: '',
                    notes: detailCustomer.notes || '',
                  });
                  setEditCustomer(detailCustomer);
                  setShowPOSModal(true);
                  setDetailCustomer(null);
                }}
                onDelete={() => {
                  setDeleteId(detailCustomer.id);
                  setDetailCustomer(null);
                }}
                onAnalyze={() => {
                  const stats = orderStats.get(detailCustomer.id);
                  window.alert(
                    `Phân tích ${detailCustomer.name}\nTổng bán: ${fmt(stats?.sold ?? 0)}\nTrả hàng: ${fmt(stats?.returned ?? 0)}\nNợ hiện tại: ${fmt(debtStats.get(detailCustomer.id) ?? 0)}`
                  );
                }}
                onToggleStatus={() => handleToggleStatus(detailCustomer)}
              />
            ) : null
          }
          emptyState={
            <div className="text-center py-16 text-slate-400 text-sm">Không có khách hàng</div>
          }
        />
      </ListPageLayout>

      {/* POS-style Add / Edit Customer Modal */}
      <POSQuickCustomerModal
        isOpen={showPOSModal}
        form={posForm}
        onChange={setPosForm}
        title={editCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
        onClose={() => {
          setShowPOSModal(false);
          setPosForm(emptyPOSForm());
          setEditCustomer(null);
        }}
        onSave={handleSaveFromPOS}
      />

      {/* Add / Edit Modal */}
      {(showAddModal || editCustomer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">
                {editCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditCustomer(null);
                  setFormData(emptyForm());
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {(
                [
                  ['name', 'Tên khách hàng *', 'text'],
                  ['phone', 'Số điện thoại', 'tel'],
                  ['email', 'Email', 'email'],
                  ['address', 'Địa chỉ', 'text'],
                  ['notes', 'Ghi chú', 'text'],
                ] as const
              ).map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(formData[field] as string) || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nhóm khách hàng</label>
                <select
                  value={formData.tier || 'Standard'}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      tier: e.target.value as POSCustomer['tier'],
                    }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
                >
                  {(['Standard', 'Silver', 'Gold', 'Diamond'] as const).map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditCustomer(null);
                  setFormData(emptyForm());
                }}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name?.trim()}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
              >
                {editCustomer ? 'Lưu thay đổi' : 'Thêm khách hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">Xóa khách hàng?</h3>
            <p className="text-sm text-slate-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerListPage;
