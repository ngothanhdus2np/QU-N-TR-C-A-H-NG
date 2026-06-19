# BUSINESS_RULES — Quy tắc nghiệp vụ CFO Brain 4.0

> Source: src/lib/businessLogic.payroll.ts, src/lib/businessLogic.inventory.ts,
>         src/lib/reportCalculations.ts, services/posOrderService.ts, types.ts

---

## NHÓM 1: LƯƠNG & NHÂN SỰ

### RULE-PAY-001 — Xác định chính sách lương theo thâm niên

**Mô tả:** Nếu nhân viên không có `assignedPolicyId`, hệ thống tự chọn policy theo số ngày thâm niên.

**Nguồn code:** `src/lib/businessLogic.payroll.ts:72` — `determineCurrentPolicy()`

**Logic:**
1. Nếu `employee.assignedPolicyId` có giá trị → dùng policy đó trực tiếp
2. Nếu không → sort policies theo `startThreshold` giảm dần (Top-Down)
3. Lấy policy đầu tiên thỏa `seniority >= startThreshold` VÀ (`endThreshold === 0` HOẶC `seniority < endThreshold`)
4. `endThreshold = 0` có nghĩa là vô cực (không giới hạn trên)
5. Nhân viên chức vụ "Nhân viên" → loại bỏ policy có tên chứa từ "quản lý"

---

### RULE-PAY-002 — Tính thâm niên

**Mô tả:** Thâm niên tính đến ngày 15 của tháng tính lương.

**Nguồn code:** `src/lib/businessLogic.payroll.ts:52` — `calculateSeniority()`

**Công thức:**
```
targetDate = ngày 15 của tháng tính lương
seniority = (targetDate - joinDate) / 86400000 + 1  [ngày, inclusive]
isOfficial = seniority >= 30 ngày
```

---

### RULE-PAY-003 — Lương cơ bản theo loại chính sách

**Nguồn code:** `src/lib/businessLogic.payroll.ts:147-176`

**Daily policy:**
```
basicSalary = (baseSalary / 11) × totalHoursWorked
(11h = số giờ tiêu chuẩn 1 ca làm việc)
```

**Monthly policy (pro-rated):**
```
workingDays = số ngày Present trong tháng + số ngày Holiday
basicSalary = (baseSalary / daysInMonth) × workingDays
(Ngày lễ vẫn tính là ngày công, không trừ lương)
```

---

### RULE-PAY-004 — Cắt phụ cấp chuyên cần

**Mô tả:** Mất phụ cấp chuyên cần nếu nghỉ có phép quá mức hoặc có nghỉ không phép.

**Nguồn code:** `src/lib/businessLogic.payroll.ts` — `shouldCutAttendanceAllowanceByLeave()`

**Điều kiện mất phụ cấp:**
- Nghỉ có phép (AuthorizedLeave / CP) > 1 ngày **HOẶC**
- Nghỉ không phép (UnauthorizedLeave / KP) > 0 ngày

---

### RULE-PAY-005 — Hoa hồng doanh số

**Nguồn code:** `src/lib/businessLogic.payroll.ts:354`

**Công thức:**
```
commissionPay = Σ(salesAmount) × (commissionRate / 100)
```

Nếu toàn bộ nhân viên đều ghi nhận doanh số → tính theo tỷ lệ cá nhân / tổng cửa hàng (line 501-505).

---

### RULE-PAY-006 — Phạt vi phạm

**Nguồn code:** `src/lib/businessLogic.payroll.ts` — parse violationOccurrences

**Logic:**
- Mỗi lần vi phạm có 3 mức phạt (fine1, fine2, fine3)
- Phạt tiền → `disciplinaryDeduction`
- Phạt mất phụ cấp → `lostAttendance`, `lostCleaning`, `lostCSKH`, v.v.

**Parse chuỗi phạt:**
- "50k" → 50.000đ
- Số cuối trong string < 1000 → × 1000 (đơn vị nghìn đồng)

---

### RULE-PAY-007 — Nợ lương carry-forward

**Mô tả:** Khi lương net_pay âm (nhân viên nợ), phần âm chuyển sang kỳ sau.

**Nguồn code:** `src/lib/businessLogic.payroll.ts` — `carryForwardDebt`

**Logic:**
```
Kỳ trước: carryForwardDebt = X (lưu trong employees.carry_forward_debt)
Kỳ này:   carryForwardDeduction = min(X, max_khấu_trừ_trong_kỳ)
          carryForwardDebtOut = X - carryForwardDeduction (nợ còn lại)
          → cập nhật employees.carry_forward_debt = carryForwardDebtOut
```

---

### RULE-PAY-008 — Thưởng ngày lễ

**Mô tả:** Chỉ tính thưởng ngày lễ khi nhân viên thực sự đi làm đúng ngày đó.

