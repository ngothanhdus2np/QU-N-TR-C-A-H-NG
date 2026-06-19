# EDGE_CASES — Trường hợp đặc biệt, bug đã fix & workaround

> Tài liệu này ghi lại những hành vi không hiển nhiên, bug đã sửa và các quyết định thiết kế đặc biệt.
> Source chính: docs/05-process/HISTORY.md, docs/05-process/AUDIT_LOG.md

---

## PHẦN 1: Edge cases nghiệp vụ

### EC-INV-001: Tồn kho sản phẩm cha luôn = 0 trong DB

**Vấn đề:** `pos_products.stock` của sản phẩm cha (`is_parent=true`) luôn = 0 trong database.

**Lý do:** Stock chỉ ghi vào biến thể con. Sản phẩm cha là "container" logic, không có tồn kho thực.

**Cách xử lý:** UI tổng hợp realtime:
```typescript
// GoodsProductRow.tsx
displayStock = product.isParent
  ? variants.filter(v => v.parentId === product.id).reduce((s,v) => s + v.stock, 0)
  : product.stock
```

**Impact:** Kiểm kho (`useGoodsAudit.ts`) bỏ qua `is_parent=true` — không nhập số lượng kiểm kho cho sản phẩm cha.

---

### EC-INV-002: AVCO khi tồn kho âm hoặc bằng 0

**Vấn đề:** Khi `currentStock <= 0` (đã bán hết), công thức AVCO chia cho 0.

**Cách xử lý:**
```typescript
// businessLogic.inventory.ts:calculateNextImportPrice()
if (currentStock <= 0) nextImportPrice = effectiveUnitPrice  // như 'fixed'
```

**Impact:** Nhập hàng đợt đầu tiên sau khi hết hàng → giá vốn = giá nhập mới (không pha loãng).

---

### EC-INV-003: Xóa phiếu nhập sau khi đã bán

**Vấn đề:** Xóa phiếu nhập khi tồn kho hiện tại < số lượng đã nhập → stock âm.

**Hành vi hiện tại:**
- Hiện dialog cảnh báo "Tồn kho hiện tại thấp hơn số lượng nhập — có thể gây âm tồn kho"
- **VẪN CHO PHÉP XÓA** sau khi user xác nhận

**Source:** `PurchaseOrdersContainer.tsx:handleDeletePurchase()`

---

### EC-INV-004: Trả hàng nhập không rollback giá vốn

**Vấn đề:** Khi trả hàng nhập, `pos_products.import_price` KHÔNG được rollback về giá trước.

**Lý do:** Trả hàng chỉ giảm `stock`, không thay đổi giá vốn. Cần có phiếu nhập mới để cập nhật giá.

**Impact:** Nếu nhập 100 cái @ 50k, trả 50 cái, giá vốn vẫn là 50k (đúng vì hàng còn lại vẫn giá đó).

---

### EC-ORDER-001: Trả hàng không tự giảm công nợ

**Vấn đề:** Khách mua chịu (ghi nợ) rồi trả hàng → `customer.debt_amount` KHÔNG tự động giảm.

**Lý do thiết kế:** Hệ thống không biết khách đã trả tiền nợ đó chưa khi trả hàng.

**Quy trình thủ công:** Nhân viên phải vào trang Khách hàng → ghi thêm khoản "Hoàn tiền" (type='repay').

**Source:** `POSComputer.tsx` — `returnUpdatedCustomer` không có `debtAmount` field.

---

### EC-ORDER-002: Bán hàng không có khách hàng

**Hành vi:** Đơn hàng không gắn `customerId` → KHÔNG ghi `customer_debt_history`.

**Impact:** Báo cáo khách hàng nhóm đơn này vào "Khách lẻ" (`WALK_IN_LABEL = 'Khách lẻ'`).

---

### EC-ORDER-003: autoUpsertStaffSales lỗi không rollback đơn hàng

**Vấn đề:** Bước gán doanh số nhân viên nằm trong try/catch riêng biệt.

**Hành vi:** Nếu `autoUpsertStaffSalesForDate()` lỗi → đơn hàng vẫn được ghi thành công.

**Lý do:** Staff sales là phụ trợ, không được block luồng chính của đơn hàng.

**Source:** `services/posOrderService.ts`

---

### EC-ORDER-004: Stock check POS — allowSellOutOfStock

**Vấn đề:** Mặc định stock phải >= qty để bán. Nhưng có flag `allowSellOutOfStock`.

**Khi bật `allowSellOutOfStock`:** RPC `decrement_product_stock` vẫn chạy nhưng không throw lỗi khi stock âm.

**Source:** `POSComputer.tsx` / `services/posOrderService.ts`

---

### EC-PAY-001: Lương âm (Carry-forward Debt)

**Vấn đề:** Nhân viên bị phạt/thiếu hụt nhiều hơn thu nhập → net pay âm.

