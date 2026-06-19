# OP-002 — Trả hàng / Đổi hàng POS

## Mục tiêu
Ghi nhận giao dịch trả hàng hoặc đổi hàng tại quầy, cập nhật tồn kho, tính hoàn tiền/thu thêm.

## Kích hoạt
Nhân viên mở màn hình trả hàng, chọn sản phẩm cần trả/đổi, bấm "Xác nhận".

## Dữ liệu đầu vào
```typescript
{
  returnCart: [{
    product: POSProduct,
    quantity: number,
    lineType: 'return' | 'exchange'  // trả hoặc đổi mới
  }]
  originalOrder?: POSOrder  // đơn gốc (không bắt buộc — trả hàng nhanh)
  returnFee: number         // phí trả hàng (thu từ khách)
  returnOtherRefund: number // hoàn thêm cho khách
}
```

## Kiểm tra hợp lệ
- `quantity > 0`
- Sản phẩm phải tồn tại trong `pos_products`
- Không bắt buộc có đơn gốc (hỗ trợ trả hàng nhanh)

## Xử lý

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

## Dữ liệu đầu ra
- `pos_orders` (1 bản ghi mới, isReturn=true)
- `pos_products.stock` thay đổi
- `revenue_records` cập nhật
- `pos_customers.total_spent` giảm

## Bảng bị ảnh hưởng
`pos_orders`, `pos_products`, `revenue_records`, `pos_customers`

## Thay đổi trạng thái
- `pos_orders.isReturn` = true
- Tồn kho sản phẩm trả: +qty
- Tồn kho sản phẩm đổi: -qty

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Trả hàng nhanh (không có đơn gốc) | Cho phép — không cần mã đơn gốc |
| Đơn vừa trả vừa đổi | items chứa cả 'return' và 'exchange' |
| refundAmount < 0 | Khách phải thanh toán thêm |
| Ghi nợ trong đơn gốc | KHÔNG tự giảm debt_amount — phải thủ công |
| returnFee > 0 | Vào revenue_other, không phải netRevenue |

## In hóa đơn trả hàng
```
// POSComputer.tsx:handlePrint() / POSReceiptModal.tsx
Tiền tố từng dòng:
  [TRẢ] → lineType='return'
  [ĐỔI] → lineType='exchange'

Dòng cuối:
  "HOÀN TRẢ KHÁCH: X đ" nếu refundAmount > 0
  "KHÁCH THANH TOÁN: X đ" nếu customerPaysDifference > 0
```

## Quy tắc liên quan
- RULE-POS-002 (Trả hàng)
- EC-ORDER-001 (Trả hàng không giảm công nợ)

## Code liên quan
- `services/posOrderService.ts:processReturnOrder()`
- `components/pos/usePOSReturnFlow.ts`
- `components/pos/POSComputer.tsx:handleCheckout()` (nhánh return)
- `components/pos/POSReceiptModal.tsx`
- RPC `increment_product_stock`, `decrement_product_stock`

## Mức độ tin cậy: CAO
