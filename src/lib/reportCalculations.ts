import type { Employee, InventoryTransaction, POSCustomer, POSOrder, POSProduct, Supplier } from '../../types';

// Xây dựng map giá vốn lịch sử: productId → [{date, price}] đã sort tăng dần theo date.
// Nguồn dữ liệu: item.nextImportPrice từ InventoryTransaction (type='Import').
// Bảng product_cost_history trên Supabase hiện chưa được dùng — nếu cần audit
// trail cấp DB thì có thể ghi vào đó khi hoàn tất phiếu nhập và query từ đây.
function buildCostHistory(
  transactions: InventoryTransaction[]
): Map<string, Array<{ date: string; price: number }>> {
  const map = new Map<string, Array<{ date: string; price: number }>>();
  transactions
    .filter(t => t.type === 'Import')
    .forEach(t => {
      t.items.forEach(item => {
        const price = Number(item.nextImportPrice);
        if (!price || price <= 0) return;
        const list = map.get(item.productId) ?? [];
        list.push({ date: t.date, price });
        map.set(item.productId, list);
      });
    });
  map.forEach((list, key) => {
    map.set(key, list.sort((a, b) => a.date.localeCompare(b.date)));
  });
  return map;
}

// Lấy giá vốn tại thời điểm gần nhất trước hoặc bằng saleDate
function getHistoricalCost(
  costHistory: Map<string, Array<{ date: string; price: number }>>,
  productId: string,
  saleDate: string,
  fallback: number
): number {
  const list = costHistory.get(productId);
  if (!list || list.length === 0) return fallback;
  let last: number | null = null;
  for (const entry of list) {
    if (entry.date <= saleDate) last = entry.price;
    else break;
  }
  return last ?? fallback;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface OrderReportFilters {
  channelQuery?: string;
  priceBookQuery?: string;
  createdByQuery?: string;
  status?: string;
  paymentMethod?: string;
}

export interface ReportAmountSummary {
  revenue: number;
  returned: number;
  netRevenue: number;
}

export interface SalesTimeRow extends ReportAmountSummary {
  hour: string;
}

export interface SalesProfitRow {
  label: string;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface SalesHorizontalReportRow {
  key: string;
  label: string;
  saleOrderCount: number;
  grossAmount: number;
  discount: number;
  revenue: number;
  returnOrderCount: number;
  returnValue: number;
  returnRefund: number; // Tiền trả khách = "Cần trả khách" KiotViet (tiền mặt thực tế hoàn lại)
  netRevenue: number;
}

export interface SalesStaffReportRow {
  key: string;
  staffName: string;
  saleOrderCount: number;
  revenue: number;
  returnOrderCount: number;
  returnValue: number;
  netRevenue: number;
}

export interface SalesInvoiceDiscountReportRow {
  key: string;
  label: string;
  invoiceCount: number;
  invoiceValue: number;
  discountValue: number;
}

export interface GoodsReportRow {
  key: string;
  sku: string;
  name: string;
  soldQty: number;
  revenue: number;
  returnQty: number;
  returnValue: number;
  netRevenue: number;
}

export interface OrderedGoodsReportRow {
  key: string;
  sku: string;
  name: string;
  quantity: number;
  value: number;
}

export interface EndOfDayReportRow {
  kind: 'invoice' | 'return';
  label: string;
  count: number;
  quantity: number;
  revenue: number;
  discount: number;
  actual: number;
}

export interface CustomerReportRow extends ReportAmountSummary {
  key: string;
  customerId: string;
  customerName: string;
  phone: string;
}

export interface StaffReportRow extends ReportAmountSummary {
  key: string;
  staffName: string;
  phone: string;
}

export interface ChannelReportRow extends ReportAmountSummary {
  key: string;
  channelName: string;
}

export interface SupplierReportRow {
  key: string;
  supplierCode: string;
  supplierName: string;
  phone: string;
  importValue: number;
  returnValue: number;
  netValue: number;
}

const WALK_IN_KEY = 'walk-in';
const WALK_IN_LABEL = 'Khách lẻ';
const UNKNOWN_STAFF = 'Không xác định';
const WALK_IN_SUPPLIER = 'NCC vãng lai';

export const toReportDate = (date: Date) => date.toLocaleDateString('en-CA');

export const getCurrentWeekRange = (): DateRange => {
  const today = new Date();
  const day = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { startDate: toReportDate(start), endDate: toReportDate(end) };
};

export const isDateInRange = (value: string | Date, range: DateRange) => {
  const date = toReportDate(value instanceof Date ? value : new Date(value));
  return date >= range.startDate && date <= range.endDate;
};

export const filterOrdersByDateRange = (orders: POSOrder[], range: DateRange) =>
  orders.filter(order => isDateInRange(order.date, range));

export const getOrderChannelName = (order: POSOrder) => order.channelName || 'Bán trực tiếp';
export const getOrderStatus = (order: POSOrder) => order.status || 'completed';
export const getOrderCreatedBy = (order: POSOrder) => order.staffName || order.createdBy || order.staffId || '';
export const getOrderPriceBookText = (order: POSOrder) =>
  `${order.priceBookId || ''} ${order.priceBookName || ''}`.trim() || 'Bảng giá chung';

export const orderMatchesReportFilters = (
  order: POSOrder,
  filters: OrderReportFilters = {}
) => {
  const channelNeedle = (filters.channelQuery || '').trim().toLowerCase();
  const priceBookNeedle = (filters.priceBookQuery || '').trim().toLowerCase();
  const createdByNeedle = (filters.createdByQuery || '').trim().toLowerCase();
  const status = filters.status || '';
  const paymentMethod = filters.paymentMethod || '';

  if (status && getOrderStatus(order) !== status) return false;
  if (paymentMethod && order.paymentMethod !== paymentMethod) return false;
  if (channelNeedle) {
    const channelText = `${order.channel || ''} ${getOrderChannelName(order)}`.toLowerCase();
    if (!channelText.includes(channelNeedle)) return false;
  }
  if (priceBookNeedle && !getOrderPriceBookText(order).toLowerCase().includes(priceBookNeedle)) {
    return false;
  }
  if (createdByNeedle && !getOrderCreatedBy(order).toLowerCase().includes(createdByNeedle)) {
    return false;
  }

  return true;
};

/**
 * Doanh thu 1 đơn hàng theo chuẩn KiotViet:
 *   Đơn bán  → totalAmount − discount (không trừ điểm tích lũy)
 *   Đơn trả  → −totalAmount (giá trị hàng trả)
 * Dùng hàm này ở MỌI nơi cần tính doanh thu để đảm bảo nhất quán.
 */
export const calcOrderRevenue = (order: POSOrder): number => {
  const totalAmount = Math.abs(Number(order.totalAmount) || 0);
  if (order.isReturn) return -totalAmount;
  const finalAmount = Number(order.finalAmount) || 0;
  const discount = order.discount != null
    ? Math.abs(Number(order.discount))
    : Math.max(0, totalAmount - finalAmount);
  return totalAmount - discount;
};

export const addOrderAmount = <T extends ReportAmountSummary>(target: T, order: POSOrder) => {
  if (order.isReturn) {
    target.returned += Math.abs(Number(order.totalAmount) || 0);
  } else {
    target.revenue += calcOrderRevenue(order);
  }
  target.netRevenue = target.revenue - target.returned;
};

export const getReportTotals = <T extends ReportAmountSummary>(rows: T[]): ReportAmountSummary =>
  rows.reduce(
    (sum, row) => ({
      revenue: sum.revenue + row.revenue,
      returned: sum.returned + row.returned,
      netRevenue: sum.netRevenue + row.netRevenue,
    }),
    { revenue: 0, returned: 0, netRevenue: 0 }
  );

export const getSalesRowsByHour = (
  orders: POSOrder[],
  range: DateRange,
  filters: OrderReportFilters = {}
): SalesTimeRow[] => {
  const map = new Map<string, SalesTimeRow>();

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters)) return;
    const hour = new Date(order.date).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const key = `${hour.slice(0, 2)}:00`;
    const row = map.get(key) ?? { hour: key, revenue: 0, returned: 0, netRevenue: 0 };
    addOrderAmount(row, order);
    map.set(key, row);
  });

  return Array.from(map.values()).sort((a, b) => a.hour.localeCompare(b.hour));
};

