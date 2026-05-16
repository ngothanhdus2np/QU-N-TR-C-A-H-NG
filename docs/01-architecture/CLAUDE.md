# CLAUDE.md — CFO Brain 4.0

> File này tải mỗi session — giữ ngắn gọn.
> Chi tiết quyết định kỹ thuật → `DECISIONS.md` | Lịch sử roadmap & tech debt → `ROADMAP.md`

## 🔴 QUY TRÌNH BẮT BUỘC — ĐẦU VÀ CUỐI MỖI PHIÊN

**TRƯỚC khi làm bất cứ gì:**
1. Đọc [`HISTORY.md`](HISTORY.md) — xem TODO và phiên trước đã làm gì
2. Đọc [`AGENTS.md`](AGENTS.md) — quy tắc code chung cho tất cả agents (nguồn sự thật chung)

---

## CẤU TRÚC TEAM — MULTI-AGENT

Claude là **Tech Lead** và **source of truth**. Các agent khác follow theo rules trong `AGENTS.md`.

| Agent | Platform | Vai trò mặc định |
|-------|----------|-----------------|
| **Claude (bạn)** | Claude Code | Tech Lead — implement, kiến trúc, cập nhật HISTORY.md |
| **ChatGPT** | Codex | Developer #2 — code tiếp khi Claude hết context limit |
| **Gemini** | Antigravity | Developer #3 — code tiếp hoặc nhận vai QA |

**Khi hết context limit giữa task:** Cập nhật `HISTORY.md` section "Còn lại / Dang dở" đầy đủ — ghi rõ đang ở file nào, bước nào, logic nào chưa xong — để agent tiếp theo có thể tiếp tục không bị gián đoạn.

**File roles cho agent khác:** [`ROLE_REVIEWER.md`](ROLE_REVIEWER.md) (review code) | [`ROLE_QA.md`](ROLE_QA.md) (test/QA)

**SAU khi hoàn thành task:**
1. Mở `HISTORY.md`
2. Thêm một phiên mới lên đầu section "Lịch sử phiên làm việc" với format:
   ```
   ### YYYY-MM-DD — Claude (claude-sonnet-4-6) — Phiên N
   **Đã làm:** [liệt kê file đã sửa + lý do]
   **Kết quả kiểm tra:** TypeScript ✅/❌ | Tests ✅/❌
   **Ghi chú kỹ thuật:** [điều gì không rõ ràng, quyết định quan trọng]
   ```
3. Cập nhật section **TODO** — thêm việc mới phát sinh, tick ✅ việc đã xong

---

## 1. Stack

- **Frontend**: React 19 + TypeScript + Vite + Recharts + Framer Motion
- **Backend**: Express.js + Node.js (`server.ts` bootstrap + `routes/*`)
- **Database**: Supabase (PostgreSQL) — 26 bảng
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) — backend-only qua `routes/ai.ts`
- **Offline**: LocalStorage fallback (`cfo_brain_local_data`)
- **Dev**: `npm run dev` (port 3000)

---

## 2. Cấu trúc chính

