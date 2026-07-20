# Audit Production-Readiness toàn diện — CFO Brain 4.0

> **Ngày**: 2026-07-19
> **Branch**: `feat/online-audit-shopee` · **HEAD lúc bắt đầu**: `152a256`
> **Bối cảnh**: Audit QA production-readiness theo yêu cầu (vai trò Senior QA / Production Readiness Auditor).
> Trọng tâm theo `EVALUATION_WORKFLOW.md`: soi kỹ **delta chưa commit** (task IMPORT-02 — import Excel hàng hóa) + kiểm chứng lại lõi bằng code/SQL thật, không tin báo cáo cũ.
> **Phương pháp kiểm chứng thật**: `npm test` (1039→**1045** pass sau fix), `tsc --noEmit` sạch, `npm run build` OK, đọc SQL RPC giao dịch trực tiếp, trace mã import qua CodeGraph.
> **Giới hạn môi trường**: sandbox không chạy được luồng CRUD thật trên browser (Supabase self-host ở iMac/localhost:8000 không có trong sandbox; không được ghi dữ liệu test vào DB thật). Các phần đó ghi rõ **NOT VERIFIED**.

---

## 0. KẾT LUẬN TỔNG THỂ

**Lõi POS (tiền/kho/quyền/giao dịch RPC atomic) vững — kiểm chứng bằng SQL thật, không hồi quy.** Mọi fix bảo mật R55/R56 của audit trước đã commit vào HEAD.

Phát hiện lần này tập trung ở **delta chưa commit — tính năng import Excel hàng hóa (IMPORT-02)**:
- 🟡 **P2-1 (LỖI MỚI)**: nhánh import client ghi đè tồn kho DB bằng giá trị tồn kho cũ trong bộ nhớ → **ĐÃ FIX trong phiên**.
- 🟡 **P2-2**: nhánh import server (giữ tồn kho) không có test tầng HTTP → **ĐÃ FIX** (thêm `routes/importProducts.test.ts`).
- 🟢 P3/P4 nhỏ → xử lý/ghi chú.
- 🔴 **Blocker duy nhất còn lại: backup tự động** (AUDIT-0710-B) — user chốt làm sau.

**Mức độ**: Dùng thật nội bộ ĐƯỢC (đang dùng). Chưa nên làm sổ sách tài chính duy nhất cho tới khi có backup tự động.

---

## 1. Nghiệp vụ cốt lõi — 🟢 ĐẠT (kiểm chứng SQL trực tiếp)

| Mục | Trạng thái | Bằng chứng |
|---|---|---|
| Chống bán âm kho (oversell) | ✅ Đạt, atomic | `029_place_pos_order_tx.sql:68-73`: `UPDATE ... WHERE stock - qty >= 0` + `IF NOT FOUND RAISE` — check+trừ trong 1 câu lệnh, khóa dòng Postgres chống race/double-deduct |
| Doanh thu cộng dồn atomic | ✅ Đạt | `029:152-158` `ON CONFLICT (date) DO UPDATE SET x = x + EXCLUDED` — 2 máy bán cùng ngày không mất doanh thu |
| Idempotency chống double-submit | ✅ Đạt | `029:42-44` `IF EXISTS ... RAISE ORDER_ALREADY_EXISTS` (cùng order id). *Lưu ý:* 2 submit id KHÁC nhau vẫn dựa vào disable nút client |
| POS mobile checkout | ✅ Đạt | `019_pos_mobile_checkout.sql` — RPC 1 transaction, guard Insufficient stock |
| Công thức lợi nhuận Shopee 1 nguồn | ✅ Đạt | `src/lib/shopeeProfit.ts` `calcShopeeNetProfit` dùng ở cả 5 đường ghi client + backend job `adsSpendSync.ts:60` |

---

## 2. Delta IMPORT-02 (import Excel hàng hóa) — 🟡 1 LỖI MỚI, ĐÃ FIX

