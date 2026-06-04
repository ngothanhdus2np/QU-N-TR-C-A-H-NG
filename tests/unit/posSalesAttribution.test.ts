import { describe, expect, it } from 'vitest';
import {
  buildPosSalesRecordUpsertsForDate,
  buildPosSalesRecordsForDate,
  calculateStaffSalesForDate,
} from '../../src/lib/posSalesAttribution';
import type { Employee, POSOrder, SalesRecord } from '../../types';

const employees: Employee[] = [
  { id: 'e1', name: 'Lan', position: 'NV', joinDate: '2024-01-01' },
  { id: 'e2', name: 'Mai', position: 'NV', joinDate: '2024-01-01' },
];

describe('pos sales attribution', () => {
  it('tính doanh số theo giảm giá từng dòng cho đúng nhân viên của dòng hàng', () => {
    const orders: POSOrder[] = [
      {
        id: 'o1',
        orderCode: 'HD-1',
        date: '2024-05-01T10:00:00.000Z',
        items: [
          {
            productId: 'p1',
            sku: 'A',
            name: 'A',
            quantity: 1,
            price: 100000,
            discount: 10000,
            total: 90000,
            salespersonId: 'e1',
          },
          {
            productId: 'p2',
            sku: 'B',
            name: 'B',
            quantity: 2,
            price: 50000,
            discount: 0,
            total: 100000,
            salespersonId: 'e2',
          },
        ],
        totalAmount: 190000,
        discount: 0,
        finalAmount: 190000,
        paymentMethod: 'Cash',
        staffId: 'e1',
        pointsEarned: 0,
      },
    ];

    const result = calculateStaffSalesForDate(orders, '2024-05-01', employees);

    expect(result.find(row => row.employeeId === 'e1')?.salesAmount).toBe(90000);
    expect(result.find(row => row.employeeId === 'e2')?.salesAmount).toBe(100000);
  });

  it('chia giảm giá toàn bill theo tổng số lượng sản phẩm', () => {
    const orders: POSOrder[] = [
      {
        id: 'o1',
        orderCode: 'HD-1',
        date: '2024-05-01T10:00:00.000Z',
        items: [
          { productId: 'p1', sku: 'A', name: 'A', quantity: 1, price: 100000, discount: 0, total: 100000, salespersonId: 'e1' },
          { productId: 'p2', sku: 'B', name: 'B', quantity: 3, price: 100000, discount: 0, total: 300000, salespersonId: 'e2' },
        ],
        totalAmount: 400000,
        discount: 80000,
        finalAmount: 320000,
        paymentMethod: 'Cash',
        staffId: 'e1',
        pointsEarned: 0,
      },
    ];

    const result = calculateStaffSalesForDate(orders, '2024-05-01', employees);

    expect(result.find(row => row.employeeId === 'e1')?.salesAmount).toBe(80000);
    expect(result.find(row => row.employeeId === 'e2')?.salesAmount).toBe(240000);
  });

  it('đổi trả chỉ ghi nhận tiền khách bù thêm cho hàng đổi', () => {
    const orders: POSOrder[] = [
      {
        id: 'r1',
        orderCode: 'TH-1',
        date: '2024-05-01T10:00:00.000Z',
        items: [
          { productId: 'old', sku: 'OLD', name: 'Old', quantity: 1, price: 100000, discount: 0, total: 100000, lineType: 'return' },
          { productId: 'new', sku: 'NEW', name: 'New', quantity: 2, price: 60000, discount: 0, total: 120000, lineType: 'exchange', salespersonId: 'e2' },
        ],
        totalAmount: 100000,
        discount: 0,
        finalAmount: 20000,
        paymentMethod: 'Cash',
        staffId: 'e1',
        pointsEarned: 0,
        isReturn: true,
      },
    ];

    const result = calculateStaffSalesForDate(orders, '2024-05-01', employees);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ employeeId: 'e2', salesAmount: 20000, quantity: 2 });
  });

  it('ghi nhận sales record idempotent theo ngày và nhân viên', () => {
    const existing: SalesRecord[] = [
      { id: 'manual', employeeId: 'e1', date: '2024-05-01', salesAmount: 5000 },
      { id: 'pos-sales-2024-05-01-e1', employeeId: 'e1', date: '2024-05-01', salesAmount: 1 },
    ];
    const orders: POSOrder[] = [
      {
        id: 'o1',
        orderCode: 'HD-1',
        date: '2024-05-01T10:00:00.000Z',
        items: [{ productId: 'p1', sku: 'A', name: 'A', quantity: 1, price: 100000, discount: 0, total: 100000, salespersonId: 'e1' }],
        totalAmount: 100000,
        discount: 0,
        finalAmount: 100000,
        paymentMethod: 'Cash',
        staffId: 'e1',
        pointsEarned: 0,
      },
    ];

    const records = buildPosSalesRecordsForDate(existing, orders, '2024-05-01', employees);

    expect(records.find(record => record.id === 'manual')?.salesAmount).toBe(5000);
    expect(records.find(record => record.id === 'pos-sales-2024-05-01-e1')?.salesAmount).toBe(100000);
  });

  it('tạo danh sách record upsert tự động cho POS theo ngày', () => {
    const orders: POSOrder[] = [
      {
        id: 'o1',
        orderCode: 'HD-1',
        date: '2024-05-01T10:00:00.000Z',
        items: [{ productId: 'p1', sku: 'A', name: 'A', quantity: 1, price: 100000, discount: 0, total: 100000, salespersonId: 'e1' }],
        totalAmount: 100000,
        discount: 0,
        finalAmount: 100000,
        paymentMethod: 'Cash',
        staffId: 'e1',
        pointsEarned: 0,
      },
    ];

    const records = buildPosSalesRecordUpsertsForDate(orders, '2024-05-01', employees);

    expect(records).toEqual([
      {
        id: 'pos-sales-2024-05-01-e1',
        employeeId: 'e1',
        employeeName: 'Lan',
        date: '2024-05-01',
        salesAmount: 100000,
      },
    ]);
  });
});
