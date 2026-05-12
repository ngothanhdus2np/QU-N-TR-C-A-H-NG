import React, { useState, useMemo } from 'react';
import { Plus, FileDown, Star, Trash2, FileText, Eye, Upload } from 'lucide-react';
import {
  ListPageLayout,
  ListPageToolbar,
  ListPageTable,
  ListPagePagination,
  FilterSection,
  FilterCheckboxGroup,
  TableColumn,
  StatusBadge,
  SUPPLIER_STATUS_CONFIG,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';
import { Supplier } from '../../types';
import { useToast } from '../ui/Toast';

interface SupplierListPageProps {
  suppliers: Supplier[];
  onCreateSupplier: () => void;
  onViewDetail: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void | Promise<void>;
  onImportFile: () => void;
}

type SortKey = 'code' | 'name' | 'totalPurchase' | 'currentDebt';
type SortDirection = 'asc' | 'desc';

const SupplierListPage: React.FC<SupplierListPageProps> = ({
  suppliers,
  onCreateSupplier,
  onViewDetail,
  onDeleteSupplier,
  onImportFile,
}) => {
  const { showToast } = useToast();
  
  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Selection
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [starredSuppliers, setStarredSuppliers] = useState<Set<string>>(new Set());

  // Filters
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [debtRangeMin, setDebtRangeMin] = useState('');
  const [debtRangeMax, setDebtRangeMax] = useState('');
  const [purchaseRangeMin, setPurchaseRangeMin] = useState('');
  const [purchaseRangeMax, setPurchaseRangeMax] = useState('');

  // Get unique groups
  const uniqueGroups = useMemo(() => {
    const groups = new Set(suppliers.map(s => s.group).filter(Boolean));
    return Array.from(groups) as string[];
  }, [suppliers]);

  // Apply filters
  const filteredSuppliers = useMemo(() => {
    let result = [...suppliers];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        supplier =>
          supplier.name.toLowerCase().includes(term) ||
          supplier.code?.toLowerCase().includes(term) ||
          supplier.phone?.toLowerCase().includes(term) ||
          supplier.email?.toLowerCase().includes(term)
      );
    }

    // Group filter
    if (groupFilter.length > 0) {
      result = result.filter(supplier => supplier.group && groupFilter.includes(supplier.group));
    }

    // Status filter
    if (statusFilter.length > 0) {
      result = result.filter(supplier => statusFilter.includes(supplier.status || 'active'));
    }

    // Debt range
    if (debtRangeMin) {
      const min = parseFloat(debtRangeMin);
      result = result.filter(supplier => (supplier.currentDebt || 0) >= min);
    }
    if (debtRangeMax) {
      const max = parseFloat(debtRangeMax);
      result = result.filter(supplier => (supplier.currentDebt || 0) <= max);
    }

    // Purchase range
    if (purchaseRangeMin) {
      const min = parseFloat(purchaseRangeMin);
      result = result.filter(supplier => (supplier.totalPurchase || 0) >= min);
    }
    if (purchaseRangeMax) {
      const max = parseFloat(purchaseRangeMax);
      result = result.filter(supplier => (supplier.totalPurchase || 0) <= max);
    }

    return result;
  }, [suppliers, searchTerm, groupFilter, statusFilter, debtRangeMin, debtRangeMax, purchaseRangeMin, purchaseRangeMax]);

  // Sort
  const sortedSuppliers = useMemo(() => {
    const sorted = [...filteredSuppliers];
    sorted.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortKey) {
        case 'code':
          aVal = a.code || '';
          bVal = b.code || '';
          break;
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'totalPurchase':
          aVal = a.totalPurchase || 0;
          bVal = b.totalPurchase || 0;
          break;
        case 'currentDebt':
          aVal = a.currentDebt || 0;
          bVal = b.currentDebt || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredSuppliers, sortKey, sortDirection]);

  // Paginate
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedSuppliers.slice(start, start + pageSize);
  }, [sortedSuppliers, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedSuppliers.length / pageSize);

  // Handlers
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key as SortKey);
      setSortDirection('asc');
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(id) ? prev.filter(supplierId => supplierId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedSuppliers.length === paginatedSuppliers.length) {
      setSelectedSuppliers([]);
    } else {
      setSelectedSuppliers(paginatedSuppliers.map(s => s.id));
    }
  };

  const handleToggleStar = (id: string) => {
    setStarredSuppliers(prev => {
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
    setGroupFilter([]);
    setStatusFilter([]);
    setDebtRangeMin('');
    setDebtRangeMax('');
    setPurchaseRangeMin('');
    setPurchaseRangeMax('');
    setCurrentPage(1);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Xóa ${selectedSuppliers.length} nhà cung cấp đã chọn?`)) {
      try {
        await Promise.all(selectedSuppliers.map(id => onDeleteSupplier(id)));
        setSelectedSuppliers([]);
      } catch (err) {
        console.error('[SupplierListPage] Bulk delete failed', err);
        showToast('Xóa hàng loạt thất bại. Vui lòng thử lại.', 'error');
      }
    }
  };

  const handleExportSelected = () => {
    // TODO: Export to Excel
    showToast(`Xuất Excel: ${selectedSuppliers.length} nhà cung cấp`, 'info');
  };

  const hasActiveFilters =
    groupFilter.length > 0 ||
    statusFilter.length > 0 ||
    debtRangeMin !== '' ||
    debtRangeMax !== '' ||
    purchaseRangeMin !== '' ||
    purchaseRangeMax !== '';

  // Sidebar
  const sidebar = (
    <>
      <FilterSection title="Trạng thái">
        <FilterCheckboxGroup
          label="Trạng thái"
          options={[
            { value: 'active', label: 'Đang hoạt động', count: suppliers.filter(s => (s.status || 'active') === 'active').length },
            { value: 'inactive', label: 'Ngừng hoạt động', count: suppliers.filter(s => s.status === 'inactive').length },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          searchable={false}
        />
      </FilterSection>

      {uniqueGroups.length > 0 && (
        <FilterSection title="Nhóm nhà cung cấp">
          <FilterCheckboxGroup
            label="Nhóm"
            options={uniqueGroups.map(group => ({
              value: group,
              label: group,
              count: suppliers.filter(s => s.group === group).length,
            }))}
            selected={groupFilter}
            onChange={setGroupFilter}
            searchable={false}
          />
        </FilterSection>
      )}

      <FilterSection title="Nợ hiện tại">
        <div className="space-y-2">
          <input
            type="number"
            placeholder="Từ"
            value={debtRangeMin}
            onChange={e => setDebtRangeMin(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all"
          />
          <input
            type="number"
            placeholder="Đến"
            value={debtRangeMax}
            onChange={e => setDebtRangeMax(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all"
          />
        </div>
      </FilterSection>

      <FilterSection title="Tổng mua">
        <div className="space-y-2">
          <input
            type="number"
            placeholder="Từ"
            value={purchaseRangeMin}
            onChange={e => setPurchaseRangeMin(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all"
          />
          <input
            type="number"
            placeholder="Đến"
            value={purchaseRangeMax}
            onChange={e => setPurchaseRangeMax(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all"
          />
        </div>
      </FilterSection>
    </>
  );

  // Toolbar
  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm mã, tên, số điện thoại..."
      rightActions={
        <>
          <button
            onClick={onCreateSupplier}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nhà cung cấp
          </button>
          <button
            onClick={onImportFile}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import file
          </button>
          <button
            onClick={() => showToast('Chức năng xuất file đang được phát triển', 'info')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Xuất file
          </button>
        </>
      }
      selectedCount={selectedSuppliers.length}
      onClearSelection={() => setSelectedSuppliers([])}
      bulkActions={
        <>
          <button
            onClick={handleExportSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Xuất Excel
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa
          </button>
        </>
      }
    />
  );

  // Table columns
  const columns: TableColumn<Supplier>[] = [
    {
      key: 'checkbox',
      label: '',
      width: 'w-10',
      align: 'center',
      headerRender: () => (
        <input
          type="checkbox"
          checked={selectedSuppliers.length === paginatedSuppliers.length && paginatedSuppliers.length > 0}
          onChange={handleToggleSelectAll}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
        />
      ),
      render: supplier => (
        <input
          type="checkbox"
          checked={selectedSuppliers.includes(supplier.id)}
          onChange={() => handleToggleSelection(supplier.id)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
        />
      ),
    },
    {
      key: 'star',
      label: '',
      width: 'w-10',
      align: 'center',
      render: supplier => (
        <button
          onClick={e => {
            e.stopPropagation();
            handleToggleStar(supplier.id);
          }}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <Star
            className={`h-4 w-4 ${starredSuppliers.has(supplier.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          />
        </button>
      ),
    },
    {
      key: 'code',
      label: 'Mã nhà cung cấp',
      width: 'w-32',
      sortable: true,
      render: supplier => (
        <span className="font-mono font-bold text-indigo-600 text-xs">
          {supplier.code || supplier.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Tên nhà cung cấp',
      sortable: true,
      render: supplier => (
        <div>
          <div className="font-bold text-slate-800 text-sm">{supplier.name}</div>
          {supplier.group && (
            <div className="text-[10px] text-slate-400 mt-0.5">{supplier.group}</div>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Điện thoại',
      width: 'w-32',
      render: supplier => (
        <span className="text-slate-600 text-sm">{supplier.phone || '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      width: 'w-48',
      render: supplier => (
        <span className="text-slate-600 text-sm">{supplier.email || '—'}</span>
      ),
    },
    {
      key: 'currentDebt',
      label: 'Nợ cần trả hiện tại',
      width: 'w-36',
      align: 'right',
      sortable: true,
      render: supplier => {
        const debt = supplier.currentDebt || 0;
        return (
          <span className={`font-black text-sm ${debt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {debt > 0 ? debt.toLocaleString() + 'đ' : '—'}
          </span>
        );
      },
    },
    {
      key: 'totalPurchase',
      label: 'Tổng mua',
      width: 'w-32',
      align: 'right',
      sortable: true,
      render: supplier => {
        const total = supplier.totalPurchase || 0;
        return (
          <span className="font-bold text-slate-700 text-sm">
            {total > 0 ? total.toLocaleString() + 'đ' : '—'}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 'w-32',
      align: 'center',
      render: supplier => (
        <StatusBadge
          status={supplier.status}
          configMap={SUPPLIER_STATUS_CONFIG}
          defaultStatus="active"
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 'w-12',
      align: 'center',
      render: supplier => (
        <button
          onClick={e => {
            e.stopPropagation();
            onViewDetail(supplier);
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
      totalItems={sortedSuppliers.length}
      onPageChange={setCurrentPage}
      onPageSizeChange={size => {
        setPageSize(size);
        setCurrentPage(1);
      }}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  );

  return (
    <div className="h-full">
      <ListPageLayout
        sidebarTitle="Nhà cung cấp"
        sidebar={sidebar}
        toolbar={toolbar}
        pagination={pagination}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      >
        <ListPageTable
          columns={columns}
          data={paginatedSuppliers}
          keyExtractor={supplier => supplier.id}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={supplier => onViewDetail(supplier)}
          emptyState={
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">Chưa có nhà cung cấp</p>
                <p className="text-xs text-slate-400 mt-1">
                  Bấm nút "Nhà cung cấp" để thêm nhà cung cấp mới
                </p>
              </div>
            </div>
          }
        />
      </ListPageLayout>
    </div>
  );
};

export default SupplierListPage;
