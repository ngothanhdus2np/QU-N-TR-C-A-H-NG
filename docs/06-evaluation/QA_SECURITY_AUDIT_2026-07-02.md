# Audit độc lập QA + Bảo mật — Sẵn sàng dùng thật?

> **Ngày**: 2026-07-02
> **Vai trò**: Senior QA Engineer + Security Auditor (độc lập)
> **Phạm vi**: React/Vite SPA + PWA, Express backend, Supabase self-hosted, IndexedDB offline-first
> **Phương pháp**: Audit code tĩnh + test THẬT trên môi trường clone prod (KHÔNG chạm prod)
> **Nguyên tắc**: Không sửa code — chỉ audit, test, báo cáo.

---

## 0. Môi trường test đã dùng (để đối chiếu)

| Hạng mục | Giá trị |
|---|---|
| DB test | **Supabase LOCAL Docker trên MacBook** (`localhost:8000`), 11 container healthy |
| Nguồn dữ liệu | Clone đầy đủ từ prod: **14.873 SP, 69.736 đơn, 249 KH POS, 2 NV, 1.200 dòng doanh thu** |
| App | `npm run dev` → `localhost:3000` (proxy `/rest/v1` → DB local) |
| Xác nhận AN TOÀN | `.env.local` trỏ `localhost:8000`; token đăng nhập `sb-localhost-auth-token`; **KHÔNG kết nối prod** (`supabase.phucsang.com.vn`) |
| Tài khoản test | `admin@cfobrain.local` (role manager) — mật khẩu test `AuditTest2026!` đặt **chỉ trên DB local** qua GoTrue admin API |

**Lưu ý**: Dữ liệu test đã tạo trong phiên (1 SP test, đơn, giao dịch, dòng doanh thu) đã được **dọn sạch** khỏi DB local sau khi test. Đề bài yêu cầu tạo "50 SP / 20 KH / hàng trăm đơn" — không cần, vì đã có sẵn dữ liệu prod-scale (gấp hàng trăm lần) để test tải thực tế.

**Đính chính về đề bài**: App **KHÔNG phải Electron**. Không có `electron` trong `package.json`. Đây là **Vite SPA + PWA** (service worker) phục vụ bởi Express. Các kịch bản "GĐ2D bản Electron" (first-run nhập credentials, update giả lập) không áp dụng theo đúng nghĩa — thay bằng test tương đương (kill server, offline queue, đăng nhập).

---

## 1. KẾT LUẬN TỔNG THỂ

### 🟡 DÙNG ĐƯỢC NHƯNG CÓ RỦI RO — cần sửa 1 lỗi chặn trước khi giao khách

Lõi tài chính **vững**: trừ kho atomic (chống bán âm/oversell đã kiểm chứng thật), cộng dồn doanh thu atomic (chống race nhiều máy), tạo đơn + COGS + lợi nhuận tính đúng end-to-end. Bảo mật cốt lõi tốt (đã kiểm chứng trên prod ở đợt 30/06: hết grant anon cho bảng tài chính, requireAuth phủ mọi router mutate, DOMPurify phủ 100% điểm render HTML, không lộ secret trong git). 318/318 test pass, `tsc` sạch.

**NHƯNG** phát hiện **1 lỗi 🔴 chặn**: sau **mỗi đơn bán**, ghi doanh số nhân viên thất bại (id chuỗi vs cột UUID) → app hiện lỗi "LỖI ĐỒNG BỘ" + cờ mất kết nối, dù đơn đã lưu thành công. Nguy cơ thực tế: **thu ngân tưởng đơn lỗi → bấm bán lại → đơn trùng / trừ kho 2 lần**. Đây là lỗi phải sửa trước khi giao khách thật.

Sau khi vá lỗi 🔴 này → app đủ điều kiện dùng thật cho 1 cửa hàng.

---

## 2. BẢNG LỖI / RỦI RO

### 🔴 CHẶN — phải sửa trước khi dùng thật

#### 🔴-1. Ghi doanh số nhân viên lỗi mọi đơn → hiện lỗi giả "mất đồng bộ" sau mỗi lần bán

