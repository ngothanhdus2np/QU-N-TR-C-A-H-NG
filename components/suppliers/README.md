# Suppliers Module — Quản lý Nhà cung cấp

> **Module:** `components/suppliers/`  
> **Mục đích:** Quản lý danh sách nhà cung cấp, công nợ, lịch sử mua hàng với reusable layout components

---

## 📁 Cấu trúc file

```
components/suppliers/
├── SupplierContainer.tsx       (170 dòng) — Container chính, toggle list/form/detail, tính toán metrics
├── SupplierListPage.tsx        (560 dòng) — Danh sách NCC với search, filter, sort, pagination, bulk actions
├── SupplierForm.tsx            (240 dòng) — Modal form tạo/sửa NCC
├── SupplierDetailView.tsx      (370 dòng) — Modal chi tiết NCC với 3 tabs: Thông tin, Công nợ, Lịch sử mua
└── README.md                   — File này
```

---

## 🎯 Tính năng chính

### SupplierListPage
- **Search:** Tìm theo tên NCC, mã NCC, SĐT
- **Filter:**
  - Trạng thái: Active / Inactive
  - Nhóm NCC: checkbox group với count
  - Nợ hiện tại: range slider (min-max)
  - Tổng mua: range slider (min-max)
- **Sort:** Tên, Mã, Nợ cần trả, Tổng mua (click header → asc/desc)
- **Pagination:** 15/30/50/100 items per page
- **Bulk actions:**
  - Xuất Excel (selected)
  - Xóa (selected)
  - Đổi trạng thái (selected)
- **Star favorites:** Đánh dấu NCC quan trọng

### SupplierForm
- **Fields:**
  - Tên NCC (*required)
  - Mã NCC (auto-generate nếu để trống)
  - Nhóm NCC (text input)
  - Số điện thoại
  - Email
  - Địa chỉ
  - Trạng thái (radio: Active / Inactive)
  - Ghi chú (textarea)
- **Validation:** Tên NCC bắt buộc
- **Mode:** Create / Edit

### SupplierDetailView
- **Tab 1 — Thông tin:**
  - Summary cards: Tổng mua, Nợ cần trả, Số đơn hàng
  - Chi tiết: Mã, Nhóm, SĐT, Email, Địa chỉ, Trạng thái, Ghi chú
- **Tab 2 — Công nợ:**
  - Bảng giao dịch công nợ với running balance
  - Cột: Ngày, Loại (Mua hàng/Trả nợ), Số tiền, Số dư
  - Sort theo ngày mới nhất
- **Tab 3 — Lịch sử mua hàng:**
  - Bảng phiếu nhập hàng từ NCC này
  - Cột: Mã phiếu, Ngày, Tổng tiền, Trạng thái
  - Link đến chi tiết phiếu nhập

---

## 🔄 Workflow

```
Menu "Nhà cung cấp"
  ↓
SupplierListPage (danh sách)
  ↓
[+ Nhà cung cấp] → SupplierForm (create) → Lưu → Back to list
  ↓
[Click row] → SupplierDetailView (3 tabs) → [Sửa] → SupplierForm (edit) → Back to detail
  ↓
[Bulk select] → [Xóa/Xuất Excel/Đổi trạng thái]
```

---

## 📊 Data Flow

### Computed Fields (runtime)
- `totalPurchase`: Tổng tiền mua từ `inventoryTransactions` type='Purchase' của NCC này
- `currentDebt`: Tổng nợ từ `supplierDebts` của NCC này (sum amount where type='purchase' minus type='payment')

### Database Tables
- `suppliers`: Thông tin NCC (id, name, code, phone, email, address, group, status, note)
- `supplier_debts`: Giao dịch công nợ (id, supplier_id, date, type, amount, note)
- `inventory_transactions`: Phiếu nhập hàng (type='Purchase', supplier_id, items, total_amount)

---

## 🎨 Design System

- **Layout:** Reusable `ListPageLayout` với collapsible sidebar
- **Colors:** Indigo accent (`bg-indigo-600`, `text-indigo-600`)
- **Radius:** `rounded-2xl` cho cards, `rounded-xl` cho inputs/buttons
- **Shadow:** `shadow-sm` cho cards
- **Status badges:**
  - Active: `bg-emerald-100 text-emerald-700`
  - Inactive: `bg-slate-100 text-slate-500`

---

## 🔧 Integration

### MainContent.tsx
```tsx
case 'suppliers':
  return (
    <SupplierContainer
      data={data}
      onUpdateData={updateData}
      onUpdateSurgical={updateSurgical}
      onPushBatch={pushBatch}
    />
  );
```

### Navigation
- Menu item: `constants/navigation.ts` → `{ id: 'suppliers', label: 'Nhà cung cấp', ... }`
- Tab ID: `'suppliers'`

---

## ✅ Testing Checklist

- [ ] Tạo NCC mới → hiển thị trong list
- [ ] Sửa NCC → cập nhật trong list
- [ ] Xóa NCC → biến mất khỏi list
- [ ] Search theo tên/mã/SĐT → filter đúng
- [ ] Filter theo trạng thái/nhóm/nợ/tổng mua → filter đúng
- [ ] Sort theo cột → thứ tự đúng
- [ ] Pagination → chuyển trang đúng
- [ ] Bulk select → actions hoạt động
- [ ] Star favorites → lưu trạng thái
- [ ] Detail view → 3 tabs hiển thị đúng data
- [ ] Công nợ tab → running balance tính đúng
- [ ] Lịch sử mua tab → hiển thị phiếu nhập đúng

---

## 🚀 Future Enhancements

- [ ] Export PDF báo cáo công nợ NCC
- [ ] Import NCC từ Excel
- [ ] Gửi email/SMS nhắc nợ tự động
- [ ] Thống kê top NCC theo doanh số
- [ ] Lịch sử thay đổi thông tin NCC (audit log)
- [ ] Đính kèm file hợp đồng/giấy tờ NCC

---

## 📝 Notes

- **Backward compatibility:** Tất cả field mới trong `Supplier` type đều optional (`?`) để không break data cũ
- **Computed fields:** `totalPurchase` và `currentDebt` tính runtime, không lưu DB
- **Old component:** `components/pos/SupplierManager.tsx` có thể archive/xóa sau khi verify module mới hoạt động ổn định
- **Reusable components:** Module này sử dụng `components/shared/*` — nếu cần custom behavior, extend props thay vì fork code
