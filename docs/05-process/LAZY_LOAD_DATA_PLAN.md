# Kế hoạch Lazy Load Data — CFO Brain 4.0

> **Mục tiêu**: Giảm thời gian tải trang lần đầu từ ~8–10s xuống < 3s bằng cách chỉ tải dữ liệu mà route hiện tại cần, defer phần còn lại.
> **Ngày lập**: 2026-06-23
> **Trạng thái**: Chờ triển khai

---

## 1. Hiện trạng — Vấn đề cần giải quyết

### 1.1. Kiến trúc hiện tại

```
App mount
  └─ useAppData.fetchData()
       └─ apiService.fetchAllData()
            └─ Promise.all(30 queries)     ← TẤT CẢ bảng load đồng thời
                 ├─ fetchAllRows('pos_products')     ~14,000 rows, paginated
                 ├─ fetchRecentPosOrders()            ~3,600 rows (60 ngày)
                 ├─ fetchAllRows('revenue_records')   ~1,200 rows, paginated
                 ├─ 27 bảng khác...
                 └─ shopee_inventory_out              đã defer (Promise.resolve([]))
```

**File liên quan:**
- `services/apiService.ts` — `fetchAllData()` (dòng ~807–935)
- `hooks/useAppData.ts` — `fetchData()` (dòng ~454–520)
- `hooks/appReducer.ts` — `SET_DATA` action
- `services/appDataCache.ts` — IndexedDB cache

### 1.2. Các tối ưu đã làm

| Tối ưu | Ngày | Kết quả |
|---|---|---|
| `POS_ORDER_BOOTSTRAP_DAYS = 60` | 2026-06-23 | Giảm pos_orders từ 69k → 3.6k rows |
| `skipPosProducts` (cache) | trước đó | Bỏ qua fetch products nếu đã có cache |
| `shopee_inventory_out` defer | trước đó | Không fetch trong Promise.all chính |
| `POS_PRODUCT_BOOTSTRAP_COLUMNS` | trước đó | Chỉ fetch cột cần thiết (không lấy `*`) |
| Lazy load routes | 2026-06-23 | 36 component chuyển sang React.lazy |

### 1.3. Bottleneck còn lại

| Bảng | Rows | Phương pháp | Thời gian ước tính |
|---|---|---|---|
| `pos_products` | ~14,000 | `fetchAllRows` paginated | ~3–4s |
| `revenue_records` | ~1,200 | `fetchAllRows` paginated | ~1s |
| `pos_orders` (60 ngày) | ~3,600 | `fetchRecentPosOrders` paginated | ~1.5s |
| `inventory_transactions` | ~2,000 | single query | ~0.5s |
| 26 bảng còn lại | < 500 mỗi bảng | single query | ~0.3s mỗi bảng, tổng ~2s |

**Tổng Promise.all**: ~4–5s (bị bottleneck bởi bảng chậm nhất: `pos_products`)

---

## 2. Chiến lược — 4 Phase

### Tổng quan

```
Phase 1: Tách fetchAllData thành 2 nhóm (Critical + Deferred)
Phase 2: Route-based data loading (chỉ load bảng route cần)
Phase 3: Prefetch thông minh (dự đoán route tiếp theo)
Phase 4: Incremental sync (chỉ tải delta thay vì full reload)
```

### Ước tính impact

| Phase | Effort | Thời gian tải sau | Giảm |
|---|---|---|---|
| Hiện tại | — | ~8–10s | — |
| Phase 1 | 1–2 ngày | ~3–4s | -60% |
| Phase 2 | 3–5 ngày | ~1–2s | -80% |
| Phase 3 | 1–2 ngày | ~1s (perceived) | -90% |
| Phase 4 | 3–5 ngày | < 1s (repeat load) | -95% |

---

## 3. Phase 1 — Tách Critical vs Deferred (Ưu tiên cao nhất)

> **Mục tiêu**: App hiện nội dung trong 3s, defer data ít dùng ra sau.
> **Effort**: 1–2 ngày
> **Rủi ro**: Thấp — không thay đổi cấu trúc AppData, chỉ thay đổi thứ tự fetch

### 3.1. Phân loại bảng

**CRITICAL (load ngay — 8 bảng):** Dữ liệu mà trang mặc định (POS hoặc Overview) cần ngay

| Bảng | Lý do | Rows |
|---|---|---|
| `pos_products` | POS + Hàng hóa cần ngay | ~14,000 |
| `pos_orders` (60 ngày) | POS + Overview + Báo cáo | ~3,600 |
| `pos_customers` | POS checkout | ~250 |
| `employees` | POS staff selector | ~20 |
| `system_configs` | Settings toàn app | ~15 |
| `product_groups` | POS nhóm hàng | ~30 |
| `brand_profile` | Tên cửa hàng | 1 |
| `salary_policies` | Payroll config | ~10 |

