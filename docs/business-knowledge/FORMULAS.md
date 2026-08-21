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

**Nguồn `totalAmount`/`discount` tại POS** (Source: `components/pos/POSComputer.tsx`, hàm dựng `newOrder`):

```
itemsDiscountTotal = Σ (item.discount × item.quantity)     — giảm giá áp riêng từng dòng sản phẩm
totalAmount = Σ item.total (đã net item-discount) + itemsDiscountTotal   — TỔNG GỘP TRƯỚC mọi giảm giá
discount    = (giảm giá hóa đơn + khuyến mãi tự động) + itemsDiscountTotal — TỔNG CẢ 2 loại giảm giá
```

Trước 2026-08-13, `totalAmount`/`discount` chỉ tính phần giảm giá HÓA ĐƠN (nút "Giảm giá" bên phải khung thanh toán) — giảm giá áp riêng từng sản phẩm (click vào ô đơn giá trong giỏ) bị bỏ sót hoàn toàn, khiến `revenue_records.discount` luôn thiếu/sai khi nhân viên chỉ dùng giảm giá theo sản phẩm (`netRevenue`/lợi nhuận gộp không bị ảnh hưởng, chỉ riêng khoản mục "Giảm giá" báo cáo sai). Đã sửa để cộng dồn đủ cả 2 loại — xem HISTORY.md 2026-08-13.

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

**Attribution chủ cửa hàng**: ô chọn người bán trên POS có 1 lựa chọn giả `OWNER_STAFF_ID` = `'OWNER'` (tên hiển thị "Ngô Thành Du" — `OWNER_STAFF_NAME`, `components/shared/staff.ts`) — dùng khi chủ cửa hàng tự bán mà không muốn gắn doanh số cho một nhân viên thật. Đây KHÔNG phải bản ghi trong bảng `employees` nên không lọt vào `mean`/`variance`/`kpiMin`/`kpiMax` ở trên hay vào `totalStoreSales` ở mục 5.4 — `buildPosSalesRecordsForDate`/`buildPosSalesRecordUpsertsForDate` (`src/lib/posSalesAttribution.ts`) lọc bỏ các dòng `employeeId === OWNER_STAFF_ID` trước khi ghi vào bảng `sales_records`. Riêng báo cáo cuối ngày (`EndOfDayReport` → `calculateStaffSalesForDate`) vẫn hiển thị đúng dòng "Ngô Thành Du" để đối soát tổng doanh thu trong ngày.

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

> Source: `routes/data.ts` → `GET /api/data/customer-stats` (tính ở server, xem ghi chú 8.7)
> Source: `CustomerDetailPage.tsx` → `customerDebt` (vẫn tính client, vì đã có sẵn orders của riêng khách đó qua `apiService.fetchOrdersForCustomer`)

```
orderDebt = finalAmount - cashReceived        (đơn bán thường)
orderDebt = -(finalAmount - cashReceived)     (đơn trả hàng, is_return = true)
```

Trong đó:
- `finalAmount` = giá trị đơn hàng sau chiết khấu (`pos_orders.final_amount`)
- `cashReceived` = số tiền khách đã trả (`pos_orders.cash_received`, lấy từ cột "Khách đã trả" trong KiotViet)
- Đơn trả hàng (`is_return = true`, prefix TH): nợ bị trừ (khách trả hàng → giảm nợ)

### 8.7 Nợ hiện tại của khách hàng (Customer Debt)

> Source: `routes/data.ts` → `GET /api/data/customer-stats` (route backend, dùng cho trang Danh sách khách hàng)
> Source: `CustomerDetailPage.tsx` → `customerDebt` + `DebtTab` (tính client, riêng cho 1 khách)
> **Hai nơi PHẢI dùng đúng cùng công thức này** — nếu lệch, danh sách/chi tiết/bảng lịch sử hiện số khác nhau.
>
> **[2026-08-21] Chuyển tính toán từ client sang server**: trước đây `CustomerListPage.tsx` tự kéo
> TOÀN BỘ `pos_orders` về trình duyệt rồi tính `debtStats`/`orderStats`/`lastTransactionMap` bằng JS
> mỗi lần mở trang — đây là lý do trang Khách hàng chậm hơn hẳn trang Hàng hoá dù ít bản ghi hơn
> (Hàng hoá dùng data đã bootstrap sẵn + phân trang, không fetch thêm). Nay route
> `GET /api/data/customer-stats` (service-role, `requireAuth`) làm đúng công thức bên dưới bằng
> Node, phân trang `pos_orders` + `customer_debt_history` ở server, trả về 1 dòng tổng hợp/khách
> thay vì toàn bộ đơn hàng. `apiService.fetchCustomerStats()` cache kết quả 60s (tránh gọi lại mỗi
> lần chuyển tab qua lại). Công thức toán học KHÔNG đổi, chỉ đổi nơi tính.

