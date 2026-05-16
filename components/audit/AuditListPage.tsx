import React, { useState, useMemo } from 'react';
import { Plus, FileDown, Star, Trash2, FileText, Eye, Info, X } from 'lucide-react';
import {
  ListPageLayout,
  ListPageToolbar,
  ListPageTable,
  ListPagePagination,
  FilterSection,
  FilterDateRange,
  FilterCheckboxGroup,
  TableColumn,
  StatusBadge,
  AUDIT_STATUS_CONFIG,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';
import { InventoryTransaction } from '../../types';
import { useToast } from '../ui/Toast';

interface AuditListPageProps {
  transactions: InventoryTransaction[];
  onCreateAudit: () => void;
  onViewDetail: (transaction: InventoryTransaction) => void;
  onDeleteAudit: (id: string) => void | Promise<void>;
  onExportAudits: (transactions: InventoryTransaction[]) => void;
  config?: {
    transactionType?: InventoryTransaction['type'];
    sidebarTitle?: string;
    searchPlaceholder?: string;
    createButtonLabel?: string;
    bulkDeleteConfirmLabel?: string;
    codeColumnLabel?: string;
    actualQtyColumnLabel?: string;
    balancedDateColumnLabel?: string;
    diffColumnLabel?: string;
    increaseColumnLabel?: string;
    decreaseColumnLabel?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    showInfoButton?: boolean;
  };
}

type SortKey = 'date' | 'code' | 'totalDiff' | 'status';
type SortDirection = 'asc' | 'desc';

const AuditListPage: React.FC<AuditListPageProps> = ({
  transactions,
  onCreateAudit,
  onViewDetail,
  onDeleteAudit,
  onExportAudits,
  config,
}) => {
  const { showToast } = useToast();
  const listConfig = {
    transactionType: config?.transactionType || ('Check' as InventoryTransaction['type']),
    sidebarTitle: config?.sidebarTitle || 'Kiểm kho',
    searchPlaceholder: config?.searchPlaceholder || 'Tìm mã phiếu kiểm kho...',
    createButtonLabel: config?.createButtonLabel || 'Phiếu kiểm kho',
    bulkDeleteConfirmLabel: config?.bulkDeleteConfirmLabel || 'phiếu kiểm kho',
    codeColumnLabel: config?.codeColumnLabel || 'Mã kiểm kho',
    actualQtyColumnLabel: config?.actualQtyColumnLabel || 'SL thực tế',
    balancedDateColumnLabel: config?.balancedDateColumnLabel || 'Ngày cân bằng',
    diffColumnLabel: config?.diffColumnLabel || 'Tổng chênh lệch',
    increaseColumnLabel: config?.increaseColumnLabel || 'SL lệch tăng',
    decreaseColumnLabel: config?.decreaseColumnLabel || 'SL lệch giảm',
    emptyTitle: config?.emptyTitle || 'Chưa có phiếu kiểm kho',
    emptyDescription: config?.emptyDescription || 'Bấm nút "Phiếu kiểm kho" để tạo phiếu kiểm mới',
    showInfoButton: config?.showInfoButton ?? true,
  };

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Selection
  const [selectedAudits, setSelectedAudits] = useState<string[]>([]);
  const [starredAudits, setStarredAudits] = useState<Set<string>>(new Set());

  // Filters
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Get transactions for this inventory submodule.
  const auditTransactions = useMemo(() => {
    return transactions.filter(t => t.type === listConfig.transactionType);
  }, [transactions, listConfig.transactionType]);

  // Apply filters
  const filteredAudits = useMemo(() => {
    let result = [...auditTransactions];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        audit => audit.id.toLowerCase().includes(term) || audit.note?.toLowerCase().includes(term)
      );
    }

    // Date range
    if (dateRange.start) {
      result = result.filter(audit => audit.date >= dateRange.start);
    }
    if (dateRange.end) {
      result = result.filter(audit => audit.date <= dateRange.end);
    }

    // Status
    if (statusFilter.length > 0) {
      result = result.filter(audit => statusFilter.includes(audit.status || 'balanced'));
    }

    // Creator
    if (creatorFilter.length > 0) {
      result = result.filter(audit => creatorFilter.includes(audit.staffId));
    }

    return result;
  }, [auditTransactions, searchTerm, dateRange, statusFilter, creatorFilter]);

  // Sort
  const sortedAudits = useMemo(() => {
    const sorted = [...filteredAudits];
    sorted.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortKey) {
        case 'date':
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case 'code':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'totalDiff':
          aVal = Math.abs(a.totalDiff || 0);
          bVal = Math.abs(b.totalDiff || 0);
          break;
        case 'status':
          aVal = a.status || 'balanced';
          bVal = b.status || 'balanced';
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredAudits, sortKey, sortDirection]);

  // Paginate
  const paginatedAudits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAudits.slice(start, start + pageSize);
  }, [sortedAudits, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedAudits.length / pageSize);

  // Handlers
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key as SortKey);
      setSortDirection('desc');
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedAudits(prev =>
      prev.includes(id) ? prev.filter(auditId => auditId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedAudits.length === paginatedAudits.length) {
      setSelectedAudits([]);
    } else {
      setSelectedAudits(paginatedAudits.map(a => a.id));
    }
  };

  const handleToggleStar = (id: string) => {
    setStarredAudits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleClearFilters = () => {
    setDateRange({ start: '', end: '' });
    setStatusFilter([]);
    setCreatorFilter([]);
    setCurrentPage(1);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Xóa ${selectedAudits.length} ${listConfig.bulkDeleteConfirmLabel} đã chọn?`)) {
      try {
        await Promise.all(selectedAudits.map(id => onDeleteAudit(id)));
        setSelectedAudits([]);
      } catch (err) {
        console.error('[AuditListPage] Bulk delete failed', err);
        showToast('Xóa hàng loạt thất bại. Vui lòng thử lại.', 'error');
      }
    }
  };

  const handleExportSelected = () => {
    const selected = sortedAudits.filter(audit => selectedAudits.includes(audit.id));
    onExportAudits(selected);
  };

  // Get unique values for filters
  const uniqueCreators = useMemo(() => {
    const creators = new Set(auditTransactions.map(a => a.staffId));
    return Array.from(creators);
  }, [auditTransactions]);

  const hasActiveFilters =
    dateRange.start !== '' ||
    dateRange.end !== '' ||
    statusFilter.length > 0 ||
    creatorFilter.length > 0;

  // Sidebar
  const sidebar = (
    <>
      <FilterSection title="Trạng thái">
        <FilterCheckboxGroup
          label="Trạng thái"
          options={[
            {
              value: 'draft',
              label: 'Phiếu tạm',
              count: auditTransactions.filter(a => a.status === 'draft').length,
            },
            {
              value: 'balanced',
              label: 'Đã cân bằng',
              count: auditTransactions.filter(a => (a.status || 'balanced') === 'balanced').length,
            },
            {
              value: 'completed',
              label: 'Hoàn thành',
              count: auditTransactions.filter(a => a.status === 'completed').length,
            },
            {
              value: 'cancelled',
              label: 'Đã hủy',
              count: auditTransactions.filter(a => a.status === 'cancelled').length,
            },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          searchable={false}
        />
      </FilterSection>

      <FilterSection title="Thời gian">
        <FilterDateRange
          startDate={dateRange.start}
          endDate={dateRange.end}
          onStartDateChange={date => setDateRange(prev => ({ ...prev, start: date }))}
          onEndDateChange={date => setDateRange(prev => ({ ...prev, end: date }))}
        />
      </FilterSection>

      <FilterSection title="Người tạo">
        <FilterCheckboxGroup
          label="Người tạo"
          options={uniqueCreators.map(creator => ({
            value: creator,
            label: creator,
            count: auditTransactions.filter(a => a.staffId === creator).length,
          }))}
          selected={creatorFilter}
          onChange={setCreatorFilter}
          searchable={false}
        />
      </FilterSection>
    </>
  );

  // Toolbar
  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={listConfig.searchPlaceholder}
      rightActions={
        <>
          <button
            onClick={onCreateAudit}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-normal hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {listConfig.createButtonLabel}
          </button>
          <button
            onClick={() => onExportAudits(sortedAudits)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Xuất file
          </button>
          {listConfig.showInfoButton && (
            <button
              onClick={() => setShowInfoModal(true)}
              className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
              title="Thông tin chức năng kiểm kho"
              aria-label="Thông tin chức năng kiểm kho"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </>
      }
      selectedCount={selectedAudits.length}
      onClearSelection={() => setSelectedAudits([])}
      bulkActions={
        <>
          <button
            onClick={handleExportSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-xs font-normal hover:bg-indigo-50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Xuất Excel
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-normal hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa
          </button>
        </>
      }
    />
  );

  // Table columns
  const columns: TableColumn<InventoryTransaction>[] = [
    {
      key: 'checkbox',
      label: '',
      width: 'w-10',
      align: 'center',
      headerRender: () => (
        <input
          type="checkbox"
          checked={selectedAudits.length === paginatedAudits.length && paginatedAudits.length > 0}
          onChange={handleToggleSelectAll}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
        />
      ),
      render: audit => (
        <input
          type="checkbox"
          checked={selectedAudits.includes(audit.id)}
          onChange={() => handleToggleSelection(audit.id)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
        />
      ),
    },
    {
      key: 'star',
      label: '',
      width: 'w-10',
      align: 'center',
      render: audit => (
        <button
          onClick={e => {
            e.stopPropagation();
            handleToggleStar(audit.id);
          }}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <Star
            className={`h-4 w-4 ${starredAudits.has(audit.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          />
        </button>
      ),
    },
    {
      key: 'code',
      label: listConfig.codeColumnLabel,
      width: 'w-32',
      sortable: true,
      render: audit => (
        <span className="font-mono font-normal text-indigo-600 text-xs">{audit.id.slice(0, 12)}</span>
      ),
    },
    {
      key: 'date',
      label: 'Thời gian',
      width: 'w-36',
      sortable: true,
      render: audit => (
        <span className="text-slate-600 text-xs">
          {new Date(audit.date).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'balancedDate',
      label: listConfig.balancedDateColumnLabel,
      width: 'w-36',
      render: audit => (
        <span className="text-slate-600 text-xs">
          {audit.balancedDate
            ? new Date(audit.balancedDate).toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </span>
      ),
    },
    {
      key: 'totalActualQty',
      label: listConfig.actualQtyColumnLabel,
      width: 'w-24',
      align: 'right',
      render: audit => (
        <span className="font-normal text-slate-700 text-sm">{audit.totalActualQty || 0}</span>
      ),
    },
    {
      key: 'totalDiff',
      label: listConfig.diffColumnLabel,
      width: 'w-28',
      align: 'right',
      sortable: true,
      render: audit => {
        const diff = audit.totalDiff || 0;
        return (
          <span
            className={`font-normal text-sm ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {diff > 0 ? '+' : ''}
            {diff}
          </span>
        );
      },
    },
    {
      key: 'increaseCount',
      label: listConfig.increaseColumnLabel,
      width: 'w-24',
      align: 'right',
      render: audit => (
        <span className="text-emerald-600 font-normal text-sm">{audit.increaseCount || 0}</span>
      ),
    },
    {
      key: 'decreaseCount',
      label: listConfig.decreaseColumnLabel,
      width: 'w-24',
      align: 'right',
      render: audit => (
        <span className="text-rose-600 font-normal text-sm">{audit.decreaseCount || 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 'w-32',
      align: 'center',
      sortable: true,
      render: audit => (
        <StatusBadge
          status={audit.status}
          configMap={AUDIT_STATUS_CONFIG}
          defaultStatus="balanced"
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 'w-12',
      align: 'center',
      render: audit => (
        <button
          onClick={e => {
            e.stopPropagation();
            onViewDetail(audit);
          }}
          className="p-2 hover:bg-indigo-50 rounded-lg transition-colors text-indigo-600"
          title="Xem chi tiết"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  // Pagination
  const pagination = (
    <ListPagePagination
      currentPage={currentPage}
      totalPages={totalPages}
      pageSize={pageSize}
      totalItems={sortedAudits.length}
      onPageChange={setCurrentPage}
      onPageSizeChange={size => {
        setPageSize(size);
        setCurrentPage(1);
      }}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  );

  return (
    <>
      <ListPageLayout
        sidebarTitle={listConfig.sidebarTitle}
        sidebar={sidebar}
        toolbar={toolbar}
        pagination={pagination}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      >
        <ListPageTable
          columns={columns}
          data={paginatedAudits}
          keyExtractor={audit => audit.id}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={audit => onViewDetail(audit)}
          emptyState={
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-normal text-slate-800">{listConfig.emptyTitle}</p>
                <p className="text-xs text-slate-400 mt-1">{listConfig.emptyDescription}</p>
              </div>
            </div>
          }
        />
      </ListPageLayout>

      {showInfoModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-normal uppercase tracking-widest text-indigo-500">
                  Thông tin chức năng
                </p>
                <h3 className="text-lg font-black text-slate-900">Kiểm kho</h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors flex items-center justify-center"
                aria-label="Đóng thông tin kiểm kho"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5 text-sm text-slate-600">
              <div>
                <h4 className="font-black text-slate-900">Phiếu kiểm kho</h4>
                <p className="mt-1">
                  Dùng khi đếm số lượng thực tế. Quét hoặc tìm mã hàng, nhập cột Thực tế, hệ thống
                  tự tính số lượng lệch và cập nhật tồn kho khi hoàn thành.
                </p>
              </div>
              <div>
                <h4 className="font-black text-slate-900">Chọn hàng hóa</h4>
                <p className="mt-1">
                  Chọn nhóm hàng trước khi quét để ô tìm kiếm chỉ tìm trong nhóm đó, giúp thao tác
                  nhẹ và nhanh hơn với dữ liệu lớn.
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-amber-800 font-normal">
                Khi bấm Hoàn thành, tồn kho sẽ được cập nhật theo số Thực tế trong phiếu.
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                onClick={() => setShowInfoModal(false)}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-normal text-white hover:bg-indigo-700 transition-colors"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuditListPage;
