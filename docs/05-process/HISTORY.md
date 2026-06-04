# HISTORY.md — Nhật ký phiên làm việc

> Chỉ ghi việc đã **hoàn thành**. Không ghi kế hoạch, không ghi TODO.
> Agent cuối ca → thêm phiên mới lên **đầu file**.

---

### 2026-06-04 — Performance fix: EndOfDayReport

- `EndOfDayReport.tsx`: Gộp 9 useMemo riêng lẻ thành 1 pass duy nhất (salesOrders, returnOrders, salesSummary, returnSummary, salesDiscount, returnRefundTotal, returnTraHang, totalAllOrders, allQty)
- `EndOfDayReport.tsx`: Fix `calculateStaffSalesForDate` nhận `filteredOrders` thay vì toàn bộ `orders` (tránh scan all-time orders mỗi khi mở modal)
- `EndOfDayReport.tsx`: Wrap `nowStr`, `dateStr` trong `useMemo` — tránh tính lại khi expand/collapse
- `EndOfDayReport.tsx`: Xoá `allQty` tính lại thừa bên trong `handlePrint`

---

### 2026-06-04 — Performance fixes: giảm lag trang Hàng hóa, POS, Dashboard

- `useGoodsFilters.ts`: Fix O(n²) supplier filter — thêm `parentProductSupplierMap` (Map<parentId, Set<supplierName>>) thay vì `products.some()` lồng; tách `parentSkuFallback` ra useMemo riêng; thêm `parentProductSupplierMap` vào deps
- `POSCart.tsx`: Thêm `useDeferredValue` cho `exchangeSearch` — input không bị block khi filter 12K+ products
- `POSComputer.tsx`: Định nghĩa `EMPTY_SPLIT_PAYMENT` constant ngoài component — tránh tạo object mới mỗi render làm re-render POSCheckout
- `useAppData.ts`: `breakEvenAnalysis` filter trước (30 ngày) rồi sort 30 records, thay vì sort toàn bộ 365+ records
- `App.tsx`: Fix `silentSync` event listener — dùng `useRef` pattern, listener chỉ đăng ký 1 lần thay vì add/remove mỗi khi silentSync đổi reference
- Files: `components/pos/useGoodsFilters.ts`, `components/pos/POSCart.tsx`, `components/pos/POSComputer.tsx`, `hooks/useAppData.ts`, `App.tsx`

---

### 2026-06-04 — Audit & fix toàn bộ logic tính toán (21 issues)

**Audit phát hiện:**
- Quét 9 file cốt lõi: `businessLogic.revenue.ts`, `businessLogic.payroll.ts`, `businessLogic.inventory.ts`, `reportCalculations.ts`, `posOrderService.ts`, `POSComputer.tsx`, `useGoodsPurchase.ts`, `dataMapper.ts`, `usePurchaseFormState.ts`
- 21 vấn đề: 10 Critical, 6 Medium, 3 Minor (sau kiểm tra kỹ thực tế: giảm còn 11 bug thực + 10 non-bug)

**Đã fix:**

*Critical bugs:*
- `reportCalculations.ts`: COGS map loại sản phẩm importPrice=0 → giữ lại để phân biệt "biết giá vốn = 0" vs "không tìm thấy"
- `reportCalculations.ts`: Discount `||` → `null check` tại 2 hàm (`getSalesHorizontalRowsByDate`, `getSalesInvoiceDiscountRowsByDate`) — tránh tính lại khi discount rõ ràng = 0
- `businessLogic.payroll.ts`: Thưởng Tết extra days vượt ranh giới tháng — dùng toàn bộ `attendance` thay vì `monthAttendance`
- `businessLogic.revenue.ts`: BEP = 0 khi biến phí ≥ doanh thu → thêm `canBreakEven` flag, `safetyMargin` = 0 khi không hòa vốn được
- `businessLogic.payroll.ts` (regression): Ngày lễ format `MM-DD` không match so sánh `YYYY-MM-DD` → hỗ trợ cả 2 format

*Medium risks:*
- `businessLogic.revenue.ts` `calculateSeasonalityAnalysis`: ABC/BCG hardcode "C"/"Dog" → tính thực từ cumulative revenue (ABC) và tăng trưởng vs thị phần tương đối (BCG)
- `types.ts` + `POSComputer.tsx`: Split payment không lưu breakdown → thêm field `splitPayments` vào `POSOrder`, lưu khi `useSplitPayment = true`
- `businessLogic.revenue.ts`: Salary keyword match bằng text thô → normalize NFD trước khi so sánh (3 hàm: `calculateFinancialHealthScore`, `auditFinancials`, `calculateExpenseAnalysis`)
- `businessLogic.payroll.ts` `determineCurrentPolicy`: thêm cảnh báo console.warn khi policy ranges chồng lên nhau

*Minor:*
- `businessLogic.payroll.ts` `calculateSeniority`: thêm comment giải thích tại sao +1 ngày
- `types.ts` + `POSComputer.tsx`: qty warning threshold 10000 → dùng `inventorySettings?.maxQtyWarning ?? 10000`

**Đã xác nhận không phải bug (sau kiểm tra code thực tế):**
- OT chia 60: đúng vì field `hours` lưu phút (confirmed bởi user)
- Holiday bonus daily salary: đúng vì `baseSalary` = lương/ca (11h), không phải lương/giờ
- processPlaceOrder rollback: đúng logic (rollback handler push sau khi step thành công)
- processReturnOrder `returnsValue`: đã được cập nhật đúng (line 370-373)
- Violation regex `/[̀-ͯ]/g`: hoạt động đúng (verified bằng node test)

- Files: `src/lib/reportCalculations.ts`, `src/lib/businessLogic.payroll.ts`, `src/lib/businessLogic.revenue.ts`, `types.ts`, `components/pos/POSComputer.tsx`

---

### 2026-06-04 — UI Refactor Phase 1+2+3: Design System & chuẩn hóa toàn app

**Phase 1 — Foundation**
- `tailwind.config.js`: thêm `fontSize.2xs` (10px), `colors.primary/muted/highlight`, `boxShadow.card/panel/dropdown/modal`, `zIndex.dropdown/sticky/overlay/modal/toast/tooltip`
- `components/shared/ui/Button.tsx`: fix `secondary` variant (nền trắng thay slate-600), `font-normal` → `font-medium`, `xs` size dùng `text-2xs`
- `components/shared/ui/Modal.tsx`: `z-50` → `z-modal`, `shadow-2xl` → `shadow-modal`, overlay chuẩn `bg-slate-950/60 backdrop-blur-sm`
- `components/shared/ui/Badge.tsx`: `text-[10px]` → `text-2xs`
- 26 file: thay toàn bộ `bg-blue-600/700` → `bg-indigo-600/700` (thống nhất primary color về indigo)

**Phase 2 — Consistency**
- 208 file components: thay 1,131 arbitrary font sizes (`text-[10px/11px/12px/13px]` → `text-2xs/xs/sm`)
- 88 chỗ z-index loạn (`z-[100..10000]`) → tokens `z-modal/z-toast/z-dropdown`
- 401 chỗ `font-black` → `font-semibold` (hạ font weight quá nặng cho labels)
- `components/shared/ui/Card.tsx`: cập nhật shadow prop dùng tokens mới (`card/panel/dropdown/modal`)

**Phase 3 — Polish**
- Tạo mới `components/shared/ui/EmptyState.tsx` (2 sizes: default/compact, có icon/title/description/action)
- Tạo mới `components/shared/ui/Skeleton.tsx` (CSS animate-pulse thay framer-motion: TableSkeleton, CardSkeleton, SidebarSkeleton)
- 130 chỗ `transition-all` → `transition-colors` (43 file không có transform)
- `components/shared/ui/index.ts`: export thêm EmptyState, Skeleton và variants

- Files: `tailwind.config.js`, `components/shared/ui/Button.tsx`, `components/shared/ui/Modal.tsx`, `components/shared/ui/Badge.tsx`, `components/shared/ui/Card.tsx`, `components/shared/ui/EmptyState.tsx`, `components/shared/ui/Skeleton.tsx`, `components/shared/ui/index.ts`, + ~170 file components khác (class-only changes)

---

### 2026-06-01 — Tối ưu hiệu năng EndOfDayReport: giảm lag khi mở danh sách đơn

- `components/pos/EndOfDayReport.tsx`: memoize `allQty`, `methodSummaries` (stats theo PTTT), `orderDisplayMap` (time/staffName/qty/disc per order); xoá IIFE trong JSX; render Level 3 dùng lookup thay vì tính lại
- Files: `components/pos/EndOfDayReport.tsx`

---

### 2026-06-01 — Fix cột Khách hàng / Nhân viên / Thời gian trong EndOfDayReport

- `types.ts`: thêm `staffName?: string` vào POSOrder
- `services/dataMapper.ts`: map `staff_name` → `staffName`
- `routes/import.ts`: lưu tên thô vào `staffName` + thêm `staff_name` vào select/upsert của KiotViet invoice import
- `supabase_setup.sql`: ALTER TABLE pos_orders ADD COLUMN staff_name TEXT (cần chạy thủ công trên Dashboard)
- `components/pos/EndOfDayReport.tsx`: thêm helpers `fmtTime` (safe parse) + `fmtCustomer`; Nhân viên dùng `order.staffName || staffNameMap.get(staffId)` cả preview lẫn print
- Files: `types.ts`, `services/dataMapper.ts`, `routes/import.ts`, `supabase_setup.sql`, `components/pos/EndOfDayReport.tsx`

---

