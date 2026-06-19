# AUDIT_REPORT — Kiểm toán logic nghiệp vụ CFO Brain 4.0

> **Vai trò:** Kiểm toán viên hệ thống cấp cao  
> **Ngày kiểm toán:** 2026-06-19  
> **Phạm vi:** `docs/business-knowledge/` + toàn bộ mã nguồn  
> **Phương pháp:** Đối chiếu chéo MASTER_FLOW với Quy tắc nghiệp vụ, Lược đồ cơ sở dữ liệu, Tệp vận hành và Mã nguồn  
> **Ghi chú:** KHÔNG sửa code. Chỉ phát hiện, mô tả, đề xuất.

---

## Danh sách phát hiện

---

### AUDIT-001

**Mức độ nghiêm trọng:** Nghiêm trọng  
**Mô-đun:** Tồn kho — Phương pháp tính giá vốn (Cost Method)

**Mô tả:**  
Tài liệu `INVENTORY_LOGIC.md` mô tả phương pháp `fixed` là "ghi đè, không pha loãng" (overwrite với giá nhập mới). Code thực tế thực hiện ngược lại: **giữ nguyên giá vốn hiện tại**, chỉ dùng giá mới khi `currentImportPrice = 0` (sản phẩm chưa có giá vốn).

Comment trong code (`businessLogic.inventory.ts:183-187`) giải thích đúng hành vi thực: _"Giữ nguyên giá vốn hiện tại. Ngoại lệ: nếu giá vốn hiện tại = 0..."_

**Bằng chứng:**
- File: `src/lib/businessLogic.inventory.ts:200-201`
- Hàm: `calculateNextImportPrice()`
- Code: `if (costMethod === 'fixed') { return currentImportPrice > 0 ? currentImportPrice : incomingPrice; }`
- Tài liệu sai: `docs/business-knowledge/INVENTORY_LOGIC.md` — mục "Fixed (Giá cố định)"
- Tài liệu sai: `docs/business-knowledge/operations/OP-003-nhap-hang.md`
- Quy tắc nghiệp vụ: INV-001

**Tác động:**
- Người đọc tài liệu sẽ hiểu sai hoàn toàn hành vi của hệ thống
- Nếu lập trình viên mới sửa code "theo tài liệu" → đổi sang ghi đè → phá vỡ logic định giá của toàn bộ kho hàng
- Khi nhập hàng với giá thay đổi, phương pháp `fixed` **không** cập nhật giá vốn → báo cáo lợi nhuận dùng giá vốn cũ → sai số tích lũy theo thời gian nếu giá nhà cung cấp thay đổi

**Đề xuất:**  
Sửa lại `INVENTORY_LOGIC.md` và `OP-003`: mô tả đúng là `fixed = giữ nguyên giá vốn cũ`. Nếu ý định thực sự là ghi đè, phải sửa code và viết test case.

---

### AUDIT-002

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Tồn kho — Cấu hình phương pháp giá vốn

**Mô tả:**  
Hàm `getInventoryCostMethod()` đọc từ `localStorage` (phía máy khách). Không có cơ chế đồng bộ cấu hình này lên Supabase. Nếu 2 thiết bị/tab dùng phương pháp giá vốn khác nhau → tính toán giá vốn cho cùng 1 đợt nhập hàng sẽ cho kết quả khác nhau.

**Bằng chứng:**
- File: `src/lib/businessLogic.inventory.ts:153-160`
- Hàm: `getInventoryCostMethod()`
- Khóa lưu trữ: `INVENTORY_COST_METHOD_STORAGE_KEY = 'inventory_cost_method'`
- Mặc định: trả về `'fixed'` nếu localStorage trống hoặc lỗi
- Không có mục nào trong `app_state` (Supabase) lưu giá trị này

**Tác động:**
- Thiết bị A dùng `average`, thiết bị B dùng `fixed` → nhập hàng trên B nhưng tính AVCO trên A → `importPrice` của sản phẩm không nhất quán
- Sao lưu/khôi phục localStorage mất cài đặt → giá vốn tự động về `fixed`
- Không có giao diện rõ ràng nào thông báo đang dùng phương pháp giá vốn nào khi nhập hàng

**Đề xuất:**  
Lưu phương pháp giá vốn vào `app_state` (Supabase), đọc từ `useAppData` như các cài đặt khác (`posInventorySettings`, `shopeeCosts`...). `localStorage` chỉ dùng làm bộ nhớ đệm.

---

### AUDIT-003

**Mức độ nghiêm trọng:** Nghiêm trọng  
**Mô-đun:** Tồn kho — Tranh chấp bán hàng đồng thời

**Mô tả:**  
`processPlaceOrder()` thực hiện 3 bước riêng lẻ: (1) kiểm tra tồn kho phía máy khách, (2) ghi đơn hàng, (3) cập nhật tồn kho. Giữa bước 1 và 3 có khoảng thời gian: nếu 2 máy POS bán cùng 1 sản phẩm cuối cùng đồng thời, cả 2 đều qua bước 1, cả 2 đều ghi đơn, và tồn kho bị trừ 2 lần → **tồn kho âm**.

Cơ sở dữ liệu có RPC `decrement_product_stock()` (kiểm tra `stock >= quantity` trước khi trừ) nhưng `posOrderService.ts` không gọi RPC này — máy khách gọi REST `PATCH pos_products SET stock = <giá trị tính sẵn>`.

