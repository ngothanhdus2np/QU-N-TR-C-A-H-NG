# OP-011 — Nhập hàng nhanh (từ trang Hàng hóa)

## Mục tiêu
Nhập nhanh 1 sản phẩm mà không cần tạo phiếu nhập đầy đủ, dùng trực tiếp từ trang quản lý hàng hóa.

## Kích hoạt
Bấm nút "Nhập hàng" trực tiếp trong `GoodsInventory.tsx` (trang Hàng hóa).

## Dữ liệu đầu vào
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

## Kiểm tra hợp lệ
- `quantity > 0`
- `importPrice >= 0`

## Xử lý
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

**Lưu ý quan trọng:** Phải truyền đúng prop `suppliers` để xác định supplierId từ tên nhà cung cấp.
Nếu không có supplierId → supplierName = '' → KHÔNG ghi `supplier_debts`.

## Dữ liệu đầu ra
- `inventory_transactions` (1 bản ghi)
- `pos_products.stock` tăng
- `pos_products.import_price` cập nhật
- `product_cost_history` (1 bản ghi)
- `supplier_debts` (tuỳ chọn)

## Bảng bị ảnh hưởng
`inventory_transactions`, `pos_products`, `product_cost_history`, `supplier_debts` (nếu có nhà cung cấp)

## Code liên quan
- `components/pos/useGoodsPurchase.ts`
- `components/pos/GoodsInventory.tsx`

## Mức độ tin cậy: TRUNG BÌNH
(Chưa đọc source useGoodsPurchase.ts đầy đủ — suy luận từ INVENTORY_LOGIC.md)