export const getSalesRowsByDate = (
  orders: POSOrder[],
  range: DateRange,
  filters: OrderReportFilters = {}
): SalesTimeRow[] => {
  const map = new Map<string, SalesTimeRow>();
  const start = new Date(`${range.startDate}T00:00:00`);
  const end = new Date(`${range.endDate}T00:00:00`);

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toReportDate(cursor);
    map.set(key, {
      hour: cursor.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      revenue: 0,
      returned: 0,
      netRevenue: 0,
    });
  }

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters)) return;
    const key = toReportDate(new Date(order.date));
    const date = new Date(`${key}T00:00:00`);
    const row = map.get(key) ?? {
      hour: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      revenue: 0,
      returned: 0,
      netRevenue: 0,
    };
    addOrderAmount(row, order);
    map.set(key, row);
  });

  return Array.from(map.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, row]) => row);
};

export const getSalesProfitRowsByDate = (
  orders: POSOrder[],
  products: POSProduct[],
  range: DateRange,
  filters: OrderReportFilters = {},
  inventoryTransactions?: InventoryTransaction[]
): SalesProfitRow[] => {
  const productCostByKey = new Map<string, number>();
  products.forEach(product => {
    const cost = Number(product.importPrice) || 0;
    // Luôn thêm vào map kể cả cost = 0, để phân biệt "biết giá vốn = 0" vs "không tìm thấy SP"
    productCostByKey.set(product.id, cost);
    if (product.sku) productCostByKey.set(product.sku, cost);
  });

  // Nếu có lịch sử giao dịch, dùng giá vốn tại thời điểm bán thay vì giá hiện tại
  const costHistory = inventoryTransactions ? buildCostHistory(inventoryTransactions) : null;

  const map = new Map<string, SalesProfitRow>();
  const start = new Date(`${range.startDate}T00:00:00`);
  const end = new Date(`${range.endDate}T00:00:00`);

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toReportDate(cursor);
    map.set(key, {
      label: cursor.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      revenue: 0,
      cogs: 0,
      profit: 0,
    });
  }

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters)) return;
    const key = toReportDate(new Date(order.date));
    const date = new Date(`${key}T00:00:00`);
    const row = map.get(key) ?? {
      label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      revenue: 0,
      cogs: 0,
      profit: 0,
    };
    const cogs = order.items.reduce((sum, item) => {
      const itemCost = Number(item.importPrice);
      let unitCost: number;
      if (itemCost > 0) {
        unitCost = itemCost;
      } else {
        const fallback = productCostByKey.get(item.productId) ?? productCostByKey.get(item.sku) ?? 0;
        unitCost = costHistory
          ? getHistoricalCost(costHistory, item.productId, order.date, fallback)
          : fallback;
      }
      return sum + unitCost * (Number(item.quantity) || 0);
    }, 0);

    if (order.isReturn) {
      row.revenue -= Math.abs(Number(order.totalAmount) || 0);
      row.cogs -= cogs;
    } else {
      row.revenue += calcOrderRevenue(order);
      row.cogs += cogs;
    }
    row.profit = row.revenue - row.cogs;
    map.set(key, row);
  });

  return Array.from(map.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, row]) => row);
};

