
import { AppData, Employee, RevenueRecord, ExpenseRecord, PayrollRecord } from '../types';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export const validationService = {
  isValidUUID(uuid: string): boolean {
    const s = "" + uuid;
    const match = s.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
    return match !== null;
  },

  validateEmployee(emp: Partial<Employee>): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!emp.name || emp.name.trim() === '') {
      errors.push({ field: 'name', message: 'Tên nhân viên không được để trống' });
    }
    if (emp.phone && !/^\d{10,11}$/.test(emp.phone.replace(/[\s.-]/g, ''))) {
      errors.push({ field: 'phone', message: 'Số điện thoại không hợp lệ (10-11 số)', value: emp.phone });
    }
    return errors;
  },

  validateRevenue(rev: Partial<RevenueRecord>): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!rev.date) {
      errors.push({ field: 'date', message: 'Ngày ghi nhận doanh thu không được để trống' });
    }
    if (Number(rev.totalGrossRevenue) < 0) {
      errors.push({ field: 'totalGrossRevenue', message: 'Doanh thu gộp không được âm' });
    }
    if (Number(rev.totalCogs) < 0) {
      errors.push({ field: 'totalCogs', message: 'Giá vốn không được âm' });
    }
    return errors;
  },

  validateExpense(exp: Partial<ExpenseRecord>): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!exp.date) {
      errors.push({ field: 'date', message: 'Ngày chi không được để trống' });
    }
    if (Number(exp.amount) <= 0) {
      errors.push({ field: 'amount', message: 'Số tiền chi phải lớn hơn 0' });
    }
    return errors;
  },

  validatePayroll(pay: Partial<PayrollRecord>): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!pay.employeeId) {
      errors.push({ field: 'employeeId', message: 'Phải chọn nhân viên cho bảng lương' });
    }
    if (!pay.month) {
      errors.push({ field: 'month', message: 'Tháng lương không được để trống' });
    }
    return errors;
  },

  // Central entry point for all data validation
  validate(key: keyof AppData, item: any): ValidationError[] {
    switch (key) {
      case 'employees': return this.validateEmployee(item);
      case 'revenue': 
      case 'shopeeRevenue': return this.validateRevenue(item);
      case 'expenses': return this.validateExpense(item);
      case 'payroll': return this.validatePayroll(item);
      default: return [];
    }
  }
};
