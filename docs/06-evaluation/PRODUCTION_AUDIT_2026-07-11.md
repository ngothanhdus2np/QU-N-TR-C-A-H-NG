# Audit Production-Readiness toàn diện — CFO Brain 4.0

> **Ngày**: 2026-07-11
> **Branch**: `feat/online-audit-shopee` (working tree sạch, HEAD `8f573ff`)
> **Bối cảnh**: Audit lần 2 liên tiếp — audit 2026-07-10 (R51) phát hiện 15 mục, R52 đã fix 13 mục 🟡/🟢 + blocker RLS, R53 đã deploy prod. Audit hôm nay: (1) **kiểm chứng lại từng fix bằng code thật** (không tin báo cáo), (2) soi phần code thay đổi sau audit, (3) đánh giá lại đủ 8 mục.
> **Phương pháp**: đọc trực tiếp code từng fix + quét mới toàn bộ route/migration/script; `tsc --noEmit` sạch; `npm test` **989/989 pass**; `vitest --coverage`.

---

## 0. KẾT LUẬN TỔNG THỂ

**13/13 fix của R52 đều THẬT và đúng chỗ — không phát hiện hồi quy.** Lõi giao dịch POS không đổi từ 2026-07-04 (đã qua 3 vòng audit trước).

Còn lại:
1. **Blocker duy nhất chưa đóng: backup tự động (AUDIT-0710-B)** — vẫn chưa có gì.
2. **1 phát hiện mới đáng chú ý (🟠)**: 3 đường ghi frontend lưu `netProfit` bằng công thức cũ, lệch công thức chuẩn.
3. Vài điểm 🟡/🟢 mới + tồn đọng nhỏ đã biết.

**Mức độ**: Dùng thật nội bộ ĐƯỢC (đang dùng). Đóng nốt backup tự động thì đạt "production có kiểm soát".

---

## 1. Nghiệp vụ cốt lõi — 🟢 ĐẠT (1 phát hiện mới 🟠 ở tính năng Ads)

| Mục | Trạng thái | Bằng chứng |
|---|---|---|
| Tạo/sửa/hủy/xóa/trả đơn qua RPC transaction | ✅ Đạt | `place/edit/delete_pos_order_tx`, `cancel_pos_return_tx` (migrations 026-029) — `posOrderService.ts` không đổi từ 2026-07-04 (`a3c11ff`), 989 test pass |
| Làm tròn tiền | ✅ Chấp nhận được | NUMERIC + `Number()` nhất quán (không đổi từ audit trước) |
| Chống oversell / race | ✅ Đạt | RPC v2 (022) guard `stock >= qty`, đã test song song thật đợt R3 |
| Bug phân bổ Ads (AUDIT-0710-E) | ✅ Đã fix thật | `useShopeeInventoryOut.ts:562-568` — lọc `platform`, dùng `isEffectiveOrder()`, `adsTax = adsCost × ADS_TAX_RATE` |
| Đồng bộ bot → app không phá cột phái sinh | ✅ Đạt | `inventoryOutSync.ts:262-276` — delete 4 cột `handling_fee/ads_cost/ads_tax/net_profit` khỏi payload update |

