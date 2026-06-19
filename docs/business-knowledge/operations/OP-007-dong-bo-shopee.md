# OP-007 — Đồng bộ đơn Shopee từ Bot

## Mục tiêu
Lấy dữ liệu đơn hàng từ 2 Shopee bot (Playwright), thêm vào `shopee_inventory_out`, cập nhật trạng thái đơn đã có.

## Kích hoạt
- Nhân viên bấm nút "Đồng bộ Bot" trong trang Xuất kho (InventoryOutTab)
- API: `POST /api/inventory-out/sync-from-bot`

## Dữ liệu đầu vào
Không có dữ liệu từ người dùng — hệ thống tự gọi 2 bot:
```
Bot 1: http://localhost:3001/api/orders (port 3001 = phuc_sang_store)
Bot 2: http://localhost:3002/api/orders (port 3002 = giaydepphucsang)
```

## Xử lý

### Bước 1 — Tải đơn từ bot (có phân trang)
```typescript
// routes/inventoryOutSync.ts
// Lặp qua offset cho đến khi bot trả về ít hơn pageSize
while (true) {
  const res = await fetch(`${botUrl}/api/orders?limit=200&offset=${offset}`)
  orders.push(...res.data)
  if (res.data.length < 200) break
  offset += 200
}
```

### Bước 2 — Loại trùng giữa 2 bot
```
allOrders = [...bot1Orders, ...bot2Orders]
deduped = Map<order_id, order>
          (bot2 ghi đè bot1 nếu trùng order_id)
```

### Bước 3 — Phân loại: đơn mới vs đơn đã có
```
existingOrderIds = SELECT DISTINCT order_id FROM shopee_inventory_out

newOrders = deduped.filter(o => !existingOrderIds.has(o.order_id))
updatedOrders = deduped.filter(o => existingOrderIds.has(o.order_id))
```

### Bước 4 — Thêm đơn mới
```
INSERT shopee_inventory_out (hàng loạt) {
  order_id, sku, quantity, revenue, date, shop,
  customer_paid, tracking_number, ship_date, product_name,
  piship_fee, vat_tax, profit_status
}
// UNIQUE(order_id, sku) → bỏ qua bản ghi trùng
```

### Bước 5 — Cập nhật trạng thái đơn đã có
```
FOR each existing order with changed status:
  UPDATE shopee_inventory_out SET status = newStatus
  WHERE order_id = X AND sku = Y
  // Chỉ cập nhật trạng thái, GIỮ NGUYÊN giá vốn và dữ liệu nhập tay
```

### Bước 6 — Tải lại giao diện
```
Sau khi đồng bộ thành công:
  tải lại shopeeInventoryOut từ Supabase
  updateData() để cập nhật giao diện
```

## Dữ liệu đầu ra
- `shopee_inventory_out` (bản ghi mới + trạng thái cập nhật)
- Thông báo: "Đã thêm X đơn mới, cập nhật Y đơn, bỏ qua Z đơn đã có"
- Phản hồi: `{ inserted, updated, skipped, botErrors }`

## Bảng bị ảnh hưởng
`shopee_inventory_out`

## Thay đổi trạng thái
- `shopee_inventory_out.status` có thể thay đổi nếu bot cập nhật

## Trường hợp đặc biệt
| Tình huống | Xử lý |
|-----------|-------|
| Bot không chạy (ECONNREFUSED) | Trả lỗi rõ ràng, tiếp tục với bot còn lại |
| Đơn trùng giữa 2 bot (xung đột UNIQUE) | UNIQUE(order_id, sku) → bỏ qua |
| Trạng thái đơn thay đổi | 2 bước tách: thêm mới + cập nhật cũ |
| Giá vốn nhập tay | Cập nhật chỉ đổi trạng thái, không ghi đè giá vốn |
| Bot tab "Đang giao" lỗi | Sửa: waitForLoadState('networkidle') thay vì timeout |

## Kiến trúc bot

```
shopee-monitor/
├── bots/
│   ├── orders.js   ← Tải và phân tích đơn hàng, tự làm mới
│   ├── products.js ← Quét danh sách sản phẩm từ Shopee Seller Center
│   └── productSync.js ← Đồng bộ 1 sản phẩm theo shopee_item_id
├── src/
│   ├── apiServer.js ← Máy chủ Express nội bộ (port 3001/3002)
│   ├── db.js        ← Lược đồ SQLite (orders, bảng đơn hàng cục bộ)
│   └── supabase.js  ← Supabase client (service role)
└── monitor.js       ← Điều phối, mở trình duyệt, gọi setupXxxBot()
```

**2 phiên bản:** ecosystem.config.js chạy 2 tiến trình riêng biệt:
```
tiến trình 1: port 3001, SHOP_NAME='phuc_sang_store'
tiến trình 2: port 3002, SHOP_NAME='giaydepphucsang'
```

## Code liên quan
- `routes/inventoryOutSync.ts`
- `components/revenue/InventoryOutTab.tsx`
- `/Users/apple/shopee-monitor/bots/orders.js`
- `/Users/apple/shopee-monitor/src/apiServer.js`

## Tài liệu liên quan
- EC-SHOPEE-001 (Bot DB bị đảo nhãn)
- EC-SHOPEE-002 (Bot không click tab "Đang giao")
- EC-SHOPEE-003 (Phiên đăng nhập hết hạn)

## Mức độ tin cậy: CAO
