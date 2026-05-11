# ROADMAP.md — CFO Brain 4.0

> Lịch sử roadmap, trạng thái bảo mật, chất lượng code, và technical debt backlog.

---

## Trạng thái bảo mật (cập nhật 2026-05-06) — Tất cả đã xử lý ✅

| Mức độ | Vấn đề | Giải pháp |
|---|---|---|
| CRITICAL | Supabase anon key hardcode | Chuyển sang `.env.local` (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) |
| CRITICAL | Facebook token ghi ra file | Xóa file, token chỉ lưu in-memory (`globalFbAccessToken`) |
| HIGH | 6 component `dangerouslySetInnerHTML` không sanitize | Cài `dompurify`, wrap `marked.parse()` bằng `DOMPurify.sanitize()` |
| HIGH | API routes không có authentication | Thêm middleware `requireAuth` cho routes mutate data |
| MEDIUM | CORS `origin: '*'` | Whitelist `localhost:3000` + `APP_URL` env var |
| MEDIUM | Session secret hardcode | Chuyển sang `SESSION_SECRET` env var |

---

## Trạng thái chất lượng code (cập nhật 2026-05-11) — Tất cả đã xử lý ✅

| Vấn đề | Giải pháp |
|---|---|
| Không có tests cho `businessLogic.ts` | 43 unit tests với Vitest — `calculateSeniority`, `cleanVNNumber`, `parseVNDate`, etc. |
| `fetchAllData()` limit 10000 | Giảm xuống 2000, time-series tables order by date desc, thêm `fetchTablePage()` |
| Scheduler dùng `setInterval` + file state | `autoPostConfig` lưu/load từ Supabase `app_state`, error guard |
| Không có audit trail tài chính | `auditLog()` trong `apiService.ts`, bảng `audit_logs` Supabase |
| `RevenueManager` ~130KB, `PayrollManager` ~100KB | Split thành sub-components: `components/revenue/`, `components/payroll/` |
| `generateId` khai báo local ở 2 component | Xóa local copy, import từ `businessLogic.ts` |
| Dead files (Sidebar, Header, FileUploader, marketingGeminiService) | Xóa 4 file không được import |
| `console.log` debug trong production | Xóa 5 chỗ, giữ nguyên `console.error` |
| `isSubItem` dead property trong navigation.ts | Xóa khỏi 3 items |
| `server.ts` god-file 1124 dòng | Tách route: `ai.ts`, `facebook.ts`, `notifications.ts`, `import.ts`; `server.ts` còn bootstrap ~176 dòng |
| Vite config còn expose biến AI cũ ra frontend | Xóa define env AI cũ khỏi Vite config; Claude chỉ server-side |
| `ExpenseManager.tsx` 1522 dòng | Tách `components/expense/`: tabs, analytics hook, recurring hook/tab, efficiency tab, ledger tab, categories tab; file chính còn 561 dòng |

---

## Roadmap 4 giai đoạn

### Giai đoạn 0 — Nền móng ✅ HOÀN THÀNH (2026-05-06)
- [x] Secrets → `.env.local`, `.env.example` làm template
- [x] DOMPurify cho `dangerouslySetInnerHTML` — 6 component
- [x] `requireAuth` middleware cho API routes
- [x] Bảng `audit_logs` — audit trail tài chính/lương
- [x] 43 unit tests cho `businessLogic.ts` (Vitest)
- [x] Fix scheduler — Supabase state, error guard
- [x] Pagination — limit 2000, order desc, `fetchTablePage()`
- [x] CORS whitelist