**Bằng chứng:**
- File: `services/posOrderService.ts:228-237` — kiểm tra tồn kho phía máy khách
- File: `services/posOrderService.ts:262-287` — `updateSurgical(stockUpdates)` → REST PATCH
- File: `supabase_setup.sql:444-456` — `decrement_product_stock()` RPC được định nghĩa
- Comment trong `posOrderService.ts:226`: _"phía server dùng RPC decrement_product_stock để đảm bảo atomicity thực sự"_ — nhưng code không gọi RPC này
- Quy tắc nghiệp vụ: POS-001

**Tác động:**
- Cao nhất vào giờ cao điểm: nhiều nhân viên bán cùng lúc trên nhiều thiết bị
- Tồn kho âm → báo cáo kiểm kho sai → gây lệch số thực
- RPC đã được định nghĩa nhưng không được gọi = mã chết

**Đề xuất:**  
Tìm hiểu xem `updateSurgical` có đi qua `apply_inventory_transaction_with_stock` RPC (nguyên tử) hay REST. Nếu là REST: gọi `decrement_product_stock` trong bước 3, bỏ kiểm tra phía máy khách (hoặc giữ làm kiểm tra UX). Nếu RPC: xác nhận và ghi rõ trong tài liệu.

---

### AUDIT-004

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Tồn kho — Giá vốn lịch sử cho báo cáo lợi nhuận

**Mô tả:**  
`buildCostHistory()` xây bản đồ giá vốn từ `InventoryTransaction.items[].nextImportPrice`. Bảng `product_cost_history` trong Supabase **không được truy vấn** (comment trong code xác nhận). Nếu một giao dịch cũ không có `nextImportPrice` (ví dụ: nhập từ KiotViet, hoặc tạo trước khi sửa) → `getHistoricalCost()` trả về giá dự phòng = `product.importPrice` hiện tại → giá vốn lịch sử tính theo giá vốn hiện tại, không phải lúc bán.

**Bằng chứng:**
- File: `src/lib/reportCalculations.ts:4-6` — comment: _"Bảng product_cost_history trên Supabase hiện chưa được dùng"_
- File: `src/lib/reportCalculations.ts:14-16` — `if (!price || price <= 0) return;` → bỏ qua mục có nextImportPrice = 0/null
- File: `src/lib/reportCalculations.ts:36-43` — `getHistoricalCost()` → trả về giá dự phòng nếu không có mục
- NV-004 đã ghi nhận nhưng chưa coi là phát hiện

**Tác động:**
- Báo cáo lợi nhuận theo thời gian (`getSalesProfitRowsByDate`) có thể tính giá vốn sai nếu dữ liệu cũ
- Đặc biệt sai khi giá vốn thay đổi nhiều (nhập đợt mới giá khác hẳn)
- Không có cách phân biệt "không có lịch sử" với "lịch sử đúng là 0"

**Đề xuất:**  
Ghi `nextImportPrice` vào tất cả giao dịch tồn kho khi nhập hàng (đảm bảo không null). Xem xét thực sự dùng bảng `product_cost_history` để có nhật ký kiểm toán ổn định hơn.

---

### AUDIT-005

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Đơn hàng — Khôi phục không bao gồm doanh số nhân viên

**Mô tả:**  
Trong `processPlaceOrder()`, nếu bất kỳ bước nào (ghi đơn, cập nhật tồn kho, cập nhật khách hàng, ghi nợ, ghi doanh thu) fail → toàn bộ khôi phục diễn ra theo thứ tự ngược. **Tuy nhiên** `autoUpsertStaffSalesForDate()` được gọi **sau** khối try/catch chính và được đánh dấu "cố gắng tối đa, không khôi phục vì idempotent". 

Nếu đơn hàng thành công → khôi phục → bản ghi doanh số nhân viên đã được ghi → nhân viên vẫn có doanh số từ đơn hàng đã khôi phục.

**Bằng chứng:**
- File: `services/posOrderService.ts:340-346` — `autoUpsertStaffSalesForDate` ngoài try/catch
- File: `services/posOrderService.ts:250-338` — vòng lặp khôi phục chỉ bao gồm bước 1-4
- Comment: _"best-effort, không rollback vì idempotent"_

**Tác động:**
- Lương nhân viên có thể cao hơn thực tế (tính hoa hồng trên đơn bị lỗi)
- Trường hợp xảy ra: mất kết nối sau khi đơn ghi xong nhưng trước khi cập nhật doanh thu
- Tần suất thấp nhưng tác động tài chính có thể tích lũy

**Đề xuất:**  
Chuyển `autoUpsertStaffSalesForDate` vào trong khối try chính. Vì nó idempotent, đưa vào khôi phục (tính lại và upsert từ đơn còn lại) sẽ đảm bảo nhất quán.

---

### AUDIT-006

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Đơn hàng — Cập nhật doanh thu khi trả hàng sai ngày

**Mô tả:**  
`processReturnOrder()` tính `orderDate = toLocalDateKey(returnOrder.date)` (ngày trả hàng) và cập nhật bản ghi doanh thu của **ngày trả**, không phải ngày bán. Nếu khách trả hàng 3 ngày sau khi mua:
- Doanh thu ngày bán: KHÔNG giảm (đã ghi đúng ngày đó)
- Doanh thu ngày trả: giảm `netRevenue`, tăng `returnsValue`

Dẫn đến 2 ngày có dữ liệu sai: ngày bán có doanh thu không thực; ngày trả có doanh thu âm.

**Bằng chứng:**
- File: `services/posOrderService.ts:400-401` — `orderDate = toLocalDateKey(returnOrder.date)`
- File: `services/posOrderService.ts:413-426` — cập nhật doanh thu dùng `existingRevenue` của ngày trả
- Không có logic truy ngược ngày bán gốc để điều chỉnh

