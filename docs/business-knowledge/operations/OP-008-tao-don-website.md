# OP-008 — Tạo đơn hàng Website Store

## Mục tiêu
Khách hàng đặt hàng qua website `phucsang.com.vn` → tạo đơn trong hệ thống, trừ tồn kho atomic.

## Trigger
- Khách bấm "Đặt hàng" trên website → gọi `POST /api/store/orders`
- Frontend website: `checkout.js:createOrder()`

## Input
```typescript
// Từ website checkout.js
{
  items: [{
    posProductId: UUID,  // ID từ store_product_variants.pos_product_id
    sku: string,
    quantity: number,
    price: number        // giá bán
  }]
  customerInfo: {
    name, phone, address, city, district, ward
  }
  paymentMethod: 'COD' | 'bank_transfer'
  note?: string
}
```

## Validation
- `items.length > 0`
- `quantity > 0` per item
- Đủ tồn kho: kiểm tra trong PostgreSQL (atomic với RPC)
- Phone không rỗng

## Processing

### Bước 1 — Gọi RPC create_store_order (atomic)
```sql
-- supabase_setup.sql: RPC create_store_order()
-- SECURITY DEFINER + FOR UPDATE (row-level lock)

BEGIN TRANSACTION;
  FOR each item:
    SELECT stock FROM pos_products WHERE id = posProductId FOR UPDATE
    IF stock < quantity THEN RAISE EXCEPTION 'Out of stock: sku'
    UPDATE pos_products SET stock -= quantity
  
  INSERT pos_orders {
    channel: 'website',
    status: 'pending',
    orderCode: 'WEB' + timestamp,
    items: [...],
    totalAmount: Σ(price × qty),
    finalAmount: totalAmount,
    paymentMethod
  }
  
  INSERT store_order_addresses {
    order_id,
    name, phone, address, city, district, ward
  }
  
COMMIT;
```

### Bước 2 — Response về website
```
{
  success: true,
  orderId: UUID,
  orderCode: 'WEB...'
}
```

### Bước 3 — Webhook hoặc realtime (NEEDS_VERIFICATION)
Nhân viên xem đơn trong `WebsiteOrdersPage.tsx`.

## Output
- `pos_orders` (1 record, channel='website', status='pending')
- `pos_products.stock` giảm (atomic)
- `store_order_addresses` (1 record)

## Tables affected
`pos_orders`, `pos_products`, `store_order_addresses`

## State changes
```
pos_orders.status workflow:
  pending → processing → shipping → completed
  pending → cancelled          (trước khi giao ĐVVC → cộng tồn ngay)
  shipping/completed → return_requested → returned  (sau khi đã giao)
```

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Hết hàng khi đặt | RPC raise exception → transaction rollback toàn bộ |
| Race condition 2 khách cùng mua | FOR UPDATE lock per row → serialized |
| Huỷ trước khi giao | update_website_order_status RPC: cộng tồn ngay |
| Yêu cầu hoàn hàng sau giao | status = 'return_requested': KHÔNG cộng tồn |
| Xác nhận đã nhận hàng trả | status = 'returned': cộng tồn (RPC) |
| Khách dùng fallback offline | checkout.js lưu local khi API lỗi |

## Luồng xử lý sau khi đặt hàng (phía nhân viên)

```
WebsiteOrdersPage.tsx:
  Xem đơn pending
  → Xác nhận → processing
  → Giao ĐVVC → shipping
  → Hoàn thành → completed
  
  HOẶC:
  → Huỷ (nếu còn pending/processing) → cancelled + cộng tồn
  → Yêu cầu hoàn hàng (nếu đã giao) → return_requested (chờ)
  → Đã nhận lại hàng → returned + cộng tồn
```

## Liên kết sản phẩm Website ↔ POS
```
store_product_variants.pos_product_id → pos_products.id
store_products.pos_product_id        → pos_products.id (cha)
```

## Related rules
- RULE-WEB-001 (Website store orders)
- EC-WEB-001 (Lỗi bảng pos_order_items không tồn tại)
- EC-WEB-002 (RPC case-mismatch status)
- EC-WEB-003 (2 luồng hoàn hàng)

## Related code
- `routes/store.ts` (POST /api/store/orders)
- RPC `create_store_order` (supabase_setup.sql)
- RPC `update_website_order_status` (supabase_setup.sql)
- `components/website/WebsiteOrdersPage.tsx`
- Website: `checkout.js`, `store-api.js`

## Confidence level: HIGH
