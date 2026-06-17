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
  updatedCustomer?: POSCustomer;
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
  updatedProducts: POSProduct[] | Map<string, POSProduct>,
  allowNegativeStock = false
): InventoryTransaction {
  return {
    id: crypto.randomUUID(),
    date: order.date,
    type: 'Sale',
    staffId: order.staffId,
    allowNegativeStock,
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
  const orderTotalAmount = Number(order.totalAmount) || 0;
  const orderDiscount = Number(order.discount) || 0;
  // [FIX B1] Tách otherFees vào revenueOther — tránh netRevenue > totalGrossRevenue
  // netRevenue = doanh thu hàng hóa (totalAmount - discount)
  // revenueOther = phụ phí khác (ship, dịch vụ...) = finalAmount - netRevenue
  const orderNetRevenue = Math.max(0, orderTotalAmount - orderDiscount);
  const orderOtherFees = Math.max(0, (Number(order.finalAmount) || 0) - orderNetRevenue);

  if (existingRevenue) {
    const updatedNetRevenue = (existingRevenue.netRevenue || 0) + orderNetRevenue;
    const updatedRevenueOther = (existingRevenue.revenueOther || 0) + orderOtherFees;
    const updatedTotalCogs = (existingRevenue.totalCogs || 0) + orderCogs;
    return {
      ...existingRevenue,
      totalGrossRevenue: (existingRevenue.totalGrossRevenue || 0) + orderTotalAmount,
      discount: (existingRevenue.discount || 0) + orderDiscount,
      revenueOther: updatedRevenueOther,
      netRevenue: updatedNetRevenue,
      totalCogs: updatedTotalCogs,
      grossProfit: updatedNetRevenue + updatedRevenueOther - updatedTotalCogs,
    };
  }

  return {
    id: crypto.randomUUID(),
    date: revenueDate,
    totalGrossRevenue: orderTotalAmount,
    discount: orderDiscount,
    revenueOther: orderOtherFees,
    returnsValue: 0,
    netRevenue: orderNetRevenue,
    totalCogs: orderCogs,
    grossProfit: orderNetRevenue + orderOtherFees - orderCogs,
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
  const inventoryTransaction = buildSaleTransaction(
    order,
    currentMap,
    updatedMap,
    allowSellOutOfStock
  );

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

    // [FIX I1] Tách thành 2 bước riêng — nếu bước sau fail, rollback được cả 2
    // Bước 2a: Ghi inventory transaction trước
    await updateSurgical([{ key: 'inventoryTransactions', item: inventoryTransaction }]);
    rollbackSteps.push(async () => {
      console.error('[ROLLBACK] Xóa inventory transaction:', inventoryTransaction.id);
      await updateSurgical([{ key: 'inventoryTransactions', item: { id: inventoryTransaction.id }, isDelete: true }]);
    });

    // Bước 2b: Cập nhật stock sau — nếu fail, bước rollback trên sẽ xóa transaction
    if (stockUpdates.length > 0) {
      await updateSurgical(stockUpdates);
      rollbackSteps.push(async () => {
        console.error('[ROLLBACK] Hoàn tồn kho cho order:', order.id);
        const revertStockUpdates = order.items
          .map(item => ({ key: 'posProducts' as const, item: findProduct(currentMap, item.productId) }))
          .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);
        await updateSurgical(revertStockUpdates);
      });
    }

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
      rollbackSteps.push(async () => {
        console.error('[ROLLBACK] Xóa debtRecord:', debtRecord.id);
        await updateSurgical([{ key: 'customerDebtHistory', item: { id: debtRecord.id }, isDelete: true }]);
      });
    }

    // Bước 4: Cập nhật revenue
    if (existingRevenue) {
      await updateSurgical([{ key: 'revenue', item: revenueRecord }]);
      rollbackSteps.push(async () => {
        console.error('[ROLLBACK] Hoàn revenue:', existingRevenue.id);
        await updateSurgical([{ key: 'revenue', item: existingRevenue }]);
      });
    } else {
      await pushBatch('revenue', [revenueRecord]);
      rollbackSteps.push(async () => {
        console.error('[ROLLBACK] Xóa revenue mới (ngày đầu tiên):', revenueRecord.id);
        await updateSurgical([{ key: 'revenue', item: { id: revenueRecord.id }, isDelete: true }]);
      });
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

  // Bước 4b: Tự động ghi doanh số nhân viên — best-effort, không rollback vì idempotent
  // [FIX POS-1] Tách ra ngoài main try/catch — tránh rollback toàn đơn hàng khi staff update lỗi
  try {
    await autoUpsertStaffSalesForDate(data, order, updateSurgical);
  } catch (staffErr) {
    console.error('[processPlaceOrder] autoUpsertStaffSalesForDate thất bại (non-critical):', staffErr);
  }

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
}

export async function processReturnOrder({
  data,
  returnOrder,
  updatedProducts,
  returnedItems,
  exchangeItems,
  allowSellOutOfStock = false,
  updatedCustomer,
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
  // returnFee (phí trả hàng shop thu) ghi vào revenueOther để phản ánh đúng doanh thu thực
  const orderReturnFee = Number(returnOrder.returnFee) || 0;

  const rollbackSteps: Array<() => Promise<void>> = [];

  try {
    // Bước 1: Ghi revenue
    if (existingRevenue) {
      // BUG-19 fix: không để netRevenue âm khi trả đơn từ ngày khác
      const updatedNetRevenue = Math.max(
        0,
        existingRevenue.netRevenue - totalReturnValue + totalExchangeValue
      );
      const updatedTotalCogs = existingRevenue.totalCogs - returnCogs + exchangeCogs;
      const revenueUpdate: RevenueRecord = {
        ...existingRevenue,
        returnsValue: (existingRevenue.returnsValue || 0) + totalReturnValue,
        netRevenue: updatedNetRevenue,
        revenueOther: (existingRevenue.revenueOther || 0) + orderReturnFee,
        totalCogs: updatedTotalCogs,
        grossProfit: updatedNetRevenue + (existingRevenue.revenueOther || 0) + orderReturnFee - updatedTotalCogs,
      };
      await updateSurgical([{ key: 'revenue', item: revenueUpdate }]);
      rollbackSteps.push(async () => {
        await updateSurgical([{ key: 'revenue', item: existingRevenue }]);
      });
    } else {
      const netRevenue = -totalReturnValue + totalExchangeValue;
      const totalCogs = -returnCogs + exchangeCogs;
      const newRecord: RevenueRecord = {
        id: crypto.randomUUID(),
        date: orderDate,
        totalGrossRevenue: 0,
        discount: 0,
        revenueOther: orderReturnFee,
        returnsValue: totalReturnValue,
        netRevenue,
        totalCogs,
        grossProfit: netRevenue + orderReturnFee - totalCogs,
      };
      await pushBatch('revenue', [newRecord]);
      // BUG-18 fix: đăng ký rollback để xóa record mới nếu bước sau fail
      rollbackSteps.push(async () => {
        console.error('[ROLLBACK] Xóa revenue mới (ngày không có đơn bán):', newRecord.id);
        await updateSurgical([{ key: 'revenue', item: { id: newRecord.id }, isDelete: true }]);
      });
    }

    // Bước 2: Lưu đơn trả hàng
    await pushBatch('posOrders', [returnOrder]);
    rollbackSteps.push(async () => {
      await updateSurgical([{ key: 'posOrders', item: { id: returnOrder.id }, isDelete: true }]);
    });

    // Bước 3: Cập nhật tồn kho + inventory transaction
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
    rollbackSteps.push(async () => {
      // [FIX M2-INV] Xóa inventory transactions đã ghi + hoàn tồn kho trong 1 call
      // shouldUseInventoryRpc = true vì có cả inventoryTransactions lẫn posProducts → RPC atomic
      const inventoryDeletions = inventoryUpdates.map(u => ({
        key: 'inventoryTransactions' as const,
        item: { id: u.item.id } as { id: string },
        isDelete: true,
      }));
      const revertStock = [...allAffectedIds]
        .map(id => ({ key: 'posProducts' as const, item: findProduct(currentMap, id) }))
        .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);
      await updateSurgical([...inventoryDeletions, ...revertStock]);
    });

    // Bước 4: Cập nhật khách hàng
    if (updatedCustomer) {
      const originalCustomer = (data.posCustomers || []).find(c => c.id === updatedCustomer.id);
      await updateSurgical([{ key: 'posCustomers', item: updatedCustomer }]);
      if (originalCustomer) {
        rollbackSteps.push(async () => {
          await updateSurgical([{ key: 'posCustomers', item: originalCustomer }]);
        });
      }
    }
  } catch (error) {
    for (let i = rollbackSteps.length - 1; i >= 0; i--) {
      try { await rollbackSteps[i](); } catch (e) {
        console.error('[ROLLBACK] processReturnOrder bước', i, e);
      }
    }
    throw error;
  }

  // [FIX m4-INV] Chuyển autoUpsert vào trong try/catch riêng — tránh uncaught throw
  // best-effort, không rollback vì idempotent
  try {
    await autoUpsertStaffSalesForDate(data, returnOrder, updateSurgical);
  } catch (staffErr) {
    console.error('[processReturnOrder] autoUpsertStaffSalesForDate thất bại (non-critical):', staffErr);
  }

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
