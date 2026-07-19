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