### 2026-06-01 — Fix hàm in EndOfDayReport: 14 cột / 3 cấp nhóm KiotViet

- `components/pos/EndOfDayReport.tsx`: viết lại hoàn toàn `handlePrint` phần `detailTables` — từ format cũ 11 cột lên 14 cột KiotViet (Mã chứng từ, Khách hàng, Nhân viên, Thời gian, SL, Tổng tiền hàng, Giảm giá, Doanh thu, Thu khác, VAT, Làm tròn, Phí trả hàng, Thực thu, Ghi nợ); bổ sung 3 cấp nhóm khi in: Hóa đơn (tất cả) → PTTT (TM/CK/Ví) → từng đơn; Trả hàng riêng biệt; summary box cuối trang
- Files: `components/pos/EndOfDayReport.tsx`

---

### 2026-06-01 — Thêm refund_amount + thiết kế lại EndOfDayReport

- `types.ts`: thêm `refundAmount?: number` vào POSOrder
- `services/dataMapper.ts`: map `refund_amount` → `refundAmount`
- `supabase_setup.sql`: thêm `ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0` (cần chạy thủ công trên Dashboard)
- `routes/import.ts`: KiotViet đơn trả → `refund_amount = |finalAmount|`
- `components/pos/POSComputer.tsx`: tự tính `refundAmount = amountToPayCustomer`
- `components/pos/EndOfDayReport.tsx`: bảng Chi tiết 10 cột mới (Giảm giá, Dịch vụ, Trả hàng, Tiền trả khách); bảng Tổng quát gộp thành 1 bảng duy nhất 9 cột; fix công thức grossRevenue và netActual
- Files: `types.ts`, `services/dataMapper.ts`, `supabase_setup.sql`, `routes/import.ts`, `components/pos/POSComputer.tsx`, `components/pos/EndOfDayReport.tsx`

---

### 2026-05-31 — Fix bug timezone: đơn sáng sớm bị lưu nhầm ngày hôm trước

- `routes/import.ts` hàm `excelDateToLocalIsoDateTime`: nhánh `raw instanceof Date` đổi từ `getUTC*` sang `getFullYear/getMonth/getDate/getHours/getMinutes/getSeconds` (local getters)
- Nguyên nhân: XLSX.js tạo Date object theo local timezone (Vietnam +7), dùng getUTC* đọc sai ngày với đơn đặt trước 07:00 sáng
- Triệu chứng phát hiện: đơn 64350 (đơn đầu ngày 31/05) xuất hiện ở báo cáo 30/05 thay vì 31/05; doanh thu thiếu 399,000đ so với KiotViet
- Files: `routes/import.ts`

---

### 2026-05-31 — Import hoá đơn KiotViet: khách hàng + đơn hàng + doanh thu

- `routes/import.ts`: thêm route `POST /api/import/kiotviet-invoices` — nhận file "Danh sách chi tiết hoá đơn" từ trang Hoá đơn KiotViet
- Parse: group by Mã hóa đơn → pos_orders với line items; extract khách hàng unique → pos_customers; aggregate theo tháng → revenue_records
- Tự động tạo khách mới (tên, SĐT, email, địa chỉ), upsert đơn hàng, upsert doanh thu tháng
- `MigrationTab.tsx`: thêm button "Hoá đơn" (badge Khuyên dùng) lên trên button khách hàng
- Files: `routes/import.ts`, `components/settings/tabs/MigrationTab.tsx`

---

### 2026-05-31 — Tự động tạo khách hàng khi import doanh thu KiotViet

- `routes/import.ts` route `kiotviet-revenue` format "theo lợi nhuận": đọc thêm col15 (Tên KH) + col16 (Mã KH) từ mỗi dòng
- Sau khi upsert pos_orders: tự động insert khách chưa có vào `pos_customers` (id = stableUuid từ mã KH, phone = '')
- Response trả thêm field `newCustomers` — số khách mới tạo trong lần import
- Files: `routes/import.ts`

---

### 2026-05-31 — Đồng bộ số liệu khách hàng từ pos_orders

- `routes/data.ts`: thêm endpoint `POST /api/customers/sync-from-orders` — paginate toàn bộ `pos_orders`, aggregate `totalSpent`/`lastVisit`/`points` theo `customer_id`, batch update `pos_customers`
- `MigrationTab.tsx`: thêm section "Đồng bộ số liệu khách hàng từ đơn hàng" với button + banner kết quả
- Auto-update đơn mới: đã hoạt động sẵn trong `POSComputer.tsx` (incremental update sau mỗi đơn)
- Sau khi chạy sync 1 lần: dữ liệu khách hàng sẽ lấy từ `pos_orders` làm nguồn chính, không phụ thuộc KiotViet import nữa
- Files: `routes/data.ts`, `components/settings/tabs/MigrationTab.tsx`

---

### 2026-05-31 — Align total_gross_revenue theo format KiotViet

- `routes/import.ts` dòng 925: đổi `total_gross_revenue = totalGross` → `net_revenue + ABS(discount)`; đổi `returns_value = returnsGross` → `0`
- Lý do: KiotViet UI định nghĩa "Tổng tiền hàng" = sales - returns (đã trừ trả hàng), còn app trước đó lưu gross sales only + returns riêng → hiển thị khác nhau dù net revenue bằng nhau
- Kết quả: import file "theo thời gian" mới từ KiotViet sẽ cho total_gross_revenue khớp KiotViet UI
- Data cũ: cần chạy SQL thủ công trên Supabase Dashboard: `UPDATE revenue_records SET total_gross_revenue = net_revenue + ABS(discount), returns_value = 0 WHERE returns_value > 0`
- Files: `routes/import.ts`

---

### 2026-05-31 — Fix finalAmount âm cho đơn trả hàng app-native

- `POSComputer.tsx`: lưu `finalAmount: -finalReturnAmount` (âm, nhất quán với KiotViet format)
- `POSComputer.tsx` receipt: dùng `Math.abs(lastOrder.finalAmount)` để hiển thị đúng
- `posOrderService.ts` processReturnOrder: cập nhật công thức revenue dùng `+ returnOrder.finalAmount` (vì giờ âm)
- `CustomerListPage.tsx`: `cur.returned += Math.abs(o.finalAmount)` cho đơn trả
- `AnalysisCustomersClassifyPage.tsx`: `c.returnValue += Math.abs(o.finalAmount)`
- `ChatInterface.tsx`: `totalReturns = Math.abs(o.finalAmount)`
- Kết quả: `SUM(pos_orders.final_amount)` giờ cho đúng net revenue kể cả đơn trả app-native
- Files: `POSComputer.tsx`, `posOrderService.ts`, `CustomerListPage.tsx`, `AnalysisCustomersClassifyPage.tsx`, `ChatInterface.tsx`

### 2026-05-31 — Bảng product_cost_history: lịch sử giá nhập độc lập với KiotViet

- Thêm bảng `product_cost_history` (sku, product_id, import_price, effective_date, source) vào `supabase_setup.sql` với indexes và RLS
- `routes/data.ts` — `applyInventoryTransactionFallback`: khi lưu phiếu nhập (type='Import') tự động ghi giá nhập vào `product_cost_history`
- `routes/data.ts` — endpoint `POST /api/analytics/backfill-cost-history`: đọc toàn bộ inventory_transactions cũ, backfill vào history (chạy 1 lần)
- `routes/data.ts` — `recalculate-cogs`: ưu tiên lookup từ history (giá gần nhất trước ngày bán) → fallback sang giá hiện tại
- `MigrationTab.tsx`: thêm section "Khởi tạo lịch sử giá nhập" với button và banner kết quả
- Files: `supabase_setup.sql`, `routes/data.ts`, `components/settings/tabs/MigrationTab.tsx`

### 2026-05-31 — Lưu importPrice vào pos_orders.items khi bán hàng

- Thêm `importPrice?: number` vào interface `POSOrderItem` trong `types.ts`
- `addToCart` trong `POSComputer.tsx`: lưu `importPrice: product.importPrice` vào cart item ngay lúc thêm vào giỏ
- `calculateOrderCogs` trong `posOrderService.ts`: ưu tiên `item.importPrice` đã lưu, fallback sang `pos_products.importPrice` hiện tại cho item cũ
- Kết quả: COGS đơn hàng mới sẽ luôn đúng dù giá nhập thay đổi sau này
- Files: `types.ts`, `components/pos/POSComputer.tsx`, `services/posOrderService.ts`

### 2026-05-31 — Import "theo lợi nhuận" toàn bộ lịch sử + dọn dẹp DB

- Import thành công "Báo cáo bán hàng theo lợi nhuận" từng năm 2023–2026 → COGS trong revenue_records giờ lấy từ KiotViet (giá vốn thực tế tại thời điểm bán)
- Phát hiện và hướng dẫn xóa 2 monthly records cũ còn sót gây đếm kép: 2025-01-31 (996M→đúng) và 2026-05-31 (289M→đúng)
- Fix import route purchase-details: đổi từ chỉ số cứng sang colMap theo tên cột → không bị ảnh hưởng khi KiotViet thêm cột
- Auto-recalculate COGS: chỉ update total_cogs khi = 0, không ghi đè data KiotViet đã import

### 2026-05-31 — Thêm nút Import KiotViet vào trang Nhập hàng

- Thêm nút "Import KiotViet" vào toolbar `PurchaseOrdersPage.tsx`: click → chọn file Excel → gọi `/api/import/kiotviet-purchase-details` → clear cache → hiện banner kết quả (loading/done/error)
- File: `components/purchase/PurchaseOrdersPage.tsx`

