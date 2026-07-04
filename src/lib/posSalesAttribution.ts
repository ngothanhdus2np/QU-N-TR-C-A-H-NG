import type { Employee, POSOrder, POSOrderItem, SalesRecord } from '../../types';

export interface StaffSalesSummary {
  employeeId: string;
  employeeName: string;
  salesAmount: number;
  quantity: number;
  orderCount: number;
}

const normalizeDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('en-CA');
  return value.slice(0, 10);
};

const getEmployeeName = (employeesById: Map<string, Employee>, id: string, fallback?: string) => {
  if (id === 'unknown') return fallback && fallback !== 'unknown' ? fallback : 'Nhân viên';
  return employeesById.get(id)?.name || fallback || 'Nhân viên';
};

const positiveQuantity = (items: POSOrderItem[]) =>
  items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);

const getLineStaff = (order: POSOrder, item: POSOrderItem) => ({
  id: item.salespersonId || order.staffId || 'unknown',
  name: item.salespersonName || order.staffName || undefined,
});

const addLine = (
  summary: Map<string, StaffSalesSummary>,
  employeesById: Map<string, Employee>,
  employeeId: string,
  employeeName: string | undefined,
  amount: number,
  quantity: number,
  orderId: string,
  countedOrders: Map<string, Set<string>>
) => {
  if (amount <= 0) return;
  const existing = summary.get(employeeId);
  const employeeOrderSet = countedOrders.get(employeeId) || new Set<string>();
  const isNewOrderForEmployee = !employeeOrderSet.has(orderId);
  employeeOrderSet.add(orderId);
  countedOrders.set(employeeId, employeeOrderSet);

  summary.set(employeeId, {
    employeeId,
    employeeName: getEmployeeName(employeesById, employeeId, employeeName),
    salesAmount: (existing?.salesAmount || 0) + amount,
    quantity: (existing?.quantity || 0) + quantity,
    orderCount: (existing?.orderCount || 0) + (isNewOrderForEmployee ? 1 : 0),
  });
};

export const calculateOrderStaffSales = (
  order: POSOrder,
  employees: Employee[] = []
): StaffSalesSummary[] => {
  const employeesById = new Map(employees.map(employee => [employee.id, employee]));
  const summary = new Map<string, StaffSalesSummary>();
  const countedOrders = new Map<string, Set<string>>();

  if (order.isReturn) {
    const exchangeItems = order.items.filter(item => item.lineType === 'exchange');
    // Tính extraPaid từ item totals: tiền khách bù thêm khi đổi hàng đắt hơn
    const exchangeTotal = exchangeItems.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const returnTotal = order.items
      .filter(i => i.lineType !== 'exchange')
      .reduce((s, i) => s + (Number(i.total) || 0), 0);
    // POS-RETURN-01: phiếu POS native luôn gắn lineType từng dòng và lưu finalAmount DƯƠNG
    // = tiền hoàn khách (FIX C2) — không phải "khách bù thêm". Fallback finalAmount chỉ
    // dành cho đơn import KiotViet (items không có lineType).
    const isNativePosReturn = order.items.some(
      i => i.lineType === 'return' || i.lineType === 'exchange'
    );
    const extraPaid = exchangeTotal > 0
      ? Math.max(0, exchangeTotal - returnTotal)
      : isNativePosReturn
        ? 0
        : Math.max(0, Number(order.finalAmount) || 0); // fallback KiotViet imports
    if (extraPaid <= 0) return [];

    if (exchangeItems.length === 0) {
      addLine(
        summary,
        employeesById,
        order.staffId || 'unknown',
        order.createdBy || order.staffId,
        extraPaid,
        0,
        order.id,
        countedOrders
      );
      return [...summary.values()];
    }

    const qty = positiveQuantity(exchangeItems) || 1;
    exchangeItems.forEach(item => {
      const staff = getLineStaff(order, item);
      const itemQty = Math.max(0, Number(item.quantity) || 0);
      addLine(
        summary,
        employeesById,
        staff.id,
        staff.name,
        (extraPaid / qty) * itemQty,
        itemQty,
        order.id,
        countedOrders
      );
    });
    return [...summary.values()];
  }

  const saleItems = order.items.filter(item => item.lineType !== 'return');
  const hasBillDiscount = (Number(order.discount) || 0) > 0;
  // Doanh thu đơn = totalAmount - discount (chuẩn KiotViet, không trừ điểm tích lũy)
  const orderNetRevenue = (Number(order.totalAmount) || 0) - Math.abs(Number(order.discount) || 0);

  // Tổng giá trị item trước discount — dùng để phân bổ theo tỷ lệ giá trị, không phải số lượng
  const orderGrossTotal = hasBillDiscount
    ? saleItems.reduce((s, i) => s + (Number(i.total) || 0), 0) || 1
    : 1;

  saleItems.forEach(item => {
    const staff = getLineStaff(order, item);
    const itemQty = Math.max(0, Number(item.quantity) || 0);
    const itemValue = Number(item.total) || 0;
    const amount = hasBillDiscount
      ? orderNetRevenue * (itemValue / orderGrossTotal)
      : itemValue;

    addLine(summary, employeesById, staff.id, staff.name, amount, itemQty, order.id, countedOrders);
  });

  return [...summary.values()];
};

