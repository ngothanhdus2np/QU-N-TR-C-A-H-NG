# BÁO CÁO KIỂM TOÁN PRODUCTION-READINESS — CFO Brain 4.0

**Ngày**: 2026-06-29
**Phạm vi (do user chọn)**: Trục rủi ro cao — **Security · Business Logic · Data Integrity · API**. Bỏ qua chấm điểm UI/UX hình thức và micro-performance.
**Phương pháp**: Đọc & thẩm định source trực tiếp (không sửa code), đối chiếu với `BUG_REPORT.md` cũ (23/06), chạy `tsc`/`npm test`.
**Quy mô hệ thống**: ~131.000 dòng TS/TSX · 234 component · 15 route backend · 24 service · 14 hook · 13 file test (318 test case).

> ⚠️ Lưu ý quan trọng: App **đang chạy production thật** (cửa hàng Phúc Sang), expose ra Internet qua Cloudflare Tunnel (`app.phucsang.com.vn` → `localhost:3000`). Mọi endpoint `/api/*` không gắn auth đều **truy cập được từ Internet**.

---

## 1. EXECUTIVE SUMMARY

Lõi nghiệp vụ (POS, tồn kho, phân quyền tài khoản, COGS/doanh thu, trả hàng) **được thiết kế cẩn thận**: có atomic RPC cho mobile checkout, rollback saga, chống leo thang đặc quyền trong quản lý tài khoản, DOMPurify ở mọi `dangerouslySetInnerHTML`, requireAuth phủ đầy đủ các route mutate dữ liệu chính.

**Tuy nhiên có 3 lỗ hổng CRITICAL ở tầng `server.ts`** — các endpoint thao tác file/DB **không gắn `requireAuth`** nhưng vẫn dùng service-role và đang phơi ra Internet. Đây là blocker production thật sự, độc lập với chất lượng nghiệp vụ.

Ngoài ra, **đường Web POS chưa được làm cứng atomic như đường Mobile** — còn race condition doanh thu và saga phi-transaction.

| Hạng mục | Critical | High | Medium | Low |
|---|---|---|---|---|
| Security | 2 | 1 | 3 | 1 |
| Business Logic / Data Integrity | 0 | 2 | 3 | 2 |
| API / Quality | 0 | 0 | 3 | 1 |
| **Tổng** | **2** | **3** | **9** | **4** |

**Verdict: 🔴 READY AFTER FIXING REQUIRED ISSUES** — phải vá `SEC-01`, `SEC-02`, `SEC-03` trước khi tiếp tục để hệ thống mở Internet.

---

## 2. BUG LIST (có bằng chứng `file:line`)

### 🔴 SEC-01 — CRITICAL — Xóa file tùy ý không cần auth (Path Traversal)
- **Module**: `server.ts:300-327` — `DELETE /api/upload-product-image/:productId`
- **Mô tả**: Endpoint **không gắn `requireAuth`**. Nhận `deleted: string[]` từ body, mỗi URL chỉ cần `startsWith('/product-images/')` rồi:
  ```ts
  const filePath = path.join(os.homedir(),'cfobrain-assets','products', url.replace('/product-images/',''));
  unlink(filePath).catch(()=>{});
  ```
- **Root cause**: Không sanitize `../` trước `path.join`. URL `"/product-images/../../../../<bất kỳ file>"` thoát khỏi thư mục products.
- **Bằng chứng / tái hiện**: `curl -X DELETE https://app.phucsang.com.vn/api/upload-product-image/x -H 'Content-Type: application/json' -d '{"images":[],"deleted":["/product-images/../../../../<path>"]}'` → xóa file tùy ý trên máy iMac. Đồng thời ghi đè `images` của `productId` bất kỳ.
- **Impact**: Xóa file hệ thống/dữ liệu trên server từ Internet, không cần đăng nhập. Data tampering.
- **Fix**: (1) Gắn `requireAuth`. (2) Chuẩn hóa & kiểm tra path nằm trong thư mục products: `path.resolve` rồi assert `startsWith(productsRoot)`. Loại bỏ url chứa `..`.
- **Fix time**: 30 phút · **Regression risk**: Thấp · **Priority**: P0

