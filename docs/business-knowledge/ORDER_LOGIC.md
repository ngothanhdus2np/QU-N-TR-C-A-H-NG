# ORDER_LOGIC — Nghiệp vụ đơn hàng & bán lẻ POS

> Source: services/posOrderService.ts, components/pos/POSComputer.tsx,
>         components/pos/usePOSReturnFlow.ts, components/orders/

---

## Luồng 1: Bán hàng POS (trực tiếp)

### Trigger
Nhân viên bấm "THANH TOÁN" trên máy tính tiền

### Input
```typescript
{
  items: POSOrderItem[]  // sku, qty, salePrice, importPrice, discount, lineType
  customer?: POSCustomer
  paymentMethod: 'Cash' | 'Bank' | 'Momo' | 'Card' | 'Other'
  splitPayments?: { method, amount }[]
  cashReceived: number
  staffId: string
  discountAmount: number  // giảm giá toàn đơn
  priceBookId?: string
  channel: 'direct' | 'website'
}
```

### Validation (POSCheckout)
- `hasCheckoutItems`: ít nhất 1 sản phẩm có `quantity > 0`
- Stock check (RPC `decrement_product_stock`): `stock >= qty` (trừ khi allowSellOutOfStock)

### Processing

**Bước 1 — Tính toán:**
```
totalAmount = Σ(item.salePrice × item.quantity)
finalAmount = totalAmount - discountAmount
```

**Bước 2 — Tạo POSOrder:**
```
orderCode: tự sinh (format: "POS" + timestamp)
isReturn: false
status: 'completed' (kênh direct) / 'pending' (kênh website)
pointsEarned = floor(finalAmount / pointsRate) × (sản phẩm có allow_points)
```

**Bước 3 — Cập nhật tồn kho (RPC):**
```
decrement_product_stock(productId, qty) per item
```

**Bước 4 — Ghi revenue_records:**
```
{
  date: today,
  total_gross_revenue: totalAmount,
  discount: discountAmount,
  net_revenue: finalAmount,
  total_cogs: Σ(item.importPrice × qty),
  gross_profit: net_revenue - total_cogs
}
```

**Bước 5 — Cập nhật khách hàng:**
```
pos_customers:
  points += pointsEarned
  total_spent += finalAmount
  last_visit = today

Nếu ghi nợ (paymentMethod includes 'debt'):
  customer_debt_history { type: 'debt', amount: debtAmount }
  pos_customers.debt_amount += debtAmount
```

**Bước 6 — Gán doanh số nhân viên:**
```
autoUpsertStaffSalesForDate() — tách ra ngoài main try/catch
sales_records { employee_id, date, sales_amount: finalAmount }
```

**Bước 7 — Offline queue:**
```
Nếu mất mạng: posOfflineQueue.ts lưu vào localStorage
Khi có mạng: flush queue → sync lên Supabase
```

### Output
- `pos_orders` (1 record)
- `pos_products.stock` giảm
- `revenue_records` (1 record per ngày, aggregate)
- `pos_customers` cập nhật
- `inventory_transactions` (type='Sale', từ RPC)

### Source files
- `services/posOrderService.ts:processPlaceOrder()`
- `components/pos/POSComputer.tsx:handleCheckout()`

---

## Luồng 2: Trả hàng / Đổi hàng POS

### Trigger
Nhân viên mở màn hình trả hàng, chọn sản phẩm trả

### Input
```
returnCart: [{ product, quantity, lineType: 'return' | 'exchange' }]
originalOrder?: POSOrder (đơn gốc — không bắt buộc)
returnFee: number  // phí trả hàng
returnOtherRefund: number  // hoàn trả thu khác
exchangeItems: POSOrderItem[]  // sản phẩm đổi mới
```

### Processing

**Tính toán:**
```
returnTotal = Σ(item.salePrice × qty, lineType='return')
exchangeTotal = Σ(item.salePrice × qty, lineType='exchange')
refundAmount = returnTotal - exchangeTotal - returnFee + returnOtherRefund
```

**Nếu `refundAmount > 0`:** Hoàn tiền cho khách
**Nếu `refundAmount < 0`:** Khách thanh toán thêm (`customerPaysDifference = |refundAmount|`)

**Ghi POSOrder:**
```
isReturn: true
orderCode: "TH" + timestamp
refundAmount: refundAmount
items: [...returnItems (lineType='return'), ...exchangeItems (lineType='exchange')]
```

**Cập nhật tồn kho:**
```
Sản phẩm trả → stock +qty (increment_product_stock)
Sản phẩm đổi mới → stock -qty (decrement_product_stock)
```

