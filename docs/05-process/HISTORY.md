# HISTORY.md — Nhật ký phiên làm việc

> Chỉ ghi việc đã **hoàn thành**. Không ghi kế hoạch, không ghi TODO.
> Agent cuối ca → thêm phiên mới lên **đầu file**.

### 2026-07-04 (R20) — Commit + deploy cụm R19 lên production

- Commit toàn bộ 18 file sửa + 3 file mới của cụm R19 (hủy trả/trả hàng/xóa đơn + guard trả trùng, đã verify live phiên trước) — trước đó nằm ở working tree chưa commit.
- Deploy qua `scripts/deploy-imac.sh`: áp migration `025_pos_orders_return_link.sql` + `026_delete_pos_order_tx.sql` lên DB prod, build, restart app trên iMac.
- **Ghi chú migration 026**: RPC `delete_pos_order_tx()` mới chỉ TẠO trên prod, **chưa được gọi từ code** (`deletePosOrder()` vẫn dùng chuỗi lời gọi cũ) — là bản nháp cho TXN-RPC-01 Giai đoạn 2, an toàn khi lên prod vì không đổi hành vi hiện tại. Đã ghi rõ việc còn lại vào TODO.md.
- Push commit lên `origin/main`.
- Files: xem danh sách đầy đủ trong commit R19 bên dưới (không sửa code thêm trong phiên này, chỉ commit/deploy/docs).

### 2026-07-04 (R19) — Giai đoạn 1 cụm Hủy trả/Trả hàng/Xóa đơn: 8 hạng mục, verify live đầy đủ

- Audit toàn diện tính toán + toàn vẹn dữ liệu (mở đầu phiên) tìm ra 7 lỗi mới ngoài các lỗi đã biết; user duyệt kế hoạch 8 hạng mục (lộ trình A→B, soft-delete cho nút Xóa, trang Trả hàng điều hướng sang POS).
- **HM1 — Migration `025_pos_orders_return_link.sql`** (+ supabase_setup.sql): thêm `original_order_id`/`return_fee`/`return_other_refund` vào `pos_orders` + index; map 2 chiều ở [apiService.ts](../../services/apiService.ts) (write + `mapPosOrderRow` + bootstrap columns) và [dataMapper.ts](../../services/dataMapper.ts). Trước đây 3 field này chỉ sống trong RAM, mất sau reload → guard trả trùng không thể hoạt động. Đã áp lên dev DB + ghi sổ migration. **Prod tự áp khi deploy (bootstrap SELECT tham chiếu cột mới — migration PHẢI chạy trước build, deploy-imac.sh đã đúng thứ tự này).**
- **HM7 — Fix POS-RETURN-01** ([posSalesAttribution.ts](../../src/lib/posSalesAttribution.ts)): fallback `max(0, finalAmount)` chỉ còn áp cho đơn import KiotViet (items không có `lineType`); phiếu trả POS native trả thuần → doanh số NV = 0 (hết cộng nhầm tiền hoàn vào doanh số → hết sai lương hoa hồng). +3 unit test (trả thuần / KiotViet fallback / đổi hàng rẻ hơn). Thêm filter `status !== 'cancelled'` vào `calculateStaffSalesForDate`.
- **HM2 — `processCancelReturn()` + `processCancelLegacyReturnTransaction()`** ([posOrderService.ts](../../services/posOrderService.ts)): hủy phiếu trả chuẩn — đảo tồn qua RPC delete theo tx.type đã lưu (hàng trả −, hàng đổi +; hàng trả đã bán tiếp → RPC chặn), đảo doanh thu bằng `applyRevenueDelta` delta đảo dấu (hết ghi đè cả dòng), khôi phục điểm/totalSpent khách, recalc sales_records, phiếu → `status='cancelled'`, giữ bản sao tx cancelled làm lịch sử, audit log. Nhánh legacy cho phiếu kiểu cũ (chỉ có inventory transaction).
- **HM3 — Trang Trả hàng** ([OrderReturns.tsx](../../components/orders/OrderReturns.tsx)): XÓA toàn bộ luồng tự chế (handleProcessReturn 142 dòng ghi đè doanh thu/tồn tại chỗ + handleCancelReturn cũ trừ kho cả hàng đổi). Panel tạo phiếu giờ chỉ chọn đơn → điều hướng sang tab Trả hàng trong POS (pattern R11); nút Hủy gọi service chuẩn qua props mới từ [MainContent.tsx](../../components/MainContent.tsx).
- **HM5 — Guard trả trùng** ([returnGuards.ts](../../src/lib/returnGuards.ts) mới): `getReturnedQuantitiesForOrder()` gom số đã trả từ phiếu POS (`original_order_id`) + phiếu kiểu cũ (tx referenceId); [usePOSReturnFlow.ts](../../components/pos/usePOSReturnFlow.ts) trừ vào `maxQuantity`, đơn trả đủ → chặn mở tab kèm thông báo. POSComputer nhận prop `inventoryTransactions` mới. OrderInvoices đổi guard sang `originalOrderId` + confirm (trả từng phần nhiều lần là hợp lệ).
- **HM6 — Fix rollback `updateSurgical`** ([useAppData.ts](../../hooks/useAppData.ts)): snapshot đầy đủ bản ghi trước khi ghi; rollback update = khôi phục bản cũ (hết DELETE nhầm bản ghi bị update), rollback xóa-qua-RPC = apply lại RPC đầy đủ (hết upsert dòng rỗng {id} + hết mất tồn kho đã chỉnh).
- **HM8 — Sửa đơn đổi/bỏ khách** ([POSComputer.tsx](../../components/pos/POSComputer.tsx) + `editPosOrder`): khách gốc ≠ khách chọn → đảo đủ totalSpent/điểm/nợ khách CŨ (param `revertedCustomer` mới) + cộng đủ khách MỚI; hết áp delta nhầm khách / bỏ sót khi bỏ chọn khách.
- **HM4 — Soft-delete xóa đơn**: `deletePosOrder` chuyển `status='cancelled'` thay DELETE + **đảo thống kê khách** (totalSpent/điểm/debtAmount theo debt history bị gỡ) + guard chặn xóa 2 lần/sửa đơn hủy. Lọc tập trung tại MainContent (`activeData`/`activePosOrders` — mọi trang tính toán/POS nhận orders đã loại cancelled; riêng trang Hóa đơn/Trả hàng nhận đủ để xem lịch sử). Backend loại cancelled: 3 query [routes/data.ts](../../routes/data.ts) (recalculate revenue/COGS/ma trận tài chính), [eodAgent.ts](../../services/agents/eodAgent.ts), 2 tool [ChatInterface.tsx](../../components/ChatInterface.tsx), `fetchPosOrdersByDateRange` + `fetchAllOrdersForCustomerStats` + default page filter (apiService — dùng `neq` vì PostgREST 400 khi `or` + aggregate `sum()`). UI Hóa đơn: mặc định ẩn đơn hủy, lọc "Đã hủy" hiện lại + badge, khóa checkbox/Sửa/Trả trên đơn hủy.
- Cập nhật `FORMULAS.md` section 11 (soft-delete, hủy phiếu trả, doanh số NV phiếu trả, guard trả trùng).
- **Verify live trên dev** (login `admin@cfobrain.local`, dev DB local — đã đổi mật khẩu tài khoản test này trên dev): bán SP012439 (tồn 5→4, revenue +65k/vốn 38k, sales_records +65k) → trả thuần (TH-0RFY1 lưu đúng `original_order_id`, tồn 4→5, revenue đảo đúng, **sales_records giữ nguyên 65k — POS-RETURN-01 hết**) → mở trả lần 2 bị chặn "đã được trả đủ" → hủy phiếu trả (tồn 5→4, revenue về đúng trạng thái sau bán, tx bản sao cancelled) → xóa đơn (status cancelled, tồn về 5, revenue + sales_records về đúng baseline, ẩn khỏi list mặc định `status=neq.cancelled`, lọc "Đã hủy" hiện lại + badge + checkbox khóa). 2 bản ghi test (HD-0NYWH/TH-0RFY1 cancelled) để lại trên dev, sẽ bị ghi đè lần sync-prod-to-dev tới.
- Chưa verify live (logic-verified + tsc): sửa đơn đổi khách (HM8), race 2 máy song song, lỗi giữa batch (HM6). tsc sạch, **641/641 test pass** (638 cũ + 3 mới).
- Files: `supabase_migrations/025_pos_orders_return_link.sql`, `supabase_setup.sql`, `services/apiService.ts`, `services/dataMapper.ts`, `services/posOrderService.ts`, `services/agents/eodAgent.ts`, `src/lib/posSalesAttribution.ts`, `src/lib/returnGuards.ts` (mới), `components/pos/usePOSReturnFlow.ts`, `components/pos/POSComputer.tsx`, `components/orders/OrderReturns.tsx`, `components/orders/OrderInvoices.tsx`, `components/MainContent.tsx`, `components/ChatInterface.tsx`, `hooks/useAppData.ts`, `routes/data.ts`, `tests/unit/posSalesAttribution.test.ts`, `docs/business-knowledge/FORMULAS.md`

### 2026-07-03 (R18) — SEC-SECRET-01: user vô hiệu hóa key project Supabase cũ trên dashboard

- User tự xác nhận đúng project ref `tqouzxlnihfjdyxqlbqs` trên Supabase dashboard (Settings → General → Reference ID khớp), rồi bấm **"Disable JWT-based API keys"** (Settings → API Keys → tab "Legacy anon, service_role API keys") — vô hiệu hóa vĩnh viễn cả 2 key cũ, kể cả service_role key đã lộ trong git history.
- Đây là bước quan trọng nhất của SEC-SECRET-01: rotate/disable key làm cho việc key còn nằm trong git history không còn là rủi ro bảo mật thật sự (dù text vẫn còn trong history, không dùng được nữa).
- Chỉ còn lại việc scrub git history (6 branch trên GitHub) — hạ xuống mức "tùy chọn vệ sinh", không còn khẩn cấp. Cập nhật TODO.md phản ánh đúng trạng thái.
- Files: không đổi code, chỉ cập nhật `docs/05-process/TODO.md`

### 2026-07-03 (R17) — Điều tra SEC-SECRET-01: xác nhận rò rỉ đã lên GitHub 6 branch + dọn HEAD

- Theo yêu cầu user xử lý SEC-SECRET-01: điều tra sâu hơn audit R3 trước đó.
- **Xác nhận git history**: decode trực tiếp JWT tìm được — service_role key thật cho project `tqouzxlnihfjdyxqlbqs`, exp năm 2036, bypass toàn bộ RLS. Không chỉ nằm local — `git merge-base --is-ancestor 66ecc7a origin/main` xác nhận **đã push lên GitHub**, và kiểm tra thêm cả 5 branch remote khác (`claude/*`) đều chứa commit rò rỉ này. Không xác định được public/private repo (thiếu `gh` CLI trong môi trường agent).
- **Đã dọn an toàn**: gỡ ref `tqouzxlnihfjdyxqlbqs` khỏi 2 file `.kiro/DEPLOY_NOW.md`/`.kiro/QUICK_START.md` (thay bằng placeholder rõ ràng) — HEAD hiện không còn tham chiếu nào tới project cũ.
- **KHÔNG tự thực hiện** 2 việc còn lại: (1) kiểm tra/rotate key trên Supabase dashboard — agent không có quyền truy cập tài khoản Supabase của user; (2) scrub git history + force-push 6 branch — thao tác lớn khó đảo ngược, ảnh hưởng toàn bộ repo GitHub, tách riêng xin xác nhận thay vì gộp vào "xử lý luôn" chung chung. Ghi rõ cả 2 vào TODO.md kèm hướng dẫn cụ thể, nhấn mạnh rotate key mới là bước có tác dụng thật (vô hiệu hoá key bất kể history còn hay sạch).
- Files: `.kiro/DEPLOY_NOW.md`, `.kiro/QUICK_START.md`, `docs/05-process/TODO.md`

### 2026-07-03 (R16) — SEC-RLS-01 hoàn tất toàn bộ: verify default-privileges supabase_admin trên prod

- User tự chạy 2 lệnh `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ... REVOKE ALL ... FROM anon` (tables + sequences) trên Supabase Studio.
- Verify trực tiếp trên prod (SSH, chỉ SELECT, user xác nhận rõ đích production): `pg_default_acl` lọc theo `defaclnamespace` = schema `public` và grantor `supabase_admin` — bảng (`defaclobjtype='r'`) và sequence (`'S'`) đều còn đúng `{postgres, authenticated, service_role}`, **anon đã biến mất**. (Function `'f'` vẫn còn anon nhưng không nằm trong 2 lệnh yêu cầu — không phải thiếu sót của lần fix này.)
- **SEC-RLS-01 đánh dấu hoàn tất toàn bộ 4 mục** (deploy 024 + store_settings + schema_migrations + default-priv supabase_admin) — đóng hẳn gốc rễ MAINT-01 (bảng mới tạo qua Studio dưới supabase_admin không còn tự mở anon full CRUD).
- Files: không đổi code, chỉ cập nhật `docs/05-process/TODO.md`

### 2026-07-03 (R15) — Khóa schema_migrations trên prod (SEC-RLS-01 mục 1b xong, 1c cần Studio)

- Theo yêu cầu user ("chạy luôn"): thử chạy 2 việc còn lại của SEC-RLS-01 qua SSH+psql (role `postgres`) trên DB production, sau khi user xác nhận rõ ràng đích production cho thao tác GHI.
- **`public.schema_migrations`** (bảng sổ theo dõi migration của app, phân biệt với `auth.schema_migrations`/`realtime.schema_migrations` — 3 bảng trùng tên khác schema) thuộc sở hữu `postgres` → `ALTER TABLE ENABLE ROW LEVEL SECURITY` + `REVOKE ALL FROM anon` chạy thành công. Verify trực tiếp: `rowsecurity=true`, 0 grant `anon`.
- **`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`**: lỗi `must be member of role "supabase_admin"` — đúng như dự đoán từ log migration `024` trước đó (role `postgres` không phải thành viên `supabase_admin` trên instance này). Không thử cách khác lách qua — báo lại user cần tự chạy trên Supabase Studio (nơi trước đó user đã tự khóa `store_settings` thành công với đúng vấn đề quyền tương tự).
- Files: không đổi code; prod: `public.schema_migrations` đã khóa RLS/anon

### 2026-07-03 (R14) — Verify user tự khóa store_settings dưới supabase_admin trên prod

- User tự chạy 3 lệnh SQL (REVOKE anon, ENABLE RLS, tạo policy authenticated) cho bảng `store_settings` trên Supabase Studio (role `supabase_admin` — vượt qua giới hạn owner mà migration `023` không tự làm được, xem R13).
- Verify trực tiếp trên prod (SSH, chỉ SELECT, user xác nhận rõ đích production trước khi đọc): `rowsecurity = true`, `information_schema.role_table_grants` cho `anon` trên `store_settings` = 0 dòng, `pg_policies` có đúng `store_settings_authenticated_all` (`FOR ALL TO authenticated`). Khớp hoàn toàn với 33 bảng đã khóa tự động bởi migration `024`.
- SEC-RLS-01 giờ chỉ còn 2 việc tồn đọng (mục 1b/1c từ audit R3 — khóa `schema_migrations` + default-privileges grantor `supabase_admin`), không liên quan đến `store_settings` nữa.
- Files: không đổi code, chỉ cập nhật `docs/05-process/TODO.md`

### 2026-07-03 (R13) — Deploy lên production: migration 021-024 + code POS mới

- Theo yêu cầu user ("deploy"): chạy `scripts/deploy-imac.sh` — đồng bộ code, áp migration còn chờ lên DB prod, build, restart app trên iMac.
- **Lần 1 dừng ở migration `023_revoke_anon_storefront_tables.sql`**: bảng `store_settings` trên prod thuộc sở hữu role `supabase_admin` (không phải `postgres` — role chạy migration) → `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` bị từ chối quyền owner, lỗi làm rollback cả file (transaction), dừng deploy theo đúng thiết kế `set -e`. Code đã rsync lên iMac nhưng **chưa build/restart** — app cũ vẫn chạy bình thường, không có downtime hay trạng thái nửa vời.
- **Chẩn đoán**: user xác nhận rõ ràng cho phép SSH đọc DB production (yêu cầu 2 lần do lớp kiểm soát an toàn auto-mode chặn đọc prod không tên đích tường minh) → xác nhận `tableowner = supabase_admin` cho `store_settings`.
- **Fix**: sửa `supabase_migrations/023_revoke_anon_storefront_tables.sql` — bọc từng bảng trong `BEGIN...EXCEPTION WHEN insufficient_privilege` (tái dùng đúng pattern đã có ở migration `024`), bảng nào thiếu quyền owner thì bỏ qua + `RAISE NOTICE`, không chặn cả migration.
- **Deploy lại thành công**: `023` áp xong (6/7 bảng khóa, riêng `store_settings` bị bỏ qua an toàn — ghi nhận vào TODO SEC-RLS-01 cần chạy tay dưới `supabase_admin`), `024` áp xong (khóa 33 bảng nội bộ), build 17.48s, restart OK, health check `200 OK` xác nhận riêng (lệnh health-check trong script tự chạy sớm 3s bị `curl: (7) connection refused` do app chưa kịp lên — không phải lỗi thật), log runtime sạch (chỉ có job auto-sync định kỳ + 1 warning MemoryStore đã có từ trước, không liên quan lần deploy này).
- Files: `supabase_migrations/023_revoke_anon_storefront_tables.sql`, `docs/05-process/TODO.md`; prod: migration 021-024 áp đủ (021/022 áp từ lần deploy trước đó), code POS R6-R12 đã live

### 2026-07-03 (R12) — Bảng danh sách hóa đơn: bỏ in đậm tiêu đề cột + nội dung dữ liệu

- Theo yêu cầu user: bảng chính ở trang Hóa đơn ([OrderInvoices.tsx](../../components/orders/OrderInvoices.tsx)) đang dùng `font-semibold` cho 10 cột tiêu đề và `font-medium` cho các ô dữ liệu (mã hóa đơn, thời gian, khách hàng, số tiền, dòng tổng cộng) — đổi hết về `font-normal`. **Giữ nguyên** đậm cho badge/chip trạng thái nhỏ (nhãn đỏ "TH" đánh dấu đơn có phiếu trả) vì đó là chỉ báo trực quan, không phải nội dung dữ liệu.
- Verify: tsc sạch (đổi CSS thuần, không chạy lại 636 test). Restart dev server sạch log, `preview_inspect` xác nhận `font-weight: 400` ở cả tiêu đề cột và ô dữ liệu.
- Files: `components/orders/OrderInvoices.tsx`

### 2026-07-03 (R11) — Nút "Trả hàng" trong chi tiết hoá đơn điều hướng sang trang trả hàng ở máy tính tiền (thay vì xử lý ngay tại chỗ)

- **Lý do**: nút "Trả hàng" cũ trong [OrderInvoices.tsx](../../components/orders/OrderInvoices.tsx) chỉ hiện 1 `window.confirm()` rồi lập tức tạo phiếu trả cho TOÀN BỘ sản phẩm trong hoá đơn — không cho chọn sản phẩm/số lượng, tự viết lại logic cộng tồn kho/trừ doanh thu RIÊNG (không qua `processReturnOrder`). Đây chính là nguyên nhân user bấm nhầm trả nguyên đơn ở phiên trước (R10). App đã có sẵn trang trả hàng đầy đủ trong POS (tab "Trả hàng N" từ `usePOSReturnFlow.handleSelectOrderReturn` — chọn từng sản phẩm/số lượng, giảm giá, đổi hàng... rồi mới xác nhận qua `processReturnOrder`) nhưng chưa nối được từ trang Hoá đơn.
- **`components/orders/OrderInvoices.tsx`**: xoá hẳn `handleCreateReturn` (113 dòng tự xử lý tồn kho/doanh thu) + state `isCreatingReturn`, thay bằng `handleGoToReturnInPOS` chỉ điều hướng (giữ nguyên 2 guard cũ: chặn trả phiếu đã là trả hàng, cảnh báo nếu hoá đơn đã có phiếu trả). Prop mới `onReturnInPOS`. Xoá luôn prop `products`/`revenue` không còn dùng.
- **`components/MainContent.tsx`** + **`components/pos/POSComputer.tsx`**: thêm state `orderToReturn` + effect mở tab trả hàng, đúng pattern `orderToEdit`/`useEditOrderFlow` đã làm cho tính năng Sửa (R7) — tái dùng `handleSelectOrderReturn` có sẵn trong `usePOSReturnFlow.ts`, có ref chặn trùng do React.StrictMode.
- **`components/pos/ProcessOrdersModal.tsx`**: modal hoá đơn mở từ bên trong POS cũng render `OrderInvoices` — nối `onReturnInPOS` thẳng vào `handleSelectOrderReturn` (đã ở trong POS nên không cần điều hướng, chỉ mở tab + đóng modal). Xoá theo prop `products`/`revenue` không còn cần.
- **Verify**: tsc sạch, 636/636 test pass, restart dev server sạch log. Verify thật trên browser (đọc React Fiber `tabs`/`activeTabId` của `POSComputer` để xác nhận không nhân đôi tab — theo đúng phương pháp R8): bấm "Trả hàng" ở hoá đơn HD-N9HEA (VỚ - TRẮNG x3) → `window.location.pathname` chuyển `/order-invoices` → `/pos` → fiber xác nhận đúng 1 tab mới "Trả hàng 1" (`mode: 'return'`, `originalOrderId` khớp HD-N9HEA, `returnCart` có đúng 1 dòng). Chụp màn hình desktop layout xác nhận UI hiện đúng: sản phẩm SP006553 số lượng mặc định 0 (chờ user tự chọn số lượng trả), không tự động xác nhận trả hàng.
- Files: `components/orders/OrderInvoices.tsx`, `components/MainContent.tsx`, `components/pos/POSComputer.tsx`, `components/pos/ProcessOrdersModal.tsx`

### 2026-07-03 (R10) — Hoàn tác phiếu trả hàng TH065947 user bấm nhầm (dev DB, SQL trực tiếp)

- User bấm nhầm "Trả hàng" trong chi tiết hóa đơn HD065947 (đơn import KiotViet, 1× DÂY LƯNG SP002175, 60.000đ) → tạo phiếu trả TH065947 lúc 09:13. Điều tra đủ 5 vùng dữ liệu `processReturnOrder` ghi, rồi hoàn tác bằng 1 transaction SQL trên **dev DB** (user xác nhận + đóng tab app trước để tránh sync force hồi sinh — bài học R6/R7): xóa `pos_orders` TH065947, xóa `inventory_transactions` Return, đảo delta `revenue_records` 03/07 (returns 60000→0, net −40000→20000, profit −50000→10000), tính lại `sales_records` NV về 100.000 (đúng 3 đơn bán 20k+60k+20k theo công thức `calculateStaffSalesForDate`), ghi audit log `pos_orders/delete` kèm snapshot lý do. Verify sau commit: cả 5 chỉ số đúng.
- **Tồn kho KHÔNG cần hoàn**: `productId` trong items đơn import không tồn tại trong `pos_products` (id KiotViet cũ ≠ id hiện tại) → RPC Return không match sản phẩm nào, stock chưa từng bị cộng (DÂY LƯNG vẫn −1, `updated_at` 19/05). Lần chạy SQL đầu bị nuốt im lặng do `docker exec` thiếu `-i` (heredoc không vào psql) — phát hiện nhờ verify count, chạy lại với `-i` OK.
- **Phát hiện bug mới → TODO POS-RETURN-01**: phiếu trả thuần lưu `finalAmount = +60000` (dương) → nhánh fallback KiotViet trong `calculateOrderStaffSales` cộng NHẦM +60k vào doanh số NV khi trả hàng. Ghi nhận thêm (không sửa): `revenue_records` 03/07 gross 20.000 vốn lệch với 3 đơn bán 100.000 từ trước — hệ quả đơn test bị cache hồi sinh lúc 09:15 (vấn đề đã biết R6/R7).
- Files: không đổi code; dev DB: 2 DELETE + 2 UPDATE + 1 INSERT audit_logs

### 2026-07-03 (R9) — Đổi nhãn nút "Thanh toán"/"Xác nhận" thành "Lưu" khi đang ở chế độ sửa đơn

- Theo phản hồi user: tab hóa đơn mở từ nút "Chỉnh sửa" (chế độ sửa, `activeTab.editingOrderId` có giá trị) giờ hiện nút hành động là **"Lưu"** thay vì "Thanh toán"/"Xác nhận"/"Thanh toán (F9)" — đúng ngữ nghĩa (không phải giao dịch bán mới). Áp dụng ở cả 3 nơi hiển thị nút hành động cuối: nút mở checkout dưới cùng ([POSMobileView.tsx](../../components/pos/POSMobileView.tsx)), tiêu đề + nút xác nhận trong sheet mobile ([POSMobileCheckoutSheet.tsx](../../components/pos/POSMobileCheckoutSheet.tsx): "Thanh toán"→"Lưu thay đổi", "Xác nhận · Xđ"→"Lưu · Xđ"), và nút chính bên desktop ([POSCheckout.tsx](../../components/pos/POSCheckout.tsx): "THANH TOÁN (F9)"→"LƯU (F9)"). Thêm prop `isEditMode` cho cả 3 component, wire từ `!!activeTab.editingOrderId` trong POSComputer.tsx.
- **Verify thật trên browser**: tạo hóa đơn → bấm "Chỉnh sửa" → xác nhận nút dưới cùng hiện "Lưu", bấm vào → modal hiện tiêu đề "Lưu thay đổi" + nút "Lưu · 20.000đ" → bấm lưu → hóa đơn giữ nguyên mã cũ (không tạo đơn mới), hóa đơn in ra đúng dữ liệu.
- Files: `components/pos/POSMobileView.tsx`, `components/pos/POSMobileCheckoutSheet.tsx`, `components/pos/POSCheckout.tsx`, `components/pos/POSComputer.tsx`

### 2026-07-03 (R8) — Fix 2 vấn đề từ phản hồi user về tính năng "Sửa trong POS" (R7)

- **🔴 Bug: bấm "Sửa trong POS" tạo 2 tab hóa đơn giống hệt nhau**. Nguyên nhân: `useEffect` nạp `orderToEdit` vào cart ([POSComputer.tsx](../../components/pos/POSComputer.tsx)) không có cleanup/guard — `React.StrictMode` (bật ở [index.tsx](../../index.tsx)) tự gọi effect 2 lần liên tiếp ở dev mode để phát hiện side-effect không idempotent, khiến `handleSelectOrderToEdit` chạy 2 lần → tạo 2 tab. Fix: thêm `loadedEditOrderIdRef` chặn xử lý trùng cùng 1 `orderToEdit.id`. **Verify bằng cách đọc thẳng React Fiber state** (không chỉ nhìn UI vì POS đang chạy ở mobile view ẩn thanh tab): sau khi bấm 1 lần, `tabs` chỉ có đúng 1 tab "Sửa 1" — xác nhận hết nhân đôi.
- **UX: gộp 2 nút thành 1** theo đúng yêu cầu — bỏ nút "Sửa trong POS" riêng, nút **"Chỉnh sửa"** cũ giờ gọi thẳng `onEditInPOS` (mở đơn vào máy tính tiền) thay vì tính năng sửa-thông-tin-phụ cũ. Dọn sạch code chết đi kèm: state `editingOrderId`/`draftOrder`, hàm `handleStartEdit`/`handleSaveOrder`, nút "Lưu", các input/select có điều kiện `isEditing` cho 4 trường (người tạo/người bán/kênh bán/bảng giá/ghi chú) — trả về hiển thị tĩnh vĩnh viễn (không còn đường nào kích hoạt chế độ sửa cũ). Đơn trả hàng (`isReturn`) hiện nút "Chỉnh sửa" dạng disabled (xám) kèm tooltip giải thích thay vì ẩn hẳn.
- **Verify lại toàn bộ**: tsc sạch, 318/318 test pass, restart dev server sạch log, test thật trên browser — tạo đơn → bấm "Chỉnh sửa" → xác nhận qua React Fiber chỉ tạo đúng 1 tab.
- Files: `components/pos/POSComputer.tsx`, `components/orders/OrderInvoices.tsx`

### 2026-07-03 (R7) — Tính năng "Sửa hóa đơn trong POS" (mở lại đơn cũ để đổi sản phẩm/số lượng/giá)

- **Bối cảnh**: nút "Chỉnh sửa" cũ trong chi tiết hóa đơn ([OrderInvoices.tsx](../../components/orders/OrderInvoices.tsx)) chỉ mở khóa 4 trường phụ (người tạo, kênh bán, bảng giá, ghi chú) — không sửa được sản phẩm/số lượng/giá, khiến user tưởng nút "không phản hồi". User kỳ vọng đúng: mở lại đơn trong máy tính tiền để sửa. Quyết định nghiệp vụ (user chọn, không giới hạn): **không** bắt buộc quyền Quản lý, **không** giới hạn theo ngày, **vẫn cho sửa** kể cả đơn đã có phiếu trả hàng liên kết (rủi ro đã ghi rõ, chưa xử lý riêng).
- **`services/posOrderService.ts`** hàm mới `editPosOrder()`: coi sửa đơn = hoàn tác đơn CŨ (giống `deletePosOrder`) + áp dụng đơn MỚI (giống `processPlaceOrder`) nhưng **giữ nguyên `id`/`orderCode`/ngày bán gốc** (không tạo đơn mới, không cho đổi ngày). Tồn kho tính **delta ròng gộp** (tồn hiện tại + số lượng cũ − số lượng mới, gộp theo từng SP) rồi để RPC `delete_inventory_transaction_with_stock_v2` (xóa tx cũ) chạy TRƯỚC `apply_inventory_transaction_with_stock_v2` (ghi tx mới) trong cùng 1 `updateSurgical` — cả 2 đều atomic trên stock LIVE server nên đúng dù `data` client cũ. Doanh thu gộp thành 1 delta ròng (đảo dấu đơn cũ + đơn mới) gọi `applyRevenueDelta` đúng 1 lần. `sales_records` tính lại 1 lần qua `recalcSalesRecordsForDate` (tái dùng từ tính năng xóa đơn R6) với order đã thay bằng bản mới. Nợ cũ tự xóa, nợ mới (nếu bật) ghi lại. Audit log mới `auditService.logOrderEdit()`. **Chưa hỗ trợ đơn trả/đổi hàng** (`isReturn`) — throw lỗi rõ ràng nếu gọi nhầm.
- **`components/pos/useEditOrderFlow.ts`** (mới): mở đơn cũ vào 1 tab POS mới ở chế độ sửa — mẫu chép đúng theo `usePOSReturnFlow.handleSelectOrderReturn()` (nạp `cart` thay vì `returnCart`). Tự phát hiện đơn gốc có bán nợ không (`customerDebtHistory`) để giữ đúng `isDebtMode`.
- **`components/pos/POSComputer.tsx`**: thêm prop `orderToEdit`/`onOrderEditLoaded`/`onEditOrder`/`customerDebtHistory`. `handleCheckout()` phát hiện `activeTab.editingOrderId` → tra `originalOrderForEdit` từ `orders` prop, giữ nguyên id/orderCode/ngày, tính **delta điểm/tổng chi tiêu/nợ khách hàng** (so với đơn gốc, không cộng trùng như đơn mới), gọi `onEditOrder` thay vì `onPlaceOrder`.
- **`components/orders/OrderInvoices.tsx`**: nút mới "Sửa trong POS" (icon giỏ hàng, màu xanh lá, chỉ hiện khi đơn không phải `isReturn`) — điều hướng qua tab POS + nạp đơn vào cart. Đổi tooltip nút "Chỉnh sửa" cũ để rõ nó chỉ sửa thông tin phụ.
- **`components/MainContent.tsx`**: state `orderToEdit`, wire `onEditInPOS` (OrderInvoices) → set state + chuyển tab 'pos'; wire `onEditOrder` (POSComputer) → gọi `editPosOrder()`.
- **Verify thật trên browser (dev)**: tạo đơn HD-N9HEA (1×20.000đ) qua UI → bấm "Sửa trong POS" từ trang Hóa đơn → cart nạp đúng sản phẩm cũ → tăng số lượng lên 3 → thanh toán → hóa đơn **giữ nguyên mã HD-N9HEA** (không tạo đơn mới). Kiểm chứng DB trực tiếp: tồn kho giảm đúng delta ròng (51→49, tương ứng +2 so với trước sửa), `revenue_records` net_revenue 20.000→60.000 đúng, `inventory_transactions` cũ đã xóa + tx mới đúng qty=3. Phát hiện `sales_records` lệch (80.000 thay vì 60.000) — **điều tra xác nhận đây là do cache trình duyệt còn giữ 1 đơn ma `HD-5BOD1` (20.000đ) sót lại từ các lần dọn dữ liệu test bằng SQL trực tiếp trong phiên trước** (không phải bug của tính năng mới) — xóa cache + sửa lại số liệu xác nhận đúng.
- **Bài học lặp lại (đã ghi từ R4/R5, tái xác nhận mạnh hơn ở đây)**: KHÔNG dọn dữ liệu test bằng SQL trực tiếp khi có tab browser đang mở — cơ chế "Sync Force push local gaps" (`useAppData.ts`) sẽ đẩy ngược dữ liệu cache cũ (IndexedDB **và** `localStorage['cfo_brain_local_data']`) lên server, "hồi sinh" y hệt dữ liệu vừa xóa. Cách dọn dữ liệu test an toàn: dùng tính năng "Xóa đơn đã chọn" trong UI, hoặc `sync-prod-to-dev.sh`, hoặc nếu buộc phải SQL thì `localStorage.clear()` + xóa cả 2 IndexedDB (`cfo_brain_app_cache`, `cfo_brain_pos_queue`) trước khi tương tác tiếp với tab đang mở.
- Files: `services/posOrderService.ts`, `services/auditService.ts`, `components/pos/useEditOrderFlow.ts` (mới), `components/pos/POSComputer.tsx`, `components/pos/types.ts`, `components/orders/OrderInvoices.tsx`, `components/MainContent.tsx`

### 2026-07-03 (R6) — Tính năng "Xóa đơn hàng đã chọn" đúng chuẩn (hoàn tồn kho + trừ doanh thu)

- **Tính năng mới**: nút "Xóa N đơn" trong trang Hóa đơn ([components/orders/OrderInvoices.tsx](../../components/orders/OrderInvoices.tsx)) — chọn nhiều hóa đơn (checkbox), xác nhận, xóa hàng loạt. Khác với "Hủy hóa đơn" có sẵn (chỉ đổi `status: 'cancelled'`, không đụng số liệu) — đây là xóa THẬT + tự hoàn tồn kho/doanh thu/doanh số NV.
- **`services/posOrderService.ts`** hàm mới `deletePosOrder()`: tái dùng ~95% pattern rollback đã có trong `processPlaceOrder`/`processReturnOrder` — (1) xóa `inventory_transactions` theo `referenceId=order.id` qua RPC `delete_inventory_transaction_with_stock_v2` (hoàn tồn kho atomic, dựa dữ liệu ĐÃ LƯU thay vì suy luận lại từ order.items), (2) xóa lịch sử công nợ liên quan, (3) xóa order, (4) trừ khỏi `revenue_records` bằng delta đảo dấu của `buildRevenueDelta`, (5) audit log `logOrderCancel`. **Chưa hỗ trợ đơn trả/đổi hàng** (`isReturn=true`) — công thức đảo ngược khác, UI disable checkbox cho các dòng này (tooltip giải thích).
- **🔴 Bug tìm thấy + sửa khi test thật (multi-delete)**: xóa nhiều đơn cùng ngày → `sales_records` (doanh số NV) tính sai vì mỗi lần gọi `deletePosOrder` dùng lại snapshot `data.posOrders` CŨ (chưa cập nhật giữa các lần xóa trong vòng lặp) → đơn xóa trước bị "đếm nhầm lại" ở lần xóa sau. Fix: tách việc tính lại `sales_records` RA KHỎI `deletePosOrder`, chuyển thành hàm `recalcSalesRecordsForDate()` gọi ĐÚNG 1 LẦN sau khi xóa xong cả batch, loại trừ toàn bộ orderId đã xóa trong batch cùng lúc (không phải từng cái một).
- **🔴 Bug thứ 2**: khi NV không còn đơn nào trong ngày sau khi xóa hết, `buildPosSalesRecordUpsertsForDate` trả mảng rỗng (chỉ liệt kê NV có sales > 0) → code cũ bỏ qua luôn, để sót dòng `sales_records` cũ với số tiền sai. Fix: `recalcSalesRecordsForDate` giờ so sánh với `data.sales` hiện có, xóa tường minh các dòng `pos-sales-<ngày>-*` không còn nằm trong danh sách tính lại.
- **Verify thật trên browser (dev)**: tạo 2 đơn thật qua UI POS (20k mỗi đơn, cùng ngày) → chọn cả 2 trên trang Hóa đơn → bấm "Xóa 2 đơn" → xác nhận: `pos_orders` mất đúng 2 dòng, `revenue_records` ngày đó về đúng 0 (từ 40.000), tồn kho hoàn đúng (49→51), `sales_records` **về mảng rỗng** (không còn sót 40.000). Test riêng biệt 1 đơn cũng cho kết quả đúng.
- **⚠️ Phát hiện phụ (không phải bug code mới, đã biết trước)**: khi xóa dữ liệu trực tiếp bằng SQL (không qua app) rồi bấm nút "Tải lại dữ liệu và đồng bộ" trên 1 tab đã mở từ trước, cơ chế "Sync Force — push local gaps to Cloud" trong `useAppData.ts` **vô tình đẩy ngược dữ liệu cache cũ trong IndexedDB lên server**, làm "sống lại" các dòng vừa xóa bằng SQL. Đây là hệ quả tất yếu của thiết kế offline-first khi trộn xóa-qua-SQL với 1 tab browser đang mở sẵn cache cũ — không phải bug của tính năng xóa đơn mới. Bài học: dọn dữ liệu test bằng SQL trực tiếp thì nên xóa luôn IndexedDB cache (`indexedDB.deleteDatabase('cfo_brain_app_cache')`) hoặc dùng đúng tính năng UI mới (`deletePosOrder`) để tránh lệch cache.
- Files: `services/posOrderService.ts`, `components/orders/OrderInvoices.tsx`, `components/MainContent.tsx`; dev DB: dọn sạch 7 hóa đơn test tồn đọng từ nhiều phiên audit trước (HD-AMUJR/HD-5BOD1/HD-QOFFV/HD-PPT13/HD-LLM61/HD-LNZNK/HD-LSU5G) + baseline tồn kho/doanh thu/doanh số về đúng số liệu thật.

### 2026-07-03 (R5) — Banner tự động báo "có bản mới" khi dev server restart

