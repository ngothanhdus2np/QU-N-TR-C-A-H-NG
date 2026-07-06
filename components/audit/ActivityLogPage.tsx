import React, { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import {
  ListPageLayout,
  ListPageToolbar,
  ListPageTable,
  ListPagePagination,
  FilterSection,
  FilterCheckboxGroup,
  FilterDateRange,
  TableColumn,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';
import { apiService } from '../../services/apiService';
import { useToast } from '../ui/Toast';

interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  pos_orders: 'Hóa đơn bán hàng',
  pos_products: 'Sản phẩm',
  inventory_transactions: 'Giao dịch tồn kho',
  suppliers: 'Nhà cung cấp',
  expense_records: 'Chi phí',
  revenue_records: 'Doanh thu',
  payroll_records: 'Lương',
  advance_records: 'Tạm ứng',
  shortage_records: 'Thiếu hụt',
  salary_policies: 'Chính sách lương',
};

const ACTION_LABELS: Record<string, string> = {
  insert: 'Tạo mới',
  upsert: 'Thêm/Cập nhật',
  upsertMany: 'Cập nhật hàng loạt',
  update: 'Cập nhật',
  delete: 'Xóa',
  clearTable: 'Xóa toàn bộ',
  applyWithStock: 'Ghi giao dịch tồn kho',
  deleteWithStock: 'Xóa giao dịch tồn kho',
};

const ACTION_COLORS: Record<string, string> = {
  insert: 'bg-emerald-50 text-emerald-700',
  upsert: 'bg-emerald-50 text-emerald-700',
  update: 'bg-amber-50 text-amber-700',
  upsertMany: 'bg-amber-50 text-amber-700',
  applyWithStock: 'bg-indigo-50 text-indigo-700',
  delete: 'bg-rose-50 text-rose-700',
  deleteWithStock: 'bg-rose-50 text-rose-700',
  clearTable: 'bg-rose-50 text-rose-700',
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const snapshotDetail = (snapshot: Record<string, unknown> | null): string => {
  if (!snapshot) return '—';
  const reason = snapshot.reason as string | undefined;
  const orderCode = snapshot.orderCode as string | undefined;
  if (reason && orderCode) return `${orderCode} — ${reason}`;
  return reason || orderCode || '—';
};

const ActivityLogPage: React.FC = () => {
  const { showToast } = useToast();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [tableFilter, setTableFilter] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiService.fetchAuditLogs();
      setRows(data as AuditLogRow[]);
    } catch (err) {
      console.error('[ActivityLogPage] load failed', err);
      showToast(err instanceof Error ? err.message : 'Không thể tải nhật ký hoạt động', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => {
        const actorName = String(r.snapshot?.actorName || '').toLowerCase();
        const detail = snapshotDetail(r.snapshot).toLowerCase();
        return actorName.includes(term) || detail.includes(term) || r.record_id.toLowerCase().includes(term);
      });
    }
    if (tableFilter.length > 0) {
      result = result.filter(r => tableFilter.includes(r.table_name));
    }
    if (actionFilter.length > 0) {
      result = result.filter(r => actionFilter.includes(r.action));
    }
    if (dateRange.start) {
      result = result.filter(r => r.created_at >= dateRange.start);
    }
    if (dateRange.end) {
      result = result.filter(r => r.created_at <= `${dateRange.end}T23:59:59`);
    }
    return result;
  }, [rows, searchTerm, tableFilter, actionFilter, dateRange]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const tableOptions = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach(r => counts.set(r.table_name, (counts.get(r.table_name) || 0) + 1));
    return Array.from(counts.entries()).map(([value, count]) => ({
      value,
      label: TABLE_LABELS[value] || value,
      count,
    }));
  }, [rows]);

  const actionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach(r => counts.set(r.action, (counts.get(r.action) || 0) + 1));
    return Array.from(counts.entries()).map(([value, count]) => ({
      value,
      label: ACTION_LABELS[value] || value,
      count,
    }));
  }, [rows]);

  const hasActiveFilters =
    tableFilter.length > 0 || actionFilter.length > 0 || dateRange.start !== '' || dateRange.end !== '';

  const handleClearFilters = () => {
    setTableFilter([]);
    setActionFilter([]);
    setDateRange({ start: '', end: '' });
    setCurrentPage(1);
  };

  const sidebar = (
    <>
      <FilterSection title="Đối tượng">
        <FilterCheckboxGroup
          label="Đối tượng"
          options={tableOptions}
          selected={tableFilter}
          onChange={value => { setTableFilter(value); setCurrentPage(1); }}
          searchable={false}
        />
      </FilterSection>

      <FilterSection title="Hành động">
        <FilterCheckboxGroup
          label="Hành động"
          options={actionOptions}
          selected={actionFilter}
          onChange={value => { setActionFilter(value); setCurrentPage(1); }}
          searchable={false}
        />
      </FilterSection>

      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="mb-2 text-sm font-normal text-slate-900">Thời gian</h3>
        <FilterDateRange
          startDate={dateRange.start}
          endDate={dateRange.end}
          onStartDateChange={date => { setDateRange(prev => ({ ...prev, start: date })); setCurrentPage(1); }}
          onEndDateChange={date => { setDateRange(prev => ({ ...prev, end: date })); setCurrentPage(1); }}
        />
      </div>
    </>
  );

  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={term => { setSearchTerm(term); setCurrentPage(1); }}
      searchPlaceholder="Tìm theo người thực hiện, mã đơn, ghi chú..."
      rightActions={
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </button>
      }
    />
  );

  const columns: TableColumn<AuditLogRow>[] = [
    {
      key: 'created_at',
      label: 'Thời gian',
      width: 'w-40',
      render: row => <span className="text-slate-600 text-sm">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'actor',
      label: 'Người thực hiện',
      width: 'w-40',
      render: row => (
        <span className="text-slate-800 text-sm font-normal">
          {String(row.snapshot?.actorName || 'Không rõ')}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Hành động',
      width: 'w-36',
      render: row => (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-normal ${ACTION_COLORS[row.action] || 'bg-slate-100 text-slate-600'}`}>
          {ACTION_LABELS[row.action] || row.action}
        </span>
      ),
    },
    {
      key: 'table_name',
      label: 'Đối tượng',
      width: 'w-36',
      render: row => <span className="text-slate-600 text-sm">{TABLE_LABELS[row.table_name] || row.table_name}</span>,
    },
    {
      key: 'detail',
      label: 'Chi tiết',
      render: row => <span className="text-slate-500 text-sm truncate">{snapshotDetail(row.snapshot)}</span>,
    },
  ];

  const pagination = (
    <ListPagePagination
      currentPage={currentPage}
      totalPages={totalPages}
      pageSize={pageSize}
      totalItems={filteredRows.length}
      onPageChange={setCurrentPage}
      onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  );

  return (
    <div className="h-full">
      <ListPageLayout
        sidebarTitle="Nhật ký hoạt động"
        sidebarDescription="Lịch sử thao tác của người dùng trong hệ thống (1000 gần nhất)"
        sidebar={sidebar}
        toolbar={toolbar}
        pagination={pagination}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      >
        <ListPageTable
          columns={columns}
          data={paginatedRows}
          keyExtractor={row => row.id}
          isLoading={isLoading}
          onRowClick={row => setExpandedId(prev => (prev === row.id ? null : row.id))}
          expandedRowId={expandedId ?? undefined}
          expandedRowContent={
            <pre className="whitespace-pre-wrap break-all bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
              {JSON.stringify(paginatedRows.find(r => r.id === expandedId)?.snapshot ?? {}, null, 2)}
            </pre>
          }
          emptyState={
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                <History className="w-10 h-10 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-normal text-slate-800">Chưa có hoạt động nào được ghi lại</p>
              </div>
            </div>
          }
        />
      </ListPageLayout>
    </div>
  );
};

export default ActivityLogPage;
