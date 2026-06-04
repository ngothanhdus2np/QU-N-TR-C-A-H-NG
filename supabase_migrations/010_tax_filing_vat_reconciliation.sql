-- Migration 010: tax filing start period and opening stock VAT reconciliation.
-- This is additive and keeps old purchase/import data untouched.

CREATE TABLE IF NOT EXISTS tax_filing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Kỳ kê khai chính',
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked', 'archived')),
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by TEXT,
  note TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tax_filing_periods_start_date ON tax_filing_periods (start_date);
CREATE INDEX IF NOT EXISTS idx_tax_filing_periods_status ON tax_filing_periods (status);

CREATE TABLE IF NOT EXISTS opening_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_period_id UUID NOT NULL REFERENCES tax_filing_periods(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  product_group_name TEXT,
  vat_group_id UUID REFERENCES vat_groups(id),
  supplier_id TEXT,
  supplier_name TEXT,
  quantity NUMERIC DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  vat_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (vat_status IN ('has_vat', 'waiting_vat', 'missing_vat', 'no_vat', 'unknown', 'pending_supplement')),
  note TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opening_stock_items_period ON opening_stock_items (filing_period_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_items_sku ON opening_stock_items (tenant_id, lower(sku));
CREATE INDEX IF NOT EXISTS idx_opening_stock_items_supplier ON opening_stock_items (supplier_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_items_vat_group ON opening_stock_items (vat_group_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_items_vat_status ON opening_stock_items (vat_status);

ALTER TABLE vat_allocations
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'purchase_receipt'
    CHECK (target_type IN ('purchase_receipt', 'opening_stock'));

ALTER TABLE vat_allocations
  ADD COLUMN IF NOT EXISTS opening_stock_item_id UUID REFERENCES opening_stock_items(id);

ALTER TABLE vat_allocations
  ADD COLUMN IF NOT EXISTS filing_period_id UUID REFERENCES tax_filing_periods(id);

ALTER TABLE vat_allocations
  ALTER COLUMN purchase_receipt_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vat_allocations_target_type ON vat_allocations (target_type);
CREATE INDEX IF NOT EXISTS idx_vat_allocations_opening_stock ON vat_allocations (opening_stock_item_id);
CREATE INDEX IF NOT EXISTS idx_vat_allocations_period ON vat_allocations (filing_period_id);

ALTER TABLE tax_filing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_stock_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON tax_filing_periods TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON opening_stock_items TO anon, authenticated;

DROP POLICY IF EXISTS "tax_filing_periods_anon_all" ON tax_filing_periods;
CREATE POLICY "tax_filing_periods_anon_all"
  ON tax_filing_periods FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "opening_stock_items_anon_all" ON opening_stock_items;
CREATE POLICY "opening_stock_items_anon_all"
  ON opening_stock_items FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
