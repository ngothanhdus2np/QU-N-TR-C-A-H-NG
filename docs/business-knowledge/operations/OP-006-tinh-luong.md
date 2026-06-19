# OP-006 — Tính lương nhân viên

## Mục tiêu
Tính toán lương tháng cho nhân viên dựa trên thâm niên, chính sách lương, chấm công, doanh số, hoa hồng, khấu trừ.

## Kích hoạt
- Nhân viên kế toán bấm "Tính lương" trong `PayrollManager.tsx`
- Hoặc: "Tính lại toàn bộ lịch sử lương"

## Dữ liệu đầu vào
```typescript
{
  employees: Employee[]
  salaryPolicies: SalaryPolicy[]  // nhiều chính sách, áp dụng theo thâm niên
  attendanceRecords: AttendanceRecord[]
  overtimeRecords: OvertimeRecord[]
  salesRecords: SalesRecord[]
  shortageRecords: ShortageRecord[]
  advanceRecords: AdvanceRecord[]
  targetMonth: string  // 'YYYY-MM'
}
```

## Xử lý

### Bước 1 — Xác định chính sách áp dụng

```typescript
// businessLogic.payroll.ts:determineCurrentPolicy()

calculateSeniority(employee, payrollMonthDate):
  // Tính đến ngày 15 của tháng lương
  // Đơn vị: số ngày
  seniorityDays = daysBetween(employee.startDate, day15OfPayrollMonth)

// Duyệt từ trên xuống: sắp xếp từ chính sách thâm niên cao nhất xuống thấp nhất
// Chọn chính sách đầu tiên có seniorityRange.from <= seniorityDays
selectedPolicy = policies.sort(giảm dần theo seniorityRange.from)
  .find(p => p.seniorityRange.from <= seniorityDays)
```

### Bước 2 — Tính thu nhập cơ bản

**Lương theo giờ:**
```
dailySalary = baseSalary / 11
workedDays = số ngày công trong tháng
grossPay = dailySalary × workedHours
```

**Lương theo ngày:**
```
dailySalary = baseSalary / daysInMonth
grossPay = dailySalary × workingDays
```

**Lương theo tháng:**
```
grossPay = baseSalary × (workingDays / standardDays)
```

### Bước 3 — Tính các khoản cộng thêm

```
overtimePay = Σ(ot.hours × overtimeRate)
commissionPay = Σ(salesRecord.salesAmount) × (commissionRate / 100)
bonus = bonusAmount (từ chính sách lương)
```

### Bước 4 — Các khoản khấu trừ

```
advanceDeduction = Σ(advance.amount WHERE month=targetMonth)
shortageDeduction = Σ(shortage.amount WHERE month=targetMonth)
fineDeduction = fineAmount (từ bản ghi chấm công)

carryForwardDebt = employee.carry_forward_debt
carryForwardDeduction = min(carryForwardDebt, available)
carryForwardDebtOut = carryForwardDebt - carryForwardDeduction
```

### Bước 5 — Tổng hợp

```
netPay = grossPay + overtimePay + commissionPay + bonus
       - advanceDeduction - shortageDeduction - fineDeduction
       - carryForwardDeduction

IF netPay < 0:
  carryForwardDebtOut += |netPay|  // cộng thêm vào nợ chuyển kỳ sau
  netPay = 0
```

### Bước 6 — Ghi kết quả

```
INSERT payroll_records {
  employee_id, month: targetMonth,
  policy_id: selectedPolicy.id,
  gross_pay, net_pay,
  overtime_pay, commission_pay, bonus,
  advance_deduction, shortage_deduction, fine_deduction,
  carry_forward_deduction, carry_forward_debt_out,
  status: 'unofficial'  // mặc định
}

INSERT expense_records {
  category: 'Lương' (hoặc tương đương),
  amount: netPay,
  date: cuối tháng,
  description: 'Lương tháng ' + targetMonth + ' - ' + employee.name
}

UPDATE employees SET carry_forward_debt = carryForwardDebtOut
```

## Dữ liệu đầu ra
- `payroll_records` (1 bản ghi mỗi nhân viên mỗi tháng)
- `expense_records` (1 bản ghi mỗi nhân viên — danh mục lương)
- `employees.carry_forward_debt` cập nhật

## Bảng bị ảnh hưởng
`payroll_records`, `expense_records`, `employees`

## Thay đổi trạng thái
- `payroll_records.status`: 'unofficial' → 'official' (khi chốt lương)
- `employees.carry_forward_debt` = carryForwardDebtOut

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Lương âm | netPay = 0, phần âm → carryForwardDebtOut |
| Không có chính sách phù hợp | Dùng chính sách mặc định (thâm niên thấp nhất) |
| Nhân viên mới (chưa đủ kỳ) | Tính theo số ngày thực tế làm việc |
| Nghỉ thai sản | CẦN XÁC MINH THÊM |
| Nhân viên nghỉ việc giữa tháng | Tính đến ngày nghỉ |
| Lương tính hai lần | Tránh: nếu module lương có dữ liệu, lọc lương khỏi expense_records |

## Lưu ý đặc biệt
- Chỉ tính thâm niên đến **ngày 15** của tháng lương, không phải cuối tháng (RULE-PAY-002)
- Bản ghi lương mặc định là 'unofficial' — phải chốt thủ công để thành 'official'
- Module lương không tự động kích hoạt mà chạy khi người dùng bấm nút

## Quy tắc liên quan
- RULE-PAY-001 (Duyệt chính sách từ trên xuống)
- RULE-PAY-002 (Tính thâm niên đến ngày 15)
- RULE-PAY-003 (Lương theo giờ/ngày/tháng)
- RULE-PAY-008 (Nợ chuyển kỳ)
- EC-PAY-001 (Lương âm)
- EC-PAY-002 (Tính đôi lương)

## Code liên quan
- `src/lib/businessLogic.payroll.ts:calculateEmployeePayroll()`
- `src/lib/businessLogic.payroll.ts:determineCurrentPolicy()`
- `src/lib/businessLogic.payroll.ts:calculateSeniority()`
- `components/PayrollManager.tsx`
- `hooks/usePayrollState.ts`

## Mức độ tin cậy: CAO
