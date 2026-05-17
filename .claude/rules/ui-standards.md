# Quy chuẩn UI — CFO Brain 4.0

> Áp dụng bắt buộc mỗi khi tạo hoặc sửa giao diện trang danh sách.
> Nếu user nói "giống trang X" → đọc source của trang X trước, không đoán kích thước.

---

## Layout chuẩn cho trang danh sách (List Page)

### Cấu trúc tổng thể

```
<div className="flex h-full min-h-0 bg-slate-50">
  <Sidebar w-64 />        ← LUÔN w-64, không dùng w-56 hay w-72
  <MainPanel flex-1 />
</div>
```

### Sidebar
- **Chiều rộng**: `w-64 shrink-0` (256px) — giống `GoodsFilterSidebar.tsx` và `ListPageLayout.tsx`
- **Nền**: `bg-white border-r border-slate-100`
- **Scroll**: `overflow-y-auto`

### Shared components — BẮT BUỘC dùng thay vì tự code

| Nhu cầu | Component | Import từ |
|---|---|---|
| Wrapper layout sidebar+main | `ListPageLayout` | `'../shared'` |
| Toolbar search + action | `ListPageToolbar` | `'../shared'` |
| Bảng dữ liệu chuẩn | `ListPageTable` | `'../shared'` |
| Pagination footer | `ListPagePagination` | `'../shared'` |
| Tiêu đề section filter | `FilterSection` | `'../shared'` |
| Filter checkbox dạng popup | `FilterCheckboxGroup` | `'../shared'` |
| Filter khoảng ngày | `FilterDateRange` | `'../shared'` |
| Số trang, page size mặc định | `DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS` | `'../shared'` |

Tham chiếu đầy đủ: `components/shared/index.ts`

### Trang tham chiếu chuẩn

| Trang | File |
|---|---|
| Danh sách hàng hóa | `components/pos/GoodsInventory.tsx` + `GoodsFilterSidebar.tsx` |
| Nhập hàng | `components/purchase/PurchaseOrdersPage.tsx` |
| Nhà cung cấp | `components/suppliers/SupplierListPage.tsx` |

---

## Quy trình BẮT BUỘC khi tạo trang mới

1. User nói "giống trang X" → **Đọc source trang X ngay** trước khi viết 1 dòng code
2. Copy đúng `w-64` từ `ListPageLayout.tsx:44` hoặc `GoodsFilterSidebar.tsx:366`
3. Dùng shared components từ `components/shared/` — không tự viết lại
4. Check `components/shared/index.ts` để xem export đầy đủ

---

## Kích thước hay bị nhầm

| Thứ | Đúng | Sai |
|---|---|---|
| Sidebar width | `w-64` | ~~w-56~~, ~~w-72~~ |
| Page size mặc định | `DEFAULT_PAGE_SIZE` (= 15) | hardcode |
| Font size label filter | `text-xs font-normal` (FilterSection) | text-[10px] font-black |
