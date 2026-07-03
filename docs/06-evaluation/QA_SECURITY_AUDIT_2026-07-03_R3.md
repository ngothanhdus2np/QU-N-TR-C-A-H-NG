# Audit độc lập QA + Bảo mật — Sẵn sàng dùng thật? (đợt 3 / xác minh chéo)

> **Ngày**: 2026-07-03
> **Vai trò**: Senior QA Engineer + Security Auditor (độc lập)
> **Phạm vi**: React/Vite SPA + PWA, Express backend, Supabase self-hosted, IndexedDB offline-first
> **Phương pháp**: Audit code tĩnh + test THẬT trên clone prod (KHÔNG chạm prod) + kiểm chứng lại các claim của đợt 02/07 và 03/07
> **Nguyên tắc**: KHÔNG sửa code — chỉ audit, test, báo cáo.
> **Điểm khác đợt trước**: Tự bắn anon key vào clone để xác minh 024 (không tin báo cáo cũ); test LIVE import Excel dòng lỗi; quét lại git history đúng cách (đợt trước bỏ sót); đọc thẳng orchestration checkout.

---

## 0. Môi trường test (để đối chiếu)

| Hạng mục | Giá trị |
|---|---|
| DB test | **Supabase LOCAL Docker** (`localhost:8000`), 11 container healthy (uptime 11h) |
| Nguồn dữ liệu | Clone prod (pg_dump 02/07): **14.873 SP, 69.736 đơn, 249 KH, 68 NCC** |
| App | `npm run dev` → `localhost:3000` (Express + Vite; proxy `/rest/v1` → DB local) |
| Xác nhận AN TOÀN | `.env.local` → `VITE_SUPABASE_URL=http://localhost:8000` + `SUPABASE_URL=http://localhost:8000` (đã đọc trực tiếp). KHÔNG biến nào trỏ `supabase.phucsang.com.vn` / `*.supabase.co`. Mọi thao tác ghi chỉ chạm container Docker local. **KHÔNG kết nối prod.** |
| Migration trên clone | 021, 022, 023, **024** đã áp (xác nhận qua `schema_migrations`, 24 dòng) |
| tsc / test | `tsc --noEmit` **sạch**; **318/318 test pass** |

**Đính chính (giữ từ đợt trước)**: App **KHÔNG phải Electron** (`package.json` không có electron) — là Vite SPA + PWA phục vụ bởi Express. Kịch bản "GĐ2D Electron" thay bằng test tương đương (login qua trang, offline-first, virtualization).

**Dữ liệu test đã dọn**: 4 SP `AUDIT-*` (import test) đã xóa; count về đúng 14.873. Row anon-INSERT bị chặn (không tạo được). **Ngoại lệ cần biết**: SP `SP010239` trên clone bị để `stock=0` do test oversell đồng thời (chỉ clone local — prod KHÔNG đụng; clone sẽ ghi đè ở lần `sync-prod-to-dev.sh` kế).

---

## 1. KẾT LUẬN TỔNG THỂ

### 🟡 DÙNG ĐƯỢC NHƯNG CÓ RỦI RO — chưa nên giao khách cho tới khi đóng 3 việc ở tầng deploy/secrets (KHÔNG phải lõi giao dịch)

**Tin tốt — lõi giao dịch tài chính đã vững và được kiểm chứng THẬT lần nữa (độc lập):**
- Trừ kho chống oversell **atomic thật** — test 2 lệnh song song trên tồn=1: 1 thành công (1→0), 1 khớp 0 row, tồn cuối = 0 **không âm**.
- RPC tồn kho `_v2` đủ nhánh Sale/Return/Import/PurchaseReturn/Check, guard `Insufficient`, chỉ `authenticated` gọi được.
- **Migration 024 (khoá anon) hoạt động THẬT trên clone**: anon key công khai → `42501 permission denied` cho cả đọc lẫn ghi trên `pos_products/pos_orders/sales_records/suppliers`; bảng HR/tài chính (`customers/employees/payroll_records/revenue_records/audit_logs`) → anon trả `[]`; catalog công khai `store_products` vẫn 200 (đúng chủ đích).
- **Import Excel dòng lỗi (test LIVE)**: 2 dòng đúng + 2 dòng số hỏng (`"abc"`, `"1.2.3"`, `"xyz"`, rỗng) → **cả 4 dòng ghi được**, số hỏng ép về 0, dòng đúng giữ nguyên giá/tồn, `errors:0`, batch KHÔNG vỡ. IMPORT-01 xác nhận hoạt động.
- Error-handling không nuốt lỗi: retry classifier (network/401/timeout/429/5xx), timeout 45s có message, badge `syncErrors` trên TopNav.
- 318/318 test, tsc sạch, DOMPurify phủ 100%, `.env.local` đã gitignore.

