import { describe, expect, it } from 'vitest';
import { sanitizeItem } from '../../services/apiService';
import { dataMapper } from '../../services/dataMapper';
import type { Employee, PayrollRecord } from '../../types';

describe('payroll carry-forward debt sync mapping', () => {
  it('writes carry-forward debt fields to Supabase column names', () => {
    const employee = {
      id: 'employee-1',
      name: 'Test Employee',
      position: 'Staff',
      joinDate: '2026-01-01',
      carryForwardDebt: 125000,
    } as Employee;

    const payroll = {
      id: 'payroll-1',
      employeeId: 'employee-1',
      employeeName: 'Test Employee',
      month: '2026-05',
      carryForwardDeduction: 50000,
      carryForwardDebtOut: 75000,
    } as PayrollRecord;

    expect(sanitizeItem('employees', employee)).toEqual(
      expect.objectContaining({ carry_forward_debt: 125000 })
    );
    expect(sanitizeItem('payroll', payroll)).toEqual(
      expect.objectContaining({
        carry_forward_deduction: 50000,
        carry_forward_debt_out: 75000,
      })
    );
  });

  it('reads carry-forward debt fields from Supabase rows', () => {
    const mapped = dataMapper.mapAllData(
      {
        employees: [
          {
            id: 'employee-1',
            name: 'Test Employee',
            position: 'Staff',
            join_date: '2026-01-01',
            carry_forward_debt: 125000,
          },
        ],
        payroll: [
          {
            id: 'payroll-1',
            employee_id: 'employee-1',
            employee_name: 'Test Employee',
            month: '2026-05',
            carry_forward_deduction: 50000,
            carry_forward_debt_out: 75000,
          },
        ],
      },
      null
    );

    expect(mapped.employees?.[0]).toEqual(expect.objectContaining({ carryForwardDebt: 125000 }));
    expect(mapped.payroll?.[0]).toEqual(
      expect.objectContaining({
        carryForwardDeduction: 50000,
        carryForwardDebtOut: 75000,
      })
    );
  });
});