```
recordDelta  = Σ ( type === 'repay' ? -amount : +amount )
               trên customer_debt_history của khách,
               LOẠI bản ghi type='debt' có orderId khớp 1 đơn còn tồn tại
customerDebt = max(0, Σ orderDebt + recordDelta)            cho tất cả đơn + bản ghi của khách đó
```

Quy tắc:
- Nợ tính từ **toàn bộ đơn hàng** (all-time) **cộng** các bản ghi điều chỉnh thủ công (`customer_debt_history`)
- Bản ghi `customer_debt_history`: "Thu nợ" và "Ghi giảm nợ" là `type='repay'` (trừ nợ); "Điều chỉnh" có thể `repay` hoặc `debt` tùy chênh lệch so với nợ hiện tại
- **[FIX 2026-08-14] Tránh đếm trùng**: khi bán nợ qua POS (Ghi nợ khách hàng), hệ thống ghi CẢ HAI: (1) đơn hàng với `cashReceived=0` → đã cộng đủ vào `orderDebt`, VÀ (2) 1 bản ghi `customer_debt_history` type='debt' cùng `orderId`, `amount` = đúng khoản chưa thu đó (dùng để hiển thị lịch sử/audit). Nếu cộng cả 2 → nợ hiển thị gấp đôi thực tế. Bản ghi `debt` có `orderId` trỏ tới đơn edit (khi sửa đơn tăng nợ) cũng bị loại theo cùng lý do — `finalAmount`/`cashReceived` sau khi sửa đã phản ánh đúng số nợ mới nhất của đơn đó.
  - Chỉ **điều chỉnh nợ thủ công** (không có `orderId`, tạo từ trang Chi tiết khách hàng — "Điều chỉnh", "Ghi giảm nợ") và **mọi khoản thu nợ** (`type='repay'`, không phản ánh lại vào `cashReceived` của đơn) mới được cộng từ `customer_debt_history`.
  - Nếu đơn hàng gắn với 1 bản ghi `debt` bị xóa khỏi hệ thống (huỷ đơn...), bản ghi đó không còn bị loại nữa (orderId không khớp đơn nào còn tồn tại) → tự động được tính lại từ `customer_debt_history`, tránh mất nợ khi đơn gốc biến mất.
- Nợ **không được âm** (floor ở 0) — khách trả thừa / ghi giảm quá tay không tạo credit, khớp logic KiotViet
- Chỉ tính đơn + bản ghi có `customerId` khớp với `pos_customers.id`

### 8.8 Tổng nợ trang danh sách khách hàng

> Source: `CustomerListPage.tsx` → `totals.debt` (cộng từ `debtStats` Map, dữ liệu lấy từ `GET /api/data/customer-stats`)

```
totalDebt = Σ customerDebt    cho tất cả khách trong danh sách đã filter
```

Vì `debtStats` Map chỉ chứa khách có nợ > 0, khách nợ ≤ 0 tự động = 0.

### 8.9 Tổng doanh thu trang danh sách

> Source: `CustomerListPage.tsx` → `totals.spent`, `totals.net` (cộng từ `orderStats` Map, dữ liệu lấy từ `GET /api/data/customer-stats`)

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

### 10.0 PiShip = Phí bảo vệ người bán (đã xác minh bằng dữ liệu thật 2026-07-08)

Cột **"Phí PiShip"** = giá trị Shopee field **`SELLER_PROTECTION_FEE`** (Shopee hiển thị
"Phí dịch vụ PiShip"), KHÔNG phải phí vận chuyển. Bot (`shopee-monitor/bots/orders.js` +
`backfill-fees-fast.js`) trích từ `seller_income_breakdown.breakdown → FEES_AND_CHARGES →
SELLER_PROTECTION_FEE`. Trước 2026-07-06 bot dò khóa `PISHIP_FEE`/`PISHIP_SERVICE_FEE`
(không tồn tại trong JSON Shopee) → luôn = 0.

