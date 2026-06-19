# PURCHASE_LOGIC — Nghiệp vụ mua hàng & quản lý nhà cung cấp

> Source: components/purchase/PurchaseOrdersContainer.tsx, hooks/usePurchaseFormState.ts,
>         components/suppliers/SupplierContainer.tsx, services/invoiceService.ts

---

## Luồng 1: Tạo phiếu nhập hàng

### Trigger
Nhân viên tạo phiếu nhập tại trang "Nhập hàng" (purchase-orders)

### Input
```typescript
{
  purchaseSupplier: string  // tên hoặc code NCC
  purchaseItems: [{
    productId, sku, name,
    quantity, originalPrice, discount, discountType
  }]
  purchaseDiscountValue: number
  purchaseDiscountType: '%' | 'fixed'
  purchaseNote: string
  purchaseReferenceId: string  // Mã phiếu nhập (tự nhập)
  invoiceStatus: 'none' | 'memo_only' | 'partial' | 'full'
}
```

### Processing

**Lưu tạm (Save Draft):**
```
InventoryTransaction { status: 'draft', referenceId: purchaseReferenceId }
KHÔNG cập nhật stock, KHÔNG cập nhật giá vốn
```

**Hoàn thành (Complete Purchase):**

```
1. Tính effectiveUnitPrice per item (có phân bổ giảm giá toàn đơn)
2. Tính nextImportPrice (fixed hoặc average)
3. INSERT inventory_transactions (status='completed')
4. UPDATE pos_products.stock += qty per item
5. UPDATE pos_products.import_price = nextImportPrice
6. INSERT product_cost_history (sku, nextImportPrice, today)
7. INSERT supplier_debts (type='purchase', amount=totalAfterDiscount)
8. Lưu previousImportPrice vào items (để rollback sau)
```

### Validation
- Giảm giá dòng không âm: `Math.max(0, discount)`
- Số lượng > 0
- Phải chọn nhà cung cấp (nếu muốn ghi công nợ)

### Source
`components/purchase/PurchaseOrdersContainer.tsx:handleCompletePurchase()`
`hooks/usePurchaseFormState.ts:getPurchaseItemsNetTotal()`

---

## Luồng 2: Xóa phiếu nhập đã hoàn thành

### Trigger
Nhân viên xóa phiếu nhập (có dialog cảnh báo)

### Processing
```
1. Dialog cảnh báo nếu stock hiện tại < số lượng đã nhập
   (tức là đã bán rồi → rollback sẽ gây âm)

2. Rollback stock:
   pos_products.stock -= item.quantity (per item)

3. Rollback import_price:
   pos_products.import_price = item.previousImportPrice
   (nếu không có previousImportPrice → giữ nguyên)

4. Xóa inventory_transactions record

5. Xóa supplier_debts record tương ứng
```

### Source
`components/purchase/PurchaseOrdersContainer.tsx:handleDeletePurchase()`

---

## Luồng 3: Trả hàng nhập (Purchase Return)

### Trigger
Tạo phiếu trả tại tab "Trả hàng nhập" (purchase-returns)

### Input
```typescript
{
  returnSupplier: string
  returnItems: [{ productId, sku, quantity }]
  returnSupplierPaidAmount: number  // NCC trả tiền mặt ngay
  returnApplySupplierDebt: boolean  // Dùng để giảm trừ công nợ
  returnReferenceId: string
}
```

### Processing
```
1. InventoryTransaction { type: 'PurchaseReturn', status: 'completed' }
2. UPDATE pos_products.stock -= qty per item
3. supplier_debts records:
   - Nếu returnApplySupplierDebt = true:
     { type: 'payment', amount: returnValue }  // trừ công nợ
   - Nếu returnSupplierPaidAmount > 0:
     { type: 'payment', amount: cashAmount }  // NCC trả tiền mặt
4. Rollback nếu lỗi:
   - Khôi phục stock về giá trị ban đầu
   - Xóa debtRecord, transactionRecord
```

### Validation
- Số lượng trả không vượt quá tồn kho: `Math.min(product.stock, qty + 1)`

### Source
`components/purchase/PurchaseOrdersContainer.tsx:handleCompleteReturn()`

---

## Luồng 4: Import từ file Excel

### Trigger
Upload file `.xlsx` trong trang nhập hàng

### Processing
```
PurchaseOrdersContainer.tsx:handlePurchaseFileImport()
  → Parse Excel rows
  → Bỏ qua SKU không tồn tại trong pos_products
  → Báo toast với tối đa 5 SKU bị bỏ qua
  → Điền vào purchaseItems form
```

**Validate status từ file:**
```
status: only ['active','inactive'] accepted → else skip
```

---

## Luồng 5: Hóa đơn VAT đầu vào

### Trigger
Upload file PDF/ảnh hóa đơn khi tạo phiếu nhập

### Processing
```
services/invoiceService.ts:
  → Upload file lên Supabase Storage bucket 'purchase-invoices'
  → INSERT invoice_attachments {
      purchase_record_id,
      file_url, file_name, file_type,
      invoice_number, invoice_date,
      invoice_amount, vat_amount
    }
```

**Storage bucket:** `purchase-invoices`
**Policy:** authenticated users có thể INSERT + SELECT

---

## Luồng 6: Tạo nhanh sản phẩm / nhà cung cấp mới

### Trigger
Trong trang nhập hàng, bấm nút "+" cạnh ô chọn SP/NCC

### Hook
`hooks/usePurchaseQuickModals.ts`

**Quick Product Modal:**
- Tab: Thông tin / Tồn kho / Vị trí / Đơn vị
- Sau khi lưu → điền vào purchaseItems

**Quick Supplier Modal:**
- Nhập tên, phone, địa chỉ nhanh
- Sau khi lưu → điền vào purchaseSupplier

---

## Quản lý nhà cung cấp

### CRUD cơ bản
```
Source: components/suppliers/SupplierContainer.tsx
CRUD: name, code, phone, email, address, supplier_group, status
Tax info: company_name, tax_code (cho xuất hóa đơn)
```

### Công nợ NCC (transaction model)
```
supplier_debts không lưu số dư tổng hợp.
Số dư hiện tại = Σ(amount WHERE type='purchase') - Σ(amount WHERE type='payment')
Computed runtime, không lưu snapshot.
```

**Lý do:** Thiết kế "transaction model" — mỗi lần mua hoặc thanh toán là 1 record riêng, tránh race condition khi nhiều tab/thiết bị ghi đồng thời.

### Import NCC từ file
```
SupplierContainer.tsx:handleSupplierFileImport()
→ Parse CSV/Excel
→ Skip duplicate (show toast với skippedRows, không prompt)
→ Validate status: only ['active','inactive']
```

### Bulk delete NCC
```
Nếu NCC có công nợ → hiện Modal cảnh báo (không dùng window.confirm)
User xác nhận → xóa tất cả cùng lúc
Selection được khôi phục nếu user Cancel (không mất selection sớm)
```

---

## Special cases

| Tình huống | Xử lý |
|-----------|-------|
| Trả hàng nhập nhiều hơn tồn kho | `Math.min(stock, qty+1)` — giới hạn tối đa = tồn kho hiện tại |
| Xóa phiếu nhập đã bán → stock âm | Dialog cảnh báo nhưng vẫn cho xóa |
| Mã phiếu nhập trùng | `referenceId` là TEXT, không có UNIQUE constraint → cho phép trùng |
| Upload hóa đơn nhiều tệp | `invoice_attachments` hỗ trợ nhiều record per purchase_record_id |
| NCC không tồn tại trong hệ thống | Nhập tên tự do → supplier_debts.supplier_name = text nhập |
