# Audit độc lập QA + Bảo mật — Sẵn sàng dùng thật? (đợt 2)

> **Ngày**: 2026-07-03
> **Vai trò**: Senior QA Engineer + Security Auditor (độc lập)
> **Phạm vi**: React/Vite SPA + PWA, Express backend, Supabase self-hosted, IndexedDB offline-first
> **Phương pháp**: Audit code tĩnh + test THẬT trên môi trường clone prod (KHÔNG chạm prod)
> **Nguyên tắc**: Không sửa code — chỉ audit, test, báo cáo.
> **Tiếp nối**: `QA_SECURITY_AUDIT_2026-07-02.md`. Đợt này xác minh các fix 021/022/023 + đào sâu bảo mật RLS.

---

## 0. Môi trường test đã dùng (để đối chiếu)

| Hạng mục | Giá trị |
|---|---|
| DB test | **Supabase LOCAL Docker trên MacBook** (`localhost:8000`), 11 container healthy |
| Nguồn dữ liệu | Clone đầy đủ từ prod (pg_dump 02/07): **14.873 SP, 69.736 đơn, 249 KH POS, 2 NV, 68 NCC, 1.200 dòng doanh thu, 1.079 giao dịch tồn kho** |
| App | `npm run dev` → `localhost:3000` (Express + Vite; proxy `/rest/v1` → DB local) |
| Xác nhận AN TOÀN | `.env.local` trỏ **`localhost:8000`** (đã đọc & xác nhận); không có biến nào trỏ `supabase.phucsang.com.vn`; mọi thao tác ghi chỉ chạm container Docker local. **KHÔNG kết nối prod.** |
| Tài khoản test | `admin@cfobrain.local` (role manager) — mật khẩu test `AuditTest2026!` đặt **chỉ trên DB local** (UPDATE auth.users). |
| Migration trên clone | 021, 022, 023 đã áp (xác nhận qua `schema_migrations`). |

**Đính chính đề bài (giữ nguyên từ đợt trước)**: App **KHÔNG phải Electron** — không có `electron` trong `package.json`. Đây là **Vite SPA + PWA** phục vụ bởi Express. Kịch bản "GĐ2D bản Electron" (first-run nhập credentials qua wizard, update giả lập) không áp dụng đúng nghĩa; thay bằng test tương đương (đăng nhập qua trang login, offline-first/IndexedDB, kill server).

**Dữ liệu test**: 1 SP `__OVERSELL_TEST__`, 1 đơn `HD-5BOD1`, 1 dòng `sales_records`, các row anon-write test — **đã dọn sạch** khỏi DB local sau khi test (khôi phục tồn VỚ-TRẮNG về 49).

---

## 1. KẾT LUẬN TỔNG THỂ

### 🟡→🔴 CHƯA SẴN SÀNG cho tới khi xác minh 1 lỗ hổng bảo mật trên prod

Lõi giao dịch tài chính đã **vững và được kiểm chứng thật lần nữa**: trừ kho atomic chống oversell (test 2 request đồng thời — 1 thành công, 1 bị chặn, tồn không âm), cộng dồn doanh thu atomic, bán 1 đơn end-to-end qua UI đúng số, `sales_records` nay ghi thành công (lỗi 🔴 của đợt trước ĐÃ được vá và xác nhận live). 318/318 test pass, `tsc` sạch, không lộ secret.

**NHƯNG đợt này phát hiện một vấn đề bảo mật nền tảng nghiêm trọng hơn lỗi đợt trước**: mô hình phân quyền Supabase đang dựa vào RLS, nhưng **nhiều bảng nhạy cảm có RLS policy mở cho `anon`** (`TO anon USING(true)` hoặc `TO public`), **cộng với cơ chế `DEFAULT PRIVILEGES` tự cấp `anon` full CRUD cho mọi bảng mới**. Trên clone (bản sao trung thực của prod), tôi đã **đọc + ghi + xóa thật bằng anon key** trên `pos_products`, `pos_orders`, `sales_records`, `suppliers`, `vat_documents`, `attendance_records`. Anon key này **nhúng công khai trong bundle frontend** và truy cập được qua proxy mở `/rest/v1` ngay trên domain app.

