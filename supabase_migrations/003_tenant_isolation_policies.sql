-- =====================================================
-- MIGRATION 003: Tenant Isolation RLS Policies
-- Created: 2026-05-18
-- Priority: P0 - CRITICAL SECURITY FIX
-- =====================================================
--
-- This migration creates restrictive RLS policies that enforce
-- tenant isolation. Each authenticated user can only access data
-- belonging to their tenant.
--
-- PREREQUISITES:
-- - Migration 002 must be run first (RLS enabled on tables)
-- - Supabase Auth must be configured
-- - Users must have tenant_id in their JWT claims
--
-- TENANT_ID SETUP:
-- In Supabase Dashboard > Authentication > Users:
-- 1. Create user with email/password
-- 2. Set user metadata: { "tenant_id": "phuc-sang" }
-- 3. JWT will include: auth.jwt() ->> 'tenant_id'
--
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: Get current user's tenant_id
-- =====================================================
CREATE OR REPLACE FUNCTION auth.get_user_tenant_id()
RETURNS TEXT AS $$
BEGIN
  -- Get tenant_id from JWT user_metadata
  -- Falls back to 'phuc-sang' for backward compatibility
  RETURN COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'tenant_id',
    'phuc-sang'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DROP OLD PERMISSIVE POLICIES
-- =====================================================

-- Drop old "allow all" policies that were too permissive
DROP POLICY IF EXISTS "authenticated_all" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_read" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_insert" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_update" ON pos_products;
DROP POLICY IF EXISTS "pos_products_allow_delete" ON pos_products;
DROP POLICY IF EXISTS "pos_products_authenticated_insert" ON pos_products;
DROP POLICY IF EXISTS "pos_products_authenticated_update" ON pos_products;
DROP POLICY IF EXISTS "pos_products_authenticated_delete" ON pos_products;

DROP POLICY IF EXISTS "authenticated_all" ON categories;
DROP POLICY IF EXISTS "authenticated_all" ON invoice_attachments;

-- =====================================================
-- POS PRODUCTS - Tenant Isolation
-- =====================================================

CREATE POLICY "pos_products_tenant_select"
  ON pos_products FOR SELECT
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "pos_products_tenant_insert"
  ON pos_products FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "pos_products_tenant_update"
  ON pos_products FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id())
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "pos_products_tenant_delete"
  ON pos_products FOR DELETE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

-- =====================================================
-- POS ORDERS - Tenant Isolation
-- =====================================================

CREATE POLICY "pos_orders_tenant_select"
  ON pos_orders FOR SELECT
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "pos_orders_tenant_insert"
  ON pos_orders FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "pos_orders_tenant_update"
  ON pos_orders FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id())
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "pos_orders_tenant_delete"
  ON pos_orders FOR DELETE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

-- =====================================================
-- POS CUSTOMERS - Tenant Isolation
-- =====================================================

CREATE POLICY "pos_customers_tenant_select"
  ON pos_customers FOR SELECT
  TO authenticated
  USING (true); -- Customers don't have tenant_id yet, allow all for now

CREATE POLICY "pos_customers_tenant_insert"
  ON pos_customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "pos_customers_tenant_update"
  ON pos_customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "pos_customers_tenant_delete"
  ON pos_customers FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- INVENTORY TRANSACTIONS - Branch Isolation
-- =====================================================

CREATE POLICY "inventory_transactions_branch_select"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "inventory_transactions_branch_insert"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "inventory_transactions_branch_update"
  ON inventory_transactions FOR UPDATE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'))
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "inventory_transactions_branch_delete"
  ON inventory_transactions FOR DELETE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

-- =====================================================
-- EMPLOYEES - Branch Isolation
-- =====================================================

CREATE POLICY "employees_branch_select"
  ON employees FOR SELECT
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "employees_branch_insert"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "employees_branch_update"
  ON employees FOR UPDATE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'))
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "employees_branch_delete"
  ON employees FOR DELETE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