### 🔴 SEC-02 — CRITICAL — Upload ảnh & sửa sản phẩm không cần auth
- **Module**: `server.ts:196-248` (`POST /api/upload-product-image/:productId`) + `:300` (DELETE) + `:251-296` (`GET /api/product-info/*`)
- **Mô tả**: Dùng **service-role client** (`supabase` admin, bypass RLS) để `update pos_products` theo `productId` tùy ý, **không auth**. Ghi tối đa 5MB/lần lên đĩa hoặc base64 vào DB.
- **Root cause**: Các handler được mount thẳng lên `app` trước middleware auth, không có cổng bảo vệ.
- **Impact**: Bất kỳ ai trên Internet (đoán/known UUID sản phẩm) ghi đè ảnh sản phẩm, bơm ảnh rác → DoS dung lượng đĩa/DB.
- **Fix**: Gắn `requireAuth` (hoặc token kiểu `POS_MOBILE_TOKEN`) cho cả 3 endpoint; giữ giới hạn 5MB.
- **Fix time**: 30 phút · **Regression risk**: Thấp (trang chụp ảnh mobile cần truyền token) · **Priority**: P0

### 🟠 SEC-03 — HIGH — Proxy Supabase REST/Auth/Storage mở công khai
- **Module**: `server.ts:435-460`
- **Mô tả**: `app.use(['/auth/v1','/rest/v1','/storage/v1'], …)` forward **toàn bộ** request kèm header tới `http://192.168.1.3:8000`, **không kiểm auth ở tầng app**. Bảo mật phụ thuộc 100% vào RLS của Supabase.
- **Bằng chứng kết hợp**: `HISTORY.md` (28/06) ghi rõ `pos_customers`/`pos_orders` cho role `anon` đọc được. Anon key nằm trong JS bundle frontend = **công khai**. → Bất kỳ ai cũng `GET /rest/v1/pos_customers?select=name,phone,debt_amount` lấy **PII khách + công nợ** từ Internet.
- **Impact**: Lộ dữ liệu cá nhân khách hàng + công nợ (Broken Access Control / Sensitive Data Exposure — OWASP A01/A02).
- **Fix**: Rà soát lại RLS từng bảng — `anon` chỉ được đọc bảng storefront công khai (`store_products`...), KHÔNG đọc `pos_customers`, `pos_orders`, `customer_debt_history`, `payroll_records`, `revenue_records`. Cân nhắc chặn `/rest/v1` cho `anon` qua proxy, ép đọc qua route backend đã có auth.
- **Fix time**: 2-4 giờ (audit RLS) · **Regression risk**: Trung bình (có thể chặn nhầm path frontend đang dùng) · **Priority**: P0/P1

### 🟠 SEC-05 — MEDIUM — Brute-force mật khẩu quản lý không bị siết
- **Module**: `routes/auth.ts:234-267` (`POST /api/auth/verify-manager`) + `server.ts:405-415`
- **Mô tả**: `verify-manager` nhận `username/password` và `signInWithPassword`, **không `requireAuth`**, chỉ chịu `apiLimiter` (300 req/15ph) — `authLimiter` (20 req/15ph) chỉ áp `/api/auth/register`. Tương tự, login Supabase đi qua proxy `/auth/v1` **không bị app rate-limit**.
- **Impact**: Cho phép thử ~300 mật khẩu/15ph/IP cho tài khoản owner/manager.
- **Fix**: Áp `authLimiter` cho `verify-manager` + thêm rate-limit cho `/auth/v1/token`.
- **Fix time**: 20 phút · **Priority**: P1

### 🟠 SEC-04 — MEDIUM — Lộ giá vốn + tồn kho qua endpoint công khai
- **Module**: `server.ts:268-296` — `GET /api/product-info/barcode/:barcode`
- **Mô tả**: `COLS` gồm `import_price`; `res.json({ ...data, … })` trả nguyên `import_price` + `stock`, **không auth**. (Trái với chủ trương đã làm ở POS Mobile — `posMobile.ts:82` cố tình bỏ `import_price`.)
- **Impact**: Đối thủ quét barcode lấy giá vốn từng SKU.
- **Fix**: Gắn auth/token + bỏ `import_price` khỏi response.
- **Fix time**: 15 phút · **Priority**: P1

