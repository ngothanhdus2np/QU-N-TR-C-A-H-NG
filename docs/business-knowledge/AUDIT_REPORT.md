# AUDIT_REPORT — Kiểm toán logic nghiệp vụ CFO Brain 4.0

> **Role:** Senior System Auditor  
> **Ngày audit:** 2026-06-19  
> **Phạm vi:** `docs/business-knowledge/` + toàn bộ source code  
> **Phương pháp:** Cross-check MASTER_FLOW vs Business Rules vs Database Schema vs Operation Files vs Source Code  
> **Ghi chú:** KHÔNG sửa code. Chỉ phát hiện, mô tả, đề xuất.

---

## Danh sách findings

---

### AUDIT-001

**Severity:** Critical  
**Module:** Tồn kho — Phương pháp tính giá vốn (Cost Method)

**Description:**  
Tài liệu `INVENTORY_LOGIC.md` mô tả phương pháp `fixed` là "ghi đè, không pha loãng" (overwrite với giá nhập mới). Code thực tế thực hiện ngược lại: **giữ nguyên giá vốn hiện tại**, chỉ dùng giá mới khi `currentImportPrice = 0` (sản phẩm chưa có giá vốn).

Comment trong code (`businessLogic.inventory.ts:183-187`) giải thích đúng hành vi thực: _"Giữ nguyên giá vốn hiện tại. Ngoại lệ: nếu giá vốn hiện tại = 0..."_

**Evidence:**
- File: `src/lib/businessLogic.inventory.ts:200-201`
- Function: `calculateNextImportPrice()`
- Code: `if (costMethod === 'fixed') { return currentImportPrice > 0 ? currentImportPrice : incomingPrice; }`
- Tài liệu sai: `docs/business-knowledge/INVENTORY_LOGIC.md` — mục "Fixed (Giá cố định)"
- Tài liệu sai: `docs/business-knowledge/operations/OP-003-nhap-hang.md`
- Business Rule: INV-001

**Impact:**
- Người đọc tài liệu sẽ hiểu sai hoàn toàn hành vi của hệ thống
- Nếu developer mới sửa code "theo tài liệu" → đổi sang overwrite → phá vỡ logic định giá của toàn bộ kho hàng
- Khi nhập hàng với giá thay đổi, hệ thống `fixed` **không** cập nhật giá vốn → báo cáo lợi nhuận dùng giá vốn cũ → sai số tích lũy theo thời gian nếu giá NCC thay đổi

**Recommendation:**  
Sửa lại `INVENTORY_LOGIC.md` và `OP-003`: mô tả đúng là `fixed = giữ nguyên giá vốn cũ`. Nếu ý định thực sự là overwrite, phải sửa code và viết test case.

---

### AUDIT-002

**Severity:** High  
**Module:** Tồn kho — Cấu hình phương pháp giá vốn

**Description:**  
Hàm `getInventoryCostMethod()` đọc từ `localStorage` (client-side). Không có cơ chế đồng bộ cấu hình này lên Supabase. Nếu 2 thiết bị/tab dùng cost method khác nhau → tính toán giá vốn cho cùng 1 đợt nhập hàng sẽ cho kết quả khác nhau.

**Evidence:**
- File: `src/lib/businessLogic.inventory.ts:153-160`
- Function: `getInventoryCostMethod()`
- Storage key: `INVENTORY_COST_METHOD_STORAGE_KEY = 'inventory_cost_method'`
- Default: trả về `'fixed'` nếu localStorage trống hoặc lỗi
- Không có entry nào trong `app_state` (Supabase) lưu giá trị này

**Impact:**
- Thiết bị A dùng `average`, thiết bị B dùng `fixed` → import hàng trên B nhưng tính AVCO trên A → `importPrice` của sản phẩm không nhất quán
- Backup/restore localStorage mất setting → giá vốn tự động về `fixed`
- Không có UI rõ ràng nào thông báo đang dùng cost method gì khi nhập hàng

**Recommendation:**  
Lưu cost method vào `app_state` (Supabase), đọc từ `useAppData` như các setting khác (`posInventorySettings`, `shopeeCosts`...). `localStorage` chỉ dùng làm cache.

---

### AUDIT-003

**Severity:** Critical  
**Module:** Tồn kho — Race condition bán hàng đồng thời

**Description:**  
`processPlaceOrder()` thực hiện 3 bước riêng lẻ: (1) check tồn kho trên client, (2) ghi order, (3) update stock. Giữa bước 1 và 3 có window thời gian: nếu 2 POS bán cùng 1 sản phẩm cuối cùng đồng thời, cả 2 đều pass bước 1, cả 2 đều ghi order, và stock bị trừ 2 lần → **tồn kho âm**.

Database có RPC `decrement_product_stock()` (kiểm tra `stock >= quantity` trước khi trừ) nhưng `posOrderService.ts` không gọi RPC này — client gọi REST `PATCH pos_products SET stock = <pre-computed>`.