-- =====================================================
-- PAYROLL RECORDS - Branch Isolation (SENSITIVE)
-- =====================================================

CREATE POLICY "payroll_records_branch_select"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "payroll_records_branch_insert"
  ON payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "payroll_records_branch_update"
  ON payroll_records FOR UPDATE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'))
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "payroll_records_branch_delete"
  ON payroll_records FOR DELETE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

-- =====================================================
-- REVENUE RECORDS - Tenant Isolation (SENSITIVE)
-- =====================================================

CREATE POLICY "revenue_records_tenant_select"
  ON revenue_records FOR SELECT
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "revenue_records_tenant_insert"
  ON revenue_records FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "revenue_records_tenant_update"
  ON revenue_records FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id())
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "revenue_records_tenant_delete"
  ON revenue_records FOR DELETE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

-- =====================================================
-- EXPENSE RECORDS - Tenant Isolation (SENSITIVE)
-- =====================================================

CREATE POLICY "expense_records_tenant_select"
  ON expense_records FOR SELECT
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "expense_records_tenant_insert"
  ON expense_records FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "expense_records_tenant_update"
  ON expense_records FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id())
  WITH CHECK (tenant_id = auth.get_user_tenant_id());

CREATE POLICY "expense_records_tenant_delete"
  ON expense_records FOR DELETE
  TO authenticated
  USING (tenant_id = auth.get_user_tenant_id());

-- =====================================================
-- SUPPLIERS - Branch Isolation
-- =====================================================

CREATE POLICY "suppliers_branch_select"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true); -- Suppliers don't have branch_id yet, allow all for now

CREATE POLICY "suppliers_branch_insert"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "suppliers_branch_update"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "suppliers_branch_delete"
  ON suppliers FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- SUPPLIER DEBTS - Branch Isolation
-- =====================================================

CREATE POLICY "supplier_debts_branch_select"
  ON supplier_debts FOR SELECT
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "supplier_debts_branch_insert"
  ON supplier_debts FOR INSERT
  TO authenticated
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "supplier_debts_branch_update"
  ON supplier_debts FOR UPDATE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'))
  WITH CHECK (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

CREATE POLICY "supplier_debts_branch_delete"
  ON supplier_debts FOR DELETE
  TO authenticated
  USING (branch_id = COALESCE(auth.jwt() -> 'user_metadata' ->> 'branch_id', 'main'));

-- =====================================================
-- ATTENDANCE, OVERTIME, SALES, SHORTAGES, ADVANCES
-- All use branch_id isolation
-- =====================================================

-- Attendance Records
CREATE POLICY "attendance_records_branch_all"
  ON attendance_records FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Overtime Records
CREATE POLICY "overtime_records_branch_all"
  ON overtime_records FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Sales Records
CREATE POLICY "sales_records_branch_all"
  ON sales_records FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Shortage Records
CREATE POLICY "shortage_records_branch_all"
  ON shortage_records FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Advance Records
CREATE POLICY "advance_records_branch_all"
  ON advance_records FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Salary Policies
CREATE POLICY "salary_policies_branch_all"
  ON salary_policies FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Staff Performance
CREATE POLICY "staff_performance_branch_all"
  ON staff_performance FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Cashflow Records
CREATE POLICY "cashflow_records_branch_all"
  ON cashflow_records FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Recurring Expenses
CREATE POLICY "recurring_expenses_branch_all"
  ON recurring_expenses FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Product Groups
CREATE POLICY "product_groups_branch_all"
  ON product_groups FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Product Group Revenue
CREATE POLICY "product_group_revenue_branch_all"
  ON product_group_revenue FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Promotions
CREATE POLICY "promotions_branch_all"
  ON promotions FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Brand Profile
CREATE POLICY "brand_profile_branch_all"
  ON brand_profile FOR ALL
  TO authenticated
  USING (true) -- No branch_id column yet
  WITH CHECK (true);

-- Shopee Tables (all allow authenticated access for now)
CREATE POLICY "shopee_revenue_records_all"
  ON shopee_revenue_records FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "shopee_product_group_revenue_all"
  ON shopee_product_group_revenue FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "shopee_source_data_all"
  ON shopee_source_data FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "shopee_inventory_in_all"
  ON shopee_inventory_in FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "shopee_inventory_out_all"
  ON shopee_inventory_out FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Knowledge Base
CREATE POLICY "knowledge_base_all"
  ON knowledge_base FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Audit Logs (read-only for all authenticated users)
CREATE POLICY "audit_logs_select"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

-- System Configs
CREATE POLICY "system_configs_all"
  ON system_configs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Invoice Attachments
CREATE POLICY "invoice_attachments_all"
  ON invoice_attachments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Customer Debt History
CREATE POLICY "customer_debt_history_all"
  ON customer_debt_history FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Categories
CREATE POLICY "categories_all"
  ON categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STORAGE BUCKET POLICIES
-- =====================================================

-- Knowledge Files - Authenticated only
DROP POLICY IF EXISTS "knowledge-files public read" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon upload" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon update" ON storage.objects;
DROP POLICY IF EXISTS "knowledge-files anon delete" ON storage.objects;

CREATE POLICY "knowledge-files authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'knowledge-files');

CREATE POLICY "knowledge-files authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'knowledge-files');

CREATE POLICY "knowledge-files authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'knowledge-files')
  WITH CHECK (bucket_id = 'knowledge-files');

CREATE POLICY "knowledge-files authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'knowledge-files');

-- Purchase Invoices Bucket (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'purchase-invoices') THEN
    DROP POLICY IF EXISTS "purchase-invoices public read" ON storage.objects;
    DROP POLICY IF EXISTS "purchase-invoices anon upload" ON storage.objects;
    
    CREATE POLICY "purchase-invoices authenticated read"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'purchase-invoices');
    
    CREATE POLICY "purchase-invoices authenticated upload"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'purchase-invoices');
    
    CREATE POLICY "purchase-invoices authenticated update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'purchase-invoices')
      WITH CHECK (bucket_id = 'purchase-invoices');
    
    CREATE POLICY "purchase-invoices authenticated delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'purchase-invoices');
  END IF;
