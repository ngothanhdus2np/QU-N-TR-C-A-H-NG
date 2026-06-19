# OP-009 — Thanh toán công nợ khách hàng

## Mục tiêu
Ghi nhận khoản khách trả nợ, giảm số dư công nợ trên hệ thống.

## Trigger
Nhân viên vào trang Chi tiết Khách hàng → nhập khoản thanh toán nợ.

## Input
```typescript
{
  customerId: UUID,
  repayAmount: number,
  date: string,
  note?: string
}
```

## Validation
- `repayAmount > 0`
- `customerId` tồn tại trong `pos_customers`

## Processing
```
INSERT customer_debt_history {
  customer_id: customerId,
  type: 'repay',
  amount: repayAmount,
  date: today,
  note: ghi chú
}

UPDATE pos_customers SET
  debt_amount -= repayAmount
  // Không giới hạn — có thể về 0 hoặc âm (trả dư)
```

## Output
- `customer_debt_history` (1 record mới, type='repay')
- `pos_customers.debt_amount` giảm

## Tables affected
`customer_debt_history`, `pos_customers`

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| repayAmount > debt_amount | Cho phép — debt_amount có thể âm |
| Trả hàng từ đơn ghi nợ | Phải thêm thủ công — HỆ THỐNG KHÔNG TỰ ĐỘNG |

## Related rules
- EC-ORDER-001 (Trả hàng không giảm công nợ tự động)

## Related code
- `components/customers/CustomerDetailPage.tsx`

## Confidence level: HIGH
