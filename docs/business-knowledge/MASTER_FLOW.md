# MASTER_FLOW — Vòng đời toàn hệ thống CFO Brain 4.0

> Source: types.ts, services/dataMapper.ts, hooks/useAppData.ts, supabase_setup.sql, server.ts

---

## Sơ đồ vòng đời tổng quát

```
[NHẬP HÀNG]
  Nhà cung cấp → Phiếu nhập (InventoryTransaction type=Import)
       ↓
  Tăng tồn kho (pos_products.stock +)
       ↓
  Cập nhật giá vốn (product_cost_history)
       ↓
  Phát sinh công nợ NCC (supplier_debts type=purchase)

[BÁN HÀNG — POS]
  Khách hàng → Máy tính tiền → POSOrder (channel=direct)
       ↓
  Giảm tồn kho (pos_products.stock -)
       ↓
  Ghi nhận doanh thu (revenue_records)
       ↓
  Tích điểm / cập nhật tier khách hàng (pos_customers)
       ↓
  Nếu ghi nợ → phát sinh công nợ KH (customer_debt_history type=debt)

[BÁN HÀNG — WEBSITE]
  Khách online → create_store_order() RPC (atomic lock)
       ↓
  pos_orders (channel=website, status=pending)
       ↓
  Nhân viên xác nhận → status=shipping → completed
       ↓
  Nếu huỷ (trước giao ĐVVC) → cộng tồn kho ngay
  Nếu hoàn (sau giao) → trạng thái return_requested → nhân viên xác nhận → stock +

[BÁN HÀNG — SHOPEE]
  Bot Shopee (port 3001 / 3002) → SQLite shop.db
       ↓
  POST /api/inventory-out/sync-from-bot (mỗi 10 phút)
       ↓
  INSERT/UPDATE shopee_inventory_out
       ↓
  Hiển thị trong trang Xuất kho (InventoryOutTab)
       ↓
  Upload Excel Shopee → điền phí nền tảng (platformFee, paymentFee...)

[TRẢ HÀNG — POS]
  Khách trả hàng → tra cứu đơn gốc
       ↓
  POSOrder (isReturn=true, refundAmount>0)
       ↓
  Cộng tồn kho sản phẩm trả
       ↓
  Trừ tổng chi tiêu khách hàng

[TRẢ HÀNG NHẬP]
  Trả lại NCC → InventoryTransaction (type=PurchaseReturn)
       ↓
  Giảm tồn kho
       ↓
  Ghi nhận NCC nhận lại hàng (supplier_debts type=payment)

[KIỂM KHO]
  Nhân viên đếm thực tế → InventoryTransaction (type=Check, status=balanced)
       ↓
  SET pos_products.stock = actual_count (ghi đè, không ±)
       ↓
  Lưu totalDiff, increaseCount, decreaseCount

[XUẤT KHO NỘI BỘ / HUỶ HÀNG]
  InventoryTransaction (type=internal_use / disposal)
       ↓
  Giảm tồn kho

[THANH TOÁN CÔNG NỢ NCC]
  supplier_debts (type=payment)
  Công nợ hiện tại = Σ(purchase) - Σ(payment) [tính runtime]

[THANH TOÁN CÔNG NỢ KHÁCH HÀNG]
  customer_debt_history (type=repay)
  pos_customers.debt_amount cập nhật

[TÍNH LƯƠNG]
  Chấm công (attendance_records) + Tăng ca (overtime_records)
       ↓
  businessLogic.payroll.ts → calculateEmployeePayroll()
       ↓
  PayrollRecord (chưa chốt: isOfficial=false)
       ↓
  Nhân viên chốt lương → isOfficial=true
       ↓
  expense_records (category="Lương tháng MM/YYYY")
       ↓
  Nếu còn nợ lương → carryForwardDebt chuyển sang kỳ sau

[BÁO CÁO & PHÂN TÍCH]
  revenue_records + expense_records + payroll_records
       ↓
  reportCalculations.ts (lợi nhuận, COGS lịch sử)
       ↓
  businessLogic.revenue.ts (ExecutiveInsights, HealthScore)
       ↓
  Các trang báo cáo + AI CFO (routes/ai.ts → Claude claude-sonnet-4-6)
```

---

## Luồng dữ liệu chi tiết

### 1. Offline → Online Sync

```
Thao tác offline (mất mạng)
       ↓
posOfflineQueue.ts → localStorage queue
       ↓
Khi có mạng → flush queue → Supabase
       ↓
Realtime WebSocket (useRealtimeSync.ts)
       ↓
mergeRemoteUpdate() → UI cập nhật
```

### 2. Giá vốn (COGS) theo thời điểm

```
Mỗi lần nhập hàng:
  inventory_transactions (type=Import)
    .items[].nextImportPrice = giá vốn mới
    .items[].previousImportPrice = giá vốn cũ
       ↓
  product_cost_history (sku, import_price, effective_date)

Khi tính báo cáo lợi nhuận:
  reportCalculations.ts:buildCostHistory()
    → tìm nextImportPrice gần nhất trước ngày bán
    → COGS = SUM(quantity × historicalCost)
```

### 3. VAT đầu vào

```
Mua hàng → upload hóa đơn VAT → invoice_attachments
       ↓
vat_documents (status=unallocated)
       ↓
Phân bổ vào phiếu nhập → vat_allocations
       ↓
Tổng hợp → taxFilingPeriods (locked khi kê khai)
```

---

## Module dependency map

```
App.tsx
  ├── useAppData.ts       ← tất cả state toàn app
  │     └── Supabase REST API (qua server proxy)
  ├── useRealtimeSync.ts  ← WebSocket Supabase
  ├── POSComputer.tsx     ← POS bán hàng
  │     └── posOrderService.ts ← nghiệp vụ bán hàng
  ├── MainContent.tsx     ← router nội bộ (tab-based)
  └── server.ts (Express) ← backend proxy + API routes
        ├── routes/ai.ts         ← Claude API
        ├── routes/import.ts     ← import Excel/KiotViet
        ├── routes/inventoryOutSync.ts ← bot Shopee
        ├── routes/store.ts      ← website store
        └── routes/auth.ts       ← Supabase Auth Admin
```
