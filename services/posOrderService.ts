import {
  AppData,
  CustomerDebtRecord,
  InventoryTransaction,
  POSCustomer,
  POSOrder,
  POSOrderItem,
  POSProduct,
  RevenueDelta,
  AppDataSurgicalUpdate,
} from '../types';
import { auditService } from './auditService';
import { getCurrentStaffId } from '../components/shared/staff';
import { buildPosSalesRecordUpsertsForDate } from '../src/lib/posSalesAttribution';

type PosOrderCallbacks = {
  pushBatch: (key: keyof AppData, items: unknown[]) => Promise<void>;
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  // [DATA-02] Cộng dồn doanh thu ngày theo delta atomic (chống race nhiều máy cùng ngày)
  applyRevenueDelta: (dateKey: string, delta: RevenueDelta) => Promise<void>;
};

type PlaceOrderArgs = PosOrderCallbacks & {
  data: AppData;
  order: POSOrder;
  updatedProducts: POSProduct[];
  updatedCustomer?: POSCustomer;
  debtRecord?: CustomerDebtRecord;
  allowSellOutOfStock?: boolean;
};

type DeleteOrderArgs = Pick<PosOrderCallbacks, 'updateSurgical' | 'applyRevenueDelta'> & {
  data: AppData;
  order: POSOrder;
};

