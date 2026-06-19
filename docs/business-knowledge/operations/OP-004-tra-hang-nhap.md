# OP-004 — Trả hàng nhập (Purchase Return)

## Mục tiêu
Ghi nhận việc trả hàng lại cho nhà cung cấp, giảm tồn kho, giảm công nợ nhà cung cấp (hoặc nhận tiền mặt).

## Kích hoạt
Tạo phiếu trả tại tab "Trả hàng nhập" trong `PurchaseOrdersContainer.tsx`.

## Dữ liệu đầu vào
```typescript
{
  returnSupplier: string
  returnItems: [{ productId, sku, quantity }]
  returnSupplierPaidAmount: number  // nhà cung cấp trả tiền mặt ngay
  returnApplySupplierDebt: boolean  // trừ vào công nợ hay không
  returnReferenceId: string
}
```

## Kiểm tra hợp lệ
- Số lượng trả không vượt quá tồn kho hiện tại: `Math.min(product.stock, qty + 1)`
- Phải chọn ít nhất 1 sản phẩm

## Xử lý

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

### Bước 3 — Ghi công nợ nhà cung cấp

**Trường hợp A — Trừ vào công nợ (returnApplySupplierDebt=true):**
```
INSERT supplier_debts {
  type: 'payment',
  amount: returnValue,
  description: 'Trả hàng - ' + referenceId
}
```

**Trường hợp B — Nhà cung cấp trả tiền mặt:**
```
IF returnSupplierPaidAmount > 0:
  INSERT supplier_debts {
    type: 'payment',
    amount: returnSupplierPaidAmount,
    description: 'NCC trả tiền mặt - ' + referenceId
  }
```

### Khôi phục khi lỗi
```
try { thêm transaction, thêm bản ghi công nợ }
catch {
  // Khôi phục tồn kho về giá trị ban đầu
  UPDATE pos_products SET stock = previousStock per item
  // Xóa debtRecord, transactionRecord đã thêm
}
```

## Dữ liệu đầu ra
- `inventory_transactions` (1 bản ghi, type='PurchaseReturn')
- `pos_products.stock` giảm
- `supplier_debts` (1–2 bản ghi type='payment')

## Bảng bị ảnh hưởng
`inventory_transactions`, `pos_products`, `supplier_debts`

## Thay đổi trạng thái
- `pos_products.stock` giảm = số lượng trả
- `supplier_debts` thêm bản ghi type='payment' → giảm công nợ

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Trả nhiều hơn tồn kho | Math.min giới hạn — không cho phép âm |
| Nhà cung cấp trả tiền mặt VÀ trừ nợ | 2 bản ghi supplier_debts cùng lúc |
| Lỗi giữa chừng | Try/catch: khôi phục tồn kho + xóa bản ghi đã thêm |
| Giá vốn không thay đổi | Trả hàng nhập KHÔNG khôi phục import_price |

## Quy tắc liên quan
- EC-INV-004 (Trả hàng nhập không khôi phục giá vốn)

## Code liên quan
- `components/purchase/PurchaseOrdersContainer.tsx:handleCompleteReturn()`

## Mức độ tin cậy: CAO
