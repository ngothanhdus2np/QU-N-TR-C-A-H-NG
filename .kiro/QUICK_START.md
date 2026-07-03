# ⚡ QUICK START - Deploy Security Fixes

**Time:** 15-30 phút  
**Status:** ✅ Ready to deploy

---

## 🚀 3 BƯỚC ĐƠN GIẢN

### 1️⃣ BACKUP DATABASE (5 phút)

```
1. Mở: https://supabase.com/dashboard/project/[PROJECT-REF-DA-GO-DO-RO-RI-XEM-SEC-SECRET-01]
2. Settings → Database → Backups
3. Click "Create Backup"
4. Đợi hoàn thành
```

### 2️⃣ RUN SQL MIGRATIONS (10 phút)

```
1. Mở: SQL Editor trong Supabase Dashboard
2. Copy nội dung file: supabase_migrations/002_enable_rls_on_sensitive_tables.sql
3. Paste vào SQL Editor → Click RUN
4. Copy nội dung file: supabase_migrations/003_tenant_isolation_policies.sql
5. Paste vào SQL Editor → Click RUN
```

**Expected:** Thấy message "All tables have RLS enabled ✓" và "Policy count looks good ✓"

### 3️⃣ CREATE TEST USER (5 phút)

```
1. Authentication → Users → Add User
2. Email: admin@phuc-sang.com
3. Password: (tạo password mạnh)
4. Auto Confirm: ✅
5. Click vào user → Edit User Metadata:
   {
     "tenant_id": "phuc-sang",
     "branch_id": "main",
     "role": "admin"
   }
```

---

## ✅ VERIFY

```bash
# Test backend
curl -H "X-Api-Key: 0e1fb17c04a021a4cf6a2dadf7d541cb825790704fb3e4bb9e2164613410d43b" \
  http://localhost:3000/api/data/employees

# Should return data

# Test without key (should fail)
curl http://localhost:3000/api/data/employees

# Should return: {"error":"Unauthorized - Valid API key required"}
```

---

## 🆘 ROLLBACK

Nếu có vấn đề:
```
Settings → Database → Backups → Restore
```

---

## 📚 FULL DOCS

- **Quick:** `.kiro/DEPLOY_NOW.md` (this file expanded)
- **Full:** `.kiro/SECURITY_DEPLOYMENT_GUIDE.md`
- **Summary:** `.kiro/SECURITY_FIXES_SUMMARY.md`

---

**Ready?** Follow `.kiro/DEPLOY_NOW.md` for detailed instructions.
