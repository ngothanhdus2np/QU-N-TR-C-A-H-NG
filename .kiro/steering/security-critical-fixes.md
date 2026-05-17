---
inclusion: auto
description: Critical security fixes based on FULL_EVALUATION_REPORT.md - must be addressed immediately
---

# Critical Security Fixes (P0)

## 🚨 CRITICAL: Auth Bypass via Loopback Check

**Status:** MUST FIX IMMEDIATELY before production deployment

**Issue:** File `server.ts` contains authentication bypass logic for loopback addresses (`127.0.0.1` or `::1`). When deployed behind a reverse proxy (Nginx) or Cloudflare Tunnel, ALL external requests appear as `127.0.0.1`, completely bypassing authentication.

**Action Required:**
- Remove ALL loopback address checks in authentication middleware
- If using `X-Forwarded-For` header, implement strict validation
- Never trust client IP for authentication decisions

**Code Pattern to Remove:**
```typescript
// ❌ DANGEROUS - Remove this pattern
if (remoteAddress === '127.0.0.1' || remoteAddress === '::1') {
  // Skip auth
}
```

## 🚨 CRITICAL: Missing Supabase RLS Policies

**Status:** MUST FIX IMMEDIATELY

**Issue:** Sensitive tables lack Row Level Security policies:
- `employees` - Contains salary and personal data
- `payroll_records` - Contains financial compensation data
- `revenue_records` - Contains business financial data

**Action Required:**
1. Enable RLS on all sensitive tables:
```sql
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;
```

2. Create restrictive policies:
```sql
-- Example: Only authenticated users can read their own data
CREATE POLICY "Users can read own employee data"
  ON employees FOR SELECT
  USING (auth.uid() = user_id);

-- Admin-only access to payroll
CREATE POLICY "Admin only payroll access"
  ON payroll_records FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
```

3. Enable RLS on Storage bucket `purchase-invoices`:
```sql
CREATE POLICY "Authenticated users can read invoices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'purchase-invoices' AND auth.role() = 'authenticated');
```

## Security Review Checklist

Before ANY deployment:
- [ ] Loopback auth bypass removed from `server.ts`
- [ ] RLS enabled on `employees`, `payroll_records`, `revenue_records`
- [ ] RLS policies created and tested
- [ ] Storage bucket policies configured
- [ ] Security audit run: `npm run security:audit`
- [ ] No hardcoded secrets in code
- [ ] Environment variables properly configured
- [ ] HTTPS enforced in production
- [ ] CORS properly configured (not `*`)
- [ ] Rate limiting enabled on API endpoints

## When Working on Auth/Security Features

ALWAYS:
1. Test with RLS enabled
2. Verify policies work as expected
3. Test from different user roles
4. Never bypass security for "convenience"
5. Document security decisions in code comments
