# OP-005 — Kiểm kho (Stock Audit)

## Mục tiêu
Đối chiếu tồn kho thực tế với số liệu hệ thống, cập nhật lại stock cho từng SKU.

## Trigger
Nhân viên đếm thực tế và nhập số lượng vào trang Kiểm kho (goods-audit).

## Input
```typescript
{
  auditItems: [{
    productId,
    sku,
    actualCount: number  // số lượng đếm được thực tế
  }]
}
```

## Validation
- `actualCount >= 0`
- Bỏ qua sản phẩm cha (`product.isParent === true`)

## Processing

### Tính chênh lệch
```typescript
FOR each product (skip if isParent):
  previousStock = product.stock
  newStock = actualCount
  diff = newStock - previousStock
  // diff > 0 → tồn kho thực tế nhiều hơn
  // diff < 0 → tồn kho thực tế ít hơn (có thể do mất mát, hỏng)
```

### Cập nhật tồn kho
```
UPDATE pos_products SET stock = actualCount
```
**Lưu ý:** SET trực tiếp (không phải ±), thay thế hoàn toàn giá trị cũ.

### Tạo InventoryTransaction
```
INSERT inventory_transactions {
  type: 'Check',
  status: 'balanced',
  balancedDate: today,
  totalActualQty: Σ(actualCount),
  totalDiff: Σ(|diff|),
  increaseCount: số SKU có diff > 0,
  decreaseCount: số SKU có diff < 0,
  items: [{ productId, sku, previousStock, newStock, diff }]
}
```

## Output
- `pos_products.stock` = actualCount (SET trực tiếp)
- `inventory_transactions` (1 record, type='Check')
- Toast: "(tăng/giảm X đơn vị)"

## Tables affected
`pos_products`, `inventory_transactions`

## State changes
- `inventory_transactions.status` = 'balanced'
- `pos_products.stock` bị ghi đè

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Sản phẩm cha (isParent=true) | Skip — không nhập, không cập nhật |
| actualCount = 0 | Hợp lệ — set stock về 0 |
| actualCount = previousStock | diff=0, không cần cập nhật nhưng vẫn ghi |
| Kiểm kho một phần (không kiểm tất cả) | Chỉ cập nhật SKU được nhập actualCount |

## Lưu ý kinh doanh
Kiểm kho là nghiệp vụ **SET** (không phải ±), vì vậy:
- Nếu cô ấy nhập 10 cho DBD16-Đen-38 nhưng thực tế cô quên kiểm DBD16-Đen-39 → stock DBD16-Đen-39 giữ nguyên (không về 0).
- Chỉ cập nhật SKU nào có `actualCount` được nhập.

## Related code
- `components/pos/useGoodsAudit.ts`
- `components/pos/GoodsInventory.tsx` (trigger kiểm kho)

## Confidence level: HIGH
