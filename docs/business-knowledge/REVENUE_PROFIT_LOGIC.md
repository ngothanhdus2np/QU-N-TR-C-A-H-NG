# REVENUE_PROFIT_LOGIC — Doanh thu, COGS & Lợi nhuận

> Source: src/lib/businessLogic.revenue.ts, src/lib/reportCalculations.ts,
>         services/posOrderService.ts, types.ts

---

## PHẦN 1: Cấu trúc bảng doanh thu

### revenue_records (Aggregate per ngày)

```
date: TEXT (YYYY-MM-DD)
total_gross_revenue: number  ← Tổng doanh thu gộp (trước giảm giá)
discount: number             ← Giảm giá toàn đơn
net_revenue: number          ← = total_gross_revenue - discount
total_cogs: number           ← COGS tại thời điểm bán (importPrice × qty)
gross_profit: number         ← = net_revenue - total_cogs
revenue_other: number        ← Thu khác (phí trả hàng, v.v.)
returns_value: number        ← Giá trị hàng trả
```

**Lưu ý quan trọng:** `revenue_records` là bảng tổng hợp theo ngày, mỗi ngày chỉ có 1 record. Khi có đơn mới, hệ thống **UPSERT** (update nếu đã có, insert nếu chưa có).

**Source:** `services/posOrderService.ts:processPlaceOrder()`

---

## PHẦN 2: Công thức tính doanh thu đơn hàng

### Chuẩn doanh thu (theo KiotViet)

```typescript
// src/lib/reportCalculations.ts:calcOrderRevenue()

Đơn bán:
  revenue = totalAmount - discount
  (KiotViet: Doanh thu = Tổng tiền hàng − Giảm giá HĐ,
   KHÔNG trừ điểm tích lũy, KHÔNG trừ giảm giá dòng SP)

Đơn trả:
  revenue = -totalAmount  (âm = giảm doanh thu)
```

### Tính discount khi không rõ ràng:
```typescript
discount = order.discount != null
  ? Math.abs(order.discount)  // lấy tuyệt đối (KiotViet đôi khi export âm)
  : Math.max(0, totalAmount - finalAmount)
```

---

## PHẦN 3: COGS (Giá vốn hàng bán)

### COGS khi bán hàng (realtime)

```typescript
// services/posOrderService.ts
total_cogs = Σ(item.importPrice × item.quantity)
```

`item.importPrice` = giá nhập hiện tại của sản phẩm tại thời điểm bán.

---

### COGS lịch sử (cho báo cáo lợi nhuận theo khoảng thời gian)

```typescript
// src/lib/reportCalculations.ts:buildCostHistory()
// Nguồn: InventoryTransaction (type='Import'), field item.nextImportPrice

costHistory = Map<productId, [{date, price}]>  // sort tăng dần theo date

// Tra cứu giá vốn tại ngày bán:
// src/lib/reportCalculations.ts:getHistoricalCost()
price = last entry where entry.date <= saleDate
```

**Ý nghĩa:** Nếu hàng được nhập lúc 50k (tháng 1) và 60k (tháng 3), đơn bán tháng 2 dùng giá vốn 50k (không phải 60k hiện tại).

> **⚠️ AUDIT-004 — Fallback khi thiếu lịch sử giá vốn:**
> `getHistoricalCost()` trả về `fallback = product.importPrice` **hiện tại** nếu không tìm thấy entry lịch sử.
> Điều này xảy ra với các `InventoryTransaction` cũ (import từ KiotViet hoặc tạo trước khi fix) không có `nextImportPrice`.
> Hệ quả: báo cáo lợi nhuận quá khứ tính COGS theo giá vốn **hiện tại**, không phải lúc bán — sai lệch tích lũy nếu giá vốn thay đổi nhiều.
> **Giải pháp dài hạn:** Đảm bảo mọi InventoryTransaction type=Import đều có `nextImportPrice > 0`.

---

### AVCO vs Fixed (xem INVENTORY_LOGIC.md)

Phương thức tính giá nhập mới:
- **Fixed**: giữ nguyên `currentImportPrice` — chỉ dùng giá mới nếu `currentImportPrice = 0` (sản phẩm chưa có giá vốn)
- **Average**: AVCO = (currentStock × currentPrice + qty × newPrice) / (currentStock + qty)

---

## PHẦN 4: Lợi nhuận gộp vs ròng

### Lợi nhuận gộp (Gross Profit)

```
grossProfit = netRevenue - totalCogs
```

### Lợi nhuận ròng (Net Profit) — Computed runtime trong businessLogic.revenue.ts

```typescript
// src/lib/businessLogic.revenue.ts:calculateExpenseAnalysis()

// Smart Priority — tránh double-count lương
payrollTotal = payrollModule > 0 ? payrollModule : ledgerSalaryTotal

// Lọc salary + COGS khỏi expense_records
filteredExpenses = expenses.filter(e =>
  !isSalaryExp(e.category) && !isCogsExp(e.category)
)

totalOpEx = filteredExpenses.total + payrollTotal

netProfit = grossProfit - totalOpEx
```

