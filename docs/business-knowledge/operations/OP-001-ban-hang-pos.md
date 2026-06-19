# OP-001 — Bán hàng POS (trực tiếp tại quầy)

## Mục tiêu
Ghi nhận giao dịch bán lẻ tại quầy, trừ tồn kho, cập nhật doanh thu, tích điểm khách hàng, ghi doanh số nhân viên.

## Trigger
- Nhân viên bấm nút "THANH TOÁN" trên máy tính tiền (`POSComputer.tsx`)
- Hoặc: khách hàng thanh toán trên website (channel='website')

## Input
```typescript
{
  items: [{
    productId, sku, name,
    quantity, salePrice, importPrice,
    discount, lineType: 'normal'
  }]
  customer?: POSCustomer
  paymentMethod: 'Cash' | 'Bank' | 'Momo' | 'Card' | 'Other'
  splitPayments?: [{ method, amount }]
  cashReceived: number
  staffId: string
  discountAmount: number
  priceBookId?: string
  channel: 'direct' | 'website'
}
```

## Validation
- Ít nhất 1 sản phẩm có `quantity > 0`
- `stock >= qty` (trừ khi `allowSellOutOfStock = true`)
- `finalAmount >= 0`

## Processing

### Bước 1 — Tính toán
```
totalAmount = Σ(item.salePrice × item.quantity)
finalAmount = totalAmount - discountAmount
pointsEarned = floor(finalAmount / pointsRate) × (sản phẩm có allowPoints)
```

### Bước 2 — Tạo POSOrder
```
INSERT pos_orders {
  orderCode: 'POS' + timestamp,
  isReturn: false,
  status: 'completed',
  channel, staffId, customerId,
  totalAmount, discount: discountAmount, finalAmount,
  paymentMethod, splitPayments, cashReceived,
  items: [...], pointsEarned
}
```

### Bước 3 — Cập nhật tồn kho (atomic RPC)
```
FOR each item:
  RPC decrement_product_stock(productId, qty)
  → cũng INSERT inventory_transactions(type='Sale')
```

### Bước 4 — Ghi doanh thu
```
UPSERT revenue_records (date=today) {
  total_gross_revenue += totalAmount,
  discount += discountAmount,
  net_revenue += finalAmount,
  total_cogs += Σ(item.importPrice × qty),
  gross_profit += finalAmount - Σcogs
}
```

### Bước 5 — Cập nhật khách hàng
```
UPDATE pos_customers {
  points += pointsEarned,
  total_spent += finalAmount,
  last_visit = today
}
```

### Bước 6 — Ghi nợ (nếu có)
```
IF paymentMethod includes 'debt':
  INSERT customer_debt_history { type: 'debt', amount: debtAmount }
  UPDATE pos_customers SET debt_amount += debtAmount
```

### Bước 7 — Gán doanh số nhân viên (tách try/catch)
```
autoUpsertStaffSalesForDate()
→ UPSERT sales_records { employee_id, date, sales_amount += finalAmount }
```

### Bước 8 — Offline queue (nếu mất mạng)
```
posOfflineQueue.ts → localStorage['pos_offline_queue']
→ Flush khi có mạng trở lại
```

## Output
- `pos_orders` (1 record mới)
- `pos_products.stock` giảm
- `revenue_records` (upsert per ngày)
- `pos_customers` cập nhật (nếu có khách)
- `customer_debt_history` (nếu ghi nợ)
- `sales_records` (cập nhật doanh số nhân viên)
- `inventory_transactions` (type='Sale', từ RPC)

## Tables affected
`pos_orders`, `pos_products`, `revenue_records`, `pos_customers`, `customer_debt_history`, `sales_records`, `inventory_transactions`

## State changes
- `pos_orders.status` = 'completed' ngay khi tạo (không qua pending)
- `pos_products.stock` giảm đi `qty`

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Bán hàng offline | localStorage queue → sync sau |
| Split payment | `pos_orders.split_payments` array JSON |
| Không có khách | Không ghi customer_debt_history |
| allowSellOutOfStock | Bỏ qua validation stock |
| autoUpsertStaffSales lỗi | Không rollback đơn hàng |

## Related rules
- RULE-POS-001 (Bán hàng POS)
- RULE-FIN-001 (Cập nhật revenue_records)
- RULE-INV-001 (AVCO COGS)

## Related code
- `services/posOrderService.ts:processPlaceOrder()`
- `components/pos/POSComputer.tsx:handleCheckout()`
- `hooks/usePOSState.ts`
- RPC `decrement_product_stock`

## Confidence level: HIGH
