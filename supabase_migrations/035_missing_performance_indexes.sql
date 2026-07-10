-- =============================================================================
-- 035 — Index còn thiếu cho cột hay filter/lookup (audit 2026-07-10, mục L)
-- =============================================================================
-- Audit phát hiện thiếu index trên cột dùng để join/filter thường xuyên:
--   - pos_products.sku       : lookup theo SKU khi import / nối sản phẩm Shopee.
--   - shopee_inventory_out   : job phân bổ ads (routes/adsSpendSync.ts) filter
--                              .eq('platform', ...) + gom theo date mỗi ~30 phút.
--
-- GHI CHÚ: pos_orders(date) ĐÃ có index (idx_pos_orders_date_desc, migration 006)
-- nên KHÔNG thêm lại ở đây — audit ban đầu bỏ sót vì chỉ quét supabase_setup.sql.
--
-- CONCURRENTLY: không dùng vì apply-migrations chạy trong --single-transaction
-- (CREATE INDEX CONCURRENTLY không chạy được trong transaction). Bảng hiện ~70k
-- dòng nên lock ngắn, chấp nhận được khi deploy ngoài giờ cao điểm.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pos_products_sku
  ON pos_products (sku);

CREATE INDEX IF NOT EXISTS idx_shopee_inventory_out_date_platform
  ON shopee_inventory_out (date, platform);
