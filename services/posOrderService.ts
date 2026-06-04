import {
  AppData,
  CustomerDebtRecord,
  InventoryTransaction,
  POSCustomer,
  POSOrder,
  POSOrderItem,
  POSProduct,
  RevenueRecord,
  AppDataSurgicalUpdate,
} from '../types';
import { auditService } from './auditService';
import { getCurrentStaffId } from '../components/shared/staff';
import { buildPosSalesRecordUpsertsForDate } from '../src/lib/posSalesAttribution';

type PosOrderCallbacks = {
  pushBatch: (key: keyof AppData, items: unknown[]) => Promise<void>;
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
};

type PlaceOrderArgs = PosOrderCallbacks & {
  data: AppData;
  order: POSOrder;
  updatedProducts: POSProduct[];
  updatedCustomer?: POSCustomer;
  debtRecord?: CustomerDebtRecord;
  allowSellOutOfStock?: boolean;
};

type ReturnOrderArgs = PosOrderCallbacks & {
  data: AppData;
  returnOrder: POSOrder;
  updatedProducts: POSProduct[];
  returnedItems: POSOrderItem[];
  exchangeItems: POSOrderItem[];
  allowSellOutOfStock?: boolean;
};

function buildProductMap(products: POSProduct[]): Map<string, POSProduct> {
  return new Map(products.map(p => [p.id, p]));
}

function findProduct(products: POSProduct[] | Map<string, POSProduct>, productId: string) {
  if (products instanceof Map) return products.get(productId);
  return products.find(p => p.id === productId);
}

function calculateOrderCogs(products: POSProduct[] | Map<string, POSProduct>, items: POSOrderItem[]) {
  return items.reduce((sum, item) => {
    // Ưu tiên importPrice đã lưu trong item (giá vốn tại thời điểm bán)
    // Fallback sang pos_products.importPrice hiện tại nếu item cũ không có
    const ip = item.importPrice ?? (() => {
      const product = findProduct(products, item.productId);
      if (!product) console.warn(`[COGS] Không tìm thấy sản phẩm ${item.productId}`);
      return product?.importPrice || 0;
    })();
    return sum + ip * item.quantity;
  }, 0);
}

function buildSaleTransaction(
  order: POSOrder,
  currentProducts: POSProduct[] | Map<string, POSProduct>,
  updatedProducts: POSProduct[] | Map<string, POSProduct>
): InventoryTransaction {
  return {
    id: crypto.randomUUID(),
    date: order.date,
    type: 'Sale',
    staffId: order.staffId,
    items: order.items.map(item => {
      const product = findProduct(currentProducts, item.productId);
      const updatedProduct = findProduct(updatedProducts, item.productId);
      return {
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: -item.quantity,
        previousStock: product?.stock || 0,
        newStock: updatedProduct?.stock ?? (product?.stock || 0) - item.quantity,
      };
    }),
    note: `Bán hàng đơn ${order.orderCode}`,
    referenceId: order.id,
  };
}

function buildReturnTransaction(
  returnOrder: POSOrder,
  currentProducts: POSProduct[] | Map<string, POSProduct>,
  updatedProducts: POSProduct[] | Map<string, POSProduct>,
  returnedItems: POSOrderItem[]
): InventoryTransaction {
  return {
    id: crypto.randomUUID(),
    date: returnOrder.date,
    type: 'Return',
    staffId: returnOrder.staffId,
    items: returnedItems.map(item => {
      const product = findProduct(currentProducts, item.productId);
      const updatedProduct = findProduct(updatedProducts, item.productId);
      return {
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        previousStock: product?.stock || 0,
        newStock: updatedProduct?.stock ?? (product?.stock || 0) + item.quantity,
      };
    }),
    note: `Trả hàng ${returnOrder.orderCode}`,
    referenceId: returnOrder.id,
  };
}

