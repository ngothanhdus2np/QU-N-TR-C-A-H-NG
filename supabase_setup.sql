-- SQL script to create missing Shopee tables in Supabase

-- 1. Shopee Revenue Records
CREATE TABLE IF NOT EXISTS shopee_revenue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  total_gross_revenue NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  revenue_other NUMERIC DEFAULT 0,
  returns_value NUMERIC DEFAULT 0,
  net_revenue NUMERIC DEFAULT 0,
  total_cogs NUMERIC DEFAULT 0,
  gross_profit NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Product Group Revenue (offline / non-Shopee)
CREATE TABLE IF NOT EXISTS product_group_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  group_id UUID,
  group_name TEXT,
  amount NUMERIC DEFAULT 0,
  quantity NUMERIC DEFAULT 0,
  returns_quantity NUMERIC DEFAULT 0,
  returns_value NUMERIC DEFAULT 0,
  net_revenue NUMERIC DEFAULT 0,
  cogs NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Shopee Product Group Revenue
CREATE TABLE IF NOT EXISTS shopee_product_group_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  group_id UUID,
  group_name TEXT,
  amount NUMERIC DEFAULT 0,
  quantity NUMERIC DEFAULT 0,
  returns_quantity NUMERIC DEFAULT 0,
  returns_value NUMERIC DEFAULT 0,
  net_revenue NUMERIC DEFAULT 0,
  cogs NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Shopee Source Data
CREATE TABLE IF NOT EXISTS shopee_source_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  name TEXT,
  import_price NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Shopee Inventory In
CREATE TABLE IF NOT EXISTS shopee_inventory_in (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  sku TEXT,
  quantity NUMERIC DEFAULT 0,
  import_price NUMERIC DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Shopee Inventory Out
CREATE TABLE IF NOT EXISTS shopee_inventory_out (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  status TEXT,
  order_id TEXT,
  sku TEXT,
  quantity NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  platform_fee NUMERIC DEFAULT 0,
  payment_fee NUMERIC DEFAULT 0,
  freeship_extra NUMERIC DEFAULT 0,
  affiliate_fee NUMERIC DEFAULT 0,
  handling_fee NUMERIC DEFAULT 0,
  ads_cost NUMERIC DEFAULT 0,
  ads_tax NUMERIC DEFAULT 0,
  personal_income_tax NUMERIC DEFAULT 0,
  net_profit NUMERIC DEFAULT 0,
  address TEXT,
  shipping_unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. POS Products
CREATE TABLE IF NOT EXISTS pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  name TEXT,
  category_id TEXT,
  category_path TEXT,
  import_price NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  expected_out_of_stock TEXT,
  min_stock NUMERIC DEFAULT 0,
  max_stock NUMERIC DEFAULT 999999,
  unit TEXT,
  base_unit_code TEXT,
  conversion_value NUMERIC DEFAULT 1,
  brand TEXT,
  barcode TEXT,
  attributes_text TEXT,
  description TEXT,
  note_template TEXT,
  components TEXT,
  warranty TEXT,
  periodic_maintenance TEXT,
  allow_points BOOLEAN DEFAULT true,
  weight NUMERIC DEFAULT 0,
  weight_unit TEXT,
  location TEXT,
  images JSONB DEFAULT '[]',
  status TEXT DEFAULT 'Active',
  units JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure allow_points column exists if table was already created
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pos_products' AND column_name='allow_points') THEN
    ALTER TABLE pos_products ADD COLUMN allow_points BOOLEAN DEFAULT true;
  END IF;
END $$;

COMMENT ON TABLE pos_products IS 'POS Products Table - Last updated for schema sync';

-- 7. POS Orders
CREATE TABLE IF NOT EXISTS pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT UNIQUE,
  date TEXT NOT NULL,
  customer_id UUID,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  final_amount NUMERIC DEFAULT 0,
  payment_method TEXT,
  staff_id TEXT,
  notes TEXT,
  points_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. POS Customers
CREATE TABLE IF NOT EXISTS pos_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  points NUMERIC DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_visit TEXT,
  tier TEXT DEFAULT 'Standard',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Import', 'Export', 'Check', 'Sale', 'Return'
  items JSONB NOT NULL DEFAULT '[]',
  note TEXT,
  reference_id TEXT,
  staff_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Optional but recommended)
-- ALTER TABLE shopee_revenue_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shopee_product_group_revenue ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shopee_source_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shopee_inventory_in ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shopee_inventory_out ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow all for simplicity in dev, adjust for production)
-- CREATE POLICY "Allow all" ON shopee_revenue_records FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON shopee_product_group_revenue FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON shopee_source_data FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON shopee_inventory_in FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON shopee_inventory_out FOR ALL USING (true);