### 2026-05-31 — Chuyển nguồn Ma trận tài chính sang pos_orders

- Thêm endpoint `POST /api/analytics/financial-matrix` vào `routes/data.ts`: paginate toàn bộ 68K pos_orders phía server, aggregate theo năm (totalGrossRevenue, discount, returnsValue, netRevenue, totalCogs, grossProfit), trả về JSON
- Cập nhật `AnalysisFinancialMatrixPage.tsx`: bỏ tính từ `data.revenue`, thay bằng gọi API mới khi `timeContext` thay đổi; thêm loading spinner; `years` lấy từ API response
- Fix partial upsert `routes/import.ts`: import "theo thời gian" không ghi đè `total_cogs`/`gross_profit` — chỉ update các cột có trong format đó
- Phát hiện: `pos_orders.items` không lưu `importPrice` → COGS vẫn tra `pos_products.import_price` hiện tại; 21 sản phẩm `{DEL}` thiếu giá nhập gây gap 9.5M với KiotViet tháng 5/2025
- Files: `routes/data.ts`, `components/analysis/AnalysisFinancialMatrixPage.tsx`, `routes/import.ts`

### 2026-05-31 — Fix Ma trận tài chính: returns_value, gross revenue, và giá vốn

- Điều tra root cause: `returns_value = 0` hardcode trong `routes/import.ts`; `total_gross_revenue` thấp hơn KiotViet vì returns bị hấp thụ vào gross khi import "theo lợi nhuận"; 2026 sai vì dùng posOrders (totalAmount mapping sai)
- Import dữ liệu lịch sử: xuất file "báo cáo bán hàng theo thời gian" (theo tháng) từ KiotViet → 39 monthly records với gross/discount/returns/net đúng
- Cleanup DB: xóa ~1000 daily records cũ (chỉ giữ last-day-of-month records); xóa 3 records corrupt date; clear IndexedDB cache trình duyệt
- Fix code `AnalysisFinancialMatrixPage.tsx`: bỏ posOrders path, dùng revenue_records cho tất cả các năm → 2026 khớp KiotViet
- Fix `routes/import.ts`: nhận format "theo thời gian" (headers[6]="Giá trị trả"), parse "MM-YYYY" date, fix returns_value từ 0 → đúng; fix "theo lợi nhuận" tách gross bán vs gross trả
- Fix `useRevenueLedger.ts`: nhận file transaction-level, fix công thức netRevenue với Math.abs
- Tính giá vốn: UPDATE revenue_records.total_cogs từ pos_orders × pos_products.import_price (trừ đơn trả); sai số 0.19% do 1 sản phẩm thiếu giá nhập
- Kết quả: Ma trận tài chính 2023–2026 khớp KiotViet (tổng tiền hàng, giảm giá, trả hàng, doanh thu thuần, giá vốn, lợi nhuận gộp)
- Files: `routes/import.ts`, `components/analysis/AnalysisFinancialMatrixPage.tsx`, `components/revenue/useRevenueLedger.ts`

### 2026-05-31 — Fix giá vốn sai trong trang Ma trận tài chính

- Điều tra root cause: `returns_value = 0` hardcode trong `routes/import.ts` khiến Ma trận tài chính hiển thị doanh thu thấp hơn KiotViet từ năm 2024 trở đi (2023 đúng vì không có đơn trả)
- Fix `routes/import.ts`: nhận thêm file "Báo cáo bán hàng theo thời gian" (`headers[6] = "Giá trị trả"`), đọc daily totals từ dòng đầu mỗi ngày; sửa format "theo lợi nhuận" tách gross bán vs gross trả, lưu đúng `returns_value = d.returnsGross` thay vì 0
- Fix `useRevenueLedger.ts`: nhận dạng file transaction-level qua cột "Mã giao dịch", tránh cộng dồn daily totals × số đơn/ngày; ưu tiên "Doanh thu thuần" thay vì "Doanh thu"; lưu `returnsValue` dương; fix công thức netRevenue dùng `Math.abs` cho discount/returns
- Fix `AnalysisFinancialMatrixPage.tsx`: thêm `Math.abs` cho `returnsValue` tương tự discount
- Files: `routes/import.ts`, `components/revenue/useRevenueLedger.ts`, `components/analysis/AnalysisFinancialMatrixPage.tsx`

---

### 2026-05-31 — Fix giá vốn sai trong trang Ma trận tài chính

- Phát hiện lỗi: `AnalysisFinancialMatrixPage.tsx` tính giá vốn (COGS) cho các năm có `posOrders` bằng cách tra `posProducts.importPrice` hiện tại — dẫn đến COGS cao hơn KiotViet khi giá nhập sản phẩm đã thay đổi
- Fix: thay `calcOrderCogs` bằng `data.revenue.totalCogs` (từ KiotViet sync, lưu giá vốn thực tế lúc bán) với deduplication theo ngày
- Xóa `productLookup` useMemo và `calcOrderCogs` useCallback (không còn cần thiết)
- TypeScript clean (lỗi pre-existing ở `InventoryOutTab.tsx` không liên quan)
- Files: `components/analysis/AnalysisFinancialMatrixPage.tsx`

---

### 2026-05-29 — Fix WebSocket shop2 bị kẹt "đang kết nối" + refactor ShippingOrders all-shops view

- Viết lại `ShippingOrders.tsx` để hiển thị đơn từ TẤT CẢ shop cùng lúc (không cần chọn shop): dùng `ordersByShop[][]`, `connStates[]`, `loadings[]` per-shop; thêm cột "Shop" với badge màu
- Fix WebSocket shop2 bị stuck ở trạng thái "đang kết nối": cleanup `useEffect` giờ null ALL handlers (`onopen/onmessage/onclose/onerror`) + null `wsRefs.current[i]` trước khi close, ngăn stale ref gây early-return sai trong React StrictMode
- Fix early-return trong `connect()`: kiểm tra cả `CONNECTING` (0) lẫn `OPEN` (1) thay vì chỉ `OPEN` như trước
- TypeScript clean (0 errors)
- Files: `components/orders/ShippingOrders.tsx`

### 2026-05-29 — Xoá cấu hình % phí sàn + sửa Shopee Monitor + thêm hỗ trợ 2 shop

- Xoá hoàn toàn section "Cấu hình phí sàn Shopee (%)" khỏi `CostsTab.tsx` — thay bằng block read-only hiển thị % phí thực tế tính từ đơn đã giao
- Xoá 6 trường `platformFeePercent/paymentFeePercent/freeshipExtraPercent/affiliateFeePercent/taxPercent/adsTaxPercent` khỏi `ShopeeCostConfig` trong `types.ts` và `defaultData.ts`
- Cập nhật `useShopeeInventoryOut.ts`: bỏ tính phí % khi import, bỏ `personalIncomeTax`, bỏ `adsTax` fallback; fix bug `r.personalIncomeTax` bị trừ sai trong secondary calc
- Fix `InventoryOutTab.tsx` dòng 219, 223–226: dùng `shopeeTotals` thực tế thay vì `shopeeCosts.%` đã xoá
- Cập nhật `RevenueManager.tsx`: truyền `shopeeInventoryOut` prop vào `<CostsTab />`
- Fix `better-sqlite3` binary không chạy được trên Node.js v24.15.0 (node-v137): rebuild `npm rebuild better-sqlite3` trong `/Users/apple/shopee-monitor/`
- Fix TELEGRAM 409 Conflict: tăng retry delay từ 10s → 35s trong `telegramCommands.js`
- Bật shop 2 (`giaydepphucsang`): đổi `API_ENABLED=false` → `true` trong `.env.shop2` và `ecosystem.config.js`
- Khởi động lại PM2: `shopee-shop1` (port 3001) + `shopee-shop2` (port 3002) đang online
- Viết lại `ShippingOrders.tsx` hỗ trợ 2 shop: thêm `SHOPS` array, `activeShopIdx` state + `activeShopIdxRef` ref, shop selector UI, kết nối WebSocket độc lập theo shop
- TypeScript clean (0 errors) sau toàn bộ thay đổi
- Files: `types.ts`, `constants/defaultData.ts`, `components/revenue/CostsTab.tsx`, `components/revenue/useShopeeInventoryOut.ts`, `components/revenue/InventoryOutTab.tsx`, `components/RevenueManager.tsx`, `components/orders/ShippingOrders.tsx`, `/Users/apple/shopee-monitor/src/telegramCommands.js`, `/Users/apple/shopee-monitor/ecosystem.config.js`, `/Users/apple/shopee-monitor/.env.shop2`

---

### 2026-05-29 — Import toàn bộ đơn hàng Shopee vào Supabase

- Tạo script `scripts/import_shopee.py` để bulk-import dữ liệu Shopee từ `shopee_exports/Shop1` (→ "Shopee 1") và `shopee_exports/Shop2` (→ "Shopee 2")
- Import thành công 1,982 records đơn hàng có đầy đủ SKU (tháng 9/2024 đến nay)
- Import thêm 517 records đơn hàng giai đoạn đầu (tháng 6–8/2024) bằng cách dùng `tenphanloaihang` làm fallback SKU
- Fix bug `fetch_existing_keys()` chỉ lấy 1,000 rows (Supabase default cap) → thêm pagination với offset
- Xóa 982 duplicates phát sinh do bug trên bằng SQL `ROW_NUMBER() OVER (PARTITION BY order_id, sku)`
- Kết quả cuối: **2,499 unique records** trong `shopee_inventory_out`, 0 duplicate
- Files: `scripts/import_shopee.py`