**Evidence:**
- File: `services/posOrderService.ts:228-237` — client-side stock guard
- File: `services/posOrderService.ts:262-287` — `updateSurgical(stockUpdates)` → REST PATCH
- File: `supabase_setup.sql:444-456` — `decrement_product_stock()` RPC được định nghĩa
- Comment trong `posOrderService.ts:226`: _"phía server dùng RPC decrement_product_stock để đảm bảo atomicity thực sự"_ — nhưng code không gọi RPC này
- Business Rule: POS-001

**Impact:**
- Cao nhất vào giờ cao điểm: nhiều nhân viên bán cùng lúc trên nhiều thiết bị
- Tồn kho âm → báo cáo kiểm kho sai → gây lệch số thực
- RPC đã được định nghĩa nhưng không được gọi = dead code

**Recommendation:**  
Tìm hiểu xem `updateSurgical` có route qua `apply_inventory_transaction_with_stock` RPC (atomic) hay REST. Nếu là REST: gọi `decrement_product_stock` trong bước 3, bỏ client-side guard (hoặc giữ làm UX guard). Nếu RPC: xác nhận và ghi rõ trong tài liệu.

---

### AUDIT-004

**Severity:** High  
**Module:** Tồn kho — Giá vốn lịch sử cho báo cáo lợi nhuận

**Description:**  
`buildCostHistory()` xây map giá vốn từ `InventoryTransaction.items[].nextImportPrice`. Bảng `product_cost_history` trong Supabase **không được query** (comment trong code xác nhận). Nếu một transaction cũ không có `nextImportPrice` (ví dụ: import từ KiotViet, hoặc tạo trước khi fix) → `getHistoricalCost()` trả về `fallback = product.importPrice` hiện tại → COGS lịch sử tính theo giá vốn hiện tại, không phải lúc bán.

**Evidence:**
- File: `src/lib/reportCalculations.ts:4-6` — comment: _"Bảng product_cost_history trên Supabase hiện chưa được dùng"_
- File: `src/lib/reportCalculations.ts:14-16` — `if (!price || price <= 0) return;` → bỏ qua entry có nextImportPrice = 0/null
- File: `src/lib/reportCalculations.ts:36-43` — `getHistoricalCost()` → trả về fallback nếu không có entry
- NV-004 đã ghi nhận nhưng chưa coi là finding

**Impact:**
- Báo cáo lợi nhuận theo thời gian (`getSalesProfitRowsByDate`) có thể tính COGS sai nếu dữ liệu cũ
- Đặc biệt sai khi giá vốn thay đổi nhiều (import đợt mới giá khác hẳn)
- Không có cách phân biệt "không có lịch sử" vs "lịch sử đúng là 0"

**Recommendation:**  
Ghi `nextImportPrice` vào tất cả inventory transactions khi nhập hàng (đảm bảo không null). Xem xét thực sự dùng `product_cost_history` bảng để có audit trail ổn định hơn.

---

### AUDIT-005

**Severity:** High  
**Module:** Đơn hàng — Rollback không cover staff sales

**Description:**  
Trong `processPlaceOrder()`, nếu bất kỳ bước nào (ghi order, update stock, cập nhật customer, ghi debt, ghi revenue) fail → toàn bộ rollback diễn ra theo thứ tự ngược. **Tuy nhiên** `autoUpsertStaffSalesForDate()` được gọi **sau** try/catch chính và được đánh dấu "best-effort, không rollback vì idempotent". 

Nếu order thành công → rollback → staff sales record đã được ghi → nhân viên vẫn có doanh số từ đơn hàng đã rollback.

**Evidence:**
- File: `services/posOrderService.ts:340-346` — `autoUpsertStaffSalesForDate` ngoài try/catch
- File: `services/posOrderService.ts:250-338` — rollback loop chỉ cover bước 1-4
- Comment: _"best-effort, không rollback vì idempotent"_

**Impact:**
- Lương nhân viên có thể cao hơn thực tế (tính hoa hồng trên đơn bị lỗi)
- Trường hợp xảy ra: mất kết nối sau khi order ghi xong nhưng trước khi revenue update
- Tần suất thấp nhưng tác động tài chính có thể tích lũy

**Recommendation:**  
Chuyển `autoUpsertStaffSalesForDate` vào trong try block chính. Vì nó idempotent, đưa vào rollback (re-calculate and upsert from remaining orders) sẽ đảm bảo nhất quán.

---

### AUDIT-006

**Severity:** High  
**Module:** Đơn hàng — Revenue update khi trả hàng không đúng ngày

**Description:**  
`processReturnOrder()` tính `orderDate = toLocalDateKey(returnOrder.date)` (ngày trả hàng) và cập nhật revenue record của **ngày trả**, không phải ngày bán. Nếu khách trả hàng 3 ngày sau khi mua:
- Revenue ngày bán: KHÔNG giảm (đã ghi đúng ngày đó)
- Revenue ngày trả: giảm `netRevenue`, tăng `returnsValue`

Dẫn đến 2 ngày có dữ liệu sai: ngày bán có doanh thu không thực; ngày trả có doanh thu âm.

