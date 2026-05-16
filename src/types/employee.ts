/**
 * Employee & HR Types
 * Types related to employees, attendance, and HR management
 */

export interface Employee {
  id: string;
  name: string;
  position: string;
  joinDate: string;
  resignedDate?: string; // Ngày nghỉ việc (nếu có)
  assignedPolicyId?: string; // Trường mới: ID nhóm lương được gán cố định
  dob?: string;
  phone?: string;
  address?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankAccountHolder?: string;
  notes?: string;
  photoUrl?: string; // Trường ảnh chân dung mới
  bloodType?: string;
  email?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: 'Present' | 'AuthorizedLeave' | 'UnauthorizedLeave' | 'Holiday';
  hours: number;
}

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  multiplier: number;
}

export interface SalesRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  salesAmount: number;
  commissionRate: number;
  commissionEarned: number;
}

export interface ShortageRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
}

export interface AdvanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface ViolationType {
  id: string;
  name: string;
  fine1: string;
  fine2: string;
  fine3: string;
}

export interface ViolationOccurrence {
  employeeId: string;
  violationTypeId: string;
  occurrence: 1 | 2 | 3;
  month: string;
}

export interface ResponsibilityApproval {
  employeeId: string;
  month: string;
}

export interface StaffPerformanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  totalSales: number;
  totalIncome: number;
  roi: number; // Doanh thu / Thu nhập
  rank?: number;
}