**Tác động:**
- Báo cáo doanh thu theo ngày sẽ sai nếu trả hàng xuyên ngày
- `returnsValue` của ngày trả tăng nhưng `totalGrossRevenue` ngày trả không có đơn bán gốc → lợi nhuận gộp âm trong ngày trả
- Báo cáo tổng tháng vẫn đúng (tổng trả đúng) nhưng phân tích theo ngày bị méo

**Đề xuất:**  
Khi trả hàng, xác định ngày bán gốc từ `originalOrder.date` và điều chỉnh bản ghi doanh thu ngày đó. Nếu không muốn phức tạp: ghi chú rõ trong tài liệu đây là thiết kế có chủ đích.

---

### AUDIT-007

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Đơn hàng — Trả hàng không trừ customer.totalSpent

**Mô tả:**  
Trong `processReturnOrder()`, `updatedCustomer` được cập nhật điểm tích lũy và nợ (nếu có), nhưng không có logic trừ `customer.totalSpent` tương ứng với giá trị hàng trả. `totalSpent` là cơ sở để xác định hạng khách hàng, nên sau khi trả hàng khách hàng vẫn có `totalSpent` như khi chưa trả.

**Bằng chứng:**
- File: `services/posOrderService.ts:497-505` — `updatedCustomer` cập nhật nhưng không đề cập `totalSpent`
- File: `services/posOrderService.ts:368-378` — `ReturnOrderArgs` không có trường nào tính delta `totalSpent`
- Tham chiếu: `dataMapper.ts:600` — `totalSpent: Number(c.total_spent || 0)` — được đọc từ cơ sở dữ liệu

**Tác động:**
- `customer.totalSpent` bị thổi phồng so với chi tiêu thực tế
- Nếu có logic nâng hạng dựa trên `totalSpent` → khách hàng lên hạng không xứng
- Thống kê "Khách hàng VIP" không phản ánh đúng

**Đề xuất:**  
Trong `processReturnOrder()`, tính `totalSpentDelta = returnedItems.reduce(sum, item.total)` và trừ khỏi `updatedCustomer.totalSpent` (giới hạn về 0).

---

### AUDIT-008

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Đơn hàng — Nhận dạng đơn trả hàng có thể sai

**Mô tả:**  
Hàm `inferIsReturnOrder()` xác định đơn trả dựa trên: (1) trường `is_return = true`, (2) `orderCode` bắt đầu bằng 'TH', (3) `finalAmount < 0`. Điều kiện (2) và (3) có thể cho kết quả dương tính giả:
- Đơn hàng bình thường có mã bắt đầu 'TH' (ví dụ: tên viết tắt) → bị đánh dấu là trả hàng
- Đơn giảm giá 100% hoặc đơn quà tặng có `finalAmount = 0` → không bị nhầm (chỉ khi < 0)

**Bằng chứng:**
- File: `services/dataMapper.ts:29-31` — `inferIsReturnOrder`
- Logic: `explicit === true || /^TH/i.test(String(orderCode || '')) || finalAmount < 0`

**Tác động:**
- Đơn hàng bị nhầm là trả hàng → không hiển thị trong báo cáo bán hàng, hiển thị trong báo cáo trả hàng
- Giá vốn không được tính cho đơn bị nhầm
- `isReturn` ảnh hưởng đến `calcOrderRevenue()`: `isReturn ? -totalAmount : totalAmount - discount`

**Đề xuất:**  
Bỏ điều kiện (2) và (3) trong `inferIsReturnOrder`. Chỉ dùng `explicit = is_return`. Khi tạo đơn trả, đặt `is_return = true` ngay từ đầu. Điều kiện dự phòng chỉ phù hợp cho di chuyển dữ liệu.

---

### AUDIT-009

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Đơn hàng / Shopee — apply_inventory_transaction_with_stock RPC: xung đột hai luồng

**Mô tả:**  
Tồn tại 2 đường ghi tồn kho:
- **Luồng A (Máy khách):** `posOrderService.ts` → `updateSurgical([{key: 'inventoryTransactions', ...}])` + `updateSurgical([{key: 'posProducts', ...}])` — 2 lời gọi REST riêng biệt
- **Luồng B (RPC):** `apply_inventory_transaction_with_stock()` — INSERT giao dịch + UPDATE tồn kho trong 1 giao dịch SQL nguyên tử

Không rõ `updateSurgical` gọi Luồng A hay Luồng B. Nếu cả 2 luồng đều được gọi (ví dụ: có hook ở máy chủ), tồn kho sẽ bị trừ 2 lần.

**Bằng chứng:**
- File: `services/posOrderService.ts:271` — `updateSurgical([{ key: 'inventoryTransactions', item: inventoryTransaction }])`
- File: `supabase_setup.sql:510-598` — `apply_inventory_transaction_with_stock()` RPC
- File: `services/apiService.ts` — **chưa đọc đầy đủ** (CẦN XÁC MINH THÊM)
- Comment posOrderService:227: _"phía server dùng RPC decrement_product_stock để đảm bảo atomicity thực sự"_ — nhưng không có lời gọi `decrement_product_stock` trong file

**Tác động:**
- Nếu hai luồng cùng chạy: tồn kho bị trừ đôi → sai số nghiêm trọng
- Nếu chỉ Luồng A (REST): mất tính nguyên tử → tranh chấp (xem AUDIT-003)
- Comment và code mâu thuẫn gây khó gỡ lỗi

**Đề xuất:**  
Xác nhận `updateSurgical` đi qua đường nào. Ghi rõ trong comment. Bổ sung kiểm tra tích hợp kiểm tra tồn kho trước/sau khi bán hàng.

