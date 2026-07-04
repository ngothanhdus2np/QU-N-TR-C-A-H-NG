import { describe, expect, it, vi } from 'vitest';
import { AppData, InventoryTransaction, POSOrder, POSProduct } from '../types';
import {
  processPlaceOrder,
  processReturnOrder,
  deletePosOrder,
  editPosOrder,
  processCancelReturn,
} from './posOrderService';

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
  // [TXN-RPC-01] processPlaceOrder giờ gọi RPC place_pos_order_tx rồi đồng bộ local
  it('calls the RPC then syncs local state with matching revenue delta', async () => {
    const applyLocalOnly = vi.fn().mockResolvedValue(undefined);
    const applyRevenueDeltaLocal = vi.fn().mockResolvedValue(undefined);
    const placePosOrderTx = vi.fn().mockResolvedValue(undefined);
    const updateSurgical = vi.fn().mockResolvedValue(undefined);
    const updatedProducts = [{ ...baseProduct, stock: 8 }];

    await processPlaceOrder({
      data: baseData,
      order: baseOrder,
      updatedProducts,
      applyLocalOnly,
      applyRevenueDeltaLocal,
      placePosOrderTx,
      updateSurgical,
    });

    // RPC (place_pos_order_tx) phải được gọi TRƯỚC — nếu lỗi, không có local update nào chạy
    expect(placePosOrderTx).toHaveBeenCalledWith(baseOrder, null, false);

    // Order local
    expect(applyLocalOnly).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'posOrders', item: baseOrder }),
    ]);

    // Doanh thu local — khớp buildRevenueDelta
    expect(applyRevenueDeltaLocal).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        totalGrossRevenue: 200000,
        discount: 30000,
        revenueOther: 0,
        returnsValue: 0,
        netRevenue: 170000,
        totalCogs: 120000,
        grossProfit: 50000,
      })
    );
    // Inventory transaction + stock update local gộp thành 1 call
    expect(applyLocalOnly).toHaveBeenCalledWith(
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

  it('blocks checkout when stock is insufficient by default, without calling the RPC', async () => {
    const applyLocalOnly = vi.fn();
    const applyRevenueDeltaLocal = vi.fn();
    const placePosOrderTx = vi.fn();
    const updateSurgical = vi.fn();
    const lowStockData = {
      ...baseData,
      posProducts: [{ ...baseProduct, stock: 1 }],
    } as AppData;

    await expect(processPlaceOrder({
      data: lowStockData,
      order: baseOrder,
      updatedProducts: [{ ...baseProduct, stock: -1 }],
      applyLocalOnly,
      applyRevenueDeltaLocal,
      placePosOrderTx,
      updateSurgical,
    })).rejects.toThrow('Không đủ tồn kho');
    expect(placePosOrderTx).not.toHaveBeenCalled();
  });

  it('allows negative stock when out-of-stock sales are enabled', async () => {
    const applyLocalOnly = vi.fn().mockResolvedValue(undefined);
    const applyRevenueDeltaLocal = vi.fn().mockResolvedValue(undefined);
    const placePosOrderTx = vi.fn().mockResolvedValue(undefined);
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
      applyLocalOnly,
      applyRevenueDeltaLocal,
      placePosOrderTx,
      updateSurgical,
    });

    expect(placePosOrderTx).toHaveBeenCalledWith(baseOrder, null, true);
    // Inventory transaction + stock update local gộp thành 1 call
    expect(applyLocalOnly).toHaveBeenCalledWith(
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

    const applyRevenueDelta = vi.fn().mockResolvedValue(undefined);
    await processReturnOrder({
      data: baseData,
      returnOrder: { ...baseOrder, id: 'return-1', orderCode: 'TH-000001', isReturn: true },
      updatedProducts,
      returnedItems,
      exchangeItems: [],
      pushBatch,
      updateSurgical,
      applyRevenueDelta,
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

    // [DATA-02] Tra hang: delta lam GIAM net revenue & gia von, cong returnsValue
    expect(applyRevenueDelta).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        returnsValue: 200000,
        netRevenue: -200000,
        totalCogs: -120000,
        grossProfit: -80000,
      })
    );
  });

  // [TXN-RPC-01]
  describe('deletePosOrder', () => {
    const saleTransaction: InventoryTransaction = {
      id: 'tx-sale-1',
      date: baseOrder.date,
      type: 'Sale',
      staffId: 'Admin',
      referenceId: 'order-1',
      items: [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Giày test',
          quantity: -2,
          previousStock: 10,
          newStock: 8,
        },
      ],
    };

    it('calls the RPC then syncs local state with matching reversal deltas', async () => {
      const applyLocalOnly = vi.fn().mockResolvedValue(undefined);
      const applyRevenueDeltaLocal = vi.fn().mockResolvedValue(undefined);
      const deletePosOrderTx = vi.fn().mockResolvedValue(undefined);
      const dataWithTx = {
        ...baseData,
        posProducts: [{ ...baseProduct, stock: 8 }],
        inventoryTransactions: [saleTransaction],
      } as AppData;

      await deletePosOrder({
        data: dataWithTx,
        order: baseOrder,
        applyLocalOnly,
        applyRevenueDeltaLocal,
        deletePosOrderTx,
      });

      // RPC (delete_pos_order_tx) phải được gọi TRƯỚC — nếu lỗi, không có local update nào chạy
      expect(deletePosOrderTx).toHaveBeenCalledWith('order-1');

      // Hoàn tồn kho local: stock 8 + 2 (abs quantity) = 10, tx đánh dấu cancelled
      expect(applyLocalOnly).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'inventoryTransactions',
            item: expect.objectContaining({ id: 'tx-sale-1', status: 'cancelled' }),
          }),
          expect.objectContaining({
            key: 'posProducts',
            item: expect.objectContaining({ id: 'product-1', stock: 10 }),
          }),
        ])
      );

      // Soft-delete local
      expect(applyLocalOnly).toHaveBeenCalledWith([
        expect.objectContaining({
          key: 'posOrders',
          item: expect.objectContaining({ id: 'order-1', status: 'cancelled' }),
        }),
      ]);

      // Đảo doanh thu — âm đúng giá trị đã cộng lúc tạo đơn (khớp buildRevenueDelta)
      expect(applyRevenueDeltaLocal).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          totalGrossRevenue: -200000,
          discount: -30000,
          netRevenue: -170000,
          totalCogs: -120000,
          grossProfit: -50000,
        })
      );
    });

    it('rejects deleting an already-cancelled order without calling the RPC', async () => {
      const applyLocalOnly = vi.fn();
      const applyRevenueDeltaLocal = vi.fn();
      const deletePosOrderTx = vi.fn();

      await expect(
        deletePosOrder({
          data: baseData,
          order: { ...baseOrder, status: 'cancelled' },
          applyLocalOnly,
          applyRevenueDeltaLocal,
          deletePosOrderTx,
        })
      ).rejects.toThrow('đã hủy trước đó');
      expect(deletePosOrderTx).not.toHaveBeenCalled();
    });

    it('rejects deleting a return/exchange order (not supported by this function)', async () => {
      const applyLocalOnly = vi.fn();
      const applyRevenueDeltaLocal = vi.fn();
      const deletePosOrderTx = vi.fn();

      await expect(
        deletePosOrder({
          data: baseData,
          order: { ...baseOrder, isReturn: true },
          applyLocalOnly,
          applyRevenueDeltaLocal,
          deletePosOrderTx,
        })
      ).rejects.toThrow('Chưa hỗ trợ xóa đơn trả/đổi');
      expect(deletePosOrderTx).not.toHaveBeenCalled();
    });
  });

  // [TXN-RPC-01]
  describe('processCancelReturn', () => {
    const returnTransaction: InventoryTransaction = {
      id: 'tx-return-1',
      date: baseOrder.date,
      type: 'Return',
      staffId: 'Admin',
      referenceId: 'return-1',
      items: [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Giày test',
          quantity: 1,
          previousStock: 8,
          newStock: 9,
        },
      ],
    };
    const returnOrder: POSOrder = {
      ...baseOrder,
      id: 'return-1',
      orderCode: 'TH-000001',
      isReturn: true,
      customerId: 'cust-1',
      items: [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Giày test',
          quantity: 1,
          price: 100000,
          discount: 0,
          total: 100000,
          lineType: 'return',
        },
      ],
    };

    it('calls the RPC then syncs local state with matching reversal deltas', async () => {
      const applyLocalOnly = vi.fn().mockResolvedValue(undefined);
      const applyRevenueDeltaLocal = vi.fn().mockResolvedValue(undefined);
      const cancelPosReturnTx = vi.fn().mockResolvedValue(undefined);
      const updateSurgical = vi.fn().mockResolvedValue(undefined);
      const dataWithReturn = {
        ...baseData,
        posProducts: [{ ...baseProduct, stock: 9 }],
        posOrders: [returnOrder],
        posCustomers: [{ id: 'cust-1', name: 'Khách A', points: 5, totalSpent: 500000 } as AppData['posCustomers'][number]],
        inventoryTransactions: [returnTransaction],
      } as AppData;

      await processCancelReturn({
        data: dataWithReturn,
        returnOrder,
        applyLocalOnly,
        applyRevenueDeltaLocal,
        cancelPosReturnTx,
        updateSurgical,
      });

      expect(cancelPosReturnTx).toHaveBeenCalledWith('return-1');

      // Đảo tồn kho local: hàng Return trừ lại kho (9 - 1 = 8), tx đánh dấu cancelled
      expect(applyLocalOnly).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'inventoryTransactions',
            item: expect.objectContaining({ id: 'tx-return-1', status: 'cancelled' }),
          }),
          expect.objectContaining({
            key: 'posProducts',
            item: expect.objectContaining({ id: 'product-1', stock: 8 }),
          }),
        ])
      );

      // Soft-delete local
      expect(applyLocalOnly).toHaveBeenCalledWith([
        expect.objectContaining({
          key: 'posOrders',
          item: expect.objectContaining({ id: 'return-1', status: 'cancelled' }),
        }),
      ]);

      // Đảo doanh thu — nghịch đảo buildReturnRevenueDelta (trả thuần, không đổi hàng)
      expect(applyRevenueDeltaLocal).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          returnsValue: -100000,
          netRevenue: 100000,
          totalCogs: 60000,
        })
      );

      // Khôi phục khách hàng: totalSpent += 100000, points theo pointsRate mặc định 10000
      expect(applyLocalOnly).toHaveBeenCalledWith([
        expect.objectContaining({
          key: 'posCustomers',
          item: expect.objectContaining({ id: 'cust-1', totalSpent: 600000, points: 15 }),
        }),
      ]);
    });

    it('rejects cancelling an already-cancelled return without calling the RPC', async () => {
      const applyLocalOnly = vi.fn();
      const applyRevenueDeltaLocal = vi.fn();
      const cancelPosReturnTx = vi.fn();
      const updateSurgical = vi.fn();

      await expect(
        processCancelReturn({
          data: baseData,
          returnOrder: { ...returnOrder, status: 'cancelled' },
          applyLocalOnly,
          applyRevenueDeltaLocal,
          cancelPosReturnTx,
          updateSurgical,
        })
      ).rejects.toThrow('đã hủy rồi');
      expect(cancelPosReturnTx).not.toHaveBeenCalled();
    });

    it('rejects cancelling a non-return order', async () => {
      const applyLocalOnly = vi.fn();
      const applyRevenueDeltaLocal = vi.fn();
      const cancelPosReturnTx = vi.fn();
      const updateSurgical = vi.fn();

      await expect(
        processCancelReturn({
          data: baseData,
          returnOrder: { ...returnOrder, isReturn: false },
          applyLocalOnly,
          applyRevenueDeltaLocal,
          cancelPosReturnTx,
          updateSurgical,
        })
      ).rejects.toThrow('Chỉ hủy được phiếu trả hàng');
      expect(cancelPosReturnTx).not.toHaveBeenCalled();
    });
  });

  // [TXN-RPC-01]
  describe('editPosOrder', () => {
    const saleTransaction: InventoryTransaction = {
      id: 'tx-sale-1',
      date: baseOrder.date,
      type: 'Sale',
      staffId: 'Admin',
      referenceId: 'order-1',
      items: [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Giày test',
          quantity: -2,
          previousStock: 10,
          newStock: 8,
        },
      ],
    };

    it('calls the RPC then syncs local state with matching net deltas', async () => {
      const applyLocalOnly = vi.fn().mockResolvedValue(undefined);
      const applyRevenueDeltaLocal = vi.fn().mockResolvedValue(undefined);
      const editPosOrderTx = vi.fn().mockResolvedValue(undefined);
      const updateSurgical = vi.fn().mockResolvedValue(undefined);
      const dataWithTx = {
        ...baseData,
        posProducts: [{ ...baseProduct, stock: 8 }],
        posOrders: [baseOrder],
        inventoryTransactions: [saleTransaction],
      } as AppData;

      // Sửa từ SL 2 lên SL 3 — tăng 1 đơn vị
      const updatedOrder: POSOrder = {
        ...baseOrder,
        items: [{ ...baseOrder.items[0], quantity: 3, total: 300000 }],
        totalAmount: 300000,
        finalAmount: 270000,
      };

      await editPosOrder({
        data: dataWithTx,
        originalOrder: baseOrder,
        updatedOrder,
        applyLocalOnly,
        applyRevenueDeltaLocal,
        editPosOrderTx,
        updateSurgical,
      });

      // RPC (edit_pos_order_tx) phải được gọi TRƯỚC — nếu lỗi, không có local update nào chạy
      expect(editPosOrderTx).toHaveBeenCalledWith('order-1', updatedOrder, null, false);

      // Tồn kho local: net = SL cũ(2) - SL mới(3) = -1 → stock 8 - 1 = 7, tx cũ xóa + tx mới ghi
      expect(applyLocalOnly).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'inventoryTransactions',
            item: { id: 'tx-sale-1' },
            isDelete: true,
          }),
          expect.objectContaining({
            key: 'inventoryTransactions',
            item: expect.objectContaining({ referenceId: 'order-1', type: 'Sale' }),
          }),
          expect.objectContaining({
            key: 'posProducts',
            item: expect.objectContaining({ id: 'product-1', stock: 7 }),
          }),
        ])
      );

      // Ghi đè order local (giữ nguyên id, đổi items/totalAmount/finalAmount)
      expect(applyLocalOnly).toHaveBeenCalledWith([
        { key: 'posOrders', item: updatedOrder },
      ]);

      // Đảo doanh thu ròng — âm delta đơn CŨ (SL2) cộng delta đơn MỚI (SL3)
      expect(applyRevenueDeltaLocal).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          totalGrossRevenue: 100000,
          discount: 0,
          netRevenue: 100000,
          totalCogs: 60000,
          grossProfit: 40000,
        })
      );
    });

    it('rejects editing a return/exchange order (not supported by this function)', async () => {
      const applyLocalOnly = vi.fn();
      const applyRevenueDeltaLocal = vi.fn();
      const editPosOrderTx = vi.fn();
      const updateSurgical = vi.fn();

      await expect(
        editPosOrder({
          data: baseData,
          originalOrder: { ...baseOrder, isReturn: true },
          updatedOrder: { ...baseOrder, isReturn: true },
          applyLocalOnly,
          applyRevenueDeltaLocal,
          editPosOrderTx,
          updateSurgical,
        })
      ).rejects.toThrow('Chưa hỗ trợ sửa đơn trả/đổi hàng');
      expect(editPosOrderTx).not.toHaveBeenCalled();
    });

    it('rejects editing an already-cancelled order', async () => {
      const applyLocalOnly = vi.fn();
      const applyRevenueDeltaLocal = vi.fn();
      const editPosOrderTx = vi.fn();
      const updateSurgical = vi.fn();

      await expect(
        editPosOrder({
          data: baseData,
          originalOrder: { ...baseOrder, status: 'cancelled' },
          updatedOrder: baseOrder,
          applyLocalOnly,
          applyRevenueDeltaLocal,
          editPosOrderTx,
          updateSurgical,
        })
      ).rejects.toThrow('đã hủy — không thể sửa');
      expect(editPosOrderTx).not.toHaveBeenCalled();
    });

    // [ORDERS-EDIT-02]
    describe('chặn sửa số lượng thấp hơn số đã trả', () => {
      const returnOrder: POSOrder = {
        ...baseOrder,
        id: 'return-1',
        orderCode: 'TH-000001',
        isReturn: true,
        originalOrderId: 'order-1',
        items: [
          {
            productId: 'product-1',
            sku: 'SKU-1',
            name: 'Giày test',
            quantity: 1,
            price: 100000,
            discount: 0,
            total: 100000,
          },
        ],
      };
      const dataWithReturn = { ...baseData, posOrders: [baseOrder, returnOrder] } as AppData;

      it('rejects reducing quantity below the amount already returned', async () => {
        const applyLocalOnly = vi.fn().mockResolvedValue(undefined);
        const applyRevenueDeltaLocal = vi.fn().mockResolvedValue(undefined);
        const editPosOrderTx = vi.fn().mockResolvedValue(undefined);
        const updateSurgical = vi.fn().mockResolvedValue(undefined);

        await expect(
          editPosOrder({
            data: dataWithReturn,
            originalOrder: baseOrder,
            updatedOrder: { ...baseOrder, items: [{ ...baseOrder.items[0], quantity: 0 }] },
            applyLocalOnly,
            applyRevenueDeltaLocal,
            editPosOrderTx,
            updateSurgical,
          })
        ).rejects.toThrow('đã có 1 sản phẩm được trả hàng');
        expect(editPosOrderTx).not.toHaveBeenCalled();
      });

      it('allows editing quantity down to (but not below) the amount already returned', async () => {
        const applyLocalOnly = vi.fn().mockResolvedValue(undefined);
        const applyRevenueDeltaLocal = vi.fn().mockResolvedValue(undefined);
        const editPosOrderTx = vi.fn().mockResolvedValue(undefined);
        const updateSurgical = vi.fn().mockResolvedValue(undefined);

        await expect(
          editPosOrder({
            data: dataWithReturn,
            originalOrder: baseOrder,
            updatedOrder: { ...baseOrder, items: [{ ...baseOrder.items[0], quantity: 1 }] },
            applyLocalOnly,
            applyRevenueDeltaLocal,
            editPosOrderTx,
            updateSurgical,
          })
        ).resolves.not.toThrow();
        expect(editPosOrderTx).toHaveBeenCalled();
      });
    });
  });
});
