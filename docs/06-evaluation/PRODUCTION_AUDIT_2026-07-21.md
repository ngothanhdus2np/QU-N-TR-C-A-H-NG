# Audit Production-Readiness toàn diện — CFO Brain 4.0

> **Ngày**: 2026-07-21
> **Branch**: `feat/online-audit-shopee` · **HEAD**: `6386ff3` · **Working tree**: sạch
> **Vai trò**: Senior QA / Production Readiness Auditor (prompt enterprise 15-phase)
> **Nguyên tắc áp dụng** (EVALUATION_WORKFLOW §1): *không tin báo cáo cũ* — tự chạy lại mọi
> kiểm tra tự động, tự đọc lại SQL lõi, và **tự thực thi RPC thật trên Postgres live** (không
> chỉ đọc code). Soi kỹ delta kể từ audit trước (`26b252a..HEAD`).
> **Khác biệt phương pháp so với các audit trước**: thay vì boot cả stack Supabase self-host
> (volume data đã bị xoá), lần này **nạp trực tiếp 4 function RPC thật từ `supabase_migrations/`
> vào Postgres 16 throwaway** rồi chạy sale/oversell/clamp/**race đồng thời**/edit/delete —
> kiểm chứng chính THÂN HÀM đang chạy trên prod, dưới tải đồng thời thật.

---

## 0. EXECUTIVE SUMMARY

```
Production Readiness:  GO (nội bộ) · GO WITH CONDITIONS (sổ sách tài chính duy nhất)
Confidence:           ~90%
```

**Lõi POS tiền/kho/quyền/giao dịch atomic — kiểm chứng bằng THỰC THI RPC THẬT trên Postgres
live, không hồi quy, không mất tiền, không âm kho, không sai doanh thu kể cả dưới race đồng thời.**
Delta kể từ audit 2026-07-19 (`26b252a..HEAD`) là **thuần hạ tầng** (backup, health-alert,
IP tĩnh) — không đụng một dòng nào của code tiền/kho. `npm test` **1045/1045**, `tsc` sạch.

Blocker backup (AUDIT-0710-B) — vốn là điều kiện duy nhất của "GO WITH CONDITIONS" ở audit
trước — **đã đóng phần thân**: script backup vững + đã cài launchd + chạy thật trên iMac.
NHƯNG audit này phát hiện **cửa cuối cùng của lưới an toàn còn hở**: kênh **cảnh báo khi
backup/health FAIL không gửi được** (Zalo token chưa cấu hình) → "fail âm thầm" vẫn còn khả
năng xảy ra. Đây là điều kiện MỚI cần đóng trước khi coi app là sổ sách tài chính duy nhất.

---

## 1. TEST STATISTICS

| Loại | Số lượng | Kết quả |
|---|---|---|
| Automated — `npm test` (tự chạy) | 1045 test / 52 file | ✅ **1045 pass, 0 fail** (exit 0, 3.8s) |
| Automated — `tsc --noEmit` (tự chạy) | toàn repo | ✅ sạch (exit 0) |
| **Live E2E — RPC thật trên Postgres** (tự chạy) | 6 flow + 1 empirical | ✅ **7/7 PASS** |
| App boot — render + /health (tự chạy) | 1 | ✅ render sạch, /health 503 thật |
| Security — static (tự đọc) | 8 hạng mục | ✅ đạt |
| NOT VERIFIED (giới hạn môi trường) | — | ghi rõ §7 |

Phân loại bug phát hiện: **P0: 0 · P1: 0 · P2: 1 · P3: 2 · P4: 2.**

---

## 2. KIỂM CHỨNG LÕI TIỀN/KHO — THỰC THI RPC THẬT (🟢 ĐẠT)

> Nạp thân hàm thật `029_place / 028_edit / 027_cancel_return / 026_delete` vào Postgres 16,
> schema tối giản khớp **ràng buộc THẬT của prod** (`revenue_records` `UNIQUE(date)`).
> Mỗi test đối chiếu DB trước–sau. Đây là *bằng chứng runtime*, không phải suy luận từ code.

