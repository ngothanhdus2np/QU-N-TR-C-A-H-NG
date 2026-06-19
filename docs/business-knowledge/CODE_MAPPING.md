# CODE_MAPPING — Bản đồ code → nghiệp vụ

> Mỗi nghiệp vụ → file, function, bảng DB liên quan

---

## Frontend Components

| Nghiệp vụ | Component chính | Hook/Service | Bảng DB |
|-----------|----------------|--------------|---------|
| Máy tính tiền | `components/pos/POSComputer.tsx` | `usePOSState`, `usePOSReturnFlow` | pos_orders, pos_products, pos_customers |
| Trả hàng POS | `components/pos/usePOSReturnFlow.ts` | `posOrderService.processReturnOrder` | pos_orders, pos_products |
| Danh sách hàng hóa | `components/pos/GoodsInventory.tsx` | `useGoodsFilters`, `useGoodsProductEditor` | pos_products |
| Nhập hàng | `components/purchase/PurchaseOrdersContainer.tsx` | `usePurchaseFormState` | inventory_transactions, pos_products, supplier_debts |
| Trả hàng nhập | `components/purchase/PurchaseOrdersContainer.tsx` | `usePurchaseFormState` | inventory_transactions, pos_products, supplier_debts |
| Nhà cung cấp | `components/suppliers/SupplierContainer.tsx` | — | suppliers, supplier_debts |
| Khách hàng | `components/customers/CustomerListPage.tsx` | — | pos_customers, customer_debt_history |
| Chấm công | `components/payroll/AttendanceTab.tsx` | — | attendance_records |
| Tính lương | `components/payroll/PayrollManager.tsx` | `usePayrollState` | payroll_records, expense_records |
| Kiểm kho | `components/pos/` (goods-audit) | `useGoodsAudit.ts` | inventory_transactions, pos_products |
| Doanh thu Shopee | `components/revenue/InventoryOutTab.tsx` | `useShopeeInventoryOut.ts` | shopee_inventory_out |
| Vận đơn | `components/orders/ShippingOrders.tsx` | — | bot shopee SQLite |
| Hóa đơn bán | `components/orders/OrderInvoices.tsx` | — | pos_orders |
| Trả hàng đặt | `components/orders/OrderReturns.tsx` | — | pos_orders, pos_products |
| Sổ quỹ | `components/finance/CashLedgerPage.tsx` | — | pos_orders, expense_records |
| Báo cáo lợi nhuận | `components/reports/SalesReportPage.tsx` | — | pos_orders, inventory_transactions |
| Phân tích AI | `components/analysis/AnalysisContainer.tsx` | — | routes/ai.ts → Claude API |
| Sản phẩm website | `components/website/WebsiteProductsPage.tsx` | — | store_products, store_product_variants |
| Đơn website | `components/website/WebsiteOrdersPage.tsx` | — | pos_orders, store_order_addresses |
| Sản phẩm Shopee | `components/website/ShopeeProductsPage.tsx` | — | shopee_inventory_out, pos_products |
| Cài đặt | `components/settings/SettingsCenter.tsx` | — | app_state (Supabase) |

---

## Backend Routes

