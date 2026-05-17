import React, { useState, useMemo } from 'react';
import { Download, ChevronRight, Calendar } from 'lucide-react';
import {
  ListPageLayout,
  ListPageToolbar,
  ListPagePagination,
  FilterSection,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';

type RepairStatus = 'processing' | 'completed' | 'cancelled';
type DateMode = 'all' | 'custom';

interface RepairTicket {
  id: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  deviceName?: string;
  issue?: string;
  technicianId?: string;
  status: RepairStatus;
  feeTotal: number;
  feePaid: number;
}

const STATUS_CONFIG: Record<RepairStatus, { label: string; cls: string }> = {
  processing: { label: 'Đang xử lý', cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Hoàn thành', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-500' },
};

function StatusBadge({ status }: { status: RepairStatus }) {
  const { label, cls } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

function SidebarCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0"
      />
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  );
}

function SidebarRadio({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0"
      />
      <span className="text-sm text-slate-600 flex-1">{label}</span>
      {icon && <span className="text-slate-400">{icon}</span>}
    </label>
  );
}

export default function OrderRepairs() {
  // Sidebar filters
  const [statusFilter, setStatusFilter] = useState<RepairStatus[]>(['processing', 'completed']);
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [updateMode, setUpdateMode] = useState<DateMode>('all');
  const [updateFrom, setUpdateFrom] = useState('');
  const [updateTo, setUpdateTo] = useState('');

  // Toolbar
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'transactions' | 'goods'>('transactions');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Placeholder — sẽ được thay bằng dữ liệu thực khi có backend
  const allRepairs: RepairTicket[] = [];

  const filteredRepairs = useMemo(() => {
    return allRepairs.filter(r => {
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      const q = searchTerm.toLowerCase();
      if (
        q &&
        !r.code.toLowerCase().includes(q) &&
        !(r.customerName || '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [allRepairs, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRepairs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredRepairs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasActiveFilters =
    statusFilter.length !== 2 || dateMode === 'custom' || updateMode === 'custom';

  const handleClearFilters = () => {
    setStatusFilter(['processing', 'completed']);
    setDateMode('all');
    setDateFrom('');
    setDateTo('');
    setUpdateMode('all');
    setUpdateFrom('');
    setUpdateTo('');
    setCurrentPage(1);
  };

  const toggleStatus = (s: RepairStatus) => {
    setStatusFilter(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
    setCurrentPage(1);
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebar = (
    <>
      {/* Trạng thái */}
      <FilterSection title="Trạng thái">
        <SidebarCheckbox
          label="Đang xử lý"
          checked={statusFilter.includes('processing')}
          onChange={() => toggleStatus('processing')}
        />
        <SidebarCheckbox
          label="Hoàn thành"
          checked={statusFilter.includes('completed')}
          onChange={() => toggleStatus('completed')}
        />
        <SidebarCheckbox
          label="Đã hủy"
          checked={statusFilter.includes('cancelled')}
          onChange={() => toggleStatus('cancelled')}
        />
      </FilterSection>

      {/* Thời gian */}
      <FilterSection title="Thời gian">
        <SidebarRadio
          label="Toàn thời gian"
          checked={dateMode === 'all'}
          onChange={() => {
            setDateMode('all');
            setCurrentPage(1);
          }}
          icon={<ChevronRight className="w-3.5 h-3.5" />}
        />
        <SidebarRadio
          label="Tùy chỉnh"
          checked={dateMode === 'custom'}
          onChange={() => {
            setDateMode('custom');
            setCurrentPage(1);
          }}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        {dateMode === 'custom' && (
          <div className="mt-2 space-y-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all"
            />
          </div>
        )}
      </FilterSection>

      {/* Ngày cập nhật */}
      <FilterSection title="Ngày cập nhật">
        <SidebarRadio
          label="Toàn thời gian"
          checked={updateMode === 'all'}
          onChange={() => {
            setUpdateMode('all');
            setCurrentPage(1);
          }}
          icon={<ChevronRight className="w-3.5 h-3.5" />}
        />
        <SidebarRadio
          label="Tùy chỉnh"
          checked={updateMode === 'custom'}
          onChange={() => {
            setUpdateMode('custom');
            setCurrentPage(1);
          }}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        {updateMode === 'custom' && (
          <div className="mt-2 space-y-2">
            <input
              type="date"
              value={updateFrom}
              onChange={e => {
                setUpdateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all"
            />
            <input
              type="date"
              value={updateTo}
              onChange={e => {
                setUpdateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-all"
            />
          </div>
        )}
      </FilterSection>
    </>
  );

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={v => {
        setSearchTerm(v);
        setCurrentPage(1);
      }}
      searchPlaceholder="Theo mã yêu cầu..."
      rightActions={
        <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors">
          <Download className="h-4 w-4" />
          Xuất file
        </button>
      }
    />
  );

  // ── Pagination ────────────────────────────────────────────────────────────
  const pagination =
    filteredRepairs.length > 0 ? (
      <ListPagePagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredRepairs.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={s => {
          setPageSize(s);
          setCurrentPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    ) : undefined;

  return (
    <ListPageLayout
      sidebar={sidebar}
      toolbar={toolbar}
      pagination={pagination}
      sidebarTitle="Bộ lọc"
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
    >
      {/* Sub-tabs: Giao dịch | Hàng hóa */}
      <div className="border-b border-slate-100 px-4 flex items-center gap-1 shrink-0 bg-white">
        {(
          [
            { key: 'transactions', label: 'Giao dịch' },
            { key: 'goods', label: 'Hàng hóa' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-normal border-b-2 transition-colors ${
              activeTab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Mã yêu cầu
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Thời gian
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide">
                Khách hàng
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide">
                Thiết bị / Mô tả
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Khách cần trả
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Khách đã trả
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Trạng thái
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center">
                  {/* Empty state giống KiotViet */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-indigo-300"
                        fill="none"
                        viewBox="0 0 48 48"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <rect x="8" y="8" width="32" height="32" rx="4" />
                        <path d="M16 24h16M16 32h10" strokeLinecap="round" />
                        <path d="M32 14l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-500">Không có kết quả phù hợp</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-xs text-indigo-600">{r.code}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 font-medium">
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-800">
                      {r.customerName || 'Khách lẻ'}
                    </p>
                    {r.customerPhone && (
                      <p className="text-[11px] text-slate-400">{r.customerPhone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-medium max-w-[200px] truncate">
                    {r.deviceName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                    {r.feeTotal.toLocaleString('vi-VN')}đ
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-green-700 whitespace-nowrap">
                    {r.feePaid.toLocaleString('vi-VN')}đ
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ListPageLayout>
  );
}
