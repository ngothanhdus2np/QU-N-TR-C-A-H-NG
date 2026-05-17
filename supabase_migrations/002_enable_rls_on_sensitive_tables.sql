-- =====================================================
-- MIGRATION 002: Enable RLS on Sensitive Tables
-- Created: 2026-05-18
-- Priority: P0 - CRITICAL SECURITY FIX
-- =====================================================
-- 
-- This migration enables Row Level Security (RLS) on all tables
-- containing sensitive business data, personal information, or
-- financial records.
--
-- IMPORTANT: Run this BEFORE creating restrictive policies.
-- After enabling RLS, existing anon access will be blocked until
-- policies are created in migration 003.
--
-- =====================================================

-- HR & Payroll Tables (contain salary and personal data)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance ENABLE ROW LEVEL SECURITY;

-- Financial Tables (contain business financial data)
ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Customer & Supplier Tables (contain personal/business data)
ALTER TABLE pos_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_debts ENABLE ROW LEVEL SECURITY;

-- POS & Inventory Tables (contain business operations data)
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
-- pos_products already has RLS enabled in supabase_setup.sql
-- ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Product & Marketing Tables
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_group_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profile ENABLE ROW LEVEL SECURITY;

-- Shopee Integration Tables
ALTER TABLE shopee_revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_product_group_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_source_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_inventory_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_inventory_out ENABLE ROW LEVEL SECURITY;

-- System Tables
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

-- Invoice Attachments (contains sensitive financial documents)
ALTER TABLE invoice_attachments ENABLE ROW LEVEL SECURITY;

-- Customer Debt History
ALTER TABLE customer_debt_history ENABLE ROW LEVEL SECURITY;

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Verification: Check RLS status
DO $$
DECLARE
  table_record RECORD;
  tables_without_rls TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%'
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_record.tablename 
      AND rowsecurity = true
    ) THEN
      tables_without_rls := array_append(tables_without_rls, table_record.tablename);
    END IF;
  END LOOP;
  
  IF array_length(tables_without_rls, 1) > 0 THEN
    RAISE NOTICE 'Tables without RLS: %', array_to_string(tables_without_rls, ', ');
  ELSE
    RAISE NOTICE 'All tables have RLS enabled ✓';
  END IF;
END $$;

-- Log migration completion
INSERT INTO audit_logs (table_name, record_id, action, snapshot)
VALUES (
  'system_migrations',
  '002_enable_rls',
  'migration_completed',
  jsonb_build_object(
    'migration', '002_enable_rls_on_sensitive_tables',
    'timestamp', NOW(),
    'description', 'Enabled RLS on all sensitive tables'
  )
);

COMMENT ON TABLE employees IS 'RLS enabled 2026-05-18 - Contains sensitive employee data';
COMMENT ON TABLE payroll_records IS 'RLS enabled 2026-05-18 - Contains salary information';
COMMENT ON TABLE revenue_records IS 'RLS enabled 2026-05-18 - Contains business financial data';
COMMENT ON TABLE expense_records IS 'RLS enabled 2026-05-18 - Contains business spending data';
COMMENT ON TABLE pos_customers IS 'RLS enabled 2026-05-18 - Contains customer personal data';
COMMENT ON TABLE suppliers IS 'RLS enabled 2026-05-18 - Contains supplier business data';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
