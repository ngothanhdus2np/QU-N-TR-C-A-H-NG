# Audit Production-Readiness toàn diện — CFO Brain 4.0

> **Ngày**: 2026-07-10
> **Branch**: `feat/online-audit-shopee`
> **Phạm vi**: React/Vite SPA + PWA, Express backend, Supabase self-hosted, offline-first — trọng tâm mới: tính năng Shopee Ads spend tracking (uncommitted, chưa từng audit)
> **Phương pháp**: Audit tĩnh toàn codebase (4 agent song song: nghiệp vụ, bảo mật, dữ liệu/hiệu năng/test, vận hành/UX) + `tsc --noEmit` (sạch) + `vitest run --coverage` (981/981 pass, 53% statements toàn project). Đối chiếu 3 đợt audit trước (06-29, 06-30, 07-02/03) để spot-check mục đã vá, đào sâu phần chưa audit.
> **Nguyên tắc**: chỉ audit + báo cáo (trừ blocker RLS được vá ngay theo yêu cầu user).

---

## 0. KẾT LUẬN TỔNG THỂ

**Lõi giao dịch tài chính (bán hàng, tồn kho, trả hàng) đã vững** — các lỗ hổng lớn từ audit trước đều đã vá thật, không hồi quy. Rủi ro thật nằm ở 2 chỗ:
1. Tính năng Shopee Ads mới (chưa qua vòng kiểm nào) lặp lại đúng lỗi RLS mà audit R3 đã cảnh báo — **1 blocker bảo mật**.
2. Tầng vận hành (backup, alerting, rollback) gần như chưa có — **backup tự động là điểm yếu nhất toàn hệ thống**.

**Mức độ**: Dùng thật nội bộ được (đang dùng), nhưng chưa đạt chuẩn "sổ sách duy nhất không lưới an toàn". Đóng blocker #1 + #2 thì đạt mức "sẵn sàng production có kiểm soát".

---

## 1. Nghiệp vụ cốt lõi — 🟢 ĐẠT (1 bug ở tính năng mới)

| Mục | Trạng thái | Bằng chứng |
|---|---|---|
| Tạo/sửa/hủy/xóa/trả đơn qua RPC transaction | ✅ Đạt | `place_pos_order_tx` (029), `edit_pos_order_tx` (028), `delete_pos_order_tx` (026), `cancel_pos_return_tx` (027) — đều `SECURITY DEFINER` + `SET search_path=public`, lỗi tự rollback |
| Làm tròn tiền | ✅ Chấp nhận được | NUMERIC + Number() nhất quán client/SQL |
| Chống oversell / race tồn kho | ✅ Đạt | RPC v2 (022) guard `UPDATE...WHERE stock>=qty`, đã test song song thật đợt R3 |
| Merge logic offline-first | ✅ Không vi phạm | `dataMapper.ts` chỉ thêm 1 dòng mapping `shopeeAdsFee` |

**⚠️ Bug mới (nên sửa)** — `components/revenue/useShopeeInventoryOut.ts:542-562`: khối cập nhật đơn cùng ngày khi thêm dòng thủ công **không lọc `platform`** (ads Shop 1 áp nhầm lên đơn Shop 2), **không dùng `isEffectiveOrder()`** (áp cả lên đơn hủy), **hard-code `adsTax=0`** thay vì nhân `ADS_TAX_RATE`. 2 hàm anh em cùng file (dòng 356-397, 399-464) đã làm đúng — chỗ này bị bỏ sót khi refactor.

**⚠️ FORMULAS.md sai vs code (nên sửa)** — §10.2b/c viết "đơn hiệu quả = `shopeeAdsFee>0`" nhưng code đã đổi sang `status ∈ {OK,SHIPPING}` từ 2026-07-09 (`routes/adsSpendSync.ts:10-14`). §10.2c claim "không ghi net_profit" nhưng `adsSpendSync.ts:221` có ghi. Vi phạm quy trình workflow.md.

---

## 2. Bảo mật — 🔴 1 BLOCKER (đã vá trong phiên này)

