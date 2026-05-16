/**
 * Revenue & Financial Types
 * Types related to revenue, expenses, and financial analysis
 */

export interface RevenueRecord {
  id: string;
  date: string; // Thời gian
  totalGrossRevenue: number; // Tổng tiền hàng
  discount: number; // Giảm giá
  revenueOther: number; // Doanh thu khác (Chỉ lấy nguồn nhập tay)
  returnsValue: number; // Giá trị trả
  netRevenue: number; // Doanh thu thuần
  totalCogs: number; // Tổng giá vốn
  grossProfit: number; // Lợi nhuận gộp
}

export interface ProductGroup {
  id: string;
  name: string;
  target?: number;
  peakMonths?: number[]; // [1, 2, 3...]
}

export interface ProductGroupRevenue {
  id: string;
  date: string;
  groupId: string;
  groupName: string;
  amount: number; // Tổng doanh thu gộp
  quantity?: number; // Số lượng bán
  returnsQuantity?: number; // Số lượng trả
  returnsValue?: number; // Giá trị trả
  netRevenue?: number; // Doanh thu thuần
  cogs?: number; // Tổng giá vốn
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  dayOfMonth: number; // 1-31
  description?: string;
  isActive: boolean;
  lastPostedMonth?: string; // YYYY-MM
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parentId?: string;
}

export interface CashFlowRecord {
  id: string;
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export type RevenueSubTab =
  | 'diagnosis'
  | 'matrix'
  | 'ledger'
  | 'source'
  | 'costs'
  | 'inventory_in'
  | 'inventory_out'
  | 'report';

export type RevenueAuditColumnKey = 'totalGrossRevenue' | 'discount' | 'returnsValue' | 'totalCogs';

export interface RevenueAuditConflict {
  date: string;
  columnKey: RevenueAuditColumnKey;
  columnLabel: string;
  currentValue: number;
  newValue: number;
  resolution: 'keep' | 'update';
}

export interface DailyBreakEvenConfig {
  monthlyFixedCosts: number;
  grossMarginPercent: number; // e.g., 35 for 35%
}
