-- Payroll carry-forward debt fields
-- 2026-05-26
-- Tracks negative payroll carried into the next payroll period.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS carry_forward_debt NUMERIC DEFAULT 0;

ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS carry_forward_deduction NUMERIC DEFAULT 0;

ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS carry_forward_debt_out NUMERIC DEFAULT 0;