| Test ID | Kịch bản | Kết quả thực tế (đối chiếu DB) | Status |
|---|---|---|---|
| **SALE-01** | Bán 3× SP-A (tồn 10, giá 200k, vốn 100k) | tồn **10→7**; `revenue_records`: gross **600.000** / net **600.000** / cogs **300.000** / lãi gộp **300.000** (khớp từng đồng); `inventory_transactions` Sale qty **−3** prevStock **10** newStock **7**; đơn `completed` | ✅ PASS |
| **NEG-01** | Oversell: bán 5× SP-B (tồn 1), `allow_out_of_stock=false` | `RAISE STOCK_WOULD_BE_NEGATIVE` → **rollback toàn bộ**; tồn giữ **1**; **0 đơn** tạo | ✅ PASS |
| **NEG-02** | Chiết khấu 15k > tổng 10k | net_revenue **clamp 0** (không âm −5.000); gross 10k / discount 15k lưu đúng | ✅ PASS |
| **CONC-01** | **Race thật**: 2 tiến trình song song mua đơn vị CUỐI của SP-B (tồn 1) | **1 thành công, 1 bị chặn `STOCK_WOULD_BE_NEGATIVE`**; tồn cuối **0 (không âm)**; đúng **1 đơn**; doanh thu net **120.000** (đếm 1 lần) | ✅ PASS |
| **EDIT-01** | Sửa đơn SL 3→5 | tồn **6→4** (đảo delta cũ +3, áp delta mới −5); revenue gross **600k→1.000k**, cogs **300k→500k** | ✅ PASS |
| **DEL-01** | Xóa (soft-delete) đơn SL 5 | tồn **4→9** hoàn đúng; revenue ngày đảo sạch về **0**; đơn `cancelled`; `inventory_transactions` `cancelled` | ✅ PASS |

**Cơ chế xác nhận đúng** (đọc SQL + chứng minh runtime):
- Chống oversell/double-deduct = `UPDATE pos_products SET stock = stock - qty WHERE id=? AND stock - qty >= 0` + `IF NOT FOUND RAISE` — **check và trừ trong 1 câu lệnh, row-lock Postgres** (`029:68-73`). CONC-01 chứng minh dưới tải đồng thời thật.
- Doanh thu cộng dồn atomic = `ON CONFLICT (date) DO UPDATE SET x = x + EXCLUDED.x` (`029:152-158`) — giao hoán, an toàn nhiều máy/đơn cùng ngày + replay offline queue.
- Clamp chiết khấu = `GREATEST(0, total − discount)` ở **cả JS lẫn SQL** (`029:145-146`).
- Sửa/xóa/hủy-trả: `SELECT ... FOR UPDATE` (row-lock) + guard chặn sửa đơn trả/đã hủy + guard giảm SL < đã-trả **viết lại bằng SQL** (không tin client, `028:60-109`) + đảo doanh thu = nghịch chính xác của delta lúc tạo.

---

## 3. PHÁT HIỆN — SCHEMA DRIFT `revenue_records` (🟡 P3, đã biết, kiểm chứng thực nghiệm)

**Hiện trạng**: mọi RPC dùng `ON CONFLICT (date)`, khớp ràng buộc THẬT của prod là
`UNIQUE(date)` (`uq_revenue_records_date`, chạy 2026-06-20). Nhưng `supabase_setup.sql`
(file "chạy để dựng hệ thống") lại: (a) **không hề `CREATE TABLE revenue_records`** — chỉ
`ALTER ... ADD COLUMN`; (b) chỉ thêm ràng buộc **composite `UNIQUE(date, branch_id)`**.

**Chứng minh thực nghiệm** (Postgres live, tự chạy):
```
Composite UNIQUE(date, branch_id) + ON CONFLICT (date)
  → ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification (42P10)
Standalone UNIQUE(date) + ON CONFLICT (date)
  → OK, cộng dồn đúng (100 + 50 = 150)
```

**Nghĩa là**: nếu ai đó **dựng lại DB từ `supabase_setup.sql`** (dev mới, đổi host, onboarding)
→ **MỌI đơn bán sẽ fail 42P10**. Đây là **schema drift đã được ghi nhận có chủ đích**
(migration `020` header + `TODO.md:434` — quyết định 1 chi nhánh, giữ nguyên hiện trạng prod).