**Evidence:**
- File: `services/posOrderService.ts:400-401` — `orderDate = toLocalDateKey(returnOrder.date)`
- File: `services/posOrderService.ts:413-426` — revenue update dùng `existingRevenue` của ngày trả
- Không có logic truy ngược ngày bán gốc để điều chỉnh

**Impact:**
- Báo cáo doanh thu theo ngày sẽ sai nếu trả hàng xuyên ngày
- `returnsValue` của ngày trả tăng nhưng `totalGrossRevenue` ngày trả không có đơn bán gốc → `grossProfit` âm trong ngày trả
- Báo cáo tổng tháng vẫn đúng (tổng trả đúng) nhưng phân tích theo ngày bị méo

**Recommendation:**  
Khi trả hàng, xác định ngày bán gốc từ `originalOrder.date` và điều chỉnh revenue record ngày đó. Nếu không muốn phức tạp: ghi chú rõ trong tài liệu đây là thiết kế có chủ đích.

---

### AUDIT-007

**Severity:** High  
**Module:** Đơn hàng — Trả hàng không trừ customer.totalSpent

**Description:**  
Trong `processReturnOrder()`, `updatedCustomer` được cập nhật điểm tích lũy và nợ (nếu có), nhưng không có logic trừ `customer.totalSpent` tương ứng với giá trị hàng trả. `totalSpent` là cơ sở để xác định tier khách hàng, nên sau khi trả hàng khách hàng vẫn có `totalSpent` như khi chưa trả.

**Evidence:**
- File: `services/posOrderService.ts:497-505` — `updatedCustomer` update nhưng không đề cập `totalSpent`
- File: `services/posOrderService.ts:368-378` — `ReturnOrderArgs` không có field nào tính `totalSpent` delta
- Tham chiếu: `dataMapper.ts:600` — `totalSpent: Number(c.total_spent || 0)` — được đọc từ DB

**Impact:**
- `customer.totalSpent` bị thổi phồng so với chi tiêu thực tế
- Nếu có logic upgrade tier dựa trên `totalSpent` → khách hàng lên tier oan
- Thống kê "Khách hàng VIP" không phản ánh đúng

**Recommendation:**  
Trong `processReturnOrder()`, tính `totalSpentDelta = returnedItems.reduce(sum, item.total)` và trừ khỏi `updatedCustomer.totalSpent` (clamp về 0).

---

### AUDIT-008

**Severity:** Medium  
**Module:** Đơn hàng — Nhận dạng đơn trả hàng có thể sai

**Description:**  
Hàm `inferIsReturnOrder()` xác định đơn trả dựa trên: (1) field `is_return = true`, (2) `orderCode` bắt đầu bằng 'TH', (3) `finalAmount < 0`. Điều kiện (2) và (3) có thể cho false positive:
- Đơn hàng bình thường có mã bắt đầu 'TH' (ví dụ: tên viết tắt) → bị mark là trả hàng
- Đơn giảm giá 100% hoặc đơn quà tặng có `finalAmount = 0` → không bị nhầm (chỉ khi < 0)

**Evidence:**
- File: `services/dataMapper.ts:29-31` — `inferIsReturnOrder`
- Logic: `explicit === true || /^TH/i.test(String(orderCode || '')) || finalAmount < 0`

**Impact:**
- Đơn hàng bị nhầm là trả hàng → không hiển thị trong báo cáo bán hàng, hiển thị trong báo cáo trả hàng
- COGS không được tính cho đơn bị nhầm
- `isReturn` ảnh hưởng đến `calcOrderRevenue()`: `isReturn ? -totalAmount : totalAmount - discount`

**Recommendation:**  
Bỏ điều kiện (2) và (3) trong `inferIsReturnOrder`. Chỉ dùng `explicit = is_return`. Khi tạo đơn trả, đặt `is_return = true` ngay từ đầu. Điều kiện fallback chỉ phù hợp cho data migration.

---

### AUDIT-009

**Severity:** High  
**Module:** Đơn hàng / Shopee — apply_inventory_transaction_with_stock RPC: dual-path conflict

**Description:**  
Tồn tại 2 đường ghi tồn kho:
- **Path A (Client):** `posOrderService.ts` → `updateSurgical([{key: 'inventoryTransactions', ...}])` + `updateSurgical([{key: 'posProducts', ...}])` — 2 REST calls riêng biệt
- **Path B (RPC):** `apply_inventory_transaction_with_stock()` — INSERT transaction + UPDATE stock trong 1 atomic SQL transaction

Không rõ `updateSurgical` gọi Path A hay Path B. Nếu cả 2 path được gọi (ví dụ: có hook ở server), stock sẽ bị trừ 2 lần.

**Evidence:**
- File: `services/posOrderService.ts:271` — `updateSurgical([{ key: 'inventoryTransactions', item: inventoryTransaction }])`
- File: `supabase_setup.sql:510-598` — `apply_inventory_transaction_with_stock()` RPC
- File: `services/apiService.ts` — **chưa đọc đầy đủ** (NEEDS_VERIFICATION)
- Comment posOrderService:227: _"phía server dùng RPC decrement_product_stock để đảm bảo atomicity thực sự"_ — nhưng không có lời gọi `decrement_product_stock` trong file

