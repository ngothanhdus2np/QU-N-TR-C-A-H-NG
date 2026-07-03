# TODO.md — Danh sách việc cần làm

> Agent cuối ca → cập nhật file này: đánh dấu xong, thêm task mới, ghi lý do block.
> Xem HISTORY.md để biết context từ phiên trước.

---

## 🔴 P0 — Ưu tiên cao (làm trước)

### [x] 🟡 ORDERS-EDIT-01 — Sửa hóa đơn trong POS (mở đơn cũ để đổi sản phẩm/số lượng/giá) *(xong 2026-07-03)*

> Nút "Sửa trong POS" ở trang Hóa đơn — mở lại đơn vào máy tính tiền, sửa xong lưu đè đúng id cũ (hoàn tồn kho + trừ/cộng doanh thu + tính lại doanh số NV, không nhân đôi lịch sử). Theo quyết định user: không giới hạn quyền/ngày, chưa xử lý riêng đơn có phiếu trả hàng liên kết (rủi ro đã ghi). Chưa hỗ trợ sửa đơn trả/đổi hàng. Chi tiết HISTORY.md.

### [ ] 🟡 ORDERS-EDIT-02 — Xử lý sửa đơn đã có phiếu trả hàng liên kết

> `editPosOrder()` hiện không kiểm tra/cảnh báo khi đơn đang sửa đã có phiếu trả hàng trỏ tới nó (`originalOrderId`) — sửa số lượng/sản phẩm trong trường hợp này có thể làm lệch số liệu đã trả. User đã chọn "vẫn cho sửa bình thường" ở bản đầu — cần theo dõi thực tế phát sinh, bổ sung cảnh báo/chặn nếu cần.

### [x] 🟡 ORDERS-DEL-01 — Xóa hàng loạt hóa đơn đúng chuẩn (hoàn tồn kho + trừ doanh thu) *(xong 2026-07-03)*

> Nút "Xóa N đơn" ở trang Hóa đơn. Tái dùng RPC/pattern có sẵn từ `processReturnOrder`. Chưa hỗ trợ đơn trả/đổi hàng (`isReturn`). Fix 2 bug phát sinh khi test multi-delete (sales_records tính sai do dùng data cũ giữa vòng lặp + không xóa dòng cũ khi NV về 0). Chi tiết HISTORY.md.

### [x] 🔴 BRAND-01 — Mất SĐT/địa chỉ cửa hàng tái diễn (khác lỗi 401 đã vá 06-28) *(fix xong 2026-07-03)*

> **ĐÃ SỬA**: prod DB `brand_profile.phone/address` bị ghi đè bằng placeholder `DEFAULT_BRAND` do race — thiết bị/browser chưa có cache + fetch đầu lỗi/chậm, user gõ field khác trong tab Hồ sơ thương hiệu → auto-save mang theo placeholder đè DB. Khôi phục dữ liệu thật trên prod (phone `033.571.3423 – 096.886.7411`, address `Số nhà 14, đường NC2, tổ 11, khu phố 3, phường Bến Cát, TP.HCM`) + vá gốc rễ [hooks/useAppData.ts](../../hooks/useAppData.ts) (`brandLoadedRef` chặn auto-save cho tới khi có dữ liệu thật xác nhận). Chi tiết HISTORY.md.

### [ ] 🟡 POS-RETURN-01 — Phiếu trả thuần cộng NHẦM +giá trị trả vào doanh số NV *(phát hiện 2026-07-03 khi hoàn tác phiếu trả bấm nhầm)*

> Phiếu trả thuần (không đổi hàng) tạo từ flow trả hàng lưu `finalAmount = +60000` (dương, bằng giá trị hàng trả) thay vì 0/âm như comment trong code mô tả (`POSComputer lưu finalAmount = -Math.max(0, totalReturn-totalExchange)`). Hệ quả: nhánh fallback KiotViet trong `calculateOrderStaffSales` ([src/lib/posSalesAttribution.ts:75](../../src/lib/posSalesAttribution.ts)) tính `extraPaid = max(0, finalAmount) = 60000` → **trả hàng làm TĂNG doanh số NV** thay vì không đổi. Tái hiện thực tế: phiếu TH065947 (trả 1×60k, không đổi hàng) đẩy `sales_records` NV +60.000. Cần xác định nơi set `finalAmount` khi tạo phiếu trả từ chi tiết hóa đơn (usePOSReturnFlow / POSComputer handleCheckout nhánh return) và sửa cho khớp công thức, hoặc siết fallback chỉ áp dụng cho đơn import KiotViet.

### [ ] 🔴 SEC-SECRET-01 — service_role JWT project cũ `tqouzxlnihfjdyxqlbqs` lộ trong GIT HISTORY *(phát hiện audit R3 2026-07-03)*

> **Severity: 🔴 (nếu project còn sống hoặc repo được chia sẻ)**. Chi tiết: `docs/06-evaluation/QA_SECURITY_AUDIT_2026-07-03_R3.md` mục 🔴-A.
>
> **Vấn đề**: Từ commit đầu `66ecc7a` (2026-05-05, `server.ts`+`services/supabase.ts`) và các script Python, cả anon key lẫn **service_role key** của project Supabase hosted `tqouzxlnihfjdyxqlbqs.supabase.co` bị hardcode. Đã gỡ khỏi code (`2a241ab`/`81675ad`) nhưng **vẫn còn trong git history** — `git log --all -p | grep` trích được JWT `role":"service_role"...ref":"tqouzxlnihfjdyxqlbqs"` (exp năm 2036). service_role bypass TOÀN BỘ RLS. HEAD chỉ còn ref/URL trong `.kiro/DEPLOY_NOW.md`+`.kiro/QUICK_START.md` (không có JWT thật).
>
> **Chưa xác minh được**: rào chắn cấm thử key vào project Supabase thật. USER tự kiểm.
>
> **Việc cần làm**:
> 1. Dashboard → kiểm project `tqouzxlnihfjdyxqlbqs` **còn tồn tại không**. Nếu còn/không chắc → **rotate service_role + anon key ngay** (Settings→API→Reset) hoặc **xoá project** nếu đã migrate self-hosted.
> 2. Nếu repo share (GitHub/nhiều máy) → scrub history (`git filter-repo`/BFG) + force-push. Nếu repo chỉ ở máy cá nhân → rủi ro thấp hơn nhưng vẫn nên rotate.
> 3. Gỡ nốt ref khỏi `.kiro/*.md`.

### [x] 🔴 SEC-RLS-01 — Vá lỗ hổng anon RLS/grant *(✅ HOÀN TẤT TOÀN BỘ 2026-07-03 — đã deploy + verify trực tiếp trên prod)*

