# OP-012 — Chốt lương

## Mục tiêu
Lưu chính thức bảng lương tháng cho từng nhân viên, đồng thời ghi chi phí lương vào sổ chi và tạo hồ sơ hiệu năng. Có thể chốt từng người hoặc chốt hàng loạt.

## Kích hoạt
Kế toán bấm nút "Chốt lương" cho từng nhân viên trong `PayrollManager.tsx`.

## Điều kiện tiên quyết
- Tháng lương phải có đủ dữ liệu chấm công (`attendance_records`)
- `netPay` phải là số hợp lệ (không phải NaN) — nếu sai sẽ báo lỗi và dừng
- Nếu nhân viên đã có bản ghi chốt tháng đó → hỏi xác nhận trước khi ghi đè

## Xử lý (hàm `handleFinalizeIndividual`)

```
1. Tính salaryCost = getPayrollSalaryCost(payroll)
   (lương thực tế phía công ty chi, khác netPay của nhân viên nhận)

2. Tính roi = totalSales / salaryCost

3. Ghi 4 bảng cùng lúc (1 lần gọi onUpdateSurgical):

   a. payroll_records    — upsert bản ghi lương tháng (PayrollRecord)
   b. expense_records    — upsert chi phí:
        category    = 'Lương & Thưởng'
        amount      = salaryCost
        description = 'Chi lương tháng MM/YYYY - [Tên nhân viên]'
        date        = ngày cuối tháng (vd: 2026-06-30)
   c. staff_performance  — upsert hồ sơ hiệu năng:
        totalSales, totalIncome (= salaryCost), roi, rank
   d. employees          — update carryForwardDebt = payroll.carryForwardDebtOut
        (nợ chuyển sang tháng sau nếu lương âm sau khi trừ tạm ứng)
```

**Quan trọng:** KHÔNG có trường `status='official'`. Chốt lương = ghi bản ghi vào `payroll_records`. Chưa chốt = bản ghi chưa tồn tại.

## Trường hợp đặc biệt

| Tình huống | Xử lý |
|-----------|-------|
| Chốt từng phần | Cho phép chốt từng nhân viên riêng lẻ trong tháng |
| Ghi đè bản đã chốt | Hỏi xác nhận, sau đó upsert (dùng id cũ nếu có) |
| Quyết toán nghỉ việc | Gọi `handleSettlementAndResignation` — tương tự nhưng expenseDate = ngày hôm nay, description = 'Quyết toán lương nghỉ việc' + đóng hồ sơ nhân sự |
| Hoàn tác chốt lương | Xóa `payroll_records` + xóa `expense_records` tương ứng (kể cả 'Quyết toán lương nghỉ việc') |

## Dữ liệu đầu ra

- `payroll_records` — 1 bản ghi lương tháng
- `expense_records` — 1 bản ghi chi phí lương
- `staff_performance` — 1 bản ghi hiệu năng tháng
- `employees.carryForwardDebt` — cập nhật nợ chuyển kỳ

## Bảng bị ảnh hưởng
`payroll_records`, `expense_records`, `staff_performance`, `employees`

## Code liên quan
- `components/PayrollManager.tsx` — hàm `handleFinalizeIndividual`, `handleSettlementAndResignation`
- `hooks/usePayrollState.ts` — tính toán draft payroll, xếp hạng nhân viên
- `src/lib/businessLogic.payroll.ts` — `calculateEmployeePayroll()`

## Mức độ tin cậy: CAO
(Đã đọc đầy đủ source `PayrollManager.tsx`. Doc cũ mô tả sai — không có trường status='official'. Thực tế là upsert 4 bảng cùng lúc.)