-- Audit Logs (thêm vào Supabase để bật tính năng audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'upsert' | 'delete' | 'clearTable'
  snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Thêm cột cho pos_products (chạy nếu chưa có)
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS category_path TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS warranty TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS allow_points BOOLEAN DEFAULT true;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS weight_unit TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS max_stock NUMERIC DEFAULT 999999;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS units JSONB DEFAULT '[]';
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '[]';
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS related_sku TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS expected_out_of_stock TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS base_unit_code TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS conversion_value NUMERIC DEFAULT 1;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS attributes_text TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS note_template TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS components TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS periodic_maintenance TEXT;
ALTER TABLE pos_customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS name TEXT;

-- KiotViet extended fields (2026-05-10)
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS customer_orders INTEGER DEFAULT 0;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS direct_sale BOOLEAN DEFAULT true;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'Hàng hóa';

-- Knowledge Base original files (2026-05-12)
-- Chạy block này trước khi upload tài liệu gốc từ KnowledgeManager.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-files',
  'knowledge-files',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'knowledge-files public read'
  ) THEN
    CREATE POLICY "knowledge-files public read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'knowledge-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'knowledge-files anon upload'
  ) THEN
    CREATE POLICY "knowledge-files anon upload"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'knowledge-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'knowledge-files anon update'
  ) THEN
    CREATE POLICY "knowledge-files anon update"
    ON storage.objects FOR UPDATE
    TO anon
    USING (bucket_id = 'knowledge-files')
    WITH CHECK (bucket_id = 'knowledge-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'knowledge-files anon delete'
  ) THEN
    CREATE POLICY "knowledge-files anon delete"
    ON storage.objects FOR DELETE
    TO anon
    USING (bucket_id = 'knowledge-files');
  END IF;
END $$;

ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_file_name TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_file_path TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_file_url TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_file_type TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_file_size BIGINT;

-- POS products sync/import permissions.
-- The current app uses the Supabase anon client, so RLS needs explicit policies.
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_products TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pos_products'
      AND policyname = 'pos_products_allow_read'
  ) THEN
    CREATE POLICY "pos_products_allow_read"
      ON pos_products FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pos_products'
      AND policyname = 'pos_products_allow_insert'
  ) THEN
    CREATE POLICY "pos_products_allow_insert"
      ON pos_products FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pos_products'
      AND policyname = 'pos_products_allow_update'
  ) THEN
    CREATE POLICY "pos_products_allow_update"
      ON pos_products FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pos_products'
      AND policyname = 'pos_products_allow_delete'
  ) THEN
    CREATE POLICY "pos_products_allow_delete"
      ON pos_products FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================
-- Migration 2026-05-11: Chuẩn bị multi-branch / multi-tenant
-- Chạy thủ công trên Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Thêm branch_id cho các bảng nghiệp vụ chính
--    DEFAULT 'main' → tương thích ngược với dữ liệu cũ
ALTER TABLE pos_products        ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE pos_customers       ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE revenue_records     ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE expense_records     ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE payroll_records     ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE employees           ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE supplier_debts      ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';

-- 2. Thêm tenant_id khi chuẩn bị SaaS (mặc định 'phuc-sang')
ALTER TABLE pos_products        ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'phuc-sang';
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'phuc-sang';
ALTER TABLE revenue_records     ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'phuc-sang';
ALTER TABLE expense_records     ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'phuc-sang';