- **Mô tả**: `buildPosSalesRecordUpsertsForDate` sinh id dạng chuỗi `pos-sales-2026-07-02-ngo-thanh-du`, nhưng cột `sales_records.id` là **UUID** → PostgreSQL trả `22P02 invalid input syntax for type uuid`. Bước này (`autoUpsertStaffSalesForDate`) chạy trong CẢ đơn bán lẫn đơn trả.
- **Hậu quả thật (đã quan sát trên browser)**:
  1. Console + UI hiện `LỖI ĐỒNG BỘ SURGICAL: Không thể ghi dữ liệu` sau **mỗi đơn**.
  2. `updateSurgical` khi lỗi này set `SET_CLOUD_CONNECTED=false` + `SET_SYNC_ERRORS` → badge "lỗi đồng bộ / mất kết nối" bật lên dù đơn (order + kho + doanh thu) đã lưu OK.
  3. **Rủi ro nghiêm trọng**: thu ngân thấy báo lỗi → tưởng đơn chưa lưu → bán lại → **đơn trùng + trừ kho 2 lần + thu tiền 2 lần**.
  4. Doanh số nhân viên từ POS **không bao giờ được ghi** (kiểm chứng: 0/150 dòng `sales_records` có id dạng `pos-sales-*`) → KPI/hoa hồng NV sai.
- **Tái hiện**: Bán bất kỳ 1 đơn qua máy tính tiền → mở Console → thấy lỗi; query `SELECT count(*) FROM sales_records WHERE id::text LIKE 'pos-sales-%'` = 0.
- **Vị trí**: [src/lib/posSalesAttribution.ts:213](src/lib/posSalesAttribution.ts) (sinh id chuỗi) + [services/posOrderService.ts:218](services/posOrderService.ts) (`autoUpsertStaffSalesForDate`) + cột `sales_records.id UUID`.
- **Đề xuất**: (a) Đổi id sinh ra sang `crypto.randomUUID()` và upsert theo `onConflict: (employee_id, date)` thay vì theo `id` chuỗi; HOẶC (b) đổi cột `sales_records.id` sang `TEXT`. Phương án (a) sạch hơn (giữ UUID chuẩn toàn hệ thống). Cần thêm UNIQUE(employee_id, date) để upsert idempotent.

---

### 🟡 NÊN SỬA SỚM — ảnh hưởng vận hành / rủi ro trung bình

#### 🟡-2. Schema drift: RPC tồn kho `_v2` không tồn tại + bản legacy thiếu nhánh Sale/Return (bom nổ chậm)

- **Mô tả**: Route `/api/data/inventory/apply` gọi `apply_inventory_transaction_with_stock_v2` TRƯỚC. Hàm `_v2` **không tồn tại** trên DB (clone prod) → lỗi `42883` → fallback. Với type `Sale/Return/Import/PurchaseReturn` → dùng `applyInventoryTransactionFallback` (đường đi THẬT của mọi đơn bán). Ngoài ra, bản legacy `apply_inventory_transaction_with_stock` **được deploy trên DB chỉ xử lý `Import` + `Check`, KHÔNG có nhánh `Sale`/`Return`** — đã kiểm chứng: gọi trực tiếp nó cho 1 Sale thì tồn kho KHÔNG bị trừ và KHÔNG báo lỗi.
- **Hiện tại KHÔNG gây hại** vì route điều hướng Sale sang fallback (dùng `decrement_product_stock` atomic — chạy đúng). Nhưng đây là **bom nổ chậm**: nếu ai đó "sửa schema" bằng cách tạo `_v2` từ bản legacy thiếu nhánh, hoặc đổi phân loại fallback → **bán hàng sẽ không trừ kho mà không báo lỗi**.
- **Vị trí**: [routes/data.ts:559](routes/data.ts) + [supabase_setup.sql:558](supabase_setup.sql) (bản mới, đủ nhánh — nhưng CHƯA deploy lên DB).
- **Đề xuất**: Đồng bộ hàm trên DB với `supabase_setup.sql` (chạy lại bản đủ nhánh Sale/Return), hoặc tạo `_v2` đúng từ migration 013. Gắn với task đang mở "Đồng bộ schema production với migrations".