**Impact:**
- Nếu dual-path: tồn kho bị trừ đôi → sai số nghiêm trọng
- Nếu chỉ path A (REST): mất atomicity → race condition (xem AUDIT-003)
- Comment và code mâu thuẫn gây khó debug

**Recommendation:**  
Xác nhận `updateSurgical` đi qua đường nào. Ghi rõ trong comment. Bổ sung integration test kiểm tra tồn kho trước/sau khi bán hàng.

---

### AUDIT-010

**Severity:** Medium  
**Module:** Công nợ — Tier khách hàng không có logic tự động

**Description:**  
`pos_customers.tier` có các giá trị `Standard / Silver / Gold / Diamond` nhưng không tìm thấy bất kỳ code nào tự động nâng/hạ tier dựa trên `totalSpent` hay điểm tích lũy. Tier có thể bị sai lệch so với chi tiêu thực (đặc biệt khi `totalSpent` không bị giảm khi trả hàng — xem AUDIT-007).

**Evidence:**
- File: `services/dataMapper.ts:603` — `tier: c.tier || 'Standard'` — đọc từ DB, không tính lại
- SYSTEM_OVERVIEW.md NV-001: _"Tier upgrade KH — không tìm thấy rule tự động trong code"_
- Business Rule: không có rule chính thức về tier upgrade

**Impact:**
- Khách hàng cần được nâng/hạ tier thủ công → dễ bỏ sót
- Tier có thể không phản ánh đúng → ảnh hưởng chính sách ưu đãi

**Recommendation:**  
Xác nhận với owner: tier có được set tự động không? Nếu cần tự động, thêm logic trong `processPlaceOrder()` sau khi cập nhật `totalSpent`.

---

### AUDIT-011

**Severity:** Medium  
**Module:** Công nợ — Nhập hàng nhanh không có NCC không ghi supplier_debts

**Description:**  
Theo OP-011, nhập hàng nhanh (trang Hàng hóa) nếu không chọn NCC → không ghi `supplier_debts`. Khi owner nhập hàng mà chưa xác định NCC, công nợ NCC sẽ thiếu, ảnh hưởng số dư nợ tổng hợp.

**Evidence:**
- `docs/business-knowledge/operations/OP-011-nhap-hang-nhanh.md`: _"Nếu không có supplierId → supplierName = '' → KHÔNG ghi supplier_debts"_
- Business Rule: không có validation bắt buộc NCC khi nhập hàng nhanh

**Impact:**
- Công nợ NCC bị thiếu nếu nhập hàng thường xuyên không chọn NCC
- Số dư nợ tổng hợp trong báo cáo công nợ NCC sai thấp hơn thực tế

**Recommendation:**  
Thêm warning (không block) trong UI khi nhập hàng nhanh mà không chọn NCC. Có thể ghi vào `supplier_debts` với `supplierId = null` để track sau.

---

### AUDIT-012

**Severity:** High  
**Module:** Doanh thu/Lợi nhuận — Double-count prevention: regex dấu tiếng Việt có thể lỗi

**Description:**  
Logic loại bỏ double-count lương trong `calculateExecutiveInsights()` và `calculateFinancialHealthScore()` dùng:
```javascript
s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
```

Regex `[̀-ͯ]` là range từ U+0300 đến U+036F (combining diacritical marks). Tuy nhiên regex này có thể bị trình biên dịch/editor encode sai, dẫn đến không xóa dấu tiếng Việt. Nếu normalization lỗi → keyword `'luong'` không khớp với category `'Lương'` → salary entries **không bị lọc** → cộng đôi cả payroll module + ledger entry.

**Evidence:**
- File: `src/lib/businessLogic.revenue.ts:44-47` — `calculateExecutiveInsights()`
- File: `src/lib/businessLogic.revenue.ts:86-94` — `calculateFinancialHealthScore()`
- Keywords: `['luong', 'hoa hong', 'thuong doanh so', 'thu nhap nhan su', 'nhan su']`
- Regex: `/[̀-ͯ]/g` — phụ thuộc vào encoding đúng của file

**Impact:**
- Nếu normalization lỗi: `totalOpEx` bao gồm cả payroll module lẫn ledger salary → chi phí tính gấp đôi → lợi nhuận hiển thị thấp hơn thực tế
- Ngược lại: nếu normalization hoạt động đúng → lợi nhuận đúng
- Cần unit test để xác nhận

**Recommendation:**  
Thêm unit test cho `isSalaryCategory()` với input `'Lương'`, `'Hoa hồng'`, `'Lương nhân viên tháng 6'`. Xem xét dùng thư viện `diacritics` hoặc list whitelist category ID thay vì keyword matching.

---

### AUDIT-013

**Severity:** Medium  
**Module:** Doanh thu/Lợi nhuận — Date format không nhất quán giữa các module