export const calculateStaffSalesForDate = (
  orders: POSOrder[],
  date: string,
  employees: Employee[] = []
): StaffSalesSummary[] => {
  const summary = new Map<string, StaffSalesSummary>();

  // Map tra theo tên → canonical ID (đảm bảo native POS + KiotViet cùng employee gom 1 dòng)
  const employeesByName = new Map(employees.map(e => [e.name.toLowerCase(), e]));
  const defaultEmployee = employees.length > 0 ? employees[0] : null;

  orders
    // Đơn/phiếu đã hủy (soft-delete hoặc hủy phiếu trả) không đóng góp doanh số
    .filter(order => order.status !== 'cancelled' && normalizeDate(order.date) === date)
    .flatMap(order => calculateOrderStaffSales(order, employees))
    .forEach(row => {
      let key: string;
      let displayName: string;

      if (row.employeeName !== 'Nhân viên') {
        // Tên hợp lệ → tra theo tên để lấy canonical ID (merge KiotViet + native POS cùng người)
        const byName = employeesByName.get(row.employeeName.toLowerCase());
        key = byName?.id ?? (row.employeeId !== 'unknown' ? row.employeeId : `name:${row.employeeName}`);
        displayName = row.employeeName;
      } else if (defaultEmployee) {
        // Không resolve được tên → gán về nhân viên đầu tiên
        key = defaultEmployee.id;
        displayName = defaultEmployee.name;
      } else {
        key = row.employeeId !== 'unknown' ? row.employeeId : 'unknown';
        displayName = 'Nhân viên';
      }

      const existing = summary.get(key);
      summary.set(key, {
        ...row,
        employeeId: key,
        employeeName: displayName,
        salesAmount: (existing?.salesAmount || 0) + row.salesAmount,
        quantity: (existing?.quantity || 0) + row.quantity,
        orderCount: (existing?.orderCount || 0) + row.orderCount,
      });
    });

  return [...summary.values()]
    .map(row => ({ ...row, salesAmount: Math.round(row.salesAmount) }))
    .filter(row => row.salesAmount > 0)
    .sort((a, b) => b.salesAmount - a.salesAmount);
};

export const buildPosSalesRecordsForDate = (
  existingSales: SalesRecord[],
  orders: POSOrder[],
  date: string,
  employees: Employee[] = []
): SalesRecord[] => {
  const summaries = calculateStaffSalesForDate(orders, date, employees);
  const posRecordIds = new Set(summaries.map(row => `pos-sales-${date}-${row.employeeId}`));
  const preservedSales = existingSales.filter(
    record => !record.id.startsWith(`pos-sales-${date}-`) || posRecordIds.has(record.id)
  );

  const upserted = summaries.map(row => ({
    id: `pos-sales-${date}-${row.employeeId}`,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    date,
    salesAmount: row.salesAmount,
  }));

  const withoutOldGenerated = preservedSales.filter(record => !posRecordIds.has(record.id));
  return [...withoutOldGenerated, ...upserted];
};

export const buildPosSalesRecordUpsertsForDate = (
  orders: POSOrder[],
  date: string,
  employees: Employee[] = []
): SalesRecord[] =>
  calculateStaffSalesForDate(orders, date, employees).map(row => ({
    id: `pos-sales-${date}-${row.employeeId}`,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    date,
    salesAmount: row.salesAmount,
  }));
