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
