import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  SlidersHorizontal,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { AppData, ExpenseRecord, ExpenseCategory, POSOrder } from '../../types';
import { FilterDateRange, FilterSection, ListPageLayout, ListPagePagination } from '../shared';

interface Props {
  data: AppData;
  onAddExpense: (expense: ExpenseRecord) => void;
  onAddPosOrder: (order: POSOrder) => void;
}

type FundType = 'cash' | 'bank' | 'momo' | 'all';
type VoucherType = 'all' | 'thu' | 'chi';
type StatusFilter = 'all' | 'active' | 'cancelled';
type BusinessFilter = 'all' | 'yes' | 'no';
type FormTab = 'chi' | 'thu';
type CashOutType = 'customer_refund' | 'store_expense';
type CashOutFilter = 'all' | CashOutType;

interface LedgerEntry {
  id: string;
  code: string;
  date: string;
  type: 'thu' | 'chi';
  cashOutType?: CashOutType;
  expenseCategory?: string;
  description: string;
  person: string;
  amount: number;
  status: 'active' | 'cancelled';
  paymentMethod: 'Cash' | 'Bank' | 'Momo' | 'Other' | 'Card';
}

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

const FUND_LABELS: Record<FundType, string> = {
  cash: 'tiền mặt',
  bank: 'ngân hàng',
  momo: 'ví điện tử',
  all: 'tổng hợp',
};

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
};

const today = () => new Date().toISOString().split('T')[0];
const thisMonthStart = () => `${today().slice(0, 7)}-01`;
const toDateString = (date: Date) => date.toLocaleDateString('sv-SE');
const toLedgerDateKey = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoLike) return isoLike[1];
  const vnDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vnDate) {
    const [, day, month, year] = vnDate;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : toDateString(parsed);
};
const formatDisplayDate = (date: string) => date ? date.split('-').reverse().join('/') : '';
const parseDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
const monthLabel = (date: Date) => `Tháng ${date.getMonth() + 1} ${date.getFullYear()}`;
const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);
const getMonthDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: { date: Date; day: number; inMonth: boolean }[] = [];

  for (let index = leadingBlanks; index > 0; index--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - index + 1),
      day: prevMonthDays - index + 1,
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - leadingBlanks - daysInMonth + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), day: nextDay, inMonth: false });
  }

  return cells;
};