### Hai đường import
1. **Nhánh server** `/api/import/kiotviet-products` (file KiotViet): resolve id theo SKU (`skuToId`), **cập nhật sản phẩm cũ có `delete rest.stock`** → giữ tồn kho DB đúng. ✅
2. **Nhánh client** `planExcelImport` (file định dạng chuẩn — dùng khi Xuất Excel rồi Import lại): khớp SKU trong bộ nhớ, giữ id.

### 🟡 P2-1 — Nhánh client ghi đè tồn kho DB bằng giá trị bộ nhớ *(ĐÃ FIX)*
- **Cơ chế**: `toUpdate` = object sản phẩm đầy đủ kèm `stock` từ bộ nhớ (`useGoodsExcelImport.ts`) → `onPushBatch` → `apiService.upsertMany` → `sanitizeItem` **luôn ghi `stock`** (`apiService.ts:58`) → ghi đè tồn kho DB.
- **Hậu quả**: nếu tồn kho đổi ở kênh khác (POS mobile, bot Shopee sync 10p, đơn website) giữa lúc mở trang và lúc import → import **revert tồn kho về số cũ**, âm thầm. Cửa sổ lệch = toàn bộ thời gian tab mở.
- **Đã FIX (3 thay đổi tương thích ngược)**:
  1. `apiService.ts` `sanitizeItem('posProducts')`: bỏ cột `stock` khỏi payload khi `item.stock === undefined` (giống pattern `posCustomers.is_starred`). Caller cũ luôn gửi số → không đổi hành vi.
  2. `hooks/useAppData.ts` `pushBatch`: merge field-level (`{...prev, ...item}`) thay vì thay thế → object partial giữ field local không gửi. Object đầy đủ vẫn ghi đè toàn bộ như cũ.
  3. `components/pos/useGoodsExcelImport.ts`: thêm `stripStockForUpdate()` bỏ `stock` khỏi payload update trước khi push → server giữ tồn kho DB (khớp đúng nhánh server). Sản phẩm MỚI vẫn giữ `stock` từ file.

### 🟡 P2-2 — Nhánh server IMPORT-02 không có test *(ĐÃ FIX)*
- Thêm `routes/importProducts.test.ts` (4 test, express listen + fetch, mock Supabase): 401 khi không auth; **sản phẩm cũ giữ tồn kho — payload không có cột `stock`**, sản phẩm mới nhận `stock` từ file; created=1/updated=1; không ghi đè `created_at`; file sai định dạng → 400.

### 🟢 P3 — Bất đối xứng semantics 2 nhánh *(ghi chú, giữ nguyên)*
Nhánh KiotViet re-import ghi đè MỌI cột danh mục (trừ stock) bằng giá trị file — **đúng thiết kế** cho re-import cả danh mục từ nguồn KiotViet có thẩm quyền. Nhánh client chỉ đè 5 cột. Không đổi (thay đổi sẽ phá đúng mục đích KiotViet), đã có comment trong code.

### 🟢 P4 — created_at bị null khi bulk upsert *(ĐÃ FIX)* + chunk-size *(hoãn)*
- `routes/import.ts`: khi cập nhật sản phẩm cũ, thêm `delete rest.created_at` → giữ ngày tạo gốc + tránh `defaultToNull` set NULL. **ĐÃ FIX.**
- Build cảnh báo chunk >500KB: bundle đã tách sẵn (`vendor-charts/pdf/supabase`), cảnh báo lành tính, không ảnh hưởng chức năng → **hoãn** (cần profiling, không sửa liều).

---

## 3. Bảo mật — 🟢 ĐẠT (fix R55/R56 đã commit trong HEAD)

| Mục | Bằng chứng (đã verify trong HEAD `152a256`) |
|---|---|
| Rate-limit storefront public | `store.ts:101-103` orderLimiter/preorderLimiter/lookupLimiter gắn 3 route |
| verify-manager → authLimiter | `server.ts:462` |
| RLS 2 bảng Ads | `supabase_migrations/034_lock_anon_shopee_ads_tables.sql` |
| Guard notify-logout | `channelManagement.ts:332-335` INTERNAL_API_KEY + socket.remoteAddress |
| requireAuth + JWT thật | verify qua `supabase.auth.getUser()` |
| Validate backend + DB CHECK | `data.ts validateDataPayload` + migration `036` (giá âm bị chặn cả tầng app lẫn DB) |

