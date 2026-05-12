# HISTORY.md — Lịch sử làm việc & Kế hoạch tiếp theo

> ## ⚠️ BẮT BUỘC ĐỌC TRƯỚC KHI LÀM BẤT CỨ THỨ GÌ
>
> 1. Đọc section **TODO** để biết việc cần làm
> 2. Đọc **phiên gần nhất** để hiểu context
> 3. Sau khi xong việc → **cập nhật file này** (thêm phiên mới lên đầu, cập nhật TODO)

---

## Current Active Task

- Task: POS/Máy tính tiền — backlog chỉnh sửa sau khi user test
- Last completed: Đổi thanh tab hóa đơn sang scroll ngang thật với thanh trượt bên dưới để kéo về các hóa đơn cũ
- Next recommended: Tiếp tục mục `Header POS: loại bỏ icon cạnh chữ Admin, chỉ giữ icon grid`
- Files touched: `components/pos/POSHeaderToolbar.tsx`, `index.html`, `HISTORY.md`
- Notes:
  - Các mục cần giống KiotViet sẽ hỏi user từng phần để nhận ảnh/layout mẫu trước khi implement
  - Workflow trả hàng giữ nguyên: bấm icon trả hàng → popup chọn hóa đơn → Trả nhanh → vào layout trả hàng
  - Logic thật của các ô trong layout `Chuyển khoản` / `Thẻ` / `Ví` sẽ làm sau khi có trang cài đặt số tài khoản/phương thức thanh toán
  - Các mục không cần layout mẫu có thể làm xen kẽ nếu không chặn UI mẫu
  - Không đổi schema DB, không đổi nghiệp vụ tài chính/lương

---

## 📋 TODO — Việc đang chờ làm

### 🔴 Ưu tiên cao
- [ ] **POS/Máy tính tiền — chỉnh sửa sau khi user test**
  - [x] ~~**Thêm khách hàng mới giống KiotViet**~~ *(xong 2026-05-12)*: thiết kế lại layout popup/modal thêm khách hàng mới
  - [x] ~~**Layout trả hàng giống KiotViet**~~ *(xong 2026-05-12)*: tô màu thanh tìm hàng đổi giống thanh tìm hàng trả; ô tìm kiếm màu trắng nổi bật; khóa/không cho tìm trong ô tìm hàng hóa ở thanh hóa đơn khi đang trả hàng
  - [x] ~~**Layout thanh toán Chuyển tiền / Thẻ / Ví giống KiotViet**~~ *(xong 2026-05-12)*: tiền mặt giữ layout gợi ý tiền; Chuyển khoản / Thẻ / Ví dùng cùng layout QR/tài khoản ban đầu theo ảnh mẫu và vẫn giữ màu app hiện tại
  - [x] ~~**Giao diện Chia nhiều**~~ *(xong 2026-05-12)*: xóa bỏ khung ngoài và thiết kế lại UI split payment
  - [x] ~~**Logic tìm kiếm/sắp xếp POS**~~ *(xong 2026-05-12)*: thêm icon trong ô tìm kiếm, dropdown chọn sort kết quả theo mã hàng hoặc giá tiền cao → thấp
  - [ ] **Header POS:** loại bỏ icon cạnh chữ Admin, chỉ giữ icon grid
  - [x] ~~**Chia nhiều — format tiền**~~ *(xong 2026-05-12)*: số tiền khách nhập hiển thị theo dấu phân cách hàng nghìn để dễ đọc
  - [ ] **Điểm thưởng trong nút thanh toán:** chỉ hiển thị khi có khách hàng và trong giỏ có sản phẩm được thiết lập tích điểm; nếu không thì ẩn dòng điểm thưởng
  - [ ] **Popup chọn hóa đơn trả hàng:** đồng bộ màu khi đang dùng theme Codex
  - [ ] **Nút Xem báo cáo cuối ngày:** sửa lỗi bấm không phản hồi, mở đúng trang/report đã có
  - [x] ~~**Thanh thêm hóa đơn**~~ *(xong 2026-05-12)*: mở rộng tab hóa đơn đến hết khu vực giỏ hàng; khi quá chỗ vẫn giữ nút `+`, hiển thị số hóa đơn bị ẩn trên nút `+`
  - [ ] Chạy `npx tsc --noEmit`, scoped ESLint, `npm test`, `npm run lint`

### 🟠 Ưu tiên trung bình
- [ ] **Type hóa `services/dataMapper.ts` + `hooks/useAppData.ts`** để giảm phần lớn 110 warning `any` còn lại

### 🔵 Ưu tiên thấp / Phase tiếp theo
- [ ] **Tách `MarketingManager.tsx` (1009L), `ProductGroupManager.tsx` (920L), `PromotionManager.tsx` (875L)** — ưu tiên thấp hơn Dashboard/Payroll/Revenue nhưng nên làm dần
  - [ ] Optional: tách UI sâu thêm thành component/settings/calendar/facebook/import/audit/matrix/ledger panels nếu muốn giảm kích thước file
- [ ] **POS: Split Payment UI** (chờ hình mẫu từ user) *(blocked)*
- [ ] **POS: Return Layout Redesign** (chờ hình mẫu từ user) *(blocked)*
- [ ] **POS: CRM Customer Modal 2 cột** (chờ hình mẫu từ user) *(blocked)*

### ⏸️ Tạm hoãn — chưa có đủ điều kiện để làm
- [ ] **POS: Logic dữ liệu cho layout Chuyển khoản / Thẻ / Ví** — chờ thiết kế trang cài đặt số tài khoản/phương thức thanh toán; sau đó mới nối dropdown tài khoản, QR, thông tin thẻ/ví và trạng thái nhận tiền thật vào layout hiện có
- [ ] **Multi-tenant / Đa chi nhánh** — cần quyết định UX chọn chi nhánh và rollout migration `branch_id`; SQL có sẵn trong `supabase_setup.sql` nhưng chưa bật filter vì DB chưa chạy migration trên tất cả môi trường
- [ ] **Tích hợp TikTok Shop / Lazada** — cần API credentials + spec mapping đơn hàng/sản phẩm/phí
- [ ] **Tích hợp GHN / GHTK** — cần API token + quy trình vận đơn rõ ràng

### ✅ Đã hoàn thành — lưu để tham chiếu
- [x] ~~**POS: Thanh thêm hóa đơn mở rộng + ẩn tab tràn**~~ *(xong 2026-05-12)*
  - `POSHeaderToolbar.tsx`: vùng tab hóa đơn dùng phần không gian còn lại giữa ô tìm kiếm và cụm icon bên phải.
  - Nút `+` luôn hiển thị cố định sau vùng tab.
  - Vùng tab render toàn bộ hóa đơn trong thanh scroll ngang có scrollbar mỏng bên dưới, giúp người dùng kéo trái/phải để quay lại hóa đơn cũ.
- [x] ~~**POS: Logic tìm kiếm/sắp xếp sản phẩm**~~ *(xong 2026-05-12)*
  - `POSHeaderToolbar.tsx`: thêm icon sliders trong ô tìm kiếm hàng hóa, xóa icon scanner; bấm mở dropdown 2 lựa chọn `Theo mã hàng` và `Theo giá tiền`, đều cao → thấp.
  - `POSComputer.tsx`: kết quả tìm kiếm POS sort theo lựa chọn hiện tại; mặc định theo mã hàng cao → thấp.
- [x] ~~**POS: Giao diện Chia nhiều + format tiền**~~ *(xong 2026-05-12)*
  - Bỏ khung ngoài của block chia nhiều, chuyển sang các dòng phương thức thanh toán riêng.
  - Label `Tiền mặt` / `Chuyển khoản` / `Thẻ` / `Ví` dùng kiểu chữ/kích thước giống các dòng `Tiền hàng` / `Giảm giá` / `Phí khác`.
  - Input tiền và đơn vị `đ` nằm trong khung bo góc; số nhập hiển thị dấu phẩy hàng nghìn nhưng vẫn lưu state dạng number.
  - Tổng đã nhận, còn thiếu, tiền thừa giữ logic cũ.
- [x] ~~**POS: Layout thanh toán Chuyển khoản / Thẻ / Ví**~~ *(xong 2026-05-12)*
  - `Tiền mặt` giữ layout gợi ý tiền nhanh.
  - `Chuyển khoản`, `Thẻ`, `Ví` dùng cùng layout ban đầu theo ảnh mẫu: QR/tài khoản, nút hiển thị mã/thông tin thanh toán, link hỗ trợ bên phải.
  - Màu sắc giữ theo app hiện tại, không copy màu KiotViet.
- [x] ~~**POS: Layout trả hàng theo ảnh mẫu**~~ *(xong 2026-05-12)*
  - Giữ workflow cũ: icon trả hàng mở popup chọn hóa đơn, bấm `Trả nhanh` mới vào layout trả hàng.
  - `POSCart.tsx`: thanh `Tìm hàng đổi (F7)` dùng cùng style với `Tìm hàng trả (F3)`, input trắng nổi bật, không dùng màu KiotViet.
  - `POSHeaderToolbar.tsx`: khóa ô tìm hàng hóa chính khi `mode === 'return'`, tránh nhập nhầm khi đang trả/đổi hàng.
- [x] ~~**POS: Thêm khách hàng mới giống KiotViet**~~ *(xong 2026-05-12)*
  - Popup thêm khách hàng đổi sang layout rộng kiểu KiotViet: header trắng, tab `Thông tin chung`, avatar + nút chọn ảnh, form 2 cột underline, radio giới tính, footer `Bỏ qua`/`Lưu`.
  - `POSComputer.tsx` mở rộng form state và lưu được email/địa chỉ/ghi chú vào `POSCustomer` hiện có.
- [x] ~~**Trang danh sách hàng hóa — chỉnh sửa sau khi user test**~~ *(xong 2026-05-12)*
  - [x] Navigation dropdown-only: bấm tiêu đề chỉ mở dropdown, chọn item mới điều hướng
  - [x] Ẩn/hiện block bộ lọc bằng nút mũi tên, giúp block danh sách hàng hóa mở rộng
  - [x] Xóa đường phân cách thừa giữa thanh tìm kiếm và thanh tiêu đề trong block danh sách
  - [x] Filter thuộc tính theo từng tên thuộc tính, mỗi tên mở popup giá trị riêng
  - [x] Mã hàng mặc định sắp xếp cao → thấp
  - [x] Sort `Giá bán`, `Giá vốn`, `Tồn kho` theo click header: lần 1 cao → thấp, lần 2 thấp → cao
- [x] ~~**Goods selection toolbar + bulk actions theo ảnh mẫu**~~ *(xong 2026-05-12)*
  - Toolbar selected mode nằm trực tiếp trên `GoodsToolbar`, không còn floating bulk bar.
  - Export selected dùng chung helper Excel, in tem mã hỏi số lượng tem, nhập hàng prefill phiếu nhập.
