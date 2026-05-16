# 📊 BÁO CÁO ĐỒNG BỘ SUPABASE

**Ngày kiểm tra:** 14/05/2026  
**Trạng thái:** ⚠️ **CÓ DỮ LIỆU CHƯA ĐỒNG BỘ**

---

## ✅ CÁC BẢNG ĐÃ CÓ TRONG SUPABASE

### 1. Nhân sự & Lương
- ✅ `employees` - Nhân viên
- ✅ `salary_policies` - Chính sách lương
- ✅ `attendance_records` - Chấm công
- ✅ `overtime_records` - Tăng ca
- ✅ `sales_records` - Doanh số bán hàng
- ✅ `shortage_records` - Thiếu hụt
- ✅ `advance_records` - Tạm ứng
- ✅ `payroll_records` - Bảng lương
- ✅ `staff_performance` - Hiệu suất nhân viên

### 2. Doanh thu & Chi phí
- ✅ `revenue_records` - Doanh thu cửa hàng
- ✅ `expense_records` - Chi phí
- ✅ `product_groups` - Nhóm sản phẩm
- ✅ `product_group_revenue` - Doanh thu theo nhóm

### 3. Shopee
- ✅ `shopee_revenue_records` - Doanh thu Shopee
- ✅ `shopee_product_group_revenue` - Doanh thu nhóm SP Shopee
- ✅ `shopee_source_data` - Dữ liệu nguồn Shopee
- ✅ `shopee_inventory_in` - Nhập kho Shopee
- ✅ `shopee_inventory_out` - Xuất kho Shopee

### 4. POS System
- ✅ `pos_products` - Sản phẩm
- ✅ `pos_orders` - Đơn hàng
- ✅ `pos_customers` - Khách hàng
- ✅ `inventory_transactions` - Giao dịch kho

### 5. Nhà cung cấp
- ✅ `suppliers` - Nhà cung cấp
- ✅ `supplier_debts` - Công nợ NCC

### 6. Khác
- ✅ `knowledge_base` - Kiến thức nội bộ
- ✅ `promotions` - Chương trình khuyến mãi
- ✅ `brand_profile` - Thông tin thương hiệu
- ✅ `audit_logs` - Nhật ký audit
- ✅ `system_configs` - Cấu hình hệ thống (app_state)

---

## ⚠️ DỮ LIỆU CHƯA ĐỒNG BỘ LÊN SUPABASE

### 1. **Cashflow (Dòng tiền)** ❌
**AppData field:** `cashflow: CashFlowRecord[]`  
**Supabase table:** CHƯA CÓ

**Cấu trúc cần tạo:**
```sql
CREATE TABLE IF NOT EXISTS cashflow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Inflow' | 'Outflow'
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_cashflow_date ON cashflow_records(date);
CREATE INDEX idx_cashflow_type ON cashflow_records(type);
```

**Cần thêm vào:**
- `TABLE_MAP` trong `apiService.ts`: `cashflow: 'cashflow_records'`
- `sanitizeItem()` trong `apiService.ts`
- `fetchAllData()` trong `apiService.ts`

### 2. **Recurring Expenses (Chi phí định kỳ)** ❌
**AppData field:** `recurringExpenses: RecurringExpense[]`  
**Supabase table:** CHƯA CÓ

**Cấu trúc cần tạo:**
```sql
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  frequency TEXT NOT NULL, -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated TEXT,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX idx_recurring_expenses_frequency ON recurring_expenses(frequency);
```

**Cần thêm vào:**
- `TABLE_MAP`: `recurringExpenses: 'recurring_expenses'`
- `sanitizeItem()` handler
- `fetchAllData()` query

### 3. **Config Data (Dữ liệu cấu hình)** ⚠️ PARTIAL

Các config sau được lưu trong `system_configs` (app_state) nhưng **KHÔNG** được fetch/sync tự động:

#### A. `holidays: Holiday[]` ⚠️
**Lưu ở:** `system_configs` với key `'holidays'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### B. `violationTypes: ViolationType[]` ⚠️
**Lưu ở:** `system_configs` với key `'violation_types'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### C. `violationOccurrences: ViolationOccurrence[]` ⚠️
**Lưu ở:** `system_configs` với key `'violation_occurrences'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### D. `customDeductions: string[]` ⚠️
**Lưu ở:** `system_configs` với key `'custom_penalties'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### E. `responsibilityApprovals: ResponsibilityApproval[]` ⚠️
**Lưu ở:** `system_configs` với key `'responsibility_approvals'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### F. `tetCampaign: TetCampaign` ⚠️
**Lưu ở:** `system_configs` với key `'tet_campaign'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### G. `expenseCategories: ExpenseCategory[]` ⚠️
**Lưu ở:** `system_configs` với key `'expense_categories'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### H. `dailyBreakEvenConfig: DailyBreakEvenConfig` ⚠️
**Lưu ở:** `system_configs` với key `'daily_break_even_config'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### I. `posPaymentSettings: POSPaymentSettings` ⚠️
**Lưu ở:** `system_configs` với key `'pos_payment_settings'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### J. `posInventorySettings: POSInventorySettings` ⚠️
**Lưu ở:** `system_configs` với key `'pos_inventory_settings'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### K. `shopeeCosts: ShopeeCostConfig` ⚠️
**Lưu ở:** `system_configs` với key `'shopee_costs'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

#### L. `dailyAdsConfig: Record<string, number>` ⚠️
**Lưu ở:** `system_configs` với key `'daily_ads_config'`  
**Trạng thái:** Có trong code nhưng không được sync real-time

---

## 📋 HÀNH ĐỘNG CẦN THỰC HIỆN

### 🔴 PRIORITY 1: Tạo bảng còn thiếu

#### 1. Tạo bảng `cashflow_records`

**File:** `supabase_setup.sql` (thêm vào cuối file)

```sql
-- =============================================================================
-- CASHFLOW RECORDS (2026-05-14)
-- Theo dõi dòng tiền vào/ra
-- =============================================================================
CREATE TABLE IF NOT EXISTS cashflow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Inflow' | 'Outflow'
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  reference_id TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashflow_date ON cashflow_records(date);
CREATE INDEX IF NOT EXISTS idx_cashflow_type ON cashflow_records(type);
CREATE INDEX IF NOT EXISTS idx_cashflow_branch ON cashflow_records(branch_id);

