# OP-010 — Thanh toán công nợ nhà cung cấp

## Mục tiêu
Ghi nhận khoản thanh toán cho nhà cung cấp, giảm số dư công nợ theo mô hình giao dịch.

## Kích hoạt
Nhân viên vào trang Chi tiết Nhà cung cấp → nhập khoản thanh toán.

## Dữ liệu đầu vào
```typescript
{
  supplierId: UUID,
  supplierName: string,
  paymentAmount: number,
  date: string,
  description?: string
}
```

## Kiểm tra hợp lệ
- `paymentAmount > 0`
- `supplierId` tồn tại trong `suppliers`

## Xử lý
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

**Lưu ý:** Số dư công nợ KHÔNG được lưu trực tiếp — tính tại thời điểm hiển thị:
```
currentDebt = Σ(amount WHERE type='purchase') - Σ(amount WHERE type='payment')
```

## Dữ liệu đầu ra
- `supplier_debts` (1 bản ghi mới, type='payment')

## Bảng bị ảnh hưởng
`supplier_debts`

## Thay đổi trạng thái
- Không thay đổi ảnh chụp — chỉ thêm bản ghi 'payment'
- Số dư hiển thị tự giảm khi giao diện tính lại

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Thanh toán vượt quá công nợ | Cho phép — currentDebt có thể âm (nhà cung cấp nợ lại) |
| Thanh toán từ trả hàng nhập | Không dùng luồng này — dùng OP-004 handleCompleteReturn |

## Quy tắc liên quan
- Mô hình giao dịch (không lưu ảnh chụp)

## Code liên quan
- `components/suppliers/SupplierContainer.tsx`
- `components/suppliers/SupplierDetailView.tsx`

## Mức độ tin cậy: CAO