Vì rào chắn an toàn cấm kết nối prod, **tôi không thể xác nhận trạng thái grant hiện tại trên prod**. Nếu prod cũng như clone → đây là **lỗ hổng 🔴 rò rỉ + sửa đổi toàn bộ dữ liệu kinh doanh** cho bất kỳ ai vào được `app.phucsang.com.vn`. Nếu prod đã REVOKE anon (đợt 30/06) và revoke còn hiệu lực → hạ xuống 🟡 (bom nổ chậm, vì `DEFAULT PRIVILEGES` sẽ tự cấp lại khi tạo bảng mới / restore).

**→ Việc phải làm trước khi giao khách**: chạy 1 câu SQL kiểm tra trên prod (mục 🔴-1) để phân loại, rồi vá theo hướng dẫn. Đây là điều kiện chặn.

---

## 2. BẢNG LỖI / RỦI RO

### 🔴 CHẶN — phải xử lý/ xác minh trước khi dùng thật

#### 🔴-1. RLS "bật nhưng mở toang cho anon" + default-privileges tự cấp anon → nguy cơ full CRUD dữ liệu kinh doanh qua anon key công khai

> **✅ CẬP NHẬT 2026-07-03 — ĐÃ VÁ + TEST trên clone**: migration `024_lock_down_anon_rls.sql` khoá 33 bảng nội bộ (`TO authenticated` + revoke anon + gỡ default-privileges). Kiểm chứng: anon → `42501 permission denied` (đọc+ghi); authenticated (đăng nhập thật) → full quyền, bán đơn qua UI OK, console sạch; catalog công khai vẫn đọc được. ⏳ Chờ deploy lên prod + 1 bước tay `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...` (xem TODO SEC-RLS-01). Phần mô tả dưới đây giữ nguyên để ghi lại bối cảnh gốc.

- **Mô tả**: Trong Supabase, một bảng chỉ an toàn với anon khi **(a)** anon không có table-grant **HOẶC (b)** RLS bật + KHÔNG có policy nào cho anon. Trên clone hiện tại **cả hai lớp đều thủng** cho nhiều bảng nhạy cảm:
  1. **`DEFAULT PRIVILEGES` cấp anon full CRUD cho MỌI bảng mới**: `pg_default_acl` cho thấy cả `supabase_admin` lẫn `postgres` đặt `anon=arwdDxt` (INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) trên mọi bảng tương lai trong schema `public`. Đây chính là gốc rễ MAINT-01 — "bảng mới tự nhận grant anon".
  2. **RLS policy mở cho anon** trên loạt bảng nhạy cảm: `pos_orders`, `pos_products`, `pos_customers`, `sales_records` (policy `Public Access` cho `{public}`), `suppliers`, `supplier_debts`, `supplier_aliases`, `cashflow_records`, `inventory_transactions`, `attendance_records` (`{public}`), `overtime_records` (`{public}`), `staff_performance` (`{public}`), toàn bộ nhóm `vat_*`, `tax_filing_periods`, `system_configs`, `app_state`… — đều `USING(true) WITH CHECK(true)`.
  3. **Proxy `/rest/v1` mở, không auth** ([server.ts:464](server.ts)): forward thẳng mọi header `apikey`/`Authorization` client gửi tới Kong. Rate-limiter chỉ áp `/api/*`, **KHÔNG áp `/rest/v1`**.
  4. **Anon key nhúng công khai**: `VITE_SUPABASE_ANON_KEY` được Vite inline vào bundle → ai tải trang cũng lấy được.
- **Kiểm chứng THẬT trên clone (an toàn, đã dọn)** — dùng chính anon key trong `.env.local`, gọi thẳng `http://localhost:8000/rest/v1/...`:
  - `GET pos_orders` → **200 + dữ liệu đơn thật** (mã đơn, khách, tiền). Tương tự `sales_records`, `suppliers`, `vat_documents`, `attendance_records` đều trả dữ liệu thật.
  - `POST pos_products` (payload hợp lệ) → **201 Created** (row vào DB); `PATCH` → **204**; `DELETE` → **204**. Anon **tạo/sửa/xóa được sản phẩm**.
  - Vài bảng CÓ được bảo vệ (anon trả `[]` — policy chỉ cho authenticated): `customers`, `employees`, `payroll_records`, `revenue_records`, `expense_records`, `audit_logs`. → chứng minh mô hình "policy authenticated-only" chặn được anon, nhưng phần lớn bảng khác chưa làm vậy.
