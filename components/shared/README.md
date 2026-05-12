# Shared Components — Reusable List Page Layout

> **Mục đích:** Tạo design pattern đồng nhất cho các trang quản lý danh sách (Hàng hóa, Nhập hàng, Nhà cung cấp, Khách hàng, v.v.)

## 📦 Components

### 1. `ListPageLayout`
Layout chính với sidebar collapsible + main content area.

```tsx
<ListPageLayout
  sidebarTitle="Bộ lọc"
  sidebar={<YourFilterComponents />}
  toolbar={<ListPageToolbar {...toolbarProps} />}
  pagination={<ListPagePagination {...paginationProps} />}
  hasActiveFilters={true}
  onClearFilters={() => clearAllFilters()}
>
  <ListPageTable {...tableProps} />
</ListPageLayout>
```

**Props:**
- `sidebar`: React node chứa các filter components
- `toolbar`: Toolbar component (search, actions)
- `pagination`: Pagination component (optional)
- `sidebarTitle`: Tiêu đề sidebar (default: "Bộ lọc")
- `hasActiveFilters`: Có filter đang active không
- `onClearFilters`: Callback xóa tất cả filters

---

### 2. `ListPageToolbar`
Toolbar với search, bulk actions, filter summary.

```tsx
<ListPageToolbar
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  searchPlaceholder="Tìm kiếm sản phẩm..."
  leftActions={<button>+ Thêm mới</button>}
  rightActions={<>
    <button>Xuất Excel</button>
    <button>Cài đặt cột</button>
  </>}
  selectedCount={selectedItems.length}
  onClearSelection={() => setSelectedItems([])}
  bulkActions={<>
    <button>Xóa</button>
    <button>In tem</button>
  </>}
/>
```

**Props:**
- `searchTerm`, `onSearchChange`: Search state
- `searchPlaceholder`: Placeholder text
- `leftActions`, `rightActions`: Custom action buttons
- `selectedCount`: Số items đã chọn
- `onClearSelection`: Callback bỏ chọn
- `bulkActions`: Bulk action buttons (hiện khi có selection)
- `filterSummary`: Filter summary component (optional)

---

### 3. `ListPageTable`
Generic table với sorting, custom rendering.

```tsx
<ListPageTable
  columns={[
    { key: 'sku', label: 'Mã hàng', sortable: true, width: 'w-32' },
    { key: 'name', label: 'Tên hàng', sortable: true },
    { 
      key: 'price', 
      label: 'Giá bán', 
      align: 'right',
      sortable: true,
      render: (item) => `${item.price.toLocaleString()}đ`
    },
  ]}
  data={filteredProducts}
  keyExtractor={(item) => item.id}
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={handleSort}
  onRowClick={(item) => openDetail(item)}
  emptyState={<div>Không có sản phẩm nào</div>}
/>
```

**Props:**
- `columns`: Array of column definitions
- `data`: Array of items to display
- `keyExtractor`: Function to get unique key
- `sortKey`, `sortDirection`: Current sort state
- `onSort`: Sort callback
- `onRowClick`: Row click handler (optional)
- `emptyState`: Custom empty state (optional)
- `rowClassName`: Function to add custom row classes
- `stickyHeader`: Sticky header (default: true)

**Column Definition:**
```tsx
interface TableColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
}
```

---

### 4. `ListPagePagination`
Pagination với page size selector.

```tsx
<ListPagePagination
  currentPage={currentPage}
  totalPages={totalPages}
  pageSize={pageSize}
  totalItems={totalItems}
  onPageChange={setCurrentPage}
  onPageSizeChange={setPageSize}
  pageSizeOptions={[15, 30, 50, 100]}
/>
```

---

### 5. Filter Components

#### `FilterSection`
Wrapper cho filter sections trong sidebar.

```tsx
<FilterSection 
  title="Nhóm hàng"
  action={<button>Tạo mới</button>}
>
  <FilterCheckboxGroup {...} />
</FilterSection>
```

#### `FilterDateRange`
Date range filter với presets.

```tsx
<FilterDateRange
  startDate={startDate}
  endDate={endDate}
  onStartDateChange={setStartDate}
  onEndDateChange={setEndDate}
  presets={[
    { label: 'Hôm nay', value: () => ({ start: today, end: today }) },
    { label: '7 ngày qua', value: () => ({ start: last7Days, end: today }) },
  ]}
/>
```

#### `FilterCheckboxGroup`
Checkbox group với search.

```tsx
<FilterCheckboxGroup
  label="Nhóm hàng"
  options={categories.map(cat => ({
    value: cat.id,
    label: cat.name,
    count: cat.productCount
  }))}
  selected={selectedCategories}
  onChange={setSelectedCategories}
  searchable={true}
  placeholder="Tìm nhóm hàng..."
/>
```

