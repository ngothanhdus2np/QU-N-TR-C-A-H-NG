# BÁO CÁO KIỂM TOÁN PRODUCTION-READINESS — CFO Brain 4.0

**Ngày**: 2026-06-30
**Phạm vi**: Toàn diện 15 trục (AI QA Enterprise v4) — Security, Business Logic, Data Integrity, API, Performance, DevOps, Architecture, Scalability, Code Quality, Testing, UI/UX, AI.
**Phương pháp**: Đọc & thẩm định source tĩnh + chạy `tsc`/`npm test` + **kiểm chứng THẬT trên production** (query RLS/grants trên DB, đọc `NODE_ENV` tiến trình live qua SSH). Không sửa code production trực tiếp.
**Cập nhật so với** [`PRODUCTION_AUDIT_2026-06-29.md`](PRODUCTION_AUDIT_2026-06-29.md): các lỗ hổng nghi CRITICAL đã được **xác minh trạng thái thật** (phần lớn đã đóng), + vá thêm SEC-01 và triển khai P1 cho DATA-02.

> ⚠️ App đang chạy production thật (cửa hàng Phúc Sang), expose Internet qua Cloudflare Tunnel (`app.phucsang.com.vn`).

---

## 1. EXECUTIVE SUMMARY

Sau khi **kiểm chứng trực tiếp trên production** (không chỉ phân tích tĩnh), bức tranh bảo mật **tốt hơn nhiều** so với lo ngại ban đầu: cả 2 nỗi sợ lớn nhất (anon đọc/ghi toàn DB; auth bypass leo quyền) đều **đã đóng**. Lõi nghiệp vụ vững (atomic mobile checkout, role enforcement, DOMPurify phủ 100% điểm render HTML, requireAuth phủ mọi router mutate). `tsc` sạch 0 lỗi, 318/318 test pass.

Phiên này đã **vá SEC-01** (path traversal) và **triển khai P1 cho DATA-02** (atomic revenue increment — diệt race mất doanh thu khi nhiều máy bán cùng ngày), giữ nguyên kiến trúc offline-first.

| Hạng mục | Critical | High | Medium | Low |
|---|---|---|---|---|
| Security | 0 | 0 (SEC-01 đã vá, chờ deploy) | 2 | 2 |
| Business Logic / Data | 0 | 1 (DATA-01, hoãn P2) | 2 | 2 |
| DevOps / Vận hành | 0 | 1 (backup) | 1 | 1 |
| **Tổng (mở)** | **0** | **2** | **5** | **5** |

**Verdict: 🟢 READY AFTER FIXING — KHÔNG còn lỗ hổng CRITICAL active.**

---

## 2. KIỂM CHỨNG THẬT TRÊN PRODUCTION (điểm khác biệt với audit tĩnh)

### ✅ SEC-03 — anon truy cập DB: ĐÃ ĐÓNG (xác minh + dọn dứt điểm)
- **Kiểm chứng**: query `information_schema.role_table_grants` cho `anon` → các bảng nặng (`pos_orders`, `payroll_records`, `revenue_records`, `employees`, `pos_customers`, `supplier_debts`...) **không còn grant** → C2-Phần-C (`supabase_setup.sql:2288`) đã chạy trên prod.
- **4 grant sót** (`customer_debt_history`, `shopee_shops`, `newsletter_subscribers`, `store_contacts`): query `pg_policies` xác nhận cả 4 đều **RLS bật + không có policy nào cho `anon`** → bị DENY mặc định (không khai thác được). Đã **REVOKE ALL FROM anon** trên 4 bảng để dọn dứt điểm.
- **Gốc rễ còn lại**: bảng mới (migration 015/019) tự nhận grant `anon` → nên thêm bước revoke vào cuối mỗi migration tạo bảng (xem MAINT-01).

### ✅ AUTH bypass Lớp 1 — dev-bypass `requireAuth`: ĐÃ ĐÓNG
- **Kiểm chứng**: `NODE_ENV=production` trong env tiến trình `com.cfobrain.app` (pid live), set qua `~/Library/LaunchAgents/com.cfobrain.app.plist`. → `IS_PROD=true` → điều kiện `!IS_PROD` của dev-bypass (`server.ts:548`) false. Rate-limiter đang bật.
- **Điểm giòn (MAINT-02)**: `NODE_ENV` nằm ở plist, **không** ở `.env.local`. Restart thủ công bằng `npm run dev` → `NODE_ENV` rỗng → bypass + tắt rate-limit bật lại. Nên thêm `NODE_ENV=production` vào `.env.local` trên iMac.

### 🟢 AUTH bypass Lớp 2 — `routes/auth.ts:21` default owner: KHÔNG khai thác được (hạ LOW)
- Vì Lớp 1 đã đóng, request không-JWT bị `requireAuth` chặn 401 trước khi tới `resolveCaller`. Vẫn nên vá `return null` (defense-in-depth) — xem SEC-08.

---

## 3. BUG LIST (trạng thái hiện tại)

### ✅ Đã xử lý phiên này
- **SEC-01 — Path traversal** (`server.ts` DELETE `/api/upload-product-image`): **ĐÃ VÁ**. Thêm `path.resolve(productsRoot, rel)` + `startsWith(productsRoot + sep)`. Proof: `../../../../etc/passwd`, `../.ssh/id_rsa`, absolute `//etc/hosts` đều BLOCK; path hợp lệ ALLOW. *(chờ deploy)*
- **DATA-02 — Race mất doanh thu** (Web POS): **ĐÃ VÁ (P1)**. Doanh thu ghi bằng **delta cộng dồn atomic** (`apply_revenue_delta` RPC, `ON CONFLICT(date) += delta`) thay vì đọc-sửa-ghi-đè. Áp dụng cả bán & trả/đổi. Giữ offline-first (queue `opType: revenueDelta`). Migration 020 đã chạy prod; code chờ deploy.