-- RLS Policies
ALTER TABLE cashflow_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashflow_authenticated_read"
  ON cashflow_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cashflow_authenticated_insert"
  ON cashflow_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cashflow_authenticated_update"
  ON cashflow_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cashflow_authenticated_delete"
  ON cashflow_records FOR DELETE
  TO authenticated
  USING (true);
```

#### 2. Tạo bảng `recurring_expenses`

```sql
-- =============================================================================
-- RECURRING EXPENSES (2026-05-14)
-- Chi phí định kỳ tự động
-- =============================================================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  frequency TEXT NOT NULL, -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated TEXT,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_frequency ON recurring_expenses(frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_branch ON recurring_expenses(branch_id);

-- RLS Policies
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_expenses_authenticated_read"
  ON recurring_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "recurring_expenses_authenticated_insert"
  ON recurring_expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "recurring_expenses_authenticated_update"
  ON recurring_expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "recurring_expenses_authenticated_delete"
  ON recurring_expenses FOR DELETE
  TO authenticated
  USING (true);
```

### 🟡 PRIORITY 2: Cập nhật code

#### 1. Cập nhật `apiService.ts`

**Thêm vào TABLE_MAP:**
```typescript
export const TABLE_MAP: Record<string, string> = {
  // ... existing mappings
  cashflow: 'cashflow_records',
  recurringExpenses: 'recurring_expenses',
};
```

**Thêm vào sanitizeItem():**
```typescript
if (key === 'cashflow')
  return {
    id: item.id,
    date: item.date,
    type: item.type,
    category: item.category,
    amount: n(item.amount),
    description: item.description,
    reference_id: item.referenceId,
  };

if (key === 'recurringExpenses')
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    amount: n(item.amount),
    frequency: item.frequency,
    start_date: item.startDate,
    end_date: item.endDate,
    last_generated: item.lastGenerated,
    is_active: !!item.isActive,
    description: item.description,
  };
```

**Thêm vào fetchAllData():**
```typescript
const [
  // ... existing queries
  cashflow,
  recurringExpenses,
] = await Promise.all([
  // ... existing queries
  supabase
    .from('cashflow_records')
    .select('*')
    .order('date', { ascending: false })
    .limit(DEFAULT_LIMIT),
  supabase
    .from('recurring_expenses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(DEFAULT_META_LIMIT),
]);

// ... in return statement
return {
  data: {
    // ... existing data
    cashflow: cashflow.data,
    recurringExpenses: recurringExpenses.data,
  },
  // ...
};
```

### 🟢 PRIORITY 3: Tối ưu Config Sync

**Vấn đề hiện tại:** Config data được lưu trong `system_configs` nhưng chỉ được load lần đầu, không real-time sync.

**Giải pháp:**

#### Option 1: Giữ nguyên (Recommended)
- Config data ít thay đổi, không cần real-time
- Chỉ reload khi user refresh page
- Tiết kiệm bandwidth

#### Option 2: Tách thành bảng riêng
- Tạo bảng riêng cho từng loại config
- Enable real-time subscription
- Tốn nhiều queries hơn

**Khuyến nghị:** Giữ nguyên cách hiện tại, chỉ cần đảm bảo `upsertConfig()` hoạt động đúng.

---

## 📊 TỔNG KẾT

### Trạng thái đồng bộ:
- ✅ **Đã đồng bộ:** 28/30 bảng chính (93%)
- ❌ **Chưa đồng bộ:** 2 bảng (cashflow, recurringExpenses)
- ⚠️ **Partial sync:** 12 config objects (lưu trong system_configs)

### Mức độ ưu tiên:
1. 🔴 **HIGH:** Tạo 2 bảng còn thiếu (cashflow, recurringExpenses)
2. 🟡 **MEDIUM:** Cập nhật code để sync 2 bảng mới
3. 🟢 **LOW:** Tối ưu config sync (optional)

### Thời gian ước tính:
- Tạo bảng: 5 phút
- Cập nhật code: 15 phút
- Test: 10 phút
- **Tổng:** ~30 phút

---

## 🚀 SCRIPT NHANH

Chạy script này trong Supabase SQL Editor để tạo 2 bảng còn thiếu:

```sql
-- Cashflow Records
CREATE TABLE IF NOT EXISTS cashflow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  reference_id TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashflow_date ON cashflow_records(date);
CREATE INDEX IF NOT EXISTS idx_cashflow_type ON cashflow_records(type);
CREATE INDEX IF NOT EXISTS idx_cashflow_branch ON cashflow_records(branch_id);

ALTER TABLE cashflow_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON cashflow_records TO authenticated;

CREATE POLICY "cashflow_authenticated_all" ON cashflow_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recurring Expenses
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  frequency TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated TEXT,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_frequency ON recurring_expenses(frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_branch ON recurring_expenses(branch_id);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_expenses TO authenticated;

CREATE POLICY "recurring_expenses_authenticated_all" ON recurring_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reload schema
NOTIFY pgrst, 'reload schema';
```

---

**Kết luận:** Hệ thống đã đồng bộ 93% dữ liệu. Chỉ cần tạo 2 bảng còn thiếu và cập nhật code là hoàn tất 100%! 🎯