- **Cơ chế lây sang prod**: `scripts/sync-prod-to-dev.sh` dùng `pg_dump ... --clean --if-exists` **không** `--no-acl` → grant/policy trên clone sao y prod. Việc clone (đồng bộ 02/07, SAU đợt REVOKE 30/06) vẫn đầy grant anon cho thấy: hoặc prod vẫn còn grant, hoặc `DEFAULT PRIVILEGES` tự cấp lại khi restore — cả hai đều nói lên rằng cách "REVOKE từng bảng" của đợt 30/06 **không bền**.
- **Hậu quả nếu prod giống clone**: bất kỳ ai mở `app.phucsang.com.vn` (hoặc `supabase.phucsang.com.vn`) → trích anon key từ bundle → `curl /rest/v1/pos_orders` đọc sạch doanh thu/khách hàng, hoặc `DELETE /rest/v1/pos_products` xóa toàn bộ sản phẩm. **Mất dữ liệu + rò rỉ toàn diện.**
- **Vị trí**: `pg_default_acl` (DB), `pg_policies` các bảng liệt kê trên, [server.ts:464](server.ts) (proxy `/rest/v1`).
- **XÁC MINH NGAY TRÊN PROD** (chỉ đọc, an toàn — chạy trong SQL editor prod):
  ```sql
  -- (1) Bảng nào anon còn grant?
  SELECT table_name, string_agg(privilege_type, ',') AS privs
  FROM information_schema.role_table_grants
  WHERE grantee = 'anon' AND table_schema = 'public'
  GROUP BY table_name ORDER BY table_name;

  -- (2) Policy nào đang mở cho anon/public?
  SELECT tablename, policyname, roles, cmd
  FROM pg_policies
  WHERE schemaname='public' AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%')
  ORDER BY tablename;

  -- (3) Test thực tế bằng anon key thật (thay <ANON_KEY>):
  --   curl 'https://supabase.phucsang.com.vn/rest/v1/pos_orders?select=id&limit=1' \
  --        -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <ANON_KEY>'
  --   → trả [] hoặc 401 = an toàn; trả dữ liệu = LỖ HỔNG XÁC NHẬN.
  ```
- **Đề xuất sửa (gốc rễ, không whack-a-mole)**:
  1. **Đổi mọi policy `TO anon`/`TO public` trên bảng nội bộ → `TO authenticated`** (RLS thành hàng rào thật, độc lập với grant). Giữ ngoại lệ có chủ đích cho storefront công khai (`store_products`/`store_product_variants` chỉ SELECT `is_published=true`).
  2. **Sửa default privileges**: `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;` (cho cả `postgres` và `supabase_admin`) → bảng mới không tự mở cho anon.
  3. **REVOKE ALL ... FROM anon** trên các bảng nội bộ hiện có (bổ sung, phòng thủ nhiều lớp).
  4. Cân nhắc đặt auth nhẹ ở proxy `/rest/v1` hoặc chỉ cho anon các path storefront cần thiết.
- **Ghi chú so với đợt 30/06**: audit 30/06 xử lý ở tầng **grant** cho bảng tài chính nặng, nhưng **không đụng các permissive policy** và không sửa default-privileges → mô hình vẫn dựa vào một lớp duy nhất (grant) mà chính lớp đó tự phục hồi cho anon.

---

### 🟡 NÊN SỬA SỚM — ảnh hưởng vận hành / rủi ro trung bình

#### 🟡-2. Fallback tồn kho không atomic ở mức nhiều-bước (đã giảm rủi ro nhờ 022 nhưng đường fallback vẫn còn)

