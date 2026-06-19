# INVENTORY_LOGIC — Nghiệp vụ tồn kho & hàng hóa

> Source: src/lib/businessLogic.inventory.ts, components/purchase/PurchaseOrdersContainer.tsx,
>         services/posOrderService.ts, components/pos/useGoodsAudit.ts, supabase_setup.sql

---

## Cấu trúc sản phẩm (Parent-Variant)

```
pos_products
├── Sản phẩm cha (is_parent=true, parent_id=null)
│     SKU: "DBD16"
│     stock: 0 (tổng hiển thị = Σ variants)
│
└── Biến thể con (is_parent=false, parent_id=id_cha)
      SKU: "DBD16-Đen-38", "DBD16-Đen-39",...
      variant_attributes: {"Màu": "Đen", "Size": "38"}
      stock: số lượng thực tế
```

**Sản phẩm không có biến thể (standalone):**
- `parent_id = null`, `is_parent = false`
- Tồn kho ghi trực tiếp vào `pos_products.stock`

---

## Luồng 1: Nhập hàng từ NCC

### Trigger
Nhân viên hoàn thành phiếu nhập trong `PurchaseOrdersContainer.tsx`

### Input
- Danh sách sản phẩm + số lượng + giá nhập (purchaseItems)
- Nhà cung cấp (purchaseSupplier)
- Giảm giá dòng / giảm giá toàn đơn (purchaseDiscountValue)
- Phương thức tính giá vốn (costMethod: 'fixed' | 'average')

### Processing

**Bước 1 — Tính giá vốn hiệu dụng:**
```typescript
// src/lib/businessLogic.inventory.ts:calcEffectiveUnitPrice()
effectiveUnitPrice = lineSubtotal / qty
lineSubtotal = originalPrice × qty
             - (billDiscount × (lineSubtotal / totalBeforeDiscount))
```

**Bước 2 — Tính giá vốn mới (per SKU):**
```typescript
// src/lib/businessLogic.inventory.ts:calculateNextImportPrice()

if (costMethod === 'fixed') {
  // AUDIT-001: KHÔNG ghi đè — giữ nguyên giá vốn hiện tại.
  // Chỉ dùng giá mới khi currentImportPrice = 0 (sản phẩm chưa có giá vốn).
  nextImportPrice = currentImportPrice > 0 ? currentImportPrice : effectiveUnitPrice
}
if (costMethod === 'average') {
  nextImportPrice = (currentStock × currentImportPrice + qty × effectiveUnitPrice)
                  / (currentStock + qty)
  // Edge case: currentStock <= 0 → nextImportPrice = effectiveUnitPrice
}
```

**Bước 3 — Tạo InventoryTransaction:**
```
{
  type: 'Import',
  status: 'completed',
  items: [{ sku, qty, previousStock, newStock, nextImportPrice, previousImportPrice }],
  supplierId, supplierName,
  invoiceStatus: 'none' | 'memo_only' | 'partial' | 'full'
}
```

**Bước 4 — Cập nhật pos_products:**
```
stock += qty
import_price = nextImportPrice
```

**Bước 5 — Ghi product_cost_history:**
```
{ sku, import_price: nextImportPrice, effective_date: today, source: 'purchase' }
```

**Bước 6 — Ghi supplier_debts:**
```
{ type: 'purchase', amount: totalAfterDiscount, supplier_id, supplier_name }
```

### Output
- `inventory_transactions` (1 record)
- `pos_products.stock` tăng
- `pos_products.import_price` cập nhật
- `product_cost_history` (1 record per SKU)
- `supplier_debts` (1 record nếu có công nợ)
- `audit_logs` (tự động trigger)

### Related rules
- RULE-INV-001 (Tính giá vốn)
- RULE-INV-002 (COGS lịch sử)

---

## Luồng 2: Nhập hàng nhanh (từ trang Hàng hóa)

### Trigger
Nút "Nhập hàng" trực tiếp trong GoodsInventory.tsx

### Input
- 1 sản phẩm + số lượng + giá nhập
- Tùy chọn: supplierId

### Processing
Logic giống Luồng 1 nhưng đơn giản hơn.

**Lưu ý:** Phải truyền `suppliers` prop để resolve supplierId từ tên nhà cung cấp.
(Nếu không có → supplierName = '' → không ghi supplier_debts)

### Source
`components/pos/useGoodsPurchase.ts`

---

## Luồng 3: Kiểm kho (Stock Audit)

### Trigger
Nhân viên đếm thực tế và nhập số lượng vào trang Kiểm kho