**🟠 PHÁT HIỆN MỚI — công thức `netProfit` lệch giữa 3 đường ghi frontend và công thức chuẩn**
- **Vấn đề**: 3 hàm trong `components/revenue/useShopeeInventoryOut.ts` (`handleDistributeAdsCost` dòng 384-393, `handleSyncAdsFromBot` dòng 447-449, `handleAddInventoryOut` khối ads-batch dòng 569-578) ghi cột `netProfit` vào DB bằng công thức: `salePrice − platformFee − paymentFee − freeshipExtra − affiliateFee − handlingFee − adsCost − adsTax − importPrice`. Công thức chuẩn (`InventoryOutTab.tsx:319-324` hiển thị, `routes/adsSpendSync.ts:69-78` backend job) còn trừ thêm **PiShip, VAT, TNCN, Phí Ads Shopee** và phân nhánh theo loại đơn (hủy = 0, giao thất bại = −(PiShip + Vận hành)).
- **Ảnh hưởng**: các dòng bot-sync (có PiShip/VAT/TNCN/adsFee ≠ 0) trong cùng ngày+shop bị ghi đè `net_profit` sai khi user phân bổ QC tay/bấm sync. **Màn hình vẫn đúng** (UI tự tính lại client-side, không đọc cột lưu — FORMULAS.md §10.2c), nhưng **CSV export và query báo cáo đọc cột này sẽ sai** cho tới khi job backend 30 phút chạy lại thành công (nếu bot down thì giá trị sai tồn tại lâu). Đơn hủy/hoàn còn bị gán lợi nhuận theo công thức đơn thành công.
- **Rủi ro**: 🟠 số liệu lợi nhuận xuất báo cáo sai tạm thời + flip-flop giá trị giữa 2 công thức.
- **Cách sửa**: tách 1 hàm `calcNetProfitFull(record, importPrice, adsCost, adsTax)` dùng chung (đúng logic `adsSpendSync.ts:59-78`), thay cho 3 công thức inline; thêm unit test so sánh kết quả frontend vs backend cùng input.

**FORMULAS.md** (AUDIT-0710-F): ✅ đã khớp code — §10.2b tiêu chí đơn hiệu quả = `status ∈ {OK, SHIPPING}`, §10.2c ghi nhận job có ghi `net_profit`.

---

## 2. Bảo mật — 🟢 ĐẠT (không blocker mới)

| Mục | Trạng thái | Bằng chứng |
|---|---|---|
| RLS 2 bảng Ads (blocker hôm qua) | ✅ Đã vá + verify prod | Migration `034` (ENABLE RLS + policy authenticated + REVOKE anon) + `supabase_setup.sql:2416-2420`; R53 đã curl anon key thật trên prod → `401/42501` |
| XSS qua `dangerouslySetInnerHTML` | ✅ Đạt | **10/10 chỗ** đều wrap `DOMPurify.sanitize()` (kiểm bằng grep multiline, tránh dương tính giả của audit R51) |
| SQL injection | ✅ Đạt | Supabase client parameterized; RPC dùng tham số |
| Auth bypass | ✅ Đạt | `requireAuth` (server.ts:558-580) verify JWT thật qua `supabase.auth.getUser()`; bypass LAN đã gỡ; AI routes có `router.use('/api/ai', requireAuth)` (ai.ts:114); 4 GET notifications.ts đã có requireAuth (dòng 24-122) |
| Phân quyền role | ✅ Đạt | `adminStore.ts` dùng `requireRole(...)` từng route; audit-logs owner-only (`data.ts:502`) |
| Secrets | ✅ Đạt | `.env.local` gitignored, không file env nào tracked ngoài `.env.example`; SEC-SECRET-01 đã đóng theo quyết định user |
| Rate-limit login | ✅ Đạt | `authLimiter` 20/15p trên `/auth/v1/token` + `/api/auth/register` (server.ts:449-463) |

**Điểm trừ còn lại (đã biết, chưa sửa):**
- 🟡 `/api/auth/verify-manager` (auth.ts:234) nhận username+password nhưng chỉ chịu `apiLimiter` 1000/15p — nên chuyển sang `authLimiter` 20/15p (1 dòng). Rủi ro: brute-force mật khẩu manager nhanh hơn 50×.
- 🟡 `/api/channels/notify-logout` (channelManagement.ts:327) không guard — comment nói "gọi từ localhost bot" nhưng route public. Ảnh hưởng thấp (chỉ đổi `bot_status`), nên thêm check `INTERNAL_API_KEY`.
- 🟡 **MỚI**: `POST /api/store/orders`, `/api/store/preorders`, `/api/store/orders/lookup` (store.ts:342-471) public không rate-limit riêng (contacts/newsletter CÓ — store.ts:120,157). Spam tạo đơn ảo → giữ tồn kho + rác dữ liệu. Fix: thêm limiter như `contactLimiter`.
- 🟢 CSP còn `unsafe-inline`/`unsafe-eval` (server.ts:417) — đã giảm nhẹ nhờ DOMPurify phủ 10/10; chấp nhận được với React hiện tại.