---

### AUDIT-010

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Công nợ — Hạng khách hàng không có logic tự động

**Mô tả:**  
`pos_customers.tier` có các giá trị `Standard / Silver / Gold / Diamond` nhưng không tìm thấy bất kỳ code nào tự động nâng/hạ hạng dựa trên `totalSpent` hay điểm tích lũy. Hạng có thể bị sai lệch so với chi tiêu thực (đặc biệt khi `totalSpent` không bị giảm khi trả hàng — xem AUDIT-007).

**Bằng chứng:**
- File: `services/dataMapper.ts:603` — `tier: c.tier || 'Standard'` — đọc từ cơ sở dữ liệu, không tính lại
- SYSTEM_OVERVIEW.md NV-001: _"Nâng hạng khách hàng — không tìm thấy quy tắc tự động trong code"_
- Quy tắc nghiệp vụ: không có quy tắc chính thức về nâng hạng

**Tác động:**
- Khách hàng cần được nâng/hạ hạng thủ công → dễ bỏ sót
- Hạng có thể không phản ánh đúng → ảnh hưởng chính sách ưu đãi

**Đề xuất:**  
Xác nhận với chủ cửa hàng: hạng có được đặt tự động không? Nếu cần tự động, thêm logic trong `processPlaceOrder()` sau khi cập nhật `totalSpent`.

---

### AUDIT-011

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Công nợ — Nhập hàng nhanh không có nhà cung cấp không ghi supplier_debts

**Mô tả:**  
Theo OP-011, nhập hàng nhanh (trang Hàng hóa) nếu không chọn nhà cung cấp → không ghi `supplier_debts`. Khi chủ cửa hàng nhập hàng mà chưa xác định nhà cung cấp, công nợ nhà cung cấp sẽ thiếu, ảnh hưởng số dư nợ tổng hợp.

**Bằng chứng:**
- `docs/business-knowledge/operations/OP-011-nhap-hang-nhanh.md`: _"Nếu không có supplierId → supplierName = '' → KHÔNG ghi supplier_debts"_
- Quy tắc nghiệp vụ: không có ràng buộc bắt buộc nhà cung cấp khi nhập hàng nhanh

**Tác động:**
- Công nợ nhà cung cấp bị thiếu nếu nhập hàng thường xuyên không chọn nhà cung cấp
- Số dư nợ tổng hợp trong báo cáo công nợ nhà cung cấp thấp hơn thực tế

**Đề xuất:**  
Thêm cảnh báo (không chặn) trong giao diện khi nhập hàng nhanh mà không chọn nhà cung cấp. Có thể ghi vào `supplier_debts` với `supplierId = null` để theo dõi sau.

---

### AUDIT-012

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Doanh thu/Lợi nhuận — Cơ chế ngăn tính đôi: biểu thức chính quy tiếng Việt có thể lỗi

**Mô tả:**  
Logic loại bỏ tính đôi lương trong `calculateExecutiveInsights()` và `calculateFinancialHealthScore()` dùng:
```javascript
s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
```

Biểu thức chính quy `[̀-ͯ]` là dải từ U+0300 đến U+036F (ký tự kết hợp bổ nghĩa). Tuy nhiên biểu thức này có thể bị trình biên dịch/trình soạn thảo mã hóa sai, dẫn đến không xóa dấu tiếng Việt. Nếu chuẩn hóa lỗi → từ khóa `'luong'` không khớp với danh mục `'Lương'` → các mục lương **không bị lọc** → tính đôi cả module lương lẫn mục sổ cái.

**Bằng chứng:**
- File: `src/lib/businessLogic.revenue.ts:44-47` — `calculateExecutiveInsights()`
- File: `src/lib/businessLogic.revenue.ts:86-94` — `calculateFinancialHealthScore()`
- Từ khóa: `['luong', 'hoa hong', 'thuong doanh so', 'thu nhap nhan su', 'nhan su']`
- Biểu thức chính quy: `/[̀-ͯ]/g` — phụ thuộc vào mã hóa đúng của file

**Tác động:**
- Nếu chuẩn hóa lỗi: `totalOpEx` bao gồm cả module lương lẫn mục lương sổ cái → chi phí tính gấp đôi → lợi nhuận hiển thị thấp hơn thực tế
- Ngược lại: nếu chuẩn hóa hoạt động đúng → lợi nhuận đúng
- Cần kiểm thử đơn vị để xác nhận

**Đề xuất:**  
Thêm kiểm thử đơn vị cho `isSalaryCategory()` với đầu vào `'Lương'`, `'Hoa hồng'`, `'Lương nhân viên tháng 6'`. Xem xét dùng thư viện `diacritics` hoặc danh sách trắng ID danh mục thay vì khớp từ khóa.

---

### AUDIT-013

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Doanh thu/Lợi nhuận — Định dạng ngày không nhất quán giữa các mô-đun

**Mô tả:**  
Hai mô-đun dùng định dạng ngày khác nhau:
- `posOrderService.ts:191` → `date.toLocaleDateString('en-CA')` (= YYYY-MM-DD theo vùng Canada)
- `businessLogic.revenue.ts:20` → `now.toLocaleDateString('sv-SE')` (= YYYY-MM-DD theo vùng Thụy Điển)

Cả hai đều xuất YYYY-MM-DD nhưng phụ thuộc vào vùng ngôn ngữ của môi trường chạy. Nếu hệ thống Node.js có vấn đề về vùng ngôn ngữ, kết quả có thể khác.

