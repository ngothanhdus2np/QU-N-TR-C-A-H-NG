# OP-008 — Tạo đơn hàng Website Store

## Mục tiêu
Khách hàng đặt hàng qua website `phucsang.com.vn` → tạo đơn trong hệ thống, trừ tồn kho theo kiểu nguyên tử.

## Kích hoạt
- Khách bấm "Đặt hàng" trên website → gọi `POST /api/store/orders`
- Giao diện website: `checkout.js:createOrder()`

## Dữ liệu đầu vào
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

## Kiểm tra hợp lệ
- `items.length > 0`
- `quantity > 0` mỗi sản phẩm
- Đủ tồn kho: kiểm tra trong PostgreSQL (nguyên tử với RPC)
- Số điện thoại không rỗng

## Xử lý

### Bước 1 — Gọi RPC create_store_order (nguyên tử)
```sql
-- supabase_setup.sql: RPC create_store_order()
-- SECURITY DEFINER + FOR UPDATE (khóa dòng)

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

### Bước 2 — Phản hồi về website
```
{
  success: true,
  orderId: UUID,
  orderCode: 'WEB...'
}
```

### Bước 3 — Webhook hoặc thời gian thực (CẦN XÁC MINH THÊM)
Nhân viên xem đơn trong `WebsiteOrdersPage.tsx`.

## Dữ liệu đầu ra
- `pos_orders` (1 bản ghi, channel='website', status='pending')
- `pos_products.stock` giảm (nguyên tử)
- `store_order_addresses` (1 bản ghi)

## Bảng bị ảnh hưởng
`pos_orders`, `pos_products`, `store_order_addresses`

## Thay đổi trạng thái
```
Luồng trạng thái pos_orders:
  pending → processing → shipping → completed
  pending → cancelled          (trước khi giao đơn vị vận chuyển → cộng tồn ngay)
  shipping/completed → return_requested → returned  (sau khi đã giao)
```

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Hết hàng khi đặt | RPC báo lỗi → toàn bộ giao dịch bị hủy |
| Tranh chấp 2 khách cùng mua | FOR UPDATE khóa từng dòng → xử lý tuần tự |
| Hủy trước khi giao | RPC update_website_order_status: cộng tồn ngay |
| Yêu cầu hoàn hàng sau giao | status = 'return_requested': KHÔNG cộng tồn |
| Xác nhận đã nhận hàng trả | status = 'returned': cộng tồn (RPC) |
| Khách dùng dự phòng ngoại tuyến | checkout.js lưu cục bộ khi API lỗi |

## Luồng xử lý sau khi đặt hàng (phía nhân viên)

```
WebsiteOrdersPage.tsx:
  Xem đơn pending
  → Xác nhận → processing
  → Giao đơn vị vận chuyển → shipping
  → Hoàn thành → completed
  
  HOẶC:
  → Hủy (nếu còn pending/processing) → cancelled + cộng tồn
  → Yêu cầu hoàn hàng (nếu đã giao) → return_requested (chờ)
  → Đã nhận lại hàng → returned + cộng tồn
```

## Liên kết sản phẩm Website ↔ POS
```
store_product_variants.pos_product_id → pos_products.id
store_products.pos_product_id        → pos_products.id (cha)
```

## Quy tắc liên quan
- RULE-WEB-001 (Đơn hàng website store)
- EC-WEB-001 (Lỗi bảng pos_order_items không tồn tại)
- EC-WEB-002 (RPC sai kiểu chữ trạng thái)
- EC-WEB-003 (2 luồng hoàn hàng)

## Code liên quan
- `routes/store.ts` (POST /api/store/orders)
- RPC `create_store_order` (supabase_setup.sql)
- RPC `update_website_order_status` (supabase_setup.sql)
- `components/website/WebsiteOrdersPage.tsx`
- Website: `checkout.js`, `store-api.js`

## Mức độ tin cậy: CAO