function buildExchangeTransaction(
  returnOrder: POSOrder,
  currentProducts: POSProduct[] | Map<string, POSProduct>,
  updatedProducts: POSProduct[] | Map<string, POSProduct>,
  exchangeItems: POSOrderItem[]
): InventoryTransaction {
  return {
    id: crypto.randomUUID(),
    date: returnOrder.date,
    type: 'Sale',
    staffId: returnOrder.staffId,
    items: exchangeItems.map(item => {
      const product = findProduct(currentProducts, item.productId);
      const updatedProduct = findProduct(updatedProducts, item.productId);
      return {
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: -item.quantity,
        previousStock: product?.stock || 0,
        newStock: updatedProduct?.stock ?? (product?.stock || 0) - item.quantity,
      };
    }),
    note: `Đổi hàng ${returnOrder.orderCode}`,
    referenceId: returnOrder.id,
  };
}

function buildRevenueUpdate(
  existingRevenue: RevenueRecord | undefined,
  order: POSOrder,
  orderCogs: number
): RevenueRecord {
  const revenueDate = toLocalDateKey(order.date);
  if (existingRevenue) {
    const updatedNetRevenue = (existingRevenue.netRevenue || 0) + order.finalAmount;
    const updatedTotalCogs = (existingRevenue.totalCogs || 0) + orderCogs;
    return {
      ...existingRevenue,
      totalGrossRevenue: (existingRevenue.totalGrossRevenue || 0) + order.totalAmount,
      discount: (existingRevenue.discount || 0) + order.discount,
      netRevenue: updatedNetRevenue,
      totalCogs: updatedTotalCogs,
      grossProfit: updatedNetRevenue - updatedTotalCogs,
    };
  }

  return {
    id: crypto.randomUUID(),
    date: revenueDate,
    totalGrossRevenue: order.totalAmount,
    discount: order.discount,
    revenueOther: 0,
    returnsValue: 0,
    netRevenue: order.finalAmount,
    totalCogs: orderCogs,
    grossProfit: order.finalAmount - orderCogs,
  };
}

function toLocalDateKey(dateString: string): string {
  const date = new Date(dateString);
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('en-CA');
  return new Date().toLocaleDateString('en-CA');
}

function buildOrdersForStaffSales(existingOrders: POSOrder[] = [], order: POSOrder) {
  return [...existingOrders.filter(item => item.id !== order.id), order];
}

async function autoUpsertStaffSalesForDate(
  data: AppData,
  order: POSOrder,
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>
) {
  const salesDate = toLocalDateKey(order.date);
  const orders = buildOrdersForStaffSales(data.posOrders || [], order);
  const salesRecords = buildPosSalesRecordUpsertsForDate(orders, salesDate, data.employees || []);
  if (salesRecords.length === 0) return;
  await updateSurgical(salesRecords.map(record => ({ key: 'sales' as const, item: record })));
}