- [x] ~~**Re-import file KiotViet** sau khi fix `related_sku` — cần chạy để 12739 sản phẩm có đủ `parent_id`/`is_parent`/`variant_count` → danh sách hiển thị cha-con mới đúng~~ *(xong 2026-05-12)*
- [x] ~~**Chạy SQL Knowledge Storage trên Supabase Dashboard**~~ *(xong 2026-05-12)*
  - Block "Knowledge Base original files (2026-05-12)" trong `supabase_setup.sql`
  - Tạo bucket `knowledge-files`, policy storage, và các cột `source_file_*` cho bảng `knowledge_base`
- [x] ~~**Chạy SQL atomic stock RPC trên Supabase Dashboard**~~ *(xong 2026-05-11)*
  - Function `decrement_product_stock` + `increment_product_stock` đã active trên Supabase
- [x] ~~**Tách `Dashboard.tsx` (1201L)** — chứa nhiều widget độc lập, tách dễ nhất, lợi nhất~~ *(xong 2026-05-11)*
  - [x] Tách `components/dashboard/DashboardKpiOverview.tsx` — KPI cards + P&L summary + DailyBreakEven *(xong 2026-05-11)*
  - [x] Tách `DashboardTrendsPanel` *(xong 2026-05-11)*
  - [x] Tách `DashboardStructurePanel` *(xong 2026-05-11)*
  - [x] Tách `DashboardAiAdvisor` *(xong 2026-05-11)*
  - [x] Tách `DashboardEodBanner` *(xong 2026-05-11)*
- [x] ~~**Tách `PayrollManager.tsx` (1096L → 890L)** — logic lương phức tạp, nhiều tab, dễ bug khi file lớn~~ *(xong 2026-05-11)*
  - [x] Tách `components/payroll/PayrollToolbar.tsx` — tab navigation, chọn tháng, export Excel, toggle nhân sự cũ *(xong 2026-05-11)*
  - [x] Tách print preview / payslip UI *(xong 2026-05-11)*
  - [x] Tách HTML in phiếu lương khỏi `handleConfirmPrint` *(xong 2026-05-11)*
  - [x] Xác nhận settlement/resignation UI đã nằm trong `SummaryTab`; không cần tách thêm trong `PayrollManager.tsx` *(xong 2026-05-11)*
- [x] ~~**Hoàn thiện tách `RevenueManager.tsx` (1315L → ~340L)**~~ *(xong 2026-05-11)*
  - [x] Tách `components/revenue/RevenueSubTabNav.tsx` *(xong 2026-05-11)*
  - [x] Tách `components/revenue/RevenueAuditModal.tsx` *(xong 2026-05-11)*
  - [x] Tách `components/revenue/useRevenueLedger.ts` — ledger upload + conflict resolution *(xong 2026-05-11)*
  - [x] Tách `components/revenue/useShopeeInventoryOut.ts` — Shopee import/upload + cost config *(xong 2026-05-11)*
- [x] ~~**Tách `businessLogic.ts` (1498L) theo domain** — chia thành `businessLogic.payroll.ts`, `businessLogic.revenue.ts`, `businessLogic.inventory.ts` — không urgent vì đã test tốt~~ *(xong 2026-05-12)*
- [x] ~~**Fix schema `inventory_transactions` trên Supabase**~~ *(xong 2026-05-11)*
  - Đã thêm 4 cột còn thiếu: `date`, `items` (JSONB), `reference_id`, `staff_id`
  - Đã thêm index `idx_inventory_transactions_date`
  - Code `dataMapper.ts` và `apiService.ts` khớp hoàn toàn — không cần sửa code
- [x] ~~**Phase 3: Tối ưu re-render bảng hàng hóa**~~ *(xong 2026-05-11)*
  - `GoodsProductTableBody` wrap `React.memo` — bail out khi modal/toast/state khác thay đổi
  - `GoodsInventory`: 6 inline handlers → `useCallback` để giữ stable reference
  - Không dùng virtualization: đã paginate 50/trang, expandable rows + detail panels quá phức tạp để virtualize
- [x] ~~**Fix lag chuyển tab POS ↔ quản lý**~~ *(xong 2026-05-11)*
  - `usePOSKeyboard.ts`: `isActive` guard — tắt cả 2 window listeners khi POS hidden
  - `POSComputer.tsx`: nhận prop `isActive`, truyền vào `usePOSKeyboard`
  - `MainContent.tsx`: `visitedTabs` Set → lazy-mount lần đầu; sau đó `display: none` thay vì unmount
- [x] ~~**`KnowledgeBaseArticle.sourceFileData` → chuyển sang Supabase Storage**~~ *(code xong 2026-05-12)*
  - Bản ghi mới không lưu base64 trong DB; chỉ lưu file metadata + public URL
  - `sourceFileData` còn là legacy fallback cho dữ liệu cũ
- [x] ~~**Dual field `resigned_date` / `resignedDate` trong `Employee` type**~~ *(xong 2026-05-12)*
  - App-level thống nhất `resignedDate`; DB boundary vẫn map sang/từ cột `resigned_date`
- [x] ~~**Thêm ErrorBoundary bao quanh từng module lớn** — hiện chỉ có 1 ErrorBoundary global, nếu Dashboard/Payroll/Revenue crash sẽ kéo sập cả app. Bọc từng module riêng trong `components/ui/ErrorBoundary`~~ *(đã có trong `MainContent.tsx`, xác nhận 2026-05-12)*
- [x] ~~**Dọn cột thừa trong `inventory_transactions`** — đã drop 4 cột legacy (`product_id`, `quantity`, `previous_stock`, `new_stock`) trên Supabase~~ *(xong 2026-05-12)*
- [x] ~~**PromotionManager/MarketingManager/ProductGroupManager — lượt tối ưu đã xong**~~ *(xong 2026-05-12)*
  - [x] `PromotionManager.tsx`: tách AI panel, tab nav, ledger table sang `components/promotion/*`
  - [x] `MarketingManager.tsx` + `ProductGroupManager.tsx`: dọn ESLint error cơ học để full lint pass
  - [x] `MarketingManager.tsx`: tối ưu calendar/list bằng `Map`, `useDeferredValue`, `useTransition`
  - [x] `ProductGroupManager.tsx`: lazy compute theo active tab, tối ưu matrix aggregation bằng `Map`, `useTransition` khi đổi tab
- [x] ~~**Kiểm tra test coverage** — chạy `npx vitest run --coverage` để biết % coverage hiện tại, xác định module nào thiếu test (đặc biệt `businessLogic.ts` 1498L)~~ *(xong 2026-05-12: statements 20.57%, branches 13.15%, functions 14.65%, lines 21.89%)*
- [x] ~~**Giảm warning `any` / `console` lượt 1** — bỏ console thường, type hóa các route/server, shared update contracts, hooks/service nhỏ~~ *(xong 2026-05-12: 314 → 110 warnings, full gate pass)*

---

## 📅 Lịch sử phiên làm việc

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 51

**Đã làm:**
- `components/pos/POSHeaderToolbar.tsx`: bỏ cơ chế ẩn tab theo số lượng; render toàn bộ hóa đơn trong vùng scroll ngang để người dùng kéo trái/phải quay lại mọi hóa đơn, gồm `Hóa đơn 1`.
- `components/pos/POSHeaderToolbar.tsx`: giữ nút `+` cố định bên ngoài vùng scroll để luôn bấm thêm hóa đơn được.
- `index.html`: thêm style scrollbar mỏng riêng cho `.pos-invoice-tab-scroll`.
- `HISTORY.md`: cập nhật ghi chú cho thanh thêm hóa đơn.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; mục kế tiếp theo thứ tự là `Header POS: loại bỏ icon cạnh chữ Admin, chỉ giữ icon grid`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 50

**Đã làm:**
- `components/pos/POSHeaderToolbar.tsx`: đổi vùng tab hóa đơn sang layout chiếm toàn bộ khoảng trống giữa ô tìm kiếm và cụm icon bên phải; bỏ giới hạn `max-w-[500px]`.
- `components/pos/POSHeaderToolbar.tsx`: thêm đo chiều rộng vùng tab bằng `ResizeObserver`, chỉ render số tab vừa đủ quanh tab đang active; nút `+` luôn hiện và có badge số hóa đơn bị ẩn.
- `HISTORY.md`: đánh dấu xong mục `Thanh thêm hóa đơn`.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; mục kế tiếp theo thứ tự là `Header POS: loại bỏ icon cạnh chữ Admin, chỉ giữ icon grid`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 49

**Đã làm:**
- `components/pos/POSHeaderToolbar.tsx`: xóa icon scanner khỏi ô tìm kiếm hàng hóa POS, đưa icon sắp xếp về mép phải trong ô và giảm padding phải tương ứng.
- `HISTORY.md`: cập nhật ghi chú cho phần tìm kiếm/sắp xếp POS.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; mục kế tiếp theo thứ tự là `Header POS: loại bỏ icon cạnh chữ Admin, chỉ giữ icon grid`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 48

**Đã làm:**
- `components/pos/POSHeaderToolbar.tsx`: thêm icon sliders trong ô tìm kiếm hàng hóa POS; bấm icon mở dropdown 2 lựa chọn `Theo mã hàng` và `Theo giá tiền`, đều sắp xếp cao → thấp.
- `components/pos/POSComputer.tsx`: thêm state sort kết quả tìm kiếm POS; mặc định sort theo mã hàng cao → thấp, option giá tiền sort theo `salePrice` cao → thấp.
- `HISTORY.md`: đánh dấu xong mục `Logic tìm kiếm/sắp xếp POS`, cập nhật bước tiếp theo.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; mục kế tiếp theo thứ tự là `Header POS: loại bỏ icon cạnh chữ Admin, chỉ giữ icon grid`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 47

**Đã làm:**
- `components/pos/POSCheckout.tsx`: tinh chỉnh tiếp giao diện `Chia nhiều`; label phương thức thanh toán dùng kiểu chữ/kích thước giống `Tiền hàng` / `Giảm giá` / `Phí khác`, tiền và đơn vị `đ` nằm chung trong khung bo góc.
- `components/pos/POSCheckout.tsx`: đổi format riêng khu vực `Chia nhiều` sang dấu phẩy hàng nghìn.
- `HISTORY.md`: cập nhật ghi chú hoàn thành cho split payment.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; mục kế tiếp theo thứ tự là `Logic tìm kiếm/sắp xếp POS`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 46

**Đã làm:**
- `components/pos/POSCheckout.tsx`: thiết kế lại giao diện `Chia nhiều`, bỏ khung ngoài xám/border cũ; mỗi phương thức thanh toán thành một dòng riêng, input tiền hiển thị dấu phân cách hàng nghìn khi nhập.
- `HISTORY.md`: đánh dấu xong `Giao diện Chia nhiều` và `Chia nhiều — format tiền`, cập nhật bước tiếp theo là `Logic tìm kiếm/sắp xếp POS`.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; mục kế tiếp theo thứ tự là `Logic tìm kiếm/sắp xếp POS`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 45