type EditOrderArgs = Pick<PosOrderCallbacks, 'updateSurgical' | 'applyRevenueDelta'> & {
  data: AppData;
  originalOrder: POSOrder;
  // Giữ NGUYÊN id/orderCode/date so với originalOrder — chỉ đổi items/khách/PTTT/giảm giá...
  updatedOrder: POSOrder;
  updatedCustomer?: POSCustomer;
  debtRecord?: CustomerDebtRecord; // nợ MỚI nếu đơn sửa bật bán nợ (nợ CŨ tự xóa)
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

function computeGrossProfit(netRevenue: number, revenueOther: number, cogs: number): number {
  return netRevenue + revenueOther - cogs;
}

// [DATA-02] Phần đóng góp của 1 đơn BÁN vào doanh thu ngày (delta cộng dồn atomic).
// netRevenue = totalAmount - discount; revenueOther = finalAmount - netRevenue (phụ phí ship/dịch vụ).
function buildRevenueDelta(order: POSOrder, orderCogs: number): RevenueDelta {
  const orderTotalAmount = Number(order.totalAmount) || 0;
  const orderDiscount = Number(order.discount) || 0;
  const orderNetRevenue = Math.max(0, orderTotalAmount - orderDiscount);
  const orderOtherFees = Math.max(0, (Number(order.finalAmount) || 0) - orderNetRevenue);
  return {
    totalGrossRevenue: orderTotalAmount,
    discount: orderDiscount,
    revenueOther: orderOtherFees,
    returnsValue: 0,
    netRevenue: orderNetRevenue,
    totalCogs: orderCogs,
    grossProfit: computeGrossProfit(orderNetRevenue, orderOtherFees, orderCogs),
  };
}

// [DATA-02] Delta cho đơn TRẢ/ĐỔI: trả làm giảm doanh thu thuần & giá vốn, đổi làm tăng;
// returnFee ghi vào revenueOther; returnsValue cộng giá trị hàng trả.
function buildReturnRevenueDelta(
  returnOrder: POSOrder,
  totalReturnValue: number,
  totalExchangeValue: number,
  returnCogs: number,
  exchangeCogs: number
): RevenueDelta {
  const orderReturnFee = Number(returnOrder.returnFee) || 0;
  const netDelta = -totalReturnValue + totalExchangeValue;
  const cogsDelta = -returnCogs + exchangeCogs;
  return {
    totalGrossRevenue: 0,
    discount: 0,
    revenueOther: orderReturnFee,
    returnsValue: totalReturnValue,
    netRevenue: netDelta,
    totalCogs: cogsDelta,
    grossProfit: computeGrossProfit(netDelta, orderReturnFee, cogsDelta),
  };
}

// Đảo dấu delta để rollback (cộng dồn ngược lại đúng giá trị đã ghi).
function negateRevenueDelta(d: RevenueDelta): RevenueDelta {
  return {
    totalGrossRevenue: -d.totalGrossRevenue,
    discount: -d.discount,
    revenueOther: -d.revenueOther,
    returnsValue: -d.returnsValue,
    netRevenue: -d.netRevenue,
    totalCogs: -d.totalCogs,
    grossProfit: -d.grossProfit,
  };
}

// Gộp 2 delta thành 1 delta ròng (cộng từng field) — dùng khi sửa đơn để chỉ gọi
// applyRevenueDelta 1 lần thay vì 2 lần (đảo dấu đơn cũ + đơn mới).
function mergeRevenueDeltas(a: RevenueDelta, b: RevenueDelta): RevenueDelta {
  return {
    totalGrossRevenue: a.totalGrossRevenue + b.totalGrossRevenue,
    discount: a.discount + b.discount,
    revenueOther: a.revenueOther + b.revenueOther,
    returnsValue: a.returnsValue + b.returnsValue,
    netRevenue: a.netRevenue + b.netRevenue,
    totalCogs: a.totalCogs + b.totalCogs,
    grossProfit: a.grossProfit + b.grossProfit,
  };
}

// sv-SE = YYYY-MM-DD format, nhất quán với businessLogic.revenue.ts
function toLocalDateKey(dateString: string): string {
  const date = new Date(dateString);
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('sv-SE');
  return new Date().toLocaleDateString('sv-SE');
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
  applyRevenueDelta,
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
  const revenueDelta = buildRevenueDelta(order, orderCogs);
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

    // Bước 2: Ghi inventory transaction + cập nhật stock trong 1 lần gọi.
    // updateSurgical phát hiện có cả inventoryTransactions + posProducts → kích hoạt
    // apply_inventory_transaction_with_stock RPC (atomic INSERT + UPDATE trong 1 SQL transaction).
    // AUDIT-003/009: gộp 2 lần gọi riêng lẻ thành 1 để đảm bảo atomicity.
    const stockUpdates = order.items
      .map(item => ({
        key: 'posProducts' as const,
        item: findProduct(updatedMap, item.productId),
      }))
      .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);

    await updateSurgical([{ key: 'inventoryTransactions', item: inventoryTransaction }, ...stockUpdates]);
    rollbackSteps.push(async () => {
      console.error('[ROLLBACK] Xóa inventory transaction + hoàn tồn kho:', inventoryTransaction.id);
      const revertStockUpdates = order.items
        .map(item => ({ key: 'posProducts' as const, item: findProduct(currentMap, item.productId) }))
        .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);
      // Rollback cũng gộp 1 lần → RPC atomic deleteInventoryTransactionWithStock
      await updateSurgical([
        { key: 'inventoryTransactions', item: { id: inventoryTransaction.id }, isDelete: true },
        ...revertStockUpdates,
      ]);
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
      rollbackSteps.push(async () => {
        console.error('[ROLLBACK] Xóa debtRecord:', debtRecord.id);
        await updateSurgical([{ key: 'customerDebtHistory', item: { id: debtRecord.id }, isDelete: true }]);
      });
    }

    // Bước 4: Cộng dồn doanh thu ATOMIC theo delta (DATA-02 — hết race nhiều máy cùng ngày)
    await applyRevenueDelta(orderDate, revenueDelta);
    rollbackSteps.push(async () => {
      console.error('[ROLLBACK] Hoàn doanh thu (delta đảo dấu) ngày', orderDate);
      await applyRevenueDelta(orderDate, negateRevenueDelta(revenueDelta));
    });

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
  applyRevenueDelta,
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

  const totalReturnValue = returnedItems.reduce((sum, item) => sum + item.total, 0);
  const totalExchangeValue = exchangeItems.reduce((sum, item) => sum + item.total, 0);

  // AUDIT-006: thiết kế có chủ đích — trả hàng ghi vào ngày trả, không điều chỉnh ngày bán gốc.
  const returnDate = toLocalDateKey(returnOrder.date);
  const returnRevenueDelta = buildReturnRevenueDelta(
    returnOrder,
    totalReturnValue,
    totalExchangeValue,
    returnCogs,
    exchangeCogs
  );

  const rollbackSteps: Array<() => Promise<void>> = [];

  try {
    // Bước 1: Cộng dồn doanh thu ngày trả ATOMIC theo delta (DATA-02)
    await applyRevenueDelta(returnDate, returnRevenueDelta);
    rollbackSteps.push(async () => {
      await applyRevenueDelta(returnDate, negateRevenueDelta(returnRevenueDelta));
    });

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
      // AUDIT-007: Service tự tính totalSpent — không phụ thuộc caller tính đúng.
      // Trừ giá trị hàng trả thực tế, cộng giá trị hàng đổi (mua mới).
      const totalReturnValue = returnedItems.reduce((sum, item) => sum + item.total, 0);
      const totalExchangeValue = exchangeItems.reduce((sum, item) => sum + item.total, 0);
      const correctedCustomer: POSCustomer = {
        ...updatedCustomer,
        totalSpent: Math.max(0, (originalCustomer?.totalSpent || 0) - totalReturnValue + totalExchangeValue),
      };
      await updateSurgical([{ key: 'posCustomers', item: correctedCustomer }]);
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

// Xóa 1 đơn BÁN (không hỗ trợ đơn trả/đổi — logic đảo ngược khác, xem gọi nơi dùng hàm này):
// hoàn tồn kho qua RPC delete_inventory_transaction_with_stock_v2 (dựa vào inventory_transactions
// đã ghi khi bán, referenceId = order.id — chính xác hơn tính lại từ order.items), trừ khỏi
// revenue_records bằng delta đảo dấu của buildRevenueDelta, xóa lịch sử công nợ liên quan,
// tính lại sales_records ngày đó, ghi audit log.
export async function deletePosOrder({
  data,
  order,
  updateSurgical,
  applyRevenueDelta,
}: DeleteOrderArgs): Promise<void> {
  if (order.isReturn) {
    throw new Error('Chưa hỗ trợ xóa đơn trả/đổi hàng qua chức năng này');
  }

  const currentProducts = data.posProducts || [];
  const currentMap = buildProductMap(currentProducts);

  // Bước 1: Hoàn tồn kho — xóa inventory transaction gắn với đơn (RPC tự cộng lại đúng stock
  // theo dữ liệu ĐÃ LƯU, không suy luận lại từ order.items để tránh lệch nếu có drift).
  const relatedTransactionIds = (data.inventoryTransactions || [])
    .filter(t => t.referenceId === order.id)
    .map(t => t.id);

  if (relatedTransactionIds.length > 0) {
    const stockUpdates = order.items
      .map(item => {
        const product = findProduct(currentMap, item.productId);
        if (!product) return null;
        return { key: 'posProducts' as const, item: { ...product, stock: product.stock + item.quantity } };
      })
      .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u);

    const inventoryDeletions = relatedTransactionIds.map(id => ({
      key: 'inventoryTransactions' as const,
      item: { id } as { id: string },
      isDelete: true,
    }));

    // Gộp chung 1 lần gọi → updateSurgical phát hiện có cả inventoryTransactions + posProducts
    // → kích hoạt RPC atomic (giống processPlaceOrder/processReturnOrder).
    await updateSurgical([...inventoryDeletions, ...stockUpdates]);
  } else {
    console.warn(`[deletePosOrder] Không tìm thấy inventory transaction cho đơn ${order.orderCode} — bỏ qua hoàn tồn kho`);
  }

  // Bước 2: Xóa lịch sử công nợ liên quan (nếu đơn bán nợ)
  const relatedDebtRecords = (data.customerDebtHistory || []).filter(d => d.orderId === order.id);
  for (const debt of relatedDebtRecords) {
    await updateSurgical([{ key: 'customerDebtHistory', item: { id: debt.id }, isDelete: true }]);
  }

  // Bước 3: Xóa order
  await updateSurgical([{ key: 'posOrders', item: { id: order.id }, isDelete: true }]);

  // Bước 4: Trừ khỏi doanh thu ngày bán (delta đảo dấu của buildRevenueDelta lúc tạo đơn)
  const orderCogs = calculateOrderCogs(currentMap, order.items);
  const orderDate = toLocalDateKey(order.date);
  const revenueDelta = negateRevenueDelta(buildRevenueDelta(order, orderCogs));
  await applyRevenueDelta(orderDate, revenueDelta);

  // Bước 5: Ghi audit log
  try {
    auditService.logOrderCancel(order.id, order.orderCode, 'Xóa đơn hàng', getCurrentStaffId());
  } catch (auditError) {
    console.error('[AUDIT] Không ghi được audit log khi xóa đơn:', order.orderCode, auditError);
  }
}

// Sửa 1 đơn BÁN đã tồn tại — mở lại trong POS, đổi sản phẩm/số lượng/giá/khách/PTTT..., lưu
// đè lên đúng order.id cũ (không tạo đơn mới). Coi sửa đơn = hoàn tác đơn CŨ (giống
// deletePosOrder) + áp dụng đơn MỚI (giống processPlaceOrder), nhưng gộp doanh thu thành 1
// delta ròng và tính sales_records đúng 1 lần — tránh gọi 2 lần dư thừa vì ngày bán không đổi.
// Không hỗ trợ đơn trả/đổi hàng (isReturn) — logic đảo ngược khác hẳn, và không xử lý trường
// hợp đơn đã có phiếu trả hàng liên kết (originalOrderId trỏ tới order này) — sửa sản phẩm/số
// lượng trong trường hợp đó có thể làm lệch số liệu đã trả, cần xử lý riêng nếu phát sinh.
export async function editPosOrder({
  data,
  originalOrder,
  updatedOrder,
  updatedCustomer,
  debtRecord,
  allowSellOutOfStock = false,
  updateSurgical,
  applyRevenueDelta,
}: EditOrderArgs): Promise<void> {
  if (originalOrder.isReturn || updatedOrder.isReturn) {
    throw new Error('Chưa hỗ trợ sửa đơn trả/đổi hàng qua chức năng này');
  }
  if (updatedOrder.id !== originalOrder.id) {
    throw new Error('editPosOrder yêu cầu updatedOrder giữ nguyên id với originalOrder');
  }

  const currentProducts = data.posProducts || [];
  const currentMap = buildProductMap(currentProducts);

  // Tồn kho cuối = tồn hiện tại + số lượng đơn CŨ (hoàn lại) − số lượng đơn MỚI (trừ lại),
  // gộp theo từng sản phẩm trong 1 bước — tránh sai nếu 1 SP xuất hiện ở cả 2 đơn.
  const oldQtyByProduct = new Map<string, number>();
  for (const item of originalOrder.items) {
    oldQtyByProduct.set(item.productId, (oldQtyByProduct.get(item.productId) || 0) + item.quantity);
  }
  const newQtyByProduct = new Map<string, number>();
  for (const item of updatedOrder.items) {
    newQtyByProduct.set(item.productId, (newQtyByProduct.get(item.productId) || 0) + item.quantity);
  }
  const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);

  if (!allowSellOutOfStock) {
    for (const productId of allProductIds) {
      const product = findProduct(currentMap, productId);
      const net = (oldQtyByProduct.get(productId) || 0) - (newQtyByProduct.get(productId) || 0);
      if (product && product.stock + net < 0) {
        throw new Error(`Không đủ tồn kho: ${product.name} (còn ${product.stock}, cần thêm ${-net})`);
      }
    }
  }

  const updatedProductsMap = new Map<string, POSProduct>();
  for (const productId of allProductIds) {
    const product = findProduct(currentMap, productId);
    if (!product) continue;
    const net = (oldQtyByProduct.get(productId) || 0) - (newQtyByProduct.get(productId) || 0);
    updatedProductsMap.set(productId, { ...product, stock: product.stock + net });
  }

  // Bước 1: hoàn tồn kho đơn CŨ (xóa inventory transaction gắn referenceId=originalOrder.id)
  // + ghi transaction MỚI cho đơn đã sửa — gộp 1 lần gọi, xóa đứng TRƯỚC áp mới trong mảng để
  // RPC chạy tuần tự đúng thứ tự trên stock LIVE trên server (không phụ thuộc `data` cũ/mới).
  const oldTransactionIds = (data.inventoryTransactions || [])
    .filter(t => t.referenceId === originalOrder.id)
    .map(t => t.id);
  const newTransaction = buildSaleTransaction(
    updatedOrder,
    currentMap,
    updatedProductsMap,
    allowSellOutOfStock
  );
  const stockUpdates = [...updatedProductsMap.values()].map(item => ({
    key: 'posProducts' as const,
    item,
  }));

  await updateSurgical([
    ...oldTransactionIds.map(id => ({
      key: 'inventoryTransactions' as const,
      item: { id } as { id: string },
      isDelete: true,
    })),
    { key: 'inventoryTransactions' as const, item: newTransaction },
    ...stockUpdates,
  ]);

  // Bước 2: Xóa nợ CŨ gắn với đơn (nếu có) — nợ MỚI (nếu có) ghi lại ở bước 4
  const oldDebtRecords = (data.customerDebtHistory || []).filter(d => d.orderId === originalOrder.id);
  for (const debt of oldDebtRecords) {
    await updateSurgical([{ key: 'customerDebtHistory', item: { id: debt.id }, isDelete: true }]);
  }

  // Bước 3: Ghi đè order (giữ nguyên id/orderCode/date, đổi items/khách/PTTT/giảm giá...)
  await updateSurgical([{ key: 'posOrders', item: updatedOrder }]);

  // Bước 4: Ghi nợ MỚI nếu đơn sửa bật bán nợ
  if (debtRecord) {
    await updateSurgical([{ key: 'customerDebtHistory', item: debtRecord }]);
  }

  // Bước 5: Cập nhật khách hàng (điểm/tổng chi tiêu) nếu có
  if (updatedCustomer) {
    await updateSurgical([{ key: 'posCustomers', item: updatedCustomer }]);
  }

  // Bước 6: Gộp delta đảo dấu đơn CŨ + delta đơn MỚI thành 1 delta ròng, gọi applyRevenueDelta
  // ĐÚNG 1 LẦN (ngày bán giữ nguyên khi sửa, không cho đổi ngày).
  const oldCogs = calculateOrderCogs(currentMap, originalOrder.items);
  const newCogs = calculateOrderCogs(currentMap, updatedOrder.items);
  const netRevenueDelta = mergeRevenueDeltas(
    negateRevenueDelta(buildRevenueDelta(originalOrder, oldCogs)),
    buildRevenueDelta(updatedOrder, newCogs)
  );
  const orderDate = toLocalDateKey(originalOrder.date);
  await applyRevenueDelta(orderDate, netRevenueDelta);

  // Bước 7: Tính lại sales_records ngày đó (ngày không đổi khi sửa) — dùng snapshot data đã
  // thay order cũ bằng order mới để tính đúng phân bổ doanh số theo item/salesperson mới.
  const recalculationOrders = (data.posOrders || []).map(o =>
    o.id === updatedOrder.id ? updatedOrder : o
  );
  await recalcSalesRecordsForDate(
    { ...data, posOrders: recalculationOrders },
    orderDate,
    new Set(),
    updateSurgical
  );

  // Bước 8: Ghi audit log
  try {
    auditService.logOrderEdit(
      originalOrder.id,
      originalOrder.orderCode,
      { finalAmountBefore: originalOrder.finalAmount, finalAmountAfter: updatedOrder.finalAmount },
      getCurrentStaffId()
    );
  } catch (auditError) {
    console.error('[AUDIT] Không ghi được audit log khi sửa đơn:', originalOrder.orderCode, auditError);
  }
}

