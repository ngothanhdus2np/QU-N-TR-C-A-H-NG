# Tổng hợp Công thức Tính toán — CFO Brain 4.0

> Tài liệu này liệt kê TẤT CẢ công thức đang được sử dụng trong app, phân chia theo nhóm chức năng.
> Source code tham chiếu được ghi kèm mỗi công thức.

---

## 1. GIÁ VỐN & TỒN KHO

### 1.1 Giá nhập thực tế sau chiết khấu NCC (Effective Unit Price)

> Source: `businessLogic.inventory.ts` → `calcEffectiveUnitPrice()`

Khi phiếu nhập có chiết khấu toàn đơn từ nhà cung cấp, chiết khấu được phân bổ tỷ lệ theo giá trị từng dòng:

```
itemNetAmount = quantity × price - itemDiscount
itemOrderDiscount = round((itemNetAmount / itemsNetTotal) × billDiscountAmount)
effectiveUnitPrice = max(0, (itemNetAmount - itemOrderDiscount) / quantity)
```

Trong đó:
- `itemsNetTotal` = tổng `itemNetAmount` của tất cả dòng trong phiếu nhập
- `billDiscountAmount` = max(0, itemsNetTotal - totalAmount)

### 1.2 Giá vốn bình quân gia quyền — WAC (Weighted Average Cost)

> Source: `businessLogic.inventory.ts` → `calculateNextImportPrice()` (mode `average`)
> Source: `reportCalculations.ts` → `buildCostHistory()`

```
newWAC = round((currentStock × currentWAC + importQty × effectiveUnitPrice) / (currentStock + importQty))
```

Quy tắc đặc biệt:
- `currentStock ≤ 0` → `newWAC = effectiveUnitPrice` (bắt đầu lại)
- Lần nhập đầu tiên của sản phẩm → `currentWAC` khởi tạo = `effectiveUnitPrice`
- Bán hàng giảm tồn kho nhưng **không thay đổi WAC**
- Trả hàng (khách trả) tăng tồn kho nhưng **không thay đổi WAC**

### 1.3 Giá vốn cố định (Fixed Cost Method)

> Source: `businessLogic.inventory.ts` → `calculateNextImportPrice()` (mode `fixed`)

```
newImportPrice = currentImportPrice > 0 ? currentImportPrice : incomingPrice
```

Giữ nguyên giá vốn hiện tại. Ngoại lệ: sản phẩm mới (giá vốn = 0) thì lấy giá nhập lần đầu.

### 1.4 Giá trị phiếu nhập hàng

> Source: `reportCalculations.ts` → `getTransactionAmount()`

```
transactionValue = quantity × max(0, price - discount)
```

---

## 2. DOANH THU & LỢI NHUẬN

### 2.1 Doanh thu đơn hàng

> Source: `reportCalculations.ts` → `calcOrderRevenue()`

```
revenue = totalAmount - discount        (đơn bán)
revenue = -totalAmount                  (đơn trả)
```

### 2.2 Doanh thu thuần

> Source: `reportCalculations.ts` → `addOrderAmount()`

```
netRevenue = revenue - returnedValue
```

### 2.3 Giá vốn hàng bán (COGS)

> Source: `reportCalculations.ts` → `getSalesProfitRowsByDate()`

Thứ tự ưu tiên lấy giá vốn cho mỗi sản phẩm trong đơn:

```
1. WAC từ costHistory (tại thời điểm bán)    ← tính từ phiếu nhập
2. item.importPrice (từ dữ liệu KiotViet)    ← fallback
3. product.importPrice (giá nhập hiện tại)    ← fallback cuối
```

```
COGS = Σ (unitCost × quantity)    cho tất cả item trong đơn
```

### 2.4 Lợi nhuận gộp

> Source: `reportCalculations.ts` → `getSalesProfitRowsByDate()`

```
profit = revenue - COGS
```

### 2.5 Tiền trả khách (Refund)

> Source: `reportCalculations.ts` → `getSalesHorizontalRowsByDate()`

```
returnRefund = |order.finalAmount|       (đơn trả hàng)
```

### 2.6 Import KiotViet — Doanh thu theo ngày ("Chi tiết hóa đơn")