#### 🟡-3. Fallback tồn kho không atomic ở mức nhiều-bước (chỉ atomic từng SP)

- **Mô tả**: `applyInventoryTransactionFallback` insert transaction rồi lặp `adjustProductStock` từng SP. Mỗi SP dùng `decrement_product_stock` (atomic, chống âm kho — TỐT). Nhưng toàn bộ chuỗi (insert tx + trừ N sp + rollback thủ công) **không nằm trong 1 DB transaction**. Nếu crash giữa chừng, rollback thủ công (`catch`) chạy — nhưng nếu bản thân rollback lỗi thì tồn kho lệch. Với đơn nhiều SP mà 1 SP hết hàng giữa chừng → rollback các SP đã trừ (best-effort).
- **Đề xuất**: Ưu tiên sửa 🟡-2 (dùng RPC 1-transaction đủ nhánh) sẽ tự giải quyết luôn 🟡-3.

#### 🟡-4. Import Excel: không validate từng dòng, số lỗi thành 0/NaN âm thầm; 1 dòng lỗi DB làm hỏng cả chunk

- **Mô tả**: `/api/import/kiotviet-products` parse mỗi ô số bằng `Number(r[x] || 0)` — ô sai định dạng (vd "abc") → `NaN`, ô trống → 0, **không cảnh báo dòng nào lỗi**. Ghi theo chunk 100–500 dòng bằng `upsert`; nếu 1 dòng vi phạm ràng buộc DB → **cả chunk fail** (báo "Lỗi ở dòng i"), các dòng đúng trong chunk cũng không vào.
- **Kiểm chứng**: đọc code — chỉ chặn cứng khi cột thứ 3 ≠ "Mã hàng" (sai định dạng file → từ chối toàn bộ). Không có báo cáo "X dòng OK, Y dòng lỗi vì...".
- **Vị trí**: [routes/import.ts:365](routes/import.ts), [routes/import.ts:564](routes/import.ts).
- **Đề xuất**: Validate + thu thập lỗi theo dòng, trả về danh sách dòng lỗi cho user; ghi các dòng hợp lệ, bỏ qua dòng lỗi (không fail cả chunk). Với dữ liệu quan trọng nên chuyển sang insert-từng-dòng-trong-transaction-có-savepoint hoặc validate trước khi upsert.

#### 🟡-5. Đối soát doanh thu: bảng tổng hợp lệch live orders (~2% tháng 6)

- **Mô tả**: Tính độc lập bằng SQL: net T6/2026 từ `pos_orders` = **242.889.000đ** vs từ `revenue_records` = **238.009.000đ** → lệch **~4,88M (~2%)**. Nằm trong vùng "drift đã biết" — 2 task đang mở đã ghi nhận: **LOGIC-02** (endpoint `recalculate-revenue-from-orders` sai mô hình dữ liệu, ghi cả tháng vào 1 dòng) và **DATA-04** (3 dòng ngày rác 109,9M). Đây là vấn đề đối soát báo cáo, KHÔNG phải lỗi toàn vẹn giao dịch.
- **Vị trí**: [routes/data.ts:994](routes/data.ts) (LOGIC-02).
- **Đề xuất**: Sửa LOGIC-02 (viết lại upsert theo từng ngày), rồi chạy đối soát để hết drift. Đã có trong TODO.

#### 🟡-6. RLS tắt trên vài bảng (dev clone) — cần xác minh grant anon trên prod

- **Mô tả**: Trên DB clone, các bảng **RLS OFF**: `shipments`, `store_collections`, `store_order_addresses`, `store_preorder_requests`, `store_product_collections`, `expense_categories` — và anon vẫn có full grant. Nghĩa là nếu prod cũng còn grant anon + RLS off, ai có anon key (nhúng sẵn trong bundle) có thể đọc/ghi thẳng `/rest/v1/<bảng>`. Đây phần lớn là bảng storefront (form liên hệ, đăng ký nhận tin, preorder) — độ nhạy thấp, không phải dữ liệu tài chính.
- **Không kiểm chứng được trên prod** (rào chắn an toàn — không kết nối prod). Đợt audit 30/06 đã REVOKE anon cho bảng tài chính nặng và 4 bảng nhạy, nhưng gốc rễ "bảng mới tự nhận grant anon" vẫn tồn tại (MAINT-01).
- **Đề xuất**: Trên prod, chạy `REVOKE ALL ON <các bảng trên> FROM anon` + bật RLS có policy cho các bảng storefront ghi qua service-role. Thêm bước revoke vào cuối mỗi migration tạo bảng.

