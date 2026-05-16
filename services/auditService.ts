/**
 * Audit Service - Ghi log các thay đổi quan trọng trong hệ thống
 * Giúp theo dõi lịch sử thay đổi giá, chiết khấu, tồn kho, v.v.
 */

export interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'create' | 'update' | 'delete' | 'price_change' | 'discount_change' | 'stock_change';
  userId?: string;
  userName?: string;
  snapshot: Record<string, unknown>;
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  reason?: string;
  createdAt: string;
}

class AuditService {
  private logs: AuditLog[] = [];
  private maxLogs = 10000; // Giới hạn số log trong memory

  /**
   * Ghi log thay đổi giá sản phẩm
   */
  logPriceChange(
    productId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
    userId?: string,
    reason?: string
  ): void {
    this.addLog({
      tableName: 'pos_products',
      recordId: productId,
      action: 'price_change',
      userId,
      snapshot: {
        productName,
        oldPrice,
        newPrice,
        priceChange: newPrice - oldPrice,
        priceChangePercent: oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0,
      },
      changes: [
        {
          field: 'salePrice',
          oldValue: oldPrice,
          newValue: newPrice,
        },
      ],
      reason,
    });
  }

  /**
   * Ghi log thay đổi chiết khấu
   */
  logDiscountChange(
    orderId: string,
    orderCode: string,
    itemName: string,
    oldDiscount: number,
    newDiscount: number,
    userId?: string
  ): void {
    this.addLog({
      tableName: 'pos_orders',
      recordId: orderId,
      action: 'discount_change',
      userId,
      snapshot: {
        orderCode,
        itemName,
        oldDiscount,
        newDiscount,
        discountChange: newDiscount - oldDiscount,
      },
      changes: [
        {
          field: 'discount',
          oldValue: oldDiscount,
          newValue: newDiscount,
        },
      ],
    });
  }

  /**
   * Ghi log thay đổi tồn kho
   */
  logStockChange(
    productId: string,
    productName: string,
    oldStock: number,
    newStock: number,
    reason: string,
    userId?: string
  ): void {
    this.addLog({
      tableName: 'pos_products',
      recordId: productId,
      action: 'stock_change',
      userId,
      snapshot: {
        productName,
        oldStock,
        newStock,
        stockChange: newStock - oldStock,
      },
      changes: [
        {
          field: 'stock',
          oldValue: oldStock,
          newValue: newStock,
        },
      ],
      reason,
    });
  }

  /**
   * Ghi log tạo đơn hàng
   */
  logOrderCreate(
    orderId: string,
    orderCode: string,
    orderData: Record<string, unknown>,
    userId?: string
  ): void {
    this.addLog({
      tableName: 'pos_orders',
      recordId: orderId,
      action: 'create',
      userId,
      snapshot: {
        orderCode,
        ...orderData,
      },
    });
  }

  /**
   * Ghi log hủy đơn hàng
   */
  logOrderCancel(
    orderId: string,
    orderCode: string,
    reason: string,
    userId?: string
  ): void {
    this.addLog({
      tableName: 'pos_orders',
      recordId: orderId,
      action: 'delete',
      userId,
      snapshot: {
        orderCode,
      },
      reason,
    });
  }

  /**
   * Ghi log trả hàng
   */
  logOrderReturn(
    returnOrderId: string,
    returnOrderCode: string,
    originalOrderId: string | undefined,
    returnData: Record<string, unknown>,
    userId?: string
  ): void {
    this.addLog({
      tableName: 'pos_orders',
      recordId: returnOrderId,
      action: 'create',
      userId,
      snapshot: {
        returnOrderCode,
        originalOrderId,
        isReturn: true,
        ...returnData,
      },
      reason: 'Trả hàng',
    });
  }

  /**
   * Thêm log vào danh sách
   */
  private addLog(logData: Omit<AuditLog, 'id' | 'createdAt'>): void {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      userName: logData.userId || 'System',
      ...logData,
    };

    this.logs.unshift(log); // Thêm vào đầu danh sách

    // Giới hạn số log trong memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Log ra console để debug
    console.log('[AUDIT]', log.action, log.tableName, log.recordId, log.snapshot);
  }

  /**
   * Lấy danh sách log theo bộ lọc
   */
  getLogs(filter?: {
    tableName?: string;
    recordId?: string;
    action?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): AuditLog[] {
    let filtered = this.logs;

    if (filter?.tableName) {
      filtered = filtered.filter(log => log.tableName === filter.tableName);
    }

    if (filter?.recordId) {
      filtered = filtered.filter(log => log.recordId === filter.recordId);
    }

    if (filter?.action) {
      filtered = filtered.filter(log => log.action === filter.action);
    }

    if (filter?.userId) {
      filtered = filtered.filter(log => log.userId === filter.userId);
    }

    if (filter?.fromDate) {
      filtered = filtered.filter(log => log.createdAt >= filter.fromDate!);
    }

    if (filter?.toDate) {
      filtered = filtered.filter(log => log.createdAt <= filter.toDate!);
    }

    if (filter?.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Lấy lịch sử thay đổi của một record
   */
  getRecordHistory(tableName: string, recordId: string): AuditLog[] {
    return this.getLogs({ tableName, recordId });
  }

  /**
   * Xóa tất cả log (dùng cho testing)
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs ra JSON để lưu vào Supabase
   */
  exportLogs(): AuditLog[] {
    return [...this.logs];
  }

  /**
   * Import logs từ Supabase
   */
  importLogs(logs: AuditLog[]): void {
    this.logs = logs;
  }
}

// Singleton instance
export const auditService = new AuditService();