**Hành vi:**
- `carry_forward_debt` được ghi vào `employees` bảng
- Kỳ tiếp theo: trừ dần từ lương (không thể trừ nhiều hơn phần có thể trừ)

**Source:** `businessLogic.payroll.ts` (carry-forward logic)

---

### EC-PAY-002: Double-count lương trong báo cáo

**Vấn đề:** Lương được ghi vào cả `payroll_records` (module lương) lẫn `expense_records` (khi kế toán nhập thủ công vào sổ quỹ).

**Cách phòng tránh:**
```typescript
// businessLogic.revenue.ts
payrollTotal = payrollModule > 0 ? payrollModule : ledgerSalaryTotal
// Chỉ dùng 1 trong 2, không cộng cả hai
```

**Keywords nhận diện lương trong expenses:**
`luong`, `hoa hong`, `thuong doanh so`, `thu nhap nhan su`, `nhan su`

---

### EC-SHOPEE-001: Bot DB bị đảo nhầm nhãn shop

**Phát hiện:** 2026-06-18 — browser profile của 2 bot bị đảo ngược:
- port 3001 (shopee-profile-shop1) thực tế login **phuc_sang_store**
- port 3002 (shopee-profile-shop2) thực tế login **giaydepphucsang**

**Hậu quả:** 81 đơn bị gán nhầm DB trong thời gian bot chạy sai nhãn.

**Fix:** Xóa 81 đơn trùng, chạy lại scan, phân tách đúng vào shop1.db / shop2.db.

**Trạng thái hiện tại (sau fix):**
- port 3001 = phuc_sang_store → shop1.db
- port 3002 = giaydepphucsang → shop2.db

---

### EC-SHOPEE-002: Bot không click được tab "Đang giao"

**Nguyên nhân:** Shopee SPA re-render sau mỗi tab click, tab kế chưa actionable khi bot thử click ngay.

**Fix:** Thay `waitForTimeout(2000)` bằng `waitForLoadState('networkidle', {timeout: 8000})`.

**Source:** `/Users/apple/shopee-monitor/bots/orders.js`

---

### EC-SHOPEE-003: Shopee session expired hiện "Đã kết nối"

**Vấn đề:** Khi session Shopee hết hạn, UI vẫn hiện "Đã kết nối" — người dùng không biết.

**Fix:** Thêm state `session_expired`, track `sessionExpired` flag trong `apiServer.js`, broadcast `LOGIN_EXPIRED` qua WebSocket.

---

### EC-WEB-001: Lỗi query bảng pos_order_items không tồn tại

**Vấn đề:** `WebsiteOrdersPage.tsx` cũ query bảng `pos_order_items` — bảng này KHÔNG TỒN TẠI trong schema.

**Fix:** Đọc thẳng cột JSONB `items` có sẵn trong `pos_orders`.

**Source:** `components/website/WebsiteOrdersPage.tsx` (fix 2026-06-16)

---

### EC-WEB-002: RPC create_store_order lỗi case-mismatch status

**Vấn đề:** RPC gốc insert `status = 'Pending'` (chữ hoa P) nhưng `WebsiteOrdersPage.tsx` lọc bằng `'pending'` (chữ thường).

**Fix:** Đổi RPC → `status = 'pending'`.

**Source:** `supabase_setup.sql` (fix 2026-06-16)

---

### EC-WEB-003: Hoàn hàng website — 2 luồng khác nhau

**Vấn đề:** Cần phân biệt:
- **Huỷ trước khi giao ĐVVC** → cộng lại tồn kho ngay
- **Yêu cầu hoàn hàng sau khi đã giao** (`return_requested`) → chưa cộng tồn, đợi nhân viên xác nhận nhận lại hàng

**Cách xử lý:**
```
status transition:
  pending → cancelled  : cộng tồn ngay (RPC)
  shipping/completed → return_requested : KHÔNG cộng tồn
  return_requested → returned : cộng tồn (RPC)
```

**Source:** `RPC update_website_order_status` + `WebsiteOrdersPage.tsx`

---

## PHẦN 2: Bugs đã fix (Audit 2026-06-15)

### Pattern chính: onUpdateSurgical không await

Nhiều module gọi `onUpdateSurgical()` (hàm save Supabase) nhưng KHÔNG await → lỗi Supabase âm thầm, UI hiện thành công nhưng DB không được cập nhật.

| Bug ID | Module | Function | Fix |
|--------|--------|----------|-----|
| BUG-R1a | Revenue | handleAddInventoryOut (nhánh 1) | async + await + try/catch |
| BUG-R1b | Revenue | handleAddInventoryOut (nhánh 2) | async + await + try/catch |
| BUG-R2 | Revenue | handleRemoveInventoryOut | thêm try/catch |
| BUG-E1 | Expense | Delete button ExpenseLedgerTab | async onClick + try/catch |
| BUG-E2 (critical) | Expense | handlePostRecurring | fix async; stop updating lastPostedMonth khi lỗi |

