import React, { useState, useMemo, useRef } from 'react';
import { Plus, FileDown, Star, Trash2, FileText, Eye, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { appDataCache } from '../../services/appDataCache';
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
  PURCHASE_STATUS_CONFIG,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../shared';
import { InventoryTransaction, Supplier } from '../../types';
import { useToast } from '../ui/Toast';

interface PurchaseOrdersPageProps {
  transactions: InventoryTransaction[];
  suppliers: Supplier[];
  onCreatePurchase: () => void;
  onViewDetail: (transaction: InventoryTransaction) => void;
  onDeletePurchase: (id: string) => void | Promise<void>;
  onExportPurchases: (transactions: InventoryTransaction[]) => void;
}

type SortKey = 'date' | 'code' | 'supplier' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

const PurchaseOrdersPage: React.FC<PurchaseOrdersPageProps> = ({
  transactions,
  suppliers,
  onCreatePurchase,
  onViewDetail,
  onDeletePurchase,
  onExportPurchases,
}) => {
  const { showToast } = useToast();
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const handleImportKiotViet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportStatus('loading');
    setImportMessage(`Đang xử lý "${file.name}"...`);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK)
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      const fileBase64 = btoa(binary);
      const res = await fetch('/api/import/kiotviet-purchase-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || 'Import thất bại');
      await appDataCache.clearDataKeys(['suppliers', 'supplierDebts', 'inventoryTransactions']);
      const skipped = data.skippedByStatus
        ? Object.entries(data.skippedByStatus).map(([s, c]) => `${s}: ${c}`).join(', ')
        : '';
      setImportStatus('done');
      setImportMessage(
        `Đã import ${data.purchases} phiếu, ${data.items} dòng SP, ${data.suppliers} NCC.${skipped ? ` Bỏ qua ${skipped}.` : ''} Tải lại trang để xem dữ liệu mới.`
      );
    } catch (err) {
      setImportStatus('error');
      setImportMessage(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
  };

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Selection
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [starredOrders, setStarredOrders] = useState<Set<string>>(new Set());

  // Filters
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);

  // Get purchase orders (Import transactions)
  const purchaseOrders = useMemo(() => {
    return transactions.filter(t => t.type === 'Import');
  }, [transactions]);

  // Apply filters
  const filteredOrders = useMemo(() => {
    let result = [...purchaseOrders];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        order =>
          order.id.toLowerCase().includes(term) ||
          order.referenceId?.toLowerCase().includes(term) ||
          order.supplierName?.toLowerCase().includes(term) ||
          order.note?.toLowerCase().includes(term)
      );
    }

    // Date range — compare only the date part (order.date is ISO timestamp)
    if (dateRange.start) {
      result = result.filter(order => order.date.slice(0, 10) >= dateRange.start);
    }
    if (dateRange.end) {
      result = result.filter(order => order.date.slice(0, 10) <= dateRange.end);
    }

    // Status
    if (statusFilter.length > 0) {
      result = result.filter(order => statusFilter.includes(order.status || 'completed'));
    }

    // Supplier
    if (supplierFilter.length > 0) {
      result = result.filter(order =>
        supplierFilter.some(supplierId => {
          const supplier = suppliers.find(s => s.id === supplierId);
          return order.supplierId === supplierId || order.supplierName === supplier?.name;
        })
      );
    }

    // Creator
    if (creatorFilter.length > 0) {
      result = result.filter(order => creatorFilter.includes(order.staffId));
    }

    return result;
  }, [
    purchaseOrders,
    searchTerm,
    dateRange,
    statusFilter,
    supplierFilter,
    creatorFilter,
    suppliers,
  ]);

  // Sort
  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
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
        case 'amount':
          aVal = a.totalAmount || 0;
          bVal = b.totalAmount || 0;
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
  }, [filteredOrders, sortKey, sortDirection]);

  // Paginate
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedOrders.length / pageSize);

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
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(orderId => orderId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedOrders.length === paginatedOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(paginatedOrders.map(o => o.id));
    }
  };

  const handleToggleStar = (id: string) => {
    setStarredOrders(prev => {
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
    setSupplierFilter([]);
    setCreatorFilter([]);
    setCurrentPage(1);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Xóa ${selectedOrders.length} phiếu nhập đã chọn?`)) {
      const failed: string[] = [];
      for (const id of selectedOrders) {
        try {
          await onDeletePurchase(id);
        } catch (err) {
          console.error('[PurchaseOrdersPage] Bulk delete item failed', id, err);
          failed.push(id);
        }
      }
      if (failed.length > 0) {
        showToast(`Xóa thất bại ${failed.length}/${selectedOrders.length} phiếu. Các phiếu còn lại đã xóa.`, 'error');
        setSelectedOrders(failed);
      } else {
        setSelectedOrders([]);
        showToast(`Đã xóa ${selectedOrders.length} phiếu nhập`, 'success');
      }
    }
  };

  const handleExportSelected = () => {
    const selected = sortedOrders.filter(order => selectedOrders.includes(order.id));
    onExportPurchases(selected);
  };

  // Get unique values for filters
  const uniqueCreators = useMemo(() => {
    const creators = new Set(purchaseOrders.map(o => o.staffId));
    return Array.from(creators);
  }, [purchaseOrders]);

  const hasActiveFilters =
    dateRange.start !== '' ||
    dateRange.end !== '' ||
    statusFilter.length > 0 ||
    supplierFilter.length > 0 ||
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
              count: purchaseOrders.filter(o => o.status === 'draft').length,
            },
            {
              value: 'completed',
              label: 'Đã nhập hàng',
              count: purchaseOrders.filter(o => (o.status || 'completed') === 'completed').length,
            },
            {
              value: 'cancelled',
              label: 'Đã hủy',
              count: purchaseOrders.filter(o => o.status === 'cancelled').length,
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
          options={suppliers.map(s => ({
            value: s.id,
            label: s.name,
            count: purchaseOrders.filter(o => o.supplierId === s.id || o.supplierName === s.name)
              .length,
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
            count: purchaseOrders.filter(o => o.staffId === creator).length,
          }))}
          selected={creatorFilter}
          onChange={v => { setCreatorFilter(v); setCurrentPage(1); }}
          searchable={false}
        />
      </FilterSection>
    </>
  );

  // Toolbar
  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={term => { setSearchTerm(term); setCurrentPage(1); }}
      searchPlaceholder="Tìm mã phiếu nhập hoặc nhà cung cấp..."
      rightActions={
        <>
          <button
            onClick={onCreatePurchase}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-normal hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Phiếu nhập hàng
          </button>
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importStatus === 'loading'}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {importStatus === 'loading'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Upload className="h-4 w-4" />}
            Import KiotViet
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportKiotViet}
          />
          <button
            onClick={() => onExportPurchases(sortedOrders)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Xuất file
          </button>
        </>
      }
      selectedCount={selectedOrders.length}
      onClearSelection={() => setSelectedOrders([])}
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
          checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}
          onChange={handleToggleSelectAll}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
        />
      ),
      render: order => (
        <input
          type="checkbox"
          checked={selectedOrders.includes(order.id)}
          onChange={() => handleToggleSelection(order.id)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
        />
      ),
    },
    {
      key: 'star',
      label: '',
      width: 'w-10',
      align: 'center',
      render: order => (
        <button
          onClick={e => {
            e.stopPropagation();
            handleToggleStar(order.id);
          }}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <Star
            className={`h-4 w-4 ${starredOrders.has(order.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          />
        </button>
      ),
    },
    {
      key: 'code',
      label: 'Mã nhập hàng',
      width: 'w-32',
      sortable: true,
      render: order => (
        <span className="font-mono font-normal text-indigo-600 text-xs">
          {order.referenceId || order.id.slice(0, 12)}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Thời gian',
      width: 'w-36',
      sortable: true,
      render: order => (
        <span className="text-slate-600 text-xs">
          {new Date(order.date).toLocaleString('vi-VN', {
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
      render: order => (
        <span className="font-normal text-slate-800 text-sm">
          {order.supplierName || 'NCC vãng lai'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Cần trả NCC',
      width: 'w-32',
      align: 'right',
      sortable: true,
      render: order => {
        const total =
          order.totalAmount ??
          order.items.reduce((sum, item) => {
            const itemWithPrice = item as typeof item & { price?: number; discount?: number };
            const price = itemWithPrice.price || 0;
            const discount = itemWithPrice.discount || 0;
            return sum + item.quantity * price - discount;
          }, 0);
        return (
          <span className="font-normal text-emerald-600 text-sm">{total.toLocaleString()}đ</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 'w-32',
      align: 'center',
      sortable: true,
      render: order => (
        <StatusBadge
          status={order.status}
          configMap={PURCHASE_STATUS_CONFIG}
          defaultStatus="completed"
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 'w-12',
      align: 'center',
      render: order => (
        <button
          onClick={e => {
            e.stopPropagation();
            onViewDetail(order);
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
      totalItems={sortedOrders.length}
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
      {importStatus !== 'idle' && (
        <div className={`mx-4 mt-3 flex items-start gap-3 rounded-xl border p-3 text-sm ${
          importStatus === 'loading' ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
          : importStatus === 'done'  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : 'border-rose-100 bg-rose-50 text-rose-700'
        }`}>
          {importStatus === 'loading' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          : importStatus === 'done'   ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="flex-1 font-normal leading-relaxed">{importMessage}</p>
          {importStatus !== 'loading' && (
            <button
              type="button"
              onClick={() => setImportStatus('idle')}
              className="shrink-0 text-xs underline opacity-60 hover:opacity-100"
            >
              Đóng
            </button>
          )}
        </div>
      )}
      <ListPageLayout
        sidebarTitle="Nhập hàng"
        sidebar={sidebar}
        toolbar={toolbar}
        pagination={pagination}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      >
        <ListPageTable
          columns={columns}
          data={paginatedOrders}
          keyExtractor={order => order.id}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={order => onViewDetail(order)}
          emptyState={
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-normal text-slate-800">Chưa có phiếu nhập hàng</p>
                <p className="text-xs text-slate-400 mt-1">
                  Bấm nút "Nhập hàng" để tạo phiếu nhập mới
                </p>
              </div>
            </div>
          }
        />
      </ListPageLayout>
    </div>
  );
};

export default PurchaseOrdersPage;
