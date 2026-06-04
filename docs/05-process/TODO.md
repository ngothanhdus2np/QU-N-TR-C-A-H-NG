# TODO.md — Danh sách việc cần làm

> Agent cuối ca → cập nhật file này: đánh dấu xong, thêm task mới, ghi lý do block.
> Xem HISTORY.md để biết context từ phiên trước.

---

## 🔴 P0 — Ưu tiên cao (làm trước)

### Kiểm tra kỹ thuật

- [x] ~~Chạy `npx tsc --noEmit`~~ — TypeScript clean (1 lỗi pre-existing ở GoodsInventory.tsx không liên quan) ✅ *(2026-05-18)*
- [x] ~~**Audit & fix toàn bộ tiểu mục Báo cáo**~~ — 9 trang báo cáo, 11 file ✅ *(2026-05-18)*
- [x] ~~**Audit UI trống / nút không phản hồi toàn app**~~ — fix AnalysisContainer 2 case, 2 form tab, copy button, 13 files alert→toast ✅ *(2026-05-19)*
- [x] ~~**Audit & fix toàn bộ 8 trang Phân tích**~~ — 13 bugs: payroll missing, shopeeRevenue excluded, lineTotal calc, Cell vs rect, stock velocity, date filters, staff name resolution ✅ *(2026-05-22)*
- [x] ~~Chạy `npm test`~~ — 162 tests pass ✅ *(2026-05-16)*
- [x] ~~Fix 4 TypeScript lint debt errors~~ — đã fix showToast type errors ✅ *(2026-05-16)*
- [x] ~~Implement virtualization cho 12,739+ SKU~~ — đã implement @tanstack/react-virtual ✅ *(2026-05-16)*

- [x] ~~**Mở rộng AI CFO — thêm 4 tools mới**~~ — query_pos_orders, get_product_details, get_customer_stats, get_product_group_revenue + domain customers ✅ *(2026-05-22)*

- [x] ~~**Hệ thống nợ lương chuyển kỳ (carry-forward debt)**~~ — tích hợp đầy đủ: tính toán, hiển thị, in phiếu, nút tính lại lịch sử ✅ *(2026-05-26)*

> **Note**: Đã hoàn thành tất cả P0 tasks! 🎉

> **Việc cần làm trên Supabase dashboard**: chạy 3 lệnh ALTER TABLE trong `supabase_setup.sql` (phần cuối file, section "Carry-forward debt system") để thêm cột vào database thực.

---

## 🟠 P1 — Ưu tiên trung bình

- [x] ~~**Type hóa `services/dataMapper.ts` + `hooks/useAppData.ts`**~~ — giảm ~110 warning `any` còn lại *(xong 2026-05-15)*
  - Thay `previousData?: any` → `previousData?: AppDataItem<keyof AppData> | { id: string }`
  - Thêm import `AppDataItem` vào useAppData.ts
  - TypeScript clean, 162 tests pass

---

## 🔴 P0 — NGUY CƠ CAO: Refactor SettingsCenter.tsx (lag nặng)

> **Triệu chứng:** Trang Cài đặt lag, khó thao tác — mỗi gõ phím re-render toàn bộ.
> **Đã fix tạm:** `barcodeLabelPrintCss` → `useMemo` (2025-05-15).
> **Chưa fix gốc rễ:** 3,864 dòng + 48 useState monolithic.

- [x] ~~**Tách `SettingsCenter.tsx` thành các tab component độc lập**~~ *(đang làm - 3/4 tabs xong)*
  - [x] ~~PaymentsTab~~ *(xong 2026-05-15)*
  - [x] ~~AppearanceTab~~ *(xong 2026-05-15)*
  - [x] ~~GoodsTab~~ *(xong 2026-05-15)*
- [x] ~~**PrintTemplatesTab**~~ *(hoàn thành 100% - 2026-05-16)*
  - [x] ~~Invoice template~~ (xong)
  - [x] ~~Exchange template~~ (xong)
  - [x] ~~Barcode label template~~ (xong)
  - [x] ~~Payroll template~~ (xong)
  - [x] ~~Xóa code cũ trong SettingsCenter.tsx~~ (xong)