### Giai đoạn 1 — Hoàn thiện POS & Vận hành ✅ HOÀN THÀNH (2026-05-10)
- [x] Quản lý nhà cung cấp + công nợ — `SupplierManager.tsx`, bảng `suppliers` + `supplier_debts`
- [x] Barcode scanner (camera/USB) — native `BarcodeDetector` API
- [x] In hóa đơn nhiệt (thermal printer) — 58mm/80mm, `pos_paper_width` localStorage
- [x] Kiểm kho định kỳ + cảnh báo tồn kho thấp — `GoodsInventory.tsx`, `minStock ?? 5`
- [x] Trang Hàng hóa redesign — 2 panel kiểu KiotViet, sidebar filter, ProductRow nâng cấp
- [x] CRM khách hàng nâng cao — `CustomerPoints.tsx` viết lại hoàn toàn
- [x] Layout: sidebar trái → top navigation 2 tầng — `TopNav.tsx`
- [x] POS: ô nhập "Khách đưa" — `<input>` thay `<span>`
- [x] POS: kiểm tra tồn kho trước khi thêm vào giỏ
- [x] POS: fix màn hình full-screen khoảng trống — h-full chain trong `MainContent.tsx`
- [x] Báo cáo cuối ngày (EOD Report) — `EndOfDayReport.tsx`
- [x] POS: payment section reorganize — Khách đưa → Payment methods → Tiền thừa
- [x] POS: CartItemRow redesign từ `<table>` sang `<div>` flex
- [x] POS: giảm giá từng sản phẩm (item-level discount popup)
- [x] POS: giảm giá bill-level popup
- [x] POS: nút +/- số lượng trong CartItemRow (hover only)
- [x] POS: Global Barcode Scanner (window keydown listener)
- [x] POS: Confirm khi đóng tab có hàng trong giỏ
- [x] POS: Sync UI — badge số offline + animate-spin khi đồng bộ
- [x] POS: Add Customer Modal — layout 2 cột
- [x] POS: Box Tư vấn Bán hàng redesign — 6 cột × 2 hàng, h-[380px]
- [x] POS: SupplierManager xuất Excel công nợ
- [x] POS: luồng trả/đổi hàng hoàn chỉnh
- [x] POS: EOD Report AI summary + in qua new window
- [x] GoodsInventory: Filter Sidebar redesign — 6 filter section, multi-select popup
- [x] GoodsInventory: Column Visibility (Cài đặt cột) — 17 cột optional, localStorage
- [x] GoodsInventory: bổ sung cột Thương hiệu + Vị trí + maxStock + relatedSku + createdAt
- [x] Import Excel KiotViet — `POST /api/import/kiotviet-products`, batch 300, 12.739 SKU
- [x] Split `RevenueManager` → 9 sub-components (`components/revenue/`)
- [x] Split `PayrollManager` → `components/payroll/`
- [x] **Quản lý sản phẩm biến thể (Product Variants)** — parent-child, Cartesian product, SKU auto-increment
- [x] 3 trường mới POSProduct: `customerOrders`, `directSale`, `productType` (từ KiotViet Excel analysis)
- [x] `.claude/` folder — hooks, commands, agents, rules
- [x] Code cleanup — 4 dead files, 2 duplicate generateId, 5 console.log, dead isSubItem
- [~] Quản lý ca làm việc — **TẠM HOÃN** (chủ tự đứng thu ngân)

**POS — pending (chờ hình mẫu từ User)**:
- [ ] Payment method-specific UI (Split Payment layout riêng)
- [ ] Return Layout Redesign (màu nền riêng, khóa ô tìm kiếm)
- [ ] CRM Customer Modal 2 cột chi tiết
- [ ] Toast cảnh báo khi thêm sản phẩm sắp hết hàng (`stock <= minStock`)

### Giai đoạn 2 — AI Agent Layer ✅ MIGRATION HOÀN TẤT (2026-05-08)

**Kiến trúc**: Tất cả Claude calls đi qua backend route `routes/ai.ts`, được mount từ `server.ts`. Frontend chỉ `fetch('/api/ai/...')`. API key chỉ server-side.

**Migration Gemini → Claude (hoàn tất)**:
- [x] `Dashboard.tsx` — `/api/ai/executive-briefing`, `claude-haiku-4-5`
- [x] `PromotionManager.tsx` — `/api/ai/promotion-analysis`
- [x] `ProductGroupManager.tsx` — `/api/ai/product-group-analysis`
- [x] `RevenueManager.tsx` — `/api/ai/revenue-analysis`, `claude-sonnet-4-6`
- [x] `ExpenseManager.tsx` — `/api/ai/expense-classify` + `/expense-scan`
- [x] `KnowledgeManager.tsx` — `/api/ai/knowledge-ocr`, Claude document blocks
- [x] `ChatInterface.tsx` — `/api/ai/chat` (multi-turn tool use) + `/api/ai/classify`
- [x] `ApiKeySettings.tsx` — rewrite thành connection test (`GET /api/ai/test-connection`)
- [x] Xóa `marketingGeminiService.ts`, thay bằng `marketingClaudeService.ts`