const SingleDatePicker: React.FC<{
  value: string;
  onChange: (date: string) => void;
  tone?: 'blue' | 'red';
}> = ({ value, onChange, tone = 'blue' }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedDate = parseDate(value || today());
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [pickerView, setPickerView] = useState<'days' | 'months'>('days');
  const [popupPosition, setPopupPosition] = useState({ top: 16, left: 16 });
  const activeColor = tone === 'red' ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white';
  const hoverColor = tone === 'red' ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-blue-50 hover:text-blue-600';

  const positionPopup = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect || typeof window === 'undefined') return;
    const popupWidth = 292;
    const popupHeight = 360;
    const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - popupWidth - 16));
    const preferredTop = rect.top - popupHeight - 8;
    const top =
      preferredTop >= 16
        ? preferredTop
        : Math.min(rect.bottom + 8, Math.max(16, window.innerHeight - popupHeight - 16));
    setPopupPosition({ top, left });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    positionPopup();
    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
    return () => {
      window.removeEventListener('resize', positionPopup);
      window.removeEventListener('scroll', positionPopup, true);
    };
  }, [isOpen]);

  const openPicker = () => {
    const base = parseDate(value || today());
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setPickerView('days');
    positionPopup();
    setIsOpen(open => !open);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className="flex h-[38px] w-36 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-white"
      >
        <span>{formatDisplayDate(value || today())}</span>
        <Calendar className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className="fixed z-modal w-[292px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
          style={{ top: popupPosition.top, left: popupPosition.left }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewMonth(month =>
                  pickerView === 'months'
                    ? new Date(month.getFullYear() - 1, month.getMonth(), 1)
                    : addMonths(month, -1)
                )
              }
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPickerView(view => (view === 'days' ? 'months' : 'days'))}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 hover:text-blue-600"
            >
              {pickerView === 'months' ? viewMonth.getFullYear() : monthLabel(viewMonth)}
            </button>
            <button
              type="button"
              onClick={() =>
                setViewMonth(month =>
                  pickerView === 'months'
                    ? new Date(month.getFullYear() + 1, month.getMonth(), 1)
                    : addMonths(month, 1)
                )
              }
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            {pickerView === 'months' ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, monthIndex) => {
                  const isSelectedMonth =
                    viewMonth.getFullYear() === selectedDate.getFullYear() &&
                    monthIndex === selectedDate.getMonth();
                  return (
                    <button
                      key={monthIndex}
                      type="button"
                      onClick={() => {
                        setViewMonth(new Date(viewMonth.getFullYear(), monthIndex, 1));
                        setPickerView('days');
                      }}
                      className={`h-10 rounded-lg text-xs font-semibold transition ${
                        isSelectedMonth ? activeColor : `text-slate-700 ${hoverColor}`
                      }`}
                    >
                      Tháng {monthIndex + 1}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {getMonthDays(viewMonth).map((cell, index) => {
                    const key = toDateString(cell.date);
                    const selected = key === value;
                    return (
                      <button
                        key={`${key}-${index}`}
                        type="button"
                        onClick={() => {
                          onChange(key);
                          setIsOpen(false);
                        }}
                        className={`h-8 rounded-full text-xs font-semibold transition ${
                          selected
                            ? activeColor
                            : cell.inMonth
                              ? `text-slate-800 ${hoverColor}`
                              : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                const todayValue = today();
                onChange(todayValue);
                setViewMonth(new Date(parseDate(todayValue).getFullYear(), parseDate(todayValue).getMonth(), 1));
                setIsOpen(false);
              }}
              className="text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const orderToEntry = (o: POSOrder): LedgerEntry => ({
  id: o.id,
  code: o.orderCode || o.id.slice(0, 10).toUpperCase(),
  date: o.date,
  type: o.isReturn ? 'chi' : 'thu',
  cashOutType: o.isReturn ? 'customer_refund' : undefined,
  description: o.isReturn ? 'Trả hàng khách' : 'Thu tiền khách hàng',
  person: o.customerName || 'Khách lẻ',
  amount: Math.abs(o.finalAmount ?? 0),
  status: o.status === 'cancelled' ? 'cancelled' : 'active',
  paymentMethod: o.paymentMethod ?? 'Cash',
});

const expenseToEntry = (e: ExpenseRecord, idx: number): LedgerEntry => ({
  id: e.id,
  code: `PTCHI${String(idx + 1).padStart(6, '0')}`,
  date: e.date,
  type: 'chi',
  cashOutType: 'store_expense',
  expenseCategory: e.category || 'Chi phí khác',
  description: e.category || 'Chi phí',
  person: e.description || '—',
  amount: e.amount ?? 0,
  status: 'active',
  paymentMethod: 'Cash',
});

const CashLedgerPage: React.FC<Props> = ({ data, onAddExpense, onAddPosOrder }) => {
  // ── Filter state ────────────────────────────────────────────
  const [fundType, setFundType] = useState<FundType>('cash');
  const [customStart, setCustomStart] = useState(() => thisMonthStart());
  const [customEnd, setCustomEnd] = useState(() => today());
  const [voucherType, setVoucherType] = useState<VoucherType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>('all');
  const [cashOutFilter, setCashOutFilter] = useState<CashOutFilter>('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // ── Quick entry form state ──────────────────────────────────
  const [formTab, setFormTab] = useState<FormTab>('chi');
  const [chiForm, setChiForm] = useState({ date: today(), category: '', amount: '', description: '' });
  const [thuForm, setThuForm] = useState({ date: today(), amount: '', person: '', paymentMethod: 'Cash' as POSOrder['paymentMethod'] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const categories: ExpenseCategory[] = data.expenseCategories || [];
  const parentCategories = categories.filter(c => !c.parentId);
  const categoryChildrenByParent = useMemo(() => {
    const map = new Map<string, ExpenseCategory[]>();
    categories.forEach(category => {
      if (!category.parentId) return;
      const children = map.get(category.parentId) || [];
      children.push(category);
      map.set(category.parentId, children);
    });
    return map;
  }, [categories]);

  const selectedExpenseCategoryNames = useMemo(() => {
    if (expenseCategoryFilter === 'all') return new Set<string>();
    const selected = categories.find(category => category.name === expenseCategoryFilter);
    if (!selected) return new Set([expenseCategoryFilter]);
    const names = new Set<string>([selected.name]);
    const collectChildren = (parentId: string) => {
      (categoryChildrenByParent.get(parentId) || []).forEach(child => {
        names.add(child.name);
        collectChildren(child.id);
      });
    };
    collectChildren(selected.id);
    return names;
  }, [categories, categoryChildrenByParent, expenseCategoryFilter]);

  // ── Dates ───────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonth = todayStr.slice(0, 7);
  const periodStart = customStart || `${thisMonth}-01`;
  const periodEnd = customEnd || todayStr;

  // ── Unified ledger ──────────────────────────────────────────
  const allEntries = useMemo<LedgerEntry[]>(() => {
    const orderEntries = (data.posOrders || []).map(orderToEntry);
    const expenseEntries = (data.expenses || []).map(expenseToEntry);
    return [...orderEntries, ...expenseEntries].sort(
      (a, b) => toLedgerDateKey(b.date).localeCompare(toLedgerDateKey(a.date))
    );
  }, [data.posOrders, data.expenses]);

  const fundFiltered = useMemo(() => {
    if (fundType === 'all') return allEntries;
    const methodMap: Record<FundType, string[]> = { cash: ['Cash'], bank: ['Bank'], momo: ['Momo'], all: [] };
    return allEntries.filter(e => methodMap[fundType].includes(e.paymentMethod));
  }, [allEntries, fundType]);

  const openingBalance = useMemo(
    () => fundFiltered
      .filter(e => toLedgerDateKey(e.date) < periodStart && e.status === 'active')
      .reduce((s, e) => s + (e.type === 'thu' ? e.amount : -e.amount), 0),
    [fundFiltered, periodStart]
  );

  const periodEntries = useMemo(
    () =>
      fundFiltered.filter(e => {
        const dateKey = toLedgerDateKey(e.date);
        return dateKey >= periodStart && dateKey <= periodEnd;
      }),
    [fundFiltered, periodStart, periodEnd]
  );

  const filtered = useMemo(() => periodEntries.filter(e => {
    if (voucherType !== 'all' && e.type !== voucherType) return false;
    if (statusFilter === 'active' && e.status !== 'active') return false;
    if (statusFilter === 'cancelled' && e.status !== 'cancelled') return false;
    if (cashOutFilter !== 'all' && (e.type !== 'chi' || e.cashOutType !== cashOutFilter)) return false;
    if (
      expenseCategoryFilter !== 'all' &&
      (e.type !== 'chi' || !e.expenseCategory || !selectedExpenseCategoryNames.has(e.expenseCategory))
    ) {
      return false;
    }
    if (search && !e.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [periodEntries, voucherType, statusFilter, cashOutFilter, expenseCategoryFilter, selectedExpenseCategoryNames, search]);

  const totalThu = useMemo(
    () => filtered.filter(e => e.type === 'thu' && e.status === 'active').reduce((s, e) => s + e.amount, 0),
    [filtered]
  );
  const totalChi = useMemo(
    () => filtered.filter(e => e.type === 'chi' && e.status === 'active').reduce((s, e) => s + e.amount, 0),
    [filtered]
  );
  const totalCustomerRefund = useMemo(
    () =>
      filtered
        .filter(e => e.type === 'chi' && e.cashOutType === 'customer_refund' && e.status === 'active')
        .reduce((s, e) => s + e.amount, 0),
    [filtered]
  );
  const totalStoreExpense = useMemo(
    () =>
      filtered
        .filter(e => e.type === 'chi' && e.cashOutType === 'store_expense' && e.status === 'active')
        .reduce((s, e) => s + e.amount, 0),
    [filtered]
  );
  const closingBalance = openingBalance + totalThu - totalChi;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const handlePageChange = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  // ── Quick entry handlers ────────────────────────────────────
  const handleAiClassify = async () => {
    if (chiForm.description.length < 5) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/expense-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: chiForm.description, categories }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.categoryName) setChiForm(f => ({ ...f, category: result.categoryName }));
      }
    } catch {
      // non-critical
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddChi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chiForm.date || !chiForm.amount || !chiForm.description) return;
    setIsSubmitting(true);
    const newExpense: ExpenseRecord = {
      id: crypto.randomUUID(),
      date: chiForm.date,
      category: chiForm.category || 'Chi phí khác',
      amount: parseFloat(chiForm.amount),
      description: chiForm.description,
    };
    onAddExpense(newExpense);
    setChiForm({ date: today(), category: '', amount: '', description: '' });
    setIsSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 1800);
  };

  const handleAddThu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thuForm.date || !thuForm.amount) return;
    setIsSubmitting(true);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newOrder: POSOrder = {
      id: crypto.randomUUID(),
      orderCode: `TTHD${String(Date.now()).slice(-6)}`,
      date: `${thuForm.date}T${timeStr}:00`,
      customerName: thuForm.person || 'Khách lẻ',
      items: [],
      totalAmount: parseFloat(thuForm.amount),
      discount: 0,
      finalAmount: parseFloat(thuForm.amount),
      paymentMethod: thuForm.paymentMethod,
      staffId: '',
      pointsEarned: 0,
      status: 'completed',
    };
    onAddPosOrder(newOrder);
    setThuForm({ date: today(), amount: '', person: '', paymentMethod: 'Cash' });
    setIsSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 1800);
  };

  const handleVoucherCheck = (type: 'thu' | 'chi', checked: boolean) => {
    if (!checked) setVoucherType(prev => prev === 'all' ? (type === 'thu' ? 'chi' : 'thu') : 'all');
    else setVoucherType(prev => prev === 'all' ? type : prev !== type ? 'all' : type);
    setPage(1);
  };

  const hasActiveFilters =
    fundType !== 'cash' ||
    customStart !== thisMonthStart() ||
    customEnd !== today() ||
    voucherType !== 'all' ||
    statusFilter !== 'active' ||
    businessFilter !== 'all' ||
    cashOutFilter !== 'all' ||
    expenseCategoryFilter !== 'all' ||
    !!search.trim();

  const clearFilters = () => {
    setFundType('cash');
    setCustomStart(thisMonthStart());
    setCustomEnd(today());
    setVoucherType('all');
    setStatusFilter('active');
    setBusinessFilter('all');
    setCashOutFilter('all');
    setExpenseCategoryFilter('all');
    setSearch('');
    setPage(1);
  };

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto">
      <FilterSection title="Quỹ tiền">
        <div className="space-y-1.5">
          {([
            { value: 'cash', label: 'Tiền mặt' },
            { value: 'bank', label: 'Ngân hàng' },
            { value: 'momo', label: 'Ví điện tử' },
            { value: 'all', label: 'Tổng quỹ' },
          ] as { value: FundType; label: string }[]).map(opt => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="fundType"
                value={opt.value}
                checked={fundType === opt.value}
                onChange={() => {
                  setFundType(opt.value);
                  setPage(1);
                }}
                className="accent-blue-600"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Thời gian">
        <FilterDateRange
          startDate={customStart}
          endDate={customEnd}
          onStartDateChange={date => {
            setCustomStart(date);
            setPage(1);
          }}
          onEndDateChange={date => {
            setCustomEnd(date);
            setPage(1);
          }}
        />
      </FilterSection>

      <FilterSection title="Loại chứng từ">
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={voucherType === 'all' || voucherType === 'thu'}
              onChange={e => handleVoucherCheck('thu', e.target.checked)}
              className="accent-blue-600"
            />
            <span>Phiếu thu</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={voucherType === 'all' || voucherType === 'chi'}
              onChange={e => handleVoucherCheck('chi', e.target.checked)}
              className="accent-blue-600"
            />
            <span>Phiếu chi</span>
          </label>
        </div>
      </FilterSection>

      <FilterSection title="Loại phiếu chi">
        <div className="space-y-1.5">
          {([
            { value: 'all', label: 'Tất cả phiếu chi' },
            { value: 'customer_refund', label: 'Trả hàng khách' },
            { value: 'store_expense', label: 'Chi tiêu cửa hàng' },
          ] as { value: CashOutFilter; label: string }[]).map(opt => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="cashOutType"
                value={opt.value}
                checked={cashOutFilter === opt.value}
                onChange={() => {
                  setCashOutFilter(opt.value);
                  if (opt.value !== 'all') setVoucherType('chi');
                  setPage(1);
                }}
                className="accent-red-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Danh mục chi phí">
        <select
          value={expenseCategoryFilter}
          onChange={event => {
            setExpenseCategoryFilter(event.target.value);
            if (event.target.value !== 'all') {
              setVoucherType('chi');
              setCashOutFilter('store_expense');
            }
            setPage(1);
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300"
        >
          <option value="all">Tất cả danh mục</option>
          {parentCategories.map(parent => (
            <React.Fragment key={parent.id}>
              <option value={parent.name}>{parent.name}</option>
              {(categoryChildrenByParent.get(parent.id) || []).map(level2 => (
                <React.Fragment key={level2.id}>
                  <option value={level2.name}>-- {level2.name}</option>
                  {(categoryChildrenByParent.get(level2.id) || []).map(level3 => (
                    <option key={level3.id} value={level3.name}>
                      ---- {level3.name}
                    </option>
                  ))}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </select>
        {expenseCategoryFilter !== 'all' && (
          <p className="mt-2 text-xs leading-4 text-slate-400">
            Chỉ áp dụng cho phiếu chi phát sinh từ sổ chi phí.
          </p>
        )}
      </FilterSection>

      <FilterSection title="Trạng thái">
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={statusFilter === 'all' || statusFilter === 'active'}
              onChange={e => {
                setStatusFilter(e.target.checked ? (statusFilter === 'cancelled' ? 'all' : 'active') : 'cancelled');
                setPage(1);
              }}
              className="accent-blue-600"
            />
            <span>Đã thanh toán</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={statusFilter === 'all' || statusFilter === 'cancelled'}
              onChange={e => {
                setStatusFilter(e.target.checked ? (statusFilter === 'active' ? 'all' : 'cancelled') : 'active');
                setPage(1);
              }}
              className="accent-blue-600"
            />
            <span>Đã hủy</span>
          </label>
        </div>
      </FilterSection>

      <FilterSection title="Hạch toán kết quả kinh doanh">
        <div className="flex gap-1.5">
          {([
            { value: 'all', label: 'Tất cả' },
            { value: 'yes', label: 'Có' },
            { value: 'no', label: 'Không' },
          ] as { value: BusinessFilter; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setBusinessFilter(opt.value);
                setPage(1);
              }}
              className={`flex-1 rounded-lg border py-1 text-xs transition-colors ${
                businessFilter === opt.value
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
      <div className="min-w-[180px]">
        <h1 className="text-base font-bold text-slate-900">Sổ quỹ {FUND_LABELS[fundType]}</h1>
      </div>
      <div className="relative flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Theo mã phiếu"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-300 focus:outline-none"
        />
      </div>
      <button className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50">
        <SlidersHorizontal className="h-4 w-4" />
      </button>
      <div className="flex-1" />
      <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50">
        <Download className="h-3.5 w-3.5" />
        Xuất file
      </button>
    </div>
  );

  return (
    <ListPageLayout
      sidebar={sidebar}
      toolbar={toolbar}
      sidebarTitle="Sổ quỹ"
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      pagination={
        <ListPagePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={handlePageChange}
          onPageSizeChange={size => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col bg-slate-50">
        <div className="shrink-0 space-y-4 px-5 pt-6">
          {/* ── Quick entry form ──────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              {([
                { id: 'chi', label: 'Phiếu chi', color: 'text-red-600 border-red-500' },
                { id: 'thu', label: 'Phiếu thu', color: 'text-blue-600 border-blue-500' },
              ] as { id: FormTab; label: string; color: string }[]).map(t => (
                <button key={t.id} onClick={() => setFormTab(t.id)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${formTab === t.id ? t.color : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Chi form */}
            {formTab === 'chi' && (
              <form onSubmit={handleAddChi} className="p-4">
                <div className="flex items-end gap-3">
                  <div className="shrink-0">
                    <label className="block text-xs text-slate-500 mb-1">Ngày chi</label>
                    <SingleDatePicker
                      value={chiForm.date}
                      onChange={date => setChiForm(f => ({ ...f, date }))}
                      tone="red"
                    />
                  </div>
                  <div className="w-44 shrink-0">
                    <label className="block text-xs text-slate-500 mb-1">Danh mục</label>
                    <select value={chiForm.category}
                      onChange={e => setChiForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400 appearance-none bg-white">
                      <option value="">Chọn danh mục</option>
                      {parentCategories.map(p => (
                        <optgroup key={p.id} label={p.name}>
                          {categories.filter(c => c.parentId === p.id).map(c2 => (
                            <React.Fragment key={c2.id}>
                              <option value={c2.name}>{c2.name}</option>
                              {categories.filter(c => c.parentId === c2.id).map(c3 => (
                                <option key={c3.id} value={c3.name}>&nbsp;&nbsp;• {c3.name}</option>
                              ))}
                            </React.Fragment>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="w-36 shrink-0">
                    <label className="block text-xs text-slate-500 mb-1">Số tiền (đ)</label>
                    <input type="number" required min={1} placeholder="0" value={chiForm.amount}
                      onChange={e => setChiForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">Mô tả</label>
                    <div className="relative">
                      <input type="text" required placeholder="Nội dung chi..." value={chiForm.description}
                        onChange={e => setChiForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-1 focus:ring-red-400" />
                      <button type="button" onClick={handleAiClassify}
                        disabled={isAiLoading || chiForm.description.length < 5}
                        title="AI gợi ý danh mục"
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${chiForm.description.length >= 5 ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-300 cursor-not-allowed'}`}>
                        {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors font-medium disabled:opacity-60">
                    {submitted ? <CheckCircle2 className="w-4 h-4" /> : '+ Thêm'}
                  </button>
                </div>
              </form>
            )}

            {/* Thu form */}
            {formTab === 'thu' && (
              <form onSubmit={handleAddThu} className="p-4">
                <div className="flex items-end gap-3">
                  <div className="shrink-0">
                    <label className="block text-xs text-slate-500 mb-1">Ngày thu</label>
                    <SingleDatePicker
                      value={thuForm.date}
                      onChange={date => setThuForm(f => ({ ...f, date }))}
                    />
                  </div>
                  <div className="w-36 shrink-0">
                    <label className="block text-xs text-slate-500 mb-1">Số tiền (đ)</label>
                    <input type="number" required min={1} placeholder="0" value={thuForm.amount}
                      onChange={e => setThuForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">Người nộp</label>
                    <input type="text" placeholder="Khách lẻ" value={thuForm.person}
                      onChange={e => setThuForm(f => ({ ...f, person: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="w-40 shrink-0">
                    <label className="block text-xs text-slate-500 mb-1">Hình thức</label>
                    <select value={thuForm.paymentMethod}
                      onChange={e => setThuForm(f => ({ ...f, paymentMethod: e.target.value as POSOrder['paymentMethod'] }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                      <option value="Cash">Tiền mặt</option>
                      <option value="Bank">Chuyển khoản</option>
                      <option value="Momo">Ví điện tử</option>
                      <option value="Other">Khác</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors font-medium disabled:opacity-60">
                    {submitted ? <CheckCircle2 className="w-4 h-4" /> : '+ Thêm'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-0 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {[
              { label: 'Quỹ đầu kỳ', value: openingBalance, color: 'text-slate-800' },
              { label: 'Tổng thu', value: totalThu, color: 'text-blue-600' },
              { label: 'Tổng chi', value: -totalChi, color: 'text-red-500' },
              { label: 'Trả hàng khách', value: -totalCustomerRefund, color: 'text-orange-500' },
              { label: 'Chi tiêu cửa hàng', value: -totalStoreExpense, color: 'text-rose-600' },
              { label: 'Tồn quỹ', value: closingBalance, color: 'text-emerald-600' },
            ].map((stat, i) => (
              <div key={stat.label} className={`px-5 py-3 ${i < 5 ? 'border-r border-slate-200' : ''}`}>
                <p className="text-xs text-slate-400 mb-0.5">{stat.label}</p>
                <p className={`text-base font-bold tabular-nums ${stat.color}`}>
                  {stat.value < 0 ? '-' : ''}{fmtFull(Math.abs(stat.value))}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="mt-10 flex-1 overflow-y-auto px-5 pb-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="w-8 py-2.5 pr-2"><input type="checkbox" className="accent-blue-500" /></th>
                <th className="w-6 py-2.5 pr-3" />
                <th className="py-2.5 pr-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Mã phiếu</th>
                <th className="py-2.5 pr-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Thời gian</th>
                <th className="py-2.5 pr-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Loại thu chi</th>
                <th className="py-2.5 pr-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Người nộp/nhận</th>
                <th className="py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Giá trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                    Không có phiếu thu chi nào trong kỳ này
                  </td>
                </tr>
              ) : (
                paginated.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-2.5 pr-2"><input type="checkbox" className="accent-blue-500" /></td>
                    <td className="py-2.5 pr-3">
                      <span className="text-slate-300 group-hover:text-amber-400 cursor-pointer transition-colors text-base">☆</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-blue-600 font-medium hover:underline cursor-pointer text-sm">{entry.code}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600 text-sm whitespace-nowrap">{fmtDateTime(entry.date)}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === 'thu' ? 'bg-blue-400' : 'bg-red-400'}`} />
                          {entry.description}
                        </span>
                        {entry.type === 'chi' && (
                          <span
                            className={`w-fit rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                              entry.cashOutType === 'customer_refund'
                                ? 'bg-orange-50 text-orange-600 border border-orange-100'
                                : 'bg-rose-50 text-rose-600 border border-rose-100'
                            }`}
                          >
                            {entry.cashOutType === 'customer_refund'
                              ? 'Trả hàng khách'
                              : 'Chi tiêu cửa hàng'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600 text-sm">{entry.person}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-semibold tabular-nums text-sm ${entry.type === 'thu' ? 'text-blue-600' : 'text-red-500'}`}>
                        {entry.type === 'chi' ? '-' : ''}{fmtFull(entry.amount)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </ListPageLayout>
  );
};

export default CashLedgerPage;