**Rủi ro còn lại — KHÔNG nằm ở logic giao dịch mà ở tầng nền tảng/vận hành:**
1. **🔴/🟡 (mới, đợt trước bỏ sót) — service_role JWT của project Supabase hosted cũ (`tqouzxlnihfjdyxqlbqs.supabase.co`) nằm trong GIT HISTORY.** service_role bypass toàn bộ RLS. Nếu project đó còn sống + key chưa thu hồi + repo được chia sẻ → rò rỉ toàn quyền. Cần xác minh + thu hồi.
2. **🟡 Gốc rễ MAINT-01 CHƯA đóng hẳn**: default-privileges của grantor `supabase_admin` VẪN cấp anon full CRUD cho bảng tương lai (024 chỉ gỡ được cho grantor `postgres`). Bảng mới tạo qua Studio sẽ tự mở cho anon.
3. **🟡 `schema_migrations` RLS OFF + anon full grant** — anon đọc/ghi/xóa được sổ migration (kiểm chứng live: `GET` trả 200 + dữ liệu).
4. **🟡 Checkout web POS không phải 1 transaction DB** (saga bù trừ tầng app — DATA-01) → có cửa sổ lệch nếu rollback tự fail.
5. **🟡 Login `/auth/v1` không rate-limit ở tầng app** (chỉ `/api/auth/register` có) → brute-force chỉ dựa vào giới hạn nội bộ GoTrue.
6. **🟡 Drift đối soát doanh thu** ~1,9% T6 (LOGIC-02, chờ deploy) + **DATA-04** 3 dòng năm rác (109,9M) làm phồng tổng all-time.

**Điều kiện để coi là SẴN SÀNG**: (a) deploy 024 + chạy 1 bước tay `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ... REVOKE ... FROM anon` trên prod, xác minh anon bị chặn thật; (b) xác minh project `tqouzxlnihfjdyxqlbqs` đã ngừng/thu hồi service_role key (+ scrub git history nếu repo chia sẻ); (c) khoá `schema_migrations`. Các mục còn lại (DATA-01, rate-limit login, LOGIC-02/DATA-04) là 🟡 — nên sửa sớm nhưng không chặn nếu chấp nhận rủi ro có kiểm soát.

---

## 2. BẢNG LỖI / RỦI RO

### 🔴 / 🟡 — cần xử lý/xác minh trước khi giao khách

#### 🔴-A (mới). service_role JWT project cũ `tqouzxlnihfjdyxqlbqs` lộ trong GIT HISTORY

- **Mô tả**: Từ commit đầu `66ecc7a` (2026-05-05, `server.ts` + `services/supabase.ts`) và các script Python, cả **anon key lẫn service_role key** của project hosted `tqouzxlnihfjdyxqlbqs.supabase.co` được hardcode. Về sau đã gỡ khỏi code (`2a241ab`, `81675ad`) nhưng **vẫn còn trong lịch sử git** (bản chất git: gỡ khỏi HEAD không xoá khỏi history). `git log --all -p | grep` trích ra được JWT `...role":"service_role"...ref":"tqouzxlnihfjdyxqlbqs"...` (exp `2085703971` = năm 2036 → còn hạn rất lâu).
- **HEAD hiện tại**: chỉ còn **project ref/URL** trong `.kiro/DEPLOY_NOW.md`, `.kiro/QUICK_START.md` (dashboard URL + connection string với `[YOUR-PASSWORD]` placeholder) — KHÔNG có JWT thật trong file tracked. Nên rủi ro là ở **history**, không phải HEAD.
- **Hậu quả nếu project còn sống + key chưa thu hồi**: bất kỳ ai có bản clone repo (kể cả history) → trích service_role key → bypass RLS, đọc/ghi toàn bộ project `tqouzxlnihfjdyxqlbqs`. service_role là "chìa khoá chúa" — RLS không chặn được.
- **Chưa xác minh được (rào chắn)**: KHÔNG thử key vào `tqouzxlnihfjdyxqlbqs.supabase.co` vì đó là project Supabase thật có thể chứa dữ liệu thật. Cần USER tự kiểm.
- **Vị trí**: git history (commit `66ecc7a` trở đi); ref còn ở `.kiro/DEPLOY_NOW.md`, `.kiro/QUICK_START.md`.
- **Việc cần làm**:
  1. Vào Supabase dashboard kiểm project `tqouzxlnihfjdyxqlbqs`: **còn tồn tại không?** Nếu còn → **rotate service_role + anon key ngay** (Settings → API → Reset), hoặc **xoá hẳn project** nếu đã migrate sang self-hosted.
  2. Nếu repo được share (GitHub/GitLab/nhiều máy) → scrub history (`git filter-repo` hoặc BFG) rồi force-push; nếu repo chỉ ở máy cá nhân → rủi ro thấp hơn nhưng vẫn nên rotate.
  3. Gỡ nốt ref khỏi `.kiro/*.md` (dọn thông tin thừa).
