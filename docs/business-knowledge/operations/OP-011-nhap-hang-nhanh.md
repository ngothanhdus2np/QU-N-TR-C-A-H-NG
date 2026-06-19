# OP-011 — Nhập hàng nhanh (từ trang Hàng hóa)

## Mục tiêu
Nhập nhanh hàng hóa mà không cần tạo phiếu nhập đầy đủ, dùng trực tiếp từ trang quản lý hàng hóa. Hỗ trợ nhiều mặt hàng, chiết khấu theo phiếu, và đính kèm hóa đơn.

## Kích hoạt
Bấm nút "Nhập hàng" trong `GoodsInventory.tsx`. Nếu chưa chọn nhà cung cấp → hiện modal xác nhận trước khi tiếp tục (thêm trong AUDIT-011).

## Dữ liệu đầu vào
```typescript
{
  purchaseItems: [{
    productId: UUID,
    quantity: number,
    price: number,       // giá nhập từng sản phẩm
    discount: number,    // chiết khấu từng dòng
  }]
  purchaseSupplier: string,         // tên NCC (gõ tay hoặc chọn)
  purchaseNote: string,
  purchaseDiscountValue: number,    // chiết khấu toàn phiếu
  purchaseDiscountType: 'fixed' | 'percent',
  invoiceStatus: 'none' | 'uploaded' | ...,
  invoiceFile?: File,               // file hóa đơn đính kèm
}
```

## Kiểm tra hợp lệ
- `quantity > 0`
- `importPrice >= 0`
- Sản phẩm phải tồn tại trong `pos_products`
- Nếu `purchaseSupplier` trống → hiện modal cảnh báo, tiếp tục với 'NCC lẻ'

## Xử lý

### Tính giá vốn mới
```
effectiveUnitPrice = (price × qty - lineDiscount - phần chiết khấu toàn phiếu phân bổ) / qty
nextImportPrice = calculateNextImportPrice(product, qty, effectiveUnitPrice, costMethod)
  → fixed:   giữ import_price cũ nếu khác 0, dùng giá mới nếu = 0
  → average: (currentStock × currentPrice + qty × newPrice) / (currentStock + qty)
```

### Ghi dữ liệu (1 lần gọi onUpdateSurgical)
```
1. UPDATE pos_products (mỗi mặt hàng):
     stock += quantity
     import_price = nextImportPrice

2. INSERT supplier_debts (luôn ghi khi totalPayable > 0):
     supplierId   = matchedSupplier?.id ?? ''
     supplierName = matchedSupplier?.name || purchaseSupplier.trim() || 'NCC lẻ'
     type         = 'purchase'
     amount       = totalPayable (sau chiết khấu toàn phiếu)

3. INSERT inventory_transactions (type='Import', status='completed')
     staffId, supplierId, supplierName, items[], totalAmount, note

4. (Nếu có file) → uploadPurchaseInvoice(transactionId, file)
```

**Lưu ý AUDIT-011:** Trước đây không ghi `supplier_debts` khi không tìm thấy NCC trong danh sách. Giờ luôn ghi với `supplierName = 'NCC lẻ'` làm dự phòng.

## Dữ liệu đầu ra
- `pos_products` — tồn kho và giá vốn được cập nhật
- `supplier_debts` — 1 bản ghi công nợ (trừ khi totalPayable = 0)
- `inventory_transactions` — 1 phiếu nhập
- `invoice_attachments` — nếu có file đính kèm

## Bảng bị ảnh hưởng
`pos_products`, `supplier_debts`, `inventory_transactions`, `invoice_attachments`

## Code liên quan
- `components/pos/useGoodsPurchase.ts` — toàn bộ logic nhập hàng
- `components/pos/GoodsInventory.tsx` — modal cảnh báo NCC, gọi handleCompletePurchase

## Mức độ tin cậy: CAO
(Đã đọc đầy đủ source `useGoodsPurchase.ts` và `GoodsInventory.tsx`. Cập nhật sau AUDIT-011.)