> **✅ DEPLOY 2026-07-03**: migration `023`+`024` đã áp thành công lên prod qua `deploy-imac.sh` (021/022 áp từ trước). `024` khóa **33 bảng nội bộ** (drop policy anon/public → `FOR ALL TO authenticated`, REVOKE anon, gỡ default-privileges grantor `postgres`). App build + restart thành công, health check `200 OK`, log sạch (không lỗi runtime mới).
>
> **✅ Phát hiện khi deploy, ĐÃ XỬ LÝ XONG**: bảng `store_settings` do role **`supabase_admin`** sở hữu (không phải `postgres` — role chạy migration) → `023` không khóa được bảng này tự động (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` bị từ chối quyền owner). Đã sửa `023` bọc exception theo từng bảng (giống pattern `024`) để không chặn cả migration — 6/7 bảng khác trong `023` khóa thành công tự động. User tự chạy tay 3 lệnh dưới `supabase_admin` trên Supabase Studio cho `store_settings` (REVOKE anon + ENABLE RLS + tạo policy authenticated) — **đã verify trực tiếp trên prod 2026-07-03**: `rowsecurity=true`, 0 grant `anon`, policy `store_settings_authenticated_all FOR ALL TO authenticated` đúng.

> **AUDIT R3 (2026-07-03) — TỰ KIỂM CHỨNG 024 CHẶN THẬT trên clone** (bắn anon key: `pos_products/pos_orders/sales_records/suppliers` → `42501` cả đọc lẫn ghi; HR/tài chính → `[]`; catalog `store_products` → 200). **NHƯNG phát hiện 3 mảnh gốc rễ CHƯA đóng — bổ sung vào "CÒN LẠI" bên dưới**:
> - 🟡-B: `pg_default_acl` grantor **`supabase_admin` vẫn còn `anon=arwdDxt`** cho bảng tương lai (024 chỉ gỡ được grantor `postgres`). Bảng mới tạo qua Studio (dưới supabase_admin) sẽ TỰ mở anon full CRUD → MAINT-01 chưa đóng hẳn.
> - 🟡-C: `schema_migrations` **RLS OFF + anon full grant** — kiểm chứng live `curl` anon → 200 + dữ liệu; anon có thể TRUNCATE sổ migration → lần deploy kế chạy lại toàn bộ.

> **Severity: 🔴**. Chi tiết: `docs/06-evaluation/QA_SECURITY_AUDIT_2026-07-03.md` mục 🔴-1.
>
> **Vấn đề**: anon key (nhúng công khai trong bundle) ĐỌC+GHI+XÓA được thật trên `pos_products/pos_orders/sales_records/suppliers/vat_documents/attendance_records` — do (1) `DEFAULT PRIVILEGES` tự cấp anon full CRUD mọi bảng mới (MAINT-01), (2) RLS policy `TO anon`/`TO public USING(true)`, (3) proxy `/rest/v1` mở.
>
> **✅ ĐÃ SỬA** bằng migration `024_lock_down_anon_rls.sql`: DROP policy anon/public trên **33 bảng nội bộ** → thay bằng `FOR ALL TO authenticated` + `REVOKE ALL FROM anon` + gỡ default-privileges anon. Giữ ngoại lệ `store_products`/`store_product_variants` (public-read `is_published` cho catalog website). **Kiểm chứng trên clone**: anon giờ `42501 permission denied` (đọc+ghi đều chặn); user đăng nhập thật (authenticated) VẪN full quyền — bán 1 đơn qua UI OK (tồn 49→48, sales_records ghi, console sạch); catalog công khai vẫn đọc được. LoginPage không đọc bảng nào pre-auth nên không vỡ trang login.
>
> **⏳ CÒN LẠI**:
> 1. ~~Deploy migration 024 lên prod~~ ✅ xong 2026-07-03. **Chưa verify bằng curl anon key thật** trên `https://supabase.phucsang.com.vn` (chỉ mới verify trên clone trước đó) — nên chạy `curl 'https://supabase.phucsang.com.vn/rest/v1/pos_orders?select=id&limit=1' -H 'apikey: <ANON>' -H 'Authorization: Bearer <ANON>'` → phải trả `42501`/`[]` để xác nhận chắc chắn.
> 1b. ~~Khoá `schema_migrations`~~ ✅ xong 2026-07-03, chạy qua SSH+psql role `postgres` (bảng `public.schema_migrations` do `postgres` sở hữu nên đủ quyền) — verify trực tiếp trên prod: `rowsecurity=true`, 0 grant `anon`.
> 1c. ~~Đóng default-priv `supabase_admin`~~ ✅ xong 2026-07-03 — user tự chạy trên Supabase Studio (SSH+psql role `postgres` không đủ quyền, đã thử và lỗi `must be member of role`). **Verify trực tiếp trên prod** qua `pg_default_acl` (lọc schema `public`, grantor `supabase_admin`): bảng (`r`) và sequence (`S`) đều còn `{postgres, authenticated, service_role}`, **anon đã biến mất**. Gốc rễ MAINT-01 (bảng mới tạo qua Studio dưới `supabase_admin` tự mở anon full CRUD) đã đóng hoàn toàn.
> 1d. ~~Bảng `store_settings` (do `supabase_admin` sở hữu, `023` bỏ qua an toàn)~~ ✅ user tự chạy 3 lệnh dưới `supabase_admin` trên Supabase Studio 2026-07-03 — **đã verify trực tiếp trên prod**: `rowsecurity=true`, 0 grant cho `anon`, policy `store_settings_authenticated_all FOR ALL TO authenticated` đúng.
> 2. **1 bước TAY trên prod** (chạy DƯỚI role `supabase_admin` hoặc superuser — migration chạy bằng `postgres` KHÔNG đủ quyền nên đã skip): `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;` — để bảng MỚI do supabase tạo không tự cấp anon. Rủi ro tồn dư THẤP vì migration bảng mới đã theo mẫu tạo RLS+policy authenticated (023/024).

### [x] 🔴 POS-SALES-01 — Ghi doanh số NV lỗi mọi đơn → hiện lỗi giả "mất đồng bộ", nguy cơ đơn trùng *(fix xong 2026-07-02 khuya, ✅ VÁ + XÁC NHẬN LIVE 2026-07-03, ⏳ CHỜ DEPLOY)*

> **ĐÃ SỬA** bằng migration `021_fix_sales_records_schema.sql`: `sales_records.id` UUID→TEXT + gỡ FK `employee_id` (khớp `pos_orders.staff_id` vốn text tự do). Chọn cách này thay vì randomUUID vì code đã thiết kế id chuỗi tất định `pos-sales-<date>-<emp>` (idempotent upsert theo ngày+NV) VÀ người bán có thể ngoài roster nhân viên (admin/chủ) — đổi randomUUID vẫn vướng FK. Verify browser: bán 1 đơn → `sales_records` ghi OK, console sạch, hết lỗi giả. ⏳ Migration đã áp local + ghi sổ, tự áp prod khi deploy.

### [x] 🟡 INV-RPC-01 — Schema drift RPC tồn kho (`_v2` thiếu + legacy thiếu nhánh Sale/Return) *(fix xong 2026-07-02 khuya, ⏳ CHỜ DEPLOY)*

> **ĐÃ SỬA** bằng migration `022_apply_inventory_rpc_v2.sql` (= nội dung 013): áp `apply/delete_inventory_transaction_with_stock_v2` lên DB. Nay mọi đơn dùng RPC atomic 1-transaction đủ nhánh Sale/Return (thay fallback nhiều-bước) → giải luôn 🟡 fallback không atomic. Legacy thiếu nhánh hết là landmine (Sale/Return không còn chạm legacy). Verify RPC: bán 5 khi tồn 1 → EXCEPTION, tồn giữ 1. ⏳ CHỜ DEPLOY. Ghi chú: đây cũng là phần chính của task "Đồng bộ schema production với migrations".

### [x] 🟡 IMPORT-01 — Import Excel không validate từng dòng, 1 dòng lỗi hỏng cả chunk *(fix xong 2026-07-02 khuya, ⏳ CHỜ DEPLOY)*

> **ĐÃ SỬA** [routes/import.ts](../../routes/import.ts): vệ sinh field số NaN→0 trước khi build parent + khi batch upsert lỗi → retry từng dòng để cô lập dòng hỏng (dòng đúng vẫn ghi), trả `rowErrors[]` chi tiết. tsc sạch, 318 test pass. ⏳ CHỜ DEPLOY (code backend).

### [x] 🟡 SEC-ANON-01 — Đóng lỗ anon truy cập bảng storefront/misc (RLS off) *(fix xong 2026-07-02 khuya, ⏳ CHỜ DEPLOY)*

> **ĐÃ SỬA** bằng migration `023_revoke_anon_storefront_tables.sql`: REVOKE ALL FROM anon + bật RLS + policy authenticated cho 7 bảng RLS-off (`expense_categories`, `shipments`, `store_collections`, `store_order_addresses`, `store_preorder_requests`, `store_product_collections`, `store_settings`). App không đọc các bảng này qua anon (đã kiểm), storefront dùng service-role bypass RLS → không phá luồng nào. Cũng là bước xử lý gốc rễ MAINT-01 (bảng mới tự nhận grant anon). ⏳ CHỜ DEPLOY.

### [ ] 🔴 Đăng nhập lại Shopee cho bot trên iMac — USER làm trực tiếp trên iMac *(2026-07-02)*

> **Bối cảnh**: Bot Shopee đã chuyển từ MacBook lên iMac (xong 02/07 — phụ thuộc 1 máy duy nhất). Nhưng Shopee phát hiện "thiết bị mới" → **session cả 2 shop hết hạn**. Đơn Shopee CŨ vẫn hiển thị trên app; đơn MỚI sẽ không cập nhật cho đến khi đăng nhập lại. Bot MacBook đã tắt, tunnel đã gỡ — KHÔNG bật lại bot trên MacBook (2 bot chạy song song sẽ đá session nhau).
>
> **Các bước làm trên iMac** (mở Terminal, copy từng dòng):
>
> ```bash
> export PATH=~/.npm-global/bin:/usr/local/bin:$PATH
> pm2 stop all
> cd ~/shopee-monitor
> node login.js --shop 1
> ```
> → Cửa sổ Chrome mở ra → đăng nhập Shopee Seller Center (quét QR bằng app Shopee trên điện thoại) → khi thấy trang **quản lý đơn hàng** hiện ra → quay lại Terminal **nhấn ENTER** để lưu session.
>
> ```bash
> node login.js --shop 2
> ```
> → Lặp lại y như trên cho shop 2 (Phúc Sang_Đồ Da Cao Cấp 93).
>
> ```bash
> pm2 start ecosystem.config.js
> pm2 logs --lines 30
> ```
> → Nhìn log ~2 phút: **KHÔNG còn** dòng `SESSION HẾT HẠN` là thành công (nhấn `Ctrl+C` để thoát log).
>
> **Bước cuối — cho bot tự chạy khi iMac khởi động lại** (nhập mật khẩu admin khi hỏi):
> ```bash
> sudo env PATH=$PATH:/usr/local/bin /Users/mac/.npm-global/lib/node_modules/pm2/bin/pm2 startup launchd -u mac --hp /Users/mac
> pm2 save
> ```
>
> Xong thì mở app → Đơn hàng online → bấm "Tải lại" kiểm tra đơn mới. Nếu trục trặc: nhắn Claude verify từ xa.

---

### [x] Migration tự động khi deploy *(xong 2026-07-02 khuya)*

> `apply-migrations.sh` + sổ `schema_migrations` (baseline 20 file trên prod+dev). Deploy tự chạy migration mới trước build, lỗi = dừng deploy. Sync prod→dev tự áp lại migration chưa deploy. **Quy trình mới**: schema mới → viết file `021_xxx.sql` vào `supabase_migrations/` → test dev → deploy. LƯU Ý: task "Đồng bộ schema production với migrations" (bên dưới) về cơ bản được giải bằng baseline — drift lịch sử coi như mốc 0, từ giờ không lệch nữa.

### [x] Tách môi trường dev — Supabase local MacBook + fix proxy dev trỏ prod *(xong 2026-07-02 đêm muộn)*

> Supabase local Docker trên MacBook (`~/supabase-dev/docker`, clone config iMac). Script `scripts/sync-prod-to-dev.sh` đồng bộ dữ liệu prod→dev + backup nén về `~/backups/cfobrain/` (giải một phần DEVOPS-01). Fix 3 hardcode `192.168.1.3:8000` trong `server.ts` → đọc `SUPABASE_URL`. Verify login + load data từ DB local trên browser. Chi tiết HISTORY.md.
>
> ⚠️ **server.ts chờ deploy** (hành vi prod không đổi, không gấp — deploy cùng đợt sau).
> 💡 Nên chạy `sync-prod-to-dev.sh` định kỳ (vd mỗi sáng) để dev có data mới + có backup.

### [x] Fix đăng nhập chập chờn app.phucsang.com.vn — tunnel Supabase phụ thuộc MacBook *(xong 2026-07-02 đêm)*

> `supabase.phucsang.com.vn` (auth + data của mọi browser) từng đi qua tunnel cloudflared trên **MacBook** → MacBook ngủ/tắt = không đăng nhập được. Đã chuyển hostname vào tunnel `cfobrain` trên iMac (ingress → localhost:8000 + DNS CNAME), xóa hẳn tunnel `supabase-tunnel` trên MacBook. Verify login flow qua domain public khi MacBook không còn tunnel. Chi tiết HISTORY.md.

---

### [~] Vá lỗ hổng Auth Bypass + Privilege Escalation trên LAN *(phát hiện + kiểm chứng 2026-06-30)*

> **Severity: HIGH → đã hạ rủi ro (kiểm chứng thật trên prod)**. Xem `docs/06-evaluation/PRODUCTION_AUDIT_2026-06-30.md`.
>
> **Lớp 1 — ✅ ĐÃ ĐÓNG**: `NODE_ENV=production` xác nhận trong tiến trình live `com.cfobrain.app` (set qua launchd plist) → `IS_PROD=true` → dev-bypass (`server.ts:548`) tắt, rate-limit bật.
>
> **Lớp 2 — KHÔNG khai thác được** (vì Lớp 1 đóng, request không-JWT bị `requireAuth` chặn 401 trước khi tới `resolveCaller`). Nhưng vẫn nên vá phòng thủ.
>
> **Việc CÒN LẠI:**
> 1. ~~Thêm `NODE_ENV=production` vào `.env.local` trên iMac~~ ✅ **xong 2026-07-02** (qua ssh, cùng đợt deploy).
> 2. ~~Vá `auth.ts:21`~~ ✅ **xong 2026-06-30** — đổi `return { role: 'owner', userId: 'dev-user' }` → `return null` (defense-in-depth).
> 3. Dài hạn: thay LAN IP bypass bằng `INTERNAL_API_KEY` header.

---

### [x] Vá SEC-01 — Path traversal xóa file tùy ý *(xong 2026-06-30, ✅ ĐÃ DEPLOY 2026-07-02)*

> `DELETE /api/upload-product-image` (`server.ts`): thêm `path.resolve(productsRoot, rel)` + `startsWith(productsRoot+sep)` chặn `../` thoát thư mục. Proof: `../`/absolute đều BLOCK, path hợp lệ ALLOW; tsc sạch; route mount 401≠404.

### [x] P1 DATA-02 — Atomic revenue increment (diệt race mất doanh thu) *(xong 2026-06-30, ✅ ĐÃ DEPLOY 2026-07-02)*

> Web POS ghi doanh thu bằng **delta cộng dồn atomic** (RPC `apply_revenue_delta`, migration 020 — ĐÃ chạy prod, constraint `UNIQUE(date)` xác nhận khớp) thay vì read-modify-write ghi đè cả dòng. Áp dụng cả bán & trả/đổi. Giữ offline-first (queue opType `revenueDelta`). 318 test pass. DATA-01 (full transaction checkout) hoãn P2 theo quyết định phân pha.
>
> ⚠️ **ĐÍNH CHÍNH bước hậu-deploy**: đã chạy `recalculate-revenue-from-orders` cho T6/T7 nhưng audit chiều 02/07 phát hiện **endpoint này có bug** (xem task LOGIC-02 bên dưới) — nó ghi tổng CẢ THÁNG vào 1 dòng ngày cuối tháng, làm T6 bị đếm đôi. **Đã khôi phục sạch** (xóa 2 dòng 30/06 + 31/07 do lần chạy tạo, xác minh bằng created_at). KHÔNG chạy lại endpoint này cho đến khi sửa LOGIC-02.

### [x] 🔴 LOGIC-02 — Endpoint `recalculate-revenue-from-orders` sai mô hình dữ liệu *(fix xong 2026-07-02 khuya, ⏳ CHỜ DEPLOY)*

> **ĐÃ SỬA** [routes/data.ts](../../routes/data.ts): viết lại group by NGÀY, upsert từng ngày `onConflict(date)` theo công thức `calcOrderRevenue` (khớp `reportCalculations.ts`) + thêm `revenue_other` từ final_amount; giữ nguyên total_cogs/gross_profit (recalculate-cogs lo riêng). Hết bug dồn cả tháng vào 1 dòng cuối tháng. Verify: recalc 2026-07 → ghi đúng dòng ngày 2026-07-02, không tạo dòng 07-31. ⏳ CHỜ DEPLOY.
>
> 💡 **Sau khi deploy**: endpoint này nay AN TOÀN để chạy lại → dùng để dọn drift T6 (~4,88M lệch giữa orders vs revenue_records) và có thể hỗ trợ đối soát DATA-04.

### [ ] 🟠 DATA-04 — 3 dòng ngày rác trong `revenue_records` *(phát hiện audit 2026-07-02)*

> 3 dòng có `date` hỏng: `92401-07-06`, `77063-10-04`, `137519-06-26` (created_at 2026-06-06, từ bug import cũ) — tổng **net 109.933.000đ** đang nằm ngoài mọi báo cáo theo range chuẩn nhưng có thể lọt vào tổng all-time. Cần đối chiếu số liệu gốc để sửa ngày đúng (không đoán tự động được), hoặc user xác nhận xóa.
>
> ✅ **Audit R3 (2026-07-03) tái hiện chính xác trên clone**: 3 dòng net 49.449.000 + 33.031.000 + 27.453.000 = **109.933.000**; tổng net all-time = 15.042.976.804 vs trong-range (2020..2027) = 14.933.043.804 → lệch **đúng 109,933M lọt vào all-time**. Vẫn tồn tại trên clone (và presumably prod).

### [ ] 🟡 SEC-RATELIMIT-01 — Login `/auth/v1` không rate-limit ở tầng app *(phát hiện audit R3 2026-07-03)*

> `apiLimiter` mount `/api/` ([server.ts:442](../../server.ts)), `authLimiter` (20/15ph) CHỈ mount `/api/auth/register` ([server.ts:443](../../server.ts)). Proxy Supabase `/auth/v1`+`/rest/v1`+`/storage/v1` ([server.ts:464](../../server.ts)) không qua limiter nào → đường login thật GoTrue `/auth/v1/token` không bị app chặn brute-force (chỉ dựa giới hạn nội bộ GoTrue). Đề xuất: thêm limiter `/auth/v1/token` (~10–20/15ph/IP) hoặc siết cấu hình GoTrue.

### [ ] 🟡 DATA-01 — Checkout web POS chưa gói vào 1 transaction DB (saga bù trừ) *(P2 — audit R3 ghi rõ rủi ro)*

> `processPlaceOrder` ([services/posOrderService.ts:270-345](../../services/posOrderService.ts)) ghi đơn qua 4–5 lời gọi riêng (insert order → RPC tồn kho → customer/nợ → RPC revenue → staff/audit), mỗi cái atomic riêng nhưng nối bằng rollback bù trừ tầng app (`rollbackSteps[]`). Rollback tự nó là chuỗi network call có thể tự fail → cửa sổ lệch (đơn xoá nhưng tồn không hoàn, hoặc ngược lại). Offline-first che phần lớn case mạng rớt → rủi ro hiếm/biên. Đề xuất P2: gộp vào 1 RPC transaction theo mẫu `pos_mobile_checkout`.

---

### [x] Fix lỗi ngẫu nhiên "1 trang báo lỗi" *(xong 2026-06-27)*

> 2 nguyên nhân: ChunkLoadError sau deploy + `.items` không null-guard trên cache cũ. ErrorBoundary tự reload khi lỗi chunk; vá 5 chỗ `.items` còn sót. Xem HISTORY.md.

### [x] Vá lỗ hổng API POS Mobile mở công khai *(xong 2026-06-27)*

> `routes/posMobile.ts` mount không `requireAuth`, 3 endpoint public dùng service role → đã thêm token `POS_MOBILE_TOKEN` (header `x-pos-mobile-token` / `?t=`), bỏ `import_price` khỏi response. Verify đầy đủ. Xem HISTORY.md.

### [x] Làm cứng checkout POS Mobile — transaction + atomic revenue *(xong 2026-06-27)*

> Gói toàn bộ checkout vào RPC `pos_mobile_checkout` (1 transaction DB): insert đơn + trừ tồn inline atomic + cộng dồn revenue atomic + KH/nợ + audit. Verify trên prod (rollback test). Xem HISTORY.md.

### [~] Đồng bộ schema production với migrations *(phát hiện khi làm #2 — 2026-06-27; vá thêm 1 phần 2026-07-02)*

> Production self-hosted (iMac, container `supabase-db`) **chưa chạy** một số migration: RPC `*_v2` (013) và cột `branch_id`/constraint `(date,branch_id)` của `revenue_records`. Hệ thống vẫn chạy nhờ fallback legacy, nhưng `supabase_setup.sql`/migrations đang **lệch** với DB thật. Nên rà soát & chạy bù các migration còn thiếu (hoặc cập nhật setup cho khớp) để tránh bẫy cho lần sau.
>
> **2026-07-02 đã vá phần store module trên prod DB**: migration 017 (shipments cols + `upsert_website_shipment` + `update_website_order_status` 3 tham số), 4 cột `pos_orders` (`shipping_fee`/`note`/`customer_phone`/`customer_email`), `create_store_order` bản canonical. ⚠️ Phát hiện: 3 cột `pos_orders` (note/customer_phone/customer_email) không nằm trong migration nào — cần bổ sung vào `supabase_setup.sql`/migration mới. Migration 014 chứa bản CŨ `update_website_order_status(UUID,TEXT)` — KHÔNG chạy nguyên file, sẽ tạo overload trùng.

### [x] Deploy fix "Đơn hàng online" lên prod *(✅ deploy + verify 2026-07-02)*

> Proxy `/api/shopee-orders/:shopId`, rate limit 1000 + miễn trừ bot-status, BotProgressBar poll 15s + JWT, 3 component bỏ hardcode localhost. Đã deploy kèm SEC-01 + DATA-02. **Phát sinh khi deploy**: app launchd trên iMac (macOS 15) bị chặn Local Network → không gọi được bot trên MacBook qua LAN IP. Giải pháp: reverse SSH tunnel MacBook→iMac (launchd agent `com.phucsang.bot-tunnel` trên MacBook, KeepAlive) + `SHOPEE_BOT_HOST=127.0.0.1` trong `.env.local` iMac. Verify qua domain public: đơn 2 shop (236+201) + bot-status đều ok.
>
> ⚠️ **Điểm giòn cần biết**: (1) Tunnel chạy từ MacBook — MacBook tắt/ngủ = prod mất dữ liệu đơn Shopee (bot vốn cũng chạy trên MacBook nên không tệ hơn hiện trạng). (2) Có thể bỏ tunnel nếu cấp quyền Local Network cho `tsx`/`node` trong System Settings > Privacy trên iMac rồi đổi `SHOPEE_BOT_HOST` về IP MacBook (IP DHCP có thể đổi).

### [x] Làm cứng auth `services/auth.ts` *(xong 2026-06-27)*

> Hóa ra 6 hàm bị gắn cờ (signUp/updatePassword/resetPassword/getUserMetadata/isAdmin/isManager) đều là code chết → đã xóa, diệt rủi ro với 0 ảnh hưởng. Xem HISTORY.md.

### [x] Dọn 7 lỗi TypeScript `routes/channelLinks.ts` + test giòn `adminStoreModule` *(xác nhận xong 2026-06-30)*

> `tsc --noEmit` nay **sạch 0 lỗi**; `npm test` **318/318 pass** (15 file). Cả 2 đã được xử lý (xác nhận lại trong audit 2026-06-30).

---

### [x] Sửa trang khách hàng: lấy dữ liệu từ đơn hàng thực tế + redesign tab lịch sử *(xong 2026-06-23)*

> Thay `c.totalSpent` bằng `orderStats` từ đơn hàng thực tế. Load all-time orders (POS_ORDER_BOOTSTRAP_DAYS=0).
> Link 3 đơn mồ côi. Tổng bán khớp KiotViet: 186.458.000 / 176.658.000.
> Tab "Lịch sử bán/trả hàng" redesign 5 cột giống KiotViet.
> **Chưa xử lý**: Nợ hiện tại = 0 (KiotViet: 14.096.000) — cần import/tính dữ liệu nợ riêng.

---

### [x] Triển khai WAC calculator tính giá vốn (không phụ thuộc KiotViet) *(xong 2026-06-22)*

> Đã implement WAC vào `buildCostHistory()` + đổi ưu tiên giá vốn trong `getSalesProfitRowsByDate()`.
> App tự tính giá vốn từ phiếu nhập, phân bổ chiết khấu NCC. Độ chính xác ~95.5% so với KiotViet.
> Tạo `docs/business-knowledge/FORMULAS.md` tổng hợp tất cả công thức.

---

### [x] Nối sản phẩm Shopee với sản phẩm POS (link SKU) *(xong 2026-06-29)*

> Fix buildSkuMap() phân trang (load đủ 14.855 SKU thay vì 1000). Strip suffix "Kèm Hộp/Không Hộp". Bot đã rescan — Shop1: 378/415 variants linked; Shop2: 174/310 variants linked. SP chưa link (SKU rỗng trong Shopee Seller Center) cần user tự thêm SKU trên Shopee.

### [ ] Thêm SKU trên Shopee Seller Center cho các sản phẩm chưa link

> ~7 SP shop1 và ~9 SP shop2 có SKU rỗng ("") trong Shopee → bot không thể auto-link với POS. User cần vào Shopee Seller Center, chỉnh từng biến thể → thêm SKU đúng định dạng (vd: DQND25-Đen-38). Sau đó bấm "Sync Shopee" để bot cập nhật.
> SP ví dụ: Dép Nữ, Unisex, DQND25-Đen (một số màu).

---

### [x] Lấy description/weight/brand từ Shopee (detail API) *(xong 2026-06-22; fix shop2 2026-06-30)*

> Bot navigate đến `/portal/product/{item_id}`, intercept `/api/v3/product/get_product_info`. Đã lấy được: gallery (3–9 ảnh), mô tả tiếng Việt, weight, categoryId, categoryName cho 63/63 SP (shop1: 29, shop2: 34).
> **Fix 2026-06-30**: Shop 2 description bị null do (1) Shopee đổi URL edit page từ `/portal/product/edit/{id}` → `/portal/product/{id}` và (2) tab mới không có localStorage → bị redirect. Đã fix trong `bots/products.js` → 34/34 shop2 có description ✅.
> **Cần chạy thủ công trên Supabase dashboard**: `ALTER TABLE shopee_products ADD COLUMN IF NOT EXISTS category_name text;` (code đã comment out, chờ cột tồn tại thì bỏ comment).

### [x] Thanh tiến trình bot Shopee trong app *(xong 2026-06-30)*

> `BotProgressBar` component poll `/api/shopee-bot-status` mỗi 3 giây, hiển thị thanh cam cố định dưới màn hình khi bot đang chạy (progress bar %, tên SP đang xử lý). Ẩn hoàn toàn khi idle. Fix PM2 conflict shopee-bot/shopee-shop1 — cả 2 bot live.

### [ ] Kiểm tra description shop 1 (phuc_sang_store) *(phát hiện 2026-06-30)*

> Cùng bug URL edit page (`/portal/product/edit/{id}` → `/portal/product/{id}`) có thể ảnh hưởng shop 1. Cần xác nhận 29 SP shop1 đã có description hay còn null, nếu null thì bot sẽ tự fetch lại trong pass 2 (code đã fix). Có thể trigger thủ công bằng cách xóa tạm trường `description` trong DB rồi restart bot shop1.

### [x] Import dữ liệu KiotViet vào CFO Brain *(xong 2026-06-22)*

> 251 KH, 13,799 SP, 12,654 dòng nhập hàng, 67,530 đơn hàng (40 file hoá đơn). Fix 2 route import để hỗ trợ format export chuẩn của KiotViet.

---

### [ ] Cập nhật file Excel với gallery images + mô tả

> Dữ liệu gallery + mô tả đã có trong DB. Cần xuất lại file Excel PHUC-SANG-shopee-bot-data.xlsx với ảnh gallery đầy đủ (cover + 3–9 ảnh phụ) và mô tả sản phẩm cho từng SP.

---

### [x] Kiểm toán logic nghiệp vụ (Senior System Auditor) *(xong 2026-06-19)*

> Đọc source + cross-check docs. Tìm ra 22 findings (3 Critical, 9 High, 8 Medium, 2 Low). Output: `docs/business-knowledge/AUDIT_REPORT.md`.  
> **TOP 3 cần xử lý ngay:** AUDIT-014 (Shopee dedup mất item multi-SKU), AUDIT-003 (race condition stock), AUDIT-001 (fixed cost method: docs sai).

---

### [x] Xử lý AUDIT-014 — Shopee dedup theo orderId mất item nhiều SKU *(đã fix trước đó)*

> Đã dùng key `${record.orderId}||${record.sku || ''}` tại `services/dataMapper.ts:499-500`. Fix thực hiện trong phiên trước, xác nhận lại 2026-06-19.

---

### [x] Xử lý AUDIT-003/009 — Race condition tồn kho: client check không atomic *(xong 2026-06-19)*

> Gộp 2 lần gọi `updateSurgical` riêng (inventoryTransaction + stockUpdates) thành 1 → kích hoạt điều kiện `shouldUseInventoryRpc = true` trong `useAppData.ts` → RPC atomic `apply_inventory_transaction_with_stock`. Sửa `services/posOrderService.ts`.

---

### [x] Xử lý AUDIT-019 — Thiếu UNIQUE constraint bảng shopee_inventory_out *(xong 2026-06-20 — đã chạy production)*

> SQL UNIQUE(order_id, sku) đã có cuối `supabase_setup.sql`. Đổi `.insert()` → `.upsert({ onConflict: 'order_id,sku', ignoreDuplicates: true })` trong `routes/inventoryOutSync.ts` để tránh lỗi 500 khi 2 sync chạy đồng thời.
> ✅ **Đã chạy trực tiếp trên production 2026-06-20** qua pg/query API. Xóa 1 duplicate (order 260527G97D8P3T / SKU "Không rõ"). Constraint `uq_shopee_inventory_out_order_sku` đã active.

---

### [x] Xử lý AUDIT-022 — Thiếu UNIQUE constraint bảng revenue_records / payroll_records *(xong 2026-06-20 — đã chạy production)*

> Thêm migration vào cuối `supabase_setup.sql`: UNIQUE(date) cho `revenue_records` (không có cột branch_id), UNIQUE(employee_id, month) cho `payroll_records`.
> ✅ **Đã chạy trực tiếp trên production 2026-06-20**. Constraints `uq_revenue_records_date` và `uq_payroll_records_emp_month` đã active. Không có duplicate trong revenue_records. payroll_records có 2 bản null employee_id (Cẩm Tú + PHẠM THỊ VUI) — không vi phạm vì NULL ≠ NULL trong PostgreSQL UNIQUE.

---

### [x] Xử lý AUDIT-001 — Docs mô tả sai cost method "fixed" *(xong 2026-06-19)*

> Sửa 3 file: `INVENTORY_LOGIC.md`, `OP-003-nhap-hang.md`, `REVENUE_PROFIT_LOGIC.md` — đổi mô tả `fixed = ghi đè` thành đúng: `fixed = giữ nguyên giá vốn hiện tại, chỉ dùng giá mới khi currentImportPrice = 0`.

---

### [x] Xử lý AUDIT-004 — Thiếu ghi chú COGS fallback trong docs *(xong 2026-06-19)*

> Thêm warning block vào `REVENUE_PROFIT_LOGIC.md` sau phần "COGS lịch sử": giải thích fallback về `product.importPrice` hiện tại khi InventoryTransaction cũ thiếu `nextImportPrice`.

### [x] AUDIT-004/017 — Backfill nextImportPrice vào InventoryTransaction cũ *(xong 2026-06-20 — đã chạy production)*

> SQL migration đã viết vào cuối `supabase_setup.sql`. Cập nhật JSONB items trong inventory_transactions type='Import' từ product_cost_history gần nhất theo ngày + SKU. An toàn: chỉ update item có nextImportPrice = 0 hoặc null.
> ✅ **Đã chạy trực tiếp trên production 2026-06-20**. 1057 Import transactions, còn 4 item của 2 transaction (SKU SP010315, SP005693, SP005692, SP005691) không backfill được vì import_price = null và không có lịch sử trong product_cost_history — dữ liệu gốc thiếu, không thể phục hồi.

---

### [x] Xử lý AUDIT-017 — Thiếu ghi chú historical COGS fallback trong REPORT_LOGIC.md *(xong 2026-06-19)*

> Thêm ghi chú sau `cogs ← Tính qua getHistoricalCost()` trong `REPORT_LOGIC.md` về fallback behavior khi thiếu lịch sử giá vốn.

---

### [x] Xử lý AUDIT-010 — Tier khách hàng tự động *(xong 2026-06-19)*

> `computeNewTier()` trong `POSComputer.tsx`: đọc ngưỡng từ `localStorage('customer_tier_settings')`, tự nâng hạng sau mỗi đơn dựa vào `totalSpent`. Chỉ nâng không hạ.

---

### [x] Xử lý AUDIT-011 — Nhập hàng nhanh không có NCC *(xong 2026-06-19)*

> Modal cảnh báo trong `GoodsInventory.tsx` khi bấm "Hoàn thành" mà không chọn NCC. Nếu tiếp tục → ghi vào 'NCC lẻ'. `useGoodsPurchase.ts` luôn tạo debtRecord khi `totalPayable > 0`.

---

### [x] Xử lý AUDIT-006 — processReturnOrder điều chỉnh ngày bán gốc *(xong 2026-06-19)*

> Xóa Case B trong `processReturnOrder` (`posOrderService.ts`): luôn ghi revenue vào ngày trả hàng, không điều chỉnh ngày bán gốc. Đây là thiết kế có chủ đích theo yêu cầu nghiệp vụ.

---

### [x] Xử lý AUDIT-008 — inferIsReturnOrder dùng fallback TH prefix và finalAmount < 0 *(xong 2026-06-19)*

> Đơn giản hoá `inferIsReturnOrder` trong `dataMapper.ts`: chỉ giữ `explicit === true`. Bỏ fallback `/^TH\d/i` và `finalAmount < 0` để tránh false positive.

---

### [x] Xử lý AUDIT-002 — costMethod chỉ lưu localStorage *(xong 2026-06-19)*

> Xóa dead state `costMethod / setCostMethod` trong `SettingsCenter.tsx` (đọc từ localStorage-only, không sync Supabase). `GoodsTab.tsx` đã handle đúng: đọc từ `inventorySettings.costMethod` (Supabase) và lưu qua `onUpdateInventorySettings`.

---

### [x] Xử lý AUDIT-015 — inventoryOutSync cập nhật đơn bằng serial loop *(xong 2026-06-19)*

> Chuyển `for (const o of toUpdate)` serial sang batch upsert `onConflict: 'order_id,sku', ignoreDuplicates: false` trong `routes/inventoryOutSync.ts`. Giảm từ N round-trips xuống 1 request.

---

### [x] Xử lý AUDIT-021 — determineCurrentPolicy thiếu gap check *(xong 2026-06-19)*

> Thêm gap check sau overlap check trong `businessLogic.payroll.ts`: cảnh báo khi `next.endThreshold < curr.startThreshold` — khoảng thâm niên không có policy nào bao phủ.

---

### [x] Tạo tài liệu business knowledge toàn hệ thống *(xong 2026-06-19)*

> Tạo 25 file tài liệu trong `docs/business-knowledge/`: 13 file chính + 12 operations. Ghi lại 12 nghiệp vụ, ~48 bảng, 11 state machines, 20+ business rules, 9 báo cáo, edge cases và bugs đã fix.

---

### [x] Xóa 81 đơn trùng giữa shop1.db và shop2.db *(xong 2026-06-18)*

> Dùng scan song song cả 2 bot để xác định đúng shop cho từng đơn. Kết quả: shop1=236, shop2=85, 0 trùng.

---

### [x] Trang vận đơn filter 15 ngày cửa sổ hoàn hàng *(xong 2026-06-18)*

> Bot lưu `first_delivered_at` khi đơn đạt "Đã giao"/"Đã nhận được hàng". App ẩn các đơn "Đã nhận được hàng" đã qua 15 ngày.

### [x] Xuất kho: sync toàn bộ đơn + cập nhật status *(xong 2026-06-18)*

> Nút "Đồng bộ Bot" giờ fetch tất cả pages + UPDATE status cho đơn đã có (chỉ status, giữ giá vốn). Response trả `inserted`/`updated`/`skipped`.

---

### [x] Bot đồng bộ đơn Shopee vào trang Xuất Kho *(xong 2026-06-18)*

> Route `POST /api/inventory-out/sync-from-bot` + nút "Đồng bộ Bot" trong `InventoryOutTab`. Phí tài chính (platformFee, paymentFee...) để 0 — người dùng cập nhật sau qua upload Excel Shopee.

---

### [x] Restart Shopee Monitor bot sau khi tái cấu trúc *(xong 2026-06-17)*

> Bots shopee-shop1 và shopee-shop2 đã restart thành công trên MacBook. Endpoint mới `/api/products/fetch/status` và `/api/product/sync-wait/:itemId` hoạt động. Lưu ý: bots chạy trên **MacBook** (user apple), không phải iMac quầy (user mac).

[x] Kết nối nút "Sync từ Shopee" vào ShopeeProductsPage *(xong 2026-06-17)*

---

### [x] Fix `cfobrain.phucsang.com.vn` bị down + swap subdomain *(xong 2026-06-17)*

> **Nguyên nhân:** `cfobrain.phucsang.com.vn` chưa có trong config cloudflared và chưa có DNS CNAME record.
> **Đã fix:** Thêm `cfobrain.phucsang.com.vn` → `localhost:8000` vào `~/.cloudflared/config.yml` trên iMac, thêm CNAME record trong Cloudflare DNS, restart cloudflared. Verify: trả về 401 (đúng — Supabase cần auth).

**Bước 1 — Fix service đang down (làm trên iMac):**
```bash
launchctl list | grep cfobrain   # kiểm tra service có chạy không
curl http://localhost:3000/health  # kiểm tra app respond không
tail -50 ~/cfobrain/logs/server.log  # xem lỗi
launchctl start cfobrain           # nếu service đã stop
```

**Bước 2 — Swap subdomain (sau khi app đã chạy lại):**

Mục tiêu mới:
| URL | Vai trò mới |
|---|---|
| `localhost:3000` | Dev/test |
| `app.phucsang.com.vn` | CFO Brain app — người dùng dùng hàng ngày |
| `cfobrain.phucsang.com.vn` | Supabase backend (Kong port 8000) |

Việc cần làm trong Cloudflare Tunnel:
1. Tunnel `app` → đổi trỏ sang `localhost:3000` (CFO Brain app)
2. Tunnel `cfobrain` → đổi trỏ sang `localhost:8000` (Supabase Kong)
3. Cập nhật `.env.local` MacBook: `VITE_SUPABASE_URL=http://192.168.1.3:8000` (đã đúng rồi, không cần đổi)
4. Cập nhật `.env.local` trên iMac: `SUPABASE_URL` vẫn giữ `http://localhost:8000`

**Deploy flow sau khi xong:**
```
Dev (localhost:3000) → npm run deploy → iMac build lại → app.phucsang.com.vn cập nhật
```

---

### ✅ Fix channel links — RLS + error display + backend route *(xong 2026-06-17)*

> Lỗi "object Object" khi liên kết kênh → fixed. Lỗi RLS trên `shopee_products` → fixed bằng route backend dùng service role key. `GoodsChannelLinksTab.tsx` giờ gọi `/api/channel-links/toggle` thay vì Supabase trực tiếp.

---

### ✅ Rewrite `ShopeeProductsPage.tsx` — dùng `shopee_inventory_out` làm nguồn dữ liệu *(xong 2026-06-17)*

> **Context:** Bảng `shopee_products` / `shopee_product_variants` đang rỗng (import thất bại do PostgREST schema cache). Chuyển sang dùng `shopee_inventory_out` + `pos_products` thay thế hoàn toàn.

**UI đã chốt (không thay đổi):**
```
DBD16                                    ▼ [bấm để mở]
┌────────────────────────────────────────────────────┐
│ [🟠 Giày Dép Da Phúc Sang] [⚫ Phúc Sang Đồ Da]   │  ← tab bar
├────────────────────────────────────────────────────┤
│ Nội dung tab đang chọn:                            │
│  DBD16-Đen-38 | 329k | 10 tồn | Đang bán  [Sửa]  │
│  DBD16-Đen-39 | 329k | 30 tồn | Đang bán  [Sửa]  │
│  DBD16-Đen-40 | 329k | 0 tồn  | Nháp      [Sửa]  │
└────────────────────────────────────────────────────┘
```

**Nguồn dữ liệu mới (đã xác nhận):**
- `shopee_inventory_out` → biết SKU nào bán ở shop nào + giá bán (avg nếu nhiều giá)
- `pos_products` → chỉ lấy tồn kho (match theo `sku`)
- KHÔNG dùng `shopee_products` / `shopee_product_variants`

**Mapping cột:**
| Cột | Nguồn |
|-----|-------|
| SKU variant | `shopee_inventory_out.sku` |
| Giá bán | `AVG(shopee_inventory_out.sale_price)` group by sku + platform |
| Tồn kho | `pos_products.stock` (match sku) |
| Trạng thái | stock > 0 → "Đang bán" / stock = 0 → "Nháp" |
| Nút Sửa | giữ lại, chức năng xác định sau |

**Hàng cha (parent row):**
- Group variant SKU theo `pos_products.parent_id`
- Tên hiển thị: SKU của parent (e.g., "DBD16")
- Chấm màu: 🟠 nếu có ở Shopee 1, ⚫ nếu có ở Shopee 2
- Có thể hiện tổng đã bán cả 2 shop

**Thuật toán `loadData()`:**
```
1. Fetch toàn bộ shopee_inventory_out (chỉ cần: sku, platform, sale_price, quantity)
2. Group by (sku, platform):
   - avgPrice = AVG(sale_price)
   - totalSold = SUM(quantity)
3. Collect tất cả unique SKUs → fetch pos_products WHERE sku IN (...)
4. Với mỗi pos_product tìm được:
   - Nếu có parent_id → fetch parent pos_product
   - Nếu is_parent → dùng làm parent
   - Nếu standalone (không parent, không is_parent) → tự làm parent
5. Build Map<parentId, { parent, shop1Variants[], shop2Variants[] }>
6. Sort theo parent.sku
```

**Interfaces mới (thay hoàn toàn interfaces cũ):**
```typescript
interface InventoryVariant {
  sku: string;
  platform: 'Shopee 1' | 'Shopee 2';
  avgPrice: number;
  totalSold: number;
  posProduct: PosProduct | null;
  stock: number;
}

interface ParentRow {
  parentId: string;     // pos_products.id của parent
  parentSku: string;    // e.g., "DBD16"
  posParent: PosProduct;
  shop1: InventoryVariant[];
  shop2: InventoryVariant[];
}
```

**File cần sửa:** `components/website/ShopeeProductsPage.tsx` (rewrite toàn bộ phần data loading + interfaces, giữ nguyên phần UI/layout đã có)

**Checklist:**
- [x] Rewrite interfaces (bỏ ShopeeShop, ShopeeProduct, ShopeeVariant, RootRow, EditingVariant) ✅
- [x] Rewrite `loadData()` theo thuật toán trên ✅
- [x] Rewrite `ShopTabContent` dùng `InventoryVariant[]` thay vì `ShopeeProduct` ✅
- [x] Rewrite hàng cha (`filteredRows`) dùng `ParentRow[]` ✅
- [x] Bỏ `CreateModal` (không cần tạo mới nếu nguồn là order history) ✅
- [x] Bỏ `VariantEditPanel` hoặc giữ placeholder cho phiên sau ✅
- [x] Test: trang hiển thị đúng danh sách cha/con theo đúng shop ✅ (verify trên iMac quầy)

**Lưu ý kỹ thuật:**
- `shopee_inventory_out` có 2359 rows — fetch 1 lần, không cần pagination
- SKU match: `pos_products.sku === shopee_inventory_out.sku` (có thể lệch case → normalize toLowerCase)
- Một số SKU trong `shopee_inventory_out` không match pos_products (đặc biệt SKU dạng "DQND21-Đen-39-Kèm Hộp") → hiển thị bình thường nhưng stock = null
- SHOP_COLORS: Shopee 1 → `bg-orange-500`, Shopee 2 → `bg-slate-600`

---

- [x] ~~**Audit toàn trang máy tính tiền, Round 6 (BUG-47 → BUG-48)**~~ — fast return modal xử lý đặt hàng + useMemo anti-pattern ✅ *(2026-06-15)*
- [x] ~~**Fix 10 bugs trang máy tính tiền (Round 7)**~~ — stale closure addToCart, debtAmount return, paymentMethod reset, tabsRef, receipt modal items, returnFee display, return UI fields, hasCheckoutItems, window.alert, cashSuggestions ✅ *(2026-06-15)*
- [x] ~~**Fix 4 bugs còn lại trang máy tính tiền (Round 8)**~~ — returnOtherRefund lưu vào POSOrder + hiện trên hóa đơn, ghi nợ in 2 dòng trùng, fast return maxQuantity, checkbox Giao hàng dummy ✅ *(2026-06-15)*


### Kiểm tra kỹ thuật

- [x] ~~Chạy `npx tsc --noEmit`~~ — TypeScript clean (1 lỗi pre-existing ở GoodsInventory.tsx không liên quan) ✅ *(2026-05-18)*
- [x] ~~**Audit & fix toàn bộ tiểu mục Báo cáo**~~ — 9 trang báo cáo, 11 file ✅ *(2026-05-18)*
- [x] ~~**Audit UI trống / nút không phản hồi toàn app**~~ — fix AnalysisContainer 2 case, 2 form tab, copy button, 13 files alert→toast ✅ *(2026-05-19)*
- [x] ~~**Audit & fix toàn bộ 8 trang Phân tích**~~ — 13 bugs: payroll missing, shopeeRevenue excluded, lineTotal calc, Cell vs rect, stock velocity, date filters, staff name resolution ✅ *(2026-05-22)*
- [x] ~~Chạy `npm test`~~ — 162 tests pass ✅ *(2026-05-16)*
- [x] ~~Fix 4 TypeScript lint debt errors~~ — đã fix showToast type errors ✅ *(2026-05-16)*
- [x] ~~Implement virtualization cho 12,739+ SKU~~ — đã implement @tanstack/react-virtual ✅ *(2026-05-16)*

- [x] ~~**Mở rộng AI CFO — thêm 4 tools mới**~~ — query_pos_orders, get_product_details, get_customer_stats, get_product_group_revenue + domain customers ✅ *(2026-05-22)*

- [x] ~~**Hệ thống nợ lương chuyển kỳ (carry-forward debt)**~~ — tích hợp đầy đủ: tính toán, hiển thị, in phiếu, nút tính lại lịch sử ✅ *(2026-05-26)*

### [x] Lazy load routes — React.lazy + Suspense *(xong 2026-06-23)*

> Chuyển 36 component trong `MainContent.tsx` từ eager import sang `React.lazy()` + `Suspense` wrapper.
> Giảm bundle size initial load, chỉ tải chunk khi user navigate tới route tương ứng.

---

### [ ] Lazy load DATA — Tách `fetchAllData()` thành route-specific loading

> **Kế hoạch chi tiết**: `docs/05-process/LAZY_LOAD_DATA_PLAN.md`
> Hiện tại 30 bảng Supabase load đồng thời trong 1 `Promise.all` → bottleneck ~8–10s.
> **Phase 1 (P0)**: Tách thành `fetchCriticalData()` (8 bảng) + `fetchDeferredData()` (22 bảng) → mục tiêu < 3s
> **Phase 2 (P1)**: Route-based loading — mỗi tab chỉ fetch bảng nó cần
> **Phase 3 (P2)**: Prefetch on hover + idle prefetch
> **Phase 4 (P2)**: Incremental sync (chỉ tải delta)

---

> **Note**: Đã hoàn thành tất cả P0 tasks! 🎉

- [x] ~~**Fix trang vận đơn + nút tải lại trigger bot**~~ — session_expired state, fetchOrders khi CONNECTED, POST /api/orders/refresh ✅ *(2026-06-18)*
- [x] ~~**Chạy SQL pending trên Supabase dashboard**~~ — ALTER TABLE carry-forward debt + RLS 5 bảng Shopee ✅ *(2026-06-13)*
- [x] ~~**Chạy SQL pending (Round 2)**~~ — `product_cost_history` index+RLS, 4 cột mới `pos_orders`, RLS 6 bảng nhạy cảm ✅ *(2026-06-15)*
- [x] ~~**Chạy SQL pending (Round 3)**~~ — `shopee_products` + `shopee_product_variants` tables ✅ *(2026-06-16)*
- [x] ~~**Audit toàn trang hàng hóa & thiết lập giá (BUG-29 → BUG-46)**~~ — 18 bugs, tất cả đã fix, TypeScript clean ✅ *(2026-06-15)*
- [x] ~~**Audit lần 2 trang hàng hóa (6 bugs error-handling)**~~ — missing await/catch trong 5 file, lọc Inactive ở dropdown nhập hàng ✅ *(2026-06-15)*
- [x] ~~**Audit lần 3 trang hàng hóa (5 bugs error-handling)**~~ — 5 handler thiếu try/catch trong GoodsInventory.tsx ✅ *(2026-06-15)*
- [x] ~~**Fix hệ thống thanh toán: Thẻ/Split payment**~~ — paymentMethod 'Card', split payment trên receipt, filter báo cáo ✅ *(2026-06-15)*

---

## 🟠 P1 — Help Center: Giai đoạn tiếp theo

### [x] Giai đoạn 1+2 — Cơ sở hạ tầng + Bài BÁN HÀNG + HÀNG HÓA *(xong 2026-06-20)*

- Tạo `components/help/HelpCenter.tsx` với sidebar danh mục, TOC phải, render Markdown + ảnh.
- Viết 4 bài đầu (pos-intro, pos-create-order, goods-search, goods-adjust) dạng step-by-step mật độ cao.
- Script Playwright chụp 45 screenshot với highlight đỏ chỉ thẳng vào UI element.

### [ ] Giai đoạn 3 — Bài MUA HÀNG + KHÁCH HÀNG & NCC

- [ ] **Mua hàng**: bài "Nhập hàng và tạo phiếu mua hàng" (màn hình PurchaseOrdersPage, form nhập hàng nhanh)
- [ ] **Khách hàng**: bài "Quản lý khách hàng và hạng thành viên"
- [ ] **Nhà cung cấp**: bài "Quản lý nhà cung cấp và công nợ"
- [ ] Screenshot tương ứng cho mỗi bài

### [ ] Giai đoạn 4 — Bài NHÂN SỰ & LƯƠNG + BÁO CÁO + CÀI ĐẶT

- [ ] **Nhân sự**: bài "Quản lý nhân viên và tính lương"
- [ ] **Báo cáo**: bài "Xem báo cáo doanh thu và lợi nhuận"
- [ ] **Cài đặt**: bài "Cấu hình hệ thống cơ bản"
- [ ] Screenshot tương ứng

---

## 🟠 P1 — Ưu tiên trung bình

- [x] ~~**Type hóa `services/dataMapper.ts` + `hooks/useAppData.ts`**~~ — giảm ~110 warning `any` còn lại *(xong 2026-05-15)*
  - Thay `previousData?: any` → `previousData?: AppDataItem<keyof AppData> | { id: string }`
  - Thêm import `AppDataItem` vào useAppData.ts
  - TypeScript clean, 162 tests pass

---

## 🔴 P0 — NGUY CƠ CAO: Refactor SettingsCenter.tsx (lag nặng)

> **Triệu chứng:** Trang Cài đặt lag, khó thao tác — mỗi gõ phím re-render toàn bộ.
> **Đã fix tạm:** `barcodeLabelPrintCss` → `useMemo` (2025-05-15).
> **Chưa fix gốc rễ:** 3,864 dòng + 48 useState monolithic.

- [x] ~~**Tách `SettingsCenter.tsx` thành các tab component độc lập**~~ *(đang làm - 3/4 tabs xong)*
  - [x] ~~PaymentsTab~~ *(xong 2026-05-15)*
  - [x] ~~AppearanceTab~~ *(xong 2026-05-15)*
  - [x] ~~GoodsTab~~ *(xong 2026-05-15)*
- [x] ~~**PrintTemplatesTab**~~ *(hoàn thành 100% - 2026-05-16)*
  - [x] ~~Invoice template~~ (xong)
  - [x] ~~Exchange template~~ (xong)
  - [x] ~~Barcode label template~~ (xong)
  - [x] ~~Payroll template~~ (xong)
  - [x] ~~Xóa code cũ trong SettingsCenter.tsx~~ (xong)

**Kết quả**: 
- ✅ File `PrintTemplatesTab.tsx` hoàn chỉnh (1699 dòng)
- ✅ TypeScript clean, 162/162 tests pass
- ✅ 4/4 templates hoàn chỉnh (Invoice + Exchange + Barcode + Payroll)
- ✅ Tất cả templates có editor + preview + print functionality
- ✅ **SettingsCenter.tsx giảm từ 2922 xuống 1157 dòng (giảm 60.4% / 1765 dòng)**
- ✅ Đã xóa toàn bộ: states (19 states), refs (3 refs), constants (5 constants), helper functions (12 functions), useMemo templates (3 useMemo)

### Cách làm (agent khác đọc và làm theo):

**Nguyên tắc:** Mỗi tab trở thành 1 component riêng, nhận `settings` qua props và callback `onSave`. State nội bộ (form đang nhập) chỉ sống trong tab đó — không bubble lên parent.

**Thứ tự tách (an toàn nhất → phức tạp nhất):**

1. **`PaymentsTab`** — state: `paymentForm`, `paymentAccountTab`, `editingAccount`, `accountModalTab`, `showPaymentAccountModal`
   - File mới: `components/settings/tabs/PaymentsTab.tsx`
   - Props nhận vào: `settings: POSPaymentSettings`, `onSave: (s: POSPaymentSettings) => void`
   - Di chuyển toàn bộ hàm `renderPaymentsTab()` + state liên quan vào component mới
   - Giữ `savePaymentSettings()` trong tab, gọi `onSave` sau khi save

2. **`AppearanceTab`** — state: `appearanceForm`, các barcode states (10 state)
   - File mới: `components/settings/tabs/AppearanceTab.tsx`
   - Đây là tab chứa `barcodeLabelPrintCss` nặng nhất

3. **`PrintTemplatesTab`** — state: `invoiceTemplateBody`, `exchangeTemplateBody`, `payrollTemplateBody`, `editingPrintTemplate*`
   - File mới: `components/settings/tabs/PrintTemplatesTab.tsx`

4. **`GoodsTab`** — phức tạp nhất, để cuối
   - State liên quan: `barcodeLabelColumns`, products, categories...

**Cách tách từng tab (pattern chuẩn):**
```tsx
// Bước 1: Tạo file mới
// components/settings/tabs/PaymentsTab.tsx
const PaymentsTab: React.FC<{
  settings: POSPaymentSettings;
  onSave: (s: POSPaymentSettings) => void;
}> = ({ settings, onSave }) => {
  const [form, setForm] = useState(settings);
  // ... toàn bộ logic từ renderPaymentsTab()
};
export default React.memo(PaymentsTab);

// Bước 2: Trong SettingsCenter.tsx, thay renderPaymentsTab() bằng:
// <PaymentsTab settings={posPaymentSettings} onSave={savePaymentSettings} />

// Bước 3: Xóa state đã chuyển sang tab mới khỏi SettingsCenter
```

**Kiểm tra sau mỗi tab tách:**
```bash
npx tsc --noEmit   # phải clean
npm test           # 43 tests phải pass
```

**Rủi ro cần lưu ý:**
- `savePaymentSettings` gọi Supabase — giữ nguyên logic, chỉ chuyển vào tab
- Modal `showPaymentAccountModal` dùng `createPortal` hoặc render trong tab cũng được
- Không xóa state trong SettingsCenter cho đến khi đã verify tab mới hoạt động

---

## 🟠 P1 — Tách file lớn (>1000 dòng, chưa có kế hoạch)

> Phát hiện 2026-05-15 khi quét toàn bộ codebase. Làm theo thứ tự: KnowledgeManager → GoodsInventory → POSComputer → PurchaseOrdersContainer.

---

### Tách `KnowledgeManager.tsx` (1,565 dòng)

- [x] ~~**Tách `KnowledgeManager.tsx`**~~ → `components/knowledge/` *(hoàn thành 100% - 2026-05-16)*
  - [x] ~~MechanismsViolationsSubTab~~ *(xong 2026-05-15, 152 dòng)*
  - [x] ~~MechanismsHolidaysSubTab~~ *(xong 2026-05-15, 82 dòng)*
  - [x] ~~MechanismsSalarySubTab~~ *(xong 2026-05-16, 394 dòng)*
  - [x] ~~StandardsWorkflowsTab~~ *(xong 2026-05-16, 239 dòng)*

**Kết quả**: File giảm từ 1565 → 778 dòng (**giảm 50.3%** / 787 dòng)

**Cấu trúc tab hiện tại:**
- `activeMainTab`: `'mechanisms' | 'standards' | 'workflows'`
- `activeMechSubTab`: `'salary' | 'holidays' | 'tet' | 'violations'`
- Tab `mechanisms` chứa 4 sub-tab, mỗi sub-tab ~200 dòng JSX
- Tab `standards` và `workflows` dùng chung layout, chỉ khác data

**Thứ tự tách:**

1. **`MechanismsSalarySubTab`** — dòng 395–788 (sub-tab Lương)
   - File mới: `components/knowledge/MechanismsSalarySubTab.tsx`
   - Props: `data: AppData`, `onUpdateData: (d: Partial<AppData>) => void`, `policyForm`, `setPolicyForm`, `selectedPolicyId`, `setSelectedPolicyId`
   - Chứa toàn bộ UI nhập cơ chế lương, bảng allowance

2. **`MechanismsViolationsSubTab`** — dòng 863–981 (sub-tab Vi phạm)
   - File mới: `components/knowledge/MechanismsViolationsSubTab.tsx`
   - Props: `localViolations`, `setLocalViolations`, `hasUnsaved`, `onSave`

3. **`MechanismsHolidaysSubTab`** — dòng 789–862 (sub-tab Nghỉ lễ)
   - File mới: `components/knowledge/MechanismsHolidaysSubTab.tsx`

4. **`StandardsWorkflowsTab`** — dòng 1142–1517 (tab Quy chuẩn + Quy trình dùng chung layout)
   - File mới: `components/knowledge/StandardsWorkflowsTab.tsx`
   - Props: `mode: 'standards' | 'workflows'`, `articles`, `onSave`, `onDelete`

**Pattern tách:**
```tsx
// components/knowledge/MechanismsViolationsSubTab.tsx
const MechanismsViolationsSubTab: React.FC<{
  localViolations: ViolationType[];
  setLocalViolations: (v: ViolationType[]) => void;
  hasUnsaved: boolean;
  onSave: (violations: ViolationType[]) => void;
}> = ({ localViolations, setLocalViolations, hasUnsaved, onSave }) => {
  // ... di chuyển JSX từ dòng 863–981 vào đây
};
export default React.memo(MechanismsViolationsSubTab);

// Trong KnowledgeManager.tsx thay bằng:
{activeMechSubTab === 'violations' && (
  <MechanismsViolationsSubTab
    localViolations={localViolations}
    setLocalViolations={setLocalViolations}
    hasUnsaved={hasUnsavedViolations}
    onSave={handleSaveViolations}
  />
)}
```

**Rủi ro:** `AllowanceInput`, `AllowanceRow`, `InputWrapper` (dòng 1518–1564) là helper components — giữ trong file riêng `components/knowledge/KnowledgeSharedUI.tsx` để dùng chung.

---

### Tách `GoodsInventory.tsx` (1,172 dòng)

- [x] ~~**Tách `GoodsInventory.tsx`**~~ → tách barcode utils ra ngoài *(xong 2026-05-15)*
  - [x] ~~Tách barcode utils~~ — dòng 63–364 (pure functions, không dùng hook)
    - File mới: `components/pos/goods/barcodeUtils.ts` (233 dòng)
    - Di chuyển: `CODE_128_PATTERNS`, `normalizeCode128Text`, `buildCode128Svg`, `buildLabelProductName`, `getBarcodeLabelTemplateSettings`, `printProductLabels`
    - Export tất cả, import lại trong `GoodsInventory.tsx`
  - [ ] **Tách `GoodsInventoryFilters`** — phần filter state + sidebar *(deferred)*
    - State cần chuyển: `filterCategories`, `filterBrand`, `filterStock`, `filterLocation`, `filterAttrs`, `filterSupplier`, `sortKey`, `sortDirection`
    - Hoặc gom vào custom hook `useGoodsFilters()` trả về toàn bộ filter state + handlers
  - [ ] **Tách `useGoodsBarcodeLabel` hook** — state barcode label template *(deferred)*
    - State: `barcodeLabelTemplate`, `labelsPerProduct`, `showBarcodePreview`
    - File mới: `components/pos/goods/useGoodsBarcodeLabel.ts`

**Kết quả đạt được:** `GoodsInventory.tsx` giảm từ 1172 → 849 dòng (**-27.5%** / 323 dòng), barcodeUtils.ts 233 dòng.

**Rủi ro đã xử lý:** `printProductLabels` gọi `window.print()` — giữ nguyên logic, chỉ chuyển file.

---

### Tách `POSComputer.tsx` (1,113 dòng)

- [x] ~~**Tách `POSComputer.tsx`**~~ → tách state ra custom hook *(xong 2026-05-15)*
  - [x] ~~Tách `usePOSState` hook~~ — tất cả state management logic
    - File mới: `hooks/usePOSState.ts` (243 dòng)
    - File mới: `components/pos/types.ts` (InvoiceTab interface)
    - Di chuyển ~30 useState vào hook
    - Bao gồm: search states, tab states, modal states, UI states, feedback states
    - Helper functions: openConfirm, closeConfirm, showScanFeedback, showStockWarning, resetNewCustomerForm
  - [x] ~~Cập nhật POSComputer.tsx~~ — sử dụng usePOSState hook
    - Xóa tất cả useState declarations (~80 dòng)
    - Xóa helper functions đã chuyển vào hook
    - Giữ lại refs (productSearchRef, checkoutRef, etc.) vì liên quan DOM
    - Giữ lại business logic (addToCart, updateQuantity, handleCheckout, etc.)
  - [x] ~~Tách InvoiceTab interface~~ — tránh circular dependency
    - File mới: `components/pos/types.ts`
    - Cập nhật imports trong: usePOSReturnFlow.ts, usePOSTabs.ts, POSCheckout.tsx, POSHeaderToolbar.tsx

**Kết quả đạt được:** `POSComputer.tsx` giảm từ 1113 → 1021 dòng (**-8.3%** / 92 dòng), usePOSState.ts 243 dòng.

**Lợi ích:**
- Giảm re-render: State được tách riêng, dễ optimize với React.memo
- Dễ test: Hook có thể test độc lập
- Dễ maintain: Logic state tách biệt khỏi UI logic
- Tránh stale closure: Refs vẫn giữ trong component chính

**Rủi ro đã xử lý:** 
- Circular dependency: Tách InvoiceTab ra file riêng
- Refs không chuyển vào hook: checkoutRef, cartLengthRef cần ở component level để fix stale closure

---

### Tách `PurchaseOrdersContainer.tsx` (1,086 dòng)

- [x] ~~**Tách `PurchaseOrdersContainer.tsx`**~~ → tách form state ra hooks *(xong 2026-05-15)*
  - [x] ~~Tách `usePurchaseFormState` hook~~ — purchase + return form states
    - File mới: `hooks/usePurchaseFormState.ts` (105 dòng)
    - Di chuyển 14 useState: purchaseItems, purchaseSupplier, purchaseNote, purchaseDiscountValue, purchaseDiscountType, returnItems, returnSupplier, returnNote, returnDiscountValue, returnDiscountType, returnSupplierPaidAmount, returnApplySupplierDebt, showPurchaseForm, showPurchaseReturnForm
    - Helper functions: resetPurchaseForm, resetReturnForm, getPurchaseItemsNetTotal, getPurchaseBillDiscountAmount, getReturnItemsNetTotal, getReturnBillDiscountAmount, getReturnSupplierMustPay
  - [x] ~~Tách `usePurchaseQuickModals` hook~~ — quick product/supplier modal states
    - File mới: `hooks/usePurchaseQuickModals.ts` (75 dòng)
    - Di chuyển 10 useState: showQuickProductForm, quickProductTarget, quickProductModalTab, showQuickProductStockSection, showQuickProductLocationSection, showQuickProductUnitsSection, quickProductForm, showQuickSupplierForm, quickSupplierTarget
    - Helper function: resetQuickProductForm
  - [x] ~~Cập nhật PurchaseOrdersContainer.tsx~~ — sử dụng 2 hooks mới
    - Xóa 24 useState declarations
    - Xóa helper functions đã chuyển vào hooks
    - Giữ lại: refs, business logic, render logic
    - Cập nhật handleSaveDraft, handleCompletePurchase để dùng resetPurchaseForm

**Kết quả đạt được:** `PurchaseOrdersContainer.tsx` giảm từ 1087 → 1061 dòng (**-2.4%** / 26 dòng), 2 hooks mới 180 dòng.

**Lợi ích:**
- Giảm re-render: Form state tách riêng
- Dễ test: Hooks test độc lập
- Dễ maintain: Form logic tách biệt UI
- Tái sử dụng: Hooks có thể dùng cho các form tương tự

**Rủi ro đã xử lý:**
- Giữ lại getPurchaseLineTotal trong component vì được dùng nhiều nơi
- Refs không chuyển vào hook: purchaseFileInputRef, returnFileInputRef cần ở component level

---

**Kiểm tra sau mỗi file tách:**
```bash
npx tsc --noEmit   # phải clean
npm test           # 43 tests phải pass
```

---

## ✅ Hệ thống Hóa đơn đầu vào — HOÀN THÀNH 2026-05-17

- [x] ~~**Giai đoạn 1**: InvoiceBadge + cột Chứng từ trong PurchaseInvoices.tsx~~ *(xong 2026-05-17)*
- [x] ~~**Giai đoạn 2**: services/invoiceService.ts + types.ts + supabase_setup.sql~~ *(xong 2026-05-17)*
- [x] ~~**Giai đoạn 3**: Wire invoice state vào useGoodsPurchase + PurchaseOrdersContainer + GoodsInventory; GoodsPurchaseForm UI chọn trạng thái + upload file~~ *(xong 2026-05-17)*
- [x] ~~**Giai đoạn 4**: Báo cáo VAT + Xuất Excel 2 sheet trong PurchaseInvoices.tsx~~ *(xong 2026-05-17)*

**Việc thủ công trên Supabase dashboard:**
- [x] ~~Chạy SQL migration trong `supabase_setup.sql`~~ *(xong 2026-05-17)*
- [x] ~~Tạo Storage bucket `purchase-invoices` với policy: authenticated users INSERT + SELECT~~ *(xong 2026-05-17)*

---

## ✅ UI Refactor — Design System — HOÀN THÀNH 2026-06-04

- [x] ~~**Phase 1 — Foundation**: tailwind.config tokens, primary color unification~~ ✅ *(2026-06-04)*
  - `tailwind.config.js`: fontSize.2xs, colors (primary/muted/highlight), boxShadow (card/panel/dropdown/modal), zIndex (dropdown/sticky/overlay/modal/toast/tooltip)
  - 26 file: `bg-blue-600/700` → `bg-indigo-600/700` (thống nhất primary = indigo)
  - `Button`, `Modal`, `Badge` trong `shared/ui/`: fix variant sai, z-index token, shadow token
- [x] ~~**Phase 2 — Consistency**: typography, z-index, font-weight toàn app~~ ✅ *(2026-06-04)*
  - 1,131 arbitrary font sizes (`text-[10-13px]`) → `text-2xs/xs/sm`
  - 88 z-indexes loạn (`z-[100..10000]`) → `z-modal/z-toast/z-dropdown`
  - 401 `font-black` → `font-semibold` (labels không cần weight 900)
  - `Card.tsx`: shadow prop dùng tokens mới
- [x] ~~**Phase 3 — Polish**: EmptyState, Skeleton, micro-interactions~~ ✅ *(2026-06-04)*
  - Tạo `EmptyState` (compact/default, icon/title/description/action)
  - Tạo `Skeleton` + `TableSkeleton` + `CardSkeleton` + `SidebarSkeleton` (CSS animate-pulse)
  - 130 `transition-all` → `transition-colors` (43 file không có transform)
  - `shared/ui/index.ts`: export đủ 7 component (Button/Card/Input/Badge/Modal/EmptyState/Skeleton)

> **Việc còn lại sau 3 phase** (ưu tiên thấp, không block):
> - Thay ~320 `transition-all` còn lại trong file có transform (case-by-case)
> - Migrate các modal tự viết sang `Modal` component chuẩn
> - Migrate các empty state inline sang `EmptyState` component

---

## 🟠 P1 — Shared Hooks (tái sử dụng, tránh viết lại từ đầu)

> Triết lý: build 1 lần chuẩn → trang mới chỉ truyền thêm điều kiện đặc thù.
> Giống như `ListPageLayout`, `ListPageToolbar`, `FilterDateRange` đã làm cho UI.

### [ ] `useChannelProducts` — **Ưu tiên cao nhất**

Đang duplicate logic ở 4 chỗ: `OnlineCatalogPage`, `ShopeeProductsPage`, `GoodsChannelLinksTab`, `ProductContentTab`. Mỗi chỗ tự gọi `/api/channel-links/catalog-links` + fetch products theo ID chunk riêng.

- File: `hooks/useChannelProducts.ts`
- Return: `{ allProducts, shopeeProducts, websiteProducts, shopeeIds, websiteIds, loading }`
- Logic: fetch catalog-links → chunk 30 ID → fetch pos_products → build 3 list
- Sau khi xong: refactor 4 component trên dùng hook này

### [ ] `useDateRangeFilter` — **Ưu tiên cao**

30+ file tự quản lý `startDate`/`endDate` state riêng. Tất cả trang analysis, reports, orders đều viết lại logic tính ngày mặc định, shortcut "tháng này / quý này / năm nay".

- File: `hooks/useDateRangeFilter.ts`
- Return: `{ startDate, endDate, setStartDate, setEndDate, preset, setPreset, reset }`
- Presets: `'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'`
- Mỗi trang truyền thêm điều kiện đặc thù (filter theo channel, nhân viên...) bên ngoài hook

### [ ] `usePagination(total, pageSize)` — **Ưu tiên trung bình**

Nhiều list page (audit, customers, orders, finance) tự tính `totalPages`, `currentPage`, slice data. `ListPagePagination` component đã có nhưng logic tính toán vẫn nằm rải rác.

- File: `hooks/usePagination.ts`
- Return: `{ page, setPage, totalPages, pageSize, setPageSize, paginatedItems }`

### [ ] `useSupabaseQuery<T>` — **Ưu tiên trung bình**

27 component tự gọi `supabase.from()` + tự quản lý `loading`, `error`, `data`. Boilerplate lặp lại ở khắp nơi.

- File: `hooks/useSupabaseQuery.ts`
- Return: `{ data, loading, error, refetch }`
- Accept: query builder function, dependencies array

### [ ] `useClipboard(timeout?)` — **Ưu tiên thấp**

Pattern `copied` state + `navigator.clipboard.writeText` + `setTimeout reset` lặp ở 6 chỗ.

- File: `hooks/useClipboard.ts`
- Return: `{ copy(text), copied }`
- Default timeout: 2000ms

---

## 🔵 P2 — Ưu tiên thấp / Phase tiếp theo

> **Note:** Layout Components proposal đã bị reject. Lý do: Refactor 20+ pages chỉ để tiết kiệm code là rủi ro cao/lợi ích thấp. Không fix bug, không thêm tính năng. Thời gian nên dùng cho những thứ user thực sự thấy.

### Refactoring

- [x] ~~**Tách `StaffManager.tsx`**~~ (827 dòng) → tách state ra hook *(hoàn thành 2026-05-16)*
  - [x] ~~Tạo `hooks/useStaffManagerState.ts`~~ (79 dòng)
  - [x] ~~Di chuyển 3 useState: activeTab, formData, editingEmployee~~
  - [x] ~~Thêm helpers: resetForm, loadEmployeeForEdit~~
  - [x] ~~Cập nhật StaffManager.tsx sử dụng hook~~
  - **Kết quả:** StaffManager.tsx giảm từ 827 → 821 dòng (-0.7%), TypeScript clean, 190/190 tests pass ✅

- [x] ~~**Tách `PayrollManager.tsx`**~~ (777 dòng) → đã có hook từ trước *(verified 2026-05-16)*
  - **Trạng thái:** File này đã sử dụng `hooks/usePayrollState.ts` (comprehensive hook 243 dòng)
  - **Hook đã extract:** Tất cả state, constants, computed values, helpers
  - **Component chỉ còn:** Business logic handlers (finalize, settlement, undo, input changes)
  - **Kết luận:** Đã được tối ưu tốt, không cần refactor thêm ✅

### Theo dõi (650–800 dòng, chưa cần tách gấp)

- [x] ~~`GoodsInventory.tsx`~~ (849 dòng) — đã tách barcode utils + useGoodsFilters hook, đã tối ưu tốt *(2026-05-15)*
- [x] ~~`ProductGroupManager.tsx`~~ (827 dòng) — đã tách 3 sub-tabs (LedgerTab, MatrixTab, TreeTab), đã tối ưu tốt
- [x] ~~`StaffManager.tsx`~~ (821 dòng) — đã tách state ra hook useStaffManagerState *(2026-05-16)*
- [x] ~~`PayrollManager.tsx`~~ (777 dòng) — đã có hook usePayrollState từ trước, đã tối ưu tốt *(2026-05-16)*
- [ ] `types.ts` (791 dòng) — xem xét tách theo domain (pos, payroll, inventory...)
- [ ] `services/apiService.ts` (755 dòng) — xem xét tách theo module
- [ ] `hooks/useAppData.ts` (707 dòng) — đã có task type hóa ở P1

---

## 🔧 Shopee Monitor — Backfill dữ liệu phí đơn hàng cũ vào SQLite

> **Mục đích:** Các đơn hàng cũ trong SQLite chỉ có `total_fee` tổng gộp, thiếu 6 cột phí riêng lẻ vừa thêm (`commission_fee`, `service_fee`, `transaction_fee`, `piship_fee`, `vat_tax`, `pit_tax`). Script này gọi lại Shopee API để fill đầy đủ.

- [ ] **Tạo script `/Users/apple/shopee-monitor/scripts/backfill.js`**

### Điều kiện trước khi chạy

1. `shopee-bot` phải đang chạy (`pm2 status` → shopee-bot = online)
2. Trình duyệt Playwright đã đăng nhập Shopee Seller Center (còn session)

### Kế hoạch implement chi tiết

**Bước 1 — Kết nối vào browser đang chạy của shopee-bot:**

shopee-bot khởi động Playwright với `--remote-debugging-port`. Cần tìm port này (hoặc hardcode) và dùng `chromium.connectOverCDP()`:

```js
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];
```

> Nếu shopee-bot chưa expose CDP port, cần thêm `args: ['--remote-debugging-port=9222']` vào Playwright launch options trong `monitor.js`.

**Bước 2 — Đọc danh sách order_sn cần backfill:**

```js
const db = require('../src/db');
// Lấy các đơn chưa có commission_fee (= chưa backfill)
const orders = db.db.prepare(`
    SELECT o.order_sn FROM orders o
    LEFT JOIN order_details d ON o.order_sn = d.order_sn
    WHERE d.commission_fee IS NULL OR d.commission_fee = 0
    ORDER BY o.created_at DESC
`).all();
```

**Bước 3 — Gọi API income cho từng đơn (reuse logic từ monitor.js):**

```js
async function fetchOrderIncome(page, orderSn) {
    const result = await page.evaluate(async (sn) => {
        const url = `https://seller.shopee.vn/api/order/get_order_income_components/?order_sn=${sn}`;
        const r = await fetch(url, { credentials: 'include' });
        return r.json();
    }, orderSn);
    return result;
}
```

Parse response giống hệt logic trong `monitor.js` (hàm `parseBreakdown` / `getSub` / `get`).

**Bước 4 — UPDATE từng đơn vào SQLite:**

```js
const updateFees = db.db.prepare(`
    UPDATE order_details SET
        commission_fee  = ?,
        service_fee     = ?,
        transaction_fee = ?,
        piship_fee      = ?,
        vat_tax         = ?,
        pit_tax         = ?
    WHERE order_sn = ?
`);
```

**Bước 5 — Loop với delay để tránh rate limit:**

```js
for (const { order_sn } of orders) {
    try {
        const data = await fetchOrderIncome(page, order_sn);
        // parse fees từ data...
        updateFees.run(commissionFee, serviceFee, transactionFee, pishipFee, vatTax, pitTax, order_sn);
        console.log(`✅ ${order_sn}`);
    } catch (e) {
        console.log(`❌ ${order_sn}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500)); // 1.5s delay
}
```

**Chạy script:**

```bash
cd /Users/apple/shopee-monitor
node scripts/backfill.js
```

### Rủi ro cần xử lý

| Vấn đề | Xử lý |
|---|---|
| shopee-bot chưa expose CDP port | Thêm `--remote-debugging-port=9222` vào launch options |
| `get_order_income_components` trả empty cho đơn chưa complete | Bỏ qua (try/catch), chỉ update khi có data |
| Session hết hạn giữa chừng | Script sẽ nhận lỗi 401/redirect — dừng và báo |
| Nhiều đơn (1000+) | Delay 1.5s → ~25 phút/1000 đơn, có thể để chạy ngầm |

### Lưu ý thêm

- Sau khi backfill xong → confirm PiShip field name thực tế từ log (field_name trong API response)
- Nếu cần xem log realtime: `pm2 logs shopee-shop1`
- Script có thể chạy nhiều lần an toàn (chỉ update đơn chưa có fee)

---

## ✅ HOÀN THÀNH 2026-06-06 — MIGRATE DATABASE: Supabase Cloud → iMac cá nhân (self-hosted)

> **Deadline**: trước 03/07/2026 (Supabase bắt nâng gói)
> **Lý do**: Supabase free tier vượt quota, self-host tiết kiệm $25/tháng
> **Môi trường mục tiêu**:
> - Server: iMac cá nhân 1TB, cùng WiFi với iMac quầy
> - Cách truy cập từ xa: Cloudflare Tunnel
> - Chi phí: $0/tháng (chỉ tiền điện ~50-100k/tháng)

---

### Thông tin cần biết trước khi làm

**Supabase Cloud hiện tại:**
- Project URL: `https://tqouzxlnihfjdyxqlbqs.supabase.co`
- Database: 0.152GB (152MB), 48 bảng
- Không dùng Auth, Realtime, Storage (hiện tại)

**Fly.io đã tạo (có thể bỏ sau khi xong):**
- App: `cfobrain-supabase` (blank app, chưa dùng)
- Postgres: `cfobrain-db` (đã import 48 bảng — nhưng không dùng vì app cần Supabase API)
- Cần xóa sau khi migrate xong để khỏi tốn tiền

**File backup data đã có:**
- `~/Desktop/supabase_backup.sql` — schema gốc từ Supabase
- `~/Desktop/supabase_backup_clean.sql` — đã làm sạch (bỏ Supabase-specific)

---

### BƯỚC 1 — Chuẩn bị iMac cá nhân

#### 1.1 Cài Docker Desktop
- Tải tại: https://www.docker.com/products/docker-desktop/
- Chọn đúng chip: vào **Apple menu → About This Mac** xem Chip (Apple Silicon M1/M2/M3) hay Intel
- Cài xong mở lên, đợi icon Docker trên thanh menu ngừng loading

#### 1.2 Cài Homebrew (nếu chưa có)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Sau khi cài xong, thêm vào PATH:
- **Apple Silicon**: `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"`
- **Intel**: `echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/usr/local/bin/brew shellenv)"`

#### 1.3 Cài đặt không tắt màn hình khi chạy server
- **System Settings → Energy Saver (hoặc Battery)**:
  - `Prevent Mac from sleeping`: ✅ Bật
  - `Turn display off after`: 15 phút (tiết kiệm điện)
  - `Wake for network access`: ✅ Bật
- **System Settings → Displays → Advanced**: tắt màn hình khi không dùng

#### 1.4 Ghi lại IP nội bộ của iMac cá nhân
```bash
ipconfig getifaddr en0
```
Lưu lại IP này (ví dụ: `192.168.1.10`) — iMac quầy sẽ kết nối vào địa chỉ này.

---

### BƯỚC 2 — Clone và cấu hình Supabase self-hosted

#### 2.1 Clone repo Supabase
```bash
cd ~
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

#### 2.2 Tạo secrets
Chạy lần lượt các lệnh sau để tạo secrets:
```bash
# Tạo JWT secret (32 chars)
openssl rand -base64 32
```

Dùng Node.js tạo ANON_KEY và SERVICE_ROLE_KEY:
```bash
node -e "
const jwt_secret = 'PASTE_JWT_SECRET_HERE';
function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function createJWT(payload, secret) {
  const header = base64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const body = base64url(JSON.stringify(payload));
  const crypto = require('crypto');
  const sig = crypto.createHmac('sha256', secret).update(header+'.'+body).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return header+'.'+body+'.'+sig;
}
const iat = Math.floor(Date.now()/1000);
const exp = iat + (10*365*24*60*60);
console.log('ANON_KEY:', createJWT({role:'anon',iss:'supabase',iat,exp}, jwt_secret));
console.log('SERVICE_KEY:', createJWT({role:'service_role',iss:'supabase',iat,exp}, jwt_secret));
"
```

Tạo password mạnh cho Postgres:
```bash
openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24
```

#### 2.3 Cập nhật file .env
Mở `~/supabase/docker/.env` và sửa các giá trị sau:
```env
POSTGRES_PASSWORD=<password vừa tạo>
JWT_SECRET=<jwt secret vừa tạo>
ANON_KEY=<anon key vừa tạo>
SERVICE_ROLE_KEY=<service role key vừa tạo>
DASHBOARD_PASSWORD=<đặt password để đăng nhập Supabase Studio>
SITE_URL=http://localhost:8000
```

---

### BƯỚC 3 — Khởi động Supabase

#### 3.1 Chạy docker-compose
```bash
cd ~/supabase/docker
docker compose up -d
```

Lần đầu sẽ tải ~2-3GB Docker images, chờ 5-10 phút.

#### 3.2 Kiểm tra tất cả services đang chạy
```bash
docker compose ps
```
Tất cả services phải có STATUS = `running` hoặc `healthy`:
- `supabase-db` (PostgreSQL)
- `supabase-kong` (API Gateway)
- `supabase-auth` (GoTrue)
- `supabase-rest` (PostgREST)
- `supabase-realtime`
- `supabase-storage`
- `supabase-studio`

#### 3.3 Kiểm tra truy cập
- Mở browser: `http://localhost:8000` → Supabase Studio
- Đăng nhập bằng `DASHBOARD_PASSWORD` đã set

---

### BƯỚC 4 — Import data từ Supabase Cloud

#### 4.1 Copy file backup lên iMac cá nhân
Từ MacBook, copy file backup sang iMac cá nhân qua AirDrop hoặc:
```bash
scp ~/Desktop/supabase_backup_clean.sql apple@<IP_IMAC>:~/Desktop/
```

#### 4.2 Tạo roles cần thiết
```bash
docker exec -it supabase-db psql -U postgres -c "
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
"
```

#### 4.3 Import schema
```bash
docker exec -i supabase-db psql -U postgres < ~/Desktop/supabase_backup_clean.sql
```

#### 4.4 Export và import DATA (rows thực tế)
Từ MacBook, export data:
```bash
SUPABASE_ACCESS_TOKEN=sbp_c9e7702b2e5404754f0f7c9120a872512f6c7e6f npx supabase@2.105.0 db dump --linked --data-only -f ~/Desktop/supabase_data.sql
```

Copy sang iMac cá nhân rồi import:
```bash
docker exec -i supabase-db psql -U postgres < ~/Desktop/supabase_data.sql
```

#### 4.5 Verify số bảng và row count
```bash
docker exec -it supabase-db psql -U postgres -c "\dt public.*" | wc -l
```
Phải thấy 48 bảng.

---

### BƯỚC 5 — Lấy URL và Keys của Supabase local

Sau khi chạy xong, Supabase local có:
- **URL**: `http://<IP_IMAC_CÁ_NHÂN>:8000`
- **ANON_KEY**: giá trị đã tạo ở Bước 2.2
- **SERVICE_ROLE_KEY**: giá trị đã tạo ở Bước 2.2

---

### BƯỚC 6 — Cài Cloudflare Tunnel (truy cập từ xa)

#### 6.1 Tạo tài khoản Cloudflare (nếu chưa có)
- Vào https://cloudflare.com → đăng ký miễn phí

#### 6.2 Cài cloudflared trên iMac cá nhân
```bash
brew install cloudflared
```

#### 6.3 Đăng nhập Cloudflare
```bash
cloudflared tunnel login
```
Sẽ mở browser, đăng nhập và chọn domain (hoặc dùng domain `.trycloudflare.com` miễn phí).

#### 6.4 Tạo tunnel
```bash
cloudflared tunnel create cfobrain
```
Lưu lại tunnel ID được tạo ra.

#### 6.5 Tạo file config
Tạo file `~/.cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/apple/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: cfobrain.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

#### 6.6 Chạy tunnel tự động khi khởi động
```bash
cloudflared service install
```

#### 6.7 Test truy cập từ xa
Mở điện thoại hoặc MacBook từ mạng khác → vào `https://cfobrain.yourdomain.com` → phải thấy Supabase Studio.

---

### BƯỚC 7 — Cập nhật app kết nối vào Supabase local

#### 7.1 Cập nhật `.env.local` trên MacBook (dev)
```env
# Khi dev (cùng mạng WiFi)
VITE_SUPABASE_URL=http://192.168.1.10:8000
VITE_SUPABASE_ANON_KEY=<anon key mới>
SUPABASE_URL=http://192.168.1.10:8000
SUPABASE_ANON_KEY=<anon key mới>
SUPABASE_SERVICE_ROLE_KEY=<service role key mới>
```

#### 7.2 Cập nhật `.env.local` trên iMac quầy (production)
```env
# iMac quầy cùng mạng → dùng IP nội bộ
VITE_SUPABASE_URL=http://192.168.1.10:8000
VITE_SUPABASE_ANON_KEY=<anon key mới>
SUPABASE_URL=http://192.168.1.10:8000
SUPABASE_ANON_KEY=<anon key mới>
SUPABASE_SERVICE_ROLE_KEY=<service role key mới>
```

#### 7.3 Nếu truy cập từ xa (MacBook đi lại / điện thoại)
```env
# Dùng Cloudflare Tunnel URL
VITE_SUPABASE_URL=https://cfobrain.yourdomain.com
```

---

### BƯỚC 8 — Test toàn bộ

- [ ] Mở app trên iMac quầy → đăng nhập, tạo đơn hàng → kiểm tra data trong Supabase Studio
- [ ] Mở app trên MacBook (cùng mạng) → kiểm tra kết nối
- [ ] Dùng điện thoại (mạng 4G) → truy cập qua Cloudflare Tunnel → kiểm tra tốc độ
- [ ] Tắt màn hình iMac cá nhân → kiểm tra app vẫn chạy bình thường

---

### BƯỚC 9 — Dọn dẹp Fly.io (sau khi migrate xong)

Xóa để khỏi tốn tiền:
```bash
flyctl apps destroy cfobrain-supabase
flyctl apps destroy cfobrain-db
```

---

### Backup tự động (setup sau khi migrate xong)

Tạo cron job backup mỗi đêm 2:00 AM:
```bash
crontab -e
```
Thêm dòng:
```
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres > ~/Backups/supabase_$(date +\%Y\%m\%d).sql
```

---

### Thông tin quan trọng đã có sẵn

| Thứ | Giá trị |
|---|---|
| Supabase Access Token | `sbp_c9e7702b2e5404754f0f7c9120a872512f6c7e6f` |
| File backup schema | `~/Desktop/supabase_backup_clean.sql` (MacBook) |
| Supabase Cloud URL | `https://tqouzxlnihfjdyxqlbqs.supabase.co` |
| Fly.io Postgres password | `4A9smTp8oZj8S4A` (có thể dùng lại làm POSTGRES_PASSWORD) |

---

## 🔴 P0 — Setup SSH key để push GitHub từ iMac

> Làm khi gần iMac. Code đã commit đủ trên máy (6 commit chưa push), chỉ còn bước xác thực.

### Các bước thực hiện (mở Terminal trên iMac)

```bash
# Bước 1 — Tạo SSH key
ssh-keygen -t ed25519 -C "ngothanhdus2np@gmail.com"
# Hỏi lưu ở đâu → Enter (giữ mặc định)
# Hỏi passphrase → Enter 2 lần (bỏ trống)

# Bước 2 — Copy public key vào clipboard
cat ~/.ssh/id_ed25519.pub | pbcopy
```

Sau đó vào **GitHub → Settings → SSH and GPG keys → New SSH key**:
- Title: `iMac Phúc Sang`
- Dán key (Cmd+V) → Add SSH key

```bash
# Bước 3 — Chuyển remote sang SSH + push
cd "/Users/apple/phucsang app/QU-N-TR-C-A-H-NG"
git remote set-url origin git@github.com:ngothanhdus2np/QU-N-TR-C-A-H-NG.git
git push origin main
```

---

## 🟠 P1 — Setup backup tự động lên Mega.nz

> Cần làm trên iMac cá nhân (iMac chạy server). Tài khoản Mega free 20GB đã có sẵn.
>
> **Bối cảnh đã thống nhất (2026-06-17):**
> - App chạy hoàn toàn trên local Supabase (`192.168.1.3:8000`) — không phụ thuộc Supabase cloud
> - Backup theo chiến lược **full dump mỗi đêm** (không phải incremental) vì:
>   - File dump nén chỉ ~5-20MB — nhỏ, không cần incremental
>   - Full dump = restore 1 file duy nhất, không cần ghép nhiều file
>   - Giữ đủ lịch sử để so sánh doanh thu qua các năm
> - Tool: **rclone** (hỗ trợ Mega, dùng được trong cron/launchd)
> - Scheduler: **launchd** (không dùng cron vì launchd bền hơn, tự chạy bù nếu iMac tắt lúc 2AM)

---

### Cấu trúc thư mục trên Mega

```
Mega/
  cfobrain-backup/
    daily/          ← giữ 7 bản gần nhất (tự xóa cũ hơn 7 ngày)
      cfobrain_2026-06-17.sql.gz
      cfobrain_2026-06-16.sql.gz
      ...
    weekly/         ← giữ 4 bản (chỉ tạo vào Chủ nhật, tự xóa cũ hơn 28 ngày)
      cfobrain_2026-06-15.sql.gz
      ...
    monthly/        ← giữ mãi mãi (chỉ tạo vào mồng 1 mỗi tháng, không xóa)
      cfobrain_2026-06-01.sql.gz
      cfobrain_2026-05-01.sql.gz
      ...
```

**Ước tính dung lượng sau 5 năm:** ~1.5GB — thoải mái trong 20GB Mega free.

---

### File cần tạo (chỉ 2 file, không sửa file nào hiện có)

| File | Mục đích |
|---|---|
| `scripts/backup-mega.sh` | Script backup chính |
| `scripts/com.cfobrain.backup.plist` | Lịch chạy tự động qua launchd |

---

### BƯỚC 1 — Cài rclone và kết nối Mega (làm 1 lần, thủ công trên iMac)

```bash
# Cài rclone
brew install rclone

# Cấu hình kết nối Mega
rclone config
# → New remote → đặt tên: mega
# → Storage type: chọn Mega
# → Nhập email + password Mega
# → Xác nhận xong

# Test kết nối
rclone ls mega:

# Tạo thư mục gốc trên Mega
rclone mkdir mega:cfobrain-backup
rclone mkdir mega:cfobrain-backup/daily
rclone mkdir mega:cfobrain-backup/weekly
rclone mkdir mega:cfobrain-backup/monthly
```

---

### BƯỚC 2 — Tạo script backup (`scripts/backup-mega.sh`)

Script làm 5 việc theo thứ tự:
1. Xác định hôm nay là daily / weekly / monthly (dựa vào ngày trong tuần + ngày trong tháng)
2. `pg_dump` từ PostgreSQL trong Docker → nén thành `.sql.gz`
3. Upload file lên đúng thư mục Mega tương ứng
4. Xóa file cũ theo chính sách giữ
5. Ghi log kết quả vào `/tmp/cfobrain-backup.log`

**Logic phân loại ngày:**
```bash
DAY_OF_WEEK=$(date +%u)   # 7 = Chủ nhật
DAY_OF_MONTH=$(date +%d)  # 01 = mồng 1

if [ "$DAY_OF_MONTH" = "01" ]; then
  FOLDER="monthly"    # mồng 1 → monthly (không bao giờ xóa)
elif [ "$DAY_OF_WEEK" = "7" ]; then
  FOLDER="weekly"     # Chủ nhật → weekly (giữ 4 tuần)
else
  FOLDER="daily"      # Còn lại → daily (giữ 7 ngày)
fi
```

**Chính sách xóa file cũ:**
- `daily/`: xóa file cũ hơn 7 ngày
- `weekly/`: xóa file cũ hơn 28 ngày
- `monthly/`: không xóa

**Lệnh pg_dump** (chạy qua Docker vì Supabase dùng Docker):
```bash
FILENAME="cfobrain_$(date +%Y-%m-%d).sql.gz"
docker exec supabase-db pg_dump -U postgres postgres | gzip > ~/Backups/$FILENAME
```

---

### BƯỚC 3 — Đăng ký launchd (`scripts/com.cfobrain.backup.plist`)

File plist cấu hình launchd chạy script mỗi đêm lúc 2:00 AM:

```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key><integer>2</integer>
  <key>Minute</key><integer>0</integer>
</dict>
```

**Cài đặt launchd sau khi tạo file:**
```bash
cp scripts/com.cfobrain.backup.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.cfobrain.backup.plist
```

---

### BƯỚC 4 — Chạy lần đầu thủ công (full backup toàn bộ data)

```bash
# Tạo thư mục local chứa backup tạm
mkdir -p ~/Backups

# Chạy script lần đầu
bash scripts/backup-mega.sh

# Kiểm tra file đã lên Mega chưa
rclone ls mega:cfobrain-backup/

# Kiểm tra log
cat /tmp/cfobrain-backup.log
```

---

### BƯỚC 5 — Verify hoạt động sau 1 đêm

Hôm sau kiểm tra:
```bash
# Xem log đêm qua
cat /tmp/cfobrain-backup.log

# Xem file trên Mega
rclone ls mega:cfobrain-backup/daily/
```

---

### Xử lý rủi ro

| Tình huống | Kết quả |
|---|---|
| iMac tắt lúc 2AM | launchd tự chạy bù khi iMac bật lại |
| Mất mạng khi upload | rclone retry tự động, file local vẫn còn |
| Docker chưa chạy khi script chạy | Script kiểm tra Docker trước, ghi lỗi vào log |
| Mega đầy (sau ~100 năm) | rclone báo lỗi trong log |

---

### Chính sách giữ file — tóm tắt

| Loại | Tần suất | Giữ | Dung lượng ước tính |
|---|---|---|---|
| Daily | Mỗi đêm | 7 ngày | ~140MB |
| Weekly | Chủ nhật | 4 tuần | ~80MB |
| Monthly | Mồng 1 | Mãi mãi | ~20MB/năm |
| **Tổng sau 5 năm** | | | **~1.5GB** |

---

## 🔴 P0 — Tích hợp website PHÚC SANG

> Context: Kế hoạch đầy đủ ở `KE-HOACH-DATABASE-VA-TICH-HOP-APP.md`. Hai codebase riêng biệt: website tại `/Users/apple/Downloads/website phúc sang/`, app tại thư mục hiện tại.

- [x] ~~**Giai đoạn 1: Tạo bảng Supabase + Store API**~~ — 8 bảng store_*, PostgreSQL function create_store_order, routes/store.ts với 5 endpoint ✅ *(2026-06-16)*
- [x] ~~**Giai đoạn 2: Kết nối website → Store API**~~ — store-api.js (API client + fallback data tĩnh), cập nhật all-products.js / product-detail.js / checkout.js / 3 HTML files ✅ *(2026-06-16)*
- [x] ~~**Giai đoạn 3: Fix PostgREST schema cache**~~ — nguyên nhân thật không phải cache mà `shopee_products`+`shopee_product_variants` **chưa từng được tạo** trong DB; chạy `CREATE TABLE` trực tiếp qua `docker exec supabase-db psql` (terminal trên iMac, không cần mật khẩu Studio) → verify lại bằng curl: cả `store_products`, `store_product_variants`, `shopee_products`, `shopee_product_variants` đều đã đọc được (200, `[]`) ✅ *(2026-06-16)*
- [x] ~~**Giai đoạn 4: Nhập 43 sản phẩm vào store_products**~~ — **30/43 sản phẩm đã có** trong store_products (is_published=true). Đã xác nhận production: 30 slug chuẩn và toàn bộ 180 biến thể đã có `color_name` + `size`. 13 sản phẩm còn thiếu (DBDN01-07, DDDN01-03, DXNN01-03) chưa tồn tại trong pos_products — cần nhập tay trước. *(2026-06-20, xác nhận lại 2026-06-20)*
  - ⏳ **Việc còn lại:** (1) Nhập 13 SKU vào pos_products; (2) Dùng tab "Kênh bán" để bật Website=ON
  - Riêng kênh Shopee: hạ tầng đã sẵn sàng, chỉ cần bấm lại "Nhập từ Dữ liệu nguồn cũ" trong trang Sản phẩm Shopee (đã fix bug duplicate-key + bảng đã tồn tại) là chạy được hết — chưa xác nhận đã bấm
- [x] **Giai đoạn 5: UI admin "Quản lý Website"** — trang trong app để: thêm/sửa store_products, liên kết variants, quản lý collections, xem đơn website ✅ *(2026-06-21)*
  - Codex đã build: `WebsiteProductsPage`, `WebsiteOrdersPage`, `WebsiteOperationsPage`, `routes/adminStore.ts`, `services/adminStoreApi.ts`
  - Fix màn hình trắng (thiếu import `Settings` icon) + fix lỗi tải sản phẩm (auth + CORS + spread requireRole)
  - Migrations: 017 (order fulfillment/shipments), 018 (store admin module) — **chưa chạy production**
- [x] ~~**OnlineCatalogPage.tsx viết lại giống layout Hàng hoá + nối fetch thật**~~ — sidebar/toolbar/table clone GoodsFilterSidebar+GoodsToolbar+GoodsProductTableHeader, cột Mã hàng/Nhóm hàng (leaf)/Giá vốn/Tồn kho/Vị trí/Thương hiệu/Nền tảng, cha-con expand giống GoodsProductRow, bảng chi tiết 5 tab clone GoodsProductDetailPanel, fetch thật từ store_product_variants+shopee_product_variants (mỗi bảng try/catch riêng để không sập trang nếu 1 bảng lỗi) ✅ *(2026-06-16)*
  - **Vẫn đang rỗng** vì chưa có sản phẩm nào thực sự liên kết — hạ tầng đã sẵn sàng (xem Giai đoạn 3), chỉ còn thiếu Giai đoạn 4
  - Đã dọn 30 sản phẩm cha rỗng (`variant_count=0`) tạo ra bởi lần "Nhập từ Dữ liệu nguồn cũ" bị lỗi trước đó trong `pos_products`
- [x] ~~**Workflow huỷ/hoàn hàng đơn website + cộng tồn kho đúng 2 luồng**~~ — RPC `update_website_order_status` (huỷ trước khi giao ĐVVC cộng tồn ngay; hoàn sau khi giao chỉ cộng tồn sau khi nhân viên xác nhận đã nhận lại hàng), fix bug case-mismatch status `'Pending'`→`'pending'`, fix thiếu cột `pos_orders.updated_at`, fix query bảng `pos_order_items` không tồn tại trong `WebsiteOrdersPage.tsx` ✅ *(2026-06-16)*
  - [x] ~~**Production migration 014**~~ — đã chạy qua internal `pg/query`, xác nhận `website_price_override`, gộp SKU trùng khi trừ/cộng tồn, và state machine chống cộng tồn hai lần ✅ *(2026-06-20)*

## ⏸️ Blocked — Chờ hình mẫu từ user

*(Không còn item nào bị block)*

---

## ⏳ Tạm hoãn — Chưa đủ điều kiện

- [ ] **POS: Logic dữ liệu Chuyển khoản / Thẻ / Ví** — chờ trang cài đặt số tài khoản/phương thức; SQL có sẵn chưa bật
- [ ] **Quản lý ca làm việc** — chủ tự đứng thu ngân, tạm không cần
- [ ] **Đa chi nhánh / Multi-tenant** — cần quyết định UX + migration branch_id
- [ ] **Tích hợp TikTok Shop / Lazada** — cần API credentials + spec mapping
- [ ] **Tích hợp GHN / GHTK** — cần API token + quy trình vận đơn
- [ ] **Real-time Sync** — Supabase Realtime thay vì poll

---

## ✅ Hoàn thành gần đây

- [x] **POS: Split Payment UI riêng** — hoàn thành *(2026-05-16)*
- [x] **POS: Return Layout Redesign** — màu nền riêng, khóa ô tìm khi mode=return *(2026-05-16)*
- [x] **POS: CRM Customer Modal 2 cột** — layout 2 cột hoàn thành *(2026-05-16)*
- [x] **Revert display changes GoodsInventory** — xoá sort buttons header, xoá collapse sidebar, xoá bulk action toolbar, khôi phục UI phiên bản trước *(2026-05-16)*
- [x] **Fix 8 TypeScript errors GoodsInventory.tsx** — selectedIds/favoriteIds → Set, productGroups prop chain, discount props purchase form, audit transactions, onStartAudit handler, 4 row-action handlers, modal props *(2026-05-16)*
- [x] **Security audit & hardening** — rate limiting, Helmet headers, error tracking, security audit script *(2026-05-16)*
- [x] **Tạo shared UI components library** — Button, Card, Input, Badge, Modal với README đầy đủ *(2026-05-16)*
- [x] **Tăng test coverage** — viết 28 tests cho auditService, coverage tăng lên 72.82% *(2026-05-16)*
- [x] **Fix 4 TypeScript lint debt errors** — sửa showToast type errors trong GoodsInventory.tsx *(2026-05-16)*
- [x] **Implement virtualization** — cài đặt @tanstack/react-virtual, tạo GoodsVirtualizedTable.tsx cho 12,739+ SKU *(2026-05-16)*
- [x] **Đánh giá toàn bộ app** — tạo báo cáo đánh giá chi tiết (APP_EVALUATION_REPORT.md + EXECUTIVE_SUMMARY.md) *(2026-05-16)*
- [x] **Tách KnowledgeManager.tsx** — tách 4/4 sub-tabs (MechanismsSalarySubTab, MechanismsViolationsSubTab, MechanismsHolidaysSubTab, StandardsWorkflowsTab), giảm 50.3% kích thước *(2026-05-16)*
- [x] **Refactor SettingsCenter.tsx** — tách 4/4 tabs (PrintTemplatesTab, PaymentsTab, AppearanceTab, GoodsTab), giảm 60.4% kích thước *(2026-05-16)*
- [x] POS: sort sản phẩm trong ô tìm kiếm *(2026-05-14)*
- [x] POS: header - loại bỏ icon cạnh chữ Admin *(2026-05-14)*
- [x] POS: nút Xem báo cáo cuối ngày *(2026-05-14)*
- [x] Inventory: sửa luồng audit nhà cung cấp *(2026-05-14)*
- [x] POS: tab hóa đơn cuộn ngang + nút thêm luôn hiển thị *(2026-05-13)*
- [x] POS: điểm thưởng chỉ hiện khi có KH và sản phẩm tích điểm *(2026-05-12)*
- [x] POS: popup trả hàng đồng bộ màu theme *(2026-05-12)*
- [x] POS: giao diện Chia nhiều + format tiền *(2026-05-12)*
- [x] POS: layout thanh toán Chuyển khoản / Thẻ / Ví *(2026-05-12)*
- [x] POS: layout trả hàng + khóa ô tìm khi mode=return *(2026-05-12)*
- [x] POS: popup thêm khách hàng mới layout 2 cột *(2026-05-12)*
