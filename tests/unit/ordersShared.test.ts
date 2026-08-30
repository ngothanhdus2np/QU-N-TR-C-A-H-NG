import { describe, expect, it } from 'vitest';
import {
  fmt,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  buildCustomerCodeMap,
  makeGetCustomerCode,
} from '../../components/orders/shared';
import type { AppData } from '../../types';

/**
 * Khoá helper dùng chung của `components/orders/` sau khi gộp 3 bản sao
 * (30/08/2026).
 *
 * Lý do có test này chứ không chỉ là gộp cho gọn: các bản sao đã lệch nhau thật.
 * `PAYMENT_LABELS` ở `OrderReturns.tsx` thiếu khoá `Card` trong khi 2 bản kia có,
 * nên đơn trả hàng thanh toán bằng thẻ hiển thị "Card" thay vì "Thẻ". Không có
 * test nào bắt được vì mỗi bản sao nằm riêng một file.
 */
describe('orders/shared', () => {
  it('fmt định dạng số theo chuẩn Việt Nam', () => {
    expect(fmt(1500000)).toBe('1.500.000');
    expect(fmt(0)).toBe('0');
    expect(fmt(-35000)).toBe('-35.000');
  });

  it('PAYMENT_LABELS có đủ nhãn cho MỌI phương thức chọn được', () => {
    // Đây chính là mắt xích từng đứt: thiếu 1 khoá thì UI rơi về fallback và
    // hiện chữ tiếng Anh, không có lỗi nào báo ra.
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_LABELS[method], `thiếu nhãn cho ${method}`).toBeTruthy();
    }
    expect(PAYMENT_LABELS.Card).toBe('Thẻ');
  });

  it('PAYMENT_LABELS có Split dù Split không nằm trong danh sách chọn', () => {
    // Split là trạng thái suy ra khi đơn trả bằng nhiều phương thức — cần nhãn
    // để hiển thị, nhưng không phải lựa chọn người dùng bấm được trong bộ lọc.
    expect(PAYMENT_LABELS.Split).toBe('Kết hợp nhiều PT');
    expect(PAYMENT_METHODS).not.toContain('Split');
  });

  it('buildCustomerCodeMap gán mã ổn định theo id, không theo thứ tự mảng', () => {
    const a = [{ id: 'c-b' }, { id: 'c-a' }] as AppData['posCustomers'];
    const b = [{ id: 'c-a' }, { id: 'c-b' }] as AppData['posCustomers'];
    // Đảo thứ tự đầu vào vẫn phải ra cùng mã, nếu không cùng một khách sẽ mang
    // mã khác nhau ở hai trang khác nhau.
    expect(buildCustomerCodeMap(a).get('c-a')).toBe('KH000001');
    expect(buildCustomerCodeMap(b).get('c-a')).toBe('KH000001');
    expect(buildCustomerCodeMap(a).get('c-b')).toBe('KH000002');
  });

  it('getCustomerCode tra được theo customerId', () => {
    const customers = [{ id: 'c-1', name: 'A ANH' }] as AppData['posCustomers'];
    const get = makeGetCustomerCode(buildCustomerCodeMap(customers), customers);
    expect(get({ customerId: 'c-1' } as AppData['posOrders'][number])).toBe('KH000001');
  });

  it('getCustomerCode dò ngược theo tên khi đơn cũ không có customerId', () => {
    // Đơn import từ KiotViet nhiều khi chỉ có tên khách, không có id.
    const customers = [{ id: 'c-1', name: 'A ANH' }] as AppData['posCustomers'];
    const get = makeGetCustomerCode(buildCustomerCodeMap(customers), customers);
    expect(get({ customerName: 'A ANH' } as AppData['posOrders'][number])).toBe('KH000001');
  });

  it('getCustomerCode trả — khi không tra được, thay vì undefined', () => {
    const customers = [{ id: 'c-1', name: 'A ANH' }] as AppData['posCustomers'];
    const get = makeGetCustomerCode(buildCustomerCodeMap(customers), customers);
    expect(get({} as AppData['posOrders'][number])).toBe('—');
    expect(get({ customerName: 'Người lạ' } as AppData['posOrders'][number])).toBe('—');
    expect(get({ customerId: 'khong-ton-tai' } as AppData['posOrders'][number])).toBe('—');
  });
});