- **Phân loại**: 🔴 nếu (project còn sống HOẶC repo được chia sẻ công khai); 🟡 nếu project đã xoá VÀ repo chỉ nằm trên máy cá nhân. → USER phân loại bằng bước 1.

#### 🟡-B (mới). Default-privileges của `supabase_admin` vẫn tự cấp anon full CRUD cho bảng tương lai (gốc rễ MAINT-01 chưa đóng hẳn)

- **Kiểm chứng**: `pg_default_acl` trên clone cho thấy grantor `supabase_admin` vẫn còn dòng `anon=arwdDxt/supabase_admin` (INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) cho mọi bảng mới trong schema `public`. Grantor `postgres` thì đã **hết** anon ở default table-priv (024 gỡ được phần này).
- **Ý nghĩa**: Migration 024 chạy dưới role `postgres` → KHÔNG sửa được default-priv của grantor `supabase_admin` (phải là superuser/`supabase_admin` mới sửa). Supabase Studio và phần lớn tooling tạo bảng **dưới `supabase_admin`** → bảng mới sẽ **tự cấp anon full CRUD**. Đây đúng là "bom nổ chậm" MAINT-01: hôm nay 024 khoá 33 bảng hiện có, nhưng bảng #34 tạo qua Studio sẽ lại mở cho anon nếu quên khoá tay.
- **Vị trí**: `pg_default_acl` (DB, grantor `supabase_admin`).
- **Đề xuất**: Chạy **dưới quyền `supabase_admin`/superuser** trên prod: `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;` (đúng câu đã ghi trong TODO SEC-RLS-01 nhưng migration 024 phải skip). Đây là mảnh còn thiếu để 024 thật sự "gốc rễ".

#### 🟡-C (mới). `schema_migrations` RLS OFF + anon full grant → anon đọc/ghi/xoá sổ migration

- **Kiểm chứng LIVE**: `curl /rest/v1/schema_migrations` bằng anon key → **HTTP 200 + dữ liệu** (`002_enable_rls...`, `003_tenant_isolation...`). Bảng có RLS = OFF và anon giữ full grant (INSERT/DELETE/TRUNCATE) → anon có thể **xoá/chèn/truncate** sổ migration.
- **Hậu quả**: Không phải dữ liệu kinh doanh, nhưng nếu anon TRUNCATE `schema_migrations` → lần deploy kế, `apply-migrations.sh` tưởng chưa migration nào chạy → **chạy lại toàn bộ** (đa số idempotent nhờ `IF EXISTS`/`CREATE OR REPLACE`, nhưng rủi ro + gây rối). Cũng lộ cấu trúc lịch sử schema.
- **Vị trí**: bảng `public.schema_migrations` (RLS off, anon grant).
- **Đề xuất**: `ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY; REVOKE ALL ON schema_migrations FROM anon;` (không cần policy — chỉ backend service-role đụng bảng này).

#### 🟡-D. Checkout web POS không phải 1 transaction DB (saga bù trừ — DATA-01)