**Lưu ý**: nhánh import (`routes/import.ts`) upsert TRỰC TIẾP, không qua `validateDataPayload` — nhưng giá âm vẫn bị chặn bởi CHECK constraint 036 (rơi vào rowErrors), NaN bị ép về 0 (`import.ts:494-499`).

---

## 4-8. Các mục khác

- **Dữ liệu & lỗi** 🟢: transaction/rollback qua RPC; offline queue IndexedDB; log redact + rotation.
- **Hiệu năng** 🟢: index 035; job nền có skip-unchanged; oversell atomic ở DB.
- **Backup** 🔴: **VẪN CHƯA CÓ** — không script backup nào; 2 file `backup_20260518_*.sql` root vẫn 0 byte. Blocker duy nhất (user chốt làm sau).
- **UX** 🟢: translateError; offline banner tiếng Việt.
- **Kiểm thử** 🟢 (nâng): **1045/1045 pass**; thêm test HTTP cho nhánh import server.
- **Vận hành** 🟡 điều kiện: `/health` check DB thật; cron `health-alert.sh` **NOT VERIFIED** trên iMac (SSH chặn — user tự kiểm).

---

## 9. TỔNG HỢP

### 🔴 Blocker (làm sau — user chốt)
1. Backup tự động (AUDIT-0710-B).

### ✅ Đã fix trong phiên này
2. P2-1 import client ghi đè tồn kho — 3 thay đổi tương thích ngược.
3. P2-2 test HTTP nhánh import server — 4 test mới.
4. P4 created_at bị null khi cập nhật — `delete rest.created_at`.

### Đánh giá sẵn sàng
| Kịch bản | Kết luận |
|---|---|
| Dùng thật nội bộ | ✅ Sẵn sàng (đang dùng) — P2-1 đã fix |
| Sổ sách tài chính duy nhất, không lưới an toàn | ⚠️ CHƯA — tới khi có backup tự động |
| Mở khách ngoài quy mô lớn | ⚠️ Chưa — cần load test + monitoring chạy thật |

### Kiểm tra tự động sau fix
`tsc --noEmit` sạch · `npm test` **1045/1045** · `npm run build` OK.

### NOT VERIFIED (cần làm thủ công trên dev.phucsang.com.vn)
Luồng import Excel thật end-to-end trên browser; concurrency 2 máy thật; cron health-alert trên iMac.

---

## So với audit trước (07-11)
- **Tiến**: fix R55/R56 đã commit (trước ở working tree); test 989→1045; nhánh import server có test.
- **Mới**: P2-1 (import client) — nằm đúng trong delta chưa commit, khớp nguyên tắc "bug mới ở code mới".
- **Tái diễn**: backup tự động (lần 3 user hoãn).

---

# AUDIT LẦN 2 (cùng ngày 2026-07-19) — Kiểm chứng độc lập lại toàn bộ

> **Bối cảnh**: User yêu cầu audit QA production-readiness toàn diện lần nữa (vai trò Senior QA / Production Readiness Auditor, prompt enterprise 15 phase).
> **HEAD lúc audit**: `26b252a` (fix IMPORT-02 đã commit — khác lần 1 audit trên working tree chưa commit).
> **Nguyên tắc áp dụng**: "Không tin báo cáo cũ" (EVALUATION_WORKFLOW §1) — TỰ CHẠY LẠI mọi kiểm tra tự động + TỰ ĐỌC lại SQL/code lõi, không dựa vào kết luận Audit lần 1.
> **Bằng chứng khác biệt lần này**: (a) tự chạy lại `npm test`/`tsc`/`build`; (b) **boot app THẬT trên browser** (port 3000) — xác minh render + `/health` check DB thật LIVE (điều Audit lần 1 ghi NOT VERIFIED).