**Cập nhật khách hàng:**
```
total_spent -= amountToPayCustomer
// Lưu ý: KHÔNG tự động giảm debt_amount (phải thanh toán thủ công)
```

**Doanh thu:**
```
revenue_records.returns_value += returnTotal
revenue_records.revenue_other += returnFee  // phí trả hàng vào revenue_other
```

### Source files
- `services/posOrderService.ts:processReturnOrder()`
- `components/pos/usePOSReturnFlow.ts`
- `components/pos/POSComputer.tsx:handleCheckout()` (nhánh return)

---

## Luồng 3: Đặt hàng (Pending Orders)

### Trigger
Trang `orders` — khách đặt hàng nhưng chưa lấy

### Status flow
```
[pending] → (nhân viên xác nhận) → [completed]
[pending] → (huỷ) → [cancelled]
```

### Source
`components/orders/PendingOrdersPage.tsx`, `OrderInvoices.tsx`

---

## Luồng 4: Hóa đơn bán hàng

### Trigger
Trang `order-invoices` — tạo hóa đơn cho đơn POS

### Processing
```typescript
// OrderInvoices.tsx:handleSaveOrder()
// Bọc try/catch từ 2026-06-15 audit

persistOrder(orderId, invoiceData)  // update pos_orders với invoice info
```

**Tạo trả hàng từ hóa đơn:**
```typescript
// OrderInvoices.tsx:handleCreateReturn()
// → tạo POSOrder (isReturn=true) từ đơn gốc
```

### Source
`components/orders/OrderInvoices.tsx`

---

## Luồng 5: Trả hàng đặt (Order Returns)

### Trigger
Trang `order-returns` — khách đã đặt hàng, muốn trả

### Processing
```typescript
// OrderReturns.tsx:handleSaveReturn()
// OrderReturns.tsx:handleCancelReturn()

// Ghi inventory transaction với previousStock/newStock đầy đủ
// Fix 2026-06-15: thêm previousStock và newStock vào audit trail
```

### Source
`components/orders/OrderReturns.tsx`

---

## In hóa đơn

### Desktop
```typescript
// POSComputer.tsx:handlePrint()
// Tạo HTML string → window.print()
// Format:
//   - Items với prefix [TRẢ]/[ĐỔI] cho đơn trả/đổi
//   - Hiển thị "GHI NỢ" khi ghi nợ (không in 2 dòng)
//   - "HOÀN TRẢ KHÁCH" khi refundAmount > 0
//   - "KHÁCH THANH TOÁN" khi customerPaysDifference > 0
```

### Mobile
```typescript
// POSMobileCheckoutSheet.tsx
```

### Receipt Modal (xác nhận trên màn hình)
```typescript
// POSReceiptModal.tsx
// Hiển thị: items với [TRẢ]/[ĐỔI], split payments, returnFee, returnOtherRefund
// Tên cửa hàng đọc từ brandProfile (không hardcode)
```

---

## Offline Queue

```
Khi mất mạng:
  posOfflineQueue.ts → localStorage['pos_offline_queue']
  → Thêm order vào queue

Khi có mạng trở lại:
  syncService.ts:flushQueue()
  → Gửi từng order lên Supabase theo thứ tự
  → Xóa khỏi queue sau khi thành công
```

### Source
`services/posOfflineQueue.ts`, `services/syncService.ts`

---

## Tính tiền thừa / gợi ý tiền mặt

```typescript
// POSComputer.tsx:cashSuggestions
// Gợi ý các mệnh giá tiền cho cashReceived:
// finalAmount, 50k, 100k, 200k, 500k, làm tròn lên

cashChange = cashReceived - finalAmount
```

---

## Split Payment (chia nhiều phương thức)

```typescript
// POSCheckout.tsx
// pos_orders.split_payments: [{ method: 'Cash', amount: X }, { method: 'Bank', amount: Y }]
// Tổng split_payments === finalAmount

// Hiển thị trên hóa đơn:
// POSReceiptModal: hiển thị từng method khi có split_payments
```

---

## Phân loại điểm thưởng

```typescript
// POSCheckout.tsx:hasPointsEligibleProducts
// products.filter(p => p.allowPoints !== false)  // undefined → cho phép
// pointsEarned = floor(finalAmount / pointsRate)
```

---

## Special cases

| Tình huống | Xử lý |
|-----------|-------|
| Bán hàng không có khách | Không ghi customer_debt_history |
| Đơn trả không có đơn gốc | Fast return — không cần orderCode gốc |
| Stock âm khi bán | Cho phép nếu allowSellOutOfStock=true |
| Ghi nợ khi trả hàng | KHÔNG tự giảm debt_amount |
| autoUpsertStaffSales lỗi | Không rollback đơn hàng (tách try/catch riêng) |
