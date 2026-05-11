# CLAUDE.md — CFO Brain 4.0

> File này tải mỗi session — giữ ngắn gọn.
> Chi tiết quyết định kỹ thuật → `DECISIONS.md` | Lịch sử roadmap & tech debt → `ROADMAP.md`

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

**Env vars**: Frontend prefix `VITE_` (vd: `VITE_SUPABASE_URL`) | Backend không prefix  
**Model AI**: quick tasks → `claude-haiku-4-5`, analysis → `claude-sonnet-4-6`

---

## 5. Trạng thái hiện tại (2026-05-11)

**Đã hoàn thành**: Giai đoạn 0 (Bảo mật) ✅ | Giai đoạn 1 (POS & Vận hành) ✅ | Giai đoạn 2 (AI Agents) ✅

**Backend refactor (2026-05-10)**:
- `server.ts` đã tách route, còn ~176 dòng bootstrap.
- Route files: `routes/ai.ts`, `routes/facebook.ts`, `routes/notifications.ts`, `routes/import.ts`.

**Bước tiếp theo (Giai đoạn 3)**:
- Tối ưu performance: virtualization cho danh sách 12.739+ SKU (`react-window` hoặc `tanstack-virtual`)
- Refactor god components: ✅ POSComputer (2361 → 824L), GoodsInventory (4260 → 534L), ExpenseManager (1522 → 561L)
- Scale: đa chi nhánh, multi-tenant SaaS
- Tích hợp: TikTok Shop, Lazada, GHN/GHTK

**POS — pending (chờ hình mẫu từ User)**:
- Payment method-specific UI (Split Payment layout riêng)
- Return Layout Redesign (màu nền riêng, khóa ô tìm kiếm)
- CRM Customer Modal 2 cột chi tiết
- Quản lý ca làm việc — tạm hoãn (chủ tự đứng thu ngân)

**SQL cần chạy thủ công trên Supabase dashboard** (đã có trong `supabase_setup.sql`):
```sql
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS customer_orders INTEGER DEFAULT 0;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS direct_sale BOOLEAN DEFAULT true;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'Hàng hóa';
```
