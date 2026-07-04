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
import { getReturnedQuantitiesForOrder } from '../src/lib/returnGuards';

type PosOrderCallbacks = {
  pushBatch: (key: keyof AppData, items: unknown[]) => Promise<void>;
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  // [DATA-02] Cộng dồn doanh thu ngày theo delta atomic (chống race nhiều máy cùng ngày)
  applyRevenueDelta: (dateKey: string, delta: RevenueDelta) => Promise<void>;
};

// [TXN-RPC-01] Đồng bộ state local (dispatch + cache), KHÔNG gọi mạng — dùng sau khi 1 RPC
// server-side đã áp dụng đầy đủ thay đổi (server là nguồn sự thật, client chỉ đồng bộ UI).
type AtomicLocalSyncCallbacks = {
  applyLocalOnly: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  applyRevenueDeltaLocal: (dateKey: string, delta: RevenueDelta) => Promise<void>;
};

type PlaceOrderArgs = PosOrderCallbacks & {
  data: AppData;
  order: POSOrder;
  updatedProducts: POSProduct[];
  updatedCustomer?: POSCustomer;
  debtRecord?: CustomerDebtRecord;
  allowSellOutOfStock?: boolean;
};

type DeleteOrderArgs = AtomicLocalSyncCallbacks & {
  data: AppData;
  order: POSOrder;
  // [TXN-RPC-01] Xóa đơn bán qua RPC delete_pos_order_tx (1 transaction DB)
  deletePosOrderTx: (orderId: string) => Promise<void>;
};