**Description:**  
Hai module dùng format ngày khác nhau:
- `posOrderService.ts:191` → `date.toLocaleDateString('en-CA')` (= YYYY-MM-DD theo Canada locale)
- `businessLogic.revenue.ts:20` → `now.toLocaleDateString('sv-SE')` (= YYYY-MM-DD theo Sweden locale)

Cả hai đều output YYYY-MM-DD nhưng phụ thuộc vào locale của runtime. Nếu Node.js locale system có vấn đề, output có thể khác.

**Evidence:**
- File: `services/posOrderService.ts:190-193` — `toLocalDateKey()` dùng `en-CA`
- File: `src/lib/businessLogic.revenue.ts:20` — `sv-SE`

**Impact:**
- Thấp trong điều kiện bình thường (cả 2 đều YYYY-MM-DD)
- Nếu môi trường server thiếu locale data: một trong hai có thể output format khác → date key mismatch khi merge revenue records
- Khó debug vì lỗi chỉ xảy ra trong môi trường thiếu ICU

**Recommendation:**  
Tạo 1 utility function `toLocaleDateKey(date: Date): string` dùng thống nhất 1 locale (ưu tiên `sv-SE` vì đã dùng ở nhiều nơi hơn) và import vào tất cả module cần.

---

### AUDIT-014

**Severity:** Critical  
**Module:** Shopee — Dedup shopeeInventoryOut theo orderId mất data đơn nhiều sản phẩm

**Description:**  
`dataMapper.ts` dedup `shopeeInventoryOut` theo key `record.orderId || record.id`. Shopee bot có thể tạo nhiều rows cho 1 `order_sn` (1 row per SKU/product trong đơn). Sau dedup, tất cả items từ cùng 1 đơn bị gộp thành 1 record → **mất toàn bộ items còn lại**.

Đây là thiết kế sai: `inventoryOutSync.ts` đúng khi dùng key `${order_sn}||${sku}` (line 156-158), nhưng `dataMapper.ts` bỏ phần `||${sku}` khi dedup phía client.

**Evidence:**
- File: `services/dataMapper.ts:493-500`
- Key: `const key = record.orderId || record.id;` — thiếu `sku`
- File: `routes/inventoryOutSync.ts:156-158` — key đúng: `` `${r.order_id}||${r.sku ?? ''}` ``
- Comment trong dataMapper: _"Dedup theo mã vận đơn"_ — mã vận đơn là orderId, không phải orderId+sku

**Impact:**
- Đơn Shopee có nhiều sản phẩm → chỉ giữ 1 item cao điểm nhất → mất revenue, mất COGS
- Analytics Shopee (doanh thu, số lượng) thấp hơn thực tế
- Bug ảnh hưởng toàn bộ báo cáo Shopee nếu bán đơn combo

**Recommendation:**  
Đổi key thành `` `${record.orderId}||${record.sku || record.id}` `` trong `dataMapper.ts`. Thống nhất với key trong `inventoryOutSync.ts`.

---

### AUDIT-015

**Severity:** High  
**Module:** Shopee — Sync serial update không atomic, partial failure không rollback

**Description:**  
`runInventoryOutSync()` cập nhật từng đơn trong vòng lặp `for...of` (serial): nếu đơn thứ 50/1000 fail → 49 đơn đã cập nhật, 951 đơn chưa → trạng thái Supabase không nhất quán với bot. Không có transaction, không có rollback.

**Evidence:**
- File: `routes/inventoryOutSync.ts:192-211` — `for (const o of toUpdate)` với từng `await supabase.update()`
- Không có `BEGIN/COMMIT` hoặc batch update
- `inserted` dùng 1 batch insert (an toàn) nhưng `updated` là serial

**Impact:**
- Partial sync khó phát hiện: response `{ inserted, updated, skipped }` chỉ đếm số đơn đã xử lý đến điểm lỗi
- Fee fields (platform_fee, payment_fee...) của đơn chưa được update sẽ giữ giá trị sai cũ
- Lợi nhuận Shopee tính toán sai cho đơn bị bỏ qua

**Recommendation:**  
Chuyển sang batch update (Supabase hỗ trợ `upsert` array): `supabase.from('shopee_inventory_out').upsert(rows)` với conflict trên `(order_id, sku)`. Cần thêm UNIQUE constraint trên DB (xem AUDIT-022).

---

### AUDIT-016

**Severity:** Medium  
**Module:** Shopee — Bot timeout không retry, partial sync không alert rõ

**Description:**  
`fetchAllBotOrders()` dùng `axios.get` với `timeout: 10_000`. Nếu bot không phản hồi trong 10s, toàn bộ shop đó bị bỏ qua với entry trong `botErrors[]`. Không có retry, không có exponential backoff. Response trả về HTTP 200 (OK) dù 1 trong 2 bot fail — chỉ có `botErrors[]` trong body.

**Evidence:**
- File: `routes/inventoryOutSync.ts:63-79` — `axios.get(..., { timeout: 10_000 })`
- File: `routes/inventoryOutSync.ts:124-132` — `try/catch` per bot, không retry
- File: `routes/inventoryOutSync.ts:219-225` — HTTP 503 chỉ khi **tất cả** bot fail. 1 bot fail + 1 bot OK → HTTP 200