**Đã làm:**
- `HISTORY.md`: thêm việc chờ cho logic dữ liệu của layout `Chuyển khoản` / `Thẻ` / `Ví`, phụ thuộc trang cài đặt số tài khoản/phương thức thanh toán sau này.

**Kết quả kiểm tra:**
TypeScript ⏸️ không cần chạy | Tests ⏸️ không cần chạy | ESLint ⏸️ không cần chạy

**Còn lại / Dang dở:**
- Chờ user thiết kế trang cài đặt số tài khoản/phương thức thanh toán trước khi nối logic thật cho các ô thanh toán không dùng tiền mặt.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 44

**Đã làm:**
- `components/pos/POSCheckout.tsx`: tách layout thanh toán theo phương thức; `Tiền mặt` chỉ còn layout gợi ý tiền nhanh, còn `Chuyển khoản` / `Thẻ` / `Ví` dùng chung panel QR/tài khoản theo ảnh mẫu ban đầu và giữ màu hệ thống hiện tại.
- `HISTORY.md`: đánh dấu xong mục layout thanh toán không dùng tiền mặt, cập nhật bước tiếp theo của backlog POS.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; mục cần làm kế tiếp theo thứ tự là `Giao diện Chia nhiều` hoặc các mục không cần layout mẫu như `Logic tìm kiếm/sắp xếp POS`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 43

**Đã làm:**
- `components/pos/POSHeaderToolbar.tsx`: thêm prop `mode`, khóa ô tìm hàng hóa chính khi đang ở chế độ trả hàng; ẩn dropdown kết quả và scanner button cũng chuyển sang trạng thái disabled.
- `components/pos/POSComputer.tsx`: truyền `mode` xuống `POSHeaderToolbar`.
- `components/pos/POSCart.tsx`: đổi thanh `Tìm hàng đổi (F7)` sang cùng style với thanh `Tìm hàng trả (F3)`, input nền trắng, icon màu app hiện tại; rút gọn ô ghi chú đơn hàng sát layout mẫu hơn.
- `HISTORY.md`: đánh dấu xong mục POS layout trả hàng, ghi rõ workflow trả hàng vẫn giữ nguyên.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; phần cần hỏi mẫu kế tiếp là `Layout thanh toán Chuyển tiền / Thẻ / Ví`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 42

**Đã làm:**
- `components/pos/POSQuickCustomerModal.tsx`: thiết kế lại modal thêm khách hàng theo ảnh mẫu KiotViet user gửi: header trắng, tab, avatar, form 2 cột underline, radio giới tính, nút `Bỏ qua`/`Lưu`.
- `components/pos/POSComputer.tsx`: mở rộng `QuickCustomerForm` state cho các field mới trong layout; khi lưu, map email/địa chỉ/ghi chú vào `POSCustomer`.
- `HISTORY.md`: đánh dấu xong mục POS `Thêm khách hàng mới giống KiotViet`, cập nhật bước tiếp theo là hỏi mẫu layout trả hàng.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- POS backlog còn các mục tiếp theo; phần cần hỏi mẫu kế tiếp là `Layout trả hàng giống KiotViet`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 41

**Đã làm:**
- `components/TopNav.tsx`: đổi hành vi bấm tiêu đề section thành chỉ mở/đóng dropdown; điều hướng chỉ xảy ra khi người dùng chọn item trong dropdown.
- `components/pos/GoodsProductsWorkspace.tsx`: thêm state ẩn/hiện filter sidebar và nút mở lại khi sidebar đã ẩn.
- `components/pos/GoodsFilterSidebar.tsx`: thêm nút thu gọn sidebar; đổi filter thuộc tính thành nhiều ô theo từng tên thuộc tính, mỗi ô mở popup giá trị riêng.
- `components/pos/GoodsToolbar.tsx`: bỏ border dưới của hàng search để xóa đường phân cách thừa trong block danh sách hàng hóa.
- `components/pos/useGoodsFilters.ts`: thêm sort mặc định theo mã hàng cao → thấp và sort theo `salePrice`, `importPrice`, `stock`.
- `components/pos/GoodsProductTableHeader.tsx`: thêm nút sort ở header `Giá bán`, `Giá vốn`, `Tồn kho`, click lần 1 cao → thấp, lần 2 thấp → cao.
- `components/pos/GoodsInventory.tsx`: giữ state sort, reset về trang 1 khi đổi sort và truyền sort xuống hook/header.
- `HISTORY.md`: cập nhật TODO và phiên làm việc.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 40

**Đã làm:**
- `components/pos/GoodsToolbar.tsx`: thêm selected mode vào toolbar chính với search + `Đã chọn N` + bỏ chọn + `Xuất file` / `In tem mã` / `Nhập hàng` / `...`.
- `components/pos/GoodsInventory.tsx`: thêm handler export selected, in tem mã hàng loạt có hỏi số lượng tem mỗi sản phẩm, và nhập hàng từ selected products.
- `components/pos/GoodsImportExport.tsx`: tách helper `toGoodsExportRows()` để export toàn bộ hoặc chỉ sản phẩm đã chọn dùng chung format.
- `components/pos/useGoodsPurchase.ts`: thêm `handleAddProductsToPurchase()` để prefill phiếu nhập từ nhiều sản phẩm, bỏ qua parent logic.
- `components/pos/GoodsProductsWorkspace.tsx`: truyền bulk action handlers xuống toolbar.
- `components/pos/GoodsBulkActions.tsx`: xóa floating bulk bar để tránh trùng UI với selected toolbar.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 109 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 39

**Đã làm:**
- `AGENTS.md`: thêm mục `Bước 5.5 — Scoped test bắt buộc sau mọi thay đổi`, yêu cầu agent tự chạy `npx tsc --noEmit` và scoped ESLint cho file vừa sửa sau mọi task có sửa code, kể cả UI nhỏ.
- `AGENTS.md`: quy định rõ khi nào phải chạy thêm `npm test`, khi nào chạy full gate, và cách báo nếu full repo lint fail vì nợ cũ.

**Kết quả kiểm tra:**
TypeScript ⏸️ không cần chạy | Tests ⏸️ không cần chạy | ESLint ⏸️ không cần chạy

**Còn lại / Dang dở:**
- Task chính `Goods selection toolbar + bulk actions theo ảnh mẫu` vẫn đang chờ implement.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 38

**Đã làm:**
- `HISTORY.md`: dọn mục TODO để phần việc đang chờ làm chỉ còn task chưa hoàn thành; chuyển toàn bộ việc đã xong xuống nhóm `Đã hoàn thành — lưu để tham chiếu` ở cuối TODO.
- `HISTORY.md`: đưa task `Goods selection toolbar + bulk actions theo ảnh mẫu` vào ưu tiên cao với checklist chi tiết để phiên sau tiếp tục.

**Kết quả kiểm tra:**
TypeScript ⏸️ không cần chạy | Tests ⏸️ không cần chạy | ESLint ⏸️ không cần chạy

**Còn lại / Dang dở:**
- Task chính `Goods selection toolbar + bulk actions theo ảnh mẫu` vẫn đang chờ implement.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 37

**Đã làm:**
- Đọc `HISTORY.md`, kiểm tra dirty worktree và các file liên quan tới hàng hóa: `GoodsToolbar`, `GoodsProductsWorkspace`, `GoodsInventory`, `useGoodsSelection`, `useGoodsPurchase`, `GoodsImportExport`, `GoodsProductTableHeader`, `GoodsBulkActions`.
- Chốt plan cho toolbar khi chọn sản phẩm và bulk actions theo ảnh mẫu.
- Xác nhận với user:
  - Scope: đủ chức năng.
  - In tem mã: hỏi số lượng tem mỗi sản phẩm.

**Kết quả kiểm tra:**
TypeScript ⏸️ chưa chạy | Tests ⏸️ chưa chạy | ESLint ⏸️ chưa chạy

**Còn lại / Dang dở:**
- [ ] Implement toolbar selected mode theo ảnh.
- [ ] Xuất file chỉ sản phẩm đã chọn.
- [ ] In tem mã hàng loạt, hỏi số lượng trước khi in.
- [ ] Nhập hàng từ sản phẩm đã chọn, prefill phiếu nhập.
- [ ] Bỏ/ẩn `GoodsBulkActions` floating bar để tránh trùng UI.
- [ ] Chạy `npx tsc --noEmit`, `npm test`, scoped ESLint, `npm run lint`.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 36

**Đã làm:**
- `components/pos/GoodsProductRow.tsx`: thêm nút ngôi sao cho `VariantRow` ở cùng cột favorite với sản phẩm cha; trạng thái active dùng cùng style `fill-amber-400 text-amber-400`.
- `components/pos/GoodsProductTableBody.tsx`: truyền `isFavorite` và `onToggleFavorite` xuống từng sản phẩm con để bật/tắt yêu thích bằng logic hiện có.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 35

**Đã làm:**
- `components/pos/GoodsProductTableBody.tsx`: bỏ cấu trúc nested table khi expand sản phẩm cha; render `ProductRow`, toàn bộ `VariantRow`, và dòng “Thêm hàng hóa cùng loại” trực tiếp trong cùng `<tbody>` của bảng chính. Nhờ đó các cột cha-con dùng chung table layout và vẫn thẳng hàng khi bật/tắt thêm cột.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 34

**Đã làm:**
- `components/pos/GoodsProductRow.tsx`: chỉnh riêng `VariantRow` để các trường mã hàng, tên hàng, giá bán và tồn kho của sản phẩm con không còn dùng `font-semibold`/`font-black`; giữ nguyên style các badge cảnh báo như `Hết`/`Sắp hết`.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 33

**Đã làm:**
- `components/MainContent.tsx`: sửa wrapper module hàng hóa từ chỉ có padding thành `h-full min-h-0 pt-4 md:pt-8 flex flex-col`, để chiều cao được truyền đúng xuống `GoodsInventory`; vùng bảng hàng hóa có thể scroll tới sát footer phân trang thay vì bị co theo nội dung/không chạm footer.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 32

**Đã làm:**
- `components/pos/GoodsFilterSidebar.tsx`: cố định sidebar bộ lọc theo chiều cao khung hàng hóa (`h-full min-h-0`) và cho phần nội dung bộ lọc dùng `overflow-y-auto overscroll-contain`, để kéo bộ lọc không kéo theo bảng hàng hóa.
- `components/pos/GoodsInventory.tsx`: đổi vùng bảng hàng hóa thành layout `flex-1 min-h-0 flex flex-col overflow-hidden`; chỉ vùng table bên trong dùng `overflow-auto overscroll-contain`, footer phân trang nằm ngoài vùng cuộn.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 31

