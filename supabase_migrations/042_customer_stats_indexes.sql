-- 2026-08-21: Index customer_id cho pos_orders — phục vụ route GET /api/data/customer-stats
-- (tổng hợp sold/returned/debt/last-transaction theo khách hàng ở server thay vì kéo hết
-- pos_orders về client tính, xem routes/data.ts). Không có index này, mỗi lần mở trang
-- Khách hàng phải seq scan toàn bộ pos_orders.
-- Lưu ý: KHÔNG thêm index cho customer_debt_history ở đây — role migration (postgres) không
-- phải owner của bảng đó trên DB staging ("must be owner of table customer_debt_history"),
-- bảng này vốn đã bị chặn ghi qua role thường (RLS "TO authenticated" only) nên chủ động tách
-- quyền, không thử ALTER OWNER. Bảng này cũng nhỏ (route customer-debt-history cũ giới hạn
-- .limit(5000)) nên thiếu index ở đây không phải nút thắt hiệu năng.
CREATE INDEX IF NOT EXISTS idx_pos_orders_customer_id ON pos_orders(customer_id);
