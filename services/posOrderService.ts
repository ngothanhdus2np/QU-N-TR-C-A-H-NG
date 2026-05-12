import {
  AppData,
  InventoryTransaction,
  POSCustomer,
  POSOrder,
  POSOrderItem,
  POSProduct,
  RevenueRecord,
  AppDataSurgicalUpdate,
} from '../types';

type PosOrderCallbacks = {
  pushBatch: (key: keyof AppData, items: unknown[]) => Promise<void>;
  updateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
};

type PlaceOrderArgs = PosOrderCallbacks & {
  data: AppData;
  order: POSOrder;
  updatedProducts: POSProduct[];
  updatedCustomer?: POSCustomer;
};

type ReturnOrderArgs = PosOrderCallbacks & {
  data: AppData;
  returnOrder: POSOrder;
  updatedProducts: POSProduct[];
  returnedItems: POSOrderItem[];
  exchangeItems: POSOrderItem[];
};

function findProduct(products: POSProduct[], productId: string) {
  return products.find(p => p.id === productId);
}

function calculateOrderCogs(products: POSProduct[], items: POSOrderItem[]) {
  return items.reduce((sum, item) => {
    const product = findProduct(products, item.productId);
    return sum + (product?.importPrice || 0) * item.quantity;
  }, 0);
}

function buildSaleTransaction(
  order: POSOrder,
  currentProducts: POSProduct[],
  updatedProducts: POSProduct[]
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
  currentProducts: POSProduct[],
  updatedProducts: POSProduct[],
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
  currentProducts: POSProduct[],
  updatedProducts: POSProduct[],
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
    date: new Date().toLocaleDateString('en-CA'),
    totalGrossRevenue: order.totalAmount,
    discount: order.discount,
    revenueOther: 0,
    returnsValue: 0,
    netRevenue: order.finalAmount,
    totalCogs: orderCogs,
    grossProfit: order.finalAmount - orderCogs,
  };
}

export async function processPlaceOrder({
  data,
  order,
  updatedProducts,
  updatedCustomer,
  pushBatch,
  updateSurgical,
}: PlaceOrderArgs): Promise<void> {
  const currentProducts = data.posProducts || [];

  // Guard: phát hiện tồn kho âm trước khi ghi — bảo vệ client-side tránh race condition
  // (phía server dùng RPC decrement_product_stock để đảm bảo atomicity thực sự)
  for (const item of order.items) {
    const current = findProduct(currentProducts, item.productId);
    if (current && current.stock < item.quantity) {
      throw new Error(
        `Không đủ tồn kho: ${item.name} (còn ${current.stock}, cần ${item.quantity})`
      );
    }
  }

  const orderCogs = calculateOrderCogs(currentProducts, order.items);
  const today = new Date().toLocaleDateString('en-CA');
  const existingRevenue = (data.revenue || []).find(r => r.date === today);
  const revenueRecord = buildRevenueUpdate(existingRevenue, order, orderCogs);

  await pushBatch('posOrders', [order]);

  const stockUpdates = order.items
    .map(item => ({
      key: 'posProducts' as const,
      item: findProduct(updatedProducts, item.productId),
    }))
    .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);
  await updateSurgical(stockUpdates);

  await pushBatch('inventoryTransactions', [
    buildSaleTransaction(order, currentProducts, updatedProducts),
  ]);

  if (updatedCustomer) {
    await updateSurgical([{ key: 'posCustomers', item: updatedCustomer }]);
  }

  if (existingRevenue) {
    await updateSurgical([{ key: 'revenue', item: revenueRecord }]);
  } else {
    await pushBatch('revenue', [revenueRecord]);
  }
}

export async function processReturnOrder({
  data,
  returnOrder,
  updatedProducts,
  returnedItems,
  exchangeItems,
  pushBatch,
  updateSurgical,
}: ReturnOrderArgs): Promise<void> {
  const currentProducts = data.posProducts || [];

  await pushBatch('posOrders', [returnOrder]);

  const allAffectedIds = new Set([
    ...returnedItems.map(i => i.productId),
    ...exchangeItems.map(i => i.productId),
  ]);
  const stockUpdates = [...allAffectedIds]
    .map(id => ({ key: 'posProducts' as const, item: findProduct(updatedProducts, id) }))
    .filter((u): u is { key: 'posProducts'; item: POSProduct } => !!u.item);
  await updateSurgical(stockUpdates);

  if (returnedItems.length > 0) {
    await pushBatch('inventoryTransactions', [
      buildReturnTransaction(returnOrder, currentProducts, updatedProducts, returnedItems),
    ]);
  }

  if (exchangeItems.length > 0) {
    await pushBatch('inventoryTransactions', [
      buildExchangeTransaction(returnOrder, currentProducts, updatedProducts, exchangeItems),
    ]);
  }
}