- **Mô tả**: `processPlaceOrder` ([services/posOrderService.ts:240-345](../../services/posOrderService.ts)) ghi đơn qua **4–5 lời gọi riêng lẻ**, mỗi cái là 1 transaction DB độc lập: (1) insert `pos_orders`; (2) RPC tồn kho atomic (insert inventory_tx + trừ kho); (3) update customer + `customer_debt_history`; (4) RPC `apply_revenue_delta`; (5) staff sales + audit (best-effort). Chúng KHÔNG nằm trong 1 transaction chung — thay vào đó có **rollback bù trừ ở tầng app** (`rollbackSteps[]`).
- **Rủi ro**: Mỗi bước atomic riêng, nhưng nếu bước 4 (doanh thu) lỗi thì code rollback bước 3→2→1 — **mỗi rollback lại là 1 network call có thể tự fail**. Nếu mạng rớt giữa lúc rollback (mà nguyên nhân bước 4 lỗi thường CHÍNH LÀ mạng) → rollback dở dang → trạng thái lệch: ví dụ đơn đã xoá nhưng tồn kho KHÔNG hoàn lại (mất tồn ảo), hoặc đơn còn nhưng doanh thu không cộng.
- **Giảm nhẹ sẵn có**: thiết kế offline-first (ghi IndexedDB trước, queue replay) che phần lớn case "mạng rớt"; từng bước atomic; guard tồn kho ở DB. Nên rủi ro là **hiếm + biên**, không phải thường trực.
- **Vị trí**: [services/posOrderService.ts:270-345](../../services/posOrderService.ts).
- **Đề xuất (đã có kế hoạch P2)**: gộp checkout web POS vào 1 RPC transaction giống `pos_mobile_checkout` (POS Mobile đã làm đúng). Chưa chặn dùng thật vì hiếm gặp và có offline-first đỡ.

#### 🟡-E (mới). Login `/auth/v1` không rate-limit ở tầng app

- **Kiểm chứng**: `apiLimiter` mount `/api/` ([server.ts:442](../../server.ts)); `authLimiter` (20 req/15ph) chỉ mount `/api/auth/register` ([server.ts:443](../../server.ts)). Proxy Supabase `/auth/v1` + `/rest/v1` + `/storage/v1` ([server.ts:464](../../server.ts)) **không qua limiter nào**. Đường login thật của app là GoTrue `/auth/v1/token` → không bị app chặn brute-force.
- **Hậu quả**: credential-stuffing/brute-force mật khẩu chỉ bị giới hạn bởi rate-limit nội bộ của GoTrue (có mặc định nhưng nới). Với app dùng thật cho cửa hàng, nên có thêm lớp chặn.
- **Vị trí**: [server.ts:442-443, 464](../../server.ts).
- **Đề xuất**: thêm limiter cho `/auth/v1/token` (vd 10–20 lần/15ph/IP) hoặc siết cấu hình GoTrue.

#### 🟡-F. Đối soát doanh thu lệch ~1,9% T6 (LOGIC-02) + DATA-04 dòng năm rác

- **Kiểm chứng độc lập (SQL vs công thức app)**:
  - T6/2026 từ `pos_orders`: gross (đơn bán) = **238.009.000**, trả = **4.535.000** → net = **233.474.000**.
  - `revenue_records` T6: net = **238.009.000** (chỉ ghi 570.000 tiền trả thay vì 4.535.000) → **lệch ~4,5M (~1,9%)**.
  - **DATA-04**: 3 dòng năm rác `137519-06-26 / 92401-07-06 / 77063-10-04` (created 06/06), net = 49.449.000 + 33.031.000 + 27.453.000 = **109.933.000**. Nằm ngoài range báo cáo tháng nhưng **lọt vào all-time**: tổng net all-time = 15.042.976.804 vs trong-range = 14.933.043.804 (lệch đúng 109,933M).
- **Bản chất**: vấn đề **đối soát báo cáo**, KHÔNG phải lỗi toàn vẹn giao dịch (đơn gốc trong `pos_orders` đúng).
- **Vị trí**: [routes/data.ts](../../routes/data.ts) endpoint `recalculate-revenue-from-orders` (LOGIC-02 đã sửa trong working tree, ⏳ chờ deploy); DATA-04 chờ user xác nhận ngày đúng.
- **Đề xuất**: deploy LOGIC-02 → chạy đối soát lại (hết ~1,9%); DATA-04 sửa/xoá 3 dòng năm rác sau khi user xác nhận số gốc.

### 🟢 CÓ THỂ ĐỂ SAU