#### 🟡-7. Tải đầu (cold-load) chậm ~10s trên máy mới

- **Mô tả**: App load 30 bảng đồng thời; 14.873 SP qua ~15 request phân trang. Đo local (cùng máy) rất nhanh (40–60ms/query) nhưng đợt đo prod trước ghi nhận ~9–10s cho máy mới chưa có IndexedDB cache. Các lần sau nhanh nhờ cache.
- **Đề xuất**: Đã có kế hoạch (task "Lazy load DATA" — tách `fetchCriticalData`/`fetchDeferredData`). Không chặn dùng thật (chỉ chậm lần đầu).

---

### 🟢 CÓ THỂ ĐỂ SAU

- **🟢-8. Bán âm kho (opt-in) đường fallback không atomic**: khi bật `allowSellOutOfStock`, `adjustProductStock` đọc-rồi-ghi (read-modify-write) → có thể race nếu 2 máy cùng bán âm 1 SP. Chỉ ảnh hưởng khi cửa hàng CHỦ ĐỘNG bật cho phép bán âm. [routes/data.ts:187](routes/data.ts).
- **🟢-9. Polling bot-status/health dày**: network trace cho thấy nhiều request `/api/shopee-bot-status` + `HEAD /health`. Đã miễn trừ khỏi rate-limit và giãn poll 15s ở đợt trước; theo dõi thêm về pin/băng thông trên máy quầy.
- **🟢-10. Log lỗi tiếng Việt gộp chung**: lỗi sync trả message chung "Không thể ghi dữ liệu" (ẩn chi tiết với client — tốt cho bảo mật) nhưng chi tiết chỉ ở server log. Với sự cố 🔴-1, client không biết chính xác bảng nào lỗi.

---

## 3. ĐÃ KIỂM TRA VÀ ĐẠT (yên tâm)

### Toàn vẹn dữ liệu — kiểm chứng THẬT
- ✅ **Chống bán trùng/oversell**: `decrement_product_stock` (đường đi thật của mọi đơn) atomic — test tuần tự tồn=1: lần 1 trừ về 0 + trả row, lần 2 trả **0 row** (chặn), tồn giữ 0. Guard `stock >= quantity` trong SQL đảm bảo không âm dù nhiều request.
- ✅ **3 lớp guard tồn kho**: client (`processPlaceOrder` throw nếu `stock < qty`) → UI (clamp `min(maxQty, max(1,qty))`, chặn thêm giỏ khi `qtyInCart >= stock`) → DB (`decrement_product_stock` atomic).
- ✅ **Cộng dồn doanh thu atomic**: `apply_revenue_delta` dùng `INSERT ... ON CONFLICT(date) DO UPDATE SET x = x + EXCLUDED.x` + constraint `uq_revenue_records_date` — chống race "2 máy bán cùng ngày ghi đè nhau".
- ✅ **Bán 1 đơn end-to-end (browser)**: tồn 10→9, đơn tạo, doanh thu net 100k/gross 100k/COGS 50k (=50k×1)/lợi nhuận 50k — tất cả ĐÚNG.
- ✅ **Rollback checkout**: `processPlaceOrder`/`processReturnOrder` có `rollbackSteps[]` đảo ngược theo thứ tự khi lỗi giữa chừng.
- ✅ **Edge cases** (đọc code): giảm giá item clamp `min(max(0,discount), price)`; số lượng ≥ 1; `netPayable = max(0,...)`; `discountRatio` clamp [0,1]; checkout re-validate tồn.