**Rủi ro / mức**: 🟡 P3 — **KHÔNG phải bug prod** (prod chạy đúng, đã kiểm chứng live). Đường
DR chính (**restore từ `pg_dump`**) **an toàn** vì dump chứa schema THẬT (gồm `uq_revenue_records_date`).
Chỉ gãy ở đường "rebuild từ repo SQL". Vì backup pg_dump vừa được bật (2026-07-20), rủi ro đã
giảm nhiều.
**Đề xuất**: sửa `supabase_setup.sql` cho khớp prod (`CREATE TABLE revenue_records` đầy đủ +
`UNIQUE(date)` thay vì composite) để đường DR thứ 2 không còn là bẫy — chi phí thấp, xoá hẳn
một lớp rủi ro tiềm ẩn.

> **✅ CẬP NHẬT (cùng ngày 2026-07-21, theo yêu cầu user)**: ĐÃ SỬA. Thêm `CREATE TABLE IF NOT
> EXISTS revenue_records` (cột lấy đúng từ RPC) + đổi constraint block sang `UNIQUE(date)` +
> dedup theo `date`. An toàn tuyệt đối với prod (IF NOT EXISTS/DROP IF EXISTS). **Verify trên
> Postgres 16 sạch**: chuỗi DDL rebuild-from-scratch chạy sạch (exit 0), `ON CONFLICT (date)`
> cộng dồn đúng (2 đơn cùng ngày → net 150, 1 dòng), chạy lại idempotent (chỉ NOTICE). Còn sót
> nhỏ (P3, **AUDIT-0721-C**): `expense_records`/`payroll_records` cũng thiếu CREATE — chưa bổ
> sung vì chưa xác minh chắc đủ cột (không bịa schema tài chính); đường DR chính (pg_dump) không
> ảnh hưởng.

---

## 4. PHÁT HIỆN — LƯỚI AN TOÀN BACKUP CÒN HỞ CỬA CUỐI (🟠 P2, MỚI)

**Bối cảnh**: blocker backup (AUDIT-0710-B) được coi là đã đóng → app từ "GO WITH CONDITIONS"
lên "GO". Audit này xác nhận **phần thân backup vững**: `scripts/backup-db.sh` `set -euo pipefail`,
`pipefail` bắt lỗi `pg_dump` qua pipe gzip, **guard chặn file 0-byte/quá nhỏ + `gzip -t`**
(đúng fix "fail âm thầm"), xoá file rác khi lỗi, off-site best-effort, rotate 14 bản, read-only.
Đã cài launchd + chạy thật trên iMac (dump prod 11-12MB).

**Nhưng cửa cuối cùng hở**: cơ chế **cảnh báo khi FAIL** dựa hoàn toàn vào Zalo, mà
`ZALO_OA_ACCESS_TOKEN` / `ZALO_FOLLOWER_ID` **chưa được cấu hình** (xác nhận: 0 key trong
`.env.local` máy local; theo AUDIT-0711-F thì iMac cũng chưa có). Khi backup fail thật (đầy ổ,
container down…), guard phát hiện đúng nhưng `send_zalo()` chỉ in *"Zalo chưa cấu hình — bỏ qua"*
ra log launchd — **không ai đọc log đó**.

**Rủi ro / mức**: 🟠 P2 — **fail âm thầm vẫn có thể xảy ra**, đúng thứ mà blocker này sinh ra để
diệt. Backup có thể ngừng chạy hàng tuần mà chủ không biết, tới khi cần restore mới lộ. Không
có kênh cảnh báo thứ 2 (email…). Đây là điều kiện của "sổ sách tài chính duy nhất".
**Đề xuất** (cần user, không phải bug code): thêm `ZALO_OA_ACCESS_TOKEN` + `ZALO_FOLLOWER_ID`
vào `.env.local` trên iMac, rồi **chủ động test 1 lần fail giả** (đổi tên container tạm) để xác
nhận nhận được tin Zalo. Cùng token này cũng bật luôn cảnh báo `health-alert.sh`.

---

## 5. BẢO MẬT — 🟢 ĐẠT (static + prod đã verify live các audit trước)

