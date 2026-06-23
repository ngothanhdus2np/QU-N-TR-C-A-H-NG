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
  platform TEXT DEFAULT 'Shopee 2',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration: thêm cột platform cho bảng đã tồn tại
-- ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'Shopee 2';

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
  created_by TEXT,
  channel TEXT DEFAULT 'direct',
  channel_name TEXT DEFAULT 'Bán trực tiếp',
  price_book_id TEXT,
  price_book_name TEXT,
  status TEXT DEFAULT 'completed',
  is_return BOOLEAN DEFAULT false,
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

-- Enable RLS cho 5 bảng Shopee — [PRODUCTION FIX: đã bỏ comment 2026-06-13]
ALTER TABLE shopee_revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_product_group_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_source_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_inventory_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_inventory_out ENABLE ROW LEVEL SECURITY;

-- Policies: chỉ authenticated user được đọc/ghi (block anon access)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_revenue_records' AND policyname='Allow authenticated') THEN
    CREATE POLICY "Allow authenticated" ON shopee_revenue_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_product_group_revenue' AND policyname='Allow authenticated') THEN
    CREATE POLICY "Allow authenticated" ON shopee_product_group_revenue FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_inventory_in' AND policyname='Allow authenticated') THEN
    CREATE POLICY "Allow authenticated" ON shopee_inventory_in FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_inventory_out' AND policyname='Allow authenticated') THEN
    CREATE POLICY "Allow authenticated" ON shopee_inventory_out FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- FIX: shopee_source_data có RLS bật nhưng thiếu policy anon — chạy lệnh này nếu app không đọc được source data
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_source_data' AND policyname='Allow all authenticated') THEN
    CREATE POLICY "Allow all authenticated" ON shopee_source_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


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
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS story TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS voice TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS competitive_advantage TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '[]'::jsonb;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE brand_profile ADD COLUMN IF NOT EXISTS hashtags TEXT;

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
    CREATE POLICY "knowledge-files auth upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'knowledge-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'knowledge-files auth update'
  ) THEN
    CREATE POLICY "knowledge-files auth update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'knowledge-files')
    WITH CHECK (bucket_id = 'knowledge-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'knowledge-files auth delete'
  ) THEN
    CREATE POLICY "knowledge-files auth delete"
    ON storage.objects FOR DELETE
    TO authenticated
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
      TO authenticated
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
      TO authenticated
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
      TO authenticated
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
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'direct';
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS channel_name TEXT DEFAULT 'Bán trực tiếp';
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS price_book_id TEXT;
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS price_book_name TEXT;
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE pos_orders          ADD COLUMN IF NOT EXISTS is_return BOOLEAN DEFAULT false;
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
CREATE INDEX IF NOT EXISTS idx_pos_orders_status          ON pos_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_channel         ON pos_orders(channel);
CREATE INDEX IF NOT EXISTS idx_pos_orders_price_book      ON pos_orders(price_book_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_created_by      ON pos_orders(created_by);
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
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_tax_code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_phone TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_address TEXT;

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

-- ============================================================
-- WEBSITE PUBLIC FORMS (migration 015)
-- Public browser writes go through /api/store/contacts and /api/store/newsletter.
-- ============================================================
CREATE TABLE IF NOT EXISTS store_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_contacts_status_created_at
  ON store_contacts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  source TEXT NOT NULL DEFAULT 'website',
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE store_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Không tạo policy anon/authenticated: browser không được ghi trực tiếp.
NOTIFY pgrst, 'reload schema';

-- User-defined categories (independent of products, allows pre-defining structure)
CREATE TABLE IF NOT EXISTS categories (
  path TEXT PRIMARY KEY,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS location TEXT;
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

-- =============================================================================
-- SECURITY MIGRATION: Restrict write access to authenticated users only
-- Chạy block này trên Supabase Dashboard nếu database đã được tạo trước đây.
-- =============================================================================

-- Fix pos_products: xóa policy cũ cho phép anon ghi, tạo lại chỉ cho authenticated
DROP POLICY IF EXISTS "pos_products_allow_insert" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_update" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_delete" ON pos_products;

CREATE POLICY "pos_products_allow_insert"
  ON pos_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pos_products_allow_update"
  ON pos_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pos_products_allow_delete"
  ON pos_products FOR DELETE TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON pos_products FROM anon;

-- Fix knowledge-files storage: xóa policy cũ cho phép anon ghi
DROP POLICY IF EXISTS "knowledge-files anon upload" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon update" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon delete" ON storage.objects;

CREATE POLICY "knowledge-files auth upload"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'knowledge-files');
CREATE POLICY "knowledge-files auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'knowledge-files') WITH CHECK (bucket_id = 'knowledge-files');
CREATE POLICY "knowledge-files auth delete"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'knowledge-files');

-- ============================================================
-- Carry-forward debt system (vòng 4) — 2026-05-26
-- Theo dõi nợ lương âm chuyển sang kỳ tiếp theo
-- ============================================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS carry_forward_debt NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS carry_forward_deduction NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS carry_forward_debt_out NUMERIC DEFAULT 0;

