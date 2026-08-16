# TODO.md — Danh sách việc cần làm

> Agent cuối ca → cập nhật file này: đánh dấu xong, thêm task mới, ghi lý do block.
> Xem HISTORY.md để biết context từ phiên trước.

---

## 🔴 P0 — Ưu tiên cao (làm trước)

### [x] 🟡 PAYROLL-EMAIL-COL-0816 — Tạo/sửa nhân sự thất bại 100% âm thầm — thiếu cột `employees.email` — ĐÃ LÊN DEV, CHỜ DUYỆT PROD *(local+dev xong 2026-08-16)*

> QA Lương & Thưởng phát hiện: `components/StaffManager.tsx:579,606` luôn gửi field `email` (có trong `types.ts` nhưng chưa từng có cột DB tương ứng) → mọi lần tạo/sửa nhân sự bị Supabase từ chối (PGRST204), nhưng UI KHÔNG báo lỗi — vẫn hiện "thành công". **Xác nhận thiếu cột trên CẢ dev VÀ prod lúc phát hiện**. Chi tiết: HISTORY.md 2026-08-16.
> Đã sửa: migration `supabase_migrations/037_employees_email_column.sql` (`ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT`), đồng bộ vào `supabase_setup.sql`. Áp dụng local + dev (qua `apply-migrations.sh --staging`, ghi sổ `schema_migrations`). Verify: tạo nhân sự thành công cả 2 nơi. **CHƯA áp dụng prod** — cần user xác nhận riêng trước khi đẩy.

### [x] 🟢 PAYROLL-LOCK-BYPASS-0816 — Khoá dữ liệu sau "Chốt & Lưu" lương bị bypass qua API — ĐÃ SỬA, LÊN DEV *(xong 2026-08-16)*

> QA Lương & Thưởng verify bằng thực nghiệm: nhân viên đã "Chốt & Lưu" lương tháng → UI đúng (input `disabled`), nhưng gọi thẳng API bỏ qua UI vẫn ghi được dữ liệu tuỳ ý, server không từ chối. Đây chính là task PAYROLL-LOCK-0805 cũ — kết quả test trước khi sửa: chưa đạt yêu cầu khoá thật. Chi tiết: HISTORY.md 2026-08-16.
> Đã sửa `routes/data.ts`: thêm `findPayrollLockViolation()` — chặn ghi/xoá `attendance_records`/`overtime_records`/`sales_records`/`shortage_records`/`advance_records` cho nhân viên đã có `payroll_records` tháng đó, áp dụng ở cả `/api/data/upsert`, `/api/data/upsert-many`, `/api/data/delete` (trả `409`). Verify: tái hiện đúng request bypass cũ → nhận `409`, DB không ghi; nhân viên chưa chốt vẫn ghi bình thường (không phá luồng cũ). `tsc`+`npm test` 448/448 sạch. Đã deploy dev.

### [x] 🟢 PAYROLL-DOB-EMPTY-0816 — Tạo/sửa nhân sự lỗi nếu để trống "Ngày sinh" — ĐÃ SỬA, LÊN DEV *(xong 2026-08-16)*

> `StaffManager.tsx:580,590` gửi `dob: formData.dob` (mặc định `''`) thẳng lên Postgres cột kiểu `date` → `invalid input syntax for type date: ""`. Chi tiết: HISTORY.md 2026-08-16.
> Đã sửa: `handleAdd`/`handleUpdateEmployee` gửi `dob: undefined` thay vì `''` khi trống (JSON tự loại field `undefined`). Verify: tạo nhân sự không điền Ngày sinh → lưu thành công, `dob` = NULL. Đã deploy dev.

### [x] 🟢 POS-QA-0813 — QA trang POS bán hàng: sửa 3 lỗi (giảm giá item-level mất khỏi báo cáo, "Unknown error", payment_method hardcode "Cash") *(xong 2026-08-13)*

> Test thật trên Supabase local dựng riêng (`~/supabase-dev/docker`) với dữ liệu thật. Đã sửa + verify DB thật cả 3 vấn đề — chi tiết đầy đủ: HISTORY.md 2026-08-13. `tsc`+`npm test` 448/448 sạch. **Chưa deploy dev/prod** — chỉ mới sửa + verify trên local, cần deploy riêng khi user yêu cầu (theo quy tắc mặc định chỉ đụng dev, prod khi được yêu cầu riêng).

### [x] 🟢 POS-QA-0814 — QA Trả/đổi hàng, Sửa đơn, Công nợ khách hàng: sửa 3 lỗi (crash tìm khách hàng, tạo đơn trùng khi bán nợ, "Nợ hiện tại" đếm trùng) *(xong 2026-08-14)*

> Tiếp nối POS-QA-0813. Trả/đổi hàng + Sửa đơn verify đúng, không lỗi. Phát hiện + sửa 3 lỗi thật khi test Công nợ khách hàng — chi tiết đầy đủ: HISTORY.md 2026-08-14. `tsc`+`npm test` 448/448 sạch. **Chưa deploy dev/prod** — chỉ mới sửa + verify trên local.

### [x] 🟢 PURCHASE-QA-0814 — QA Mua hàng / Nhập kho / Nhà cung cấp — không phát hiện lỗi *(xong 2026-08-14)*

> Test 4 luồng bằng giao dịch thật + đối chiếu DB: tạo phiếu nhập (kể cả công thức AVCO), thanh toán nợ NCC, trả hàng nhập, nhập hàng nhanh (đường ghi 2 bước khác — cũng test riêng vì rủi ro kiến trúc khác). Cả 4 đều đúng — chi tiết đầy đủ: HISTORY.md 2026-08-14 (2). Không có thay đổi code.

### [x] 🟢 REPORT-DISCOUNT-BACKFILL-0814 — Backfill discount cho đơn lịch sử lệch Doanh thu/Thực thu — ĐÃ LÊN LOCAL + DEV + PROD *(xong 2026-08-14)*

> QA Báo cáo/Phân tích tài chính phát hiện: bug import KiotViet (đã sửa ở commit `eb34d9b` 29/06/2026) khiến `pos_orders.discount=0` sai cho các đơn import TRƯỚC ngày đó — code đã đúng cho đơn mới, nhưng dữ liệu cũ chưa được backfill. Điều tra thêm xác định đa số/toàn bộ là đơn đổi hàng liên kết (không phải thiếu giảm giá thật), nhưng công thức backfill `discount = total_amount - final_amount` đúng trong cả 2 trường hợp. Chi tiết đầy đủ: HISTORY.md 2026-08-14 (3) và (4).
> Đã chạy UPDATE (kèm backup bảng `backfill_discount_backup_0814`) trên **Supabase local** (1.602 dòng), **Supabase dev** (`dev.phucsang.com.vn`, 1.624 dòng), và **Supabase prod** (`app.phucsang.com.vn`, 1.624 dòng, user xác nhận qua AskUserQuestion trước khi chạy) — verify SQL 0 lệch còn lại ở cả 3 nơi, verify thêm qua UI trên local (khớp chính xác báo cáo Tài chính). Không có thay đổi code.
> Đã điều tra thêm 13 đơn trên prod phát sinh SAU ngày fix import (30/06–09/07/2026): nguyên nhân là **deploy trễ** (fix merge git 29/06 nhưng chỉ lên prod thật 22/07) — không phải lỗi logic mới, đã nằm trong 1.624 đơn backfill rồi, không cần sửa thêm. Chi tiết: HISTORY.md 2026-08-14 (4).
> Đã re-verify 0 lệch còn lại ở cả 3 nơi rồi mới xoá bảng backup `backfill_discount_backup_0814` (local/dev/prod) theo yêu cầu user. Task đóng hoàn toàn.

### [ ] 🟠 PAYROLL-LOCK-0805 — Khóa Chấm công/Tăng ca/Doanh số/Khấu trừ sau chốt lương — ĐÃ LÊN DEV, CHỜ USER TEST + DUYỆT ĐẨY PROD *(2026-08-05)*

> Đã sửa: nhân viên đã "Chốt & Lưu" lương tháng nào thì vẫn hiện đầy đủ ở 4 tab Chấm công/Tăng ca/Doanh số/Khấu trừ (bỏ cơ chế ẩn cũ) nhưng input bị khóa (view-only) + badge "Đã chốt". Chi tiết: HISTORY.md 2026-08-05. `tsc`+`npm test` 448/448 sạch, đã deploy `dev.phucsang.com.vn` (health 200 OK).
> **Còn lại**: user tự test trên dev (thử sửa 1 ô của nhân viên đã chốt → phải bị khóa; nhân viên chưa chốt vẫn sửa bình thường) → nếu ổn báo lại để đẩy `app.phucsang.com.vn` (prod) — theo quy tắc mới chỉ đụng dev trước, prod khi được yêu cầu riêng.

### [x] 🟢 CLEANUP-0729 — Audit dọn dẹp codebase lần 3, 5 giai đoạn *(xong 2026-07-29)*

> User yêu cầu audit toàn diện lần 3 tìm code thừa/lỗi thời/trùng lặp. Khảo sát + knip + kiểm chứng chéo grep in-file usage từng phát hiện (rút kinh nghiệm: nhiều hàm/type knip báo "unused export" thực ra vẫn được gọi NỘI BỘ trong chính file, chỉ là export thừa — không phải dead code thật; đã soát lại kỹ trước khi xóa để tránh xóa nhầm). Stash 40 file tính năng "Trắng hóa hệ thống" đang dở (FACTORY-RESET-0723) trước khi làm, pop lại sau khi xong. 5 giai đoạn, mỗi giai đoạn verify `tsc`+`npm test` 448/448+`npm run build`+browser (giới hạn: sandbox không có Supabase, không vào sâu được tab VAT/Hàng hóa) rồi commit riêng.
> **GĐ1**: xóa dead code an toàn — hàm/component/type export không còn reference nào (services/auth.ts, exportService.ts, errorTracking.ts, reportCalculations.ts, vatCoverage.ts, ProductGroupFilter.tsx + 7 sub-component chết, cụm OCR/VAT cũ, 2 type mồ côi). Bỏ npm script `help:capture` (phụ thuộc playwright đã gỡ đợt trước). ~765 dòng.
> **GĐ2**: xóa 6 hàm chết trong `vatCoverageService.ts` (parseVatXml, createVatDocumentFromParsedInvoice, createOpeningStockItem, confirmVatAllocations, voidVatAllocation, saveVatKeyword) — loại trừ `uploadVatFile` khỏi danh sách xóa sau khi phát hiện vẫn được `createVatDocumentFromPdf` gọi nội bộ dù knip báo unused.
> **GĐ3**: bỏ `export` thừa khỏi ~28 hàm/type chỉ dùng nội bộ (không xóa function, chỉ thu hẹp API bề mặt) + dọn duplicate export (POSQuickPage, GoodsPurchaseReturnForm) + hợp nhất `supabaseAdmin`/`supabase` thành 1 tên `supabase` trong `services/supabase.ts` (5 file + 1 dynamic import cập nhật theo).
> **GĐ4**: move `assets/` (22MB logo ngân hàng .eps/.ai/.cdr, ảnh tmp, Excel KiotViet — 0 code reference) ra `_archive-ngoai-repo/assets-20260729/`, thêm `assets/` vào `.gitignore`.
> **GĐ5**: gộp `formatNumber`/`formatDate` trùng lặp y hệt ở 8 trang báo cáo (không phải 6 như audit trước bỏ sót StaffReportPage/SupplierReportPage) về `src/lib/formatCurrency.ts` (`formatReportNumber`/`formatReportDate`). Phát hiện thêm 4/8 trang có `formatAxis` trùng `formatCurrencyAxis` sẵn có (đợt trước chỉ gộp 2/8) — gộp nốt, tiện sửa luôn bug `GoodsReportPage.tsx` thiếu nhánh "tỷ" (giống lớp bug OrderReportPage đã sửa trước).
> **Còn để ngỏ, chưa làm (cần user quyết)**: 2 thư mục tài liệu Word/PDF ở root ("BIỂU MẪU HỖ TRỢ VẬN HÀNH", "HỆ THỐNG NỘI QUY - QUY ĐỊNH CHÍNH", ~12MB) — giữ nguyên hay gộp vào `docs/business-knowledge/`; `.kiro/`/`.agents/`/`.codex/` còn dùng hay archive; `npm run cf` (cloudflare-tunnel.mjs) còn cần không. `CLEANUP-0721-B` (tách 2 God file) + `CLEANUP-0721-C` (test route thiếu) vẫn còn nguyên, không thuộc phạm vi đợt này.

### [ ] 🟠 FACTORY-RESET-0723 — Deploy tính năng "Trắng hóa toàn bộ hệ thống" lên prod *(xong build+test trên dev 2026-07-23, CHỜ user quyết định deploy prod)*

> Tính năng mới cho phép xóa sạch toàn bộ dữ liệu + tài khoản đăng nhập để bàn giao app cho 1 cửa hàng khác hoàn toàn. Đã build (`routes/factoryReset.ts`, `routes/auth.ts` bootstrap-owner, `LoginPage.tsx` màn hình thiết lập lần đầu, `MigrationTab.tsx` UI) và **test thật trên dev.phucsang.com.vn** (sync bản sao prod → gọi API trắng hóa thật → verify DB rỗng + tài khoản mới hoạt động → sync lại prod để khôi phục). Test thật phát hiện và sửa 3 bug (xóa song song vi phạm khóa ngoại, thiếu 9 bảng VAT trong danh sách xóa, bảng `store_product_collections` khóa kép không có cột `id`).
> Sau đó rà soát + genericize toàn bộ hardcode nhận diện Phúc Sang trong source code (tên nhân viên/chủ cửa hàng mặc định, tài khoản ngân hàng thật, nội dung Knowledge Base, brand mặc định, AI system prompt, nhãn kênh bán, phiếu lương in — ~30 vị trí). Domain CORS/CSP chuyển sang đọc từ env `ALLOWED_ORIGINS`/`ALLOWED_CONNECT_HOSTS` (không set thì giữ nguyên mặc định Phúc Sang, không phá vỡ deploy hiện tại). Chi tiết đầy đủ: HISTORY.md.
> **Còn lại**: (1) User quyết định commit+push+deploy prod hay không. (2) File logo vật lý (`public/logo.png`, `favicon.png`) không sửa được qua code — cần thay tay trước khi bàn giao thật. (3) `routes/shopeeSync.ts` mapping shop↔port bot + `constants/marketing.ts` DEFAULT_INVENTORY (nội dung ngành giày) chưa đụng — cố ý để nguyên, thuộc phạm vi hạ tầng/ngành hàng chứ không phải "dữ liệu cũ".

### [ ] 🔴 SHOPEE-RELOGIN-0722 — Đăng nhập lại 2 bot Shopee (session hết hạn thật, đang crash-loop) *(phát hiện 2026-07-22)*