**Kết quả**: 
- ✅ File `PrintTemplatesTab.tsx` hoàn chỉnh (1699 dòng)
- ✅ TypeScript clean, 162/162 tests pass
- ✅ 4/4 templates hoàn chỉnh (Invoice + Exchange + Barcode + Payroll)
- ✅ Tất cả templates có editor + preview + print functionality
- ✅ **SettingsCenter.tsx giảm từ 2922 xuống 1157 dòng (giảm 60.4% / 1765 dòng)**
- ✅ Đã xóa toàn bộ: states (19 states), refs (3 refs), constants (5 constants), helper functions (12 functions), useMemo templates (3 useMemo)

### Cách làm (agent khác đọc và làm theo):

**Nguyên tắc:** Mỗi tab trở thành 1 component riêng, nhận `settings` qua props và callback `onSave`. State nội bộ (form đang nhập) chỉ sống trong tab đó — không bubble lên parent.

**Thứ tự tách (an toàn nhất → phức tạp nhất):**

1. **`PaymentsTab`** — state: `paymentForm`, `paymentAccountTab`, `editingAccount`, `accountModalTab`, `showPaymentAccountModal`
   - File mới: `components/settings/tabs/PaymentsTab.tsx`
   - Props nhận vào: `settings: POSPaymentSettings`, `onSave: (s: POSPaymentSettings) => void`
   - Di chuyển toàn bộ hàm `renderPaymentsTab()` + state liên quan vào component mới
   - Giữ `savePaymentSettings()` trong tab, gọi `onSave` sau khi save

2. **`AppearanceTab`** — state: `appearanceForm`, các barcode states (10 state)
   - File mới: `components/settings/tabs/AppearanceTab.tsx`
   - Đây là tab chứa `barcodeLabelPrintCss` nặng nhất

3. **`PrintTemplatesTab`** — state: `invoiceTemplateBody`, `exchangeTemplateBody`, `payrollTemplateBody`, `editingPrintTemplate*`
   - File mới: `components/settings/tabs/PrintTemplatesTab.tsx`

4. **`GoodsTab`** — phức tạp nhất, để cuối
   - State liên quan: `barcodeLabelColumns`, products, categories...

**Cách tách từng tab (pattern chuẩn):**
```tsx
// Bước 1: Tạo file mới
// components/settings/tabs/PaymentsTab.tsx
const PaymentsTab: React.FC<{
  settings: POSPaymentSettings;
  onSave: (s: POSPaymentSettings) => void;
}> = ({ settings, onSave }) => {
  const [form, setForm] = useState(settings);
  // ... toàn bộ logic từ renderPaymentsTab()
};
export default React.memo(PaymentsTab);

// Bước 2: Trong SettingsCenter.tsx, thay renderPaymentsTab() bằng:
// <PaymentsTab settings={posPaymentSettings} onSave={savePaymentSettings} />

// Bước 3: Xóa state đã chuyển sang tab mới khỏi SettingsCenter
```

**Kiểm tra sau mỗi tab tách:**
```bash
npx tsc --noEmit   # phải clean
npm test           # 43 tests phải pass
```

**Rủi ro cần lưu ý:**
- `savePaymentSettings` gọi Supabase — giữ nguyên logic, chỉ chuyển vào tab
- Modal `showPaymentAccountModal` dùng `createPortal` hoặc render trong tab cũng được
- Không xóa state trong SettingsCenter cho đến khi đã verify tab mới hoạt động

---

## 🟠 P1 — Tách file lớn (>1000 dòng, chưa có kế hoạch)

> Phát hiện 2026-05-15 khi quét toàn bộ codebase. Làm theo thứ tự: KnowledgeManager → GoodsInventory → POSComputer → PurchaseOrdersContainer.

---

### Tách `KnowledgeManager.tsx` (1,565 dòng)

