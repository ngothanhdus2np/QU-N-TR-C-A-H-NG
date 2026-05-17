# 🔴 SECURITY FIXES - CRITICAL PRIORITY

**Created:** 2026-05-18  
**Status:** ✅ PHASE 1 COMPLETE - Ready for deployment  
**Priority:** P0 - MUST FIX BEFORE PRODUCTION

---

## 🎯 OVERVIEW

Đã phát hiện và fix 4 vấn đề bảo mật CRITICAL:

1. ✅ **Auth bypass via loopback** - FIXED
2. ✅ **Missing RLS on sensitive tables** - FIXED (SQL ready)
3. ✅ **Weak RLS policies** - FIXED (SQL ready)
4. ⏳ **Frontend using anon key** - PLANNED (Phase 2)

---

## 1. ✅ AUTH BYPASS VIA LOOPBACK - FIXED

### Vấn đề
```typescript
// ❌ NGUY HIỂM - server.ts line 207-212
const isTrueLocalhost =
  remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';

if (isTrueLocalhost || hasValidKey) return next();
```

**Rủi ro:** Khi deploy sau reverse proxy (Nginx/Cloudflare), TẤT CẢ requests đều có `remoteAddr = 127.0.0.1`, bypass hoàn toàn authentication!

### Giải pháp
- ✅ Remove loopback check hoàn toàn
- ✅ Chỉ dùng `X-Api-Key` header cho internal services
- ✅ Implement proper JWT authentication cho users

### Files cần sửa
- [x] `server.ts` - Remove loopback check ✅
- [x] Created comprehensive security fix plan ✅
- [ ] Add JWT authentication middleware (Phase 2)
- [ ] Update all route handlers to use JWT (Phase 2)

---

## 2. ⏳ MISSING RLS ON SENSITIVE TABLES

### Vấn đề
Các bảng chứa dữ liệu nhạy cảm CHƯA có RLS:

```sql
-- ❌ Chưa enable RLS
employees           -- Lương, thông tin cá nhân
payroll_records     -- Bảng lương chi tiết
revenue_records     -- Doanh thu
expense_records     -- Chi phí
pos_customers       -- Thông tin khách hàng
suppliers           -- Thông tin nhà cung cấp
```

### Giải pháp
Tạo file SQL migration để enable RLS:

```sql
-- Enable RLS on all sensitive tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_records ENABLE ROW LEVEL SECURITY;
```

### Files cần tạo
- [x] `supabase_migrations/002_enable_rls.sql` ✅
- [x] Comprehensive migration with verification ✅

---

## 3. ⏳ WEAK RLS POLICIES

### Vấn đề
Policies hiện tại cho phép TẤT CẢ authenticated users truy cập MỌI dữ liệu:

```sql
-- ❌ NGUY HIỂM - supabase_setup.sql
CREATE POLICY "authenticated_all" 
  ON pos_products FOR ALL 
  TO authenticated 
  USING (true) WITH CHECK (true);
```

**Rủi ro:** Mọi user đăng nhập đều xem/sửa/xóa được data của nhau!

### Giải pháp
Implement tenant isolation với `tenant_id`:

```sql
-- ✅ AN TOÀN - Chỉ cho phép user xem data của tenant mình
CREATE POLICY "tenant_isolation_select" 
  ON pos_products FOR SELECT 
  TO authenticated 
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "tenant_isolation_insert" 
  ON pos_products FOR INSERT 
  TO authenticated 
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "tenant_isolation_update" 
  ON pos_products FOR UPDATE 
  TO authenticated 
  USING (tenant_id = auth.jwt() ->> 'tenant_id')
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "tenant_isolation_delete" 
  ON pos_products FOR DELETE 
  TO authenticated 
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

### Files cần tạo
- [x] `supabase_migrations/003_tenant_isolation_policies.sql` ✅
- [x] 80+ restrictive policies created ✅
- [x] Storage bucket policies updated ✅
- [x] RPC function permissions restricted ✅

---

## 4. ⏳ FRONTEND USING ANON KEY

### Vấn đề
Frontend đang dùng `SUPABASE_ANON_KEY` cho mọi operations:

```typescript
// ❌ services/supabase.ts
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Rủi ro:** 
- Anon key có quyền hạn chế, không thể enforce user-level permissions
- Không có audit trail về user nào thực hiện action

### Giải pháp
Implement Supabase Auth:

1. **Setup Supabase Auth**
```typescript
// services/auth.ts
import { supabase } from './supabase';

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
```

2. **Update Supabase client to use auth session**
```typescript
// services/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

3. **Add auth context**
```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

4. **Add login page**
```typescript
// components/auth/LoginPage.tsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch (err) {
      setError('Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Đăng nhập CFO Brain</h1>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
          >
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
};
```

5. **Protect routes**
```typescript
// App.tsx
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';

const ProtectedApp = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <MainApp />;
};

const App = () => {
  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
};
```

### Files cần tạo/sửa
- [ ] `services/auth.ts`
- [ ] `contexts/AuthContext.tsx`
- [ ] `components/auth/LoginPage.tsx`
- [ ] `App.tsx` - Add auth protection
- [ ] Update `services/supabase.ts`

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Backend Security (Week 1) ✅ COMPLETE
- [x] Remove loopback auth bypass from `server.ts` ✅
- [x] Create SQL migration to enable RLS on all tables ✅
- [x] Create SQL migration for tenant isolation policies ✅
- [x] Create comprehensive deployment guide ✅
- [ ] Test RLS policies work correctly (Ready to test)
- [ ] Deploy SQL migrations to Supabase (Ready to deploy)

### Phase 2: Authentication (Week 2)
- [ ] Create auth service
- [ ] Create auth context
- [ ] Create login page
- [ ] Add route protection
- [ ] Test authentication flow
- [ ] Add user management in Supabase dashboard

### Phase 3: Testing & Validation (Week 3)
- [ ] Test multi-tenant isolation
- [ ] Test RLS policies with different users
- [ ] Security audit with authenticated users
- [ ] Load testing with auth
- [ ] Document authentication setup

### Phase 4: Deployment (Week 4)
- [ ] Deploy to staging
- [ ] Run security audit on staging
- [ ] Fix any issues found
- [ ] Deploy to production
- [ ] Monitor for security issues

---

## 🚨 IMMEDIATE ACTIONS (TODAY) ✅ COMPLETE

1. ✅ **Remove loopback bypass** - DONE
2. ✅ **Create RLS migration** - DONE
3. ✅ **Create tenant isolation policies** - DONE
4. ✅ **Create deployment guide** - DONE
5. ⏳ **Test locally** - Ready to test
6. ⏳ **Deploy to Supabase** - Ready to deploy

---

## 📝 NOTES

- **DO NOT deploy to production** until all P0 fixes are complete
- **Test thoroughly** in staging environment first
- **Backup database** before running migrations
- **Monitor logs** after deployment for auth issues
- **Have rollback plan** ready

---

## 🔗 REFERENCES

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- Security audit skill: `.kiro/steering/security-critical-fixes.md`
