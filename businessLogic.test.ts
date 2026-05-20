import { describe, it, expect } from 'vitest';
import {
  calculateSeniority,
  determineCurrentPolicy,
  cleanVNNumber,
  parseVNDate,
  normalizeHeader,
  isUUID,
  isStaffActive,
  calculateDailyBreakEven,
  calculateEmployeePayroll,
  dummyPolicy,
} from './businessLogic';
import type { SalaryPolicy, Employee, AttendanceRecord } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makePolicy = (overrides: Partial<SalaryPolicy> = {}): SalaryPolicy => ({
  id: 'p1',
  name: 'Chính thức',
  salaryType: 'monthly',
  baseSalary: 6_000_000,
  startThreshold: 0,
  endThreshold: 0,
  otRate: 50_000,
  commissionRate: 0,
  seniorityBonusPerYear: 500_000,
  attendanceAllowance: 0,
  cleaningAllowance: 0,
  customerServiceAllowance: 0,
  dinnerAllowance: 50_000,
  housingAllowance: 0,
  responsibilityAllowance: 1_000_000,
  isProRated: false,
  ...overrides,
});

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  name: 'Nguyễn Văn A',
  position: 'Nhân viên',
  joinDate: '2020-01-01',
  ...overrides,
});

// ─── calculateSeniority ──────────────────────────────────────────────────────

describe('calculateSeniority', () => {
  it('trả về 1 khi cùng ngày (ngày đầu tiên làm việc = 1 ngày)', () => {
    expect(calculateSeniority('2024-01-01', '2024-01-01')).toBe(1);
  });

  it('trả về 2 khi cách nhau 1 ngày', () => {
    expect(calculateSeniority('2024-01-01', '2024-01-02')).toBe(2);
  });

  it('trả về 366 sau đúng 1 năm không nhuận (2023)', () => {
    // 365 ngày + 1 (off-by-one intentional) = 366
    expect(calculateSeniority('2023-01-01', '2024-01-01')).toBe(366);
  });

  it('trả về 367 sau đúng 1 năm nhuận (2024)', () => {
    // 366 ngày + 1 = 367
    expect(calculateSeniority('2024-01-01', '2025-01-01')).toBe(367);
  });

  it('trả về 0 khi joinDate rỗng', () => {
    expect(calculateSeniority('', '2024-01-01')).toBe(0);
  });

  it('trả về 0 khi joinDate không hợp lệ', () => {
    expect(calculateSeniority('abc-def-ghi', '2024-01-01')).toBe(0);
  });

  it('trả về 0 khi joinDate sau asOfDate (nhân viên chưa vào)', () => {
    expect(calculateSeniority('2025-01-01', '2024-01-01')).toBe(0);
  });

  it('dùng ngày hôm nay khi không có asOfDate', () => {
    // Nhân viên từ 2020 tính đến 2026 → > 2000 ngày
    expect(calculateSeniority('2020-01-01')).toBeGreaterThan(2000);
  });
});

// ─── determineCurrentPolicy ──────────────────────────────────────────────────

describe('determineCurrentPolicy', () => {
  const probationPolicy = makePolicy({
    id: 'prob', name: 'Thử việc', baseSalary: 3_000_000,
    startThreshold: 0, endThreshold: 30,
  });
  const officialPolicy = makePolicy({
    id: 'off', name: 'Chính thức', baseSalary: 6_000_000,
    startThreshold: 30, endThreshold: 0,
  });
  const policies = [probationPolicy, officialPolicy];
  const emp = makeEmployee({ joinDate: '2024-01-01' });

  it('chọn bậc thử việc khi thâm niên < 30 ngày', () => {
    const { policy, isOfficial } = determineCurrentPolicy(emp, policies, 15);
    expect(policy.id).toBe('prob');
    expect(isOfficial).toBe(false);
  });

  it('chọn bậc chính thức khi thâm niên đúng 30 ngày', () => {
    const { policy, isOfficial } = determineCurrentPolicy(emp, policies, 30);
    expect(policy.id).toBe('off');
    expect(isOfficial).toBe(true);
  });

  it('dùng assignedPolicyId nếu đã gán cứng', () => {
    const empAssigned = makeEmployee({ assignedPolicyId: 'prob' });
    const { policy } = determineCurrentPolicy(empAssigned, policies, 500);
    expect(policy.id).toBe('prob');
  });

  it('trả về dummyPolicy khi danh sách bậc lương rỗng', () => {
    const { policy } = determineCurrentPolicy(emp, [], 100);
    expect(policy.id).toBe('dummy');
  });

  it('isOfficial = false khi thâm niên < 30 dù có bậc khớp', () => {
    const { isOfficial } = determineCurrentPolicy(emp, policies, 29);
    expect(isOfficial).toBe(false);
  });
});

// ─── cleanVNNumber ───────────────────────────────────────────────────────────