- **Trạng thái**: Migration 022 đã áp `apply/delete_inventory_transaction_with_stock_v2` lên clone (xác nhận: hàm tồn tại, có nhánh `Sale`/`Return`, có guard `Insufficient`). Route `/api/data/inventory/apply` nay gọi `_v2` TRƯỚC ([routes/data.ts:559](routes/data.ts)) → mọi đơn dùng RPC 1-transaction atomic. Landmine "legacy thiếu nhánh Sale/Return" đã vô hiệu hoá.
- **Còn lại**: đường `applyInventoryTransactionFallback` vẫn tồn tại cho trường hợp `_v2` lỗi `42883` (không tồn tại). Trên clone `_v2` đã có nên không đi vào fallback; nhưng nếu prod chưa áp 022 khi deploy, hành vi sẽ khác. → Đảm bảo 022 chạy trên prod ở lần deploy kế (đã nằm trong cơ chế `apply-migrations.sh`).
- **Đề xuất**: Sau deploy, xác minh `_v2` tồn tại trên prod (`SELECT proname FROM pg_proc WHERE proname LIKE '%_v2'`).

#### 🟡-3. Import Excel: fix per-row đã có trong code, chưa test upload file thật

- **Trạng thái**: Đã đọc diff [routes/import.ts](routes/import.ts): (a) vệ sinh field số `NaN→0` trước khi build parent; (b) khi batch upsert lỗi → **retry từng dòng để cô lập dòng hỏng**, dòng hợp lệ vẫn ghi, trả `rowErrors[]` (tối đa 50). Logic đúng và đã wire vào response.
- **Chưa kiểm live**: chưa upload file `.xlsx` thật có dòng lỗi trộn dòng đúng (cần file đúng format KiotViet + auth session). Khuyến nghị user tự test với file mẫu 5 dòng (2 dòng thiếu cột/sai số).
- **Vị trí**: [routes/import.ts:487](routes/import.ts), [routes/import.ts:578](routes/import.ts).

#### 🟡-4. Đối soát doanh thu: bảng tổng hợp còn lệch live orders (~2% tháng 6)

- **Kiểm chứng**: Net T6/2026 tính độc lập từ `pos_orders` (công thức `calcOrderRevenue`) ≈ **233,7M** vs `revenue_records` = **238,0M** → lệch ~**4,3M (~1,8%)**. Đây là vấn đề **đối soát báo cáo**, KHÔNG phải lỗi toàn vẹn giao dịch (đơn gốc đúng).
- **Nguyên nhân đã biết**: LOGIC-02 (endpoint `recalculate-revenue-from-orders` — đã sửa trong working tree, ⏳ chờ deploy) + DATA-04 (3 dòng ngày rác 109,9M). Sau khi deploy LOGIC-02 và chạy đối soát lại → drift sẽ hết.
- **Vị trí**: [routes/data.ts:994](routes/data.ts).

#### 🟡-5. Tải đầu (cold-load) chậm trên máy mới (~10s)

- **Kiểm chứng**: Query DB rất nhanh (count 14.873 SP = **7ms**; page 1.000 dòng = **3ms**) → nút thắt KHÔNG ở DB mà ở **~15 request phân trang qua mạng/tunnel** lúc chưa có IndexedDB cache. Đo prod trước ghi ~9–10s cho máy mới; các lần sau nhanh nhờ cache.
- **Đề xuất**: task "Lazy load DATA" (tách `fetchCriticalData`/`fetchDeferredData`) đã có kế hoạch. Không chặn dùng thật.

---

### 🟢 CÓ THỂ ĐỂ SAU

- **🟢-6. Bán âm kho (opt-in) đường fallback không atomic**: khi bật `allowSellOutOfStock`, `adjustProductStock` đọc-rồi-ghi → có thể race nếu 2 máy cùng bán âm 1 SP. Chỉ ảnh hưởng khi cửa hàng CHỦ ĐỘNG bật cho bán âm. [routes/data.ts:187](routes/data.ts).
- **🟢-7. Polling health/bot-status dày**: network trace đầy `HEAD /health` (keep-alive) + `/api/shopee-bot-status`. Đã miễn trừ rate-limit + giãn poll ở đợt trước; theo dõi thêm về pin/băng thông máy quầy.
- **🟢-8. `sales_records` gỡ FK `employee_id`**: migration 021 gỡ FK để cho người bán ngoài roster (chủ/admin). Đánh đổi: không còn ràng buộc referential — `employee_id` có thể trỏ nhân viên đã xóa. Chấp nhận được (khớp `pos_orders.staff_id` vốn text tự do), nhưng ghi nhận để biết.

