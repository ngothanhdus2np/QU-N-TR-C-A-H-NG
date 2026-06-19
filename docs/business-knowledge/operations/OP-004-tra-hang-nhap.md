# OP-004 — Trả hàng nhập (Purchase Return)

## Mục tiêu
Ghi nhận việc trả hàng lại cho nhà cung cấp, giảm tồn kho, giảm công nợ NCC (hoặc nhận tiền mặt).

## Trigger
Tạo phiếu trả tại tab "Trả hàng nhập" trong `PurchaseOrdersContainer.tsx`.

## Input
```typescript
{
  returnSupplier: string
  returnItems: [{ productId, sku, quantity }]
  returnSupplierPaidAmount: number  // NCC trả tiền mặt ngay
  returnApplySupplierDebt: boolean  // trừ vào công nợ hay không
  returnReferenceId: string
}
```

## Validation
- Số lượng trả không vượt quá tồn kho hiện tại: `Math.min(product.stock, qty + 1)`
- Phải chọn ít nhất 1 sản phẩm

## Processing

### Bước 1 — Tạo InventoryTransaction
```
INSERT inventory_transactions {
  type: 'PurchaseReturn',
  status: 'completed',
  supplierName: returnSupplier,
  referenceId: returnReferenceId,
  items: [{ productId, sku, qty, previousStock, newStock }]
}
```

### Bước 2 — Giảm tồn kho
```
FOR each returnItem:
  UPDATE pos_products SET stock -= qty
```

### Bước 3 — Ghi công nợ NCC

**Trường hợp A — Trừ vào công nợ (returnApplySupplierDebt=true):**
```
INSERT supplier_debts {
  type: 'payment',
  amount: returnValue,
  description: 'Trả hàng - ' + referenceId
}
```

**Trường hợp B — NCC trả tiền mặt:**
```
IF returnSupplierPaidAmount > 0:
  INSERT supplier_debts {
    type: 'payment',
    amount: returnSupplierPaidAmount,
    description: 'NCC trả tiền mặt - ' + referenceId
  }
```

### Rollback nếu lỗi
```
try { insert transaction, insert debt record }
catch {
  // Khôi phục stock về giá trị ban đầu
  UPDATE pos_products SET stock = previousStock per item
  // Xóa debtRecord, transactionRecord đã insert
}
```

## Output
- `inventory_transactions` (1 record, type='PurchaseReturn')
- `pos_products.stock` giảm
- `supplier_debts` (1–2 records type='payment')

## Tables affected
`inventory_transactions`, `pos_products`, `supplier_debts`

## State changes
- `pos_products.stock` giảm = qty trả
- `supplier_debts` tăng record type='payment' → giảm công nợ

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Trả nhiều hơn tồn kho | Math.min giới hạn — không cho phép âm |
| NCC trả tiền mặt VÀ trừ nợ | 2 records supplier_debts cùng lúc |
| Lỗi giữa chừng | Try/catch: rollback stock + xóa records đã insert |
| Giá vốn không thay đổi | Trả hàng nhập KHÔNG rollback import_price |

## Related rules
- EC-INV-004 (Trả hàng nhập không rollback giá vốn)

## Related code
- `components/purchase/PurchaseOrdersContainer.tsx:handleCompleteReturn()`

## Confidence level: HIGH
