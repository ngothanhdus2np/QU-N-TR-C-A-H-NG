/**
 * Payroll Types
 * Types related to salary, payroll, and compensation
 */

export interface SalaryPolicy {
  id: string;
  name: string;
  salaryType: 'daily' | 'monthly';
  baseSalary: number;
  isProRated?: boolean;
  startThreshold: number;
  endThreshold: number;
  otRate: number;
  commissionRate: number;
  seniorityBonusPerYear: number;
  attendanceAllowance: number;
  cleaningAllowance: number;
  customerServiceAllowance: number;
  dinnerAllowance: number;
  housingAllowance: number;
  responsibilityAllowance: number;
}

export interface TetCampaign {
  // Giai đoạn Trước Tết
  commitmentDate: string;
  carAllowance: number;
  beforeTetExtraDays: string[];
  beforeTetExtraBonus: number;

  // Cấu hình đặc thù 28, 29, 30
  date28Tet?: string;
  date29Tet?: string;
  date30Tet?: string;
  bonus29Tet?: number;
  bonus30Tet?: number;

  // Giai đoạn Sau Tết
  afterTetDate: string;
  lixiBonus: number;
  afterTetExtraDays: string[];
  afterTetExtraBonus: number;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  basicSalary: number;
  allowance: number;
  responsibilityPay: number;
  overtimePay: number;
  commissionPay: number;
  seniorityBonus: number;
  holidayBonus: number;
  tetBonus: number;
  tetBonusBefore?: number; // Phúc lợi trước tết
  tetBonusAfter?: number; // Phúc lợi sau tết
  advance: number;
  shortage: number;
  fine: number;
  netPay: number;
  seniorityDays: number;
  isOfficial: boolean;
  hasTetCommitment: boolean;
  calculationNote?: string;
}

export type PayrollSubTab =
  | 'attendance'
  | 'overtime'
  | 'sales'
  | 'penalties'
  | 'summary'
  | 'ledger';