### Input
- Danh sách sản phẩm + số lượng thực tế (actualCount)

### Processing
```typescript
// components/pos/useGoodsAudit.ts

for each product:
  if (product.isParent) continue  // bỏ qua sản phẩm cha

  previousStock = product.stock
  newStock = actualCount
  diff = newStock - previousStock
  // diff > 0 → tăng, diff < 0 → giảm

  UPDATE pos_products SET stock = actualCount
```

**InventoryTransaction:**
```
{
  type: 'Check',
  status: 'balanced',
  balancedDate: today,
  totalActualQty: Σ(actualCount),
  totalDiff: Σ(|diff|),
  increaseCount: số SKU tăng,
  decreaseCount: số SKU giảm
}
```

### Output
- `pos_products.stock` = actualCount (SET trực tiếp)
- `inventory_transactions` (1 record, type='Check')
- Toast hiển thị chênh lệch: "(tăng/giảm X đơn vị)"

---

## Luồng 4: Xuất kho nội bộ

### Trigger
Trang `goods-internal-use`

### Processing
```typescript
// components/inventory/GoodsInternalUse.tsx:handleSave()

// Validation trước khi lưu:
newStock = Math.max(0, product.stock - quantity)
if (product.stock < quantity) → cảnh báo nhưng vẫn cho lưu

UPDATE pos_products SET stock = newStock

InventoryTransaction { type: 'internal_use', status: 'completed' }
```

---

## Luồng 5: Hủy hàng lỗi/hư

### Trigger
Trang `goods-disposal`

### Processing
Tương tự xuất kho nội bộ nhưng `type: 'disposal'`

---

## Luồng 6: Trả hàng nhập (PurchaseReturn)

### Trigger
`PurchaseOrdersContainer.tsx:handleCompleteReturn()`

### Processing
```
1. Giảm pos_products.stock - returnQty
2. InventoryTransaction { type: 'PurchaseReturn', status: 'completed' }
3. supplier_debts { type: 'payment', amount: returnValue }
   (NCC nhận lại hàng = giảm công nợ)
4. Nếu NCC trả tiền mặt → supplier_debts { type: 'payment', amount: cashAmount }

Rollback nếu lỗi:
  - Khôi phục stock về giá trị ban đầu
  - Xóa debtRecord và transactionRecord đã insert
```

---

## Luồng 7: Import từ Excel / KiotViet

### Trigger
`routes/import.ts`

**Excel import:**
```
useGoodsExcelImport.ts:
  - Parse file .xlsx
  - Upsert pos_products (SKU làm key)
  - Tạo InventoryTransaction (type='Import') cho sản phẩm có stock > 0
    để buildCostHistory có dữ liệu khởi điểm
```

**KiotViet import:**
```
routes/import.ts:1643:
  - Import đơn mua hàng từ KiotViet
  - Fix: thêm nextImportPrice vào items để buildCostHistory hoạt động
  - Fix: update pos_products.import_price theo giá mua mới nhất
```

---

## Tính tồn kho hiển thị cho sản phẩm cha

```typescript
// components/pos/GoodsProductRow.tsx
// RULE-INV-003: tồn kho cha = tổng variants con

totalVariantStock = variants
  .filter(v => v.parentId === product.id)
  .reduce((sum, v) => sum + (v.stock || 0), 0)

displayStock = product.isParent ? totalVariantStock : product.stock
```

---

## Cảnh báo tồn kho thấp

```
Trigger: routes/notifications.ts
Logic: pos_products WHERE stock <= min_stock AND status='Active'
Tần suất: NEEDS_VERIFICATION (chưa đọc file notifications.ts)
```

---

## Điểm đặc biệt & rủi ro

| Vấn đề | File | Ghi chú |
|--------|------|---------|
| Rollback giá vốn khi xóa phiếu nhập | `PurchaseOrdersContainer.tsx:handleDeletePurchase` | Dùng `previousImportPrice` lưu trong transaction.items |
| Stock âm khi bán quá tồn | `GoodsInternalUse.tsx:207` | `Math.max(0, ...)` để tránh âm |
| Tồn kho âm khi trả hàng nhập | `PurchaseOrdersContainer.tsx:handleAddProductToReturn` | `Math.min(product.stock, item.quantity + 1)` |
| Import KiotViet không có nextImportPrice | `routes/import.ts:1643` | Đã fix 2026-06-15 |
| Excel import không tạo InventoryTransaction | `useGoodsExcelImport.ts` | Đã fix 2026-06-15 (tạo 1 transaction 'Import') |