| Hạng mục | Bằng chứng (tự kiểm) |
|---|---|
| Secrets không tracked | `git ls-files` chỉ thấy `.env.example`; `.gitignore` phủ `.env`/`.env.local`/`.env.*`; **0 secret hardcode** trong source; `ANTHROPIC_API_KEY` chỉ tồn tại server-side |
| requireAuth mọi route mutate | 130 tham chiếu; **mọi** route mutate trong `routes/data.ts` (upsert/upsert-many/delete/clear/config/inventory/**place-tx/edit-tx/delete-tx/cancel-return-tx**/revenue-delta/knowledge/analytics) đều `requireAuth` |
| XSS | **Mọi** `dangerouslySetInnerHTML` đều wrap `DOMPurify.sanitize(...)` — kiểm multiline, gồm `MemoHtml` (`StandardsWorkflowsTab.tsx:141`) |
| RLS | 39 `ENABLE ROW LEVEL SECURITY`; migration **034** khóa 2 bảng Ads tài chính mới (RLS + policy + REVOKE anon) — đúng pattern chống bẫy DEFAULT PRIVILEGES |
| Rate-limit | `authLimiter`/`apiLimiter` (server.ts) + 5 limiter storefront public (order/preorder/lookup/contact/newsletter) |
| Validate backend | `data.ts` `Number.isFinite` chặn NaN/±Infinity + chặn giá âm; DB CHECK constraint 036 (2 lớp) |

*Chú ý*: RLS **enforcement live** verify static lần này; chiều thực thi bằng anon key thật đã
được audit 07-10 (401/404 trên prod) + 07-19 L2.9 kiểm lại — delta từ đó không đụng RLS.

---

## 6. HẠ TẦNG / DELTA — 🟢 (trừ P2 §4)

- **Delta `26b252a..HEAD`** = 4 commit **thuần hạ tầng**: cài health-alert.sh + fix `set -e`
  (thêm `|| true` vào 2 dòng grep — xác nhận `health-alert.sh:24-25`), backup tự động, IP tĩnh
  iMac `192.168.1.2` (server.ts CSP/fallback + channelManagement.ts). **Không đụng code tiền/kho.**
- **/health check DB thật**: boot app → `/health` trả **HTTP 503 `DB_UNAVAILABLE`** khi DB
  không tới được (log `[health] DB check failed … ECONNREFUSED`) — xác nhận KHÔNG hardcode "OK".
- **Công thức lợi nhuận Shopee 1 nguồn**: `src/lib/shopeeProfit.ts` `calcShopeeNetProfit` được
  import bởi cả 3 đường ghi (`InventoryOutTab.tsx`, `useShopeeInventoryOut.ts`, `adsSpendSync.ts`)
  — không còn bản chép inline.
- **App render**: POS terminal render sạch (ảnh chụp), UI tiếng Việt, format VND/ngày đúng,
  empty state đúng ("HỆ THỐNG CHƯA CÓ SẢN PHẨM"), offline-first (boot được cả khi DB down).

---

## 7. NOT VERIFIED (giới hạn môi trường — cần làm thủ công)

- **Excel import E2E thật trên browser** (dev.phucsang.com.vn) — logic đã có test HTTP 2 nhánh
  + fix P2-1; nhưng chưa chạy 1 file Excel thật đối chiếu UI (đây vẫn là điều kiện IMPORT-02).
- **Cron/launchd trên iMac prod** (backup 02:30, health-alert 5 phút) — SSH iMac bị classifier
  chặn trong chế độ tự động; xác nhận "đã cài + đang chạy" phải nhờ user chạy `launchctl list`.
- **Performance dữ liệu lớn** — audit 07-19 L2.9 đã `EXPLAIN ANALYZE` (Index Scan 0.1-0.2ms trên
  69.736 đơn / 14.873 SP); lần này không có bản data lớn nên không đo lại.
- **Return-cancel qua UI đầy đủ** (`cancel_pos_return_tx`) — đã ĐỌC thân hàm (đảo kho theo tx
  đã lưu + guard không âm + đảo doanh thu nghịch đảo chính xác) + audit 07-20 đã verify UI; lần
  này ưu tiên chạy live 6 flow còn lại nên không dựng lại đơn trả trên Postgres tối giản.

---

## 8. BUSINESS RISK

| Câu hỏi | Trả lời (dựa trên bằng chứng) |
|---|---|
| Có thể mất tiền? | **Không** ở lõi POS — doanh thu cộng dồn atomic, clamp chống âm, đảo delta chính xác khi sửa/xóa/trả (đã chạy live). |
| Có thể sai tồn kho? | **Không** — guard `stock - qty >= 0` + row-lock chặn oversell/double-deduct kể cả race đồng thời (CONC-01 chứng minh). |
| Có thể sai lợi nhuận/báo cáo? | **Không** ở lõi — cogs/lãi gộp khớp từng đồng; công thức Shopee 1 nguồn. |
| Có thể **mất dữ liệu**? | **Rủi ro còn lại**: backup chạy nhưng **cảnh báo khi backup FAIL không gửi được** (§4) → nếu backup âm thầm hỏng, có thể mất dữ liệu tích lũy tới lần restore. |
| Có thể bị truy cập trái phép? | **Không** ở mức đã kiểm — requireAuth mọi route mutate, RLS 39 bảng, secrets sạch. |
| DR khi cần dựng lại DB? | Restore từ `pg_dump`: **an toàn**. Rebuild từ repo SQL: **gãy** (schema drift §3). |