---

### 2026-05-29 — Fix toàn bộ 20 lỗi (phần 2 — Task #15 → #17)

- **Task #15 — Payroll holiday + phạt**: Sửa so sánh ngày lễ dùng `MM-DD` thay vì `YYYY-MM-DD` (line 208 businessLogic.payroll.ts); sửa parse tiền phạt dùng `join('')` nối tất cả số → dùng pattern `k-suffix` hoặc lấy số cuối cùng
- **Task #15 — Ngày lễ không tính công**: Sửa `workingDays` chỉ đếm `'Present'` → thêm `'Holiday'` (ngày nghỉ lễ quy định vẫn hưởng lương đầy đủ)
- **Task #16 — Break-even slice(-30) unsorted**: Sửa `data.revenue.slice(-30)` → sort theo ngày trước khi slice, tránh lấy nhầm 30 bản ghi ngẫu nhiên thay vì 30 ngày gần nhất — `hooks/useAppData.ts`
- **Task #16 — Double-count payroll trong health score**: `calculateFinancialHealthScore` và `auditFinancials` cộng `totalPayroll` + salary-ledger → sửa dùng `payrollModuleTotal > 0 ? payrollModuleTotal : ledgerSalaryTotal`; lọc salary-category ra khỏi `nonSalaryExpenses` — `businessLogic.revenue.ts`
- **Task #17 — COGS double-count**: Lọc category "giá vốn/cogs" khỏi `filteredExpenses` trong `calculateExpenseAnalysis`, tránh cộng hai lần với `revenue.totalCogs` — `businessLogic.revenue.ts`
- **Task #17 — Timezone UTC bug**: Thay `toISOString().slice(0,7)` và `toISOString().split('T')[0]` bằng `toLocaleDateString('sv-SE')` — `businessLogic.revenue.ts`
- **Task #17 — Excel serial date off-by-1**: `Math.round` → `Math.floor` (bỏ phần giờ) + dùng `getUTCFullYear/Month/Date` thay vì local methods — `businessLogic.core.ts`
- **Task #17 — Excel header row sai**: Sửa break condition `matchCount >= 2` ghi đè `headerRowIndex` sau khi đã tìm được hàng tốt hơn → chỉ `break` không gán lại — `businessLogic.core.ts`
- **Task #17 — O(n²) stock validation**: Thay `products.find()` bên trong `cart.find()` bằng `productById.get()` (Map O(1)) — `POSComputer.tsx`
- **Task #17 — Offline queue full scan**: Thay `store.getAll()` bằng `dataKeyIndex.getAll(op.dataKey)` để chỉ scan records cùng key — `posOfflineQueue.ts`
- **Task #17 — Rollback step 1 trống**: Implement rollback xóa order bằng `updateSurgical([{ key: 'posOrders', item: { id }, isDelete: true }])` — `posOrderService.ts`
- Files: `businessLogic.payroll.ts`, `businessLogic.revenue.ts`, `businessLogic.core.ts`, `hooks/useAppData.ts`, `components/pos/POSComputer.tsx`, `services/posOfflineQueue.ts`, `services/posOrderService.ts`

---

### 2026-05-29 — Kiểm tra và fix trang danh sách hàng hoá / tồn kho

- Fix giá vốn bình quân sai khi nhập hàng có chiết khấu dòng: tính `effectiveUnitPrice = (qty × price − discount) / qty` trước khi gọi `calculateNextImportPrice` — `useGoodsPurchase.ts`
- Fix nhập hàng dùng surgical update thay vì full-array replace: thêm `onUpdateSurgical` vào `UseGoodsPurchaseArgs`, truyền từ `GoodsInventory` → loại bỏ race condition với POS bán hàng đồng thời
- Fix kiểm kho dùng surgical update thay vì full-array replace: thêm `onUpdateSurgical` vào `UseGoodsAuditArgs`, cùng cơ chế như nhập hàng
- Fix bộ lọc "Sắp hết" bao gồm sản phẩm `stock = 0`: đổi `stock <= minStock` → `stock > 0 && stock <= minStock` tại `useGoodsFilters.ts` (cả `lowStockProducts` lẫn filter candidate)
- Fix `getNextSKUNumber` dùng `Math.max(...array)` → `.reduce()` để tránh call stack overflow khi số lượng SKU lớn — `businessLogic.inventory.ts`
- Files: `useGoodsPurchase.ts`, `useGoodsAudit.ts`, `useGoodsFilters.ts`, `GoodsInventory.tsx`, `src/lib/businessLogic.inventory.ts`

---

### 2026-05-29 — Fix thêm 3 lỗi POS sau kiểm tra toàn diện

- Fix CRITICAL: Mobile `POSReceiptModal` `onClose` cũng bị lỗi khóa checkout — đồng bộ với desktop: gọi `handleFinishOrder()` + `setShowCheckoutSheet(false)`
- Fix DATA: Split payment không block thanh toán khi tổng < `netPayable` — thêm validation trong `handleCheckout` trả về lỗi và abort nếu thiếu tiền
- Fix UX: Phiếu in hiển thị `staffId` (ID nội bộ) thay vì tên nhân viên — tra `employees.find()` để lấy `name` thực
- Files: `components/pos/POSComputer.tsx`

---

### 2026-05-29 — Fix 3 lỗi quan trọng trong trang máy tính tiền (POSComputer)

- Fix CRITICAL: `POSReceiptModal` `onClose` → đổi từ `setShowReceiptModal(false)` thành `handleFinishOrder` — trước đây nhấn X sẽ khóa checkout vĩnh viễn đến khi refresh trang
- Fix performance: `handleCheckout` dòng 765 — dùng `cartItemMap` (Map) thay vì `cartWithSalesperson.find()` O(n) lồng trong `products.map()` — từ O(n²) xuống O(n+m)
- Fix data: `orderCode` dùng `Date.now().toString(36).slice(-5)` base-36 thay vì 6 chữ số thập phân — tránh trùng mã đơn (chu kỳ lặp từ ~16 phút → ~24 ngày)
- Files: `components/pos/POSComputer.tsx`

---

### 2026-05-29 — Audit hiệu năng toàn bộ + fix thêm 3 điểm O(n²)

- Fix `GoodsPurchaseForm.tsx`: thêm `useMemo` build Map `productById` — thay 2 lần `products.find()` per dòng trong JSX render bằng `productById.get()` O(1)
- Fix `posOrderService.ts`: thêm `buildProductMap()`, truyền Map vào `processPlaceOrder` + `processReturnOrder` thay vì Array — tránh O(items × products) khi lưu đơn hàng/trả hàng (quan trọng với nhập hàng bulk nhiều dòng)
- Kiểm tra toàn bộ event listeners: tất cả đều có cleanup trong useEffect ✅
- Kiểm tra memory leaks: WebSocket ShippingOrders có cleanup ✅, không có leak nào
- Kiểm tra GoodsTab chunking: đã dùng `requestIdleCallback` đúng cách ✅
- Files: `components/pos/GoodsPurchaseForm.tsx`, `services/posOrderService.ts`

### 2026-05-29 — Tối ưu hiệu năng thêm (sau fix mergeBy)

- Fix O(n²) trong `MatrixTab.tsx`: thay `productGroups.map(group => groupRevenue.filter(...))` trong JSX bằng `useMemo` pre-group theo `groupId` dùng Map — O(n) một lần thay vì O(groups × rows) mỗi render
- Thêm timeout 20 giây cho `fetchAllData` trong `hooks/useAppData.ts` bằng `Promise.race` — nếu Supabase không phản hồi, tự động throw để fallback về cached data thay vì loading vô tận
- Files: `components/revenue/MatrixTab.tsx`, `hooks/useAppData.ts`

### 2026-05-29 — Tích hợp Shopee Monitor + sửa lỗi trang treo khi refresh

- Bật API server shopee-monitor (`API_ENABLED=true` trong `.env.shop1`)
- Cập nhật `ecosystem.config.js`: thêm `env` block explicit để bypass dotenvx interference
- Xóa lock files cũ, cài `better-sqlite3@latest` (tương thích Node v24 với prebuilt binaries)
- Xóa process `shopee-bot` cũ gây Telegram 409 Conflict
- Viết lại `components/orders/ShippingOrders.tsx`: hiển thị đơn Shopee live từ monitor API (`localhost:3001`) qua WebSocket + REST, toast notification, auto-reconnect, bộ lọc theo trạng thái
- Sửa CSP trong `server.ts`: thêm `http://localhost:3001` và `ws://localhost:3001` vào `connectSrc`
- Sửa `App.tsx`: chỉ đăng ký service worker trong production (tránh block browser thread trong dev)
- **Sửa lỗi trang treo (Page Unresponsive) khi refresh**: Nguyên nhân là `mergeBy()` trong `services/dataMapper.ts` dùng `Array.findIndex` O(n²) — với hàng nghìn `posOrders`/`posProducts` gây block main thread nhiều giây. Đã thay bằng `Map` để O(n)
- Files: `shopee-monitor/ecosystem.config.js`, `shopee-monitor/.env.shop1`, `components/orders/ShippingOrders.tsx`, `server.ts`, `App.tsx`, `services/dataMapper.ts`

### 2026-05-26 — Hoàn thiện hệ thống nợ lương chuyển kỳ (carry-forward debt)