export async function processPlaceOrder({
  data,
  order,
  updatedProducts,
  updatedCustomer,
  debtRecord,
  allowSellOutOfStock = false,
  pushBatch,
  updateSurgical,
}: PlaceOrderArgs): Promise<void> {
  const currentProducts = data.posProducts || [];
  // Build Maps một lần — tránh O(items × products) khi nhiều items
  const currentMap = buildProductMap(currentProducts);
  const updatedMap  = buildProductMap(updatedProducts);

  // Guard: phát hiện tồn kho âm trước khi ghi — bảo vệ client-side tránh race condition
  // (phía server dùng RPC decrement_product_stock để đảm bảo atomicity thực sự)
  if (!allowSellOutOfStock) {
    for (const item of order.items) {
      const current = findProduct(currentMap, item.productId);
      if (current && current.stock < item.quantity) {
        throw new Error(
          `Không đủ tồn kho: ${item.name} (còn ${current.stock}, cần ${item.quantity})`
        );
      }
    }
  }

  const orderCogs = calculateOrderCogs(currentMap, order.items);
  const orderDate = toLocalDateKey(order.date);
  const existingRevenue = (data.revenue || []).find(r => r.date === orderDate);
  const revenueRecord = buildRevenueUpdate(existingRevenue, order, orderCogs);
  const inventoryTransaction = buildSaleTransaction(order, currentMap, updatedMap);

  // Rollback state để phục hồi nếu có lỗi
  const rollbackSteps: Array<() => Promise<void>> = [];

  try {
    // Bước 1: Lưu order
    await pushBatch('posOrders', [order]);
    rollbackSteps.push(async () => {
      console.error('[ROLLBACK] Xóa order:', order.id);
      await updateSurgical([{ key: 'posOrders', item: { id: order.id }, isDelete: true }]);
    });

    // Bước 2: Cập nhật stock và inventory transaction
    const stockUpdates = order.items
      .map(item => ({
        key: 'posProducts' as const,
        item: findProduct(updatedMap, item.productId),
      }))
      .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);

    await updateSurgical([
      ...stockUpdates,
      { key: 'inventoryTransactions', item: inventoryTransaction },
    ]);

    rollbackSteps.push(async () => {
      console.error('[ROLLBACK] Hoàn tồn kho cho order:', order.id);
      const revertStockUpdates = order.items.map(item => ({
        key: 'posProducts' as const,
        item: {
          ...findProduct(currentMap, item.productId)!,
        },
      }));
      await updateSurgical(revertStockUpdates);
    });

    // Bước 3: Cập nhật customer (nếu có)
    if (updatedCustomer) {
      await updateSurgical([{ key: 'posCustomers', item: updatedCustomer }]);
      rollbackSteps.push(async () => {
        console.error('[ROLLBACK] Hoàn điểm khách hàng:', updatedCustomer.id);
        const originalCustomer = data.posCustomers?.find(c => c.id === updatedCustomer.id);
        if (originalCustomer) {
          await updateSurgical([{ key: 'posCustomers', item: originalCustomer }]);
        }
      });
    }

    // Bước 3b: Ghi lịch sử công nợ khách hàng (nếu có)
    if (debtRecord) {
      await pushBatch('customerDebtHistory', [debtRecord]);
    }

    // Bước 4: Cập nhật revenue
    if (existingRevenue) {
      await updateSurgical([{ key: 'revenue', item: revenueRecord }]);
    } else {
      await pushBatch('revenue', [revenueRecord]);
    }

    // Bước 4b: Tự động ghi doanh số nhân viên từ các dòng hàng POS trong ngày
    await autoUpsertStaffSalesForDate(data, order, updateSurgical);

    // Bước 5: Ghi audit log
    try {
      await auditService.logOrderCreate(
        order.id,
        order.orderCode,
        {
          customerName: order.customerName,
          totalAmount: order.totalAmount,
          discount: order.discount,
          finalAmount: order.finalAmount,
          paymentMethod: order.paymentMethod,
          itemCount: order.items.length,
        },
        getCurrentStaffId()
      );
    } catch (auditError) {
      console.error('[AUDIT] Không ghi được audit log cho đơn hàng:', order.orderCode, auditError);
    }
  } catch (error) {
    console.error('[ERROR] Lỗi khi xử lý đơn hàng, đang rollback...', error);

    // Thực hiện rollback theo thứ tự ngược lại
    for (let i = rollbackSteps.length - 1; i >= 0; i--) {
      try {
        await rollbackSteps[i]();
      } catch (rollbackError) {
        console.error('[ROLLBACK ERROR] Không thể rollback bước', i, rollbackError);
      }
    }

    throw error; // Re-throw để UI xử lý
  }
}