```
businessLogic.ts        — Core calculations, export generateId
server.ts               — Express bootstrap, middleware, Supabase, route mounting, scheduler startup
routes/
  ai.ts                 — Claude AI endpoints (`/api/ai/*`)
  facebook.ts           — Facebook OAuth/posting + auto-post scheduler helpers
  notifications.ts      — EOD, notifications, alerts + notification scheduler helper
  import.ts             — KiotViet import/sync endpoints
types.ts                — TypeScript interfaces toàn app
services/
  apiService.ts         — Supabase CRUD, table mapping
  dataMapper.ts         — Cloud ↔ localStorage merge (KHÔNG XÓA)
  supabase.ts           — Supabase client
  marketingClaudeService.ts
  agents/               — claudeClient, cfoAgent, alertAgent, eodAgent
hooks/useAppData.ts     — Main state (useReducer)
components/
  TopNav.tsx            — Top navigation 2 tầng kiểu KiotViet
  pos/                  — POSComputer (824L), GoodsInventory (534L), CustomerPoints, SupplierManager
    POSCart, POSCheckout, POSConsultant, POSHeaderToolbar — sub-components của POSComputer
    POSReceiptModal, POSReturnModal, POSQuickCustomerModal, POS*Popup — modals của POSComputer
    usePOSKeyboard, usePOSReturnFlow, usePOSTabs — hooks của POSComputer
    GoodsAuditForm, GoodsPurchaseForm, GoodsFilterSidebar, GoodsProductRow
    GoodsProductForm, GoodsCreateProductModal, GoodsCreateProductInfoTab, GoodsCreateProductTextTab
    GoodsVariantModal, GoodsImportExport, GoodsColumnSettings, GoodsUnitModals, GoodsToolbar
    GoodsPagination, GoodsBulkActions, GoodsProductTableHeader, GoodsProductTableBody, GoodsProductDetailPanel
    GoodsProductsWorkspace, GoodsInventoryModals, GoodsInventoryNavigation, GoodsInventoryFeedback, GoodsInventoryColumns
    GoodsLegacyProductFormView, useGoodsFilters, useGoodsProductEditor, useGoodsVariantWorkflow, useGoodsPurchase, useGoodsAudit, useGoodsExcelImport, useGoodsSelection
  revenue/              — 9 sub-components (split từ RevenueManager)
  payroll/              — split từ PayrollManager
  expense/              — ExpenseManager (561L): tabs, recurring, ledger, categories, analytics hook
  ui/                   — ConfirmDialog, ErrorBoundary, InputModal
.claude/
  hooks/PostToolUse.sh  — Auto tsc --noEmit sau mỗi Edit/Write .ts/.tsx
  rules/codebase.md     — Condensed rules
  agents/code-reviewer.md
  commands/             — /test, /check, /dev
```

---

## 3. Design system

- **Background**: `#f8fafc` (Slate 50) | **Accent**: `#6366f1` (Indigo 600)
- **Lãi**: `text-emerald-600` | **Lỗ**: `text-rose-600` | **Cảnh báo**: `text-amber-600`
- **Border radius**: `0.75rem` (12px) thống nhất — input, button, card
- **Shadow**: `shadow-sm` / `shadow-md` — không dùng shadow đậm
- **Font**: Inter (Sans-serif)

---

## 4. Quy tắc bất di bất dịch

**KHÔNG được:**
- Xóa merge logic trong `services/dataMapper.ts` — offline-first
- Hardcode secrets — chỉ `.env.local`, không commit file này
- Thêm `updated_at`/`created_at` vào Supabase payload nếu bảng không có cột đó
- Bỏ qua `requireAuth` cho API routes mutate data
- Dùng `dangerouslySetInnerHTML` mà không wrap `DOMPurify.sanitize()`
- Import `@anthropic-ai/sdk` trong frontend — AI calls chỉ từ backend route `routes/ai.ts`
- Dùng `console.log` trong production — chỉ `console.error` tại catch blocks
- Giữ dead files "để an toàn" — nếu không có import → xóa (dùng git history)

**LUÔN phải:**
- Dùng `generateId()` từ `../../businessLogic` — không khai báo local copy trong component
- Hỏi và chờ xác nhận trước khi edit bất kỳ file nào
- Viết SQL mới vào `supabase_setup.sql` trước khi dùng bảng/cột mới
- Ghi `auditLog()` cho mọi thay đổi tài chính/lương
- Chạy `npm test` sau khi sửa `businessLogic.ts` hoặc tách logic POS/Goods — 45 tests phải pass
- Lương trách nhiệm chỉ tính khi có `responsibilityApprovals` — không tự ý thay đổi
- Tự động commit sau khi hoàn thành task (không cần hỏi lại) — message ngắn gọn, tiếng Anh, theo conventional commits

**Env vars**: Frontend prefix `VITE_` (vd: `VITE_SUPABASE_URL`) | Backend không prefix  
**Model AI**: quick tasks → `claude-haiku-4-5`, analysis → `claude-sonnet-4-6`

---

## 5. Khi làm Code Review

> Khi user yêu cầu review / kiểm tra code, bắt buộc dùng checklist trong `AGENTS.md — PHẦN 4`.

**Quy tắc:**
- Đi qua **đủ 7 danh mục** theo thứ tự: Security → Data Integrity → Error Handling → Performance → Type Safety → Business Logic → Code Quality
- **Không dừng sau 1 lỗi** — phải hoàn thành toàn bộ checklist
- Mỗi mục ghi: ✅ OK / ⚠️ Cần xem xét / ❌ Lỗi + mô tả cụ thể
- Kết thúc bằng danh sách tổng hợp: 🔴 Critical → 🟠 Medium → 🟡 Low

---

## 6. Trạng thái hiện tại (2026-05-12)

**Đã hoàn thành**: Giai đoạn 0 (Bảo mật) ✅ | Giai đoạn 1 (POS & Vận hành) ✅ | Giai đoạn 2 (AI Agents) ✅

**Backend refactor (2026-05-10)**:
- `server.ts` đã tách route, còn ~176 dòng bootstrap.
- Route files: `routes/ai.ts`, `routes/facebook.ts`, `routes/notifications.ts`, `routes/import.ts`.

---

### ⏳ Việc đang dở / Chưa làm

**Ưu tiên cao — làm ngay phiên sau:**
- **Re-import file KiotViet** (1 lần) — fix `related_sku` đã áp dụng, cần re-import để 12739 sản phẩm có đủ `parent_id`/`is_parent`/`variant_count` → danh sách hiển thị cha-con; nếu vẫn lỗi: mở Network tab xem field `firstError` trong response
- Chi tiết quyết định kỹ thuật phiên 2026-05-12 → xem `HISTORY.md` phiên 24, 25, 26

**14 nav items chưa có trang** (hiện render blank):
- Hàng hóa: `goods-pricing`, `goods-warranty`, `goods-audit`, `goods-internal-use`, `goods-disposal`
- Mua hàng: `purchase-invoices`, `purchase-returns`
- Đơn hàng: `order-invoices`, `order-returns`, `order-repairs`, `delivery-partners`, `shipping-orders`

**POS — pending (chờ hình mẫu từ User)**:
- Payment method-specific UI (Split Payment layout riêng)
- Return Layout Redesign (màu nền riêng, khóa ô tìm kiếm)
- CRM Customer Modal 2 cột chi tiết
- Quản lý ca làm việc — tạm hoãn (chủ tự đứng thu ngân)

**Dài hạn (Giai đoạn 3)**:
- Tối ưu performance: virtualization cho danh sách 12.739+ SKU (`react-window` hoặc `tanstack-virtual`)
- Refactor god components: ✅ POSComputer (2361 → 824L), GoodsInventory (4260 → 534L), ExpenseManager (1522 → 561L)

---

**SQL đã chạy trên Supabase** (tích lũy đến 2026-05-12) ✅:
- `pos_products`: `customer_orders`, `direct_sale`, `product_type`
- `pos_products`: `variant_attributes JSONB`, `parent_id TEXT`, `is_parent BOOLEAN`, `variant_count INTEGER`
