-- Migration 007: Add supplier fields required by KiotViet purchase detail imports
-- Safe to run multiple times.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_group TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers (code);
CREATE INDEX IF NOT EXISTS idx_suppliers_supplier_group ON suppliers (supplier_group);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers (status);
