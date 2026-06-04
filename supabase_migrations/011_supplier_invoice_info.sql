-- Migration 011: Separate supplier invoice issuer information
-- Safe to run multiple times.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_tax_code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_phone TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_address TEXT;