## L2.0 — KẾT LUẬN TỔNG THỂ

**Production Readiness: GO WITH CONDITIONS · Confidence ~90%** (tăng từ ~85% sau khi kiểm chứng LIVE trên Supabase local — xem **L2.9**; điều kiện còn lại: blocker backup).

Lõi POS (tiền/kho/quyền/giao dịch atomic) — **kiểm chứng lại bằng SQL thật, vững, không hồi quy**. **Không phát hiện blocker MỚI.** Blocker duy nhất vẫn là **backup tự động** (AUDIT-0710-B, user chốt hoãn 3 lần). Bổ sung 1 quan sát P3 mới về nhất quán (điểm khách/doanh số NV nằm ngoài transaction — có chủ đích, đã ghi trong code).

## L2.1 — Kiểm tra tự động (TỰ CHẠY LẠI, không tin số cũ)

| Kiểm tra | Kết quả tôi tự chạy | Bằng chứng |
|---|---|---|
| `npm test` | ✅ **1045/1045 pass** (52 file), exit 0, 4.17s | chạy sạch từ đầu |
| `npx tsc --noEmit` | ✅ exit 0 (sạch) | — |
| `npm run build` | ✅ built 25.27s; chỉ cảnh báo chunk >500KB (lành tính, đã ghi P4) | — |

## L2.2 — Lõi tiền/kho (TỰ ĐỌC SQL, không tin báo cáo) — 🟢 ĐẠT

| Mục | Xác minh | Bằng chứng (file:dòng) |
|---|---|---|
| Chống oversell atomic | ✅ TỰ ĐỌC | `029:68-73` `UPDATE ... WHERE stock - qty >= 0` + `IF NOT FOUND RAISE STOCK_WOULD_BE_NEGATIVE` — check+trừ trong 1 câu, row-lock chống race/double-deduct |
| Doanh thu cộng dồn atomic | ✅ TỰ ĐỌC | `029:152-158` `ON CONFLICT (date) DO UPDATE SET x = x + EXCLUDED` |
| Idempotency đơn trùng id | ✅ TỰ ĐỌC | `029:42-44` `RAISE ORDER_ALREADY_EXISTS`. *Lưu ý:* 2 submit id KHÁC vẫn dựa disable nút client |
| Sửa đơn atomic + guard | ✅ TỰ ĐỌC | `028:49` `SELECT ... FOR UPDATE`; `028:53-58` chặn sửa đơn trả/đã hủy; `028:13-14` guard giảm SL < đã-trả viết LẠI bằng SQL (không tin client) |
| Chiết khấu > tổng tiền / 100% | ✅ TỰ ĐỌC | Clamp `Math.max(0, ...)` ở CẢ JS (`posOrderService.ts:203-204`) LẪN SQL (`029:145-146`) → doanh thu không âm |
| Công thức lợi nhuận Shopee 1 nguồn | ✅ TỰ ĐỌC + test | `src/lib/shopeeProfit.ts`; test đối chiếu **đơn thật escrow 218.449đ** (`shopeeProfit.test.ts:57`), test cả fee âm→abs, đơn hủy/hoàn — test có ý nghĩa, không rỗng |

## L2.3 — Bảo mật & validation — 🟢 ĐẠT (static)

