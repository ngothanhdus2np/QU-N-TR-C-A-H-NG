-- =============================================================================
-- THÊM CÁC BẢNG CÒN THIẾU VÀO SUPABASE (2026-05-14)
-- Chạy script này trong Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- 1. CASHFLOW RECORDS
-- Theo dõi dòng tiền vào/ra
-- =============================================================================
CREATE TABLE IF NOT EXISTS cashflow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Inflow' | 'Outflow'
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  reference_id TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cashflow_date ON cashflow_records(date);
CREATE INDEX IF NOT EXISTS idx_cashflow_type ON cashflow_records(type);
CREATE INDEX IF NOT EXISTS idx_cashflow_branch ON cashflow_records(branch_id);

-- RLS Policies
ALTER TABLE cashflow_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON cashflow_records TO authenticated;

CREATE POLICY "cashflow_authenticated_all" 
  ON cashflow_records FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- =============================================================================
-- 2. RECURRING EXPENSES
-- Chi phí định kỳ tự động
-- =============================================================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  frequency TEXT NOT NULL, -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated TEXT,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_frequency ON recurring_expenses(frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_branch ON recurring_expenses(branch_id);

-- RLS Policies
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_expenses TO authenticated;

CREATE POLICY "recurring_expenses_authenticated_all" 
  ON recurring_expenses FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- =============================================================================
-- RELOAD SCHEMA
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- HOÀN TẤT!
-- Kiểm tra bằng cách chạy:
-- SELECT * FROM cashflow_records LIMIT 1;
-- SELECT * FROM recurring_expenses LIMIT 1;
-- =============================================================================
