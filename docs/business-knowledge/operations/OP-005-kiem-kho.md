# OP-005 — Kiểm kho (Stock Audit)

## Mục tiêu
Đối chiếu tồn kho thực tế với số liệu hệ thống, cập nhật lại tồn kho cho từng SKU.

## Kích hoạt
Nhân viên đếm thực tế và nhập số lượng vào trang Kiểm kho (goods-audit).

## Dữ liệu đầu vào
```typescript
{
  auditItems: [{
    productId,
    sku,
    actualCount: number  // số lượng đếm được thực tế
  }]
}
```

## Kiểm tra hợp lệ
- `actualCount >= 0`
- Bỏ qua sản phẩm cha (`product.isParent === true`)

## Xử lý

### Tính chênh lệch
```typescript
FOR each product (bỏ qua nếu isParent):
  previousStock = product.stock
  newStock = actualCount
  diff = newStock - previousStock
  // diff > 0 → tồn kho thực tế nhiều hơn hệ thống
  // diff < 0 → tồn kho thực tế ít hơn (có thể do mất mát, hỏng)
```

### Cập nhật tồn kho
```
UPDATE pos_products SET stock = actualCount
```
**Lưu ý:** Ghi trực tiếp (không phải ±), thay thế hoàn toàn giá trị cũ.

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

## Dữ liệu đầu ra
- `pos_products.stock` = actualCount (ghi trực tiếp)
- `inventory_transactions` (1 bản ghi, type='Check')
- Thông báo: "(tăng/giảm X đơn vị)"

## Bảng bị ảnh hưởng
`pos_products`, `inventory_transactions`

## Thay đổi trạng thái
- `inventory_transactions.status` = 'balanced'
- `pos_products.stock` bị ghi đè

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Sản phẩm cha (isParent=true) | Bỏ qua — không nhập, không cập nhật |
| actualCount = 0 | Hợp lệ — đặt tồn kho về 0 |
| actualCount = previousStock | diff=0, không cần cập nhật nhưng vẫn ghi |
| Kiểm kho một phần (không kiểm tất cả) | Chỉ cập nhật SKU được nhập actualCount |

## Lưu ý nghiệp vụ
Kiểm kho là thao tác **GHI TRỰC TIẾP** (không phải ±), vì vậy:
- Nếu cô ấy nhập 10 cho DBD16-Đen-38 nhưng thực tế quên kiểm DBD16-Đen-39 → tồn kho DBD16-Đen-39 giữ nguyên (không về 0).
- Chỉ cập nhật SKU nào có `actualCount` được nhập.

## Code liên quan
- `components/pos/useGoodsAudit.ts`
- `components/pos/GoodsInventory.tsx` (khởi động kiểm kho)

## Mức độ tin cậy: CAO
