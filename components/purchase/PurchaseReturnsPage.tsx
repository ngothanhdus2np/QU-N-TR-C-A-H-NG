import React, { useMemo, useState } from 'react';
import { Eye, FileDown, FileText, Plus, Star, Trash2 } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  FilterCheckboxGroup,
  FilterDateRange,
  FilterSection,
  ListPageLayout,
  ListPagePagination,
  ListPageTable,
  ListPageToolbar,
  PAGE_SIZE_OPTIONS,
  PURCHASE_STATUS_CONFIG,
  StatusBadge,
  TableColumn,
} from '../shared';
import { InventoryTransaction, Supplier } from '../../types';
import { useToast } from '../ui/Toast';

interface PurchaseReturnsPageProps {
  transactions: InventoryTransaction[];
  suppliers: Supplier[];
  onCreateReturn: () => void;
  onViewDetail: (transaction: InventoryTransaction) => void;
  onDeleteReturn: (id: string) => void | Promise<void>;
  onExportReturns: (transactions: InventoryTransaction[]) => void;
}

type SortKey = 'date' | 'code' | 'supplier' | 'goodsTotal' | 'discount' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

const getLineTotal = (item: InventoryTransaction['items'][number]) => {
  const withPrice = item as typeof item & { price?: number; discount?: number };
  return item.quantity * (withPrice.price || 0) - (withPrice.discount || 0);
};

const getGoodsTotal = (transaction: InventoryTransaction) =>
  transaction.items.reduce((sum, item) => {
    const withPrice = item as typeof item & { price?: number };
    return sum + item.quantity * (withPrice.price || 0);
  }, 0);

const getLineDiscountTotal = (transaction: InventoryTransaction) =>
  transaction.items.reduce((sum, item) => {
    const withPrice = item as typeof item & { discount?: number };
    return sum + (withPrice.discount || 0);
  }, 0);

const getTransactionAmount = (transaction: InventoryTransaction) =>
  transaction.totalAmount ?? transaction.items.reduce((sum, item) => sum + getLineTotal(item), 0);

