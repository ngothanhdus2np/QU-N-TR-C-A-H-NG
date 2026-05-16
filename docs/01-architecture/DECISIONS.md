# DECISIONS.md — Quyết định kỹ thuật CFO Brain 4.0

> Lưu trữ lý do đằng sau mọi quyết định thiết kế quan trọng.
> Khi gặp vấn đề tương tự, đọc file này trước khi thay đổi cách tiếp cận.

---

## Auth & Security

### `requireAuth` — tại sao không dùng session check?
`requireAuth` kiểm tra `req.hostname === 'localhost'` OR `X-Api-Key` header khớp `INTERNAL_API_KEY`. App là SPA cùng origin với server — request từ localhost đã đủ tin cậy. `X-Api-Key` phục vụ tích hợp bên ngoài như KiotViet sync từ xa.

### audit_logs — tại sao fail silently?
`auditLog()` catch lỗi và không throw — bảng `audit_logs` có thể chưa tồn tại trên môi trường mới. App phải hoạt động bình thường ngay cả khi audit trail không ghi được. Sau khi chạy SQL tạo bảng thì audit tự động hoạt động.

---

## Data & State

### fetchAllData limit 2000
Giảm từ 10000 xuống 2000 với `order by date desc` — data cũ hơn 2000 records hiếm khi cần hiển thị trực tiếp. Nếu cần, dùng `fetchTablePage(tableName, limit, offset)`.

### autoPostConfig — tại sao lưu vào Supabase thay vì file?
File mất khi server crash hoặc deploy lại. Supabase `app_state` table đã được dùng cho schedule data — dùng thêm `user_id: 'phuc-sang-auto-post-config'` là consistent, không cần table mới.

### SupplierDebtRecord — tại sao transaction model thay vì snapshot?
Mô hình transaction-based (mỗi dòng là 1 giao dịch riêng): dễ xem lịch sử từng lần mua/trả, dễ xóa giao dịch sai mà không ảnh hưởng giao dịch khác, số dư tính tại thời điểm đọc — không bao giờ mất đồng bộ. `purchase` tăng nợ, `payment` giảm nợ.

### `calculateSeniority` — `+1` là intentional
Dòng 117: `diffDays = floor(diffTime / 86400000) + 1`. Ngày đầu tiên làm việc tính là 1 ngày thâm niên (không phải 0). Tests đã document hành vi này. Không cần sửa.

### `minStock ?? 5` — nullish coalescing thay vì `||`
`minStock || 5` sẽ treat `minStock = 0` là falsy và default về 5, sai với trường hợp muốn "luôn cảnh báo". `?? 5` chỉ fallback khi `minStock` là `null` hoặc `undefined`.

---

## Architecture & Stack

### Migration Gemini → Claude API (hoàn tất 2026-05-08)
**Lý do**: Prompt Caching giảm ~80% chi phí, tool use đáng tin hơn, context window 200K, không phụ thuộc Google.  
**Mapping**: `gemini-3-flash` → `claude-haiku-4-5` | `gemini-3.1-pro` → `claude-sonnet-4-6`  
**Kiến trúc**: Tất cả Claude calls đi qua backend Express, hiện tập trung trong `routes/ai.ts` và được mount từ `server.ts` — không bao giờ gọi từ frontend.

### Kiến trúc 6 Specialized Agents
CFO, HR, Sales, Inventory, Marketing, Operations — mỗi agent có system prompt riêng + domain tools. Orchestrator `/api/ai/classify` (Haiku, ~200ms) route câu hỏi đến đúng agent. KiotViet không có AI agents — đây là điểm khác biệt cạnh tranh chính.

### RevenueManager / PayrollManager split (2026-05-08)
Parent giữ toàn bộ state và handlers. Sub-components là pure functional, nhận props, không có state nội bộ (ngoại trừ UI-only). `helpers.tsx` export `MetricCard` và `InputWrapper` dùng chung. Audit modal giữ trong parent vì dùng nhiều state phức tạp.

### Dead files — tại sao xóa thay vì giữ?
Không file nào được import → xóa. Giữ lại tạo confusion cho dev mới, IDE autocompletion gợi ý symbol cũ, bundle analyzer hiển thị false positives. Git history đủ làm backup.