- **🟢-G. Bán âm kho (opt-in) đường fallback không atomic**: khi bật `allowSellOutOfStock`, đường đọc-rồi-ghi có thể race nếu 2 máy cùng bán âm 1 SP. Chỉ ảnh hưởng khi CHỦ ĐỘNG bật cho bán âm.
- **🟢-H. `sales_records` gỡ FK `employee_id` (021)**: cho người bán ngoài roster (chủ/admin) nhưng mất ràng buộc referential — `employee_id` có thể trỏ NV đã xoá. Chấp nhận được (khớp `pos_orders.staff_id` text tự do).
- **🟢-I. Polling health/bot-status dày** + `express.json({ limit: '30mb' })` lớn trên proxy (cần cho upload Excel base64) — theo dõi băng thông/pin máy quầy.

---

## 3. ĐÃ KIỂM TRA VÀ ĐẠT (yên tâm) — kiểm chứng THẬT đợt này

### Toàn vẹn dữ liệu
- ✅ **Oversell đồng thời**: 2 `UPDATE ... WHERE stock>=qty` song song trên tồn=1 → 1 trả `UPDATE 1`, 1 trả `UPDATE 0`, tồn cuối = 0 (không âm). Guard atomic đúng dù nhiều request.
- ✅ **RPC v2 đủ nhánh + guard**: đọc source 022 — Sale (`WHERE stock>=qty` hoặc allow_negative), Return (cộng lại), Import (cộng + ghi cost_history), PurchaseReturn/Check; `RAISE EXCEPTION 'Insufficient stock'`; grant EXECUTE chỉ `authenticated`.
- ✅ **Import Excel dòng lỗi (LIVE)**: POST `/api/import/kiotviet-products` file 4 dòng (2 đúng + 2 số hỏng) → `{imported:4, errors:0, rowErrors:[]}`; DB: dòng đúng giữ giá 100k/200k, dòng hỏng ép về 0. Batch không vỡ. Logic per-row retry ([routes/import.ts:584-610](../../routes/import.ts)) đúng.

### Bảo mật
- ✅ **024 khoá anon THẬT trên clone**: anon → `42501` (đọc+ghi) trên `pos_products/pos_orders/sales_records/suppliers`; catalog `store_products` anon vẫn 200.
- ✅ **Bảng HR/tài chính chặn anon qua RLS**: `customers/employees/payroll_records/revenue_records/expense_records/audit_logs/advance_records/salary_policies/customer_debt_history` — RLS bật + policy authenticated-only + 0 policy anon → anon trả `[]` (grant còn nhưng RLS vô hiệu hoá).
- ✅ **`.env.local` gitignore** (`git check-ignore` = ignored, không track). Không có JWT thật trong file tracked HEAD.
- ✅ **DOMPurify phủ**, **requireAuth phủ router mutate**, RPC/route nhạy cảm dùng service-role backend.

### Xử lý lỗi
- ✅ **Không nuốt lỗi im lặng ở đường quan trọng**: `isRetryableSyncError` ([useAppData.ts:282](../../hooks/useAppData.ts)) phân loại network/401/timeout/429/5xx; `fetchWithTimeout` Promise.race 45s có message tiếng Việt; badge `syncErrors` phân loại trên TopNav. Các `catch {}` rỗng (≈15 chỗ) đều quanh `localStorage`/best-effort — vô hại.
- ✅ **Rollback checkout** có `rollbackSteps[]` đảo thứ tự; staff-sales tách khỏi main try (không rollback cả đơn khi lỗi phụ).

### Hiệu năng / tải
- ✅ **Trang danh sách 14.873 SP**: render không đơ, dùng **virtualization** (chỉ ~50 DOM row cho toàn list), phân trang hiển thị "… / 14.8xx hàng hóa".
- ✅ **Tìm kiếm** trên full dataset: ~380ms (có debounce) — chấp nhận được.
- ✅ **Query DB nhanh** (đợt trước: count 14.873 = 7ms, page 1000 = 3ms) → nút thắt cold-load là round-trip mạng, không phải DB.
- ✅ **tsc sạch, 318/318 test pass**, server dev restart sạch không lỗi build/runtime.

---

## 4. CHƯA KIỂM TRA ĐƯỢC (rào chắn an toàn / giới hạn môi trường)