---

## 🎨 Design System

Tất cả components tuân thủ design system hiện tại của CFO Brain:

- **Colors:** Indigo accent (`bg-indigo-600`, `text-indigo-600`)
- **Borders:** `border-slate-100`, `border-slate-200`
- **Radius:** `rounded-xl`, `rounded-2xl`
- **Shadows:** `shadow-sm`, `shadow-md`
- **Typography:** Font Inter, uppercase tracking-widest cho headers

---

## 📝 Example: Trang Nhập hàng

```tsx
import {
  ListPageLayout,
  ListPageToolbar,
  ListPageTable,
  ListPagePagination,
  FilterSection,
  FilterDateRange,
  FilterCheckboxGroup,
} from '../shared';

const PurchaseOrdersPage = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  
  // Filters
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);

  // Sidebar
  const sidebar = (
    <>
      <FilterSection title="Trạng thái">
        <FilterCheckboxGroup
          label="Trạng thái"
          options={[
            { value: 'draft', label: 'Phiếu tạm' },
            { value: 'completed', label: 'Đã nhập hàng' },
            { value: 'cancelled', label: 'Đã hủy' },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
      </FilterSection>

      <FilterSection title="Thời gian">
        <FilterDateRange
          startDate={dateRange.start}
          endDate={dateRange.end}
          onStartDateChange={(date) => setDateRange(prev => ({ ...prev, start: date }))}
          onEndDateChange={(date) => setDateRange(prev => ({ ...prev, end: date }))}
        />
      </FilterSection>

      <FilterSection title="Nhà cung cấp">
        <FilterCheckboxGroup
          label="Nhà cung cấp"
          options={suppliers.map(s => ({ value: s.id, label: s.name }))}
          selected={supplierFilter}
          onChange={setSupplierFilter}
        />
      </FilterSection>
    </>
  );

  // Toolbar
  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm mã phiếu nhập hoặc nhà cung cấp..."
      leftActions={
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl">
          + Nhập hàng
        </button>
      }
      rightActions={
        <>
          <button>Xuất file</button>
          <button>Cài đặt</button>
        </>
      }
      selectedCount={selectedOrders.length}
      onClearSelection={() => setSelectedOrders([])}
      bulkActions={
        <>
          <button>Xóa</button>
          <button>In phiếu</button>
        </>
      }
    />
  );

  // Table
  const columns = [
    { key: 'checkbox', label: '', width: 'w-12', headerRender: () => <input type="checkbox" /> },
    { key: 'code', label: 'Mã phiếu nhập', sortable: true },
    { key: 'date', label: 'Thời gian', sortable: true },
    { key: 'supplier', label: 'Nhà cung cấp' },
    { 
      key: 'amount', 
      label: 'Cần trả NCC', 
      align: 'right',
      sortable: true,
      render: (order) => `${order.amount.toLocaleString()}đ`
    },
    { 
      key: 'status', 
      label: 'Trạng thái',
      render: (order) => <StatusBadge status={order.status} />
    },
  ];

  // Pagination
  const pagination = (
    <ListPagePagination
      currentPage={currentPage}
      totalPages={Math.ceil(filteredOrders.length / pageSize)}
      pageSize={pageSize}
      totalItems={filteredOrders.length}
      onPageChange={setCurrentPage}
      onPageSizeChange={setPageSize}
    />
  );

  return (
    <ListPageLayout
      sidebarTitle="Phiếu nhập hàng"
      sidebar={sidebar}
      toolbar={toolbar}
      pagination={pagination}
      hasActiveFilters={statusFilter.length > 0 || supplierFilter.length > 0}
      onClearFilters={() => {
        setStatusFilter([]);
        setSupplierFilter([]);
        setDateRange({ start: '', end: '' });
      }}
    >
      <ListPageTable
        columns={columns}
        data={paginatedOrders}
        keyExtractor={(order) => order.id}
        onRowClick={(order) => openOrderDetail(order)}
      />
    </ListPageLayout>
  );
};
```

---

## ✅ Đã hoàn thành

- [x] Generic layout components
- [x] Toolbar với search + bulk actions
- [x] Table với sorting + custom rendering
- [x] Pagination với page size selector
- [x] Filter components (Section, DateRange, CheckboxGroup)
- [x] TypeScript types đầy đủ
- [x] Design system đồng bộ với app

## 🔜 Tiếp theo

- [ ] Áp dụng cho trang Nhập hàng
- [ ] Refactor trang Hàng hóa hiện tại (optional)
- [ ] Thêm filter components khác nếu cần: Radio group, Number range, Autocomplete