const PurchaseReturnsPage: React.FC<PurchaseReturnsPageProps> = ({
  transactions,
  suppliers,
  onCreateReturn,
  onViewDetail,
  onDeleteReturn,
  onExportReturns,
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [starredReturns, setStarredReturns] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);

  const purchaseReturns = useMemo(
    () => transactions.filter(transaction => transaction.type === 'PurchaseReturn'),
    [transactions]
  );

  const filteredReturns = useMemo(() => {
    let result = [...purchaseReturns];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        transaction =>
          transaction.id.toLowerCase().includes(term) ||
          transaction.referenceId?.toLowerCase().includes(term) ||
          transaction.supplierName?.toLowerCase().includes(term) ||
          transaction.note?.toLowerCase().includes(term)
      );
    }

    if (dateRange.start) result = result.filter(transaction => transaction.date.slice(0, 10) >= dateRange.start);
    if (dateRange.end) result = result.filter(transaction => transaction.date.slice(0, 10) <= dateRange.end);
    if (statusFilter.length > 0) {
      result = result.filter(transaction => statusFilter.includes(transaction.status || 'completed'));
    }
    if (supplierFilter.length > 0) {
      result = result.filter(transaction =>
        supplierFilter.some(supplierId => {
          const supplier = suppliers.find(item => item.id === supplierId);
          return transaction.supplierId === supplierId || transaction.supplierName === supplier?.name;
        })
      );
    }
    if (creatorFilter.length > 0) {
      result = result.filter(transaction => creatorFilter.includes(transaction.staffId));
    }

    return result;
  }, [creatorFilter, dateRange, purchaseReturns, searchTerm, statusFilter, supplierFilter, suppliers]);

  const sortedReturns = useMemo(() => {
    const sorted = [...filteredReturns];
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
        case 'supplier':
          aVal = a.supplierName || '';
          bVal = b.supplierName || '';
          break;
        case 'goodsTotal':
          aVal = getGoodsTotal(a);
          bVal = getGoodsTotal(b);
          break;
        case 'discount':
          aVal = getLineDiscountTotal(a);
          bVal = getLineDiscountTotal(b);
          break;
        case 'amount':
          aVal = getTransactionAmount(a);
          bVal = getTransactionAmount(b);
          break;
        case 'status':
          aVal = a.status || 'completed';
          bVal = b.status || 'completed';
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredReturns, sortDirection, sortKey]);

  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedReturns.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedReturns]);

  const uniqueCreators = useMemo(
    () => Array.from(new Set(purchaseReturns.map(transaction => transaction.staffId))),
    [purchaseReturns]
  );

  const totalPages = Math.ceil(sortedReturns.length / pageSize);
  const hasActiveFilters =
    dateRange.start !== '' ||
    dateRange.end !== '' ||
    statusFilter.length > 0 ||
    supplierFilter.length > 0 ||
    creatorFilter.length > 0;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key as SortKey);
      setSortDirection('desc');
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedReturns(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const handleToggleSelectAll = () => {
    setSelectedReturns(prev =>
      prev.length === paginatedReturns.length ? [] : paginatedReturns.map(item => item.id)
    );
  };

  const handleToggleStar = (id: string) => {
    setStarredReturns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearFilters = () => {
    setDateRange({ start: '', end: '' });
    setStatusFilter([]);
    setSupplierFilter([]);
    setCreatorFilter([]);
    setCurrentPage(1);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Xóa ${selectedReturns.length} phiếu trả hàng nhập đã chọn?`)) {
      const failed: string[] = [];
      for (const id of selectedReturns) {
        try {
          await onDeleteReturn(id);
        } catch (err) {
          console.error('[PurchaseReturnsPage] Bulk delete item failed', id, err);
          failed.push(id);
        }
      }
      if (failed.length > 0) {
        showToast(`Xóa thất bại ${failed.length}/${selectedReturns.length} phiếu. Các phiếu còn lại đã xóa.`, 'error');
        setSelectedReturns(failed);
      } else {
        setSelectedReturns([]);
        showToast(`Đã xóa ${selectedReturns.length} phiếu trả hàng nhập`, 'success');
      }
    }
  };

  const handleExportSelected = () => {
    onExportReturns(sortedReturns.filter(transaction => selectedReturns.includes(transaction.id)));
  };

  const sidebar = (
    <>
      <FilterSection title="Trạng thái">
        <FilterCheckboxGroup
          label="Trạng thái"
          options={[
            {
              value: 'draft',
              label: 'Phiếu tạm',
              count: purchaseReturns.filter(transaction => transaction.status === 'draft').length,
            },
            {
              value: 'completed',
              label: 'Đã trả hàng',
              count: purchaseReturns.filter(transaction => (transaction.status || 'completed') === 'completed').length,
            },
            {
              value: 'cancelled',
              label: 'Đã hủy',
              count: purchaseReturns.filter(transaction => transaction.status === 'cancelled').length,
            },
          ]}
          selected={statusFilter}
          onChange={v => { setStatusFilter(v); setCurrentPage(1); }}
          searchable={false}
        />
      </FilterSection>

      <FilterSection title="Thời gian">
        <FilterDateRange
          startDate={dateRange.start}
          endDate={dateRange.end}
          onStartDateChange={date => { setDateRange(prev => ({ ...prev, start: date })); setCurrentPage(1); }}
          onEndDateChange={date => { setDateRange(prev => ({ ...prev, end: date })); setCurrentPage(1); }}
        />
      </FilterSection>

      <FilterSection title="Nhà cung cấp">
        <FilterCheckboxGroup
          label="Nhà cung cấp"
          options={suppliers.map(supplier => ({
            value: supplier.id,
            label: supplier.name,
            count: purchaseReturns.filter(
              transaction => transaction.supplierId === supplier.id || transaction.supplierName === supplier.name
            ).length,
          }))}
          selected={supplierFilter}
          onChange={v => { setSupplierFilter(v); setCurrentPage(1); }}
        />
      </FilterSection>

      <FilterSection title="Người tạo">
        <FilterCheckboxGroup
          label="Người tạo"
          options={uniqueCreators.map(creator => ({
            value: creator,
            label: creator,
            count: purchaseReturns.filter(transaction => transaction.staffId === creator).length,
          }))}
          selected={creatorFilter}
          onChange={v => { setCreatorFilter(v); setCurrentPage(1); }}
          searchable={false}
        />
      </FilterSection>
    </>
  );

  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={term => { setSearchTerm(term); setCurrentPage(1); }}
      searchPlaceholder="Tìm mã phiếu trả hoặc nhà cung cấp..."
      rightActions={
        <>
          <button
            onClick={onCreateReturn}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-normal hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Trả hàng nhập
          </button>
          <button
            onClick={() => onExportReturns(sortedReturns)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Xuất file
          </button>
        </>
      }
      selectedCount={selectedReturns.length}
      onClearSelection={() => setSelectedReturns([])}
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

  const columns: TableColumn<InventoryTransaction>[] = [
    {
      key: 'checkbox',
      label: '',
      width: 'w-10',
      align: 'center',
      headerRender: () => (
        <input
          type="checkbox"
          checked={selectedReturns.length === paginatedReturns.length && paginatedReturns.length > 0}
          onChange={handleToggleSelectAll}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      ),
      render: transaction => (
        <input
          type="checkbox"
          checked={selectedReturns.includes(transaction.id)}
          onChange={() => handleToggleSelection(transaction.id)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      ),
    },
    {
      key: 'star',
      label: '',
      width: 'w-10',
      align: 'center',
      render: transaction => (
        <button
          onClick={event => {
            event.stopPropagation();
            handleToggleStar(transaction.id);
          }}
          className="p-1 rounded hover:bg-slate-100 transition-colors"
        >
          <Star className={`h-4 w-4 ${starredReturns.has(transaction.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
        </button>
      ),
    },
    {
      key: 'code',
      label: 'Mã trả hàng nhập',
      width: 'w-40',
      sortable: true,
      render: transaction => (
        <span className="text-xs font-normal text-indigo-600">{transaction.referenceId || transaction.id.slice(0, 12)}</span>
      ),
    },
    {
      key: 'date',
      label: 'Thời gian',
      width: 'w-36',
      sortable: true,
      render: transaction => (
        <span className="text-xs text-slate-600">
          {new Date(transaction.date).toLocaleString('vi-VN', {
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
      key: 'supplier',
      label: 'Nhà cung cấp',
      sortable: true,
      render: transaction => (
        <span className="text-sm font-normal text-slate-800">{transaction.supplierName || 'NCC vãng lai'}</span>
      ),
    },
    {
      key: 'goodsTotal',
      label: 'Tổng tiền hàng',
      width: 'w-32',
      align: 'right',
      sortable: true,
      render: transaction => <span className="text-sm text-slate-700">{getGoodsTotal(transaction).toLocaleString()}đ</span>,
    },
    {
      key: 'discount',
      label: 'Giảm giá',
      width: 'w-28',
      align: 'right',
      sortable: true,
      render: transaction => <span className="text-sm text-slate-500">{getLineDiscountTotal(transaction).toLocaleString()}đ</span>,
    },
    {
      key: 'amount',
      label: 'NCC cần trả',
      width: 'w-32',
      align: 'right',
      sortable: true,
      render: transaction => (
        <span className="text-sm font-normal text-indigo-600">{getTransactionAmount(transaction).toLocaleString()}đ</span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 'w-32',
      align: 'center',
      sortable: true,
      render: transaction => (
        <StatusBadge
          status={transaction.status}
          configMap={{
            ...PURCHASE_STATUS_CONFIG,
            completed: { label: 'Đã trả hàng', bg: 'bg-emerald-100', text: 'text-emerald-700' },
          }}
          defaultStatus="completed"
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 'w-12',
      align: 'center',
      render: transaction => (
        <button
          onClick={event => {
            event.stopPropagation();
            onViewDetail(transaction);
          }}
          className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Xem chi tiết"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="h-full">
      <ListPageLayout
        sidebarTitle="Trả hàng nhập"
        sidebarDescription="Quản lý phiếu trả hàng cho NCC"
        sidebar={sidebar}
        toolbar={toolbar}
        pagination={
          <ListPagePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedReturns.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        }
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      >
        <ListPageTable
          columns={columns}
          data={paginatedReturns}
          keyExtractor={transaction => transaction.id}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={transaction => onViewDetail(transaction)}
          emptyState={
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-normal text-slate-800">Chưa có phiếu trả hàng nhập</p>
                <p className="text-xs text-slate-400 mt-1">Bấm nút "Trả hàng nhập" để tạo phiếu mới</p>
              </div>
            </div>
          }
        />
      </ListPageLayout>
    </div>
  );
};

export default PurchaseReturnsPage;