**Xác minh 2026-07-08**: đối chiếu trực tiếp với screenshot Shopee đơn `2607072XFTWSWH` —
fetch lại đúng đơn này bằng field `SELLER_PROTECTION_FEE` cho ra `piship_fee = -2.700` và
`escrow_amount = 208.085`, **khớp tuyệt đối** (từng đồng) với "Phí dịch vụ PiShip" và
"Doanh thu đơn hàng ước tính" Shopee hiển thị. Field này **KHÔNG cố định giá trị ở mọi đơn**
(một số đơn = 0 thật, không phải lỗi quét) — khác giả định ban đầu "đơn nào cũng có".
Việc sửa field cũng làm `total_fee` khớp đúng `FEES_AND_CHARGES` (trước đây thiếu khoản
bảo vệ người bán).

**Công thức đối chiếu (đơn mẫu, khớp Shopee)**:
```
Doanh thu ước tính = Tổng tiền SP − Phụ phí (cố định+PiShip+dịch vụ+xử lý GD) − Thuế (VAT+TNCN)
208.085            = 299.000        − 86.430                                   − 4.485
```
Phí vận chuyển (`ACTUAL_SHIPPING_FEE`) không nằm trong công thức trên vì Shopee đã bù
(`SHIPPING_REBATE_FROM_SHOPEE`) về **net 0** ở đơn thành công — không cần cột riêng trong
`calcPlatformNet()`.

### 10.0b Phí Ads Shopee = AMS_COMMISSION_FEE (thêm 2026-07-08)

**Nguyên nhân lệch 65-81% đơn, 12-15k đ/đơn so với escrow thật**: thiếu field
Shopee **`AMS_COMMISSION_FEE`** (Ads Management System) — phí hoa hồng quảng cáo
Shopee tự trừ theo **TỪNG đơn cụ thể** do Shopee Ads mang lại. Khác hoàn toàn với
cột `adsCost` hiện có (ngân sách QC user tự nhập tay, phân bổ theo ngày — xem §10.2b).

Bot (`shopee-monitor/bots/orders.js`, `backfill-fees-fast.js`) trích từ
`seller_income_breakdown.breakdown → FEES_AND_CHARGES → AMS_COMMISSION_FEE`, lưu
cột `ams_commission_fee` (SQLite) → prorate theo tỷ trọng giá trị SKU (như §10.3)
→ `shopee_ads_fee` (Supabase, cột `shopeeAdsFee` phía app).

**Lưu ý khi đọc dữ liệu**: `shopeeAdsFee = 0` có thể là **giá trị đúng** (đơn hữu
cơ — không đến từ quảng cáo), không nhất thiết là lỗi/thiếu dữ liệu.

> ⚠️ **Tiêu chí "đơn hiệu quả" KHÔNG còn dựa vào `shopeeAdsFee > 0`.** User chốt
> 2026-07-09: đơn hiệu quả = đơn có `status ∈ {OK, SHIPPING}` (đã giao / đang giao)
> — xem §10.2b. Lý do đổi: `shopeeAdsFee` (từ AMS_COMMISSION_FEE) đồng bộ trễ vài
> ngày do Shopee quyết toán chậm, khiến các ngày gần nhất luôn phân bổ ra 0.

### 10.1 Sàn Thanh Toán (Platform Net)

```
Sàn Thanh Toán = Giá trị đơn
               − Phí cố định (platformFee)
               − PiShip = phí bảo vệ người bán (pishipFee)
               − Phí dịch vụ vận chuyển (freeshipExtra)
               − Phí thanh toán (paymentFee)
               − VAT (vatTax)
               − Thuế TNCN (personalIncomeTax)
               − Affiliate fee (affiliateFee)
               − Phí Ads Shopee = AMS_COMMISSION_FEE (shopeeAdsFee)  ← thêm 2026-07-08
```

Source: `calcPlatformNet()` — chỉ tính cho **đơn thành công** (OK/SHIPPING); đơn khác = 0.
Không bao gồm chi phí quảng cáo tự nhập tay (`adsCost`, xem §10.2b) và vận hành.

### 10.2 Lợi Nhuận (Net Profit) — theo loại đơn (cập nhật 2026-07-11)