### 🟠 HIGH (mở)
- **DATA-01 — Web POS saga phi-transaction**: hoãn theo quyết định phân pha (P2). Giảm thiểu sẵn có: local-first ghi trước, stock atomic qua RPC, rollback saga, recalc tool. Atomic toàn DB chỉ đạt được nếu hy sinh offline-first → cân nhắc kỹ ở P2.
- **DEVOPS-01 — Không có backup DB thật**: `backup_*.sql` = 0 byte. Cần cron `pg_dump` định kỳ + kiểm tra restore.

### 🟡 MEDIUM (mở)
- **SEC-04** (`server.ts:291`): barcode endpoint vẫn trả `import_price` (đã rào token). Nên bỏ cột.
- **SEC-05** (`server.ts`): `/auth/v1/token` (proxy) không bị app rate-limit → brute-force login. Thêm limiter cho `/auth/v1`.
- **LOGIC-01** (`posOrderService.ts:56`): COGS=0 thầm lặng khi mất sản phẩm → lãi gộp ảo.
- **QA-01**: độ phủ test mỏng (318 case / ~131k dòng); thiếu test concurrency/security.
- **DEVOPS-02**: không có CI (chỉ supabase-keepalive). Nên thêm workflow chạy `tsc`+`test` khi push.

### 🟢 LOW (mở)
- **SEC-06** (`server.ts:396`): CSP `unsafe-eval`/`unsafe-inline` bật ở prod.
- **SEC-08** (`auth.ts:21`): đổi `return owner` → `return null`.
- **DATA-03** (`posOrderService.ts`): `Math.max(0,…)` che giá trị âm (P1 đã cải thiện nhẹ ở đường revenue delta).
- **CODE-01**: 8 file `.bak` commit vào git (KnowledgeManager, SettingsCenter); a11y mỏng (48 `aria-`/234 component).
- **MAINT-01/02**: revoke anon cho bảng mới; thêm `NODE_ENV` vào `.env.local`.

---

## 4. SCORING (0–100, sau kiểm chứng)

| Trục | Điểm | Ghi chú |
|---|---:|---|
| Architecture | 70 | Monolith hợp lý cho 1 cửa hàng; checkout-on-client (offline-first) là đánh đổi có chủ đích |
| Backend/API | 80 | requireAuth phủ tốt, role chắc; vài endpoint công khai thiếu rate-limit |
| Frontend | 80 | React.lazy, virtualization, design system |
| Database | 72 | RLS xác minh tốt; còn schema drift (setup.sql vs prod) cần dọn |
| Performance | 70 | Lazy/virtual tốt; load đầu ~8-10s + bundle vendor 1.3MB |
| **Security** | **72** | ↑ từ 48: 2 nỗi sợ CRITICAL xác minh đã đóng; còn SEC-01 (đã vá, chờ deploy) + vài MEDIUM |
| UI | 82 | Đồng nhất, design system |
| UX | 72 | Workflow tốt; a11y mỏng |
| Maintainability | 74 | Docs nghiệp vụ xuất sắc; .bak rác + schema drift |
| Scalability | 70 | Đủ cho 1 cửa hàng/vài POS; không đa-tenant (không cần) |
| Business Logic | 82 | WAC/COGS/trả hàng cẩn thận; DATA-02 đã sửa, còn DATA-01 |
| Testing | 60 | 318 pass; thiếu test concurrency/security |
| DevOps | 45 | Không CI, backup 0 byte, SPOF iMac, deploy thủ công |
| **TỔNG THỂ** | **72** | Hết blocker CRITICAL; còn HIGH ở DATA-01 + backup |

---

## 5. FINAL VERDICT

# 🟢 READY AFTER FIXING REQUIRED ISSUES

Không còn lỗ hổng CRITICAL phơi Internet (đã kiểm chứng thật). Hệ thống an toàn để tiếp tục vận hành. Các việc còn lại là **củng cố**, không phải blocker khẩn:

**Nên làm sớm (P1):**
1. Deploy SEC-01 + P1 DATA-02 (đã code xong, migration đã chạy prod).
2. Backup DB thật (cron `pg_dump` + test restore) — **DEVOPS-01**.
3. Vá `auth.ts:21 → return null` + thêm `NODE_ENV` vào `.env.local` — **SEC-08/MAINT-02**.

**Trong tháng (P2):**
4. Đánh giá lại DATA-01 (full RPC checkout + offline fallback).
5. SEC-04/05/06, rate-limit `/auth/v1`, thêm CI, dọn `.bak`, revoke anon cho bảng mới.

---

## 6. GHI CHÚ TRUNG THỰC VỀ PHẠM VI
- Phần Security cốt lõi được **kiểm chứng trên production thật** (query DB + đọc env tiến trình live). Đây là mức độ tin cậy cao nhất.
- Các trục Performance/Scalability/UX được đánh giá từ source + cấu trúc, **chưa đo benchmark thực tế** (load test, Lighthouse) — điểm số mang tính ước lượng kỹ thuật.
- SEC-01 và P1 DATA-02 đã code + verify ở local (tsc/test/route mount), **chưa deploy lên prod** tại thời điểm viết báo cáo.