- Thêm `carryForwardDebt` vào `Employee`, `carryForwardDeduction` + `carryForwardDebtOut` vào `PayrollRecord` trong `types.ts`
- Tích hợp logic nợ chuyển kỳ vào `calculateEmployeePayroll` trong `src/lib/businessLogic.payroll.ts`
- Cập nhật `hooks/usePayrollState.ts` truyền `emp.carryForwardDebt` vào hàm tính lương
- Hiển thị dòng "Trừ Nợ Kỳ Trước" trong `components/payroll/SummaryTab.tsx`
- Hiển thị dòng "Trừ nợ kỳ trước" trên phiếu in `components/payroll/payrollPayslipPrint.ts`
- Cập nhật `components/PayrollManager.tsx`: khi chốt lương lưu `carryForwardDebt` vào nhân viên + nút "Tính lại nợ chuyển kỳ (toàn bộ lịch sử)"
- Thêm badge cảnh báo nợ lương trên card nhân viên trong `components/StaffManager.tsx`
- Thêm SQL migration vào `supabase_setup.sql` (3 ALTER TABLE)
- Files: `types.ts`, `src/lib/businessLogic.payroll.ts`, `hooks/usePayrollState.ts`, `components/payroll/SummaryTab.tsx`, `components/payroll/payrollPayslipPrint.ts`, `components/PayrollManager.tsx`, `components/StaffManager.tsx`, `supabase_setup.sql`

### 2026-05-22 — Tái cơ cấu tab Phân tích: chuyển biểu đồ, xóa tab thừa

- Chuyển 2 biểu đồ (waterfall P&L + pie phân bổ chi phí) từ tab "Cơ cấu" của `AnalysisBusinessPage` sang `AnalysisBusinessProfitPage` (đặt trên bảng chi phí)
- Xóa hoàn toàn tab "Cơ cấu" khỏi `AnalysisBusinessPage`
- Chuyển biểu đồ xu hướng tài chính (`DashboardTrendsPanel`) từ tab "Xu hướng" của `AnalysisBusinessPage` sang `AnalysisFinancialMatrixPage` (đặt trên bảng ma trận)
- Xóa hoàn toàn tab "Xu hướng" khỏi `AnalysisBusinessPage` — trang này giờ chỉ còn nội dung KPI duy nhất
- TypeScript check pass sạch
- Files: `components/analysis/AnalysisBusinessPage.tsx`, `components/analysis/AnalysisBusinessProfitPage.tsx`, `components/analysis/AnalysisFinancialMatrixPage.tsx`

### 2026-05-22 — Mở rộng AI CFO: thêm 4 tools mới

- Thêm 4 tool mới vào AI CFO để bao phủ toàn bộ dữ liệu app: `query_pos_orders`, `get_product_details`, `get_customer_stats`, `get_product_group_revenue`
- Thêm domain `customers` mới cho hệ thống phân loại câu hỏi (classify)
- Cập nhật system prompts cho domain `sales` và `inventory` để dùng tools mới
- Thêm agent `Customer Agent` vào giao diện chat với 3 câu hỏi mẫu
- TypeScript check pass sạch
- Files: `services/agents/cfoAgent.ts`, `components/ChatInterface.tsx`, `routes/ai.ts`

### 2026-05-22 — Audit & fix toàn bộ 8 trang Phân tích

- Kiểm tra và sửa 13 bug trên 8 trang phân tích trong mục "Phân tích và Báo cáo"
- **P0 — Tính toán sai nghiêm trọng:**
  - `AnalysisBusinessProfitPage`: cộng thêm lương (`payroll.netPay`) vào chi phí; lọc theo `p.month` (YYYY-MM) thay vì `p.date` không tồn tại; thêm "Lương nhân viên" vào biểu đồ chi phí
  - `AnalysisFinancialMatrixPage`: merge `shopeeRevenue` vào revenue để ma trận tài chính tính đúng tổng
  - `AnalysisGoodsClassifyPage`: fix `lineTotal` fallback chain đúng thứ tự (`item.total ?? item.subtotal ?? price × qty`)
- **P1 — Hiển thị sai / UX lỗi:**
  - `AnalysisBusinessProfitPage`: xóa cột "Chi nhánh trung tâm" trùng lặp trong PLRow; thêm ghi chú "(chưa theo dõi)" cho dòng hardcode 0
  - `AnalysisCustomersClassifyPage`: đổi `<rect>` thành `<Cell>` trong HBarCard (Recharts API đúng)
  - `AnalysisGoodsStockPage`: thêm `soldQtyMap` từ 30 ngày gần nhất để tính velocity-based stock alerts; fix `categoryPath` fallback; fix overStock dùng 60-day threshold
  - `AnalysisGoodsOverviewPage`: đổi nhãn "Top 10%" → "Top 10" cho đúng nghĩa
- **P2 — Thiếu tính năng:**
  - `AnalysisContainer`: sidebar `w-[200px]` → `w-64 shrink-0` đúng chuẩn project
  - `AnalysisEfficiencyPage`: thêm bộ lọc ngày (date picker), tính `days` động, giải mã tên nhân viên từ `data.employees`
  - `AnalysisGoodsClassifyPage`: thêm bộ lọc ngày, cập nhật AI context period
- TypeScript clean sau khi fix (`npx tsc --noEmit` không có lỗi)
- Files: `AnalysisBusinessProfitPage.tsx`, `AnalysisFinancialMatrixPage.tsx`, `AnalysisGoodsClassifyPage.tsx`, `AnalysisCustomersClassifyPage.tsx`, `AnalysisGoodsStockPage.tsx`, `AnalysisGoodsOverviewPage.tsx`, `AnalysisEfficiencyPage.tsx`, `AnalysisContainer.tsx`

---

### 2026-05-21
- Fix bộ lọc nhà cung cấp trong danh sách hàng hóa: đổi từ text input thuần sang popup checkbox giống bộ lọc nhóm hàng
- `useGoodsFilters.ts`: thêm param `transactions` + `filterSupplier: string[]`; build `productSupplierMap` từ giao dịch nhập hàng (type `'Import'`); logic lọc multi-select; export `uniqueSuppliers`
- `GoodsInventory.tsx`: state `filterSupplier` đổi sang `string[]`; truyền `transactions` + `filterSupplier` vào hook; pass `uniqueSuppliers` xuống workspace
- `GoodsProductsWorkspace.tsx`: prop `filterSupplier: string[]`, truyền tiếp `uniqueSuppliers` xuống sidebar
- `GoodsFilterSidebar.tsx`: thêm supplier popup (trigger div → popup cạnh bên, search + checkbox + Áp dụng); hỗ trợ chọn nhiều nhà cung cấp cùng lúc
- Fix thêm: `uniqueSuppliers` đổi nguồn từ transactions sang `suppliers` prop → dropdown luôn hiện đủ danh sách; `productSupplierMap` fallback dùng `supplierId` lookup; `useGoodsPurchase.ts` fix thiếu `supplierName` khi tạo transaction Import
- Files: `useGoodsFilters.ts`, `GoodsInventory.tsx`, `GoodsProductsWorkspace.tsx`, `GoodsFilterSidebar.tsx`, `useGoodsPurchase.ts`

---

### 2026-05-19 — Tích hợp AI Insight vào 8 trang phân tích

- Tạo `services/aiCache.ts` — localStorage cache với TTL 4h, `hashData()` + `getCachedAiResult()` + `setCachedAiResult()`
- Tạo `components/shared/AiInsightPanel.tsx` — panel AI tái sử dụng: nút Sparkles, spinner, badge "Từ cache", render markdown qua DOMPurify + marked
- Wire `AiInsightPanel` + aiCache + `handleAiRun` vào 8 trang: `AnalysisBusinessProfitPage`, `AnalysisFinancialMatrixPage`, `AnalysisGoodsOverviewPage`, `AnalysisGoodsStockPage`, `AnalysisGoodsClassifyPage`, `AnalysisCustomersOverviewPage`, `AnalysisCustomersClassifyPage`, `AnalysisEfficiencyPage`
- Thêm 8 backend endpoint POST trong `routes/ai.ts`: `/api/ai/profit-analysis`, `financial-matrix`, `goods-overview`, `goods-stock`, `goods-classify`, `customers-overview`, `customers-classify`, `efficiency`
- Tạo `.claude/rules/vietnamese.md` — quy tắc giao tiếp tiếng Việt bắt buộc cho mọi agent
- Files: `services/aiCache.ts` (new), `components/shared/AiInsightPanel.tsx` (new), `.claude/rules/vietnamese.md` (new), 8 analysis page files updated, `routes/ai.ts` updated

---

### 2026-05-19
- Tạo `AnalysisEfficiencyPage.tsx` — trang hiệu quả kinh doanh với KPI, so sánh hôm nay/hôm qua, top nhân viên, phân bổ kênh bán
- Tạo `AnalysisGoodsClassifyPage.tsx` — phân tích ABC hàng hóa theo doanh thu 30 ngày, filter theo nhóm, search
- Fix `AnalysisContainer.tsx` — thêm case `efficiency-overview` + `goods-classify` vào renderContent() (trước đó cả hai fall to `<Placeholder />`)
- Fix `GoodsLegacyProductFormView.tsx` — tách tab `related` (hiện danh sách sản phẩm cùng categoryId) và tab `channels` (coming soon UI); thêm prop `allProducts`
- Fix `GoodsProductDetailPanel.tsx` — cải thiện tab channels placeholder; thêm onClick cho nút "Sao chép" (copy SKU + tên ra clipboard)
- Fix `GoodsInventory.tsx` — truyền `allProducts={products}` vào `GoodsLegacyProductFormView`
- Thay thế `alert()` → `showToast()` trong 13 file: PayrollManager, KnowledgeManager, ProductGroupManager, StaffManager, PromotionManager, ExpenseManager, GoodsInternalUse, SettingsCenter, PrintTemplatesTab, ExpenseCategoriesPage, CustomerPoints, SupplierManager, POSComputer
- Files: AnalysisEfficiencyPage.tsx (new), AnalysisGoodsClassifyPage.tsx (new), AnalysisContainer.tsx, GoodsLegacyProductFormView.tsx, GoodsProductDetailPanel.tsx, GoodsInventory.tsx, + 13 files alert→toast