### 🟡 SEC-07 — MEDIUM — Endpoint tạo đơn website công khai không rate-limit
- **Module**: `routes/store.ts:342` — `POST /api/store/orders`
- **Mô tả**: Tạo đơn (trừ tồn ngay qua RPC `create_store_order`) **không có rate limiter**, trong khi `contacts`/`newsletter` đã có (`store.ts:97-98`).
- **Impact**: Spam đơn giả → rút cạn tồn kho ảo / nhiễu dữ liệu. (RPC atomic nên không sai lệch tài chính, nhưng tồn kho bị khóa.)
- **Fix**: Thêm `publicFormRateLimit` cho `/api/store/orders` + `/preorders` + `/orders/lookup`.
- **Fix time**: 15 phút · **Priority**: P2

### 🟡 SEC-06 — LOW/MEDIUM — CSP cho `unsafe-inline` + `unsafe-eval`
- **Module**: `server.ts:376`
- **Mô tả**: `scriptSrc: ["'self'","'unsafe-inline'","'unsafe-eval'"]` bật cả ở production → giảm hiệu lực phòng XSS (dù XSS đã được DOMPurify chặn ở các điểm render HTML).
- **Fix**: Bỏ `unsafe-eval` ở prod nếu build không cần; cân nhắc nonce thay `unsafe-inline`.
- **Priority**: P2

---

### 🟠 DATA-01 — HIGH — Web POS checkout là saga phi-transaction
- **Module**: `services/posOrderService.ts:258-339` + `hooks/useAppData.ts:901-991`
- **Mô tả**: `processPlaceOrder` chạy **trên client**, ghi tuần tự qua nhiều lệnh riêng: (1) `posOrders` → (2) `inventoryTransactions+posProducts` (atomic RPC) → (3) `posCustomers` → (3b) `customerDebtHistory` → (4) `revenue`. Chỉ bước 2 atomic. Cả saga **không phải 1 transaction DB**; chỉ rollback khi có `throw` được bắt — **không bảo vệ khi tab đóng/mất mạng/crash giữa chừng**.
- **Đối chiếu**: Đường Mobile đã được gói vào 1 RPC `pos_mobile_checkout` (HISTORY 27/06). Web POS thì chưa.
- **Impact**: Sự cố giữa bước 2 và 4 → đơn đã lưu + đã trừ tồn nhưng **doanh thu/công nợ ghi thiếu** → lệch sổ.
- **Fix**: Đưa Web POS checkout vào 1 RPC tương tự `pos_mobile_checkout` (insert đơn + trừ tồn + cộng doanh thu + nợ trong 1 transaction).
- **Fix time**: 1-2 ngày · **Regression risk**: Cao (lõi bán hàng) · **Priority**: P1

### 🟠 DATA-02 — HIGH (tài chính) — Race condition mất doanh thu trên Web POS
- **Module**: `services/posOrderService.ts:151-191, 246-247, 312-324`
- **Mô tả**: `buildRevenueUpdate` đọc `existingRevenue` từ snapshot RAM, cộng dồn **ở client**, rồi `upsertItem('revenue', record)` ghi đè **cả dòng** (`useAppData.ts:984`). 2 máy bán cùng ngày → read-modify-write đua nhau → last-write-wins, **mất doanh thu đơn kia**.
- **Đối chiếu**: RPC mobile dùng `ON CONFLICT (date) DO UPDATE SET x = records.x + excluded.x` (atomic increment). Web không.
- **Giảm nhẹ**: Có `POST /api/analytics/recalculate-revenue-from-orders` dựng lại doanh thu từ đơn (nguồn chân lý) → sai lệch khôi phục được, nhưng số hiển thị hằng ngày có thể sai cho tới khi recalc.
- **Fix**: Cộng doanh thu bằng atomic increment phía DB (gộp vào RPC ở DATA-01).
- **Fix time**: gộp với DATA-01 · **Priority**: P1

### 🟡 LOGIC-01 — MEDIUM — COGS = 0 khi không tìm thấy sản phẩm
- **Module**: `services/posOrderService.ts:53-57` *(carry-over BUG-LOGIC-002, vẫn open)*
- **Mô tả**: `return product?.importPrice || 0` → sản phẩm bị xóa/lỗi sync làm giá vốn = 0 ⇒ **lãi gộp thổi phồng** âm thầm (chỉ `console.warn`).
- **Fix**: Khi thiếu giá vốn → cảnh báo nổi bật/khối đơn, không lẳng lặng tính 0.
- **Priority**: P2

