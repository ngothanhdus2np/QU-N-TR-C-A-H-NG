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

-- 6. POS Suppliers
CREATE TABLE IF NOT EXISTS pos_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  contact_person TEXT,
  tax_code TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. POS Products
CREATE TABLE IF NOT EXISTS pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  name TEXT,
  category_id TEXT,
  import_price NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  max_stock NUMERIC DEFAULT 999999,
  unit TEXT,
  brand TEXT,
  barcode TEXT,
  description TEXT,
  warranty TEXT,
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

-- 10. Audit Trail (lịch sử thay đổi tài chính / lương)
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,  -- 'upsert' | 'delete' | 'clear_table'
  new_value JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add supplier_name to pos_products if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pos_products' AND column_name='supplier_name') THEN
    ALTER TABLE pos_products ADD COLUMN supplier_name TEXT;
  END IF;
END $$;

-- Add supplier_name to inventory_transactions if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_transactions' AND column_name='supplier_name') THEN
    ALTER TABLE inventory_transactions ADD COLUMN supplier_name TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_trail_table ON audit_trail(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_trail_changed_at ON audit_trail(changed_at DESC);

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