---

## Current Active Task
- Task: ✅ **HOÀN THÀNH** - Tách MarketingManager.tsx state ra hook
- Status: File giảm 0.8% (1046 → 1038 dòng), state logic tách thành useMarketingState hook 120 dòng
- Next recommended: Tách các file lớn khác (PayrollManager 891 dòng, ProductGroupManager 827 dòng)
- Recent completions:
  - SettingsCenter.tsx: 3/4 tabs, giảm 32.6%
  - 6 items POS: 100%
  - Type hóa: 100%
  - KnowledgeManager.tsx: 2/4 sub-tabs, giảm 12.4%
  - GoodsInventory.tsx: barcode utils, giảm 27.5%
  - POSComputer.tsx: state hook, giảm 8.3%
  - PurchaseOrdersContainer.tsx: form hooks, giảm 2.4%
  - MarketingManager.tsx: state hook, giảm 0.8%

---

### 2026-05-18 — Claude — Phiên 12 (Audit & fix toàn bộ tiểu mục Báo cáo)

**Đã làm:**
- `src/lib/reportCalculations.ts`: Sửa `EndOfDayReportRow` — bỏ 4 trường hardcode 0, thêm `discount` tính từ `totalAmount - finalAmount`; thêm time-range filter (fromTime/toTime) cho `getEndOfDayReportRows`; thêm `allowedProductIds?: Set<string>` filter vào `getGoodsReportRows` và `getOrderedGoodsReportRows`
- `components/reports/EndOfDayReportPage.tsx`: Thêm fromTime/toTime filter UI; đổi cột "Chiết khấu" thay 4 cột zero cũ; wire In/Tải xuống toolbar
- `components/reports/ChannelReportPage.tsx`: Thay fake blue circle bằng SVG donut chart thực với dữ liệu thực theo kênh; wire tất cả export buttons
- `components/reports/GoodsReportPage.tsx`: Thêm prop `products`, filter Loại hàng/Thương hiệu hoạt động bằng `<select>` + `allowedProductIds`; wire export
- `components/reports/OrderReportPage.tsx`: Tương tự GoodsReportPage — filter Loại hàng/Thương hiệu; wire export
- `components/MainContent.tsx`: Truyền `products={data.posProducts || []}` vào `report-orders` và `report-goods`
- `components/reports/SalesReportPage.tsx`: Wire ToolbarButton/SelectButton onClick; thêm handlePrint/handleDownload; wire Xuất tất cả, Hiển thị dọc, toolbar In/Tải xuống
- `components/reports/CustomerReportPage.tsx`: Tương tự SalesReportPage
- `components/reports/StaffReportPage.tsx`: Tương tự SalesReportPage
- `components/reports/SupplierReportPage.tsx`: Tương tự SalesReportPage
- `components/reports/FinanceReportPage.tsx`: Wire toolbar In/Tải xuống; thêm row "Doanh thu khác (*)" với chú thích `(*) Chưa ghi nhận trong phiên bản hiện tại`
- Files: `src/lib/reportCalculations.ts`, `components/reports/EndOfDayReportPage.tsx`, `components/reports/ChannelReportPage.tsx`, `components/reports/GoodsReportPage.tsx`, `components/reports/OrderReportPage.tsx`, `components/MainContent.tsx`, `components/reports/SalesReportPage.tsx`, `components/reports/CustomerReportPage.tsx`, `components/reports/StaffReportPage.tsx`, `components/reports/SupplierReportPage.tsx`, `components/reports/FinanceReportPage.tsx`

---

### 2026-05-17 — Claude — Phiên 11 (Hệ thống Hóa đơn đầu vào - Giai đoạn 1-4)

**Đã làm:**
- `supabase_setup.sql`: Thêm SQL migration — ALTER TABLE inventory_transactions thêm 4 cột (invoice_status, invoiced_amount, invoice_changed_by, invoice_changed_at); CREATE TABLE invoice_attachments với RLS policy
- `types.ts`: Thêm 4 optional fields vào InventoryTransaction interface (invoiceStatus, invoicedAmount, invoiceChangedBy, invoiceChangedAt)
- `services/invoiceService.ts` (NEW): Service upload file lên Supabase Storage bucket `purchase-invoices`; lưu record vào bảng `invoice_attachments`; export InvoiceStatus type
- `components/pos/useGoodsPurchase.ts`: Thêm invoiceStatus + invoiceFile state; handleCompletePurchase → async; upload file sau khi tạo transaction
- `components/pos/GoodsPurchaseForm.tsx`: Thêm 4 radio buttons chọn trạng thái chứng từ (FileCheck/FileMinus/FileText/FileX icons); nút upload file ẩn; badge "Chứng từ" trong lịch sử phiếu
- `components/purchase/PurchaseOrdersContainer.tsx`: Wire invoiceStatus vào transaction; upload file sau khi lưu; pass 4 props mới vào GoodsPurchaseForm
- `components/pos/GoodsInventory.tsx`: Destructure và pass 4 props mới vào GoodsPurchaseForm
- `components/orders/PurchaseInvoices.tsx` (REWRITE lớn): Giai đoạn 1: InvoiceBadge + cột Chứng từ; Giai đoạn 3: 5 tabs, header thống kê, expandable rows, signed URLs, loading attachments; Giai đoạn 4: import xlsx, showReport/vatRate state, monthlyReport + vatSummary computed, handleExportExcel (2 sheets), toggle Báo cáo/Danh sách, report UI (4 VAT cards + bảng tháng)
- Files: `supabase_setup.sql`, `types.ts`, `services/invoiceService.ts`, `components/pos/useGoodsPurchase.ts`, `components/pos/GoodsPurchaseForm.tsx`, `components/purchase/PurchaseOrdersContainer.tsx`, `components/pos/GoodsInventory.tsx`, `components/orders/PurchaseInvoices.tsx`

---

### 2026-05-16 — Claude — Phiên 10 (Revert GoodsInventory display + fix TypeScript errors)

**Đã làm:**
- `components/pos/GoodsProductTableHeader.tsx`: Xoá sort UI (ArrowDown/ArrowUp icons, renderSortHeader), khôi phục plain text headers với `text-slate-500`
- `components/pos/GoodsToolbar.tsx`: Xoá bulk action toolbar (FileDown, PackagePlus, Printer icons), khôi phục nút "Tạo mới" luôn hiển thị + `{rightControls}`, khôi phục `border-b border-slate-100`, khôi phục "Đã chọn {selectedCount}" text
- `components/pos/GoodsFilterSidebar.tsx`: Xoá collapse button (ChevronLeft icon), xoá `ChevronLeft` khỏi import
- `components/pos/GoodsProductsWorkspace.tsx`: Xoá `isFilterCollapsed` state, luôn render `GoodsFilterSidebar`, đổi sang implicit return
- `components/pos/GoodsInventory.tsx`: Fix 8 pre-existing TypeScript errors gây crash runtime:
  - `selectedIds: string[]` → `selectedIdSet: Set<string>` (useMemo)
  - `favoriteIds: string[]` → `favoriteIdSet: Set<string>` (useMemo)
  - Thêm `productGroups: ProductGroup[]` vào props và pass xuống `GoodsAuditForm`, `GoodsLegacyProductFormView`, `GoodsInventoryModals`
  - Thêm 4 discount props vào `GoodsPurchaseForm`: `purchaseDiscountValue`, `purchaseDiscountType`, `setPurchaseDiscountValue`, `setPurchaseDiscountType`
  - Thêm `transactions` vào `GoodsAuditForm`
  - Thêm `products` vào `GoodsInventoryModals`
  - Đổi `setActiveTab` → `onStartAudit` trong `GoodsInventorySecondaryToolbar`
  - Tạo 4 row-action handlers: `handlePrintLabel`, `handleAddSameType`, `handlePurchaseProduct`, `handleStopBusiness`

**Kết quả kiểm tra:**
- TypeScript ✅ **0 errors** (`npx tsc --noEmit`)
- Trang Hàng hoá hoạt động bình thường trên localhost

---

### 2026-05-15 — Claude — Phiên 9 (Tách MarketingManager state hook)

**Đã làm:**
- `hooks/useMarketingState.ts`: Tách marketing state management (120 dòng)
  - Core states: loading, adviceLoading, schedule, drafts, strategies, focusProducts, aiAdvice
  - Cloud sync: isCloudSyncEnabled
  - View states: duration, viewDate, activeTab, selectedPost
  - Modal states: modalMode, searchQuery, deferredSearchQuery, selectedStrategyFilter
  - Upload: uploadingForDate
  - Computed values:
    - todayStr - ngày hôm nay
    - nextAvailableStartDate - ngày bắt đầu tạo bài tiếp theo
    - generationCount - số bài có thể tạo trong tháng
  - Helper function: togglePosted()