type EditOrderArgs = AtomicLocalSyncCallbacks & {
  data: AppData;
  originalOrder: POSOrder;
  // Giữ NGUYÊN id/orderCode/date so với originalOrder — chỉ đổi items/khách/PTTT/giảm giá...
  updatedOrder: POSOrder;
  updatedCustomer?: POSCustomer;
  // Khách của ĐƠN GỐC khi bị đổi sang khách khác / bỏ chọn — bản ghi đã đảo hết phần
  // totalSpent/điểm/nợ mà đơn gốc từng cộng (caller tính, service chỉ ghi). Tính tier/điểm dùng
  // cấu hình localStorage nên KHÔNG nằm trong RPC — vẫn 1 lời gọi mạng thật riêng (updateSurgical).
  revertedCustomer?: POSCustomer;
  debtRecord?: CustomerDebtRecord; // nợ MỚI nếu đơn sửa bật bán nợ (nợ CŨ tự xóa)
  allowSellOutOfStock?: boolean;
  // [TXN-RPC-01] Sửa đơn qua RPC edit_pos_order_tx (1 transaction DB)
  editPosOrderTx: (
    orderId: string,
    updatedOrder: POSOrder,
    debtRecord: CustomerDebtRecord | null,
    allowSellOutOfStock: boolean
  ) => Promise<void>;
  // Khách hàng (bước 5) + sales_records (bước 7) không nằm trong RPC — vẫn cần updateSurgical
  // (mạng thật) riêng cho 2 bước này.
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
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

// [TXN-RPC-01] Hủy 1 đơn BÁN (soft-delete — không hỗ trợ đơn trả/đổi, logic đảo ngược khác):
// gộp toàn bộ vào RPC delete_pos_order_tx (1 transaction DB — hoàn tồn kho, đảo doanh thu,
// đảo khách/nợ, soft-delete đơn) thay vì chuỗi nhiều lời gọi mạng cũ, đóng cửa sổ lệch khi
// rớt mạng giữa chừng. Server là nguồn sự thật; sau khi RPC thành công, áp lại ĐÚNG các delta
// tương ứng (công thức khớp 1-1 với migration 026_delete_pos_order_tx.sql) vào state local
// qua applyLocalOnly/applyRevenueDeltaLocal — chỉ dispatch + lưu cache, không gọi thêm mạng.
// sales_records (doanh số NV) không nằm trong RPC (client tính lại riêng qua
// recalcSalesRecordsForDate, xem MainContent.tsx onDeleteOrders — cùng ranh giới pos_mobile_checkout).
// Đơn KHÔNG bị xóa khỏi DB — chuyển status='cancelled', vẫn xem lại được ở trang Hóa đơn
// (lọc "Đã hủy") và bị loại khỏi mọi tính toán/báo cáo.
export async function deletePosOrder({
  data,
  order,
  applyLocalOnly,
  applyRevenueDeltaLocal,
  deletePosOrderTx,
}: DeleteOrderArgs): Promise<void> {
  if (order.isReturn) {
    throw new Error('Chưa hỗ trợ xóa đơn trả/đổi hàng qua chức năng này');
  }
  if (order.status === 'cancelled') {
    throw new Error(`Đơn ${order.orderCode} đã hủy trước đó`);
  }

  const currentMap = buildProductMap(data.posProducts || []);

  // RPC 1 transaction — hoàn tồn kho + đảo doanh thu + đảo khách/nợ + soft-delete đơn.
  // Lỗi bất kỳ → RPC tự rollback toàn bộ, không có gì để áp lại local (throw luôn cho caller).
  await deletePosOrderTx(order.id);

  // Từ đây RPC đã áp dụng xong trên server — chỉ còn đồng bộ lại state local cho khớp.

  // 1) Hoàn tồn kho local — dựa vào inventory transaction Sale ĐÃ LƯU (giống RPC dùng tx.items,
  //    không suy luận lại từ order.items để tránh lệch nếu có drift).
  const relatedTransactions = (data.inventoryTransactions || []).filter(
    t => t.referenceId === order.id && t.type === 'Sale' && t.status !== 'cancelled'
  );
  if (relatedTransactions.length > 0) {
    const stockDeltaByProduct = new Map<string, number>();
    for (const tx of relatedTransactions) {
      for (const item of tx.items) {
        stockDeltaByProduct.set(
          item.productId,
          (stockDeltaByProduct.get(item.productId) || 0) + Math.abs(item.quantity)
        );
      }
    }
    const stockUpdates = Array.from(stockDeltaByProduct.entries())
      .map(([productId, qty]) => {
        const product = findProduct(currentMap, productId);
        if (!product) return null;
        return { key: 'posProducts' as const, item: { ...product, stock: product.stock + qty } };
      })
      .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u);

    const txCancelUpdates = relatedTransactions.map(tx => ({
      key: 'inventoryTransactions' as const,
      item: { ...tx, status: 'cancelled' as const },
    }));

    await applyLocalOnly([...txCancelUpdates, ...stockUpdates]);
  } else {
    console.warn(`[deletePosOrder] Không tìm thấy inventory transaction cho đơn ${order.orderCode} — bỏ qua hoàn tồn kho local`);
  }

  // 2) Xóa lịch sử công nợ liên quan (nếu đơn bán nợ)
  const relatedDebtRecords = (data.customerDebtHistory || []).filter(d => d.orderId === order.id);
  if (relatedDebtRecords.length > 0) {
    await applyLocalOnly(
      relatedDebtRecords.map(debt => ({
        key: 'customerDebtHistory',
        item: { id: debt.id },
        isDelete: true,
      }))
    );
  }

  // 3) Soft-delete local — chuyển đơn sang 'cancelled', giữ lại để xem/audit
  await applyLocalOnly([{ key: 'posOrders', item: { ...order, status: 'cancelled' } }]);

  // 4) Trừ khỏi doanh thu ngày bán (delta đảo dấu của buildRevenueDelta lúc tạo đơn)
  const orderCogs = calculateOrderCogs(currentMap, order.items);
  const orderDate = toLocalDateKey(order.date);
  const revenueDelta = negateRevenueDelta(buildRevenueDelta(order, orderCogs));
  await applyRevenueDeltaLocal(orderDate, revenueDelta);

  // 5) (best-effort) đảo thống kê khách hàng — đơn gốc từng cộng totalSpent/điểm khi
  // tạo (POSComputer) và cộng debtAmount nếu bán nợ; hủy đơn phải trừ lại tương ứng
  // (trước đây bỏ sót → khách giữ nợ "ảo" không chứng từ + điểm/hạng như chưa hủy)
  try {
    if (order.customerId) {
      const customer = (data.posCustomers || []).find(c => c.id === order.customerId);
      if (customer) {
        const debtDelta = relatedDebtRecords.reduce(
          (sum, d) => sum + (d.type === 'debt' ? d.amount : -d.amount),
          0
        );
        await applyLocalOnly([
          {
            key: 'posCustomers',
            item: {
              ...customer,
              points: Math.max(0, (customer.points || 0) - (order.pointsEarned || 0)),
              totalSpent: Math.max(0, (customer.totalSpent || 0) - (Number(order.finalAmount) || 0)),
              debtAmount: Math.max(0, (customer.debtAmount ?? 0) - debtDelta),
            },
          },
        ]);
      }
    }
  } catch (e) {
    console.error('[deletePosOrder] Đảo thống kê khách hàng thất bại (non-critical):', e);
  }

  // Audit log: RPC đã tự ghi (best-effort) bên trong transaction — không ghi trùng ở client.
}

