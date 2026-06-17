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
  pos_product_id UUID NOT NULL REFERENCES pos_products(id),
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
