-- =============================================================================
-- 036 — CHECK constraint chặn giá bán/giá vốn sản phẩm âm (audit 2026-07-10, mục H)
-- =============================================================================
-- Bổ sung hàng rào DB-level cho lớp validate backend (routes/data.ts →
-- validateDataPayload). Chỉ áp cho pos_products.sale_price / import_price — 2 trường
-- KHÔNG BAO GIỜ âm hợp lệ.
--
-- CỐ Ý KHÔNG áp cho:
--   - pos_orders.* (đơn TRẢ HÀNG lưu số âm hợp lệ — xem AUDIT-008).
--   - pos_products.stock (allowSellOutOfStock cho phép tồn âm có chủ đích).
--
-- NOT VALID: chỉ kiểm tra INSERT/UPDATE MỚI, KHÔNG quét/khoá dữ liệu cũ (tránh migration
-- fail nếu lịch sử có dòng lỗi). NULL được CHECK bỏ qua (an toàn với cột nullable).
-- Idempotent: DROP IF EXISTS trước khi ADD.
-- =============================================================================

ALTER TABLE pos_products DROP CONSTRAINT IF EXISTS chk_pos_products_nonneg_prices;
ALTER TABLE pos_products
  ADD CONSTRAINT chk_pos_products_nonneg_prices
  CHECK (sale_price >= 0 AND import_price >= 0) NOT VALID;
