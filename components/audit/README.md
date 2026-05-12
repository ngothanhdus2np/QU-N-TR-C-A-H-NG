# Audit Module — Quản lý Kiểm kho

Module quản lý phiếu kiểm kho (inventory audit/stock check) cho CFO Brain 4.0.

## Cấu trúc

```
components/audit/
├── AuditContainer.tsx      # Container toggle giữa list ↔ form
├── AuditListPage.tsx       # Trang danh sách phiếu kiểm kho
└── README.md               # Documentation này
```

## Workflow

1. **Menu "Kiểm kho"** → `AuditContainer` → `AuditListPage`
   - Hiển thị danh sách phiếu kiểm kho từ `inventoryTransactions.filter(t => t.type === 'Check')`
   - Search, filter (trạng thái, thời gian, người tạo), sort, pagination
   - Bulk actions: export Excel, xóa phiếu

2. **Nút "+ Kiểm kho"** → `setShowAuditForm(true)`
   - `AuditContainer` render `GoodsAuditForm` (từ `components/pos/GoodsAuditForm.tsx`)
   - User nhập SL thực tế cho từng sản phẩm, ghi chú

3. **Xác nhận kiểm kê** → `handleConfirmAudit()`
   - Tạo `InventoryTransaction` type `'Check'` với status `'balanced'`
   - Tính toán thống kê:
     - `totalActualQty`: tổng SL thực tế
     - `totalDiff`: tổng chênh lệch (sum of all differences)
     - `increaseCount`: số mặt hàng lệch tăng
     - `decreaseCount`: số mặt hàng lệch giảm
   - Cập nhật stock sản phẩm theo SL thực tế
   - Quay về list, hiển thị phiếu mới tạo

4. **Xem chi tiết phiếu** → `onViewDetail()`
   - Hiện tại: alert với thông tin tóm tắt
   - TODO: Modal chi tiết với danh sách sản phẩm, tồn HT, thực tế, chênh lệch

## Components

### `AuditContainer`

Container chính, quản lý state và toggle giữa list/form.

**Props:**
- `data: AppData` — toàn bộ dữ liệu app
- `onUpdateData` — update data callback
- `onUpdateSurgical` — surgical update callback (optional)
- `onPushBatch` — push batch callback (optional)

**State:**
- `showAuditForm: boolean` — hiển thị form hay list
- `auditItems: AuditItem[]` — danh sách sản phẩm đang kiểm
- `auditSearchTerm: string` — search term trong form

**Handlers:**
- `handleConfirmAudit()` — xác nhận kiểm kho, tạo transaction, cập nhật stock
- `handleCancelAudit()` — hủy form, confirm nếu đã nhập dữ liệu
- `handleViewDetail()` — xem chi tiết phiếu (TODO: modal)
- `handleDeleteAudit()` — xóa phiếu kiểm kho

### `AuditListPage`

Trang danh sách phiếu kiểm kho, dùng reusable layout components.

**Props:**
- `transactions: InventoryTransaction[]` — danh sách transactions
- `onCreateAudit: () => void` — callback khi bấm "+ Kiểm kho"
- `onViewDetail: (transaction) => void` — callback xem chi tiết
- `onDeleteAudit: (id) => void` — callback xóa phiếu

**Features:**
- Search theo mã phiếu, ghi chú
- Filter: trạng thái (phiếu tạm, đã cân bằng, đã hủy), thời gian, người tạo
- Sort: ngày, mã phiếu, tổng chênh lệch, trạng thái
- Pagination: 15/30/50/100 items per page
- Bulk actions: export Excel, xóa nhiều phiếu
- Star favorites

**Columns:**
- Checkbox — chọn nhiều phiếu
- Star — đánh dấu yêu thích
- Mã kiểm kho — font mono, indigo
- Thời gian — ngày giờ tạo phiếu
- Ngày cân bằng — ngày giờ xác nhận kiểm kho
- SL thực tế — tổng số lượng thực tế đếm được
- Tổng chênh lệch — tổng chênh lệch (màu xanh nếu +, đỏ nếu -)
- SL lệch tăng — số mặt hàng có stock tăng
- SL lệch giảm — số mặt hàng có stock giảm
- Trạng thái — badge (phiếu tạm, đã cân bằng, đã hủy)
- Actions — nút xem chi tiết

## Data Structure

### `InventoryTransaction` (type: 'Check')

```typescript
{
  id: 'AUD-1234567890',
  type: 'Check',
  date: '2026-05-12T10:30:00',
  staffId: 'admin',
  status: 'balanced', // 'draft' | 'balanced' | 'cancelled'
  balancedDate: '2026-05-12T14:00:00',
  totalActualQty: 18,
  totalDiff: -13,
  increaseCount: 0,
  decreaseCount: 13,
  note: 'Kiểm kho định kỳ tháng 5',
  items: [
    {
      productId: 'prod-1',
      sku: 'KKG01819',
      name: 'Giày ABC',
      quantity: -12, // chênh lệch (actual - current)
      previousStock: 100, // tồn hiện tại
      newStock: 88, // thực tế
    },
    // ...
  ]
}
```

### `AuditItem` (form state)

```typescript
{
  productId: string;
  currentStock: number;  // Tồn hiện tại
  actualStock: number;   // Thực tế đếm được
  note: string;          // Ghi chú
}
```

## Integration

### `MainContent.tsx`

Thêm case cho tab kiểm kho:

```typescript
case 'goods-audit':
  return (
    <AuditContainer
      data={data}
      onUpdateData={updateData}
      onUpdateSurgical={updateSurgical}
      onPushBatch={pushBatch}
    />
  );
```

### `constants/navigation.ts`

Thêm menu item:

```typescript
{
  id: 'goods-audit',
  label: 'Kiểm kho',
  icon: ClipboardCheck,
  section: 'goods',
}
```

## TODO

- [ ] Modal chi tiết phiếu kiểm kho (thay alert)
- [ ] Export Excel cho phiếu đã chọn
- [ ] In phiếu kiểm kho
- [ ] Lọc theo khoảng chênh lệch (> 10, > 50, etc.)
- [ ] Thống kê tổng quan: tổng phiếu, tổng chênh lệch, xu hướng
- [ ] Lịch sử kiểm kho của từng sản phẩm
- [ ] Draft mode: lưu phiếu tạm, tiếp tục sau
- [ ] Barcode scanner integration cho form kiểm kho

## Notes

- Form kiểm kho (`GoodsAuditForm`) được tái sử dụng từ module `pos/`
- Phiếu kiểm kho lưu trong `inventoryTransactions` với type `'Check'`
- Stock sản phẩm được cập nhật ngay khi xác nhận kiểm kho
- Chênh lệch được lưu trong field `quantity` của từng item (actual - current)
- `generateId()` từ `businessLogic.ts` để tạo ID phiếu