-- ============================================================
-- Product Cost History — 2026-05-31
-- Lưu lịch sử giá vốn theo thời gian để tính COGS chính xác
-- ============================================================
CREATE TABLE IF NOT EXISTS product_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  product_id TEXT,
  import_price NUMERIC NOT NULL DEFAULT 0,
  effective_date TEXT NOT NULL,
  source TEXT DEFAULT 'purchase',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pch_sku_date ON product_cost_history(sku, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_pch_product_date ON product_cost_history(product_id, effective_date DESC);

ALTER TABLE product_cost_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_cost_history auth all" ON product_cost_history FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- Refund Amount — 2026-06-01
-- Tiền trả lại khách khi trả hàng (> 0 = hoàn tiền, 0 = đổi hàng)
-- ============================================================
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;

-- Tên nhân viên thô từ KiotViet (staff_id lưu UUID, staff_name lưu tên gốc)
-- ============================================================
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS staff_name TEXT;

-- Phân bổ thanh toán nhiều phương thức (cash/bank/card/momo)
-- ============================================================
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS split_payments JSONB;
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS cash_received NUMERIC DEFAULT 0;

-- ============================================================
-- STORE WEBSITE — Bảng cho website PHÚC SANG — 2026-06-16
-- Chạy thủ công trên Supabase Dashboard → SQL Editor
-- ============================================================

-- Thêm channel vào pos_orders để phân biệt đơn POS vs website
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'pos';

-- Sản phẩm website (tách với pos_products — có thể 1 sản phẩm website = nhiều pos_products theo size)
CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description TEXT,
  material TEXT,
  sole_material TEXT,
  origin TEXT,
  care_instructions TEXT,
  size_guide TEXT,
  cover_image_url TEXT,
  gallery JSONB DEFAULT '[]',
  video_url TEXT,
  seo_title TEXT,
  seo_description TEXT,
  og_image_url TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  is_new BOOLEAN DEFAULT FALSE,
  is_best_seller BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Variants website: mỗi dòng = 1 size/màu, liên kết với pos_products để lấy tồn/giá realtime
CREATE TABLE IF NOT EXISTS store_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  pos_product_id UUID NOT NULL REFERENCES pos_products(id),
  sku TEXT NOT NULL,
  size TEXT,
  color_name TEXT,
  color_hex TEXT,
  website_price_override NUMERIC,
  compare_at_price NUMERIC,
  is_published BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_product_variants_store_product ON store_product_variants(store_product_id);
CREATE INDEX IF NOT EXISTS idx_store_product_variants_pos_product ON store_product_variants(pos_product_id);

-- Collections (danh mục website: nam, nữ, sandal, dép, ...)
CREATE TABLE IF NOT EXISTS store_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nhiều-nhiều: sản phẩm ↔ collection
CREATE TABLE IF NOT EXISTS store_product_collections (
  store_product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES store_collections(id) ON DELETE CASCADE,
  PRIMARY KEY (store_product_id, collection_id)
);

-- Địa chỉ giao hàng đính kèm với đơn website (pos_orders.channel = 'website')
CREATE TABLE IF NOT EXISTS store_order_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
  recipient_name TEXT,
  phone TEXT,
  address_line TEXT NOT NULL,
  ward TEXT,
  district TEXT NOT NULL,
  province TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_order_addresses_order ON store_order_addresses(order_id);

-- Đặt trước khi hết hàng — nhân viên liên hệ khi có hàng
CREATE TABLE IF NOT EXISTS store_preorder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pos_product_id UUID REFERENCES pos_products(id),
  sku TEXT,
  size TEXT,
  note TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'contacted', 'converted', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vận đơn — dùng cho tra cứu đơn website
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
  tracking_code TEXT,
  provider TEXT,
  status TEXT DEFAULT 'pending',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);