**🔴 BLOCKER — 2 bảng Ads mới thiếu RLS** (migration 032/033): `shopee_ads_daily_spend`, `shopee_ads_wallet_transactions` tạo mới không có `ENABLE RLS`/`POLICY`/`REVOKE anon`. Vì DEFAULT PRIVILEGES của `supabase_admin` có thể vẫn cấp anon full CRUD (R3 đã cảnh báo migration 024 không gỡ được phần này), anon key công khai có thể đọc/ghi/xóa dữ liệu tài chính quảng cáo qua `/rest/v1`.
→ **ĐÃ VÁ**: tạo `supabase_migrations/034_lock_anon_shopee_ads_tables.sql` + cập nhật `supabase_setup.sql`. **CÒN LẠI**: user chạy migration 034 trên prod (`apply-migrations.sh --prod` hoặc `docker exec ... psql`) + verify anon key thật trả 401/42501.

**🟡 XSS (nên sửa)** — 12/14 chỗ `dangerouslySetInnerHTML` KHÔNG wrap `DOMPurify.sanitize()` (vi phạm rule codebase.md). Chỉ 2 chỗ đúng (`PromotionAiPanel.tsx:82`, `DiagnosisTab.tsx:93`). Nguy hiểm nhất: render output AI (`ChatInterface.tsx:716`, `AiInsightPanel.tsx:55`, `DashboardAiAdvisor.tsx:45`) — prompt-inject → script chạy trong DOM; CSP không đỡ vì cho phép `unsafe-inline/eval`.

**🟡 4 GET endpoint lộ dữ liệu tài chính (nên sửa)** — `routes/notifications.ts`: `/api/eod-report`, `/api/alerts`, `/api/alerts/config`, `/api/notifications/status` không có `requireAuth`. Báo cáo cuối ngày chứa doanh thu thật.

**🟢 Đạt**: SQL injection (Supabase client parameterized), auth verify signature thật (`server.ts:541`), Auth Bypass LAN đã gỡ, phân quyền role chặt, rate-limit `/auth/v1/token`, secrets (`.env.local` chưa từng commit, CORS whitelist, INTERNAL_API_KEY không lộ frontend), SEC-SECRET-01 ghi nhận đúng.
**Điểm trừ nhỏ**: `/api/auth/verify-manager` nên chuyển từ `apiLimiter` (1000/15p) sang `authLimiter` (20/15p); `/api/channels/notify-logout` thiếu guard IP/token.

---

## 3. Dữ liệu & xử lý lỗi — 🟡 ĐẠT MỘT PHẦN

- **Validate backend — CHƯA ĐẠT**: `/api/data/upsert` (generic, ~25 bảng) chỉ check tồn tại rồi upsert payload `any` — không chặn giá âm/NaN/chiết khấu>100%. `adsSpendSync.ts:199`/`inventoryOutSync.ts` ghi số từ bot không qua `Number.isFinite()`. Không có CHECK constraint DB-level trên cột tiền.
- **File upload — ĐẠT TỐT**: `src/lib/excelSafety.ts` — magic bytes, 10MB, 50k dòng, in-memory (không path traversal).
- **Transaction luồng phụ**: `inventoryOutSync` idempotent tốt (upsert UNIQUE order_id,sku). Nhưng `runAdsSpendSync` (`adsSpendSync.ts:213`) update **từng dòng** — lỗi giữa chừng để ngày nửa cập nhật (tự lành sau 30p). → gom batch upsert.
- **Thiếu `auditLog()` — CHƯA ĐẠT**: job Ads ghi đè `ads_cost`/`net_profit` mỗi 30p không ghi `audit_logs` (vi phạm rule).
- **Logging — CHƯA ĐẠT**: `errorTracking.ts:15` Sentry `false` chưa bật, chỉ `console.error` (mất khi rotate); `errorHandler` log `req.body` không redact.

---

## 4. Hiệu năng — 🟡 CHẤP NHẬN ĐƯỢC, THIẾU INDEX

- **Thiếu index**: `pos_orders(date)`, `pos_products(sku)`, `shopee_inventory_out(date,platform)` — cột filter chính. Chưa đau (DB nhỏ ~70k đơn, query 3-7ms) nhưng sẽ chậm dần. 2 bảng Ads mới có UNIQUE+index đầy đủ (tốt).
- N+1 duy nhất ở fallback path ít dùng (`data.ts:294-326`) — chấp nhận được.
- Batch/pagination đúng chuẩn. 1 chỗ `.limit(5000)` (customer-debt-history) vượt rule 2000.
- **Cache — ĐẠT**: `aiCache` invalidate theo hash+TTL 4h, `appDataCache` IndexedDB clear đồng bộ 2 tầng.

---

## 5. Sao lưu & khôi phục — 🔴 ĐIỂM YẾU NHẤT