describe('cleanVNNumber', () => {
  it('xử lý định dạng dấu chấm VN (1.500.000)', () => {
    expect(cleanVNNumber('1.500.000')).toBe(1_500_000);
  });

  it('xử lý định dạng dấu phẩy VN (1,500,000)', () => {
    expect(cleanVNNumber('1,500,000')).toBe(1_500_000);
  });

  it('xử lý số thập phân dấu chấm (1500.50)', () => {
    expect(cleanVNNumber('1500.50')).toBe(1500.5);
  });

  it('xử lý dấu chấm làm dấu phân cách nghìn ngắn (1.500)', () => {
    expect(cleanVNNumber('1.500')).toBe(1500);
  });

  it('trả về 0 cho chuỗi rỗng', () => {
    expect(cleanVNNumber('')).toBe(0);
  });

  it('trả về 0 cho dấu gạch (---)', () => {
    expect(cleanVNNumber('---')).toBe(0);
  });

  it('trả về 0 cho giá trị null/undefined', () => {
    expect(cleanVNNumber(null)).toBe(0);
    expect(cleanVNNumber(undefined)).toBe(0);
  });

  it('trả về nguyên gốc với số', () => {
    expect(cleanVNNumber(123456)).toBe(123456);
  });
});

// ─── parseVNDate ─────────────────────────────────────────────────────────────