**Đã làm:**
- `components/pos/GoodsInventory.tsx`: đổi page size danh sách hàng hóa từ hằng số 50 sang state có lưu localStorage (`goods_items_per_page`), mặc định 15 dòng; đổi page size sẽ reset về trang 1 và clamp trang hiện tại khi filter làm tổng trang giảm.
- `components/pos/GoodsPagination.tsx`: thêm footer kiểu KiotViet với chọn `15/30/50/100 dòng`, nút về đầu/trước/sau/cuối, số trang hiện tại và text `A - B trong X hàng hóa (Y mã hàng)`.
- `components/pos/useGoodsFilters.ts`: tách filtered candidates để tính thêm `sellableSkuCount` theo cùng filter, loại parent logic khỏi số `mã hàng` nhưng vẫn giữ phân trang theo top-level rows.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Ghi chú kỹ thuật:**
- `X hàng hóa` = số top-level rows sau filter (`filteredProducts.length`), gồm parent logic và sản phẩm đơn.
- `Y mã hàng` = số sản phẩm bán thật sau filter, không tính parent logic.
- Dev server hiện đang trả HTTP 200 tại `http://localhost:3000`.

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 30

**Đã làm:**
- `services/apiService.ts`: xác định nguyên nhân app chỉ thấy khoảng 1000 sản phẩm và không expand được child là do Supabase REST cap response ở 1000 rows dù code gọi `.limit(50000)`.
- `services/apiService.ts`: thêm helper `fetchAllRows()` dùng `.range()` phân trang 1000 dòng/lần và đổi `fetchAllData()` để nạp toàn bộ `pos_products` thay vì chỉ trang đầu.
- Xác minh bằng truy vấn phân trang: lấy đủ 14072 dòng `pos_products`; riêng `DÉP BẢN KIỂU NỮ 014301` có `variant_count=12` và `childCount=12` trong cùng dataset.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Ghi chú kỹ thuật:**
- Dữ liệu Supabase sau phiên 29 đã đúng; lỗi người dùng thấy là frontend chỉ nhận 1000 dòng nên parent có badge nhưng child nằm ngoài trang đầu không có trong state.
- Sau khi deploy/reload code mới, app phải hiển thị tổng khoảng 14072 sản phẩm trong state và expand parent-child đầy đủ.

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 29

**Đã làm:**
- `routes/import.ts`: sửa lại mô hình import biến thể KiotViet cho đúng nguyên tắc nghiệp vụ — không dùng một SKU thật làm parent nữa. Với mỗi nhóm `related_sku`, route tạo một record cha logic riêng bằng ID ổn định `pos-product-parent:<relatedSku>` và SKU nội bộ `__PARENT__<relatedSku>`; toàn bộ SKU thật trong nhóm, kể cả SKU gốc được KiotViet dùng làm liên kết, đều được gắn `parent_id` vào parent logic và `is_parent=false`.
- `routes/import.ts`: response import thêm `logicalParents` và `upserted` để debug số parent logic được tạo.
- `services/apiService.ts`: khi lưu parent app-level không có SKU, backend dùng SKU nội bộ `__PARENT__<id>` thay vì `null` vì DB thật đang có constraint `sku NOT NULL`.
- `services/dataMapper.ts`: map parent từ DB về app với `sku: ''`, nên UI/POS vẫn đúng rule "parent không có mã sản phẩm".
- `supabase_setup.sql`: cập nhật comment mô tả variant support cho đúng mô hình parent logic.
- Re-import `DanhSachSanPham_KV06052026-194714-029.xlsx` qua server port 3001: `{"total":12739,"logicalParents":1331,"upserted":14070,"imported":14070,"errors":0,"firstError":null}`.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Ghi chú kỹ thuật:**
- Xác minh Supabase sau import: `pos_products` tổng 14072 dòng, 1331 parent logic, 5225 child có `parent_id`.
- Sample xác minh: parent `DÉP REDLEO (39_43)` có `variant_count=3` và query child theo `parent_id` trả đúng 3 SKU con (`SP012024`, `SP012025`, `SP012026`); parent `DÉP KẸP NAM 1263` có `variant_count=10` và trả đúng 10 child.
- Lần import đầu trong phiên bị lỗi `sku NOT NULL` khi thử lưu parent `sku=null`; đã đổi sang SKU nội bộ `__PARENT__...` rồi re-import thành công.

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 28

**Đã làm:**
- `components/pos/GoodsProductRow.tsx`: dòng sản phẩm cha (`isParent` + `variantCount > 0`) không còn hiển thị mã sản phẩm trong cột SKU; hiển thị dấu `—` đúng theo rule parent chỉ là nhóm, SKU thuộc về sản phẩm con.
- `components/pos/POSComputer.tsx`: loại sản phẩm cha khỏi kết quả tìm kiếm POS và thêm guard `addToCart()` để parent không thể vào giỏ hàng dù còn SKU gốc trong DB từ import KiotViet.
- `components/pos/usePOSKeyboard.ts`: scanner barcode/USB không match sản phẩm cha, chỉ match sản phẩm bán trực tiếp.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Ghi chú kỹ thuật:**
- Không xóa SKU parent trong DB vì `pos_products.sku` đang có unique constraint; nếu set nhiều parent về chuỗi rỗng có thể gây lỗi dữ liệu khi upsert/sửa. Fix hiện tại coi parent là group ở UI/POS runtime, còn dữ liệu gốc vẫn giữ để mapping import ổn định.

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 27

**Đã làm:**
- `routes/import.ts`: bỏ fallback `name -> id` khi import KiotViet; file KiotViet có nhiều biến thể trùng tên nên fallback này làm nhiều SKU khác nhau bị gán cùng `id`, gây lỗi Supabase `ON CONFLICT DO UPDATE command cannot affect row a second time` và `duplicate key value violates unique constraint "pos_products_sku_key"`. ID hiện chỉ lấy theo SKU đã tồn tại hoặc hash ổn định từ SKU mới.
- Re-import `DanhSachSanPham_KV06052026-194714-029.xlsx` qua `POST /api/import/kiotviet-products`: lần chạy sau fix trả `{"total":12739,"imported":12739,"errors":0,"firstError":null}`.
- Xác minh Supabase: `pos_products` có 12741 dòng tổng, 1331 parent (`is_parent=true`), 3894 child có `parent_id`; tổng nhiều hơn file 2 dòng do DB có sẵn sản phẩm ngoài file import.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass (0 errors, 110 warnings `any` tồn đọng)

**Ghi chú kỹ thuật:**
- Dev server cảnh báo `SUPABASE_SERVICE_ROLE_KEY` chưa set nên fallback sang anon key, nhưng import/upsert và query xác minh vẫn thành công.
- `related_sku` vẫn chỉ dùng trong memory để build `parent_id`, sau đó bị xóa trước upsert như phiên 26.

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-12 — Claude (claude-sonnet-4-6) — Phiên 26

**Đã làm:**
- `routes/import.ts`: xóa `related_sku` khỏi payload **trước khi upsert** — đây là nguyên nhân gốc khiến 12000/12739 sản phẩm thất bại (cột không tồn tại trong DB, chỉ batch không có variant mới qua được); thêm `firstError: string|null` vào response JSON để frontend/network tab thấy lỗi thực từ Supabase khi debug
- `CLAUDE.md`: cập nhật section 6 với đầy đủ trạng thái phiên 24+25+26; ghi quyết định kỹ thuật và lý do; chuyển nhật ký phiên sang `HISTORY.md`

**Kết quả kiểm tra:**
TypeScript ✅ clean | 0 lỗi mới

**Ghi chú kỹ thuật:**
- Pattern import lỗi: batch 1 (0-299) + batch 2 (300-599) + batch cuối (12600-12738) thành công — đây là các batch không có sản phẩm biến thể (không có `related_sku`); batches 3-42 đều có variant → `related_sku` gây lỗi Supabase "column does not exist"
- `related_sku` chỉ cần để build `parent_id` trong memory; sau khi build xong thì delete trước upsert — không cần column riêng trong DB
- Display logic cha-con đã đúng hoàn toàn trong code; vấn đề duy nhất là thiếu data trong DB do import lỗi

**Còn lại / Dang dở:**
- User cần re-import file KiotViet (1 lần) để ghi đủ 12739 sản phẩm với `parent_id`/`is_parent`/`variant_count` → danh sách tự hiển thị cha-con sau khi reload
- Nếu vẫn còn lỗi: mở Network tab → POST `/api/import/kiotviet-products` → xem field `firstError` trong JSON response

---

### 2026-05-12 — Claude (claude-sonnet-4-6) — Phiên 25

**Đã làm:**
- `supabase_setup.sql`: thêm block "POS PRODUCTS VARIANT SUPPORT" — 3 cột mới: `variant_attributes JSONB`, `parent_id TEXT`, `is_parent BOOLEAN` *(cần chạy thủ công trên Supabase Dashboard)*
- `services/dataMapper.ts`: thêm helper `parseVariantAttrText()` — parse `"SIZE:43|MÀU:ĐỎ"` → `{ SIZE: "43", MÀU: "ĐỎ" }`; thêm mapping `variantAttributes` (ưu tiên DB → fallback parse từ `attributes_text`), `parentId`, `isParent`
- `routes/import.ts`: thêm helper `parseVariantAttrText()`; thêm `variant_attributes` vào record khi import; thêm pass build parent-child sau khi build xong toàn bộ records — dùng `related_sku` (cột 16 KiotViet) để set `parent_id` + `is_parent`; fix type `ImportedProductRecord` để chứa `Record<string,string>`
- `components/pos/GoodsFilterSidebar.tsx`: bỏ guard `Object.keys(attrValuesByName).length > 0` — section "Thuộc tính" luôn hiển thị trong sidebar

**Kết quả kiểm tra:**
TypeScript ✅ clean | ESLint ✅ 0 errors (42 warnings pre-existing trong dataMapper.ts)

**Còn lại / Dang dở:**
- Cần chạy SQL block "POS PRODUCTS VARIANT SUPPORT" trên Supabase Dashboard
- Sau đó re-import file KiotViet để `variant_attributes`, `parent_id`, `is_parent` được ghi vào DB
- Dữ liệu cũ đã có trong DB sẽ tự có `variantAttributes` qua parse fallback trong `dataMapper.ts` (không cần re-import mới có filter)

---

### 2026-05-12 — Claude (claude-sonnet-4-6) — Phiên 24