**Bằng chứng:**
- File: `services/posOrderService.ts:190-193` — `toLocalDateKey()` dùng `en-CA`
- File: `src/lib/businessLogic.revenue.ts:20` — `sv-SE`

**Tác động:**
- Thấp trong điều kiện bình thường (cả 2 đều YYYY-MM-DD)
- Nếu môi trường máy chủ thiếu dữ liệu vùng ngôn ngữ: một trong hai có thể xuất định dạng khác → khóa ngày không khớp khi hợp nhất bản ghi doanh thu
- Khó gỡ lỗi vì lỗi chỉ xảy ra trong môi trường thiếu ICU

**Đề xuất:**  
Tạo 1 hàm tiện ích `toLocaleDateKey(date: Date): string` dùng thống nhất 1 vùng ngôn ngữ (ưu tiên `sv-SE` vì đã dùng ở nhiều nơi hơn) và nhập vào tất cả mô-đun cần.

---

### AUDIT-014

**Mức độ nghiêm trọng:** Nghiêm trọng  
**Mô-đun:** Shopee — Loại trùng shopeeInventoryOut theo orderId mất dữ liệu đơn nhiều sản phẩm

**Mô tả:**  
`dataMapper.ts` loại trùng `shopeeInventoryOut` theo khóa `record.orderId || record.id`. Shopee bot có thể tạo nhiều dòng cho 1 `order_sn` (1 dòng mỗi SKU/sản phẩm trong đơn). Sau khi loại trùng, tất cả mục từ cùng 1 đơn bị gộp thành 1 bản ghi → **mất toàn bộ các mục còn lại**.

Đây là thiết kế sai: `inventoryOutSync.ts` đúng khi dùng khóa `${order_sn}||${sku}` (dòng 156-158), nhưng `dataMapper.ts` bỏ phần `||${sku}` khi loại trùng phía máy khách.

**Bằng chứng:**
- File: `services/dataMapper.ts:493-500`
- Khóa: `const key = record.orderId || record.id;` — thiếu `sku`
- File: `routes/inventoryOutSync.ts:156-158` — khóa đúng: `` `${r.order_id}||${r.sku ?? ''}` ``
- Comment trong dataMapper: _"Dedup theo mã vận đơn"_ — mã vận đơn là orderId, không phải orderId+sku

**Tác động:**
- Đơn Shopee có nhiều sản phẩm → chỉ giữ 1 mục → mất doanh thu, mất giá vốn
- Phân tích Shopee (doanh thu, số lượng) thấp hơn thực tế
- Lỗi ảnh hưởng toàn bộ báo cáo Shopee nếu bán đơn gộp

**Đề xuất:**  
Đổi khóa thành `` `${record.orderId}||${record.sku || record.id}` `` trong `dataMapper.ts`. Thống nhất với khóa trong `inventoryOutSync.ts`.

---

### AUDIT-015

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Shopee — Đồng bộ tuần tự, lỗi một phần không khôi phục

**Mô tả:**  
`runInventoryOutSync()` cập nhật từng đơn trong vòng lặp `for...of` (tuần tự): nếu đơn thứ 50/1000 lỗi → 49 đơn đã cập nhật, 951 đơn chưa → trạng thái Supabase không nhất quán với bot. Không có giao dịch, không có khôi phục.

**Bằng chứng:**
- File: `routes/inventoryOutSync.ts:192-211` — `for (const o of toUpdate)` với từng `await supabase.update()`
- Không có `BEGIN/COMMIT` hoặc cập nhật hàng loạt
- Phần thêm mới dùng 1 lần thêm hàng loạt (an toàn) nhưng phần cập nhật là tuần tự

**Tác động:**
- Đồng bộ một phần khó phát hiện: phản hồi `{ inserted, updated, skipped }` chỉ đếm số đơn đã xử lý đến điểm lỗi
- Các trường phí (platform_fee, payment_fee...) của đơn chưa được cập nhật sẽ giữ giá trị sai cũ
- Lợi nhuận Shopee tính toán sai cho đơn bị bỏ qua

**Đề xuất:**  
Chuyển sang cập nhật hàng loạt (Supabase hỗ trợ `upsert` mảng): `supabase.from('shopee_inventory_out').upsert(rows)` với xung đột trên `(order_id, sku)`. Cần thêm ràng buộc UNIQUE trên cơ sở dữ liệu (xem AUDIT-022).

---

### AUDIT-016

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Shopee — Bot hết thời gian chờ không thử lại, đồng bộ một phần không cảnh báo rõ

**Mô tả:**  
`fetchAllBotOrders()` dùng `axios.get` với `timeout: 10_000`. Nếu bot không phản hồi trong 10 giây, toàn bộ cửa hàng đó bị bỏ qua với mục trong `botErrors[]`. Không có thử lại, không có tăng dần thời gian chờ. Phản hồi trả về HTTP 200 (OK) dù 1 trong 2 bot lỗi — chỉ có `botErrors[]` trong nội dung.

**Bằng chứng:**
- File: `routes/inventoryOutSync.ts:63-79` — `axios.get(..., { timeout: 10_000 })`
- File: `routes/inventoryOutSync.ts:124-132` — `try/catch` mỗi bot, không thử lại
- File: `routes/inventoryOutSync.ts:219-225` — HTTP 503 chỉ khi **tất cả** bot lỗi. 1 bot lỗi + 1 bot OK → HTTP 200

**Tác động:**
- 1 cửa hàng lỗi → dữ liệu cửa hàng đó không cập nhật, không ai biết
- `botErrors` trả về trong HTTP 200 → giao diện có thể không hiển thị lỗi
- Dữ liệu 2 cửa hàng lệch nhau theo thời gian