---

## 3. ĐÃ KIỂM TRA VÀ ĐẠT (yên tâm)

### Toàn vẹn dữ liệu — kiểm chứng THẬT đợt này
- ✅ **Chống oversell (đồng thời)**: bắn **2 lệnh `decrement_product_stock` song song** trên SP tồn=1 → req1 trả 1 row (bán được), req2 trả **0 row** (bị chặn), tồn cuối = 0, **không âm**. Guard SQL `WHERE stock >= quantity` đảm bảo atomic dù nhiều request.
- ✅ **Bán 1 đơn end-to-end qua UI (browser thật)**: chọn VỚ-TRẮNG → giỏ 20.000đ → thanh toán tiền mặt → **tồn 49→48**, đơn `HD-5BOD1` tạo (total 20.000, staff Ngô Thành Du), **console SẠCH** (không còn "LỖI ĐỒNG BỘ"), không network fail (ngoài `HEAD /health` keep-alive benign).
- ✅ **🔴 đợt trước (POS-SALES-01) ĐÃ VÁ — xác nhận live**: sau đơn trên, `sales_records` ghi thành công dòng **`pos-sales-2026-07-03-ngo-thanh-du`** (amount 20.000) nhờ migration 021 (`id` UUID→TEXT). Trước đây 0/N dòng ghi được → nay ghi OK, hết cờ mất-kết-nối giả → **hết nguy cơ thu ngân bán trùng**.
- ✅ **RPC tồn kho v2 đầy đủ nhánh (022)**: xác nhận trên DB `apply_inventory_transaction_with_stock_v2` tồn tại, có nhánh `Sale`/`Return`, có guard `Insufficient` (chống bán quá tồn ở tầng DB).
- ✅ **Edge-case clamp (đọc code)**: SL kẹp `min(maxQty, max(1, qty))` (SL=0→1, không vượt tồn); giảm giá kẹp `min(max(0, discount), price)` (giảm 100% = miễn phí, net không âm); `orderNetRevenue = max(0, total - discount)`; chặn thêm giỏ khi `qtyInCart >= stock`. Đường hoàn hàng (`processReturnOrder`) dùng nhánh `Return` của RPC (cộng kho lại) + `totalSpent = max(0, ...)`.
- ✅ **Query hiệu năng DB**: 14.873 SP đếm 7ms, page 1.000 dòng 3ms — DB không phải nút thắt.

### Bảo mật
- ✅ **Không lộ secret**: `.env.local` đã `.gitignore` (xác nhận `git check-ignore`), không bị track; **git history KHÔNG chứa service key / anon service_role / `sk-ant` thật** (các match chỉ là placeholder tài liệu `sk-ant-xxx`).
- ✅ **DOMPurify phủ 100% điểm render HTML**: 13 điểm `dangerouslySetInnerHTML`, **tất cả** đều nằm trong file có `DOMPurify.sanitize` (quét tự động không tìm ra điểm nào thiếu sanitize).
- ✅ **requireAuth phủ router mutate**: mọi `create*Router` nhận `requireAuth` ([server.ts:582-596](server.ts)); `store.ts` công khai CÓ CHỦ ĐÍCH (đặt hàng website không login); upload ảnh dùng token QR riêng.
- ✅ **Mô hình policy authenticated-only CHẶN được anon** (đối chứng): `customers`, `employees`, `payroll_records`, `revenue_records`, `expense_records`, `audit_logs` → anon trả `[]`. Đây là bằng chứng cách vá đúng cho 🔴-1 sẽ hiệu quả.

### Xử lý lỗi
- ✅ **try/catch + rollback** quanh checkout (`rollbackSteps[]`); `autoUpsertStaffSalesForDate` bọc try/catch "non-critical" (nay không còn ném lỗi nhờ 021).
- ✅ **Offline queue** (`posOfflineQueue` + IndexedDB): phân loại lỗi retry-được qua `isRetryableSyncError`, enqueue replay.
- ✅ **318/318 test pass**; **`tsc --noEmit` sạch**.

---

## 4. CHƯA KIỂM TRA ĐƯỢC (giới hạn môi trường / rào chắn an toàn)

