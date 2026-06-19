# OP-012 — Chốt lương (Official)

## Mục tiêu
Chuyển trạng thái `payroll_records` từ 'unofficial' → 'official', xác nhận lương chính thức cho kỳ lương.

## Trigger
Kế toán bấm nút "Chốt lương" trong `PayrollManager.tsx`.

## Processing
```
UPDATE payroll_records SET
  status = 'official',
  confirmed_at = now(),
  confirmed_by = currentUserId
WHERE month = targetMonth AND employee_id IN (selectedIds)
```

## Output
- `payroll_records.status` = 'official'

## Tables affected
`payroll_records`

## State changes
```
'unofficial' → 'official'
```

Sau khi chốt, không nên sửa lại (cần ghi audit nếu có thay đổi).

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Undo chốt lương | Bulk undo bao gồm cả expense "Quyết toán lương nghỉ việc" (BUG-PY2-1 đã fix) |
| Chốt 1 phần | Cho phép chốt từng nhân viên riêng lẻ |

## Related code
- `components/PayrollManager.tsx`
- `hooks/usePayrollState.ts`

## Confidence level: MEDIUM
