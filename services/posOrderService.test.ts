import { describe, expect, it, vi } from 'vitest';
import { AppData, POSOrder, POSProduct } from '../types';
import { processPlaceOrder, processReturnOrder } from './posOrderService';

const baseProduct: POSProduct = {
  id: 'product-1',
  sku: 'SKU-1',
  name: 'Giày test',
  categoryId: 'Giày',
  importPrice: 60000,
  salePrice: 100000,
  stock: 10,
  minStock: 2,
  unit: 'Đôi',
  status: 'Active',
};

const baseData = {
  posProducts: [baseProduct],
  revenue: [],
} as AppData;

const baseOrder: POSOrder = {
  id: 'order-1',
  orderCode: 'HD-000001',
  date: '2026-05-10T10:00:00.000Z',
  items: [{
    productId: 'product-1',
    sku: 'SKU-1',
    name: 'Giày test',
    quantity: 2,
    price: 100000,
    discount: 0,
    total: 200000,
  }],
  totalAmount: 200000,
  discount: 30000,
  finalAmount: 170000,
  paymentMethod: 'Cash',
  staffId: 'Admin',
  pointsEarned: 17,
};

describe('posOrderService', () => {
  it('records POS revenue with COGS and gross profit', async () => {
    const pushBatch = vi.fn().mockResolvedValue(undefined);
    const updateSurgical = vi.fn().mockResolvedValue(undefined);
    const updatedProducts = [{ ...baseProduct, stock: 8 }];

    await processPlaceOrder({
      data: baseData,
      order: baseOrder,
      updatedProducts,
      pushBatch,
      updateSurgical,
    });

    expect(pushBatch).toHaveBeenCalledWith('posOrders', [baseOrder]);
    expect(pushBatch).toHaveBeenCalledWith('revenue', [
      expect.objectContaining({
        totalGrossRevenue: 200000,
        discount: 30000,
        netRevenue: 170000,
        totalCogs: 120000,
        grossProfit: 50000,
      }),
    ]);
    // AUDIT-003/009: inventory transaction + stock update gộp thành 1 call atomic
    expect(updateSurgical).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'inventoryTransactions',
          item: expect.objectContaining({
            type: 'Sale',
            referenceId: 'order-1',
            items: [expect.objectContaining({ previousStock: 10, newStock: 8 })],
          }),
        }),
        expect.objectContaining({ key: 'posProducts' }),
      ])
    );
  });

  it('blocks checkout when stock is insufficient by default', async () => {
    const pushBatch = vi.fn().mockResolvedValue(undefined);
    const updateSurgical = vi.fn().mockResolvedValue(undefined);
    const lowStockData = {
      ...baseData,
      posProducts: [{ ...baseProduct, stock: 1 }],
    } as AppData;

    await expect(processPlaceOrder({
      data: lowStockData,
      order: baseOrder,
      updatedProducts: [{ ...baseProduct, stock: -1 }],
      pushBatch,
      updateSurgical,
    })).rejects.toThrow('Không đủ tồn kho');
  });

  it('allows negative stock when out-of-stock sales are enabled', async () => {
    const pushBatch = vi.fn().mockResolvedValue(undefined);
    const updateSurgical = vi.fn().mockResolvedValue(undefined);
    const lowStockData = {
      ...baseData,
      posProducts: [{ ...baseProduct, stock: 1 }],
    } as AppData;
    const updatedProducts = [{ ...baseProduct, stock: -1 }];

    await processPlaceOrder({
      data: lowStockData,
      order: baseOrder,
      updatedProducts,
      allowSellOutOfStock: true,
      pushBatch,
      updateSurgical,
    });

    // AUDIT-003/009: inventory transaction + stock update gộp thành 1 call atomic
    expect(updateSurgical).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'inventoryTransactions',
          item: expect.objectContaining({ allowNegativeStock: true }),
        }),
        expect.objectContaining({
          key: 'posProducts',
          item: expect.objectContaining({ stock: -1 }),
        }),
      ])
    );
  });

  it('uses updatedProducts for return and exchange stock snapshots', async () => {
    const pushBatch = vi.fn().mockResolvedValue(undefined);
    const updateSurgical = vi.fn().mockResolvedValue(undefined);
    const updatedProducts = [{ ...baseProduct, stock: 11 }];
    const returnedItems = [baseOrder.items[0]];

    await processReturnOrder({
      data: baseData,
      returnOrder: { ...baseOrder, id: 'return-1', orderCode: 'TH-000001', isReturn: true },
      updatedProducts,
      returnedItems,
      exchangeItems: [],
      pushBatch,
      updateSurgical,
    });

    expect(updateSurgical).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'posProducts' }),
      expect.objectContaining({
        key: 'inventoryTransactions',
        item: expect.objectContaining({
          type: 'Return',
          referenceId: 'return-1',
          items: [expect.objectContaining({ previousStock: 10, newStock: 11 })],
        }),
      }),
    ]);
  });
});