- [x] ~~**Tách `KnowledgeManager.tsx`**~~ → `components/knowledge/` *(hoàn thành 100% - 2026-05-16)*
  - [x] ~~MechanismsViolationsSubTab~~ *(xong 2026-05-15, 152 dòng)*
  - [x] ~~MechanismsHolidaysSubTab~~ *(xong 2026-05-15, 82 dòng)*
  - [x] ~~MechanismsSalarySubTab~~ *(xong 2026-05-16, 394 dòng)*
  - [x] ~~StandardsWorkflowsTab~~ *(xong 2026-05-16, 239 dòng)*

**Kết quả**: File giảm từ 1565 → 778 dòng (**giảm 50.3%** / 787 dòng)

**Cấu trúc tab hiện tại:**
- `activeMainTab`: `'mechanisms' | 'standards' | 'workflows'`
- `activeMechSubTab`: `'salary' | 'holidays' | 'tet' | 'violations'`
- Tab `mechanisms` chứa 4 sub-tab, mỗi sub-tab ~200 dòng JSX
- Tab `standards` và `workflows` dùng chung layout, chỉ khác data

**Thứ tự tách:**

1. **`MechanismsSalarySubTab`** — dòng 395–788 (sub-tab Lương)
   - File mới: `components/knowledge/MechanismsSalarySubTab.tsx`
   - Props: `data: AppData`, `onUpdateData: (d: Partial<AppData>) => void`, `policyForm`, `setPolicyForm`, `selectedPolicyId`, `setSelectedPolicyId`
   - Chứa toàn bộ UI nhập cơ chế lương, bảng allowance

2. **`MechanismsViolationsSubTab`** — dòng 863–981 (sub-tab Vi phạm)
   - File mới: `components/knowledge/MechanismsViolationsSubTab.tsx`
   - Props: `localViolations`, `setLocalViolations`, `hasUnsaved`, `onSave`

3. **`MechanismsHolidaysSubTab`** — dòng 789–862 (sub-tab Nghỉ lễ)
   - File mới: `components/knowledge/MechanismsHolidaysSubTab.tsx`

4. **`StandardsWorkflowsTab`** — dòng 1142–1517 (tab Quy chuẩn + Quy trình dùng chung layout)
   - File mới: `components/knowledge/StandardsWorkflowsTab.tsx`
   - Props: `mode: 'standards' | 'workflows'`, `articles`, `onSave`, `onDelete`

**Pattern tách:**
```tsx
// components/knowledge/MechanismsViolationsSubTab.tsx
const MechanismsViolationsSubTab: React.FC<{
  localViolations: ViolationType[];
  setLocalViolations: (v: ViolationType[]) => void;
  hasUnsaved: boolean;
  onSave: (violations: ViolationType[]) => void;
}> = ({ localViolations, setLocalViolations, hasUnsaved, onSave }) => {
  // ... di chuyển JSX từ dòng 863–981 vào đây
};
export default React.memo(MechanismsViolationsSubTab);

// Trong KnowledgeManager.tsx thay bằng:
{activeMechSubTab === 'violations' && (
  <MechanismsViolationsSubTab
    localViolations={localViolations}
    setLocalViolations={setLocalViolations}
    hasUnsaved={hasUnsavedViolations}
    onSave={handleSaveViolations}
  />
)}
```

**Rủi ro:** `AllowanceInput`, `AllowanceRow`, `InputWrapper` (dòng 1518–1564) là helper components — giữ trong file riêng `components/knowledge/KnowledgeSharedUI.tsx` để dùng chung.

---

### Tách `GoodsInventory.tsx` (1,172 dòng)