### 🟡 DATA-03 — MEDIUM — `Math.max(0, …)` che giấu giá trị âm
- **Module**: `services/posOrderService.ts:162-163` *(carry-over BUG-DATA-001)*
- **Mô tả**: `netRevenue`/`otherFees` bị kẹp về 0 khi âm (discount > totalAmount, finalAmount < netRevenue) → nuốt lỗi dữ liệu thay vì báo.
- **Fix**: Validate & raise khi âm vượt ngưỡng làm tròn.
- **Priority**: P2

### 🟡 DATA-05 — MEDIUM — Schema drift giữa production và migrations
- **Module**: `supabase_setup.sql` / `supabase_migrations/` vs DB self-hosted *(TODO P0 đang mở)*
- **Mô tả**: Production chưa chạy migration 013 (RPC `*_v2`) + cột `branch_id`/constraint `(date,branch_id)` của `revenue_records`. Hệ thống chạy nhờ fallback legacy → setup.sql **lệch DB thật**, là bẫy cho lần thay đổi schema sau.
- **Fix**: Rà soát & chạy bù migration còn thiếu hoặc cập nhật setup cho khớp.
- **Priority**: P1

### 🟢 DATA-04 — LOW — `toLocalDateKey` âm thầm fallback về hôm nay
- **Module**: `services/posOrderService.ts:194-198`, `routes/posMobile.ts:10-14` *(carry-over BUG-DATA-002)*
- **Mô tả**: Ngày không hợp lệ → ghi doanh thu vào **ngày hiện tại** không cảnh báo.
- **Priority**: P3

### 🟢 ERR-01 — LOW — Lỗi audit log chỉ `console.error`
- **Module**: `services/posOrderService.ts:364-366, 541-547` *(carry-over BUG-ERR-001)*
- **Mô tả**: Audit thất bại không alert/không retry → mất dấu vết thao tác tài chính mà không ai biết.
- **Priority**: P3

---

### 🟡 QA-01 — MEDIUM — Độ phủ test mỏng
- **Bằng chứng**: 13 file test / 318 case cho ~131k dòng. Lõi rủi ro cao nhất (saga Web POS, race doanh thu, path traversal) **không có test concurrency/security**.
- **Fix**: Thêm test cho checkout atomic, return flow, và regression cho các fix SEC.
- **Priority**: P2

### 🟢 QA-02 — LOW — Nợ kỹ thuật đã biết
- **Bằng chứng**: `tsc --noEmit` → **7 lỗi type** trong `routes/channelLinks.ts` (generic `inBatches<T>` → `unknown`); `npm test` → **1 fail** brittle ở `tests/unit/adminStoreModule.test.ts` (string-match lệch với source dùng `...requireRole(...)`). Cả hai **đã nằm trong TODO P0** — không phải phát hiện mới, không chặn runtime (tsx bỏ qua type check).
- **Priority**: P2

---

## 3. ĐỐI CHIẾU `BUG_REPORT.md` CŨ (23/06) VỚI CODE HIỆN TẠI

| Bug cũ | Trạng thái hôm nay | Bằng chứng |
|---|---|---|
| BUG-LOGIC-001 (race tồn kho) | ✅ **Đã giảm thiểu** | Trừ tồn qua RPC atomic `apply_inventory_transaction_with_stock` (`useAppData.ts:934,956`) + mobile RPC |
| BUG-LOGIC-002 (COGS=0) | ❌ **Còn** | `posOrderService.ts:56` → **LOGIC-01** |
| BUG-LOGIC-003 (rollback audit) | ⚠️ Thiết kế giữ nguyên | Xóa transaction thay vì mark — chấp nhận được |
| BUG-LOGIC-004 (pending count localStorage) | ❌ **Còn** | `services/syncService.ts:2-15` (low) |
| **BUG-SEC-001..004** (auth.ts) | ✅ **LỖI THỜI** | 6 hàm (`signUp/updatePassword/resetPassword/getUserMetadata/isAdmin/isManager`) **đã xóa** (HISTORY 27/06). `services/auth.ts` nay chỉ còn `signIn/signOut/getCurrentUser/getCurrentSession/refreshSession` |
| BUG-SEC-005 (session expiry) | ⚠️ Còn `getCurrentSession` | Dựa vào auto-refresh của Supabase client — rủi ro thấp |
| BUG-DATA-001 (Math.max che âm) | ❌ **Còn** | `posOrderService.ts:162-163` → **DATA-03** |
| BUG-DATA-002 (date fallback) | ❌ **Còn** | `posOrderService.ts:194-198` → **DATA-04** |
| BUG-PERF-001 (buildProductMap 2 lần) | ✅ Đã tối ưu | `posOrderService.ts:228-229` build map 1 lần |
| BUG-ERR-001 (audit chỉ log) | ❌ **Còn** | `posOrderService.ts:364-366` → **ERR-01** |