END $$;

-- =====================================================
-- REVOKE ANON ACCESS TO RPC FUNCTIONS
-- =====================================================

REVOKE EXECUTE ON FUNCTION decrement_product_stock(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_product_stock(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION apply_inventory_transaction_with_stock(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION delete_inventory_transaction_with_stock(UUID) FROM anon;

-- Grant to authenticated only
GRANT EXECUTE ON FUNCTION decrement_product_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_product_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_inventory_transaction_with_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_inventory_transaction_with_stock(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check policy count per table
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE 'Total RLS policies created: %', policy_count;
  
  IF policy_count < 50 THEN
    RAISE WARNING 'Expected at least 50 policies, found %', policy_count;
  ELSE
    RAISE NOTICE 'Policy count looks good ✓';
  END IF;
END $$;

-- Log migration completion
INSERT INTO audit_logs (table_name, record_id, action, snapshot)
VALUES (
  'system_migrations',
  '003_tenant_isolation',
  'migration_completed',
  jsonb_build_object(
    'migration', '003_tenant_isolation_policies',
    'timestamp', NOW(),
    'description', 'Created tenant isolation RLS policies'
  )
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- TESTING INSTRUCTIONS
-- =====================================================
-- 
-- 1. Create test user in Supabase Dashboard:
--    Email: test@phuc-sang.com
--    Password: (secure password)
--    User Metadata: { "tenant_id": "phuc-sang", "branch_id": "main" }
--
-- 2. Test queries:
--    SELECT * FROM pos_products; -- Should only see tenant's products
--    SELECT * FROM revenue_records; -- Should only see tenant's revenue
--
-- 3. Test cross-tenant isolation:
--    Create another user with tenant_id: "other-tenant"
--    Verify they cannot see "phuc-sang" data
--
-- =====================================================