**DEFERRED (load background sau 2s — 22 bảng):**

| Nhóm | Bảng | Khi nào cần |
|---|---|---|
| Tài chính | `revenue_records`, `expense_records`, `cashflow_records`, `recurring_expenses` | Tab Doanh thu, Chi phí, Sổ quỹ |
| Nhân sự | `attendance_records`, `overtime_records`, `sales_records`, `shortage_records`, `advance_records`, `payroll_records`, `staff_performance` | Tab Nhân sự, Lương |
| Shopee | `shopee_revenue_records`, `shopee_product_group_revenue`, `shopee_source_data`, `shopee_inventory_in` | Tab Bán online |
| Kho | `inventory_transactions`, `suppliers`, `supplier_debts` | Tab Mua hàng, Kiểm kho |
| Khác | `knowledge_base`, `promotions`, `product_group_revenue` | Tab SOP, Khuyến mãi |

### 3.2. Thay đổi code

**File: `services/apiService.ts`**

```typescript
// Thêm 2 method mới, giữ nguyên fetchAllData cũ (backward compatible)

async fetchCriticalData(options: { skipPosProducts?: boolean } = {}) {
  const skippedResult = { data: [], error: null };
  const [
    employees, policies, posProducts, posOrders, posCustomers,
    configs, pGroups, brand,
  ] = await Promise.all([
    supabase.from('employees').select('*').limit(500),
    supabase.from('salary_policies').select('*'),
    options.skipPosProducts
      ? skippedResult
      : fetchAllRows('pos_products', 'id', undefined, POS_PRODUCT_BOOTSTRAP_COLUMNS),
    fetchRecentPosOrders(),
    supabase.from('pos_customers').select('*').limit(2000),
    supabase.from('system_configs').select('*').limit(DEFAULT_META_LIMIT),
    supabase.from('product_groups').select('*').limit(DEFAULT_META_LIMIT),
    supabase.from('brand_profile').select('*').limit(1),
  ]);
  // ... return partial AppData
},

async fetchDeferredData() {
  const [
    revenue, expenses, attendance, overtime, sales,
    shortages, advances, payroll, perf, kb,
    pGroupRev, promotions, shopeeRevenue, shopeePGroupRev,
    shopeeSource, shopeeIn, transactions, suppliers,
    supplierDebts, cashflow, recurringExpenses,
  ] = await Promise.all([
    // ... 21 bảng còn lại
  ]);
  // ... return remaining AppData fields
},
```

**File: `hooks/useAppData.ts`**

```typescript
const fetchData = useCallback(async () => {
  // Bước 1: Load critical — app hiện UI ngay
  const { data: critical } = await apiService.fetchCriticalData({ skipPosProducts });
  dispatch({ type: 'SET_DATA', payload: critical });

  // Bước 2: Load deferred — chạy background, merge vào state
  const { data: deferred } = await apiService.fetchDeferredData();
  dispatch({ type: 'MERGE_DATA', payload: deferred });
}, []);
```

**File: `hooks/appReducer.ts`**

```typescript
// Thêm action MERGE_DATA (merge vào state hiện tại, không replace)
case 'MERGE_DATA':
  return {
    ...state,
    data: { ...state.data, ...action.payload },
    deferredLoaded: true,
  };
```

### 3.3. UX — Loading state

Khi deferred data chưa load xong, các tab tương ứng hiện skeleton/spinner:

```typescript
// Trong renderContent(), kiểm tra trước khi render
case 'expenses':
  if (!deferredLoaded) return <TableSkeleton />;
  return <ExpenseManager ... />;
```

### 3.4. Kiểm tra sau Phase 1

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — all tests pass
- [ ] Trang POS mở < 3s (đo bằng console.time)
- [ ] Navigate sang tab Doanh thu — data hiện ngay (đã load background)
- [ ] Navigate sang tab Doanh thu TRƯỚC khi deferred load xong — hiện skeleton, rồi tự hiện data

---

## 4. Phase 2 — Route-based Data Loading (Ưu tiên trung bình)

> **Mục tiêu**: Mỗi route chỉ load đúng bảng nó cần, không load thừa.
> **Effort**: 3–5 ngày
> **Rủi ro**: Trung bình — cần refactor cách truyền data xuống component

### 4.1. Data dependency map

Định nghĩa rõ mỗi route cần bảng nào:

```typescript
// services/routeDataMap.ts
export const ROUTE_DATA_DEPS: Record<string, (keyof AppData)[]> = {
  'pos':              ['posProducts', 'posCustomers', 'posOrders', 'employees', 'productGroups'],
  'goods':            ['posProducts', 'productGroups', 'inventoryTransactions', 'posOrders', 'suppliers'],
  'overview':         ['revenue', 'expenses', 'posOrders', 'employees', 'payroll'],
  'customers':        ['posCustomers', 'posOrders', 'customerDebtHistory'],
  'suppliers':        ['suppliers', 'supplierDebts', 'inventoryTransactions'],
  'store-revenue':    ['revenue', 'productGroups', 'productGroupRevenue'],
  'shopee-revenue':   ['shopeeRevenue', 'shopeeProductGroupRevenue', 'shopeeSourceData', 'shopeeInventoryIn', 'shopeeInventoryOut'],
  'expenses':         ['expenses', 'expenseCategories', 'revenue', 'shopeeProductGroupRevenue', 'payroll', 'recurringExpenses'],
  'staff':            ['employees', 'salaryPolicies', 'staffPerformance'],
  'payroll':          ['employees', 'salaryPolicies', 'attendance', 'overtime', 'sales', 'shortages', 'advances', 'payroll'],
  'cash-ledger':      ['cashflow', 'expenses', 'posOrders'],
  'goods-purchase':   ['posProducts', 'suppliers', 'supplierDebts', 'inventoryTransactions'],
  'goods-audit':      ['posProducts', 'inventoryTransactions'],
  'order-invoices':   ['posOrders', 'posCustomers', 'posProducts', 'revenue', 'employees'],
  // ... các route khác
};
```

### 4.2. Hook `useRouteData`

```typescript
// hooks/useRouteData.ts
export function useRouteData(activeTab: string) {
  const deps = ROUTE_DATA_DEPS[activeTab] || [];
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const missing = deps.filter(k => !loadedKeys.has(k));
    if (missing.length === 0) return;

    apiService.fetchTables(missing).then(result => {
      dispatch({ type: 'MERGE_DATA', payload: result });
      setLoadedKeys(prev => new Set([...prev, ...missing]));
    });
  }, [activeTab]);

  const isReady = deps.every(k => loadedKeys.has(k));
  return { isReady };
}
```

### 4.3. Method mới trong apiService

```typescript
// Fetch chỉ các bảng được yêu cầu
async fetchTables(keys: (keyof AppData)[]) {
  const queries = keys.map(key => {
    const tableName = TABLE_MAP[key];
    if (key === 'posProducts') return fetchAllRows('pos_products', 'id', undefined, POS_PRODUCT_BOOTSTRAP_COLUMNS);
    if (key === 'posOrders') return fetchRecentPosOrders();
    // ... mapping cho từng bảng
    return supabase.from(tableName).select('*').limit(DEFAULT_LIMIT);
  });
  const results = await Promise.all(queries);
  // ... build partial AppData từ results
}
```

### 4.4. Thay đổi Component

```typescript
// MainContent.tsx
const MainContent = ({ activeTab, data, ... }) => {
  const { isReady } = useRouteData(activeTab);

  // Trong renderContent()
  case 'expenses':
    if (!isReady) return <TableSkeleton />;
    return <ExpenseManager ... />;
};
```

### 4.5. Kiểm tra sau Phase 2

- [ ] Mở POS — chỉ fetch 5 bảng (verify qua Network tab)
- [ ] Navigate sang Doanh thu — fetch thêm 3 bảng (chỉ bảng chưa có)
- [ ] Navigate lại POS — không fetch thêm (đã cache)
- [ ] Tổng thời gian tải initial < 2s

---

## 5. Phase 3 — Prefetch thông minh (Ưu tiên thấp)

> **Mục tiêu**: Preload data của route user sắp vào, perceived load time = 0.
> **Effort**: 1–2 ngày
> **Rủi ro**: Thấp — chỉ thêm behavior, không thay đổi logic

### 5.1. Prefetch khi hover sidebar

```typescript
// components/Sidebar.tsx
const handleMouseEnter = (tab: string) => {
  // Preload data sau 200ms hover (tránh trigger quá nhiều)
  const timer = setTimeout(() => {
    const deps = ROUTE_DATA_DEPS[tab] || [];
    const missing = deps.filter(k => !loadedKeys.has(k));
    if (missing.length > 0) {
      apiService.fetchTables(missing); // fire-and-forget
    }
  }, 200);
  return () => clearTimeout(timer);
};
```

### 5.2. Prefetch route phổ biến

Dựa vào usage pattern (POS → Hàng hóa → Khách hàng), auto-prefetch khi idle:

```typescript
// Sau khi critical data load xong
requestIdleCallback(() => {
  // Prefetch top 3 routes phổ biến nhất
  const popularRoutes = ['goods', 'customers', 'overview'];
  const allDeps = [...new Set(popularRoutes.flatMap(r => ROUTE_DATA_DEPS[r] || []))];
  apiService.fetchTables(allDeps.filter(k => !loadedKeys.has(k)));
});
```