---

## 3. Dữ liệu & xử lý lỗi — 🟢 ĐẠT (nâng từ 🟡 hôm qua)

| Mục | Trạng thái | Bằng chứng |
|---|---|---|
| Validate backend | ✅ Đã fix thật | `data.ts:109-117` `validateDataPayload` chặn NaN/Infinity toàn payload + số âm `pos_products.sale_price/import_price`, áp cho `upsert` (537) + `upsert-many` (577); DB-level CHECK migration `036` (NOT VALID, cố ý bỏ qua pos_orders/stock vì âm hợp lệ) |
| Guard số liệu bot | ✅ Đã fix thật | `adsSpendSync.ts:199-205` bỏ qua ngày có QC NaN/Infinity/âm, ghi error rõ |
| Validate storefront public | ✅ Đạt tốt | `store.ts:342-383` — validate từng field, UUID check, qty 1-100, slice độ dài, giá tính server-side qua RPC atomic `create_store_order` |
| Transaction/rollback | ✅ Đạt | Luồng tiền qua RPC transaction; `inventoryOutSync` idempotent (UNIQUE order_id,sku) |
| auditLog cho job Ads | ✅ Đã fix thật | `adsSpendSync.ts:245-263` — 1 dòng tổng hợp/lần chạy vào `audit_logs` |
| Logging đủ debug | ✅ Đã fix thật | `errorTracking.ts` — `redact()` che password/token/secret... (dòng 20-33), ghi file `logs/error-YYYY-MM-DD.log` giữ 14 ngày (37-66); `errorHandler` ĐÃ wire làm middleware cuối (server.ts cuối file) |
| File upload | ✅ Đạt | `excelSafety.ts` magic bytes + 10MB + 50k dòng (không đổi) |

**Tồn đọng nhỏ:**
- 🟡 `runAdsSpendSync` vẫn update **từng dòng** (adsSpendSync.ts:226-229) — lỗi giữa chừng để ngày nửa cập nhật (tự lành sau 30p). Gom batch upsert khi tiện.
- 🟢 Sentry vẫn chưa bật (`errorTracking.ts:70`) — đã có file log thay thế, chấp nhận được.

---

## 4. Hiệu năng — 🟢 ĐẠT

- ✅ Index đã bổ sung: migration `035` — `pos_products(sku)`, `shopee_inventory_out(date,platform)`; `pos_orders(date)` có sẵn từ 006. Đã chạy prod (R53).
- ✅ `adsSpendSync.ts:170-183` phân trang đúng (PAGE_SIZE 1000, tránh mất đơn quá dòng 1000).
- ✅ Job nền hợp lý: inventory sync 10p, ads sync 30p, có điều kiện `unchanged` tránh ghi thừa.
- ✅ `useRealtimeSync.ts:125-135` — tắt realtime WS khi qua proxy localhost (tránh retry vô hạn spam console).
- 🟢 Còn 1 chỗ `.limit(5000)` (customer-debt-history) vượt rule 2000 — đã biết, chưa đau.
- Concurrency: oversell guard atomic ở DB, nhiều người bán cùng lúc an toàn (đã test thật đợt R3).

---

## 5. Sao lưu & khôi phục — 🔴 BLOCKER DUY NHẤT CÒN LẠI