**Từ khóa nhận diện lương trong chi phí (keyword không dấu):**
`luong`, `hoa hong`, `thuong doanh so`, `thu nhap nhan su`, `nhan su`

---

## PHẦN 5: Các KPI tài chính quan trọng

### calculateExecutiveInsights() — businessLogic.revenue.ts:16

| KPI | Công thức |
|-----|----------|
| `todayRev` | netRevenue + revenueOther của hôm nay |
| `currentMonthRev` | Σ(netRevenue + revenueOther) tháng hiện tại |
| `projectedNetProfit` | grossProfit - nonSalaryExp - projectedPayroll |
| `profitPerStaff` | projectedNetProfit / activeStaffCount |
| `coverageRatio` | (totalConsultedSales / currentMonthRev) × 100 |

**Múi giờ:** Dùng `toLocaleDateString('sv-SE')` để tránh lệch UTC vs GMT+7.

---

### calculateFinancialHealthScore() — businessLogic.revenue.ts:72

Score bắt đầu từ 70, cộng/trừ dựa trên:
- `netMargin > 20%`: +15 điểm (Biên lợi nhuận ròng xuất sắc)
- `coverageRatio > 50%`: +10 điểm (Đội ngũ sale chủ động)
- (có thể có các điều kiện khác)
- Kết quả: clamp [0, 100]

---

### calculateExpenseAnalysis() — businessLogic.revenue.ts:309

Phân loại chi phí theo loại:
```
ExpenseCategory root id → loại
  cat-fixed → 'fixed'
  cat-depreciation-root → 'depreciation'
  cat-interest-root → 'interest'
  rootName includes 'giá vốn'/'cogs' → 'cogs'
  otherwise → 'variable'
```

**Điểm hòa vốn (Break-even):**
```
totalFixed = fixedCosts + depreciationCosts + interestCosts
variableRatio = (totalCogs + variableCosts) / totalRev
contributionMarginRatio = 1 - variableRatio
breakEvenRevenue = totalFixed / contributionMarginRatio
```

---

### Industry Benchmarks (calculateMISMetrics) — businessLogic.revenue.ts:415

| Chỉ số | Target | Ngưỡng an toàn |
|--------|--------|---------------|
| COGS | 65% | 60–75% |
| Nhân sự (Labor) | 12% | 10–18% |
| Mặt bằng (Rent) | 10% | 8–15% |
| Marketing | 5% | 3–8% |
| Vận hành (OpEx) | 30% | 25–40% |

Trạng thái: `safe` / `warning` / `alert`

---

## PHẦN 6: Phân tích doanh thu theo nhóm hàng

### calculateSeasonalityAnalysis() — businessLogic.revenue.ts:628

Dùng cho báo cáo phân tích theo mùa vụ (nhóm hàng)

**ABC Classification:**
```
Sắp xếp nhóm theo doanh thu giảm dần → tính tích luỹ:
  ≤ 70% → A (nhóm quan trọng nhất)
  ≤ 90% → B
  > 90% → C (nhóm ít quan trọng)
```

**BCG Matrix:**
```
So sánh từng nhóm vs trung bình toàn dataset:
  highShare + highGrowth → Star
  highShare + lowGrowth  → Cash Cow
  lowShare + highGrowth  → Question Mark
  lowShare + lowGrowth   → Dog
```

**Source:** `src/lib/businessLogic.revenue.ts:628`

---

## PHẦN 7: Báo cáo lợi nhuận theo ngày (getSalesProfitRowsByDate)

```typescript
// src/lib/reportCalculations.ts:316

Với mỗi ngày trong range:
  revenue = Σ(calcOrderRevenue) - Σ(returnValue)
  cogs = Σ(
    getHistoricalCost(productId, saleDate) × qty
    (fallback: product.importPrice hiện tại)
  )
  profit = revenue - cogs
```

---

## PHẦN 8: Doanh thu Shopee

### Bảng riêng (shopee_inventory_out)

```
shopee_inventory_out:
  order_id, sku, quantity, revenue, date
  shop: 'giaydepphucsang' | 'phuc_sang_store'
  UNIQUE(order_id, sku)
```

**KHÔNG gộp với pos_orders.**

Xem tại: `components/revenue/InventoryOutTab.tsx`

---

## Cờ tránh double-count

| Vấn đề | Giải pháp |
|--------|----------|
| Lương ghi 2 lần (payroll module + expense_records) | Nếu payroll module > 0 → bỏ qua salary trong expenses |
| COGS ghi 2 lần (revenue_records.totalCogs + expenses) | Lọc category có 'giá vốn'/'cogs' khỏi expenses |
| revenueOther tính vào netRevenue | Cộng thủ công: `netRevenue + revenueOther` trong KPI |
