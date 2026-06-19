# OP-012 — Chốt lương (Official)

## Mục tiêu
Chuyển trạng thái `payroll_records` từ 'unofficial' → 'official', xác nhận lương chính thức cho kỳ lương.

## Kích hoạt
Kế toán bấm nút "Chốt lương" trong `PayrollManager.tsx`.

## Xử lý
```
UPDATE payroll_records SET
  status = 'official',
  confirmed_at = now(),
  confirmed_by = currentUserId
WHERE month = targetMonth AND employee_id IN (selectedIds)
```

## Dữ liệu đầu ra
- `payroll_records.status` = 'official'

## Bảng bị ảnh hưởng
`payroll_records`

## Thay đổi trạng thái
```
'unofficial' → 'official'
```

Sau khi chốt, không nên sửa lại (cần ghi nhật ký kiểm toán nếu có thay đổi).

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Hoàn tác chốt lương | Hoàn tác hàng loạt bao gồm cả khoản chi "Quyết toán lương nghỉ việc" (BUG-PY2-1 đã sửa) |
| Chốt từng phần | Cho phép chốt từng nhân viên riêng lẻ |

## Code liên quan
- `components/PayrollManager.tsx`
- `hooks/usePayrollState.ts`

## Mức độ tin cậy: TRUNG BÌNH