### Pattern thứ 2: filter sidebar không reset page

Filter thay đổi không gọi `setCurrentPage(1)` → trang 2+ hiện trống.

| Bug ID | Module | Filter bị ảnh hưởng |
|--------|--------|---------------------|
| BUG-P2-1 | PurchaseOrdersPage | status, date, supplier, creator |
| BUG-P2-2 | PurchaseReturnsPage | status, date, supplier, creator |
| BUG-O2-1 | OrderReturns | returnType, status checkbox |
| BUG-F2-1 | CashLedgerPage | handleVoucherCheck |
| BUG-PY2-1 | PayrollManager | bulk undo bỏ sót expense "Quyết toán lương nghỉ việc" |

---

## PHẦN 3: Workaround & quyết định kỹ thuật đặc biệt

### WA-001: Tồn kho nhanh từ import Excel

**Vấn đề:** Import Excel hàng hóa không tạo `InventoryTransaction` → `buildCostHistory()` không có dữ liệu khởi điểm.

**Fix:** Sau khi import Excel, tạo 1 `InventoryTransaction` (type='Import') cho các sản phẩm có `stock > 0`.

**Source:** `useGoodsExcelImport.ts` (fix 2026-06-15)

---

### WA-002: KiotViet import thiếu nextImportPrice

**Vấn đề:** Import đơn mua hàng từ KiotViet không có field `nextImportPrice` trong `items` → `buildCostHistory()` skip.

**Fix:** `routes/import.ts:1643` — thêm `nextImportPrice` vào items, update `pos_products.import_price` theo giá mua mới nhất.

---

### WA-003: Import Shopee duplicate key

**Vấn đề:** `ImportFromSourceModal.tsx` query `pos_products` không phân trang → bị giới hạn 1000 dòng → không thấy SKU cha đã tồn tại → insert trùng → lỗi `pos_products_sku_key`.

**Fix:** Thêm `fetchAllPages()` phân trang `.range()` cho cả `pos_products` và `shopee_product_variants`.

---

### WA-004: Supabase tự hosted — bảng không xuất hiện sau CREATE TABLE

**Vấn đề:** Sau khi chạy `CREATE TABLE shopee_products` trên self-hosted Supabase, PostgREST chưa nhận diện → gọi API trả `PGRST205`.

**Nguyên nhân thực tế:** Bảng chưa từng được tạo (không phải lỗi cache).

**Fix:** Dùng `docker exec supabase-db psql` để chạy SQL trực tiếp (bypass Supabase Studio).

**Kiểm tra:** `curl localhost:8000/rest/v1/shopee_products` → 200 = OK, PGRST205 = bảng chưa được tạo.

---

### WA-005: PostgrestError không phải instanceof Error

**Vấn đề:** Nhiều nơi dùng `String(err)` hoặc `err instanceof Error` để lấy message lỗi Supabase → hiện `[object Object]`.

**Fix:** Extract `.message` từ `PostgrestError`:
```typescript
const msg = err instanceof Error ? err.message : (err as any)?.message || String(err);
```

---

### WA-006: Múi giờ GMT+7 vs UTC

**Vấn đề:** `new Date().toISOString()` trả UTC → ngày sai (lệch 7 tiếng).

**Fix thống nhất:**
```typescript
// Dùng locale 'sv-SE' hoặc 'en-CA' → format YYYY-MM-DD theo giờ local
const today = new Date().toLocaleDateString('sv-SE');
```

---

### WA-007: Nhãn shop Shopee bị đảo ngược trong ecosystem.config.js

**Lịch sử:** Trước 2026-06-18, ecosystem.config.js có SHOP_NAME bị swap.

**Trạng thái đúng sau fix:**
```
port 3001 → SHOP_NAME='phuc_sang_store'  → ShippingOrders.tsx: "Phúc Sang Store"
port 3002 → SHOP_NAME='giaydepphucsang' → ShippingOrders.tsx: "Giày Dép Phúc Sang"
```

---

## PHẦN 4: Hành vi NEEDS_VERIFICATION

| # | Vấn đề | Nơi cần kiểm tra |
|---|--------|-----------------|
| NV-001 | Tier upgrade (Standard→Silver→Gold→Diamond) không có rule tự động | Tìm trong ChatInterface.tsx, không thấy rule → có thể là thủ công |
| NV-002 | Tần suất check cảnh báo tồn kho thấp | `routes/notifications.ts` — chưa đọc |
| NV-003 | Limit 2000 rows có enforce cho tất cả tables không | Kiểm tra `apiService.ts:fetchTablePage()` |
| NV-004 | `product_cost_history` có được dùng trong query hay chỉ dùng `buildCostHistory()` từ transactions | `reportCalculations.ts:buildCostHistory()` comment: "bảng product_cost_history hiện chưa được dùng" |