export const getSalesHorizontalRowsByDate = (
  orders: POSOrder[],
  range: DateRange,
  filters: OrderReportFilters = {}
): SalesHorizontalReportRow[] => {
  const map = new Map<string, SalesHorizontalReportRow>();
  const start = new Date(`${range.startDate}T00:00:00`);
  const end = new Date(`${range.endDate}T00:00:00`);

  const emptyRow = (key: string, label: string): SalesHorizontalReportRow => ({
    key, label, saleOrderCount: 0, grossAmount: 0, discount: 0,
    revenue: 0, returnOrderCount: 0, returnValue: 0, returnRefund: 0, netRevenue: 0,
  });

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toReportDate(cursor);
    map.set(key, emptyRow(key, cursor.toLocaleDateString('vi-VN')));
  }

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters)) return;
    const key = toReportDate(new Date(order.date));
    const date = new Date(`${key}T00:00:00`);
    const row = map.get(key) ?? emptyRow(key, date.toLocaleDateString('vi-VN'));

    const totalAmount = Number(order.totalAmount) || 0;
    const finalAmount = Number(order.finalAmount) || 0;
    // Dùng order.discount nếu đã được set, luôn lấy giá trị tuyệt đối (KiotViet đôi khi export âm)
    const discount = order.discount != null ? Math.abs(Number(order.discount)) : Math.max(0, totalAmount - finalAmount);

    if (order.isReturn) {
      row.returnOrderCount += 1;
      row.returnValue += Math.abs(totalAmount);
      // Tiền trả khách = finalAmount của đơn trả ("Cần trả khách" KiotViet)
      row.returnRefund += Math.abs(finalAmount);
    } else {
      row.saleOrderCount += 1;
      row.grossAmount += totalAmount;
      row.discount += discount;
      // KiotViet: Doanh thu = Tổng tiền hàng − Giảm giá HĐ (không trừ giảm giá dòng SP / điểm)
      row.revenue += totalAmount - discount;
    }
    row.netRevenue = row.revenue - row.returnValue;
    map.set(key, row);
  });

  return Array.from(map.values()).sort((first, second) => second.key.localeCompare(first.key));
};