- [x] ~~**Tách `GoodsInventory.tsx`**~~ → tách barcode utils ra ngoài *(xong 2026-05-15)*
  - [x] ~~Tách barcode utils~~ — dòng 63–364 (pure functions, không dùng hook)
    - File mới: `components/pos/goods/barcodeUtils.ts` (233 dòng)
    - Di chuyển: `CODE_128_PATTERNS`, `normalizeCode128Text`, `buildCode128Svg`, `buildLabelProductName`, `getBarcodeLabelTemplateSettings`, `printProductLabels`
    - Export tất cả, import lại trong `GoodsInventory.tsx`
  - [ ] **Tách `GoodsInventoryFilters`** — phần filter state + sidebar *(deferred)*
    - State cần chuyển: `filterCategories`, `filterBrand`, `filterStock`, `filterLocation`, `filterAttrs`, `filterSupplier`, `sortKey`, `sortDirection`
    - Hoặc gom vào custom hook `useGoodsFilters()` trả về toàn bộ filter state + handlers
  - [ ] **Tách `useGoodsBarcodeLabel` hook** — state barcode label template *(deferred)*
    - State: `barcodeLabelTemplate`, `labelsPerProduct`, `showBarcodePreview`
    - File mới: `components/pos/goods/useGoodsBarcodeLabel.ts`

**Kết quả đạt được:** `GoodsInventory.tsx` giảm từ 1172 → 849 dòng (**-27.5%** / 323 dòng), barcodeUtils.ts 233 dòng.

**Rủi ro đã xử lý:** `printProductLabels` gọi `window.print()` — giữ nguyên logic, chỉ chuyển file.

---

### Tách `POSComputer.tsx` (1,113 dòng)

- [x] ~~**Tách `POSComputer.tsx`**~~ → tách state ra custom hook *(xong 2026-05-15)*
  - [x] ~~Tách `usePOSState` hook~~ — tất cả state management logic
    - File mới: `hooks/usePOSState.ts` (243 dòng)
    - File mới: `components/pos/types.ts` (InvoiceTab interface)
    - Di chuyển ~30 useState vào hook
    - Bao gồm: search states, tab states, modal states, UI states, feedback states
    - Helper functions: openConfirm, closeConfirm, showScanFeedback, showStockWarning, resetNewCustomerForm
  - [x] ~~Cập nhật POSComputer.tsx~~ — sử dụng usePOSState hook
    - Xóa tất cả useState declarations (~80 dòng)
    - Xóa helper functions đã chuyển vào hook
    - Giữ lại refs (productSearchRef, checkoutRef, etc.) vì liên quan DOM
    - Giữ lại business logic (addToCart, updateQuantity, handleCheckout, etc.)
  - [x] ~~Tách InvoiceTab interface~~ — tránh circular dependency
    - File mới: `components/pos/types.ts`
    - Cập nhật imports trong: usePOSReturnFlow.ts, usePOSTabs.ts, POSCheckout.tsx, POSHeaderToolbar.tsx

**Kết quả đạt được:** `POSComputer.tsx` giảm từ 1113 → 1021 dòng (**-8.3%** / 92 dòng), usePOSState.ts 243 dòng.

**Lợi ích:**
- Giảm re-render: State được tách riêng, dễ optimize với React.memo
- Dễ test: Hook có thể test độc lập
- Dễ maintain: Logic state tách biệt khỏi UI logic
- Tránh stale closure: Refs vẫn giữ trong component chính

**Rủi ro đã xử lý:** 
- Circular dependency: Tách InvoiceTab ra file riêng
- Refs không chuyển vào hook: checkoutRef, cartLengthRef cần ở component level để fix stale closure

---

### Tách `PurchaseOrdersContainer.tsx` (1,086 dòng)