export async function processReturnOrder({
  data,
  returnOrder,
  updatedProducts,
  returnedItems,
  exchangeItems,
  allowSellOutOfStock = false,
  pushBatch,
  updateSurgical,
}: ReturnOrderArgs): Promise<void> {
  const currentProducts = data.posProducts || [];
  // Build Maps một lần — tránh O(items × products) khi nhiều items
  const currentMap = buildProductMap(currentProducts);
  const updatedMap  = buildProductMap(updatedProducts);

  if (!allowSellOutOfStock) {
    for (const item of exchangeItems) {
      const current = findProduct(currentMap, item.productId);
      if (current && current.stock < item.quantity) {
        throw new Error(
          `Không đủ tồn kho hàng đổi: ${item.name} (còn ${current.stock}, cần ${item.quantity})`
        );
      }
    }
  }

  // Tính COGS cho hàng trả và hàng đổi
  const returnCogs = calculateOrderCogs(currentMap, returnedItems);
  const exchangeCogs = calculateOrderCogs(currentMap, exchangeItems);

  // Cập nhật revenue: trừ tiền trả, cộng tiền đổi, điều chỉnh COGS
  const orderDate = toLocalDateKey(returnOrder.date);
  const existingRevenue = (data.revenue || []).find(r => r.date === orderDate);

  const totalReturnValue = returnedItems.reduce((sum, item) => sum + item.total, 0);
  const totalExchangeValue = exchangeItems.reduce((sum, item) => sum + item.total, 0);

  if (existingRevenue) {
    const updatedNetRevenue =
      existingRevenue.netRevenue + returnOrder.finalAmount + totalExchangeValue;
    const updatedTotalCogs = existingRevenue.totalCogs - returnCogs + exchangeCogs;

    const revenueUpdate: RevenueRecord = {
      ...existingRevenue,
      returnsValue: (existingRevenue.returnsValue || 0) + totalReturnValue,
      netRevenue: updatedNetRevenue,
      totalCogs: updatedTotalCogs,
      grossProfit: updatedNetRevenue - updatedTotalCogs,
    };

    await updateSurgical([{ key: 'revenue', item: revenueUpdate }]);
  } else {
    // Trả hàng khác ngày bán — tạo revenue record mới ghi nhận tác động âm
    const netRevenue = returnOrder.finalAmount + totalExchangeValue;
    const totalCogs = -returnCogs + exchangeCogs;
    const newRecord: RevenueRecord = {
      id: crypto.randomUUID(),
      date: orderDate,
      totalGrossRevenue: 0,
      discount: 0,
      revenueOther: 0,
      returnsValue: totalReturnValue,
      netRevenue,
      totalCogs,
      grossProfit: netRevenue - totalCogs,
    };
    await pushBatch('revenue', [newRecord]);
  }

  await pushBatch('posOrders', [returnOrder]);

  const allAffectedIds = new Set([
    ...returnedItems.map(i => i.productId),
    ...exchangeItems.map(i => i.productId),
  ]);
  const stockUpdates = [...allAffectedIds]
    .map(id => ({ key: 'posProducts' as const, item: findProduct(updatedMap, id) }))
    .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);
  const inventoryUpdates: AppDataSurgicalUpdate[] = [];

  if (returnedItems.length > 0) {
    inventoryUpdates.push({
      key: 'inventoryTransactions',
      item: buildReturnTransaction(returnOrder, currentMap, updatedMap, returnedItems),
    });
  }

  if (exchangeItems.length > 0) {
    inventoryUpdates.push({
      key: 'inventoryTransactions',
      item: buildExchangeTransaction(returnOrder, currentMap, updatedMap, exchangeItems),
    });
  }

  await updateSurgical([...stockUpdates, ...inventoryUpdates]);

  // Tự động ghi doanh số nhân viên nếu đơn đổi trả có phần khách bù thêm
  await autoUpsertStaffSalesForDate(data, returnOrder, updateSurgical);

  // Ghi audit log cho trả hàng
  try {
    await auditService.logOrderReturn(
      returnOrder.id,
      returnOrder.orderCode,
      returnOrder.notes?.match(/Đơn gốc: (.*)/)?.[1], // Extract original order code from notes
      {
        customerName: returnOrder.customerName,
        returnedItemsCount: returnedItems.length,
        exchangeItemsCount: exchangeItems.length,
        finalAmount: returnOrder.finalAmount,
      },
      getCurrentStaffId()
    );
  } catch (auditError) {
    console.error(
      '[AUDIT] Không ghi được audit log cho trả hàng:',
      returnOrder.orderCode,
      auditError
    );
  }
}