> **Source (2026-07-11, nguồn DUY NHẤT)**: `src/lib/shopeeProfit.ts` —
> `shopeeOrderKind()`, `calcShopeePlatformNet()`, `calcShopeeNetProfit()`.
> Mọi nơi (UI hiển thị `InventoryOutTab.tsx`, job phân bổ QC `routes/adsSpendSync.ts`,
> 3 đường ghi + nhập tay + **luồng import Excel** trong `useShopeeInventoryOut.ts`)
> đều import từ đây — KHÔNG chép lại.
> Trước 2026-07-11, 3 đường ghi frontend dùng bản cũ thiếu PiShip/VAT/TNCN/Phí Ads
> Shopee và không phân nhánh đơn hủy/hoàn → cột `net_profit` lưu trên Supabase lệch
> với số hiển thị (audit 2026-07-11 mục A, đã sửa). Audit lần 3 cùng ngày phát hiện
> thêm đường thứ 5 (import Excel) còn sót bản inline: đơn hoàn ghi 0 thay vì
> −(PiShip + Vận hành) và giá vốn quên nhân số lượng — đã đưa về công thức chuẩn.

Phân loại theo `status`, `calcShopeeNetProfit()`:

| Loại đơn | status | Lợi nhuận |
|---|---|---|
| **Thành công** | `OK`, `SHIPPING` | Sàn TT − Giá gốc×SL − QC (adsCost) − Thuế QC (adsTax) − Phí Vận Hành (handlingFee) |
| **Giao thất bại / Hoàn hàng** | `FAILED`, `RETURN`, `RETURNED` | **−(PiShip + Phí Vận Hành)** — lỗ thuần, **không trừ giá gốc** (hàng về kho) |
| **Huỷ chưa giao / chờ / thất lạc** | `CANCEL`, `PENDING`, `LOST` | **0** |

Giá gốc (`importPrice`) tra theo SKU từ `shopeeSourceData`.

