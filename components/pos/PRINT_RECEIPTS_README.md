# Hệ thống In Phiếu - Print Receipts System

## 📋 Tổng quan

Hệ thống in phiếu được thiết kế với kiến trúc **layout chung + nội dung riêng** để đảm bảo tính nhất quán và dễ bảo trì.

## 🏗️ Kiến trúc

### 1. Component Layout Chung
**File:** `PrintReceiptLayout.tsx`

Component này cung cấp:
- ✅ Header với tiêu đề và icon tùy chỉnh
- ✅ Thông tin công ty (logo, địa chỉ, hotline)
- ✅ Vùng nội dung động (children)
- ✅ Footer với lời cảm ơn
- ✅ Nút hành động (In & Hoàn tất)

### 2. Component Nội dung Riêng
Mỗi loại phiếu có component riêng:
- `POSReceiptModal.tsx` - Hóa đơn bán hàng
- `POSExchangeReceiptModal.tsx` - Phiếu đổi hàng ⭐ MỚI
- `POSReturnReceiptModal.tsx` - Phiếu trả hàng ⭐ MỚI

## 🎨 Thiết kế Phiếu Đổi Hàng

### Layout Structure
```
┌─────────────────────────────────────┐
│ Header (Icon + Title + Order Code)  │
├─────────────────────────────────────┤
│ Company Info (Logo, Address)        │
├─────────────────────────────────────┤
│ Customer Info                        │
│ - Khách hàng                         │
│ - Hóa đơn gốc                        │
│ - Thu ngân                           │
├─────────────────────────────────────┤
│ 🔴 HÀNG TRẢ LẠI                     │
│ ┌─────────────────────────────────┐ │
│ │ Table: Items + Quantity + Total │ │
│ │ - Lý do trả (nếu có)            │ │
│ └─────────────────────────────────┘ │
│ Tổng trả lại: XXX đ                 │
├─────────────────────────────────────┤
│ 🟢 HÀNG MỚI                         │
│ ┌─────────────────────────────────┐ │
│ │ Table: Items + Quantity + Total │ │
│ └─────────────────────────────────┘ │
│ Tổng hàng mới: XXX đ                │
├─────────────────────────────────────┤
│ CHÊNH LỆCH                          │
│ - Khách cần trả thêm / Hoàn lại    │
│ - Phương thức thanh toán            │
│ - Ghi chú (nếu có)                  │
├─────────────────────────────────────┤
│ Footer (Thank you message)          │
├─────────────────────────────────────┤
│ [In phiếu] [Hoàn tất]               │
└─────────────────────────────────────┘
```

## 🎯 Đặc điểm Nổi bật

### Phiếu Đổi Hàng
- **Icon:** RefreshCw (màu amber)
- **Màu chủ đạo:** 
  - Hàng trả: Rose/Red
  - Hàng mới: Emerald/Green
  - Chênh lệch: Indigo (trả thêm) / Emerald (hoàn lại)
- **Thông tin đặc biệt:**
  - Hiển thị hóa đơn gốc
  - Lý do trả hàng cho từng item
  - Tính toán chênh lệch tự động
  - Ghi chú đổi hàng

### Phiếu Trả Hàng
- **Icon:** Undo2 (màu rose)
- **Màu chủ đạo:** Rose/Red
- **Thông tin đặc biệt:**
  - Hiển thị hóa đơn gốc
  - Lý do trả hàng
  - Phương thức hoàn tiền
  - Ghi chú trả hàng

## 💻 Cách Sử dụng

### Sử dụng Layout Chung (Recommended)

```tsx
import PrintReceiptLayout from './PrintReceiptLayout';
import { FileText } from 'lucide-react';

const MyCustomReceipt = ({ order, onClose, onPrint, onFinish }) => (
  <PrintReceiptLayout
    title="Phiếu Thu"
    titleIcon={FileText}
    titleIconColor="text-blue-500"
    orderCode={order.code}
    date={order.date}
    onClose={onClose}
    onPrint={onPrint}
    onFinish={onFinish}
  >
    {/* Nội dung tùy chỉnh của bạn */}
    <div>
      <h4>Thông tin khách hàng</h4>
      {/* ... */}
    </div>
  </PrintReceiptLayout>
);
```