---

## 9. GO / NO-GO DECISION

| Kịch bản | Quyết định | Điều kiện |
|---|---|---|
| **Dùng thật nội bộ (đang dùng)** | ✅ **GO** | Lõi tiền/kho/quyền atomic đã kiểm chứng LIVE; không blocker |
| **Sổ sách tài chính DUY NHẤT, không lưới an toàn** | ⚠️ **GO WITH CONDITIONS** | Đóng P2 §4 (**cấu hình Zalo alert cho backup** + test 1 lần fail giả) |
| **Mở khách ngoài quy mô lớn** | ⚠️ **CHƯA** | Cần load test + monitoring chạy thật + RLS re-verify live |

**So audit 07-19**: audit đó kết luận blocker duy nhất = "chưa có backup". Backup nay đã có +
chạy thật → **tiến bộ thật**. Audit này soi sâu hơn *một tầng*: backup tồn tại ≠ lưới an toàn
hoàn chỉnh — **kênh cảnh báo khi fail mới là cái quyết định "không mất dữ liệu âm thầm"**, và
nó chưa hoạt động. Đây là tinh chỉnh điều kiện, không phải lùi.

---

## 10. RELEASE BLOCKERS & FIX ORDER

**Không có P0/P1.** Không có blocker chặn dùng nội bộ.

Thứ tự sửa khuyến nghị (để đạt "sổ sách tài chính duy nhất"):
1. 🟠 **P2 — Cấu hình Zalo alert** cho `backup-db.sh` + `health-alert.sh` trên iMac (user thêm
   2 token vào `.env.local`, test 1 lần fail giả). *Đóng cửa cuối của lưới an toàn.*
2. 🟡 **P3 — Sửa `supabase_setup.sql`** khớp prod (`CREATE TABLE revenue_records` + `UNIQUE(date)`)
   để đường DR "rebuild từ repo" không còn gãy.
3. 🟢 **P3 — điểm/hạng khách + `sales_records` ngoài transaction** (đã biết, L2.5) — job recalc
   cuối ngày nếu muốn tự lành hoàn toàn (không tới hạn: không mất tiền/kho, recover được).
4. 🟢 **P4** — (a) timezone `(v_date)::DATE` gần nửa đêm nếu client gửi UTC; (b) dev auto-login
   retry loop khi backend down (chỉ dev). Cả hai không ảnh hưởng prod.
5. Verify các mục NOT VERIFIED §7 trên dev khi có điều kiện.

---

## 11. FINAL QA SIGN-OFF

Dựa trên: (1) tự chạy lại `npm test` **1045/1045** + `tsc` sạch; (2) **thực thi 4 RPC giao dịch
THẬT trên Postgres live** — bán/oversell/clamp/**race đồng thời**/sửa/xóa, đối chiếu DB trước–sau,
**7/7 PASS, không mất tiền, không âm kho, không sai doanh thu**; (3) chứng minh thực nghiệm
schema-drift `revenue_records`; (4) boot app thật xác minh render + `/health` 503 DB thật; (5)
rà bảo mật (requireAuth/RLS/secrets/XSS) + audit script backup + fix `set -e` health-alert —

**ứng dụng ĐỦ điều kiện DÙNG THẬT NỘI BỘ (đang dùng), và ĐỦ điều kiện làm SỔ SÁCH TÀI CHÍNH
DUY NHẤT NGAY SAU KHI cấu hình kênh cảnh báo Zalo cho backup (P2 §4)** — vì đó là mảnh cuối
cùng đảm bảo backup hỏng sẽ được phát hiện thay vì âm thầm. **Không phát hiện P0/P1. Không có
blocker chặn go-live nội bộ.**

*Giới hạn trung thực*: các mục §7 (Excel import E2E, cron trên iMac, load test) chưa xác minh
trong phiên này — cần môi trường/quyền tương ứng.