**Đề xuất:**  
Thử lại 2-3 lần với độ trễ. Nếu vẫn lỗi: ghi cảnh báo rõ ràng, trả về HTTP 207 (Đa trạng thái). Giao diện nên hiển thị `botErrors` nổi bật.

---

### AUDIT-017

**Mức độ nghiêm trọng:** Cao  
**Mô-đun:** Báo cáo — Giá vốn lịch sử dự phòng không rõ ràng

**Mô tả:**  
`getHistoricalCost()` trả về giá dự phòng = `product.importPrice` (giá vốn **hiện tại**) nếu không tìm thấy lịch sử. Khi gọi từ `getSalesProfitRowsByDate()`, giá dự phòng này là `product.importPrice` tại thời điểm tính báo cáo — không phải tại thời điểm bán hàng. Với sản phẩm đã thay đổi giá vốn nhiều lần, báo cáo lợi nhuận quá khứ sẽ sai.

**Bằng chứng:**
- File: `src/lib/reportCalculations.ts:29-43` — `getHistoricalCost()` với tham số dự phòng
- Nơi gọi truyền `fallback = product.importPrice` (giá hiện tại)
- Giao dịch tồn kho cũ (trước khi sửa) có thể không có `nextImportPrice`

**Tác động:**
- Lợi nhuận quá khứ tính theo giá vốn hiện tại, không phải lúc bán → sai lệch ngày càng lớn theo thời gian
- Báo cáo tháng cũ sau khi nhập hàng mới (giá tăng) → lợi nhuận cũ hiển thị thấp hơn thực tế

**Đề xuất:**  
Đảm bảo tất cả `InventoryTransaction` type=Import có `nextImportPrice` > 0. Script di chuyển dữ liệu cập nhật lại các giao dịch cũ từ `pos_products.import_price` tại thời điểm tương ứng (nếu có lịch sử).

---

### AUDIT-018

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Báo cáo — mergeBy dùng key='date' cho doanh thu có thể xung đột

**Mô tả:**  
`dataMapper.mapAllData()` hợp nhất doanh thu theo khóa `'date'`: `this.mergeBy(cloudRevenue, localData?.revenue || [], 'date')`. Nếu dữ liệu cục bộ có bản ghi doanh thu ngày X với ID-A và đám mây cũng có bản ghi ngày X với ID-B → `mergeBy` khớp theo ngày → đám mây thắng (đúng theo thiết kế). Nhưng nếu vì lý do nào đó có 2 bản ghi đám mây cùng ngày → hợp nhất không xác định.

**Bằng chứng:**
- File: `services/dataMapper.ts:194` — `this.mergeBy(cloudRevenue, ..., 'date')`
- File: `supabase_setup.sql` — `revenue_records` không có ràng buộc UNIQUE trên `date`

**Tác động:**
- Không có ràng buộc cơ sở dữ liệu ngăn 2 bản ghi cùng ngày → `mergeBy` dùng chỉ mục của bản ghi đầu tiên trong `cloudIndexMap` → bản ghi thứ 2 bị ghi đè
- Nếu có lỗi tạo bản ghi doanh thu trùng: tổng sẽ thấp hơn thực tế (chỉ giữ 1)

**Đề xuất:**  
Thêm ràng buộc UNIQUE: `ALTER TABLE revenue_records ADD CONSTRAINT revenue_records_date_unique UNIQUE (date, branch_id);`

---

### AUDIT-019

**Mức độ nghiêm trọng:** Thấp  
**Mô-đun:** Báo cáo — shopee_inventory_out thiếu ràng buộc UNIQUE tại cơ sở dữ liệu

**Mô tả:**  
`inventoryOutSync.ts` loại trùng bằng kiểm tra cấp ứng dụng (`existingMap`). Không có ràng buộc UNIQUE tại cấp cơ sở dữ liệu trên `(order_id, sku)`. Nếu 2 yêu cầu đồng bộ chạy đồng thời → cả 2 đều không thấy bản ghi trong `existingMap` → cả 2 thêm → trùng lặp.

**Bằng chứng:**
- File: `supabase_setup.sql:70-91` — `shopee_inventory_out` không có ràng buộc UNIQUE
- File: `routes/inventoryOutSync.ts:155-179` — loại trùng chỉ bằng Map cấp ứng dụng

**Tác động:**
- Bản ghi trùng → tổng doanh thu Shopee tính đôi
- Tranh chấp thấp (cần 2 đồng bộ đồng thời) nhưng không có cơ chế chặn ở cơ sở dữ liệu

**Đề xuất:**  
`ALTER TABLE shopee_inventory_out ADD CONSTRAINT shopee_inv_out_order_sku_unique UNIQUE (order_id, sku);`  
Đổi `INSERT` → `INSERT ... ON CONFLICT (order_id, sku) DO UPDATE SET ...` (upsert).

---

### AUDIT-020

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Lợi nhuận — grossProfit trong revenue_records tính sai khi có revenueOther

**Mô tả:**  
Trong `processReturnOrder()` khi không có bản ghi doanh thu ngày trả (tạo mới):
```javascript
const netRevenue = -totalReturnValue + totalExchangeValue;
const totalCogs = -returnCogs + exchangeCogs;
grossProfit: netRevenue + orderReturnFee - totalCogs,
```

Nhưng trong `processPlaceOrder()` khi có bản ghi doanh thu hiện có:
```javascript
grossProfit: updatedNetRevenue + updatedRevenueOther - updatedTotalCogs,
```