// Tính lại sales_records (doanh số NV) cho 1 ngày, loại trừ TOÀN BỘ orderId đã xóa trong batch.
// Gọi 1 LẦN sau khi xóa xong cả loạt đơn (không gọi trong deletePosOrder từng đơn) — vì `data`
// truyền vào các lệnh gọi trong 1 batch là snapshot cũ chưa cập nhật giữa các lần xóa, nếu tính
// lại theo từng đơn sẽ vô tình đếm lại các đơn đã xóa ở bước trước đó trong cùng batch.
export async function recalcSalesRecordsForDate(
  data: AppData,
  dateKey: string,
  excludedOrderIds: Set<string>,
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>
): Promise<void> {
  const remainingOrders = (data.posOrders || []).filter(o => !excludedOrderIds.has(o.id));
  const salesRecords = buildPosSalesRecordUpsertsForDate(remainingOrders, dateKey, data.employees || []);
  const newIds = new Set(salesRecords.map(r => r.id));

  // buildPosSalesRecordUpsertsForDate chỉ trả về NV còn > 0đ đóng góp — NV nào về hẳn 0 (không
  // còn đơn nào trong ngày sau khi xóa) sẽ KHÔNG có trong danh sách trên, cần xóa dòng cũ tay
  // (nếu không sẽ để lại sales_amount cũ dù đơn gốc đã xóa hết).
  const stalePrefix = `pos-sales-${dateKey}-`;
  const staleRecords = (data.sales || []).filter(
    r => r.id.startsWith(stalePrefix) && !newIds.has(r.id)
  );

  const updates: AppDataSurgicalUpdate[] = [
    ...salesRecords.map(record => ({ key: 'sales' as const, item: record })),
    ...staleRecords.map(record => ({ key: 'sales' as const, item: { id: record.id }, isDelete: true })),
  ];
  if (updates.length > 0) {
    await updateSurgical(updates);
  }
}

// Local date key (sv-SE = YYYY-MM-DD) của 1 đơn — dùng để gom nhóm ngày bị ảnh hưởng khi xóa batch.
export function getOrderLocalDateKey(order: POSOrder): string {
  return toLocalDateKey(order.date);
}