**Đã làm:**
- `components/pos/useGoodsFilters.ts`: thay `uniqueAttrTypes` (list tên kiểu) bằng `attrValuesByName` — dạng `Record<attrName, { values, counts }>`, tổng hợp từ `variantAttributes` (count từ variant) và `attributes[].values` (parent); đổi filter logic `matchAttr` từ `Object.keys` sang `Object.values` để lọc đúng theo giá trị
- `components/pos/GoodsFilterSidebar.tsx`: đổi prop `uniqueAttrTypes: string[]` → `attrValuesByName`; redesign attr popup nhóm theo tên thuộc tính (header uppercase + tracking-widest), từng value là checkbox + count; search filter theo value và group name; "Chọn tất cả" chọn tất cả values; trigger text đổi sang "X giá trị đã chọn"
- `components/pos/GoodsProductsWorkspace.tsx`: cập nhật interface + destructuring + JSX prop từ `uniqueAttrTypes` → `attrValuesByName`
- `components/pos/GoodsInventory.tsx`: cập nhật destructuring + JSX prop từ `uniqueAttrTypes` → `attrValuesByName`
- `HISTORY.md`: đánh dấu tạm hoãn 3 mục blocked, ghi phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | ESLint ✅ 0 error, 1 warning `any` pre-existing ở GoodsInventory:305

**Còn lại / Dang dở:**
Hoàn thành — không có việc dang dở

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 23

**Đã làm:**
- `eslint.config.js`: ignore `coverage/**` để không lint artifact coverage.
- `server.ts`, `routes/ai.ts`, `routes/facebook.ts`, `routes/import.ts`, `routes/notifications.ts`: bỏ log dev không cần thiết, đổi catch `any` sang `unknown`, type Express request/session/error; thêm `requireAuth` cho import KiotViet POST.
- `businessLogic.core.ts`, `businessLogic.revenue.ts`: type hóa parse Excel/CSV và health score callbacks.
- `types.ts`, `hooks/stateTypes.ts`, `hooks/useAppData.ts`, `hooks/appReducer.ts`: chuẩn hóa contract `AppDataSurgicalUpdate`, bỏ nhiều `any` trong reducer/update path.
- `services/agents/*`, `services/exportService.ts`, `services/marketingClaudeService.ts`, `services/posOfflineQueue.ts`, `services/posOrderService.ts`, `services/validationService.ts`: type hóa wrapper Claude, offline payload, validation/export, POS order callbacks.
- `components/MainContent.tsx`, `components/ProductGroupManager.tsx`, `components/ExpenseManager.tsx`, `components/expense/*`, `components/pos/*`, `components/revenue/*`: thay callback/update prop `any` bằng type chung, type hóa import row/transaction item/UI helper props.

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 pass | ESLint ✅ pass, còn 110 warning `any`, 0 `console` warning

**Còn lại / Dang dở:**
- Chưa xóa hết 110 warning `any`; phần lớn còn ở `services/dataMapper.ts` (42), `hooks/useAppData.ts` (20), `KnowledgeManager.tsx`, `ChatInterface.tsx`.
- Đây là type debt còn lại, không chặn build/test/lint vì `npm run lint` pass với warning.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 22

**Đã làm:**
- `components/ProductGroupManager.tsx`: lazy compute `filteredGroupRevenue`, `thisMonthTactical`, `nextMonthTactical`, `matrixData`, `visibleLedgerRows` theo `activeSubTab` để không tính các tab đang ẩn
- `components/ProductGroupManager.tsx`: đổi thuật toán `matrixData` từ filter/reduce lặp theo từng nhóm/năm sang gom số liệu một lượt bằng `Map`, đồng thời dùng `useTransition` khi đổi tab nặng
- `components/marketing/MarketingManager.tsx`: thêm `calendarPostByDate` bằng `Map` để ô lịch tra cứu O(1), không còn `find/some` lặp qua `schedule/drafts` trong từng ngày
- `components/marketing/MarketingManager.tsx`: `groupedSchedule` chỉ tính khi mở tab list; thêm `useDeferredValue(searchQuery)` để gõ search mượt hơn và `useTransition` khi đổi tab marketing
- `HISTORY.md`: cập nhật Current Active Task, TODO và phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 | ESLint ✅ pass (`npm run lint` pass; còn 314 warnings `any`/console nhưng 0 errors)

**Ghi chú kỹ thuật:**
- Đây là tối ưu performance thực tế, không chỉ tách file: giảm tính toán trên render và giảm blocking khi đổi tab/search.
- Không đổi business rule, schema, auth, tài chính/lương.

**Còn lại / Dang dở:**
- Blocked: Multi-tenant/branch filter cần UX + migration rollout; TikTok/Lazada/GHN/GHTK cần API credential/spec; POS redesign cần hình mẫu/user spec.
- Optional: giảm dần warning `any`/console hoặc tách UI sâu hơn để dễ maintain.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 21

**Đã làm:**
- `components/PromotionManager.tsx`: tách bước đầu thành `PromotionAiPanel`, `PromotionSubTabNav`, `PromotionLedgerTable`; giữ nguyên state/handler và behavior hiện có
- `components/ProductGroupManager.tsx`, `components/marketing/MarketingManager.tsx`: dọn các ESLint error scoped bằng cách bỏ import/biến không dùng, đổi `let` không cần thiết sang `const`, bỏ tham số catch không dùng
- `components/ExpenseManager.tsx`, `components/TopNav.tsx`, `components/marketing/BrandManager.tsx`, `components/marketing/MarketingUI.tsx`, `components/payroll/OvertimeTab.tsx`, `components/pos/GoodsAuditForm.tsx`, `components/pos/GoodsProductRow.tsx`, `components/pos/POSComputer.tsx`, `components/pos/SupplierManager.tsx`, `constants/navigation.ts`, `hooks/useAppData.ts`, `hooks/useMarketing.ts`, `services/emailService.ts`, `services/marketingClaudeService.ts`, `services/marketingStorageService.ts`: dọn lint error cơ học toàn repo để full lint pass
- `HISTORY.md`: cập nhật Current Active Task, TODO và phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 | ESLint ✅ pass (`npm run lint` pass; còn 315 warnings `any`/console nhưng 0 errors)

**Ghi chú kỹ thuật:**
- Không đổi business rule, schema runtime, auth, tài chính/lương.
- `PromotionManager.tsx` đã giảm kích thước đáng kể nhưng `MarketingManager.tsx` và `ProductGroupManager.tsx` mới dọn lint error, chưa refactor sâu UI vì sẽ là task lớn riêng.
- SQL cleanup `inventory_transactions` vẫn cần chạy trên Supabase nếu muốn drop cột thật.

**Còn lại / Dang dở:**
- Blocked: Multi-tenant/branch filter cần UX + migration rollout; TikTok/Lazada/GHN/GHTK cần API credential/spec; POS redesign cần hình mẫu/user spec.
- Optional: refactor sâu `MarketingManager.tsx` và `ProductGroupManager.tsx` thành các panel con.

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 20

**Đã làm:**
- `components/MainContent.tsx`: xác nhận ErrorBoundary module-level đã có cho POS, Goods, Staff, Payroll và các tab còn lại (`key={activeTab}`), nên TODO ErrorBoundary là nợ lịch sử đã hoàn thành
- `supabase_setup.sql`: thêm block cleanup cột legacy `inventory_transactions` (`product_id`, `quantity`, `previous_stock`, `new_stock`) bằng `DROP COLUMN IF EXISTS`
- `package.json` / `package-lock.json`: thêm `@vitest/coverage-v8` để chạy được coverage với Vitest
- Chạy `npx vitest run --coverage`: coverage tổng hiện tại Statements 20.57% | Branches 13.15% | Functions 14.65% | Lines 21.89%
- `HISTORY.md`: cập nhật TODO, đánh dấu các mục đã xác nhận/đã xử lý và ghi rõ các mục blocked

**Kết quả kiểm tra:**
Coverage ✅ chạy được, Tests ✅ 45/45 trong coverage run | Full TypeScript ✅ clean từ phiên 19 | Full ESLint ❌ lint debt toàn repo

**Ghi chú kỹ thuật:**
- SQL cleanup `inventory_transactions` chưa chạy trên Supabase trong phiên này; cần chạy block mới trong `supabase_setup.sql` nếu muốn drop cột thật.
- Multi-tenant/đa chi nhánh chưa bật filter code vì hiện repo chỉ có SQL chuẩn bị `branch_id/tenant_id`; chưa có UX chọn chi nhánh hoặc rollout đảm bảo DB đã có cột trên mọi môi trường.
- TikTok/Lazada/GHN/GHTK và 3 POS redesign đang blocked vì cần API credentials/spec hoặc hình mẫu từ user.

**Còn lại / Dang dở:**
- Tách `MarketingManager.tsx`, `ProductGroupManager.tsx`, `PromotionManager.tsx`
- Các tích hợp/POS redesign đang blocked như ghi trong TODO

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 19

**Đã làm:**
- `types.ts`: xóa `Employee.resigned_date`, giữ `resignedDate` là field app-level duy nhất
- `services/dataMapper.ts`: thêm `normalizeEmployee()` để migrate localStorage/dữ liệu legacy `resigned_date` sang `resignedDate`; cloud `employees.resigned_date` vẫn map vào camelCase
- `services/apiService.ts`: `employees` payload chỉ đọc `item.resignedDate`, sau đó ghi xuống Supabase column `resigned_date`
- `components/Dashboard.tsx`, `components/PayrollManager.tsx`, `components/StaffManager.tsx`, `components/payroll/SummaryTab.tsx`, `components/ChatInterface.tsx`: bỏ fallback đọc `resigned_date`, chỉ dùng `resignedDate`
- `businessLogic.payroll.ts`: `isStaffActive()` chỉ kiểm tra `resignedDate`
- `businessLogic.test.ts`: bỏ test snake_case legacy, thêm test `resignedDate` whitespace để giữ coverage case rỗng
- `components/ChatInterface.tsx`, `components/StaffManager.tsx`: dọn unused imports/state sẵn có trong file vừa chạm để scoped ESLint không còn error
- `HISTORY.md`: cập nhật TODO + phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 | Scoped ESLint ✅ 0 errors (62 warnings `any` tồn đọng) | Full ESLint ❌ lint debt toàn repo

**Ghi chú kỹ thuật:**
- `resigned_date` vẫn xuất hiện có chủ đích ở `services/dataMapper.ts` và `services/apiService.ts` vì Supabase column vẫn là snake_case.
- Không cần chạy SQL migration: DB column giữ nguyên `resigned_date`; migration thực tế là app boundary mapping + localStorage normalization.
- Full lint vẫn fail vì nợ cũ ngoài phạm vi như `ProductGroupManager.tsx`, `MarketingManager.tsx`, `TopNav.tsx`, `services/emailService.ts`, v.v.

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở trong task này

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 18