- [x] ~~**Tách `PurchaseOrdersContainer.tsx`**~~ → tách form state ra hooks *(xong 2026-05-15)*
  - [x] ~~Tách `usePurchaseFormState` hook~~ — purchase + return form states
    - File mới: `hooks/usePurchaseFormState.ts` (105 dòng)
    - Di chuyển 14 useState: purchaseItems, purchaseSupplier, purchaseNote, purchaseDiscountValue, purchaseDiscountType, returnItems, returnSupplier, returnNote, returnDiscountValue, returnDiscountType, returnSupplierPaidAmount, returnApplySupplierDebt, showPurchaseForm, showPurchaseReturnForm
    - Helper functions: resetPurchaseForm, resetReturnForm, getPurchaseItemsNetTotal, getPurchaseBillDiscountAmount, getReturnItemsNetTotal, getReturnBillDiscountAmount, getReturnSupplierMustPay
  - [x] ~~Tách `usePurchaseQuickModals` hook~~ — quick product/supplier modal states
    - File mới: `hooks/usePurchaseQuickModals.ts` (75 dòng)
    - Di chuyển 10 useState: showQuickProductForm, quickProductTarget, quickProductModalTab, showQuickProductStockSection, showQuickProductLocationSection, showQuickProductUnitsSection, quickProductForm, showQuickSupplierForm, quickSupplierTarget
    - Helper function: resetQuickProductForm
  - [x] ~~Cập nhật PurchaseOrdersContainer.tsx~~ — sử dụng 2 hooks mới
    - Xóa 24 useState declarations
    - Xóa helper functions đã chuyển vào hooks
    - Giữ lại: refs, business logic, render logic
    - Cập nhật handleSaveDraft, handleCompletePurchase để dùng resetPurchaseForm

**Kết quả đạt được:** `PurchaseOrdersContainer.tsx` giảm từ 1087 → 1061 dòng (**-2.4%** / 26 dòng), 2 hooks mới 180 dòng.

**Lợi ích:**
- Giảm re-render: Form state tách riêng
- Dễ test: Hooks test độc lập
- Dễ maintain: Form logic tách biệt UI
- Tái sử dụng: Hooks có thể dùng cho các form tương tự

**Rủi ro đã xử lý:**
- Giữ lại getPurchaseLineTotal trong component vì được dùng nhiều nơi
- Refs không chuyển vào hook: purchaseFileInputRef, returnFileInputRef cần ở component level

---

**Kiểm tra sau mỗi file tách:**
```bash
npx tsc --noEmit   # phải clean
npm test           # 43 tests phải pass
```

---

## ✅ Hệ thống Hóa đơn đầu vào — HOÀN THÀNH 2026-05-17

- [x] ~~**Giai đoạn 1**: InvoiceBadge + cột Chứng từ trong PurchaseInvoices.tsx~~ *(xong 2026-05-17)*
- [x] ~~**Giai đoạn 2**: services/invoiceService.ts + types.ts + supabase_setup.sql~~ *(xong 2026-05-17)*
- [x] ~~**Giai đoạn 3**: Wire invoice state vào useGoodsPurchase + PurchaseOrdersContainer + GoodsInventory; GoodsPurchaseForm UI chọn trạng thái + upload file~~ *(xong 2026-05-17)*
- [x] ~~**Giai đoạn 4**: Báo cáo VAT + Xuất Excel 2 sheet trong PurchaseInvoices.tsx~~ *(xong 2026-05-17)*

**Việc thủ công trên Supabase dashboard:**
- [x] ~~Chạy SQL migration trong `supabase_setup.sql`~~ *(xong 2026-05-17)*
- [x] ~~Tạo Storage bucket `purchase-invoices` với policy: authenticated users INSERT + SELECT~~ *(xong 2026-05-17)*

---

## ✅ UI Refactor — Design System — HOÀN THÀNH 2026-06-04

- [x] ~~**Phase 1 — Foundation**: tailwind.config tokens, primary color unification~~ ✅ *(2026-06-04)*
  - `tailwind.config.js`: fontSize.2xs, colors (primary/muted/highlight), boxShadow (card/panel/dropdown/modal), zIndex (dropdown/sticky/overlay/modal/toast/tooltip)
  - 26 file: `bg-blue-600/700` → `bg-indigo-600/700` (thống nhất primary = indigo)
  - `Button`, `Modal`, `Badge` trong `shared/ui/`: fix variant sai, z-index token, shadow token
