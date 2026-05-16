# 📐 ĐỀ XUẤT: LAYOUT COMPONENTS

**Ngày:** 16/05/2026  
**Người đề xuất:** User + Kiro AI  
**Trạng thái:** ❌ **REJECTED**

---

## ❌ LÝ DO REJECT

**User feedback:**
> "Refactor 20+ pages chỉ để tiết kiệm dòng code là rủi ro cao / lợi ích thấp. Không bug nào được fix, không tính năng nào được thêm. Thời gian đó dùng để fix những thứ người dùng thực sự thấy sẽ có giá trị hơn nhiều."

**Phân tích:**
- ✅ **User đúng 100%**
- ❌ Refactor 20+ pages = rủi ro cao (có thể break existing functionality)
- ❌ Lợi ích chỉ là "code đẹp hơn" - không ảnh hưởng trực tiếp đến user
- ❌ Mất 7 giờ làm việc không tạo ra giá trị cho user
- ✅ Thời gian nên dùng để fix bugs, thêm features user cần

**Bài học:**
- ⚠️ **Không refactor chỉ vì "code đẹp"**
- ✅ **Ưu tiên: User value > Developer convenience**
- ✅ **Refactor chỉ khi:** Fix performance issue, Fix bugs, hoặc enable new features
- ✅ **Hỏi trước khi refactor:** "Điều này có giúp user không?"

---

## 🎯 VẤN ĐỀ (Vẫn đúng, nhưng không đủ quan trọng)

### Phát hiện:
Rất nhiều pages trong app có **layout giống hệt nhau**, chỉ khác nội dung:

**Ví dụ:**

#### 1. DeliveryPartners.tsx
```tsx
<div className="p-6 max-w-7xl mx-auto">
  <div className="mb-6">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <Bike className="w-8 h-8 text-green-600" />
        <div>
          <h1 className="text-2xl font-bold">Đối tác giao hàng</h1>
          <p className="text-gray-600">Quản lý thông tin đối tác</p>
        </div>
      </div>
      <button>Thêm đối tác</button>
    </div>
  </div>
  {/* Stats cards */}
  {/* Content */}
</div>
```

#### 2. OrderReturns.tsx
```tsx
<div className="p-6 max-w-7xl mx-auto">
  <div className="mb-6">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-8 h-8 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold">Đơn trả hàng</h1>
          <p className="text-gray-600">Quản lý đơn hàng trả lại</p>
        </div>
      </div>
      <button>Tạo đơn trả</button>
    </div>
  </div>
  {/* Stats cards */}
  {/* Content */}
</div>
```

#### 3. ShippingOrders.tsx, OrderRepairs.tsx, PurchaseInvoices.tsx...
→ **Tất cả đều giống nhau!**

---

## 📊 PHÂN TÍCH

### Các pages có layout giống nhau:

| Page | Layout Pattern | Lines Duplicated |
|------|----------------|------------------|
| DeliveryPartners.tsx | ✅ Container + Header + Stats + Content | ~50 lines |
| OrderReturns.tsx | ✅ Container + Header + Stats + Content | ~50 lines |
| ShippingOrders.tsx | ✅ Container + Header + Stats + Content | ~50 lines |
| OrderRepairs.tsx | ✅ Container + Header + Stats + Content | ~50 lines |
| PurchaseInvoices.tsx | ✅ Container + Header + Stats + Content | ~50 lines |
| OrderInvoices.tsx | ✅ Container + Header + Stats + Content | ~50 lines |
| GoodsInternalUse.tsx | ✅ Container + Header + Stats + Content | ~50 lines |
| **Và nhiều pages khác...** | | |

**Tổng:** ~20+ pages × 50 lines = **1,000+ lines code lặp!**

---

## 💡 GIẢI PHÁP: TẠO LAYOUT COMPONENTS

### 1. PageContainer Component

**Mục đích:** Wrapper chung cho tất cả pages

```tsx
// components/shared/layout/PageContainer.tsx
interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function PageContainer({ 
  children, 
  maxWidth = '7xl',
  padding = 'md' 
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  };

  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div className={`${paddingClasses[padding]} ${maxWidthClasses[maxWidth]} mx-auto`}>
      {children}
    </div>
  );
}
```

**Usage:**
```tsx
<PageContainer maxWidth="7xl" padding="md">
  {/* Content */}
</PageContainer>
```

---

### 2. PageHeader Component

**Mục đích:** Header với icon, title, description, và action button