-- RLS: store_products — đọc public (published), ghi cần authenticated
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_products' AND policyname='store_products_public_read') THEN
    CREATE POLICY "store_products_public_read" ON store_products FOR SELECT USING (is_published = true AND deleted_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_products' AND policyname='store_products_authenticated') THEN
    CREATE POLICY "store_products_authenticated" ON store_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE store_product_variants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_product_variants' AND policyname='store_product_variants_public_read') THEN
    CREATE POLICY "store_product_variants_public_read" ON store_product_variants FOR SELECT USING (is_published = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_product_variants' AND policyname='store_product_variants_authenticated') THEN
    CREATE POLICY "store_product_variants_authenticated" ON store_product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Shopee products content layer (quản lý ảnh, mô tả, SEO cho sản phẩm Shopee)
-- Không có API chính thức → nhập tay, liên kết SKU qua pos_products
-- ============================================================
CREATE TABLE IF NOT EXISTS shopee_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  cover_image_url TEXT,
  gallery JSONB DEFAULT '[]',
  seo_title TEXT,
  seo_description TEXT,
  shopee_item_id TEXT,  -- dùng khi có API chính thức sau này
  is_published BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS shopee_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopee_product_id UUID NOT NULL REFERENCES shopee_products(id) ON DELETE CASCADE,
  pos_product_id UUID REFERENCES pos_products(id),
  sku TEXT NOT NULL,
  size TEXT,
  color_name TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopee_product_variants_shopee ON shopee_product_variants(shopee_product_id);
CREATE INDEX IF NOT EXISTS idx_shopee_product_variants_pos ON shopee_product_variants(pos_product_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_products' AND policyname='shopee_products_authenticated') THEN
    ALTER TABLE shopee_products ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "shopee_products_authenticated" ON shopee_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_product_variants' AND policyname='shopee_product_variants_authenticated') THEN
    ALTER TABLE shopee_product_variants ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "shopee_product_variants_authenticated" ON shopee_product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Shopee shops (thêm 2026-06-17)
CREATE TABLE IF NOT EXISTS shopee_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  port INTEGER,
  shop_url TEXT,
  profile_dir TEXT,
  bot_status TEXT DEFAULT 'stopped',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shopee_shops ADD COLUMN IF NOT EXISTS port         INTEGER;
ALTER TABLE shopee_shops ADD COLUMN IF NOT EXISTS shop_url     TEXT;
ALTER TABLE shopee_shops ADD COLUMN IF NOT EXISTS profile_dir  TEXT;
ALTER TABLE shopee_shops ADD COLUMN IF NOT EXISTS bot_status   TEXT DEFAULT 'stopped';
ALTER TABLE shopee_shops ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

UPDATE shopee_shops SET port = 3001, profile_dir = 'shopee-profile-shop1' WHERE slug = 'phuc-sang-store'  AND port IS NULL;
UPDATE shopee_shops SET port = 3002, profile_dir = 'shopee-profile-shop2' WHERE slug = 'giaydepphucsang' AND port IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_shops' AND policyname='shopee_shops_authenticated') THEN
    ALTER TABLE shopee_shops ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "shopee_shops_authenticated" ON shopee_shops FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO shopee_shops (name, slug, display_order) VALUES
  ('Giày Dép Da Phúc Sang', 'phuc-sang-store', 1),
  ('Phúc Sang_Đồ Da Cao Cấp 93', 'giaydepphucsang', 2)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE shopee_products ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shopee_shops(id);
CREATE INDEX IF NOT EXISTS idx_shopee_products_shop ON shopee_products(shop_id);

-- Cột bổ sung cho sync chi tiết sản phẩm từ bot
ALTER TABLE shopee_products ADD COLUMN IF NOT EXISTS category_name text;
ALTER TABLE shopee_products ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE shopee_products ADD COLUMN IF NOT EXISTS weight integer;
ALTER TABLE shopee_products ADD COLUMN IF NOT EXISTS gallery text[];

-- ============================================================
-- PostgreSQL function: create_store_order
-- Atomic: lock rows → check stock → create pos_order → save address → deduct stock
-- Server calls via supabase.rpc('create_store_order', {...})
-- ============================================================
CREATE OR REPLACE FUNCTION create_store_order(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_address_line TEXT DEFAULT NULL,
  p_ward TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_province TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cod',
  p_note TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_code TEXT;
  v_customer_id UUID;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_product RECORD;
  v_qty INTEGER;
  v_items_json JSONB := '[]'::JSONB;
BEGIN
  -- Upsert khách hàng theo SĐT
  SELECT id INTO v_customer_id FROM pos_customers WHERE phone = p_customer_phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO pos_customers (id, name, phone, email)
    VALUES (gen_random_uuid(), p_customer_name, p_customer_phone, p_customer_email)
    RETURNING id INTO v_customer_id;
  END IF;

  -- Khóa từng sản phẩm (FOR UPDATE), kiểm tra tồn kho
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;

    SELECT id, name, sku, sale_price, stock, status
    INTO v_product
    FROM pos_products
    WHERE id = (v_item->>'pos_product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Sản phẩm không tồn tại');
    END IF;

    IF v_product.status != 'Active' THEN
      RETURN jsonb_build_object('error', format('Sản phẩm "%s" hiện không kinh doanh', v_product.name));
    END IF;

    IF v_product.stock < v_qty THEN
      RETURN jsonb_build_object('error', format('Sản phẩm "%s" không đủ hàng (còn %s)', v_product.name, v_product.stock));
    END IF;

    v_total := v_total + (v_product.sale_price * v_qty);

    v_items_json := v_items_json || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'productName', v_product.name,
      'sku', v_product.sku,
      'quantity', v_qty,
      'price', v_product.sale_price,
      'subtotal', v_product.sale_price * v_qty
    ));
  END LOOP;

  -- Sinh mã đơn PSYYMMDDxxxx
  v_order_code := 'PS' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYMMDD') ||
                  LPAD(FLOOR(RANDOM() * 9999 + 1)::TEXT, 4, '0');

  -- Tạo đơn hàng (channel = 'website')
  INSERT INTO pos_orders (
    id, order_code, date, customer_id, customer_name,
    items, total_amount, final_amount, status,
    payment_method, channel, note, created_at
  ) VALUES (
    gen_random_uuid(), v_order_code,
    TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
    v_customer_id, p_customer_name,
    v_items_json, v_total, v_total, 'pending',
    p_payment_method, 'website', p_note, NOW()
  ) RETURNING id INTO v_order_id;

  -- Lưu địa chỉ giao hàng
  IF p_address_line IS NOT NULL THEN
    INSERT INTO store_order_addresses (order_id, recipient_name, phone, address_line, ward, district, province)
    VALUES (v_order_id, p_customer_name, p_customer_phone, p_address_line, p_ward, p_district, p_province);
  END IF;

  -- Trừ tồn kho
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE pos_products
    SET stock = stock - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'pos_product_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object(
    'order_code', v_order_code,
    'order_id', v_order_id,
    'total_amount', v_total
  );
END;
$$;

-- ============================================================
-- PostgreSQL function: update_website_order_status
-- Atomic: lock đơn → đổi status → nếu chuyển sang 'cancelled' hoặc 'returned'
-- thì tự cộng lại tồn kho theo items JSONB của đơn (đối xứng với create_store_order).
-- Chuyển sang 'return_requested' KHÔNG cộng tồn — hàng chưa thực về kho.
-- Server gọi qua supabase.rpc('update_website_order_status', {...})
-- ============================================================

-- pos_orders gốc chỉ có created_at, chưa có updated_at — bổ sung để RPC dưới đây chạy được
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION update_website_order_status(
  p_order_id UUID,
  p_new_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_items JSONB;
  v_item JSONB;
BEGIN
  SELECT items INTO v_items FROM pos_orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Đơn hàng không tồn tại');
  END IF;

  UPDATE pos_orders
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_order_id;

  -- Chỉ cộng lại tồn kho khi huỷ hẳn hoặc xác nhận đã nhận lại hàng hoàn
  IF p_new_status IN ('cancelled', 'returned') THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_items, '[]'::JSONB))
    LOOP
      UPDATE pos_products
      SET stock = stock + COALESCE((v_item->>'quantity')::INTEGER, 0)
      WHERE id = (v_item->>'productId')::UUID;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Reload PostgREST schema cache sau khi tạo bảng
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- RLS — Bật Row Level Security cho bảng nhạy cảm — 2026-06-06
-- Chạy thủ công trên Supabase Dashboard
-- ============================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='employees_authenticated') THEN
    CREATE POLICY "employees_authenticated" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_records' AND policyname='payroll_records_authenticated') THEN
    CREATE POLICY "payroll_records_authenticated" ON payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='revenue_records' AND policyname='revenue_records_authenticated') THEN
    CREATE POLICY "revenue_records_authenticated" ON revenue_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE pos_customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pos_customers' AND policyname='pos_customers_authenticated') THEN
    CREATE POLICY "pos_customers_authenticated" ON pos_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pos_orders' AND policyname='pos_orders_authenticated') THEN
    CREATE POLICY "pos_orders_authenticated" ON pos_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='audit_logs_authenticated') THEN
    CREATE POLICY "audit_logs_authenticated" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RLS cho các bảng channel links (shopee + website)