Quy tắc hiển thị cột theo loại đơn:
- **Thành công**: hiện đủ mọi phí + doanh thu.
- **Lỗ ship (FAILED/RETURN/RETURNED)**: CHỈ hiện **PiShip + Phí Vận Hành**; các phí Shopee khác, Khách TT, Sàn TT, SL = 0; Lợi Nhuận = −(PiShip + Phí Vận Hành).
- **Huỷ/chờ/thất lạc**: mọi cột tiền = 0, SL = 0.
- Nếu SKU không tìm thấy trong `shopeeSourceData` → Giá gốc = 0 (không lỗi).
- Lợi Nhuận âm → màu đỏ (`text-rose-600`); dương → xanh (`text-emerald-700`).
- Badge LÃI/LỖ: đơn huỷ/chờ/thất lạc → hiện trạng thái (xám); còn lại → **LÃI**/**LỖ** theo dấu tổng lợi nhuận cả đơn.
- Tổng (footer) tính lại theo đúng các quy tắc trên (không cộng phí của đơn không phát sinh).

### 10.2b Phân bổ chi phí QC theo ngày cho đơn hiệu quả (cập nhật 2026-07-09)

> Source: `components/revenue/useShopeeInventoryOut.ts` → `handleDistributeAdsCost()`
> (`isEffectiveOrder`, `ADS_TAX_RATE`; netProfit tính qua `calcShopeeNetProfit()`
> của `src/lib/shopeeProfit.ts` từ 2026-07-11)

User nhập tổng chi QC thực tế của 1 ngày (từ Shopee Ads Manager, nhập tay). Hệ
thống chia số tiền này **chỉ cho các đơn "hiệu quả"** trong ngày đó — đơn hiệu quả
= đơn có **`status ∈ {OK, SHIPPING}`** (đã giao hoặc đang giao). Đơn huỷ/hoàn/giao
thất bại/thất lạc/chờ xử lý **không** gánh phí QC.

```
đơn_hiệu_quả(ngày)   = { đơn trong ngày | status ∈ {OK, SHIPPING} }
adsCost(mỗi đơn hiệu quả) = tổng_QC_ngày / số_lượng(đơn_hiệu_quả)
adsCost(đơn không hiệu quả) = 0
adsTax(mỗi đơn) = adsCost × 8%     (ADS_TAX_RATE, user chốt 2026-07-10)
```

Nếu ngày không có đơn hiệu quả nào → không có cơ sở phân bổ, tất cả giữ `adsCost = 0`.

**Quyết định 2026-07-08**: trước đây chia đều tổng QC/ngày cho **mọi** đơn trong
ngày, khiến đơn không phát sinh doanh thu bị tính lỗ sai. User chốt: chỉ đơn hiệu
quả gánh **toàn bộ** phí QC của ngày.

**Đổi tiêu chí 2026-07-09**: trước dùng `shopeeAdsFee > 0` để nhận diện đơn hiệu
quả, nhưng field này đồng bộ trễ vài ngày (Shopee quyết toán chậm) → các ngày gần
nhất luôn ra 0. Chuyển sang dùng `status` (OK/SHIPPING) — có ngay khi đơn phát sinh.

Việc tự động lấy tổng chi QC/ngày trực tiếp từ Shopee Ads Manager (thay vì user
nhập tay) — xem §10.2c, đã triển khai 2026-07-09 cho 2 shop hiện có.

### 10.2c Tự động lấy + phân bổ tiền QC theo ngày/shop (thêm 2026-07-09)

> Source: `routes/adsSpendSync.ts` → `runAdsSpendSync()`, gọi mỗi 30 phút từ `server.ts`
> (biến `ADS_SPEND_SYNC_INTERVAL`). Bot lấy dữ liệu: `src/adsReport.js` (`getAdsSpendSnapshot`)
> trong repo `shopee-monitor` (**không nằm trong repo này**, xem `[[reference_bot_deploy_imac]]`).

Thay vì user nhập tay tổng chi QC/ngày (§10.2b), bot Shopee tự động lấy con số
này từ API ví quảng cáo Shopee (`pas/v1/wallet/get` → `ads_expense_today.total`,
chia 100000 ra VNĐ) cho **từng shop riêng** (trước đây input chỉ có 1 ô chung
cho cả 2 shop).

```
total_spend(ngày, shop) = ads_expense_today.total / 100000   (từ API Shopee Ads)
đơn_hiệu_quả(ngày, shop) = { đơn trong ngày | platform = shop AND status ∈ {OK, SHIPPING} }
adsCost(mỗi đơn hiệu quả) = total_spend(ngày, shop) / số_lượng(đơn_hiệu_quả)
```

Công thức phân bổ giống hệt §10.2b, chỉ thêm điều kiện lọc theo `platform`.
Chạy lặp lại mỗi 30 phút trong ngày nên tự "làm mới" (true-up) khi
`ads_expense_today` tăng dần hoặc có đơn hiệu quả mới phát sinh — không cộng dồn,
mỗi lần chạy tính lại từ đầu.

Lưu vào bảng `shopee_ads_daily_spend` (date, platform, total_spend,
effective_orders_count) — nguồn dữ liệu tham chiếu cho lịch sử chi QC/ngày/shop.

Mỗi lần chạy, job ghi lại **4 cột** cho từng đơn thay đổi: `ads_cost`, `ads_tax`,
`handling_fee`, và `net_profit` (tính qua `calcShopeeNetProfit()` của
`src/lib/shopeeProfit.ts` — công thức chuẩn dùng chung, từ 2026-07-11). Các đơn
thay đổi của cùng 1 ngày được gom **batch upsert 1 request** (trước 2026-07-11
update từng dòng — lỗi giữa chừng để ngày ở trạng thái nửa cập nhật). Điều kiện
bỏ qua (`unchanged`) so cả `net_profit` nên đơn cũ tự được true-up khi công thức
đổi, kể cả khi `ads_cost` vốn đã đúng.

**Giới hạn đã biết**:
- UI (`InventoryOutTab.tsx` → `calcNetProfit()`) vẫn tính lại `netProfit` client-side
  mỗi lần render, không đọc cột `net_profit` lưu sẵn — nên cột này chủ yếu phục vụ
  file export CSV và query báo cáo. Vì job đã ghi `net_profit` (khác mô tả cũ),
  cột này KHÔNG còn "lag" như trước.
- Backfill dữ liệu quá khứ (`backfill-ads-spend.js` trong repo bot) chỉ lấy được
  lô giao dịch mặc định Shopee trả về (chưa xác định được tham số phân trang của
  `transaction_history/get`), KHÔNG phải toàn bộ lịch sử vài tuần/tháng.

### 10.2d Lưu giao dịch gốc ví quảng cáo để phân tích sau (thêm 2026-07-09)

> Source: `getAdsSpendSnapshot()` (`src/adsReport.js` trong repo bot) → `runAdsSpendSync()` (`routes/adsSpendSync.ts`)

Mỗi lần đồng bộ (30 phút/lần), ngoài việc ghi `total_spend` vào
`shopee_ads_daily_spend` (§10.2c), hệ thống còn lưu **từng giao dịch gốc** của
Ví Quảng cáo (nạp/trừ tiền, kèm `transaction_type` — vd
`manual_product_deduction_roi_two_bidding`) vào bảng `shopee_ads_wallet_transactions`
(migration 033), dedup theo `(platform, transaction_id)`.

Mục đích: dữ liệu thô để phân tích sau này (tổng nạp/chi theo tuần/tháng, theo
loại hình quảng cáo...) — KHÔNG dùng cho việc tự động phân bổ `ads_cost` (đó là
việc của `shopee_ads_daily_spend`, §10.2c).

**Lợi ích phụ**: vì chạy đều 30 phút/lần và dedup theo transaction_id, bảng này
tự tích lũy thành lịch sử ngày càng đầy đủ theo thời gian — gần như giải quyết
được giới hạn phân trang ở trên, miễn phát sinh dưới ~10-20 giao dịch mỗi 30
phút. Không backfill ngược được giao dịch xảy ra TRƯỚC khi tính năng này chạy.

**Đã verify bằng dữ liệu thật (2026-07-08, staging)**: 10 giao dịch lưu đúng,
toàn bộ giao dịch `deduction` của Shopee 2 đều thuộc loại
`manual_product_deduction_roi_two_bidding` — xác nhận đây là ROI-2.0 auto-bidding,
khớp với phần `product_ads_auto_bidding` trong `ads_expense_today` (§10.2c).

### 10.3 Đơn nhiều sản phẩm khác nhau — chia phí theo tỷ trọng giá trị (thêm 2026-07-05)

> Source: `routes/inventoryOutSync.ts` → `mapOrderToRows()`

1 đơn Shopee có thể chứa nhiều sản phẩm khác nhau (`items[]` từ bot, lấy từ
`order_item_list.order_items` của Shopee). Mỗi sản phẩm → 1 dòng riêng trong
`shopee_inventory_out` (key `order_id + sku`). Shopee chỉ trả phí (hoa hồng/vận
chuyển/thuế/PiShip) ở **cấp đơn**, không tách theo từng sản phẩm → chia theo
**tỷ trọng giá trị** (subtotal = đơn giá × số lượng) của từng sản phẩm trong đơn:

```
subtotal(sp_i)     = price(sp_i) × quantity(sp_i)
tổng_subtotal      = Σ subtotal(sp_i) toàn đơn
tỷ_trọng(sp_i)     = subtotal(sp_i) / tổng_subtotal   (nếu tổng_subtotal = 0 → chia đều 1/số_sản_phẩm)

sale_price(sp_i)       = subtotal(sp_i)  (nếu có giá; fallback: tỷ_trọng × giá đơn cũ)
customer_paid(sp_i)    = tỷ_trọng × buyer_paid (cấp đơn)
platform_fee(sp_i)     = tỷ_trọng × commission_fee (cấp đơn)
freeship_extra(sp_i)   = tỷ_trọng × service_fee
payment_fee(sp_i)      = tỷ_trọng × transaction_fee
piship_fee(sp_i)       = tỷ_trọng × piship_fee
shopee_ads_fee(sp_i)   = tỷ_trọng × ams_commission_fee   ← thêm 2026-07-08
vat_tax(sp_i)          = tỷ_trọng × vat_tax (cấp đơn)
personal_income_tax(sp_i) = tỷ_trọng × pit_tax (cấp đơn)
```

Ví dụ: đơn 388.700đ có SP A (giá 250.000đ) + SP B (giá 138.700đ) → tỷ trọng
A ≈ 64%, B ≈ 36% → phí hoa hồng của đơn chia theo đúng tỷ lệ đó cho từng dòng.

Giá + phân loại (`price`/`variation`) từng sản phẩm lấy từ API Shopee
`get_order_income_components` → `order_item_list.order_items[].price/model_name`
(field `price` cùng scale ÷100000 như các field tiền khác trong bot).

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

### 11.5 Guard sửa đơn đã có phiếu trả liên kết (ORDERS-EDIT-02)

> Source: `services/posOrderService.ts` → `editPosOrder()` (check nhanh phía client)
> **+ `edit_pos_order_tx()` SQL** (`supabase_migrations/028_edit_pos_order_tx.sql`,
> nguồn sự thật — verify độc lập, không tin dữ liệu client gửi lên), dùng chung
> `getReturnedQuantitiesForOrder()` ở 11.4

`editPosOrder()` tính lại tồn kho theo delta (SL CŨ vs SL MỚI của đơn đang sửa),
độc lập với phiếu trả đã xử lý trước đó. Sửa SL xuống THẤP HƠN số đã trả sẽ làm
tồn kho bị cộng trùng phần phiếu trả đã cộng lại rồi:
```
Chặn khi: SL mới (mỗi SP) < SL đã trả của SP đó (tính theo 11.4)
Cho phép: SL mới ≥ SL đã trả — vẫn đúng vì 2 phép tính (sửa đơn + phiếu trả) độc lập
          nhưng không chồng lấn phần đã trả
```
Vi phạm → throw lỗi chặn lưu, không đụng tới tồn kho/doanh thu (guard chạy trước
mọi bước ghi dữ liệu — cả ở JS lẫn RPC SQL đều chặn độc lập).

### 11.6 Sửa đơn (`editPosOrder`) — RPC `edit_pos_order_tx` [TXN-RPC-01]

> Source: `services/posOrderService.ts` → `editPosOrder()` +
> `supabase_migrations/028_edit_pos_order_tx.sql`

Toàn bộ hoàn/áp tồn kho + xóa/ghi nợ + ghi đè đơn + đảo doanh thu chạy trong 1
transaction DB (RPC), thay vì chuỗi nhiều lời gọi mạng cũ:
```
Tồn kho mới (mỗi SP) = Tồn hiện tại + SL đơn CŨ (hoàn lại) − SL đơn MỚI (trừ lại)
Delta doanh thu ròng = −buildRevenueDelta(đơn CŨ, cogsCũ) + buildRevenueDelta(đơn MỚI, cogsMới)
                        (gộp 1 delta duy nhất — ngày bán giữ nguyên, không tính 2 lần)
```
`inventory_transactions` của đơn CŨ bị **xóa hẳn** (không đánh dấu cancelled) và
ghi transaction Sale MỚI theo items đã sửa — khác cơ chế "cancelled" của xóa/hủy
trả vì sửa đơn là ghi đè, không phải hoàn tác.

**Ngoài phạm vi RPC** (vẫn 2 lời gọi mạng thật riêng qua `updateSurgical` sau khi
RPC xong): cập nhật điểm/hạng khách hàng (`computeNewTier()` đọc cấu hình
localStorage, server không truy cập được) và tính lại `sales_records` ngày đó.

### 11.7 Tạo đơn (`processPlaceOrder`) — RPC `place_pos_order_tx` [TXN-RPC-01 — hoàn tất]

> Source: `services/posOrderService.ts` → `processPlaceOrder()` +
> `supabase_migrations/029_place_pos_order_tx.sql`

Insert order + ghi inventory transaction & trừ tồn kho + ghi nợ (nếu bán nợ) +
cộng dồn doanh thu chạy trong 1 transaction DB (RPC), thay chuỗi nhiều lời gọi
mạng + cơ chế rollback thủ công từng bước cũ:
```
Tồn kho mới (mỗi SP) = Tồn hiện tại − SL đơn (gộp theo SP nếu 1 SP xuất hiện nhiều dòng)
COGS = Σ (importPrice mỗi item × SL) — importPrice ưu tiên client gửi, fallback
       import_price hiện tại của SP trong DB nếu client không gửi
```
Không trùng với RPC `pos_mobile_checkout` (mục 019, dành riêng POS mobile — staff
cố định, tier tính cứng trong SQL) — `place_pos_order_tx` giữ nguyên order đã
dựng sẵn từ client (giá/PTTT/giảm giá đã tính ở POSComputer, không tính lại).

**Ngoài phạm vi RPC** (vẫn 2 lời gọi mạng thật riêng qua `updateSurgical` sau khi
RPC xong): cập nhật điểm/hạng khách hàng và tính lại `sales_records` ngày đó —
cùng ranh giới với `edit_pos_order_tx`.

Với luồng này, **TXN-RPC-01 hoàn tất toàn bộ 4 luồng** (xóa đơn, hủy phiếu trả,
sửa đơn, tạo đơn) — không còn luồng POS nào dùng chuỗi nhiều lời gọi mạng +
rollback thủ công phía client.
