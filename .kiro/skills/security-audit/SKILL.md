---
name: Security Audit
description: Comprehensive security review for CFO Brain 4.0 focusing on critical vulnerabilities
keywords: security, audit, vulnerability, authentication, RLS, Supabase
---

# Security Audit Skill

## Purpose
Perform comprehensive security review of CFO Brain 4.0 application, focusing on authentication, authorization, data protection, and financial data security.

## When to Use
- Before production deployment
- After adding authentication/authorization features
- When modifying API endpoints
- After Supabase schema changes
- Before handling sensitive financial data

## Critical Security Checks

### 1. Authentication Bypass (P0 - CRITICAL)

**Check:** Verify no loopback address bypass in `server.ts`

```bash
# Search for dangerous patterns
grep -r "127.0.0.1\|::1" server.ts
grep -r "remoteAddress" server.ts
```

**What to Look For:**
- ❌ Any code that skips auth based on IP address
- ❌ Trusting `X-Forwarded-For` without validation
- ❌ Different auth logic for "local" vs "remote" requests

**Action:** Remove ALL IP-based auth bypass logic immediately.

### 2. Supabase RLS Policies (P0 - CRITICAL)

**Check:** Verify RLS enabled on sensitive tables

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'payroll_records', 'revenue_records', 'expense_records');

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

**Required Tables with RLS:**
- ✅ `employees` - Contains salary and personal data
- ✅ `payroll_records` - Contains compensation data
- ✅ `revenue_records` - Contains business financial data
- ✅ `expense_records` - Contains spending data
- ✅ `customers` - Contains customer personal data
- ✅ `suppliers` - Contains supplier data

**Action:** Enable RLS and create restrictive policies for each table.

### 3. Storage Bucket Security

**Check:** Verify RLS on Storage buckets

```sql
-- Check storage bucket policies
SELECT * FROM storage.buckets WHERE id = 'purchase-invoices';
SELECT * FROM storage.objects WHERE bucket_id = 'purchase-invoices' LIMIT 5;
```

**Required Policies:**
- ✅ `purchase-invoices` bucket - Authenticated users only
- ✅ File upload size limits
- ✅ File type restrictions (PDF, images only)

### 4. Hardcoded Secrets

**Check:** Search for hardcoded credentials

```bash
# Search for common secret patterns
grep -r "password.*=.*['\"]" --include="*.ts" --include="*.tsx" .
grep -r "api[_-]?key.*=.*['\"]" --include="*.ts" --include="*.tsx" .
grep -r "secret.*=.*['\"]" --include="*.ts" --include="*.tsx" .
grep -r "token.*=.*['\"]" --include="*.ts" --include="*.tsx" .

# Check for Supabase keys in code
grep -r "supabase.*anon.*key" --include="*.ts" --include="*.tsx" .
```

**What to Look For:**
- ❌ Hardcoded passwords
- ❌ API keys in source code
- ❌ JWT secrets in code
- ❌ Database credentials

**Action:** Move all secrets to `.env.local` and add to `.gitignore`.

### 5. Input Validation

**Check:** Verify input sanitization

```typescript
// ❌ BAD - No validation
const { data } = await supabase
  .from('products')
  .select()
  .eq('name', userInput); // SQL injection risk!

// ✅ GOOD - Validated input
const sanitizedInput = DOMPurify.sanitize(userInput);
const { data } = await supabase
  .from('products')
  .select()
  .eq('name', sanitizedInput);
```

**Check These Areas:**
- ✅ Search queries sanitized
- ✅ User input validated before DB queries
- ✅ File uploads validated (type, size)
- ✅ API parameters validated

### 6. CORS Configuration

**Check:** Verify CORS not too permissive

```typescript
// ❌ BAD - Allows all origins
app.use(cors({ origin: '*' }));

// ✅ GOOD - Specific origins
app.use(cors({ 
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true 
}));
```

### 7. Rate Limiting

**Check:** Verify rate limiting on API endpoints

```typescript
// ✅ GOOD - Rate limiting enabled
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 8. HTTPS Enforcement

**Check:** Verify HTTPS in production

```typescript
// ✅ GOOD - Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

## Security Audit Checklist

Run through this checklist before deployment:

### Authentication & Authorization
- [ ] No IP-based auth bypass in `server.ts`
- [ ] All API endpoints require authentication
- [ ] Role-based access control implemented
- [ ] Session management secure (httpOnly cookies)
- [ ] Password hashing used (bcrypt/argon2)

### Database Security
- [ ] RLS enabled on all sensitive tables
- [ ] RLS policies tested and working
- [ ] No SQL injection vulnerabilities
- [ ] Prepared statements used for queries
- [ ] Database credentials in environment variables

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] HTTPS enforced in production
- [ ] Secure headers configured (Helmet.js)
- [ ] CORS properly configured
- [ ] XSS protection enabled

### API Security
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Output encoding to prevent XSS
- [ ] CSRF protection enabled
- [ ] API keys rotated regularly

### File Upload Security
- [ ] File type validation
- [ ] File size limits enforced
- [ ] Virus scanning (if applicable)
- [ ] Storage bucket policies configured
- [ ] No executable files allowed

### Secrets Management
- [ ] No hardcoded secrets in code
- [ ] `.env.local` in `.gitignore`
- [ ] Secrets rotated regularly
- [ ] Different secrets for dev/staging/prod
- [ ] Secret scanning in CI/CD

### Logging & Monitoring
- [ ] Security events logged
- [ ] Failed login attempts tracked
- [ ] Suspicious activity alerts configured
- [ ] Audit trail for sensitive operations
- [ ] Log retention policy defined

## Running Security Audit

```bash
# Run automated security audit
npm run security:audit

# Check for known vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

## Post-Audit Actions

1. **Document findings** in `docs/security/audit-YYYY-MM-DD.md`
2. **Prioritize fixes** by severity (P0 → P1 → P2)
3. **Create tickets** for each issue
4. **Fix P0 issues** before deployment
5. **Schedule P1/P2 fixes** in next sprint
6. **Re-audit** after fixes applied

## Emergency Response

If vulnerability discovered in production:

1. **Assess impact** - What data is at risk?
2. **Contain** - Disable affected feature if needed
3. **Fix** - Deploy patch immediately
4. **Notify** - Inform affected users if data breach
5. **Document** - Write incident report
6. **Prevent** - Add tests to prevent recurrence

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Security Best Practices](https://react.dev/learn/security)