---

## POS & GoodsInventory

### Barcode scanner — tại sao dùng native BarcodeDetector?
Không cần thêm bundle. Native API (Chrome/Edge) đủ dùng. USB scanner hoạt động qua keyboard: scanner gõ barcode + Enter. Camera dùng `cameraActiveRef` (useRef, không phải state) để tránh stale closure trong `requestAnimationFrame`.

### Global Barcode Scanner — tại sao `window.addEventListener`?
Thu ngân quét mã bất cứ lúc nào, không cần focus ô tìm kiếm. Phân biệt máy quét (tốc độ < 50ms, kết thúc bằng Enter) và gõ tay (chậm hơn). Zero-click workflow.

### Thermal printer — tại sao lưu `paperWidth` vào localStorage?
Preference per device, không per account — mỗi máy tại cửa hàng có thể dùng 58mm hoặc 80mm khác nhau. Key: `pos_paper_width`.

### POS full-screen — tại sao cần `className="h-full"` trên wrapper div?
`height: 100%` chỉ hoạt động khi toàn bộ chuỗi tổ tiên đều có chiều cao xác định. Wrapper div cho tab `'pos'` trong `MainContent.tsx` có `className=""` → `height: auto` → phá vỡ chuỗi → khoảng trống phía dưới. CSS điển hình, không phải lỗi React.

### addToCart stock check — tại sao check ngoài setTabs?
`setStockWarning()` là side effect — không được gọi bên trong state updater của `setTabs` (React strict mode gọi updater 2 lần trong dev). Đọc `activeTab.cart` từ ngoài, gọi `setStockWarning` + `return` trước khi vào `setTabs`.

### cashReceived input — `value={cashReceived === 0 ? '' : cashReceived}`
Khi = 0, input hiển thị empty và placeholder hiện `netPayable` — thu ngân thấy ngay số cần thanh toán. Nếu dùng `value={cashReceived}` khi = 0, input hiển thị "0" → phải xóa trước khi gõ.

### handleReturnCheckout — tại sao prop riêng?
`onReturnOrder` khác hoàn toàn với `onPlaceOrder`: hoàn kho hàng trả (`quantity +`), trừ kho hàng đổi (`quantity -`), ghi 2 transaction log riêng (`Return` và `Sale`), không cộng doanh thu. `isReturn: true` trên POSOrder. Phiếu trả prefix `TH-`.

### Return modal — tại sao tạo tab mới?
Cashier có thể đang có đơn bán dở. Tạo tab return mới (`Trả hàng N`) giữ nguyên đơn đang bán. Khi confirm xong, tab tự đóng.

### `onMouseDown` thay vì `onClick` trong dropdown
Input `onBlur` chạy trước `onClick` → blur ẩn dropdown trước khi click được register. `onMouseDown` chạy trước blur → item được chọn trước khi dropdown đóng. Áp dụng: customer search dropdown, return item dropdown, discount popup toggle VND/%.

### EndOfDayReport — tại sao dùng `posOrders` chứ không phải `data.revenue`?
`data.revenue` là sổ cái tổng hợp từ nhiều kênh (nhập tay, import, Shopee). `data.posOrders` là giao dịch thực tế từ POS app. Báo cáo cuối ngày phản ánh ca bán hàng — không trộn lẫn dữ liệu kênh khác.

### EndOfDayReport — tại sao in qua `window.open('', '_blank')`?
`window.print()` trực tiếp in toàn bộ trang app. New window + `document.write` HTML thuần tách hoàn toàn khỏi UI, không cần CSS `@media print` phức tạp. `setTimeout(window.close, 500)` đảm bảo print dialog đã xuất hiện.

### TopNav handleSectionClick — tại sao skip `'pos'`?
`'pos'` là full-screen mode — khi active, TopNav bị ẩn hoàn toàn. Nếu click section "Bán hàng" navigate đến `'pos'`, tầng 2 biến mất và user không thể chọn sub-item khác. Fix: `.find(i => i.id !== 'pos') ?? section.items[0]`.