export const getSalesInvoiceDiscountRowsByDate = (
  orders: POSOrder[],
  range: DateRange,
  filters: OrderReportFilters = {}
): SalesInvoiceDiscountReportRow[] => {
  const map = new Map<string, SalesInvoiceDiscountReportRow>();

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters) || order.isReturn) return;
    const totalAmount = Number(order.totalAmount) || 0;
    const finalAmount = Number(order.finalAmount) || 0;
    const discountValue = order.discount != null ? Number(order.discount) : Math.max(0, totalAmount - finalAmount);
    if (discountValue <= 0) return;

    const key = toReportDate(new Date(order.date));
    const date = new Date(`${key}T00:00:00`);
    const row = map.get(key) ?? {
      key,
      label: date.toLocaleDateString('vi-VN'),
      invoiceCount: 0,
      invoiceValue: 0,
      discountValue: 0,
    };
    row.invoiceCount += 1;
    row.invoiceValue += totalAmount;
    row.discountValue += discountValue;
    map.set(key, row);
  });

  return Array.from(map.values()).sort((first, second) => second.key.localeCompare(first.key));
};

export const getSalesStaffRows = (
  orders: POSOrder[],
  range: DateRange,
  filters: OrderReportFilters = {},
  employees: Employee[] = []
): SalesStaffReportRow[] => {
  const map = new Map<string, SalesStaffReportRow>();
  const employeeById = new Map(employees.map(e => [e.id, e]));

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters)) return;
    const rawId = order.createdBy || order.staffId || '';
    const resolved = employeeById.get(rawId)?.name;
    const staffName = order.staffName || resolved || rawId || UNKNOWN_STAFF;
    const row = map.get(staffName) ?? {
      key: staffName,
      staffName,
      saleOrderCount: 0,
      revenue: 0,
      returnOrderCount: 0,
      returnValue: 0,
      netRevenue: 0,
    };
    if (order.isReturn) {
      row.returnOrderCount += 1;
      row.returnValue += Math.abs(Number(order.totalAmount) || 0);
    } else {
      row.saleOrderCount += 1;
      row.revenue += calcOrderRevenue(order);
    }
    row.netRevenue = row.revenue - row.returnValue;
    map.set(staffName, row);
  });

  return Array.from(map.values()).sort((first, second) => second.netRevenue - first.netRevenue);
};

export const getGoodsReportRows = (
  orders: POSOrder[],
  range: DateRange,
  options: { query?: string; mergeSameGoods?: boolean; allowedProductIds?: Set<string> } & OrderReportFilters = {}
): GoodsReportRow[] => {
  const query = (options.query || '').trim().toLowerCase();
  const map = new Map<string, GoodsReportRow>();

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, options)) return;
    order.items.forEach(item => {
      if (options.allowedProductIds && item.productId && !options.allowedProductIds.has(item.productId)) return;
      const itemText = `${item.sku || ''} ${item.name || ''}`.toLowerCase();
      if (query && !itemText.includes(query)) return;

      const key = options.mergeSameGoods
        ? item.productId || item.sku || item.name
        : item.sku || item.productId || item.name;
      const row = map.get(key) ?? {
        key,
        sku: item.sku || '',
        name: item.name || '',
        soldQty: 0,
        revenue: 0,
        returnQty: 0,
        returnValue: 0,
        netRevenue: 0,
      };

      const quantity = Number(item.quantity) || 0;
      const amount = Number(item.total) || 0;
      if (order.isReturn && item.lineType !== 'exchange') {
        row.returnQty += quantity;
        row.returnValue += amount;
      } else {
        row.soldQty += quantity;
        row.revenue += amount;
      }
      row.netRevenue = row.revenue - row.returnValue;
      map.set(key, row);
    });
  });

  return Array.from(map.values()).sort((a, b) => b.netRevenue - a.netRevenue || b.soldQty - a.soldQty);
};

