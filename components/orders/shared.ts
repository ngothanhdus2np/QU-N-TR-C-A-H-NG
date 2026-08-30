import type { AppData, POSOrder } from '../../types';

/**
 * Helper dùng chung cho các trang trong `components/orders/`.
 *
 * Gộp 30/08/2026: trước đó `fmt`, `PAYMENT_LABELS`, `PAYMENT_METHODS`,
 * `customerCodeMap` và `getCustomerCode` được copy-paste giữa `OrderInvoices.tsx`,
 * `OrderReturns.tsx` và `PendingOrdersPage.tsx`.
 *
 * Việc tách ra đây KHÔNG chỉ để bớt dòng — các bản sao đã bắt đầu lệch nhau âm
 * thầm: `PAYMENT_LABELS` ở `OrderReturns.tsx` thiếu khoá `Card` trong khi 2 bản
 * kia có, nên đơn trả hàng thanh toán bằng thẻ hiển thị chữ Anh "Card" thay vì
 * "Thẻ" (đã vá 29/08/2026). Một nguồn sự thật thì kiểu lệch đó không tái diễn.
 */

/** Định dạng số theo chuẩn Việt Nam: 1500000 → "1.500.000". */
export function fmt(n: number) {
  return n.toLocaleString('vi-VN');
}

/** Nhãn tiếng Việt cho phương thức thanh toán. */
export const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Card: 'Thẻ',
  Momo: 'Momo',
  Other: 'Khác',
  Split: 'Kết hợp nhiều PT',
};

/**
 * Các phương thức chọn được trong bộ lọc.
 * Cố ý KHÔNG có 'Split' — đó là trạng thái suy ra khi đơn trả bằng nhiều phương
 * thức, không phải lựa chọn người dùng bấm được.
 */
export const PAYMENT_METHODS: POSOrder['paymentMethod'][] = [
  'Cash',
  'Bank',
  'Card',
  'Momo',
  'Other',
];

/**
 * Gán mã hiển thị KH000001, KH000002... cho khách hàng.
 *
 * Sắp theo `id` để mã ổn định giữa các lần render và giữa các trang — nếu sắp
 * theo thứ tự mảng đầu vào thì cùng một khách có thể mang mã khác nhau ở hai
 * trang khác nhau.
 */
export const buildCustomerCodeMap = (customers: AppData['posCustomers']) => {
  const map = new Map<string, string>();
  [...customers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((customer, index) => {
      map.set(customer.id, `KH${String(index + 1).padStart(6, '0')}`);
    });
  return map;
};

/**
 * Tạo hàm tra mã khách hàng của một đơn.
 *
 * Đơn cũ có thể chỉ lưu `customerName` mà không có `customerId` (dữ liệu import
 * từ KiotViet), nên có bước dò ngược theo tên trước khi bỏ cuộc trả '—'.
 */
export const makeGetCustomerCode = (
  customerCodeMap: Map<string, string>,
  customers: AppData['posCustomers']
) => {
  return (order: AppData['posOrders'][number]) => {
    if (order.customerId && customerCodeMap.has(order.customerId)) {
      return customerCodeMap.get(order.customerId) || '—';
    }
    if (order.customerName) {
      const matchedCustomer = customers.find(customer => customer.name === order.customerName);
      if (matchedCustomer) return customerCodeMap.get(matchedCustomer.id) || '—';
    }
    return '—';
  };
};