**Agent Services**:
- [x] 6 Specialized Agents — CFO, HR, Sales, Inventory, Marketing, Operations
- [x] Orchestrator route câu hỏi — `/api/ai/classify` (Haiku, ~200ms)
- [x] EOD Report tự động 21:00 VN — Email + Zalo OA
- [x] Cảnh báo thông minh theo ngưỡng — tồn kho, nợ NCC, doanh thu drop; TopNav bell poll 10 phút

**UX (hoàn tất)**:
- [x] Dashboard: P&L waterfall card, auto-load Executive Briefing 1 lần/ngày
- [x] EOD Report: AI summary bar
- [x] `ErrorBoundary` — reset theo tab, hiện tên module + nút Thử lại
- [x] Bell notification + alert dropdown trong TopNav

### Giai đoạn 3 — Scale (4-6 tháng) — CHƯA BẮT ĐẦU
- [ ] Tối ưu performance: virtualization danh sách 12.739+ SKU
- [x] Refactor bước 1: `POSComputer.tsx` 2361 → 824 dòng; `GoodsInventory.tsx` 4260 → 534 dòng; `ExpenseManager.tsx` 1522 → 561 dòng
- [ ] Đa chi nhánh (multi-branch)
- [ ] Multi-tenant SaaS
- [ ] Tích hợp TikTok Shop, Lazada, GHN/GHTK
- [ ] AI Analytics: time-series forecasting doanh thu
- [ ] Real-time Sync: Supabase Realtime (Websockets) thay vì poll

---

## Technical Debt Backlog (§10.5 — review 2026-05-10)

### P0 — Nghiệp vụ & nhất quán dữ liệu ✅ ĐÃ XỬ LÝ (2026-05-10)

| # | Vấn đề | Vị trí |
|---|--------|--------|
| 1 | Bán có thể **âm kho** | Đã chặn ở `addToCart`, barcode, `updateQuantity`, và re-check lần cuối trong `handleCheckout` trước khi ghi `updatedProducts` |
| 2 | **Tính tiền `discount`** không thống nhất | Đã thống nhất công thức item total = `quantity * (price - discount)` khi thêm, đổi số lượng, cập nhật giảm giá |
| 3 | **`pushBatch` vs `updateSurgical` khi offline** | Đã enqueue `updateSurgical` vào IndexedDB bằng `upsertItem`/`deleteItem` khi lỗi mạng, tương đương `pushBatch` |

### P1 — Sổ sách, audit, giao dịch nhiều bước

| # | Vấn đề | Ghi chú |
|---|--------|---------|
| 4 | ~~Ghi **revenue từ POS** không phản ánh COGS~~ | Đã xử lý 2026-05-10 — POS tính `totalCogs` từ `importPrice * quantity`, `grossProfit = netRevenue - totalCogs` |
| 5 | ~~**`inventoryTransactions` snapshot** có thể lệch~~ | Đã giảm rủi ro 2026-05-10 — log Sale/Return/Exchange lấy `newStock` từ `updatedProducts` cùng lần cập nhật tồn kho |
| 6 | **Transaction/idempotency** | Đã thêm checkout lock chống double-submit và các replay dùng upsert theo `id`; transaction DB thật vẫn là nâng cấp dài hạn qua backend/RPC |

### P2 — Kiến trúc & hygiene