type CancelReturnArgs = AtomicLocalSyncCallbacks & {
  data: AppData;
  returnOrder: POSOrder;
  // [TXN-RPC-01] Hủy phiếu trả hàng qua RPC cancel_pos_return_tx (1 transaction DB)
  cancelPosReturnTx: (returnOrderId: string) => Promise<void>;
  // sales_records KHÔNG nằm trong RPC (client tính lại best-effort) — vẫn cần updateSurgical
  // (mạng thật) riêng cho bước này.
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
};

type CancelLegacyReturnArgs = Pick<PosOrderCallbacks, 'updateSurgical' | 'applyRevenueDelta'> & {
  data: AppData;
  transaction: InventoryTransaction;
};

// [TXN-RPC-01] Hủy 1 phiếu trả hàng (TH receipt trong pos_orders) — phép đảo ngược của
// processReturnOrder. Gộp toàn bộ vào RPC cancel_pos_return_tx (1 transaction DB — đảo tồn
// kho, đảo doanh thu, khôi phục khách, soft-delete phiếu) thay vì chuỗi nhiều lời gọi mạng cũ.
// Server là nguồn sự thật; sau khi RPC thành công, áp lại ĐÚNG các delta tương ứng (công thức
// khớp 1-1 với migration 027_cancel_pos_return_tx.sql) vào state local qua
// applyLocalOnly/applyRevenueDeltaLocal — chỉ dispatch + lưu cache, không gọi thêm mạng.
// sales_records (doanh số NV) không nằm trong RPC — vẫn tính lại qua updateSurgical (mạng thật),
// cùng ranh giới pos_mobile_checkout/delete_pos_order_tx.
export async function processCancelReturn({
  data,
  returnOrder,
  applyLocalOnly,
  applyRevenueDeltaLocal,
  cancelPosReturnTx,
  updateSurgical,
}: CancelReturnArgs): Promise<void> {
  if (!returnOrder.isReturn) {
    throw new Error('Chỉ hủy được phiếu trả hàng');
  }
  if (returnOrder.status === 'cancelled') {
    throw new Error('Phiếu trả này đã hủy rồi');
  }

  const currentMap = buildProductMap(data.posProducts || []);
  const returnedItems = returnOrder.items.filter(i => i.lineType !== 'exchange');
  const exchangeItems = returnOrder.items.filter(i => i.lineType === 'exchange');

  // RPC 1 transaction — hoàn/trừ tồn kho theo tx.type đã lưu + đảo doanh thu + khôi phục khách
  // + soft-delete phiếu. Lỗi bất kỳ (vd hàng trả đã bán tiếp) → RPC tự rollback toàn bộ.
  await cancelPosReturnTx(returnOrder.id);

  // Từ đây RPC đã áp dụng xong trên server — chỉ còn đồng bộ lại state local cho khớp.

  // 1) Đảo tồn kho local — dựa vào inventory transaction ĐÃ LƯU (giống RPC dùng tx.items):
  // 'Return' (hàng trả) → trừ lại kho, 'Sale' (hàng đổi) → cộng lại kho.
  const relatedTransactions = (data.inventoryTransactions || []).filter(
    t => t.referenceId === returnOrder.id && t.status !== 'cancelled'
  );
  if (relatedTransactions.length > 0) {
    const stockDelta = new Map<string, number>();
    for (const tx of relatedTransactions) {
      for (const item of tx.items) {
        const qty = Math.abs(item.quantity);
        if (tx.type === 'Return') {
          stockDelta.set(item.productId, (stockDelta.get(item.productId) || 0) - qty);
        } else if (tx.type === 'Sale') {
          stockDelta.set(item.productId, (stockDelta.get(item.productId) || 0) + qty);
        }
      }
    }
    const stockUpdates = [...stockDelta.entries()]
      .map(([productId, delta]) => {
        const product = findProduct(currentMap, productId);
        if (!product || delta === 0) return null;
        return { key: 'posProducts' as const, item: { ...product, stock: product.stock + delta } };
      })
      .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u);

    const txCancelUpdates = relatedTransactions.map(tx => ({
      key: 'inventoryTransactions' as const,
      item: { ...tx, status: 'cancelled' as const },
    }));

    await applyLocalOnly([...txCancelUpdates, ...stockUpdates]);
  } else {
    console.warn(
      `[processCancelReturn] Không tìm thấy inventory transaction cho phiếu ${returnOrder.orderCode} — bỏ qua đảo tồn kho local`
    );
  }

  // 2) Soft-delete local — chuyển phiếu sang 'cancelled'
  const cancelledOrder: POSOrder = { ...returnOrder, status: 'cancelled' };
  await applyLocalOnly([{ key: 'posOrders', item: cancelledOrder }]);

  // 3) Đảo doanh thu ngày phiếu (delta đảo dấu của buildReturnRevenueDelta lúc tạo phiếu)
  const totalReturnValue = returnedItems.reduce((sum, item) => sum + item.total, 0);
  const totalExchangeValue = exchangeItems.reduce((sum, item) => sum + item.total, 0);
  const returnCogs = calculateOrderCogs(currentMap, returnedItems);
  const exchangeCogs = calculateOrderCogs(currentMap, exchangeItems);
  await applyRevenueDeltaLocal(
    toLocalDateKey(returnOrder.date),
    negateRevenueDelta(
      buildReturnRevenueDelta(returnOrder, totalReturnValue, totalExchangeValue, returnCogs, exchangeCogs)
    )
  );

  // 4) (best-effort) khôi phục điểm + tổng chi tiêu khách — nghịch đảo công thức lúc tạo
  try {
    if (returnOrder.customerId) {
      const customer = (data.posCustomers || []).find(c => c.id === returnOrder.customerId);
      if (customer) {
        const pointsRate = Math.max(1, data.posPaymentSettings?.pointsRate ?? 10000);
        const pointsRestored = Math.floor(
          returnedItems.reduce((sum, item) => {
            const product = findProduct(currentMap, item.productId);
            if (product?.allowPoints === false) return sum;
            return sum + item.total;
          }, 0) / pointsRate
        );
        await applyLocalOnly([
          {
            key: 'posCustomers',
            item: {
              ...customer,
              points: Math.max(0, (customer.points || 0) + pointsRestored),
              totalSpent: Math.max(0, (customer.totalSpent || 0) + totalReturnValue - totalExchangeValue),
            },
          },
        ]);
      }
    }
  } catch (e) {
    console.error('[processCancelReturn] Khôi phục khách hàng thất bại (non-critical):', e);
  }

  // 5) (best-effort) tính lại doanh số NV ngày phiếu — không nằm trong RPC, vẫn qua mạng thật
  try {
    const recalculationOrders = (data.posOrders || []).map(o =>
      o.id === returnOrder.id ? cancelledOrder : o
    );
    await recalcSalesRecordsForDate(
      { ...data, posOrders: recalculationOrders },
      toLocalDateKey(returnOrder.date),
      new Set(),
      updateSurgical
    );
  } catch (e) {
    console.error('[processCancelReturn] Tính lại doanh số NV thất bại (non-critical):', e);
  }

  // Audit log: RPC đã tự ghi (best-effort) bên trong transaction — không ghi trùng ở client.
}

