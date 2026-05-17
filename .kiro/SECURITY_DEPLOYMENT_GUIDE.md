# 🔐 Security Fixes Deployment Guide

**Created:** 2026-05-18  
**Status:** Ready for deployment  
**Priority:** P0 - CRITICAL

---

## ⚠️ IMPORTANT WARNINGS

1. **BACKUP DATABASE FIRST** - These changes are irreversible
2. **TEST IN STAGING** - Do not deploy directly to production
3. **DOWNTIME EXPECTED** - Plan for 15-30 minutes maintenance window
4. **BREAKING CHANGES** - Frontend will need authentication updates

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Backup Database
```bash
# In Supabase Dashboard:
# Settings > Database > Backups > Create Backup
# Or use pg_dump:
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verify Environment Variables
```bash
# Check .env.local has all required variables:
cat .env.local | grep -E "SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|INTERNAL_API_KEY|SESSION_SECRET"
```

Required variables:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (for backend)
- ✅ `INTERNAL_API_KEY` (for cron jobs)
- ✅ `SESSION_SECRET` (32+ characters)

### 3. Test Backend Locally
```bash
# Start server
npm run dev

# Test API with valid key
curl -H "X-Api-Key: your-internal-api-key" http://localhost:3000/api/data/employees

# Test API without key (should fail)
curl http://localhost:3000/api/data/employees
# Expected: {"error":"Unauthorized - Valid API key required"}
```

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy Backend Changes (5 min)

**File changed:** `server.ts`

**What changed:**
- ✅ Removed loopback address bypass
- ✅ Now requires valid `X-Api-Key` header for all API requests

**Deploy:**
```bash
# Commit changes
git add server.ts
git commit -m "security: remove loopback auth bypass (P0 fix)"

# Deploy to production
git push origin main
# Or your deployment command (Vercel, Railway, etc.)
```

**Verify:**
```bash
# Test production API
curl -H "X-Api-Key: your-production-api-key" https://your-domain.com/api/data/employees
# Should return data

curl https://your-domain.com/api/data/employees
# Should return 401 Unauthorized
```

---

### Step 2: Run Database Migrations (10 min)

**Files to run:**
1. `supabase_migrations/002_enable_rls_on_sensitive_tables.sql`
2. `supabase_migrations/003_tenant_isolation_policies.sql`

**⚠️ WARNING:** After running migration 002, **ALL anon access will be blocked** until migration 003 creates policies.

**Run migrations:**

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com/project/YOUR_PROJECT_ID
   - Navigate to: SQL Editor

2. **Run Migration 002**
   ```sql
   -- Copy entire content of 002_enable_rls_on_sensitive_tables.sql
   -- Paste into SQL Editor
   -- Click "Run"
   ```
   
   **Expected output:**
   ```
   NOTICE: All tables have RLS enabled ✓
   ```

3. **Run Migration 003**
   ```sql
   -- Copy entire content of 003_tenant_isolation_policies.sql
   -- Paste into SQL Editor
   -- Click "Run"
   ```
   
   **Expected output:**
   ```
   NOTICE: Total RLS policies created: 80+
   NOTICE: Policy count looks good ✓
   ```

**Verify migrations:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'payroll_records', 'revenue_records', 'pos_products');

-- Expected: All should have rowsecurity = true

-- Check policies exist
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC;

-- Expected: Each table should have 1-4 policies
```

---

### Step 3: Create Test User (5 min)

**In Supabase Dashboard:**

1. Navigate to: **Authentication > Users**
2. Click: **Add User**
3. Fill in:
   - Email: `admin@phuc-sang.com`
   - Password: (generate secure password)
   - Auto Confirm User: ✅ Yes
   
4. After user created, click on user to edit
5. Scroll to **User Metadata** section
6. Add metadata:
   ```json
   {
     "tenant_id": "phuc-sang",
     "branch_id": "main",
     "role": "admin"
   }
   ```
7. Click **Save**

**Test user authentication:**
```bash
# Get auth token
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@phuc-sang.com",
    "password": "your-password"
  }'

# Should return:
# {
#   "access_token": "eyJ...",
#   "token_type": "bearer",
#   "expires_in": 3600,
#   "refresh_token": "...",
#   "user": { ... }
# }
```

---

### Step 4: Test RLS Policies (10 min)

**Test tenant isolation:**

```sql
-- Login as admin@phuc-sang.com in Supabase Dashboard
-- Run these queries in SQL Editor with "Use authenticated user" enabled

-- Should return data (user's tenant)
SELECT * FROM pos_products LIMIT 10;

-- Should return data (user's branch)
SELECT * FROM employees LIMIT 10;

-- Should return data (user's tenant)
SELECT * FROM revenue_records LIMIT 10;
```

**Test cross-tenant isolation:**