> Source: `routes/importParsers.ts` → `parseInvoiceDetailRow()`, `orderRevenue()`, `accumulateInvoiceDayAgg()`
> Đầu vào: file Excel "Chi tiết hóa đơn" KiotViet. Mỗi đơn dedup theo mã HĐ.

Doanh thu mỗi đơn (`orderRevenue`):

```
rev = đơn trả thuần (mã "TH")           → -Tổng tiền hàng
      đơn ĐỔI/trả (có "Mã trả hàng" c11) → "Khách đã trả"  (col 42, đã net hàng đổi)
      đơn bán thường                     → "Khách cần trả" (col 41, ghi nhận ĐỦ kể cả COD chưa thu)

netRev  += rev
profit  += rev
totalGross   += Tổng tiền hàng   (col 38, chỉ đơn bán)
returnsGross += |Tổng tiền hàng|  (chỉ đơn trả thuần)
```

- **Đơn trả** nhận diện CHỈ qua mã bắt đầu `TH`. Hóa đơn bán có "Mã trả hàng" (col 11)
  là đơn **BÁN** liên kết phiếu đổi/trả (sửa BUG: trước đây nhận nhầm thành đơn trả → hiện số âm).
- **Tại sao 2 cơ sở khác nhau:** đơn bán thường lấy "Khách cần trả" (ghi nhận đủ, đúng kế toán,
  khớp KiotViet, không hụt đơn online/COD chưa thu). Đơn đổi/trả lấy "Khách đã trả" để tự trừ
  phần hàng khách đổi lại (vì file "Phiếu trả hàng" KHÔNG được import riêng).
- Đơn lưu vào `pos_orders` với `discount = max(0, Tổng tiền hàng − rev)`, `finalAmount = rev`
  → `calcOrderRevenue` (mục 2.1) ra đúng doanh thu cho mọi báo cáo UI.
- **Để khớp KiotViet 100%:** import THÊM file "Phiếu trả hàng" (xem 2.7) — trừ doanh thu theo
  "Đã trả khách". Đã kiểm chứng tháng 05/2026: hóa đơn 294.105.000 − phiếu trả 435.000 =
  **293.670.000**, khớp đúng số "Doanh thu" KiotViet.

### 2.7 Import KiotViet — Phiếu trả hàng ("Danh sách chi tiết phiếu trả hàng")

> Source: `routes/importParsers.ts` → `resolveReturnColumns()` + `parseReturnRow()`
> Endpoint: `/api/import/kiotviet-returns`. Mỗi phiếu trả → 1 đơn `pos_orders` với `is_return = true`.

**Doanh thu đơn trả** (khớp KiotViet):

```
doanh thu giảm = -|Đã trả khách|     (col 19 — tiền mặt THỰC hoàn)
```

- Lưu `total_amount = |Đã trả khách|` → `calcOrderRevenue` (đơn trả = −totalAmount) ra đúng
  −tiền hoàn. Đơn **ĐỔI hàng** (hoàn 0) → doanh thu giảm **0** (đúng: đổi hàng không sinh/mất doanh thu).
- KHÔNG trừ theo "Tổng tiền hàng trả" (giá trị hàng) — sẽ trừ thừa rất nhiều (hàng đổi). Giá trị
  hàng lưu trong `items` + `notes` để đối chiếu/tồn kho.

**Thành tiền dòng** (line item):

```
lineTotal = có cột "Thành tiền"/"Thành tiền trả"  → giá trị cột đó
            chỉ có cột "Giá bán" (đơn giá)         → |Giá bán| × quantity
```