| Route | File | Mô tả |
|-------|------|-------|
| POST /api/auth/register | `routes/auth.ts` | Tạo tài khoản Supabase (Admin API) |
| GET /api/auth/accounts | `routes/auth.ts` | Danh sách tài khoản |
| PATCH /api/auth/accounts/:id/password | `routes/auth.ts` | Reset mật khẩu |
| POST /api/ai/chat | `routes/ai.ts` | Claude AI CFO chat |
| POST /api/data/:table | `routes/data.ts` | CRUD chung |
| POST /api/import/excel | `routes/import.ts` | Import Excel hàng hóa/doanh thu |
| POST /api/import/kiotviet | `routes/import.ts` | Import từ KiotViet |
| POST /api/inventory-out/sync-from-bot | `routes/inventoryOutSync.ts` | Sync đơn Shopee từ bot |
| GET/POST /api/store/* | `routes/store.ts` | Website store endpoints |
| POST /api/shopee-sync | `routes/shopeeSync.ts` | Sync sản phẩm Shopee |
| POST /api/channel-links/toggle | `routes/channelLinks.ts` | Liên kết kênh bán |
| GET /api/notifications | `routes/notifications.ts` | Cảnh báo tồn kho |

---

## Services

| File | Mô tả |
|------|-------|
| `services/posOrderService.ts` | Logic nghiệp vụ đặt hàng POS (processPlaceOrder, processReturnOrder) |
| `services/dataMapper.ts` | Mapping snake_case DB → camelCase App (merge logic offline-first) |
| `services/apiService.ts` | Gọi Supabase REST API (fetchTable, upsertRecord, deleteRecord) |
| `services/auditService.ts` | Ghi audit_logs |
| `services/syncService.ts` | Đồng bộ dữ liệu giữa offline queue và Supabase |
| `services/posOfflineQueue.ts` | Quản lý hàng đợi offline |
| `services/exportService.ts` | Xuất Excel báo cáo |
| `services/invoiceService.ts` | Upload hóa đơn VAT lên Supabase Storage |
| `services/validationService.ts` | Validate dữ liệu nhập |

---

## Business Logic (src/lib/)

| File | Hàm chính | Mô tả |
|------|-----------|-------|
| `businessLogic.payroll.ts` | `calculateEmployeePayroll()` | Tính lương đầy đủ 1 nhân viên |
| `businessLogic.payroll.ts` | `determineCurrentPolicy()` | Chọn policy lương theo thâm niên |
| `businessLogic.payroll.ts` | `calculateSeniority()` | Tính số ngày thâm niên |
| `businessLogic.inventory.ts` | `calculateNextImportPrice()` | Tính giá vốn mới (fixed/average) |
| `businessLogic.inventory.ts` | `calcEffectiveUnitPrice()` | Phân bổ giảm giá vào đơn giá |
| `businessLogic.revenue.ts` | `calculateExecutiveInsights()` | KPIs tổng hợp cấp lãnh đạo |
| `businessLogic.revenue.ts` | `calculateFinancialHealthScore()` | Điểm sức khoẻ tài chính |
| `businessLogic.core.ts` | Các hàm dùng chung | Format tiền, tính thuế... |
| `reportCalculations.ts` | `buildCostHistory()` | Lập index giá vốn theo thời điểm |
| `reportCalculations.ts` | `getSalesProfitRowsByDate()` | Báo cáo lợi nhuận theo ngày |
| `reportCalculations.ts` | `getEndOfDayReportRows()` | Báo cáo cuối ngày |
| `staffPerformanceLedger.ts` | — | Sổ cái hiệu năng nhân viên |
| `posSalesAttribution.ts` | — | Gán doanh số cho nhân viên |
| `vatCoverage.ts` | — | Kiểm tra độ phủ VAT |

---

## Hooks

| Hook | File | Mô tả |
|------|------|-------|
| `useAppData` | `hooks/useAppData.ts` | Toàn bộ state app, fetch Supabase |
| `useRealtimeSync` | `hooks/useRealtimeSync.ts` | WebSocket Supabase Realtime |
| `usePOSState` | `hooks/usePOSState.ts` | UI state máy tính tiền |
| `usePurchaseFormState` | `hooks/usePurchaseFormState.ts` | Form nhập hàng / trả hàng nhập |
| `usePurchaseQuickModals` | `hooks/usePurchaseQuickModals.ts` | Modal tạo nhanh SP/NCC |
| `usePayrollState` | `hooks/usePayrollState.ts` | State tính lương |
| `useStaffManagerState` | `hooks/useStaffManagerState.ts` | State quản lý nhân viên |
| `useGoodsFilters` | `components/pos/` | Bộ lọc trang hàng hóa |
| `useGoodsAudit` | `components/pos/` | Kiểm kho |
| `useGoodsPurchase` | `components/pos/` | Nhập hàng nhanh từ trang hàng hóa |

---

## Bảng dữ liệu theo domain

| Domain | Bảng chính | Bảng phụ |
|--------|-----------|---------|
| Nhân sự | employees, salary_policies | attendance_records, overtime_records, sales_records, shortage_records, advance_records |
| Lương | payroll_records | expense_records (category=Lương) |
| Hàng hóa | pos_products | categories, product_groups |
| Kho | inventory_transactions | product_cost_history |
| Bán hàng POS | pos_orders | pos_customers, customer_debt_history |
| Mua hàng | inventory_transactions (type=Import) | suppliers, supplier_debts, invoice_attachments |
| Tài chính | revenue_records, expense_records | cashflow_records |
| Shopee | shopee_inventory_out | shopee_inventory_in, shopee_revenue_records |
| Website | pos_orders (channel=website) | store_products, store_product_variants, store_order_addresses, shipments |
| VAT | vat_documents | vat_document_items, vat_allocations, tax_filing_periods |
| Config | app_state | knowledge_base |
| Audit | audit_logs | — |

---

## Constants & Navigation

| Constant | File | Mô tả |
|----------|------|-------|
| SIDEBAR_SECTIONS | `constants/navigation.ts` | Cấu trúc menu toàn app |
| THEMES | `constants/themes.ts` | Bảng màu giao diện |
| TABLE_MAP | `services/apiService.ts` | Mapping table name → Supabase endpoint |
