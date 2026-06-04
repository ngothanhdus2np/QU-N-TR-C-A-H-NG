import type { AppData, StaffPerformanceRecord } from '../../types';

const toMoney = (value: unknown) => Math.round(Number(value) || 0);

export const getPayrollSalaryCost = (record: {
  netPay?: number;
  advance?: number;
}) => toMoney(record.netPay) + toMoney(record.advance);

export const buildStaffPerformanceLedger = (data?: AppData): StaffPerformanceRecord[] => {
  if (!data) return [];

  const salesByEmployeeMonth = new Map<string, number>();
  (data.sales || []).forEach(sale => {
    const month = String(sale.date || '').slice(0, 7);
    if (!sale.employeeId || !month) return;
    const key = `${sale.employeeId}::${month}`;
    salesByEmployeeMonth.set(
      key,
      (salesByEmployeeMonth.get(key) || 0) + toMoney(sale.salesAmount)
    );
  });

  const existingPerformanceByKey = new Map<string, StaffPerformanceRecord>();
  (data.staffPerformance || []).forEach(record => {
    if (!record.employeeId || !record.month) return;
    existingPerformanceByKey.set(`${record.employeeId}::${record.month}`, record);
  });

  const rowsFromPayroll = (data.payroll || []).map(payroll => {
    const key = `${payroll.employeeId}::${payroll.month}`;
    const existing = existingPerformanceByKey.get(key);
    const totalSales = salesByEmployeeMonth.get(key) ?? toMoney(existing?.totalSales);
    const salaryCost = getPayrollSalaryCost(payroll);

    return {
      id: existing?.id || `payroll-performance-${payroll.month}-${payroll.employeeId}`,
      employeeId: payroll.employeeId,
      employeeName: payroll.employeeName,
      month: payroll.month,
      totalSales,
      totalIncome: salaryCost,
      roi: salaryCost > 0 ? totalSales / salaryCost : 0,
      rank: existing?.rank,
    };
  });

  if (rowsFromPayroll.length > 0) {
    return rowsFromPayroll.sort((a, b) => {
      const monthCompare = b.month.localeCompare(a.month);
      if (monthCompare !== 0) return monthCompare;
      return a.employeeName.localeCompare(b.employeeName, 'vi');
    });
  }

  return [...(data.staffPerformance || [])].sort((a, b) => b.month.localeCompare(a.month));
};