---

## 6. Phase 4 — Incremental Sync (Ưu tiên thấp, effort cao)

> **Mục tiêu**: Lần load tiếp theo chỉ tải rows thay đổi kể từ lần cuối.
> **Effort**: 3–5 ngày
> **Rủi ro**: Cao — cần thêm `updated_at` column, cần xử lý delete

### 6.1. Yêu cầu

- Bảng cần có `updated_at` column (trigger `set_updated_at`)
- Client lưu `lastSyncTimestamp` per table
- Fetch: `WHERE updated_at > lastSyncTimestamp`
- Xử lý deleted rows: soft delete (`deleted_at`) hoặc changelog table

### 6.2. Thay đổi SQL

```sql
-- Thêm updated_at cho các bảng chưa có
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
-- ... các bảng khác

-- Trigger tự động cập nhật
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pos_products_updated_at
  BEFORE UPDATE ON pos_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 6.3. Incremental fetch

```typescript
async fetchTableIncremental(key: keyof AppData, since: string) {
  const tableName = TABLE_MAP[key];
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true });

  return { data, error, timestamp: new Date().toISOString() };
}
```

### 6.4. Lưu ý

- Phase này phức tạp và có thể gây bug nếu không xử lý edge case (xóa row, conflict merge)
- Chỉ nên làm SAU khi Phase 1–3 đã ổn định
- Ưu tiên cho bảng lớn nhất (`pos_products`, `pos_orders`)

---

## 7. Thứ tự triển khai đề xuất

| # | Việc | Phase | Effort | Priority |
|---|---|---|---|---|
| 1 | Tách `fetchAllData` → `fetchCriticalData` + `fetchDeferredData` | 1 | 1 ngày | 🔴 P0 |
| 2 | Thêm `MERGE_DATA` action vào appReducer | 1 | 0.5 ngày | 🔴 P0 |
| 3 | Cập nhật `useAppData.fetchData()` gọi 2 bước | 1 | 0.5 ngày | 🔴 P0 |
| 4 | Thêm loading state cho tab chưa có deferred data | 1 | 0.5 ngày | 🔴 P0 |
| 5 | Tạo `ROUTE_DATA_DEPS` map | 2 | 0.5 ngày | 🟠 P1 |
| 6 | Tạo `apiService.fetchTables()` method | 2 | 1 ngày | 🟠 P1 |
| 7 | Tạo `useRouteData` hook | 2 | 1 ngày | 🟠 P1 |
| 8 | Refactor `useAppData` dùng route-based loading | 2 | 2 ngày | 🟠 P1 |
| 9 | Prefetch on hover + idle prefetch | 3 | 1 ngày | 🔵 P2 |
| 10 | Incremental sync (SQL + client) | 4 | 3–5 ngày | 🔵 P2 |

---

## 8. Rủi ro và giải pháp

| Rủi ro | Mức độ | Giải pháp |
|---|---|---|
| Component render trước khi data load xong → crash | Cao | Kiểm tra `isReady` + fallback skeleton trước khi render |
| Race condition: user navigate nhanh → data merge sai thứ tự | Trung bình | Dùng abort controller, cancel fetch khi route đổi |
| Cache stale: IndexedDB có data cũ, deferred chưa load | Trung bình | Luôn hiện timestamp "cập nhật lúc..." trên UI |
| `updateData` gọi trước khi data load xong | Trung bình | Queue updates, apply sau khi load xong |
| Test existing behavior bị break | Thấp | Chạy `npm test` sau mỗi thay đổi |

---

## 9. Metrics để đo thành công

| Metric | Hiện tại | Mục tiêu Phase 1 | Mục tiêu Phase 2 |
|---|---|---|---|
| Time to interactive (POS) | ~8–10s | < 3s | < 1.5s |
| Số API calls khi mở POS | 30 (tất cả bảng) | 8 (critical) | 5 (route-specific) |
| Data transferred initial | ~5MB | ~2MB | < 1MB |
| Time to navigate sang tab khác | 0s (đã có data) | 0–2s (deferred loading) | 0s (prefetched) |

---

## 10. Không làm (Out of scope)

- **Server-side rendering (SSR)**: App này là SPA offline-first, SSR không phù hợp
- **GraphQL**: Quá nhiều thay đổi infra, lợi ích không đáng
- **Supabase Realtime subscriptions cho tất cả bảng**: Tốn resource, chỉ dùng cho bảng cần real-time
- **Web Worker cho data processing**: Complexity cao, data hiện tại chưa đủ lớn để cần