ALTER TABLE shopee_products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_products' AND policyname='shopee_products_authenticated') THEN
    CREATE POLICY "shopee_products_authenticated" ON shopee_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE shopee_product_variants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopee_product_variants' AND policyname='shopee_product_variants_authenticated') THEN
    CREATE POLICY "shopee_product_variants_authenticated" ON shopee_product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_products' AND policyname='store_products_authenticated') THEN
    CREATE POLICY "store_products_authenticated" ON store_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE store_product_variants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_product_variants' AND policyname='store_product_variants_authenticated') THEN
    CREATE POLICY "store_product_variants_authenticated" ON store_product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Thêm giá Shopee riêng cho từng SKU liên kết
ALTER TABLE shopee_product_variants ADD COLUMN IF NOT EXISTS shopee_price_override INTEGER;

-- ============================================================
-- Migration: chống trùng (order_id, sku) trong shopee_inventory_out
-- 1 đơn hàng có thể có nhiều SKU → key là composite (order_id, sku)
-- Chạy theo thứ tự: bước 1 trước (xóa duplicate), bước 2 sau (thêm constraint)
-- ============================================================

-- Bước 1: Xóa constraint cũ nếu đã tồn tại (UNIQUE order_id đơn lẻ)
ALTER TABLE shopee_inventory_out
  DROP CONSTRAINT IF EXISTS uq_shopee_inventory_out_order_id;

-- Bước 2: Xóa các dòng duplicate (order_id, sku), giữ dòng có sale_price lớn nhất
-- Tie-break bằng created_at ASC (giữ dòng cũ nhất)
DELETE FROM shopee_inventory_out
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY order_id, sku
             ORDER BY sale_price DESC, created_at ASC
           ) AS rn
    FROM shopee_inventory_out
    WHERE order_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Bước 3: Thêm UNIQUE constraint composite (order_id, sku)
ALTER TABLE shopee_inventory_out
  ADD CONSTRAINT uq_shopee_inventory_out_order_sku UNIQUE (order_id, sku);

-- ============================================================
-- Migration AUDIT-022: Thêm UNIQUE constraints cho revenue_records và payroll_records
-- Chạy theo thứ tự: dedup trước, thêm constraint sau
-- ============================================================

-- revenue_records: UNIQUE(date, branch_id) — 1 bản ghi doanh thu / ngày / chi nhánh
-- Bước 1: Xóa constraint cũ nếu đã tồn tại
ALTER TABLE revenue_records
  DROP CONSTRAINT IF EXISTS uq_revenue_records_date_branch;

-- Bước 2: Xóa các dòng duplicate, giữ dòng có ctid lớn nhất (mới nhất vật lý)
DELETE FROM revenue_records
WHERE ctid NOT IN (
  SELECT MAX(ctid)
  FROM revenue_records
  GROUP BY date, branch_id
);

-- Bước 3: Thêm UNIQUE constraint
ALTER TABLE revenue_records
  ADD CONSTRAINT uq_revenue_records_date_branch UNIQUE (date, branch_id);

-- payroll_records: UNIQUE(employee_id, month) — 1 bản ghi lương / nhân viên / tháng
-- Bước 1: Xóa constraint cũ nếu đã tồn tại
ALTER TABLE payroll_records
  DROP CONSTRAINT IF EXISTS uq_payroll_records_employee_month;

-- Bước 2: Xóa các dòng duplicate, giữ dòng có ctid lớn nhất (mới nhất vật lý)
DELETE FROM payroll_records
WHERE ctid NOT IN (
  SELECT MAX(ctid)
  FROM payroll_records
  GROUP BY employee_id, month
);

-- Bước 3: Thêm UNIQUE constraint
ALTER TABLE payroll_records
  ADD CONSTRAINT uq_payroll_records_employee_month UNIQUE (employee_id, month);

-- ============================================================
-- Product Images Storage Bucket
-- Chạy trên Supabase Dashboard > SQL Editor
-- ============================================================