- **Validate backend chặn rác**: `routes/data.ts:89` `Number.isFinite` (chặn NaN/±Infinity), `:114` `raw < 0` (chặn âm), áp cho upsert đơn + nhiều (`:537`, `:577`). ✅ TỰ ĐỌC.
- **requireAuth**: 130 lần dùng trên routes; storefront public (`store.ts`) cố ý không auth nhưng có 3 rate-limiter (đúng thiết kế). ✅
- **RLS**: `supabase_setup.sql` 39 `ENABLE ROW LEVEL SECURITY` / 34 bảng + migration 034 khóa 2 bảng Ads. ⚠️ *Chỉ verify static lần này* — chiều enforcement live đã được Audit 07-10 verify bằng anon key thật trên prod (401 42501).
- **Import P2-1 fix ĐÃ Ở ĐÚNG CHỖ + có test 2 nhánh**: `apiService.ts:62` bỏ `stock` khi undefined; `useGoodsExcelImport.ts:129,195` `stripStockForUpdate`; test client `useGoodsExcelImport.test.ts` + test server `importProducts.test.ts`. ✅ TỰ ĐỌC.

## L2.4 — Boot app THẬT trên browser (mới so Audit lần 1) — 🟢

- App khởi động port 3000, frontend load đủ module, **render sạch** (ảnh chụp: màn POS mobile, empty state tiếng Việt "Tìm và thêm sản phẩm vào giỏ hàng", format VND "0đ" đúng). ✅
- **`/health` check DB THẬT (verify LIVE)**: log `[health] DB check failed: ECONNREFUSED` khi không có Supabase — xác nhận endpoint KHÔNG trả "OK" cứng (đúng fix AUDIT-0710-I). ✅ Đây là bằng chứng runtime, không chỉ đọc code.

## L2.5 — Quan sát MỚI 🟢 P3: nhất quán điểm khách / doanh số NV nằm ngoài transaction

- **Hiện trạng**: `place/edit/delete/cancel_pos_order_tx` (RPC) chỉ bao **đơn + kho + doanh thu + nợ** trong 1 transaction. **Điểm/hạng khách hàng** (đọc cấu hình hạng từ localStorage, server không truy cập được) và **`sales_records` (doanh số NV)** là các lời gọi mạng RIÊNG sau RPC, bọc `try/catch` best-effort (`posOrderService.ts:72,295-297,330,372`).
- **Rủi ro nếu bỏ qua**: rớt mạng/đóng browser NGAY SAU khi RPC commit nhưng TRƯỚC khi 2 bước kia xong → đơn/kho/doanh thu ĐÚNG, nhưng điểm khách không cộng + doanh số NV của đơn đó thiếu tới khi recalc. **Không mất tiền, không sai kho.** `sales_records` là recalc-overwrite theo cả ngày (idempotent) nên **không double-count**; recover được bằng recalc.
- **Mức**: P3 (không chặn go-live). Đề xuất: (a) giữ nguyên (tradeoff hợp lý, đã ghi rõ trong code) HOẶC (b) job recalc `sales_records` cuối ngày để tự lành; đưa điểm/hạng vào server-side nếu muốn atomic hoàn toàn (cần chuyển cấu hình hạng khỏi localStorage).

## L2.6 — Blocker (xác minh lại) — 🔴 Backup tự động

- 2 file `backup_20260518_011509.sql` + `backup_20260518_011551.sql` root vẫn **0 byte** (fail âm thầm). `scripts/` **không có** script backup nào (chỉ deploy + sync-prod-to-dev). ✅ TỰ KIỂM.
- Ổ cứng iMac hỏng = mất dữ liệu bán hàng thật, không có đường khôi phục tự động. **Đây là điều kiện của "GO WITH CONDITIONS".**

## L2.7 — NOT VERIFIED (giới hạn môi trường — cần làm thủ công)

Sandbox **không có Supabase/Postgres local** (port 8000/5432 đóng, không Docker) + không được ghi DB thật → **KHÔNG thể** chạy các phase sau end-to-end:
- **Phase 3/5/14** — CRUD thật (bán/sửa/hủy/trả) đối chiếu DB trước-sau; nhất quán UI↔DB↔report.
- **Phase 7** — concurrency 2 máy thật (chỉ verify được atomicity qua đọc SQL, không chạy đua thật).
- **Phase 9** — RLS enforcement LIVE (đã verify prod ở audit 07-10, không verify lại lần này).
- **Phase 11** — performance dữ liệu lớn (không có data).
- Import Excel thật end-to-end; cron `health-alert.sh` trên iMac (SSH chặn).

