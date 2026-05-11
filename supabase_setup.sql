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

-- 2. Shopee Product Group Revenue
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
