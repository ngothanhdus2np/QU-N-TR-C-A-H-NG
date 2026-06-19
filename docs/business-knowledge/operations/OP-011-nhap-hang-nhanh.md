# OP-011 — Nhập hàng nhanh (từ trang Hàng hóa)

## Mục tiêu
Nhập nhanh 1 sản phẩm mà không cần tạo phiếu nhập đầy đủ, dùng trực tiếp từ trang quản lý hàng hóa.

## Trigger
Bấm nút "Nhập hàng" trực tiếp trong `GoodsInventory.tsx` (trang Hàng hóa).

## Input
```typescript
{
  productId: UUID,
  sku: string,
  quantity: number,
  importPrice: number,
  supplierId?: UUID,
  supplierName?: string,
  note?: string
}
```

## Validation
- `quantity > 0`
- `importPrice >= 0`

## Processing
Logic tương tự OP-003 nhưng đơn giản hơn:
```
1. Tính nextImportPrice (theo costMethod: fixed/average)
2. INSERT inventory_transactions (type='Import', status='completed')
3. UPDATE pos_products:
     stock += quantity
     import_price = nextImportPrice
4. INSERT product_cost_history

IF supplierId:
  INSERT supplier_debts { type: 'purchase', amount: importPrice × qty }
```

**Lưu ý quan trọng:** Phải truyền đúng `suppliers` prop để resolve supplierId từ tên NCC.
Nếu không có supplierId → supplierName = '' → KHÔNG ghi `supplier_debts`.

## Output
- `inventory_transactions` (1 record)
- `pos_products.stock` tăng
- `pos_products.import_price` cập nhật
- `product_cost_history` (1 record)
- `supplier_debts` (tuỳ chọn)

## Tables affected
`inventory_transactions`, `pos_products`, `product_cost_history`, `supplier_debts` (nếu có NCC)

## Related code
- `components/pos/useGoodsPurchase.ts`
- `components/pos/GoodsInventory.tsx`

## Confidence level: MEDIUM
(Chưa đọc source useGoodsPurchase.ts đầy đủ — suy luận từ INVENTORY_LOGIC.md)