- ⛔ **Trạng thái anon/grant/default-priv THỰC TẾ trên prod**: không kết nối prod. Sau deploy 024 + bước tay, USER cần verify: `curl 'https://supabase.phucsang.com.vn/rest/v1/pos_orders?select=id&limit=1' -H 'apikey:<ANON>' -H 'Authorization: Bearer <ANON>'` → phải `42501`/`[]`.
- ⛔ **Project `tqouzxlnihfjdyxqlbqs` còn sống / key còn hiệu lực không** (🔴-A): KHÔNG thử key vào project Supabase thật. USER tự kiểm dashboard.
- ⚠️ **Ngắt mạng vật lý / kill process giữa checkout**: xác minh ĐƯỜNG CODE (offline queue + retry classification) nhưng chưa cắt wifi/kill giữa 1 checkout live. USER nên: bật máy bay mode giữa lúc bấm "Xác nhận" → kiểm đơn vào queue, không mất/trùng khi có mạng lại.
- ⚠️ **2 tab UI thật bán song song**: đã test atomic ở tầng RPC (nghiêm ngặt hơn) nhưng chưa mở 2 tab bấm song song.
- N/A **Electron** (first-run wizard, update giả lập): app không phải Electron.

---

## 5. THỨ TỰ ƯU TIÊN XỬ LÝ (đề xuất)

1. **🔴-A** — Kiểm project `tqouzxlnihfjdyxqlbqs` trên dashboard; nếu còn/không chắc → rotate service_role + anon key (hoặc xoá project). Scrub git history nếu repo chia sẻ. **Việc bảo mật gấp nhất.**
2. **🟡-B + 🟡-C** — Khi deploy 024: chạy thêm (dưới `supabase_admin`) `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ... REVOKE ... FROM anon` + khoá `schema_migrations` (RLS + revoke anon). Verify anon bị chặn thật trên prod.
3. **🟡-F** — Deploy LOGIC-02 → chạy đối soát doanh thu (hết ~1,9%); xử lý DATA-04 (3 dòng năm rác 109,9M).
4. **🟡-E** — Thêm rate-limit cho `/auth/v1/token`.
5. **🟡-D** — Gộp checkout web POS vào 1 RPC transaction (P2, theo mẫu `pos_mobile_checkout`).
6. **🟢** — G/H/I để sau.

---

## 6. So với đợt 02/07 và 03/07

| Hạng mục | 02/07 | 03/07 (đợt 1) | 03/07 (đợt này – R3) |
|---|---|---|---|
| 🔴 POS-SALES-01 (sales_records) | Phát hiện | Vá (021), xác nhận live | — (đã đóng) |
| 🟡 RPC `_v2` | Phát hiện | Áp (022) | ✅ đọc source xác nhận đủ nhánh + guard |
| 🔴 SEC-RLS-01 anon | Nghi ngờ | Vá (024) trên clone | ✅ **tự bắn anon key xác minh 024 chặn thật**; nhưng phát hiện 3 mảnh còn hở: `supabase_admin` default-priv, `schema_migrations`, — |
| Service_role key git history | "Không lộ" (chỉ quét sk-ant) | "Không lộ" | 🔴 **Phát hiện service_role JWT project cũ trong history** |
| Checkout atomicity | DATA-01 hoãn P2 | — | 🟡 đọc orchestration xác nhận là saga bù trừ, ghi rõ rủi ro |
| Import Excel dòng lỗi | Chưa test live | Chưa test live | ✅ **test LIVE — batch không vỡ** |
| Rate-limit login | — | — | 🟡 phát hiện `/auth/v1` không limit |

**Kết luận đợt này**: Các fix đợt trước (021/022/024) **hoạt động đúng như tuyên bố** — tôi đã tự kiểm chứng, không chỉ tin báo cáo. Lõi giao dịch đủ vững để dùng thật. Nhưng đợt đào sâu tìm ra **rủi ro secrets (service_role key trong git history)** và **2 mảnh RLS còn hở** (default-priv `supabase_admin` + `schema_migrations`) mà các đợt trước chưa thấy — đây là những việc phải đóng ở tầng deploy/prod trước khi coi là hoàn toàn sẵn sàng giao khách.

---

*Báo cáo bởi audit độc lập (đợt 3). Không sửa code. Dữ liệu test đã dọn khỏi DB local (trừ ghi chú SP010239 stock=0 ở mục 0).*