describe('parseVNDate', () => {
  it('chuyển định dạng ISO YYYY-MM-DD giữ nguyên', () => {
    expect(parseVNDate('2024-04-01')).toBe('2024-04-01');
  });

  it('chuyển định dạng DD/MM/YYYY', () => {
    expect(parseVNDate('01/04/2024')).toBe('2024-04-01');
  });

  it('chuyển định dạng DD-MM-YYYY', () => {
    expect(parseVNDate('30-01-2024')).toBe('2024-01-30');
  });

  it('chuyển ngày > 12 đứng đầu đúng là DD (31/01/2024)', () => {
    // p0=31 > 12 nên chắc chắn là ngày
    expect(parseVNDate('31/01/2024')).toBe('2024-01-31');
  });

  it('trả về chuỗi rỗng cho input rỗng', () => {
    expect(parseVNDate('')).toBe('');
  });

  it('trả về chuỗi rỗng cho null/undefined', () => {
    expect(parseVNDate(null)).toBe('');
    expect(parseVNDate(undefined)).toBe('');
  });

  it('chuyển Excel serial number về YYYY-MM-DD', () => {
    // 45292 = 2024-01-01 (Excel epoch từ 1900-01-01)
    const result = parseVNDate(45292);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── normalizeHeader ─────────────────────────────────────────────────────────

describe('normalizeHeader', () => {
  it('bỏ dấu, bỏ khoảng trắng, chuyển thường', () => {
    expect(normalizeHeader('Thời Gian')).toBe('thoigian');
  });

  it('xử lý chữ Đ/đ', () => {
    expect(normalizeHeader('Đơn Vị')).toBe('donvi');
  });

  it('bỏ ký tự đặc biệt', () => {
    expect(normalizeHeader('Doanh Thu (%)')).toBe('doanhthu');
  });

  it('trả về chuỗi rỗng cho null/undefined', () => {
    expect(normalizeHeader(null)).toBe('');
    expect(normalizeHeader(undefined)).toBe('');
  });
});

// ─── isUUID ──────────────────────────────────────────────────────────────────

describe('isUUID', () => {
  it('xác nhận UUID v4 hợp lệ', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('từ chối chuỗi không phải UUID', () => {
    expect(isUUID('not-a-uuid')).toBe(false);
  });

  it('từ chối chuỗi rỗng', () => {
    expect(isUUID('')).toBe(false);
  });
});

// ─── isStaffActive ───────────────────────────────────────────────────────────

describe('isStaffActive', () => {
  it('nhân viên không có ngày nghỉ = còn làm', () => {
    expect(isStaffActive({ id: 'e1', resignedDate: '' })).toBe(true);
    expect(isStaffActive({ id: 'e1' })).toBe(true);
  });

  it('nhân viên có resignedDate = đã nghỉ', () => {
    expect(isStaffActive({ id: 'e1', resignedDate: '2024-01-01' })).toBe(false);
  });

  it('nhân viên có resigned_date (snake_case) = đã nghỉ', () => {
    expect(isStaffActive({ id: 'e1', resigned_date: '2024-01-01' })).toBe(false);
  });

  it('trả về false cho null/undefined', () => {
    expect(isStaffActive(null)).toBe(false);
    expect(isStaffActive(undefined)).toBe(false);
  });
});

// ─── calculateDailyBreakEven ─────────────────────────────────────────────────

describe('calculateDailyBreakEven', () => {
  const config = { monthlyFixedCosts: 31_000_000, grossMarginPercent: 31 };

  it('tính dailyFixedCost và dailyBreakEvenRevenue đúng', () => {
    // Tháng 10/2024 có 31 ngày → dailyFixedCost = 31M/31 = 1M đúng
    const r = calculateDailyBreakEven([], config, '2024-10-15');
    expect(r.dailyFixedCost).toBeCloseTo(1_000_000, 0);
    expect(r.dailyBreakEvenRevenue).toBeCloseTo(1_000_000 / 0.31, 0);
  });

  it('currentRevenue = 0 khi không có dữ liệu hôm nay', () => {
    const r = calculateDailyBreakEven([], config, '2024-10-15');
    expect(r.currentRevenue).toBe(0);
    expect(r.isProfitable).toBe(false);
  });

  it('monthlyTrend có đủ số ngày trong tháng', () => {
    const r = calculateDailyBreakEven([], config, '2024-10-15');
    expect(r.trend).toHaveLength(31);
    // Tháng 2/2024 (năm nhuận) có 29 ngày
    const r2 = calculateDailyBreakEven([], config, '2024-02-01');
    expect(r2.trend).toHaveLength(29);
  });

  it('isProfitable = true khi doanh thu vượt break-even', () => {
    const revenue = [{ id: 'r1', date: '2024-10-15', netRevenue: 10_000_000, revenueOther: 0 } as any];
    const r = calculateDailyBreakEven(revenue, config, '2024-10-15');
    expect(r.isProfitable).toBe(true);
    expect(r.progress).toBe(100);
  });
});

// ─── calculateEmployeePayroll ────────────────────────────────────────────────

describe('calculateEmployeePayroll', () => {
  const policy = makePolicy();
  const emp = makeEmployee({ joinDate: '2020-01-01' });

  // 26 ngày công tháng 1/2024
  const attendance: AttendanceRecord[] = Array.from({ length: 26 }, (_, i) => ({
    id: `a${i}`,
    employeeId: 'e1',
    employeeName: 'Nguyễn Văn A',
    date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
    status: 'Present',
    hours: 11,
  }));

  it('trả về 0 khi tháng không hợp lệ', () => {
    const r = calculateEmployeePayroll(emp, 'invalid', [policy], [], [], [], []);
    expect(r.netPay).toBe(0);
    expect(r.basicSalary).toBe(0);
  });

  it('tính lương tháng pro-rated đúng (26/31 ngày)', () => {
    // January 2024: 31 ngày, 26 ngày công
    // basicActual = Math.round((6_000_000 / 31) * 26) = 5_032_258
    const r = calculateEmployeePayroll(emp, '2024-01', [policy], [], attendance, [], []);
    expect(r.basicSalary).toBe(5_032_258);
  });

  it('tính phụ cấp cơm đúng', () => {
    // dinnerAllowance = 50_000 × 26 ngày = 1_300_000
    const r = calculateEmployeePayroll(emp, '2024-01', [policy], [], attendance, [], []);
    expect(r.allowance).toBe(1_300_000);
  });

  it('tính thâm niên đúng (4 năm = 2_000_000)', () => {
    // Nhân viên vào 2020-01-01, tháng 01/2024 → cuối tháng là 2024-01-31
    // Thâm niên = 1492 ngày → Math.floor(1492/365) = 4 năm
    // seniorityBonus = 4 × 500_000 = 2_000_000
    const r = calculateEmployeePayroll(emp, '2024-01', [policy], [], attendance, [], []);
    expect(r.seniorityBonus).toBe(2_000_000);
  });

  it('không tính lương trách nhiệm khi chưa duyệt', () => {
    const r = calculateEmployeePayroll(emp, '2024-01', [policy], [], attendance, [], [], undefined, 26, [], [], false);
    expect(r.responsibilityPay).toBe(0);
  });

  it('tính lương trách nhiệm khi đã duyệt (isResponsibilityApproved = true)', () => {
    // responsibilityAllowance = 1_000_000, pro-rated theo 26/31 ngày
    const r = calculateEmployeePayroll(emp, '2024-01', [policy], [], attendance, [], [], undefined, 26, [], [], true);
    expect(r.responsibilityPay).toBeGreaterThan(0);
    expect(r.responsibilityPay).toBe(Math.round((1_000_000 / 31) * 26));
  });

  it('tổng netPay = basic + allowance + seniority (trường hợp đơn giản)', () => {
    const r = calculateEmployeePayroll(emp, '2024-01', [policy], [], attendance, [], []);
    const expected = r.basicSalary + r.allowance + r.seniorityBonus;
    expect(r.netPay).toBe(expected);
  });

  it('trừ ứng lương vào netPay', () => {
    const advances = [{ id: 'adv1', employeeId: 'e1', employeeName: 'A', date: '2024-01-10', amount: 1_000_000 }];
    const r = calculateEmployeePayroll(emp, '2024-01', [policy], [], attendance, [], [], undefined, 26, [], [], false, [], advances);
    expect(r.advance).toBe(1_000_000);
    expect(r.netPay).toBeLessThan(r.basicSalary + r.allowance + r.seniorityBonus);
  });
});