// Hủy phiếu trả kiểu CŨ — chỉ có inventory transaction 'Return' (không có TH receipt trong
// pos_orders), tạo bởi luồng trả hàng tại trang Trả hàng trước 2026-07-04. Đảo đúng những gì
// luồng cũ đã ghi: xóa transaction qua RPC (trừ kho lại, có guard không âm), giữ bản sao
// status='cancelled', đảo revenue delta ngày xử lý, hoàn điểm/chi tiêu khách theo đơn gốc.
export async function processCancelLegacyReturnTransaction({
  data,
  transaction,
  updateSurgical,
  applyRevenueDelta,
}: CancelLegacyReturnArgs): Promise<void> {
  if (transaction.type !== 'Return' && transaction.type !== 'return') {
    throw new Error('Chỉ hủy được phiếu trả hàng');
  }
  if (transaction.status === 'cancelled') {
    throw new Error('Phiếu trả này đã hủy rồi');
  }

  const currentMap = buildProductMap(data.posProducts || []);
  const items = transaction.items || [];
  const refund =
    Number(transaction.totalAmount) ||
    items.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          Math.abs(Number(item.quantity) || 0) * (Number(item.price) || 0) -
            (Number(item.discount) || 0)
        ),
      0
    );

  // Bước 1: xóa transaction qua RPC — server trừ kho lại atomic (guard không cho âm)
  const stockUpdates = items
    .map(item => {
      const product = findProduct(currentMap, item.productId);
      if (!product) return null;
      return {
        key: 'posProducts' as const,
        item: { ...product, stock: product.stock - Math.abs(Number(item.quantity) || 0) },
      };
    })
    .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u);

  await updateSurgical([
    { key: 'inventoryTransactions', item: { id: transaction.id } as { id: string }, isDelete: true },
    ...stockUpdates,
  ]);

  // Bước 2 (best-effort): giữ bản sao transaction đã hủy làm lịch sử
  try {
    await updateSurgical([
      { key: 'inventoryTransactions', item: { ...transaction, status: 'cancelled' } },
    ]);
  } catch (e) {
    console.error('[processCancelLegacyReturnTransaction] Không giữ được bản sao đã hủy (non-critical):', e);
  }

  // Bước 3: đảo doanh thu — luồng cũ đã trừ netRevenue/totalCogs + cộng returnsValue ngày xử lý
  const cogs = items.reduce((sum, item) => {
    const product = findProduct(currentMap, item.productId);
    return sum + (product?.importPrice || 0) * Math.abs(Number(item.quantity) || 0);
  }, 0);
  await applyRevenueDelta(toLocalDateKey(transaction.date), {
    totalGrossRevenue: 0,
    discount: 0,
    revenueOther: 0,
    returnsValue: -refund,
    netRevenue: refund,
    totalCogs: cogs,
    grossProfit: computeGrossProfit(refund, 0, cogs),
  });

  // Bước 4 (best-effort): hoàn điểm + chi tiêu khách theo đơn gốc (nghịch đảo công thức cũ)
  try {
    const originalOrder = (data.posOrders || []).find(o => o.id === transaction.referenceId);
    if (originalOrder?.customerId && originalOrder.pointsEarned) {
      const customer = (data.posCustomers || []).find(c => c.id === originalOrder.customerId);
      if (customer) {
        const finalAmt = Number(originalOrder.finalAmount) || 0;
        const pts =
          finalAmt > 0 ? Math.floor((refund / finalAmt) * (originalOrder.pointsEarned || 0)) : 0;
        await updateSurgical([
          {
            key: 'posCustomers',
            item: {
              ...customer,
              points: Math.max(0, (customer.points || 0) + pts),
              totalSpent: Math.max(0, (customer.totalSpent || 0) + refund),
            },
          },
        ]);
      }
    }
  } catch (e) {
    console.error('[processCancelLegacyReturnTransaction] Khôi phục khách hàng thất bại (non-critical):', e);
  }

  // Bước 5: audit log
  try {
    auditService.logOrderCancel(
      transaction.id,
      transaction.note || transaction.id,
      'Hủy phiếu trả hàng (kiểu cũ)',
      getCurrentStaffId()
    );
  } catch (auditError) {
    console.error('[AUDIT] Không ghi được audit log khi hủy phiếu trả kiểu cũ:', transaction.id, auditError);
  }
}