- `components/marketing/MarketingManager.tsx`: Cập nhật để dùng useMarketingState hook
  - Import useMarketingState và MarketingTab type
  - Xóa 17 useState declarations
  - Xóa 3 useMemo (todayStr, nextAvailableStartDate, generationCount)
  - Xóa 1 useDeferredValue (deferredSearchQuery)
  - Xóa togglePosted function
  - Giữ lại: Facebook states (fbAppConfig, fbPages, etc.), refs, business logic
  - File giảm từ 1046 → 1038 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt GoodsInventory không liên quan)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 0.8% (8 dòng)

**Lợi ích:**
- Giảm re-render: State tách riêng
- Dễ test: Hook test độc lập
- Dễ maintain: State logic tách biệt UI
- Tái sử dụng: Hook có thể dùng cho marketing features khác

**Tổng kết:**
- ✅ useMarketingState hook hoàn thành (100%)
- ✅ Không có regression, tất cả tests pass
- ✅ Facebook states giữ trong component (không liên quan marketing core)

---

### 2026-05-15 — Claude — Phiên 8 (Tách PurchaseOrdersContainer form hooks)

**Đã làm:**
- `hooks/usePurchaseFormState.ts`: Tách purchase + return form states (105 dòng)
  - Purchase form states: showPurchaseForm, purchaseItems, purchaseSupplier, purchaseNote, purchaseDiscountValue, purchaseDiscountType
  - Return form states: showPurchaseReturnForm, returnItems, returnSupplier, returnNote, returnDiscountValue, returnDiscountType, returnSupplierPaidAmount, returnApplySupplierDebt
  - Helper functions:
    - resetPurchaseForm() - reset tất cả purchase form fields
    - resetReturnForm() - reset tất cả return form fields
    - getPurchaseItemsNetTotal() - tính tổng tiền hàng purchase
    - getPurchaseBillDiscountAmount() - tính chiết khấu purchase
    - getReturnItemsNetTotal() - tính tổng tiền hàng return
    - getReturnBillDiscountAmount() - tính chiết khấu return
    - getReturnSupplierMustPay() - tính số tiền NCC phải trả
- `hooks/usePurchaseQuickModals.ts`: Tách quick product/supplier modal states (75 dòng)
  - Quick product states: showQuickProductForm, quickProductTarget, quickProductModalTab, showQuickProductStockSection, showQuickProductLocationSection, showQuickProductUnitsSection, quickProductForm
  - Quick supplier states: showQuickSupplierForm, quickSupplierTarget
  - Helper function: resetQuickProductForm()
- `components/purchase/PurchaseOrdersContainer.tsx`: Cập nhật để dùng 2 hooks mới
  - Import usePurchaseFormState và usePurchaseQuickModals
  - Xóa 24 useState declarations
  - Xóa helper functions: resetReturnForm, resetQuickProductForm, getPurchaseItemsNetTotal, getPurchaseBillDiscountAmount, getReturnItemsNetTotal, getReturnBillDiscountAmount, getReturnSupplierMustPay
  - Giữ lại: getPurchaseLineTotal (dùng nhiều nơi), refs, business logic
  - Cập nhật handleSaveDraft, handleCompletePurchase để dùng resetPurchaseForm từ hook
  - File giảm từ 1087 → 1061 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt GoodsInventory không liên quan)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 2.4% (26 dòng)

**Lợi ích:**
- Giảm re-render: Form state tách riêng
- Dễ test: Hooks test độc lập
- Dễ maintain: Form logic tách biệt UI
- Tái sử dụng: Hooks có thể dùng cho form tương tự

**Tổng kết:**
- ✅ usePurchaseFormState hook hoàn thành (100%)
- ✅ usePurchaseQuickModals hook hoàn thành (100%)
- ✅ Không có regression, tất cả tests pass

---

### 2026-05-15 — Claude — Phiên 7 (Tách POSComputer state hook)

**Đã làm:**
- `hooks/usePOSState.ts`: Tách toàn bộ state management từ POSComputer (243 dòng)
  - Search states: searchTerm, debouncedSearchTerm, productSearchSort, customerSearch, showConsultant
  - Tab states: tabs, activeTabId, activeTab (với useMemo)
  - Modal states: showAddCustomerModal, showGridMenu, newCustomerForm, useSplitPayment
  - UI states: showDiscountModal, billDiscountRect, showReceiptModal, isCheckoutLocked
  - Item discount: itemDiscountPopup
  - Other modals: showReturnModal, showEODReport, isAutoPrintEnabled, lastOrder
  - Search results: showProductResults, selectedResultIndex
  - Feedback: scanFeedback, stockWarning với auto-clear timers
  - Mobile: showCheckoutSheet
  - Confirm dialog: confirmDialog với openConfirm/closeConfirm helpers
  - Effects: debounce search terms, close grid menu on tab switch
  - Helper functions: showScanFeedback, showStockWarning, resetNewCustomerForm
- `components/pos/types.ts`: Tách InvoiceTab interface để tránh circular dependency (24 dòng)
  - Export InvoiceTab interface
  - Được dùng bởi: POSComputer, usePOSState, usePOSReturnFlow, usePOSTabs, POSCheckout, POSHeaderToolbar
- `components/pos/POSComputer.tsx`: Cập nhật để dùng usePOSState hook
  - Import usePOSState và InvoiceTab từ file mới
  - Xóa ~30 useState declarations
  - Xóa 3 useEffect (debounce + grid menu)
  - Xóa helper functions: openConfirm, closeConfirm, showScanFeedback, showStockWarning
  - Xóa InvoiceTab interface definition
  - Xóa form reset logic trong handleAddQuickCustomer (dùng resetNewCustomerForm từ hook)
  - Giữ lại: refs (productSearchRef, checkoutRef, etc.), business logic, render logic
  - File giảm từ 1113 → 1021 dòng
- Cập nhật imports trong 4 files:
  - `components/pos/usePOSReturnFlow.ts`: import InvoiceTab from './types'
  - `components/pos/usePOSTabs.ts`: import InvoiceTab from './types'
  - `components/pos/POSCheckout.tsx`: import InvoiceTab from './types'
  - `components/pos/POSHeaderToolbar.tsx`: import InvoiceTab from './types'

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt GoodsInventory không liên quan)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 8.3% (92 dòng)

**Lợi ích:**
- Giảm re-render: State tách riêng, dễ optimize
- Dễ test: Hook test độc lập
- Dễ maintain: State logic tách biệt UI
- Tránh stale closure: Refs giữ ở component level

**Tổng kết:**
- ✅ usePOSState hook hoàn thành (100%)
- ✅ InvoiceTab interface tách riêng
- ✅ Không có regression, tất cả tests pass

---

### 2026-05-15 — Claude — Phiên 6 (Tách GoodsInventory barcode utils)

**Đã làm:**
- `components/pos/goods/barcodeUtils.ts`: Tách toàn bộ barcode logic từ GoodsInventory (233 dòng)
  - Constants: `CODE_128_PATTERNS` (bảng mã Code 128)
  - Pure functions:
    - `normalizeCode128Text()` - chuẩn hóa text cho Code 128
    - `buildCode128Svg()` - tạo SVG barcode từ text
    - `buildLabelProductName()` - format tên sản phẩm cho label
    - `getBarcodeLabelTemplateSettings()` - lấy settings template từ localStorage
    - `printProductLabels()` - in tem barcode (gọi window.print)
  - Tất cả đều export để dùng lại
- `components/pos/GoodsInventory.tsx`: Cập nhật imports và xóa code đã chuyển
  - Import 6 functions từ `./goods/barcodeUtils`
  - Xóa ~300 dòng barcode code đã chuyển
  - File giảm từ 1172 → 849 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt có sẵn không liên quan refactor)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 27.5% (323 dòng)

**Tổng kết:**
- ✅ Barcode utils hoàn thành (100%)
- ⏸️ GoodsInventoryFilters deferred (có thể làm sau)
- ⏸️ useGoodsBarcodeLabel hook deferred (có thể làm sau)

---

### 2026-05-15 — Claude — Phiên 5 (Tách KnowledgeManager)

**Đã làm:**
- `components/knowledge/MechanismsViolationsSubTab.tsx`: Tách sub-tab Violations (152 dòng)
  - Props: `localViolations`, `setLocalViolations`, `hasUnsaved`, `onSave`
  - Quản lý ma trận kỷ luật & khấu trừ
  - Wrap với React.memo
- `components/knowledge/MechanismsHolidaysSubTab.tsx`: Tách sub-tab Holidays (82 dòng)
  - Props: `holidays`, `onUpdate`
  - Quản lý danh sách ngày lễ (x2 lương)
  - Wrap với React.memo
- `components/KnowledgeManager.tsx`: Cập nhật để dùng 2 components mới
  - Xóa 3 helper functions: `handleUpdateLocalViolation`, `handleAddLocalViolation`, `handleRemoveLocalViolation`
  - Thay thế ~194 dòng JSX bằng components
  - File giảm từ 1565 → 1371 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN**
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 12.4% (194 dòng)

**Tổng kết:**
- ✅ 2/4 sub-tabs hoàn thành (50%)
- ⏸️ MechanismsSalarySubTab deferred (quá phức tạp ~394 dòng)
- ⏸️ StandardsWorkflowsTab deferred (~376 dòng)

---

### 2026-05-15 — Claude — Phiên 4 (Type hóa)

**Đã làm:**
- `hooks/useAppData.ts`: Type hóa `completedOperations` array
  - Thay `previousData?: any` → `previousData?: AppDataItem<keyof AppData> | { id: string }`
  - Thêm import `AppDataItem` từ types.ts
  - Loại bỏ hoàn toàn việc dùng `any` explicit
