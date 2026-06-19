# OP-003 — Nhập hàng từ nhà cung cấp

## Mục tiêu
Ghi nhận phiếu nhập hàng, cập nhật tồn kho, cập nhật giá vốn (Fixed hoặc AVCO), ghi công nợ NCC.

## Trigger
- Nhân viên hoàn thành phiếu nhập trong trang "Nhập hàng" (`PurchaseOrdersContainer.tsx`)
- Bấm nút "Hoàn thành" (không phải "Lưu nháp")

## Input
```typescript
{
  purchaseSupplier: string         // tên NCC
  purchaseItems: [{
    productId, sku, name,
    quantity: number,
    originalPrice: number,         // giá nhập per unit
    discount: number,
    discountType: '%' | 'fixed'
  }]
  purchaseDiscountValue: number    // giảm giá toàn đơn
  purchaseDiscountType: '%' | 'fixed'
  purchaseReferenceId: string      // mã phiếu tự nhập
  invoiceStatus: 'none' | 'memo_only' | 'partial' | 'full'
  costMethod: 'fixed' | 'average' // từ POSInventorySettings
}
```

## Validation
- Số lượng > 0
- Giảm giá dòng không âm (`Math.max(0, discount)`)
- Giá nhập > 0 (khuyến nghị, không block)

## Processing

### Bước 1 — Tính giá vốn hiệu dụng per dòng
```typescript
// businessLogic.inventory.ts:calcEffectiveUnitPrice()
lineSubtotal = originalPrice × qty
              - (billDiscount × lineSubtotal / totalBeforeDiscount)
effectiveUnitPrice = lineSubtotal / qty
```

### Bước 2 — Tính giá vốn mới per SKU
```typescript
// businessLogic.inventory.ts:calculateNextImportPrice()

if costMethod === 'fixed':
  // AUDIT-001: KHÔNG ghi đè — giữ nguyên giá vốn hiện tại.
  // Chỉ dùng giá mới khi currentImportPrice = 0 (sản phẩm chưa có giá vốn).
  nextImportPrice = currentImportPrice > 0 ? currentImportPrice : effectiveUnitPrice

if costMethod === 'average':
  if currentStock <= 0:
    nextImportPrice = effectiveUnitPrice  // tránh chia 0
  else:
    nextImportPrice = (currentStock × currentImportPrice + qty × effectiveUnitPrice)
                    / (currentStock + qty)
```

### Bước 3 — INSERT InventoryTransaction
```
{
  type: 'Import',
  status: 'completed',
  supplierId, supplierName,
  referenceId: purchaseReferenceId,
  invoiceStatus,
  items: [{
    productId, sku, qty,
    previousStock, newStock,
    nextImportPrice,
    previousImportPrice  // để rollback sau
  }]
}
```

### Bước 4 — Cập nhật pos_products
```
UPDATE pos_products:
  stock += qty
  import_price = nextImportPrice
```

### Bước 5 — Ghi lịch sử giá vốn
```
INSERT product_cost_history {
  sku, import_price: nextImportPrice,
  effective_date: today,
  source: 'purchase'
}
```

### Bước 6 — Ghi công nợ NCC
```
IF supplierId OR supplierName:
  INSERT supplier_debts {
    type: 'purchase',
    amount: totalAfterDiscount,
    supplier_id, supplier_name,
    description: 'Nhập hàng - ' + referenceId
  }
```

## Output
- `inventory_transactions` (1 record)
- `pos_products.stock` tăng per SKU
- `pos_products.import_price` = nextImportPrice per SKU
- `product_cost_history` (1 record per SKU)
- `supplier_debts` (1 record nếu có NCC)

## Tables affected
`inventory_transactions`, `pos_products`, `product_cost_history`, `supplier_debts`

## State changes
- `inventory_transactions.status` = 'completed' (không qua draft nếu chọn "Hoàn thành" trực tiếp)
- `pos_products.import_price` thay đổi (cẩn thận khi rollback)

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Lưu nháp | status='draft', KHÔNG cập nhật stock/giá vốn |
| NCC không có trong hệ thống | supplier_name = text tự nhập, không có supplier_id |
| Mã phiếu trùng | Cho phép (không có UNIQUE constraint) |
| currentStock <= 0 khi AVCO | nextImportPrice = effectiveUnitPrice |
| Upload hóa đơn VAT | invoiceService.ts → Supabase Storage bucket 'purchase-invoices' |

## Ví dụ
```
Nhập 50 đôi giày DBD16-Đen-38 @ 100k
currentStock = 30, currentImportPrice = 90k
effectiveUnitPrice = 100k (không có giảm giá)

AVCO: nextImportPrice = (30×90k + 50×100k) / (30+50) = 96.25k
Fixed: nextImportPrice = 90k (giữ nguyên giá cũ — currentImportPrice > 0 nên không thay đổi)
```

## Related rules
- RULE-INV-001 (AVCO)
- RULE-INV-002 (COGS lịch sử)
- EC-INV-002 (AVCO khi stock <= 0)
- EC-INV-003 (Xóa phiếu sau khi bán)

## Related code
- `components/purchase/PurchaseOrdersContainer.tsx:handleCompletePurchase()`
- `hooks/usePurchaseFormState.ts:getPurchaseItemsNetTotal()`
- `src/lib/businessLogic.inventory.ts:calcEffectiveUnitPrice()`
- `src/lib/businessLogic.inventory.ts:calculateNextImportPrice()`

## Confidence level: HIGH