- **🔴 Backup tự động — VẪN CHƯA CÓ** (AUDIT-0710-B, đã biết): `scripts/` chỉ có `sync-prod-to-dev.sh`/`sync-prod-to-staging.sh` chạy tay; `backup-mega.sh` + launchd trong kế hoạch **chưa tồn tại**; 2 file `backup_20260518_*.sql` ở root vẫn **0 byte** (bằng chứng backup từng fail âm thầm, chưa dọn). Ổ cứng iMac hỏng = mất toàn bộ dữ liệu bán hàng từ lần cuối sync tay.
- ✅ Crash giữa giao dịch: Postgres WAL + RPC transaction — đạt.
- ✅ **Rollback deploy — ĐÃ CÓ (mới từ R52/R53)**: `deploy-imac.sh` backup hardlink trước khi ghi đè (dòng 22-27), poll `/health` 15 lần (73-82, đã vá bug `set -e` + curl fail exit 7 khi deploy thật), tự rollback + restart nếu fail (105-116); `docs/03-deployment/ROLLBACK_RUNBOOK.md` tồn tại. Đã chạy thật 3 lần ngày 10/07.
- 🟢 Cosmetic: `deploy-imac.sh:91` echo IP cũ `192.168.1.3` (chỉ là message hiển thị, IP thật dùng biến `IMAC_IP=192.168.1.6`).

---

## 6. Trải nghiệm người dùng — 🟢 ĐẠT

- ✅ Thông báo lỗi tiếng Việt: `services/errorMessages.ts` `translateError()` (mạng/401/403/trùng khóa/constraint/500 → câu dễ hiểu, raw log console) — áp dụng 5 trang (ShopeeProducts/WebsiteProducts/WebsiteOrders/WebsiteChannelLinks/GoodsInventory).
- ✅ Mất mạng: offline queue IndexedDB (coalesce + retry cap 5 + check server thật) + banner tiếng Việt — không đổi từ audit trước.
- ✅ PWA/máy cũ: network-first HTML/JS; dead code Background Sync trong `service-worker.js` đã dọn thật (chỉ còn comment ghi chú dòng 194).
- 🟢 **MỚI**: `AdsTab.tsx:82` (tab QC mới) hiện `err.message` raw (có thể tiếng Anh "Failed to fetch") — nên bọc `translateError()`.

---

## 7. Kiểm thử — 🟡 ĐẠT MỘT PHẦN (cải thiện rõ)

- ✅ **989/989 test pass** (tăng từ 981 nhờ 8 test mới cho 2 job sync), `tsc --noEmit` sạch.
- ✅ 2 job rủi ro nhất đã có test: `adsSpendSync.ts` 67.8% statements, `inventoryOutSync.ts` 81%, `importParsers.ts` 100% (mock Supabase + axios, phủ phân bổ QC/prorate/status-map/skip-unchanged).
- 🟡 **Lưu ý con số coverage**: "routes 78%" chỉ tính 3 file có test import. Các route handler tiền tệ trong `data.ts` (place/edit/delete-tx, upsert), `notifications.ts`, `store.ts`, `auth.ts` **vẫn 0 test tầng HTTP** — logic dưới (RPC + service) có test, nhưng lớp wiring Express (auth, validate, mapping lỗi) chưa. Ưu tiên kế tiếp: test `createDataRouter` với supertest hoặc mock req/res.
- ✅ Luồng nghiệp vụ quan trọng có test: posOrderService ~68%, auditService 97%, returnGuards, import parser 100%.

---

## 8. Vận hành & giám sát — 🟢 ĐẠT CÓ ĐIỀU KIỆN (nâng từ 🔴)

