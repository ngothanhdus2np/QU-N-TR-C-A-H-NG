# 🚀 DEPLOY SECURITY FIXES - HƯỚNG DẪN NHANH

**Status:** ✅ Code đã commit, sẵn sàng deploy  
**Time:** 15-30 phút  
**Risk:** Medium (có rollback plan)

---

## ⚠️ QUAN TRỌNG - ĐỌC TRƯỚC KHI LÀM

1. **BACKUP DATABASE** - Bắt buộc trước khi chạy migrations
2. **Có thể có downtime** - Nên deploy ngoài giờ cao điểm
3. **Test kỹ sau khi deploy** - Verify mọi thứ hoạt động

---

## 📋 CHECKLIST TRƯỚC KHI DEPLOY

- [x] Code đã commit
- [x] TypeScript compiles OK
- [ ] **BACKUP DATABASE** ← LÀM NGAY
- [ ] Đọc kỹ hướng dẫn này
- [ ] Chuẩn bị rollback plan

---

## BƯỚC 1: BACKUP DATABASE (5 phút)

### Option A: Backup qua Supabase Dashboard (Khuyến nghị)

1. Mở: https://supabase.com/dashboard/project/tqouzxlnihfjdyxqlbqs
2. Vào: **Settings** (góc trái dưới) → **Database**
3. Scroll xuống section **Backups**
4. Click: **Create Backup**
5. Đợi backup hoàn thành (1-2 phút)
6. ✅ Verify backup xuất hiện trong danh sách

### Option B: Backup qua pg_dump (Alternative)

```bash
# Lấy connection string từ Supabase Dashboard
# Settings → Database → Connection string → URI

pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.tqouzxlnihfjdyxqlbqs.supabase.co:5432/postgres" \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file
ls -lh backup_*.sql
```

---

## BƯỚC 2: RUN SQL MIGRATIONS (10 phút)

### 2.1. Open Supabase SQL Editor

1. Mở: https://supabase.com/dashboard/project/tqouzxlnihfjdyxqlbqs
2. Click: **SQL Editor** (menu bên trái)
3. Click: **New Query**

### 2.2. Run Migration 002 - Enable RLS

1. **Mở file:** `supabase_migrations/002_enable_rls_on_sensitive_tables.sql`
2. **Copy toàn bộ nội dung** (Cmd+A, Cmd+C)
3. **Paste vào SQL Editor** (Cmd+V)
4. **Click: RUN** (hoặc Cmd+Enter)

**Expected Output:**
```
NOTICE: All tables have RLS enabled ✓
INSERT 0 1
```

**Nếu có lỗi:**
- Đọc error message
- Check syntax
- Có thể table đã có RLS (không sao, migration là idempotent)

### 2.3. Run Migration 003 - Create Policies

1. **Mở file:** `supabase_migrations/003_tenant_isolation_policies.sql`
2. **Copy toàn bộ nội dung**
3. **Paste vào SQL Editor**
4. **Click: RUN**

**Expected Output:**
```
NOTICE: Total RLS policies created: 80+
NOTICE: Policy count looks good ✓
INSERT 0 1
```

**Nếu có lỗi:**
- Có thể policy đã tồn tại (migration sẽ DROP IF EXISTS trước)
- Check error message
- Nếu stuck, rollback và hỏi

### 2.4. Verify Migrations

Run query này để verify:

```sql
-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'payroll_records', 'revenue_records', 'pos_products');

-- Expected: All should have rowsecurity = true

-- Check policy count
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';

-- Expected: 80+

-- Check audit logs
SELECT * FROM audit_logs 
WHERE table_name = 'system_migrations'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Should see migration completion logs
```

---

## BƯỚC 3: CREATE TEST USER (5 phút)

### 3.1. Create User in Supabase

1. Vào: **Authentication** → **Users**
2. Click: **Add User** → **Create new user**
3. Fill in:
   - **Email:** `admin@phuc-sang.com`
   - **Password:** (tạo password mạnh, lưu lại)
   - **Auto Confirm User:** ✅ Check
4. Click: **Create User**

### 3.2. Add User Metadata

1. Click vào user vừa tạo
2. Scroll xuống **User Metadata** section
3. Click **Edit**
4. Paste JSON này:

```json
{
  "tenant_id": "phuc-sang",
  "branch_id": "main",
  "role": "admin"
}
```

5. Click **Save**

### 3.3. Test User Login

Run query này trong SQL Editor với **"Use authenticated user"** toggle:

```sql
-- Login as admin@phuc-sang.com first
-- Then run these queries:

-- Should return data
SELECT COUNT(*) FROM pos_products;

-- Should return data
SELECT COUNT(*) FROM revenue_records;

-- Should return data
SELECT COUNT(*) FROM employees;
```

**Nếu queries return 0 rows:**
- Check user metadata có `tenant_id` đúng không
- Check RLS policies đã được tạo chưa
- Check data có `tenant_id = 'phuc-sang'` không

---

## BƯỚC 4: TEST BACKEND API (5 phút)

### 4.1. Test với Valid API Key

```bash
# Test employees endpoint
curl -H "X-Api-Key: 0e1fb17c04a021a4cf6a2dadf7d541cb825790704fb3e4bb9e2164613410d43b" \
  http://localhost:3000/api/data/employees

# Expected: Returns employee data (or empty array if no data)
```

### 4.2. Test WITHOUT API Key (Should Fail)

```bash
# Test without API key
curl http://localhost:3000/api/data/employees

# Expected: {"error":"Unauthorized - Valid API key required"}
```

### 4.3. Test Frontend

```bash
# Start dev server
npm run dev

# Open browser
open http://localhost:3000

# Check:
# - App loads normally
# - No console errors
# - Data displays correctly
# - Can navigate between pages
```

---

## BƯỚC 5: VERIFY EVERYTHING WORKS (5 phút)

### Checklist

- [ ] RLS enabled on all sensitive tables
- [ ] 80+ policies created
- [ ] Test user can login
- [ ] Test user can see their data
- [ ] Backend API requires API key
- [ ] Frontend loads normally
- [ ] No errors in console
- [ ] No errors in Supabase logs

### Check Supabase Logs

1. Vào: **Logs** → **API Logs**
2. Filter: Last 1 hour
3. Look for:
   - ❌ 500 errors
   - ❌ RLS policy violations
   - ✅ 200 success responses

---

## 🆘 ROLLBACK (Nếu có vấn đề)

### Option 1: Restore from Backup

1. Vào: **Settings** → **Database** → **Backups**
2. Find backup vừa tạo
3. Click: **Restore**
4. Confirm
5. Đợi restore hoàn thành (5-10 phút)

### Option 2: Disable RLS Manually

```sql
-- EMERGENCY ONLY - Disable RLS on all tables
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
```

### Option 3: Revert Git Commit

```bash
# Revert server.ts changes
git revert HEAD

# Push to production
git push origin main
```

---

## ✅ SUCCESS CRITERIA

Deployment thành công khi:

- ✅ Backend API requires API key
- ✅ RLS enabled on all tables
- ✅ Policies created and working
- ✅ Test user can access data
- ✅ Frontend loads normally
- ✅ No errors in logs

---

## 📞 SUPPORT

**Nếu gặp vấn đề:**

1. **Check logs** - Supabase Dashboard → Logs
2. **Check error message** - Đọc kỹ error
3. **Rollback if needed** - Follow rollback procedure
4. **Ask for help** - Provide error message and logs

**Documentation:**
- Full guide: `.kiro/SECURITY_DEPLOYMENT_GUIDE.md`
- Summary: `.kiro/SECURITY_FIXES_SUMMARY.md`
- Technical: `.kiro/SECURITY_FIXES_PLAN.md`

---

## 🎯 NEXT STEPS AFTER DEPLOYMENT

1. **Monitor for 24 hours** - Watch logs for errors
2. **Test all critical flows** - POS, inventory, payroll
3. **Notify team** - Inform about changes
4. **Plan Phase 2** - Frontend authentication

---

## 📝 DEPLOYMENT LOG

**Date:** _____________  
**Deployed by:** _____________  

**Checklist:**
- [ ] Database backed up
- [ ] Migration 002 run successfully
- [ ] Migration 003 run successfully
- [ ] Test user created
- [ ] Backend API tested
- [ ] Frontend tested
- [ ] No errors in logs

**Issues encountered:**
_____________________________________________

**Resolution:**
_____________________________________________

**Sign-off:** _____________