### activeSection — tại sao derive từ activeId?
`activeSection = sections.find(s => s.items.some(i => i.id === activeId))` — tính bằng `useMemo`, không có state riêng. Một source of truth duy nhất, không thể mất đồng bộ khi navigate bằng phím tắt.

### Payment methods ẩn khi giỏ trống — conditional render thay vì CSS `hidden`
`{cart.length > 0 && (...)}` để component không mount, tránh stale state khi cashier switch tab. Thứ tự: Khách đưa → Payment methods → Cash suggestions → Tiền thừa.

### CartItemRow — từ `<table>` sang `<div>` flex
`<table>` enforce cột đều nhau, `border-r` cứng nhắc. `<div>` flex: tên `flex-1 truncate`, cột số `shrink-0 w-fixed`. Nút Xóa/More dùng `opacity-0 group-hover:opacity-100` — giảm visual noise. Áp dụng cả 3 nơi: giỏ bán, danh sách hàng trả, hàng đổi.

### Discount popup: `position: fixed` + `getBoundingClientRect()`
Cart scroll container dùng `overflow-y-auto` — clip `position: absolute` children khi scroll. Đọc `button.getBoundingClientRect()` để lấy tọa độ viewport, render popup với `position: fixed`. Pattern dùng cho cả item-level và bill-level discount popup.

### commitRef pattern — ref thay vì closure trong mousedown listener
`commitRef.current = () => { ... }` được gán lại mỗi render, nhưng event listener chỉ đăng ký 1 lần trong `useEffect`. Closure trong listener là stale. `commitRef.current()` luôn gọi phiên bản mới nhất.

### `group/qty` scoped Tailwind group
`CartItemRow` có `group` ở root điều khiển nút Xóa/More. `group/qty` là scoped group riêng: chỉ phần tử trong `group/qty` wrapper phản ứng với `group-hover/qty:opacity-100`. Hai vùng hover độc lập nhau.

### `POSOrderItem.discount` — activate field đã có sẵn
Field `discount: number` đã có trong interface và DB, nhưng `addToCart` luôn gán = 0. `updateItemPrice()` tính `discount = item.price - customPrice`. Công thức: `total = (price - discount) × quantity`. Không cần thay đổi schema.

### Confirm on Tab Close — chỉ khi `cart.length > 0`
Tránh mất dữ liệu do lỡ tay click X hoặc Alt+W. Tab trống → đóng ngay, không hỏi.

### Drilled Sync Props — tại sao không dùng hook riêng lẻ?
Truyền `offlinePendingCount` và `isDraining` từ `App` → `MainContent` → `POSComputer`. Tránh nhiều instance `useOfflineSync` cùng lắng nghe event `online` và gọi `drainQueue()` đồng thời — có thể xung đột khi ghi IndexedDB.

### Import Excel KiotViet — detect client-side, upsert server-side
`handleExcelImport` đọc header row (sync, không cần server). Nếu col[0]==="Loại hàng" → KiotViet format → convert base64 → POST `/api/import/kiotviet-products`. Backend route `routes/import.ts` dùng `xlsx`, lookup existing SKUs (1 SELECT), upsert batch 300. Generic template vẫn xử lý client-side.

### ApiKeySettings — tại sao rewrite thành connection test?
API key tồn tại server-side trong `.env.local` — user không cần nhập trong browser. Thay bằng ping `GET /api/ai/test-connection` — user thấy ngay server có hoạt động không. Frontend không giữ SDK hoặc key AI.

### Zalo OA — tại sao dùng `access_token` header?
Zalo OA API v2.0 dùng header `access_token: {token}` (không phải `Authorization: Bearer`). TTL 90 ngày, cần refresh thủ công. `sendZaloMessage()` fail silently — app không crash nếu chưa cấu hình.

### Critical alert — tại sao 6 tiếng?
Mỗi `checkAllAlerts()` là 3 Supabase queries. 6 tiếng = 720 queries/ngày tổng cộng — đủ nhạy cho bài toán cửa hàng. `alert-last-notified` trong `app_state` tránh spam khi alert kéo dài. Critical alerts vẫn hiện realtime trong TopNav bell (poll 10 phút).

