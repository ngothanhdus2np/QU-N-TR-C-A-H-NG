ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'direct';
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS channel_name TEXT DEFAULT 'Bán trực tiếp';
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS price_book_id TEXT;
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS price_book_name TEXT;
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS is_return BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON pos_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_channel ON pos_orders(channel);
CREATE INDEX IF NOT EXISTS idx_pos_orders_price_book ON pos_orders(price_book_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_created_by ON pos_orders(created_by);