**Đã làm:**
- `components/KnowledgeManager.tsx`: upload file ảnh/PDF gốc lên Supabase Storage bucket `knowledge-files` sau khi OCR thành công; bản ghi mới lưu `sourceFilePath`, `sourceFileUrl`, `sourceFileType`, `sourceFileSize` thay vì `sourceFileData` base64; download dùng URL mới và fallback base64 legacy
- `types.ts`: thêm metadata Storage cho `KnowledgeBaseArticle`; giữ `sourceFileData` dưới dạng legacy field
- `services/apiService.ts`: sanitize `knowledgeBase` payload sang snake_case (`source_file_name`, `source_file_path`, `source_file_url`, `source_file_type`, `source_file_size`)
- `services/dataMapper.ts`: map metadata file từ cloud về camelCase, giữ fallback legacy
- `supabase_setup.sql`: thêm block tạo bucket `knowledge-files`, storage policies và các cột `source_file_*` trên bảng `knowledge_base`
- `components/KnowledgeManager.tsx` + `services/apiService.ts`: dọn ESLint error sẵn có trong file vừa chạm (unused imports/helper, unused `succeeded`)
- `HISTORY.md`: cập nhật TODO + phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 | Scoped ESLint ✅ 0 errors (56 warnings `any` tồn đọng) | Full ESLint ❌ lint debt toàn repo

**Ghi chú kỹ thuật:**
- Cần chạy block SQL "Knowledge Base original files (2026-05-12)" trong `supabase_setup.sql` trên Supabase Dashboard trước khi upload tài liệu mới.
- Storage bucket hiện cấu hình public read để link tải trực tiếp hoạt động với `sourceFileUrl`; policy upload dùng role `anon`, phù hợp app hiện đang dùng anon client phía frontend.
- `sourceFileData` không còn được set cho tài liệu mới, nhưng vẫn được dùng làm fallback khi tải tài liệu cũ đã lưu base64.

**Còn lại / Dang dở:**
- User đã chạy SQL trên Supabase Dashboard thành công sau phiên code

---

### 2026-05-12 — ChatGPT (Codex) — Phiên 17

**Đã làm:**
- `businessLogic.ts`: rút thành barrel re-export để giữ nguyên public import path hiện tại (`../businessLogic`)
- `businessLogic.core.ts`: tách helper lõi/time/import Excel (`calculateTimeContext`, `generateId`, `isUUID`, `normalizeHeader`, `cleanVNNumber`, `parseVNDate`, `parseHierarchyGroups`, `processExcelRawData`)
- `businessLogic.inventory.ts`: tách logic hàng hóa/biến thể (`cartesianProduct`, `generateProductVariants`, `getNextSKUNumber`)
- `businessLogic.payroll.ts`: tách logic nhân sự/lương (`dummyPolicy`, `isStaffActive`, `calculateSeniority`, `determineCurrentPolicy`, `calculateEmployeePayroll`, `calculateStaffRanking`)
- `businessLogic.revenue.ts`: tách logic tài chính/doanh thu/MIS/chiến lược (`calculateExecutiveInsights`, `calculateExpenseAnalysis`, `calculateMISMetrics`, `calculateDailyBreakEven`, `calculateStrategicSuggestions`, `calculateSeasonalityAnalysis`, v.v.)
- `HISTORY.md`: cập nhật TODO + phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 | Scoped ESLint ✅ 0 errors (42 warnings `any` kế thừa) | Full ESLint ❌ lint debt toàn repo

**Ghi chú kỹ thuật:**
- Không đổi public API: toàn bộ import hiện tại từ `businessLogic.ts` vẫn hoạt động qua re-export.
- Không đổi nghiệp vụ lương: `calculateEmployeePayroll` được chuyển nguyên trạng; `responsibilityPay` vẫn chỉ tính khi có approval.
- `npm run lint` vẫn fail vì nợ cũ ngoài phạm vi, ví dụ `ChatInterface.tsx`, `KnowledgeManager.tsx`, `ProductGroupManager.tsx`, `StaffManager.tsx`, `services/apiService.ts`, v.v.; file vừa sửa không có ESLint error.

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở trong task này

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 16

**Đã làm:**
- `components/pos/usePOSKeyboard.ts`: thêm `isActive?: boolean` param; thêm guard `if (!isActive) return;` ở đầu cả 2 `useEffect`; thêm `isActive` vào dependency arrays — listeners được remove khi hidden
- `components/pos/POSComputer.tsx`: thêm `isActive?: boolean` vào `POSComputerProps`; truyền vào `usePOSKeyboard({ isActive, ... })`
- `components/MainContent.tsx`: thêm `visitedTabs` state (`Set<string>`, lazy-init từ `activeTab`); `useEffect` cập nhật Set khi tab đổi; tách `pos` + `goods` khỏi switch thành 2 persistent divs với `style={{ display: ... }}`; các tab khác vẫn dùng switch + skeleton như cũ
- `HISTORY.md`: cập nhật TODO + phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean

**Ghi chú kỹ thuật:**
- Pattern `activeTab === 'pos' || visitedTabs.has('pos')` tránh blank screen lần đầu navigate (Set chưa update khi render đầu tiên)
- `ErrorBoundary` cho persistent tabs dùng `key="pos"` cố định — error state không reset khi navigate đi/về (chấp nhận được)
- `isPending` skeleton chỉ áp dụng cho non-persistent tabs, tránh che POSComputer khi đã mount sẵn

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 15

**Đã làm:**
- `components/pos/GoodsProductTableBody.tsx`: đổi export thành `React.memo(GoodsProductTableBodyBase)` — component bail out khi props không đổi
- `components/pos/GoodsInventory.tsx`: thêm `useCallback` import; thêm 6 memoized handlers (`handleToggleView`, `handleChangeDetailTab`, `handleDeleteViewed`, `handleEditViewed`, `handleAddUnitInView`, `handleAddAttributeInView`); thay 6 inline arrow functions bằng stable references; xóa `isQuickAddMode` unused destructuring (pre-existing lint error)
- `HISTORY.md`: cập nhật TODO + phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 | Scoped ESLint ✅ 0 errors (7 warnings `any` pre-existing)

**Ghi chú kỹ thuật:**
- Quyết định không dùng `@tanstack/react-virtual`: bảng đã paginate 50/trang; expandable rows + detail panels có variable height rất khó maintain với virtual scroll
- `handleToggleView` phụ thuộc `viewingProduct?.id` — tạo ref mới khi user mở/đóng panel, đây là behavior đúng
- `handleDeleteViewed` phụ thuộc `products` — tạo ref mới khi products thay đổi, không tránh được

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 14

**Đã làm:**
- `components/revenue/useRevenueLedger.ts`: tách toàn bộ ledger upload, conflict detection, conflict resolution (`handleFileUpload`, `handleResolveConflicts`, `handleAdd`) + state liên quan (`formData`, `isSaving`, `fileInputRef`, audit states)
- `components/revenue/useShopeeInventoryOut.ts`: tách toàn bộ Shopee inventory out logic (`handleShopeeFileUpload`, `handleDistributeAdsCost`, `handleAddInventoryOut`, `handleEditInventoryOut`, `handleRemoveInventoryOut`, `handleClearAllInventoryOut`) + cost config handlers + computed values (`totalFixedCosts`, `totalVariableCosts`, `shopeeTotals`, `fixedCostPerOrder`)
- `components/RevenueManager.tsx`: dùng 2 hooks mới; file giảm từ 1315 → ~340 dòng; xóa toàn bộ logic đã tách, giữ lại analytics useMemos, `runRevenueDiagnosis`, JSX
- Fix ESLint error `no-duplicate-imports`: gộp `import type` vào cùng dòng `import { ... }` cho cả 2 hook files
- `HISTORY.md`: cập nhật TODO + phiên mới

**Kết quả kiểm tra:**
TypeScript ✅ clean | Tests ✅ 45/45 | Scoped ESLint ✅ không error

**Ghi chú kỹ thuật:**
- `useRevenueLedger` nhận `setActiveSubTab` làm prop để `handleResolveConflicts` có thể chuyển sang tab 'ledger' sau khi resolve xong
- `useShopeeInventoryOut` expose đủ state/handlers để `InventoryOutTab` và `CostsTab` nhận qua `shopee.*` destructuring
- Full ESLint toàn repo chưa chạy; lint debt cũ vẫn còn ở các file khác ngoài phạm vi

**Còn lại / Dang dở:**
- Hoàn thành — không có việc dang dở trong task này

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 13

**Mục tiêu:** Tiếp tục ưu tiên trung bình — bắt đầu tách `RevenueManager.tsx`

**Đã làm:**
- `components/revenue/RevenueSubTabNav.tsx`: tách thanh điều hướng sub-tab doanh thu/Shopee khỏi `RevenueManager.tsx`
- `components/revenue/RevenueAuditModal.tsx`: tách modal đối soát sai lệch upload doanh thu
- `types.ts`: thêm `RevenueSubTab`, `RevenueAuditColumnKey`, `RevenueAuditConflict`; nới `AppDataSurgicalUpdate` để hỗ trợ delete-by-id `{ id }`
- `components/RevenueManager.tsx`: dùng component mới, sửa các lỗi scoped ESLint trong file vừa chạm (`unused props`, `unused catch err`, surgical update key literal)

**Kết quả kiểm tra:**
TypeScript ✅ | Tests ✅ 45/45 | Scoped ESLint ✅ không error

**Ghi chú kỹ thuật:**
- Scoped ESLint còn 2 warning `any` trong phần parse Excel Shopee (`sheet_to_json` rows và row object), chưa xử lý để tránh đổi rộng logic import
- Chưa chạy full `npm run lint` lại ở bước này; lần chạy full trước đó vẫn fail do lint debt cũ toàn repo

**Còn lại / Dang dở:**
- Tiếp tục `RevenueManager.tsx`: tách logic Shopee import/upload hoặc ledger upload/conflict resolution

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 12

**Mục tiêu:** Hoàn tất task tách `PayrollManager.tsx`

**Đã làm:**
- `components/payroll/payrollPayslipPrint.ts`: tách phần build HTML phiếu lương in nhiệt khỏi `handleConfirmPrint`
- `components/PayrollManager.tsx`: rút `handleConfirmPrint` còn phần điều phối in; file giảm còn 890 dòng
- `types.ts`: thêm `AppDataItem`, `AppDataSurgicalUpdate`, `UpdateAppData` để bỏ `any` trong props/update của Payroll
- `components/PayrollManager.tsx`: thay `catch (err: any)` bằng `unknown` + guard `instanceof Error`

**Kết quả kiểm tra:**
TypeScript ✅ | Tests ✅ 45/45 | Scoped ESLint ✅ sạch | Full ESLint ❌ do lỗi tồn đọng ngoài phạm vi

**Ghi chú kỹ thuật:**
- Không thay đổi `calculateEmployeePayroll`, không thay đổi cách tính `responsibilityPay`
- `components/payroll/SummaryTab.tsx` đã chứa UI settlement/resignation, nên không tách thêm UI settlement trong `PayrollManager.tsx`
- `npm run lint` vẫn fail vì lint debt cũ ở `businessLogic.ts`, `ChatInterface.tsx`, `KnowledgeManager.tsx`, `ProductGroupManager.tsx`, `services/apiService.ts`, v.v.; các file Payroll vừa sửa không có error/warning scoped

**Còn lại / Dang dở:**
- Tiếp tục ưu tiên trung bình: `RevenueManager.tsx` hoặc task medium kế tiếp

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 11