export const getOrderedGoodsReportRows = (
  orders: POSOrder[],
  range: DateRange,
  options: { customerQuery?: string; productQuery?: string; mergeSameGoods?: boolean; allowedProductIds?: Set<string> } & OrderReportFilters = {}
): OrderedGoodsReportRow[] => {
  const customerNeedle = (options.customerQuery || '').trim().toLowerCase();
  const productNeedle = (options.productQuery || '').trim().toLowerCase();
  const map = new Map<string, OrderedGoodsReportRow>();

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (order.isReturn) return;
    if (!orderMatchesReportFilters(order, options)) return;

    const customerText = `${order.customerId || ''} ${order.customerName || ''}`.toLowerCase();
    if (customerNeedle && !customerText.includes(customerNeedle)) return;

    if (
      productNeedle &&
      !order.items.some(item =>
        `${item.sku || ''} ${item.name || ''}`.toLowerCase().includes(productNeedle)
      )
    ) {
      return;
    }

    order.items.forEach(item => {
      if (options.allowedProductIds && item.productId && !options.allowedProductIds.has(item.productId)) return;
      if (
        productNeedle &&
        !`${item.sku || ''} ${item.name || ''}`.toLowerCase().includes(productNeedle)
      ) {
        return;
      }

      const key = options.mergeSameGoods
        ? item.productId || item.sku || item.name
        : item.sku || item.productId || item.name;
      const row = map.get(key) ?? {
        key,
        sku: item.sku || '',
        name: item.name || '',
        quantity: 0,
        value: 0,
      };
      row.quantity += Number(item.quantity) || 0;
      row.value += Number(item.total) || 0;
      map.set(key, row);
    });
  });

  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity || b.value - a.value);
};

export const getEndOfDayReportRows = (
  orders: POSOrder[],
  selectedDate: string,
  filters: OrderReportFilters & { fromTime?: string; toTime?: string } = {}
): EndOfDayReportRow[] => {
  const dayOrders = orders.filter(order => {
    if (toReportDate(new Date(order.date)) !== selectedDate) return false;
    if (!orderMatchesReportFilters(order, filters)) return false;
    if (filters.fromTime || filters.toTime) {
      const hhmm = new Date(order.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (filters.fromTime && hhmm < filters.fromTime) return false;
      if (filters.toTime && hhmm > filters.toTime) return false;
    }
    return true;
  });
  if (dayOrders.length === 0) return [];

  const invoices = dayOrders.filter(order => !order.isReturn);
  const returns = dayOrders.filter(order => order.isReturn);
  const sumQuantity = (rows: POSOrder[]) =>
    rows.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemSum, item) => {
          if (order.isReturn && item.lineType === 'exchange') return itemSum;
          return itemSum + (Number(item.quantity) || 0);
        }, 0),
      0
    );

  return [
    {
      kind: 'invoice',
      label: 'Hóa đơn',
      count: invoices.length,
      quantity: sumQuantity(invoices),
      revenue: invoices.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0),
      discount: invoices.reduce((sum, order) => sum + Math.max(0, (Number(order.totalAmount) || 0) - (Number(order.finalAmount) || 0)), 0),
      actual: invoices.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0),
    },
    {
      kind: 'return',
      label: 'Trả hàng',
      count: returns.length,
      quantity: sumQuantity(returns),
      revenue: -returns.reduce((sum, order) => sum + Math.abs(Number(order.totalAmount) || 0), 0),
      discount: -returns.reduce((sum, order) => sum + Math.max(0, Math.abs(Number(order.totalAmount) || 0) - Math.abs(Number(order.finalAmount) || 0)), 0),
      actual: -returns.reduce((sum, order) => sum + Math.abs(Number(order.finalAmount) || 0), 0),
    },
  ];
};

export const getCustomerReportRows = (
  orders: POSOrder[],
  customers: POSCustomer[],
  range: DateRange,
  query = '',
  filters: OrderReportFilters = {}
): CustomerReportRow[] => {
  const customerById = new Map(customers.map(customer => [customer.id, customer]));
  const needle = query.trim().toLowerCase();
  const map = new Map<string, CustomerReportRow>();

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters)) return;
    const customer = order.customerId ? customerById.get(order.customerId) : undefined;
    const key = order.customerId || order.customerName || WALK_IN_KEY;
    const customerId = order.customerId || WALK_IN_LABEL;
    const customerName = customer?.name || order.customerName || WALK_IN_LABEL;
    const phone = customer?.phone || '';
    const searchText = `${customerId} ${customerName} ${phone}`.toLowerCase();
    if (needle && !searchText.includes(needle)) return;

    const row = map.get(key) ?? {
      key,
      customerId,
      customerName,
      phone,
      revenue: 0,
      returned: 0,
      netRevenue: 0,
    };
    addOrderAmount(row, order);
    map.set(key, row);
  });

  return Array.from(map.values()).sort((a, b) => b.netRevenue - a.netRevenue);
};

