# OP-009 — Thanh toán công nợ khách hàng

## Mục tiêu
Ghi nhận khoản khách trả nợ, giảm số dư công nợ trên hệ thống.

## Kích hoạt
Nhân viên vào trang Chi tiết Khách hàng → nhập khoản thanh toán nợ.

## Dữ liệu đầu vào
```typescript
{
  customerId: UUID,
  repayAmount: number,
  date: string,
  note?: string
}
```

## Kiểm tra hợp lệ
- `repayAmount > 0`
- `customerId` tồn tại trong `pos_customers`

## Xử lý
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

## Dữ liệu đầu ra
- `customer_debt_history` (1 bản ghi mới, type='repay')
- `pos_customers.debt_amount` giảm

## Bảng bị ảnh hưởng
`customer_debt_history`, `pos_customers`

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| repayAmount > debt_amount | Cho phép — debt_amount có thể âm |
| Trả hàng từ đơn ghi nợ | Phải thêm thủ công — HỆ THỐNG KHÔNG TỰ ĐỘNG |

## Quy tắc liên quan
- EC-ORDER-001 (Trả hàng không giảm công nợ tự động)

## Code liên quan
- `components/customers/CustomerDetailPage.tsx`

## Mức độ tin cậy: CAO