### Backend route split (2026-05-10)
`server.ts` chỉ giữ bootstrap: Express setup, middleware, Supabase client, `requireAuth`, mount routes, Vite/static serving và scheduler startup. Các route nghiệp vụ được tách ra:
- `routes/ai.ts` — `/api/ai/*`
- `routes/facebook.ts` — `/api/fb/*`, `/auth/facebook/callback`, auto-post helpers
- `routes/notifications.ts` — `/api/notifications/*`, `/api/eod-report`, `/api/alerts`
- `routes/import.ts` — `/api/import/kiotviet-products`, `/api/sync-kiotviet*all`

Lý do: giảm `server.ts` từ god-file thành entrypoint dễ đọc, giữ backend-only AI/security nhưng cô lập từng nhóm endpoint.

---

## GoodsInventory — Filter & Column Visibility

### Filter popup — tại sao `position: fixed` thay vì `position: absolute`?
Sidebar filter dùng `overflow-y-auto` — clip mọi `position: absolute` child khi scroll. `position: fixed` float hoàn toàn khỏi stacking context, không bị clip. Pattern nhất quán với discount popup trong POSComputer.

```typescript
const rect = triggerRef.current.getBoundingClientRect();
setPopupPos({ top: rect.bottom + 4, left: rect.left, width: 340 });
```

### Column visibility — tại sao localStorage thay vì Supabase?
Per-device preference, không per-account — máy kho xem tồn kho/vị trí, máy kế toán xem giá vốn/giá bán. Supabase round-trip không cần thiết cho preference thay đổi thường xuyên. Consistent với `pos_paper_width`.

### `ALL_COLUMNS` — tại sao module level?
Khai báo bên trong component → array tạo lại mỗi lần render. Module level → tạo 1 lần khi module load, O(1) memory. Pattern đúng cho bất kỳ static config nào không phụ thuộc props/state.

### `filterCategories`/`filterAttrs` là `string[]`
User muốn xem nhiều nhóm cùng lúc — string đơn không biểu diễn được. `pendingCategories` tích lũy clicks trước "Áp dụng", tránh table reload sau mỗi click. Stock filter giữ là single-select vì 4 trạng thái mutually exclusive.

### Toggle popup — pattern click-lần-2-đóng
```typescript
if (showXxxPopup) { setShowXxxPopup(false); return; }
```
Click lần 2 mà không có guard → đóng rồi ngay lập tức mở lại → popup nhấp nháy. `return` sớm tránh `getBoundingClientRect()` không cần thiết.

### `colCount = 5 + visibleColumns.length`
5 cột luôn hiển thị (checkbox, star, SKU, tên, actions). Tất cả `colSpan` dùng `colCount` — hardcode `colSpan={11}` sẽ vỡ layout khi user thay đổi cột.

### "Dự kiến hết hàng" — tại sao không lưu?
Calculated field của KiotViet dựa trên analytics nội bộ của họ. Giá trị trong Excel là snapshot tại thời điểm export — stale ngay khi import vào app khác. CFO Brain sẽ tự tính dự báo riêng (Giai đoạn 3).

---

## Product Variants (2026-05-09)

### Mô hình parent-child thay vì `variantGroup` table
`products.filter(p => p.parentId === parentId)` — một SELECT đơn giản. Cascade delete bằng 1 WHERE clause. UI expand/collapse tự nhiên: parent là "folder". Không cần maintain separate table.

```typescript
POSProduct {
  parentId?: string;        // Trỏ đến sản phẩm cha
  isParent?: boolean;       // true nếu có biến thể
  variantAttributes?: Record<string, string>;  // { "Màu": "Đỏ", "Size": "M" }
  variantCount?: number;    // Cache để hiển thị badge
}
```

### SKU strategy — chỉ biến thể con có SKU
Sản phẩm cha KHÔNG có SKU (empty string) — là khái niệm logic, không bán trực tiếp. Chỉ biến thể con có SKU tự động tăng (SP000001...). Thu ngân scan barcode luôn match với biến thể cụ thể.

### generateProductVariants — Cartesian product
Recursive function hỗ trợ N thuộc tính không giới hạn. Ví dụ: Màu [Đỏ, Xanh] × Size [M, L, XL] = 6 biến thể. Ngắn gọn, dễ test, đúng với toán học.