→ **Để chuyển các mục này sang VERIFIED**: user chạy Supabase local (hoặc test trên `dev.phucsang.com.vn`) rồi báo — tôi sẽ chạy đúng các flow này qua browser.

## L2.8 — QUYẾT ĐỊNH GO / NO-GO

| Kịch bản | Quyết định | Điều kiện |
|---|---|---|
| Dùng thật nội bộ (đang dùng) | ✅ **GO** | Lõi tiền/kho atomic đã kiểm chứng; P2-1 đã fix + commit |
| Sổ sách tài chính DUY NHẤT, không lưới an toàn | ⚠️ **NO-GO tới khi có backup** | Blocker AUDIT-0710-B |
| Mở khách ngoài quy mô lớn | ⚠️ **CHƯA** | Cần load test + monitoring chạy thật + RLS re-verify |

**Fix order khuyến nghị**: (1) 🔴 Backup tự động + alert fail; (2) 🟢 P3 recalc/atomic điểm-khách nếu muốn; (3) verify các mục NOT VERIFIED trên dev.

**QA SIGN-OFF**: *Dựa trên test tự chạy lại (1045/1045), đọc trực tiếp SQL giao dịch atomic, boot app thật xác minh render + /health, và kiểm tra file backup — ứng dụng ĐỦ điều kiện DÙNG THẬT NỘI BỘ (đang dùng), nhưng CHƯA đủ để làm sổ sách tài chính duy nhất cho tới khi có backup tự động. Không phát hiện blocker mới ngoài backup.*

## L2.9 — KIỂM CHỨNG LIVE trên Supabase local (chuyển NOT VERIFIED → VERIFIED)

> Sau khi viết L2.0-L2.8, đã **khởi động Supabase self-host local** (`~/supabase-dev/docker`, `docker compose up -d` — DB copy prod: **14.873 SP, 69.736 đơn, 1.197 dòng doanh thu**), app kết nối `localhost:8000`, **auto-login thật** tài khoản chủ `admin@cfobrain.local`. Thực hiện CRUD/negative/concurrency THẬT, đối chiếu DB trước-sau. Confidence tăng ~85% → **~90%** (các gap lớn nhất đã đóng).

| Test | Cách chạy | Kết quả (đối chiếu DB thật) |
|---|---|---|
| **SALE-01** bán hàng E2E | UI: search SP004120 → thêm giỏ SL 3 → Thanh toán → Xác nhận (`POST /api/data/pos-orders/place-tx`) | ✅ tồn **979→976**; `revenue_records` 07-19 gross **105.000**/net **105.000**/cogs **48.000** (3×16.000)/lãi gộp **57.000** khớp từng đồng; `inventory_transactions` Sale qty **−3** prev 979 new 976; đơn HD-WPR4C completed. **UI↔RPC↔DB↔ledger↔doanh thu nhất quán tuyệt đối** |
| **CONC-01** race thật | 2 tiến trình `psql` song song gọi `place_pos_order_tx` cùng SP tồn=1 | ✅ **1 thành công, 1 bị chặn `STOCK_WOULD_BE_NEGATIVE`**; tồn cuối **0 (không âm)**; đúng **1 đơn** tạo — row-lock atomic chống oversell dưới tải đồng thời THẬT |
| **NEG-01** oversell | `place_pos_order_tx` bán 5 khi tồn=1 | ✅ **ERROR** rollback toàn bộ; tồn giữ **1**; **0 đơn** tạo |
| **NEG-02** chiết khấu > tổng | order total 10.000 discount 15.000 | ✅ `net_revenue` **clamp 0** (không âm −5.000); gross 10.000/discount 15.000 lưu đúng |
| **DEL-01** xóa đơn | `delete_pos_order_tx(HD-WPR4C)` | ✅ tồn **976→979** hoàn đúng; đơn → **cancelled** (soft-delete); doanh thu đảo sạch phần đơn (chỉ còn phần đơn khác cùng ngày); cộng dồn atomic 2 đơn/ngày xác nhận đúng |
| **EDIT-01** sửa đơn (SL 2→5) *(bổ sung 07-20)* | `edit_pos_order_tx` | ✅ tồn **8→5** (đảo delta cũ 2 + áp delta mới 5); doanh thu net **40.000→100.000**, cogs **16.000→40.000** — đảo+áp delta đúng |
| **RETURN-01** trả hàng — FLOW 4 UI ĐẦY ĐỦ *(bổ sung 07-20)* | UI desktop: nút **Đổi trả** → chọn đơn HD-ORO5K → SL trả 1 → THANH TOÁN (`processReturnOrder`) | ✅ tồn **978→979** hoàn lại; ledger `inventory_transactions` type **Return** qty **+1** (prev 978 new 979); đơn trả **TH-OV4RN** `is_return=true`; doanh thu net **35.000→0**, cogs **16.000→0** (hàng về kho), **returns_value 0→35.000** — hạch toán trả chính xác |
| **PHASE 9 RLS** live | anon key qua Kong `:8000` REST | ✅ `revenue_records`/`pos_products`/`audit_logs`/`pos_orders` → **401**; `shopee_ads_daily_spend` → **404** (migration 034). Không bảng tài chính nào lộ anon |
| **PHASE 11** hiệu năng | `EXPLAIN ANALYZE` bảng lớn | ✅ `pos_orders` theo ngày (69.736) → **Index Scan `idx_pos_orders_date_desc`** 0.228ms; `pos_products` theo sku (14.873) → **Index Scan `idx_products_sku`** 0.143ms |