> **Bối cảnh**: nút "Đăng nhập lại" ở Bán online → Liên kết kênh bán không hoạt động vì `pm2` không được cài trên iMac — lệnh `execAsync('pm2 ...')` trong `routes/channelManagement.ts` thất bại âm thầm (`.catch(() => {})`), API vẫn báo `{ok:true}` giả. Đã sửa hạ tầng: cài `pm2` (`/Users/mac/.npm-global/bin/pm2`, symlink `/usr/local/bin/pm2` để khớp PATH launchd dùng), chuyển 2 tiến trình `monitor.js` từ chạy mồ côi sang quản lý bởi `pm2`, `pm2 save`. Chi tiết đầy đủ: memory `shopee-bot-pm2-fix.md`.
> **Còn lại — CẦN LÀM**: cả 2 bot (`shopee-shop1` port 3001 phuc_sang_store, `shopee-shop2` port 3002 giaydepphucsang) đang **crash-loop thật** ~90s/lần: vào trang đơn hàng → không bấm được tab nào → tự phát hiện `SESSION HẾT HẠN` → restart → lặp lại, xử lý được **0 đơn/lần**. Session Shopee đã hết hạn thật, không tự phục hồi được.
> **Cách làm**: (1) Bật Screen Sharing trên iMac (System Settings → General → Sharing) — làm 1 lần. (2) Từ MacBook: Finder → `Cmd+K` → `vnc://192.168.1.2`, đăng nhập user "mac". (3) Trên màn hình iMac (qua VNC): app → Bán online → Liên kết kênh bán → bấm "Đăng nhập lại" từng shop → Chrome headed hiện ra thật (pm2 đã hoạt động) → đăng nhập Shopee + OTP → bấm "Hoàn thành" để bot về chạy ngầm bình thường.
> **Rủi ro nếu để lâu**: đơn hàng Shopee mới không được đồng bộ/xử lý tự động (0 đơn/chu kỳ hiện tại); crash-loop liên tục tốn CPU/RAM iMac không cần thiết.

### [x] 🟢 CLEANUP-0721 — Audit dọn dẹp codebase 5 giai đoạn (senior engineer review) *(xong 2026-07-21)*

> User yêu cầu audit toàn diện tìm code thừa/lỗi thời/trùng lặp. Khảo sát + knip + kiểm chứng chéo grep từng phát hiện → trình báo cáo đầy đủ cho user duyệt từng phần trước khi làm (không tự động xóa). Thực thi 5 giai đoạn, mỗi giai đoạn verify `tsc`+`npm test`+browser thật trước khi commit. Chi tiết đầy đủ: HISTORY.md.
> **Phát hiện đáng chú ý nhất**: `vitest include '**/*.test.ts'` quét luôn bản copy test trong `.claude/worktrees/` → tổng test bị thổi phồng từ 04/07 (mọi báo cáo audit trước ghi "1045/1045" — số thật là **396/22 file**, không phải suy giảm coverage, chỉ là đếm trùng). Đã thêm exclude vào `vite.config.ts` để ngăn tái diễn — **agent phiên sau nếu thấy số test khác 1045 trong lịch sử, đó là do bug đếm trùng đã sửa, không phải mất test**.
> Cũng sửa 4 bug thật phát hiện trong lúc audit (không nằm trong scope "dọn dẹp" ban đầu nhưng lộ ra khi kiểm chứng): icon PWA 404 toàn bộ (script CommonJS chạy sai module + sai nguồn logo), 2 bộ Skeleton trùng, `FinanceReportPage` hiển thị `$` thay vì `đ`, 1 dòng SQL trùng lặp.

### [x] 🟢 CLEANUP-0721-audit2 — Audit lần 2 phạm vi rộng: code smell + dedup + test coverage (5 GĐ) *(xong 2026-07-21 phiên 3)*

> User yêu cầu audit lại đào sâu hơn (anti-pattern/coupling/God object, không chỉ dead code). 5 agent song song + kiểm chứng chéo. Làm 5 GĐ, mỗi GĐ verify+commit riêng, test 396→448. Chi tiết: HISTORY.md phiên 3. Điểm đáng chú ý: **HỦY đổi tên migration trùng 005/019** (verify cho thấy `apply-migrations.sh` track theo tên file → đổi tên làm rối sổ prod/dev, rủi ro > lợi ích); **thu hẹp 2 scope** agent phóng đại (formatCurrency: chỉ 2/5 hàm trùng thật; import test: dời sang GĐ5 test parser tách ra thay vì HTTP-test monolith sắp đổi).

### [ ] 🟠 CLEANUP-0721-B — Tách HẾT 2 God file (mới làm bước đầu ở phiên 3) *(phát hiện 2026-07-21 phiên 3)*

> Phiên 3 mới tách 1 phần nhỏ mỗi file (có test): `import.ts` 2655 dòng → rút `kiotvietRevenueParser.ts`; `PurchaseInvoices.tsx` 2627 dòng → rút `vatGroupMatchesSourceText`. **CÒN LẠI**: (a) `import.ts` — tách tiếp handler `kiotviet-purchase-details` (414 dòng) + `kiotviet-products` SKU-gen (298 dòng) ra service thuần có test; cân nhắc tách sub-router theo domain. (b) `PurchaseInvoices.tsx` — tách ~60 useState thành custom hook theo domain (`useVatDocumentForm`, `useOpeningStockAllocation`...). **Điều kiện làm an toàn**: cần drive được UI trung tâm VAT + luồng import Excel với DỮ LIỆU THẬT trên dev để verify (sandbox không có Supabase). Nên là ca riêng, không rush trong ca dài chung. **Rủi ro cao** (logic thuế/tồn kho/tiền) — mỗi lần tách phải verify workflow thật trên browser dev.

### [ ] 🟡 CLEANUP-0721-C — Bổ sung test cho 12/16 route file chưa có test *(phát hiện 2026-07-21 phiên 3)*

> Phiên 3 đã thêm test cho auth.ts + ai.ts. Còn thiếu test tầng HTTP: `channelLinks.ts` (831), `facebook.ts` (479), `channelManagement.ts` (404), `adminStore.ts` (290), `shopeeProductsCrud.ts` (275), `shopeeSync.ts` (237), `notifications.ts` (237), `posMobile.ts` (179). Ưu tiên route mutate dữ liệu. `import.ts` cover dần qua các parser thuần tách ra (CLEANUP-0721-B).

### [ ] 🟡 DISCOUNT-PERCENT-01 — Xác minh cột `discount_percent` trên Supabase trước khi bật code gửi *(phát hiện trong CLEANUP-0721, 2026-07-21)*

> UI đã xây xong đầy đủ (`components/pos/GoodsPriceSetupModal.tsx`, `components/pos/GoodsInventory.tsx`, `types.ts:517`) — form nhập % giảm giá mặc định sản phẩm hoạt động, chỉ riêng dòng gửi lên Supabase bị comment-out tại `services/apiService.ts:82` và `:524` chờ xác nhận migration đã chạy. `supabase_setup.sql:279` đã có sẵn `ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0` (ghi ngày 2026-06-23) — không rõ đã chạy trên Supabase dev/prod thật chưa. Không tự xác minh được từ sandbox (Docker Supabase local trên MacBook không chạy trong phiên audit — connection refused; không có credential cho `dev.phucsang.com.vn` hay prod).
> **Việc cần làm**: chạy `SELECT column_name FROM information_schema.columns WHERE table_name='pos_products' AND column_name='discount_percent';` trên Supabase SQL Editor (cả dev và prod). Nếu rỗng → chạy dòng ALTER TABLE ở `supabase_setup.sql:279` trên môi trường đó trước. Sau khi xác nhận có cột trên CẢ 2 môi trường → bỏ comment dòng `discount_percent: n(item.discountPercent || 0)` tại `apiService.ts:82` (và dòng tương ứng `:524`), test tạo/sửa sản phẩm với % giảm giá trên dev trước khi deploy prod.
> **Rủi ro nếu bật nhầm khi cột chưa tồn tại**: PostgREST trả lỗi cho MỌI request tạo/sửa sản phẩm (`pos_products` upsert) — vỡ toàn bộ luồng quản lý hàng hóa, không chỉ tính năng giảm giá.

### [x] 🟢 AUDIT-0721 — Audit QA production-readiness (kiểm chứng lõi bằng THỰC THI RPC thật) *(xong 2026-07-21 — báo cáo `docs/06-evaluation/PRODUCTION_AUDIT_2026-07-21.md`)*

> HEAD `6386ff3`, audit-only. Tự chạy `npm test` **1045/1045** + `tsc` sạch. Delta từ audit 07-19 thuần hạ tầng. **Nạp 4 RPC thật (029/028/027/026) vào Postgres 16 live** → chạy bán/oversell/clamp/**race đồng thời**/sửa/xóa đối chiếu DB: **7/7 PASS, không mất tiền/âm kho/sai doanh thu**. Không P0/P1, không blocker chặn dùng nội bộ. Phát sinh 2 finding dưới (P2 + P3).

### [ ] 🟠 AUDIT-0721-A — Backup: cấu hình kênh CẢNH BÁO khi FAIL (Zalo) — lưới an toàn còn hở cửa cuối *(phát hiện 2026-07-21)*

> **Vấn đề**: `scripts/backup-db.sh` phần thân vững (guard 0-byte/`gzip -t`, đã chạy thật trên iMac), NHƯNG cơ chế cảnh báo khi backup FAIL dựa hoàn toàn vào Zalo mà `ZALO_OA_ACCESS_TOKEN`/`ZALO_FOLLOWER_ID` **chưa cấu hình** (0 key trong `.env.local` local; iMac cũng chưa có — xem AUDIT-0711-F). → backup hỏng thật (đầy ổ, container down) chỉ in log launchd, **không ai biết** = "fail âm thầm" vẫn còn — đúng thứ blocker AUDIT-0710-B sinh ra để diệt. Không có kênh cảnh báo thứ 2.
> **Mức**: 🟠 P2 — **điều kiện để coi app là sổ sách tài chính DUY NHẤT** (không lưới an toàn). Không chặn dùng nội bộ.
> **Việc cần làm (user, không phải bug code)**: thêm `ZALO_OA_ACCESS_TOKEN` + `ZALO_FOLLOWER_ID` vào `.env.local` trên iMac (không dán token vào chat) → **test 1 lần fail giả** (đổi tên container tạm) xác nhận nhận được tin Zalo. Cùng token bật luôn cảnh báo `health-alert.sh`.

### [x] 🟢 AUDIT-0721-B — Sửa `supabase_setup.sql` khớp prod (schema drift `revenue_records`) *(xong 2026-07-21)*

> **Vấn đề (đã sửa)**: RPC dùng `ON CONFLICT (date)` khớp ràng buộc THẬT prod `UNIQUE(date)`, nhưng `supabase_setup.sql` (a) **không `CREATE TABLE revenue_records`** (chỉ ALTER → dựng lại từ đầu fail ngay dòng 457), (b) chỉ thêm composite `UNIQUE(date, branch_id)` → `ON CONFLICT(date)` fail 42P10 (chứng minh live).
> **ĐÃ SỬA (2 thay đổi, an toàn tuyệt đối với prod vì IF NOT EXISTS = no-op)**: (1) thêm `CREATE TABLE IF NOT EXISTS revenue_records` (cột lấy đúng từ RPC: id UUID PK, date DATE, 7 numeric) trước block ALTER branch_id; (2) đổi constraint block sang `DROP IF EXISTS` cả 2 tên + dedup `GROUP BY date` + `ADD CONSTRAINT uq_revenue_records_date UNIQUE(date)`.
> **VERIFY end-to-end trên Postgres 16 SẠCH**: chạy đúng DDL đã sửa theo thứ tự rebuild-from-scratch → CREATE+ALTER chạy sạch (không còn fail), `ON CONFLICT (date)` cộng dồn đúng (2 đơn cùng ngày → net 150, 1 dòng), chạy lại constraint block idempotent (chỉ NOTICE, 0 ERROR), `psql` exit 0. `npm test` vẫn 1045/1045.
> **Còn sót (nhỏ) — [ ] AUDIT-0721-C**: `expense_records` + `payroll_records` cũng chỉ được ALTER, chưa có CREATE trong repo. CHƯA bổ sung vì chưa xác minh chắc đủ cột (không bịa schema tài chính). Đường DR chính (restore pg_dump) không ảnh hưởng. Cần: lấy schema thật 2 bảng này (từ `\d` trên prod hoặc types.ts) rồi thêm `CREATE TABLE IF NOT EXISTS` tương tự.
> **Cập nhật 2026-08-03**: đúng dự đoán — drift này gây bug thật (xem PAYROLL-CALC-NOTE-0803 bên dưới). Đã lấy `\d payroll_records` thật trên prod, có thể dùng để viết `CREATE TABLE IF NOT EXISTS payroll_records` đầy đủ khi làm AUDIT-0721-C (chưa làm, chỉ mới vá cột thiếu `calculation_note`).

### [x] 🔴 PAYROLL-CALC-NOTE-0803 — `payroll_records` thiếu cột `calculation_note` → "Chốt & Lưu" bảng lương fail 100% trên prod *(xong 2026-08-03)*