Hai công thức khác nhau cho `grossProfit`:
- Bán hàng: `netRevenue + revenueOther - cogs` ✓
- Trả hàng (bản ghi mới): `netRevenue + returnFee - cogs` (thiếu `revenueOther` cũ)

**Bằng chứng:**
- File: `services/posOrderService.ts:442-443` — `grossProfit: netRevenue + orderReturnFee - totalCogs`
- File: `services/posOrderService.ts:184-186` — `grossProfit: orderNetRevenue + orderOtherFees - orderCogs`
- File: `services/posOrderService.ts:425` — bản ghi hiện có: `grossProfit = updatedNetRevenue + (existingRevenue.revenueOther || 0) + orderReturnFee - updatedTotalCogs`

**Tác động:**
- `grossProfit` trong bản ghi doanh thu ngày trả không bao gồm `revenueOther` lịch sử (0 trong ngày mới) → thực ra đúng khi ngày mới
- Nhưng công thức không nhất quán → dễ gây lỗi khi sửa sau này

**Đề xuất:**  
Tạo hàm trợ giúp `computeGrossProfit(netRevenue, revenueOther, cogs)` dùng chung, tránh viết công thức lặp lại.

---

### AUDIT-021

**Mức độ nghiêm trọng:** Trung bình  
**Mô-đun:** Lương — Xác định chính sách theo thâm niên có thể không khớp

**Mô tả:**  
`determineCurrentPolicy()` dùng cách "duyệt từ trên xuống": sắp xếp chính sách theo `startThreshold` giảm dần, tìm chính sách đầu tiên mà `seniorityDays >= start && seniorityDays < end`. Nếu không khớp chính sách nào (khoảng trống trong dải): dùng dự phòng về `sortedCandidates[sortedCandidates.length - 1]` (chính sách có startThreshold thấp nhất). Điều này có thể chọn chính sách sai nếu khoảng thâm niên không liên tục.

**Bằng chứng:**
- File: `src/lib/businessLogic.payroll.ts:104-115` — `determineCurrentPolicy()`
- Cảnh báo được ghi khi có chồng chéo nhưng không có kiểm tra cho khoảng trống
- `isOfficial: seniorityDays >= 30` — ngưỡng 30 ngày được cố định trong code

**Tác động:**
- Nhân viên có thâm niên trong "vùng trống" giữa 2 chính sách → nhận chính sách thấp nhất → lương tính sai
- `isOfficial = true` khi >= 30 ngày: nhân viên thử việc 30 ngày đủ điều kiện "chính thức"?

**Đề xuất:**  
Thêm kiểm tra khoảng trống và ghi cảnh báo tương tự như chồng chéo. Ghi tài liệu về ngưỡng 30 ngày cho `isOfficial`.

---

### AUDIT-022

**Mức độ nghiêm trọng:** Thấp  
**Mô-đun:** Lược đồ — Thiếu ràng buộc toàn vẹn dữ liệu quan trọng

**Mô tả:**  
Nhiều bảng quan trọng thiếu ràng buộc UNIQUE hoặc NOT NULL tại cấp cơ sở dữ liệu, phụ thuộc vào kiểm tra hợp lệ cấp ứng dụng:

| Bảng | Thiếu ràng buộc |
|------|-----------------|
| `revenue_records` | UNIQUE (date, branch_id) |
| `shopee_inventory_out` | UNIQUE (order_id, sku) |
| `payroll_records` | UNIQUE (employee_id, month) |
| `supplier_debts` | Thiếu khóa ngoại về `suppliers` (chỉ có văn bản `supplier_id`) |

**Bằng chứng:**
- File: `supabase_setup.sql` — xem qua, không thấy các ràng buộc trên

**Tác động:**
- Lỗi ứng dụng hoặc tranh chấp có thể tạo bản ghi trùng
- Không có lưới an toàn cấp cơ sở dữ liệu → phụ thuộc 100% vào logic ứng dụng

**Đề xuất:**  
Thêm ràng buộc UNIQUE và ràng buộc khóa ngoại vào `supabase_setup.sql`. Chạy di chuyển.

---

## Tóm tắt theo mô-đun

| Mô-đun | Số phát hiện | Nghiêm trọng | Cao | Trung bình | Thấp |
|--------|-------------|--------------|-----|-----------|------|
| **Tồn kho** | 4 | 2 (001, 003) | 2 (002, 004) | 0 | 0 |
| **Đơn hàng** | 5 | 0 | 3 (005, 006, 007, 009) | 2 (008) | 0 |
| **Công nợ** | 2 | 0 | 0 | 2 (010, 011) | 0 |
| **Doanh thu/Lợi nhuận** | 3 | 0 | 1 (012) | 2 (013, 020) | 0 |
| **Shopee** | 3 | 1 (014) | 2 (015, 016) | 0 | 0 |
| **Báo cáo** | 3 | 0 | 1 (017) | 1 (018) | 1 (019) |
| **Lương** | 1 | 0 | 0 | 1 (021) | 0 |
| **Lược đồ** | 1 | 0 | 0 | 0 | 1 (022) |
| **TỔNG** | **22** | **3** | **9** | **8** | **2** |

---

## TOP 20 RỦI RO — Sắp xếp theo tác động vận hành thực tế