**Dọn dẹp**: mọi dữ liệu test (đơn HD-WPR4C/CONC-A/NEG-*, SP test ZZTEST-CONC, revenue rows 07-19/07-20, audit_logs test) đã **xóa sạch** — DB trả về nguyên trạng (SP004120 tồn lại **979**, 0 dòng test sót).

**Quan sát nhỏ (P4)**: `pos_orders.date` lưu ISO timestamp đầy đủ trong cột TEXT (`2026-07-19T14:44:29.196Z`) trong khi `revenue_records.date` là kiểu DATE — query lọc `pos_orders` theo ngày phải khớp prefix, không so bằng `= 'YYYY-MM-DD'`. Không phải lỗi (app tự xử lý), chỉ lưu ý cho truy vấn báo cáo thủ công.

### Cập nhật NOT VERIFIED sau L2.9 (cập nhật 07-20: ĐÃ ĐÓNG NỐT trả hàng + sửa đơn)
- ✅ Đã VERIFIED (toàn bộ luồng nghiệp vụ cốt lõi): bán / sửa / xóa / **trả hàng** E2E, oversell, concurrency race, clamp chiết khấu, RLS enforcement live, performance bảng lớn. **Cả 5 luồng POS + 3 test an toàn đều kiểm chứng LIVE trên DB thật.**
- ⏳ Còn NOT VERIFIED (không chặn, marginal): trả HÀNG ĐỔI (exchange — trả kèm mua bù, khác trả thuần); cron health-alert + backup trên iMac prod (SSH chặn).
- 🟢 **Quan sát P4 (offline-first cache)**: khi sửa DB TRỰC TIẾP (psql, ngoài app), cache client IndexedDB (`cfo_brain_app_cache`) KHÔNG tự đồng bộ — UI hiển thị tồn kho/đơn cũ tới khi xóa cache + reload. Không phải lỗi (thao tác thật luôn qua app, cập nhật cả 2 chiều); chỉ lưu ý khi vá dữ liệu thủ công trên prod thì phải bảo user reload app. Đã tận dụng: clear IndexedDB (giữ token auth) + `location.reload()` để đồng bộ lại.
- 🔴 Blocker KHÔNG đổi: **backup tự động** — đây vẫn là điều kiện duy nhất chặn "sổ sách tài chính duy nhất".
