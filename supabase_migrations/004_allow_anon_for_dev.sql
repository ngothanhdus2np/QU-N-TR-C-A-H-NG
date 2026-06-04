-- =====================================================
-- MIGRATION 004: Allow Anon Access for Development
-- Created: 2026-05-18
-- Priority: P1 - Development Mode
-- =====================================================
--
-- TEMPORARY: Allow anonymous access for single-user dev mode
-- This should be REMOVED in production!
--
-- =====================================================

-- =====================================================
-- SUPPLIERS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "suppliers_branch_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_branch_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_branch_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_branch_delete" ON suppliers;

CREATE POLICY "suppliers_anon_all"
  ON suppliers FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- POS PRODUCTS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "pos_products_tenant_select" ON pos_products;
DROP POLICY IF EXISTS "pos_products_tenant_insert" ON pos_products;
DROP POLICY IF EXISTS "pos_products_tenant_update" ON pos_products;
DROP POLICY IF EXISTS "pos_products_tenant_delete" ON pos_products;

CREATE POLICY "pos_products_anon_all"
  ON pos_products FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- POS ORDERS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "pos_orders_tenant_select" ON pos_orders;
DROP POLICY IF EXISTS "pos_orders_tenant_insert" ON pos_orders;
DROP POLICY IF EXISTS "pos_orders_tenant_update" ON pos_orders;
DROP POLICY IF EXISTS "pos_orders_tenant_delete" ON pos_orders;

CREATE POLICY "pos_orders_anon_all"
  ON pos_orders FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- INVENTORY TRANSACTIONS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "inventory_transactions_branch_select" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_branch_insert" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_branch_update" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_branch_delete" ON inventory_transactions;

CREATE POLICY "inventory_transactions_anon_all"
  ON inventory_transactions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- REVENUE RECORDS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "revenue_records_tenant_select" ON revenue_records;
DROP POLICY IF EXISTS "revenue_records_tenant_insert" ON revenue_records;
DROP POLICY IF EXISTS "revenue_records_tenant_update" ON revenue_records;
DROP POLICY IF EXISTS "revenue_records_tenant_delete" ON revenue_records;

CREATE POLICY "revenue_records_anon_all"
  ON revenue_records FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- EXPENSE RECORDS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "expense_records_tenant_select" ON expense_records;
DROP POLICY IF EXISTS "expense_records_tenant_insert" ON expense_records;
DROP POLICY IF EXISTS "expense_records_tenant_update" ON expense_records;
DROP POLICY IF EXISTS "expense_records_tenant_delete" ON expense_records;

CREATE POLICY "expense_records_anon_all"
  ON expense_records FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- EMPLOYEES - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "employees_branch_select" ON employees;
DROP POLICY IF EXISTS "employees_branch_insert" ON employees;
DROP POLICY IF EXISTS "employees_branch_update" ON employees;
DROP POLICY IF EXISTS "employees_branch_delete" ON employees;

CREATE POLICY "employees_anon_all"
  ON employees FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PAYROLL RECORDS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "payroll_records_branch_select" ON payroll_records;
DROP POLICY IF EXISTS "payroll_records_branch_insert" ON payroll_records;
DROP POLICY IF EXISTS "payroll_records_branch_update" ON payroll_records;
DROP POLICY IF EXISTS "payroll_records_branch_delete" ON payroll_records;

CREATE POLICY "payroll_records_anon_all"
  ON payroll_records FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- SUPPLIER DEBTS - Allow anon access
-- =====================================================

DROP POLICY IF EXISTS "supplier_debts_branch_select" ON supplier_debts;
DROP POLICY IF EXISTS "supplier_debts_branch_insert" ON supplier_debts;
DROP POLICY IF EXISTS "supplier_debts_branch_update" ON supplier_debts;
DROP POLICY IF EXISTS "supplier_debts_branch_delete" ON supplier_debts;

CREATE POLICY "supplier_debts_anon_all"
  ON supplier_debts FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- GRANT EXECUTE ON RPC FUNCTIONS TO ANON
-- =====================================================

GRANT EXECUTE ON FUNCTION decrement_product_stock(UUID, INT) TO anon;
GRANT EXECUTE ON FUNCTION increment_product_stock(UUID, INT) TO anon;
GRANT EXECUTE ON FUNCTION apply_inventory_transaction_with_stock(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION delete_inventory_transaction_with_stock(UUID) TO anon;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '⚠️  WARNING: Anonymous access enabled for development';
  RAISE NOTICE '⚠️  This should be REMOVED before production deployment!';
END $$;

-- Log migration completion
INSERT INTO audit_logs (table_name, record_id, action, snapshot)
VALUES (
  'system_migrations',
  '004_allow_anon_dev',
  'migration_completed',
  jsonb_build_object(
    'migration', '004_allow_anon_for_dev',
    'timestamp', NOW(),
    'description', 'Temporarily allow anon access for development',
    'warning', 'REMOVE BEFORE PRODUCTION'
  )
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