- Phải dùng **"Thành tiền"** (line total), KHÔNG dùng "Giá bán" (đơn giá) (BUG #7 đã sửa).

---

## 3. LƯƠNG & NHÂN SỰ

### 3.1 Thâm niên

> Source: `businessLogic.payroll.ts` → `calculateSeniority()`

```
seniorityDays = floor((targetDate - joinDate) / 86400000) + 1
```

Tính cả ngày gia nhập (inclusive). Mốc tham chiếu: ngày 15 hàng tháng.

### 3.2 Xác định bậc lương

> Source: `businessLogic.payroll.ts` → `determineCurrentPolicy()`

Logic **Top-Down Range Matching**:
1. Nếu nhân viên có `assignedPolicyId` → dùng policy đó
2. Nếu không → sắp xếp policy theo `startThreshold` giảm dần
3. Tìm policy đầu tiên mà `seniorityDays ∈ [startThreshold, endThreshold)`
4. `endThreshold = 0` được hiểu là vô cực (∞)

### 3.3 Lương cơ bản

> Source: `businessLogic.payroll.ts` → `calculateEmployeePayroll()`

**Lương theo tháng:**
```
basicActual = round((baseSalary / daysInMonth) × workingDays)
```

**Lương theo ngày (giờ):**
```
basicActual = round((baseSalary / 11) × totalHoursWorked)
```

Trong đó `11` = số giờ 1 ca chuẩn.

### 3.4 Phụ cấp

> Source: `businessLogic.payroll.ts` → `calculateEmployeePayroll()`

**Lương tháng:**
```
allowance = round((chuyenCan + veSinh + cskh + nhaO) × proRateFactor) + round(comToi × workingDays)
proRateFactor = workingDays / daysInMonth
```

**Lương ngày:**
```
allowance = round(comToi × workingDays)
```

Phụ cấp bị mất nếu vi phạm kỷ luật tương ứng (chuyên cần, vệ sinh, CSKH, nhà ở, cơm tối).

### 3.5 Lương trách nhiệm

```
responsibilityPay = round((responsibilityAllowance / daysInMonth) × workingDays)
```

Điều kiện: phải được phê duyệt (`isResponsibilityApproved`) VÀ không bị tước do vi phạm.

### 3.6 Hoa hồng (Commission)

```
commissionPay = round(totalSalesAmount × (commissionRate / 100))
```

### 3.7 Tăng ca (Overtime)

```
otHours = totalOvertimeMinutes / 60
otPay = round(otHours × otRate)
```

### 3.8 Thưởng thâm niên

```
seniorityBonus = floor(seniorityDays / 365) × seniorityBonusPerYear
```

Chỉ áp dụng cho nhân viên chính thức (`seniorityDays ≥ 30`).

### 3.9 Thưởng ngày lễ

```
holidayBonus = monthHolidaysCount × (baseSalary / daysInMonth)     (lương tháng)
holidayBonus = monthHolidaysCount × baseSalary                      (lương ngày)
```

Chỉ tính nếu nhân viên đi làm ngày lễ đó.

### 3.10 Thưởng Tết

Thưởng trước Tết:
- 28 Tết (có mặt): `carAllowance`
- 29 Tết (có mặt): `bonus29Tet`
- 30 Tết (có mặt): `bonus30Tet`
- Ngày extra trước Tết (đi đủ tất cả): `beforeTetExtraBonus`

Thưởng sau Tết:
- Ngày mùng (có mặt): `lixiBonus`
- Ngày extra sau Tết (đi đủ tất cả): `afterTetExtraBonus`

### 3.11 Phạt kỷ luật

> Source: `businessLogic.payroll.ts` → `calculateEmployeePayroll()`

Parse từ `ViolationType.fine1/fine2/fine3`:
- Pattern `XYZk` → `XYZ × 1000` VNĐ
- Số cuối cùng < 1000 → nhân 1000
- Số cuối cùng ≥ 1000 → giữ nguyên

### 3.12 Lương thực nhận (Net Pay)

```
rawNet = basicActual + allowance + responsibilityPay + otPay + commissionPay
       + seniorityBonus + holidayBonus + tetBonus
       - disciplinaryDeduction - shortageAmount - totalAdvance

available = max(0, rawNet)
cfDeduction = min(available, carryForwardDebt)
netPay = available - cfDeduction

newDebtThisPeriod = max(0, -rawNet)
carryForwardDebtOut = carryForwardDebt - cfDeduction + newDebtThisPeriod
```

Lương âm → chuyển thành nợ kỳ sau, trừ dần khi có lương dương.

### 3.13 Chuyên cần — Điều kiện mất phụ cấp

> Source: `businessLogic.payroll.ts` → `shouldCutAttendanceAllowanceByLeave()`

```
mấtChuyênCần = (nghỉ phép > 1 ngày) HOẶC (nghỉ không phép > 0 ngày)
```

---

## 4. PHÂN TÍCH TÀI CHÍNH

### 4.1 Biên lợi nhuận ròng (Net Margin)

> Source: `businessLogic.revenue.ts` → `calculateFinancialHealthScore()`

```
netProfit = totalGrossProfit - totalOpEx
netMargin = (netProfit / totalRevenue) × 100
```

### 4.2 Doanh thu trên nhân viên (RPE)

> Source: `businessLogic.revenue.ts` → `calculateStaffProductivity()`

```
RPE = totalRevenue / activeStaffCount
```

### 4.3 Tỷ lệ quỹ lương

```
payrollRatio = (totalPayroll / totalRevenue) × 100
```

### 4.4 Điểm hòa vốn (Break-Even)

> Source: `businessLogic.revenue.ts` → `calculateExpenseAnalysis()`

```
variableRatio = (totalCOGS + variableCosts) / totalRevenue
contributionMarginRatio = 1 - variableRatio
breakEvenRevenue = totalFixedCosts / contributionMarginRatio
safetyMargin = ((totalRevenue - breakEvenRevenue) / totalRevenue) × 100
```

`totalFixedCosts` = chi phí cố định + khấu hao + lãi vay.

### 4.5 Hòa vốn theo ngày

> Source: `businessLogic.revenue.ts` → `calculateDailyBreakEven()`

```
dailyFixedCost = monthlyFixedCosts / daysInMonth
dailyBreakEvenRevenue = dailyFixedCost / (grossMarginPercent / 100)
progress = min((currentRevenue / dailyBreakEvenRevenue) × 100, 100)
```

### 4.6 Điểm sức khỏe tài chính

> Source: `businessLogic.revenue.ts` → `calculateFinancialHealthScore()`

```
baseScore = 70
+ 15 nếu netMargin > 20%
+ 10 nếu coverageRatio > 50%
score ∈ [0, 100]
```

### 4.7 Độ phủ đội sale (Coverage Ratio)

```
coverageRatio = (totalConsultedSales / totalRevenue) × 100
```

---

## 5. PHÂN TÍCH CHIẾN LƯỢC

### 5.1 Phân loại ABC (theo doanh thu tích lũy)

> Source: `businessLogic.revenue.ts` → `calculateSeasonalityAnalysis()`

Sắp xếp nhóm hàng theo doanh thu giảm dần, tính % tích lũy:

```
≤ 70% tích lũy → Nhóm A (chủ lực)
≤ 90% tích lũy → Nhóm B (trung bình)
> 90% tích lũy → Nhóm C (đuôi dài)
```

### 5.2 Ma trận BCG

> Source: `businessLogic.revenue.ts` → `calculateSeasonalityAnalysis()`

```
avgRevenue = totalAllRevenue / numberOfGroups
avgGrowth = mean(growthRate của tất cả nhóm)

growthRate = (secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue × 100
```

| | Tăng trưởng cao | Tăng trưởng thấp |
|---|---|---|
| **Thị phần cao** | ⭐ Star | 🐄 Cash Cow |
| **Thị phần thấp** | ❓ Question Mark | 🐕 Dog |

### 5.3 KPI nhân viên bán hàng

> Source: `businessLogic.revenue.ts` → `calculateMarketingPerformance()`

```
mean = totalSales / numberOfStaff
variance = Σ(staffSales - mean)² / numberOfStaff
kpiMin = max(mean - √variance, mean × 0.5)
kpiMax = mean(top 20% performers)
```

- `≥ kpiMax` → **Elite**
- `≥ kpiMin` → **Safety**
- `< kpiMin` → **Under**

### 5.4 Xếp hạng nhân viên

> Source: `businessLogic.payroll.ts` → `calculateStaffRanking()`

```
contribution = (staffSalesAmount / totalStoreSales) × 100
```

Sắp xếp theo `totalAmount` giảm dần, gán rank 1, 2, 3...

---

## 6. BENCHMARKS NGÀNH (MIS)

> Source: `businessLogic.revenue.ts` → `calculateMISMetrics()`

| Chỉ số | Mục tiêu | Ngưỡng cảnh báo | Ngưỡng nguy hiểm |
|---|---|---|---|
| Giá vốn (COGS) | 65% | > 65% | > 75% |
| Nhân sự (Labor) | 12% | > 12% | > 18% |
| Mặt bằng (Rent) | 10% | > 10% | > 15% |
| Marketing | 5% | > 5% | > 8% |
| Vận hành (OpEx) | 30% | > 30% | > 40% |

Tất cả tính theo % trên doanh thu.

**Hotspots**: So sánh chi phí kỳ hiện tại vs kỳ trước, lấy top 3 danh mục tăng nhiều nhất.

---

## 7. BÁO CÁO

### 7.1 Báo cáo cuối ngày

> Source: `reportCalculations.ts` → `getEndOfDayReportRows()`

```
invoiceCount = số đơn bán (không phải trả hàng)
invoiceRevenue = Σ calcOrderRevenue(đơn bán)
returnCount = số đơn trả hàng
returnValue = Σ |totalAmount| (đơn trả)
netRevenue = invoiceRevenue - returnValue
```

### 7.2 Báo cáo nhà cung cấp

> Source: `reportCalculations.ts` → `getSupplierReportRows()`

```
importValue = Σ getTransactionAmount(phiếu nhập)
returnValue = Σ getTransactionAmount(phiếu trả NCC)
netValue = importValue - returnValue
```

### 7.3 Báo cáo hàng hóa

> Source: `reportCalculations.ts` → `getGoodsReportRows()`

Theo từng sản phẩm:
```
quantity = Σ item.quantity (đơn bán)
revenue = Σ (item.quantity × item.price - item.discount)
returnQuantity = Σ item.quantity (đơn trả)
returnValue = Σ (item.quantity × item.price) (đơn trả)
```

---

## PHỤ LỤC: Phân loại chi phí

> Source: `businessLogic.revenue.ts` → `getCategoryType()`

Truy vết danh mục cha cao nhất (root category), phân loại theo tên/ID:

| Root category | Loại |
|---|---|
| `cat-fixed` / chứa "cố định" | Fixed |
| `cat-depreciation-root` / chứa "khấu hao" | Depreciation |
| `cat-interest-root` / chứa "lãi vay" / "lãi ngân hàng" | Interest |
| Chứa "giá vốn" / "cogs" | COGS |
| Còn lại | Variable |

Nhân sự luôn được tính là chi phí **cố định** (fixed) trong phân tích hòa vốn.

---

## 8. KHÁCH HÀNG

### 8.1 Mã khách hàng (Customer Code)

> Source: `CustomerListPage.tsx` → `codeMap` useMemo

```
code = "KH" + padStart(index + 1, 6, '0')
```

Khách hàng được sắp xếp theo `id` (alphabetical), rồi đánh mã tự tăng: KH000001, KH000002...
Mã này tạo ở frontend, không lưu trong database.

### 8.2 Doanh thu khách hàng (Order Stats — Tổng bán / Trả hàng)

> Source: `CustomerListPage.tsx` → `orderStats` useMemo
> Source: `reportCalculations.ts` → `calcOrderRevenue()`

```
sold = Σ calcOrderRevenue(đơn bán)              cho tất cả đơn bán của khách
returned = Σ |totalAmount|                       cho tất cả đơn trả hàng của khách
```

Trong đó `calcOrderRevenue`:
```
revenue = totalAmount - discount                 (đơn bán)
discount = |order.discount|                       (nếu có)
         = max(0, totalAmount - finalAmount)      (nếu không có discount field)
```

- `sold` = tổng doanh thu đơn bán (hiển thị cột "Tổng bán")
- `returned` = tổng giá trị trả hàng (dùng `|totalAmount|`, không dùng finalAmount)

### 8.3 Doanh thu thuần khách hàng (Net Spent)

> Source: `CustomerListPage.tsx` → `totals.net`
> Source: `CustomerDetailPage.tsx` → `netSpent`

```
netSpent = sold - returned
```

Hiển thị cột "Trừ trả hàng" trong trang danh sách.

### 8.4 Doanh thu theo khoảng thời gian (Spent in Range)

> Source: `CustomerListPage.tsx` → `spentInRangeMap` useMemo

```
spentInRange = Σ calcOrderRevenue(đơn bán trong [spentFrom, spentTo])
```

Chỉ tính đơn bán (không tính trả hàng), chỉ đơn trong khoảng ngày filter.
Dùng khi user filter "Tổng bán" kết hợp với "Thời gian".

### 8.5 Ngày giao dịch cuối (Last Transaction)

> Source: `CustomerListPage.tsx` → `lastTransactionMap` useMemo

```
lastTransaction = max(order.date)    cho tất cả đơn của khách (bán + trả)
```

So sánh bằng `new Date().getTime()`, lấy đơn có ngày lớn nhất.

### 8.6 Nợ từng đơn hàng (Order Debt)

> Source: `CustomerListPage.tsx` → `debtStats` useMemo
> Source: `CustomerDetailPage.tsx` → `customerDebt`

```
orderDebt = finalAmount - cashReceived        (đơn bán thường)
orderDebt = -(finalAmount - cashReceived)     (đơn trả hàng, is_return = true)
```

Trong đó:
- `finalAmount` = giá trị đơn hàng sau chiết khấu (`pos_orders.final_amount`)
- `cashReceived` = số tiền khách đã trả (`pos_orders.cash_received`, lấy từ cột "Khách đã trả" trong KiotViet)
- Đơn trả hàng (`is_return = true`, prefix TH): nợ bị trừ (khách trả hàng → giảm nợ)

### 8.7 Nợ hiện tại của khách hàng (Customer Debt)

> Source: `CustomerListPage.tsx` → `debtStats`; `CustomerDetailPage.tsx` → `customerDebt`
> **Hai nơi PHẢI dùng đúng cùng công thức này** — nếu lệch, danh sách và chi tiết hiện 2 số khác nhau.

```
recordDelta  = Σ ( type === 'repay' ? -amount : +amount )   trên customer_debt_history của khách
customerDebt = max(0, Σ orderDebt + recordDelta)            cho tất cả đơn + bản ghi của khách đó
```

Quy tắc:
- Nợ tính từ **toàn bộ đơn hàng** (all-time) **cộng** các bản ghi điều chỉnh thủ công (`customer_debt_history`)
- Bản ghi `customer_debt_history`: "Thu nợ" và "Ghi giảm nợ" là `type='repay'` (trừ nợ); "Điều chỉnh" có thể `repay` hoặc `debt` tùy chênh lệch so với nợ hiện tại
- Nợ **không được âm** (floor ở 0) — khách trả thừa / ghi giảm quá tay không tạo credit, khớp logic KiotViet
- Chỉ tính đơn + bản ghi có `customerId` khớp với `pos_customers.id`

### 8.8 Tổng nợ trang danh sách khách hàng

> Source: `CustomerListPage.tsx` → `totals.debt`

```
totalDebt = Σ customerDebt    cho tất cả khách trong danh sách đã filter
```

Vì `debtStats` Map chỉ chứa khách có nợ > 0, khách nợ ≤ 0 tự động = 0.

### 8.9 Tổng doanh thu trang danh sách

> Source: `CustomerListPage.tsx` → `totals.spent`, `totals.net`

```
totalSpent = Σ (orderStats[customerId].sold)       cho tất cả khách đã filter
totalNet   = Σ (sold - returned)                   cho tất cả khách đã filter
```

### 8.10 Xác định đơn trả hàng (isReturn)

> Source: `apiService.ts` → `inferIsReturnOrder()`

```
isReturn = explicit === true
         OR orderCode bắt đầu bằng "TH" (regex /^TH/i)
         OR finalAmount < 0
```

Ưu tiên giá trị `is_return` từ database, fallback theo mã đơn và giá trị.

### 8.11 Nguồn dữ liệu `cashReceived`

> Source: `apiService.ts` → `mapPosOrderRow()`, `routes/import.ts`

- Cột `cash_received` trong bảng `pos_orders` (Supabase)
- Import từ KiotViet Excel: cột "Khách đã trả" (thường index 42 trong format "Chi tiết hóa đơn" và "kiotviet-invoices")
- Tìm cột động bằng `col('Khách đã trả', 42)` — ưu tiên tên cột, fallback index 42
- Mapping: `cash_received` (DB) → `cashReceived` (frontend) qua `mapPosOrderRow()`
- Nếu `cash_received` = null trong DB → `cashReceived` = undefined → tính như 0
- `POS_ORDER_BOOTSTRAP_DAYS = 0` → load toàn bộ đơn hàng (không giới hạn ngày)

---

## 9. Khách đặt (customerOrders) — Tính tự động từ đơn đặt hàng

> Source: `components/pos/GoodsInventory.tsx` → `pendingOrdersMap` + `enrichProduct()`

### 9.1 Công thức

```
pendingQuantity(productId) = SUM(item.quantity)
  WHERE order.status = 'pending'
  AND item.productId = productId

customerOrders(productId) = MAX(pendingQuantity, importedValue)
```

- `importedValue`: giá trị `customerOrders` gốc trên sản phẩm (từ KiotViet import hoặc nhập tay)
- `pendingQuantity`: tổng số lượng sản phẩm trong các đơn đặt hàng đang chờ (`status = 'pending'`)
- Lấy `MAX` để không bỏ sót: nếu KiotViet có số lớn hơn thì giữ, nếu app có nhiều đơn hơn thì dùng số app

### 9.2 Nguồn dữ liệu

- `posOrders` (bảng `pos_orders`) — filter `status = 'pending'`
- `posProducts.customerOrders` — giá trị import gốc (fallback)

### 9.3 Nơi hiển thị

- Cột "Khách đặt" trong bảng danh sách hàng hoá (`GoodsProductRow.tsx`)
- Panel chi tiết sản phẩm → bảng tồn kho chi nhánh (`GoodsProductDetailPanel.tsx`)
- Tính "Tồn dự kiến" = stock - customerOrders

### 9.4 Quy tắc đặc biệt

- Cơ chế import KiotViet vẫn được giữ nguyên — giá trị import lưu trên field `customerOrders` của sản phẩm
- Giá trị hiển thị được tính realtime (computed) tại thời điểm render, không ghi đè lên database
- Khi đơn đặt hàng hoàn thành hoặc huỷ, `pendingQuantity` tự động giảm

---

## 10. SHOPEE — BÁO CÁO XUẤT KHO (InventoryOutTab)

> Source: `components/revenue/InventoryOutTab.tsx`

### 10.1 Sàn Thanh Toán (Platform Net)

```
Sàn Thanh Toán = Giá trị đơn
               − Phí cố định (platformFee)
               − PiShip (pishipFee)
               − Phí dịch vụ vận chuyển (freeshipExtra)
               − Phí thanh toán (paymentFee)
               − VAT (vatTax)
               − Thuế TNCN (personalIncomeTax)
               − Affiliate fee (affiliateFee)
```

Source: `calcPlatformNet()` — không bao gồm chi phí quảng cáo và vận hành.

### 10.2 Lợi Nhuận (Net Profit)

```
Lợi Nhuận = Sàn Thanh Toán
           − Giá gốc × Số lượng
           − Quảng cáo (adsCost)
           − Thuế QC (adsTax)
           − Phí vận hành (handlingFee)
```

Source: `calcNetProfit()` — Giá gốc (`importPrice`) tra theo SKU từ `shopeeSourceData` (không hiển thị thành cột riêng).

Quy tắc đặc biệt:
- Đơn huỷ (`status === 'CANCEL'`): **tất cả cột từ "Khách Thanh Toán" đến "Lợi Nhuận" đều = 0**, kể cả Số lượng = 0 (để không sai tồn kho)
- Nếu SKU không tìm thấy trong `shopeeSourceData` → Giá gốc = 0 (không lỗi)
- Lợi Nhuận âm → hiển thị màu đỏ (`text-rose-600`); dương → màu xanh (`text-emerald-700`)

---

## 11. HỦY PHIẾU TRẢ & XÓA ĐƠN (SOFT-DELETE) — thêm 2026-07-04

### 11.1 Xóa đơn bán = soft-delete (không xóa khỏi DB)

> Source: `services/posOrderService.ts` → `deletePosOrder()`

Đơn bị "xóa" chuyển `status = 'cancelled'`, vẫn xem lại được ở trang Hóa đơn qua lọc
"Đã hủy". **Đơn cancelled bị loại khỏi TOÀN BỘ tính toán**: doanh thu, doanh số NV,
thống kê khách hàng, báo cáo, POS (chọn đơn sửa/trả), AI agent, recalculate backend.

Phép đảo khi hủy đơn bán:
```
tồn kho          += quantity từng item        (qua RPC delete_inventory_transaction_with_stock_v2)
revenue_records  -= buildRevenueDelta(đơn)    (delta đảo dấu, atomic theo ngày bán)
customer.totalSpent -= finalAmount            (clamp ≥ 0)
customer.points     -= pointsEarned           (clamp ≥ 0)
customer.debtAmount -= Σ(debt) − Σ(payment)   (các dòng customer_debt_history có orderId, bị xóa kèm)
sales_records    = tính lại cả ngày, loại đơn đã hủy
```

Điểm lọc tập trung: `components/MainContent.tsx` → `activeData`/`activePosOrders`
(mọi trang tính toán nhận orders đã lọc cancelled — trừ trang Hóa đơn/Trả hàng cần
hiển thị lịch sử). Backend: các query `pos_orders` thêm
`.or('status.is.null,status.neq.cancelled')`.

### 11.2 Hủy phiếu trả hàng

> Source: `services/posOrderService.ts` → `processCancelReturn()` (phiếu TH chuẩn)
> và `processCancelLegacyReturnTransaction()` (phiếu kiểu cũ chỉ có inventory transaction)

Phiếu trả chuyển `status = 'cancelled'`. Phép đảo (nghịch đảo đúng của `processReturnOrder`):
```
tồn kho:  hàng TRẢ (lineType ≠ 'exchange')  → TRỪ lại kho (khách lấy lại hàng)
          hàng ĐỔI (lineType = 'exchange')  → CỘNG lại kho (hàng đổi quay về)
          — cả 2 qua RPC delete theo tx.type đã lưu; hàng trả đã bán tiếp → RPC chặn (exception)
revenue_records += negate(buildReturnRevenueDelta)   (atomic theo ngày phiếu)
customer.points     += floor(Σ item trả có allowPoints / pointsRate)
customer.totalSpent += totalReturnValue − totalExchangeValue   (clamp ≥ 0)
sales_records = tính lại cả ngày (phiếu cancelled đóng góp 0)
```
Bản sao inventory transaction `status='cancelled'` được giữ lại làm lịch sử kho.

### 11.3 Doanh số NV với phiếu trả (fix POS-RETURN-01)

> Source: `src/lib/posSalesAttribution.ts` → `calculateOrderStaffSales()`

```
Phiếu POS native (items có lineType):
  extraPaid = max(0, Σ total hàng đổi − Σ total hàng trả)   — trả thuần → 0
Đơn import KiotViet (không lineType):
  extraPaid = max(0, finalAmount)                            — fallback duy nhất
```
Phiếu trả thuần POS lưu `finalAmount` DƯƠNG = tiền hoàn khách (FIX C2) — **không**
được đọc là "khách bù thêm". Doanh số NV chỉ tăng khi khách thật sự bù tiền đổi hàng.

### 11.4 Guard chống trả trùng

> Source: `src/lib/returnGuards.ts` → `getReturnedQuantitiesForOrder()`

```
SL còn được trả (mỗi SP) = SL mua gốc − Σ SL đã trả ở các phiếu trước (chưa hủy)
```
Nguồn "đã trả": phiếu TH có `original_order_id` = đơn gốc (migration 025; phiếu cũ
match qua notes chứa mã đơn) + inventory transaction 'Return' kiểu cũ có
`referenceId` = đơn gốc. Đơn trả đủ toàn bộ → chặn mở tab trả hàng.