- ⛔ **Trạng thái grant/policy anon THỰC TẾ trên prod (🔴-1)**: KHÔNG kết nối prod theo rào chắn. **Đây là việc cần user tự chạy 3 câu SQL ở mục 🔴-1 để phân loại 🔴 hay 🟡.** Đây là điểm chặn quan trọng nhất của báo cáo.
- ⚠️ **Import Excel dòng lỗi trộn dòng đúng (🟡-3)**: đã xác minh CODE (per-row retry), chưa upload file `.xlsx` thật. Khuyến nghị user test file mẫu 5 dòng (2 dòng hỏng) → kỳ vọng: dòng đúng vẫn ghi, response có `rowErrors[]` liệt kê dòng hỏng.
- ⚠️ **Ngắt mạng vật lý giữa lúc lưu đơn**: đã xác minh ĐƯỜNG CODE offline queue (retry classification + enqueue) nhưng chưa cắt wifi giữa 1 checkout live. Khuyến nghị user: bật máy bay mode giữa lúc bấm "Xác nhận" → kiểm tra đơn vào queue, không mất/không trùng khi có mạng lại.
- ⚠️ **Kill process giữa checkout**: chưa kill server giữa 1 checkout đang chạy. Thiết kế offline-first (ghi IndexedDB TRƯỚC cloud) là cơ chế chịu lỗi cho case này, nhưng chưa mô phỏng trực tiếp.
- ⚠️ **2 cửa sổ browser thật đồng thời**: đã test atomic ở tầng RPC (nghiêm ngặt hơn — cả 2 request đồng thời không cùng trừ 1 tồn=1). Chưa mở 2 tab UI bấm bán song song.
- N/A **Electron** (first-run wizard credentials, update giả lập): app không phải Electron. Flow đăng nhập lần đầu = trang login (hoạt động OK).

---

## 5. THỨ TỰ ƯU TIÊN XỬ LÝ (đề xuất)

1. **🔴-1** — Chạy 3 câu SQL kiểm tra anon trên prod NGAY. Nếu anon đọc/ghi được bảng nội bộ → **CHẶN giao khách**, vá bằng: đổi policy `TO authenticated` + `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM anon` + REVOKE bảng hiện có. (~2–4h)
2. **🟡-2** — Xác minh `_v2` tồn tại trên prod sau khi deploy 022.
3. **🟡-4** — Deploy LOGIC-02 rồi chạy đối soát doanh thu (hết drift ~2%).
4. **🟡-3** — Test upload Excel dòng lỗi thật (xác nhận fix per-row).
5. **🟡-5 / 🟢** — Lazy-load data + các mục 🟢 để sau.

---

## 6. So với đợt audit 2026-07-02

| Hạng mục | 02/07 | 03/07 (đợt này) |
|---|---|---|
| 🔴 POS-SALES-01 (sales_records lỗi mọi đơn) | Phát hiện | **ĐÃ VÁ (021) — xác nhận live: đơn ghi `pos-sales-*` OK, console sạch** |
| 🟡 RPC tồn kho `_v2` thiếu | Phát hiện | **ĐÃ ÁP (022) — v2 đủ nhánh Sale/Return + guard** |
| 🟡 Anon/RLS storefront | Nghi ngờ, chưa rõ | **Đào sâu: 023 đóng 7 bảng storefront; NHƯNG phát hiện lỗ lớn hơn (🔴-1) ở bảng tài chính/HR/NCC + default-privileges** |
| Oversell atomic | Test tuần tự | **Test ĐỒNG THỜI (2 request song song) — chặn đúng** |
| Bán end-to-end | Đã test | **Test lại — xác nhận fix 021 sạch console** |

**Kết luận đợt này**: Các lỗi đợt trước đã được vá tốt và xác nhận. Nhưng đợt đào sâu bảo mật cho thấy mô hình phân quyền anon/RLS là rủi ro nền tảng lớn nhất còn lại — **phải xác minh + vá trên prod trước khi coi là sẵn sàng dùng thật**.

---

*Báo cáo bởi audit độc lập. Không sửa code trong phiên này theo yêu cầu. Dữ liệu test đã dọn sạch khỏi DB local.*