- **Backup tự động — CHƯA CÓ**: `sync-prod-to-dev.sh` có pg_dump nhưng **chạy tay**. Kế hoạch `backup-mega.sh`+launchd trong TODO nhưng file **không tồn tại**. 2 file `backup_2026*.sql` ở root **0 byte** (backup từng fail âm thầm). → Ổ cứng iMac hỏng = mất dữ liệu từ lần cuối nhớ chạy tay.
- **Crash giữa giao dịch — ĐẠT** (Postgres WAL + luồng tiền là RPC transaction).
- **Rollback deploy — CHƯA CÓ**: `deploy-imac.sh` rsync `--delete` đè bản cũ, health-check fail chỉ in cảnh báo. Migration có `--single-transaction` (tốt) nhưng code không có đường lùi.

---

## 6. Trải nghiệm người dùng — 🟡 ĐẠT MỘT PHẦN

- **Thông báo lỗi — CHƯA ĐẠT**: nhiều nơi hiện thẳng `err.message` tiếng Anh (vd `ShopeeProductsPage.tsx:253`, `WebsiteProductsPage.tsx:191` dùng `alert()` native).
- **Mất mạng — ĐẠT**: offline queue IndexedDB có coalesce + retry cap 5 + check server thật reachable, banner tiếng Việt. Lưu ý: `service-worker.js:194-267` có Background Sync **chết** (trỏ IndexedDB khác) — nên dọn.
- **PWA/máy cũ — ĐẠT**: network-first HTML/JS, cache-first ảnh ≤1.5MB, không cache API data. Responsive dùng breakpoint Tailwind mặc định — cần test tay trên màn hình cũ.

---

## 7. Kiểm thử — 🟡 LỆCH TẦNG

- Toàn project **53% statements** nhưng **`routes/` chỉ 0.89%** — 981 test toàn pure function, KHÔNG test nào chạm Express route handler.
- CHƯA có test: `routes/adsSpendSync.ts` + `routes/inventoryOutSync.ts` (mới, 0%), route hủy phiếu trả, fallback transaction. CÓ test: doanh thu/trả hàng (gián tiếp), `posOrderService` (~68%), `auditService` (97%), import parser (100%).
- Ưu tiên: `runAdsSpendSync`/`runInventoryOutSync` đã export sẵn → mock Supabase client test được ngay.

---

## 8. Vận hành & giám sát — 🔴 CHƯA ĐẠT

- **`/health` trả `'OK'` cứng** (`server.ts:181`) — không check DB → deploy báo thành công dù Supabase chết.
- **Alerting hạ tầng — KHÔNG CÓ**: alert hiện có toàn nghiệp vụ (hết hàng, công nợ). App/bot down → launchd restart im lặng, không ai biết.
- **Secrets — ĐẠT**. **Runbook rollback/sự cố — KHÔNG CÓ** trong `docs/03-deployment/`.

---

## 9. TỔNG HỢP HÀNH ĐỘNG

### 🔴 Blocker — BẮT BUỘC trước khi tin dùng hoàn toàn
1. **RLS 2 bảng Ads** — ✅ đã tạo migration 034 + sửa setup.sql; **user chạy trên prod + verify anon key**.
2. **Backup tự động** — triển khai kế hoạch backup định kỳ đã có sẵn trong TODO (backup-mega.sh + launchd).

### 🟡 Nên sửa sớm (không chặn go-live nội bộ)
3. DOMPurify cho 12 chỗ `dangerouslySetInnerHTML` (ưu tiên 3 chỗ AI).
4. `requireAuth` cho 4 GET `notifications.ts`.
5. Bug phân bổ Ads không lọc platform + adsTax=0 (`useShopeeInventoryOut.ts:542-562`).
6. Sửa FORMULAS.md §10.2b/c khớp code.
7. `auditLog()` cho job Ads + `Number.isFinite()` guard số liệu bot.
8. `/health` check DB thật + cron alerting hạ tầng qua Zalo.
9. Deploy versioned + runbook rollback; 3 index thiếu; `translateError()` tiếng Việt.
10. Test `runAdsSpendSync`/`runInventoryOutSync`; batch update thay per-row trong `adsSpendSync`.

### 🟢 Đã vững
Lõi POS (5 RPC transaction), oversell atomic, RLS bảng cũ, rate-limit login, secrets, offline-first, PWA, cache, import Excel an toàn, dataMapper nguyên vẹn, tsc sạch + 981/981 test.