| # | Vấn đề | Ghi chú |
|---|--------|---------|
| 7 | `POSComputer.tsx` monolith (~2180 dòng) | Đã giảm còn 824 dòng; đã tách `POSCart`, `POSCheckout`, `POSConsultant`, `POSReceiptModal`, `POSReturnModal`, `POSItemDiscountPopup`, `POSBillDiscountPopup`, `POSToasts`, `POSQuickCustomerModal`, `POSHeaderToolbar`, `usePOSKeyboard`, `usePOSReturnFlow`, `usePOSTabs` |
| 8 | `GoodsInventory.tsx` monolith (~4260 dòng) | Đã giảm còn 534 dòng; đã tách `GoodsAuditForm`, `GoodsPurchaseForm`, `GoodsFilterSidebar`, `GoodsProductRow`, `GoodsProductForm`, `GoodsCreateProductModal`, `GoodsCreateProductInfoTab`, `GoodsCreateProductTextTab`, `GoodsVariantModal`, `GoodsImportExport`, `GoodsColumnSettings`, `GoodsUnitModals`, `GoodsToolbar`, `GoodsPagination`, `GoodsBulkActions`, `GoodsProductTableHeader`, `GoodsProductTableBody`, `GoodsProductDetailPanel`, `GoodsProductsWorkspace`, `GoodsInventoryModals`, `GoodsInventoryNavigation`, `GoodsInventoryFeedback`, `GoodsInventoryColumns`, `GoodsLegacyProductFormView`, `useGoodsFilters`, `useGoodsProductEditor`, `useGoodsVariantWorkflow`, `useGoodsPurchase`, `useGoodsAudit`, `useGoodsExcelImport`, `useGoodsSelection` |
| 8.1 | `ExpenseManager.tsx` monolith (~1522 dòng) | Đã giảm còn 561 dòng; đã tách `ExpenseTabs`, `ExpenseSharedUI`, `useExpenseRecurring`, `useExpenseAnalytics`, `ExpenseRecurringTab`, `ExpenseEfficiencyTab`, `ExpenseLedgerTab`, `ExpenseCategoriesTab` |
| 9 | ~~`onPlaceOrder`/`onReturnOrder` trong `MainContent.tsx`~~ | Đã xử lý 2026-05-10 — tách sang `services/posOrderService.ts`, thêm unit test cho COGS/revenue và stock snapshot |
| 10 | ~~Type/UI thừa~~ | Đã xử lý 2026-05-10 — `POSComputer` dùng `BrandProfile` từ `types.ts`, không còn local duplicate |
| 11 | ~~**Stale closure** shortcut & effect~~ | Đã xử lý 2026-05-10 — shortcut F9 dùng `checkoutRef`/`cartLengthRef`, listener chỉ đăng ký một lần |

### P3 — Hiệu năng

| # | Vấn đề | Giải pháp |
|---|--------|-----------|
| 12 | 10k+ SKU — scan/search full-array | Virtual list + index SKU/barcode, hoặc search server-side |
| 13 | 2 listener `keydown` trên window | Gom shortcut quầy + global barcode, thứ tự ưu tiên rõ ràng |
| 14 | `console.log` trong drain offline | `useOfflineSync.ts` — gom sau flag debug |

### P4 — Dự án

| # | Vấn đề | Ghi chú |
|---|--------|---------|
| 15 | Tests | Hầu như chỉ `businessLogic.test.ts` — chưa có test luồng đặt hàng / mapping tồn / POS handler |

---

## Kiến trúc đánh giá (tầm nhìn dài hạn)

**Điểm mạnh**: Offline-First ổn định, Type-safe tuyệt đối, Logic nghiệp vụ tập trung (`businessLogic.ts`), Kiến trúc AI Agent chuyên biệt rất tiến bộ.

**Điểm yếu**: Còn một số component lớn cần refactor tiếp (Dashboard, MarketingManager, ProductGroupManager, PromotionManager, KnowledgeManager), fetch dữ liệu chưa tối ưu cho >100K records.

**Khi scale lên (tương lai)**:
- **Modularize Backend**: Bước 1 đã xong — `server.ts` tách thành `routes/ai.ts`, `routes/facebook.ts`, `routes/notifications.ts`, `routes/import.ts`. Bước sau: cân nhắc tách tiếp route POS/auth riêng khi backend POS lớn hơn.
- **Feature-based Architecture**: Khi >50 components, mỗi folder feature chứa API + components + hooks + types riêng
- **Real-time Sync**: Supabase Realtime (Websockets) thay vì poll/manual sync
