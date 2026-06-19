# OP-003 — Nhập hàng từ nhà cung cấp

## Mục tiêu
Ghi nhận phiếu nhập hàng, cập nhật tồn kho, cập nhật giá vốn (Fixed hoặc AVCO), ghi công nợ nhà cung cấp.

## Kích hoạt
- Nhân viên hoàn thành phiếu nhập trong trang "Nhập hàng" (`PurchaseOrdersContainer.tsx`)
- Bấm nút "Hoàn thành" (không phải "Lưu nháp")

## Dữ liệu đầu vào
```typescript
{
  purchaseSupplier: string         // tên nhà cung cấp
  purchaseItems: [{
    productId, sku, name,
    quantity: number,
    originalPrice: number,         // giá nhập mỗi đơn vị
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

## Kiểm tra hợp lệ
- Số lượng > 0
- Giảm giá từng dòng không âm (`Math.max(0, discount)`)
- Giá nhập > 0 (khuyến nghị, không chặn)

## Xử lý

### Bước 1 — Tính giá vốn hiệu dụng mỗi dòng
```typescript
// businessLogic.inventory.ts:calcEffectiveUnitPrice()
lineSubtotal = originalPrice × qty
              - (billDiscount × lineSubtotal / totalBeforeDiscount)
effectiveUnitPrice = lineSubtotal / qty
```

### Bước 2 — Tính giá vốn mới mỗi SKU
```typescript
// businessLogic.inventory.ts:calculateNextImportPrice()

if costMethod === 'fixed':
  // AUDIT-001: KHÔNG ghi đè — giữ nguyên giá vốn hiện tại.
  // Chỉ dùng giá mới khi currentImportPrice = 0 (sản phẩm chưa có giá vốn).
  nextImportPrice = currentImportPrice > 0 ? currentImportPrice : effectiveUnitPrice

if costMethod === 'average':
  if currentStock <= 0:
    nextImportPrice = effectiveUnitPrice  // tránh chia cho 0
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
    previousImportPrice  // để khôi phục sau nếu cần
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

### Bước 6 — Ghi công nợ nhà cung cấp
```
IF supplierId OR supplierName:
  INSERT supplier_debts {
    type: 'purchase',
    amount: totalAfterDiscount,
    supplier_id, supplier_name,
    description: 'Nhập hàng - ' + referenceId
  }
```

## Dữ liệu đầu ra
- `inventory_transactions` (1 bản ghi)
- `pos_products.stock` tăng mỗi SKU
- `pos_products.import_price` = nextImportPrice mỗi SKU
- `product_cost_history` (1 bản ghi mỗi SKU)
- `supplier_debts` (1 bản ghi nếu có nhà cung cấp)

## Bảng bị ảnh hưởng
`inventory_transactions`, `pos_products`, `product_cost_history`, `supplier_debts`

## Thay đổi trạng thái
- `inventory_transactions.status` = 'completed' (không qua nháp nếu chọn "Hoàn thành" trực tiếp)
- `pos_products.import_price` thay đổi (cẩn thận khi khôi phục)

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Lưu nháp | status='draft', KHÔNG cập nhật tồn kho/giá vốn |
| Nhà cung cấp không có trong hệ thống | supplier_name = văn bản tự nhập, không có supplier_id |
| Mã phiếu trùng | Cho phép (không có ràng buộc UNIQUE) |
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

## Quy tắc liên quan
- RULE-INV-001 (AVCO)
- RULE-INV-002 (Giá vốn lịch sử)
- EC-INV-002 (AVCO khi tồn kho <= 0)
- EC-INV-003 (Xóa phiếu sau khi bán)

## Code liên quan
- `components/purchase/PurchaseOrdersContainer.tsx:handleCompletePurchase()`
- `hooks/usePurchaseFormState.ts:getPurchaseItemsNetTotal()`
- `src/lib/businessLogic.inventory.ts:calcEffectiveUnitPrice()`
- `src/lib/businessLogic.inventory.ts:calculateNextImportPrice()`

## Mức độ tin cậy: CAO