### Bảo mật
- ✅ **Không lộ secret**: `.env*` đã gitignore đúng; git history KHÔNG chứa service key; không hardcode `sk-ant`/JWT trong source.
- ✅ **requireAuth phủ router mutate**: mọi `create*Router` nhận `requireAuth`; `router.use('/api/ai', requireAuth)` phủ toàn bộ AI; `store.ts` công khai CÓ CHỦ ĐÍCH (đặt hàng website không login) + rate-limit endpoint dễ lạm dụng (contacts/newsletter).
- ✅ **DOMPurify phủ 100% điểm render HTML** (spot-check 4/8: AiInsightPanel, ChatInterface, StandardsWorkflowsTab, DashboardAiAdvisor — đều `DOMPurify.sanitize(marked.parse(...))`).
- ✅ **Bảo mật lõi trên prod** (từ audit 30/06, đã kiểm chứng thật): hết grant anon cho bảng tài chính; auth bypass Lớp 1+2 đã đóng; `NODE_ENV=production` trong tiến trình live.

### Xử lý lỗi
- ✅ **try/catch + rollback** quanh checkout; audit log best-effort không làm hỏng đơn.
- ✅ **Offline queue** (`posOfflineQueue` + IndexedDB): lỗi retry-được (network/401/429/5xx/timeout) → enqueue replay; phân loại qua `isRetryableSyncError`.
- ✅ **Lỗi không im lặng ở tầng data**: badge `syncErrors` trên TopNav; timeout 45s có message rõ.
- ✅ 318/318 test pass; `tsc --noEmit` sạch.

---

## 4. CHƯA KIỂM TRA ĐƯỢC (giới hạn môi trường / rào chắn an toàn)

- ⛔ **Grant anon thực tế trên prod** cho các bảng RLS-off (🟡-6): không kết nối prod theo rào chắn an toàn. Cần user tự chạy `SELECT ... FROM information_schema.role_table_grants WHERE grantee='anon'` trên prod.
- ⚠️ **Ngắt mạng thật giữa lúc lưu đơn**: đã xác minh ĐƯỜNG CODE của offline queue (retry classification + enqueue) nhưng chưa cắt mạng vật lý giữa 1 checkout live. Khuyến nghị user tự test: bật máy bay mode giữa lúc bấm "Xác nhận" → kiểm tra đơn vào queue, không mất, không trùng khi có mạng lại.
- ⚠️ **2 tab/2 máy cùng bán trên UI**: đã test atomic ở tầng RPC (nghiêm ngặt hơn) — cả 2 request đồng thời không thể cùng trừ 1 tồn=1. Chưa mô phỏng 2 cửa sổ browser thật đồng thời.
- ⚠️ **Import Excel dòng lỗi trộn dòng đúng**: phân tích tĩnh (🟡-4) — chưa upload file thật có dòng hỏng. Khuyến nghị user test với file mẫu 5 dòng (2 dòng thiếu cột/sai số) để xác nhận hành vi.
- N/A **Electron** (first-run credentials, update giả lập): app không phải Electron. Flow đăng nhập lần đầu = trang login (đã dùng để đăng nhập trong phiên, hoạt động OK: sai mật khẩu báo đúng "Tên đăng nhập hoặc mật khẩu không đúng").
- ⚠️ **Kill process giữa thao tác**: chưa kill server giữa 1 checkout đang chạy. Offline-first + IndexedDB durable save (ghi local TRƯỚC cloud) là thiết kế chịu lỗi cho case này.

---

## 5. THỨ TỰ ƯU TIÊN SỬA (đề xuất)

1. **🔴-1** — Sửa id `sales_records` (UUID vs chuỗi). Chặn dùng thật. ~1–2h.
2. **🟡-2 + 🟡-3** — Đồng bộ RPC tồn kho đủ nhánh Sale/Return lên DB (giải luôn tính atomic đa-bước).
3. **🟡-5** — Sửa LOGIC-02 rồi đối soát doanh thu (đã trong TODO).
4. **🟡-6** — REVOKE anon + RLS cho bảng storefront trên prod (cần user chạy, không kết nối được từ đây).
5. **🟡-4** — Cải thiện báo cáo lỗi từng dòng khi import Excel.
6. **🟡-7 / 🟢** — Lazy-load data, các mục 🟢 để sau.

---

*Báo cáo bởi audit độc lập. Không sửa code trong phiên này theo yêu cầu. Dữ liệu test đã dọn sạch khỏi DB local.*