- [x] ~~**Phase 2 — Consistency**: typography, z-index, font-weight toàn app~~ ✅ *(2026-06-04)*
  - 1,131 arbitrary font sizes (`text-[10-13px]`) → `text-2xs/xs/sm`
  - 88 z-indexes loạn (`z-[100..10000]`) → `z-modal/z-toast/z-dropdown`
  - 401 `font-black` → `font-semibold` (labels không cần weight 900)
  - `Card.tsx`: shadow prop dùng tokens mới
- [x] ~~**Phase 3 — Polish**: EmptyState, Skeleton, micro-interactions~~ ✅ *(2026-06-04)*
  - Tạo `EmptyState` (compact/default, icon/title/description/action)
  - Tạo `Skeleton` + `TableSkeleton` + `CardSkeleton` + `SidebarSkeleton` (CSS animate-pulse)
  - 130 `transition-all` → `transition-colors` (43 file không có transform)
  - `shared/ui/index.ts`: export đủ 7 component (Button/Card/Input/Badge/Modal/EmptyState/Skeleton)

> **Việc còn lại sau 3 phase** (ưu tiên thấp, không block):
> - Thay ~320 `transition-all` còn lại trong file có transform (case-by-case)
> - Migrate các modal tự viết sang `Modal` component chuẩn
> - Migrate các empty state inline sang `EmptyState` component

---

## 🔵 P2 — Ưu tiên thấp / Phase tiếp theo

> **Note:** Layout Components proposal đã bị reject. Lý do: Refactor 20+ pages chỉ để tiết kiệm code là rủi ro cao/lợi ích thấp. Không fix bug, không thêm tính năng. Thời gian nên dùng cho những thứ user thực sự thấy.

### Refactoring

- [x] ~~**Tách `StaffManager.tsx`**~~ (827 dòng) → tách state ra hook *(hoàn thành 2026-05-16)*
  - [x] ~~Tạo `hooks/useStaffManagerState.ts`~~ (79 dòng)
  - [x] ~~Di chuyển 3 useState: activeTab, formData, editingEmployee~~
  - [x] ~~Thêm helpers: resetForm, loadEmployeeForEdit~~
  - [x] ~~Cập nhật StaffManager.tsx sử dụng hook~~
  - **Kết quả:** StaffManager.tsx giảm từ 827 → 821 dòng (-0.7%), TypeScript clean, 190/190 tests pass ✅

- [x] ~~**Tách `PayrollManager.tsx`**~~ (777 dòng) → đã có hook từ trước *(verified 2026-05-16)*
  - **Trạng thái:** File này đã sử dụng `hooks/usePayrollState.ts` (comprehensive hook 243 dòng)
  - **Hook đã extract:** Tất cả state, constants, computed values, helpers
  - **Component chỉ còn:** Business logic handlers (finalize, settlement, undo, input changes)
  - **Kết luận:** Đã được tối ưu tốt, không cần refactor thêm ✅

### Theo dõi (650–800 dòng, chưa cần tách gấp)

- [x] ~~`GoodsInventory.tsx`~~ (849 dòng) — đã tách barcode utils + useGoodsFilters hook, đã tối ưu tốt *(2026-05-15)*
- [x] ~~`ProductGroupManager.tsx`~~ (827 dòng) — đã tách 3 sub-tabs (LedgerTab, MatrixTab, TreeTab), đã tối ưu tốt
- [x] ~~`StaffManager.tsx`~~ (821 dòng) — đã tách state ra hook useStaffManagerState *(2026-05-16)*
- [x] ~~`PayrollManager.tsx`~~ (777 dòng) — đã có hook usePayrollState từ trước, đã tối ưu tốt *(2026-05-16)*
- [ ] `types.ts` (791 dòng) — xem xét tách theo domain (pos, payroll, inventory...)
- [ ] `services/apiService.ts` (755 dòng) — xem xét tách theo module
- [ ] `hooks/useAppData.ts` (707 dòng) — đã có task type hóa ở P1

---

## 🔧 Shopee Monitor — Backfill dữ liệu phí đơn hàng cũ vào SQLite

