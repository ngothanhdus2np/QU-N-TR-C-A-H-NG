import { describe, expect, it, beforeEach, vi } from 'vitest';
import { auditService, AuditLog } from './auditService';

describe('AuditService', () => {
  beforeEach(() => {
    // Clear logs before each test
    auditService.clearLogs();
  });

  describe('logPriceChange', () => {
    it('should log price change with correct data', () => {
      auditService.logPriceChange(
        'product-1',
        'Giày Nike',
        100000,
        120000,
        'user-1',
        'Tăng giá theo thị trường'
      );

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        tableName: 'pos_products',
        recordId: 'product-1',
        action: 'price_change',
        userId: 'user-1',
        reason: 'Tăng giá theo thị trường',
      });
      expect(logs[0].snapshot).toMatchObject({
        productName: 'Giày Nike',
        oldPrice: 100000,
        newPrice: 120000,
        priceChange: 20000,
        priceChangePercent: 20,
      });
      expect(logs[0].changes).toEqual([
        {
          field: 'salePrice',
          oldValue: 100000,
          newValue: 120000,
        },
      ]);
    });

    it('should handle price decrease', () => {
      auditService.logPriceChange('product-2', 'Áo Adidas', 200000, 150000);

      const logs = auditService.getLogs();
      expect(logs[0].snapshot).toMatchObject({
        priceChange: -50000,
        priceChangePercent: -25,
      });
    });

    it('should handle zero old price', () => {
      auditService.logPriceChange('product-3', 'Sản phẩm mới', 0, 100000);

      const logs = auditService.getLogs();
      expect(logs[0].snapshot).toMatchObject({
        priceChangePercent: 0,
      });
    });
  });

  describe('logDiscountChange', () => {
    it('should log discount change with correct data', () => {
      auditService.logDiscountChange(
        'order-1',
        'HD-000001',
        'Giày Nike',
        10000,
        20000,
        'user-1'
      );

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        tableName: 'pos_orders',
        recordId: 'order-1',
        action: 'discount_change',
        userId: 'user-1',
      });
      expect(logs[0].snapshot).toMatchObject({
        orderCode: 'HD-000001',
        itemName: 'Giày Nike',
        oldDiscount: 10000,
        newDiscount: 20000,
        discountChange: 10000,
      });
    });
  });

  describe('logStockChange', () => {
    it('should log stock change with correct data', () => {
      auditService.logStockChange(
        'product-1',
        'Giày Nike',
        10,
        15,
        'Nhập hàng',
        'user-1'
      );

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        tableName: 'pos_products',
        recordId: 'product-1',
        action: 'stock_change',
        userId: 'user-1',
        reason: 'Nhập hàng',
      });
      expect(logs[0].snapshot).toMatchObject({
        productName: 'Giày Nike',
        oldStock: 10,
        newStock: 15,
        stockChange: 5,
      });
    });

    it('should handle stock decrease', () => {
      auditService.logStockChange('product-2', 'Áo Adidas', 20, 15, 'Bán hàng');

      const logs = auditService.getLogs();
      expect(logs[0].snapshot).toMatchObject({
        stockChange: -5,
      });
    });
  });

  describe('logOrderCreate', () => {
    it('should log order creation with correct data', () => {
      const orderData = {
        totalAmount: 200000,
        discount: 30000,
        finalAmount: 170000,
        paymentMethod: 'Cash',
      };

      auditService.logOrderCreate('order-1', 'HD-000001', orderData, 'user-1');

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        tableName: 'pos_orders',
        recordId: 'order-1',
        action: 'create',
        userId: 'user-1',
      });
      expect(logs[0].snapshot).toMatchObject({
        orderCode: 'HD-000001',
        ...orderData,
      });
    });
  });

  describe('logOrderCancel', () => {
    it('should log order cancellation with correct data', () => {
      auditService.logOrderCancel('order-1', 'HD-000001', 'Khách hủy', 'user-1');

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        tableName: 'pos_orders',
        recordId: 'order-1',
        action: 'delete',
        userId: 'user-1',
        reason: 'Khách hủy',
      });
      expect(logs[0].snapshot).toMatchObject({
        orderCode: 'HD-000001',
      });
    });
  });

  describe('logOrderReturn', () => {
    it('should log order return with correct data', () => {
      const returnData = {
        totalAmount: 100000,
        refundAmount: 100000,
      };

      auditService.logOrderReturn(
        'return-1',
        'TH-000001',
        'order-1',
        returnData,
        'user-1'
      );

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        tableName: 'pos_orders',
        recordId: 'return-1',
        action: 'create',
        userId: 'user-1',
        reason: 'Trả hàng',
      });
      expect(logs[0].snapshot).toMatchObject({
        returnOrderCode: 'TH-000001',
        originalOrderId: 'order-1',
        isReturn: true,
        ...returnData,
      });
    });

    it('should handle return without original order', () => {
      auditService.logOrderReturn('return-2', 'TH-000002', undefined, {}, 'user-1');

      const logs = auditService.getLogs();
      expect(logs[0].snapshot).toMatchObject({
        originalOrderId: undefined,
      });
    });
  });

  describe('getLogs', () => {
    beforeEach(() => {
      // Create sample logs
      auditService.logPriceChange('product-1', 'Product 1', 100, 120, 'user-1');
      auditService.logPriceChange('product-2', 'Product 2', 200, 180, 'user-2');
      auditService.logStockChange('product-1', 'Product 1', 10, 15, 'Nhập hàng', 'user-1');
      auditService.logOrderCreate('order-1', 'HD-001', {}, 'user-1');
    });

    it('should return all logs without filter', () => {
      const logs = auditService.getLogs();
      expect(logs).toHaveLength(4);
    });

    it('should filter by tableName', () => {
      const logs = auditService.getLogs({ tableName: 'pos_products' });
      expect(logs).toHaveLength(3);
      expect(logs.every(log => log.tableName === 'pos_products')).toBe(true);
    });

    it('should filter by recordId', () => {
      const logs = auditService.getLogs({ recordId: 'product-1' });
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.recordId === 'product-1')).toBe(true);
    });

    it('should filter by action', () => {
      const logs = auditService.getLogs({ action: 'price_change' });
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.action === 'price_change')).toBe(true);
    });

    it('should filter by userId', () => {
      const logs = auditService.getLogs({ userId: 'user-1' });
      expect(logs).toHaveLength(3);
      expect(logs.every(log => log.userId === 'user-1')).toBe(true);
    });

    it('should filter by date range', () => {
      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const tomorrow = new Date(Date.now() + 86400000).toISOString();

      const logs = auditService.getLogs({ fromDate: yesterday, toDate: tomorrow });
      expect(logs).toHaveLength(4);
    });

    it('should limit results', () => {
      const logs = auditService.getLogs({ limit: 2 });
      expect(logs).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const logs = auditService.getLogs({
        tableName: 'pos_products',
        userId: 'user-1',
        limit: 1,
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].tableName).toBe('pos_products');
      expect(logs[0].userId).toBe('user-1');
    });
  });

  describe('getRecordHistory', () => {
    it('should return history for specific record', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120);
      auditService.logStockChange('product-1', 'Product 1', 10, 15, 'Nhập hàng');
      auditService.logPriceChange('product-2', 'Product 2', 200, 180);

      const history = auditService.getRecordHistory('pos_products', 'product-1');
      expect(history).toHaveLength(2);
      expect(history.every(log => log.recordId === 'product-1')).toBe(true);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120);
      expect(auditService.getLogs()).toHaveLength(1);

      auditService.clearLogs();
      expect(auditService.getLogs()).toHaveLength(0);
    });
  });

  describe('exportLogs and importLogs', () => {
    it('should export and import logs correctly', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120);
      auditService.logStockChange('product-2', 'Product 2', 10, 15, 'Nhập hàng');

      const exported = auditService.exportLogs();
      expect(exported).toHaveLength(2);

      auditService.clearLogs();
      expect(auditService.getLogs()).toHaveLength(0);

      auditService.importLogs(exported);
      expect(auditService.getLogs()).toHaveLength(2);
    });

    it('should export logs as a copy', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120);
      const exported = auditService.exportLogs();
      
      expect(exported).toHaveLength(1);
      expect(exported[0]).toMatchObject({
        tableName: 'pos_products',
        recordId: 'product-1',
        action: 'price_change',
      });
    });
  });

  describe('log properties', () => {
    it('should generate unique IDs for each log', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120);
      auditService.logPriceChange('product-2', 'Product 2', 200, 180);

      const logs = auditService.getLogs();
      expect(logs[0].id).not.toBe(logs[1].id);
      expect(logs[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should set createdAt timestamp', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120);

      const logs = auditService.getLogs();
      expect(logs[0].createdAt).toBeDefined();
      expect(typeof logs[0].createdAt).toBe('string');
      expect(new Date(logs[0].createdAt).getTime()).toBeGreaterThan(0);
    });

    it('should set userName to userId or System', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120, 'user-1');
      auditService.logPriceChange('product-2', 'Product 2', 200, 180);

      const logs = auditService.getLogs();
      expect(logs[0].userName).toBe('System'); // No userId provided
      expect(logs[1].userName).toBe('user-1');
    });

    it('should add logs to the beginning of the list', () => {
      auditService.logPriceChange('product-1', 'Product 1', 100, 120);
      auditService.logPriceChange('product-2', 'Product 2', 200, 180);

      const logs = auditService.getLogs();
      expect(logs[0].recordId).toBe('product-2'); // Most recent first
      expect(logs[1].recordId).toBe('product-1');
    });
  });

  describe('maxLogs limit', () => {
    it('should limit logs to maxLogs (10000)', () => {
      // Create 10001 logs
      for (let i = 0; i < 10001; i++) {
        auditService.logPriceChange(`product-${i}`, `Product ${i}`, 100, 120);
      }

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(10000);
      
      // Should keep most recent logs
      expect(logs[0].recordId).toBe('product-10000');
      expect(logs[9999].recordId).toBe('product-1');
    });
  });

  describe('console logging', () => {
    it('should log to console when adding log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      auditService.logPriceChange('product-1', 'Product 1', 100, 120);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AUDIT]',
        'price_change',
        'pos_products',
        'product-1',
        expect.objectContaining({
          productName: 'Product 1',
          oldPrice: 100,
          newPrice: 120,
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
