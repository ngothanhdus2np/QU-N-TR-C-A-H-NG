import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import {
  ListPageLayout,
  ListPageToolbar,
  ListPagePagination,
  FilterSection,
  FilterDateRange,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';

type RepairStatus = 'processing' | 'completed' | 'cancelled';

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
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
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

export default function OrderRepairs() {
  // Sidebar filters
  const [statusFilter, setStatusFilter] = useState<RepairStatus[]>(['processing', 'completed']);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [updateFrom, setUpdateFrom] = useState('');
  const [updateTo, setUpdateTo] = useState('');

  // Toolbar
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'transactions' | 'goods'>('transactions');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Placeholder — sẽ được thay bằng dữ liệu thực khi có backend
  const allRepairs: RepairTicket[] = [];

  const filteredRepairs = useMemo(() => {
    return allRepairs.filter(r => {
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      const created = r.createdAt.slice(0, 10);
      if (dateFrom && created < dateFrom) return false;
      if (dateTo && created > dateTo) return false;
      const updated = r.updatedAt.slice(0, 10);
      if (updateFrom && updated < updateFrom) return false;
      if (updateTo && updated > updateTo) return false;
      const q = searchTerm.toLowerCase();
      if (
        q &&
        !r.code.toLowerCase().includes(q) &&
        !(r.customerName || '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [allRepairs, dateFrom, dateTo, searchTerm, statusFilter, updateFrom, updateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRepairs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredRepairs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasActiveFilters =
    statusFilter.length !== 2 || !!dateFrom || !!dateTo || !!updateFrom || !!updateTo;

  const handleClearFilters = () => {
    setStatusFilter(['processing', 'completed']);
    setDateFrom('');
    setDateTo('');
    setUpdateFrom('');
    setUpdateTo('');
    setCurrentPage(1);
  };

  const toggleStatus = (s: RepairStatus) => {
    setStatusFilter(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
    setCurrentPage(1);
  };

  const allChecked = paginated.length > 0 && paginated.every(ticket => selectedIds.has(ticket.id));
  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allChecked) paginated.forEach(ticket => next.delete(ticket.id));
      else paginated.forEach(ticket => next.add(ticket.id));
      return next;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const rowsToExport =
      selectedIds.size > 0 ? filteredRepairs.filter(ticket => selectedIds.has(ticket.id)) : filteredRepairs;
    const rows = [
      ['Mã yêu cầu', 'Thời gian', 'Cập nhật', 'Khách hàng', 'SĐT', 'Thiết bị', 'Mô tả', 'Khách cần trả', 'Khách đã trả', 'Trạng thái'].join(','),
      ...rowsToExport.map(ticket =>
        [
          ticket.code,
          ticket.createdAt,
          ticket.updatedAt,
          ticket.customerName || 'Khách lẻ',
          ticket.customerPhone || '',
          ticket.deviceName || '',
          ticket.issue || '',
          ticket.feeTotal,
          ticket.feePaid,
          STATUS_CONFIG[ticket.status].label,
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = selectedIds.size > 0 ? 'sua-chua-da-chon.csv' : 'sua-chua.csv';
    a.click();
    URL.revokeObjectURL(a.href);
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
        <FilterDateRange
          startDate={dateFrom}
          endDate={dateTo}
          onStartDateChange={date => {
            setDateFrom(date);
            setCurrentPage(1);
          }}
          onEndDateChange={date => {
            setDateTo(date);
            setCurrentPage(1);
          }}
        />
      </FilterSection>

      {/* Ngày cập nhật */}
      <FilterSection title="Ngày cập nhật">
        <FilterDateRange
          startDate={updateFrom}
          endDate={updateTo}
          onStartDateChange={date => {
            setUpdateFrom(date);
            setCurrentPage(1);
          }}
          onEndDateChange={date => {
            setUpdateTo(date);
            setCurrentPage(1);
          }}
        />
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
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          {selectedIds.size > 0 ? `Xuất ${selectedIds.size} dòng` : 'Xuất file'}
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
                  checked={allChecked}
                  onChange={toggleAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Mã yêu cầu
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Thời gian
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Khách hàng
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Thiết bị / Mô tả
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Khách cần trả
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Khách đã trả
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
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
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelection(r.id)}
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
                      <p className="text-xs text-slate-400">{r.customerPhone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-medium max-w-[200px] truncate">
                    {r.deviceName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900 whitespace-nowrap">
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