> **Mục đích:** Các đơn hàng cũ trong SQLite chỉ có `total_fee` tổng gộp, thiếu 6 cột phí riêng lẻ vừa thêm (`commission_fee`, `service_fee`, `transaction_fee`, `piship_fee`, `vat_tax`, `pit_tax`). Script này gọi lại Shopee API để fill đầy đủ.

- [ ] **Tạo script `/Users/apple/shopee-monitor/scripts/backfill.js`**

### Điều kiện trước khi chạy

1. `shopee-bot` phải đang chạy (`pm2 status` → shopee-bot = online)
2. Trình duyệt Playwright đã đăng nhập Shopee Seller Center (còn session)

### Kế hoạch implement chi tiết

**Bước 1 — Kết nối vào browser đang chạy của shopee-bot:**

shopee-bot khởi động Playwright với `--remote-debugging-port`. Cần tìm port này (hoặc hardcode) và dùng `chromium.connectOverCDP()`:

```js
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];
```

> Nếu shopee-bot chưa expose CDP port, cần thêm `args: ['--remote-debugging-port=9222']` vào Playwright launch options trong `monitor.js`.

**Bước 2 — Đọc danh sách order_sn cần backfill:**

```js
const db = require('../src/db');
// Lấy các đơn chưa có commission_fee (= chưa backfill)
const orders = db.db.prepare(`
    SELECT o.order_sn FROM orders o
    LEFT JOIN order_details d ON o.order_sn = d.order_sn
    WHERE d.commission_fee IS NULL OR d.commission_fee = 0
    ORDER BY o.created_at DESC
`).all();
```

**Bước 3 — Gọi API income cho từng đơn (reuse logic từ monitor.js):**