-- Tạo bucket product-images (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép upload không cần auth (anon có thể upload)
CREATE POLICY "Allow anon upload product images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'product-images');

-- Cho phép đọc public
CREATE POLICY "Allow public read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- ============================================================
-- AUDIT-004/017 — Backfill nextImportPrice vào inventory_transactions cũ
-- Mục đích: Báo cáo lợi nhuận quá khứ dùng giá vốn đúng lúc bán,
--           không phải importPrice hiện tại của sản phẩm.
-- Chỉ chạy khi: giá vốn sản phẩm đã thay đổi kể từ khi nhập kho ban đầu.
-- An toàn: chỉ cập nhật item có nextImportPrice = 0 hoặc null.
-- Chạy thủ công trên Supabase Dashboard > SQL Editor.
-- ============================================================

UPDATE inventory_transactions
SET items = (
  SELECT jsonb_agg(
    CASE
      WHEN COALESCE((item ->> 'nextImportPrice')::numeric, 0) = 0 THEN
        jsonb_set(
          item,
          '{nextImportPrice}',
          to_jsonb(COALESCE(
            (
              SELECT pch.import_price
              FROM product_cost_history pch
              WHERE pch.sku = item ->> 'sku'
                AND pch.effective_date <= inventory_transactions.date
              ORDER BY pch.effective_date DESC
              LIMIT 1
            ),
            (item ->> 'importPrice')::numeric,
            0
          ))
        )
      ELSE item
    END
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE type = 'Import'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(items) AS item
    WHERE COALESCE((item ->> 'nextImportPrice')::numeric, 0) = 0
  );

-- ============================================================
-- GIAI ĐOẠN 4: Fix store_products + store_product_variants (2026-06-20)
-- Chạy trên iMac: docker exec supabase-db psql -U postgres -d postgres
-- ============================================================

-- Bước 1: Fix slug
-- Slug hiện tại sai dạng "dbd01-den-38-1781686887459" → đúng là "dbd01"
UPDATE store_products
SET slug = LOWER(name)
WHERE deleted_at IS NULL
  AND slug LIKE '%-%';
-- Kết quả mong đợi: UPDATE 30

-- Bước 2: Parse size và color_name từ SKU variant
-- SKU dạng "DBD01-Đen-38" → color_name='Đen', size='38'
UPDATE store_product_variants
SET
  color_name = SPLIT_PART(sku, '-', 2),
  size       = SPLIT_PART(sku, '-', 3)
WHERE color_name IS NULL
  AND size IS NULL
  AND sku LIKE '%-%-%';
-- Kết quả mong đợi: UPDATE 180

-- Xác nhận kết quả
-- SELECT name, slug FROM store_products ORDER BY name;
-- SELECT sku, color_name, size FROM store_product_variants LIMIT 10;

-- ============================================================
-- LƯU Ý: 13 sản phẩm từ website chưa có trong pos_products
-- (DBDN01-07, DDDN01-03, DXNN01-03)
-- → Cần nhập vào pos_products trước, sau đó dùng tab "Kênh bán"
--   trong app để toggle lên store_products.
-- ============================================================

-- ============================================================
-- WEBSITE ORDER INTEGRITY (migration 014)
-- Nguồn chuẩn: supabase_migrations/014_store_order_inventory_integrity.sql
-- Chạy migration này trên production trước khi deploy Store API.
-- ============================================================

-- Phí vận chuyển đơn website được tính trong RPC và lưu theo đơn để giữ đúng
-- lịch sử thanh toán nếu chính sách vận chuyển thay đổi sau này.
ALTER TABLE pos_orders
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION create_store_order(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_address_line TEXT DEFAULT NULL,
  p_ward TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_province TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cod',
  p_note TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_code TEXT;
  v_customer_id UUID;
  v_subtotal NUMERIC := 0;
  v_shipping_fee NUMERIC := 0;
  v_total NUMERIC := 0;
  v_request RECORD;
  v_product RECORD;
  v_items_json JSONB := '[]'::JSONB;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Giỏ hàng trống');
  END IF;

  FOR v_request IN
    SELECT (item->>'pos_product_id')::UUID AS pos_product_id,
           SUM((item->>'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY (item->>'pos_product_id')::UUID
    ORDER BY (item->>'pos_product_id')::UUID
  LOOP
    IF v_request.quantity IS NULL OR v_request.quantity < 1 THEN
      RETURN jsonb_build_object('error', 'Số lượng sản phẩm không hợp lệ');
    END IF;

    SELECT p.id, p.name, p.sku, p.stock, p.status,
           COALESCE(spv.website_price_override, p.sale_price) AS website_price
    INTO v_product
    FROM pos_products AS p
    JOIN store_product_variants AS spv
      ON spv.pos_product_id = p.id AND spv.is_published = TRUE
    JOIN store_products AS sp
      ON sp.id = spv.store_product_id
     AND sp.is_published = TRUE
     AND sp.deleted_at IS NULL
    WHERE p.id = v_request.pos_product_id
    FOR UPDATE OF p;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Sản phẩm không tồn tại hoặc chưa được xuất bản');
    END IF;
    IF v_product.status <> 'Active' THEN
      RETURN jsonb_build_object('error', format('Sản phẩm "%s" hiện không kinh doanh', v_product.name));
    END IF;
    IF v_product.stock < v_request.quantity THEN
      RETURN jsonb_build_object('error', format('Sản phẩm "%s" không đủ hàng (còn %s)', v_product.name, v_product.stock));
    END IF;

    v_subtotal := v_subtotal + (v_product.website_price * v_request.quantity);
    v_items_json := v_items_json || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id, 'productName', v_product.name, 'sku', v_product.sku,
      'quantity', v_request.quantity, 'price', v_product.website_price,
      'subtotal', v_product.website_price * v_request.quantity
    ));
  END LOOP;

  -- Chính sách Website: dưới 800.000đ thu 30.000đ, từ 800.000đ miễn phí.
  -- Browser không truyền và không có quyền quyết định phí vận chuyển.
  v_shipping_fee := CASE WHEN v_subtotal < 800000 THEN 30000 ELSE 0 END;
  v_total := v_subtotal + v_shipping_fee;

  SELECT id INTO v_customer_id FROM pos_customers WHERE phone = p_customer_phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO pos_customers (id, name, phone, email)
    VALUES (gen_random_uuid(), p_customer_name, p_customer_phone, p_customer_email)
    RETURNING id INTO v_customer_id;
  END IF;

  v_order_code := 'PS' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYMMDD') ||
                  LPAD(FLOOR(RANDOM() * 9999 + 1)::TEXT, 4, '0');
  INSERT INTO pos_orders (
    id, order_code, date, customer_id, customer_name, items, shipping_fee, total_amount, final_amount,
    status, payment_method, channel, note, created_at
  ) VALUES (
    gen_random_uuid(), v_order_code, TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
    v_customer_id, p_customer_name, v_items_json, v_shipping_fee, v_total, v_total, 'pending',
    p_payment_method, 'website', p_note, NOW()
  ) RETURNING id INTO v_order_id;

  IF p_address_line IS NOT NULL THEN
    INSERT INTO store_order_addresses (order_id, recipient_name, phone, address_line, ward, district, province)
    VALUES (v_order_id, p_customer_name, p_customer_phone, p_address_line, p_ward, p_district, p_province);
  END IF;

  FOR v_request IN SELECT value FROM jsonb_array_elements(v_items_json)
  LOOP
    UPDATE pos_products
    SET stock = stock - (v_request.value->>'quantity')::INTEGER
    WHERE id = (v_request.value->>'productId')::UUID;
  END LOOP;

  RETURN jsonb_build_object(
    'order_code', v_order_code,
    'order_id', v_order_id,
    'subtotal', v_subtotal,
    'shipping_fee', v_shipping_fee,
    'total_amount', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_website_order_status(
  p_order_id UUID,
  p_new_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_items JSONB;
BEGIN
  SELECT status, items INTO v_current_status, v_items
  FROM pos_orders
  WHERE id = p_order_id AND channel = 'website'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Đơn hàng website không tồn tại');
  END IF;
  IF p_new_status IS NULL OR p_new_status NOT IN ('pending', 'confirmed', 'shipping', 'completed', 'cancelled', 'return_requested', 'returned') THEN
    RETURN jsonb_build_object('error', 'Trạng thái đơn hàng không hợp lệ');
  END IF;
  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object('ok', TRUE, 'idempotent', TRUE, 'restocked', FALSE);
  END IF;
  IF NOT (
    (v_current_status = 'pending' AND p_new_status IN ('confirmed', 'cancelled')) OR
    (v_current_status = 'confirmed' AND p_new_status IN ('shipping', 'cancelled')) OR
    (v_current_status = 'shipping' AND p_new_status IN ('completed', 'return_requested')) OR
    (v_current_status = 'completed' AND p_new_status = 'return_requested') OR
    (v_current_status = 'return_requested' AND p_new_status = 'returned')
  ) THEN
    RETURN jsonb_build_object('error', format('Không thể chuyển trạng thái từ "%s" sang "%s"', v_current_status, p_new_status));
  END IF;

  UPDATE pos_orders SET status = p_new_status, updated_at = NOW() WHERE id = p_order_id;
  IF p_new_status IN ('cancelled', 'returned') THEN
    WITH restocks AS (
      SELECT (item->>'productId')::UUID AS product_id,
             SUM(COALESCE(NULLIF(item->>'quantity', '')::INTEGER, 0))::INTEGER AS quantity
      FROM jsonb_array_elements(COALESCE(v_items, '[]'::JSONB)) AS item
      GROUP BY (item->>'productId')::UUID
    )
    UPDATE pos_products AS p
    SET stock = p.stock + restocks.quantity
    FROM restocks
    WHERE p.id = restocks.product_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'idempotent', FALSE, 'restocked', p_new_status IN ('cancelled', 'returned'));
END;
$$;

NOTIFY pgrst, 'reload schema';

-- WEBSITE ADMIN MODULE (migration 018)
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS store_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO store_settings (key, value) VALUES
  ('website', jsonb_build_object('shipping_policy', jsonb_build_object('threshold', 800000, 'fee_below_threshold', 30000), 'hotline', '', 'address', '', 'social_links', jsonb_build_object(), 'bank_accounts', jsonb_build_array(), 'footer', jsonb_build_object()))
ON CONFLICT (key) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('store-media', 'store-media', TRUE, 10485760, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_preorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_products_authenticated" ON store_products;
DROP POLICY IF EXISTS "store_product_variants_authenticated" ON store_product_variants;
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Migration 015: Auto-import 13 sản phẩm dép kiểu nữ từ website
-- Danh mục: Dép kiểu nữ | Size: 35–40 | Giá = 0 (điền sau)
-- An toàn: bỏ qua nếu SKU đã tồn tại (idempotent)
-- ============================================================
DO $$
DECLARE
  v_products JSONB[] := ARRAY[
    '{"sku":"DBDN01","name":"DBDN01 XANH LÁ","color":"Xanh Lá"}'::JSONB,
    '{"sku":"DBDN02","name":"DBDN02 NÂU","color":"Nâu"}'::JSONB,
    '{"sku":"DBDN03","name":"DBDN03 CAM","color":"Cam"}'::JSONB,
    '{"sku":"DBDN04","name":"DBDN04 DA","color":"Da"}'::JSONB,
    '{"sku":"DBDN05","name":"DBDN05 TRẮNG","color":"Trắng"}'::JSONB,
    '{"sku":"DBDN06","name":"DBDN06 ĐEN","color":"Đen"}'::JSONB,
    '{"sku":"DBDN07","name":"DBDN07 TRẮNG","color":"Trắng"}'::JSONB,
    '{"sku":"DDDN01","name":"DDDN01 TRẮNG","color":"Trắng"}'::JSONB,
    '{"sku":"DDDN02","name":"DDDN02 ĐEN","color":"Đen"}'::JSONB,
    '{"sku":"DDDN03","name":"DDDN03 NÂU","color":"Nâu"}'::JSONB,
    '{"sku":"DXNN01","name":"DXNN01 TRẮNG","color":"Trắng"}'::JSONB,
    '{"sku":"DXNN02","name":"DXNN02 ĐEN","color":"Đen"}'::JSONB,
    '{"sku":"DXNN03","name":"DXNN03 DA","color":"Da"}'::JSONB
  ];
  v_sizes     INT[] := ARRAY[35, 36, 37, 38, 39, 40];
  v_prod      JSONB;
  v_parent_id UUID;
  v_store_id  UUID;
  v_var       RECORD;
  v_size      INT;
BEGIN
  FOREACH v_prod IN ARRAY v_products LOOP

    IF EXISTS (SELECT 1 FROM pos_products WHERE sku = v_prod->>'sku') THEN
      RAISE NOTICE 'SKU % đã tồn tại — bỏ qua', v_prod->>'sku';
      CONTINUE;
    END IF;

    v_parent_id := gen_random_uuid();

    -- 1. Sản phẩm cha
    INSERT INTO pos_products (
      id, sku, name,
      category_id, category_path,
      sale_price, import_price, stock,
      unit, status, is_parent, variant_count,
      branch_id, tenant_id, product_type
    ) VALUES (
      v_parent_id,
      v_prod->>'sku',
      v_prod->>'name',
      'Dép kiểu nữ', 'Dép kiểu nữ',
      0, 0, 0,
      'Đôi', 'Active', TRUE, 6,
      'main', 'phuc-sang', 'Hàng hóa'
    );

    -- 2. 6 biến thể (size 35–40)
    FOREACH v_size IN ARRAY v_sizes LOOP
      INSERT INTO pos_products (
        id, sku, name,
        category_id, category_path,
        sale_price, import_price, stock,
        unit, status, is_parent, parent_id,
        variant_attributes, attributes_text,
        branch_id, tenant_id, product_type
      ) VALUES (
        gen_random_uuid(),
        (v_prod->>'sku') || '-' || (v_prod->>'color') || '-' || v_size,
        (v_prod->>'name') || ' - ' || (v_prod->>'color') || ' - ' || v_size,
        'Dép kiểu nữ', 'Dép kiểu nữ',
        0, 0, 0,
        'Đôi', 'Active', FALSE, v_parent_id::TEXT,
        jsonb_build_object('Màu', v_prod->>'color', 'Size', v_size::TEXT),
        'Màu: ' || (v_prod->>'color') || ', Size: ' || v_size,
        'main', 'phuc-sang', 'Hàng hóa'
      );
    END LOOP;

    -- 3. store_products (website listing)
    IF NOT EXISTS (SELECT 1 FROM store_products WHERE slug = LOWER(v_prod->>'sku')) THEN
      v_store_id := gen_random_uuid();
      INSERT INTO store_products (
        id, name, slug,
        is_published, is_new,
        created_at, updated_at
      ) VALUES (
        v_store_id,
        v_prod->>'name',
        LOWER(v_prod->>'sku'),
        TRUE, TRUE,
        NOW(), NOW()
      );
    ELSE
      SELECT id INTO v_store_id FROM store_products WHERE slug = LOWER(v_prod->>'sku');
    END IF;

    -- 4. store_product_variants (liên kết pos_products ↔ store_products)
    FOR v_var IN
      SELECT id, sku FROM pos_products
      WHERE parent_id = v_parent_id::TEXT
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM store_product_variants WHERE pos_product_id = v_var.id
      ) THEN
        INSERT INTO store_product_variants (
          id, store_product_id, pos_product_id, sku,
          color_name, size, is_published, display_order
        ) VALUES (
          gen_random_uuid(),
          v_store_id,
          v_var.id,
          v_var.sku,
          v_prod->>'color',
          SPLIT_PART(v_var.sku, '-', 3),
          TRUE, 0
        );
      END IF;
    END LOOP;

    RAISE NOTICE 'Đã tạo: % + 6 biến thể + store entry', v_prod->>'sku';
  END LOOP;
END $$;

-- Migration 016: Gán nhóm hàng DÉP KIỂU NAM cho 258 sản phẩm trong catalog
-- Các sản phẩm đã có category_path (vd: 'Dép kiểu nữ') sẽ không bị ảnh hưởng.
DO $$
DECLARE
  v_group_name TEXT;
  v_updated    INT;
BEGIN
  SELECT name INTO v_group_name
  FROM product_groups
  WHERE UPPER(name) LIKE '%KIỂU NAM%'
  LIMIT 1;

  IF v_group_name IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy nhóm KIỂU NAM. Các nhóm hiện có: %',
      (SELECT string_agg(name, ' | ') FROM product_groups);
  END IF;

  UPDATE pos_products
  SET category_id   = v_group_name,
      category_path = v_group_name
  WHERE id IN (
    SELECT DISTINCT pos_product_id
    FROM store_product_variants
    WHERE is_published = true
  )
  AND (category_path IS NULL OR category_path = '');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Migration 016: Đã cập nhật % sản phẩm → nhóm "%"', v_updated, v_group_name;
END $$;

-- ============================================================
-- WEBSITE FULFILMENT + SPX SHIPMENTS (migration 017)
-- ============================================================
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS cod_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION upsert_website_shipment(
  p_order_id UUID, p_provider TEXT DEFAULT 'SPX', p_tracking_code TEXT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0, p_cod_amount NUMERIC DEFAULT 0, p_status TEXT DEFAULT 'ready_to_ship'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_status TEXT;
  v_shipment_id UUID;
  v_provider TEXT := COALESCE(NULLIF(BTRIM(p_provider), ''), 'SPX');
  v_tracking_code TEXT := NULLIF(BTRIM(p_tracking_code), '');
  v_status TEXT := COALESCE(NULLIF(BTRIM(p_status), ''), 'ready_to_ship');
BEGIN
  SELECT status INTO v_order_status FROM pos_orders
  WHERE id = p_order_id AND channel = 'website' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Đơn hàng website không tồn tại'); END IF;
  IF LENGTH(v_provider) > 100 OR LENGTH(COALESCE(v_tracking_code, '')) > 150 OR LENGTH(v_status) > 100 THEN
    RETURN jsonb_build_object('error', 'Thông tin vận đơn không hợp lệ');
  END IF;
  IF p_shipping_fee < 0 OR p_cod_amount < 0 THEN
    RETURN jsonb_build_object('error', 'Phí giao hàng và tiền COD phải lớn hơn hoặc bằng 0');
  END IF;
  IF (v_order_status = 'shipping' OR v_status = 'shipping') AND v_tracking_code IS NULL THEN
    RETURN jsonb_build_object('error', 'Cần có mã vận đơn trước khi chuyển sang đang giao');
  END IF;

  SELECT id INTO v_shipment_id FROM shipments WHERE order_id = p_order_id
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_shipment_id IS NULL THEN
    INSERT INTO shipments (order_id, provider, tracking_code, shipping_fee, cod_amount, status, shipped_at, created_at, updated_at)
    VALUES (p_order_id, v_provider, v_tracking_code, p_shipping_fee, p_cod_amount, v_status,
      CASE WHEN v_status = 'shipping' THEN NOW() ELSE NULL END, NOW(), NOW())
    RETURNING id INTO v_shipment_id;
  ELSE
    UPDATE shipments SET provider = v_provider, tracking_code = v_tracking_code,
      shipping_fee = p_shipping_fee, cod_amount = p_cod_amount, status = v_status,
      shipped_at = CASE WHEN v_status = 'shipping' THEN COALESCE(shipped_at, NOW()) ELSE shipped_at END,
      updated_at = NOW()
    WHERE id = v_shipment_id;
  END IF;
  RETURN jsonb_build_object('ok', TRUE, 'shipment_id', v_shipment_id);
END;
$$;

DROP FUNCTION IF EXISTS update_website_order_status(UUID, TEXT);
CREATE OR REPLACE FUNCTION update_website_order_status(
  p_order_id UUID, p_new_status TEXT, p_shipment JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_status TEXT; v_items JSONB; v_shipment_result JSONB;
BEGIN
  SELECT status, items INTO v_current_status, v_items FROM pos_orders
  WHERE id = p_order_id AND channel = 'website' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Đơn hàng website không tồn tại'); END IF;
  IF p_new_status IS NULL OR p_new_status NOT IN ('pending', 'confirmed', 'packing', 'ready_to_ship', 'shipping', 'completed', 'cancelled', 'return_requested', 'returned') THEN
    RETURN jsonb_build_object('error', 'Trạng thái đơn hàng không hợp lệ');
  END IF;
  IF v_current_status = p_new_status THEN RETURN jsonb_build_object('ok', TRUE, 'idempotent', TRUE, 'restocked', FALSE); END IF;
  IF NOT (
    (v_current_status = 'pending' AND p_new_status IN ('confirmed', 'cancelled')) OR
    (v_current_status = 'confirmed' AND p_new_status IN ('packing', 'cancelled')) OR
    (v_current_status = 'packing' AND p_new_status IN ('ready_to_ship', 'cancelled')) OR
    (v_current_status = 'ready_to_ship' AND p_new_status IN ('shipping', 'cancelled')) OR
    (v_current_status = 'shipping' AND p_new_status IN ('completed', 'return_requested')) OR
    (v_current_status = 'completed' AND p_new_status = 'return_requested') OR
    (v_current_status = 'return_requested' AND p_new_status = 'returned')
  ) THEN RETURN jsonb_build_object('error', format('Không thể chuyển trạng thái từ "%s" sang "%s"', v_current_status, p_new_status)); END IF;
  IF p_new_status = 'shipping' THEN
    IF p_shipment IS NULL OR jsonb_typeof(p_shipment) <> 'object' OR NULLIF(BTRIM(p_shipment->>'tracking_code'), '') IS NULL THEN
      RETURN jsonb_build_object('error', 'Cần có mã vận đơn trước khi chuyển sang đang giao');
    END IF;
    SELECT upsert_website_shipment(p_order_id, COALESCE(p_shipment->>'provider', 'SPX'), p_shipment->>'tracking_code',
      COALESCE((p_shipment->>'shipping_fee')::NUMERIC, 0), COALESCE((p_shipment->>'cod_amount')::NUMERIC, 0), 'shipping')
    INTO v_shipment_result;
    IF v_shipment_result ? 'error' THEN RETURN v_shipment_result; END IF;
  END IF;
  UPDATE pos_orders SET status = p_new_status, updated_at = NOW() WHERE id = p_order_id;
  IF p_new_status IN ('cancelled', 'returned') THEN
    WITH restocks AS (
      SELECT (item->>'productId')::UUID AS product_id,
        SUM(COALESCE(NULLIF(item->>'quantity', '')::INTEGER, 0))::INTEGER AS quantity
      FROM jsonb_array_elements(COALESCE(v_items, '[]'::JSONB)) AS item
      GROUP BY (item->>'productId')::UUID
    ) UPDATE pos_products AS p SET stock = p.stock + restocks.quantity FROM restocks WHERE p.id = restocks.product_id;
  END IF;
  RETURN jsonb_build_object('ok', TRUE, 'idempotent', FALSE, 'restocked', p_new_status IN ('cancelled', 'returned'));
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Add is_starred column to pos_customers for favorite marking
ALTER TABLE pos_customers ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