1. Create another test user with different tenant:
   ```json
   {
     "tenant_id": "other-company",
     "branch_id": "main"
   }
   ```

2. Login as that user
3. Run same queries
4. **Expected:** Should return 0 rows (no access to phuc-sang data)

---

### Step 5: Update Frontend (Next Phase)

**⚠️ CURRENT STATUS:** Frontend still uses anon key, will fail after RLS enabled.

**Temporary workaround:**
- Backend API endpoints use service role key (bypass RLS)
- Frontend calls backend API with `X-Api-Key` header
- This maintains current functionality while we implement proper auth

**Permanent solution (Phase 2):**
- Implement Supabase Auth in frontend
- Add login page
- Use authenticated user tokens
- See: `.kiro/SECURITY_FIXES_PLAN.md` section 4

---

## 🧪 POST-DEPLOYMENT TESTING

### 1. Test Backend API
```bash
# Test with valid API key
curl -H "X-Api-Key: your-api-key" https://your-domain.com/api/data/employees
# Expected: Returns employee data

# Test without API key
curl https://your-domain.com/api/data/employees
# Expected: 401 Unauthorized
```

### 2. Test Frontend
```bash
# Open app in browser
open https://your-domain.com

# Check browser console for errors
# Should see data loading normally (via backend API)
```

### 3. Test RLS Policies
```sql
-- In Supabase Dashboard SQL Editor
-- Enable "Use authenticated user" toggle
-- Login as test user

SELECT COUNT(*) FROM pos_products;
-- Expected: Returns count of products for user's tenant

SELECT COUNT(*) FROM revenue_records;
-- Expected: Returns count of revenue for user's tenant
```

### 4. Test Audit Logs
```sql
SELECT * FROM audit_logs 
WHERE table_name = 'system_migrations'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Should see migration completion logs
```

---

## 🔄 ROLLBACK PROCEDURE

If something goes wrong:

### 1. Rollback Backend
```bash
git revert HEAD
git push origin main
```

### 2. Rollback Database (DANGEROUS)
```sql
-- Disable RLS on all tables
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_record.tablename);
  END LOOP;
END $$;

-- Drop all policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      policy_record.policyname, 
      policy_record.schemaname, 
      policy_record.tablename
    );
  END LOOP;
END $$;

-- Restore from backup
-- psql -h db.xxx.supabase.co -U postgres -d postgres < backup_YYYYMMDD_HHMMSS.sql
```

---

## 📊 MONITORING

### What to Monitor After Deployment

1. **Error Rates**
   - Check for 401 Unauthorized errors
   - Check for RLS policy violations

2. **Performance**
   - RLS policies add query overhead
   - Monitor query execution times

3. **User Reports**
   - Users unable to access data
   - Missing data after login

### Logs to Check

```bash
# Backend logs
tail -f /var/log/app.log | grep -E "401|Unauthorized|RLS"

# Supabase logs
# Dashboard > Logs > API Logs
# Filter for: status_code = 401
```

---

## ✅ SUCCESS CRITERIA

Deployment is successful when:

- ✅ Backend API requires valid API key
- ✅ RLS enabled on all sensitive tables
- ✅ Tenant isolation policies working
- ✅ Test user can access their data
- ✅ Test user CANNOT access other tenant's data
- ✅ Frontend loads data normally (via backend API)
- ✅ No 500 errors in logs
- ✅ Audit logs show migration completion

---

## 📞 SUPPORT

If you encounter issues:

1. **Check logs** - Backend and Supabase
2. **Verify environment variables** - Especially API keys
3. **Test RLS policies** - Use SQL Editor with authenticated user
4. **Rollback if needed** - Follow rollback procedure above

---

## 📚 NEXT STEPS

After successful deployment:

1. **Phase 2: Frontend Authentication**
   - Implement Supabase Auth
   - Add login page
   - Use authenticated user tokens
   - See: `.kiro/SECURITY_FIXES_PLAN.md`

2. **Phase 3: Additional Security**
   - Add 2FA
   - Implement role-based access control (RBAC)
   - Add audit trail for sensitive operations
   - Set up security monitoring

3. **Phase 4: Performance Optimization**
   - Optimize RLS policies
   - Add database indexes
   - Implement caching

---

## 📝 DEPLOYMENT LOG

**Date:** _____________  
**Deployed by:** _____________  
**Environment:** ☐ Staging  ☐ Production  

**Checklist:**
- [ ] Database backed up
- [ ] Backend deployed
- [ ] Migration 002 run successfully
- [ ] Migration 003 run successfully
- [ ] Test user created
- [ ] RLS policies tested
- [ ] Frontend tested
- [ ] Monitoring configured
- [ ] Team notified

**Issues encountered:**
_____________________________________________
_____________________________________________

**Resolution:**
_____________________________________________
_____________________________________________

**Sign-off:** _____________  
**Date:** _____________
