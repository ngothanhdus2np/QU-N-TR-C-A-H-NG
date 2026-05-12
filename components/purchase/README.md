# Purchase Orders Management — Quản lý phiếu nhập hàng

## 📍 Truy cập

Menu: **Mua hàng** → **Quản lý phiếu nhập** (badge "Mới")

## ✨ Tính năng

### 1. Danh sách phiếu nhập
- **Table view** với các cột:
  - Checkbox (bulk selection)
  - Star (đánh dấu yêu thích)
  - Mã nhập hàng
  - Thời gian
  - Nhà cung cấp
  - Cần trả NCC
  - Trạng thái (Phiếu tạm / Đã nhập hàng / Đã hủy)
  - Actions (xem chi tiết)

### 2. Tìm kiếm & Lọc

**Sidebar filters:**
- **Trạng thái**: Phiếu tạm, Đã nhập hàng, Đã hủy
- **Thời gian**: Presets (Hôm nay, 7 ngày qua, Tháng này) + Custom date range
- **Nhà cung cấp**: Multi-select với search
- **Người tạo**: Multi-select

**Search bar:**
- Tìm theo mã phiếu nhập hoặc tên nhà cung cấp

### 3. Sắp xếp (Sorting)
Click vào header để sort:
- Mã nhập hàng
- Thời gian
- Nhà cung cấp
- Cần trả NCC
- Trạng thái

### 4. Pagination
- Chọn số items/trang: 15, 30, 50, 100
- Navigation: Previous, Next, Page numbers

### 5. Bulk Actions
Khi chọn nhiều phiếu:
- **Xuất Excel**: Export danh sách đã chọn
- **Xóa**: Xóa nhiều phiếu cùng lúc

### 6. Actions
- **+ Nhập hàng**: Tạo phiếu nhập mới (điều hướng đến form nhập hàng)
- **Xuất file**: Export toàn bộ danh sách
- **Xem chi tiết**: Click vào row hoặc nút eye icon

## 🎨 Design

Sử dụng **reusable layout components**:
- `ListPageLayout`: Layout chính với collapsible sidebar
- `ListPageToolbar`: Search + actions
- `ListPageTable`: Table với sorting
- `ListPagePagination`: Pagination controls
- `FilterSection`, `FilterDateRange`, `FilterCheckboxGroup`: Filter components

**Design system:**
- Colors: Indigo accent (`bg-indigo-600`)
- Borders: `border-slate-100`, `border-slate-200`
- Radius: `rounded-xl`, `rounded-2xl`
- Shadows: `shadow-sm`

## 📊 Data Model

### InventoryTransaction (extended)
```typescript
interface InventoryTransaction {
  id: string;
  date: string;
  type: 'Import' | 'Export' | 'Check' | 'Sale' | 'Return';
  items: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    price?: number;        // NEW: Import price
    discount?: number;     // NEW: Discount
  }[];
  note?: string;
  referenceId?: string;
  staffId: string;
  supplierId?: string;     // NEW: Supplier ID
  supplierName?: string;   // NEW: Supplier name
  totalAmount?: number;    // NEW: Total amount
  status?: 'draft' | 'completed' | 'cancelled'; // NEW: Status
}
```

## 🔄 Workflow

1. **Xem danh sách**: User vào menu "Quản lý phiếu nhập"
2. **Lọc/Tìm kiếm**: Dùng sidebar filters hoặc search bar
3. **Sắp xếp**: Click header để sort
4. **Chọn phiếu**: Checkbox để bulk actions
5. **Xem chi tiết**: Click row hoặc eye icon
6. **Tạo mới**: Nút "+ Nhập hàng" → điều hướng đến form nhập hàng

## 🚀 Tương lai

### TODO:
- [ ] Modal chi tiết phiếu nhập (xem items, supplier info, notes)
- [ ] Export Excel với template đẹp
- [ ] In phiếu nhập (PDF/print preview)
- [ ] Edit phiếu tạm
- [ ] Hủy phiếu với lý do
- [ ] Lịch sử thay đổi phiếu (audit log)
- [ ] Thống kê: Tổng giá trị nhập theo tháng, NCC top, v.v.

### Có thể mở rộng:
- Workflow approval (phiếu tạm → chờ duyệt → đã duyệt → đã nhập)
- Liên kết với công nợ NCC
- Tự động tạo phiếu nhập từ đơn đặt hàng
- Import phiếu nhập từ Excel
- Barcode scanning khi nhập hàng

## 📝 Files

```
components/purchase/
├── PurchaseOrdersPage.tsx      # Main page component
├── PurchaseOrdersDemo.tsx      # Wrapper kết nối app data
└── README.md                   # This file

components/shared/              # Reusable components
├── ListPageLayout.tsx
├── ListPageToolbar.tsx
├── ListPageTable.tsx
├── ListPagePagination.tsx
├── filters/
│   ├── FilterSection.tsx
│   ├── FilterDateRange.tsx
│   └── FilterCheckboxGroup.tsx
└── README.md
```

## 🎯 Kết luận

Trang **Quản lý phiếu nhập hàng** đã hoàn chỉnh với đầy đủ tính năng cơ bản:
- ✅ Search & Filter
- ✅ Sort & Pagination
- ✅ Bulk actions
- ✅ Responsive design
- ✅ Reusable components
- ✅ Type-safe

Sẵn sàng để test và mở rộng thêm tính năng!