- `services/dataMapper.ts`: Kiểm tra và xác nhận không có `any` explicit
  - File đã clean, không cần sửa gì

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** - Không còn `any` explicit trong 2 file
- Tests ✅ **162/162 PASS** (100%)
- Lỗi TypeScript còn lại: 4 (tất cả trong GoodsInventory.tsx - lint debt)

**Tổng kết:**
- ✅ Task P1 hoàn thành: Type hóa dataMapper + useAppData
- ✅ Loại bỏ 1 chỗ dùng `any` trong useAppData.ts
- ✅ Không có regression, tất cả tests pass

---

### 2026-05-15 — Claude — Phiên 3 (Final)

**Đã làm:**
- `components/settings/tabs/GoodsTab.tsx`: Tách tab Goods từ SettingsCenter thành component độc lập (~450 dòng)
  - State: inventoryForm, inventorySaveStatus, costMethod
  - Functions: saveInventorySettings, toggleAllowSellOutOfStock
  - Sections: Thông tin hàng hóa, Giá vốn & tồn kho, Bảo hành & bảo trì, Khác
  - Wrap với React.memo để tối ưu re-render
- `components/settings/SettingsCenter.tsx`: Sửa lỗi cú pháp nghiêm trọng + type checking
  - **BUG FIX**: Xóa dòng `useEffect(() => {` thừa ở dòng 1094 gây lỗi TypeScript TS1005
  - **TYPE FIX**: Sửa 2 lỗi type checking khi truyền props vào GoodsTab
    - `inventorySettings || {}` → `inventorySettings || DEFAULT_POS_INVENTORY_SETTINGS`
    - `setActiveTab` → `(tab: string) => setActiveTab(tab as SettingsTab)`
  - Xóa renderGoodsTab function (~499 dòng)
  - Xóa GoodsDetailView type, GoodsOverviewLine component
  - Xóa GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY, GOODS_BARCODE_MODE_CHANGED_EVENT constants
  - Cập nhật renderActiveTab để dùng <GoodsTab />
  - File giảm từ 3444 → 2945 dòng
- **Kiểm tra 6 items POS user test**: Xác nhận tất cả đã hoàn thành
  - ✅ Sort sản phẩm POS (có dropdown sort theo mã/giá)
  - ✅ Header POS (đã loại bỏ icon cạnh chữ Admin)
  - ✅ Điểm thưởng (chỉ hiện khi có KH + sản phẩm tích điểm)
  - ✅ Popup trả hàng (màu indigo đồng bộ)
  - ✅ Nút báo cáo cuối ngày (có callback mở modal)
  - ✅ Thanh thêm hóa đơn (logic tabs đã implement)
- **Cập nhật tài liệu**: TODO.md đánh dấu hoàn thành tất cả items POS

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** - Tất cả lỗi liên quan SettingsCenter refactor đã được sửa
- Tests ✅ **162/162 PASS** (100%)
- ESLint ✅ Chỉ có unused vars (lint debt có sẵn)

**Debug process:**
- Tạo script Node.js `check-parens.cjs` để quét cân bằng dấu ngoặc toàn file
- Phát hiện final balance = +1 (1 dấu ngoặc mở thừa)
- Tìm được dòng 1094-1095 có 2 dòng `useEffect(() => {` liên tiếp
- Xóa dòng thừa, TypeScript compile thành công
- Sửa 2 lỗi type checking khi truyền props vào GoodsTab
- Kiểm tra code để xác nhận 6 items POS đã hoàn thành

**Tổng kết:**
- ✅ Refactor SettingsCenter.tsx: 3/4 tabs hoàn thành (75%)
- ✅ File giảm 32.6% (1422 dòng)
- ✅ TypeScript clean, 162 tests pass
- ✅ 6 items POS user test đã hoàn thành
- ⏸️ PrintTemplatesTab deferred (quá phức tạp ~1200 dòng)

---

### 2026-05-15 — Claude — Phiên 2

**Đã làm:**
- `components/settings/tabs/PaymentsTab.tsx`: Tách tab Payments từ SettingsCenter thành component độc lập
  - State: paymentForm, paymentSaveStatus, paymentAccountTab, editingAccount, accountModalTab
  - Functions: savePaymentSettings, openPaymentAccountModal, updateEditingAccount, saveEditingAccount, deletePaymentAccount, renderAccountTable
  - Modal payment account được chuyển vào component
  - Wrap với React.memo để tối ưu re-render
- `components/settings/tabs/AppearanceTab.tsx`: Tách tab Appearance từ SettingsCenter thành component độc lập
  - Không có state riêng, chỉ nhận activeThemeId và onThemeChange qua props
  - Hiển thị theme selector, typography guide, color palette, UI components preview
  - Component thuần, không có side effects
- `components/settings/SettingsCenter.tsx`: Xóa code liên quan payments và appearance đã chuyển sang tabs
  - Xóa 5 state payments: paymentForm, paymentSaveStatus, paymentAccountTab, editingAccount, accountModalTab
  - Xóa 6 functions payments: savePaymentSettings, toggleSplitPaymentSetting, openPaymentAccountModal, updateEditingAccount, saveEditingAccount, deletePaymentAccount
  - Xóa renderPaymentsTab, renderAccountTable, renderAppearanceTab (~450 dòng tổng)
  - Xóa VIET_BANKS constant, emptyPaymentAccount helper
  - Xóa modal editingAccount (~150 dòng)
  - Xóa useEffect sync paymentForm
  - Xóa unused imports: HelpCircle, DEFAULT_POS_PAYMENT_SETTINGS, POSPaymentAccount, POSPaymentAccountType, POSPaymentMethod, APP_THEMES
  - Cập nhật renderActiveTab để dùng <PaymentsTab /> và <AppearanceTab />

**Kết quả kiểm tra:**
TypeScript ✅ clean (lỗi tồn đọng GoodsInventory không liên quan)
ESLint ✅ clean

**Còn lại / Dang dở:**
- [ ] Tách PrintTemplatesTab (invoice, exchange, payroll, barcode templates + 10 barcode states)
- [ ] Tách GoodsTab (phức tạp nhất - units, attributes, categories, brands, locations)

---

### 2026-05-15
- Tái cấu trúc tài liệu quy trình: tách HISTORY.md, TODO.md, workflow.md
- Files: `.claude/rules/workflow.md`, `docs/05-process/HISTORY.md`, `docs/05-process/TODO.md`

### 2026-05-13 → 2026-05-14
- POS: tab hóa đơn cuộn ngang khi quá nhiều tab
- POS: giữ nút thêm hóa đơn luôn hiển thị
- POS: xóa icon scanner trên thanh tìm sản phẩm
- POS: thêm sort sản phẩm theo tên / mã / giá trong ô tìm kiếm
- Inventory: sửa luồng audit nhà cung cấp khi nhập hàng
- Files: `components/pos/POSHeaderToolbar.tsx`, `components/pos/POSComputer.tsx`, `components/pos/GoodsInventory.tsx`

### 2026-05-12
- POS: giao diện Chia nhiều — bỏ khung ngoài, label giống dòng tiền hàng/giảm giá, input bo góc, format dấu phẩy
- POS: layout thanh toán Chuyển khoản / Thẻ / Ví theo ảnh mẫu, giữ màu app
- POS: layout trả hàng — thanh Tìm hàng đổi đồng màu với Tìm hàng trả, khóa ô tìm chính khi mode=return
- POS: popup thêm khách hàng mới — layout 2 cột kiểu KiotViet, form underline, radio giới tính
- Hàng hóa: navigation dropdown-only, ẩn/hiện bộ lọc bằng nút mũi tên, xóa đường phân cách thừa
- Files: `components/pos/POSCheckout.tsx`, `components/pos/POSCart.tsx`, `components/pos/POSHeaderToolbar.tsx`, `components/pos/POSComputer.tsx`, `components/pos/POSQuickCustomerModal.tsx`

### 2026-05-11
- Code cleanup: xóa 4 dead files, 2 duplicate generateId, 5 console.log, dead isSubItem
- Split ExpenseManager.tsx (1522 dòng → 561 dòng) → components/expense/
- Thiết lập .claude/ folder: hooks, commands, agents, rules
- Files: `components/expense/*`, `.claude/*`

### 2026-05-10
- Fix P0: chặn bán âm kho tại addToCart + barcode + updateQuantity + handleCheckout
- Fix P0: thống nhất công thức discount — item total = quantity × (price − discount)
- Fix P0: enqueue updateSurgical vào IndexedDB khi offline
- POS: tính COGS từ importPrice × quantity, grossProfit = netRevenue − totalCogs
- Tách onPlaceOrder/onReturnOrder → services/posOrderService.ts + unit test
- Fix stale closure shortcut F9 dùng checkoutRef/cartLengthRef
- Files: `components/pos/POSComputer.tsx`, `services/posOrderService.ts`, `hooks/useOfflineSync.ts`

### 2026-05-08
- Migration Gemini → Claude hoàn tất cho tất cả module
- 6 Specialized Agents: CFO, HR, Sales, Inventory, Marketing, Operations
- EOD Report tự động 21:00 VN — Email + Zalo OA
- Cảnh báo thông minh: tồn kho, nợ NCC, doanh thu drop; TopNav bell poll 10 phút
- Files: `routes/ai.ts`, `components/dashboard/*`, `components/TopNav.tsx`

### 2026-05-06
- Bảo mật: secrets → .env.local, DOMPurify cho 6 component, requireAuth middleware
- 43 unit tests cho businessLogic.ts (Vitest)
- Pagination: limit 2000, order desc, fetchTablePage()
- CORS whitelist, session secret → env var