export const getStaffReportRows = (
  orders: POSOrder[],
  employees: Employee[],
  range: DateRange,
  query = '',
  filters: OrderReportFilters = {}
): StaffReportRow[] => {
  const employeeById = new Map(employees.map(employee => [employee.id, employee]));
  const needle = query.trim().toLowerCase();
  const map = new Map<string, StaffReportRow>();

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, filters)) return;
    const staffId = order.staffId || UNKNOWN_STAFF;
    const employee = employeeById.get(staffId);
    const staffName = employee?.name || staffId || UNKNOWN_STAFF;
    const phone = employee?.phone || '';
    const searchText = `${staffId} ${staffName} ${phone}`.toLowerCase();
    if (needle && !searchText.includes(needle)) return;

    const row = map.get(staffId) ?? {
      key: staffId,
      staffName,
      phone,
      revenue: 0,
      returned: 0,
      netRevenue: 0,
    };
    addOrderAmount(row, order);
    map.set(staffId, row);
  });

  return Array.from(map.values()).sort((a, b) => b.netRevenue - a.netRevenue);
};

export const getChannelReportRows = (
  orders: POSOrder[],
  employees: Employee[],
  range: DateRange,
  options: { staffQuery?: string; channelQuery?: string } & OrderReportFilters = {}
): ChannelReportRow[] => {
  const employeeById = new Map(employees.map(employee => [employee.id, employee]));
  const staffNeedle = (options.staffQuery || '').trim().toLowerCase();
  const map = new Map<string, ChannelReportRow>();

  filterOrdersByDateRange(orders, range).forEach(order => {
    if (!orderMatchesReportFilters(order, options)) return;
    const employee = employeeById.get(order.staffId);
    const staffText = `${order.staffId || ''} ${employee?.name || ''} ${employee?.phone || ''}`.toLowerCase();
    if (staffNeedle && !staffText.includes(staffNeedle)) return;

    const channelName = getOrderChannelName(order);
    const row = map.get(channelName) ?? {
      key: channelName,
      channelName,
      revenue: 0,
      returned: 0,
      netRevenue: 0,
    };
    addOrderAmount(row, order);
    map.set(channelName, row);
  });

  return Array.from(map.values()).sort((a, b) => b.netRevenue - a.netRevenue);
};

const getTransactionAmount = (transaction: InventoryTransaction) => {
  if (typeof transaction.totalAmount === 'number') return transaction.totalAmount;
  return transaction.items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    return sum + (Number(item.quantity) || 0) * Math.max(0, price - discount);
  }, 0);
};

export const getSupplierReportRows = (
  transactions: InventoryTransaction[],
  suppliers: Supplier[],
  range: DateRange,
  query = ''
): SupplierReportRow[] => {
  const supplierById = new Map(suppliers.map(supplier => [supplier.id, supplier]));
  const supplierByName = new Map(suppliers.map(supplier => [supplier.name, supplier]));
  const needle = query.trim().toLowerCase();
  const map = new Map<string, SupplierReportRow>();

  transactions.forEach(transaction => {
    if (transaction.type !== 'Import' && transaction.type !== 'PurchaseReturn') return;
    if (transaction.status === 'cancelled') return;
    if (!isDateInRange(transaction.date, range)) return;

    const supplier =
      (transaction.supplierId ? supplierById.get(transaction.supplierId) : undefined) ||
      (transaction.supplierName ? supplierByName.get(transaction.supplierName) : undefined);
    const key = transaction.supplierId || transaction.supplierName || WALK_IN_SUPPLIER;
    const supplierCode = supplier?.code || transaction.supplierName || WALK_IN_SUPPLIER;
    const supplierName = supplier?.name || transaction.supplierName || WALK_IN_SUPPLIER;
    const phone = supplier?.phone || '';
    const searchText = `${supplierCode} ${supplierName} ${phone}`.toLowerCase();
    if (needle && !searchText.includes(needle)) return;

    const row = map.get(key) ?? {
      key,
      supplierCode,
      supplierName,
      phone,
      importValue: 0,
      returnValue: 0,
      netValue: 0,
    };

    const amount = getTransactionAmount(transaction);
    if (transaction.type === 'PurchaseReturn') row.returnValue += amount;
    else row.importValue += amount;
    row.netValue = row.importValue - row.returnValue;
    map.set(key, row);
  });

  return Array.from(map.values()).sort((a, b) => b.netValue - a.netValue);
};