**Mục tiêu:** Cập nhật quy trình xác nhận và test theo yêu cầu mới của user

**Đã làm:**
- `AGENTS.md`: đổi Bước 3 thành xác nhận theo ranh giới task lớn/module lớn; sau khi user đồng ý task lớn, agent tự chia checklist con và không hỏi lại từng bước nhỏ trong cùng phạm vi
- `AGENTS.md`: thêm vòng lặp bắt buộc cho refactor nhiều bước — tách nhỏ, chạy TypeScript + scoped ESLint, sửa lỗi đến sạch rồi mới chuyển bước tiếp theo
- `AGENTS.md`: làm rõ gate cuối task lớn — chạy full check/test/lint; nếu full lint fail do nợ cũ thì phải báo rõ, còn lỗi do phần vừa sửa thì phải sửa đến khi ổn
- `HISTORY.md`: ghi chú quy trình mới trong Current Active Task để agent sau áp dụng ngay

**Kết quả kiểm tra:**
TypeScript ⏭️ | Tests ⏭️ | ESLint ⏭️ (chỉ sửa tài liệu Markdown)

**Còn lại / Dang dở:**
- Tiếp tục ưu tiên trung bình: `PayrollManager.tsx`

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 10

**Mục tiêu:** Tiếp tục ưu tiên trung bình — tách thêm UI khỏi `PayrollManager.tsx`

**Đã làm:**
- `components/payroll/PayrollPrintPreviewModal.tsx`: tách modal xem trước phiếu lương sang component riêng; giữ nguyên cách hiển thị attendance, phụ cấp, phạt, overtime, trách nhiệm và tổng lương
- `components/PayrollManager.tsx`: thay block modal inline bằng `PayrollPrintPreviewModal`; giữ `handleConfirmPrint` và logic tính/in ở parent

**Kết quả kiểm tra:**
TypeScript ✅ | Tests ✅ 45/45 | Scoped ESLint ✅ không error | Full ESLint ❌ do lỗi tồn đọng ngoài phạm vi

**Ghi chú kỹ thuật:**
- Không thay đổi `calculateEmployeePayroll`, không thay đổi cách tính `responsibilityPay`
- Scoped ESLint còn 5 warning `any` cũ trong `PayrollManager.tsx`, không có error
- `PayrollManager.tsx` vẫn còn dài vì HTML in phiếu lương trong `handleConfirmPrint` chưa tách

**Còn lại / Dang dở:**
- Tiếp tục `PayrollManager.tsx`: tách HTML in phiếu lương khỏi `handleConfirmPrint` hoặc tách settlement/resignation UI

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 9

**Mục tiêu:** Tiếp tục ưu tiên trung bình — bắt đầu tách `PayrollManager.tsx` theo hướng an toàn

**Đã làm:**
- `components/payroll/PayrollToolbar.tsx`: tách sticky toolbar gồm tab navigation, chọn tháng, xuất Excel, toggle hiện nhân sự cũ
- `components/PayrollManager.tsx`: thay toolbar inline bằng `PayrollToolbar`; giữ toàn bộ logic lương, settlement, in phiếu và calculation ở parent
- `types.ts`: thêm `PayrollSubTab` để tránh local union type lặp lại
- `components/PayrollManager.tsx`: dọn import không dùng và vài `let` thành `const` theo scoped ESLint, không đổi behavior

**Kết quả kiểm tra:**
TypeScript ✅ | Tests ✅ 45/45 | Scoped ESLint ✅ không error | Full ESLint ❌ do lỗi tồn đọng ngoài phạm vi

**Ghi chú kỹ thuật:**
- Scoped command còn 5 warning `any` trong `PayrollManager.tsx`, không có error
- `npm run lint` vẫn fail vì lint debt cũ toàn repo
- `PayrollManager.tsx` còn nhiều UI print preview/payslip lớn, nên tách tiếp phần đó trước khi chạm logic khác

**Còn lại / Dang dở:**
- Tiếp tục `PayrollManager.tsx`: tách print preview/payslip UI; không thay đổi `calculateEmployeePayroll` hoặc cách tính `responsibilityPay`

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 8

**Mục tiêu:** Tiếp tục nhóm ưu tiên trung bình — hoàn tất tách `Dashboard.tsx`

**Đã làm:**
- `components/Dashboard.tsx`: rút các khối UI lớn sang panel con, giữ lại state, tính toán và orchestration ở parent; file còn 731 dòng
- `components/dashboard/DashboardTrendsPanel.tsx`: tách biểu đồ xu hướng tháng/ngày
- `components/dashboard/DashboardStructurePanel.tsx`: tách waterfall P&L, pie chart chi phí và bảng chi tiết nhóm chi phí
- `components/dashboard/DashboardAiAdvisor.tsx`: tách panel AI CFO Advisor, giữ nguyên callback gọi briefing từ parent
- `components/dashboard/DashboardEodBanner.tsx`: tách banner báo cáo EOD, vẫn sanitize markdown bằng DOMPurify
- `types.ts`: thêm type dashboard rõ ràng (`DashboardTrendPoint`, `DashboardWaterfallItem`, `DashboardExpenseSlice`, `DashboardDetailedExpense`, `DashboardBreakEvenAnalysis`)

**Kết quả kiểm tra:**
TypeScript ✅ | Tests ✅ 45/45 | Scoped ESLint ✅ | Full ESLint ❌ do lỗi tồn đọng ngoài phạm vi

**Ghi chú kỹ thuật:**
- Scoped command sạch: `npx eslint components/Dashboard.tsx components/dashboard/*.tsx types.ts`
- `npm run lint` vẫn fail do lint debt cũ ở `businessLogic.ts`, `PayrollManager.tsx`, `KnowledgeManager.tsx`, `services/apiService.ts`, v.v.

**Còn lại / Dang dở:**
- Tiếp tục ưu tiên trung bình: `PayrollManager.tsx` là task kế tiếp, nhưng cần đọc kỹ trước vì liên quan logic lương nhạy cảm

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 7

**Mục tiêu:** Cập nhật quy trình làm việc trong `AGENTS.md` theo góp ý đã thống nhất

**Đã làm:**
- `AGENTS.md`: đổi source of truth vận hành sang `AGENTS.md` + `HISTORY.md`; Claude là maintainer mặc định nhưng agent đang làm phải cập nhật history
- `AGENTS.md`: thêm dirty worktree protocol trước khi edit
- `AGENTS.md`: thêm phân loại xác nhận theo rủi ro — task nhỏ rõ phạm vi được làm sau khi báo ngắn; DB/lương/tài chính/auth/migration phải xin xác nhận
- `AGENTS.md`: thêm quy tắc chia task lớn thành checklist con trong `HISTORY.md`
- `AGENTS.md`: cập nhật test/lint gate — full check vẫn chạy, nhưng khi repo có lint debt thì phải thêm scoped ESLint cho file vừa sửa và báo rõ full lint fail do tồn đọng
- `AGENTS.md`: bổ sung rule refactor behavior-preserving — extract trước, tối ưu sau, không đổi business rule/copy/data shape trong cùng refactor
- `HISTORY.md`: thêm `Current Active Task` và chia nhỏ checklist `Dashboard.tsx`

**Kết quả kiểm tra:**
TypeScript ⏭️ | Tests ⏭️ | ESLint ⏭️ (chỉ sửa tài liệu Markdown)

**Còn lại / Dang dở:**
- Tiếp tục task ưu tiên trung bình: tách `DashboardTrendsPanel`, `DashboardStructurePanel`, `DashboardAiAdvisor`, `DashboardEodBanner`

---

### 2026-05-11 — ChatGPT (Codex) — Phiên 6

**Mục tiêu:** Làm tiếp nhóm ưu tiên trung bình — bắt đầu refactor `Dashboard.tsx`

**Đã làm:**
- `types.ts`: thêm `DashboardFinancialInsights` và `DashboardPreviousInsights` để component dashboard dùng chung type rõ ràng
- `components/dashboard/DashboardKpiOverview.tsx`: tạo component mới cho KPI cards, P&L summary và DailyBreakEven
- `components/Dashboard.tsx`: thay khối KPI/P&L/DailyBreakEven inline bằng `DashboardKpiOverview`; dọn các biến unused trong file này để targeted ESLint không còn error

**Kết quả kiểm tra:**
TypeScript ✅ | Tests ✅ 45/45 | ESLint ❌ toàn repo còn lỗi tồn đọng ngoài phạm vi refactor

**Ghi chú kỹ thuật:**
- `npx eslint components/Dashboard.tsx components/dashboard/DashboardKpiOverview.tsx types.ts` chỉ còn warning `any`, không có error
- `npm run lint` vẫn fail do nhiều lỗi cũ ở `businessLogic.ts`, `PayrollManager.tsx`, `KnowledgeManager.tsx`, `services/apiService.ts`, v.v.
- Chưa tick xong TODO tách Dashboard vì mới tách bước 1; còn nên tách tiếp Trends, Structure, AI Advisor và EOD banner

**Còn lại / Dang dở:**
- Tiếp tục tách `Dashboard.tsx`: ưu tiên `DashboardTrendsPanel`, `DashboardStructurePanel`, `DashboardAiAdvisor`, `DashboardEodBanner`
- Sau đó xử lý các việc ưu tiên trung bình tiếp theo: `PayrollManager.tsx`, `RevenueManager.tsx`, virtualization SKU

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 5

**Mục tiêu:** Hoàn thiện hệ thống multi-agent, fix database, thêm indexes

**Đã làm:**
- `AGENTS.md`: Rewrite hoàn toàn — self-contained, đủ cho mọi agent implement
- `ROLE_REVIEWER.md`: Tạo mới — vai Code Reviewer với 7 danh mục + format báo cáo
- `ROLE_QA.md`: Tạo mới — vai QA Engineer với 5 bước + edge cases + nghiệp vụ
- `CLAUDE.md`: Thêm section multi-agent team + handoff instructions
- Supabase: Chạy SQL atomic stock RPC (`decrement_product_stock` + `increment_product_stock`) ✅
- Supabase: Thêm database indexes cho 9 bảng (`pos_products`, `pos_orders`, `pos_customers`, `revenue_records`, `expense_records`, `attendance_records`, `payroll_records`, `supplier_debts`, `employees`)
- Supabase: Fix schema `inventory_transactions` — thêm 4 cột thiếu (`date`, `items`, `reference_id`, `staff_id`) + index

**Kết quả kiểm tra:** TypeScript ✅ | Tests ✅ (không sửa logic code)

**Còn lại / Dang dở:** Hoàn thành — không có việc dang dở

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 4

**Mục tiêu:** Xây dựng hệ thống multi-agent đầy đủ — mỗi agent 1 file vai trò hoàn chỉnh, hỗ trợ bàn giao giữa agents khi hết context limit