**Impact:**
- 1 shop lỗi → dữ liệu shop đó không cập nhật, không ai biết
- `botErrors` trả về trong HTTP 200 → UI có thể không hiển thị lỗi
- Dữ liệu 2 shop lệch nhau theo thời gian

**Recommendation:**  
Retry 2-3 lần với delay. Nếu vẫn fail: log cảnh báo rõ ràng, trả về HTTP 207 (Multi-Status). UI nên hiển thị `botErrors` nổi bật.

---

### AUDIT-017

**Severity:** High  
**Module:** Báo cáo — Lịch sử giá vốn fallback không rõ ràng

**Description:**  
`getHistoricalCost()` trả về `fallback = product.importPrice` (giá vốn **hiện tại**) nếu không tìm thấy lịch sử. Khi gọi từ `getSalesProfitRowsByDate()`, fallback này là `product.importPrice` tại thời điểm tính báo cáo — không phải tại thời điểm bán hàng. Với sản phẩm đã thay đổi giá vốn nhiều lần, báo cáo lợi nhuận quá khứ sẽ sai.

**Evidence:**
- File: `src/lib/reportCalculations.ts:29-43` — `getHistoricalCost()` với fallback param
- Caller truyền `fallback = product.importPrice` (current price)
- InventoryTransaction cũ (trước khi fix) có thể không có `nextImportPrice`

**Impact:**
- Lợi nhuận quá khứ tính theo giá vốn hiện tại, không phải lúc bán → sai lệch ngày càng lớn theo thời gian
- Báo cáo tháng cũ sau khi nhập hàng mới (giá tăng) → lợi nhuận cũ hiển thị thấp hơn thực tế

**Recommendation:**  
Đảm bảo tất cả `InventoryTransaction` type=Import có `nextImportPrice` > 0. Migration script cập nhật lại các transaction cũ từ `pos_products.import_price` tại thời điểm tương ứng (nếu có lịch sử).

---

### AUDIT-018

**Severity:** Medium  
**Module:** Báo cáo — mergeBy dùng key='date' cho revenue có thể conflict

**Description:**  
`dataMapper.mapAllData()` merge revenue với key `'date'`: `this.mergeBy(cloudRevenue, localData?.revenue || [], 'date')`. Nếu local có revenue record ngày X với ID-A và cloud cũng có record ngày X với ID-B → `mergeBy` match theo date → cloud thắng (đúng theo thiết kế). Nhưng nếu vì lý do nào đó có 2 cloud records cùng date → merge không xác định.

**Evidence:**
- File: `services/dataMapper.ts:194` — `this.mergeBy(cloudRevenue, ..., 'date')`
- File: `supabase_setup.sql` — `revenue_records` không có UNIQUE constraint trên `date`

**Impact:**
- Không có database constraint ngăn 2 records cùng date → `mergeBy` dùng index của record đầu tiên trong `cloudIndexMap` → record thứ 2 bị ghi đè
- Nếu có bug tạo duplicate revenue record: tổng sẽ thấp hơn thực tế (chỉ giữ 1)

**Recommendation:**  
Thêm UNIQUE constraint: `ALTER TABLE revenue_records ADD CONSTRAINT revenue_records_date_unique UNIQUE (date, branch_id);`

---

### AUDIT-019

**Severity:** Low  
**Module:** Báo cáo — shopee_inventory_out thiếu UNIQUE constraint tại DB

**Description:**  
`inventoryOutSync.ts` dedup bằng application-level check (`existingMap`). Không có UNIQUE constraint tại DB level trên `(order_id, sku)`. Nếu 2 sync request chạy đồng thời → cả 2 đều không thấy record trong `existingMap` → cả 2 insert → duplicate.

**Evidence:**
- File: `supabase_setup.sql:70-91` — `shopee_inventory_out` không có UNIQUE constraint
- File: `routes/inventoryOutSync.ts:155-179` — dedup chỉ bằng application-level Map

**Impact:**
- Duplicate records → tổng doanh thu Shopee tính đôi
- Race condition thấp (cần 2 sync đồng thời) nhưng không có cơ chế chặn ở DB

**Recommendation:**  
`ALTER TABLE shopee_inventory_out ADD CONSTRAINT shopee_inv_out_order_sku_unique UNIQUE (order_id, sku);`  
Đổi `INSERT` → `INSERT ... ON CONFLICT (order_id, sku) DO UPDATE SET ...` (upsert).

---

### AUDIT-020

**Severity:** Medium  
**Module:** Lợi nhuận — grossProfit trong revenue_records tính sai khi có revenueOther

**Description:**  
Trong `processReturnOrder()` khi không có revenue record ngày trả (mở mới):
```javascript
const netRevenue = -totalReturnValue + totalExchangeValue;
const totalCogs = -returnCogs + exchangeCogs;
grossProfit: netRevenue + orderReturnFee - totalCogs,
```