- ✅ `/health` check DB thật: server.ts:183-198 — `SELECT` từ `app_state`, timeout 2s, trả `503 DB_UNAVAILABLE` khi Supabase chết (đã verify nhánh lỗi qua preview R52; nhánh thành công verify khi deploy thật R53 — health-check deploy pass).
- ✅ Alerting hạ tầng: `scripts/health-alert.sh` — bắn Zalo khi `/health` fail 2 lần liên tiếp + báo phục hồi. **⚠️ ĐIỀU KIỆN: cần user xác nhận đã cài cron/launchd 5 phút/lần trên iMac** — không kiểm chứng được từ máy dev; script tồn tại nhưng chưa chắc đang chạy.
- ✅ Secrets: không lộ trong repo; frontend/backend env tách prefix đúng chuẩn.
- ✅ Tài liệu: `ROLLBACK_RUNBOOK.md` (build fail/migration fail/health fail); deploy + rollback tự động trong script.
- 🟢 Sentry chưa bật (đã có file log 14 ngày thay thế tối thiểu).

---

## 9. TỔNG HỢP HÀNH ĐỘNG

### 🔴 Blocker — BẮT BUỘC trước khi tin dùng hoàn toàn
1. **Backup tự động** (mục 5, đã biết từ R51) — triển khai `backup-mega.sh` + launchd + alert khi backup fail + dọn 2 file 0-byte ở root. Đây là việc P0 duy nhất còn lại.

### 🟠 Nên sửa sớm
2. **Thống nhất công thức `netProfit` ở 3 đường ghi frontend** (`useShopeeInventoryOut.ts:384-393, 447-449, 569-578`) — dùng chung 1 hàm với backend/hiển thị (mục 1, phát hiện mới).

### 🟡 Nên sửa, không chặn go-live
3. `verify-manager` → `authLimiter` (1 dòng, auth.ts:234).
4. Rate-limit cho `POST /api/store/orders`/`preorders`/`lookup` (store.ts).
5. Guard `INTERNAL_API_KEY` cho `notify-logout` (channelManagement.ts:327).
6. Batch upsert thay per-row trong `adsSpendSync.ts:226`.
7. Test tầng HTTP cho `createDataRouter` (data.ts).
8. User xác nhận cron `health-alert.sh` đã cài + chạy thật trên iMac.

### 🟢 Nhỏ
9. `translateError()` cho `AdsTab.tsx:82`; sửa echo IP cũ `deploy-imac.sh:91`.

### Đã vững — không đụng vào
Lõi POS 5 RPC transaction, oversell atomic, RLS toàn bộ bảng (kể cả 2 bảng Ads mới), requireAuth + JWT verify thật, DOMPurify 10/10, validate backend + CHECK constraint, offline-first + dataMapper nguyên vẹn, deploy rollback tự động, /health thật + health-alert, error log redact + rotation, 989/989 test + tsc sạch.

### Đánh giá sẵn sàng
| Kịch bản | Kết luận |
|---|---|
| Dùng thật nội bộ (chủ + nhân viên tiệm) | ✅ Sẵn sàng — đang dùng, các lớp bảo vệ tiền/kho/quyền đã đủ |
| Sổ sách tài chính duy nhất, không lưới an toàn | ⚠️ CHƯA — cho tới khi có backup tự động (mục 1) |
| Mở cho khách hàng ngoài quy mô lớn | ⚠️ Chưa nên — cần thêm rate-limit storefront (mục 4) + monitoring chạy thật (mục 8) |

---
---

# AUDIT LẦN 3 (cùng ngày, sau khi R55 fix 6/7 mục) + FIX TRONG PHIÊN (R56)

> **Bối cảnh**: kiểm chứng bằng code thật 6 fix R55 (đang uncommitted trên working tree)
> + rà lại 8 mục + tìm phát hiện mới. Sau đó user chốt "bỏ backup làm sau, fix hết
> phần còn lại từ dễ đến khó" — đã fix ngay trong phiên.
> **Kiểm tra**: `tsc --noEmit` sạch · `npm test` 1009/1009 (sau fix: **1029/1029**) ·
> coverage 50.26% statements toàn cục, `shopeeProfit.ts` 100%.

## Kết quả kiểm chứng 6 fix R55 — TẤT CẢ THẬT, không hồi quy