**Đã làm:**
- [`AGENTS.md`](AGENTS.md): Rewrite hoàn toàn — thêm mục 1 (giới thiệu dự án), mục 2 (files cần đọc), mục 3 (cấu trúc team), mục 4 (HANDOFF protocol), mục 5 (8-bước workflow), mục 6 (testing khi được yêu cầu), mục 7 (tình huống cụ thể), mục 8 (quy tắc bất di bất dịch), mục 9 (kỹ thuật), mục 10 (code review checklist)
- [`ROLE_REVIEWER.md`](ROLE_REVIEWER.md): Tạo mới — hướng dẫn đầy đủ cho vai Code Reviewer (7 danh mục, format báo cáo, lưu ý đặc biệt)
- [`ROLE_QA.md`](ROLE_QA.md): Tạo mới — hướng dẫn đầy đủ cho vai QA Engineer (5 bước, edge cases, nghiệp vụ, risk matrix)
- [`CLAUDE.md`](CLAUDE.md): Thêm section multi-agent team + hướng dẫn cập nhật HISTORY.md khi hết context

**Kết quả kiểm tra:** TypeScript ✅ | Tests ✅ (không sửa logic)

**Ghi chú kỹ thuật:**
- AGENTS.md là nguồn sự thật chung — mọi agent đọc file này để implement
- ROLE_REVIEWER.md + ROLE_QA.md là vai trò theo yêu cầu — bất kỳ agent nào cũng có thể đảm nhận
- Handoff protocol quan trọng: khi Claude hết limit, phải ghi "Còn lại / Dang dở" vào HISTORY.md đủ chi tiết để agent tiếp theo không bị gián đoạn

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 3

**Mục tiêu:** Thêm Code Review Checklist có cấu trúc để mọi AI model review đồng nhất

**Đã làm:**
- [`AGENTS.md`](AGENTS.md): Thêm `PHẦN 4 — CODE REVIEW CHECKLIST` — 7 danh mục bắt buộc (Security, Data Integrity, Error Handling, Performance, Type Safety, Business Logic, Code Quality) + prompt template dán thẳng vào ChatGPT/Gemini
- [`CLAUDE.md`](CLAUDE.md): Thêm section `## 5. Khi làm Code Review` — chỉ tới AGENTS.md PHẦN 4, bắt buộc Claude đi đủ 7 danh mục thay vì dừng sau 1 lỗi

**Kết quả kiểm tra:** TypeScript ✅ | Tests ✅ (không sửa logic)

**Ghi chú kỹ thuật:**
- Vấn đề gốc: prompt mở "tìm nguy cơ lỗi" + context window giới hạn → mỗi model chỉ báo 1 lỗi rồi dừng
- Giải pháp: buộc model duyệt đủ 7 danh mục có checkbox → không thể bỏ sót category
- Prompt template ở cuối PHẦN 4 dùng được ngay cho ChatGPT/Gemini — không cần thêm context

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 2

**Mục tiêu:** Cài Prettier + ESLint, tạo hệ thống đồng bộ quy tắc giữa các AI agents

**Đã làm:**
- Cài `prettier@3.8.3`, `eslint@10.3.0`, `@typescript-eslint/...` vào devDependencies
- Tạo [`.prettierrc`](.prettierrc): singleQuote, tabWidth 2, trailingComma es5, printWidth 100
- Tạo [`.prettierignore`](.prettierignore): bỏ qua dist/, node_modules/, imports/ (file 12k SKU)
- Tạo [`eslint.config.js`](eslint.config.js): ESLint 9 flat config, bắt `console.log` / `any` / `var` / unused imports
- Cập nhật [`package.json`](package.json): thêm scripts `format`, `lint`, `lint:fix`, `format:check`
- Cập nhật [`.claude/hooks/PostToolUse.sh`](.claude/hooks/PostToolUse.sh): chạy Prettier trước TypeScript check sau mỗi Edit
- Tạo [`AGENTS.md`](AGENTS.md): spec document đầy đủ cho tất cả AI agents (stack, rules, naming, checklist)
- Format các file route + service bằng Prettier (routes/\*, services/posOrderService.ts, businessLogic.ts)

**Kết quả kiểm tra:** TypeScript ✅ | 45/45 tests ✅ | Prettier ✅ | ESLint ✅

**Ghi chú kỹ thuật:**
- Project dùng `"type":"module"` (ESM) + Node 24 → phải dùng ESLint flat config (`eslint.config.js`), không dùng `.eslintrc.json` legacy
- `eslint.config.js` phải tự thêm vào `ignores` của chính nó (tránh ESLint lint chính nó)
- Prettier dùng `arrowParens: "avoid"` cho hàm 1 tham số: `x => x` thay vì `(x) => x`

---

### 2026-05-11 — Claude (claude-sonnet-4-6) — Phiên 1

**Mục tiêu:** Review toàn bộ codebase, vá các lỗ hổng bảo mật và data integrity

**Đã làm:**

**🔴 Bảo mật — Critical:**
- [`server.ts`](server.ts): Fix `requireAuth` bypass qua HTTP `Host` header → dùng `req.socket.remoteAddress` (TCP address, không spoofable)
- [`server.ts`](server.ts): Session secret hardcoded `'fb-app-secret-key'` → fail hard khi `NODE_ENV=production` và không set `SESSION_SECRET`
- [`server.ts`](server.ts): Thêm startup warning nếu fallback về SUPABASE_ANON_KEY (SERVICE_ROLE_KEY chưa set)
- [`routes/ai.ts`](routes/ai.ts): Thêm rate limiting cho toàn bộ 10 AI endpoints (10/phút cho haiku, 5/phút cho sonnet/file) — trước đó 8/10 endpoint không có rate limit
- [`routes/notifications.ts`](routes/notifications.ts): Thêm `requireAuth` vào `POST /api/eod-report`, `POST /api/notifications/test-email`, `POST /api/notifications/test-zalo`, `PUT /api/alerts/config`

**🟡 Chất lượng code:**
- [`server.ts`](server.ts): `console.log` request logging chỉ chạy trong development (`!IS_PROD`)
- [`businessLogic.ts`](businessLogic.ts): Fix `generateId()` — dùng `globalThis.crypto.randomUUID()` thay `window.crypto` → hoạt động đúng trên Node.js backend
- [`businessLogic.ts`](businessLogic.ts): Fix penalty string matching trong `calculateEmployeePayroll` — dùng hàm `normVN()` chuẩn hóa diacritics trước khi so sánh → không còn bỏ sót vi phạm do lỗi gõ dấu

**🟠 Data integrity:**
- [`services/posOrderService.ts`](services/posOrderService.ts): Thêm stock guard — throw error nếu `stock < quantity` trước khi ghi đơn hàng
- [`supabase_setup.sql`](supabase_setup.sql): Thêm SQL function `decrement_product_stock()` + `increment_product_stock()` cho atomic stock update (**cần chạy thủ công trên Supabase**)
- [`services/posOrderService.test.ts`](services/posOrderService.test.ts): Fix 2 test fail — mock `pushBatch`/`updateSurgical` trả `Promise.resolve()`, test dùng `async/await` đúng cách

**Kết quả kiểm tra:** TypeScript ✅ | 45/45 tests ✅

**Ghi chú kỹ thuật:**
- `req.hostname` đọc từ HTTP `Host` header — có thể spoof. `req.socket.remoteAddress` là TCP address thực — không thể spoof qua HTTP
- `globalThis.crypto` available từ Node.js 17+, `window.crypto` chỉ có ở browser → codebase cũ dùng sai nhánh
- Khi mock `vi.fn()` trả `undefined` và function dùng `await`, continuation nhảy vào microtask queue → assertion sync chạy trước khi function hoàn thành → test false pass
- Scheduler trong `routes/facebook.ts` và `routes/notifications.ts` đã có Supabase-based distributed lock → không cần thêm

---

### 2026-05-10 — Claude (claude-sonnet-4-6) — Phiên 0

**Đã làm:**
- Backend refactor: tách `server.ts` (cũ ~800L) thành các route files riêng
  - `routes/ai.ts` — Claude AI endpoints
  - `routes/facebook.ts` — Facebook OAuth + auto-post scheduler
  - `routes/notifications.ts` — EOD report + alert scheduler
  - `routes/import.ts` — KiotViet sync
- `server.ts` còn ~176 dòng bootstrap thuần
- Tối ưu AI token: giảm context size gửi lên Claude
- Thêm cột `customer_orders`, `direct_sale`, `product_type` vào bảng `pos_products` (SQL đã chạy)

**Ghi chú kỹ thuật:**
- `runNotificationScheduler` được export từ `routes/notifications.ts` và gọi từ `setInterval` trong `server.ts`
- Facebook `autoPostConfig` load từ Supabase khi khởi động (`loadAutoPostConfig()`)

---

### Trước 2026-05-10 — Nhiều phiên (Claude)

**Đã hoàn thành:**
- **Giai đoạn 0 (Bảo mật):** `requireAuth` middleware, CORS config, `.env.local` isolation
- **Giai đoạn 1 (POS & Vận hành):**
  - POSComputer refactor: 2361L → 824L (tách 15+ sub-components + hooks)
  - GoodsInventory refactor: 4260L → 534L
  - ExpenseManager refactor: 1522L → 561L
  - Offline queue: IndexedDB (`posOfflineQueue`) + auto-drain khi online
  - Supplier debt management (transaction model)
  - Customer points + tier system
- **Giai đoạn 2 (AI Agents):**
  - CFO Agent: phân tích tài chính, P&L, HR
  - Alert Agent: cảnh báo tồn kho thấp, nợ NCC, doanh thu giảm
  - EOD Agent: báo cáo cuối ngày tự động 21:00 VN
  - Marketing Agent: content plan, Facebook auto-post
  - Knowledge Base: OCR tài liệu → Markdown

---

## 📐 Kiến trúc hiện tại (snapshot 2026-05-11)

```
Frontend (React 19 + Vite)
  ↕ fetch /api/*
Backend (Express + Node 24)
  ├── /api/ai/*         → Claude API (haiku/sonnet)
  ├── /api/eod-report   → EOD Agent (Claude)
  ├── /api/alerts       → Alert checks (Supabase)
  ├── /api/sync-kiotviet → KiotViet import
  └── /api/facebook/*   → FB Graph API
  ↕ Supabase JS Client
Supabase (PostgreSQL, 26 bảng)
  ├── pos_products, pos_orders, pos_customers
  ├── inventory_transactions
  ├── revenue_records, expense_records
  ├── employees, attendance_records, payroll_records
  ├── salary_policies, violation_types, violation_occurrences
  ├── suppliers, supplier_debt_records
  ├── app_state (FB token, scheduler lock, marketing config)
  └── ... (26 tổng)
localStorage (fallback offline)
  key: 'cfo_brain_local_data'
IndexedDB (offline queue)
  db: 'pos_offline_queue', store: 'pending_ops'
```
