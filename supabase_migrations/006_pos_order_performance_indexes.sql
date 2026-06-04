-- Performance indexes for large POS invoice imports.
-- Supports paginated invoice list, date filters, payment/type filters, and text search.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Keep this migration safe if 005 has not been applied yet.
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS is_return BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pos_orders_date_desc
  ON pos_orders (date DESC);

CREATE INDEX IF NOT EXISTS idx_pos_orders_payment_date
  ON pos_orders (payment_method, date DESC);

CREATE INDEX IF NOT EXISTS idx_pos_orders_is_return_date
  ON pos_orders (is_return, date DESC);

CREATE INDEX IF NOT EXISTS idx_pos_orders_order_code_trgm
  ON pos_orders USING gin (order_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pos_orders_customer_name_trgm
  ON pos_orders USING gin (customer_name gin_trgm_ops)
  WHERE customer_name IS NOT NULL;
