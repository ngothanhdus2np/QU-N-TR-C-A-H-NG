-- Migration 005: Add company invoice fields to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_code TEXT;