```tsx
// components/shared/layout/PageHeader.tsx
interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger';
  };
}

export function PageHeader({
  icon: Icon,
  iconColor = 'text-blue-600',
  title,
  description,
  action
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Icon className={`w-8 h-8 ${iconColor}`} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {description && (
              <p className="text-gray-600">{description}</p>
            )}
          </div>
        </div>
        {action && (
          <Button
            variant={action.variant || 'primary'}
            icon={action.icon}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Usage:**
```tsx
<PageHeader
  icon={Bike}
  iconColor="text-green-600"
  title="Đối tác giao hàng"
  description="Quản lý thông tin đối tác vận chuyển"
  action={{
    label: 'Thêm đối tác',
    icon: Plus,
    onClick: () => setShowModal(true),
    variant: 'success'
  }}
/>
```

---

### 3. StatsGrid Component

**Mục đích:** Grid hiển thị các stats cards

```tsx
// components/shared/layout/StatsGrid.tsx
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  valueColor?: string;
}

interface StatsGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3 | 4;
}

export function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4'
  };

  return (
    <div className={`grid grid-cols-1 ${gridCols[columns]} gap-4 mb-6`}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  iconColor = 'text-blue-500',
  valueColor = 'text-gray-900'
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${iconColor}`} />
      </div>
    </div>
  );
}
```

**Usage:**
```tsx
<StatsGrid
  columns={4}
  stats={[
    {
      label: 'Tổng đối tác',
      value: partners.length,
      icon: Bike,
      iconColor: 'text-green-500'
    },
    {
      label: 'Đang hoạt động',
      value: activePartners,
      icon: Star,
      iconColor: 'text-yellow-500',
      valueColor: 'text-green-600'
    },
    // ...
  ]}
/>
```

---

### 4. PageLayout Component (Kết hợp tất cả)

**Mục đích:** Layout hoàn chỉnh cho một page

```tsx
// components/shared/layout/PageLayout.tsx
interface PageLayoutProps {
  // Container props
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  
  // Header props
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger';
  };
  
  // Stats props (optional)
  stats?: Array<{
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    iconColor?: string;
    valueColor?: string;
  }>;
  statsColumns?: 2 | 3 | 4;
  
  // Content
  children: React.ReactNode;
}

export function PageLayout({
  maxWidth = '7xl',
  padding = 'md',
  icon,
  iconColor,
  title,
  description,
  action,
  stats,
  statsColumns = 4,
  children
}: PageLayoutProps) {
  return (
    <PageContainer maxWidth={maxWidth} padding={padding}>
      <PageHeader
        icon={icon}
        iconColor={iconColor}
        title={title}
        description={description}
        action={action}
      />
      
      {stats && stats.length > 0 && (
        <StatsGrid stats={stats} columns={statsColumns} />
      )}
      
      {children}
    </PageContainer>
  );
}
```

---

## 🔄 TRƯỚC VÀ SAU

### ❌ TRƯỚC (50+ lines):

```tsx
export default function DeliveryPartners() {
  const [searchTerm, setSearchTerm] = useState('');
  const partners: any[] = [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Bike className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Đối tác giao hàng</h1>
              <p className="text-gray-600">Quản lý thông tin đối tác vận chuyển</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus className="w-5 h-5" />
            Thêm đối tác
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng đối tác</p>
              <p className="text-2xl font-bold text-gray-900">{partners.length}</p>
            </div>
            <Bike className="w-8 h-8 text-green-500" />
          </div>
        </div>
        {/* 3 cards nữa... */}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {/* ... */}
      </div>
    </div>
  );
}
```

---

### ✅ SAU (15 lines):

```tsx
export default function DeliveryPartners() {
  const [searchTerm, setSearchTerm] = useState('');
  const partners: any[] = [];

  return (
    <PageLayout
      icon={Bike}
      iconColor="text-green-600"
      title="Đối tác giao hàng"
      description="Quản lý thông tin đối tác vận chuyển"
      action={{
        label: 'Thêm đối tác',
        icon: Plus,
        onClick: () => setShowModal(true),
        variant: 'success'
      }}
      stats={[
        { label: 'Tổng đối tác', value: partners.length, icon: Bike, iconColor: 'text-green-500' },
        { label: 'Đang hoạt động', value: activePartners, icon: Star, iconColor: 'text-yellow-500' },
        { label: 'Đơn hôm nay', value: todayOrders, icon: Package, iconColor: 'text-blue-500' },
        { label: 'Doanh thu', value: formatCurrency(revenue), icon: DollarSign, iconColor: 'text-green-500' }
      ]}
    >
      {/* Chỉ cần viết content riêng của page */}
      <div className="bg-white rounded-lg shadow">
        {/* ... */}
      </div>
    </PageLayout>
  );
}
```

**Giảm từ 50 lines → 15 lines = -70% code!**

---

## 📊 LỢI ÍCH

### 1. Giảm Code Duplication

| Metric | Trước | Sau | Cải thiện |
|--------|-------|-----|-----------|
| Lines per page | 50 lines | 15 lines | **-70%** |
| Total duplicated code | 1,000+ lines | 0 lines | **-100%** |
| Time to create new page | 30 phút | 5 phút | **-83%** |

---

### 2. Consistency (Nhất quán)

**Trước:**
- ❌ Mỗi page có padding khác nhau: `p-4`, `p-6`, `p-8`
- ❌ Max-width khác nhau: `max-w-6xl`, `max-w-7xl`
- ❌ Header style khác nhau
- ❌ Stats cards khác nhau

**Sau:**
- ✅ Tất cả pages đều giống nhau 100%
- ✅ Đổi design 1 lần → apply cho tất cả

---

### 3. Maintainability (Dễ bảo trì)

**Scenario: Đổi padding từ p-6 → p-8**

**Trước:**
```bash
# Phải sửa 20+ files
DeliveryPartners.tsx: p-6 → p-8
OrderReturns.tsx: p-6 → p-8
ShippingOrders.tsx: p-6 → p-8
... (17 files nữa)
```

**Sau:**
```tsx
// Chỉ sửa 1 file: PageContainer.tsx
const paddingClasses = {
  md: 'p-8' // Đổi từ p-6 → p-8
}
```

---

### 4. Faster Development

**Tạo page mới:**

**Trước:**
1. Copy paste layout từ page khác (5 phút)
2. Sửa title, icon, description (2 phút)
3. Sửa stats (3 phút)
4. Sửa action button (2 phút)
5. Viết content (15 phút)
**Total: 27 phút**

**Sau:**
1. Import PageLayout (10 giây)
2. Pass props (2 phút)
3. Viết content (15 phút)
**Total: 17 phút (-37%)**

---

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Tạo Layout Components (2 giờ)

1. ✅ Tạo `components/shared/layout/PageContainer.tsx`
2. ✅ Tạo `components/shared/layout/PageHeader.tsx`
3. ✅ Tạo `components/shared/layout/StatsGrid.tsx`
4. ✅ Tạo `components/shared/layout/PageLayout.tsx`
5. ✅ Tạo `components/shared/layout/index.ts`
6. ✅ Tạo `components/shared/layout/README.md`

---

### Phase 2: Migrate Existing Pages (4 giờ)

**Priority 1: Pages có layout giống nhau nhất (10 pages)**
1. DeliveryPartners.tsx
2. OrderReturns.tsx
3. ShippingOrders.tsx
4. OrderRepairs.tsx
5. PurchaseInvoices.tsx
6. OrderInvoices.tsx
7. GoodsInternalUse.tsx
8. WarrantyOrders.tsx
9. ConsignmentOrders.tsx
10. PreOrders.tsx

**Priority 2: Pages khác (10+ pages)**
- Migrate dần dần khi có thời gian

---

### Phase 3: Documentation & Testing (1 giờ)

1. ✅ Viết documentation
2. ✅ Viết tests cho layout components
3. ✅ Update style guide

---

## 📝 CHECKLIST

### Layout Components:
- [ ] PageContainer.tsx
- [ ] PageHeader.tsx
- [ ] StatsGrid.tsx
- [ ] PageLayout.tsx
- [ ] index.ts (exports)
- [ ] README.md (documentation)

### Migration:
- [ ] DeliveryPartners.tsx
- [ ] OrderReturns.tsx
- [ ] ShippingOrders.tsx
- [ ] OrderRepairs.tsx
- [ ] PurchaseInvoices.tsx
- [ ] OrderInvoices.tsx
- [ ] GoodsInternalUse.tsx
- [ ] (7+ pages nữa...)

### Testing:
- [ ] Unit tests cho layout components
- [ ] Visual regression tests
- [ ] Accessibility tests

### Documentation:
- [ ] README.md với examples
- [ ] Migration guide
- [ ] Best practices

---

## 💡 KẾT LUẬN

**Layout Components sẽ giúp:**

1. ✅ **Giảm 1,000+ lines code lặp** → Chỉ còn 200 lines
2. ✅ **Tạo page mới nhanh hơn 37%** → 27 phút → 17 phút
3. ✅ **100% consistency** → Tất cả pages giống nhau
4. ✅ **Dễ maintain** → Sửa 1 chỗ → apply toàn bộ
5. ✅ **Scalable** → Dễ thêm features mới

**Đây là bước tiếp theo tự nhiên sau Shared UI Components!**

---

## 🎯 NEXT STEPS

### Bạn muốn:

1. **Làm ngay** → Tôi sẽ tạo 4 layout components + migrate 3 pages mẫu
2. **Xem demo trước** → Tôi sẽ tạo 1 page demo để bạn xem
3. **Thảo luận thêm** → Bạn có ý tưởng gì khác?

Bạn chọn option nào? 😊

---

**Cập nhật lần cuối:** 16/05/2026  
**Trạng thái:** 💡 ĐỀ XUẤT - Chờ user quyết định
