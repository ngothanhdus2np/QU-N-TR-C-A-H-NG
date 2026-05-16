/**
 * App State Types
 * Types related to application state management
 */

import type { Employee, AttendanceRecord, OvertimeRecord, SalesRecord, ShortageRecord, AdvanceRecord, Holiday, ViolationType, ViolationOccurrence, ResponsibilityApproval, StaffPerformanceRecord } from './employee';
import type { SalaryPolicy, TetCampaign, PayrollRecord } from './payroll';
import type { RevenueRecord, ProductGroup, ProductGroupRevenue, ExpenseRecord, RecurringExpense, ExpenseCategory, CashFlowRecord, DailyBreakEvenConfig } from './revenue';
import type { POSProduct, POSOrder, POSCustomer, POSPaymentSettings } from './pos';
import type { InventoryTransaction, Supplier, SupplierDebtRecord } from './inventory';
import type { PromotionPlan, BrandProfile } from './marketing';
import type { ShopeeSourceItem, ShopeeCostConfig, ShopeeInventoryInRecord, ShopeeInventoryOutRecord } from './shopee';
import type { KnowledgeBaseArticle } from './common';

export interface AppData {
  employees: Employee[];
  revenue: RevenueRecord[];
  productGroups?: ProductGroup[];
  productGroupRevenue?: ProductGroupRevenue[];
  expenses: ExpenseRecord[];
  payroll: PayrollRecord[];
  staffPerformance?: StaffPerformanceRecord[];
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  sales: SalesRecord[];
  shortages?: ShortageRecord[];
  advances?: AdvanceRecord[];
  cashflow: CashFlowRecord[];
  salaryPolicies: SalaryPolicy[];
  holidays: Holiday[];
  violationTypes?: ViolationType[];
  violationOccurrences?: ViolationOccurrence[];
  customDeductions?: string[];
  responsibilityApprovals?: ResponsibilityApproval[];
  tetCampaign?: TetCampaign;
  expenseCategories?: ExpenseCategory[];
  knowledgeBase?: KnowledgeBaseArticle[];
  promotions?: PromotionPlan[];
  brandProfile?: BrandProfile;
  shopeeRevenue: RevenueRecord[];
  shopeeProductGroupRevenue: ProductGroupRevenue[];
  shopeeSourceData: ShopeeSourceItem[];
  shopeeCosts: ShopeeCostConfig;
  shopeeInventoryIn: ShopeeInventoryInRecord[];
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  dailyAdsConfig: Record<string, number>;
  recurringExpenses: RecurringExpense[];
  dailyBreakEvenConfig?: DailyBreakEvenConfig;
  // POS System Fields
  posProducts: POSProduct[];
  posOrders: POSOrder[];
  posCustomers: POSCustomer[];
  inventoryTransactions: InventoryTransaction[];
  posPaymentSettings?: POSPaymentSettings;
  // Nhà cung cấp
  suppliers: Supplier[];
  supplierDebts: SupplierDebtRecord[];
}

export type AppDataListKey = {
  [K in keyof AppData]: NonNullable<AppData[K]> extends { id: string }[] ? K : never;
}[keyof AppData];

export type AppDataItem<K extends keyof AppData> =
  NonNullable<AppData[K]> extends Array<infer Item> ? Item : NonNullable<AppData[K]>;

export type AppDataSurgicalUpdate = {
  [K in AppDataListKey]: { key: K; item: AppDataItem<K> | { id: string }; isDelete?: boolean };
}[AppDataListKey];

export type UpdateAppData = <K extends keyof AppData>(
  key: K,
  newList: AppData[K],
  idToRemove?: string
) => void;
