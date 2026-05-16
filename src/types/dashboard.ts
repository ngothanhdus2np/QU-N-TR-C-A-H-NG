/**
 * Dashboard Types
 * Types related to dashboard analytics and visualizations
 */

export interface DashboardFinancialInsights {
  periodRev: number;
  periodExp: number;
  periodProfit: number;
  periodGross: number;
  payrollTotal: number;
  nonPayrollExp: number;
  activeStaffCount: number;
  netProfitMargin: number;
  opExRatio: number;
  laborCostRatio: number;
  fixedCosts: number;
  variableCosts: number;
  depreciationCosts: number;
  interestCosts: number;
  totalCogs: number;
  ledgerCogs: number;
}

export interface DashboardPreviousInsights {
  rev: number;
  profit: number;
  gross: number;
  exp: number;
}

export interface DashboardBreakEvenAnalysis {
  dailyFixedCost: number;
  avgGrossMargin: number;
}

export interface DashboardTrendPoint {
  month?: string;
  date?: string;
  revenue: number;
  grossProfit: number;
  netProfit: number;
}

export interface DashboardWaterfallItem {
  name: string;
  value: [number, number];
  fill: string;
  label: string;
}

export interface DashboardExpenseSlice {
  name: string;
  value: number;
}

export interface DashboardDetailedExpense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}