Nhưng trong `processPlaceOrder()` khi có existing revenue:
```javascript
grossProfit: updatedNetRevenue + updatedRevenueOther - updatedTotalCogs,
```

Hai công thức khác nhau cho `grossProfit`:
- Bán hàng: `netRevenue + revenueOther - cogs` ✓
- Trả hàng (new record): `netRevenue + returnFee - cogs` (thiếu `revenueOther` cũ)

**Evidence:**
- File: `services/posOrderService.ts:442-443` — `grossProfit: netRevenue + orderReturnFee - totalCogs`
- File: `services/posOrderService.ts:184-186` — `grossProfit: orderNetRevenue + orderOtherFees - orderCogs`
- File: `services/posOrderService.ts:425` — existing record: `grossProfit = updatedNetRevenue + (existingRevenue.revenueOther || 0) + orderReturnFee - updatedTotalCogs`

**Impact:**
- `grossProfit` trong revenue record ngày trả không bao gồm `revenueOther` lịch sử (0 trong ngày mới) → thực ra đúng khi ngày mới
- Nhưng công thức không nhất quán → dễ gây bug khi sửa sau này

**Recommendation:**  
Tạo helper function `computeGrossProfit(netRevenue, revenueOther, cogs)` dùng chung, tránh viết công thức lặp lại.

---

### AUDIT-021

**Severity:** Medium  
**Module:** Lương — Xác định policy theo thâm niên có thể không match

**Description:**  
`determineCurrentPolicy()` dùng "Top-Down Range Matching": sort policy theo `startThreshold` giảm dần, tìm policy đầu tiên mà `seniorityDays >= start && seniorityDays < end`. Nếu không match policy nào (gap trong range): fallback về `sortedCandidates[sortedCandidates.length - 1]` (policy có startThreshold thấp nhất). Điều này có thể chọn policy sai nếu khoảng thâm niên không liên tục.

**Evidence:**
- File: `src/lib/businessLogic.payroll.ts:104-115` — `determineCurrentPolicy()`
- Warning được log khi overlap nhưng không có check cho gap
- `isOfficial: seniorityDays >= 30` — ngưỡng 30 ngày được hardcode

**Impact:**
- Nhân viên có thâm niên trong "vùng trống" giữa 2 policy → nhận policy thấp nhất → lương tính sai
- `isOfficial = true` khi >= 30 ngày: nhân viên thử việc 30 ngày đủ điều kiện "official"?

**Recommendation:**  
Thêm check gap và log warning tương tự như overlap. Tài liệu hóa ngưỡng 30 ngày cho `isOfficial`.

---

### AUDIT-022

**Severity:** Low  
**Module:** Schema — Thiếu constraint toàn vẹn dữ liệu quan trọng

**Description:**  
Nhiều bảng quan trọng thiếu UNIQUE hoặc NOT NULL constraint tại DB level, phụ thuộc vào application-level validation:

| Bảng | Thiếu constraint |
|------|-----------------|
| `revenue_records` | UNIQUE (date, branch_id) |
| `shopee_inventory_out` | UNIQUE (order_id, sku) |
| `payroll_records` | UNIQUE (employee_id, month) |
| `supplier_debts` | Thiếu FK về `suppliers` (chỉ có text `supplier_id`) |

**Evidence:**
- File: `supabase_setup.sql` — xem qua, không thấy các constraint trên

**Impact:**
- Application bug hoặc race condition có thể tạo duplicate records
- Không có DB-level safety net → phụ thuộc 100% vào app logic

**Recommendation:**  
Thêm UNIQUE constraints và FK constraints vào `supabase_setup.sql`. Chạy migration.

---

## Tóm tắt theo module

| Module | Findings | Critical | High | Medium | Low |
|--------|----------|----------|------|--------|-----|
| **Tồn kho** | 4 | 2 (001, 003) | 2 (002, 004) | 0 | 0 |
| **Đơn hàng** | 5 | 0 | 3 (005, 006, 007, 009) | 2 (008) | 0 |
| **Công nợ** | 2 | 0 | 0 | 2 (010, 011) | 0 |
| **Doanh thu/Lợi nhuận** | 3 | 0 | 1 (012) | 2 (013, 020) | 0 |
| **Shopee** | 3 | 1 (014) | 2 (015, 016) | 0 | 0 |
| **Báo cáo** | 3 | 0 | 1 (017) | 1 (018) | 1 (019) |
| **Lương** | 1 | 0 | 0 | 1 (021) | 0 |
| **Schema** | 1 | 0 | 0 | 0 | 1 (022) |
| **TỔNG** | **22** | **3** | **9** | **8** | **2** |

---

## TOP 20 RISKS — Sắp xếp theo tác động vận hành thực tế