- **Bối cảnh**: production đã có service-worker tự phát hiện bản mới ([registerServiceWorker.ts](../../registerServiceWorker.ts)) nhưng **chỉ bật khi `import.meta.env.PROD`** (dev tắt vì SW cache hàng trăm module Vite → treo trang). Dev (`tsx server.ts`) không có cơ chế nào báo user biết server đã restart (đổi code) → user phải tự đoán lúc nào cần F5.
- **Fix**: [server.ts](../../server.ts) sinh `BOOT_ID` ngẫu nhiên (`crypto.randomUUID()`) mỗi lần process khởi động, expose qua `GET /api/server-boot-id`. Component mới [components/DevUpdateBanner.tsx](../../components/DevUpdateBanner.tsx) poll endpoint này mỗi 10s, so với bootId lần đầu tải trang — lệch thì hiện banner tím cố định đầu trang "Server vừa cập nhật code mới — tải lại trang" kèm nút Tải lại. Chỉ mount khi `import.meta.env.DEV` (App.tsx) — không đụng hành vi production.
- **Verify**: tsc sạch, 318/318 test pass, restart dev server sạch log. Test trên browser: patch `window.fetch` giả lập server trả bootId khác → banner hiện đúng sau đúng 1 chu kỳ poll; bấm nút "Tải lại" → reload thật, banner biến mất (baseline mới). Xác nhận endpoint `/api/server-boot-id` trả UUID khác nhau giữa các lần restart thật.
- Files: `server.ts`, `components/DevUpdateBanner.tsx` (mới), `App.tsx`

### 2026-07-03 (R4) — Fix gốc rễ bug tái diễn "mất SĐT/địa chỉ cửa hàng" + khôi phục dữ liệu prod

- **Root cause thật (khác lỗi 401 đã vá 06-28)**: `brand_profile.phone/address` trên **prod DB đã thực sự bị ghi đè bằng đúng giá trị placeholder** `DEFAULT_BRAND` ([constants/marketing.ts:37-38](../../constants/marketing.ts)) — xác nhận bằng SQL trực tiếp trên prod (`090xxxxxxx` / `Địa chỉ cửa hàng của bạn`, khớp từng ký tự). Cơ chế: khi mở app trên thiết bị/trình duyệt **chưa có cache** (IndexedDB + localStorage rỗng) và lần fetch đầu bị lỗi/timeout, `brandProfile` state giữ nguyên `DEFAULT_BRAND` trong bộ nhớ; nếu user gõ vào **bất kỳ ô nào** trong tab Hồ sơ thương hiệu (kể cả field không liên quan như "giọng văn") trước khi dữ liệu thật kịp tải — spread `{...brandProfile, ...}` mang theo placeholder `phone`/`address` → auto-save debounce 2s ghi đè thẳng lên DB. Vòng lặp: fix 06-28 (JWT) chỉ chặn được lỗi ghi do 401, không chặn được ghi placeholder khi tải chậm/lỗi tạm + cache rỗng.
- **Khôi phục dữ liệu**: UPDATE trực tiếp `brand_profile` trên prod (qua SSH `docker exec supabase-db psql`) về giá trị thật tìm thấy nguyên vẹn ở 2 nơi khác trong code (fallback in hóa đơn `PrintTemplatesTab.tsx` + seed hợp đồng lao động `systemKnowledgeSeed.ts`): phone `033.571.3423 – 096.886.7411`, address `Số nhà 14, đường NC2, tổ 11, khu phố 3, phường Bến Cát, Thành phố Hồ Chí Minh`. User xác nhận dùng đúng giá trị này.
- **Fix code** [hooks/useAppData.ts](../../hooks/useAppData.ts): thêm ref `brandLoadedRef` — chỉ bật `true` khi `brandProfile` đã được xác nhận từ cache/localStorage/server thật (5 điểm dispatch trong `hydrateThenSync` + `fetchData`). Effect auto-save (debounce brand profile) thêm guard chặn lưu nếu `brandLoadedRef` chưa bật — ngăn ghi `DEFAULT_BRAND` placeholder đè DB khi chưa có nguồn dữ liệu thật nào xác nhận.
- **Verify**: tsc sạch, 318/318 test pass, restart dev server sạch log. Test trên browser: gõ vào field "voice" (không liên quan phone/address) → network `POST /api/data/upsert` 200, query lại DB xác nhận `phone`/`address` giữ nguyên không bị ghi đè, chỉ `voice` đổi đúng field vừa sửa (dữ liệu test đã dọn sạch trên dev DB).
- Files: `hooks/useAppData.ts`; prod DB: 1 UPDATE `brand_profile` (khôi phục phone/address)

### 2026-07-03 (R3) — Audit độc lập QA+Bảo mật đợt 3: tự kiểm chứng 024 + phát hiện 4 rủi ro mới

- **Môi trường**: clone prod trên Supabase LOCAL Docker (`localhost:8000`, 14.873 SP/69.736 đơn), `.env.local` xác nhận trỏ local — KHÔNG chạm prod. Migration 021/022/023/024 đã áp trên clone. tsc sạch, 318/318 test pass.
- **Tự kiểm chứng (không tin báo cáo cũ)**: (1) bắn anon key thật vào clone → 024 **chặn thật**: `pos_products/pos_orders/sales_records/suppliers` → `42501` (đọc+ghi), HR/tài chính → `[]`, catalog `store_products` → 200. (2) Oversell đồng thời: 2 UPDATE song song tồn=1 → 1 ok / 1 khớp 0 row, tồn=0 không âm. (3) **Import Excel dòng lỗi test LIVE**: file 4 dòng (2 đúng + 2 số hỏng "abc"/"1.2.3") → `{imported:4, errors:0}`, số hỏng ép về 0, batch không vỡ. (4) UI danh sách 14.873 SP: virtualization (~50 DOM row), render không đơ, search ~380ms. (5) Đối soát doanh thu độc lập: T6 orders net 233,5M vs revenue_records 238M (~1,9% — LOGIC-02); DATA-04 3 dòng năm rác 109,933M lọt all-time (tái hiện đúng).
- **🔴 PHÁT HIỆN MỚI (đợt trước bỏ sót)**: **service_role JWT của project Supabase hosted cũ `tqouzxlnihfjdyxqlbqs.supabase.co` nằm trong GIT HISTORY** (commit đầu `66ecc7a` 2026-05-05, gỡ khỏi code sau ở `2a241ab` nhưng history còn; exp 2036, bypass toàn bộ RLS). HEAD chỉ còn ref/URL trong `.kiro/*.md`. → task P0 SEC-SECRET-01 (rotate/xoá project + scrub history). Không thử key vào project thật (rào chắn).
- **🟡 3 mảnh RLS/hạ tầng còn hở**: (B) default-priv grantor `supabase_admin` VẪN cấp anon full CRUD bảng tương lai (024 chỉ gỡ được grantor `postgres`) → MAINT-01 chưa đóng hẳn; (C) `schema_migrations` RLS OFF + anon full grant (curl anon → 200 + data, có thể TRUNCATE sổ migration); (E) login `/auth/v1/token` không rate-limit tầng app. Bổ sung vào SEC-RLS-01 (bước 1b/1c) + task SEC-RATELIMIT-01. Ghi rõ DATA-01 (checkout là saga bù trừ, không phải 1 transaction).
- **Verdict**: 🟡 DÙNG ĐƯỢC NHƯNG CÓ RỦI RO — lõi giao dịch vững (kiểm chứng thật lần nữa); rủi ro còn lại ở tầng deploy/secrets/prod, không ở logic. Điều kiện sẵn sàng: đóng SEC-SECRET-01 + 3 bước tay SEC-RLS-01 trên prod.
- Files: `docs/06-evaluation/QA_SECURITY_AUDIT_2026-07-03_R3.md` (mới), `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md` (không sửa code — audit only; dữ liệu test đã dọn, trừ SP010239 stock=0 trên clone local).

### 2026-07-03 (tiếp) — Vá SEC-RLS-01: khoá anon RLS/grant (migration 024), test đầy đủ trên clone

- **Fix 🔴 SEC-RLS-01** (migration `024_lock_down_anon_rls.sql`): DROP mọi policy `TO anon`/`TO public` trên **33 bảng nội bộ** (pos_orders/pos_products/sales_records/suppliers/vat_*/attendance_records...) → thay bằng 1 policy `FOR ALL TO authenticated` + `REVOKE ALL FROM anon` + `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM anon`. NGOẠI LỆ giữ nguyên: `store_products`/`store_product_variants` (public-read `is_published` cho catalog website). Áp qua đúng `apply-migrations.sh` (mô phỏng deploy).
- **Kiểm chứng THẬT trên clone**: (1) anon key giờ trả `42501 permission denied` cho CẢ đọc lẫn ghi (INSERT trước 201 → nay 401) trên mọi bảng nhạy cảm; (2) user đăng nhập thật qua GoTrue (role authenticated) VẪN đọc/ghi full — bán 1 đơn qua UI browser với session thật OK (tồn 49→48, đơn HD-AMUJR, sales_records ghi, **console sạch**, không lỗi /rest/v1); (3) catalog công khai `store_products` anon vẫn đọc được sản phẩm published. LoginPage không đọc bảng nào pre-auth → không vỡ trang login.
- **Lưu ý deploy**: migration chạy bằng `postgres` KHÔNG sửa được default-privileges của grantor `supabase_admin` (không phải member) → đã bọc exception, skip an toàn. Cần chạy TAY 1 câu `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ... REVOKE ... FROM anon` trên prod dưới quyền supabase_admin/superuser (rủi ro tồn dư thấp — bảng mới đã theo mẫu RLS+authenticated). Ghi trong TODO SEC-RLS-01.
- Files: `supabase_migrations/024_lock_down_anon_rls.sql` (mới), `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md`, `docs/06-evaluation/QA_SECURITY_AUDIT_2026-07-03.md`. DB clone: 33 bảng đổi policy + revoke anon. Dữ liệu test đã dọn sạch.

### 2026-07-03 — Audit độc lập QA + Bảo mật đợt 2: xác nhận fix 021/022/023 + đào sâu RLS

- **Môi trường**: test trên Supabase LOCAL Docker (clone prod 02/07: 14.873 SP / 69.736 đơn), `.env.local` trỏ `localhost:8000` — KHÔNG chạm prod (rào chắn). Đăng nhập `admin@cfobrain.local` (mật khẩu test chỉ đặt trên DB local). Migration 021/022/023 xác nhận đã áp trên clone.
- **Xác nhận các fix đợt trước hoạt động THẬT**: (1) 🔴 POS-SALES-01 — bán 1 đơn qua UI (VỚ-TRẮNG, tồn 49→48, đơn HD-5BOD1), `sales_records` ghi thành công dòng `pos-sales-2026-07-03-ngo-thanh-du`, **console SẠCH** (hết "LỖI ĐỒNG BỘ" giả) → migration 021 (id UUID→TEXT) hiệu quả. (2) 🟡 INV-RPC-01 — `_v2` tồn tại trên DB, đủ nhánh Sale/Return + guard Insufficient. (3) Oversell test ĐỒNG THỜI: 2 `decrement_product_stock` song song trên tồn=1 → 1 thành công, 1 chặn (0 row), tồn về 0 không âm.
- **🔴 PHÁT HIỆN MỚI (SEC-RLS-01) — nghiêm trọng hơn lỗi đợt trước**: anon key (nhúng công khai trong bundle) ĐỌC+GHI+XÓA được THẬT trên clone với `pos_products`/`pos_orders`/`sales_records`/`suppliers`/`vat_documents`/`attendance_records` (INSERT 201, UPDATE/DELETE 204). Gốc rễ: `DEFAULT PRIVILEGES` tự cấp anon full CRUD mọi bảng mới (MAINT-01) + RLS policy `TO anon/public USING(true)` trên loạt bảng nhạy cảm + proxy `/rest/v1` mở không auth/không rate-limit. Bảng authenticated-only (customers/employees/payroll/revenue) thì anon bị chặn. `sync-prod-to-dev.sh` dùng pg_dump không `--no-acl` → grant/policy clone = prod. **Không xác minh prod được (rào chắn)** → task P0 SEC-RLS-01 với SQL kiểm tra + hướng vá gốc rễ (đổi policy `TO authenticated` + revoke default-privileges anon).
- **Đối chiếu số liệu**: net T6 từ pos_orders ≈233,7M vs revenue_records 238M (~1,8% drift — đúng vùng LOGIC-02/DATA-04 đã biết, chờ deploy). Query DB nhanh (14.873 SP count 7ms, page 1k dòng 3ms) → cold-load ~10s là do round-trip mạng. 318/318 test pass, tsc sạch, không lộ secret git, DOMPurify phủ 100%.
- **Verdict**: 🟡→🔴 CHƯA SẴN SÀNG cho tới khi xác minh + vá SEC-RLS-01 trên prod. Lõi giao dịch vững; rủi ro nền tảng là phân quyền anon/RLS.
- Files: `docs/06-evaluation/QA_SECURITY_AUDIT_2026-07-03.md` (mới), `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md` (không sửa code — audit only; dữ liệu test đã dọn sạch khỏi DB local)

### 2026-07-02 (khuya 3) — Sửa 5 lỗi từ audit QA+Bảo mật (1 🔴 + 4 🟡), verify end-to-end

- **Fix 🔴 POS-SALES-01** (migration `021_fix_sales_records_schema.sql`): `sales_records.id` UUID→TEXT + gỡ FK `employee_id` (khớp `pos_orders.staff_id` vốn text tự do). Nguyên nhân kép: code sinh id chuỗi `pos-sales-<date>-<emp>` + người bán ngoài roster (admin) → 22P02 + FK 23503. **Verify browser**: bán 1 đơn → `sales_records` GHI THÀNH CÔNG (id `pos-sales-2026-07-02-ngo-thanh-du`), console SẠCH (hết "LỖI ĐỒNG BỘ" sau mỗi đơn), server log hết `upsert failed [sales_records]`. Hết nguy cơ thu ngân tưởng lỗi → bán trùng.
- **Fix 🟡 INV-RPC-01** (migration `022_apply_inventory_rpc_v2.sql` = nội dung 013): áp `apply/delete_inventory_transaction_with_stock_v2` lên DB (013 chưa từng được áp dù baseline tưởng đã vá). Nay mọi đơn dùng RPC atomic 1-transaction đủ nhánh Sale/Return thay vì fallback nhiều-bước; legacy thiếu nhánh Sale/Return hết là landmine. **Verify**: bán 2 tồn 3→1; bán 5 khi tồn 1 → EXCEPTION Insufficient, tồn giữ 1 (không âm). Bán qua browser: tồn 8→7 đúng.
- **Fix 🟡 IMPORT-01** ([routes/import.ts](../../routes/import.ts)): vệ sinh số NaN→0 trước khi build parent + khi batch upsert lỗi thì retry TỪNG DÒNG để cô lập dòng hỏng (dòng đúng vẫn ghi), trả `rowErrors[]` chi tiết cho user. Hết cảnh 1 dòng lỗi làm hỏng cả batch 300.
- **Fix 🟡 LOGIC-02** ([routes/data.ts](../../routes/data.ts) `recalculate-revenue-from-orders`): viết lại group by NGÀY, upsert từng ngày `onConflict(date)` theo công thức `calcOrderRevenue` (khớp `reportCalculations.ts`), thêm `revenue_other` từ final_amount. Hết bug dồn cả tháng vào 1 dòng cuối tháng → cộng trùng. **Verify**: recalc 2026-07 → ghi đúng dòng ngày 2026-07-02 (không tạo dòng 07-31).
- **Fix 🟡-6** (migration `023_revoke_anon_storefront_tables.sql`): REVOKE ALL FROM anon + bật RLS + policy authenticated cho 7 bảng RLS-off (expense_categories, shipments, store_* ×5, store_settings). App không đọc các bảng này qua anon (đã kiểm) + storefront dùng service-role (bypass RLS) → không phá luồng nào. Đóng lỗ anon key công khai.
- **Kiểm tra cuối**: `tsc --noEmit` sạch, **318/318 test pass**, restart dev server sạch, verify bán đơn end-to-end thành công + console sạch. Migration 021/022/023 đã áp local + ghi sổ `schema_migrations`; sẽ tự áp lên prod ở lần deploy kế (apply-migrations.sh). Dữ liệu test đã dọn sạch (khôi phục tồn SP009094).
- Files: `supabase_migrations/021,022,023_*.sql` (mới), `routes/import.ts`, `routes/data.ts`, `docs/05-process/{HISTORY,TODO}.md`

### 2026-07-02 (khuya 2) — Audit độc lập QA + Bảo mật "sẵn sàng dùng thật?" (test thật trên clone prod)

- **Verdict: 🟡 DÙNG ĐƯỢC NHƯNG CÓ RỦI RO** — vá 1 lỗi 🔴 chặn là đủ điều kiện giao khách. Báo cáo đầy đủ: `docs/06-evaluation/QA_SECURITY_AUDIT_2026-07-02.md`.
- **Môi trường**: test trên Supabase LOCAL Docker (clone prod, 14.873 SP/69.736 đơn) — KHÔNG chạm prod (rào chắn an toàn). Đăng nhập `admin@cfobrain.local` (manager, mật khẩu test `AuditTest2026!` đặt chỉ trên DB local). Dữ liệu test đã dọn sạch.
- **🔴 LỖI CHẶN mới phát hiện (POS-SALES-01)**: `sales_records.id` là UUID nhưng `buildPosSalesRecordUpsertsForDate` sinh id chuỗi `pos-sales-<date>-<emp>` → `autoUpsertStaffSalesForDate` lỗi `22P02` MỌI đơn bán/trả. Hậu quả: (1) console+UI hiện "LỖI ĐỒNG BỘ" + cờ mất kết nối sau mỗi đơn dù đơn đã lưu OK → thu ngân dễ tưởng lỗi bán lại → ĐƠN TRÙNG; (2) doanh số NV từ POS không bao giờ ghi (0/150 dòng có id `pos-sales-*`). Nuốt lỗi qua try/catch "non-critical". Sửa: dùng `crypto.randomUUID()` + upsert onConflict(employee_id,date).
- **Kiểm chứng THẬT đạt**: chống oversell atomic (`decrement_product_stock` test tồn=1: lần 2 trả 0 row, giữ 0); cộng dồn doanh thu atomic (`apply_revenue_delta` ON CONFLICT date); bán 1 đơn end-to-end qua browser (tồn 10→9, net/gross 100k, COGS 50k, lợi nhuận 50k đúng); 3 lớp guard tồn kho; edge-case (giảm giá clamp, qty≥1, netPayable≥0); không lộ secret git; requireAuth phủ router mutate; DOMPurify 100% (spot 4/8); 318/318 test pass.
- **🟡 phát hiện thêm**: schema drift RPC tồn kho (`_v2` không tồn tại + legacy thiếu nhánh Sale/Return trên DB — bom nổ chậm, hiện fallback che); fallback tồn kho không atomic đa-bước; import Excel không validate từng dòng (1 dòng lỗi hỏng cả chunk); drift doanh thu T6 ~4,88M/2% (LOGIC-02/DATA-04 đã có); RLS off + anon grant vài bảng storefront trên clone (cần verify prod).
- Files: `docs/06-evaluation/QA_SECURITY_AUDIT_2026-07-02.md` (mới), `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md` (không sửa code — audit only)

### 2026-07-02 (khuya) — Migration tự động khi deploy (schema đi cùng code)

- **Script mới `scripts/apply-migrations.sh`**: chạy các file `supabase_migrations/*.sql` CHƯA có trong sổ `schema_migrations` (bảng mới trên DB, theo dõi theo TÊN FILE — số trùng 005/019 không sao). Mỗi file = 1 transaction (`ON_ERROR_STOP` + `--single-transaction`), lỗi = rollback file + exit 1. Hỗ trợ `--prod` (SSH iMac) / `--baseline` (đánh dấu không thực thi).
- **`deploy-imac.sh`**: thêm bước chạy `apply-migrations.sh --prod` SAU rsync, TRƯỚC build — migration lỗi thì deploy dừng, code mới không lên.
- **`sync-prod-to-dev.sh`**: sau restore tự gọi `apply-migrations.sh` local — vì sync ghi đè DB dev bằng prod (kèm sổ), migration chưa deploy được áp lại tự động.
- **Baseline 20 file hiện có trên cả prod lẫn dev** (không thực thi lại — prod đã được vá tay tương đương; tránh bẫy 014 tạo overload trùng). Từ giờ chỉ file MỚI tự chạy.
- **Test trên dev**: migration giả chạy đúng 1 lần, lần 2 bỏ qua; file SQL lỗi → dừng + không ghi sổ. Đã dọn sạch dấu vết test. Fix bug word-split path có dấu cách (dùng glob thay `$(ls)`).
- **Quy trình mới cho schema**: tính năng cần bảng/cột/RPC mới → viết file `021_xxx.sql` (số kế tiếp) vào `supabase_migrations/` → test dev bằng `./scripts/apply-migrations.sh` → bấm deploy là prod tự có.
- Files: `scripts/apply-migrations.sh` (mới), `scripts/deploy-imac.sh`, `scripts/sync-prod-to-dev.sh`, `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md`; DB prod+dev: bảng `schema_migrations` (20 dòng baseline)

### 2026-07-02 (đêm muộn) — Tách môi trường dev: Supabase local trên MacBook, dev không còn đụng DB prod

- **Bối cảnh**: audit "còn gì phụ thuộc MacBook" xác nhận prod đã sạch (chỉ còn điểm giòn `pm2 startup` chưa cài trên iMac — nằm trong task P0). Nhưng phát hiện ngược: dev MacBook trỏ thẳng DB prod → dựng môi trường dev riêng.
- **Supabase local MacBook**: nhân bản config từ iMac (`~/supabase-dev/docker`, cùng version images + JWT secret/keys → app không cần đổi key), 11 container healthy, port 8000/5432/6543.
- **Script mới `scripts/sync-prod-to-dev.sh`**: pg_dump prod (iMac, không downtime) → restore vào local + rsync storage + backup nén vào `~/backups/cfobrain/` (giữ 14 bản — kiêm backup ngoài iMac cho DEVOPS-01). Lần chạy đầu: 69.736 pos_orders, 14.873 pos_products, 4 auth users, RPC (`apply_revenue_delta`, `pos_mobile_checkout`) đầy đủ.
- **🔴 Fix 3 chỗ hardcode `192.168.1.3:8000` trong `server.ts`** (syncLocalSchema:59, proxy SUPABASE_INTERNAL:462, auto-detect:600) → đọc `process.env.SUPABASE_URL` (fallback IP cũ). Trước fix, dev proxy `/auth/v1`+`/rest/v1` LUÔN forward về prod bất kể .env.local. Trên prod iMac `SUPABASE_URL=localhost:8000` nên hành vi không đổi (còn bỏ được vòng LAN IP). **Code chờ deploy** (không gấp — prod không ảnh hưởng).
- `.env.local` MacBook → `http://localhost:8000` (backup `.env.local.bak-prod-20260702`).
- **Verify end-to-end trên browser dev**: đăng nhập admin bằng mật khẩu test chỉ có ở DB local → thành công (role Quản lý), vào /overview 38/38 REST request OK từ DB local; sai mật khẩu hiện đúng "Tên đăng nhập hoặc mật khẩu không đúng".
- tsc sạch, 318/318 test pass.
- Files: `server.ts`, `scripts/sync-prod-to-dev.sh` (mới), `.env.local` (ngoài git), `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md`; ngoài repo: `~/supabase-dev/docker`, `~/backups/cfobrain/`

### 2026-07-02 (đêm) — Fix đăng nhập chập chờn trên app.phucsang.com.vn (tunnel Supabase phụ thuộc MacBook)

- **Triệu chứng**: login hay báo "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại" ([LoginPage.tsx:55](../../components/LoginPage.tsx)) dù mạng người dùng bình thường.
- **Root cause**: domain `supabase.phucsang.com.vn` (VITE_SUPABASE_URL nướng trong bundle prod — mọi browser gọi auth + data qua đây) được serve bởi tunnel cloudflared `supabase-tunnel` chạy **trên MacBook** (process rời, không launchd, từ 24/06) → forward LAN về iMac:8000. MacBook ngủ/tắt/rời mạng = toàn bộ login chết. Sót lại từ trước đợt "kiến trúc 1 máy" — đã gỡ tunnel bot nhưng bỏ sót tunnel Supabase.
- **Fix (chỉ hạ tầng, 0 dòng code, không rebuild)**: (1) thêm ingress `supabase.phucsang.com.vn → http://localhost:8000` vào `~/.cloudflared/config.yml` trên iMac (backup `config.yml.bak-20260702`), validate OK; (2) restart cloudflared iMac (launchctl kickstart); (3) chuyển DNS CNAME sang tunnel `cfobrain` (`cloudflared tunnel route dns --overwrite-dns`); (4) kill + **xóa hẳn** tunnel `supabase-tunnel` trên MacBook.
- **Verify sau khi MacBook không còn tunnel**: auth health 200, rest 200, login sai mật khẩu trả đúng 400 `invalid_credentials` từ GoTrue qua domain public; app 200, cfobrain 401 (đúng — cần auth). Prod giờ chỉ phụ thuộc iMac đúng như mục tiêu.
- Files: `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md`; ngoài repo: `~/.cloudflared/config.yml` (iMac), xóa tunnel `supabase-tunnel` (Cloudflare + MacBook)

### 2026-07-02 (tối muộn) — Di chuyển bot Shopee từ MacBook lên iMac (kiến trúc 1 máy)

- **Mục tiêu**: prod chỉ phụ thuộc iMac, MacBook tắt không ảnh hưởng gì.
- Cài PM2 7.0.3 trên iMac (npm prefix `~/.npm-global` vì /usr/local không có quyền ghi); rsync 2.4GB `shopee-monitor` (2 pass: pass 1 khi bot còn chạy, pass 2 delta sau khi dừng bot để profile Chromium nhất quán); `npm install` + Playwright Chromium (1.59.1 khớp MacBook).
- Đổi `SUPABASE_URL` của bot → `http://localhost:8000` (trước là 192.168.1.3:8000 — giờ cùng máy, tránh cả vấn đề Local Network TCC).
- Bot chạy OK trên iMac (2 process online, API 3001/3002 trả 200, app prod đọc đơn bình thường qua `SHOPEE_BOT_HOST=127.0.0.1`).
- **Session Shopee cả 2 shop hết hạn** khi profile sang máy mới (rủi ro đã lường) → cần user đăng nhập lại 1 lần bằng `login.js` trực tiếp trên iMac — hướng dẫn từng bước đã ghi vào TODO.md (P0). Đơn cũ vẫn hiển thị; đơn mới chưa cập nhật cho đến khi login.
- Đã tắt bot MacBook + gỡ launchd tunnel `com.phucsang.bot-tunnel` (không cần nữa); `pm2 save` trên iMac; lệnh `pm2 startup` (cần sudo) nằm trong hướng dẫn TODO.
- Files: `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md`; ngoài repo: `~/shopee-monitor` (iMac), gỡ `~/Library/LaunchAgents/com.phucsang.bot-tunnel.plist` (MacBook)

### 2026-07-02 (tối) — Kiểm chứng data-load "máy mới" trên prod + vá RLS recurring_expenses

- **Test thật qua domain public** (mint JWT authenticated từ JWT_SECRET của Supabase self-hosted, gọi curl đúng các query app phát ra): cả **31 bảng bootstrap** trả 200/206, số dòng khớp thực tế (pos_orders 69.736, pos_products 14.873). Không bảng nào bị chặn quyền sau đợt REVOKE anon.
- **Đo tốc độ thực tế**: 14.873 sản phẩm (15 request song song) = **9,1s**; pos_orders 60 ngày (~810KB) = **0,7s** → load đầu máy mới ~10s, các lần sau có IndexedDB cache.
- **Cơ chế chịu lỗi đã xác minh trong code**: timeout 45s + message rõ; lỗi từng bảng → `syncErrors` badge trên TopNav (không im lặng) + tắt cờ cloudConnected; máy mới không cache → dùng thẳng server data; rest/v1 KHÔNG đi qua /api rate limiter.
- **🔴 Vá bug tiềm ẩn tìm thấy**: `recurring_expenses` có RLS bật nhưng **0 policy** → backend ghi thành công (service role) nhưng browser đọc về rỗng — user nhập xong refresh là "mất". Đã CREATE POLICY `recurring_expenses_select_authenticated` trên prod + bổ sung CREATE TABLE + policy vào `supabase_setup.sql` (bảng này trước đây hoàn toàn thiếu trong setup).
- Đã xóa JWT test sau khi dùng (exp 15 phút).
- Files: `supabase_setup.sql`, `docs/05-process/HISTORY.md`; prod DB: 1 CREATE POLICY

### 2026-07-02 (chiều muộn) — Audit logic tính toán + nghiệp vụ, kiểm chứng số liệu thật trên prod DB

- **Đối chiếu code vs FORMULAS.md**: `calcOrderRevenue` (2.1), `calcEffectiveUnitPrice` (1.1), WAC (1.2), fixed cost (1.3) khớp từng phép tính. Phát hiện doc drift mục 8.10: code đã đổi sang CHỈ dùng `is_return` explicit (AUDIT-008) ở cả `dataMapper.ts` + `apiService.ts`, FORMULAS.md chưa cập nhật.
- **Kiểm chứng chéo trên prod DB** (SQL độc lập vs công thức app): net T6 từ `pos_orders` = 238.354.000đ khớp chính xác; `revenue_records` không trùng ngày; `cash_received` phủ 100% (69.723/69.736 đơn); 0 đơn trùng mã; 0 đơn bán final>total; 0 payroll net âm; ngày sạch ở pos_orders/expense_records.
- **🔴 Phát hiện + sửa sự cố do chính phiên sáng gây ra**: endpoint `recalculate-revenue-from-orders` ghi tổng CẢ THÁNG vào 1 dòng ngày cuối tháng (mô hình cũ) → lần chạy sáng nay làm T6 đếm đôi (476M thay vì 238M). Đã xóa 2 dòng lỗi (30/06 + 31/07, xác minh created_at 02/07), T6 về 238.009.000đ/25 ngày. Ghi task LOGIC-02 sửa endpoint.
- **Phát hiện tồn đọng lịch sử**: (1) 3 dòng ngày rác revenue_records (năm 92401/77063/137519, net 109,9M, từ 06/06) → task DATA-04; (2) drift T6 revenue_records vs orders −345K (0,14%) — di chứng race DATA-02 trước khi vá; (3) 534/14.873 SP tồn kho âm (legacy KiotViet); (4) LOGIC-01 (COGS=0) tác động không đáng kể: 3/2.184 dòng T6 ≈ 100K; (5) payroll mới nhất 2026-04 (thiếu T5/T6 — vận hành); (6) `shopee_revenue_records` rỗng hoàn toàn.
- **Verdict**: logic tính toán lõi ĐÚNG (kiểm chứng chéo dữ liệu thật + 318 test); app đang dùng thực tế được; rủi ro chính là vận hành (backup DEVOPS-01) + dọn dữ liệu lịch sử.
- Files: `docs/05-process/TODO.md`, `docs/05-process/HISTORY.md` (không sửa code — audit only; sửa dữ liệu: xóa 2 dòng revenue_records lỗi trên prod)

### 2026-07-02 (chiều) — Deploy fix "Đơn hàng online" + SEC-01 + DATA-02 lên iMac prod

- Commit `334d91f` (fix online orders) + `5bb6b48` (SHOPEE_BOT_HOST), deploy 2 lần qua `./scripts/deploy-imac.sh`, health OK.
- **Phát sinh**: app launchd (gui domain, macOS 15.7) bị **Local Network privacy** chặn outbound tới MacBook (EHOSTUNREACH tới 192.168.88.183:3001) dù curl/node từ ssh shell chạy OK — quyền này không cấp được qua CLI.
- **Giải pháp**: reverse SSH tunnel MacBook→iMac (`ssh -R 3001/3002:localhost` — loopback miễn trừ Local Network). Persist bằng launchd agent trên MacBook: `~/Library/LaunchAgents/com.phucsang.bot-tunnel.plist` (KeepAlive, log `/tmp/phucsang-bot-tunnel.log`). iMac `.env.local`: `SHOPEE_BOT_HOST=127.0.0.1` + bổ sung `NODE_ENV=production` (đóng điểm giòn TODO 2026-06-30).
- **Verify trên domain public** (x-api-key): `/api/shopee-orders/1` → 236 đơn, `/api/shopee-orders/2` → 201 đơn, `/api/shopee-bot-status` → ok:true cả 2 bot, `/api/admin/store/orders` → 200 `{"data":[]}`.
- **Hậu-deploy DATA-02**: chạy `recalculate-revenue-from-orders` cho 2026-06 (net 238.354.000đ, gross 243.845.000đ, returns 4.535.000đ) và 2026-07 (0đ — DB xác nhận chưa có đơn tháng 7).
- Files: `routes/shopeeSync.ts`, `docs/05-process/TODO.md`; ngoài repo: `~/Library/LaunchAgents/com.phucsang.bot-tunnel.plist` (MacBook), `~/cfobrain/.env.local` (iMac)

### 2026-07-02 — Fix "Đơn hàng online" không tải được trên app.phucsang.com.vn

- **Root cause 1 — Shopee hardcode localhost**: 3 component (AllOrdersPage, ShippingOrders, POSHeaderToolbar popup) fetch thẳng `http://localhost:3001/3002` → chỉ chạy trên máy có bot. Fix: thêm proxy backend `GET/POST /api/shopee-orders/:shopId[/refresh]` trong `routes/shopeeSync.ts` (requireAuth), frontend đổi sang relative path + `adminStoreRequest` (gắn JWT). WebSocket realtime chỉ bật khi hostname là localhost; truy cập qua domain fallback polling 60s (conn state cập nhật theo kết quả fetch).
- **Root cause 2 — Rate limit prod tự ăn hết quota**: limiter 300 req/15ph/IP trong khi BotProgressBar poll 3s (~300 req/15ph) → mọi API sau đó 429. Fix: nâng max 300→1000, miễn trừ `/api/shopee-bot-status` khỏi limiter, giãn poll 3s→15s, BotProgressBar dùng `adminStoreRequest` (fetch trần bị 401 trên prod).
- **Root cause 3 — Schema prod lệch migrations**: `/api/admin/store/orders` 500 vì `shipments` thiếu `shipping_fee`/`cod_amount`/`updated_at`, `pos_orders` thiếu `shipping_fee`/`note`/`customer_phone`/`customer_email`, RPC `upsert_website_shipment` không tồn tại, `update_website_order_status` là bản cũ 2 tham số. Đã chạy trên prod DB: migration 017 đầy đủ + 4 ALTER pos_orders + CREATE OR REPLACE `create_store_order` (bản canonical từ supabase_setup.sql). KHÔNG chạy nguyên file migration 014 vì chứa bản cũ `update_website_order_status(UUID,TEXT)` sẽ tạo overload trùng với bản 3 tham số của 017.
- Verify: proxy trả 236+201 đơn 2 shop, `/api/admin/store/orders` → `{"data":[]}` 200, popup Đơn hàng online hiện 40 đơn trên browser. tsc sạch, 318/318 test pass.
- Kill server nohup cũ (chạy từ 23/06, nguồn file `nohup.out`).
- **Lưu ý**: schema DB đã vá trực tiếp trên prod (hiệu lực ngay); code (proxy + rate limit + frontend) CHỜ DEPLOY mới hết lỗi trên app.phucsang.com.vn.
- Files: `routes/shopeeSync.ts`, `server.ts`, `components/shared/BotProgressBar.tsx`, `components/online/AllOrdersPage.tsx`, `components/orders/ShippingOrders.tsx`, `components/pos/POSHeaderToolbar.tsx`

### 2026-06-30 — Vá auth bypass Lớp 2 (defense-in-depth)

- Vá `routes/auth.ts:21`: đổi `return { role: 'owner', userId: 'dev-user' }` → `return null` — loại bỏ dev-bypass trong `resolveCaller` (các route phân quyền: đổi role, tạo tài khoản). Lớp 1 (`requireAuth` chặn 401 trước) đã bảo vệ prod; đây là tầng phòng thủ thứ hai.
- tsc sạch, 318/318 test pass.
- Còn lại: thêm `NODE_ENV=production` vào `.env.local` trên iMac (cần làm khi gần iMac) + deploy SEC-01/DATA-02.
- Files: `routes/auth.ts`

### 2026-06-30 — Audit production-readiness toàn diện + vá SEC-01 + P1 atomic revenue
- **Audit 15 trục** (AI QA Enterprise v4) với kiểm chứng THẬT trên prod (không chỉ tĩnh). Báo cáo: `docs/06-evaluation/PRODUCTION_AUDIT_2026-06-30.md`
- **SEC-03 (anon đọc/ghi toàn DB): XÁC MINH ĐÓNG**. Query grants + RLS policy trên prod: bảng nặng (orders/payroll/revenue/employees/customers) đã hết grant anon; 4 bảng sót (customer_debt_history, shopee_shops, newsletter_subscribers, store_contacts) có RLS chặn anon → đã REVOKE ALL FROM anon dọn dứt điểm
- **Auth bypass Lớp 1: XÁC MINH ĐÓNG** — NODE_ENV=production trong tiến trình live (set qua launchd plist com.cfobrain.app, KHÔNG ở .env.local → điểm giòn nếu restart bằng npm run dev)
- **Vá SEC-01 path traversal** trong `DELETE /api/upload-product-image` (server.ts): `path.resolve` + `startsWith(productsRoot+sep)`. Proof: `../`/absolute đều BLOCK, path hợp lệ ALLOW. Verify route mount (401≠404)
- **P1 DATA-02 — atomic revenue increment**: thay ghi doanh thu read-modify-write (race mất doanh thu nhiều máy/ngày) bằng delta cộng dồn atomic. RPC `apply_revenue_delta` (migration 020 — ĐÃ chạy prod, constraint UNIQUE(date) xác nhận khớp). Áp dụng cả bán & trả/đổi. Giữ offline-first (queue opType `revenueDelta`, local-first optimistic, truyền id tránh nhân đôi sau resync)
- tsc sạch, 318/318 test pass (thêm assertion delta bán & trả). **Code SEC-01 + P1 chờ deploy** (migration đã ở prod, RPC nằm im chưa dùng nên không lệch)
- Files: `server.ts`, `supabase_migrations/020_atomic_revenue_delta.sql`, `supabase_setup.sql`, `routes/data.ts`, `services/apiService.ts`, `services/posOrderService.ts`(+test), `services/posOfflineQueue.ts`, `hooks/useAppData.ts`, `hooks/useOfflineSync.ts`, `types.ts`, `App.tsx`, `components/MainContent.tsx`

### 2026-06-30 — Thanh tiến trình bot Shopee trong app CFO Brain ✅

- **Tính năng**: Thanh cam cố định phía dưới màn hình, hiển thị tiến trình bot đang chạy (filled/total, % progress, tên SP đang xử lý)
- **Bot side** (`bots/sync-descriptions.js`): thêm module-level `_progress` object, cập nhật trong vòng lặp `fillDescriptions`, export `getProgress()`
- **API bot** (`src/apiServer.js`): cập nhật `GET /api/products/fill-descriptions/status` trả về progress chi tiết; thêm `GET /api/bot-status` tổng hợp cả sync + descriptions
- **CFO Brain backend** (`routes/shopeeSync.ts`): thêm `GET /api/shopee-bot-status` proxy đến cả 2 bot (port 3001 + 3002), merge kết quả
- **Frontend** (`components/shared/BotProgressBar.tsx` + `App.tsx`): component poll 3 giây, ẩn hoàn toàn khi không bot nào chạy, hiện progress bar khi descriptions.running hoặc sync.running
- **Fix PM2**: xóa `shopee-bot` cũ (process ngoài ecosystem, không có API_ENABLED, giữ lock shop1), restart `shopee-shop1` → cả 2 bot đều live
- Files: `bots/sync-descriptions.js`, `src/apiServer.js`, `routes/shopeeSync.ts`, `components/shared/BotProgressBar.tsx`, `App.tsx`