-- 3. Index cho branch_id để query multi-branch hiệu quả
CREATE INDEX IF NOT EXISTS idx_pos_products_branch        ON pos_products(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_branch          ON pos_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_branch     ON revenue_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_expense_records_branch     ON expense_records(branch_id);

-- 4. Bảng lưu FB token và Zalo token với expiry tracking
--    (app_state đã có sẵn, chỉ cần ghi chú các user_id đã dùng)
--    'phuc-sang-fb-token'   → { token, expiresAt } — TTL 90 ngày
--    'phuc-sang-zalo-token' → { token, expiresAt } — TTL 90 ngày
--    Khi expiresAt - NOW() < 7 ngày → server log cảnh báo

-- =============================================================================
-- ATOMIC STOCK OPERATIONS (chạy thủ công trên Supabase SQL Editor)
-- Giải quyết race condition: 2 POS bán cùng sản phẩm đồng thời
-- không thể dẫn đến tồn kho âm.
-- =============================================================================

-- Decrement stock — chỉ trừ nếu còn đủ hàng (trả về row nếu thành công, empty nếu hết hàng)
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id UUID,
  p_quantity    INT
) RETURNS TABLE(id UUID, stock INT) AS $$
BEGIN
  RETURN QUERY
  UPDATE pos_products
  SET stock = pos_products.stock - p_quantity
  WHERE pos_products.id = p_product_id
    AND pos_products.stock >= p_quantity
  RETURNING pos_products.id, pos_products.stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment stock — dùng cho trả hàng / nhập kho
CREATE OR REPLACE FUNCTION increment_product_stock(
  p_product_id UUID,
  p_quantity    INT
) RETURNS TABLE(id UUID, stock INT) AS $$
BEGIN
  RETURN QUERY
  UPDATE pos_products
  SET stock = pos_products.stock + p_quantity
  WHERE pos_products.id = p_product_id
  RETURNING pos_products.id, pos_products.stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute cho anon/authenticated roles (điều chỉnh theo cấu hình RLS của bạn)
GRANT EXECUTE ON FUNCTION decrement_product_stock(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_product_stock(UUID, INT) TO anon, authenticated;

-- =============================================================================
-- INVENTORY TRANSACTIONS LEGACY COLUMN CLEANUP (2026-05-12)
-- Code hiện dùng JSONB `items` + `date/reference_id/staff_id`.
-- Các cột snapshot cũ bên dưới không còn được đọc/ghi bởi app.
-- =============================================================================
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS product_id;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS quantity;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS previous_stock;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS new_stock;

-- =============================================================================
-- SUPPLIERS / INVENTORY TRANSACTION LIST MODULE FIELDS (2026-05-12)
-- Các trang Nhà cung cấp / Nhập hàng / Kiểm kho cần metadata này để filter,
-- sort và reload cloud không mất trạng thái/tổng tiền/thống kê.
-- =============================================================================
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_group TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS supplier_id TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS balanced_date TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS total_actual_qty NUMERIC;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS total_diff NUMERIC;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS increase_count NUMERIC;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS decrease_count NUMERIC;

CREATE OR REPLACE FUNCTION apply_inventory_transaction_with_stock(
  p_transaction JSONB
) RETURNS TABLE(transaction_id UUID, date TEXT, type TEXT) AS $$
DECLARE
  item JSONB;
  tx_id UUID := (p_transaction->>'id')::UUID;
  tx_type TEXT := p_transaction->>'type';
BEGIN
  INSERT INTO inventory_transactions (
    id,
    date,
    type,
    items,
    note,
    reference_id,
    staff_id,
    supplier_id,
    supplier_name,
    total_amount,
    status,
    balanced_date,
    total_actual_qty,
    total_diff,
    increase_count,
    decrease_count
  )
  VALUES (
    tx_id,
    p_transaction->>'date',
    tx_type,
    COALESCE(p_transaction->'items', '[]'::JSONB),
    p_transaction->>'note',
    p_transaction->>'reference_id',
    p_transaction->>'staff_id',
    p_transaction->>'supplier_id',
    p_transaction->>'supplier_name',
    COALESCE((p_transaction->>'total_amount')::NUMERIC, 0),
    p_transaction->>'status',
    p_transaction->>'balanced_date',
    NULLIF(p_transaction->>'total_actual_qty', '')::NUMERIC,
    NULLIF(p_transaction->>'total_diff', '')::NUMERIC,
    NULLIF(p_transaction->>'increase_count', '')::NUMERIC,
    NULLIF(p_transaction->>'decrease_count', '')::NUMERIC
  )
  ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    type = EXCLUDED.type,
    items = EXCLUDED.items,
    note = EXCLUDED.note,
    reference_id = EXCLUDED.reference_id,
    staff_id = EXCLUDED.staff_id,
    supplier_id = EXCLUDED.supplier_id,
    supplier_name = EXCLUDED.supplier_name,
    total_amount = EXCLUDED.total_amount,
    status = EXCLUDED.status,
    balanced_date = EXCLUDED.balanced_date,
    total_actual_qty = EXCLUDED.total_actual_qty,
    total_diff = EXCLUDED.total_diff,
    increase_count = EXCLUDED.increase_count,
    decrease_count = EXCLUDED.decrease_count;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_transaction->'items', '[]'::JSONB))
  LOOP
    IF tx_type = 'Import' THEN
      UPDATE pos_products
      SET stock = pos_products.stock + COALESCE((item->>'quantity')::INT, 0)
      WHERE pos_products.id = (item->>'productId')::UUID;
    ELSIF tx_type = 'Sale' THEN
      UPDATE pos_products
      SET stock = GREATEST(0, pos_products.stock - ABS(COALESCE((item->>'quantity')::INT, 0)))
      WHERE pos_products.id = (item->>'productId')::UUID
        AND pos_products.stock >= ABS(COALESCE((item->>'quantity')::INT, 0));
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock for product %', item->>'productId';
      END IF;
    ELSIF tx_type = 'Return' THEN
      UPDATE pos_products
      SET stock = pos_products.stock + ABS(COALESCE((item->>'quantity')::INT, 0))
      WHERE pos_products.id = (item->>'productId')::UUID;
    ELSIF tx_type = 'Check' THEN
      UPDATE pos_products
      SET stock = COALESCE((item->>'newStock')::INT, pos_products.stock)
      WHERE pos_products.id = (item->>'productId')::UUID;
    END IF;
  END LOOP;

  RETURN QUERY SELECT tx_id, p_transaction->>'date', tx_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_inventory_transaction_with_stock(
  p_transaction_id UUID
) RETURNS TABLE(id UUID) AS $$
DECLARE
  tx inventory_transactions%ROWTYPE;
  item JSONB;