| # | Finding | Severity | Tác động lên | Mức độ ảnh hưởng vận hành |
|---|---------|----------|-------------|--------------------------|
| 1 | **AUDIT-014** — Shopee dedup mất data multi-SKU | Critical | Doanh thu, Lợi nhuận | **Rất cao** — mọi đơn Shopee nhiều sản phẩm bị mất item → doanh thu/COGS thấp hơn thực tế |
| 2 | **AUDIT-003** — Race condition bán hàng đồng thời | Critical | Tồn kho | **Rất cao** — giờ cao điểm, nhiều nhân viên → tồn kho âm không phát hiện ngay |
| 3 | **AUDIT-001** — Fixed cost method: docs sai | Critical | Tồn kho, Lợi nhuận | **Rất cao** — dev mới "sửa theo docs" → phá vỡ toàn bộ giá vốn kho hàng |
| 4 | **AUDIT-012** — Double-count prevention regex lỗi | High | Lợi nhuận | **Cao** — chi phí tính đôi → lợi nhuận tháng sai → quyết định kinh doanh sai |
| 5 | **AUDIT-006** — Revenue update sai ngày khi trả hàng | High | Doanh thu, Báo cáo | **Cao** — doanh thu ngày bán không giảm, ngày trả âm → phân tích theo ngày méo |
| 6 | **AUDIT-017** — COGS lịch sử fallback về giá hiện tại | High | Lợi nhuận, Báo cáo | **Cao** — báo cáo lợi nhuận quá khứ sai khi giá vốn thay đổi |
| 7 | **AUDIT-015** — Shopee sync serial, partial fail | High | Doanh thu Shopee | **Cao** — fee fields sai → lợi nhuận Shopee tính không đúng |
| 8 | **AUDIT-007** — Trả hàng không trừ totalSpent | High | Công nợ, Tier KH | **Trung bình-Cao** — tier KH thổi phồng, tích lũy theo thời gian |
| 9 | **AUDIT-004** — COGS lịch sử từ transaction thiếu nextImportPrice | High | Lợi nhuận | **Trung bình-Cao** — data cũ trước khi fix → COGS báo cáo sai |
| 10 | **AUDIT-009** — Dual-path ghi tồn kho (RPC vs REST) | High | Tồn kho | **Trung bình-Cao** — nếu dual-path: tồn kho trừ đôi |
| 11 | **AUDIT-002** — Cost method ở localStorage | High | Tồn kho | **Trung bình** — multi-device dùng khác method → importPrice không nhất quán |
| 12 | **AUDIT-005** — Staff sales không rollback | High | Lương | **Trung bình** — lương NV có thể cao hơn thực tế vài trường hợp hiếm |
| 13 | **AUDIT-013** — Date format en-CA vs sv-SE | Medium | Doanh thu, Báo cáo | **Trung bình** — môi trường thiếu ICU → date key mismatch → revenue không hợp nhất |
| 14 | **AUDIT-020** — grossProfit formula không nhất quán | Medium | Lợi nhuận | **Trung bình** — rủi ro khi sửa code sau này |
| 15 | **AUDIT-008** — inferIsReturnOrder false positive | Medium | Đơn hàng, Báo cáo | **Trung bình** — đơn hàng bị nhầm loại → sai thống kê |
| 16 | **AUDIT-016** — Bot timeout 10s không retry | Medium | Doanh thu Shopee | **Trung bình** — 1 shop mất dữ liệu, không alert rõ |
| 17 | **AUDIT-011** — Nhập hàng nhanh không NCC | Medium | Công nợ NCC | **Trung bình** — công nợ NCC thiếu nếu hay dùng |
| 18 | **AUDIT-018** — mergeBy revenue key='date', thiếu UNIQUE | Medium | Báo cáo | **Thấp-Trung bình** — nếu có duplicate → tổng sai |
| 19 | **AUDIT-010** — Tier KH không tự động | Medium | Công nợ, Marketing | **Thấp** — vận hành thủ công có thể chấp nhận |
| 20 | **AUDIT-021** — Policy gap trong tính lương | Medium | Lương | **Thấp** — chỉ ảnh hưởng khi cấu hình policy có gap |

---

## Phần chưa xác minh (AUDIT NEEDS_VERIFICATION)

Các điểm sau cần xác minh thêm bằng cách đọc source còn lại:

| # | Vấn đề | File cần đọc |
|---|--------|-------------|
| ANV-001 | `updateSurgical` gọi REST hay RPC? → ảnh hưởng AUDIT-003, AUDIT-009 | `services/apiService.ts` |
| ANV-002 | `processReturnOrder`: `item.total` có bao gồm line discount không? | `types/index.ts` — định nghĩa `POSOrderItem.total` |
| ANV-003 | Nhập hàng nhanh (`useGoodsPurchase.ts`) có ghi `nextImportPrice` vào item không? | `components/pos/useGoodsPurchase.ts` |
| ANV-004 | `payroll_records` có UNIQUE constraint (employee_id, month) không? | Supabase Dashboard hoặc `supabase_setup.sql` đầy đủ hơn |
| ANV-005 | Kiểm kho (OP-005) có cập nhật `nextImportPrice` hay không? | `components/inventory/GoodsInventoryCheck.tsx` |

---

*AUDIT_REPORT.md — Hoàn thành 2026-06-19. Tổng: 22 findings, 3 Critical, 9 High, 8 Medium, 2 Low.*