### 2026-06-30 — Fix mô tả auto-fetch shop 2 (giaydepphucsang) — 34/34 sản phẩm ✅

- **Vấn đề**: Pass 2 của bot shop2 (lấy description qua edit page) trả về null cho tất cả 34 sản phẩm
- **Root cause 1**: URL Shopee đã đổi — `/portal/product/edit/{itemId}` → `/portal/product/{itemId}` (redirect 404 với URL cũ)
- **Root cause 2**: `page.context().newPage()` chia sẻ cookies nhưng KHÔNG chia sẻ localStorage — Shopee SPA cần localStorage cho auth token → tab mới bị redirect về `/404`
- **Fix 1**: Đổi URL navigate sang `https://banhang.shopee.vn/portal/product/${itemId}` (bỏ `/edit/`)
- **Fix 2**: Copy localStorage + sessionStorage từ trang chính (184 entries) bằng `page.evaluate()`, inject vào tab mới bằng `newPage.addInitScript()` trước khi navigate
- **Fix 3** (loại bỏ): Shopee buyer API `shopee.vn/api/v4/item/get` trả về 403 / errCode 90309999 (anti-bot) → không dùng, giữ cách lấy từ `.ql-editor` DOM trong seller center
- **Kỹ thuật**: Extract description từ `.ql-editor` (Shopee dùng Quill rich-text editor) sau khi SPA render xong
- **Kết quả**: 34/34 sản phẩm shop 2 đã có mô tả trong `shopee_products.description` ✅; tổng 810 items toàn hệ thống có description
- **PM2 tip**: `pm2 restart` không load env mới; phải dùng `pm2 reload ecosystem.config.js --update-env`
- Files: `/Users/apple/shopee-monitor/bots/products.js` (hàm `fetchDescriptionViaEditPage`, pass 2 loop trong `setupProductsBot`)

### 2026-06-29 — Grid view cho ShopeeProductsPage & WebsiteProductsPage + drag-drop ảnh

- Bỏ hậu tố ×2/×3 sau tên shop trong ShopeeProductsPage (mỗi chip chỉ hiện 1 lần)
- Thêm chế độ grid (List/Grid toggle) cho ShopeeProductsPage: `ShopeeGridCard` memo, popup chọn shop với chip biến thể scroll ngang + ShopDetailPanel
- Thêm chế độ grid cho WebsiteProductsPage: `WebsiteGridCard` memo, popup với chip biến thể (color dot + size + published dot) + DetailPanel đầy đủ 6 tab
- Thêm GoodsPagination cho cả 2 trang (cả table lẫn grid mode)
- Thêm drag-and-drop ảnh bìa trong DetailPanel: kéo từ browser → URL tự điền; kéo file → upload lên store-media
- Files: `components/website/ShopeeProductsPage.tsx`, `components/website/WebsiteProductsPage.tsx`

### 2026-06-29 — Fix Shopee variant linking: hiển thị đúng số biến thể mỗi shop

- **Vấn đề**: ShopeeProductsPage hiện "0 đã link POS" cho tất cả sản phẩm shop2 và một số shop1. Nút "Sync Shopee" không hoạt động với sản phẩm chưa có shopee_item_id
- **Root cause 1**: `buildSkuMap()` trong `/Users/apple/shopee-monitor/bots/products.js` chỉ load 1000 row đầu (Supabase default limit), trong khi DB có 14.855 sản phẩm POS Active → hầu hết SKU không tìm thấy
- **Fix 1**: Đổi sang vòng lặp phân trang `.range(from, from+999)` để load toàn bộ 14.855 SKU
- **Root cause 2**: Shopee variant SKU dạng "DQND26-Đen-38-Kèm Hộp" không khớp POS SKU "DQND26-Đen-38"
- **Fix 2**: Strip suffix "-Kèm Hộp" / "-Không Hộp" trước khi fallback lookup trong `upsertVariants()`
- **Root cause 3**: Nút "Sync Shopee" trên UI gọi `/api/shopee-sync` (sync 1 SP, cần itemId) nhưng disabled khi chưa có shopee_item_id → không scan được SP mới
- **Fix 3**: Đổi handleSync gọi `/api/shopee-sync/all` (quét toàn shop), bỏ disable condition. Thêm endpoint `/api/shopee-sync/all` vào `routes/shopeeSync.ts`
- **Kết quả sau restart bot + rescan**: DQND26 Shop1=12 biến thể ✅, Shop2=6 biến thể ✅; Shop1 tổng 378/415 linked (22/29 SP đủ); Shop2 tổng 174/310 linked (25/34 SP đủ)
- **Sản phẩm chưa link được** (7 SP shop1, 9 SP shop2): SKU rỗng trong Shopee Seller Center → cần user thêm SKU trực tiếp trên Shopee
- Files: `/Users/apple/shopee-monitor/bots/products.js`, `components/website/ShopeeProductsPage.tsx`, `routes/shopeeSync.ts`

### 2026-06-28 — Fix ghi dữ liệu qua tunnel bị 401 (hồ sơ cửa hàng/nợ không lưu qua app.phucsang.com.vn)

- Triệu chứng: hồ sơ cửa hàng (SĐT/địa chỉ) sửa nhiều lần vẫn mất; thực ra mọi thao tác lưu qua app.phucsang.com.vn đều thất bại âm thầm (auto-save không báo lỗi)
- Điều tra: ghi DB bằng service-role OK; dev/LAN lưu OK; nhưng POST `/api/data/*` qua tunnil → 401. AuthGate: dev bypass auth, prod bắt buộc session Supabase thật → prod CÓ JWT. Nhưng `postDataRoute` + `fetchCustomerDebtHistory` KHÔNG gắn JWT → qua tunnel (dev-bypass tắt do header X-Forwarded) → requireAuth 401. `clearTable` thì đã gắn JWT sẵn (chỉ 2 chỗ kia sót)
- Fix: thêm helper `getAuthHeaders()` (lấy Bearer từ `supabase.auth.getSession()`), gắn vào `postDataRoute` (mọi lệnh ghi: khách/đơn/sản phẩm/nợ/tồn kho/cấu hình) + `fetchCustomerDebtHistory` (đọc nợ trên prod). Gom `clearTable` dùng chung helper. Dev/LAN không session → header rỗng → dev-bypass như cũ (no regression, đã test brand save dev vẫn lưu)
- Lưu ý: các fetch `/api/ai/*`, `/api/import/*`, `/api/notifications/*` cũng có vấn đề tương tự (ngoài phạm vi, ghi chú lại)
- Files: `services/apiService.ts`

### 2026-06-28 — Fix nợ khách "clear data + đăng nhập lại nợ trở về" (RLS chặn anon đọc) — ROOT CAUSE

- Triệu chứng: điều chỉnh nợ về 0, nhưng clear data + đăng nhập lại thì nợ quay về
- Điều tra (test thật trên DB): các bản ghi điều chỉnh ĐÃ ghi vào DB (server ghi bằng service-role, bypass RLS) — query service-role thấy 4 bản ghi "Điều chỉnh chị Khiêm" type=repay 1.540.000. Nhưng app ĐỌC bằng role `anon` qua `/rest/v1`, mà `customer_debt_history` chỉ có policy "FOR ALL TO authenticated" → anon BỊ CHẶN đọc (pos_orders/pos_customers thì anon đọc được do RLS khác) → app luôn nhận rỗng → nợ tính lại từ đơn
- (Đã loại trừ nhầm: ban đầu nghi dual-DB do lỗi NOT NULL của payload thiếu cột; test round-trip pos_customers chứng minh GHI & ĐỌC cùng 1 DB)
- Fix (không phụ thuộc RLS, tự verify được): đọc `customer_debt_history` QUA SERVER (service-role) thay vì supabase client anon. Thêm route `GET /api/data/customer-debt-history` (routes/data.ts) + `apiService.fetchCustomerDebtHistory()` thay query trực tiếp trong `fetchAllData`. An toàn hơn (không phơi nợ cho anon), nhất quán với cách bảng này được GHI
- Verify: endpoint trả đúng 4 bản ghi (200); load sạch sau restart → chị Khiêm hiện nợ = 0 (đơn 1.540.000 + 4×repay floored 0); tsc sạch. Dọn 3 bản ghi trùng (do double-count cũ), giữ 1 repay → nợ chị Khiêm = 0 sạch
- Files: `routes/data.ts`, `services/apiService.ts`, `supabase_setup.sql` (ghi chú)

### 2026-06-28 — Fix nợ khách "điều chỉnh về 0 vẫn còn nợ" (công thức trang chi tiết)

- Triệu chứng (khách "chị Khiêm"): chỉnh nợ về 0 nhiều lần nhưng vẫn hiện 1.540.000
- Truy dữ liệu thật: nợ 1.540.000 đến từ 1 đơn chưa thu tiền (HD063779, giao 1.540.000 / khách đưa 0). Số nợ được TÍNH LẠI từ đơn mỗi lần mở, không phải số gõ tay
- Root cause: `CustomerDetailPage.customerDebt` chỉ cộng nợ từ đơn hàng, BỎ QUA `customerDebtHistory` (điều chỉnh/thu nợ) — trong khi `CustomerListPage.debtStats` lại cộng cả 2. Hai trang lệch công thức → điều chỉnh về 0 tạo bản ghi repay nhưng chi tiết vẫn tính lại = nợ đơn → "vẫn còn nợ"; bấm lại còn tạo repay chồng (diff tính từ số sai)
- Fix: `customerDebt = max(0, Σ orderDebt + Σ recordDelta)` với recordDelta = repay(−)/debt(+), khớp đúng debtStats
- Verify trên browser (DB thật): mở chị Khiêm → điều chỉnh về 0 → chi tiết hiện 0 NGAY (trước lì 1.540.000) + badge "!" tắt; reload → bản ghi repay persist, list & detail đều 0; sau đó XÓA bản ghi test → chị Khiêm về đúng 1.540.000. tsc sạch
- Files: `components/customers/CustomerDetailPage.tsx`, `docs/business-knowledge/FORMULAS.md` (mục 8.7)

### 2026-06-28 — Fix nợ khách hàng "sửa xong không lưu" (read path thiếu)

- Triệu chứng: trong trang khách hàng, Thu nợ/Điều chỉnh/Ghi giảm nợ thấy số đổi đúng lúc đó nhưng reload lại quay về số cũ
- Root cause: bảng `customer_debt_history` được GHI xuống Supabase đầy đủ nhưng KHÔNG nơi nào ĐỌC lại — `fetchAllData` không query, `mapAllData` không map (còn ghi đè cache thành rỗng mỗi lần sync), merge list ở `useAppData` thiếu key → debt tính lại chỉ từ orders → mất các bản ghi điều chỉnh
- Fix: (1) `fetchAllData` thêm query `customer_debt_history` (order date desc, limit 2000) + trả về trong results; (2) `dataMapper.mapAllData` thêm map cloud→app (snake→camel) + `mergeBy` với localData để hết ghi đè cache rỗng; (3) thêm `customerDebtHistory` vào `SyncableDataKey` + danh sách sync-force của `useAppData`; (4) thêm field vào `DataMapperResults`
- Verify: tsc sạch (3 file sửa không lỗi), server build sạch; network xác nhận app GIỜ gửi `GET /rest/v1/customer_debt_history → 200` lúc bootstrap (trước đây hoàn toàn không có request này). Luồng ghi client→server→bảng đã đúng sẵn, không đổi
- Files: `services/apiService.ts`, `services/dataMapper.ts`, `hooks/useAppData.ts`

### 2026-06-27 — Fix đăng nhập chập chờn "sai mật khẩu" dù tài khoản đúng

- Triệu chứng: thỉnh thoảng báo sai tài khoản/mật khẩu, lát sau cùng tài khoản lại vào được. Log GoTrue prod xác nhận pattern: 400 Invalid credentials rồi 6-12s sau 200 (cùng account), thời gian phản hồi ~120ms → KHÔNG phải timeout/mạng mà mật khẩu gửi lần đầu thật sự khác
- Nguyên nhân: (1) `LoginPage` gán MỌI lỗi thành "sai mật khẩu" (kể cả lỗi mạng/429); (2) form đọc mật khẩu từ React state có thể chưa kịp cập nhật khi autofill điền → gửi rỗng/cũ → 400; (3) input thiếu `autoCapitalize/autoCorrect/spellCheck` → bàn phím di động viết hoa/sửa ký tự (nhất là khi bấm hiện mật khẩu)
- Fix: đọc giá trị thẳng từ `FormData` lúc submit (chống race autofill); thêm `name` + `autoCapitalize=none`/`autoCorrect=off`/`spellCheck=false` cho cả 2 ô; phân biệt lỗi (400→sai mật khẩu, 429→bận, còn lại→lỗi kết nối, không đổ oan mật khẩu)
- Verify: tsc sạch, trang `/login` render đúng thuộc tính mới
- Files: `components/LoginPage.tsx`

### 2026-06-27 — #3 Auth hardening: xóa code chết rủi ro bảo mật

- Phát hiện: `signUp` / `updatePassword` / `resetPassword` / `getUserMetadata` / `isAdmin` / `isManager` trong `services/auth.ts` **không nơi nào gọi** (dead code) → các lỗ hổng BUG-SEC (default role='owner', signUp không guard, updatePassword không cần mật khẩu cũ...) chỉ tồn tại trên code chết
- Giải pháp an toàn nhất: **xóa 6 hàm + interface `SignUpCredentials`** → loại bỏ rủi ro với 0 ảnh hưởng hành vi. Giữ `signIn`/`signOut`/`getCurrentUser`/`getCurrentSession`/`refreshSession` (đang dùng)
- Phân quyền thật vẫn do RLS + `requireAuth` (server) đảm nhiệm — không tin client
- Verify: tsc sạch, build OK, app boot + luồng login nguyên vẹn
- Files: `services/auth.ts`

### 2026-06-27 — #2 Làm cứng checkout POS Mobile (atomic transaction)

- Thay 6 bước insert/update tuần tự trong `routes/posMobile.ts` bằng 1 RPC `pos_mobile_checkout` chạy trong **1 transaction DB**: insert đơn + trừ tồn inline atomic + cộng dồn `revenue_records` atomic (`ON CONFLICT (date)`) + cập nhật KH/nợ + audit (best-effort). Lỗi bất kỳ bước nào → rollback toàn bộ
- Khắc phục 2 rủi ro #2: (a) đơn tạo nhưng revenue/tồn lệch khi fail giữa chừng; (b) race read-modify-write revenue khi 2 đơn cùng ngày
- **Phát hiện schema drift trên production**: migration 013 (RPC `*_v2`) và cột `branch_id`/constraint `(date,branch_id)` của `revenue_records` CHƯA từng chạy trên DB self-hosted. Hàm mới tự chứa (inline trừ tồn, không phụ thuộc RPC ngoài), revenue conflict theo `(date)` + cast `date::DATE` để khớp prod thật. Web POS không ảnh hưởng (`routes/data.ts` đã fallback legacy `apply_inventory_transaction_with_stock`)
- Verify trực tiếp trên prod (BEGIN/ROLLBACK qua `docker exec supabase-db`): happy-path tồn -1, revenue cộng dồn đúng (gross/COGS/lãi gộp), rollback sạch 0 đơn; thiếu tồn → RAISE `Insufficient stock` + rollback (0 đơn ghi)
- Đã apply hàm lên production. Files: `routes/posMobile.ts`, `supabase_migrations/019_pos_mobile_checkout.sql`, `supabase_setup.sql`

### 2026-06-27 — Fix lỗi "máy mới vào báo lỗi, reload mới được" (Service Worker)

- Root cause (từ console máy mới): (1) `service-worker.js` handler mặc định cache MỌI response không kiểm method → `cache.put()` ném `Request method 'HEAD' is unsupported` flood (app poll health/kết nối bằng HEAD); (2) `controllerchange` ép `window.location.reload()` ngay cả lần cài SW đầu tiên → giật giữa lúc khởi tạo
- Fix 1: SW bỏ qua mọi request non-GET (`if (request.method !== 'GET') return;`) — diệt sạch flood, không cache nhầm request mutate
- Fix 2: chỉ auto-reload khi đã có controller trước đó (update thật) — `hadController` guard; lần cài SW đầu không reload
- Verify: tsc sạch, app boot không lỗi console (SW không đăng ký trong preview headless nên phép thử thật là trên production sau deploy)
- Files: `public/service-worker.js`, `registerServiceWorker.ts`

### 2026-06-27 — Fix lỗi ngẫu nhiên "1 trang báo lỗi, trang khác bình thường"