BEGIN
  SELECT * INTO tx FROM inventory_transactions WHERE inventory_transactions.id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF COALESCE(tx.status, '') <> 'cancelled' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(tx.items, '[]'::JSONB))
    LOOP
      IF tx.type = 'Import' THEN
        UPDATE pos_products
        SET stock = GREATEST(0, pos_products.stock - COALESCE((item->>'quantity')::INT, 0))
        WHERE pos_products.id = (item->>'productId')::UUID;
      ELSIF tx.type = 'Sale' THEN
        UPDATE pos_products
        SET stock = pos_products.stock + ABS(COALESCE((item->>'quantity')::INT, 0))
        WHERE pos_products.id = (item->>'productId')::UUID;
      ELSIF tx.type = 'Return' THEN
        UPDATE pos_products
        SET stock = GREATEST(0, pos_products.stock - ABS(COALESCE((item->>'quantity')::INT, 0)))
        WHERE pos_products.id = (item->>'productId')::UUID;
      ELSIF tx.type = 'Check' THEN
        UPDATE pos_products
        SET stock = COALESCE((item->>'previousStock')::INT, pos_products.stock)
        WHERE pos_products.id = (item->>'productId')::UUID;
      END IF;
    END LOOP;
  END IF;

  DELETE FROM inventory_transactions WHERE inventory_transactions.id = p_transaction_id;
  RETURN QUERY SELECT p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION apply_inventory_transaction_with_stock(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_inventory_transaction_with_stock(UUID) TO anon, authenticated;

-- =============================================================================
-- POS PRODUCTS VARIANT SUPPORT (2026-05-12)
-- variant_attributes: JSON parse từ attributes_text (vd: {MÀU: "ĐỎ", SIZE: "38"})
-- parent_id: ID sản phẩm cha logic; toàn bộ SKU thật trong cùng nhóm KiotViet đều là child
-- is_parent: true cho record cha logic, không phải một SKU thật được nâng lên làm cha
-- =============================================================================
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS variant_attributes JSONB DEFAULT '{}';
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT false;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS variant_count INTEGER DEFAULT 0;

-- =============================================================================
-- PRODUCTION SECURITY HARDENING (2026-05-13)
-- Chạy block này sau khi môi trường ghi dữ liệu đã đi qua backend service-role
-- hoặc Supabase authenticated user. Nếu app vẫn ghi trực tiếp bằng anon client,
-- block này sẽ chặn cloud write đúng theo mục tiêu bảo mật production.
-- =============================================================================

-- 1. Không cho anon ghi/xóa trực tiếp bảng hàng hóa.
REVOKE INSERT, UPDATE, DELETE ON pos_products FROM anon;
GRANT SELECT ON pos_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_products TO authenticated;

DROP POLICY IF EXISTS "pos_products_allow_insert" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_update" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_delete" ON pos_products;
DROP POLICY IF EXISTS "pos_products_authenticated_insert" ON pos_products;
DROP POLICY IF EXISTS "pos_products_authenticated_update" ON pos_products;
DROP POLICY IF EXISTS "pos_products_authenticated_delete" ON pos_products;

CREATE POLICY "pos_products_authenticated_insert"
  ON pos_products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "pos_products_authenticated_update"
  ON pos_products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "pos_products_authenticated_delete"
  ON pos_products FOR DELETE
  TO authenticated
  USING (true);

-- 2. Không cho anon upload/update/delete tài liệu knowledge storage.
UPDATE storage.buckets
SET public = false
WHERE id = 'knowledge-files';

DROP POLICY IF EXISTS "knowledge-files public read" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon upload" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon update" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon delete" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files authenticated delete" ON storage.objects;

CREATE POLICY "knowledge-files authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'knowledge-files');

CREATE POLICY "knowledge-files authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'knowledge-files');

CREATE POLICY "knowledge-files authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'knowledge-files')
  WITH CHECK (bucket_id = 'knowledge-files');

CREATE POLICY "knowledge-files authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'knowledge-files');

-- 3. Không cho anon gọi RPC SECURITY DEFINER sửa tồn kho.
REVOKE EXECUTE ON FUNCTION decrement_product_stock(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_product_stock(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION apply_inventory_transaction_with_stock(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION delete_inventory_transaction_with_stock(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION decrement_product_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_product_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_inventory_transaction_with_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_inventory_transaction_with_stock(UUID) TO authenticated;

ALTER FUNCTION decrement_product_stock(UUID, INT) SET search_path = public;
ALTER FUNCTION increment_product_stock(UUID, INT) SET search_path = public;
ALTER FUNCTION apply_inventory_transaction_with_stock(JSONB) SET search_path = public;
ALTER FUNCTION delete_inventory_transaction_with_stock(UUID) SET search_path = public;

-- Reload PostgREST schema cache so newly created/replaced RPCs are callable via Supabase REST.
NOTIFY pgrst, 'reload schema';

-- User-defined categories (independent of products, allows pre-defining structure)
CREATE TABLE IF NOT EXISTS categories (
  path TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- HOÁ ĐƠN ĐẦU VÀO — Giai đoạn 1 (2026-05-17)
-- Chạy thủ công trên Supabase dashboard
-- =====================================================

-- Thêm trường chứng từ vào bảng nhập hàng
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'none'
    CHECK (invoice_status IN ('full', 'partial', 'memo_only', 'none')),
  ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_changed_by TEXT,
  ADD COLUMN IF NOT EXISTS invoice_changed_at TIMESTAMPTZ;

-- Bảng lưu file HĐ VAT đính kèm (1 phiếu nhập → nhiều file)
CREATE TABLE IF NOT EXISTS invoice_attachments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_record_id UUID NOT NULL,
  file_name          TEXT NOT NULL,
  file_url           TEXT NOT NULL,
  file_type          TEXT,             -- 'pdf' | 'xml' | 'image'
  invoice_number     TEXT,
  invoice_date       DATE,
  supplier_tax_id    TEXT,
  invoice_amount     NUMERIC,
  vat_amount         NUMERIC,
  uploaded_by        TEXT,
  uploaded_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE invoice_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON invoice_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- Công nợ khách hàng
-- =============================================================================

-- Thêm cột debt_amount vào pos_customers
ALTER TABLE pos_customers ADD COLUMN IF NOT EXISTS debt_amount NUMERIC DEFAULT 0;

-- Bảng lịch sử công nợ khách hàng
CREATE TABLE IF NOT EXISTS customer_debt_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES pos_customers(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  order_id     UUID,
  type         TEXT NOT NULL CHECK (type IN ('debt', 'repay')),
  amount       NUMERIC NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE customer_debt_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON customer_debt_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
