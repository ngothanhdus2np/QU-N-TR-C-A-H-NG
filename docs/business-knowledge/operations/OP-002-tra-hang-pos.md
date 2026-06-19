# OP-002 — Trả hàng / Đổi hàng POS

## Mục tiêu
Ghi nhận giao dịch trả hàng hoặc đổi hàng tại quầy, cập nhật tồn kho, tính hoàn tiền/thu thêm.

## Trigger
Nhân viên mở màn hình trả hàng, chọn sản phẩm cần trả/đổi, bấm "Xác nhận".

## Input
```typescript
{
  returnCart: [{
    product: POSProduct,
    quantity: number,
    lineType: 'return' | 'exchange'  // trả hoặc đổi mới
  }]
  originalOrder?: POSOrder  // đơn gốc (không bắt buộc — fast return)
  returnFee: number         // phí trả hàng (thu từ khách)
  returnOtherRefund: number // hoàn thêm cho khách
}
```

## Validation
- `quantity > 0`
- Sản phẩm phải tồn tại trong `pos_products`
- Không bắt buộc có đơn gốc (hỗ trợ fast return)

## Processing

### Tính toán hoàn tiền
```
returnTotal   = Σ(item.salePrice × qty, lineType='return')
exchangeTotal = Σ(item.salePrice × qty, lineType='exchange')
refundAmount  = returnTotal - exchangeTotal - returnFee + returnOtherRefund

refundAmount > 0 → Hoàn tiền cho khách
refundAmount < 0 → Khách thanh toán thêm (customerPaysDifference = |refundAmount|)
```

### Tạo POSOrder (đơn trả)
```
INSERT pos_orders {
  orderCode: 'TH' + timestamp,
  isReturn: true,
  refundAmount: refundAmount,
  returnFee: returnFee,
  returnOtherRefund: returnOtherRefund,
  items: [
    ...returnItems  (lineType='return'),
    ...exchangeItems (lineType='exchange')
  ]
}
```

### Cập nhật tồn kho
```
FOR each returnItem (lineType='return'):
  RPC increment_product_stock(productId, qty)  ← tồn kho tăng

FOR each exchangeItem (lineType='exchange'):
  RPC decrement_product_stock(productId, qty)  ← tồn kho giảm
```

### Cập nhật khách hàng
```
IF customer:
  UPDATE pos_customers SET
    total_spent -= amountToPayCustomer  (refundAmount > 0)
    // KHÔNG tự động giảm debt_amount — phải làm thủ công
```

### Ghi doanh thu
```
UPSERT revenue_records (date=today):
  returns_value += returnTotal
  revenue_other += returnFee  ← phí trả hàng vào revenue_other
```

## Output
- `pos_orders` (1 record mới, isReturn=true)
- `pos_products.stock` thay đổi
- `revenue_records` cập nhật
- `pos_customers.total_spent` giảm

## Tables affected
`pos_orders`, `pos_products`, `revenue_records`, `pos_customers`

## State changes
- `pos_orders.isReturn` = true
- Stock sản phẩm trả: +qty
- Stock sản phẩm đổi: -qty

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Fast return (không có đơn gốc) | Cho phép — không cần orderCode gốc |
| Đơn trả + đổi kết hợp | items chứa cả 'return' và 'exchange' |
| refundAmount < 0 | Khách phải thanh toán thêm |
| Ghi nợ trong đơn gốc | KHÔNG tự giảm debt_amount — phải thủ công |
| returnFee > 0 | Vào revenue_other, không phải netRevenue |

## In hóa đơn trả hàng
```
// POSComputer.tsx:handlePrint() / POSReceiptModal.tsx
Item prefix:
  [TRẢ] → lineType='return'
  [ĐỔI] → lineType='exchange'

Dòng cuối:
  "HOÀN TRẢ KHÁCH: X đ" nếu refundAmount > 0
  "KHÁCH THANH TOÁN: X đ" nếu customerPaysDifference > 0
```

## Related rules
- RULE-POS-002 (Trả hàng)
- EC-ORDER-001 (Trả hàng không giảm công nợ)

## Related code
- `services/posOrderService.ts:processReturnOrder()`
- `components/pos/usePOSReturnFlow.ts`
- `components/pos/POSComputer.tsx:handleCheckout()` (nhánh return)
- `components/pos/POSReceiptModal.tsx`
- RPC `increment_product_stock`, `decrement_product_stock`

## Confidence level: HIGH