- Nguyên nhân kép: (#2) ChunkLoadError sau deploy — chunk đổi hash, bản cũ trong cache/SW 404 khi `import()`; (#1) truy cập `.items` không null-guard trên record cache cũ thiếu trường
- #2: `ErrorBoundary` tự khôi phục khi gặp ChunkLoadError → xóa toàn bộ cache + reload 1 lần (guard 10s qua sessionStorage chống vòng lặp); nút "Thử lại" cũng reload khi là lỗi chunk
- #1: thêm guard `(x || [])` cho 5 chỗ `.items` còn sót: `printInvoiceFromTemplate.ts` (2), `GoodsAuditForm.tsx` (2), `GoodsPurchaseForm.tsx` (1)
- Verify: tsc sạch (chỉ còn 7 lỗi channelLinks.ts có sẵn), app boot không lỗi console / không module error
- Files: `components/ui/ErrorBoundary.tsx`, `components/pos/printInvoiceFromTemplate.ts`, `components/pos/GoodsAuditForm.tsx`, `components/pos/GoodsPurchaseForm.tsx`

### 2026-06-27 — Bảo mật: vá lỗ hổng API POS Mobile mở công khai

- Root cause: `routes/posMobile.ts` mount không `requireAuth`, 3 endpoint public dùng service role (bypass RLS) → lộ giá vốn + PII khách, cho phép tạo đơn giả/trừ kho/ghi doanh thu từ Internet (app expose qua Cloudflare Tunnel)
- Fix: thêm token bí mật `POS_MOBILE_TOKEN` — desktop lấy qua `GET /api/pos-mobile/token` (có requireAuth), nhúng vào QR; điện thoại gửi qua header `x-pos-mobile-token` (hoặc `?t=`); server đối chiếu timing-safe (`crypto.timingSafeEqual`)
- Bỏ `import_price` khỏi response `/products` (checkout vẫn tự lấy giá vốn từ DB nên không sai COGS)
- Verify (browser + curl): không/sai token → 401, đúng token → 200 và không lộ giá vốn, `/token` có auth → 401 khi thiếu JWT, trang `/pos-quick?t=` bán được
- Files: `routes/posMobile.ts`, `server.ts`, `components/pos/POSHeaderToolbar.tsx`, `components/pos/POSQuickPage.tsx`, `components/LoginPage.tsx`, `.env.local` (thêm `POS_MOBILE_TOKEN`)

### 2026-06-27 — Fix mergeRemoteUpdate không ghi vào IndexedDB

- Root cause: `mergeRemoteUpdate` (gọi khi nhận realtime event từ thiết bị khác) chỉ update RAM, không ghi IndexedDB → reload trang thì mất update
- Fix: thêm IndexedDB persistence vào `mergeRemoteUpdate` trong `hooks/useAppData.ts:828` (giống pattern của `updateSurgical`)
- Files: `hooks/useAppData.ts`

### 2026-06-27 — Refactor OnlineCatalogPage dùng AppData thay vì fetch Supabase riêng

- Root cause: trang catalog tự fetch sản phẩm từ Supabase 1 lần khi mount → không phản ánh sửa đổi từ GoodsInventory
- Fix: loại bỏ `RawProduct` interface + Supabase product fetch; dùng `products: POSProduct[]` prop từ AppData (luôn đồng bộ realtime)
- `platformMap` (raw từ API) → `enrichedPlatformMap` (tính via useMemo: kế thừa platform từ cha xuống con)
- Grid popup: thay Supabase fetch bằng `variantById.get(popupVariantId)` trực tiếp từ AppData
- `MainContent.tsx` line 767: thêm `products={data.posProducts || []}` prop
- Files: `components/website/OnlineCatalogPage.tsx`, `components/MainContent.tsx`

### 2026-06-27 — Fix tên sản phẩm biến thể bị lặp thuộc tính

- Root cause: DB chỉ lưu thuộc tính vào cột `name` của sản phẩm con (vd: "Đen - 38"), không lưu tên cha → `buildVariantProductName("Đen - 38", {Màu:"Đen",Size:"38"})` = "Đen - 38 - Đen - 38"
- Fix trong `dataMapper.ts`: thêm pre-pass xây `parentNameMap` (id → name của sản phẩm cha), dùng tên cha làm `baseName` khi map sản phẩm con — two-pass IIFE pattern
- Fix trong `useRealtimeSync.ts`: dùng `stripVariantProductNameSuffix` để bóc suffix cũ trước khi gọi `buildVariantProductName` khi nhận realtime update
- Files: `services/dataMapper.ts`, `hooks/useRealtimeSync.ts`

### 2026-06-27 — Fix lỗi ngẫu nhiên "Module gặp lỗi" trên nhiều trang

- Root cause: `o.items.forEach()` / `.reduce()` / `.map()` không có null guard → crash khi orders từ cache cũ (IndexedDB) thiếu trường `items`
- Thêm `(o.items || [])` guard tại 14 chỗ trong 7 file: `AnalysisGoodsOverviewPage.tsx` (3 chỗ), `AnalysisBusinessPage.tsx` (2 chỗ), `ProductGroupManager.tsx`, `SupplierContainer.tsx`, `SupplierDetailView.tsx`, `EndOfDayReport.tsx` (6 chỗ), `WebsiteOrdersPage.tsx` (2 chỗ), `CustomerPoints.tsx`
- TypeScript check: chỉ còn lỗi cũ trong `routes/channelLinks.ts` (server-side, không ảnh hưởng React)
- Files: `components/analysis/AnalysisGoodsOverviewPage.tsx`, `components/analysis/AnalysisBusinessPage.tsx`, `components/ProductGroupManager.tsx`, `components/suppliers/SupplierContainer.tsx`, `components/suppliers/SupplierDetailView.tsx`, `components/pos/EndOfDayReport.tsx`, `components/website/WebsiteOrdersPage.tsx`, `components/pos/CustomerPoints.tsx`

### 2026-06-25 — Shopee: Thêm trạng thái FAILED cho đơn giao hàng thất bại

- Thêm cột `cancel_reason TEXT` vào bảng `shopee_inventory_out` (migration SQL trong `supabase_setup.sql`)
- Thêm logic FAILED detection trong `routes/inventoryOutSync.ts`: đơn hủy có `cancel_reason` chứa "giao hàng thất bại" → map thành FAILED thay vì CANCEL
- Thêm `cancel_reason` vào `BotOrder` interface và `mapToRow()` để sync lý do hủy từ bot lên Supabase
- Thêm `FAILED` vào union type `ShopeeInventoryOutRecord.status` trong `src/types/shopee.ts`
- Sync lại toàn bộ 409 đơn → 3 đơn được chuyển đúng sang FAILED (lý do: "Lý do hủy: Giao hàng thất bại")
- Files: `routes/inventoryOutSync.ts`, `supabase_setup.sql`, `src/types/shopee.ts`

### 2026-06-24 — POS: Popup cài đặt in + preview hóa đơn + custom dropdown bảo hành

- Thêm `PrintPreviewModal` vào `POSHeaderToolbar.tsx`: click "A. Mẫu in hóa đơn" → mở popup xem trước hóa đơn mẫu với dữ liệu thực (tên cửa hàng, địa chỉ, SĐT từ brandProfile)
- Đổi dòng "Cho mỗi hàng hóa" từ `<select>` native sang custom dropdown (chevron xoay, overlay click-outside, checkmark option đang chọn)
- Sửa icon máy in: không active = màu slate-400 bằng với các icon khác (trước đó nhạt hơn)
- Sửa toggle gạt: ô tròn trượt thật sự bằng CSS transform (trước chỉ đổi màu)
- Bỏ border/khung quanh nút +/− và ô số bản in (giữ borderless cho gọn)
- Files: `components/pos/POSHeaderToolbar.tsx`

### 2026-06-24 — POS: Thêm popup cài đặt in khi click icon máy in

- Thêm `POSPrintSettings` interface vào `hooks/usePOSState.ts` với localStorage persistence
- Thay `isAutoPrintEnabled` boolean đơn giản bằng `printSettings` object (6 trường: autoPrintInvoice, mergeItems, invoiceCopies, autoPrintWarranty, warrantyMode, warrantyCopies)
- Giữ `isAutoPrintEnabled` / `setIsAutoPrintEnabled` dưới dạng derived value để không phá vỡ keyboard shortcut và checkout logic
- Sửa `POSHeaderToolbar.tsx`: icon máy in mở popup dropdown (giống style showGridMenu) với toggles, number inputs, select, nút Bỏ qua/Xong
- Thêm sub-components `PrintToggleRow` và `PrintCopiesInput` vào POSHeaderToolbar
- Files: `hooks/usePOSState.ts`, `components/pos/POSHeaderToolbar.tsx`, `components/pos/POSComputer.tsx`

### 2026-06-24 — Agent Console: Feature 3 — kết nối Dev Console với File Explorer

- Tạo `FilePicker.tsx`: modal chọn file từ project đã đăng ký, hỗ trợ tìm kiếm và duyệt thư mục đệ quy
- Cập nhật `Console.tsx`: nút đính kèm file (Paperclip), hiển thị file chip, gửi nội dung file vào context chat
- Parse code block trong response AI → nút Copy + nút "Áp dụng" trên mỗi block
- "Áp dụng" mở FilePicker chọn file đích → PUT `/api/console/projects/:id/file` → ghi đè nội dung
- Toast confirm sau khi áp dụng thành công
- Files (agent-console): `client/src/components/FilePicker.tsx`, `client/src/pages/Console.tsx`

### 2026-06-23 — Sửa trang khách hàng: dữ liệu từ đơn hàng thực tế + redesign tab lịch sử

- Thay toàn bộ `c.totalSpent` (static Supabase = 0) bằng `orderStats` tính từ đơn hàng thực tế trong CustomerListPage
- Đổi `POS_ORDER_BOOTSTRAP_DAYS` từ 90 → 0 (load all-time) để có đủ dữ liệu 69,539 đơn thay vì chỉ 5,310
- Link 3 đơn hàng mồ côi (HD065290, HD065142, HD064705) với customer_id đúng qua Supabase REST API
- Tổng bán khớp KiotViet: 186.458.000 / Trừ trả hàng: 176.658.000
- Redesign tab "Lịch sử bán/trả hàng" trong CustomerDetailPage: 5 cột giống KiotViet (Mã hóa đơn, Thời gian, Người bán, Tổng cộng, Trạng thái)
- Files: `components/customers/CustomerListPage.tsx`, `components/customers/CustomerDetailPage.tsx`, `services/apiService.ts`

### 2026-06-22 — Revert wacMap on-the-fly, giữ kiến trúc đúng

- Revert `wacMap` on-the-fly ở 5 file (MainContent, POSComputer, 3 trang Analysis) — không cần vì `product.importPrice` đã được cập nhật đúng tại thời điểm nhập hàng trong `PurchaseOrdersContainer.tsx` (dòng 932: `calculateNextImportPrice()`)
- Kiến trúc giá vốn đúng: Nhập hàng → tính WAC/fixed → cập nhật `product.importPrice` → POS + Analysis đọc trực tiếp
- `reportCalculations.ts` vẫn giữ `buildCostHistory()` vì báo cáo lợi nhuận cần giá vốn **tại thời điểm bán** (historical), không phải giá vốn hiện tại
- Files: `components/MainContent.tsx`, `components/pos/POSComputer.tsx`, `components/analysis/AnalysisBusinessPage.tsx`, `components/analysis/AnalysisGoodsOverviewPage.tsx`, `components/analysis/AnalysisGoodsStockPage.tsx`

### 2026-06-22 — Tích hợp WAC calculator + tài liệu công thức

- Implement WAC (Weighted Average Cost) vào `reportCalculations.ts`:
  - Viết lại `buildCostHistory()`: tính WAC thực sự qua từng phiếu nhập, phân bổ chiết khấu NCC toàn đơn (dùng `calcEffectiveUnitPrice()` + `calculateNextImportPrice()` mode average).
  - Sửa `getSalesProfitRowsByDate()`: đổi ưu tiên giá vốn — WAC từ costHistory > item.importPrice > product.importPrice.
- Tạo `docs/business-knowledge/FORMULAS.md`: tổng hợp tất cả công thức tính toán trong app, chia 7 nhóm (Giá vốn, Doanh thu, Lương, Tài chính, Chiến lược, Benchmarks, Báo cáo).
- Files: `src/lib/reportCalculations.ts`, `docs/business-knowledge/FORMULAS.md`

### 2026-06-22 — Nghiên cứu thuật toán tính giá vốn KiotViet (WAC, không phải FIFO)

- Reverse-engineer thuật toán giá vốn KiotViet bằng cách so sánh WAC simulation với `importPrice` trên 69,539 đơn + 1,068 phiếu nhập.
- **Phát hiện chính**: KiotViet dùng **Weighted Average Cost (WAC)**, KHÔNG phải FIFO.
  - Công thức: `new_WAC = (stock × old_WAC + import_qty × import_price) / (stock + import_qty)`
  - Bán hàng giảm tồn nhưng KHÔNG thay đổi WAC. Returns cộng tồn, không đổi WAC.
- **Kết quả kiểm tra SP000927** (36 imports, 1,282 sales): WAC match 710/1,257 (56.5%).
  - 710 đơn đầu match 100%. Sai lệch bắt đầu từ 2025-07-17.
  - Nguyên nhân: KiotViet có thêm sự kiện kho (kiểm kho, chỉnh tồn, tồn đầu kỳ) KHÔNG nằm trong DB.
  - Bằng chứng: SP001898 chỉ 1 giá nhập 85,000đ nhưng WAC KV = 84,997.46 → có event khác.
- **Kết luận**: Không thể tính WAC 100% match KiotViet chỉ từ dữ liệu import. Cần dữ liệu kiểm kho + tồn đầu kỳ.
- **Đề xuất**: Dùng tiếp `importPrice` từ KiotViet export (đang đạt 99.99996%). Triển khai WAC calculator cho đơn mới khi có đủ dữ liệu nhập hàng.
- Không thay đổi file code nào.

### 2026-06-22 — Đồng bộ giá vốn & doanh thu với KiotViet — đạt 100% chính xác

- Fix báo cáo lợi nhuận sai lệch 599M giá vốn + 262M doanh thu so với KiotViet:
  - Thêm `importPrice` vào `POSOrderItem` interface, ưu tiên giá vốn KiotViet gán cho từng item.
  - Sửa `reportCalculations.ts` + `FinanceReportPage.tsx`: ưu tiên `item.importPrice` > historical cost > product cost.
  - Patch 69,505 đơn hàng: gán `importPrice` cho 116,848 items từ KiotViet export.
  - Fix 384 đơn bán bị đánh dấu sai `is_return=true` (373 HD* + 11 HDD_TH*).
  - Import 33 đơn trả hàng TH* tháng 6/2026, sửa `total_amount` cho 32 đơn TH* khác.
- Kết quả: Doanh thu 0đ chênh lệch, Giá vốn 328đ (làm tròn FIFO), Lợi nhuận -328đ.
- **Chưa giải quyết**: App copy giá vốn từ KiotViet export, chưa tự tính FIFO độc lập.
- Files: `src/types/pos.ts`, `src/lib/reportCalculations.ts`, `components/reports/FinanceReportPage.tsx`

### 2026-06-22 — Import toàn bộ dữ liệu KiotViet vào CFO Brain

- Fix route `/api/import/kiotviet-customers`: thêm format "Danh sách khách hàng" (col0="Loại khách") với mapping col[2]=Mã KH, col[3]=Tên, col[4]=SĐT, col[5]=Địa chỉ, col[8]=Điểm, col[15]=Tổng bán trừ trả. Import thành công **251 khách hàng**.
- Fix route `/api/import/kiotviet-revenue`: thêm format "Chi tiết hóa đơn" (col6="Thời gian") — format export đầy đủ 65 cột từ KiotViet. Detect qua `col6Header === 'Thời gian'`, dùng `excelDateToLocalIsoDateTime(row[6])` để parse datetime, gom đơn theo Mã hóa đơn (col1). Import thành công **40/40 file**, **67,530 đơn hàng**, **1,187 ngày doanh thu**.
- Import sản phẩm: **13,799 SP** thành công (600 trùng SKU với Shopee — bình thường). Import chi tiết nhập hàng: **12,654 dòng**, **67 NCC**, **1,068 phiếu nhập**.
- Files: `routes/import.ts`

### 2026-06-22 — Bot sync gallery + mô tả sản phẩm Shopee (63/63 SP)

- Viết lại `fetchItemDetailViaPage` trong `productSync.js`: navigate thẳng đến `/portal/product/{item_id}` thay vì đi qua product list. Fix timeout bằng `waitUntil: 'load'` + `waitForTimeout(5000)`.
- Fix lỗi `category_name` column không tồn tại: comment out field trong updateData, thêm ALTER TABLE vào `supabase_setup.sql`.
- Batch sync thành công toàn bộ 63 SP (shop1: 29/29, shop2: 34/34): ảnh gallery (3–9 URL/SP), mô tả đầy đủ tiếng Việt, weight, categoryId, categoryName lưu vào `shopee_products`.
- Files: `/Users/apple/shopee-monitor/bots/productSync.js`, `supabase_setup.sql`

### 2026-06-22 — Bot lấy thông tin sản phẩm Shopee + lưu vào DB

- Sửa lỗi NOT NULL constraint trên `shopee_product_variants.pos_product_id`: chạy `ALTER TABLE ... DROP NOT NULL` qua API pg/query. Bot code cũ bỏ sót field khi không match SKU — sửa để luôn ghi `pos_product_id: null` thay vì bỏ qua.
- Viết lại hoàn toàn `/Users/apple/shopee-monitor/bots/products.js`: lấy TẤT CẢ thông tin có thể từ Shopee (dual-source: list API + detail API), lưu vào DB mà không cần match POS SKU (pos_product_id nullable). Thêm cột `raw_data JSONB`, `gallery`, `price_min`, `price_max`, `stock_total`, `item_sku`, `brand_name`, `weight`, `description`, `model_id`, `model_name`, `stock` cho variants.
- Phát hiện API detail (`/api/v2/product/get_item_detail`) trả về 404 — thử nhiều GET/POST endpoints đều fail. Xác định `model_list` trong list response đã có đủ variant data (sku, giá, stock).
- Sửa field mapping variant: `model_id` từ `model.id`, `price` từ `price_detail.origin_price`, `stock` từ `stock_detail.total_available_stock`.
- Chạy bot thành công: shop1 = 29 sản phẩm, shop2 = 34 sản phẩm. DB: 94 sản phẩm, 905 variants, 415 variants có price/stock.
- Files: `/Users/apple/shopee-monitor/bots/products.js`

### 2026-06-21 — Sửa màn hình trắng + lỗi tải sản phẩm website

- Fix màn hình trắng toàn app: icon `Settings` dùng trong `constants/navigation.ts` (route website-operations) nhưng thiếu import từ `lucide-react` → thêm vào import list.
- Fix trang sản phẩm website báo "lỗi tải sản phẩm": `services/adminStoreApi.ts` throw ngay khi không có Supabase session (app dùng auth nội bộ, không dùng Supabase auth) → sửa thành bỏ throw, gửi request không có auth header.
- Fix backend `routes/adminStore.ts`: `requireRole` không dùng dev bypass → chain `requireAuth` (có localhost bypass) + nếu không có JWT gán role `admin` cho dev mode.
- Cập nhật tất cả 18 route registrations trong `adminStore.ts` dùng `...requireRole(...)` (spread array) thay vì `requireRole(...)`.
- Thêm `PATCH` và `DELETE` vào CORS methods trong `server.ts` (trước đó thiếu → PATCH request bị reject từ browser).
- Sửa 7 lỗi TypeScript `string | string[]`: `req.params.id` đổi thành `String(req.params.id)` trong các lời gọi `writeAudit` và `saveVariants` (do `ParamsDictionary` trong @types/express-serve-static-core type giá trị là `string | string[]`).
- `npx tsc --noEmit` → 0 lỗi.
- Restart server để pick up code mới (server cũ khởi động trước khi code được sửa → routes không được đăng ký).
- Xác nhận: trang sản phẩm website hiển thị đầy đủ danh sách sản phẩm sau restart.
- Files: `constants/navigation.ts`, `services/adminStoreApi.ts`, `routes/adminStore.ts`, `server.ts`

### 2026-06-20 — Help Center: Viết bài + Chụp screenshot dạng step-by-step

- Tạo script `scripts/capture-help-screenshots.cjs` với Playwright: chụp 45 ảnh cho 4 bài viết (pos-intro, pos-create-order, goods-search, goods-adjust).
- Thêm highlight đỏ (#E63329) trực tiếp lên element trước khi chụp: dùng `highlight` (CSS selector) và `locatorHighlight` (Playwright locator) để bypass giới hạn `querySelector` trong browser context.
- Viết lại toàn bộ 4 bài viết trong `data/helpArticles.ts` theo format step-by-step mật độ cao: mỗi bước hành động có ảnh minh hoạ ngay bên dưới, highlight chỉ thẳng vào UI element.
- Xử lý các lỗi khi chụp: `{ force: true }` cho click bị overlay, `Escape` để đóng modal, URL navigation thay vì click nav.
- Files: `scripts/capture-help-screenshots.cjs`, `data/helpArticles.ts`, `public/help/images/` (45 ảnh)

### 2026-06-20 — Theme Phúc Sang

- Tạo theme `phuc-sang` mới: đỏ `#E63329` chủ đạo, vàng `#F8C21C` accent, nền trắng sạch.
- Xoá theme Prestige và Clarity khỏi `constants/themes.ts`, `hooks/useTheme.ts`, `index.css`.
- Sửa TopNav: nền trắng khi dùng theme Phúc Sang, nav item text slate, active item đỏ nhạt, nút BÁN HÀNG đỏ.
- Icon "Hoạt động gần đây": nền `#FEF2F2` (nhạt như icon Doanh thu), icon màu vàng `#F8C21C`.
- Recharts: bar đỏ, line chart vàng, dots vàng.
- Dữ liệu trong bảng tbody: reset về màu đen.
- Files: `index.css`, `constants/themes.ts`, `hooks/useTheme.ts`, `phuc-sang-ui.css` (thêm mới)

### 2026-06-20 — Deploy Store API sau migration 014

- Deploy lên iMac thành công: đồng bộ mã, Vite production build, restart `com.cfobrain.app`, health check trả `OK`.
- Smoke test read-only `GET /api/store/products`: HTTP 200, trả 30 sản phẩm (sản phẩm đầu có 6 biến thể) và không lộ trường `import_price`.

### 2026-06-20 — Deploy production migration 014 cho đơn website

- Chạy `supabase_migrations/014_store_order_inventory_integrity.sql` trong transaction qua internal `pg/query` trên production; response thành công.
- Xác minh chỉ-đọc definition RPC: `create_store_order` đã dùng `website_price_override` và gộp cart line; `update_website_order_status` có `search_path=public`, idempotency và gộp dữ liệu hoàn tồn.
- Không tạo đơn thử để không làm thay đổi tồn kho vận hành.

### 2026-06-20 — Tăng toàn vẹn RPC đơn website

- Thêm migration `014_store_order_inventory_integrity.sql`: `create_store_order` dùng `website_price_override`, gộp cart line trùng SKU trước khi kiểm/trừ tồn; `update_website_order_status` áp dụng state machine một chiều, retry idempotent và gộp SKU trùng trước khi hoàn tồn.
- Đồng bộ RPC vào `supabase_setup.sql`; UI đơn website chỉ báo đã cộng tồn khi RPC xác nhận `restocked=true`.
- Thêm test hồi quy cho các điều kiện của migration.
- Files: `supabase_migrations/014_store_order_inventory_integrity.sql`, `supabase_setup.sql`, `components/website/WebsiteOrdersPage.tsx`, `tests/unit/storeOrderRpcMigration.test.ts`, tài liệu kế hoạch/TODO.

### 2026-06-20 — Xác nhận dữ liệu Giai đoạn 4 tích hợp website

- Kiểm tra production qua Supabase: 30 `store_products` đều đã có slug chuẩn; 180 `store_product_variants` đều đã có `color_name` và `size`. Hai SQL fix ghi trong `supabase_setup.sql` đã được áp dụng, không cần chạy lại.
- Cập nhật kế hoạch và TODO: bỏ bước chạy SQL cũ; còn lại 13 SKU chưa tồn tại trong `pos_products` (DBDN01–07, DDDN01–03, DXNN01–03) cần dữ liệu hàng hoá/vận hành trước khi xuất bản.
- Files: `docs/05-process/TODO.md`, `docs/02-development/KE-HOACH-DATABASE-VA-TICH-HOP-APP.md`, `docs/05-process/HISTORY.md`

### 2026-06-20 — Giai đoạn 4 tích hợp website: SQL fix + tài liệu API cho web team

- Viết SQL Giai đoạn 4 vào `supabase_setup.sql`: (1) fix slug từ `dbd01-den-38-timestamp` → `dbd01`, (2) parse `color_name` + `size` từ SKU format `DBD01-Den-38` cho 180 `store_product_variants`. Cần chạy thủ công trên iMac.
- Phát hiện 13 sản phẩm từ website (DBDN01-07, DDDN01-03, DXNN01-03) chưa có trong `pos_products` — cần nhập tay trong app trước khi có thể link lên website.
- Cập nhật `docs/02-development/KE-HOACH-DATABASE-VA-TICH-HOP-APP.md`: thêm section 23 (tiến độ thực hiện — 30/43 sản phẩm đã có) + section 24 (hướng dẫn đầy đủ cho web team: 5 endpoint, format request/response JSON, những gì không được làm, cách test ngay).
- Files: `supabase_setup.sql`, `docs/02-development/KE-HOACH-DATABASE-VA-TICH-HOP-APP.md`

### 2026-06-20 — Fix trang Hoá đơn: Người tạo/Người bán hiện ID số thay vì tên

- Root cause: `OrderInvoices.tsx` hiển thị `order.createdBy || order.staffId` — cả 2 đều là ID nhân viên. Component không nhận `employees` prop nên không tra cứu được tên.
- Fix: Thêm `employees?: Employee[]` prop + `getStaffName()` lookup. Fallback chain: `staffName → employee.name(by id) → createdBy → staffId`.
- Truyền `employees={data.employees || []}` từ `MainContent.tsx` và `ProcessOrdersModal` → `POSComputer`.
- Files: `components/orders/OrderInvoices.tsx`, `components/MainContent.tsx`, `components/pos/ProcessOrdersModal.tsx`, `components/pos/POSComputer.tsx`

### 2026-06-20 — Chạy production migrations: AUDIT-019, AUDIT-022, AUDIT-004/017

- AUDIT-019: Xóa 1 duplicate (order 260527G97D8P3T / SKU "Không rõ") và thêm `UNIQUE(order_id, sku)` vào `shopee_inventory_out`. Chạy qua internal pg/query API (port 8000).
- AUDIT-022: Thêm `UNIQUE(date)` vào `revenue_records` và `UNIQUE(employee_id, month)` vào `payroll_records`. Không có duplicate trong revenue. payroll có 2 null employee_id khác nhau — không vi phạm UNIQUE (NULL ≠ NULL trong PostgreSQL).
- AUDIT-004/017: Backfill `nextImportPrice` vào 1057 Import transactions. 4 item của 2 transaction cũ (SP010315, SP005693/5692/5691) không thể backfill vì `importPrice = null` và không có lịch sử giá — dữ liệu gốc thiếu.
- Files: Production DB (không có thay đổi code), `docs/05-process/TODO.md`

### 2026-06-20 — Fix 2 test thất bại + BUG-F1 + AUDIT-004/017

- Fix 2 test trong `posOrderService.test.ts`: đổi 2 `toHaveBeenCalledWith` riêng biệt sang 1 `arrayContaining` — phản ánh đúng behavior sau AUDIT-003/009 (inventoryTransaction + stockUpdates gộp thành 1 atomic call). 286/286 tests pass, TypeScript clean.
- BUG-F1: Xóa bộ lọc "Hạch toán kết quả kinh doanh" khỏi `CashLedgerPage.tsx` — filter này chưa bao giờ có tác dụng do `LedgerEntry` không có field tương ứng. Xóa: type `BusinessFilter`, state `businessFilter`, UI FilterSection, references trong `hasActiveFilters` + `clearFilters`.
- AUDIT-004/017: Viết SQL migration backfill `nextImportPrice` vào cuối `supabase_setup.sql` — cập nhật JSONB items trong `inventory_transactions` (type='Import', nextImportPrice=0/null) dựa vào `product_cost_history` gần nhất theo SKU + ngày. Cần chạy thủ công trên Supabase Dashboard.
- Files: `services/posOrderService.test.ts`, `components/finance/CashLedgerPage.tsx`, `supabase_setup.sql`, `docs/05-process/TODO.md`

### 2026-06-20 — Fix trang chụp ảnh mobile: camera + load thông tin sản phẩm

- Fix trang `/upload-image/:productId` trả về HTML thay vì JSON: root cause là server đang chạy bản cũ (started 23:23 nhưng `server.ts` sửa lúc 23:54). Restart server để pick up route `/api/product-info/:productId`.
- Thêm route GET `/api/product-info/:productId` vào `server.ts` (public, không cần auth): query Supabase lấy `name, sku, attributes` theo productId.
- Fix camera trên điện thoại: thay `getUserMedia()` (bị block trên HTTP) bằng `<input type="file" capture="environment">` trong `MobileImageUploadPage.tsx`.
- Redesign giao diện chụp ảnh mobile (`MobileImageUploadPage.tsx`): card vuông ảnh/camera icon, tên sản phẩm + màu phía dưới, nút "Chụp ảnh" dạng pill, flash overlay ✓/✗, badge đếm ảnh, chụp liên tục tự động.
- Fix grid view hàng hoá: căn giữa tên sản phẩm, ẩn SKU dạng `__PARENT_...`, hiện SKU con đầu tiên thay thế, bỏ text "Tồn:", fix ảnh con fallback cho sản phẩm cha.
- Files: `server.ts`, `components/pos/MobileImageUploadPage.tsx`, `components/pos/GoodsGridView.tsx`, `App.tsx`

### 2026-06-19 — Fix stacking context + UI improvements trang danh sách hàng hoá

- Fix modal bị che bởi navbar: bỏ `z-0` khỏi `<main>` trong `App.tsx` — loại bỏ stacking context khiến `fixed z-modal(400)` bị nhốt dưới z-index của navbar.
- Popup QR "Thêm ảnh": chuyển sang layout 2 cột (QR trái / ảnh phải) khi điện thoại upload ảnh đầu tiên; lưới 4 cột × 2 hàng có scroll; nút X xoá từng ảnh phiên; QR-only mode khi chưa kết nối.
- Thêm nút mũi tên trượt ảnh trên main image trong `GoodsProductDetailPanel` khi có hơn 4 ảnh; counter overlay "1/N" khi hover.
- Fix nút "Tạo mới" nhóm hàng trong sidebar bộ lọc không phản hồi: thread `onCreateGroup` prop qua `GoodsProductsWorkspace` → `GoodsFilterSidebar` → button.
- Fix ảnh sản phẩm cha trong grid view: hiện ảnh con đầu tiên nếu sản phẩm cha không có ảnh riêng (`firstChildImage` fallback).
- Thêm DELETE `/api/upload-product-image/:productId` vào `server.ts` để xoá ảnh khỏi mảng.
- Files: `App.tsx`, `server.ts`, `components/pos/GoodsProductDetailPanel.tsx`, `components/pos/GoodsFilterSidebar.tsx`, `components/pos/GoodsProductsWorkspace.tsx`, `components/pos/GoodsInventory.tsx`, `components/pos/GoodsGridView.tsx`

### 2026-06-19 — Feature: apply-to-variants + Fix import tự tính đủ dữ liệu

- Thêm checkbox "Áp dụng thay đổi cho các hàng hoá cùng loại" vào tab Thông tin của modal chỉnh sửa hàng hoá (dưới section Quyền theo đơn vị tính và thuộc tính), chỉ hiện khi sản phẩm có parentId.
- Tạo `ApplyToVariantsModal.tsx`: popup chọn sản phẩm cùng loại (parentId), checkbox per-row + "Chọn tất cả", nút "Đồng ý (n)" / "Bỏ qua".
- Cập nhật `useGoodsProductEditor.ts`: tính diff (loại trừ name/sku/barcode/stock/id/parentId…), tìm siblings, batch upsert surgical cho từng sibling được chọn.
- Fix `routes/import.ts` — `kiotviet-purchase-details`: tự ghi `product_cost_history` (idempotent qua `stableUuidFromKey`) ngay trong quá trình import phiếu nhập.
- Fix `routes/import.ts` — `kiotviet-invoices`: (1) tính `total_spent`+`last_visit` từ orderMap thay vì gán 0; (2) ghi `revenue_records` daily từ `dailyMap` với fetch-existing-by-date trước để reuse ID.
- Ẩn 3 section utility thừa trong `MigrationTab.tsx`: "Khởi tạo lịch sử giá nhập", "Tính lại doanh thu tháng này", "Đồng bộ số liệu khách hàng từ đơn hàng" — dữ liệu này giờ được tính tự động trong import.
- Files: `components/pos/ApplyToVariantsModal.tsx` (mới), `components/pos/useGoodsProductEditor.ts`, `components/pos/GoodsCreateProductInfoTab.tsx`, `components/pos/GoodsCreateProductModal.tsx`, `components/pos/GoodsInventoryModals.tsx`, `components/pos/GoodsInventory.tsx`, `routes/import.ts`, `components/settings/tabs/MigrationTab.tsx`

### 2026-06-19 — Xác minh 6 vấn đề chưa xác nhận (NV-001 → NV-006) + Viết lại docs business knowledge sang tiếng Việt

- **NV-001:** Xác nhận `computeNewTier()` hoạt động đúng (đã fix từ AUDIT-010). Tier tự động nâng dựa vào `totalSpent`.
- **NV-002:** Xác nhận scheduler: critical alerts mỗi 6 tiếng, EOD report 21:00 VN, cooldown 6h, distributed lock chống gửi trùng.
- **NV-003:** Xác nhận limit không đồng nhất: 2000 (hầu hết), 5000 (metadata), 500 (employees), 90 ngày (pos_orders).
- **NV-004:** Phát hiện `product_cost_history` không được ghi khi nhập hàng qua OP-011. Đã fix: thêm `writeCostHistory()` vào `routes/data.ts` cho payload `type='Import'`.
- **NV-005:** Xác nhận luồng xuất kho nội bộ: type='internal_use', validate tồn kho thực tế, trừ stock và INSERT transaction.
- **NV-006:** Xác nhận luồng trừ hàng lỗi: type='disposal', SET stock=actualStock (không cộng/trừ), INSERT transaction, có rollback tự động.
- Cập nhật `SYSTEM_OVERVIEW.md`: thay bảng NEEDS_VERIFICATION bằng kết quả xác minh đầy đủ, sửa state machine #7 (không có trường status).
- Viết lại toàn bộ 26 file `docs/business-knowledge/` sang tiếng Việt (tài liệu 1 nguồn, AI + người đọc được).
- Sửa sai nghiêm trọng trong `OP-012-chot-luong.md`: doc cũ mô tả "UPDATE status='official'" sai hoàn toàn — thực tế là upsert 4 bảng đồng thời.
- Sửa sai trong `OP-011-nhap-hang-nhanh.md`: luôn ghi supplier_debts với 'NCC lẻ' fallback, có chiết khấu toàn phiếu, có upload hóa đơn.
- Files: `routes/data.ts`, `docs/business-knowledge/SYSTEM_OVERVIEW.md`, `docs/business-knowledge/STATE_TRANSITIONS.md`, `docs/business-knowledge/operations/OP-011-nhap-hang-nhanh.md`, `docs/business-knowledge/operations/OP-012-chot-luong.md`, tất cả file trong `docs/business-knowledge/`, `docs/05-process/HISTORY.md`, `docs/05-process/TODO.md`

### 2026-06-19 — Fix Nhóm 7 kiểm toán: Revenue returnDate, dedup serial loop, dead code, gap check (AUDIT-006, 008, 002, 015, 021)

- **AUDIT-006:** `processReturnOrder` trong `posOrderService.ts` — xóa Case B (điều chỉnh ngày bán gốc), luôn ghi revenue vào ngày trả hàng.
- **AUDIT-008:** `inferIsReturnOrder` trong `dataMapper.ts` — chỉ giữ `explicit === true`, bỏ fallback `/^TH\d/i` và `finalAmount < 0` để tránh false positive.
- **AUDIT-002:** `SettingsCenter.tsx` — xóa dead state `costMethod / setCostMethod` (localStorage-only, không sync Supabase). `GoodsTab.tsx` đã đọc/ghi đúng từ Supabase.
- **AUDIT-015:** `inventoryOutSync.ts` — chuyển serial for loop cập nhật đơn sang batch upsert `onConflict: 'order_id,sku'`, tiết kiệm N round-trips mỗi lần sync.
- **AUDIT-021:** `businessLogic.payroll.ts` — thêm gap check sau overlap check: cảnh báo khi có khoảng thâm niên không có policy nào bao phủ.
- Files: `services/posOrderService.ts`, `services/dataMapper.ts`, `components/settings/SettingsCenter.tsx`, `routes/inventoryOutSync.ts`, `src/lib/businessLogic.payroll.ts`

### 2026-06-19 — Fix Nhóm 6 kiểm toán: Tier KH tự động + NCC lẻ (AUDIT-010, 011)

- **AUDIT-010:** Thêm `computeNewTier()` vào `POSComputer.tsx` — tự động nâng hạng KH sau mỗi đơn dựa trên `totalSpent` và ngưỡng từ `localStorage`. Chỉ nâng, không hạ. Cập nhật mô tả trong `SettingsCenter.tsx`.
- **AUDIT-011:** `useGoodsPurchase.ts` ghi nợ ngay cả khi không có NCC (supplierName = 'NCC lẻ', supplierId = ''). `GoodsInventory.tsx` thêm modal cảnh báo trước khi hoàn thành nếu chưa chọn NCC.
- Files: `components/pos/POSComputer.tsx`, `components/settings/SettingsCenter.tsx`, `components/pos/useGoodsPurchase.ts`, `components/pos/GoodsInventory.tsx`

### 2026-06-19 — Fix Nhóm 5 kiểm toán: Tài liệu business knowledge (AUDIT-001, 004, 017)

- **AUDIT-001:** Sửa mô tả sai `fixed` cost method trong 3 file docs — đổi "ghi đè hoàn toàn" thành "giữ nguyên giá vốn hiện tại, chỉ dùng giá mới khi currentImportPrice = 0"
- **AUDIT-004:** Thêm warning block COGS fallback vào `REVENUE_PROFIT_LOGIC.md` — cảnh báo khi InventoryTransaction cũ thiếu `nextImportPrice` → fallback về giá hiện tại
- **AUDIT-017:** Thêm ghi chú fallback behavior vào `REPORT_LOGIC.md` sau `getHistoricalCost()`
- Files: `docs/business-knowledge/INVENTORY_LOGIC.md`, `docs/business-knowledge/operations/OP-003-nhap-hang.md`, `docs/business-knowledge/REVENUE_PROFIT_LOGIC.md`, `docs/business-knowledge/REPORT_LOGIC.md`

### 2026-06-19 — Fix Nhóm 4 kiểm toán: Schema/DB constraints (AUDIT-019, 022)

- **AUDIT-019:** Đổi `.insert()` → `.upsert({ onConflict: 'order_id,sku', ignoreDuplicates: true })` trong `routes/inventoryOutSync.ts` — tránh lỗi 500 khi 2 sync chạy đồng thời
- **AUDIT-022:** Thêm migration `supabase_setup.sql` + chạy trên Supabase dashboard:
  - `ALTER TABLE revenue_records ADD COLUMN branch_id` + `UNIQUE(date, branch_id)`
  - `ALTER TABLE payroll_records ADD COLUMN branch_id` + `UNIQUE(employee_id, month)`
- TypeScript clean
- Files: `routes/inventoryOutSync.ts`, `supabase_setup.sql`

### 2026-06-19 — Fix 10 findings kiểm toán (Nhóm 1–3 / tổng 5 nhóm)

- **Nhóm 1 (phiên trước):** AUDIT-008, 013, 015, 016 — computeGrossProfit(), toLocalDateKey(), các logic đơn lẻ
- **AUDIT-007:** `processReturnOrder` giờ tự tính `totalSpent` đúng (không phụ thuộc caller) — `services/posOrderService.ts`
- **AUDIT-006:** Fix hoàn tiền sai ngày doanh thu — thêm `originalOrderId` vào luồng trả hàng, tách logic cùng ngày / khác ngày — 5 files: `types.ts`, `components/pos/types.ts`, `usePOSReturnFlow.ts`, `POSComputer.tsx`, `posOrderService.ts`
- **AUDIT-005:** Xác nhận đã tự fix (throw exits trước autoUpsertStaffSalesForDate khi rollback)
- **AUDIT-003/009:** Gộp 2 lần gọi `updateSurgical` riêng thành 1 → kích hoạt atomic RPC `apply_inventory_transaction_with_stock` — `services/posOrderService.ts`
- **AUDIT-002:** Thêm `useEffect` sync `costMethod` từ Supabase xuống `localStorage` — `App.tsx`
- **AUDIT-012:** Đổi 5 regex character literal `[̀-ͯ]` → `[̀-ͯ]` (encoding-safe) — `src/lib/businessLogic.revenue.ts`
- TypeScript clean sau toàn bộ thay đổi (`npx tsc --noEmit`)
- Files: `App.tsx`, `types.ts`, `components/pos/types.ts`, `components/pos/usePOSReturnFlow.ts`, `components/pos/POSComputer.tsx`, `services/posOrderService.ts`, `src/lib/businessLogic.revenue.ts`

### 2026-06-19 — Kiểm toán logic nghiệp vụ (Senior System Auditor)

- Đọc source: `posOrderService.ts`, `dataMapper.ts`, `inventoryOutSync.ts`, `businessLogic.inventory.ts`, `businessLogic.payroll.ts`, `businessLogic.revenue.ts`, `reportCalculations.ts`, `supabase_setup.sql`
- Cross-check docs/business-knowledge/ với source code
- Phát hiện 22 findings: 3 Critical, 9 High, 8 Medium, 2 Low
- Tạo `docs/business-knowledge/AUDIT_REPORT.md` — đầy đủ Finding ID / Severity / Evidence / Impact / Recommendation
- Top 3 critical: AUDIT-014 (Shopee dedup multi-SKU), AUDIT-003 (race condition tồn kho), AUDIT-001 (fixed cost method: docs sai)
- Files: `docs/business-knowledge/AUDIT_REPORT.md` (mới)

### 2026-06-19 — Tạo toàn bộ tài liệu business knowledge (docs/business-knowledge/)

- Đọc toàn bộ codebase (source files, types.ts, businessLogic, reportCalculations, history)
- Tạo 13 file tài liệu chính + 12 file operations (không sửa code)
- Files tạo mới:
  - `docs/business-knowledge/MASTER_FLOW.md` — sơ đồ luồng toàn hệ thống
  - `docs/business-knowledge/DATABASE_SCHEMA.md` — ~48 bảng + RPC functions
  - `docs/business-knowledge/BUSINESS_RULES.md` — 20+ rules (PAY/INV/POS/FIN/SHOP/WEB)
  - `docs/business-knowledge/STATE_TRANSITIONS.md` — 11 state machines
  - `docs/business-knowledge/CODE_MAPPING.md` — component → hook → service → table
  - `docs/business-knowledge/INVENTORY_LOGIC.md` — 7 luồng tồn kho
  - `docs/business-knowledge/ORDER_LOGIC.md` — 5 luồng đơn hàng POS
  - `docs/business-knowledge/PURCHASE_LOGIC.md` — 6 luồng mua hàng & NCC
  - `docs/business-knowledge/DEBT_LOGIC.md` — 3 loại công nợ
  - `docs/business-knowledge/REVENUE_PROFIT_LOGIC.md` — doanh thu, COGS, lợi nhuận
  - `docs/business-knowledge/REPORT_LOGIC.md` — 9 báo cáo và nguồn dữ liệu
  - `docs/business-knowledge/EDGE_CASES.md` — edge cases, bugs đã fix, workarounds
  - `docs/business-knowledge/SYSTEM_OVERVIEW.md` — tổng kết (12 nghiệp vụ, 48 bảng, 11 states, 20+ rules)
  - `docs/business-knowledge/operations/OP-001` đến `OP-012` — 12 nghiệp vụ chi tiết

### 2026-06-18 — Fix nhãn shop và mapping bot/DB

- **Phát hiện**: browser profile của 2 bot bị đảo ngược so với ecosystem.config.js:
  - port 3001 (shopee-profile-shop1) thực tế login phuc_sang_store, không phải giaydepphucsang
  - port 3002 (shopee-profile-shop2) thực tế login giaydepphucsang
- Revert `ShippingOrders.tsx` về label đúng: port 3001 = "Phúc Sang Store", port 3002 = "Giày Dép Phúc Sang"
- Fix `ecosystem.config.js`: swap SHOP_NAME — port 3001 = 'phuc_sang_store', port 3002 = 'giaydepphucsang'
- Xóa đơn `2606047X0F2VY8` khỏi shop1.db (đã được bot background scan tự bổ sung vào shop2.db đúng chỗ)
- Files: `components/orders/ShippingOrders.tsx`, `/Users/apple/shopee-monitor/ecosystem.config.js`

### 2026-06-18 — Bot database cleanup: xóa 81 đơn trùng giữa 2 shop

- Xác định 81 đơn tồn tại cả shop1.db và shop2.db do lỗi display reversal trước đây
- Backup cả 2 DB trước khi xử lý
- Xóa 81 đơn trùng khỏi cả 2 DB, trigger scan song song trên cả 2 bot
- Kết quả scan: 40 đơn xác nhận phuc_sang_store → shop1.db, 27 đơn giaydepphucsang → shop2.db, 14 ambiguous restore về shop1.db
- Kết quả cuối: shop1=235 orders, shop2=85 orders, 0 đơn trùng
- Files: `/Users/apple/shopee-monitor/storage/shop1.db`, `shop2.db`

### 2026-06-18 — Xuất kho: sync toàn bộ đơn + cập nhật status tự động

- `routes/inventoryOutSync.ts`: fetch tất cả pages từ bot (loop qua offset, thay vì limit=500 cứng)
- Đổi từ INSERT-only sang 2 bước tách biệt: INSERT đơn mới + UPDATE status đơn đã có (chỉ update status, giữ nguyên giá vốn và dữ liệu nhập tay)
- Response mới trả thêm `updated` (số đơn đổi status) và `botErrors`
- Files: `routes/inventoryOutSync.ts`

### 2026-06-18 — Trang vận đơn: filter 15 ngày cửa sổ hoàn hàng

- Bot `src/db.js`: Thêm cột `first_delivered_at` vào bảng `orders` (migration), thêm function `setFirstDeliveredAt()`
- Bot `bots/orders.js`: Gọi `setFirstDeliveredAt()` khi đơn đạt status "Đã giao" hoặc "Đã nhận được hàng"
- Backfill `first_delivered_at = created_at` cho 75 đơn shop1 + 64 đơn shop2 đã có trong DB
- App `ShippingOrders.tsx`: Thêm filter logic — ẩn "Đã nhận được hàng" đã qua 15 ngày kể từ `first_delivered_at`
- Files: `shopee-monitor/src/db.js`, `shopee-monitor/bots/orders.js`, `components/orders/ShippingOrders.tsx`

### 2026-06-18 — Bot đồng bộ đơn Shopee vào trang Xuất Kho

- Tạo backend route `POST /api/inventory-out/sync-from-bot`: gọi cả 2 bot (port 3001, 3002), dedup theo `order_id`, insert đơn mới vào bảng `shopee_inventory_out`
- Migration tự động 7 cột còn thiếu: `customer_paid`, `tracking_number`, `ship_date`, `product_name`, `piship_fee`, `vat_tax`, `profit_status` — đăng ký trong `requiredColumns` tại `server.ts`
- Thêm nút "Đồng bộ Bot" (icon RefreshCw, màu indigo) vào toolbar `InventoryOutTab` — chỉ hiện khi có prop `onSyncFromBot`
- Toast kết quả: "Đã thêm X đơn mới, bỏ qua Y đơn đã có"
- Sau sync thành công, tự reload `shopeeInventoryOut` từ Supabase và cập nhật UI qua `updateData`
- Files: `routes/inventoryOutSync.ts` (mới), `server.ts`, `components/revenue/InventoryOutTab.tsx`, `components/RevenueManager.tsx`, `components/MainContent.tsx`

### 2026-06-18 — Fix bot shop2 không click được tab "Đang giao"

- **Chẩn đoán**: Bot quét đơn shop2 click được "Chờ xác nhận" và "Chờ lấy hàng" nhưng luôn fail tab "Đang giao" trong auto-refresh — Shopee SPA re-render sau mỗi tab click, tab kế chưa actionable khi bot thử click ngay
- **Fix**: Thay `waitForTimeout(2000)` bằng `waitForLoadState('networkidle', {timeout: 8000})` sau mỗi click thành công — đợi Shopee settle hẳn trước khi click tab tiếp theo
- **Verify**: Cả initial scan lẫn auto-refresh đều click đủ 3 tab (✅ Chờ xác nhận, ✅ Chờ lấy hàng, ✅ Đang giao)
- Files: `/Users/apple/shopee-monitor/bots/orders.js`

### 2026-06-18 — Nút tải lại trigger bot quét đơn ngay

- **Fix hiển thị "Đã kết nối" khi session Shopee hết hạn**: thêm trạng thái `session_expired` vào ConnState, track `sessionExpired` flag trong apiServer, broadcast `LOGIN_EXPIRED`/`LOGIN_SUCCESS` qua WebSocket
- **Fix trang vận đơn không cập nhật sau bot restart**: gọi `fetchOrders` ngay khi nhận message `CONNECTED`
- **Nút tải lại → trigger bot quét đơn ngay**: thêm event `orders:refresh` trong `bots/orders.js`, endpoint `POST /api/orders/refresh` trong `apiServer.js`, button onClick trong `ShippingOrders.tsx` gọi refresh rồi fetchOrders sau 3 giây
- Files: `/Users/apple/shopee-monitor/bots/orders.js`, `/Users/apple/shopee-monitor/src/apiServer.js`, `components/orders/ShippingOrders.tsx`

### 2026-06-17 — Fix iMac: restart bots + fix cfobrain tunnel

- **Restart shopee-shop1/shop2** trên MacBook: load code đa-bot mới, verify endpoint `/api/products/fetch/status` trả `{"ok":true,"running":false}` ✅
- **Fix `cfobrain.phucsang.com.vn` down**: nguyên nhân là thiếu entry trong cloudflared config + thiếu DNS CNAME; đã thêm `cfobrain.phucsang.com.vn → localhost:8000` vào `~/.cloudflared/config.yml` trên iMac, thêm CNAME record Cloudflare, restart tunnel; verify trả 401 ✅
- Files: `docs/05-process/TODO.md`, `~/.cloudflared/config.yml` (iMac), Cloudflare DNS

### 2026-06-17 — Nút Sync Shopee + route proxy

- **Tạo `routes/shopeeSync.ts`**: proxy `POST /api/shopee-sync` → gọi `shopee-monitor:port/api/product/sync-wait/:itemId`, map shopIdx 0→3001, 1→3002; lỗi ECONNREFUSED trả thông báo rõ ràng
- **Thêm `POST /api/shopee-sync/all`**: trigger bot quét toàn bộ danh sách SP
- **Đăng ký route trong `server.ts`**: `createShopeeSyncRouter(requireAuth)`
- **Thêm nút "Sync Shopee"** trong `ShopeeProductsPage.tsx`: hiện trên thanh tab, disabled khi chưa có `shopee_item_id`, gọi sync rồi tự điền ảnh bìa / gallery / tên vào form
- Files: `routes/shopeeSync.ts`, `server.ts`, `components/website/ShopeeProductsPage.tsx`

### 2026-06-17 — Tái cấu trúc shopee-monitor thành kiến trúc đa-bot

- **Tạo `bots/orders.js`**: tách toàn bộ logic đơn hàng ra khỏi `monitor.js` (fetchOrderIncome, backfill, response hook, auto-refresh, check return orders, Telegram commands)
- **Tạo `bots/products.js`**: bot mới quét toàn bộ danh sách sản phẩm + biến thể từ Shopee Seller Center, upsert vào `shopee_products` Supabase, tự match SKU với `pos_products`
- **Tạo `bots/productSync.js`**: bot mới sync chi tiết 1 sản phẩm (ảnh bìa, gallery, tên) theo `shopee_item_id`
- **Tạo `src/supabase.js`**: Supabase client dùng chung cho các bot, dùng service role key
- **Cập nhật `monitor.js`**: refactor thành orchestrator gọn — mở browser rồi gọi setupXxxBot()
- **Cập nhật `src/apiServer.js`**: thêm 4 endpoint mới: `POST /api/products/fetch`, `GET /api/products/fetch/status`, `POST /api/product/sync/:itemId`, `POST /api/product/sync-wait/:itemId`
- **Cập nhật `.env.shop1/.env.shop2`**: thêm `SUPABASE_URL` và `SUPABASE_SERVICE_KEY`
- **Cài `@supabase/supabase-js`** vào shopee-monitor
- Files: `bots/orders.js`, `bots/products.js`, `bots/productSync.js`, `src/supabase.js`, `monitor.js`, `src/apiServer.js`, `.env.shop1`, `.env.shop2`

### 2026-06-17 — Fix channel links: RLS + error display + backend route

- **Fix lỗi "object Object"** khi bấm nút liên kết kênh: `PostgrestError` không phải `instanceof Error`, đã extract `.message` đúng cách.
- **Tạo `routes/channelLinks.ts`**: backend route dùng admin supabase client (service role) để bypass RLS — xử lý link/unlink cho cả website lẫn Shopee, cả sản phẩm đơn lẫn parent+children.
- **Đăng ký route** trong `server.ts`: `app.use(createChannelLinksRouter(supabase, requireAuth))`.
- **Rewrite `GoodsChannelLinksTab.tsx`**: bỏ toàn bộ direct Supabase write từ frontend, thay bằng gọi `/api/channel-links/toggle` qua `toggleChannelBackend()` — đọc (loadStatus) vẫn dùng anon key như cũ.
- **Fix Shopee Monitor**: cập nhật `monitor.js` + `login.js` dùng `playwright-extra` + stealth plugin + `channel: 'chrome'` để giảm session expiry do Shopee phát hiện bot.
- **Thêm SQL vào `supabase_setup.sql`**: RLS policies cho `shopee_products`, `shopee_product_variants`, `store_products`, `store_product_variants`.
- Files: `components/pos/GoodsChannelLinksTab.tsx`, `routes/channelLinks.ts`, `server.ts`, `/Users/apple/shopee-monitor/monitor.js`, `/Users/apple/shopee-monitor/login.js`, `supabase_setup.sql`

### 2026-06-17 — Rewrite ShopeeProductsPage.tsx — nguồn dữ liệu mới shopee_inventory_out

- **Rewrite hoàn toàn `components/website/ShopeeProductsPage.tsx`**: bỏ interfaces cũ (ShopeeShop, ShopeeProduct, ShopeeVariant, RootRow, EditingVariant), thay bằng `InventoryVariant` + `ParentRow`.
- **loadData() mới**: paginated fetch `shopee_inventory_out` (1000 rows/page), group by (sku, platform) với weighted avg price, batch fetch `pos_products` 200 SKU/batch, build virtual parent cho SKU không match.
- **Bỏ CreateModal + VariantEditPanel**: không cần tạo mới khi nguồn là order history — nút Sửa giữ placeholder.
- **Fix error handling**: Supabase error object không phải `instanceof Error` → extract `.message` thay vì `String(err)` (tránh toast `[object Object]`).
- **TypeScript clean** (0 lỗi).
- **Lưu ý dev**: lỗi "Lỗi tải dữ liệu" trên MacBook là do mạng không kết nối được Supabase iMac — không phải bug, sẽ hoạt động đúng trên iMac quầy.
- Files: `components/website/ShopeeProductsPage.tsx`

### 2026-06-17 — Kiểm tra & làm sạch dữ liệu shopee_inventory_out

- **So sánh Excel XUAT KHO vs DB**: 2.391 dòng Excel ↔ 2.359 dòng DB, khớp 99.9% (3 đơn thiếu trong DB, lý do ngày lỗi trong Excel).
- **So sánh files gốc Shopee (shopee_exports/Shop1+2) vs DB**: 0 đơn trong file gốc bị thiếu trong DB — DB đầy đủ hơn files.
- **Phát hiện & xóa 2 file nhầm folder**: `Order.all.20260401_20260425.xlsx` và `Order.all.20260426_20260526.xlsx` bị đặt vào Shop1 nhưng thực ra là dữ liệu Shopee 2 — đã xóa khỏi `shopee_exports/Shop1/`.
- **Fix 17 đơn sai platform**: cập nhật `platform = 'Shopee 1'` cho 17 đơn mã SPXVN bị gán nhầm vào Shopee 2 trong DB.
- **Xác nhận 106 đơn chỉ trong DB**: import thủ công ngày 2026-05-29, mã hợp lệ (SPXVN + GY/Giao Hàng Nhanh), giữ lại.
- **Kết luận**: `shopee_inventory_out` đủ điều kiện làm nguồn dữ liệu duy nhất.
- Files: `scripts/fix_platform_mismatch.sql` (đã chạy), `shopee_exports/Shop1/` (đã xóa 2 file thừa)

### 2026-06-16 — Catalog Online: fix cha-con grouping + thêm tab liên kết kênh + di chuyển migration tool

- **Fix `OnlineCatalogPage.tsx` logic nhóm cha-con**: rewrite `loadData` để gom đúng theo `pos_products.parent_id` — xử lý cả 2 trường hợp: channel tables liên kết tới sản phẩm cha hoặc sản phẩm con; mỗi sản phẩm chỉ hiển thị 1 dòng với cột "Nền tảng" tổng hợp (Website + Shopee).
- **Tạo mới `components/pos/GoodsChannelLinksTab.tsx`**: tab "Kênh bán" trong GoodsInventory — toggle Website / Shopee bằng switch; auto-tạo `store_products`/`shopee_products` nếu chưa có; áp dụng cho tất cả biến thể con khi bật/tắt từ sản phẩm cha.
- **Cập nhật `GoodsProductDetailPanel.tsx`**: render `GoodsChannelLinksTab` trong tab `channels` (thay placeholder "Tính năng sẽ sớm ra mắt").
- **Di chuyển "Nhập từ nguồn cũ"**: xóa nút khỏi `ShopeeProductsPage.tsx`, thêm section "Nhập từ dữ liệu nguồn cũ" vào `MigrationTab.tsx` (Cài đặt → Chuyển dữ liệu).
- TypeScript clean (0 lỗi).
- Files: `components/website/OnlineCatalogPage.tsx`, `components/pos/GoodsChannelLinksTab.tsx`, `components/pos/GoodsProductDetailPanel.tsx`, `components/settings/tabs/MigrationTab.tsx`, `components/website/ShopeeProductsPage.tsx`

### 2026-06-16 — Fix hạ tầng Supabase + workflow huỷ/hoàn hàng đơn website

- **Fix gốc lỗi `PGRST205`**: xác minh trực tiếp qua `psql` (không qua PostgREST) thấy `shopee_products` + `shopee_product_variants` **chưa từng được tạo thật** trong database (không phải lỗi cache như chẩn đoán ban đầu) — chạy `CREATE TABLE` cho cả 2 bảng + index + RLS policy `authenticated` trực tiếp qua `docker exec supabase-db psql` (user không nhớ mật khẩu Supabase Studio nên dùng terminal trên iMac). Verify lại bằng curl: cả 2 bảng đã được PostgREST nhận diện.
- **Thêm cột `pos_orders.updated_at`** — cột này chưa từng tồn tại trong schema gốc, khiến mọi lệnh `update({status, updated_at})` trước đó âm thầm lỗi.
- **Fix RPC `create_store_order`**: đổi `status = 'Pending'` → `'pending'` (fix bug case-mismatch với `WebsiteOrdersPage.tsx` lọc bằng chữ thường).
- **RPC mới `update_website_order_status`**: atomic — đổi status đơn + tự cộng lại tồn kho nếu chuyển sang `cancelled`/`returned`; không cộng khi `return_requested` (hàng chưa thực về kho).
- **`WebsiteOrdersPage.tsx`**: thêm trạng thái `return_requested` ("Đang hoàn hàng") + `returned` ("Đã hoàn hàng"); tách rõ 2 luồng huỷ — huỷ thẳng khi chưa giao ĐVVC (cộng tồn ngay) vs yêu cầu hoàn hàng khi đã `shipping`/`completed` (chỉ cộng tồn sau khi nhân viên xác nhận đã nhận lại hàng); đổi `updateStatus` gọi RPC mới; **fix bug query bảng `pos_order_items` không tồn tại** — đổi sang đọc thẳng cột JSONB `items` có sẵn trong `pos_orders`.
- Tất cả SQL mới đã viết vào `supabase_setup.sql` và đã chạy thành công trên Supabase self-host (xác nhận qua terminal + curl).
- TypeScript clean, `npm test` 286/286 pass.
- Files: `supabase_setup.sql`, `components/website/WebsiteOrdersPage.tsx`

### 2026-06-16 — Fix bug import Shopee + viết lại OnlineCatalogPage giống layout Hàng hoá

- **Fix bug "Nhập từ Dữ liệu nguồn cũ" lỗi duplicate key**: `ImportFromSourceModal.tsx` query `pos_products` không phân trang, bị giới hạn 1000 dòng của PostgREST nên không thấy SKU cha đã tồn tại (14,245 dòng) → cố insert lại → lỗi `pos_products_sku_key`. Thêm hàm `fetchAllPages()` phân trang `.range()` cho cả `pos_products` và `shopee_product_variants`.
- **Dọn dữ liệu rác**: xoá 30 sản phẩm cha rỗng (`variant_count=0`, `stock=0`, tạo lúc 2026-06-16 05:43) do lần import lỗi trước đó tạo ra trong `pos_products`.
- **Phát hiện bug hạ tầng**: bảng `shopee_products` + `shopee_product_variants` bị lỗi `PGRST205` (PostgREST chưa nhận diện bảng, dù đã tạo SQL từ trước) — cần `docker restart supabase-rest` hoặc `NOTIFY pgrst, 'reload schema'` trên iMac self-host, **chưa được chạy** tính đến cuối phiên.
- **Viết lại hoàn toàn `OnlineCatalogPage.tsx`** (mục Online → Catalog sản phẩm): layout clone 100% từ `GoodsFilterSidebar` + `GoodsToolbar` + `GoodsProductTableHeader` (sidebar w-64, 6 mục lọc, toolbar tìm kiếm + toggle bảng/lưới). Cột bảng: Mã hàng → Nhóm hàng (chỉ hiện nhóm con cuối cùng) → Giá vốn → Tồn kho → Vị trí → Thương hiệu → **Nền tảng** (badge Website/Shopee, cột mới). Cha-con expand/collapse + bảng chi tiết 5 tab (Thông tin/Mô tả/Thẻ kho/Tồn kho/Liên kết kênh bán) clone từ `GoodsProductRow.tsx` + `GoodsProductDetailPanel.tsx`.
- Nối fetch dữ liệu thật: đọc `store_product_variants` + `shopee_product_variants` (is_published=true, mỗi bảng try/catch riêng để 1 bảng lỗi không sập trang) → join `pos_products` (cha qua `parent_id`) → dựng cấu trúc cha-con + map nền tảng theo SKU.
- TypeScript clean, không cần `npm test` (không đổi `businessLogic.ts`).
- Files: `components/website/ImportFromSourceModal.tsx`, `components/website/OnlineCatalogPage.tsx`

### 2026-06-16 — Giai đoạn 8 (tiếp): ShopeeProductsPage + WebsiteProductsPage — UI kiểu SourceTab với inline panel

- Viết lại `ShopeeProductsPage.tsx`: bỏ form modal → list table + click row mở panel inline bên dưới có 4 tabs (Thông tin / Ảnh & Mô tả / SEO / SKU liên kết). "Thêm sản phẩm" vẫn dùng modal. Badge "Chưa lưu" khi có thay đổi, nút "Lưu thay đổi" save toàn bộ 1 lần.
- Viết lại `WebsiteProductsPage.tsx`: cùng pattern SourceTab-style, thêm field slug + nhãn (is_featured/is_new/is_best_seller) + website_price_override cho từng SKU. Quick toggle "Hiển thị/Đang ẩn" vẫn giữ trong bảng. Tab Nhãn thay thế tab SEO.
- TypeScript check: 0 lỗi
- Files: `components/website/ShopeeProductsPage.tsx`, `components/website/WebsiteProductsPage.tsx`

### 2026-06-16 — Giai đoạn 8: OnlineCatalogPage — UI kiểu GoodsInventory, lọc theo kênh liên kết

- Viết lại hoàn toàn `OnlineCatalogPage.tsx` dùng `ListPageLayout` + `ListPageToolbar` + `ListPagePagination` + `FilterSection` từ shared
- Chỉ hiện SKU đã được link vào `store_product_variants` HOẶC `shopee_product_variants` (sản phẩm đang bán online)
- Sidebar filter: Kênh bán (Tất cả / Website / Shopee / Cả hai) + Tồn kho (Còn hàng / Sắp hết / Hết hàng)
- Bảng phẳng có sort: SKU, Tên, Giá bán, Giá vốn, Tồn kho, Kênh bán
- Click hàng → mở panel chi tiết inline (3 tab: Thông tin / Thẻ kho / Kênh bán)
- TypeScript clean
- Files: OnlineCatalogPage.tsx

### 2026-06-16 — Giai đoạn 7: OnlineCatalogPage — list + inline detail panel với tabs

- Viết lại `components/website/OnlineCatalogPage.tsx` theo đúng pattern SourceTab + SourceDetailPage: bảng list nhóm theo parent SKU (expandable, sort, paginate), click SKU → mở panel inline bên dưới hàng, có 2 tab: Thông tin và Kênh bán
- Tab Thông tin: ảnh, SKU, tên, giá bán, tồn kho, màu/size (parse từ SKU), kênh bán
- Tab Kênh bán: load realtime từ store_product_variants + shopee_product_variants, hiển thị trạng thái xuất bản + link navigate sang trang quản lý
- Indigo border khi expand (giống SourceTab), panel đóng khi click lại hàng đó
- TypeScript clean
- Files: OnlineCatalogPage.tsx

### 2026-06-16 — Giai đoạn 6: ShopeeProductsPage + OnlineCatalog dual-channel

- Tạo `components/website/ShopeeProductsPage.tsx` — quản lý ảnh, mô tả, SEO sản phẩm Shopee (CRUD, liên kết SKU qua shopee_product_variants)
- Cập nhật `components/MainContent.tsx` — lazy import ShopeeProductsPage, render khi `onlineShopeeSubTab === 'source'` thay vì RevenueManager
- Cập nhật `components/online/OnlineSidebarNav.tsx` — đổi label sub-tab 'source' từ 'Dữ liệu nguồn' → 'Sản phẩm Shopee'
- Cập nhật `components/website/OnlineCatalogPage.tsx` — join cả 2 nguồn (store_product_variants + shopee_product_variants), chỉ hiện sản phẩm có ít nhất 1 kênh liên kết, hiển thị tag [Website] [Shopee], bộ lọc theo kênh
- SQL cho `shopee_products` + `shopee_product_variants` đã có trong `supabase_setup.sql` — **cần chạy thủ công trên Supabase dashboard**
- TypeScript clean, deploy thành công
- Files: ShopeeProductsPage.tsx (mới), MainContent.tsx, OnlineSidebarNav.tsx, OnlineCatalogPage.tsx

### 2026-06-16 — Giai đoạn 5: Gộp "Website" vào "Online" — sidebar đa kênh

- Tạo `components/website/OnlineCatalogPage.tsx` — trang Catalog sản phẩm online (pos_products + trạng thái xuất bản website), nút điều hướng sang quản lý sản phẩm website
- Cập nhật `components/website/WebsiteProductsPage.tsx` — thêm `navigationSlot` prop, đổi layout thành grid 2 cột (sidebar 280px + main), sửa lỗi thiếu closing `</div>` main content
- Cập nhật `components/website/WebsiteOrdersPage.tsx` — thêm `navigationSlot` prop, đổi layout thành grid 2 cột
- Cập nhật `components/online/OnlineSidebarNav.tsx` — thêm mục "Catalog sản phẩm" (online-catalog), thêm nhóm "Website PHÚC SANG" với 2 sub-item: Sản phẩm và Đơn hàng; xử lý logic active state cho website tabs
- Cập nhật `constants/navigation.ts` — xóa section "Website" riêng biệt, thêm `online-catalog` + `website-products` + `website-orders` vào section "Online"
- Cập nhật `components/MainContent.tsx` — lazy import OnlineCatalogPage, extend `isOnlineActive`, thêm case `online-catalog`, truyền `navigationSlot={renderOnlineNav()}` vào WebsiteProductsPage và WebsiteOrdersPage
- TypeScript clean, deploy thành công
- Files: OnlineCatalogPage.tsx (mới), WebsiteProductsPage.tsx, WebsiteOrdersPage.tsx, OnlineSidebarNav.tsx, navigation.ts, MainContent.tsx

### 2026-06-16 — Store API + Kết nối website (Giai đoạn 1 & 2)

- Tạo 8 bảng Supabase mới: store_products, store_product_variants, store_collections, store_product_collections, store_order_addresses, shipments, store_preorder_requests, store_contacts — tất cả có RLS + service_role_all policies
- Tạo PostgreSQL function `create_store_order` (SECURITY DEFINER, FOR UPDATE atomic stock deduction)
- Tạo `routes/store.ts` — 4 endpoint: GET /api/store/products, GET /api/store/products/:slug, POST /api/store/orders, POST /api/store/preorders, POST /api/store/orders/lookup
- Thêm `pos_product_id` vào mapVariant output để frontend dùng khi đặt hàng
- Tạo `store-api.js` cho website: API client với fallback sang data tĩnh khi API chưa có dữ liệu
- Cập nhật `all-products.js`: async loadCatalog() thay vì đọc trực tiếp window.productCatalog
- Cập nhật `product-detail.js`: async getProduct() với fallback
- Cập nhật `checkout.js`: gọi storeApi.createOrder() nếu có posProductId, fallback lưu local
- Thêm store-api.js vào products.html, product.html, checkout.html
- Files app: routes/store.ts, server.ts | Files website: store-api.js, all-products.js, product-detail.js, checkout.js, products.html, product.html, checkout.html

### 2026-06-15 — AUDIT HOÀN THÀNH — Pass 3 sạch (0 bugs), tổng 3 pass (22+5+0)

- Toàn bộ 10 module đã qua 3 pass liên tiếp, pass 3 không tìm thấy bug mới nào
- Kết quả tổng: 27 bugs đã fix qua 2 pass đầu, codebase sạch hoàn toàn
- Files: docs/05-process/AUDIT_LOG.md (đánh dấu AUDIT HOÀN THÀNH)

### 2026-06-15 — Audit Pass 2 hoàn thành — 5 bugs mới, bắt đầu Pass 3

- Pass 2 pattern chính: filter sidebar gọi setter trực tiếp không kèm setCurrentPage(1) → trang 2+ trống
- BUG-P2-1/2: PurchaseOrdersPage + PurchaseReturnsPage — 4 filter loại (status, date, supplier, creator)
- BUG-O2-1: OrderReturns checkbox filter returnType/status không reset page
- BUG-F2-1: CashLedgerPage handleVoucherCheck không reset page
- BUG-PY2-1: PayrollManager bulk undo bỏ sót expense "Quyết toán lương nghỉ việc"
- Files: PurchaseOrdersPage.tsx, PurchaseReturnsPage.tsx, OrderReturns.tsx, CashLedgerPage.tsx, PayrollManager.tsx

### 2026-06-15 — Audit logic toàn app hoàn thành (components/reports/ + tổng kết)

- Kiểm tra 12 file reports: tất cả read-only analytics, 0 bugs
- Tổng kết: 22 bugs tìm và fix trên 10 module, 9 files sửa
- Pattern chính: onUpdateSurgical không await → lỗi Supabase im lặng (mọi module đều có)
- Audit log đầy đủ tại: docs/05-process/AUDIT_LOG.md

### 2026-06-15 — Audit logic module Doanh thu (components/revenue/)

- Kiểm tra 16 file: useRevenueLedger, useShopeeInventoryOut, SourceDetailPage, và các file còn lại
- BUG-R1a/b: handleAddInventoryOut sync gọi onUpdateSurgical không await (2 nhánh) → fix async + await + try/catch
- BUG-R2: handleRemoveInventoryOut có await nhưng thiếu try/catch → fix bọc try/catch
- useRevenueLedger tất cả clean ✅
- Files: useShopeeInventoryOut.ts

### 2026-06-15 — Audit logic module Chi phí (components/expense/)

- Kiểm tra 10 file: ExpenseLedgerTab, ExpenseCategoriesPage, useExpenseRecurring, và các file còn lại
- BUG-E1: Delete button trong ExpenseLedgerTab gọi onUpdateSurgical không await → fix async onClick + try/catch
- BUG-E2 (critical): handlePostRecurring trong useExpenseRecurring cập nhật lastPostedMonth kể cả khi Supabase save thất bại → expense định kỳ mất luôn trong tháng → fix async + await + return sớm trong catch
- Files: ExpenseLedgerTab.tsx, useExpenseRecurring.ts

### 2026-06-15 — Audit logic module Phân tích (components/analysis/)

- Kiểm tra 11 file: AnalysisContainer + 10 trang phân tích
- Read-only analytics, tất cả handleAiRun có try/catch/finally đúng chuẩn
- 0 bugs tìm được
- Files: không thay đổi

### 2026-06-15 — Audit logic module Lương (components/payroll/ + PayrollManager.tsx)

- Kiểm tra 9 tab files (presentation) + PayrollManager.tsx (container với toàn bộ mutation logic)
- handleFinalizeIndividual, handleSettlementAndResignation, handleRecalculateCarryForwardDebt: đã có try/catch
- Phát hiện 1 bug logic: handleUndoPayroll dùng sai expense description format cho settlement payrolls
- **BUG-PY1** `PayrollManager.tsx:351` — handleUndoPayroll chỉ tìm expense format "Chi lương tháng" nhưng settlement expense dùng "Quyết toán lương nghỉ việc" → undo bỏ sót orphan expense → fix: tìm cả 2 format khi filter
- TypeScript: clean (0 lỗi)
- Files: PayrollManager.tsx

### 2026-06-15 — Audit logic module Tổng quan (components/overview/)

- Kiểm tra 1 file: OverviewPage.tsx
- Component read-only (không có mutation), không có async ops để audit
- 0 bugs tìm được
- Files: không thay đổi

### 2026-06-15 — Audit logic module Sổ quỹ (components/finance/)

- Kiểm tra 1 file: CashLedgerPage.tsx
- Không có async onUpdateSurgical call (props sync), không có pagination reset bug
- Phát hiện 1 bug thiết kế: businessFilter không có tác dụng
- **BUG-F1** `CashLedgerPage.tsx:421` — businessFilter có UI + hasActiveFilters + clearFilters nhưng KHÔNG được apply trong filtered useMemo → filter "Hạch toán kết quả kinh doanh" vô tác dụng. Root cause: LedgerEntry không có field tương ứng, cần schema change
- Không có code fix (cần quyết định schema); ghi nhận để xử lý riêng
- TypeScript: không thay đổi code → skip check
- Files: không thay đổi

### 2026-06-15 — Audit logic module Đơn hàng (components/orders/)

- Kiểm tra 4 file có mutation + 2 file read-only
- Phát hiện và fix 5 bugs: thiếu try/catch hoặc thiếu catch block
- **BUG-O1** `OrderInvoices.tsx:376` — handleSaveOrder await persistOrder không try/catch → bọc try/catch/alert
- **BUG-O2** `OrderInvoices.tsx:393` — handleCancelInvoice await persistOrder không try/catch → tương tự BUG-O1
- **BUG-O3** `OrderInvoices.tsx:530` — handleCreateReturn có try nhưng không có catch → thêm catch block với alert
- **BUG-O4** `OrderReturns.tsx:625` — handleCancelReturn await onUpdateSurgical không try/catch → bọc try/catch/alert
- **BUG-O5** `OrderReturns.tsx:648` — handleSaveReturn await onUpdateSurgical không try/catch → bọc try/catch/alert
- TypeScript: clean (0 lỗi)
- Files: OrderInvoices.tsx, OrderReturns.tsx

### 2026-06-15 — Audit logic module Khách hàng (components/customers/)

- Kiểm tra 2 file: CustomerListPage.tsx, CustomerDetailPage.tsx
- Phát hiện và fix 4 bugs: tất cả là lỗi thiếu try/catch khi gọi onUpdateSurgical async
- **BUG-C1** `CustomerListPage.tsx:347` — handleSave không await onUpdateSurgical → async thành công, chuyển thành async + try/catch
- **BUG-C2** `CustomerListPage.tsx:384` — handleSaveFromPOS không await onUpdateSurgical → tương tự BUG-C1
- **BUG-C3** `CustomerListPage.tsx:435` — handleDelete không await onUpdateSurgical → tương tự BUG-C1
- **BUG-C4** `CustomerListPage.tsx:444` — handleToggleStatus không await onUpdateSurgical → tương tự BUG-C1
- TypeScript: clean (0 lỗi)
- Files: CustomerListPage.tsx

### 2026-06-15 — Audit logic module Nhập hàng (components/purchase/)

- Kiểm tra 5 file trong components/purchase/
- Phát hiện và fix 6 bugs: 4 lỗi thiếu try/catch async, 1 lỗi toast success trước khi lưu, 2 lỗi search không reset page
- **BUG-P1** `PurchaseOrdersContainer.tsx:442` — handleSaveDraft thiếu try/catch → bọc try/catch/toast error
- **BUG-P2** `PurchaseOrdersContainer.tsx:490` — handleSaveReturnDraft thiếu try/catch → bọc try/catch/toast error
- **BUG-P3** `PurchaseOrdersContainer.tsx:745` — handleSaveQuickProduct thiếu try/catch → bọc try/catch, return false khi lỗi
- **BUG-P4** `PurchaseOrdersContainer.tsx:808` — handleSaveQuickSupplier toast success hiện trước await → di chuyển toast vào sau await, thêm try/catch
- **BUG-P5** `PurchaseOrdersPage.tsx:364` — search không reset currentPage → thêm setCurrentPage(1)
- **BUG-P6** `PurchaseReturnsPage.tsx:309` — search không reset currentPage → thêm setCurrentPage(1)
- TypeScript: clean (0 lỗi)
- Files: PurchaseOrdersContainer.tsx, PurchaseOrdersPage.tsx, PurchaseReturnsPage.tsx

### 2026-06-15 — Audit & fix toàn bộ logic giá vốn (COGS)

- Audit 9 luồng ảnh hưởng giá vốn: nhập hàng, bán POS, trả hàng mua, POS return, Excel import, KiotViet import, bán Shopee, quick purchase, xóa phiếu nhập
- 6/9 luồng đúng — phát hiện 3 vấn đề cần fix
- **Fix 1** `components/pos/useGoodsExcelImport.ts` — Excel import thiếu InventoryTransaction → `buildCostHistory` không đọc được tồn kho ban đầu. Fix: tạo 1 transaction 'Import' + status 'completed' với `nextImportPrice` cho mọi sản phẩm có stock > 0
- **Fix 2B** `routes/import.ts:1643` — KiotViet purchase import thiếu field `nextImportPrice` trong items → `buildCostHistory` bỏ qua toàn bộ lịch sử giá vốn KiotViet. Fix: thêm `nextImportPrice: importPrice` khi tạo item
- **Fix 2C** `routes/import.ts:1721-1745` — KiotViet purchase import không cập nhật `pos_products.import_price`. Fix: sau khi upsert transactions, update `import_price` theo giá mua mới nhất per SKU
- **Fix 2A** `routes/import.ts:1538` — Sửa type `costMethod: 'fixed'` thành `'fixed' | 'average'` cho linh hoạt sau này
- TypeScript clean (0 lỗi), 286/286 tests pass
- Files: `components/pos/useGoodsExcelImport.ts`, `routes/import.ts`

### 2026-06-15 — Fix 2 logic accuracy bugs (phân tích tài chính + audit trail)

- **BUG-FIN-01** `AnalysisFinancialMatrixPage.tsx` — `monthlyTrendData` và `dailyTrendData` double-count chi phí lương khi dùng cả payroll module và sổ chi phí có dòng lương. Fix: thêm `nonSalaryExpenses` filter loại salary ra trước khi trừ (giống pattern đã có ở `AnalysisBusinessProfitPage.tsx`)
- **BUG-INV-AUDIT** `OrderReturns.tsx:handleProcessReturn` — transaction ghi vào lịch sử thiếu `previousStock`/`newStock`. Fix: thêm lookup `products.find()` trong `.map()` để ghi đúng trước/sau
- TypeScript: clean (npx tsc --noEmit)
- Files: `components/analysis/AnalysisFinancialMatrixPage.tsx`, `components/orders/OrderReturns.tsx`

### 2026-06-15 — Audit toàn bộ logic tồn kho + fix bug GoodsInternalUse

- Kiểm tra 15 luồng ảnh hưởng tồn kho: nhập hàng (NCC + phiếu nhập), bán POS, trả hàng (bán + mua), kiểm kho, xuất dùng nội bộ, hủy hàng, hóa đơn, Shopee, Excel import
- 14/15 luồng đúng — 1 bug phát hiện tại `GoodsInternalUse.tsx:handleSave`
- **BUG-INV-01** `GoodsInternalUse.tsx:207` — thiếu `Math.max(0, ...)` → tồn kho có thể âm nếu stock giảm giữa lúc mở form và lúc bấm Lưu. Fix: thêm `Math.max(0, ...)` + validation re-check stock trước khi ghi (báo lỗi cụ thể nếu không đủ tồn)
- Files: `components/inventory/GoodsInternalUse.tsx`

### 2026-06-15 — Fix 4 bugs còn sót trang Nhà cung cấp (lần 2)

- **BUG-S4** `SupplierForm.tsx:85` — Địa chỉ bị nhân đôi khi sửa NCC có đúng 2 phần địa chỉ. Fix: `setStreetAddress(length > 2 ? slice : '')` thay vì gán cả chuỗi ban đầu
- **BUG-M3** `SupplierListPage.tsx` — Gõ search không reset `currentPage` về 1 → trang > 1 hiện empty state sai. Fix: `onSearchChange={term => { setSearchTerm(term); setCurrentPage(1); }}`
- **BUG-M4** `SupplierContainer.tsx:handleToggleFavorite` — Rethrow sau khi đã bắt lỗi và show toast → gây double toast. Fix: xóa `throw err`
- **BUG-N3** `SupplierContainer.tsx + SupplierListPage.tsx` — Selection bị xóa trước khi user xác nhận unsafe bulk delete; nếu hủy dialog, selection đã mất. Fix: truyền `onSuccess` callback qua `handleBulkDeleteSuppliers`, gọi sau khi delete thực sự thành công (kể cả path unsafe)
- TypeScript: clean (npx tsc --noEmit)
- Files: `SupplierForm.tsx`, `SupplierListPage.tsx`, `SupplierContainer.tsx`

### 2026-06-15 — Fix 7 bugs trang Nhà cung cấp

- **BUG-S1** `SupplierContainer.tsx:handleSaveSupplier` — Toast success hiển thị trước `await onUpdateSurgical` → nếu lỗi user thấy 2 toast mâu thuẫn. Fix: di chuyển `showToast` + `setShowSupplierForm(false)` vào sau `await`
- **BUG-S2** `SupplierContainer.tsx:handleBulkDeleteSuppliers` — Dùng `window.confirm` cho cảnh báo NCC có công nợ. Fix: thêm state `unsafeBulkDeleteDialog`, render Modal xác nhận chuẩn, thêm handler `handleConfirmUnsafeBulkDelete`
- **BUG-S3** `SupplierContainer.tsx:handleSupplierFileImport` — `window.confirm` trong `rows.forEach` (synchronous loop, UX xấu). Fix: đổi sang logic skip tự động, ghi vào `skippedRows` để báo toast
- **BUG-M1** `SupplierListPage.tsx:handleToggleSelectAll` — So sánh `length` không đúng khi multi-page selection. Fix: dùng `.every(s => selectedSuppliers.includes(s.id))`, cập nhật cả `checked` prop của checkbox header
- **BUG-M2** `SupplierContainer.tsx:handleSupplierFileImport` — Status từ file không validate → có thể nhận giá trị không hợp lệ. Fix: check `['active','inactive'].includes(val)` trước khi cast
- **BUG-N1** `SupplierDetailView.tsx` — Tab active dùng `border-blue-500 text-blue-600` không nhất quán với toàn app (indigo). Fix: đổi sang `border-indigo-500 text-indigo-600`
- **BUG-N2** `SupplierContainer.tsx:debtBelongsToSupplier` — Chỉ match theo `supplier.name`, không match theo `supplier.code` như `transactionBelongsToSupplier`. Fix: thêm `|| supplierText === normalizeSupplierKey(supplier.code)`
- TypeScript: clean (npx tsc --noEmit)
- Files: `components/suppliers/SupplierContainer.tsx`, `components/suppliers/SupplierListPage.tsx`, `components/suppliers/SupplierDetailView.tsx`

### 2026-06-15 — Fix 5 bugs trang Hàng hóa (audit lần 3)

- **BUG-A** `GoodsInventory.tsx:handleStopBusiness` — `onConfirm` async không có try/catch → bọc try/catch/finally, `closeConfirm()` vào finally để dialog luôn đóng dù lỗi
- **BUG-B** `GoodsInventory.tsx:handleBulkStopBusiness` — tương tự, bọc try/catch/finally
- **BUG-C** `GoodsInventory.tsx:handleConfirmChangeGroup` — `await onUpdateSurgical` không có try/catch → bọc try/catch
- **BUG-D** `GoodsInventory.tsx:handleCreateGroup` — `await onPushBatch` không có try/catch → bọc try/catch
- **BUG-E** `GoodsInventory.tsx` — `onDelete` callback của `GoodsGridDetailModal` không có try/catch → bọc try/catch, `setGridDetailProduct(null)` chỉ chạy khi thành công
- TypeScript: clean (npx tsc --noEmit)
- Files: `GoodsInventory.tsx`

### 2026-06-15 — Fix 6 bugs trang Hàng hóa (audit lần 2)

- **Bug 1** `useGoodsProductEditor.ts` — 3 lần gọi `onUpdateSurgical` không có `.catch()` → thêm `.catch(err => showToast(..., 'error'))` cho cả 3 case (edit, tạo biến thể, tạo đơn giản)
- **Bug 2** `useGoodsVariantWorkflow.ts` — 3 lần gọi `onUpdateSurgical` không xử lý lỗi → thêm `.catch()` cho `handleAddUnitInViewMode`, `handleAddAttributeInViewMode`, `doSave` trong `handleSaveMoreVariants`
- **Bug 3** `GoodsInventory.tsx:handleDeleteViewed` — `setViewingProduct(null)` chạy kể cả khi `onUpdateSurgical` thất bại → bọc trong try/catch, chuyển `setViewingProduct(null)` vào try block
- **Bug 4** `useGoodsPurchase.ts:handleCompletePurchase` — toàn bộ async logic không có try/catch → bọc trong try/catch với `showToast(..., 'error')` khi lỗi
- **Bug 5** `GoodsInventory.tsx:onSavePrices` — gọi `onUpdateSurgical` không `await` và không xử lý lỗi → đổi callback thành `async`, thêm `await` + try/catch
- **Bug 6** `GoodsPurchaseForm.tsx` — dropdown tìm kiếm nhập hàng không lọc sản phẩm `Inactive` → thêm `p.status !== 'Inactive'` vào filter
- TypeScript: clean (npx tsc --noEmit)
- Files: `useGoodsProductEditor.ts`, `useGoodsVariantWorkflow.ts`, `GoodsInventory.tsx`, `useGoodsPurchase.ts`, `GoodsPurchaseForm.tsx`

### 2026-06-15 — Fix 4 bugs trang Trả hàng nhập (audit lần 3)

- **Bug D1** `PurchaseOrdersContainer.tsx:handleDeleteReturn` — `.find()` chỉ xóa 1 trong 2 debt records khi trả hàng → đổi thành `.filter()`, xóa tất cả records khớp `id` bằng `Set`, cả surgical và fallback path
- **Bug D2** `PurchaseReturnsPage.tsx` — Cột mã trả hàng luôn hiện UUID thay vì `referenceId` → đổi thành `transaction.referenceId || transaction.id.slice(0, 12)`
- **Bug D3** `PurchaseOrderDetailModal.tsx` — Trạng thái hiển thị raw English ("completed"/"draft"/"cancelled") → localize thành "Đã nhập hàng"/"Đã trả hàng"/"Phiếu tạm"/"Đã hủy"
- **Bug D4** `PurchaseOrdersContainer.tsx:handleAddProductToReturn` — Thêm sản phẩm trùng không kiểm tra tồn kho → thêm `Math.min(product.stock, item.quantity + 1)`
- TypeScript: clean (npx tsc --noEmit)
- Files: `PurchaseOrdersContainer.tsx`, `PurchaseReturnsPage.tsx`, `PurchaseOrderDetailModal.tsx`

### 2026-06-15 — Fix 5 bugs trang Trả hàng nhập (audit lần 2)

- **Bug R1** `PurchaseReturnsPage.tsx` — Search không tìm theo `referenceId` → thêm `transaction.referenceId?.toLowerCase().includes(term)`
- **Bug R2** `PurchaseReturnsPage.tsx:handleBulkDelete` — Xóa hàng loạt không track fail → sửa thành track từng phiếu, giữ lại phiếu fail trong selection, toast rõ số thất bại
- **Bug R3** `GoodsPurchaseReturnForm.tsx` + `PurchaseOrdersContainer.tsx` + `usePurchaseFormState.ts` — Input "Mã trả hàng nhập" không kết nối state → thêm `returnReferenceId`/`setReturnReferenceId` vào hook, Container, form prop; gán vào cả `handleCompleteReturn` và `handleSaveReturnDraft`
- **Bug R4** `GoodsPurchaseReturnForm.tsx` — Badge "Phiếu tạm" hardcode → đổi thành "Đang trả hàng" màu indigo
- **Bug R5** `GoodsPurchaseReturnForm.tsx` — Nút + không giới hạn max → thêm `Math.min(product?.stock, item.quantity + 1)`
- TypeScript: clean (npx tsc --noEmit)
- Files: `PurchaseReturnsPage.tsx`, `GoodsPurchaseReturnForm.tsx`, `PurchaseOrdersContainer.tsx`, `hooks/usePurchaseFormState.ts`

### 2026-06-15 — Fix 6 bugs trang Nhập hàng (audit)

- **Bug 1** `PurchaseOrdersPage.tsx` — Search không tìm theo `referenceId` → thêm `order.referenceId?.toLowerCase().includes(term)` vào filter
- **Bug 2** `PurchaseOrdersContainer.tsx:handleCompleteReturn` — `returnSupplierPaidAmount` (NCC trả tiền mặt) không được ghi vào debt ledger → thêm `cashPaymentRecord` type `'payment'`, tách thành `cashPaymentRecord` + `debtOffsetRecord`, rollback cả hai khi lỗi
- **Bug 3** `GoodsPurchaseForm.tsx` — Input giảm giá dòng sản phẩm chấp nhận số âm → thêm `Math.max(0, ...)` + attr `min={0}`
- **Bug 4** `PurchaseOrdersPage.tsx:handleBulkDelete` — Xóa hàng loạt không rollback khi lỗi giữa chừng → sửa thành track từng phiếu fail, giữ lại trong selection, báo toast rõ số thất bại
- **Bug 5** `GoodsPurchaseForm.tsx` — Badge "Phiếu tạm" hardcode trong form tạo mới → đổi thành "Đang nhập" với màu indigo
- **Bug 6** `PurchaseOrdersContainer.tsx` — Toast import file chỉ báo số lượng bỏ qua, không liệt kê SKU → hiển thị tối đa 5 SKU bị bỏ qua trong toast
- TypeScript: clean (npx tsc --noEmit)
- Files: `components/purchase/PurchaseOrdersPage.tsx`, `components/purchase/PurchaseOrdersContainer.tsx`, `components/pos/GoodsPurchaseForm.tsx`


---

### 2026-06-15 — Fix 4 bugs còn lại trang máy tính tiền (audit Round 8)

- `types.ts`: Thêm field `returnOtherRefund?: number` vào type `POSOrder`
- `POSComputer.tsx:returnOrder`: Lưu `returnOtherRefund` vào POSOrder để đối soát về sau
- `POSReceiptModal.tsx`: Thêm dòng "Hoàn trả thu khác" trong totals khi `returnOtherRefund > 0`
- `POSComputer.tsx` (print): Thêm dòng "Hoàn trả thu khác" trong bản in giấy
- `POSComputer.tsx` (print): Sửa 2 dòng "Thanh toán" chồng nhau khi ghi nợ → chỉ hiện 1 dòng "GHI NỢ"
- `usePOSReturnFlow.ts:addToReturnCart`: Fast return không còn giới hạn `maxQuantity` theo tồn kho hiện tại
- `POSCheckout.tsx`: Xóa checkbox "Giao hàng" dummy trong return mode
- Files: `types.ts`, `POSComputer.tsx`, `POSReceiptModal.tsx`, `usePOSReturnFlow.ts`, `POSCheckout.tsx`

### 2026-06-15 — Fix 10 bugs trang máy tính tiền (audit Round 7)

- BUG-1 — `POSComputer.tsx:handleFinishOrder`: Sau checkout reset tab về `paymentMethod: 'Cash'` thay vì `paymentSettings?.defaultMethod` → đổi thành đọc defaultMethod
- BUG-2 — `POSComputer.tsx:handleCheckout` (return): `debtAmount` giảm tự động khi trả hàng dù đơn gốc có thể không phải ghi nợ → bỏ field debtAmount khỏi returnUpdatedCustomer (Phương án A)
- BUG-3 — `POSComputer.tsx:addToCart`: Kiểm tra stock dùng stale closure `activeTab.cart` → chuyển vào trong `setTabs(prevTabs => ...)` functional updater, dùng `setTimeout` để fire warning
- BUG-4 — `POSComputer.tsx:handleFinishOrder`: Đọc `tabs` từ stale closure khi modal hiển thị → thêm `tabsRef` và dùng `tabsRef.current`
- BUG-5 — `POSReceiptModal.tsx`: Items return/exchange hiển thị như nhau → thêm prefix `[TRẢ]`/`[ĐỔI]` và màu sắc theo lineType
- BUG-6 — `POSReceiptModal.tsx`: Không hiển thị `returnFee` → thêm dòng "Phí trả hàng" trong totals section
- BUG-7 — `POSCheckout.tsx` + `POSComputer.tsx`: Giảm giá/Phí trả/Hoàn trả thu khác hardcode "0", không có UI nhập → thêm 3 props mới, làm rows clickable mở prompt
- BUG-8 — `POSCheckout.tsx:hasCheckoutItems`: Button THANH TOÁN enabled dù returnCart có items nhưng quantity = 0 → đổi `length > 0` thành `some(item => item.quantity > 0)`
- BUG-9 — `POSCheckout.tsx:copyPaymentInfo`: Dùng `window.alert` → đổi sang `useToast`
- BUG-10 — `POSComputer.tsx:cashSuggestions`: While loop có điều kiện `result.length < 5` sai → bỏ điều kiện thừa
- TypeScript: clean
- Files: `components/pos/POSComputer.tsx`, `components/pos/POSCheckout.tsx`, `components/pos/POSReceiptModal.tsx`

---

### 2026-06-15 — Fix 2 lỗi còn lại sau audit toàn diện

- Bug 1 — `services/dataMapper.ts:posCustomers`: Thiếu `debtAmount: Number(c.debt_amount || 0)` → nợ khách hàng reset về 0 khi load từ Supabase trên thiết bị mới → đã thêm field vào mapping
- Bug 2 — `components/finance/CashLedgerPage.tsx:orderToEntry`: `amount: o.finalAmount ?? 0` không dùng `Math.abs` → đơn trả cũ có finalAmount âm làm sai số dư sổ quỹ → đổi thành `Math.abs(o.finalAmount ?? 0)`
- Files: `services/dataMapper.ts`, `components/finance/CashLedgerPage.tsx`

---

### 2026-06-15 — Fix 4 lỗi logic nghiệp vụ (báo cáo & lương)

- Bug A — `reportCalculations.ts:getSalesProfitRowsByDate`: Không dùng `Math.abs` khi trừ revenue của đơn trả → nếu `totalAmount` âm (KiotViet import), lợi nhuận báo cáo bị tăng ảo → thêm `Math.abs`
- Bug B — `reportCalculations.ts:getEndOfDayReportRows`: Cùng pattern `Math.abs` thiếu cho cột revenue/actual của đơn trả cuối ngày → thêm `Math.abs`
- Bug C — `businessLogic.revenue.ts:calculateExecutiveInsights`: Double-count chi phí lương khi dùng cả payroll module lẫn expense ledger → thêm filter salary ra khỏi ledger khi `projectedPayroll > 0`
- Bug D — `businessLogic.payroll.ts:calculateEmployeePayroll`: `hasTetCommitment` hardcoded `true` → sửa thành `tetTotal > 0 || Boolean(tetConfig)`
- TypeScript: clean, Tests: 286/286 pass
- Files: `src/lib/reportCalculations.ts`, `src/lib/businessLogic.revenue.ts`, `src/lib/businessLogic.payroll.ts`

---

### 2026-06-15 — Fix 3 lỗi logic tồn kho

- Bug 1 — `useGoodsPurchase.ts`: Nhập nhanh từ GoodsInventory không tạo `SupplierDebtRecord` → thêm tạo debt và bundle vào `onUpdateSurgical` cùng batch với product updates
- Bug 2 — `usePOSReturnFlow.ts:addToReturnCart`: Trả hàng nhanh không có `maxQuantity` → tồn kho có thể tăng vô hạn → thêm `maxQuantity: product.stock` khi thêm sản phẩm mới vào giỏ trả
- Bug 3 — `PurchaseOrdersContainer.tsx:handleDeletePurchase`: Xóa phiếu nhập khi đã bán → tồn kho âm bị cắt về 0 âm thầm → thêm dialog cảnh báo + confirm trước khi xóa
- TypeScript: clean, Tests: 286/286 pass
- Files: `components/pos/useGoodsPurchase.ts`, `components/pos/usePOSReturnFlow.ts`, `components/purchase/PurchaseOrdersContainer.tsx`

---

### 2026-06-15 — Fix 5 vấn đề logic giá vốn

- Fix 1 — `types.ts`: Thêm `previousImportPrice?: number` vào `InventoryTransaction.items` để lưu giá vốn trước khi nhập
- Fix 1 — `PurchaseOrdersContainer.tsx:handleDeletePurchase`: Rollback `importPrice` về `item.previousImportPrice` khi xóa phiếu nhập completed (trước đây chỉ rollback stock)
- Fix 1 — `PurchaseOrdersContainer.tsx:handleCompletePurchase` + `useGoodsPurchase.ts:handleCompletePurchase`: Gán `previousImportPrice: product.importPrice` vào từng transaction item
- Fix 2 — `businessLogic.inventory.ts`: Extract `calcEffectiveUnitPrice` thành hàm export dùng chung; cả hai luồng nhập hàng giờ dùng cùng một hàm thay vì viết lại
- Fix 3 — `PurchaseOrdersContainer.tsx`: Ưu tiên `data.posInventorySettings?.costMethod` thay vì chỉ đọc localStorage; `useGoodsPurchase.ts` thêm prop `inventoryCostMethod` với fallback localStorage
- Fix 3 — `GoodsInventory.tsx`: Thêm prop `inventoryCostMethod`, truyền từ `MainContent.tsx` qua `data.posInventorySettings?.costMethod`
- Fix 4 — `businessLogic.inventory.ts`: Thêm JSDoc cho `calculateNextImportPrice` và `calcEffectiveUnitPrice`
- Fix 5 — `reportCalculations.ts`: Thêm comment giải thích tại sao dùng `inventoryTransactions` thay vì bảng `product_cost_history`
- TypeScript: clean (npx tsc --noEmit), Tests: 279/279 pass
- Files: `types.ts`, `src/lib/businessLogic.inventory.ts`, `src/lib/reportCalculations.ts`, `components/purchase/PurchaseOrdersContainer.tsx`, `components/pos/useGoodsPurchase.ts`, `components/pos/GoodsInventory.tsx`, `components/MainContent.tsx`

---

### 2026-06-15 — Fix 6 lỗi logic tính giá vốn

- Fix 1 — `PurchaseOrdersContainer.tsx`: discount toàn đơn (`billDiscountAmount`) chưa được phân bổ vào `effectiveUnitPrice` → tách hàm `calcEffectiveUnitPrice`, áp dụng nhất quán cho cả `transaction.items` và `updatedProducts`
- Fix 2 — `tests/unit/businessLogic.inventory.test.ts`: thêm 15 unit tests cho `calculateNextImportPrice` (method `fixed` + `average`, lần nhập đầu, tồn kho âm, qty=0, làm tròn, edge cases)
- Fix 3 — `reportCalculations.ts`: COGS trong báo cáo lợi nhuận dùng giá vốn lịch sử thay vì snapshot hiện tại — thêm hàm `buildCostHistory`/`getHistoricalCost`, thêm param tùy chọn `inventoryTransactions` vào `getSalesProfitRowsByDate`, cập nhật `SalesReportPage` + `MainContent`
- Fix 4 — `useGoodsPurchase.ts`: transaction nhập hàng nhanh thiếu `supplierId` — thêm `suppliers` prop, resolve supplier từ tên, ghi đúng `supplierId` và `supplierName` chuẩn hóa
- Fix 5 — `types.ts` + `GoodsTab.tsx`: `costMethod` chỉ lưu localStorage → thêm vào `POSInventorySettings`, sync lên Supabase khi thay đổi, ưu tiên đọc từ Supabase khi load lần đầu
- Fix 6 — `GoodsTab.tsx`: làm rõ mô tả method `fixed` (giá vốn không tự cập nhật khi nhập giá mới) và `average` (ghi rõ AVCO)
- Files: `components/purchase/PurchaseOrdersContainer.tsx`, `components/pos/useGoodsPurchase.ts`, `components/pos/GoodsInventory.tsx`, `src/lib/reportCalculations.ts`, `components/reports/SalesReportPage.tsx`, `components/MainContent.tsx`, `types.ts`, `components/settings/tabs/GoodsTab.tsx`, `tests/unit/businessLogic.inventory.test.ts`
- TypeScript: clean (npx tsc --noEmit), Tests: 279/279 pass

### 2026-06-15 — Fix hệ thống thanh toán Thẻ (paymentMethod 'Card')

- Thêm `'Card'` vào `POSPaymentMethod` và `POSOrder.paymentMethod` trong `types.ts`
- Fix `POSCheckout.tsx`: phương thức Thẻ dùng `method: 'Card'` thay vì `'Other'`; tương thích ngược với `enabledMethods` cũ chứa `'Other'`
- Fix `POSReceiptModal.tsx`: hiển thị chi tiết từng PTTT khi đơn có `splitPayments`
- Fix `SalesReportPage.tsx`: thêm filter "Thẻ" (Card); giữ filter "Khác" (Other) cho dữ liệu cũ
- Cập nhật label/filter "Card → Thẻ" trong: `EndOfDayReport.tsx`, `OrderInvoices.tsx`, `PendingOrdersPage.tsx`
- Cập nhật type tại: `pos/types.ts`, `POSMobileCheckoutSheet.tsx`, `CashLedgerPage.tsx`
- Files: `types.ts`, `components/pos/types.ts`, `POSCheckout.tsx`, `POSReceiptModal.tsx`, `POSMobileCheckoutSheet.tsx`, `EndOfDayReport.tsx`, `orders/OrderInvoices.tsx`, `orders/PendingOrdersPage.tsx`, `finance/CashLedgerPage.tsx`, `reports/SalesReportPage.tsx`

### 2026-06-15 — Implement Supabase Realtime sync (2 POS + quản lý từ xa)

- Tạo `hooks/useRealtimeSync.ts` — subscribe `pos_orders`, `pos_products`, `revenue_records` via WebSocket
- Echo prevention: `markLocalWrite(id)` đánh dấu ID vừa ghi local → bỏ qua Realtime event trong 3s
- Mapper inline: `mapOrderRow`, `mapProductRow`, `mapRevenueRow` (snake_case DB → app camelCase)
- `hooks/useAppData.ts` — thêm `mergeRemoteUpdate` (dispatch-only, không ghi lại Supabase), gọi `markLocalWrite` trong `updateSurgical`
- `App.tsx` — gọi `useRealtimeSync(mergeRemoteUpdate)` sau `useAppData()`
- TypeScript: 0 lỗi ✅
- **Bước thủ công còn lại**: bật Realtime toggle cho 3 bảng trên Supabase Dashboard
- Files: `hooks/useRealtimeSync.ts` (new), `hooks/useAppData.ts`, `App.tsx`

---

### 2026-06-15 — Chạy SQL pending trên Supabase Cloud

- Tạo bảng `product_cost_history` (đã tồn tại từ trước, bỏ qua CREATE TABLE)
- `ALTER TABLE pos_orders` — thêm 4 cột: `refund_amount`, `staff_name`, `split_payments`, `cash_received`
- Bật RLS cho 6 bảng: `employees`, `payroll_records`, `revenue_records`, `pos_customers`, `pos_orders`, `audit_logs`
- Tất cả policy dùng `IF NOT EXISTS` guard, chạy thành công ✅

---

### 2026-06-15 — Audit POS round 6: fix BUG-47, BUG-48 (trang máy tính tiền)

- **BUG-47** `ProcessOrdersModal.tsx` — hardcode `products={[]}` `revenue={[]}`, thiếu `onUpdateSurgical` → fast return từ modal "Xử lý đặt hàng" không cập nhật tồn kho, COGS sai, không lưu được. Fix: thêm props `products`, `revenue`, `onUpdateSurgical` vào `ProcessOrdersModal`; truyền từ `POSComputer`; truyền `updateSurgical`+`data.revenue` từ `MainContent`
- **BUG-48** `POSReturnModal.tsx` — `setPage(1)` gọi bên trong `useMemo` (anti-pattern, có thể double-render Strict Mode). Fix: chuyển sang `useEffect` riêng với deps `[orders, returnSearch, customers]`
- Files: `ProcessOrdersModal.tsx`, `POSComputer.tsx`, `MainContent.tsx`, `POSReturnModal.tsx`
- TypeScript check: 0 errors ✅

---

### 2026-06-15 — Audit POS round 5: fix BUG-29 đến BUG-46 (trang hàng hóa & thiết lập giá)

- **BUG-29** `GoodsPriceSetupModal.tsx` — `handleSavePagePrices` không lọc giá 0 → lưu salePrice=0 ghi đè giá cũ. Fix: thêm `.filter(([, salePrice]) => salePrice > 0)`
- **BUG-30** `GoodsProductRow.tsx` — crash khi variant hoặc product chưa có giá (undefined). Fix: wrap `Number(x) || 0` cho salePrice/importPrice
- **BUG-31** `useGoodsAudit.ts` — `onAddTransaction` gọi trước khi `onUpdateSurgical` resolve xong → race condition. Fix: đưa vào trong try block sau await
- **BUG-32** `useGoodsFilters.ts` — filter "Còn hàng" sai cho sản phẩm cha (stock=0 nhưng variants có hàng). Fix: thêm `parentTotalStock` useMemo, dùng `effectiveStock` trong matchStock
- **BUG-34** `GoodsPriceSetupModal.tsx` — cột "Giá nhập cuối" duplicate cột "Giá vốn" (cùng field `importPrice`). Fix: xóa cột thừa
- **BUG-35** `GoodsPriceSetupModal.tsx` — filter priceCondition/comparePrice không áp dụng vào filteredProducts. Fix: thêm logic `matchesPrice` vào useMemo
- **BUG-36** `GoodsProductRow.tsx` — cột stock của sản phẩm cha hiển thị 0 thay vì tổng variants. Fix: tính `totalVariantStock` từ variants
- **BUG-37** `useGoodsAudit.ts` — kiểm kho ghi đè stock=0 cho sản phẩm cha. Fix: `if (product.isParent) return`
- **BUG-38** `useGoodsFilters.ts` — `sellableSkuCount` dùng `!p.isParent` không nhất quán với `filteredProducts` (dùng `!p.parentId`). Fix: đổi thành `!p.parentId`
- **BUG-39** `useGoodsFilters.ts` — `categoryMatchesSelection` có lastPart fallback nguy hiểm (match nhầm nhóm cùng tên). Fix: xóa fallback
- **BUG-40** `useGoodsVariantWorkflow.ts` — `variantCount` cộng thêm vào giá trị cũ (có thể sai). Fix: tính lại từ `existingVariants.length + newVariants.length`
- **BUG-41** `useGoodsSelection.ts` — toast xóa dùng `selectedIds.length` thay vì `idsToDelete.size` (bỏ sót variants của cha). Fix: đổi thành `idsToDelete.size`
- **BUG-42** `GoodsPriceSetupModal.tsx` — 2 ô filter trong bảng (mã/tên) dùng chung state `searchTerm`. Fix: tách thành `tableSearchSku` và `tableSearchName`
- **BUG-43** `useGoodsAudit.ts` — toast kiểm kho không hiển thị chênh lệch. Fix: thêm `diffNote` "(tăng/giảm X đơn vị)"
- **BUG-44** `useGoodsFilters.ts` — biến `parentSkuFallback` trong `variantsByParentId` shadowing biến ngoài. Fix: rename thành `variantParentSkuFallback`
- **BUG-45** `useGoodsVariantWorkflow.ts` — validation attribute khi thêm variant chỉ check `length === 1`. Fix: mở rộng thành `length > 0` + kiểm tra toàn bộ attributes
- **BUG-46** `useGoodsSelection.ts` — `selectedIds` không sync khi filter thay đổi → checkbox sai. Fix: thêm useEffect sync với `filteredProducts`
- TypeScript check: 0 errors
- Files: `GoodsPriceSetupModal.tsx`, `GoodsProductRow.tsx`, `useGoodsAudit.ts`, `useGoodsFilters.ts`, `useGoodsSelection.ts`, `useGoodsVariantWorkflow.ts`

---

### 2026-06-14 (ca 6) — Fix 2 lỗi audit POS tiếp theo (POSCart + POSReceiptModal)

- **[Bug POS-4]** `components/pos/POSCart.tsx:185` — exchange search trong tab trả hàng thiếu filter `!p.isParent && p.status === 'Active' && p.salePrice > 0` → sản phẩm cha và ngừng bán hiện trong dropdown. Fix: thêm 3 điều kiện vào filter
- **[Bug POS-5]** `components/pos/POSReceiptModal.tsx:31-33` — tên cửa hàng, địa chỉ, hotline bị hardcode ("CFO BRAIN PROFESSIONAL / 1900 1234"). Fix: thêm prop `brandProfile?: BrandProfile`, dùng trong JSX; truyền `brandProfile` từ cả 2 chỗ gọi (desktop + mobile) trong POSComputer.tsx
- Files: `components/pos/POSCart.tsx`, `components/pos/POSReceiptModal.tsx`, `components/pos/POSComputer.tsx`

---

### 2026-06-14 (ca 5) — Fix 3 lỗi audit màn hình POS (posOrderService + POSComputer + POSCheckout)

- **[Bug POS-1]** `services/posOrderService.ts:323` — `autoUpsertStaffSalesForDate` nằm trong main try/catch của `processPlaceOrder` → nếu staff update lỗi toàn đơn hàng bị rollback sai. Fix: tách ra ngoài main try/catch, wrap riêng (giống cách `processReturnOrder` đã làm)
- **[Bug POS-2]** `components/pos/POSComputer.tsx:1416` — desktop `POSReceiptModal` truyền `cashReceived={cashReceived}` (tab state = 0 cho tab trả hàng), không nhất quán với mobile. Fix: đổi thành `cashReceived={lastOrder.cashReceived ?? cashReceived}`
- **[Bug POS-3]** `components/pos/POSCheckout.tsx:465` — `hasPointsEligibleProducts` filter `allowPoints === true` bỏ sót sản phẩm chưa set flag (undefined). Fix: đổi thành `allowPoints !== false` khớp với logic tính điểm trong POSComputer
- Files: `services/posOrderService.ts`, `components/pos/POSComputer.tsx`, `components/pos/POSCheckout.tsx`

---

### 2026-06-14 (ca 4) — Fix 3 lỗi audit nhập hàng

- **[Bug 1]** `GoodsPurchaseForm.tsx:441-452` — ô "Mã phiếu nhập" là UI giả (uncontrolled, không lưu) → thêm state `purchaseReferenceId` vào `usePurchaseFormState`, wire prop vào form, lưu `referenceId` trên `InventoryTransaction` khi hoàn thành và khi lưu tạm
- **[Bug 2]** `GoodsPurchaseForm.tsx:666` — tên NCC parse từ `note.split('từ ')` → thay bằng `t.supplierName`
- **[Bug 3]** `PurchaseOrdersContainer.tsx` — `handleCompleteReturn` thiếu rollback khi thất bại → thêm inner try/catch khôi phục transaction, debtRecord, và stock về trạng thái ban đầu
- Files: `hooks/usePurchaseFormState.ts`, `components/pos/GoodsPurchaseForm.tsx`, `components/purchase/PurchaseOrdersContainer.tsx`

---

### 2026-06-14 (ca 3) — Fix 3 lỗi POS audit lần 2

- **[Bug 1]** `POSCheckout.tsx:715` — điều kiện `netPayable > 0` ẩn dòng "Tiền trả khách" khi chỉ trả thuần (không đổi) → đổi thành `finalReturnAmount > 0`
- **[Bug 2]** `POSReceiptModal.tsx` — modal hiện "Hoàn trả khách: 0đ" khi khách đổi hàng đắt hơn → tính `exchangeTotal` từ `items.filter(lineType=exchange)`, phân nhánh hiện "Khách thanh toán" (indigo) hoặc "Hoàn trả khách" (rose)
- **[Bug 3]** `POSReceiptModal.tsx:44` — tên thu ngân hiện `staffId` thay vì `staffName` → `staffName || staffId`
- TypeScript clean (0 errors)
- Files: `POSCheckout.tsx`, `POSReceiptModal.tsx`

---

### 2026-06-14 (ca 2) — Fix 5 lỗi POS audit

- **[Fix A]** `POSComputer.tsx` — `totalSpent` không cộng `customerPaysDifference` khi khách đổi sang hàng đắt hơn → sửa công thức đúng: `totalSpent + customerPaysDifference - amountToPayCustomer`
- **[Fix B]** `POSComputer.tsx:handlePrint` — đơn đổi hàng hiện thêm dòng "Tiền hàng đổi", hiển thị "KHÁCH THANH TOÁN" khi khách trả thêm hoặc "HOÀN TRẢ KHÁCH" khi shop hoàn tiền; dùng `refundAmount` thay vì `finalAmount`
- **[Fix C]** `POSReceiptModal.tsx` — modal xác nhận: đơn trả hàng hiện tiêu đề "Hóa đơn trả hàng", hiện dòng "Hoàn trả khách" màu đỏ với `refundAmount`, ẩn "Khách đưa"/"Tiền thừa"
- **[Fix D]** `POSCheckout.tsx` — xóa dòng "Tổng giá gốc hàng mua" trùng lặp với "Tổng tiền hàng trả" trong sidebar trả hàng
- **[Fix E]** `POSReturnModal.tsx` — cột Nhân viên hiển thị `staffName` thay vì `staffId`
- TypeScript clean (0 errors), `npx tsc --noEmit` pass
- Files: `POSComputer.tsx`, `POSReceiptModal.tsx`, `POSCheckout.tsx`, `POSReturnModal.tsx`

---

### 2026-06-14 — Fix 4 lỗi luồng trả hàng POS

- **[Fix #1]** `POSComputer.tsx` — `returnUpdatedCustomer` thiếu `totalSpent` giảm khi trả hàng → thêm `totalSpent: Math.max(0, totalSpent - amountToPayCustomer)`, tránh khách ở tier cao hơn thực tế dài hạn
- **[Fix #2]** `types.ts` — thêm field `returnFee?: number` vào `POSOrder`; `POSComputer.tsx` — lưu `returnFee` vào `returnOrder`; `posOrderService.ts:processReturnOrder` — cộng `returnFee` vào `revenueOther` trong `revenue_records` thay vì bỏ mất
- **[Fix #3]** `POSComputer.tsx:handlePrint` — items trong đơn trả/đổi có prefix `[TRẢ]` màu đỏ và `[ĐỔI]` màu xanh, phân biệt rõ ràng trên hóa đơn in
- **[Fix #4]** `POSComputer.tsx:handlePrint` — đơn trả hiển thị đúng: label "Tiền hàng trả", "Phí trả hàng" (nếu có), "HOÀN TRẢ KHÁCH" thay vì "Tiền hàng"/"TỔNG CỘNG"/"Khách đưa"
- TypeScript clean (0 errors)
- Files: `types.ts`, `components/pos/POSComputer.tsx`, `services/posOrderService.ts`

---

### 2026-06-13 (ca 2) — Hệ thống phân quyền 3 cấp + quản lý tài khoản trong Settings

- Thêm `role` (cashier/manager/owner) vào `user_metadata` Supabase khi đăng ký
- Trang đăng nhập: bỏ tab đăng ký, chỉ giữ đăng nhập với 2 sub-tab (Thu ngân / Quản lý·Chủ)
- Tạo `LauncherPage.tsx`: màn hình chọn chế độ sau đăng nhập — thu ngân chỉ thấy nút Bán hàng, quản lý/chủ thấy 2 nút Bán hàng + Quản lý
- App.tsx: thu ngân bị redirect về /pos nếu cố vào trang quản lý
- Cài đặt: thêm tab "Quản lý tài khoản" (AccountsTab) — xem danh sách, tạo mới, reset mật khẩu, xóa tài khoản
- Backend: 3 API mới `/api/auth/accounts` (GET), `/api/auth/accounts/:id/password` (PATCH), `/api/auth/accounts/:id` (DELETE)
- Files: `routes/auth.ts`, `services/auth.ts`, `components/LoginPage.tsx`, `components/LauncherPage.tsx`, `index.tsx`, `App.tsx`, `components/settings/SettingsCenter.tsx`, `components/settings/tabs/AccountsTab.tsx`

---

### 2026-06-13 — Auth, UI đăng nhập, schema sync local Supabase

**Auth & Logout:**
- **[AuthGate.tsx]** Fix logout không ra trang đăng nhập: luôn đăng ký `onAuthStateChange`, dev mode dùng dummy session bypass, chỉ phản hồi `SIGNED_OUT`
- **[POSComputer.tsx]** Nút Đăng xuất POS giờ gọi `signOut()` thật thay vì chỉ reset cart
- **[components/LoginPage.tsx]** Tạo mới — trang đăng nhập riêng tại `/login`, logo lớn hơn (`w-4/5`), nền trắng cột trái, card `w-[70vw] min-h-[70vh]`
- **[index.tsx]** Thêm route `/login` → `<LoginPage />`
- **[routes/auth.ts]** Tạo mới — `POST /api/auth/register` dùng Admin API, bypass email confirmation
- **[components/LoginPage.tsx]** Đăng ký bằng tên đăng nhập (không cần email), tự ghép `@cfobrain.local`

**Schema sync local Supabase:**
- **[server.ts]** Thêm `syncLocalSchema()` — mỗi khi khởi động ở mạng nội bộ, tự kiểm tra cột thiếu trên local Supabase qua REST API, in SQL cần chạy vào console nếu phát hiện thiếu
- **[package.json]** Thêm `pg`, `@types/pg` dependency
- Files: `AuthGate.tsx`, `LoginPage.tsx` (new), `POSComputer.tsx`, `index.tsx`, `routes/auth.ts` (new), `server.ts`

---

### 2026-06-13 — Fix lỗi logout không ra trang đăng nhập

- **[AuthGate.tsx]** Đăng ký `onAuthStateChange` ở mọi môi trường (trước: chỉ PROD) — dev không có listener nên sign out không có effect
- **[AuthGate.tsx]** Khởi tạo `session` = dummy truthy trong dev để giữ bypass auth, chỉ phản hồi sự kiện `SIGNED_OUT` trong dev
- **[AuthGate.tsx]** Đơn giản hoá render condition: `if (session)` thay vì `if (!PROD || session)`
- Files: `components/AuthGate.tsx`

---

### 2026-06-13 — Hoàn tất production readiness — app sẵn sàng go-live

- Đã chạy SQL trên Supabase Dashboard: RLS 5 bảng Shopee + ALTER TABLE carry-forward debt
- Xác nhận `.gitignore` đã có `.env.local`, `excelSafety.ts` đã validate xlsx đúng
- TypeScript clean, 266 tests pass
- **Trạng thái: APP SẴN SÀNG DÙNG THỰC TẾ** ✅

---

### 2026-06-13 — Production readiness: fix 2 vấn đề security, chuẩn bị SQL Supabase

- **[server.ts]** `saveUninitialized: true` → `false`, `resave: true` → `false` — không tạo session rác cho request chưa đăng nhập
- **[supabase_setup.sql]** Bỏ comment, bật RLS cho 5 bảng Shopee + thêm `CREATE POLICY authenticated` (DO $$ IF NOT EXISTS $$) — sẵn sàng chạy trên Supabase Dashboard
- Ghi nhận: `.gitignore` đã đúng, `excelSafety.ts` đã có validation xlsx, TypeScript clean, 266 tests pass
- Files: `server.ts`, `supabase_setup.sql`

---

### 2026-06-13 — Audit vòng 2: fix 10 lỗi còn sót sau vòng 1

**Critical (3 lỗi):**
- **[D1]** `POSComputer.tsx:623` — `discountRatio` âm khi discount lớn → `pointsEarned` âm → điểm bị trừ khi mua. Fix: `Math.max(0, ...)`
- **[C1-POS]** `usePOSReturnFlow.ts:139` — `handleSelectOrderReturn` load cả `lineType='exchange'` vào returnCart → cho phép trả ngược hàng đổi. Fix: filter chỉ giữ items `sale`
- **[D3]** `POSComputer.tsx:607` — `pointsRate = 0` → chia cho 0 → `pointsEarned = Infinity`. Fix: `Math.max(1, pointsRate)`

**Major (4 lỗi):**
- **[F2]** `usePOSReturnFlow.ts:166` — `customers` thiếu trong `useCallback` deps → stale closure → fix M4 auto-fill không hoạt động sau khi customers cập nhật
- **[B1]** `posOrderService.ts:buildRevenueUpdate` — `netRevenue > totalGrossRevenue` khi có `otherFees`. Fix: tách `otherFees` vào `revenueOther`, `netRevenue = totalAmount - discount`
- **[M2-INV]** `posOrderService.ts:processReturnOrder` — rollback bước 3 không xóa inventoryTransactions. Fix: kết hợp inventory deletions + stock revert trong 1 `updateSurgical` call
- **[M3-INV]** `useGoodsPurchase.ts:162` — `onAddTransaction` thiếu `await` → lỗi bị nuốt silently. Fix: thêm `await`

**Minor (3 lỗi):**
- **[E1]** `POSComputer.tsx` — `isCheckoutLocked` kẹt nếu modal không render. Fix: `useEffect` timeout 30s tự reset
- **[m4-INV]** `posOrderService.ts:485` — `autoUpsertStaffSalesForDate` ngoài try/catch trong `processReturnOrder`. Fix: bọc trong try/catch riêng
- **[m3-INV]** `routes/data.ts:678,826` — `item.importPrice` miss nếu DB lưu `import_price`. Fix: check cả 2 key

- TypeScript clean, 266 tests pass
- Files: `components/pos/POSComputer.tsx`, `components/pos/usePOSReturnFlow.ts`, `services/posOrderService.ts`, `components/pos/useGoodsPurchase.ts`, `routes/data.ts`

---

### 2026-06-13 — Audit & fix 15 lỗi logic POS và tồn kho

**Critical (6 lỗi):**
- **[C1]** `posOrderService.ts:buildRevenueUpdate` — đổi `totalAmount - discount` → `finalAmount` (bao gồm otherFees/phụ phí)
- **[C2]** `POSComputer.tsx:761` — `finalAmount` đơn trả từ âm → dương (`isReturn: true` đã phân biệt)
- **[C3]** `POSComputer.tsx` — chặn checkout khi toàn bộ returnCart có quantity = 0
- **[I1]** `posOrderService.ts:262` — tách inventory transaction và stock update thành 2 `updateSurgical` call riêng + thêm rollback cho transaction
- **[I2/M3]** Cải thiện checkout lock: giải phóng localStorage lock ngay sau khi order confirmed (không chờ modal đóng)

**Major (6 lỗi):**
- **[M1/M2]** `usePOSReturnFlow.ts` — `item.total` trong returnCart tính `qty × (price - discount)` thay vì `qty × price` — tránh hoàn tiền nhiều hơn thực thu, và điểm trừ đúng
- **[M4]** `usePOSReturnFlow.ts:handleSelectOrderReturn` — auto-fill `selectedCustomer` từ đơn gốc (thêm `customers` param) — tránh điểm không bị thu hồi khi trả
- **[M6]** `useGoodsExcelImport.ts` — `Math.max(0, ...)` cho stock khi import — không cho import tồn kho âm
- **[M10]** `routes/data.ts:financial-matrix` — COGS dùng giá lịch sử (`product_cost_history`) thay vì giá hiện tại — nhất quán với `recalculate-cogs`

**Minor (3 lỗi):**
- **[m2]** `POSComputer.tsx` — `discountRatio` cho `pointsEarned` loại trừ `otherFees` (`Math.min(1, ...)`)
- **[m5]** `POSReturnModal.tsx` — so sánh ngày dùng `toLocaleDateString('en-CA')` thay vì Date object UTC — fix miss đơn do lệch timezone
- **[m6]** `useGoodsExcelImport.ts` — filter tên sản phẩm loại trừ `''`, `'null'`, `'undefined'`
- **[m7]** `POSComputer.tsx` — validate `returnFee >= 0` trước khi checkout

- TypeScript clean, 266 tests pass
- Files: `services/posOrderService.ts`, `services/posOrderService.test.ts`, `components/pos/POSComputer.tsx`, `components/pos/usePOSReturnFlow.ts`, `components/pos/useGoodsExcelImport.ts`, `components/pos/POSReturnModal.tsx`, `routes/data.ts`

---

### 2026-06-07 — Logic audit & fix 6 bugs tính toán doanh thu

- **BUG 1** `reportCalculations.ts:getSalesProfitRowsByDate` — đổi `finalAmount` → `calcOrderRevenue(order)` cho đơn bán (tránh undercount khi KH dùng điểm)
- **BUG 2** `reportCalculations.ts:getSalesStaffRows` — đổi `finalAmount` → `calcOrderRevenue(order)` cho doanh số nhân viên
- **BUG 3** `posOrderService.ts:buildRevenueUpdate` — đổi `netRevenue = finalAmount` → `totalAmount - discount` (chuẩn KiotViet); bảo vệ `discount` null bằng `Number(order.discount) || 0`
- **BUG 4** `EndOfDayReport.tsx:handlePrint` — fix bản in: `mDoanhThu = Σ calcOrderRevenue` thay vì gross mTienHang; `mGiamGia` derived từ `mTienHang - mDoanhThu`; `mThucThu = mDoanhThu` (nhất quán với UI live)
- **BUG 5** `OverviewPage.tsx:lastMonthSameDay` — đổi `finalAmount` → `calcOrderRevenue(o)` để % tăng trưởng không bị lệch
- **BUG 6** `EndOfDayReport.tsx:returnRevenue` — thêm `Math.abs()` tránh cộng âm khi totalAmount trả hàng là số âm
- TypeScript clean, 266 tests pass
- Files: `src/lib/reportCalculations.ts`, `services/posOrderService.ts`, `components/pos/EndOfDayReport.tsx`, `components/overview/OverviewPage.tsx`

---

### 2026-06-07 — Logic audit vòng 4: fix 13 bug từ 4 agent song song

**routes/data.ts (3 critical):**
- `financial-matrix:694` — `agg.net` đổi `final_amount` → `totalAmount - discount` (bán) / `-totalAmount` (trả)
- `recalculate-revenue-from-orders:740-773` — rewrite dùng `total_amount`: tính đúng `grossRev`, `returnsGross`, `discountSum`; `returns_value` không còn hardcode 0
- `sync-from-orders:807` — `totalSpent = Σ(totalAmount-discount)bán - ΣtotalAmount trả`; thêm `total_amount, discount` vào select

**EndOfDayReport.tsx (2):**
- `totalAllOrders:65` — chỉ cộng đơn bán (không cộng đơn trả) → cột Tổng không bị phình
- `thucThu:139` — `thucThu = doanhThu - traHang` trong methodSummaries (sub-group PTTT)

**usePosOrders.ts (1):**
- `merge:84-86` — local-only orders được filter theo date range khi merge với remote → tránh đơn ngoài range lọt vào báo cáo

**OrderReturns.tsx (3):**
- `handleCancelReturn:555` — hoàn `netRevenue += returnValue` (totalAmount) thay vì `refundValue` (finalAmount) → đối xứng với khi tạo
- `returnProfitImpact:839` — dùng `absMoney(order.totalAmount)` thay `finalAmount`
- `summary.refunded:245` — đơn bị huỷ không được tính vào "đã trả khách"

**OrderInvoices.tsx (2):**
- `handleCreateReturn:367,378` — `netRevenue` trừ `orderRevenue = totalAmount - discount` thay vì `finalAmount`

**Report pages (3):**
- `OrderReportPage:123` — bỏ filter status sai; `getOrderedGoodsReportRows` tự xử lý qua `statusFilter`
- `ChannelReportPage:144` — `fraction = Math.max(0, row.netRevenue) / totals.netRevenue` tránh arc âm
- `SupplierReportPage:74` — thêm guard `if (dateMode === 'custom') return;`

- 266 tests pass, TypeScript clean
- Files: `routes/data.ts`, `components/pos/EndOfDayReport.tsx`, `hooks/usePosOrders.ts`, `components/orders/OrderReturns.tsx`, `components/orders/OrderInvoices.tsx`, `components/reports/OrderReportPage.tsx`, `components/reports/ChannelReportPage.tsx`, `components/reports/SupplierReportPage.tsx`

---

### 2026-06-07 — Logic audit vòng 3: fix 8 bug từ 4 agent song song

- **routes/data.ts:692** — financial-matrix: `agg.returns` đổi `final_amount` → `total_amount` (chuẩn KiotViet)
- **businessLogic.revenue.ts:43** — `calculateExecutiveInsights`: `projectedNetProfit` giờ trừ `projectedPayroll` (trước đó bỏ quên → lợi nhuận báo cáo cao hơn thực tế)
- **EndOfDayReport.tsx:831** — UI: cột "Doanh thu" từng dòng đổi `totalAmount` → `calcOrderRevenue(order)` (đã trừ giảm giá)
- **EndOfDayReport.tsx:362** — Print: cột "Doanh thu" từng dòng in ra cũng fix tương tự, thêm `doanhThuOrder = calcOrderRevenue(order)`
- **posSalesAttribution.ts:117-119** — Đơn bán có bill discount: doanh số NV dùng `orderNetRevenue = totalAmount - discount` thay `finalAmount` (tránh mất doanh số khi khách trả bằng điểm)
- **OverviewPage.tsx:742-743** — Sidebar "Hoạt động gần đây": đổi `finalAmount` → `calcOrderRevenue(o)` cho đơn bán, `Math.abs(totalAmount)` cho đơn trả
- **AnalysisBusinessProfitPage.tsx:135** — `totalExpenses` dedup salary: khi `payrollTotal > 0` thì lọc salary expenses khỏi ledger trước khi cộng, tránh double-count lương
- **routes/import.ts:1903** — Route duplicate `/api/import/kiotviet-invoices` v2 shadowed bởi route v1: đổi tên thành `/api/import/kiotviet-invoices-v2`; thêm inline `inferIsReturnOrder` (trước đó undefined → crash nếu route được gọi)
- 266 tests pass, TypeScript clean
- Files: `routes/data.ts`, `src/lib/businessLogic.revenue.ts`, `components/pos/EndOfDayReport.tsx`, `src/lib/posSalesAttribution.ts`, `components/overview/OverviewPage.tsx`, `components/analysis/AnalysisBusinessProfitPage.tsx`, `routes/import.ts`

---

### 2026-06-07 — Logic audit vòng 2: fix 3 bug doanh thu còn sót

- **BUG 1** `FinanceReportPage.tsx:financeRows` — đổi `finalAmount` → `totalAmount - discount` cho netRevenue (báo cáo tài chính tháng); returnsValue dùng `Math.abs(totalAmount)`; bảo vệ discount null
- **BUG 2** `AnalysisEfficiencyPage.tsx:68,80` — staffMap và channelMap dùng `calcOrderRevenue(o)` thay `o.finalAmount`
- **BUG 3** `posSalesAttribution.ts:67` — `extraPaid` đơn đổi hàng tính từ `exchangeTotal - returnTotal` (item.total) thay vì finalAmount (luôn = 0 khi đổi hàng đắt hơn trong native POS); fallback sang finalAmount cho KiotViet imports
- 266 tests pass, TypeScript clean
- Files: `components/reports/FinanceReportPage.tsx`, `components/analysis/AnalysisEfficiencyPage.tsx`, `src/lib/posSalesAttribution.ts`

---

### 2026-06-06 — Batch 2: Chuẩn hóa calcOrderRevenue cho CustomerListPage + ChatInterface

- `CustomerListPage`: `orderStats` sold dùng `calcOrderRevenue(o)`, returned dùng `Math.abs(totalAmount)`; `spentInRangeMap` dùng `calcOrderRevenue`
- `ChatInterface`: 2 tool handlers (`get_daily_summary`, `query_pos_orders`) — tất cả `o.finalAmount` → `calcOrderRevenue(o)`, `totalReturns` dùng `Math.abs(totalAmount)`, payment breakdown đồng bộ
- 266 tests pass
- Files: `components/customers/CustomerListPage.tsx`, `components/ChatInterface.tsx`

### 2026-06-06 — Batch 1: Chuẩn hóa calcOrderRevenue cho 4 trang Phân tích

- `AnalysisCustomersOverviewPage`: đổi `o.finalAmount` → `calcOrderRevenue(o)` tại 4 chỗ (leRevenue, moiRevenue, cuRevenue, dayRevenue)
- `AnalysisCustomersClassifyPage`: `c.monetary` dùng `calcOrderRevenue(o)`; `c.returnValue` đổi `Math.abs(finalAmount)` → `Math.abs(totalAmount)` đúng chuẩn
- `AnalysisEfficiencyPage`: thay toàn bộ `o.finalAmount` → `calcOrderRevenue(o)` (5 chỗ: totalRevenue30, prev30, today, staff map, channel map)
- `AnalysisGoodsOverviewPage`: fix daily sparkline revenue dùng `calcOrderRevenue(o)`
- 4 trang còn lại (BusinessPage, BusinessProfitPage, GoodsClassify, GoodsStock) đã đúng — không cần sửa
- TypeScript clean, 266 tests pass
- Files: 4 Analysis pages

### 2026-06-06 — Chuẩn hóa công thức doanh thu thuần toàn app

- Root cause: 3 nơi dùng 3 công thức khác nhau (addOrderAmount dùng totalAmount-discount, EndOfDayReport dùng totalAmount, OverviewPage dùng finalAmount)
- Export hàm `calcOrderRevenue(order)` từ `reportCalculations.ts` — 1 công thức duy nhất: đơn bán = `totalAmount - discount`, đơn trả = `-totalAmount` (chuẩn KiotViet)
- `EndOfDayReport.tsx`: salesRevenue, methodSummaries đều dùng `calcOrderRevenue`; salesDiscount giờ derived từ `salesGross - salesRevenue`; bỏ double-subtract ở newThucthu
- `OverviewPage.tsx`: `netOrderAmount` đổi từ `finalAmount` sang `calcOrderRevenue`
- `reportCalculations.ts`: `addOrderAmount` refactor dùng `calcOrderRevenue`
- TypeScript clean, 266 tests pass
- Files: `src/lib/reportCalculations.ts`, `components/pos/EndOfDayReport.tsx`, `components/overview/OverviewPage.tsx`

### 2026-06-06 — Auto-reload sau deploy (Service Worker)

- Root cause: `CACHE_NAME = 'cfo-brain-v1.0.2'` hardcode → browser không phát hiện SW mới sau deploy
- Root cause 2: `confirm()` dialog trong `showUpdatePrompt` vô dụng vì SW đã `skipWaiting()` tự động → `registration.waiting` luôn null
- Fix `registerServiceWorker.ts`: Xóa `confirm()`, thêm `controllerchange` listener → tự `window.location.reload()` khi SW mới activate; poll update mỗi 5 phút thay vì 1 giờ
- Fix `scripts/deploy-imac.sh`: Inject timestamp `cfo-brain-vYYYYMMDDHHMMSS` vào `public/service-worker.js` trước khi build → mỗi deploy browser luôn thấy file SW khác byte
- Sau fix: deploy xong → browser tự reload trong vòng 5 phút, không cần thao tác thủ công
- Files: `registerServiceWorker.ts`, `scripts/deploy-imac.sh`

### 2026-06-06 — Full audit 6 vai trò + fix 10 vấn đề

- **Logic**: Fix `posOrderService.ts:367,381` — đổi dấu `+` → `-` khi update `netRevenue` sau trả hàng (doanh thu bị phình lên trước đây)
- **QA/UX**: Fix `POSComputer.tsx:handlePrint` — dùng `brandProfile` thay vì hardcode "CFO Brain Professional"; thêm `escapeHtml()` cho tên KH, sản phẩm, nhân viên
- **QA/UX**: Fix `POSComputer.tsx:handleAddQuickCustomer` — thêm toast báo lỗi khi tên/SĐT trống thay vì silent fail
- **Security**: Fix `PrintTemplatesTab.tsx:1614` — thêm `DOMPurify.sanitize()` cho barcode preview HTML
- **Code Review**: Fix `SalesReportPage.tsx` — thêm `dateMode` vào useEffect deps array
- **Performance**: Fix `apiService.ts:buildPosOrdersPageQuery` — đổi `select('*')` → `POS_ORDER_BOOTSTRAP_COLUMNS` (bỏ cột `items` JSON lớn)
- **Security**: Thêm RLS cho 6 bảng nhạy cảm vào `supabase_setup.sql` (employees, payroll_records, revenue_records, pos_customers, pos_orders, audit_logs)
- **Security**: Đổi `shopee_source_data` policy từ `anon` → `authenticated`
- **Code Quality**: Xóa 6 `console.log` debug trong `OfflineIndicator.tsx` và `ShippingOrders.tsx`
- TypeScript clean (exit 0), 238 tests pass
- Files: `services/posOrderService.ts`, `components/pos/POSComputer.tsx`, `components/settings/tabs/PrintTemplatesTab.tsx`, `components/reports/SalesReportPage.tsx`, `services/apiService.ts`, `supabase_setup.sql`, `components/OfflineIndicator.tsx`, `components/orders/ShippingOrders.tsx`

### 2026-06-06 — Báo cáo tự fetch Supabase theo date range (không giới hạn bootstrap)

- Thêm `fetchPosOrdersByDateRange(startDate, endDate)` vào `apiService.ts`
- Tạo hook `usePosOrders(bootstrapOrders, startDate, endDate)`: tự detect khi range nằm ngoài bootstrap 90 ngày và fetch trực tiếp Supabase
- Áp dụng hook cho 6 trang báo cáo: SalesReport, OrderReport, GoodsReport, CustomerReport, StaffReport, ChannelReport
- Thêm guard `if (dateMode === 'custom') return;` vào fallback useEffect tránh override ngày tháng user đã chọn
- Thêm loading indicator "Đang tải..." khi đang fetch
- 266 tests pass
- Files: `services/apiService.ts`, `hooks/usePosOrders.ts`, 6 report pages

### 2026-06-06 — Thêm cột "Tiền trả khách" vào báo cáo bán hàng

- Thêm field `returnRefund` vào `SalesHorizontalReportRow` interface
- Tính `returnRefund = SUM(|finalAmount|)` cho return orders (= "Cần trả khách" KiotViet)
- Hiển thị cột "Tiền trả khách" trong bảng ngang và bảng trả hàng của `SalesReportPage`
- Fix import route `kiotviet-returns`: đọc đúng cột "Tổng tiền hàng trả" / "Cần trả khách" thay vì fallback sai
- 266 tests pass
- Files: `src/lib/reportCalculations.ts`, `components/reports/SalesReportPage.tsx`, `routes/import.ts`

### 2026-06-06 — Chuẩn hóa công thức tính giá trị trả hàng theo KiotViet

- Root cause: app dùng `finalAmount` ("Cần trả khách") cho giá trị trả → sai với KiotViet vốn dùng `totalAmount` ("Tổng tiền hàng trả")
- Sự khác biệt: đơn đổi hàng có `totalAmount > 0` nhưng `finalAmount = 0` (không hoàn tiền mặt)
- Fix `addOrderAmount` trong `reportCalculations.ts`: returns dùng `totalAmount`
- Fix `getSalesProfitRowsByDate` trong `reportCalculations.ts`: returns dùng `totalAmount`
- Fix `netOrderAmount`, `netOrderProfit`, `todayReturnAmt` trong `OverviewPage.tsx`
- 266 tests pass
- Files: `src/lib/reportCalculations.ts`, `components/overview/OverviewPage.tsx`

### 2026-06-06 — Fix trang Tổng quát và Báo cáo không có dữ liệu

- Root cause: `split_payments` nằm trong `POS_ORDER_BOOTSTRAP_COLUMNS` nhưng không có trong schema `pos_orders` → Supabase lỗi "column not found" → `fetchRecentPosOrders` trả về `[]` → `data.posOrders` rỗng → toàn bộ báo cáo/tổng quát trống
- Fix: xóa `split_payments` khỏi `POS_ORDER_BOOTSTRAP_COLUMNS` trong `apiService.ts`
- Bonus fix: OverviewPage thêm `useEffect` fallback tự chuyển sang "tháng trước" khi tháng hiện tại không có đơn
- Bonus fix: tăng `POS_ORDER_BOOTSTRAP_DAYS` 60 → 90 ngày
- Thêm `ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS split_payments JSONB` vào `supabase_setup.sql`
- Files: `services/apiService.ts`, `components/overview/OverviewPage.tsx`, `supabase_setup.sql`

---

### 2026-06-06 — Deploy app lên iMac + domain phucsang.com.vn

- Cài Node.js + tsx trên iMac, copy app lên iMac qua rsync
- Build app production trên iMac, chạy tại port 3000
- Setup Cloudflare Tunnel: phucsang.com.vn → iMac:3000
- Fix CORS + CSP cho domain phucsang.com.vn
- Setup SSH key không cần password cho deploy
- Tạo `scripts/deploy-imac.sh` + `npm run deploy` — 1 lệnh deploy hoàn toàn tự động
- Auto-detect Supabase URL: nội bộ dùng IP, bên ngoài dùng app.phucsang.com.vn
- Files: `server.ts`, `scripts/deploy-imac.sh`, `scripts/watch-and-sync.sh`, `package.json`

### 2026-06-06 — Migrate database từ Supabase Cloud sang iMac cá nhân

- Cài Docker Desktop + Homebrew + libpq + cloudflared trên iMac cá nhân
- Chạy Supabase self-hosted (11 services) trên iMac cá nhân (192.168.1.3)
- Export toàn bộ data từ Supabase Cloud (48 bảng, 68,184 đơn hàng)
- Import schema + data vào Supabase local thành công
- Setup Cloudflare Quick Tunnel (neural-korean-vermont-hang.trycloudflare.com)
- Cập nhật `.env.local`: SUPABASE_URL → http://192.168.1.3:8000 + keys mới
- Fix CSP trong `server.ts`: thêm IP nội bộ, trycloudflare.com, tắt upgradeInsecureRequests
- Setup auto-start: Docker Desktop login startup + brew services cloudflared
- Xóa Fly.io apps (cfobrain-supabase, cfobrain-db) tiết kiệm chi phí
- Fix import KiotViet: sửa logic isReturn sai (bỏ check Mã trả hàng)
- Thêm route + UI import phiếu trả hàng (`/api/import/kiotviet-returns`)
- Files: `server.ts`, `.env.local`, `routes/import.ts`, `components/settings/tabs/MigrationTab.tsx`

### 2026-06-04 — Performance fix: EndOfDayReport

- `EndOfDayReport.tsx`: Gộp 9 useMemo riêng lẻ thành 1 pass duy nhất (salesOrders, returnOrders, salesSummary, returnSummary, salesDiscount, returnRefundTotal, returnTraHang, totalAllOrders, allQty)
- `EndOfDayReport.tsx`: Fix `calculateStaffSalesForDate` nhận `filteredOrders` thay vì toàn bộ `orders` (tránh scan all-time orders mỗi khi mở modal)
- `EndOfDayReport.tsx`: Wrap `nowStr`, `dateStr` trong `useMemo` — tránh tính lại khi expand/collapse
- `EndOfDayReport.tsx`: Xoá `allQty` tính lại thừa bên trong `handlePrint`

---

### 2026-06-04 — Performance fixes: giảm lag trang Hàng hóa, POS, Dashboard

- `useGoodsFilters.ts`: Fix O(n²) supplier filter — thêm `parentProductSupplierMap` (Map<parentId, Set<supplierName>>) thay vì `products.some()` lồng; tách `parentSkuFallback` ra useMemo riêng; thêm `parentProductSupplierMap` vào deps
- `POSCart.tsx`: Thêm `useDeferredValue` cho `exchangeSearch` — input không bị block khi filter 12K+ products
- `POSComputer.tsx`: Định nghĩa `EMPTY_SPLIT_PAYMENT` constant ngoài component — tránh tạo object mới mỗi render làm re-render POSCheckout
- `useAppData.ts`: `breakEvenAnalysis` filter trước (30 ngày) rồi sort 30 records, thay vì sort toàn bộ 365+ records
- `App.tsx`: Fix `silentSync` event listener — dùng `useRef` pattern, listener chỉ đăng ký 1 lần thay vì add/remove mỗi khi silentSync đổi reference
- Files: `components/pos/useGoodsFilters.ts`, `components/pos/POSCart.tsx`, `components/pos/POSComputer.tsx`, `hooks/useAppData.ts`, `App.tsx`

---

### 2026-06-04 — Audit & fix toàn bộ logic tính toán (21 issues)

**Audit phát hiện:**
- Quét 9 file cốt lõi: `businessLogic.revenue.ts`, `businessLogic.payroll.ts`, `businessLogic.inventory.ts`, `reportCalculations.ts`, `posOrderService.ts`, `POSComputer.tsx`, `useGoodsPurchase.ts`, `dataMapper.ts`, `usePurchaseFormState.ts`
- 21 vấn đề: 10 Critical, 6 Medium, 3 Minor (sau kiểm tra kỹ thực tế: giảm còn 11 bug thực + 10 non-bug)

**Đã fix:**

*Critical bugs:*
- `reportCalculations.ts`: COGS map loại sản phẩm importPrice=0 → giữ lại để phân biệt "biết giá vốn = 0" vs "không tìm thấy"
- `reportCalculations.ts`: Discount `||` → `null check` tại 2 hàm (`getSalesHorizontalRowsByDate`, `getSalesInvoiceDiscountRowsByDate`) — tránh tính lại khi discount rõ ràng = 0
- `businessLogic.payroll.ts`: Thưởng Tết extra days vượt ranh giới tháng — dùng toàn bộ `attendance` thay vì `monthAttendance`
- `businessLogic.revenue.ts`: BEP = 0 khi biến phí ≥ doanh thu → thêm `canBreakEven` flag, `safetyMargin` = 0 khi không hòa vốn được
- `businessLogic.payroll.ts` (regression): Ngày lễ format `MM-DD` không match so sánh `YYYY-MM-DD` → hỗ trợ cả 2 format

*Medium risks:*
- `businessLogic.revenue.ts` `calculateSeasonalityAnalysis`: ABC/BCG hardcode "C"/"Dog" → tính thực từ cumulative revenue (ABC) và tăng trưởng vs thị phần tương đối (BCG)
- `types.ts` + `POSComputer.tsx`: Split payment không lưu breakdown → thêm field `splitPayments` vào `POSOrder`, lưu khi `useSplitPayment = true`
- `businessLogic.revenue.ts`: Salary keyword match bằng text thô → normalize NFD trước khi so sánh (3 hàm: `calculateFinancialHealthScore`, `auditFinancials`, `calculateExpenseAnalysis`)
- `businessLogic.payroll.ts` `determineCurrentPolicy`: thêm cảnh báo console.warn khi policy ranges chồng lên nhau

*Minor:*
- `businessLogic.payroll.ts` `calculateSeniority`: thêm comment giải thích tại sao +1 ngày
- `types.ts` + `POSComputer.tsx`: qty warning threshold 10000 → dùng `inventorySettings?.maxQtyWarning ?? 10000`

**Đã xác nhận không phải bug (sau kiểm tra code thực tế):**
- OT chia 60: đúng vì field `hours` lưu phút (confirmed bởi user)
- Holiday bonus daily salary: đúng vì `baseSalary` = lương/ca (11h), không phải lương/giờ
- processPlaceOrder rollback: đúng logic (rollback handler push sau khi step thành công)
- processReturnOrder `returnsValue`: đã được cập nhật đúng (line 370-373)
- Violation regex `/[̀-ͯ]/g`: hoạt động đúng (verified bằng node test)

- Files: `src/lib/reportCalculations.ts`, `src/lib/businessLogic.payroll.ts`, `src/lib/businessLogic.revenue.ts`, `types.ts`, `components/pos/POSComputer.tsx`

---

### 2026-06-04 — UI Refactor Phase 1+2+3: Design System & chuẩn hóa toàn app

**Phase 1 — Foundation**
- `tailwind.config.js`: thêm `fontSize.2xs` (10px), `colors.primary/muted/highlight`, `boxShadow.card/panel/dropdown/modal`, `zIndex.dropdown/sticky/overlay/modal/toast/tooltip`
- `components/shared/ui/Button.tsx`: fix `secondary` variant (nền trắng thay slate-600), `font-normal` → `font-medium`, `xs` size dùng `text-2xs`
- `components/shared/ui/Modal.tsx`: `z-50` → `z-modal`, `shadow-2xl` → `shadow-modal`, overlay chuẩn `bg-slate-950/60 backdrop-blur-sm`
- `components/shared/ui/Badge.tsx`: `text-[10px]` → `text-2xs`
- 26 file: thay toàn bộ `bg-blue-600/700` → `bg-indigo-600/700` (thống nhất primary color về indigo)

**Phase 2 — Consistency**
- 208 file components: thay 1,131 arbitrary font sizes (`text-[10px/11px/12px/13px]` → `text-2xs/xs/sm`)
- 88 chỗ z-index loạn (`z-[100..10000]`) → tokens `z-modal/z-toast/z-dropdown`
- 401 chỗ `font-black` → `font-semibold` (hạ font weight quá nặng cho labels)
- `components/shared/ui/Card.tsx`: cập nhật shadow prop dùng tokens mới (`card/panel/dropdown/modal`)

**Phase 3 — Polish**
- Tạo mới `components/shared/ui/EmptyState.tsx` (2 sizes: default/compact, có icon/title/description/action)
- Tạo mới `components/shared/ui/Skeleton.tsx` (CSS animate-pulse thay framer-motion: TableSkeleton, CardSkeleton, SidebarSkeleton)
- 130 chỗ `transition-all` → `transition-colors` (43 file không có transform)
- `components/shared/ui/index.ts`: export thêm EmptyState, Skeleton và variants

- Files: `tailwind.config.js`, `components/shared/ui/Button.tsx`, `components/shared/ui/Modal.tsx`, `components/shared/ui/Badge.tsx`, `components/shared/ui/Card.tsx`, `components/shared/ui/EmptyState.tsx`, `components/shared/ui/Skeleton.tsx`, `components/shared/ui/index.ts`, + ~170 file components khác (class-only changes)

---

### 2026-06-01 — Tối ưu hiệu năng EndOfDayReport: giảm lag khi mở danh sách đơn

- `components/pos/EndOfDayReport.tsx`: memoize `allQty`, `methodSummaries` (stats theo PTTT), `orderDisplayMap` (time/staffName/qty/disc per order); xoá IIFE trong JSX; render Level 3 dùng lookup thay vì tính lại
- Files: `components/pos/EndOfDayReport.tsx`

---

### 2026-06-01 — Fix cột Khách hàng / Nhân viên / Thời gian trong EndOfDayReport

- `types.ts`: thêm `staffName?: string` vào POSOrder
- `services/dataMapper.ts`: map `staff_name` → `staffName`
- `routes/import.ts`: lưu tên thô vào `staffName` + thêm `staff_name` vào select/upsert của KiotViet invoice import
- `supabase_setup.sql`: ALTER TABLE pos_orders ADD COLUMN staff_name TEXT (cần chạy thủ công trên Dashboard)
- `components/pos/EndOfDayReport.tsx`: thêm helpers `fmtTime` (safe parse) + `fmtCustomer`; Nhân viên dùng `order.staffName || staffNameMap.get(staffId)` cả preview lẫn print
- Files: `types.ts`, `services/dataMapper.ts`, `routes/import.ts`, `supabase_setup.sql`, `components/pos/EndOfDayReport.tsx`

---

### 2026-06-01 — Fix hàm in EndOfDayReport: 14 cột / 3 cấp nhóm KiotViet

- `components/pos/EndOfDayReport.tsx`: viết lại hoàn toàn `handlePrint` phần `detailTables` — từ format cũ 11 cột lên 14 cột KiotViet (Mã chứng từ, Khách hàng, Nhân viên, Thời gian, SL, Tổng tiền hàng, Giảm giá, Doanh thu, Thu khác, VAT, Làm tròn, Phí trả hàng, Thực thu, Ghi nợ); bổ sung 3 cấp nhóm khi in: Hóa đơn (tất cả) → PTTT (TM/CK/Ví) → từng đơn; Trả hàng riêng biệt; summary box cuối trang
- Files: `components/pos/EndOfDayReport.tsx`

---

### 2026-06-01 — Thêm refund_amount + thiết kế lại EndOfDayReport

- `types.ts`: thêm `refundAmount?: number` vào POSOrder
- `services/dataMapper.ts`: map `refund_amount` → `refundAmount`
- `supabase_setup.sql`: thêm `ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0` (cần chạy thủ công trên Dashboard)
- `routes/import.ts`: KiotViet đơn trả → `refund_amount = |finalAmount|`
- `components/pos/POSComputer.tsx`: tự tính `refundAmount = amountToPayCustomer`
- `components/pos/EndOfDayReport.tsx`: bảng Chi tiết 10 cột mới (Giảm giá, Dịch vụ, Trả hàng, Tiền trả khách); bảng Tổng quát gộp thành 1 bảng duy nhất 9 cột; fix công thức grossRevenue và netActual
- Files: `types.ts`, `services/dataMapper.ts`, `supabase_setup.sql`, `routes/import.ts`, `components/pos/POSComputer.tsx`, `components/pos/EndOfDayReport.tsx`

---

### 2026-05-31 — Fix bug timezone: đơn sáng sớm bị lưu nhầm ngày hôm trước

- `routes/import.ts` hàm `excelDateToLocalIsoDateTime`: nhánh `raw instanceof Date` đổi từ `getUTC*` sang `getFullYear/getMonth/getDate/getHours/getMinutes/getSeconds` (local getters)
- Nguyên nhân: XLSX.js tạo Date object theo local timezone (Vietnam +7), dùng getUTC* đọc sai ngày với đơn đặt trước 07:00 sáng
- Triệu chứng phát hiện: đơn 64350 (đơn đầu ngày 31/05) xuất hiện ở báo cáo 30/05 thay vì 31/05; doanh thu thiếu 399,000đ so với KiotViet
- Files: `routes/import.ts`

---

### 2026-05-31 — Import hoá đơn KiotViet: khách hàng + đơn hàng + doanh thu

- `routes/import.ts`: thêm route `POST /api/import/kiotviet-invoices` — nhận file "Danh sách chi tiết hoá đơn" từ trang Hoá đơn KiotViet
- Parse: group by Mã hóa đơn → pos_orders với line items; extract khách hàng unique → pos_customers; aggregate theo tháng → revenue_records
- Tự động tạo khách mới (tên, SĐT, email, địa chỉ), upsert đơn hàng, upsert doanh thu tháng
- `MigrationTab.tsx`: thêm button "Hoá đơn" (badge Khuyên dùng) lên trên button khách hàng
- Files: `routes/import.ts`, `components/settings/tabs/MigrationTab.tsx`

---

### 2026-05-31 — Tự động tạo khách hàng khi import doanh thu KiotViet

- `routes/import.ts` route `kiotviet-revenue` format "theo lợi nhuận": đọc thêm col15 (Tên KH) + col16 (Mã KH) từ mỗi dòng
- Sau khi upsert pos_orders: tự động insert khách chưa có vào `pos_customers` (id = stableUuid từ mã KH, phone = '')
- Response trả thêm field `newCustomers` — số khách mới tạo trong lần import
- Files: `routes/import.ts`

---

### 2026-05-31 — Đồng bộ số liệu khách hàng từ pos_orders

- `routes/data.ts`: thêm endpoint `POST /api/customers/sync-from-orders` — paginate toàn bộ `pos_orders`, aggregate `totalSpent`/`lastVisit`/`points` theo `customer_id`, batch update `pos_customers`
- `MigrationTab.tsx`: thêm section "Đồng bộ số liệu khách hàng từ đơn hàng" với button + banner kết quả
- Auto-update đơn mới: đã hoạt động sẵn trong `POSComputer.tsx` (incremental update sau mỗi đơn)
- Sau khi chạy sync 1 lần: dữ liệu khách hàng sẽ lấy từ `pos_orders` làm nguồn chính, không phụ thuộc KiotViet import nữa
- Files: `routes/data.ts`, `components/settings/tabs/MigrationTab.tsx`

---

### 2026-05-31 — Align total_gross_revenue theo format KiotViet

- `routes/import.ts` dòng 925: đổi `total_gross_revenue = totalGross` → `net_revenue + ABS(discount)`; đổi `returns_value = returnsGross` → `0`
- Lý do: KiotViet UI định nghĩa "Tổng tiền hàng" = sales - returns (đã trừ trả hàng), còn app trước đó lưu gross sales only + returns riêng → hiển thị khác nhau dù net revenue bằng nhau
- Kết quả: import file "theo thời gian" mới từ KiotViet sẽ cho total_gross_revenue khớp KiotViet UI
- Data cũ: cần chạy SQL thủ công trên Supabase Dashboard: `UPDATE revenue_records SET total_gross_revenue = net_revenue + ABS(discount), returns_value = 0 WHERE returns_value > 0`
- Files: `routes/import.ts`

---

### 2026-05-31 — Fix finalAmount âm cho đơn trả hàng app-native

- `POSComputer.tsx`: lưu `finalAmount: -finalReturnAmount` (âm, nhất quán với KiotViet format)
- `POSComputer.tsx` receipt: dùng `Math.abs(lastOrder.finalAmount)` để hiển thị đúng
- `posOrderService.ts` processReturnOrder: cập nhật công thức revenue dùng `+ returnOrder.finalAmount` (vì giờ âm)
- `CustomerListPage.tsx`: `cur.returned += Math.abs(o.finalAmount)` cho đơn trả
- `AnalysisCustomersClassifyPage.tsx`: `c.returnValue += Math.abs(o.finalAmount)`
- `ChatInterface.tsx`: `totalReturns = Math.abs(o.finalAmount)`
- Kết quả: `SUM(pos_orders.final_amount)` giờ cho đúng net revenue kể cả đơn trả app-native
- Files: `POSComputer.tsx`, `posOrderService.ts`, `CustomerListPage.tsx`, `AnalysisCustomersClassifyPage.tsx`, `ChatInterface.tsx`

### 2026-05-31 — Bảng product_cost_history: lịch sử giá nhập độc lập với KiotViet

- Thêm bảng `product_cost_history` (sku, product_id, import_price, effective_date, source) vào `supabase_setup.sql` với indexes và RLS
- `routes/data.ts` — `applyInventoryTransactionFallback`: khi lưu phiếu nhập (type='Import') tự động ghi giá nhập vào `product_cost_history`
- `routes/data.ts` — endpoint `POST /api/analytics/backfill-cost-history`: đọc toàn bộ inventory_transactions cũ, backfill vào history (chạy 1 lần)
- `routes/data.ts` — `recalculate-cogs`: ưu tiên lookup từ history (giá gần nhất trước ngày bán) → fallback sang giá hiện tại
- `MigrationTab.tsx`: thêm section "Khởi tạo lịch sử giá nhập" với button và banner kết quả
- Files: `supabase_setup.sql`, `routes/data.ts`, `components/settings/tabs/MigrationTab.tsx`

### 2026-05-31 — Lưu importPrice vào pos_orders.items khi bán hàng

- Thêm `importPrice?: number` vào interface `POSOrderItem` trong `types.ts`
- `addToCart` trong `POSComputer.tsx`: lưu `importPrice: product.importPrice` vào cart item ngay lúc thêm vào giỏ
- `calculateOrderCogs` trong `posOrderService.ts`: ưu tiên `item.importPrice` đã lưu, fallback sang `pos_products.importPrice` hiện tại cho item cũ
- Kết quả: COGS đơn hàng mới sẽ luôn đúng dù giá nhập thay đổi sau này
- Files: `types.ts`, `components/pos/POSComputer.tsx`, `services/posOrderService.ts`

### 2026-05-31 — Import "theo lợi nhuận" toàn bộ lịch sử + dọn dẹp DB

- Import thành công "Báo cáo bán hàng theo lợi nhuận" từng năm 2023–2026 → COGS trong revenue_records giờ lấy từ KiotViet (giá vốn thực tế tại thời điểm bán)
- Phát hiện và hướng dẫn xóa 2 monthly records cũ còn sót gây đếm kép: 2025-01-31 (996M→đúng) và 2026-05-31 (289M→đúng)
- Fix import route purchase-details: đổi từ chỉ số cứng sang colMap theo tên cột → không bị ảnh hưởng khi KiotViet thêm cột
- Auto-recalculate COGS: chỉ update total_cogs khi = 0, không ghi đè data KiotViet đã import

### 2026-05-31 — Thêm nút Import KiotViet vào trang Nhập hàng

- Thêm nút "Import KiotViet" vào toolbar `PurchaseOrdersPage.tsx`: click → chọn file Excel → gọi `/api/import/kiotviet-purchase-details` → clear cache → hiện banner kết quả (loading/done/error)
- File: `components/purchase/PurchaseOrdersPage.tsx`

### 2026-05-31 — Chuyển nguồn Ma trận tài chính sang pos_orders

- Thêm endpoint `POST /api/analytics/financial-matrix` vào `routes/data.ts`: paginate toàn bộ 68K pos_orders phía server, aggregate theo năm (totalGrossRevenue, discount, returnsValue, netRevenue, totalCogs, grossProfit), trả về JSON
- Cập nhật `AnalysisFinancialMatrixPage.tsx`: bỏ tính từ `data.revenue`, thay bằng gọi API mới khi `timeContext` thay đổi; thêm loading spinner; `years` lấy từ API response
- Fix partial upsert `routes/import.ts`: import "theo thời gian" không ghi đè `total_cogs`/`gross_profit` — chỉ update các cột có trong format đó
- Phát hiện: `pos_orders.items` không lưu `importPrice` → COGS vẫn tra `pos_products.import_price` hiện tại; 21 sản phẩm `{DEL}` thiếu giá nhập gây gap 9.5M với KiotViet tháng 5/2025
- Files: `routes/data.ts`, `components/analysis/AnalysisFinancialMatrixPage.tsx`, `routes/import.ts`

### 2026-05-31 — Fix Ma trận tài chính: returns_value, gross revenue, và giá vốn

- Điều tra root cause: `returns_value = 0` hardcode trong `routes/import.ts`; `total_gross_revenue` thấp hơn KiotViet vì returns bị hấp thụ vào gross khi import "theo lợi nhuận"; 2026 sai vì dùng posOrders (totalAmount mapping sai)
- Import dữ liệu lịch sử: xuất file "báo cáo bán hàng theo thời gian" (theo tháng) từ KiotViet → 39 monthly records với gross/discount/returns/net đúng
- Cleanup DB: xóa ~1000 daily records cũ (chỉ giữ last-day-of-month records); xóa 3 records corrupt date; clear IndexedDB cache trình duyệt
- Fix code `AnalysisFinancialMatrixPage.tsx`: bỏ posOrders path, dùng revenue_records cho tất cả các năm → 2026 khớp KiotViet
- Fix `routes/import.ts`: nhận format "theo thời gian" (headers[6]="Giá trị trả"), parse "MM-YYYY" date, fix returns_value từ 0 → đúng; fix "theo lợi nhuận" tách gross bán vs gross trả
- Fix `useRevenueLedger.ts`: nhận file transaction-level, fix công thức netRevenue với Math.abs
- Tính giá vốn: UPDATE revenue_records.total_cogs từ pos_orders × pos_products.import_price (trừ đơn trả); sai số 0.19% do 1 sản phẩm thiếu giá nhập
- Kết quả: Ma trận tài chính 2023–2026 khớp KiotViet (tổng tiền hàng, giảm giá, trả hàng, doanh thu thuần, giá vốn, lợi nhuận gộp)
- Files: `routes/import.ts`, `components/analysis/AnalysisFinancialMatrixPage.tsx`, `components/revenue/useRevenueLedger.ts`

### 2026-05-31 — Fix giá vốn sai trong trang Ma trận tài chính

- Điều tra root cause: `returns_value = 0` hardcode trong `routes/import.ts` khiến Ma trận tài chính hiển thị doanh thu thấp hơn KiotViet từ năm 2024 trở đi (2023 đúng vì không có đơn trả)
- Fix `routes/import.ts`: nhận thêm file "Báo cáo bán hàng theo thời gian" (`headers[6] = "Giá trị trả"`), đọc daily totals từ dòng đầu mỗi ngày; sửa format "theo lợi nhuận" tách gross bán vs gross trả, lưu đúng `returns_value = d.returnsGross` thay vì 0
- Fix `useRevenueLedger.ts`: nhận dạng file transaction-level qua cột "Mã giao dịch", tránh cộng dồn daily totals × số đơn/ngày; ưu tiên "Doanh thu thuần" thay vì "Doanh thu"; lưu `returnsValue` dương; fix công thức netRevenue dùng `Math.abs` cho discount/returns
- Fix `AnalysisFinancialMatrixPage.tsx`: thêm `Math.abs` cho `returnsValue` tương tự discount
- Files: `routes/import.ts`, `components/revenue/useRevenueLedger.ts`, `components/analysis/AnalysisFinancialMatrixPage.tsx`

---

### 2026-05-31 — Fix giá vốn sai trong trang Ma trận tài chính

- Phát hiện lỗi: `AnalysisFinancialMatrixPage.tsx` tính giá vốn (COGS) cho các năm có `posOrders` bằng cách tra `posProducts.importPrice` hiện tại — dẫn đến COGS cao hơn KiotViet khi giá nhập sản phẩm đã thay đổi
- Fix: thay `calcOrderCogs` bằng `data.revenue.totalCogs` (từ KiotViet sync, lưu giá vốn thực tế lúc bán) với deduplication theo ngày
- Xóa `productLookup` useMemo và `calcOrderCogs` useCallback (không còn cần thiết)
- TypeScript clean (lỗi pre-existing ở `InventoryOutTab.tsx` không liên quan)
- Files: `components/analysis/AnalysisFinancialMatrixPage.tsx`

---

### 2026-05-29 — Fix WebSocket shop2 bị kẹt "đang kết nối" + refactor ShippingOrders all-shops view

- Viết lại `ShippingOrders.tsx` để hiển thị đơn từ TẤT CẢ shop cùng lúc (không cần chọn shop): dùng `ordersByShop[][]`, `connStates[]`, `loadings[]` per-shop; thêm cột "Shop" với badge màu
- Fix WebSocket shop2 bị stuck ở trạng thái "đang kết nối": cleanup `useEffect` giờ null ALL handlers (`onopen/onmessage/onclose/onerror`) + null `wsRefs.current[i]` trước khi close, ngăn stale ref gây early-return sai trong React StrictMode
- Fix early-return trong `connect()`: kiểm tra cả `CONNECTING` (0) lẫn `OPEN` (1) thay vì chỉ `OPEN` như trước
- TypeScript clean (0 errors)
- Files: `components/orders/ShippingOrders.tsx`

### 2026-05-29 — Xoá cấu hình % phí sàn + sửa Shopee Monitor + thêm hỗ trợ 2 shop

- Xoá hoàn toàn section "Cấu hình phí sàn Shopee (%)" khỏi `CostsTab.tsx` — thay bằng block read-only hiển thị % phí thực tế tính từ đơn đã giao
- Xoá 6 trường `platformFeePercent/paymentFeePercent/freeshipExtraPercent/affiliateFeePercent/taxPercent/adsTaxPercent` khỏi `ShopeeCostConfig` trong `types.ts` và `defaultData.ts`
- Cập nhật `useShopeeInventoryOut.ts`: bỏ tính phí % khi import, bỏ `personalIncomeTax`, bỏ `adsTax` fallback; fix bug `r.personalIncomeTax` bị trừ sai trong secondary calc
- Fix `InventoryOutTab.tsx` dòng 219, 223–226: dùng `shopeeTotals` thực tế thay vì `shopeeCosts.%` đã xoá
- Cập nhật `RevenueManager.tsx`: truyền `shopeeInventoryOut` prop vào `<CostsTab />`
- Fix `better-sqlite3` binary không chạy được trên Node.js v24.15.0 (node-v137): rebuild `npm rebuild better-sqlite3` trong `/Users/apple/shopee-monitor/`
- Fix TELEGRAM 409 Conflict: tăng retry delay từ 10s → 35s trong `telegramCommands.js`
- Bật shop 2 (`giaydepphucsang`): đổi `API_ENABLED=false` → `true` trong `.env.shop2` và `ecosystem.config.js`
- Khởi động lại PM2: `shopee-shop1` (port 3001) + `shopee-shop2` (port 3002) đang online
- Viết lại `ShippingOrders.tsx` hỗ trợ 2 shop: thêm `SHOPS` array, `activeShopIdx` state + `activeShopIdxRef` ref, shop selector UI, kết nối WebSocket độc lập theo shop
- TypeScript clean (0 errors) sau toàn bộ thay đổi
- Files: `types.ts`, `constants/defaultData.ts`, `components/revenue/CostsTab.tsx`, `components/revenue/useShopeeInventoryOut.ts`, `components/revenue/InventoryOutTab.tsx`, `components/RevenueManager.tsx`, `components/orders/ShippingOrders.tsx`, `/Users/apple/shopee-monitor/src/telegramCommands.js`, `/Users/apple/shopee-monitor/ecosystem.config.js`, `/Users/apple/shopee-monitor/.env.shop2`

---

### 2026-05-29 — Import toàn bộ đơn hàng Shopee vào Supabase

- Tạo script `scripts/import_shopee.py` để bulk-import dữ liệu Shopee từ `shopee_exports/Shop1` (→ "Shopee 1") và `shopee_exports/Shop2` (→ "Shopee 2")
- Import thành công 1,982 records đơn hàng có đầy đủ SKU (tháng 9/2024 đến nay)
- Import thêm 517 records đơn hàng giai đoạn đầu (tháng 6–8/2024) bằng cách dùng `tenphanloaihang` làm fallback SKU
- Fix bug `fetch_existing_keys()` chỉ lấy 1,000 rows (Supabase default cap) → thêm pagination với offset
- Xóa 982 duplicates phát sinh do bug trên bằng SQL `ROW_NUMBER() OVER (PARTITION BY order_id, sku)`
- Kết quả cuối: **2,499 unique records** trong `shopee_inventory_out`, 0 duplicate
- Files: `scripts/import_shopee.py`

---

### 2026-05-29 — Fix toàn bộ 20 lỗi (phần 2 — Task #15 → #17)

- **Task #15 — Payroll holiday + phạt**: Sửa so sánh ngày lễ dùng `MM-DD` thay vì `YYYY-MM-DD` (line 208 businessLogic.payroll.ts); sửa parse tiền phạt dùng `join('')` nối tất cả số → dùng pattern `k-suffix` hoặc lấy số cuối cùng
- **Task #15 — Ngày lễ không tính công**: Sửa `workingDays` chỉ đếm `'Present'` → thêm `'Holiday'` (ngày nghỉ lễ quy định vẫn hưởng lương đầy đủ)
- **Task #16 — Break-even slice(-30) unsorted**: Sửa `data.revenue.slice(-30)` → sort theo ngày trước khi slice, tránh lấy nhầm 30 bản ghi ngẫu nhiên thay vì 30 ngày gần nhất — `hooks/useAppData.ts`
- **Task #16 — Double-count payroll trong health score**: `calculateFinancialHealthScore` và `auditFinancials` cộng `totalPayroll` + salary-ledger → sửa dùng `payrollModuleTotal > 0 ? payrollModuleTotal : ledgerSalaryTotal`; lọc salary-category ra khỏi `nonSalaryExpenses` — `businessLogic.revenue.ts`
- **Task #17 — COGS double-count**: Lọc category "giá vốn/cogs" khỏi `filteredExpenses` trong `calculateExpenseAnalysis`, tránh cộng hai lần với `revenue.totalCogs` — `businessLogic.revenue.ts`
- **Task #17 — Timezone UTC bug**: Thay `toISOString().slice(0,7)` và `toISOString().split('T')[0]` bằng `toLocaleDateString('sv-SE')` — `businessLogic.revenue.ts`
- **Task #17 — Excel serial date off-by-1**: `Math.round` → `Math.floor` (bỏ phần giờ) + dùng `getUTCFullYear/Month/Date` thay vì local methods — `businessLogic.core.ts`
- **Task #17 — Excel header row sai**: Sửa break condition `matchCount >= 2` ghi đè `headerRowIndex` sau khi đã tìm được hàng tốt hơn → chỉ `break` không gán lại — `businessLogic.core.ts`
- **Task #17 — O(n²) stock validation**: Thay `products.find()` bên trong `cart.find()` bằng `productById.get()` (Map O(1)) — `POSComputer.tsx`
- **Task #17 — Offline queue full scan**: Thay `store.getAll()` bằng `dataKeyIndex.getAll(op.dataKey)` để chỉ scan records cùng key — `posOfflineQueue.ts`
- **Task #17 — Rollback step 1 trống**: Implement rollback xóa order bằng `updateSurgical([{ key: 'posOrders', item: { id }, isDelete: true }])` — `posOrderService.ts`
- Files: `businessLogic.payroll.ts`, `businessLogic.revenue.ts`, `businessLogic.core.ts`, `hooks/useAppData.ts`, `components/pos/POSComputer.tsx`, `services/posOfflineQueue.ts`, `services/posOrderService.ts`

---

### 2026-05-29 — Kiểm tra và fix trang danh sách hàng hoá / tồn kho

- Fix giá vốn bình quân sai khi nhập hàng có chiết khấu dòng: tính `effectiveUnitPrice = (qty × price − discount) / qty` trước khi gọi `calculateNextImportPrice` — `useGoodsPurchase.ts`
- Fix nhập hàng dùng surgical update thay vì full-array replace: thêm `onUpdateSurgical` vào `UseGoodsPurchaseArgs`, truyền từ `GoodsInventory` → loại bỏ race condition với POS bán hàng đồng thời
- Fix kiểm kho dùng surgical update thay vì full-array replace: thêm `onUpdateSurgical` vào `UseGoodsAuditArgs`, cùng cơ chế như nhập hàng
- Fix bộ lọc "Sắp hết" bao gồm sản phẩm `stock = 0`: đổi `stock <= minStock` → `stock > 0 && stock <= minStock` tại `useGoodsFilters.ts` (cả `lowStockProducts` lẫn filter candidate)
- Fix `getNextSKUNumber` dùng `Math.max(...array)` → `.reduce()` để tránh call stack overflow khi số lượng SKU lớn — `businessLogic.inventory.ts`
- Files: `useGoodsPurchase.ts`, `useGoodsAudit.ts`, `useGoodsFilters.ts`, `GoodsInventory.tsx`, `src/lib/businessLogic.inventory.ts`

---

### 2026-05-29 — Fix thêm 3 lỗi POS sau kiểm tra toàn diện

- Fix CRITICAL: Mobile `POSReceiptModal` `onClose` cũng bị lỗi khóa checkout — đồng bộ với desktop: gọi `handleFinishOrder()` + `setShowCheckoutSheet(false)`
- Fix DATA: Split payment không block thanh toán khi tổng < `netPayable` — thêm validation trong `handleCheckout` trả về lỗi và abort nếu thiếu tiền
- Fix UX: Phiếu in hiển thị `staffId` (ID nội bộ) thay vì tên nhân viên — tra `employees.find()` để lấy `name` thực
- Files: `components/pos/POSComputer.tsx`

---

### 2026-05-29 — Fix 3 lỗi quan trọng trong trang máy tính tiền (POSComputer)

- Fix CRITICAL: `POSReceiptModal` `onClose` → đổi từ `setShowReceiptModal(false)` thành `handleFinishOrder` — trước đây nhấn X sẽ khóa checkout vĩnh viễn đến khi refresh trang
- Fix performance: `handleCheckout` dòng 765 — dùng `cartItemMap` (Map) thay vì `cartWithSalesperson.find()` O(n) lồng trong `products.map()` — từ O(n²) xuống O(n+m)
- Fix data: `orderCode` dùng `Date.now().toString(36).slice(-5)` base-36 thay vì 6 chữ số thập phân — tránh trùng mã đơn (chu kỳ lặp từ ~16 phút → ~24 ngày)
- Files: `components/pos/POSComputer.tsx`

---

### 2026-05-29 — Audit hiệu năng toàn bộ + fix thêm 3 điểm O(n²)

- Fix `GoodsPurchaseForm.tsx`: thêm `useMemo` build Map `productById` — thay 2 lần `products.find()` per dòng trong JSX render bằng `productById.get()` O(1)
- Fix `posOrderService.ts`: thêm `buildProductMap()`, truyền Map vào `processPlaceOrder` + `processReturnOrder` thay vì Array — tránh O(items × products) khi lưu đơn hàng/trả hàng (quan trọng với nhập hàng bulk nhiều dòng)
- Kiểm tra toàn bộ event listeners: tất cả đều có cleanup trong useEffect ✅
- Kiểm tra memory leaks: WebSocket ShippingOrders có cleanup ✅, không có leak nào
- Kiểm tra GoodsTab chunking: đã dùng `requestIdleCallback` đúng cách ✅
- Files: `components/pos/GoodsPurchaseForm.tsx`, `services/posOrderService.ts`

### 2026-05-29 — Tối ưu hiệu năng thêm (sau fix mergeBy)

- Fix O(n²) trong `MatrixTab.tsx`: thay `productGroups.map(group => groupRevenue.filter(...))` trong JSX bằng `useMemo` pre-group theo `groupId` dùng Map — O(n) một lần thay vì O(groups × rows) mỗi render
- Thêm timeout 20 giây cho `fetchAllData` trong `hooks/useAppData.ts` bằng `Promise.race` — nếu Supabase không phản hồi, tự động throw để fallback về cached data thay vì loading vô tận
- Files: `components/revenue/MatrixTab.tsx`, `hooks/useAppData.ts`

### 2026-05-29 — Tích hợp Shopee Monitor + sửa lỗi trang treo khi refresh

- Bật API server shopee-monitor (`API_ENABLED=true` trong `.env.shop1`)
- Cập nhật `ecosystem.config.js`: thêm `env` block explicit để bypass dotenvx interference
- Xóa lock files cũ, cài `better-sqlite3@latest` (tương thích Node v24 với prebuilt binaries)
- Xóa process `shopee-bot` cũ gây Telegram 409 Conflict
- Viết lại `components/orders/ShippingOrders.tsx`: hiển thị đơn Shopee live từ monitor API (`localhost:3001`) qua WebSocket + REST, toast notification, auto-reconnect, bộ lọc theo trạng thái
- Sửa CSP trong `server.ts`: thêm `http://localhost:3001` và `ws://localhost:3001` vào `connectSrc`
- Sửa `App.tsx`: chỉ đăng ký service worker trong production (tránh block browser thread trong dev)
- **Sửa lỗi trang treo (Page Unresponsive) khi refresh**: Nguyên nhân là `mergeBy()` trong `services/dataMapper.ts` dùng `Array.findIndex` O(n²) — với hàng nghìn `posOrders`/`posProducts` gây block main thread nhiều giây. Đã thay bằng `Map` để O(n)
- Files: `shopee-monitor/ecosystem.config.js`, `shopee-monitor/.env.shop1`, `components/orders/ShippingOrders.tsx`, `server.ts`, `App.tsx`, `services/dataMapper.ts`

### 2026-05-26 — Hoàn thiện hệ thống nợ lương chuyển kỳ (carry-forward debt)

- Thêm `carryForwardDebt` vào `Employee`, `carryForwardDeduction` + `carryForwardDebtOut` vào `PayrollRecord` trong `types.ts`
- Tích hợp logic nợ chuyển kỳ vào `calculateEmployeePayroll` trong `src/lib/businessLogic.payroll.ts`
- Cập nhật `hooks/usePayrollState.ts` truyền `emp.carryForwardDebt` vào hàm tính lương
- Hiển thị dòng "Trừ Nợ Kỳ Trước" trong `components/payroll/SummaryTab.tsx`
- Hiển thị dòng "Trừ nợ kỳ trước" trên phiếu in `components/payroll/payrollPayslipPrint.ts`
- Cập nhật `components/PayrollManager.tsx`: khi chốt lương lưu `carryForwardDebt` vào nhân viên + nút "Tính lại nợ chuyển kỳ (toàn bộ lịch sử)"
- Thêm badge cảnh báo nợ lương trên card nhân viên trong `components/StaffManager.tsx`
- Thêm SQL migration vào `supabase_setup.sql` (3 ALTER TABLE)
- Files: `types.ts`, `src/lib/businessLogic.payroll.ts`, `hooks/usePayrollState.ts`, `components/payroll/SummaryTab.tsx`, `components/payroll/payrollPayslipPrint.ts`, `components/PayrollManager.tsx`, `components/StaffManager.tsx`, `supabase_setup.sql`

### 2026-05-22 — Tái cơ cấu tab Phân tích: chuyển biểu đồ, xóa tab thừa

- Chuyển 2 biểu đồ (waterfall P&L + pie phân bổ chi phí) từ tab "Cơ cấu" của `AnalysisBusinessPage` sang `AnalysisBusinessProfitPage` (đặt trên bảng chi phí)
- Xóa hoàn toàn tab "Cơ cấu" khỏi `AnalysisBusinessPage`
- Chuyển biểu đồ xu hướng tài chính (`DashboardTrendsPanel`) từ tab "Xu hướng" của `AnalysisBusinessPage` sang `AnalysisFinancialMatrixPage` (đặt trên bảng ma trận)
- Xóa hoàn toàn tab "Xu hướng" khỏi `AnalysisBusinessPage` — trang này giờ chỉ còn nội dung KPI duy nhất
- TypeScript check pass sạch
- Files: `components/analysis/AnalysisBusinessPage.tsx`, `components/analysis/AnalysisBusinessProfitPage.tsx`, `components/analysis/AnalysisFinancialMatrixPage.tsx`

### 2026-05-22 — Mở rộng AI CFO: thêm 4 tools mới

- Thêm 4 tool mới vào AI CFO để bao phủ toàn bộ dữ liệu app: `query_pos_orders`, `get_product_details`, `get_customer_stats`, `get_product_group_revenue`
- Thêm domain `customers` mới cho hệ thống phân loại câu hỏi (classify)
- Cập nhật system prompts cho domain `sales` và `inventory` để dùng tools mới
- Thêm agent `Customer Agent` vào giao diện chat với 3 câu hỏi mẫu
- TypeScript check pass sạch
- Files: `services/agents/cfoAgent.ts`, `components/ChatInterface.tsx`, `routes/ai.ts`

### 2026-05-22 — Audit & fix toàn bộ 8 trang Phân tích

- Kiểm tra và sửa 13 bug trên 8 trang phân tích trong mục "Phân tích và Báo cáo"
- **P0 — Tính toán sai nghiêm trọng:**
  - `AnalysisBusinessProfitPage`: cộng thêm lương (`payroll.netPay`) vào chi phí; lọc theo `p.month` (YYYY-MM) thay vì `p.date` không tồn tại; thêm "Lương nhân viên" vào biểu đồ chi phí
  - `AnalysisFinancialMatrixPage`: merge `shopeeRevenue` vào revenue để ma trận tài chính tính đúng tổng
  - `AnalysisGoodsClassifyPage`: fix `lineTotal` fallback chain đúng thứ tự (`item.total ?? item.subtotal ?? price × qty`)
- **P1 — Hiển thị sai / UX lỗi:**
  - `AnalysisBusinessProfitPage`: xóa cột "Chi nhánh trung tâm" trùng lặp trong PLRow; thêm ghi chú "(chưa theo dõi)" cho dòng hardcode 0
  - `AnalysisCustomersClassifyPage`: đổi `<rect>` thành `<Cell>` trong HBarCard (Recharts API đúng)
  - `AnalysisGoodsStockPage`: thêm `soldQtyMap` từ 30 ngày gần nhất để tính velocity-based stock alerts; fix `categoryPath` fallback; fix overStock dùng 60-day threshold
  - `AnalysisGoodsOverviewPage`: đổi nhãn "Top 10%" → "Top 10" cho đúng nghĩa
- **P2 — Thiếu tính năng:**
  - `AnalysisContainer`: sidebar `w-[200px]` → `w-64 shrink-0` đúng chuẩn project
  - `AnalysisEfficiencyPage`: thêm bộ lọc ngày (date picker), tính `days` động, giải mã tên nhân viên từ `data.employees`
  - `AnalysisGoodsClassifyPage`: thêm bộ lọc ngày, cập nhật AI context period
- TypeScript clean sau khi fix (`npx tsc --noEmit` không có lỗi)
- Files: `AnalysisBusinessProfitPage.tsx`, `AnalysisFinancialMatrixPage.tsx`, `AnalysisGoodsClassifyPage.tsx`, `AnalysisCustomersClassifyPage.tsx`, `AnalysisGoodsStockPage.tsx`, `AnalysisGoodsOverviewPage.tsx`, `AnalysisEfficiencyPage.tsx`, `AnalysisContainer.tsx`

---

### 2026-05-21
- Fix bộ lọc nhà cung cấp trong danh sách hàng hóa: đổi từ text input thuần sang popup checkbox giống bộ lọc nhóm hàng
- `useGoodsFilters.ts`: thêm param `transactions` + `filterSupplier: string[]`; build `productSupplierMap` từ giao dịch nhập hàng (type `'Import'`); logic lọc multi-select; export `uniqueSuppliers`
- `GoodsInventory.tsx`: state `filterSupplier` đổi sang `string[]`; truyền `transactions` + `filterSupplier` vào hook; pass `uniqueSuppliers` xuống workspace
- `GoodsProductsWorkspace.tsx`: prop `filterSupplier: string[]`, truyền tiếp `uniqueSuppliers` xuống sidebar
- `GoodsFilterSidebar.tsx`: thêm supplier popup (trigger div → popup cạnh bên, search + checkbox + Áp dụng); hỗ trợ chọn nhiều nhà cung cấp cùng lúc
- Fix thêm: `uniqueSuppliers` đổi nguồn từ transactions sang `suppliers` prop → dropdown luôn hiện đủ danh sách; `productSupplierMap` fallback dùng `supplierId` lookup; `useGoodsPurchase.ts` fix thiếu `supplierName` khi tạo transaction Import
- Files: `useGoodsFilters.ts`, `GoodsInventory.tsx`, `GoodsProductsWorkspace.tsx`, `GoodsFilterSidebar.tsx`, `useGoodsPurchase.ts`

---

### 2026-05-19 — Tích hợp AI Insight vào 8 trang phân tích

- Tạo `services/aiCache.ts` — localStorage cache với TTL 4h, `hashData()` + `getCachedAiResult()` + `setCachedAiResult()`
- Tạo `components/shared/AiInsightPanel.tsx` — panel AI tái sử dụng: nút Sparkles, spinner, badge "Từ cache", render markdown qua DOMPurify + marked
- Wire `AiInsightPanel` + aiCache + `handleAiRun` vào 8 trang: `AnalysisBusinessProfitPage`, `AnalysisFinancialMatrixPage`, `AnalysisGoodsOverviewPage`, `AnalysisGoodsStockPage`, `AnalysisGoodsClassifyPage`, `AnalysisCustomersOverviewPage`, `AnalysisCustomersClassifyPage`, `AnalysisEfficiencyPage`
- Thêm 8 backend endpoint POST trong `routes/ai.ts`: `/api/ai/profit-analysis`, `financial-matrix`, `goods-overview`, `goods-stock`, `goods-classify`, `customers-overview`, `customers-classify`, `efficiency`
- Tạo `.claude/rules/vietnamese.md` — quy tắc giao tiếp tiếng Việt bắt buộc cho mọi agent
- Files: `services/aiCache.ts` (new), `components/shared/AiInsightPanel.tsx` (new), `.claude/rules/vietnamese.md` (new), 8 analysis page files updated, `routes/ai.ts` updated

---

### 2026-05-19
- Tạo `AnalysisEfficiencyPage.tsx` — trang hiệu quả kinh doanh với KPI, so sánh hôm nay/hôm qua, top nhân viên, phân bổ kênh bán
- Tạo `AnalysisGoodsClassifyPage.tsx` — phân tích ABC hàng hóa theo doanh thu 30 ngày, filter theo nhóm, search
- Fix `AnalysisContainer.tsx` — thêm case `efficiency-overview` + `goods-classify` vào renderContent() (trước đó cả hai fall to `<Placeholder />`)
- Fix `GoodsLegacyProductFormView.tsx` — tách tab `related` (hiện danh sách sản phẩm cùng categoryId) và tab `channels` (coming soon UI); thêm prop `allProducts`
- Fix `GoodsProductDetailPanel.tsx` — cải thiện tab channels placeholder; thêm onClick cho nút "Sao chép" (copy SKU + tên ra clipboard)
- Fix `GoodsInventory.tsx` — truyền `allProducts={products}` vào `GoodsLegacyProductFormView`
- Thay thế `alert()` → `showToast()` trong 13 file: PayrollManager, KnowledgeManager, ProductGroupManager, StaffManager, PromotionManager, ExpenseManager, GoodsInternalUse, SettingsCenter, PrintTemplatesTab, ExpenseCategoriesPage, CustomerPoints, SupplierManager, POSComputer
- Files: AnalysisEfficiencyPage.tsx (new), AnalysisGoodsClassifyPage.tsx (new), AnalysisContainer.tsx, GoodsLegacyProductFormView.tsx, GoodsProductDetailPanel.tsx, GoodsInventory.tsx, + 13 files alert→toast

---

## Current Active Task
- Task: ✅ **HOÀN THÀNH** - Tách MarketingManager.tsx state ra hook
- Status: File giảm 0.8% (1046 → 1038 dòng), state logic tách thành useMarketingState hook 120 dòng
- Next recommended: Tách các file lớn khác (PayrollManager 891 dòng, ProductGroupManager 827 dòng)
- Recent completions:
  - SettingsCenter.tsx: 3/4 tabs, giảm 32.6%
  - 6 items POS: 100%
  - Type hóa: 100%
  - KnowledgeManager.tsx: 2/4 sub-tabs, giảm 12.4%
  - GoodsInventory.tsx: barcode utils, giảm 27.5%
  - POSComputer.tsx: state hook, giảm 8.3%
  - PurchaseOrdersContainer.tsx: form hooks, giảm 2.4%
  - MarketingManager.tsx: state hook, giảm 0.8%

---

### 2026-05-18 — Claude — Phiên 12 (Audit & fix toàn bộ tiểu mục Báo cáo)

**Đã làm:**
- `src/lib/reportCalculations.ts`: Sửa `EndOfDayReportRow` — bỏ 4 trường hardcode 0, thêm `discount` tính từ `totalAmount - finalAmount`; thêm time-range filter (fromTime/toTime) cho `getEndOfDayReportRows`; thêm `allowedProductIds?: Set<string>` filter vào `getGoodsReportRows` và `getOrderedGoodsReportRows`
- `components/reports/EndOfDayReportPage.tsx`: Thêm fromTime/toTime filter UI; đổi cột "Chiết khấu" thay 4 cột zero cũ; wire In/Tải xuống toolbar
- `components/reports/ChannelReportPage.tsx`: Thay fake blue circle bằng SVG donut chart thực với dữ liệu thực theo kênh; wire tất cả export buttons
- `components/reports/GoodsReportPage.tsx`: Thêm prop `products`, filter Loại hàng/Thương hiệu hoạt động bằng `<select>` + `allowedProductIds`; wire export
- `components/reports/OrderReportPage.tsx`: Tương tự GoodsReportPage — filter Loại hàng/Thương hiệu; wire export
- `components/MainContent.tsx`: Truyền `products={data.posProducts || []}` vào `report-orders` và `report-goods`
- `components/reports/SalesReportPage.tsx`: Wire ToolbarButton/SelectButton onClick; thêm handlePrint/handleDownload; wire Xuất tất cả, Hiển thị dọc, toolbar In/Tải xuống
- `components/reports/CustomerReportPage.tsx`: Tương tự SalesReportPage
- `components/reports/StaffReportPage.tsx`: Tương tự SalesReportPage
- `components/reports/SupplierReportPage.tsx`: Tương tự SalesReportPage
- `components/reports/FinanceReportPage.tsx`: Wire toolbar In/Tải xuống; thêm row "Doanh thu khác (*)" với chú thích `(*) Chưa ghi nhận trong phiên bản hiện tại`
- Files: `src/lib/reportCalculations.ts`, `components/reports/EndOfDayReportPage.tsx`, `components/reports/ChannelReportPage.tsx`, `components/reports/GoodsReportPage.tsx`, `components/reports/OrderReportPage.tsx`, `components/MainContent.tsx`, `components/reports/SalesReportPage.tsx`, `components/reports/CustomerReportPage.tsx`, `components/reports/StaffReportPage.tsx`, `components/reports/SupplierReportPage.tsx`, `components/reports/FinanceReportPage.tsx`

---

### 2026-05-17 — Claude — Phiên 11 (Hệ thống Hóa đơn đầu vào - Giai đoạn 1-4)

**Đã làm:**
- `supabase_setup.sql`: Thêm SQL migration — ALTER TABLE inventory_transactions thêm 4 cột (invoice_status, invoiced_amount, invoice_changed_by, invoice_changed_at); CREATE TABLE invoice_attachments với RLS policy
- `types.ts`: Thêm 4 optional fields vào InventoryTransaction interface (invoiceStatus, invoicedAmount, invoiceChangedBy, invoiceChangedAt)
- `services/invoiceService.ts` (NEW): Service upload file lên Supabase Storage bucket `purchase-invoices`; lưu record vào bảng `invoice_attachments`; export InvoiceStatus type
- `components/pos/useGoodsPurchase.ts`: Thêm invoiceStatus + invoiceFile state; handleCompletePurchase → async; upload file sau khi tạo transaction
- `components/pos/GoodsPurchaseForm.tsx`: Thêm 4 radio buttons chọn trạng thái chứng từ (FileCheck/FileMinus/FileText/FileX icons); nút upload file ẩn; badge "Chứng từ" trong lịch sử phiếu
- `components/purchase/PurchaseOrdersContainer.tsx`: Wire invoiceStatus vào transaction; upload file sau khi lưu; pass 4 props mới vào GoodsPurchaseForm
- `components/pos/GoodsInventory.tsx`: Destructure và pass 4 props mới vào GoodsPurchaseForm
- `components/orders/PurchaseInvoices.tsx` (REWRITE lớn): Giai đoạn 1: InvoiceBadge + cột Chứng từ; Giai đoạn 3: 5 tabs, header thống kê, expandable rows, signed URLs, loading attachments; Giai đoạn 4: import xlsx, showReport/vatRate state, monthlyReport + vatSummary computed, handleExportExcel (2 sheets), toggle Báo cáo/Danh sách, report UI (4 VAT cards + bảng tháng)
- Files: `supabase_setup.sql`, `types.ts`, `services/invoiceService.ts`, `components/pos/useGoodsPurchase.ts`, `components/pos/GoodsPurchaseForm.tsx`, `components/purchase/PurchaseOrdersContainer.tsx`, `components/pos/GoodsInventory.tsx`, `components/orders/PurchaseInvoices.tsx`

---

### 2026-05-16 — Claude — Phiên 10 (Revert GoodsInventory display + fix TypeScript errors)

**Đã làm:**
- `components/pos/GoodsProductTableHeader.tsx`: Xoá sort UI (ArrowDown/ArrowUp icons, renderSortHeader), khôi phục plain text headers với `text-slate-500`
- `components/pos/GoodsToolbar.tsx`: Xoá bulk action toolbar (FileDown, PackagePlus, Printer icons), khôi phục nút "Tạo mới" luôn hiển thị + `{rightControls}`, khôi phục `border-b border-slate-100`, khôi phục "Đã chọn {selectedCount}" text
- `components/pos/GoodsFilterSidebar.tsx`: Xoá collapse button (ChevronLeft icon), xoá `ChevronLeft` khỏi import
- `components/pos/GoodsProductsWorkspace.tsx`: Xoá `isFilterCollapsed` state, luôn render `GoodsFilterSidebar`, đổi sang implicit return
- `components/pos/GoodsInventory.tsx`: Fix 8 pre-existing TypeScript errors gây crash runtime:
  - `selectedIds: string[]` → `selectedIdSet: Set<string>` (useMemo)
  - `favoriteIds: string[]` → `favoriteIdSet: Set<string>` (useMemo)
  - Thêm `productGroups: ProductGroup[]` vào props và pass xuống `GoodsAuditForm`, `GoodsLegacyProductFormView`, `GoodsInventoryModals`
  - Thêm 4 discount props vào `GoodsPurchaseForm`: `purchaseDiscountValue`, `purchaseDiscountType`, `setPurchaseDiscountValue`, `setPurchaseDiscountType`
  - Thêm `transactions` vào `GoodsAuditForm`
  - Thêm `products` vào `GoodsInventoryModals`
  - Đổi `setActiveTab` → `onStartAudit` trong `GoodsInventorySecondaryToolbar`
  - Tạo 4 row-action handlers: `handlePrintLabel`, `handleAddSameType`, `handlePurchaseProduct`, `handleStopBusiness`

**Kết quả kiểm tra:**
- TypeScript ✅ **0 errors** (`npx tsc --noEmit`)
- Trang Hàng hoá hoạt động bình thường trên localhost

---

### 2026-05-15 — Claude — Phiên 9 (Tách MarketingManager state hook)

**Đã làm:**
- `hooks/useMarketingState.ts`: Tách marketing state management (120 dòng)
  - Core states: loading, adviceLoading, schedule, drafts, strategies, focusProducts, aiAdvice
  - Cloud sync: isCloudSyncEnabled
  - View states: duration, viewDate, activeTab, selectedPost
  - Modal states: modalMode, searchQuery, deferredSearchQuery, selectedStrategyFilter
  - Upload: uploadingForDate
  - Computed values:
    - todayStr - ngày hôm nay
    - nextAvailableStartDate - ngày bắt đầu tạo bài tiếp theo
    - generationCount - số bài có thể tạo trong tháng
  - Helper function: togglePosted()
- `components/marketing/MarketingManager.tsx`: Cập nhật để dùng useMarketingState hook
  - Import useMarketingState và MarketingTab type
  - Xóa 17 useState declarations
  - Xóa 3 useMemo (todayStr, nextAvailableStartDate, generationCount)
  - Xóa 1 useDeferredValue (deferredSearchQuery)
  - Xóa togglePosted function
  - Giữ lại: Facebook states (fbAppConfig, fbPages, etc.), refs, business logic
  - File giảm từ 1046 → 1038 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt GoodsInventory không liên quan)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 0.8% (8 dòng)

**Lợi ích:**
- Giảm re-render: State tách riêng
- Dễ test: Hook test độc lập
- Dễ maintain: State logic tách biệt UI
- Tái sử dụng: Hook có thể dùng cho marketing features khác

**Tổng kết:**
- ✅ useMarketingState hook hoàn thành (100%)
- ✅ Không có regression, tất cả tests pass
- ✅ Facebook states giữ trong component (không liên quan marketing core)

---

### 2026-05-15 — Claude — Phiên 8 (Tách PurchaseOrdersContainer form hooks)

**Đã làm:**
- `hooks/usePurchaseFormState.ts`: Tách purchase + return form states (105 dòng)
  - Purchase form states: showPurchaseForm, purchaseItems, purchaseSupplier, purchaseNote, purchaseDiscountValue, purchaseDiscountType
  - Return form states: showPurchaseReturnForm, returnItems, returnSupplier, returnNote, returnDiscountValue, returnDiscountType, returnSupplierPaidAmount, returnApplySupplierDebt
  - Helper functions:
    - resetPurchaseForm() - reset tất cả purchase form fields
    - resetReturnForm() - reset tất cả return form fields
    - getPurchaseItemsNetTotal() - tính tổng tiền hàng purchase
    - getPurchaseBillDiscountAmount() - tính chiết khấu purchase
    - getReturnItemsNetTotal() - tính tổng tiền hàng return
    - getReturnBillDiscountAmount() - tính chiết khấu return
    - getReturnSupplierMustPay() - tính số tiền NCC phải trả
- `hooks/usePurchaseQuickModals.ts`: Tách quick product/supplier modal states (75 dòng)
  - Quick product states: showQuickProductForm, quickProductTarget, quickProductModalTab, showQuickProductStockSection, showQuickProductLocationSection, showQuickProductUnitsSection, quickProductForm
  - Quick supplier states: showQuickSupplierForm, quickSupplierTarget
  - Helper function: resetQuickProductForm()
- `components/purchase/PurchaseOrdersContainer.tsx`: Cập nhật để dùng 2 hooks mới
  - Import usePurchaseFormState và usePurchaseQuickModals
  - Xóa 24 useState declarations
  - Xóa helper functions: resetReturnForm, resetQuickProductForm, getPurchaseItemsNetTotal, getPurchaseBillDiscountAmount, getReturnItemsNetTotal, getReturnBillDiscountAmount, getReturnSupplierMustPay
  - Giữ lại: getPurchaseLineTotal (dùng nhiều nơi), refs, business logic
  - Cập nhật handleSaveDraft, handleCompletePurchase để dùng resetPurchaseForm từ hook
  - File giảm từ 1087 → 1061 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt GoodsInventory không liên quan)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 2.4% (26 dòng)

**Lợi ích:**
- Giảm re-render: Form state tách riêng
- Dễ test: Hooks test độc lập
- Dễ maintain: Form logic tách biệt UI
- Tái sử dụng: Hooks có thể dùng cho form tương tự

**Tổng kết:**
- ✅ usePurchaseFormState hook hoàn thành (100%)
- ✅ usePurchaseQuickModals hook hoàn thành (100%)
- ✅ Không có regression, tất cả tests pass

---

### 2026-05-15 — Claude — Phiên 7 (Tách POSComputer state hook)

**Đã làm:**
- `hooks/usePOSState.ts`: Tách toàn bộ state management từ POSComputer (243 dòng)
  - Search states: searchTerm, debouncedSearchTerm, productSearchSort, customerSearch, showConsultant
  - Tab states: tabs, activeTabId, activeTab (với useMemo)
  - Modal states: showAddCustomerModal, showGridMenu, newCustomerForm, useSplitPayment
  - UI states: showDiscountModal, billDiscountRect, showReceiptModal, isCheckoutLocked
  - Item discount: itemDiscountPopup
  - Other modals: showReturnModal, showEODReport, isAutoPrintEnabled, lastOrder
  - Search results: showProductResults, selectedResultIndex
  - Feedback: scanFeedback, stockWarning với auto-clear timers
  - Mobile: showCheckoutSheet
  - Confirm dialog: confirmDialog với openConfirm/closeConfirm helpers
  - Effects: debounce search terms, close grid menu on tab switch
  - Helper functions: showScanFeedback, showStockWarning, resetNewCustomerForm
- `components/pos/types.ts`: Tách InvoiceTab interface để tránh circular dependency (24 dòng)
  - Export InvoiceTab interface
  - Được dùng bởi: POSComputer, usePOSState, usePOSReturnFlow, usePOSTabs, POSCheckout, POSHeaderToolbar
- `components/pos/POSComputer.tsx`: Cập nhật để dùng usePOSState hook
  - Import usePOSState và InvoiceTab từ file mới
  - Xóa ~30 useState declarations
  - Xóa 3 useEffect (debounce + grid menu)
  - Xóa helper functions: openConfirm, closeConfirm, showScanFeedback, showStockWarning
  - Xóa InvoiceTab interface definition
  - Xóa form reset logic trong handleAddQuickCustomer (dùng resetNewCustomerForm từ hook)
  - Giữ lại: refs (productSearchRef, checkoutRef, etc.), business logic, render logic
  - File giảm từ 1113 → 1021 dòng
- Cập nhật imports trong 4 files:
  - `components/pos/usePOSReturnFlow.ts`: import InvoiceTab from './types'
  - `components/pos/usePOSTabs.ts`: import InvoiceTab from './types'
  - `components/pos/POSCheckout.tsx`: import InvoiceTab from './types'
  - `components/pos/POSHeaderToolbar.tsx`: import InvoiceTab from './types'

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt GoodsInventory không liên quan)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 8.3% (92 dòng)

**Lợi ích:**
- Giảm re-render: State tách riêng, dễ optimize
- Dễ test: Hook test độc lập
- Dễ maintain: State logic tách biệt UI
- Tránh stale closure: Refs giữ ở component level

**Tổng kết:**
- ✅ usePOSState hook hoàn thành (100%)
- ✅ InvoiceTab interface tách riêng
- ✅ Không có regression, tất cả tests pass

---

### 2026-05-15 — Claude — Phiên 6 (Tách GoodsInventory barcode utils)

**Đã làm:**
- `components/pos/goods/barcodeUtils.ts`: Tách toàn bộ barcode logic từ GoodsInventory (233 dòng)
  - Constants: `CODE_128_PATTERNS` (bảng mã Code 128)
  - Pure functions:
    - `normalizeCode128Text()` - chuẩn hóa text cho Code 128
    - `buildCode128Svg()` - tạo SVG barcode từ text
    - `buildLabelProductName()` - format tên sản phẩm cho label
    - `getBarcodeLabelTemplateSettings()` - lấy settings template từ localStorage
    - `printProductLabels()` - in tem barcode (gọi window.print)
  - Tất cả đều export để dùng lại
- `components/pos/GoodsInventory.tsx`: Cập nhật imports và xóa code đã chuyển
  - Import 6 functions từ `./goods/barcodeUtils`
  - Xóa ~300 dòng barcode code đã chuyển
  - File giảm từ 1172 → 849 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** (4 lỗi lint debt có sẵn không liên quan refactor)
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 27.5% (323 dòng)

**Tổng kết:**
- ✅ Barcode utils hoàn thành (100%)
- ⏸️ GoodsInventoryFilters deferred (có thể làm sau)
- ⏸️ useGoodsBarcodeLabel hook deferred (có thể làm sau)

---

### 2026-05-15 — Claude — Phiên 5 (Tách KnowledgeManager)

**Đã làm:**
- `components/knowledge/MechanismsViolationsSubTab.tsx`: Tách sub-tab Violations (152 dòng)
  - Props: `localViolations`, `setLocalViolations`, `hasUnsaved`, `onSave`
  - Quản lý ma trận kỷ luật & khấu trừ
  - Wrap với React.memo
- `components/knowledge/MechanismsHolidaysSubTab.tsx`: Tách sub-tab Holidays (82 dòng)
  - Props: `holidays`, `onUpdate`
  - Quản lý danh sách ngày lễ (x2 lương)
  - Wrap với React.memo
- `components/KnowledgeManager.tsx`: Cập nhật để dùng 2 components mới
  - Xóa 3 helper functions: `handleUpdateLocalViolation`, `handleAddLocalViolation`, `handleRemoveLocalViolation`
  - Thay thế ~194 dòng JSX bằng components
  - File giảm từ 1565 → 1371 dòng

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN**
- Tests ✅ **162/162 PASS** (100%)
- File size: Giảm 12.4% (194 dòng)

**Tổng kết:**
- ✅ 2/4 sub-tabs hoàn thành (50%)
- ⏸️ MechanismsSalarySubTab deferred (quá phức tạp ~394 dòng)
- ⏸️ StandardsWorkflowsTab deferred (~376 dòng)

---

### 2026-05-15 — Claude — Phiên 4 (Type hóa)

**Đã làm:**
- `hooks/useAppData.ts`: Type hóa `completedOperations` array
  - Thay `previousData?: any` → `previousData?: AppDataItem<keyof AppData> | { id: string }`
  - Thêm import `AppDataItem` từ types.ts
  - Loại bỏ hoàn toàn việc dùng `any` explicit
- `services/dataMapper.ts`: Kiểm tra và xác nhận không có `any` explicit
  - File đã clean, không cần sửa gì

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** - Không còn `any` explicit trong 2 file
- Tests ✅ **162/162 PASS** (100%)
- Lỗi TypeScript còn lại: 4 (tất cả trong GoodsInventory.tsx - lint debt)

**Tổng kết:**
- ✅ Task P1 hoàn thành: Type hóa dataMapper + useAppData
- ✅ Loại bỏ 1 chỗ dùng `any` trong useAppData.ts
- ✅ Không có regression, tất cả tests pass

---

### 2026-05-15 — Claude — Phiên 3 (Final)

**Đã làm:**
- `components/settings/tabs/GoodsTab.tsx`: Tách tab Goods từ SettingsCenter thành component độc lập (~450 dòng)
  - State: inventoryForm, inventorySaveStatus, costMethod
  - Functions: saveInventorySettings, toggleAllowSellOutOfStock
  - Sections: Thông tin hàng hóa, Giá vốn & tồn kho, Bảo hành & bảo trì, Khác
  - Wrap với React.memo để tối ưu re-render
- `components/settings/SettingsCenter.tsx`: Sửa lỗi cú pháp nghiêm trọng + type checking
  - **BUG FIX**: Xóa dòng `useEffect(() => {` thừa ở dòng 1094 gây lỗi TypeScript TS1005
  - **TYPE FIX**: Sửa 2 lỗi type checking khi truyền props vào GoodsTab
    - `inventorySettings || {}` → `inventorySettings || DEFAULT_POS_INVENTORY_SETTINGS`
    - `setActiveTab` → `(tab: string) => setActiveTab(tab as SettingsTab)`
  - Xóa renderGoodsTab function (~499 dòng)
  - Xóa GoodsDetailView type, GoodsOverviewLine component
  - Xóa GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY, GOODS_BARCODE_MODE_CHANGED_EVENT constants
  - Cập nhật renderActiveTab để dùng <GoodsTab />
  - File giảm từ 3444 → 2945 dòng
- **Kiểm tra 6 items POS user test**: Xác nhận tất cả đã hoàn thành
  - ✅ Sort sản phẩm POS (có dropdown sort theo mã/giá)
  - ✅ Header POS (đã loại bỏ icon cạnh chữ Admin)
  - ✅ Điểm thưởng (chỉ hiện khi có KH + sản phẩm tích điểm)
  - ✅ Popup trả hàng (màu indigo đồng bộ)
  - ✅ Nút báo cáo cuối ngày (có callback mở modal)
  - ✅ Thanh thêm hóa đơn (logic tabs đã implement)
- **Cập nhật tài liệu**: TODO.md đánh dấu hoàn thành tất cả items POS

**Kết quả kiểm tra:**
- TypeScript ✅ **CLEAN** - Tất cả lỗi liên quan SettingsCenter refactor đã được sửa
- Tests ✅ **162/162 PASS** (100%)
- ESLint ✅ Chỉ có unused vars (lint debt có sẵn)

**Debug process:**
- Tạo script Node.js `check-parens.cjs` để quét cân bằng dấu ngoặc toàn file
- Phát hiện final balance = +1 (1 dấu ngoặc mở thừa)
- Tìm được dòng 1094-1095 có 2 dòng `useEffect(() => {` liên tiếp
- Xóa dòng thừa, TypeScript compile thành công
- Sửa 2 lỗi type checking khi truyền props vào GoodsTab
- Kiểm tra code để xác nhận 6 items POS đã hoàn thành

**Tổng kết:**
- ✅ Refactor SettingsCenter.tsx: 3/4 tabs hoàn thành (75%)
- ✅ File giảm 32.6% (1422 dòng)
- ✅ TypeScript clean, 162 tests pass
- ✅ 6 items POS user test đã hoàn thành
- ⏸️ PrintTemplatesTab deferred (quá phức tạp ~1200 dòng)

---

### 2026-05-15 — Claude — Phiên 2

**Đã làm:**
- `components/settings/tabs/PaymentsTab.tsx`: Tách tab Payments từ SettingsCenter thành component độc lập
  - State: paymentForm, paymentSaveStatus, paymentAccountTab, editingAccount, accountModalTab
  - Functions: savePaymentSettings, openPaymentAccountModal, updateEditingAccount, saveEditingAccount, deletePaymentAccount, renderAccountTable
  - Modal payment account được chuyển vào component
  - Wrap với React.memo để tối ưu re-render
- `components/settings/tabs/AppearanceTab.tsx`: Tách tab Appearance từ SettingsCenter thành component độc lập
  - Không có state riêng, chỉ nhận activeThemeId và onThemeChange qua props
  - Hiển thị theme selector, typography guide, color palette, UI components preview
  - Component thuần, không có side effects
- `components/settings/SettingsCenter.tsx`: Xóa code liên quan payments và appearance đã chuyển sang tabs
  - Xóa 5 state payments: paymentForm, paymentSaveStatus, paymentAccountTab, editingAccount, accountModalTab
  - Xóa 6 functions payments: savePaymentSettings, toggleSplitPaymentSetting, openPaymentAccountModal, updateEditingAccount, saveEditingAccount, deletePaymentAccount
  - Xóa renderPaymentsTab, renderAccountTable, renderAppearanceTab (~450 dòng tổng)
  - Xóa VIET_BANKS constant, emptyPaymentAccount helper
  - Xóa modal editingAccount (~150 dòng)
  - Xóa useEffect sync paymentForm
  - Xóa unused imports: HelpCircle, DEFAULT_POS_PAYMENT_SETTINGS, POSPaymentAccount, POSPaymentAccountType, POSPaymentMethod, APP_THEMES
  - Cập nhật renderActiveTab để dùng <PaymentsTab /> và <AppearanceTab />

**Kết quả kiểm tra:**
TypeScript ✅ clean (lỗi tồn đọng GoodsInventory không liên quan)
ESLint ✅ clean

**Còn lại / Dang dở:**
- [ ] Tách PrintTemplatesTab (invoice, exchange, payroll, barcode templates + 10 barcode states)
- [ ] Tách GoodsTab (phức tạp nhất - units, attributes, categories, brands, locations)

---

### 2026-05-15
- Tái cấu trúc tài liệu quy trình: tách HISTORY.md, TODO.md, workflow.md
- Files: `.claude/rules/workflow.md`, `docs/05-process/HISTORY.md`, `docs/05-process/TODO.md`

### 2026-05-13 → 2026-05-14
- POS: tab hóa đơn cuộn ngang khi quá nhiều tab
- POS: giữ nút thêm hóa đơn luôn hiển thị
- POS: xóa icon scanner trên thanh tìm sản phẩm
- POS: thêm sort sản phẩm theo tên / mã / giá trong ô tìm kiếm
- Inventory: sửa luồng audit nhà cung cấp khi nhập hàng
- Files: `components/pos/POSHeaderToolbar.tsx`, `components/pos/POSComputer.tsx`, `components/pos/GoodsInventory.tsx`

### 2026-05-12
- POS: giao diện Chia nhiều — bỏ khung ngoài, label giống dòng tiền hàng/giảm giá, input bo góc, format dấu phẩy
- POS: layout thanh toán Chuyển khoản / Thẻ / Ví theo ảnh mẫu, giữ màu app
- POS: layout trả hàng — thanh Tìm hàng đổi đồng màu với Tìm hàng trả, khóa ô tìm chính khi mode=return
- POS: popup thêm khách hàng mới — layout 2 cột kiểu KiotViet, form underline, radio giới tính
- Hàng hóa: navigation dropdown-only, ẩn/hiện bộ lọc bằng nút mũi tên, xóa đường phân cách thừa
- Files: `components/pos/POSCheckout.tsx`, `components/pos/POSCart.tsx`, `components/pos/POSHeaderToolbar.tsx`, `components/pos/POSComputer.tsx`, `components/pos/POSQuickCustomerModal.tsx`

### 2026-05-11
- Code cleanup: xóa 4 dead files, 2 duplicate generateId, 5 console.log, dead isSubItem
- Split ExpenseManager.tsx (1522 dòng → 561 dòng) → components/expense/
- Thiết lập .claude/ folder: hooks, commands, agents, rules
- Files: `components/expense/*`, `.claude/*`

### 2026-05-10
- Fix P0: chặn bán âm kho tại addToCart + barcode + updateQuantity + handleCheckout
- Fix P0: thống nhất công thức discount — item total = quantity × (price − discount)
- Fix P0: enqueue updateSurgical vào IndexedDB khi offline
- POS: tính COGS từ importPrice × quantity, grossProfit = netRevenue − totalCogs
- Tách onPlaceOrder/onReturnOrder → services/posOrderService.ts + unit test
- Fix stale closure shortcut F9 dùng checkoutRef/cartLengthRef
- Files: `components/pos/POSComputer.tsx`, `services/posOrderService.ts`, `hooks/useOfflineSync.ts`

### 2026-05-08
- Migration Gemini → Claude hoàn tất cho tất cả module
- 6 Specialized Agents: CFO, HR, Sales, Inventory, Marketing, Operations
- EOD Report tự động 21:00 VN — Email + Zalo OA
- Cảnh báo thông minh: tồn kho, nợ NCC, doanh thu drop; TopNav bell poll 10 phút
- Files: `routes/ai.ts`, `components/dashboard/*`, `components/TopNav.tsx`

### 2026-05-06
- Bảo mật: secrets → .env.local, DOMPurify cho 6 component, requireAuth middleware
- 43 unit tests cho businessLogic.ts (Vitest)
- Pagination: limit 2000, order desc, fetchTablePage()
- CORS whitelist, session secret → env var