> Kết luận: `BUG_REPORT.md` cũ **lỗi thời ~40% phần Security** (toàn bộ SEC trên auth.ts là code chết đã xóa). Nên thay bằng báo cáo này.

---

## 4. RISK MATRIX

| | Tác động THẤP | Tác động CAO |
|---|---|---|
| **Xác suất CAO** | SEC-07, DATA-04 | **SEC-01, SEC-02** (endpoint Internet không auth), DATA-02 (đa máy) |
| **Xác suất THẤP** | SEC-06, ERR-01, QA-02 | **SEC-03** (cần biết anon key — nhưng key công khai), DATA-01 (crash giữa saga), DATA-05 |

---

## 5. SCORING (0–100, theo phạm vi đã chọn)

| Trục | Điểm | Ghi chú |
|---|---:|---|
| Security | **45** | Lõi auth/role tốt, nhưng 2 CRITICAL endpoint không auth phơi Internet kéo điểm xuống mạnh |
| Business Logic | **78** | Logic đúng & cẩn thận; còn race doanh thu + COGS=0 ở đường web |
| Data Integrity | **65** | Mobile atomic tốt; web saga phi-transaction + schema drift |
| API design | **80** | requireAuth phủ tốt, role enforcement chắc; thiếu rate-limit vài endpoint công khai |
| Testing | **55** | 318 test pass nhưng phủ mỏng so với quy mô; thiếu test bảo mật/đồng thời |
| Maintainability | **75** | Tài liệu nghiệp vụ tốt, quy trình rõ; còn 7 lỗi type tồn đọng |
| **Tổng thể (trục rủi ro cao)** | **62** | Bị chặn bởi 3 lỗ hổng CRITICAL/HIGH ở tầng phơi Internet |

*(UI/UX/Perf/DevOps/Scalability: ngoài phạm vi user chọn — chưa chấm.)*

---

## 6. KẾ HOẠCH HÀNH ĐỘNG (ưu tiên)

**P0 — vá ngay (≈1 buổi):**
1. `SEC-01` + `SEC-02`: gắn `requireAuth` (hoặc token) + sanitize path cho 3 endpoint trong `server.ts` (upload/delete/product-info).
2. `SEC-03`: audit RLS — chặn `anon` đọc `pos_customers`/`pos_orders`/`customer_debt_history`/`payroll_records`.

**P1 — trong tuần:**
3. `SEC-04`, `SEC-05`: bỏ `import_price` khỏi barcode endpoint; siết rate-limit verify-manager/login.
4. `DATA-01` + `DATA-02`: gói Web POS checkout vào 1 RPC atomic (như mobile) → diệt cả saga lẫn race doanh thu.
5. `DATA-05`: đồng bộ schema production với migrations.

**P2 — trong tháng:**
6. `SEC-06`, `SEC-07`, `LOGIC-01`, `DATA-03`, `QA-01`: rate-limit storefront, siết CSP, hard-fail COGS thiếu giá vốn, bổ sung test bảo mật/đồng thời, dọn 7 lỗi type.

---

## 7. KẾT LUẬN

**🔴 READY AFTER FIXING REQUIRED ISSUES.**

Hệ thống có lõi nghiệp vụ vững và nhiều lớp phòng thủ đúng đắn (atomic mobile checkout, role enforcement, DOMPurify, requireAuth phủ rộng). Nhưng **3 lỗ hổng CRITICAL/HIGH ở `server.ts` (SEC-01/02/03) đang phơi ra Internet** là blocker thực sự — phải vá trước khi xem là an toàn để mở rộng. Đường Web POS cần được nâng lên cùng mức atomic như đường Mobile (DATA-01/02) để đảm bảo toàn vẹn tài chính khi nhiều máy bán đồng thời.

> Báo cáo này thay thế `BUG_REPORT.md` (23/06) — vốn đã lỗi thời phần Security.