| # | Phát hiện | Mức độ | Ảnh hưởng đến | Mức độ tác động vận hành |
|---|-----------|--------|--------------|--------------------------|
| 1 | **AUDIT-014** — Shopee loại trùng mất dữ liệu đơn nhiều SKU | Nghiêm trọng | Doanh thu, Lợi nhuận | **Rất cao** — mọi đơn Shopee nhiều sản phẩm bị mất mục → doanh thu/giá vốn thấp hơn thực tế |
| 2 | **AUDIT-003** — Tranh chấp bán hàng đồng thời | Nghiêm trọng | Tồn kho | **Rất cao** — giờ cao điểm, nhiều nhân viên → tồn kho âm không phát hiện ngay |
| 3 | **AUDIT-001** — Phương pháp giá cố định: tài liệu sai | Nghiêm trọng | Tồn kho, Lợi nhuận | **Rất cao** — lập trình viên mới "sửa theo tài liệu" → phá vỡ toàn bộ giá vốn kho hàng |
| 4 | **AUDIT-012** — Biểu thức chính quy ngăn tính đôi lỗi | Cao | Lợi nhuận | **Cao** — chi phí tính đôi → lợi nhuận tháng sai → quyết định kinh doanh sai |
| 5 | **AUDIT-006** — Cập nhật doanh thu sai ngày khi trả hàng | Cao | Doanh thu, Báo cáo | **Cao** — doanh thu ngày bán không giảm, ngày trả âm → phân tích theo ngày méo |
| 6 | **AUDIT-017** — Giá vốn lịch sử dự phòng về giá hiện tại | Cao | Lợi nhuận, Báo cáo | **Cao** — báo cáo lợi nhuận quá khứ sai khi giá vốn thay đổi |
| 7 | **AUDIT-015** — Shopee đồng bộ tuần tự, lỗi một phần | Cao | Doanh thu Shopee | **Cao** — trường phí sai → lợi nhuận Shopee tính không đúng |
| 8 | **AUDIT-007** — Trả hàng không trừ totalSpent | Cao | Công nợ, Hạng KH | **Trung bình-Cao** — hạng khách hàng thổi phồng, tích lũy theo thời gian |
| 9 | **AUDIT-004** — Giá vốn lịch sử từ giao dịch thiếu nextImportPrice | Cao | Lợi nhuận | **Trung bình-Cao** — dữ liệu cũ trước khi sửa → giá vốn báo cáo sai |
| 10 | **AUDIT-009** — Hai luồng ghi tồn kho (RPC vs REST) | Cao | Tồn kho | **Trung bình-Cao** — nếu cả hai luồng: tồn kho trừ đôi |
| 11 | **AUDIT-002** — Phương pháp giá vốn ở localStorage | Cao | Tồn kho | **Trung bình** — nhiều thiết bị dùng phương pháp khác → importPrice không nhất quán |
| 12 | **AUDIT-005** — Doanh số nhân viên không khôi phục | Cao | Lương | **Trung bình** — lương nhân viên có thể cao hơn thực tế một số trường hợp hiếm |
| 13 | **AUDIT-013** — Định dạng ngày en-CA vs sv-SE | Trung bình | Doanh thu, Báo cáo | **Trung bình** — môi trường thiếu ICU → khóa ngày không khớp → doanh thu không hợp nhất |
| 14 | **AUDIT-020** — Công thức lợi nhuận gộp không nhất quán | Trung bình | Lợi nhuận | **Trung bình** — rủi ro khi sửa code sau này |
| 15 | **AUDIT-008** — inferIsReturnOrder dương tính giả | Trung bình | Đơn hàng, Báo cáo | **Trung bình** — đơn hàng bị nhầm loại → sai thống kê |
| 16 | **AUDIT-016** — Bot hết thời gian chờ 10s không thử lại | Trung bình | Doanh thu Shopee | **Trung bình** — 1 cửa hàng mất dữ liệu, không cảnh báo rõ |
| 17 | **AUDIT-011** — Nhập hàng nhanh không có nhà cung cấp | Trung bình | Công nợ NCC | **Trung bình** — công nợ nhà cung cấp thiếu nếu hay dùng |
| 18 | **AUDIT-018** — mergeBy doanh thu key='date', thiếu UNIQUE | Trung bình | Báo cáo | **Thấp-Trung bình** — nếu có bản ghi trùng → tổng sai |
| 19 | **AUDIT-010** — Hạng khách hàng không tự động | Trung bình | Công nợ, Marketing | **Thấp** — vận hành thủ công có thể chấp nhận |
| 20 | **AUDIT-021** — Khoảng trống chính sách trong tính lương | Trung bình | Lương | **Thấp** — chỉ ảnh hưởng khi cấu hình chính sách có khoảng trống |

---

## Phần chưa xác minh (CẦN XÁC MINH THÊM)

Các điểm sau cần xác minh thêm bằng cách đọc mã nguồn còn lại:

| # | Vấn đề | File cần đọc |
|---|--------|-------------|
| ANV-001 | `updateSurgical` gọi REST hay RPC? → ảnh hưởng AUDIT-003, AUDIT-009 | `services/apiService.ts` |
| ANV-002 | `processReturnOrder`: `item.total` có bao gồm giảm giá dòng không? | `types/index.ts` — định nghĩa `POSOrderItem.total` |
| ANV-003 | Nhập hàng nhanh (`useGoodsPurchase.ts`) có ghi `nextImportPrice` vào mục không? | `components/pos/useGoodsPurchase.ts` |
| ANV-004 | `payroll_records` có ràng buộc UNIQUE (employee_id, month) không? | Supabase Dashboard hoặc `supabase_setup.sql` đầy đủ hơn |
| ANV-005 | Kiểm kho (OP-005) có cập nhật `nextImportPrice` hay không? | `components/inventory/GoodsInventoryCheck.tsx` |

---

*AUDIT_REPORT.md — Hoàn thành 2026-06-19. Tổng: 22 phát hiện, 3 Nghiêm trọng, 9 Cao, 8 Trung bình, 2 Thấp.*