### generatePreviewVariants — hỗ trợ 2 context
- **Popup "Thêm thuộc tính"**: Tạo sản phẩm cha MỚI → dùng `viewingProduct`
- **Popup "Thêm hàng hóa cùng loại"**: Thêm vào cha ĐÃ TỒN TẠI → dùng `addingToParentId`
```typescript
const referenceProduct = viewingProduct || (addingToParentId ? products.find(p => p.id === addingToParentId) : null);
```

### variantCount cache — lưu trên parent thay vì count runtime
O(1) read thay vì O(N) filter mỗi lần render. Trade-off: phải maintain sync khi thêm/xóa biến thể.

### Popup "Thêm hàng hóa cùng loại" — form trống
User muốn thêm giá trị MỚI cho thuộc tính hiện có. Load sẵn thuộc tính cũ → user phải xóa hết trước khi nhập → thao tác thừa.

### ChevronRight icon — tại sao xóa?
Badge "(6)" với màu indigo đã đủ báo hiệu sản phẩm có biến thể. Toàn bộ dòng đã là click target → không cần icon riêng. Giữ layout đồng nhất với sản phẩm đơn giản.

### Khung bao parent + children khi expanded
Visual grouping rõ ràng. Nền xám trắng (`bg-slate-100`) phân biệt parent với children (nền trắng). Consistent với KiotViet UX.

---

## Navigation & Layout

### Top navigation 2 tầng — tại sao thay sidebar?
Sidebar chiếm ~256px chiều ngang — lãng phí trên màn hình widescreen. Top nav giải phóng toàn bộ chiều ngang, phù hợp UX KiotViet. POS full-screen khi ẩn TopNav hoàn toàn.

### `onMouseDown` vs `onClick` toggle VND/%
Input `onBlur → setShowDiscount(false)` chạy trước `onClick` → popup đóng trước khi click land. `onMouseDown + e.preventDefault()` chạy trước blur — mode đổi xong trước khi blur xử lý.

---

## Supabase & SQL

### `created_at` — set on creation, immutable khi edit
Được gán `new Date().toISOString()` khi tạo SP mới. Khi edit, giữ nguyên từ `editingProduct`. Hiển thị read-only trong form.

### BrandProfile.name, POSCustomer.notes — SQL cần chạy thủ công
`ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS name TEXT;` — đã chạy 2026-05-06.  
`ALTER TABLE pos_customers ADD COLUMN IF NOT EXISTS notes TEXT;` — thêm cùng session CRM redesign.

### KiotViet Excel — 19 cột giữ, 10 cột bỏ
29 cột trong file. Bỏ: rỗng hoàn toàn (Mã ĐVT Cơ bản, Hàng thành phần...), luôn 1 giá trị (Loại hàng, Quy đổi), dữ liệu live không sync được (Dự kiến hết hàng — calculated field của KiotViet).

### .claude/PostToolUse.sh — tại sao exit 2?
Exit code 2 báo cho Claude biết có TypeScript error và phải xử lý trước khi tiếp tục — không chặn action (edit đã xảy ra) mà là signal để đọc output và fix ngay. Exit 0 khi có lỗi → Claude tiếp tục trên code broken.

---

## Box Tư vấn Bán hàng (2026-05-10)

### h-[380px] + auto-rows-[160px] — tại sao fixed row height?
Grid tự tính với auto height → fit nhiều row nhỏ vào container. Fixed `auto-rows-[160px]`: grid biết mỗi row phải 160px → row thứ 3 bị đẩy xuống (scroll). Ảnh 110px cố định đảm bảo còn ~50px cho tên.

### Xóa dropdown "Sắp xếp" — thêm nút collapse
User yêu cầu đơn giản hóa. Nút ChevronDown ở vị trí dropdown cũ để user ẩn box khi không cần — tiết kiệm không gian màn hình.

---

## Payment Section (2026-05-10)

### Thứ tự mới: Khách đưa → Payment methods → Tiền thừa
"Tiền thừa" là output (kết quả tính), không phải input — hiển thị sau payment methods. Split payment: "Tiền thừa" vẫn trong box vì là feedback trực tiếp khi nhập liệu.
