# REPORT_LOGIC — Hệ thống báo cáo

> Source: components/reports/, src/lib/reportCalculations.ts, src/lib/businessLogic.revenue.ts

---

## Danh sách báo cáo

| # | Tên | File | Data chính |
|---|-----|------|-----------|
| 1 | Báo cáo bán hàng | `SalesReportPage.tsx` | pos_orders |
| 2 | Báo cáo lợi nhuận | `FinanceReportPage.tsx` | pos_orders + expense_records + payroll_records |
| 3 | Báo cáo hàng hóa | `GoodsReportPage.tsx` | pos_orders |
| 4 | Báo cáo theo kênh | `ChannelReportPage.tsx` | pos_orders |
| 5 | Báo cáo khách hàng | `CustomerReportPage.tsx` | pos_orders + pos_customers |
| 6 | Báo cáo nhân viên | `StaffReportPage.tsx` | pos_orders + sales_records |
| 7 | Báo cáo nhà cung cấp | `SupplierReportPage.tsx` | inventory_transactions + supplier_debts |
| 8 | Cuối ngày | `EndOfDayReportPage.tsx` | pos_orders |
| 9 | Báo cáo đặt hàng | `OrderReportPage.tsx` | pos_orders (pending) |

---

## Báo cáo 1: Bán hàng (SalesReportPage)

### Chế độ xem (InterestMode)
| Mode | Mô tả | Hàm tính |
|------|-------|---------|
| `time` | Doanh thu theo ngày/giờ | `getSalesRowsByDate()` / `getSalesRowsByHour()` |
| `profit` | Lợi nhuận theo ngày | `getSalesProfitRowsByDate()` |
| `discount` | Giảm giá theo hóa đơn | `getSalesInvoiceDiscountRowsByDate()` |
| `returns` | Trả hàng theo ngày | `getSalesHorizontalRowsByDate()` (isReturn) |
| `staff` | Doanh thu theo nhân viên | `getSalesStaffRows()` |

### Bộ lọc
- Khoảng thời gian (`week` / `custom`)
- Kênh bán (channel)
- Bảng giá (priceBook)
- Nhân viên tạo đơn (createdBy)
- Phương thức thanh toán (paymentMethod)

### Layout
- `vertical`: Từng dòng là 1 ngày
- `horizontal`: Ma trận ngày × chỉ số

### Công thức doanh thu chuẩn
```
calcOrderRevenue(order):
  Bán   → totalAmount - discount
  Trả   → -totalAmount
```

---

## Báo cáo 2: Lợi nhuận (FinanceReportPage)

### Cột tính toán (per tháng)
```
grossRevenue     ← Σ totalAmount (đơn bán)
discount         ← Σ discount
returnsValue     ← Σ |totalAmount| (đơn trả)
netRevenue       ← grossRevenue - discount - returnsValue
cogs             ← Tính qua getHistoricalCost()
                 ⚠️ AUDIT-017: Nếu InventoryTransaction cũ thiếu nextImportPrice
                    → fallback về product.importPrice HIỆN TẠI (không phải lúc bán)
                    → COGS lịch sử có thể sai nếu giá vốn đã thay đổi
grossProfit      ← netRevenue - cogs

payrollCost      ← Σ payroll_records.netPay (tháng đó)
otherExpense     ← Σ expense_records (không phải lương)

netProfit        ← grossProfit - payrollCost - otherExpense
```

### Tránh double-count lương
```
Nếu payroll_records có data → dùng payroll_records.netPay
Nếu không → dùng expense_records với category keyword 'luong'/'hoa hong'
(không cộng cả 2)
```

### Nguồn data
- `pos_orders` (channel bất kỳ — cả POS lẫn website)
- `expense_records`
- `payroll_records`
- `inventory_transactions` (để buildCostHistory)

---

## Báo cáo 3: Hàng hóa (GoodsReportPage)