| Fix | Bằng chứng đã soi |
|---|---|
| A — nguồn duy nhất công thức | `src/lib/shopeeProfit.ts` + diff xác nhận 4 nơi đều import; 10 test fixture đơn thật khớp escrow 218.449đ |
| B — rate-limit storefront | `store.ts:101-103` gắn đúng 3 route; **soi phản biện**: `trust proxy=1` (server.ts:394) → limiter key theo IP khách thật sau Cloudflare, không gộp chung loopback |
| C — verify-manager + notify-logout | `server.ts:462` mount TRƯỚC router (dòng 587); guard `channelManagement.ts:331-340` dùng `req.socket.remoteAddress` (không bị trust-proxy đánh lừa), tunnel luôn mang `cf-connecting-ip` nên không giả local được |
| D — batch upsert | `adsSpendSync.ts:206-246`; **soi phản biện**: bảng chỉ có `date` NOT NULL không default (setup:72) và payload có kèm `date` → nhánh insert lý thuyết không vỡ |
| E — test HTTP data router | `routes/data.test.ts` 10 test chạy thật |
| G — translateError AdsTab + IP echo | diff xác nhận cả 2 |

## Phát hiện mới lần 3 → trạng thái sau phiên fix

1. **🟡 Đường ghi thứ 5 bị bỏ sót — luồng import Excel** (`useShopeeInventoryOut.ts:255-261` cũ):
   còn công thức inline — đơn hoàn từ Excel ghi `netProfit = 0` thay vì `−(PiShip + Vận hành)`,
   và `importPrice` **quên nhân số lượng** (đơn qty ≥ 2 thổi phồng lãi `importPrice × (qty−1)`).
   → **ĐÃ FIX cùng phiên**: thay bằng `calcShopeeNetProfit()` + `importPrice × (quantity || 1)`;
   FORMULAS.md §10.2 cập nhật. Lưu ý: dữ liệu ĐÃ import trước đây có thể mang sai số cũ.
2. **🟡 `store.ts` 0 test tầng HTTP** (bề mặt public không auth lớn nhất)
   → **ĐÃ FIX**: `routes/store.test.ts` mới — 20 test (validate biên, UUID/injection, phone
   chuẩn hoá, RPC atomic đúng tham số, không lộ chi tiết lỗi/giá vốn/id nội bộ, chống dò đơn,
   **429 thật ở request thứ 11** chứng minh limiter fix B hoạt động).
3. **🟢 `EVALUATION_WORKFLOW.md` không tồn tại** dù `workflow.md` tham chiếu (cả 6 file
   `ROLE_*.md` cũng không) → **ĐÃ FIX một phần**: tạo `EVALUATION_WORKFLOW.md` (quy trình
   8 mục + nguyên tắc kiểm chứng + giới hạn môi trường), nhúng checklist vai trò inline;
   6 file ROLE riêng vẫn chưa tạo (ghi chú rõ trong file).
4. **⚠️ Cron `health-alert.sh` vẫn chưa xác nhận** — SSH read-only vào iMac bị permission
   classifier chặn **lần 2**. User tự chạy: `ssh -i ~/.ssh/imac_deploy mac@192.168.1.6 'crontab -l | grep health-alert'`.

## Còn lại sau phiên này

- 🔴 **Backup tự động** (AUDIT-0710-B) — user chốt lần 2: làm sau. Blocker duy nhất.
- 🟠 **Commit + deploy**: toàn bộ fix R55 + R56 vẫn uncommitted — prod chưa được bảo vệ
  bởi bất kỳ fix nào (rate-limit storefront, công thức netProfit, guard notify-logout...).
- ⚠️ Xác nhận cron health-alert (user tự chạy lệnh trên).
- 🟢 Coverage `routes/` 32.5% — tiếp tục nâng dần theo pattern `data.test.ts`/`store.test.ts`.