**Logic:** Lookup attendance_records ngày lễ → status='Present' → mới tính `holidayBonus`

---

## NHÓM 2: HÀNG HÓA & TỒN KHO

### RULE-INV-001 — Tính giá vốn (COGS)

**Nguồn code:** `src/lib/businessLogic.inventory.ts` — `calculateNextImportPrice()`, `calcEffectiveUnitPrice()`

**Method `fixed`:**
```
importPrice = giá nhập của lô mới (không thay đổi giá vốn cũ)
Dùng cho: đồ da đặt hàng theo giá cố định
```

**Method `average` (AVCO — trung bình có trọng số):**
```
nextImportPrice = (currentStock × currentImportPrice + qty × newUnitPrice) / (currentStock + qty)
Làm tròn: 2 chữ số thập phân
Edge case: currentStock <= 0 → nextImportPrice = newUnitPrice (không pha loãng)
```

**Phân bổ giảm giá toàn đơn:**
```
effectiveUnitPrice = lineSubtotal / qty
lineSubtotal = originalPrice × qty - (billDiscount × proportionalShare)
```

---

### RULE-INV-002 — COGS theo lịch sử (Báo cáo lợi nhuận)

**Nguồn code:** `src/lib/reportCalculations.ts` — `buildCostHistory()`, `getHistoricalCost()`

**Mô tả:** Báo cáo lợi nhuận dùng giá vốn tại **thời điểm bán**, không phải giá vốn hiện tại.

**Logic:**
```
buildCostHistory(inventoryTransactions):
  → Index all Import transactions by (sku, date)
  → Lưu nextImportPrice theo effective_date

getHistoricalCost(sku, saleDate):
  → Tìm nextImportPrice gần nhất trước saleDate
  → Fallback: currentImportPrice từ pos_products
```

---

### RULE-INV-003 — Tồn kho âm

**Nguồn code:** RPC `decrement_product_stock`, `posOrderService.ts`

**Mặc định:** Không cho phép tồn kho âm (RPC check `stock >= qty`)

**Override:**
- `posInventorySettings.allowSellOutOfStock = true` → cho phép bán âm
- `allowNegativeStock = true` trên InventoryTransaction → ghi nhận xuất kho âm

**Tồn kho sản phẩm cha:**
```
totalVariantStock = Σ(stock của tất cả variants con)
(Tồn kho cha = 0 trong DB, chỉ dùng để hiển thị)
```

---

### RULE-INV-004 — Kiểm kho (Stock Check)

**Nguồn code:** `components/pos/useGoodsAudit.ts`

**Logic:**
- Sản phẩm cha (`isParent=true`) → bỏ qua, không ghi đè stock
- Sản phẩm con → SET stock = actualCount (ghi đè trực tiếp)
- Ghi InventoryTransaction (type='Check', status='balanced')
- Lưu `totalDiff`, `increaseCount`, `decreaseCount`

---

### RULE-INV-005 — Phát hiện đơn trả hàng

**Nguồn code:** `services/dataMapper.ts:29`

**Nhận diện là đơn trả hàng khi:**
- `is_return = true` HOẶC
- `order_code` bắt đầu bằng "TH" HOẶC
- `final_amount < 0`

---

## NHÓM 3: BÁN HÀNG POS

### RULE-POS-001 — Tích điểm khách hàng

**Nguồn code:** `services/posOrderService.ts`, `types.ts:591` (POSPaymentSettings)

**Công thức:**
```
pointsEarned = floor(finalAmount / pointsRate)
Mặc định: pointsRate = 10.000đ/điểm
Điều kiện: sản phẩm có allow_points = true
```

---

### RULE-POS-002 — Phân loại tier khách hàng

**Nguồn code:** `types.ts:748`, `services/dataMapper.ts:602`

**Giá trị tier:** `'Standard' | 'Silver' | 'Gold' | 'Diamond'`

**NEEDS_VERIFICATION:** Ngưỡng `totalSpent` cho từng tier không tìm thấy trong code. Tier được lưu trực tiếp trong `pos_customers.tier` — có thể được set thủ công bởi admin.

---

### RULE-POS-003 — Phương thức thanh toán

**Nguồn code:** `types.ts`, `components/pos/POSCheckout.tsx`

**Các phương thức hỗ trợ:** `'Cash' | 'Bank' | 'Momo' | 'Card' | 'Other'`

**Split payment:** `splitPayments = [{ method, amount }]` — nhiều phương thức trong 1 đơn

**Default method:** Đọc từ `posPaymentSettings.defaultMethod` (không hardcode)

---

### RULE-POS-004 — Trả hàng POS

**Nguồn code:** `services/posOrderService.ts:processReturnOrder()`