### Output: GoodsReportRow per SKU
```
sku, name,
soldQty, revenue,
returnQty, returnValue,
netRevenue (= revenue - returnValue)
```

### Hàm tính
```typescript
// reportCalculations.ts:getGoodsReportRows()
// Nhóm các đơn hàng theo SKU
```

### Bộ lọc
- Khoảng thời gian
- Nhóm hàng (productGroup)
- Kênh bán

---

## Báo cáo 4: Kênh bán (ChannelReportPage)

### Output: ChannelReportRow per kênh
```
channelName, revenue, returned, netRevenue
```

### Channel values
- `'direct'` → Bán trực tiếp
- `'website'` → Website store
- `'Shopee'` → (Không dùng pos_orders, dùng shopee_inventory_out riêng)

---

## Báo cáo 5: Khách hàng (CustomerReportPage)

### Output: CustomerReportRow
```
customerId, customerName, phone,
revenue, returned, netRevenue
```

### Khách vãng lai
```
WALK_IN_KEY = 'walk-in'
WALK_IN_LABEL = 'Khách lẻ'
// Đơn hàng không gắn customerId → gom vào nhóm này
```

---

## Báo cáo 6: Nhân viên (StaffReportPage)

### Output: StaffReportRow
```
staffName, phone,
revenue, returned, netRevenue
```

### Dữ liệu nhân viên
```
// Từ pos_orders.staffId / pos_orders.staffName
// KHÔNG phải từ sales_records (sales_records chỉ dùng cho module lương)
```

---

## Báo cáo 7: Nhà cung cấp (SupplierReportPage)

### Output: SupplierReportRow
```
supplierCode, supplierName, phone,
importValue,   ← Σ inventory_transactions (type='Import')
returnValue,   ← Σ inventory_transactions (type='PurchaseReturn')
netValue       ← importValue - returnValue
```

### Nhà cung cấp vãng lai
```
WALK_IN_SUPPLIER = 'NCC vãng lai'
// Phiếu nhập không gắn supplierId → gom vào đây
```

---

## Báo cáo 8: Cuối ngày (EndOfDayReportPage)

### Output: EndOfDayReportRow
```
kind: 'invoice' | 'return'
label: phương thức thanh toán
count: số đơn
quantity: số lượng sản phẩm
revenue: tổng doanh thu
discount: tổng giảm giá
actual: doanh thu thực nhận (= revenue - discount)
```

### Hàm tính
```typescript
// reportCalculations.ts:getEndOfDayReportRows()
// Chỉ lấy đơn hàng trong ngày hiện tại
```

---

## Báo cáo 9: Đặt hàng (OrderReportPage)

### Nguồn data
```
pos_orders WHERE status = 'pending'
```

Dùng cho trang `orders` → xem đơn đặt chưa giao.

---

## Quy tắc chung của mọi báo cáo

### Date range defaults
```typescript
// components/reports/reportDateDefaults.ts

getWeekRange(): DateRange   ← Tuần hiện tại (Thứ 2 → CN)
getLatestOrderDate()        ← Ngày có đơn hàng gần nhất
hasOrdersInDateRange()      ← Kiểm tra xem range có đơn không
```

### Múi giờ
- Dùng `en-CA` locale → format `YYYY-MM-DD` (tránh sai UTC vs GMT+7)
- Dùng `sv-SE` locale trong businessLogic → cùng mục đích

### Xuất Excel
```typescript
// services/exportService.ts
// Tất cả báo cáo đều có nút xuất Excel
```

### In ấn
```typescript
// Dùng window.print() với CSS @media print
// Một số trang có nút "In hóa đơn" riêng
```

---

## Luồng data tổng quát

```
pos_orders (chuỗi đơn hàng)
     ↓ filter dateRange + filters
reportCalculations.ts (aggregate/group by)
     ↓
Component hiển thị (chart + table)
     ↓ export
Excel / Print
```
