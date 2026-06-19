# OP-007 — Đồng bộ đơn Shopee từ Bot

## Mục tiêu
Lấy dữ liệu đơn hàng từ 2 Shopee bot (Playwright), insert vào `shopee_inventory_out`, cập nhật status đơn đã có.

## Trigger
- Nhân viên bấm nút "Đồng bộ Bot" trong trang Xuất kho (InventoryOutTab)
- API: `POST /api/inventory-out/sync-from-bot`

## Input
Không có input từ user — hệ thống tự gọi 2 bot:
```
Bot 1: http://localhost:3001/api/orders (port 3001 = phuc_sang_store)
Bot 2: http://localhost:3002/api/orders (port 3002 = giaydepphucsang)
```

## Processing

### Bước 1 — Fetch đơn từ bot (có phân trang)
```typescript
// routes/inventoryOutSync.ts
// Loop qua offset cho đến khi bot trả về ít hơn pageSize
while (true) {
  const res = await fetch(`${botUrl}/api/orders?limit=200&offset=${offset}`)
  orders.push(...res.data)
  if (res.data.length < 200) break
  offset += 200
}
```

### Bước 2 — Dedup giữa 2 bot
```
allOrders = [...bot1Orders, ...bot2Orders]
deduped = Map<order_id, order>
          (bot2 overrides bot1 nếu trùng order_id)
```

### Bước 3 — Phân loại: đơn mới vs đơn đã có
```
existingOrderIds = SELECT DISTINCT order_id FROM shopee_inventory_out

newOrders = deduped.filter(o => !existingOrderIds.has(o.order_id))
updatedOrders = deduped.filter(o => existingOrderIds.has(o.order_id))
```

### Bước 4 — INSERT đơn mới
```
INSERT shopee_inventory_out (batch) {
  order_id, sku, quantity, revenue, date, shop,
  customer_paid, tracking_number, ship_date, product_name,
  piship_fee, vat_tax, profit_status
}
// UNIQUE(order_id, sku) → skip duplicate
```

### Bước 5 — UPDATE status đơn đã có
```
FOR each existing order with changed status:
  UPDATE shopee_inventory_out SET status = newStatus
  WHERE order_id = X AND sku = Y
  // Chỉ update status, GIỮ NGUYÊN giá vốn và dữ liệu nhập tay
```

### Bước 6 — Reload UI
```
Sau khi sync thành công:
  reload shopeeInventoryOut từ Supabase
  updateData() để cập nhật UI
```

## Output
- `shopee_inventory_out` (records mới + status cập nhật)
- Toast: "Đã thêm X đơn mới, cập nhật Y đơn, bỏ qua Z đơn đã có"
- Response: `{ inserted, updated, skipped, botErrors }`

## Tables affected
`shopee_inventory_out`

## State changes
- `shopee_inventory_out.status` có thể thay đổi nếu bot cập nhật

## Special cases
| Tình huống | Xử lý |
|-----------|-------|
| Bot không chạy (ECONNREFUSED) | Trả lỗi rõ ràng, tiếp tục với bot còn lại |
| Đơn trùng giữa 2 bot (UNIQUE conflict) | UNIQUE(order_id, sku) → skip |
| Status đơn thay đổi | 2 bước tách: INSERT mới + UPDATE cũ |
| Giá vốn nhập tay | UPDATE chỉ đổi status, không overwrite giá vốn |
| Bot SPA tab "Đang giao" lỗi | Fix: waitForLoadState('networkidle') thay vì timeout |

## Kiến trúc bot

```
shopee-monitor/
├── bots/
│   ├── orders.js   ← Fetch + parse đơn hàng, auto-refresh
│   ├── products.js ← Scan danh sách SP từ Shopee Seller Center
│   └── productSync.js ← Sync 1 sản phẩm theo shopee_item_id
├── src/
│   ├── apiServer.js ← Express server local (port 3001/3002)
│   ├── db.js        ← SQLite schema (orders, bảng đơn hàng local)
│   └── supabase.js  ← Supabase client (service role)
└── monitor.js       ← Orchestrator, mở browser, gọi setupXxxBot()
```

**2 instance:** ecosystem.config.js chạy 2 process riêng biệt:
```
process 1: port 3001, SHOP_NAME='phuc_sang_store'
process 2: port 3002, SHOP_NAME='giaydepphucsang'
```

## Related code
- `routes/inventoryOutSync.ts`
- `components/revenue/InventoryOutTab.tsx`
- `/Users/apple/shopee-monitor/bots/orders.js`
- `/Users/apple/shopee-monitor/src/apiServer.js`

## Related docs
- EC-SHOPEE-001 (Bot DB bị đảo nhãn)
- EC-SHOPEE-002 (Bot không click tab "Đang giao")
- EC-SHOPEE-003 (Session expired)

## Confidence level: HIGH