**Logic:**
```
1. Tra cứu đơn gốc (có thể không cần)
2. Tạo POSOrder mới (isReturn=true)
3. Cộng lại stock sản phẩm trả
4. Nếu có sản phẩm đổi → trừ stock sản phẩm đổi
5. Lưu refundAmount (số tiền hoàn khách)
6. Lưu returnFee (phí trả hàng) → cộng vào revenue_records.revenue_other
7. Cập nhật pos_customers.total_spent (trừ amountToPayCustomer)
```

---

### RULE-POS-005 — Ghi nợ khách hàng

**Nguồn code:** `components/pos/POSComputer.tsx`

**Khi bán ghi nợ:**
- Tạo `customer_debt_history` (type='debt', amount=debtAmount)
- Cộng `pos_customers.debt_amount`

**Khi trả hàng với đơn gốc ghi nợ:**
- KHÔNG tự động giảm `debtAmount` (phải thanh toán thủ công)

---

## NHÓM 4: TÀI CHÍNH & BÁO CÁO

### RULE-FIN-001 — Điểm hòa vốn hàng ngày

**Nguồn code:** `hooks/useAppData.ts:399` — `calculateDailyBreakEven()`

**Công thức:**
```
dailyFixedCost = (monthlyPayroll + monthlyExpenses) / daysInMonth
avgGrossMargin = trung bình tỷ lệ lợi nhuận gộp 30 ngày gần nhất
dailyBreakEvenRevenue = dailyFixedCost / avgGrossMargin
```

---

### RULE-FIN-002 — Không double-count chi phí lương

**Nguồn code:** `src/lib/businessLogic.revenue.ts:calculateExecutiveInsights()`, `src/lib/reportCalculations.ts`

**Logic:**
```
Nếu projectedPayroll > 0 (dùng payroll module):
  nonSalaryExpenses = expenses.filter(e => !e.category.includes('Lương'))
  totalExpenses = nonSalaryExpenses + projectedPayroll
(tránh tính lương 2 lần khi có cả payroll record và expense record lương)
```

---

### RULE-FIN-003 — Trị tuyệt đối doanh thu đơn trả hàng

**Nguồn code:** `src/lib/reportCalculations.ts:getSalesProfitRowsByDate()`

**Logic:** `Math.abs(order.finalAmount)` khi order.isReturn=true — tránh cộng âm làm tăng doanh thu ảo.

---

### RULE-FIN-004 — Danh mục chi phí tự động

**Nguồn code:** `hooks/useAppData.ts:1051`

**Mapping tự động:**
```
"Lương..." → parentId = 'cat-variable' (chi phí biến đổi)
"Lãi vay..." → parentId = 'cat-interest-root'
"Khấu hao..." → parentId = 'cat-depreciation-root'
```

---

## NHÓM 5: SHOPEE

### RULE-SHOP-001 — Bot mapping shop

**Nguồn code:** `routes/inventoryOutSync.ts`, history 2026-06-18

**Mapping:**
```
Bot port 3001 → giaydepphucsang → platform = 'Shopee 1'
Bot port 3002 → phuc_sang_store → platform = 'Shopee 2'
```

**Lưu ý quan trọng:** Profile trình duyệt của 2 bot từng bị swap. Đã fix 2026-06-18.

---

### RULE-SHOP-002 — Filter đơn vận đơn (cửa sổ hoàn hàng)

**Nguồn code:** `components/orders/ShippingOrders.tsx`

**Logic:** Ẩn các đơn status="Đã nhận được hàng" đã qua 15 ngày kể từ `first_delivered_at`.

---

### RULE-SHOP-003 — Dedup đơn Shopee

**Nguồn code:** `shopee_inventory_out` UNIQUE CONSTRAINT: (order_id, sku)

**Logic sync:** INSERT mới nếu (order_id, sku) chưa có → UPDATE status/fees nếu đã tồn tại.

---

## NHÓM 6: WEBSITE STORE

### RULE-WEB-001 — Tạo đơn website (atomic)

**Nguồn code:** `supabase_setup.sql` — RPC `create_store_order()`

**Logic:**
```
BEGIN;
  FOR EACH item:
    SELECT stock FROM pos_products WHERE id = pos_product_id FOR UPDATE;
    IF stock < qty THEN RAISE EXCEPTION;
    UPDATE pos_products SET stock = stock - qty;
  INSERT INTO pos_orders (channel='website', status='pending');
  INSERT INTO store_order_addresses;
COMMIT;
```

---

### RULE-WEB-002 — Hoàn tồn kho khi huỷ/hoàn hàng website

**Nguồn code:** RPC `update_website_order_status()`, `components/website/WebsiteOrdersPage.tsx`

**Logic:**
```
cancelled (trước giao ĐVVC):
  → cộng tồn kho ngay lập tức

return_requested (đang hoàn hàng):
  → KHÔNG cộng tồn kho (chờ hàng về kho thật)

returned (nhân viên xác nhận đã nhận hàng):
  → cộng tồn kho
```
