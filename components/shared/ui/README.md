# Shared UI Components Library

Thư viện components UI tái sử dụng cho CFO Brain 4.0.

## 📦 Components

### Button

Component button với nhiều variants và sizes.

**Props:**
- `variant`: `'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline'` (default: `'primary'`)
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'xl'` (default: `'md'`)
- `loading`: `boolean` - Hiển thị loading spinner
- `icon`: `LucideIcon` - Icon component
- `iconPosition`: `'left' | 'right'` (default: `'left'`)
- `fullWidth`: `boolean` - Full width button
- `uppercase`: `boolean` - Uppercase text

**Usage:**
```tsx
import { Button } from '@/components/shared/ui';
import { Plus } from 'lucide-react';

<Button variant="primary" size="md" icon={Plus}>
  Thêm mới
</Button>

<Button variant="danger" loading>
  Đang xử lý...
</Button>
```

---

### Card

Component card container với header, content, footer.

**Props:**
- `padding`: `'none' | 'sm' | 'md' | 'lg' | 'xl'` (default: `'md'`)
- `shadow`: `'none' | 'sm' | 'md' | 'lg' | 'xl'` (default: `'md'`)
- `rounded`: `'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'` (default: `'xl'`)
- `border`: `boolean` (default: `true`)

**Usage:**
```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/shared/ui';

<Card>
  <CardHeader>
    <CardTitle>Tiêu đề</CardTitle>
  </CardHeader>
  <CardContent>
    Nội dung card
  </CardContent>
  <CardFooter>
    <Button>Lưu</Button>
  </CardFooter>
</Card>
```

---

### Input & Textarea

Components input và textarea với label, error, helper text.

**Props:**
- `label`: `string` - Label text
- `error`: `string` - Error message
- `helperText`: `string` - Helper text
- `icon`: `LucideIcon` - Icon (Input only)
- `iconPosition`: `'left' | 'right'` (default: `'left'`)
- `fullWidth`: `boolean` - Full width input

**Usage:**
```tsx
import { Input, Textarea } from '@/components/shared/ui';
import { Search } from 'lucide-react';

<Input
  label="Tìm kiếm"
  placeholder="Nhập từ khóa..."
  icon={Search}
  fullWidth
/>

<Input
  label="Email"
  type="email"
  error="Email không hợp lệ"
/>

<Textarea
  label="Ghi chú"
  rows={4}
  helperText="Tối đa 500 ký tự"
/>
```

---

### Badge

Component badge để hiển thị status, tags.

**Props:**
- `variant`: `'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'` (default: `'default'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)

**Usage:**
```tsx
import { Badge } from '@/components/shared/ui';

<Badge variant="success">Hoàn thành</Badge>
<Badge variant="warning" size="sm">Chờ duyệt</Badge>
<Badge variant="danger">Hủy</Badge>
```

---

### Modal

Component modal với overlay, close button, keyboard support.

**Props:**
- `isOpen`: `boolean` - Modal open state
- `onClose`: `() => void` - Close handler
- `title`: `string` - Modal title
- `size`: `'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'` (default: `'md'`)
- `closeOnOverlayClick`: `boolean` (default: `true`)
- `showCloseButton`: `boolean` (default: `true`)

**Usage:**
```tsx
import { Modal, ModalBody, ModalFooter, Button } from '@/components/shared/ui';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Xác nhận"
  size="md"
>
  <ModalBody>
    Bạn có chắc muốn xóa?
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>
      Hủy
    </Button>
    <Button variant="danger" onClick={handleDelete}>
      Xóa
    </Button>
  </ModalFooter>
</Modal>
```

---

## 🎨 Design Tokens

### Colors
- **Primary**: Indigo (indigo-600, indigo-700)
- **Secondary**: Slate (slate-600, slate-700)
- **Success**: Emerald (emerald-600, emerald-700)
- **Warning**: Amber (amber-600, amber-700)
- **Danger**: Rose (rose-600, rose-700)
- **Info**: Blue (blue-600, blue-700)

### Spacing
- **xs**: 0.5rem (8px)
- **sm**: 0.75rem (12px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)

### Border Radius
- **sm**: 0.25rem (4px)
- **md**: 0.375rem (6px)
- **lg**: 0.5rem (8px)
- **xl**: 0.75rem (12px)
- **2xl**: 1rem (16px)
- **3xl**: 1.5rem (24px)

### Shadows
- **sm**: `shadow-sm`
- **md**: `shadow-md`
- **lg**: `shadow-lg`
- **xl**: `shadow-xl`

---

## 📝 Best Practices

### 1. Consistency
Sử dụng shared components thay vì tạo custom styles:
```tsx
// ❌ Bad
<button className="px-4 py-2 bg-indigo-600 text-white rounded-xl">
  Click me
</button>

// ✅ Good
<Button variant="primary" size="md">
  Click me
</Button>
```

### 2. Accessibility
Tất cả components đã có accessibility built-in:
- Keyboard navigation (Tab, Enter, Escape)
- Focus states
- ARIA attributes
- Screen reader support

### 3. Composition
Kết hợp components để tạo UI phức tạp:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Form đăng ký</CardTitle>
  </CardHeader>
  <CardContent>
    <Input label="Họ tên" fullWidth />
    <Input label="Email" type="email" fullWidth />
    <Textarea label="Ghi chú" rows={3} fullWidth />
  </CardContent>
  <CardFooter>
    <Button variant="ghost">Hủy</Button>
    <Button variant="primary">Đăng ký</Button>
  </CardFooter>
</Card>
```

### 4. Customization
Extend components với className:
```tsx
<Button className="shadow-2xl animate-pulse">
  Custom button
</Button>
```

---

## 🚀 Migration Guide

### Migrating existing buttons:

**Before:**
```tsx
<button className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
  Thêm mới
</button>
```

**After:**
```tsx
<Button variant="primary" size="md">
  Thêm mới
</Button>
```

### Migrating existing cards:

**Before:**
```tsx
<div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
  Content
</div>
```

**After:**
```tsx
<Card padding="lg" shadow="md" rounded="xl">
  Content
</Card>
```

---

## 📊 Benefits

### Code Reduction
- **Before**: ~50 lines cho một button với variants
- **After**: 1 line `<Button variant="primary">`
- **Savings**: 98% less code

### Consistency
- Tất cả buttons có cùng style, spacing, transitions
- Dễ dàng update design system-wide

### Maintainability
- Thay đổi 1 nơi → apply toàn bộ app
- Dễ test, dễ document

### Performance
- React.memo built-in
- Optimized re-renders
- Smaller bundle size (shared code)

---

## 🔮 Future Enhancements

- [ ] Select / Dropdown component
- [ ] Checkbox / Radio component
- [ ] Switch / Toggle component
- [ ] Tabs component
- [ ] Tooltip component
- [ ] Toast / Notification component
- [ ] Table component
- [ ] Pagination component
- [ ] Loading / Skeleton component
- [ ] Avatar component

---

## 📚 References

- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [React Aria](https://react-spectrum.adobe.com/react-aria/)
- [Radix UI](https://www.radix-ui.com/)