// [TXN-RPC-01] Sửa 1 đơn BÁN đã tồn tại — mở lại trong POS, đổi sản phẩm/số lượng/giá/khách/
// PTTT..., lưu đè lên đúng order.id cũ (không tạo đơn mới). Gộp phần hoàn/áp tồn kho + xóa/ghi
// nợ + ghi đè đơn + đảo doanh thu vào RPC edit_pos_order_tx (1 transaction DB) thay vì chuỗi
// nhiều lời gọi mạng cũ. Server là nguồn sự thật; sau khi RPC thành công, áp lại ĐÚNG các delta
// tương ứng (khớp 1-1 với migration 028_edit_pos_order_tx.sql) vào state local qua
// applyLocalOnly/applyRevenueDeltaLocal — chỉ dispatch + lưu cache, không gọi thêm mạng.
// Không hỗ trợ đơn trả/đổi hàng (isReturn) — logic đảo ngược khác hẳn.
// KHÔNG nằm trong RPC: điểm/hạng khách hàng (computeNewTier() đọc cấu hình localStorage —
// server không truy cập được, vẫn 1 lời gọi mạng thật riêng qua updateSurgical) và
// sales_records (tính lại best-effort sau, cùng ranh giới delete_pos_order_tx/cancel_pos_return_tx).
export async function editPosOrder({
  data,
  originalOrder,
  updatedOrder,
  updatedCustomer,
  revertedCustomer,
  debtRecord,
  allowSellOutOfStock = false,
  applyLocalOnly,
  applyRevenueDeltaLocal,
  editPosOrderTx,
  updateSurgical,
}: EditOrderArgs): Promise<void> {
  if (originalOrder.isReturn || updatedOrder.isReturn) {
    throw new Error('Chưa hỗ trợ sửa đơn trả/đổi hàng qua chức năng này');
  }
  if (originalOrder.status === 'cancelled') {
    throw new Error(`Đơn ${originalOrder.orderCode} đã hủy — không thể sửa`);
  }
  if (updatedOrder.id !== originalOrder.id) {
    throw new Error('editPosOrder yêu cầu updatedOrder giữ nguyên id với originalOrder');
  }

  const currentMap = buildProductMap(data.posProducts || []);

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

  // [ORDERS-EDIT-02] Chặn giảm số lượng xuống dưới mức đã trả — kiểm tra nhanh phía client
  // trước khi gọi mạng (RPC cũng tự kiểm tra lại độc lập bằng SQL, xem migration 028).
  const returnedQuantities = getReturnedQuantitiesForOrder(
    originalOrder,
    data.posOrders || [],
    data.inventoryTransactions || []
  );
  for (const [productId, returnedQty] of returnedQuantities) {
    const newQty = newQtyByProduct.get(productId) || 0;
    if (newQty < returnedQty) {
      const product = findProduct(currentMap, productId);
      const name = product?.name || productId;
      throw new Error(
        `Không thể sửa: "${name}" đã có ${returnedQty} sản phẩm được trả hàng — số lượng mới phải từ ${returnedQty} trở lên.`
      );
    }
  }

  if (!allowSellOutOfStock) {
    for (const productId of allProductIds) {
      const product = findProduct(currentMap, productId);
      const net = (oldQtyByProduct.get(productId) || 0) - (newQtyByProduct.get(productId) || 0);
      if (product && product.stock + net < 0) {
        throw new Error(`Không đủ tồn kho: ${product.name} (còn ${product.stock}, cần thêm ${-net})`);
      }
    }
  }

  // RPC 1 transaction — hoàn/áp tồn kho + xóa/ghi nợ + ghi đè đơn + đảo doanh thu. Lỗi bất kỳ
  // (vd guard trả hàng, tồn kho âm) → RPC tự rollback toàn bộ, không có gì để áp lại local.
  await editPosOrderTx(originalOrder.id, updatedOrder, debtRecord ?? null, allowSellOutOfStock);

  // Từ đây RPC đã áp dụng xong trên server — chỉ còn đồng bộ lại state local cho khớp.

  // 1) Tồn kho + inventory transaction local
  const updatedProductsMap = new Map<string, POSProduct>();
  for (const productId of allProductIds) {
    const product = findProduct(currentMap, productId);
    if (!product) continue;
    const net = (oldQtyByProduct.get(productId) || 0) - (newQtyByProduct.get(productId) || 0);
    updatedProductsMap.set(productId, { ...product, stock: product.stock + net });
  }
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
  await applyLocalOnly([
    ...oldTransactionIds.map(id => ({
      key: 'inventoryTransactions' as const,
      item: { id } as { id: string },
      isDelete: true,
    })),
    { key: 'inventoryTransactions' as const, item: newTransaction },
    ...stockUpdates,
  ]);

  // 2) Xóa nợ CŨ local (nợ MỚI ghi ở bước 4)
  const oldDebtRecords = (data.customerDebtHistory || []).filter(d => d.orderId === originalOrder.id);
  if (oldDebtRecords.length > 0) {
    await applyLocalOnly(
      oldDebtRecords.map(debt => ({ key: 'customerDebtHistory', item: { id: debt.id }, isDelete: true }))
    );
  }

  // 3) Ghi đè order local (giữ nguyên id/orderCode/date, đổi items/khách/PTTT/giảm giá...)
  await applyLocalOnly([{ key: 'posOrders', item: updatedOrder }]);

  // 4) Ghi nợ MỚI local nếu đơn sửa bật bán nợ
  if (debtRecord) {
    await applyLocalOnly([{ key: 'customerDebtHistory', item: debtRecord }]);
  }

  // 5) Cập nhật khách hàng (điểm/tổng chi tiêu/tier) — KHÔNG nằm trong RPC (tier đọc cấu hình
  // localStorage), vẫn 1 lời gọi mạng thật riêng.
  const customerUpdates: AppDataSurgicalUpdate[] = [];
  if (revertedCustomer && revertedCustomer.id !== updatedCustomer?.id) {
    customerUpdates.push({ key: 'posCustomers', item: revertedCustomer });
  }
  if (updatedCustomer) {
    customerUpdates.push({ key: 'posCustomers', item: updatedCustomer });
  }
  if (customerUpdates.length > 0) {
    await updateSurgical(customerUpdates);
  }

  // 6) Đảo doanh thu local — gộp delta đảo dấu đơn CŨ + delta đơn MỚI thành 1 delta ròng
  // (khớp công thức RPC đã tính, ngày bán giữ nguyên khi sửa).
  const oldCogs = calculateOrderCogs(currentMap, originalOrder.items);
  const newCogs = calculateOrderCogs(currentMap, updatedOrder.items);
  const netRevenueDelta = mergeRevenueDeltas(
    negateRevenueDelta(buildRevenueDelta(originalOrder, oldCogs)),
    buildRevenueDelta(updatedOrder, newCogs)
  );
  const orderDate = toLocalDateKey(originalOrder.date);
  await applyRevenueDeltaLocal(orderDate, netRevenueDelta);

  // 7) Tính lại sales_records ngày đó — không nằm trong RPC, vẫn qua mạng thật.
  const recalculationOrders = (data.posOrders || []).map(o =>
    o.id === updatedOrder.id ? updatedOrder : o
  );
  await recalcSalesRecordsForDate(
    { ...data, posOrders: recalculationOrders },
    orderDate,
    new Set(),
    updateSurgical
  );

  // Audit log: RPC đã tự ghi (best-effort) bên trong transaction — không ghi trùng ở client.
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