### Sử dụng Component Độc lập

```tsx
import POSExchangeReceiptModal from './POSExchangeReceiptModal';

const order = {
  orderCode: 'EX-2024-001',
  originalOrderCode: 'HD-2024-100',
  date: new Date().toISOString(),
  customerName: 'Nguyễn Văn A',
  staffId: 'NV001',
  returnItems: [
    { name: 'Áo sơ mi', price: 200000, quantity: 1, total: 200000, reason: 'Không vừa' }
  ],
  newItems: [
    { name: 'Áo sơ mi size L', price: 220000, quantity: 1, total: 220000 }
  ],
  returnTotal: 200000,
  newTotal: 220000,
  difference: 20000,
  paymentMethod: 'Tiền mặt',
  notes: 'Đổi size'
};

<POSExchangeReceiptModal
  order={order}
  onClose={() => console.log('Close')}
  onPrint={() => window.print()}
  onFinish={() => console.log('Finish')}
/>
```

## 🎨 Màu sắc & Theme

### Màu theo loại phiếu
- **Hóa đơn bán:** Indigo (#4F46E5)
- **Phiếu đổi:** Amber (#F59E0B) + Rose/Emerald
- **Phiếu trả:** Rose (#F43F5E)
- **Phiếu thu:** Blue (#3B82F6)
- **Phiếu chi:** Orange (#F97316)

### Typography
- **Font:** System font stack
- **Heading:** font-black, uppercase, tracking-tight
- **Body:** font-normal
- **Labels:** text-[10px], uppercase, tracking-[0.2em]

## 📦 TypeScript Interfaces

### POSExchangeOrder
```typescript
interface ExchangeItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
  reason?: string;
}

interface POSExchangeOrder {
  orderCode: string;
  originalOrderCode: string;
  date: string;
  customerName?: string;
  staffId: string;
  returnItems: ExchangeItem[];
  newItems: ExchangeItem[];
  returnTotal: number;
  newTotal: number;
  difference: number;
  paymentMethod?: string;
  notes?: string;
}
```

## 🖨️ In ấn

### CSS Print Styles
Thêm vào global CSS:

```css
@media print {
  .print-area {
    /* Styles cho vùng in */
  }
  
  /* Ẩn các nút không cần in */
  button {
    display: none !important;
  }
}
```

### JavaScript Print Handler
```typescript
const handlePrint = () => {
  window.print();
};
```

## 🚀 Mở rộng

### Tạo loại phiếu mới

1. **Tạo interface cho data:**
```typescript
interface MyReceiptOrder {
  orderCode: string;
  date: string;
  // ... các field khác
}
```

2. **Tạo component sử dụng PrintReceiptLayout:**
```tsx
const MyReceiptModal = ({ order, onClose, onPrint, onFinish }) => (
  <PrintReceiptLayout
    title="Tên Phiếu"
    titleIcon={MyIcon}
    titleIconColor="text-color-500"
    orderCode={order.orderCode}
    date={order.date}
    onClose={onClose}
    onPrint={onPrint}
    onFinish={onFinish}
  >
    {/* Nội dung riêng */}
  </PrintReceiptLayout>
);
```

3. **Hoặc tạo component độc lập** (nếu cần tùy chỉnh nhiều)

## 📝 Best Practices

1. ✅ **Sử dụng PrintReceiptLayout** cho tính nhất quán
2. ✅ **Màu sắc phân biệt** cho từng loại phiếu
3. ✅ **Icon rõ ràng** để nhận diện nhanh
4. ✅ **Typography nhất quán** theo design system
5. ✅ **Responsive** cho các kích thước màn hình
6. ✅ **Print-friendly** với CSS media queries
7. ✅ **TypeScript** cho type safety

## 🎯 Roadmap

- [ ] Phiếu thu tiền
- [ ] Phiếu chi tiền
- [ ] Phiếu bảo hành
- [ ] Phiếu sửa chữa
- [ ] Phiếu đặt hàng
- [ ] Export PDF
- [ ] Email phiếu
- [ ] QR code tracking

## 📞 Support

Nếu có thắc mắc hoặc cần hỗ trợ, vui lòng liên hệ team development.
