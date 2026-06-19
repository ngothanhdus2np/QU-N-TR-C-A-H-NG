# SYSTEM_OVERVIEW — Tổng quan hệ thống CFO Brain 4.0

> Tài liệu tổng kết cuối cùng. Xem chi tiết tại từng file trong `docs/business-knowledge/`.

---

## Thông tin hệ thống

| Mục | Chi tiết |
|-----|---------|
| Tên hệ thống | CFO Brain 4.0 |
| Phiên bản tài liệu | 2026-06-19 |
| Đơn vị vận hành | Cửa hàng giày dép Phúc Sang |
| Stack chính | React + TypeScript (Vite) + Express.js + Supabase self-hosted (PostgreSQL) |
| Hosting | iMac tại quầy, Cloudflare Tunnel (`app.phucsang.com.vn`) |

---

## Tổng số (Totals)

| Chỉ số | Số lượng |
|--------|---------|
| **Nghiệp vụ đã phát hiện** | **12** |
| **Bảng cơ sở dữ liệu** | **~48** |
| **State machines** | **11** |
| **Business rules** | **20+** |
| **Reports** | **9** |
| **Files tài liệu** | **13 (không kể operations)** |
| **Files operations** | **12** |

---

## Danh sách 12 nghiệp vụ

| # | Tên | File | Trạng thái |
|---|-----|------|-----------|
| OP-001 | Bán hàng POS | operations/OP-001-ban-hang-pos.md | ✅ HIGH confidence |
| OP-002 | Trả hàng / Đổi hàng POS | operations/OP-002-tra-hang-pos.md | ✅ HIGH confidence |
| OP-003 | Nhập hàng từ NCC | operations/OP-003-nhap-hang.md | ✅ HIGH confidence |
| OP-004 | Trả hàng nhập | operations/OP-004-tra-hang-nhap.md | ✅ HIGH confidence |
| OP-005 | Kiểm kho | operations/OP-005-kiem-kho.md | ✅ HIGH confidence |
| OP-006 | Tính lương | operations/OP-006-tinh-luong.md | ✅ HIGH confidence |
| OP-007 | Đồng bộ đơn Shopee | operations/OP-007-dong-bo-shopee.md | ✅ HIGH confidence |
| OP-008 | Tạo đơn Website Store | operations/OP-008-tao-don-website.md | ✅ HIGH confidence |
| OP-009 | Thanh toán nợ khách hàng | operations/OP-009-thanh-toan-no-khach-hang.md | ✅ HIGH confidence |
| OP-010 | Thanh toán nợ NCC | operations/OP-010-thanh-toan-no-ncc.md | ✅ HIGH confidence |
| OP-011 | Nhập hàng nhanh | operations/OP-011-nhap-hang-nhanh.md | ✅ HIGH confidence |
| OP-012 | Chốt lương | operations/OP-012-chot-luong.md | ✅ HIGH confidence |

---

## Danh sách 48 bảng (theo domain)

Xem chi tiết tại: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

| Domain | Bảng |
|--------|------|
| Nhân sự & Lương | `employees`, `salary_policies`, `attendance_records`, `overtime_records`, `sales_records`, `shortage_records`, `advance_records`, `payroll_records` |
| Hàng hóa & Kho | `pos_products`, `categories`, `product_groups`, `inventory_transactions`, `product_cost_history` |
| Bán hàng POS | `pos_orders`, `pos_customers`, `customer_debt_history` |
| Mua hàng & NCC | `suppliers`, `supplier_debts`, `invoice_attachments` |
| Tài chính | `revenue_records`, `expense_records`, `expense_categories`, `cashflow_records` |
| VAT | `vat_documents`, `vat_document_items`, `vat_allocations`, `tax_filing_periods` |
| Shopee | `shopee_inventory_out`, `shopee_inventory_in`, `shopee_revenue_records`, `shopee_products`, `shopee_product_variants` |
| Website Store | `store_products`, `store_product_variants`, `store_collections`, `store_product_collections`, `store_order_addresses`, `shipments`, `store_preorder_requests`, `store_contacts` |
| Config/KV | `app_state`, `knowledge_base`, `price_books`, `price_book_items`, `promotions` |
| Audit | `audit_logs` |

---

## 11 State machines

Xem chi tiết tại: [STATE_TRANSITIONS.md](STATE_TRANSITIONS.md)

1. `pos_orders.status` — Trạng thái đơn hàng
2. `inventory_transactions.status` — Trạng thái phiếu kho
3. `vat_documents.status` — Trạng thái hóa đơn VAT
4. `tax_filing_periods.status` — Trạng thái kỳ khai thuế
5. Shopee Order Status (Vietnamese → enum)
6. Employee `status` (active / resigned)
7. `payroll_records` (chưa chốt → đã chốt) — không có trường status, sự tồn tại bản ghi = đã chốt
8. `pos_products.status` (Active / Inactive)
9. `suppliers.status` (active / inactive)
10. Store Order (`pos_orders WHERE channel='website'`)
11. `invoice_attachments` (attachment lifecycle)

---

## 20+ Business Rules (nhóm)

Xem chi tiết tại: [BUSINESS_RULES.md](BUSINESS_RULES.md)

