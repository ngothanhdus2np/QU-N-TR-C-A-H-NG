# OP-010 — Thanh toán công nợ nhà cung cấp

## Mục tiêu
Ghi nhận khoản thanh toán cho NCC, giảm số dư công nợ NCC theo mô hình transaction.

## Trigger
Nhân viên vào trang Chi tiết Nhà cung cấp → nhập khoản thanh toán.

## Input
```typescript
{
  supplierId: UUID,
  supplierName: string,
  paymentAmount: number,
  date: string,
  description?: string
}
```

## Validation
- `paymentAmount > 0`
- `supplierId` tồn tại trong `suppliers`

## Processing
```
INSERT supplier_debts {
  supplier_id: supplierId,
  supplier_name: supplierName,
  type: 'payment',
  amount: paymentAmount,
  date: today,
  description: ghi chú
}
```

**Lưu ý:** Số dư công nợ KHÔNG được lưu trực tiếp — tính runtime:
```
currentDebt = Σ(amount WHERE type='purchase') - Σ(amount WHERE type='payment')
```

## Output
- `supplier_debts` (1 record mới, type='payment')

## Tables affected
`supplier_debts`

## State changes
- Không thay đổi snapshot — chỉ thêm record 'payment'
- Số dư hiển thị tự giảm khi UI tính lại

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Thanh toán vượt quá công nợ | Cho phép — currentDebt có thể âm (NCC nợ lại) |
| Thanh toán từ trả hàng nhập | Không dùng route này — dùng OP-004 handleCompleteReturn |

## Related rules
- Mô hình transaction model (không snapshot)

## Related code
- `components/suppliers/SupplierContainer.tsx`
- `components/suppliers/SupplierDetailView.tsx`

## Confidence level: HIGH