> User báo bấm "Chốt & Lưu" ở tab Bảng lương báo lỗi "Không thể ghi dữ liệu" rồi app chuyển offline, Sổ cái lương trống. SSH vào iMac đọc `/tmp/cfobrain-app.log` (server không lộ chi tiết lỗi Supabase ra client) → `PGRST204: Could not find the 'calculation_note' column of 'payroll_records'`. Bảng `payroll_records` chưa từng có cột này dù `apiService.ts` đã gửi field từ lâu — PostgREST chặn cả payload nếu 1 key không khớp cột nào, nên chặn TOÀN BỘ lượt chốt lương, không phải lỗi riêng nhân viên nào.
> **Đã sửa (fix #1)**: `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS calculation_note TEXT;` trên cả prod và dev + `NOTIFY pgrst, 'reload schema'`.
> **User test lại vẫn fail** → phát hiện **lỗi #2 chồng lên**: `staff_performance.employee_id` bị tạo sai kiểu `uuid` (đúng ra phải `text` như `employees.id` và mọi bảng liên quan khác) → ghi `EMP-441676` bị PostgreSQL từ chối `22P02`, kéo theo `updateSurgical` tự rollback xóa luôn `payroll_records` vừa ghi thành công trong cùng batch (payroll → expenses → staffPerformance ghi chung 1 transaction client-side).
> **Đã sửa (fix #2)**: `ALTER TABLE staff_performance ALTER COLUMN employee_id TYPE TEXT;` trên cả prod và dev. Verify **end-to-end thật** bằng INSERT/DELETE qua REST API đúng payload app gửi (không chỉ SELECT) → 201/204 sạch cả 2 môi trường.
> **User đã tự test lại trên UI thật (2026-08-05) và xác nhận "Chốt & Lưu" đã lưu thành công vào Sổ cái lương** — đóng hẳn bug này.
> **Còn để ngỏ**: chưa làm nốt AUDIT-0721-C (CREATE TABLE đầy đủ cho payroll_records/expense_records/staff_performance — nên tranh thủ chốt luôn kiểu cột `text` cho staff_performance khi làm).

### [x] 🟢 AUDIT-0719 — Audit QA production-readiness + fix delta IMPORT-02 (trừ backup) *(xong 2026-07-19 — báo cáo `docs/06-evaluation/PRODUCTION_AUDIT_2026-07-19.md`)*

> Lõi POS kiểm chứng SQL trực tiếp — vững, không hồi quy. Phát hiện + fix **P2-1** (import client ghi đè tồn kho DB bằng giá trị bộ nhớ cũ) qua 3 thay đổi tương thích ngược (`apiService.sanitizeItem` bỏ stock khi undefined + `pushBatch` merge field-level + `stripStockForUpdate` trong import). Fix **P2-2** (test HTTP nhánh import server — `routes/importProducts.test.ts` 4 test). Fix **P4** (`delete rest.created_at` khi cập nhật). `tsc` sạch, `npm test` **1045/1045**, build OK. **Chưa commit/deploy** — user nên test import Excel thật trên dev trước. Backup tự động (AUDIT-0710-B) = blocker duy nhất còn lại, user chốt làm sau.
>
> **Audit lần 2 (cùng ngày 2026-07-19, HEAD `26b252a`)**: kiểm chứng độc lập lại — tự chạy `npm test` 1045/1045 + `tsc`/`build` OK, tự đọc lại SQL lõi (029/028) không hồi quy, **boot app thật trên browser** verify render + `/health` check DB live. **Không blocker mới.** Quan sát mới 🟢 **P3-CONSISTENCY** bên dưới. Báo cáo: section "AUDIT LẦN 2" trong `PRODUCTION_AUDIT_2026-07-19.md`.

### [ ] 🟢 P3-CONSISTENCY — Điểm/hạng khách + doanh số NV (`sales_records`) nằm ngoài RPC transaction *(phát hiện Audit lần 2, 2026-07-19 — không chặn go-live)*

> `place/edit/delete/cancel_pos_order_tx` chỉ bao đơn+kho+doanh thu+nợ trong 1 transaction. Điểm/hạng khách (đọc cấu hình localStorage) + `sales_records` là lời gọi mạng RIÊNG sau RPC, bọc try/catch best-effort (`posOrderService.ts:72,295-297,330`). Rớt mạng/đóng browser NGAY SAU RPC commit → đơn/kho/doanh thu ĐÚNG, nhưng điểm khách không cộng + doanh số NV thiếu tới khi recalc. **Không mất tiền/sai kho**; `sales_records` recalc-overwrite theo ngày (idempotent) → không double-count, recover được. Có chủ đích, đã ghi rõ trong code. **Đề xuất (khi rảnh)**: job recalc `sales_records` cuối ngày để tự lành, hoặc đưa điểm/hạng vào server-side (cần chuyển cấu hình hạng khỏi localStorage) nếu muốn atomic hoàn toàn.

### [x] 🟢 IMPORT-02 — Import danh sách sản phẩm theo SKU: trùng → cập nhật (giữ tồn kho), mới → thêm *(xong 2026-07-14; audit 2026-07-19 phát hiện + fix P2-1: nhánh client ghi đè tồn kho DB bằng giá trị bộ nhớ cũ — xem AUDIT-0719. user cần test import file Excel thật trên dev trước khi deploy prod)*

### [ ] 🟠 AUDIT-0711 — Audit lần 2 (2026-07-11): kiểm chứng 13 fix R52 + phát hiện mới (báo cáo: `docs/06-evaluation/PRODUCTION_AUDIT_2026-07-11.md`)

> Đã kiểm chứng bằng code thật: **13/13 fix R52 đều thật, không hồi quy** (RLS 034 verify prod, DOMPurify 10/10, requireAuth notifications, validate backend + migration 036, /health DB thật, errorHandler wired, redact+log rotation, deploy rollback, index 035, translateError, tests, service-worker sạch). Blocker duy nhất còn lại = AUDIT-0710-B (backup). **2026-07-11 (cùng ngày): fix xong 6/7 mục con (A-E, G) — tsc sạch, 1009/1009 test pass. Chưa deploy prod.** Còn F chờ user.
> **Audit lần 3 (cùng ngày, R56)**: kiểm chứng 6/6 fix R55 đều thật (soi phản biện cả trust-proxy cho limiter, nhánh insert NOT NULL của batch upsert). Phát hiện + fix thêm 3 mục H/I/J bên dưới — **1029/1029 test pass, tsc sạch. Vẫn CHƯA commit/deploy prod — mọi fix R55+R56 chỉ nằm trên working tree.**

#### [x] 🟠 AUDIT-0711-A — Thống nhất công thức netProfit *(xong 2026-07-11 — tạo `src/lib/shopeeProfit.ts` (shopeeOrderKind/calcShopeePlatformNet/calcShopeeNetProfit) làm NGUỒN DUY NHẤT; thay cả 4 chỗ chép công thức: InventoryOutTab.tsx (hiển thị), routes/adsSpendSync.ts (job), useShopeeInventoryOut.ts (3 đường ghi + newRecord nhập tay — giờ đơn hủy/hoàn nhập tay cũng ra 0/−(PiShip+VH) đúng thay vì công thức thành công). +10 unit test src/lib/shopeeProfit.test.ts, có fixture đơn thật khớp escrow 218.449đ. FORMULAS.md §10.2/10.2b/10.2c đã cập nhật source.)*

#### [x] 🟡 AUDIT-0711-B — Rate-limit storefront public POST *(xong 2026-07-11 — store.ts: orderLimiter 20/15p cho /api/store/orders, preorderLimiter 10/15p, lookupLimiter 30/15p — cùng pattern publicFormRateLimit có sẵn, message tiếng Việt)*

#### [x] 🟡 AUDIT-0711-C — verify-manager + notify-logout *(xong 2026-07-11 — server.ts: `app.use('/api/auth/verify-manager', authLimiter)` 20/15p; channelManagement.ts: guard notify-logout chấp nhận x-api-key khớp INTERNAL_API_KEY HOẶC request thật sự local (socket loopback + không có header cf-connecting-ip/x-forwarded-for — request qua tunnel luôn mang các header này) → bot localhost cũ chạy tiếp không cần sửa bot)*

#### [x] 🟡 AUDIT-0711-D — Batch upsert trong adsSpendSync *(xong 2026-07-11 — gom mọi đơn cần đổi của 1 ngày thành 1 request `upsert(..., { onConflict: 'id' })` (payload kèm `date` vì là cột NOT NULL duy nhất không default); lỗi giờ tính theo ngày trọn vẹn thay vì nửa chừng. Test mock đổi update→upsert tương ứng)*

#### [x] 🟡 AUDIT-0711-E — Test tầng HTTP cho createDataRouter *(xong 2026-07-11 — routes/data.test.ts: 10 test dùng express app thật listen port 0 + fetch (không thêm dependency supertest): 401 khi không qua requireAuth, 400 key lạ/NaN/giá âm/thiếu id, upsert hợp lệ ghi audit_logs kèm actor từ JWT, upsert-many validate TRƯỚC khi ghi, clear chặn non-admin 403, place-tx gọi đúng RPC + trả 500 khi RPC lỗi)*

#### [x] 🟢 AUDIT-0711-F — health-alert.sh: CÀI XONG + PHÁT HIỆN & FIX BUG THẬT *(xong 2026-07-20, sau khi có SSH thật)*
> SSH giờ đã thông (xem BACKUP-INFRA-01) → gỡ được block cũ. Kiểm tra: **chưa từng được cài** (không crontab, không launchd) suốt từ 2026-07-10. Tạo `scripts/com.cfobrain.health-alert.plist` (launchd, 5 phút/lần) → cài trên iMac → **launchctl báo exit code 1** (không phải 0).
> **Bug thật phát hiện qua log**: `ZALO_OA_ACCESS_TOKEN`/`ZALO_FOLLOWER_ID` chưa từng được set trong `.env.local` trên iMac → dòng `grep -E '^ZALO_OA_ACCESS_TOKEN='` không khớp gì → exit 1 → dưới `set -euo pipefail` làm **chết cả script trước khi kịp chạy health-check** (script chưa bao giờ chạy được 1 lần trọn vẹn từ khi viết). Fix: thêm `|| true` vào 2 dòng grep (cùng pattern đã dùng đúng trong `backup-db.sh`) — giờ graceful, không tin tưởng biến optional có sẵn.
> **Verify end-to-end thật** (giả lập app sập bằng port không tồn tại): fail lần 1 → log đúng; fail lần 2 (đủ ngưỡng) → log đúng + thử gửi Zalo + graceful "Zalo chưa cấu hình — bỏ qua" (không crash). Exit code sau fix = **0**. Cơ chế phát hiện crash 2-lần-liên-tiếp hoạt động đúng thiết kế.
> **CÒN THIẾU (cần user, không phải bug code)**: `.env.local` trên iMac **chưa có** `ZALO_OA_ACCESS_TOKEN`/`ZALO_FOLLOWER_ID` → cảnh báo hiện tại chỉ dừng ở log, **KHÔNG gửi được tin Zalo thật**. Cần user có sẵn Zalo Official Account + access token, tự thêm 2 dòng vào `.env.local` trên iMac (không dán token vào chat).
> Files: `scripts/health-alert.sh` (fix bug), `scripts/com.cfobrain.health-alert.plist` (mới).

#### [x] 🟢 AUDIT-0711-G — translateError AdsTab + IP echo deploy script *(xong 2026-07-11 — AdsTab.tsx bọc translateError() cả 2 nhánh lỗi; deploy-imac.sh echo dùng `$IMAC_IP` thay IP cũ hardcode)*

#### [x] 🟡 AUDIT-0711-H — Đường ghi thứ 5 (import Excel) sót công thức netProfit inline *(xong 2026-07-11 R56 — audit lần 3 phát hiện `useShopeeInventoryOut.ts` luồng import Excel còn bản inline: đơn hoàn ghi 0 thay vì −(PiShip+VH), và `importPrice` QUÊN NHÂN số lượng (đơn qty ≥ 2 thổi phồng lãi). Đã thay bằng `calcShopeeNetProfit()` + `importPrice × (quantity || 1)`; FORMULAS.md §10.2 cập nhật. **Lưu ý dữ liệu cũ**: dòng đã import bằng Excel trước fix có thể mang sai số này — job adsSpendSync 30p sẽ true-up dần các dòng có QC, dòng không QC giữ nguyên giá trị cũ)*

#### [x] 🟡 AUDIT-0711-I — Test tầng HTTP cho store.ts (storefront public) *(xong 2026-07-11 R56 — routes/store.test.ts mới: 20 test cùng pattern data.test.ts (express listen port 0 + fetch): validate biên orders/preorders/lookup, chặn injection qua UUID, phone 84xxx→0xxx, RPC create_store_order nhận items chỉ id+quantity (giá server-side), lỗi 500 không lộ chi tiết kỹ thuật, lookup không lộ costPrice/customer_id/id nội bộ + chống dò đơn (404 đồng nhất), rate-limiter preorder trả 429 THẬT ở request thứ 11)*

#### [x] 🟢 AUDIT-0711-J — Tạo docs/06-evaluation/EVALUATION_WORKFLOW.md *(xong 2026-07-11 R56 — workflow.md tham chiếu file này (và 6 file ROLE_*.md) nhưng KHÔNG file nào tồn tại → agent sau làm "full audit" không tìm thấy quy trình. Đã tạo EVALUATION_WORKFLOW.md: nguyên tắc kiểm chứng code thật/không tin báo cáo cũ, trình tự 7 bước, bảng 8 hạng mục nhúng checklist vai trò, cấu trúc kết luận, giới hạn môi trường sandbox/SSH. 6 file ROLE riêng vẫn chưa tạo — ghi chú rõ trong file, tạo khi cần)*

### [ ] 🔴 AUDIT-0710 — Audit production-readiness toàn diện 2026-07-10 (báo cáo: `docs/06-evaluation/PRODUCTION_AUDIT_2026-07-10.md`)

> Audit 4 agent song song trên branch `feat/online-audit-shopee`. Lõi POS vững, không hồi quy. Rủi ro tập trung ở tính năng Shopee Ads mới (chưa từng audit) + tầng vận hành. Các mục con:

#### [x] 🔴 AUDIT-0710-A — BLOCKER: 2 bảng Ads mới (032/033) thiếu RLS → anon CRUD được dữ liệu tài chính *(XONG HẲN 2026-07-10 — đã deploy + verify trên prod)*
> `shopee_ads_daily_spend` + `shopee_ads_wallet_transactions` tạo mới không kèm ENABLE RLS/POLICY/REVOKE anon — đúng "bom nổ chậm" R3 cảnh báo. Đã tạo `supabase_migrations/034_lock_anon_shopee_ads_tables.sql` + sửa `supabase_setup.sql`. Migration 034 đã chạy trên prod (deploy 2026-07-10) và verify bằng anon key thật: cả 2 bảng trả `401 permission denied (42501)`.

#### [x] 🟢 AUDIT-0710-B — BLOCKER backup tự động: HOÀN TẤT + ĐÃ CÀI + CHẠY THẬT TRÊN iMAC PROD *(2026-07-20)*
> **Đóng blocker duy nhất của audit production-readiness → app từ "GO WITH CONDITIONS" lên "GO".**
> **Script (2026-07-20)**: `scripts/backup-db.sh` (pg_dump `supabase-db` → gzip `~/backups/cfobrain/`, **guard chống fail âm thầm**: chặn file 0-byte/quá nhỏ + `gzip -t` + container-down → xoá file rác + **Zalo alert**; rotate giữ 14 bản). Test local: dump 16MB (73.8MB giải nén, đủ schema+data+12 RPC+auth.users); 2 guard bắt đúng. `scripts/com.cfobrain.backup.plist` (launchd 02:30 hằng ngày). `scripts/backup-pull-offsite.sh` (MacBook kéo off-site). Runbook + **quy trình RESTORE** `docs/03-deployment/BACKUP_RUNBOOK.md`. Xóa 2 file `backup_2026*.sql` 0-byte.
> **ĐÃ CÀI TRÊN iMAC PROD (user chạy tay, 2026-07-20)**: `~/cfobrain` là thư mục rsync (KHÔNG git) → tạo file bằng heredoc thay vì git checkout. Chạy tay `backup-db.sh` → **dump PROD thật 12MB** (`db-20260720-144615.sql.gz`). `launchctl load` → `launchctl list` thấy `- 0 com.cfobrain.backup` (nạp OK). Kích hoạt qua launchd (`launchctl start`) → **tạo file mới `db-20260720-145130.sql.gz` 11M** → xác nhận launchd chạy được script trong env tối giản (tìm thấy docker + container prod).
> **Ghi chú hạ tầng phát hiện khi cài**: (1) IP iMac đã đổi lần nữa (DHCP) — `deploy-imac.sh` còn hardcode `192.168.1.6` CHẾT, `~/.ssh/config` alias `imac-cfobrain`=`192.168.88.112` cũng down → **cần đặt IP tĩnh/DHCP reservation + sửa deploy-imac.sh** (xem BACKUP-INFRA-01 dưới). (2) SSH MacBook→iMac không thông lúc cài → phải cài tay trên iMac.
> (Tuỳ chọn tương lai: cloud off-site MEGA/rclone — §6 runbook.)

### [x] 🟢 BACKUP-INFRA-01 — IP iMac không ổn định: ĐÃ ĐẶT TĨNH + SỬA MỌI SCRIPT + VERIFY SSH THẬT *(xong 2026-07-20)*
> **Đặt IP tĩnh**: user cấu hình thủ công trên iMac (System Settings → Network → Ethernet → TCP/IP → Manually) — **`192.168.1.2`**, subnet `255.255.255.0`, router/DNS `192.168.1.1`. Bật **Remote Login** (Sharing). Card Ethernet MAC `3c:cd:36:63:61:85`.
> **Đã sửa 7 nơi** hardcode IP chết `192.168.1.6`/`192.168.88.112` → `192.168.1.2`: `~/.ssh/config` (alias `imac-cfobrain`), `scripts/deploy-imac.sh`, `scripts/sync-prod-to-staging.sh`, `scripts/deploy-imac-dev.sh`, `scripts/sync-prod-to-dev.sh`, `scripts/backup-pull-offsite.sh`, `scripts/apply-migrations.sh` + 2 runbook (`ROLLBACK_RUNBOOK.md` 4 chỗ, `BACKUP_RUNBOOK.md` 1 chỗ) dùng làm lệnh copy-paste khi xử lý sự cố thật.
> **Verify SSH thật**: lần đầu kết nối `192.168.1.2` → `Host key verification failed` (bình thường — máy lạ, TOFU) → chấp nhận host key (`StrictHostKeyChecking=accept-new`) → kết nối bình thường ổn định từ đó, alias `imac-cfobrain` hoạt động. **Verify end-to-end thật**: chạy `backup-pull-offsite.sh` → kéo được bản backup PROD thật 12MB từ iMac về MacBook, `gzip -t` xác nhận nguyên vẹn — chứng minh cả IP tĩnh + SSH + toàn bộ chuỗi script backup off-site hoạt động thật, không chỉ lý thuyết.
> **Phần còn sót ĐÃ XONG (cùng ngày 2026-07-20)**: `server.ts` (3 chỗ: CSP `connectSrc` + 2 fallback URL local Kong) + `routes/channelManagement.ts:57` — sửa `192.168.1.6` → `192.168.1.2` (giữ nguyên port 8000=prod/8010=dev-staging). `tsc --noEmit` sạch, `npm test` 1045/1045 pass. Theo đúng quy trình bắt buộc: kill + restart dev server, verify browser — app render đầy đủ (màn POS, tên NV, UI tiếng Việt), session giữ nguyên, console sạch, không vi phạm CSP. Quét lại toàn repo (trừ `docs/05-process/HISTORY.md` + báo cáo audit — log lịch sử, giữ nguyên đúng quy tắc không sửa việc đã ghi): **0 chỗ còn IP chết trong code/script thật**, chỉ còn 1 chuỗi text mock trong `routes/store.test.ts:211` (message giả lập lỗi, không phải cấu hình — không cần sửa).

#### [x] 🟡 AUDIT-0710-C — 12/14 chỗ `dangerouslySetInnerHTML` chưa DOMPurify *(xong 2026-07-10 — kiểm tra lại: THỰC RA cả 10 chỗ thật (không tính .bak) đều ĐÃ wrap DOMPurify.sanitize(), agent audit trước bị dương tính giả vì grep chỉ khớp dòng dangerouslySetInnerHTML= mà không thấy DOMPurify ở dòng __html: kế tiếp. Không cần sửa code.)*
#### [x] 🟡 AUDIT-0710-D — 4 GET endpoint `notifications.ts` lộ dữ liệu tài chính không cần auth *(xong 2026-07-10 — thêm requireAuth cho eod-report/alerts/alerts-config/notifications-status; xác nhận App.tsx có fetch interceptor tự đính Bearer token cho mọi request /api nên không vỡ luồng cũ)*
#### [x] 🟡 AUDIT-0710-E — Bug phân bổ Ads: `useShopeeInventoryOut.ts:542-562` không lọc platform + không dùng isEffectiveOrder + hard-code adsTax=0 *(xong 2026-07-10)*
#### [x] 🟡 AUDIT-0710-F — FORMULAS.md §10.2b/c sai vs code *(xong 2026-07-10 — sửa §10.0b/§10.2b/§10.2c khớp code: tiêu chí đơn hiệu quả = status OK/SHIPPING, xác nhận code THẬT có ghi net_profit)*
#### [x] 🟡 AUDIT-0710-G — Job Ads không gọi auditLog() + thiếu Number.isFinite() guard *(xong 2026-07-10 — thêm guard bỏ qua ngày có total_spend âm/NaN từ bot + ghi 1 dòng audit_logs tổng hợp mỗi lần job update ≥1 đơn)*
#### [x] 🟡 AUDIT-0710-H — Validate backend yếu ở `/api/data/upsert` *(xong 2026-07-10 — thêm validateDataPayload: chặn NaN/Infinity toàn payload + số âm cho pos_products.sale_price/import_price; + migration 036 CHECK constraint DB-level NOT VALID, KHÔNG áp cho pos_orders/stock vì có giá trị âm/opt-in hợp lệ)*
#### [x] 🟡 AUDIT-0710-I — `/health` trả 'OK' cứng + thiếu alerting hạ tầng *(xong 2026-07-10 — /health giờ SELECT 1 thật từ Supabase (timeout 2s, 503 nếu lỗi) + scripts/health-alert.sh cron 5p bắn Zalo khi fail 2 lần liên tiếp. Verify: xác nhận 503 khi DB unreachable trong sandbox; verify chiều thành công cần chạy trên iMac thật — user tự cài cron theo hướng dẫn trong file script)*
#### [x] 🟡 AUDIT-0710-J — Logging thiếu redact + ghi file rotation *(xong 2026-07-10 — errorTracking.ts: thêm redact() che field password/token/secret/apikey/jwt..., ghi log ra logs/error-YYYY-MM-DD.log giữ 14 ngày; PHÁT HIỆN THÊM: errorHandler chưa từng được wire vào server.ts (middleware "chết") — đã thêm app.use(errorHandler) làm middleware cuối cùng)*
#### [x] 🟡 AUDIT-0710-K — Rollback deploy chưa có *(xong 2026-07-10 — deploy-imac.sh: backup hardlink (cp -Rl) trước khi ghi đè, tự động rollback + restart nếu health-check fail sau deploy; docs/03-deployment/ROLLBACK_RUNBOOK.md mới cho các kịch bản build/migration/health-check fail. LƯU Ý: chưa test end-to-end trên iMac thật (không có SSH access) — user nên theo dõi sát lần deploy đầu tiên dùng script mới)*
#### [x] 🟡 AUDIT-0710-L — Thiếu index *(xong 2026-07-10 — migration 035: pos_products(sku), shopee_inventory_out(date,platform). LƯU Ý: pos_orders(date) THỰC RA đã có sẵn từ migration 006 (idx_pos_orders_date_desc) — audit ban đầu bỏ sót vì chỉ quét supabase_setup.sql)*
#### [x] 🟡 AUDIT-0710-M — Error message lộ raw tiếng Anh *(xong 2026-07-10 — tạo services/errorMessages.ts translateError(), áp dụng cho 13 chỗ ở ShopeeProductsPage/WebsiteProductsPage/WebsiteOrdersPage/WebsiteChannelLinksPage/GoodsInventory)*
#### [x] 🟢 AUDIT-0710-N — routes/ coverage 0.89% *(xong 2026-07-10 — thêm routes/adsSpendSync.test.ts (4 test) + routes/inventoryOutSync.test.ts (4 test), mock SupabaseClient + axios, phủ logic phân bổ QC/prorate/status-map/unchanged-skip)*
#### [x] 🟢 AUDIT-0710-O — Dead code Background Sync *(xong 2026-07-10 — xóa listener 'sync' + syncOfflineOrders/syncInventoryChanges/openDB trong service-worker.js, xác nhận không nơi nào đăng ký tag sync-orders/sync-inventory)*

### [x] 🟢 DEV-ENV-01 — Dựng môi trường dev/staging always-on riêng trên iMac, tách biệt hoàn toàn dữ liệu prod *(xong 2026-07-08)*

> User muốn 1 link dev cố định "giống prod" nhưng không ảnh hưởng dữ liệu prod. Phát hiện: trước đây dev (MacBook) và prod dùng CHUNG 1 Supabase database thật. Đã dựng stack Supabase self-host thứ 2 hoàn toàn riêng trên iMac (`~/supabase-dev`, container hậu tố `-dev`, Kong port 8010, secret mới hoàn toàn) + app instance riêng (`~/cfobrain-dev`, launchd `com.cfobrain.app.dev`, port 3010) + route Cloudflare Tunnel mới (`dev.phucsang.com.vn` → 3010, `supabase-dev.phucsang.com.vn` → 8010). Copy dữ liệu prod sang dev 1 lần (pg_dump/restore, verify khớp số dòng tuyệt đối). Từ nay dev/prod độc lập hoàn toàn — sửa gì trên dev không đụng prod. Chi tiết đầy đủ: HISTORY.md.
> **User đã tự test xong**: đăng nhập `https://dev.phucsang.com.vn` bằng tài khoản chủ thật — dữ liệu hiển thị đúng, khớp prod (snapshot lúc copy). Trong lúc test phát hiện + sửa luôn 1 bug CORS có sẵn từ trước (không liên quan dev-env mới) ở `server.ts allowedHeaders` thiếu `apikey`/`x-client-info`/`x-supabase-api-version` — chặn local dev (`localhost:3000`) khi fallback gọi Supabase qua proxy `app.phucsang.com.vn`. Đã sửa + deploy cả prod lẫn dev. Chi tiết: HISTORY.md.
> **Thêm `scripts/sync-prod-to-staging.sh`** (làm mới dữ liệu dev/staging trên iMac từ prod, chạy tay khi cần — không tự động trong deploy). **Phát hiện**: đã có sẵn 1 bộ Supabase dev KHÁC chạy local trên MacBook từ 02/07 (`scripts/sync-prod-to-dev.sh`, `~/supabase-dev/docker` trên MacBook, dùng khi offline) — user muốn giữ lại song song, không gộp. Đã sửa luôn IP cũ `192.168.1.3`→`192.168.1.6` trong script cũ (lỗi kết nối nếu chạy nguyên trạng). Đã chạy thử `sync-prod-to-staging.sh` thành công, verify số dòng khớp tuyệt đối.
> **Đổi fallback local dev khỏi prod**: local dev (`server.ts`, khi Docker Supabase local không chạy) trước đây fallback thẳng sang Supabase PROD — đã đổi sang fallback dev/staging (`dev.phucsang.com.vn`), kèm fix CORS origin `localhost:3000` cho server dev-staging (port riêng 3010) chấp nhận. Deploy cả 2 môi trường, verify preflight CORS thật OK. Chi tiết: HISTORY.md.

### [ ] 🔴 PISHIP-FIELD — Field `SELLER_PROTECTION_FEE` ĐÃ ĐƯỢC XÁC MINH ĐÚNG bằng dữ liệu thật — chờ user xác nhận bằng lời để mở rộng backfill

> **2026-07-07/08 — bằng chứng xác minh**: user chụp màn hình Shopee đơn `237101463287729` (shop2, order_sn `2607072XFTWSWH`) cho thấy dòng **"Phí dịch vụ PiShip" = -2.700đ**, tách riêng khỏi Phí cố định/Phí Dịch Vụ/Phí xử lý giao dịch, và **"Doanh thu đơn hàng ước tính" = 208.085đ**. Trước đó DB bot lưu đơn này: `piship_fee=0`, `escrow_amount=210.785` (lệch đúng 2.700 — do bot quét TRƯỚC khi Shopee chốt khoản này vào đối soát). Đã dùng endpoint debug có sẵn `/api/debug/fetch-income` (không sửa code, không restart) để trigger fetch lại đúng đơn này trên shop2 → kết quả DB cập nhật **`piship_fee=-2700`, `escrow_amount=208085`** — **KHỚP TUYỆT ĐỐI với Shopee** (cả 2 số, tới từng đồng). → **Xác nhận mapping `SELLER_PROTECTION_FEE` là ĐÚNG** — không cần đổi field.
> **Vì sao backfill trước đó ra 0 hết trên shop1**: phí này biến đổi theo đơn (không phải đơn nào cũng có giá trị khác 0 — khác với giả định "đơn nào cũng có" của user) — không phải lỗi field.
> **Trạng thái hiện tại**: query backfill đã sửa và deploy trên cả 2 shop (dùng chung file), cả 2 bot đã restart để nạp code + query mới, đang online ổn định. Đã bị **classifier chặn** khi thử chạy backfill quy mô lớn (limit=500 cả 2 shop, rồi cả limit=10 1 shop) vì user mới nói "để tôi kiểm tra Shopee đã" — cần **user xác nhận bằng lời rõ ràng** (không chỉ dựa vào bằng chứng số liệu) mới được chạy backfill tiếp.
> **Việc cần làm khi user xác nhận**: trigger `POST http://localhost:3002/api/backfill?limit=10` (test nhỏ 1 shop trước, đúng scope đã duyệt) → verify → rồi mở rộng `limit=500` cả 2 shop → chạy `sync-fees-to-supabase.js` hoặc app "Đồng bộ Bot" để kéo lên Supabase.

### [x] 🟢 PISHIP-BACKFILL — HOÀN TẤT: backfill + sync PiShip lên Supabase thành công *(xong 2026-07-08)*

> **User duyệt qua AskUserQuestion**: test 20 đơn trước → xác nhận kết quả tốt → "Cứ backfill PiShip cho 388 đơn trước" (xử lý riêng vấn đề lệch công thức lớn hơn phát hiện sau).
> **Backfill trên bot** (2 đợt: test 20 + full còn lại): shop1 tổng **51 đơn** xử lý (10+41), shop2 tổng **83 đơn** xử lý (10+73) — **0 lỗi, 0 bỏ qua** cả 2 đợt cả 2 shop.
> **Phát hiện giới hạn dữ liệu cũ**: ước tính ban đầu 408 đơn cần backfill (207 shop1 + 201 shop2) dựa trên điều kiện `piship=0 AND escrow!=0`, nhưng backfill thực tế chỉ xử lý được **134 đơn** (51+83) vì phần còn lại **thiếu `order_id_numeric`** (dữ liệu quét gốc không đầy đủ, không đủ điều kiện để bot fetch lại qua cơ chế hiện tại) — giới hạn dữ liệu lịch sử, không phải lỗi logic.
> **Kết quả PiShip**: shop1 **0/236 đơn có PiShip** (nhất quán — có vẻ shop1 không tham gia chương trình phí bảo vệ người bán này); shop2 **76/214 đơn có PiShip = 2.700đ** (biến đổi theo đơn, không phải mọi đơn).
> **Sync lên Supabase** (qua domain tunnel `https://supabase.phucsang.com.vn` — IP LAN trực tiếp `192.168.1.3:8000` không route được nhưng tunnel domain vẫn sống, dùng script tạm copy từ `sync-fees-to-supabase.js`, đổi 1 dòng URL, KHÔNG sửa file gốc, xoá ngay sau mỗi lần chạy): **572 dòng cập nhật, 0 lỗi, 0 not-found** (shop1: 192 đơn → 331 dòng do split SKU; shop2: 178 đơn → 241 dòng). Verify bằng sampling ngẫu nhiên đọc lại từ Supabase — khớp chính xác dữ liệu SQLite.
> **Còn treo (việc khác, xem PISHIP-FORMULA-GAP)**: phát hiện 65-81% đơn lệch công thức Sàn Thanh Toán 12.987–14.696đ (lớn hơn nhiều PiShip) — nguyên nhân chưa xác định chắc chắn (thiếu phí Ads/AMS_COMMISSION_FEE khác, hoặc dữ liệu stale do đơn bị hoàn/đổi sau khi bot quét lần đầu). User chọn xử lý PiShip trước, vấn đề này để riêng.

### [x] 🟢 ADS-FEE-GAP — HOÀN TẤT: bot + app + Supabase sync + user chạy SQL migration *(xong 2026-07-08)*

### [x] 🟢 SETTLEMENT-FIX-01 — Sửa nguồn sai "Giá trị hàng" gây lệch Sàn Thanh Toán *(xong 2026-07-08)*
> User báo sau khi thêm cột Ads, Sàn Thanh Toán sai. Tìm ra `routes/inventoryOutSync.ts` ưu tiên nhầm `order_items.price` (giá cào, có thể lệch) thay vì `order_details.product_price` (MERCHANDISE_SUBTOTAL từ chính API Shopee, khớp đúng escrow thật). Đã sửa thứ tự ưu tiên, deploy, resync — 41/47 đơn khớp đúng, 6 đơn còn lại đúng theo thiết kế (fallback vì chưa có product_price).

### [x] 🟢 DEDUP-ROWS-01 — Dọn dẹp dòng trùng lặp trong shopee_inventory_out *(xong 1 phần, 2026-07-08)*
> 351 đơn có nhiều dòng trùng do cách tính mã SKU thay đổi qua các đời code trước. Chỉ **66 đơn xác minh chắc chắn** (đối chiếu `order_items` thật của bot) được xử lý: backup toàn bộ bảng trước, giữ đúng 1 dòng khớp SKU tính theo code hiện tại, xóa 81 dòng thừa — verify: không dòng nào có `ads_cost`/`net_profit` bị mất. **Còn lại 285 đơn KHÔNG xử lý** vì bot không còn dữ liệu `order_items` gốc để xác minh (đơn quá cũ) — không xóa liều để tránh mất dữ liệu thật. Nếu cần dọn tiếp, phải tìm cách xác minh khác (không dựa vào order_items) hoặc chấp nhận rủi ro thủ công từng đơn.

### [x] 🟢 BOT-RACE-01 — Sửa lỗi race condition khiến bot lưu nhầm số liệu tài chính chéo giữa các đơn *(xong 2026-07-08)*
> User phát hiện đơn `2607060KHA74EM` hiển thị sai hoàn toàn so với ảnh chụp Shopee thật (mọi phí, giá trị hàng, Sàn Thanh Toán). Điều tra ra: dữ liệu trong DB của đơn này trùng khớp TUYỆT ĐỐI với đơn KHÁC (`2606289QGRE30K`) — không phải trùng ngẫu nhiên (giá trị hàng 329k không khớp giá thật 299k của đơn này).
>
> **Nguyên nhân gốc**: `bots/orders.js` — hàm `fetchOrderIncome(page, ...)` được gọi KHÔNG `await` bên trong vòng lặp xử lý danh sách đơn (dòng 748, 756 cũ). Khi nhiều đơn "chờ xác nhận"/"chờ lấy hàng" xuất hiện cùng lúc trong 1 lần quét, nhiều lệnh fetch chạy CHỒNG CHÉO trên CÙNG 1 trang trình duyệt (`page`) — lệnh sau điều hướng đè URL của lệnh trước, khiến response tài chính bị "chộp nhầm" và lưu sai order_sn.
>
> **Đã sửa**: thêm `await` vào cả 3 lệnh gọi `fetchOrderIncome` (dòng 649 debug-trigger, 748, 756 vòng lặp chính) — đảm bảo các lần fetch chạy tuần tự, không chồng chéo. Deploy lên iMac, restart cả 2 bot (shop1 + shop2), verify log không lỗi.
>
> **⚠️ CHƯA XỬ LÝ**: không có cách rẻ tiền để dò quét TOÀN BỘ lịch sử đơn đã fetch trước fix này xem còn đơn nào khác bị dính lỗi tương tự (thử dùng "trùng fingerprint phí" nhưng không đáng tin — nhiều đơn cùng sản phẩm/giá tự nhiên có phí giống hệt, không phải bug). Chỉ phát hiện được khi user tự đối chiếu tay với ảnh Shopee thật như lần này. Rủi ro: có thể còn đơn khác bị sai âm thầm trong dữ liệu lịch sử.

> **2026-07-08 — xác định dứt điểm** (quét live 5 đơn lệch nhiều nhất qua `/api/debug/fetch-income`, debug code tạm đã dọn sạch ngay sau khi lấy kết quả): cả 5/5 đơn đều có field **`AMS_COMMISSION_FEE`** trong `FEES_AND_CHARGES` (Shopee Ads — hoa hồng quảng cáo) mà bot **chưa từng capture**. Verify khớp tuyệt đối escrow thật:
> ```
> 329.000 − 50.995(cố định) − 2.700(PiShip) − 21.095(DV) − 19.740(xử lý GD) − 11.086(Ads) − 3.290(VAT) − 1.645(TNCN) = 218.449 = escrow thật ✅
> ```
> **Đây chính là nguyên nhân của 65-81% đơn lệch 12-15kđ** đã phát hiện trước đó — không phải dữ liệu stale, không phải lỗi công thức app, mà là thiếu 1 field trong bot.
> **Quyết định user**: cột **mới riêng** `shopee_ads_fee`/`shopeeAdsFee` (không gộp vào `adsCost` hiện có — cột đó vẫn giữ nguyên cho chi phí QC user tự nhập tay, xem §10.2b FORMULAS.md).
> **✅ ĐÃ XONG (2026-07-08)**:
> 1. Bot (`bots/orders.js` + `backfill-fees-fast.js`) trích `AMS_COMMISSION_FEE`, lưu cột `ams_commission_fee` (SQLite) — deploy sạch cả 2 shop, restart pm2, verify không lỗi.
> 2. Backfill đơn cũ qua `/api/debug/fetch-income` (tuần tự, 6s/đơn, không dùng script Playwright rời vì bị lỗi 404 profile lock): **shop1 13 đơn + shop2 24 đơn** có `ams_commission_fee` thật (khác 0). Phần lớn đơn còn lại thiếu `order_id_numeric` (137 shop2 + phần lớn shop1) — vấn đề cũ, xem PISHIP-MISSING-ORDERID.
> 3. App-side plumbing đầy đủ: `types.ts` (`shopeeAdsFee`), `routes/inventoryOutSync.ts` (prorate theo SKU), `hooks/useAppData.ts` + `services/dataMapper.ts` (mapping), `InventoryOutTab.tsx` (`calcPlatformNet()` trừ thêm, cột mới trong bảng + CSV), `supabase_setup.sql` (migration 026, **user cần tự chạy trên dashboard**), `server.ts` (`syncLocalSchema` cảnh báo cột thiếu). TypeScript clean, `npm test` 981/981 pass.
> 4. Sửa `handleDistributeAdsCost` theo yêu cầu user: chia tổng QC/ngày chỉ cho đơn "hiệu quả" (`shopeeAdsFee > 0`), không chia đều mọi đơn — xem §10.2b FORMULAS.md.
> **✅ HOÀN TẤT (tiếp, 2026-07-08)**:
> - Migration 026 chạy trực tiếp qua `docker exec supabase-db psql` trên iMac (user đồng ý cách này thay vì tìm dashboard — lưu ý: đây là Supabase **tự host** trên iMac, KHÔNG phải supabase.com cloud, dễ nhầm). Verify `\d shopee_inventory_out` thấy cột `shopee_ads_fee numeric default 0`.
> - Sync `ams_commission_fee` → `shopee_ads_fee` chạy trên iMac (`sync-fees-to-supabase.js`) — **576 dòng cập nhật, 0 lỗi** (331 shop1 + 245 shop2). Gặp + sửa 1 bug: script hardcode `SUPABASE_URL=http://192.168.1.3:8000` (IP cũ của iMac, IP thật đã đổi thành `192.168.1.6`) → sửa thành `http://localhost:8000` (chạy trực tiếp trên iMac). Verify qua psql: **52 dòng có `shopee_ads_fee != 0`** trên Supabase, khớp SQLite tuyệt đối.
> - **Bonus fix**: cùng lỗi IP cũ `192.168.1.3` cũng tồn tại trong `server.ts` (3 chỗ) + `routes/channelManagement.ts` (1 chỗ) — khiến app-side auto-detect mạng nội bộ luôn fail → fallback tunnel `app.phucsang.com.vn` (đang lỗi kết nối) → dev không tải được BẤT KỲ dữ liệu nào (không riêng Xuất kho). Đã sửa IP thành `192.168.1.6` ở cả 4 chỗ.
> - **Bug proxy thứ 3 — ĐÃ SỬA, verify UI thành công**: `server.ts` proxy `/auth/v1`,`/rest/v1`,`/storage/v1` forward nhầm header `content-encoding`/`content-length` sau khi `fetch()` đã tự giải nén body → browser lỗi `ERR_CONTENT_DECODING_FAILED` khi login. Sửa xong (loại 2 header stale). Verify UI trực tiếp: trang Xuất kho hiện 2801 đơn thật, đơn `2606289QGRE30K` → cột "PHÍ ADS SHOPEE" = 11.086đ, khớp Postgres tuyệt đối.
> - **Verify Postgres trực tiếp** (trước khi verify UI): `SELECT COUNT(*) WHERE shopee_ads_fee != 0` = 52 dòng, sample data khớp chính xác SQLite.
> - Tự động lấy tổng chi QC/ngày từ Shopee Ads Manager (thay vì nhập tay) — chưa triển khai, để phiên sau.

### [x] ⚪️ (đã xác định nguyên nhân, xem ADS-FEE-GAP ở trên) PISHIP-FORMULA-GAP — 65-81% đơn lệch công thức Sàn Thanh Toán 12-15kđ

> **Phát hiện 2026-07-08** (đọc SQLite local, read-only): so khớp `product_price − |commission| − |piship| − |service| − |transaction| − |vat| − |pit|` với `escrow_amount` thật trên toàn bộ đơn có escrow:
> - Shop1: 193 đơn có escrow, chỉ **68 khớp (35%)**, **125 lệch (65%)**.
> - Shop2: 183 đơn có escrow, chỉ **34 khớp (19%)**, **149 lệch (81%)**.
> - Mức lệch lớn: nhiều đơn **12.987 – 14.696đ** — lớn hơn nhiều so với PiShip (2.700đ) hay Ads/AMS đã thấy trước đó (7.106đ ở 1 đơn mẫu).
> **Giả thuyết "dữ liệu stale do hoàn hàng" đã LOẠI BỎ** (2026-07-08, đọc local): 0/178 đơn lệch (shop2) có `return_completed_at`, toàn bộ status "Đã giao" bình thường — không liên quan tới hoàn/đổi trả.
> **Phát hiện thêm — lệch có tính % nhất quán**: mức lệch dao động **3.78% – 4.47% giá trị đơn** (trung bình ~4.2%), khá đều đặn qua nhiều đơn khác nhau → gợi ý đây là **1 loại phí % cố định** (không phải phí Ads chỉ áp dụng ngẫu nhiên vài đơn) — có thể là 1 field khác trong `FEES_AND_CHARGES` mà bot chưa từng query. **Không thể xác định chính xác tên field nếu không quét lại Shopee thật** (cần xin phép riêng, ngoài phạm vi PiShip đã duyệt).
> **User đã chọn**: xử lý PiShip trước (xong), vấn đề này để sau, riêng.
> **Việc cần làm khi quay lại**: quét lại (`/api/debug/fetch-income`) vài đơn lệch nhiều nhất (vd `260316A0K26FKF` lệch 14.696đ, 4.47%) để xem breakdown đầy đủ, xác định đúng tên field trước khi quyết định hướng sửa.

### [ ] ⚪️ PISHIP-MISSING-ORDERID — 274 đơn thiếu `order_id_numeric`, có đường khôi phục nhưng cần duyệt riêng

> **Phát hiện 2026-07-08** (đọc code `bots/orders.js`, read-only): `order_id_numeric` chỉ được điền từ response trang **danh sách đơn** (`get_order_list_card_list`, dòng 730-731: `numericId = orderCard?.order_ext_info?.order_id`), KHÔNG phải từ income detail. Đơn cũ thiếu field này (274 đơn ước tính) không thể backfill PiShip qua `/api/backfill` (cần `order_id_numeric` để biết URL fetch income).
> **Đường khôi phục có sẵn**: endpoint `POST /api/scan/date-range` (đã có trong `src/apiServer.js:176`) quét lại trang danh sách đơn theo khoảng ngày → tự động điền `order_id_numeric` cho đơn gặp trong khoảng đó → sau đó chạy lại `/api/backfill` sẽ xử lý được thêm các đơn này.
> **Chưa thực hiện**: đây là **phạm vi mới** (quét thêm 1 lượt Shopee live nữa, ngoài phạm vi "backfill PiShip 388 đơn" đã duyệt) — cần hỏi lại user trước khi chạy.

### [x] ⚪️ (đã giải quyết, giữ tham khảo) Hạ tầng ĐÃ THÔNG

> **2026-07-08 — định lượng phạm vi**: **shop1: 207 đơn, shop2: 201 đơn = 408 đơn cần điền PiShip** (khớp ước tính "~400" của user). Query backfill đã sửa đúng, deploy + restart trên cả 2 bot, ổn định, sẵn sàng chạy.
> **Điều tra hạ tầng (đã sửa lại kết luận trong ngày)**: `sync-fees-to-supabase.js` trên iMac hardcode `SUPABASE_URL='http://192.168.1.3:8000'` (IP LAN) — ping từ iMac (cùng dải `192.168.1.4`) mất gói 100% → tưởng nhầm là "Supabase offline". Nhưng test domain Cloudflare tunnel `https://supabase.phucsang.com.vn` (thấy trong CSP `server.ts`) từ iMac → **HTTP 401 (không phải connection refused/timeout)** = **kết nối tầng ứng dụng thành công**, chỉ thiếu quyền do RLS/role. **Kết luận đúng: Supabase KHÔNG offline — chỉ IP LAN trực tiếp bị chặn/đổi route; domain tunnel vẫn sống.** Muốn ghi dữ liệu thật: đổi `SUPABASE_URL` trong `sync-fees-to-supabase.js` (chỉ khi chạy, không cần sửa vĩnh viễn) sang `https://supabase.phucsang.com.vn`, giữ nguyên service-role key đã có sẵn trong file.
> **Rào cản DUY NHẤT còn lại**: agent đã bị chặn an toàn 3 lần khi thử backfill diện rộng (limit=500 cả 2 shop, limit=10 1 shop) vì **chưa có xác nhận bằng lời rõ ràng** từ user cho việc ghi dữ liệu tài chính prod (chỉ mới gửi ảnh chụp Shopee, chưa nói "đúng rồi/chạy đi"). Đây là quyết định user phải chủ động đưa ra.
> **Việc cần làm khi user xác nhận bằng lời**: (1) `POST http://localhost:3001/api/backfill?limit=250` (shop1) + `POST http://localhost:3002/api/backfill?limit=250` (shop2) trên iMac qua SSH, ~2s/đơn (~14 phút); (2) sửa `SUPABASE_URL` trong `sync-fees-to-supabase.js` sang domain tunnel rồi `node sync-fees-to-supabase.js`; (3) verify trang Xuất kho.
>
> **Context cũ**: 2026-07-06 đã sửa bot lấy PiShip = `SELLER_PROTECTION_FEE` (trước dò khóa không tồn tại → luôn 0) và đã deploy + restart bot trên iMac. **Đơn MỚI từ nay tự có piship.** Đơn CŨ vẫn `piship_fee = 0` trong DB.
>
> **Việc còn lại (user chọn hoãn — làm sau)**: backfill piship cho ~400 đơn cũ. Vướng: cả 2 đường backfill (`backfill-fees-fast.js` và `bots/orders.js` event `backfill:start`) hiện chỉ quét đơn **thiếu escrow**, mà đơn cũ đã có escrow → bị bỏ qua. Cần:
> 1. Sửa query backfill: target `piship_fee = 0 AND status đã giao/nhận/hoàn/thất bại` (bỏ điều kiện escrow=0).
> 2. Chạy backfill trên iMac (dùng session Shopee của bot đang chạy) — re-scrape ~400 đơn, chậm, rủi ro nhỏ về tần suất.
> 3. Chạy `sync-fees-to-supabase.js` đẩy phí mới lên Supabase.
>
> App đã sẵn sàng hiển thị đúng ngay khi có dữ liệu piship.

### [x] 🟢 DEV-AUTH-01 — Trang Xuất kho (bảng đã khoá anon) không tải ở dev do bypass login chạy anon *(xong 2026-07-06)*

> **User báo**: Bán online → Doanh Thu Shopee → Xuất kho báo lỗi tải đơn hàng (hiện 0 đơn).
>
> **Nguyên nhân**: dev bypass login (`AuthGate.tsx` khởi tạo session giả `{}`) → Supabase chạy role `anon`. Migration bảo mật `023`/`024` (02–03/07) REVOKE anon trên `shopee_inventory_out`/`shopee_source_data`... → anon `42501 permission denied`; `loadInventoryOut()` silent-catch → 0 đơn. Prod không bị (đăng nhập thật = `authenticated`). Xác minh: service-role thấy 2790 dòng thật, 2 bot 3001/3002 OK → backend khỏe, chỉ là dev chạy anon.
>
> **✅ ĐÃ SỬA** (`components/AuthGate.tsx`): dev auto-login thật khi `.env.local` có `VITE_DEV_LOGIN_USER`+`VITE_DEV_LOGIN_PASSWORD` (resolve username→`@cfobrain.local`), chờ login xong mới render. Thiếu biến → giữ bypass cũ (không regression).
>
> **Verify browser dev**: session role=`authenticated`; Sản phẩm Shopee 30 SP/1216 listing (trước 0); Xuất kho **2.396 đơn** (trước 0); console sạch. tsc pass.
>
> **Lưu ý**: creds dev nằm plaintext trong `.env.local` (gitignore). Cân nhắc tạo user dev quyền hạn chế thay cho tài khoản owner.
>
> Files: `components/AuthGate.tsx`, `.env.local` (ngoài repo).

### [x] 🟠 SHOPEE-ORDERS-01 — Đơn Shopee: tỉnh trống + mất sản phẩm thứ 2 trở đi *(fix xong + đã deploy 2026-07-05)*

> User báo trên link prod: (1) đơn Shopee mới không có tỉnh, để trống; (2) đơn `260703PMY9G09S` có 2 sản phẩm khác nhau nhưng app chỉ hiện 1.
>
> **Nguyên nhân 1 — tỉnh trống**: bot Shopee (`~/shopee-monitor`) đã có sẵn hàm bù tỉnh `fillMissingProvinces()` (`bots/orders.js`) nhưng **chỉ chạy khi ai đó gọi tay** `POST /api/fill-provinces` — không có lịch tự động, và app cũng chưa từng gọi endpoint này. Đơn nào lọt tỉnh lúc scrape ban đầu sẽ trống vĩnh viễn.
>
> **Nguyên nhân 2 — mất sản phẩm**: `order_details` là bảng 1-dòng-1-đơn, và code scrape list-card chỉ lấy `item_info_list[0].item_list[0]` — bỏ mọi sản phẩm còn lại ngay từ lúc quét. Phát hiện thêm: API `get_order_income_components` (đã được bot gọi sẵn qua `fetchOrderIncome`) trả về `order_item_list.order_items[]` — **đã có sẵn đầy đủ danh sách sản phẩm + số lượng**, nhưng code cũ chỉ lấy `[0]`.
>
> **✅ ĐÃ SỬA** (repo `~/shopee-monitor`, ngoài repo app — deploy thủ công qua rsync + pm2 restart, không có script deploy tự động cho bot):
> - `src/db.js`: bảng mới `order_items` (order_sn, item_index, product_name, product_sku, quantity) + cột `order_details.items_synced` đánh dấu đã đồng bộ đủ sản phẩm chưa. Hàm `saveOrderItems()`/`getItemsForOrders()`/`getOrdersMissingItems()`.
> - `bots/orders.js`: `fetchOrderIncome()` giờ lưu **toàn bộ** `order_item_list.order_items[]` (không chỉ `[0]`) vào `order_items`. Mở rộng `fillMissingProvinces()` bù **cả tỉnh lẫn sản phẩm** trong 1 lượt ghé trang chi tiết đơn (tiết kiệm request). Thêm lịch tự động `setInterval` 20 phút/lần tự chạy hàm này (trước đây không có lịch nào).
> - `src/apiServer.js`: `GET /api/orders` giờ trả kèm `items: [...]` mỗi đơn (fallback dựng từ cột đơn lẻ nếu đơn chưa kịp đồng bộ).
> - `backfill-multi-items.js` (mới): script một lần để bù sản phẩm cho đơn cũ hàng loạt qua gọi API trực tiếp (không cần dùng vì job tự động 20 phút đã quét sạch backlog ngay sau khi restart).
> - App (`components/online/AllOrdersPage.tsx`): đổi `product_summary`/`sku_summary` dùng `items[]` mới, theo đúng pattern đã có sẵn cho đơn Website (`items.length===1 ? tên : "tên + N sản phẩm khác"`).
>
> **Verify live trên production** (restart pm2 `shopee-shop1`+`shopee-shop2` sau khi rsync code mới): log xác nhận đúng đơn `260703PMY9G09S` → `tỉnh Thành phố Cần Thơ` + `2 sản phẩm`; gọi lại API xác nhận `items` có đủ 2 sản phẩm (`DQND25` + `DQND21`). tsc sạch, 981/981 test pass.
>
> Files: `~/shopee-monitor/src/db.js`, `~/shopee-monitor/bots/orders.js`, `~/shopee-monitor/src/apiServer.js`, `~/shopee-monitor/backfill-multi-items.js` (mới, ngoài repo app), `components/online/AllOrdersPage.tsx`.

### [x] 🟢 DEV-SHOPEE-01 — Trang "Đơn hàng online" trống ở local dev (bot Shopee chỉ chạy trên iMac) *(xong 2026-07-05)*

> **Nguyên nhân**: bot Shopee (`~/shopee-monitor`) chỉ chạy trên iMac (chuyển từ MacBook 02/07). Backend dev (MacBook) forward `/api/shopee-orders/:shopId` tới `SHOPEE_BOT_HOST` (mặc định `localhost`) — nhưng bot không chạy trên MacBook nên `ECONNREFUSED` → route trả `503`, trang hiện rỗng. Không phải bug code, code tự báo lỗi đúng.
>
> **✅ ĐÃ SỬA**: tạo LaunchAgent `~/Library/LaunchAgents/com.phucsang.dev-bot-tunnel.plist` trên MacBook — tự mở & duy trì SSH tunnel `-L 3001:localhost:3001 -L 3002:localhost:3002` sang `imac-cfobrain` (dùng key SSH có sẵn cho deploy), tự khởi động cùng máy + tự restart nếu rớt (`KeepAlive`). Không cần đổi `.env.local` vì code mặc định `SHOPEE_BOT_HOST=localhost` sẵn — tunnel khiến `localhost:3001/3002` trên MacBook trỏ đúng sang bot thật. Cập nhật comment trong `routes/shopeeSync.ts` cho khớp kiến trúc hiện tại (trước đó ghi ngược: tưởng bot chạy MacBook, prod là iMac riêng).
>
> **Verify**: `curl localhost:3001/3002/api/orders` qua tunnel → 200. Gọi thẳng `GET /api/shopee-orders/1` qua `INTERNAL_API_KEY` → 200, trả đúng 236 đơn thật shop `phuc_sang_store`. Không verify được qua UI browser vì phiên preview chưa đăng nhập Supabase (vấn đề khác, không liên quan) — user tự đăng nhập app thật sẽ thấy dữ liệu ngay.
>
> Giữ nguyên tách biệt dữ liệu dev/prod (Supabase local Docker trên MacBook không đổi) — chỉ riêng luồng đọc-only đơn Shopee (dữ liệu ngoài app, không có khái niệm "dev version") mượn chung bot thật trên iMac qua tunnel.
>
> Files: `routes/shopeeSync.ts` (comment), `~/Library/LaunchAgents/com.phucsang.dev-bot-tunnel.plist` (mới, ngoài repo).

### [x] 🟡 AUDIT-ACTOR-01 — Nhật ký hoạt động: ghi "ai" thao tác + trang xem (owner-only) *(hoàn tất + ĐÃ DEPLOY 2026-07-04)*

> Ghi danh tính người thực hiện vào `audit_logs` cho mọi thao tác (tạo/sửa/xóa/hủy đơn, upsert, xóa bảng, giao dịch tồn kho) + trang "Nhật ký hoạt động" trong Settings để chủ cửa hàng xem ai đã làm gì.
>
> **✅ ĐÃ XONG + VERIFY (dev)**: migration `030` thêm `p_actor_id/p_actor_name` vào 4 RPC + ghi `audit_logs.snapshot` (thân hàm giữ nguyên); `routes/data.ts` có `resolveActor()` (lấy từ JWT, không tin client) truyền vào 4 RPC + mọi `auditLog()`, endpoint `GET /api/data/audit-logs` **owner-only**; `apiService.fetchAuditLogs()`; trang `ActivityLogPage.tsx` (lọc/tìm/phân trang/JSON); tab trong Settings **ẩn với non-owner** (gating `userRole` ở SettingsCenter + App.tsx). Verify live: owner 200 + actor ghi đúng ("Chủ cửa hàng") cho place/delete, non-owner 403, UI render sạch. tsc + 981 test pass. Chi tiết HISTORY R30.
>
> **✅ ĐÃ DEPLOY production 2026-07-04**: `deploy-imac.sh` áp migration `030` (đổi chữ ký 4 RPC, code cũ không còn dùng) + build + restart — health check 200 OK. Set `role='owner'` cho tài khoản chủ thật `admin@cfobrain.local` trên `auth.users` **prod** (trước đó là `manager`) — đã xác nhận qua SELECT sau UPDATE.

### [x] 🟡 ORDERS-EDIT-01 — Sửa hóa đơn trong POS (mở đơn cũ để đổi sản phẩm/số lượng/giá) *(xong 2026-07-03)*

> Nút "Sửa trong POS" ở trang Hóa đơn — mở lại đơn vào máy tính tiền, sửa xong lưu đè đúng id cũ (hoàn tồn kho + trừ/cộng doanh thu + tính lại doanh số NV, không nhân đôi lịch sử). Theo quyết định user: không giới hạn quyền/ngày, chưa xử lý riêng đơn có phiếu trả hàng liên kết (rủi ro đã ghi). Chưa hỗ trợ sửa đơn trả/đổi hàng. Chi tiết HISTORY.md.

### [x] 🟡 ORDERS-EDIT-02 — Xử lý sửa đơn đã có phiếu trả hàng liên kết *(fix xong + ĐÃ DEPLOY 2026-07-04)*

> **Rủi ro gốc**: `editPosOrder()` tự tính lại tồn kho theo delta (số lượng CŨ vs MỚI của đơn đang sửa) hoàn toàn độc lập với phiếu trả hàng đã xử lý trước đó. Nếu sửa số lượng xuống THẤP HƠN số đã trả (vd: bán 5, đã trả 3, sửa xuống còn 2) → tồn kho bị cộng trùng phần phiếu trả đã cộng lại rồi (double-count). Sửa xuống mức vẫn ≥ số đã trả thì toán học vẫn đúng (đã kiểm chứng bằng tay từng bước).
>
> **✅ ĐÃ SỬA** [services/posOrderService.ts](../../services/posOrderService.ts): thêm guard trong `editPosOrder()` — tái dùng `getReturnedQuantitiesForOrder()` ([src/lib/returnGuards.ts](../../src/lib/returnGuards.ts), đã có sẵn từ RETURNS-GUARD-01) để tính số đã trả theo từng sản phẩm; nếu số lượng mới < số đã trả → chặn lưu với lỗi rõ ràng (vd: `"Dép ABC" đã có 3 sản phẩm được trả hàng — số lượng mới phải từ 3 trở lên`). Lỗi tự hiện lên UI qua đúng cơ chế cảnh báo có sẵn cho "Không đủ tồn kho" (POSComputer.tsx), không cần sửa UI. +2 unit test (chặn khi giảm dưới ngưỡng, cho phép khi vẫn đủ). 646/646 test pass, tsc sạch.

### [x] 🟡 ORDERS-DEL-01 — Xóa hàng loạt hóa đơn đúng chuẩn (hoàn tồn kho + trừ doanh thu) *(xong 2026-07-03)*

> Nút "Xóa N đơn" ở trang Hóa đơn. Tái dùng RPC/pattern có sẵn từ `processReturnOrder`. Chưa hỗ trợ đơn trả/đổi hàng (`isReturn`). Fix 2 bug phát sinh khi test multi-delete (sales_records tính sai do dùng data cũ giữa vòng lặp + không xóa dòng cũ khi NV về 0). Chi tiết HISTORY.md.

### [x] 🔴 BRAND-01 — Mất SĐT/địa chỉ cửa hàng tái diễn (khác lỗi 401 đã vá 06-28) *(fix xong 2026-07-03)*

> **ĐÃ SỬA**: prod DB `brand_profile.phone/address` bị ghi đè bằng placeholder `DEFAULT_BRAND` do race — thiết bị/browser chưa có cache + fetch đầu lỗi/chậm, user gõ field khác trong tab Hồ sơ thương hiệu → auto-save mang theo placeholder đè DB. Khôi phục dữ liệu thật trên prod (phone `033.571.3423 – 096.886.7411`, address `Số nhà 14, đường NC2, tổ 11, khu phố 3, phường Bến Cát, TP.HCM`) + vá gốc rễ [hooks/useAppData.ts](../../hooks/useAppData.ts) (`brandLoadedRef` chặn auto-save cho tới khi có dữ liệu thật xác nhận). Chi tiết HISTORY.md.

### [x] 🟡 POS-RETURN-01 — Phiếu trả thuần cộng NHẦM +giá trị trả vào doanh số NV *(fix xong 2026-07-04, ✅ ĐÃ DEPLOY 2026-07-04)*

> **ĐÃ SỬA** theo hướng "siết fallback chỉ áp dụng cho đơn import KiotViet": [posSalesAttribution.ts](../../src/lib/posSalesAttribution.ts) — phiếu POS native (items có `lineType`) trả thuần → doanh số NV = 0; fallback `max(0, finalAmount)` chỉ còn cho đơn import (không có lineType). +3 unit test. Verify live trên dev: bán 65k → doanh số NV +65k → trả thuần → doanh số GIỮ NGUYÊN 65k (trước fix sẽ nhảy 130k). ⏳ Sau deploy cần recalc `sales_records` các ngày có phiếu trả POS cũ (xem DATA-CLEANUP-01). Chi tiết HISTORY.md R19.

### [x] 🔴 RETURNS-CANCEL-01 — Trang Trả hàng: hủy phiếu/tạo phiếu tự chế phá tồn kho + doanh thu *(phát hiện audit + fix xong 2026-07-04, ✅ ĐÃ DEPLOY 2026-07-04)*

> **Phát hiện audit 2026-07-04**: `OrderReturns.tsx` có luồng song song tự chế — hủy phiếu trả trừ kho cả HÀNG ĐỔI (trừ kép), ghi stock đọc-rồi-ghi không qua RPC, ghi đè cả dòng `revenue_records` (race DATA-02 tái xuất), không khôi phục điểm khách/doanh số NV. **ĐÃ SỬA**: viết `processCancelReturn()` + `processCancelLegacyReturnTransaction()` chuẩn trong posOrderService (đảo tồn qua RPC theo tx.type, doanh thu delta atomic, khôi phục khách, recalc doanh số, phiếu → cancelled, giữ bản sao tx làm lịch sử); trang Trả hàng chỉ còn điều hướng sang POS để tạo phiếu (pattern R11) + gọi service chuẩn để hủy. Verify live đủ vòng đời trên dev. Chi tiết HISTORY.md R19.

### [x] 🟠 RETURNS-GUARD-01 — Chặn trả trùng/quá số lượng xuyên luồng *(fix xong 2026-07-04, ✅ ĐÃ DEPLOY 2026-07-04)*

> Migration `025` persist `original_order_id`/`return_fee`/`return_other_refund` (trước chỉ sống trong RAM). `src/lib/returnGuards.ts` mới + `usePOSReturnFlow` trừ số đã trả vào `maxQuantity`, đơn trả đủ → chặn mở tab. Verify live: trả đủ 1/1 → mở lần 2 bị chặn đúng thông báo. Chi tiết HISTORY.md R19.

### [x] 🟠 ORDERS-DEL-02 — Soft-delete xóa đơn + đảo thống kê khách hàng *(fix xong 2026-07-04, ✅ ĐÃ DEPLOY 2026-07-04)*

> Xóa đơn giờ chuyển `status='cancelled'` (xem lại được qua lọc "Đã hủy" ở trang Hóa đơn, khôi phục được về sau) thay vì DELETE; bổ sung đảo `totalSpent`/điểm/`debtAmount` khách (trước bỏ sót → nợ "ảo"). Lọc tập trung `activeData` tại MainContent + backend/AI/agent loại đơn cancelled. Sửa đơn cũng đảo đúng khách khi đổi/bỏ khách (`revertedCustomer`). Fix rollback `updateSurgical` lưu snapshot đầy đủ (hết phá dữ liệu khi lỗi giữa batch). Verify live đủ vòng đời. Chi tiết HISTORY.md R19.

### [x] 🟠 DATA-CLEANUP-01 — Đối soát dữ liệu cũ sau deploy 2026-07-04 *(xong 2026-07-04 trên prod, trừ DATA-04 chờ user)*

> **Kết quả trên prod (deploy Giai đoạn 1 xong)**:
> 1. ✅ **Recalc revenue T6/2026 xong** qua endpoint canonical (gọi trên iMac bằng `INTERNAL_API_KEY`, key không lộ). Drift về **0 tuyệt đối**: gross/returns/net khớp 100% pos_orders (net 238.009.000 → **238.354.000**, returns 570.000 → **4.535.000**). T7 rỗng (prod dữ liệu thật đến 2026-06-25, không có đơn tháng 7 → bỏ qua).
> 2. ✅ **Không cần recalc sales_records**: prod CHỈ có phiếu trả import KiotViet (2009 cái), **0 phiếu trả POS native** → POS-RETURN-01 chưa từng kích hoạt trên prod (fix không đổi hành vi đơn import). Doanh số NV không bị ảnh hưởng.
> 3. ✅ **Không có tồn kho hỏng**: 0 `inventory_transactions` type Return trên prod → nút trả hàng/hủy cũ ở trang Trả hàng chưa từng dùng thật. Các fix RETURNS-* là phòng ngừa (cửa hàng chưa dùng luồng trả hàng trong app).
> 4. ⏳ **DATA-04 — CHỜ USER QUYẾT ĐỊNH**: 3 dòng ngày rác trong `revenue_records` (created 2026-06-06, `total_gross_revenue=0` nhưng `net_revenue>0` — mâu thuẫn, rác từ bug import cũ), tổng net **109.933.000** lọt vào tổng all-time:
>    - `77063-10-04` → net 27.453.000 (id `e69c5c67-e1c1-4ffe-b5b0-c95390c0bb34`)
>    - `92401-07-06` → net 33.031.000 (id `24a63f64-e6f5-4df5-a352-8d6d45f84f0b`)
>    - `137519-06-26` → net 49.449.000 (id `6356bd21-90b8-4ea4-8b87-13ebfbd381e3`)
>    - Gross=0 nên gần như chắc chắn nên **XÓA** (không phải doanh thu thật). User xác nhận xóa hoặc cho ngày đúng để sửa.

### [x] 🟡 TXN-RPC-01 — Giai đoạn 2: gộp xóa/hủy trả/sửa đơn + checkout web thành RPC 1 transaction — HOÀN TẤT + ĐÃ DEPLOY 2026-07-04

> Giai đoạn 2 của lộ trình A→B: thay ruột các hàm service (`deletePosOrder`, `processCancelReturn`, `editPosOrder`, `processPlaceOrder`) từ chuỗi nhiều lời gọi mạng thành 1 RPC transaction DB theo mẫu `pos_mobile_checkout` — đóng nốt cửa sổ lệch khi rớt mạng giữa chừng. Gộp chung với DATA-01. UI/props không phải sửa lại (Giai đoạn 1 đã dồn mọi nút về service layer).
>
> **✅ Luồng xóa đơn (`deletePosOrder`) xong**: wire RPC `delete_pos_order_tx()` qua endpoint mới `POST /api/data/pos-orders/delete-tx` ([routes/data.ts](../../routes/data.ts)) + `apiService.deletePosOrderTx()`. `deletePosOrder()` giờ gọi 1 RPC rồi đồng bộ lại state local (không gọi mạng) qua 2 hàm mới trong `useAppData.ts`: `applyLocalOnly()` (dispatch+cache, tái dùng cho update generic) và `applyRevenueDeltaLocal()` (merge delta local, không gọi RPC `apply_revenue_delta`). Quyết định kỹ thuật: **recompute delta ở client** (không refetch) vì công thức JS (`buildRevenueDelta`/`calculateOrderCogs`) đã khớp 100% với SQL trong RPC — verify từng dòng trước khi chọn hướng này.
>
> **🐛 2 bug phát hiện trong migration 026 khi wire lần đầu** (function tạo sẵn từ trước nhưng chưa ai gọi nên chưa lộ): (1) so sánh `inventory_transactions.reference_id` (TEXT) với `p_order_id` (UUID) thiếu cast → `operator does not exist: text = uuid`; (2) `RETURNS TABLE(order_id UUID)` tạo biến ngầm `order_id` trùng tên cột `customer_debt_history.order_id` → `column reference "order_id" is ambiguous`. Đã sửa cả 2 (cast `::TEXT` + qualify tên bảng), áp lại (`CREATE OR REPLACE`) lên cả dev và prod — an toàn vì chưa từng có code nào gọi hàm này trước đây.
>
> +3 unit test cho `deletePosOrder` (happy path so khớp delta, guard đã hủy, guard đơn trả). Verify live trên dev: bán SP012439 (tồn 5→4) → xóa qua RPC → tồn về 5, tx đánh dấu cancelled, revenue_records đảo đúng delta (khớp DB tuyệt đối sau khi bấm "Tải lại dữ liệu"), state local (React+IndexedDB) khớp DB không cần refetch (trừ 1 khoảng ngắn optimistic UI lệch do cache local vốn thiếu baseline ngày đó từ trước — tự lành sau reload, không phải bug mới).
>
> **✅ Luồng hủy phiếu trả (`processCancelReturn`) xong 2026-07-04**: migration `027_cancel_pos_return_tx.sql` — RPC `cancel_pos_return_tx()` gộp đảo tồn kho (theo tx.type: Return→trừ lại, Sale/đổi→cộng lại) + đảo doanh thu + khôi phục điểm/chi tiêu khách + soft-delete phiếu vào 1 transaction. Wire qua endpoint `POST /api/data/pos-orders/cancel-return-tx` + `apiService.cancelPosReturnTx()` + `useAppData.cancelPosReturnTx()`. Không có bug lần này (rút kinh nghiệm từ 026 — verify kỹ tên/kiểu cột trước khi viết SQL, test trực tiếp bằng SQL trước khi wire code). sales_records vẫn tính lại qua `updateSurgical` thật (ngoài RPC, giữ nguyên `recalcSalesRecordsForDate`). +3 unit test. Verify live trên dev: bán 2 → trả 1 (tồn 5→3→4) → hủy phiếu trả qua RPC → tồn về 3 (khớp thực tế), revenue_records đảo đúng delta tuyệt đối (gross 130k không đổi, returnsValue 65k→0, net 65k→130k, cogs 38k→76k, profit 27k→54k), tx đánh dấu cancelled.
>
> **✅ Luồng sửa đơn (`editPosOrder`) xong 2026-07-04**: migration `028_edit_pos_order_tx.sql` — RPC `edit_pos_order_tx()` gộp hoàn/áp tồn kho theo delta (SL cũ − SL mới) + xóa/ghi nợ + ghi đè đơn + đảo doanh thu ròng thành 1 transaction, **kèm guard ORDERS-EDIT-02 viết lại bằng SQL độc lập** (không chỉ tin JS) — chặn sửa SL thấp hơn SL đã trả bằng 2 nguồn (phiếu TH liên kết + inventory_transactions type='Return' cũ). Quyết định phạm vi (đã hỏi user, chọn theo "Recommended"/"chắc" tương ứng): điểm/hạng khách hàng (`computeNewTier()` đọc cấu hình localStorage) và `sales_records` **giữ ngoài RPC**, vẫn 2 lời gọi mạng thật riêng qua `updateSurgical` sau khi RPC xong. Wire qua endpoint `POST /api/data/pos-orders/edit-tx` + `apiService.editPosOrderTx()` + `useAppData.editPosOrderTx()`. **2 bug phát hiện khi viết SQL** (cùng dạng bug đã gặp ở 026/028): (1) alias `item` trong 1 subquery trùng tên biến PL/pgSQL `item JSONB` → đổi alias thành `it`; (2) `DELETE ... WHERE order_id = p_order_id` mơ hồ do biến ngầm từ `RETURNS TABLE(order_id UUID)` → qualify `customer_debt_history.order_id`. Cả 2 sửa xong, verify bằng 3 kịch bản SQL tay (`BEGIN...ROLLBACK`) trước khi wire code: tăng SL, chặn giảm SL dưới mức đã trả, giảm đúng bằng mức đã trả kèm đổi khách/nợ — khớp tuyệt đối. +3 unit test (happy path so khớp delta merge, guard đơn trả/đã hủy) + giữ 2 test guard ORDERS-EDIT-02 cũ. Verify live trên dev: bán SP011545 (tồn 7→6) → sửa SL 1→3 qua RPC → tồn về 4, `total_amount`/`final_amount` đúng 390.000, `revenue_records` cộng dồn đúng công thức (gross+260.000, cogs+152.000, profit+40.000), inventory_transactions cũ bị xóa hẳn thay tx mới (khác xóa/hủy trả — sửa đơn KHÔNG đánh dấu cancelled mà ghi đè thật), UI hiển thị đúng SL/thành tiền sau khi lưu.
>
> **⚠️ Phát hiện ngoài phạm vi khi verify** (không thuộc TXN-RPC-01, không sửa trong phiên này): nút "Hủy" nhanh trong danh sách Hóa đơn (`OrderInvoices.tsx`) chỉ `POST /api/data/upsert` đổi `status='cancelled'` trực tiếp — **không** gọi qua `deletePosOrderTx`/RPC, nên không hoàn tồn kho lẫn không đảo doanh thu. Khác với luồng xóa đã convert RPC (nút riêng, có thể ở menu khác). Cần rà lại xem 2 luồng "hủy" nào đang trỏ tới hành động nào — có rủi ro dữ liệu lệch nếu người dùng bấm nhầm nút.
>
> **✅ Luồng tạo đơn (`processPlaceOrder`) xong 2026-07-04 — TXN-RPC-01 HOÀN TẤT**: migration `029_place_pos_order_tx.sql` — RPC `place_pos_order_tx()` gộp insert order + ghi inventory transaction & trừ tồn kho + ghi nợ (nếu bán nợ) + cộng dồn doanh thu atomic vào 1 transaction, mô phỏng theo `pos_mobile_checkout` (019, dành riêng cho POS mobile — không sửa, không dùng chung vì ràng buộc khác: staff cố định, tier tính cứng). **1 bug phát hiện khi viết SQL** (cùng dạng đã gặp 3 lần): khai báo biến PL/pgSQL `it JSONB` trùng tên alias `it` trong subquery `jsonb_array_elements(...) it` → bỏ khai báo biến thừa (không dùng làm loop var, chỉ cần làm alias). Verify bằng 3 kịch bản SQL tay (`BEGIN...ROLLBACK`): bán thường (khớp tay), chặn bán vượt tồn kho (raise đúng exception), bán nợ có khách hàng liên kết (ghi đúng customer_debt_history). Phạm vi (nhất quán với `editPosOrder`): điểm/hạng khách hàng và `sales_records` giữ ngoài RPC, vẫn `updateSurgical` mạng thật riêng. Wire qua `POST /api/data/pos-orders/place-tx` + `apiService.placePosOrderTx()` + `useAppData.placePosOrderTx()`. +3 unit test viết lại (RPC happy-path, guard tồn kho không gọi RPC, allowSellOutOfStock). 981/981 test pass, tsc sạch. Verify live trên dev: bán SP011546 (tồn 6→5) qua RPC → order/inventory tx/revenue_records khớp tuyệt đối theo SQL, UI hiển thị đúng hóa đơn. Dọn dữ liệu test bằng SQL (không dùng nút "Hủy" — xem phát hiện ngoài phạm vi bên dưới).
>
> **TXN-RPC-01 đã hoàn tất cả 4 luồng**: xóa đơn, hủy phiếu trả, sửa đơn, tạo đơn — đều chạy qua RPC 1 transaction DB, không còn rollback thủ công nhiều bước phía client.

### [x] 🔴 SEC-SECRET-01 — service_role JWT project cũ `tqouzxlnihfjdyxqlbqs` lộ trong GIT HISTORY *(✅ key đã vô hiệu hóa 2026-07-03 — ĐÃ QUYẾT ĐỊNH bỏ qua scrub git history 2026-07-04)*

> **Severity: 🔴 XÁC NHẬN CAO HƠN ban đầu tưởng**: commit rò rỉ `66ecc7a` **đã push lên GitHub** (`origin/main` chứa nó — không chỉ nằm local như audit R3 nghi ngờ) **VÀ có mặt ở cả 5 branch remote khác** (`claude/category-tree-accordion-*`, `claude/code-review-feedback-*`, `claude/pos-ui-design-system-audit-*`, `claude/review-remaining-tasks-*`, `claude/sales-app-logic-audit-*`). Repo: `github.com/ngothanhdus2np/QU-N-TR-C-A-H-NG` — chưa xác định public/private (không có `gh` CLI trong môi trường agent để kiểm, user tự xem trên GitHub Settings).
>
> **Đã trích xuất + xác nhận trong git history** (JWT decode, không phải suy đoán): service_role key thật cho project `tqouzxlnihfjdyxqlbqs`, `exp: 2085703971` (~năm 2036), payload `role: service_role` — bypass TOÀN BỘ RLS nếu project còn sống.
>
> **✅ ĐÃ DỌN 2026-07-03**: gỡ sạch ref `tqouzxlnihfjdyxqlbqs` khỏi `.kiro/DEPLOY_NOW.md` + `.kiro/QUICK_START.md` (HEAD hiện tại không còn ref/URL nào trỏ tới project cũ). Chỉ dọn HEAD — **KHÔNG động vào git history** (xem việc còn lại #2).
>
> **✅ ĐÃ RESET/VÔ HIỆU HÓA KEY 2026-07-03**: user xác nhận đúng project ref `tqouzxlnihfjdyxqlbqs` trên dashboard, bấm **"Disable JWT-based API keys"** (Settings → API Keys → Legacy anon, service_role API keys) — vô hiệu hóa vĩnh viễn cả `anon` lẫn `service_role` cũ, kể cả key đã lộ trong git history. **Đây là bước có tác dụng thật** — key trong git history giờ vô dụng bất kể history còn hay sạch.
>
> **✅ QUYẾT ĐỊNH 2026-07-04 — KHÔNG scrub git history**: đã hỏi lại user có muốn scrub git history + force-push 6 branch (`main` + 5 branch `claude/*`) bằng `git filter-repo`/BFG hay không — user chọn **"Không làm"** vì thao tác lớn, khó đảo ngược, ảnh hưởng toàn bộ repo GitHub kể cả collaborator khác đang có clone cũ (phải re-clone/hard-reset), trong khi key đã chết nên đánh đổi không xứng đáng với lợi ích vệ sinh thuần túy. Coi như đã đóng — chỉ mở lại nếu phát sinh lý do mới (vd audit bên ngoài yêu cầu, hoặc tạo repo mới thay vì scrub repo cũ).

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
> 2. ~~`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ... REVOKE ALL ON TABLES FROM anon`~~ — **trùng với mục 1c ở trên, đã xong từ 2026-07-03**. Xác nhận lại 2026-07-04 bằng `pg_default_acl` trực tiếp trên prod: `defaclobjtype` `r` (bảng) và `S` (sequence) dưới grantor `supabase_admin` đều chỉ còn `{postgres, authenticated, service_role}` — không có `anon`. Không cần làm gì thêm.

### [x] 🔴 POS-SALES-01 — Ghi doanh số NV lỗi mọi đơn → hiện lỗi giả "mất đồng bộ", nguy cơ đơn trùng *(fix xong 2026-07-02 khuya, ✅ VÁ + XÁC NHẬN LIVE 2026-07-03, ✅ ĐÃ DEPLOY — xác nhận lại 2026-07-04: migration 021 đã đăng ký trên prod, `sales_records.id` = TEXT)*

> **ĐÃ SỬA** bằng migration `021_fix_sales_records_schema.sql`: `sales_records.id` UUID→TEXT + gỡ FK `employee_id` (khớp `pos_orders.staff_id` vốn text tự do). Chọn cách này thay vì randomUUID vì code đã thiết kế id chuỗi tất định `pos-sales-<date>-<emp>` (idempotent upsert theo ngày+NV) VÀ người bán có thể ngoài roster nhân viên (admin/chủ) — đổi randomUUID vẫn vướng FK. Verify browser: bán 1 đơn → `sales_records` ghi OK, console sạch, hết lỗi giả.

### [x] 🟡 INV-RPC-01 — Schema drift RPC tồn kho (`_v2` thiếu + legacy thiếu nhánh Sale/Return) *(fix xong 2026-07-02 khuya, ✅ ĐÃ DEPLOY — xác nhận lại 2026-07-04: migration 022 đã đăng ký trên prod)*

> **ĐÃ SỬA** bằng migration `022_apply_inventory_rpc_v2.sql` (= nội dung 013): áp `apply/delete_inventory_transaction_with_stock_v2` lên DB. Nay mọi đơn dùng RPC atomic 1-transaction đủ nhánh Sale/Return (thay fallback nhiều-bước) → giải luôn 🟡 fallback không atomic. Legacy thiếu nhánh hết là landmine (Sale/Return không còn chạm legacy). Verify RPC: bán 5 khi tồn 1 → EXCEPTION, tồn giữ 1. Ghi chú: đây cũng là phần chính của task "Đồng bộ schema production với migrations".

### [x] 🟡 IMPORT-01 — Import Excel không validate từng dòng, 1 dòng lỗi hỏng cả chunk *(fix xong 2026-07-02 khuya, ✅ ĐÃ DEPLOY — code backend, đi qua nhiều lần deploy kể từ đó)*

> **ĐÃ SỬA** [routes/import.ts](../../routes/import.ts): vệ sinh field số NaN→0 trước khi build parent + khi batch upsert lỗi → retry từng dòng để cô lập dòng hỏng (dòng đúng vẫn ghi), trả `rowErrors[]` chi tiết. tsc sạch, 318 test pass.

### [x] 🟡 SEC-ANON-01 — Đóng lỗ anon truy cập bảng storefront/misc (RLS off) *(fix xong 2026-07-02 khuya, ✅ ĐÃ DEPLOY — xác nhận lại 2026-07-04: migration 023 đã đăng ký trên prod)*

> **ĐÃ SỬA** bằng migration `023_revoke_anon_storefront_tables.sql`: REVOKE ALL FROM anon + bật RLS + policy authenticated cho 7 bảng RLS-off (`expense_categories`, `shipments`, `store_collections`, `store_order_addresses`, `store_preorder_requests`, `store_product_collections`, `store_settings`). App không đọc các bảng này qua anon (đã kiểm), storefront dùng service-role bypass RLS → không phá luồng nào. Cũng là bước xử lý gốc rễ MAINT-01 (bảng mới tự nhận grant anon).

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

### [x] Vá lỗ hổng Auth Bypass + Privilege Escalation trên LAN *(phát hiện + kiểm chứng 2026-06-30, HOÀN TẤT + ĐÃ DEPLOY 2026-07-04)*

> **Severity: HIGH → đã hạ rủi ro (kiểm chứng thật trên prod)**. Xem `docs/06-evaluation/PRODUCTION_AUDIT_2026-06-30.md`.
>
> **Lớp 1 — ✅ ĐÃ ĐÓNG**: `NODE_ENV=production` xác nhận trong tiến trình live `com.cfobrain.app` (set qua launchd plist) → `IS_PROD=true` → dev-bypass tắt, rate-limit bật.
>
> **Lớp 2 — ✅ ĐÃ VÁ 2026-07-04**: gỡ hẳn nhánh bypass dựa vào IP nguồn thuộc LAN (`isPrivateLanAddress`/`isTrustedDevBrowserRequest` trong `requireAuth`, `server.ts`) thay vì chỉ tắt bằng `!IS_PROD` — trước khi xóa đã xác minh không có caller nội bộ nào phụ thuộc nó (frontend luôn đính JWT thật qua session Supabase). Giữ `INTERNAL_API_KEY` header cho caller nội bộ không có JWT (cơ chế đã có sẵn). Verify: tsc sạch, restart server, toàn bộ API call vẫn 200 OK sau đăng nhập thật, không phát sinh 401 mới trên log prod.
>
> **Việc CÒN LẠI:**
> 1. ~~Thêm `NODE_ENV=production` vào `.env.local` trên iMac~~ ✅ **xong 2026-07-02** (qua ssh, cùng đợt deploy).
> 2. ~~Vá `auth.ts:21`~~ ✅ **xong 2026-06-30** — đổi `return { role: 'owner', userId: 'dev-user' }` → `return null` (defense-in-depth).
> 3. ~~Dài hạn: thay LAN IP bypass bằng `INTERNAL_API_KEY` header~~ ✅ **xong 2026-07-04**.

---

### [x] Vá SEC-01 — Path traversal xóa file tùy ý *(xong 2026-06-30, ✅ ĐÃ DEPLOY 2026-07-02)*

> `DELETE /api/upload-product-image` (`server.ts`): thêm `path.resolve(productsRoot, rel)` + `startsWith(productsRoot+sep)` chặn `../` thoát thư mục. Proof: `../`/absolute đều BLOCK, path hợp lệ ALLOW; tsc sạch; route mount 401≠404.

### [x] P1 DATA-02 — Atomic revenue increment (diệt race mất doanh thu) *(xong 2026-06-30, ✅ ĐÃ DEPLOY 2026-07-02)*

> Web POS ghi doanh thu bằng **delta cộng dồn atomic** (RPC `apply_revenue_delta`, migration 020 — ĐÃ chạy prod, constraint `UNIQUE(date)` xác nhận khớp) thay vì read-modify-write ghi đè cả dòng. Áp dụng cả bán & trả/đổi. Giữ offline-first (queue opType `revenueDelta`). 318 test pass. DATA-01 (full transaction checkout) hoãn P2 theo quyết định phân pha.
>
> ⚠️ **ĐÍNH CHÍNH bước hậu-deploy**: đã chạy `recalculate-revenue-from-orders` cho T6/T7 nhưng audit chiều 02/07 phát hiện **endpoint này có bug** (xem task LOGIC-02 bên dưới) — nó ghi tổng CẢ THÁNG vào 1 dòng ngày cuối tháng, làm T6 bị đếm đôi. **Đã khôi phục sạch** (xóa 2 dòng 30/06 + 31/07 do lần chạy tạo, xác minh bằng created_at). KHÔNG chạy lại endpoint này cho đến khi sửa LOGIC-02.

### [x] 🔴 LOGIC-02 — Endpoint `recalculate-revenue-from-orders` sai mô hình dữ liệu *(fix xong 2026-07-02 khuya, ✅ ĐÃ DEPLOY — code backend, đi qua nhiều lần deploy kể từ đó)*

> **ĐÃ SỬA** [routes/data.ts](../../routes/data.ts): viết lại group by NGÀY, upsert từng ngày `onConflict(date)` theo công thức `calcOrderRevenue` (khớp `reportCalculations.ts`) + thêm `revenue_other` từ final_amount; giữ nguyên total_cogs/gross_profit (recalculate-cogs lo riêng). Hết bug dồn cả tháng vào 1 dòng cuối tháng. Verify: recalc 2026-07 → ghi đúng dòng ngày 2026-07-02, không tạo dòng 07-31.
>
> 💡 Endpoint này nay AN TOÀN để chạy lại → dùng để dọn drift T6 (~4,88M lệch giữa orders vs revenue_records) và có thể hỗ trợ đối soát DATA-04 (đã xử lý riêng, xem bên dưới) — nếu vẫn còn drift T6 chưa dọn thì đây là task còn treo, cần user xác nhận trước khi chạy vì ghi đè `revenue_records`.

### [x] 🟠 DATA-04 — 3 dòng ngày rác trong `revenue_records` *(phát hiện audit 2026-07-02, xóa xong trên prod 2026-07-04)*

> 3 dòng có `date` hỏng: `92401-07-06`, `77063-10-04`, `137519-06-26` (created_at 2026-06-06, từ bug import cũ) — tổng **net 109.933.000đ** đang nằm ngoài mọi báo cáo theo range chuẩn nhưng có thể lọt vào tổng all-time.
>
> ✅ **Audit R3 (2026-07-03) tái hiện chính xác trên clone**: 3 dòng net 49.449.000 + 33.031.000 + 27.453.000 = **109.933.000**; tổng net all-time = 15.042.976.804 vs trong-range (2020..2027) = 14.933.043.804 → lệch **đúng 109,933M lọt vào all-time**.
>
> ✅ **Đã xử lý 2026-07-04**: xác nhận lại y hệt trên production qua SQL trực tiếp (giá trị khớp 100% với audit R3), user chọn phương án **xóa** (gross=0 + date rác → gần chắc chắn không phải doanh thu thật). Đã `DELETE` cả 3 dòng trên prod kèm `audit_logs` ghi lý do trước khi xóa.

### [x] 🟡 SEC-RATELIMIT-01 — Login `/auth/v1` không rate-limit ở tầng app *(phát hiện audit R3 2026-07-03, ✅ HOÀN TẤT + ĐÃ DEPLOY 2026-07-04)*

> `apiLimiter` mount `/api/`, `authLimiter` (20/15ph) CHỈ mount `/api/auth/register`. Proxy Supabase `/auth/v1`+`/rest/v1`+`/storage/v1` không qua limiter nào → đường login thật GoTrue `/auth/v1/token` không bị app chặn brute-force (chỉ dựa giới hạn nội bộ GoTrue).
>
> **✅ ĐÃ SỬA**: thêm `app.use('/auth/v1/token', authLimiter)` trong `server.ts` — dùng lại `authLimiter` có sẵn (20 req/15 phút/IP, chỉ áp khi `IS_PROD`), mount trước proxy để chặn sớm. Verify: tsc sạch, health 200, `POST /auth/v1/token` qua domain public vẫn phản hồi đúng `401` cho sai mật khẩu (không phải 500/502).

### [x] 🟡 DATA-01 — Checkout web POS chưa gói vào 1 transaction DB (saga bù trừ) *(P2 — audit R3 ghi rõ rủi ro; GIẢI QUYẾT bởi TXN-RPC-01, ✅ ĐÃ DEPLOY 2026-07-04)*

> `processPlaceOrder` từng ghi đơn qua 4–5 lời gọi riêng (insert order → RPC tồn kho → customer/nợ → RPC revenue → staff/audit), nối bằng rollback bù trừ tầng app (`rollbackSteps[]`) — tự nó là chuỗi network call có thể tự fail → cửa sổ lệch. Đã gộp toàn bộ vào RPC `place_pos_order_tx` (migration 029, xem TXN-RPC-01 phía trên) — không còn rollback thủ công, insert order + trừ tồn kho + ghi nợ + cộng doanh thu chạy atomic trong 1 transaction DB. Đã deploy + verify live.

---

### [x] Fix lỗi ngẫu nhiên "1 trang báo lỗi" *(xong 2026-06-27)*

> 2 nguyên nhân: ChunkLoadError sau deploy + `.items` không null-guard trên cache cũ. ErrorBoundary tự reload khi lỗi chunk; vá 5 chỗ `.items` còn sót. Xem HISTORY.md.

### [x] Vá lỗ hổng API POS Mobile mở công khai *(xong 2026-06-27)*

> `routes/posMobile.ts` mount không `requireAuth`, 3 endpoint public dùng service role → đã thêm token `POS_MOBILE_TOKEN` (header `x-pos-mobile-token` / `?t=`), bỏ `import_price` khỏi response. Verify đầy đủ. Xem HISTORY.md.

### [x] Làm cứng checkout POS Mobile — transaction + atomic revenue *(xong 2026-06-27)*

> Gói toàn bộ checkout vào RPC `pos_mobile_checkout` (1 transaction DB): insert đơn + trừ tồn inline atomic + cộng dồn revenue atomic + KH/nợ + audit. Verify trên prod (rollback test). Xem HISTORY.md.

### [x] Đồng bộ schema production với migrations *(phát hiện khi làm #2 — 2026-06-27; vá 1 phần 2026-07-02; rà soát lại & đóng 2026-07-04)*

> Production self-hosted (iMac, container `supabase-db`) **chưa chạy** một số migration: RPC `*_v2` (013) và cột `branch_id`/constraint `(date,branch_id)` của `revenue_records`. Hệ thống vẫn chạy nhờ fallback legacy, nhưng `supabase_setup.sql`/migrations đang **lệch** với DB thật. Nên rà soát & chạy bù các migration còn thiếu (hoặc cập nhật setup cho khớp) để tránh bẫy cho lần sau.
>
> **2026-07-02 đã vá phần store module trên prod DB**: migration 017 (shipments cols + `upsert_website_shipment` + `update_website_order_status` 3 tham số), 4 cột `pos_orders` (`shipping_fee`/`note`/`customer_phone`/`customer_email`), `create_store_order` bản canonical. ⚠️ Phát hiện: 3 cột `pos_orders` (note/customer_phone/customer_email) không nằm trong migration nào — cần bổ sung vào `supabase_setup.sql`/migration mới. Migration 014 chứa bản CŨ `update_website_order_status(UUID,TEXT)` — KHÔNG chạy nguyên file, sẽ tạo overload trùng.
>
> **✅ Rà soát lại 2026-07-04 — ĐÓNG, không cần hành động thêm**: query trực tiếp `information_schema`/`pg_proc` trên prod xác nhận 2/3 mục đã tự hết: RPC `apply_inventory_transaction_with_stock_v2` + `delete_inventory_transaction_with_stock_v2` **đã tồn tại**; cột `pos_orders.note`/`customer_phone`/`customer_email` **đã tồn tại** (từ đợt vá 07-02). Mục còn lại — `revenue_records.branch_id` + constraint `(date, branch_id)` — **cố ý không thêm**: migration `020_atomic_revenue_delta.sql` (dòng 14-16) đã chủ động chuyển toàn bộ `ON CONFLICT` sang khớp constraint thật trên prod là `UNIQUE(date)` (không kèm branch_id), và mọi RPC atomic sau này (026-030) đều theo đúng pattern đó. App hiện chỉ vận hành 1 chi nhánh (`branch_id` mặc định `'main'` ở các bảng khác không có tính năng multi-branch nào dùng tới) — thêm cột/constraint này bây giờ không phục vụ gì, chỉ là rủi ro thừa. Giữ nguyên hiện trạng.

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