| Nhóm | Rules |
|------|-------|
| Lương & Nhân sự | PAY-001 đến PAY-008 |
| Hàng hóa & Tồn kho | INV-001 đến INV-005 |
| Bán hàng POS | POS-001 đến POS-005 |
| Tài chính & Báo cáo | FIN-001 đến FIN-004 |
| Shopee | SHOP-001 đến SHOP-003 |
| Website Store | WEB-001 đến WEB-002 |

---

## Kết quả xác minh (đã giải quyết hết NEEDS_VERIFICATION)

| # | Vấn đề | Kết quả |
|---|--------|---------|
| NV-001 | Tier upgrade KH | ✅ **Đã giải quyết** — AUDIT-010 thêm `computeNewTier()` vào `posOrderService.ts`. Tier tự động nâng khi tổng chi tiêu vượt ngưỡng. |
| NV-002 | Tần suất check cảnh báo | ✅ **Xác nhận** — `runNotificationScheduler` chạy mỗi 2 phút. Critical alerts gửi mỗi **6 tiếng** (`vnHour % 6 === 0`), cooldown 6h/NCC. EOD report vào **21:00 giờ VN**. Dùng distributed lock (`app_state`) chống gửi trùng. |
| NV-003 | Limit rows có uniform không | ✅ **Xác nhận** — KHÔNG đồng nhất: `DEFAULT_LIMIT=2000` (hầu hết time-series), `DEFAULT_META_LIMIT=5000` (knowledge_base, system_configs, product_groups, promotions), `employees=500`, `pos_orders` bootstrap 90 ngày gần nhất (chỉ load cột cần thiết). |
| NV-004 | `product_cost_history` thiếu dữ liệu OP-011 | ✅ **Đã fix** — thêm `writeCostHistory()` vào `routes/data.ts` cho payload `type='Import'`. Từ nay OP-011 cũng ghi cost history. |
| NV-005 | Xuất kho nội bộ (`internal_use`) | ✅ **Xác nhận** — type=`'internal_use'`, re-validate tồn kho thực tế trước khi ghi. Save: (1) trừ `pos_products.stock -= quantity`, (2) INSERT `inventory_transactions`. Delete: hoàn stock + DELETE transaction. |
| NV-006 | Hủy hàng lỗi/hư (`disposal`) | ✅ **Xác nhận** — type=`'disposal'`, dùng `GoodsAuditForm` (giống kiểm kho). quantity=diff (actualStock - currentStock, âm = giảm). Save: (1) SET `pos_products.stock = actualStock`, (2) INSERT `inventory_transactions` với `previousStock`/`newStock`. Có rollback tự động nếu save lỗi. `totalAmount = sum(|diff| × importPrice)`. |

---

## Kiến trúc tổng quát

```
Website phucsang.com.vn
  ↓ POST /api/store/orders
  
CFO Brain 4.0 (Express.js server.ts)
  ↓ routes/* (auth, data, ai, store, shopee, import...)
  
Supabase self-hosted (Docker trên iMac)
  PostgreSQL @ 192.168.1.3:8000
  PostgREST + GoTrue + Storage

Shopee Bots (Playwright, 2 instances)
  port 3001 = phuc_sang_store
  port 3002 = giaydepphucsang
  → SQLite local DB → push lên Supabase

Claude AI (claude-sonnet-4-6)
  → routes/ai.ts (KHÔNG gọi trực tiếp từ frontend)
  → ANTHROPIC_API_KEY chỉ server-side

Cloudflare Tunnel
  app.phucsang.com.vn    → CFO Brain (port 3000)
  cfobrain.phucsang.com.vn → Supabase (port 8000)
```

---

## File index

| File | Mô tả |
|------|-------|
| [MASTER_FLOW.md](MASTER_FLOW.md) | Sơ đồ luồng toàn hệ thống (text diagram) |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tất cả ~48 bảng, RPC functions |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | 20+ business rules có mã RULE-XXX |
| [STATE_TRANSITIONS.md](STATE_TRANSITIONS.md) | 11 state machines |
| [CODE_MAPPING.md](CODE_MAPPING.md) | Component → Hook → Service → Table |
| [INVENTORY_LOGIC.md](INVENTORY_LOGIC.md) | 7 luồng tồn kho (AVCO, Fixed, Import, Kiểm kho...) |
| [ORDER_LOGIC.md](ORDER_LOGIC.md) | 5 luồng đơn hàng POS (bán, trả, pending, invoice) |
| [PURCHASE_LOGIC.md](PURCHASE_LOGIC.md) | 6 luồng mua hàng & NCC |
| [DEBT_LOGIC.md](DEBT_LOGIC.md) | 3 loại công nợ (KH, NCC, Lương) |
| [REVENUE_PROFIT_LOGIC.md](REVENUE_PROFIT_LOGIC.md) | Doanh thu, COGS, lợi nhuận, KPIs |
| [REPORT_LOGIC.md](REPORT_LOGIC.md) | 9 loại báo cáo và nguồn dữ liệu |
| [EDGE_CASES.md](EDGE_CASES.md) | Edge cases, bugs đã fix, workarounds |
| [operations/](operations/) | 12 nghiệp vụ chi tiết (template đầy đủ) |
| **SYSTEM_OVERVIEW.md** | ← File này |