```js
async function fetchOrderIncome(page, orderSn) {
    const result = await page.evaluate(async (sn) => {
        const url = `https://seller.shopee.vn/api/order/get_order_income_components/?order_sn=${sn}`;
        const r = await fetch(url, { credentials: 'include' });
        return r.json();
    }, orderSn);
    return result;
}
```

Parse response giống hệt logic trong `monitor.js` (hàm `parseBreakdown` / `getSub` / `get`).

**Bước 4 — UPDATE từng đơn vào SQLite:**

```js
const updateFees = db.db.prepare(`
    UPDATE order_details SET
        commission_fee  = ?,
        service_fee     = ?,
        transaction_fee = ?,
        piship_fee      = ?,
        vat_tax         = ?,
        pit_tax         = ?
    WHERE order_sn = ?
`);
```

**Bước 5 — Loop với delay để tránh rate limit:**

```js
for (const { order_sn } of orders) {
    try {
        const data = await fetchOrderIncome(page, order_sn);
        // parse fees từ data...
        updateFees.run(commissionFee, serviceFee, transactionFee, pishipFee, vatTax, pitTax, order_sn);
        console.log(`✅ ${order_sn}`);
    } catch (e) {
        console.log(`❌ ${order_sn}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500)); // 1.5s delay
}
```

**Chạy script:**

```bash
cd /Users/apple/shopee-monitor
node scripts/backfill.js
```

### Rủi ro cần xử lý

| Vấn đề | Xử lý |
|---|---|
| shopee-bot chưa expose CDP port | Thêm `--remote-debugging-port=9222` vào launch options |
| `get_order_income_components` trả empty cho đơn chưa complete | Bỏ qua (try/catch), chỉ update khi có data |
| Session hết hạn giữa chừng | Script sẽ nhận lỗi 401/redirect — dừng và báo |
| Nhiều đơn (1000+) | Delay 1.5s → ~25 phút/1000 đơn, có thể để chạy ngầm |

### Lưu ý thêm

- Sau khi backfill xong → confirm PiShip field name thực tế từ log (field_name trong API response)
- Nếu cần xem log realtime: `pm2 logs shopee-shop1`
- Script có thể chạy nhiều lần an toàn (chỉ update đơn chưa có fee)

---

## ⏸️ Blocked — Chờ hình mẫu từ user

*(Không còn item nào bị block)*

---

## ⏳ Tạm hoãn — Chưa đủ điều kiện

- [ ] **POS: Logic dữ liệu Chuyển khoản / Thẻ / Ví** — chờ trang cài đặt số tài khoản/phương thức; SQL có sẵn chưa bật
- [ ] **Quản lý ca làm việc** — chủ tự đứng thu ngân, tạm không cần
- [ ] **Đa chi nhánh / Multi-tenant** — cần quyết định UX + migration branch_id
- [ ] **Tích hợp TikTok Shop / Lazada** — cần API credentials + spec mapping
- [ ] **Tích hợp GHN / GHTK** — cần API token + quy trình vận đơn
- [ ] **Real-time Sync** — Supabase Realtime thay vì poll

---

## ✅ Hoàn thành gần đây

- [x] **POS: Split Payment UI riêng** — hoàn thành *(2026-05-16)*
- [x] **POS: Return Layout Redesign** — màu nền riêng, khóa ô tìm khi mode=return *(2026-05-16)*
- [x] **POS: CRM Customer Modal 2 cột** — layout 2 cột hoàn thành *(2026-05-16)*
- [x] **Revert display changes GoodsInventory** — xoá sort buttons header, xoá collapse sidebar, xoá bulk action toolbar, khôi phục UI phiên bản trước *(2026-05-16)*
- [x] **Fix 8 TypeScript errors GoodsInventory.tsx** — selectedIds/favoriteIds → Set, productGroups prop chain, discount props purchase form, audit transactions, onStartAudit handler, 4 row-action handlers, modal props *(2026-05-16)*
- [x] **Security audit & hardening** — rate limiting, Helmet headers, error tracking, security audit script *(2026-05-16)*
- [x] **Tạo shared UI components library** — Button, Card, Input, Badge, Modal với README đầy đủ *(2026-05-16)*
- [x] **Tăng test coverage** — viết 28 tests cho auditService, coverage tăng lên 72.82% *(2026-05-16)*
- [x] **Fix 4 TypeScript lint debt errors** — sửa showToast type errors trong GoodsInventory.tsx *(2026-05-16)*
- [x] **Implement virtualization** — cài đặt @tanstack/react-virtual, tạo GoodsVirtualizedTable.tsx cho 12,739+ SKU *(2026-05-16)*
- [x] **Đánh giá toàn bộ app** — tạo báo cáo đánh giá chi tiết (APP_EVALUATION_REPORT.md + EXECUTIVE_SUMMARY.md) *(2026-05-16)*
- [x] **Tách KnowledgeManager.tsx** — tách 4/4 sub-tabs (MechanismsSalarySubTab, MechanismsViolationsSubTab, MechanismsHolidaysSubTab, StandardsWorkflowsTab), giảm 50.3% kích thước *(2026-05-16)*
- [x] **Refactor SettingsCenter.tsx** — tách 4/4 tabs (PrintTemplatesTab, PaymentsTab, AppearanceTab, GoodsTab), giảm 60.4% kích thước *(2026-05-16)*
- [x] POS: sort sản phẩm trong ô tìm kiếm *(2026-05-14)*
- [x] POS: header - loại bỏ icon cạnh chữ Admin *(2026-05-14)*
- [x] POS: nút Xem báo cáo cuối ngày *(2026-05-14)*
- [x] Inventory: sửa luồng audit nhà cung cấp *(2026-05-14)*
- [x] POS: tab hóa đơn cuộn ngang + nút thêm luôn hiển thị *(2026-05-13)*
- [x] POS: điểm thưởng chỉ hiện khi có KH và sản phẩm tích điểm *(2026-05-12)*
- [x] POS: popup trả hàng đồng bộ màu theme *(2026-05-12)*
- [x] POS: giao diện Chia nhiều + format tiền *(2026-05-12)*
- [x] POS: layout thanh toán Chuyển khoản / Thẻ / Ví *(2026-05-12)*
- [x] POS: layout trả hàng + khóa ô tìm khi mode=return *(2026-05-12)*
- [x] POS: popup thêm khách hàng mới layout 2 cột *(2026-05-12)*
