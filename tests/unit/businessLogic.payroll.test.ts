import { describe, it, expect } from 'vitest';
import {
  calculateEmployeePayroll,
  calculateStaffRanking,
  dummyPolicy,
} from '../../src/lib/businessLogic.payroll';
import type {
  Employee,
  SalaryPolicy,
  AttendanceRecord,
  OvertimeRecord,
  SalesRecord,
  ViolationType,
  ViolationOccurrence,
  ShortageRecord,
  AdvanceRecord,
  Holiday,
  TetCampaign,
} from '../../types';

// ─── calculateEmployeePayroll ─────────────────────────────────────────────

describe('calculateEmployeePayroll', () => {
  const baseEmployee: Employee = {
    id: 'e1',
    name: 'Nhân Viên Test',
    position: 'Nhân viên',
    joinDate: '2024-01-01',
    photoUrl: '',
    phone: '',
    email: '',
    address: '',
    idNumber: '',
    bankAccount: '',
    emergencyContact: '',
    notes: '',
    resignedDate: '',
  };

  const basePolicy: SalaryPolicy = {
    ...dummyPolicy,
    id: 'p1',
    name: 'Nhân viên chính thức',
    salaryType: 'monthly',
    baseSalary: 6000000,
    startThreshold: 30,
    endThreshold: 0,
    otRate: 50000,
    commissionRate: 5,
    seniorityBonusPerYear: 500000,
    attendanceAllowance: 500000,
    cleaningAllowance: 300000,
    customerServiceAllowance: 200000,
    dinnerAllowance: 30000,
    housingAllowance: 1000000,
    responsibilityAllowance: 2000000,
    isProRated: true,
  };

  it('tính lương cơ bản pro-rated theo ngày công', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-05-02', status: 'Present', hours: 11 },
      { id: 'a3', employeeId: 'e1', date: '2024-05-03', status: 'Absent', hours: 0 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // Tháng 5 có 31 ngày, làm 2 ngày
    // Basic = 6000000 / 31 * 2 ≈ 387097 (làm tròn)
    expect(result.basicSalary).toBeCloseTo(387097, 0);
    expect(result.isOfficial).toBe(true); // thâm niên > 30 ngày
  });

  it('tính phụ cấp pro-rated đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-05-02', status: 'Present', hours: 11 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // Phụ cấp tháng (chuyên cần, vệ sinh, CSKH, nhà ở) pro-rated: (500000 + 300000 + 200000 + 1000000) * 2/31
    // Phụ cấp cơm: 30000 * 2 ngày = 60000
    const expectedMonthlyAllowance = Math.round(2000000 * (2 / 31));
    const expectedDinnerAllowance = 30000 * 2;
    expect(result.allowance).toBe(expectedMonthlyAllowance + expectedDinnerAllowance);
  });

  it('vẫn giữ chuyên cần khi nghỉ có phép 1 ngày', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-05-02', status: 'Present', hours: 8 },
      { id: 'a3', employeeId: 'e1', date: '2024-05-03', status: 'AuthorizedLeave', hours: 0 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );

    const expectedMonthlyAllowance = Math.round(2000000 * (2 / 31));
    const expectedDinnerAllowance = 30000 * 2;
    expect(result.allowance).toBe(expectedMonthlyAllowance + expectedDinnerAllowance);
  });

  it('mất chuyên cần khi nghỉ có phép hơn 1 ngày', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-05-02', status: 'Present', hours: 11 },
      { id: 'a3', employeeId: 'e1', date: '2024-05-03', status: 'AuthorizedLeave', hours: 0 },
      { id: 'a4', employeeId: 'e1', date: '2024-05-04', status: 'AuthorizedLeave', hours: 0 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );

    const expectedMonthlyAllowanceWithoutAttendance = Math.round(1500000 * (2 / 31));
    const expectedDinnerAllowance = 30000 * 2;
    expect(result.allowance).toBe(expectedMonthlyAllowanceWithoutAttendance + expectedDinnerAllowance);
  });

  it('mất chuyên cần khi nghỉ không phép 1 ngày', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-05-02', status: 'Present', hours: 11 },
      { id: 'a3', employeeId: 'e1', date: '2024-05-03', status: 'UnauthorizedLeave', hours: 0 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );

    const expectedMonthlyAllowanceWithoutAttendance = Math.round(1500000 * (2 / 31));
    const expectedDinnerAllowance = 30000 * 2;
    expect(result.allowance).toBe(expectedMonthlyAllowanceWithoutAttendance + expectedDinnerAllowance);
  });

  it('tính lương trách nhiệm khi có phê duyệt', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-05-02', status: 'Present', hours: 11 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      true, // isResponsibilityApproved = true
      [],
      []
    );
    // Responsibility = 2000000 / 31 * 2 ≈ 129032
    expect(result.responsibilityPay).toBeGreaterThan(0);
    expect(result.responsibilityPay).toBeCloseTo(129032, 0);
  });

  it('không tính lương trách nhiệm khi chưa có phê duyệt', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false, // isResponsibilityApproved = false
      [],
      []
    );
    expect(result.responsibilityPay).toBe(0);
  });

  it('tính overtime pay đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const overtime: OvertimeRecord[] = [
      { id: 'ot1', employeeId: 'e1', date: '2024-05-01', hours: 120 }, // 120 phút = 2 giờ
      { id: 'ot2', employeeId: 'e1', date: '2024-05-02', hours: 90 }, // 90 phút = 1.5 giờ
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      overtime,
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // OT = 3.5 giờ * 50000 = 175000
    expect(result.overtimePay).toBe(175000);
  });

  it('tính hoa hồng đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const sales: SalesRecord[] = [
      { id: 's1', employeeId: 'e1', date: '2024-05-01', salesAmount: 10000000, customerId: '' },
      { id: 's2', employeeId: 'e1', date: '2024-05-02', salesAmount: 5000000, customerId: '' },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      sales,
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // Commission = 15000000 * 5% = 750000
    expect(result.commissionPay).toBe(750000);
  });

  it('tính thưởng thâm niên đúng', () => {
    const longTermEmployee: Employee = {
      ...baseEmployee,
      joinDate: '2022-01-01', // 2+ năm trước
    };
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const result = calculateEmployeePayroll(
      longTermEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // Thâm niên cuối tháng 5/2024 từ 1/2022 ≈ 2.4 năm → 2 năm * 500000 = 1000000
    expect(result.seniorityBonus).toBeGreaterThanOrEqual(1000000);
  });

  it('tính thưởng lễ đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const holidays: Holiday[] = [
      { id: 'h1', date: '05-01', name: 'Quốc tế Lao động' },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      holidays,
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // Holiday bonus = 1 ngày lễ * (6000000 / 31) ≈ 193548
    expect(result.holidayBonus).toBeGreaterThan(0);
    expect(result.holidayBonus).toBeCloseTo(193548, 0);
  });

  it('trừ ứng lương đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const advances: AdvanceRecord[] = [
      { id: 'ad1', employeeId: 'e1', date: '2024-05-10', amount: 1000000, reason: 'Ứng lương' },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      advances
    );
    expect(result.advance).toBe(1000000);
    expect(result.netPay).toBeLessThan(result.basicSalary + result.allowance); // đã trừ ứng
  });

  it('trừ thiếu hụt đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const shortages: ShortageRecord[] = [
      { id: 'sh1', employeeId: 'e1', date: '2024-05-15', amount: 500000, reason: 'Thiếu tiền quầy' },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      shortages,
      []
    );
    expect(result.shortage).toBe(500000);
    expect(result.netPay).toBeLessThan(result.basicSalary + result.allowance);
  });

  it('trừ phạt kỷ luật đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const violationTypes: ViolationType[] = [
      {
        id: 'vt1',
        name: 'Đi muộn',
        fine1: '100000',
        fine2: '200000',
        fine3: '300000',
      },
    ];
    const violationOccurrences: ViolationOccurrence[] = [
      {
        id: 'vo1',
        employeeId: 'e1',
        violationTypeId: 'vt1',
        month: '2024-05',
        occurrence: 1,
      },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      violationTypes,
      violationOccurrences,
      false,
      [],
      []
    );
    expect(result.fine).toBe(100000);
    expect(result.netPay).toBeLessThan(result.basicSalary + result.allowance);
  });

  it('tước phụ cấp khi vi phạm có từ khóa "chuyên cần"', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const violationTypes: ViolationType[] = [
      {
        id: 'vt1',
        name: 'Nghỉ không phép',
        fine1: 'Tước chuyên cần',
        fine2: '200000',
        fine3: '300000',
      },
    ];
    const violationOccurrences: ViolationOccurrence[] = [
      {
        id: 'vo1',
        employeeId: 'e1',
        violationTypeId: 'vt1',
        month: '2024-05',
        occurrence: 1,
      },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      violationTypes,
      violationOccurrences,
      false,
      [],
      []
    );
    // Phụ cấp chuyên cần bị tước → allowance thấp hơn
    expect(result.allowance).toBeLessThan(Math.round(2000000 * (1 / 31)) + 30000);
  });

  it('tước lương trách nhiệm khi vi phạm có từ khóa "trách nhiệm"', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const violationTypes: ViolationType[] = [
      {
        id: 'vt1',
        name: 'Vi phạm nghiêm trọng',
        fine1: 'Tước trách nhiệm',
        fine2: '500000',
        fine3: '1000000',
      },
    ];
    const violationOccurrences: ViolationOccurrence[] = [
      {
        id: 'vo1',
        employeeId: 'e1',
        violationTypeId: 'vt1',
        month: '2024-05',
        occurrence: 1,
      },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      violationTypes,
      violationOccurrences,
      true, // có phê duyệt nhưng bị tước
      [],
      []
    );
    expect(result.responsibilityPay).toBe(0); // bị tước
  });

  it('tính lương theo giờ (daily) đúng', () => {
    const dailyPolicy: SalaryPolicy = {
      ...basePolicy,
      salaryType: 'daily',
      baseSalary: 110000, // 110k cho ca 11 giờ
    };
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-05-02', status: 'Present', hours: 5.5 },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [dailyPolicy],
      [],
      attendance,
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // Basic = 110000 / 11 * 16.5 = 165000
    expect(result.basicSalary).toBeCloseTo(165000, 0);
  });

  it('tính thưởng Tết trước Tết đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-01-28', status: 'Present', hours: 11 },
      { id: 'a2', employeeId: 'e1', date: '2024-01-29', status: 'Present', hours: 11 },
      { id: 'a3', employeeId: 'e1', date: '2024-01-30', status: 'Present', hours: 11 },
    ];
    const tetConfig: TetCampaign = {
      id: 'tet1',
      year: 2024,
      date28Tet: '2024-01-28',
      date29Tet: '2024-01-29',
      date30Tet: '2024-01-30',
      carAllowance: 200000,
      bonus29Tet: 300000,
      bonus30Tet: 500000,
      beforeTetExtraDays: [],
      beforeTetExtraBonus: 0,
      afterTetDate: '',
      lixiBonus: 0,
      afterTetExtraDays: [],
      afterTetExtraBonus: 0,
    };
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-01',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      tetConfig,
      26,
      [],
      [],
      false,
      [],
      []
    );
    // Tết trước = 200000 + 300000 + 500000 = 1000000
    expect(result.tetBonusBefore).toBe(1000000);
    expect(result.tetBonus).toBe(1000000);
  });

  it('tính thưởng Tết sau Tết đúng', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-02-10', status: 'Present', hours: 11 },
    ];
    const tetConfig: TetCampaign = {
      id: 'tet1',
      year: 2024,
      date28Tet: '',
      date29Tet: '',
      date30Tet: '',
      carAllowance: 0,
      bonus29Tet: 0,
      bonus30Tet: 0,
      beforeTetExtraDays: [],
      beforeTetExtraBonus: 0,
      afterTetDate: '2024-02-10',
      lixiBonus: 500000,
      afterTetExtraDays: [],
      afterTetExtraBonus: 0,
    };
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-02',
      [basePolicy],
      [],
      attendance,
      [],
      [],
      tetConfig,
      26,
      [],
      [],
      false,
      [],
      []
    );
    expect(result.tetBonusAfter).toBe(500000);
    expect(result.tetBonus).toBe(500000);
  });

  it('trả về 0 khi tháng không hợp lệ', () => {
    const result = calculateEmployeePayroll(
      baseEmployee,
      'invalid-month',
      [basePolicy],
      [],
      [],
      [],
      [],
      undefined,
      26,
      [],
      [],
      false,
      [],
      []
    );
    expect(result.netPay).toBe(0);
    expect(result.basicSalary).toBe(0);
  });

  it('tính netPay = tổng thu nhập - tổng khấu trừ', () => {
    const attendance: AttendanceRecord[] = [
      { id: 'a1', employeeId: 'e1', date: '2024-05-01', status: 'Present', hours: 11 },
    ];
    const sales: SalesRecord[] = [
      { id: 's1', employeeId: 'e1', date: '2024-05-01', salesAmount: 10000000, customerId: '' },
    ];
    const advances: AdvanceRecord[] = [
      { id: 'ad1', employeeId: 'e1', date: '2024-05-10', amount: 500000, reason: 'Ứng lương' },
    ];
    const result = calculateEmployeePayroll(
      baseEmployee,
      '2024-05',
      [basePolicy],
      [],
      attendance,
      [],
      sales,
      undefined,
      26,
      [],
      [],
      false,
      [],
      advances
    );
    const expectedNet =
      result.basicSalary +
      result.allowance +
      result.responsibilityPay +
      result.overtimePay +
      result.commissionPay +
      result.seniorityBonus +
      result.holidayBonus +
      result.tetBonus -
      result.fine -
      result.shortage -
      result.advance;
    expect(result.netPay).toBe(expectedNet);
  });
});

// ─── calculateStaffRanking ────────────────────────────────────────────────

describe('calculateStaffRanking', () => {
  it('xếp hạng nhân viên theo doanh số đúng', () => {
    const sales: SalesRecord[] = [
      { id: 's1', employeeId: 'e1', date: '2024-05-01', salesAmount: 10000000, customerId: '' },
      { id: 's2', employeeId: 'e2', date: '2024-05-02', salesAmount: 5000000, customerId: '' },
      { id: 's3', employeeId: 'e3', date: '2024-05-03', salesAmount: 8000000, customerId: '' },
    ];
    const employees: Employee[] = [
      { id: 'e1', name: 'NV1', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
      { id: 'e2', name: 'NV2', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
      { id: 'e3', name: 'NV3', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
    ];
    const result = calculateStaffRanking(sales, employees, '2024-05');
    expect(result.length).toBe(3);
    expect(result[0].rank).toBe(1);
    expect(result[0].id).toBe('e1'); // doanh số cao nhất
    expect(result[0].totalAmount).toBe(10000000);
    expect(result[1].rank).toBe(2);
    expect(result[1].id).toBe('e3');
    expect(result[2].rank).toBe(3);
    expect(result[2].id).toBe('e2');
  });

  it('tính contribution % đúng', () => {
    const sales: SalesRecord[] = [
      { id: 's1', employeeId: 'e1', date: '2024-05-01', salesAmount: 6000000, customerId: '' },
      { id: 's2', employeeId: 'e2', date: '2024-05-02', salesAmount: 4000000, customerId: '' },
    ];
    const employees: Employee[] = [
      { id: 'e1', name: 'NV1', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
      { id: 'e2', name: 'NV2', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
    ];
    const result = calculateStaffRanking(sales, employees, '2024-05');
    expect(result[0].contribution).toBe(60); // 6000000 / 10000000 * 100
    expect(result[1].contribution).toBe(40);
  });

  it('lọc nhân viên không có doanh số', () => {
    const sales: SalesRecord[] = [
      { id: 's1', employeeId: 'e1', date: '2024-05-01', salesAmount: 10000000, customerId: '' },
    ];
    const employees: Employee[] = [
      { id: 'e1', name: 'NV1', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
      { id: 'e2', name: 'NV2', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
    ];
    const result = calculateStaffRanking(sales, employees, '2024-05');
    expect(result.length).toBe(1); // chỉ e1 có doanh số
    expect(result[0].id).toBe('e1');
  });

  it('xử lý đúng khi không có sales', () => {
    const employees: Employee[] = [
      { id: 'e1', name: 'NV1', photoUrl: '', position: 'Nhân viên', joinDate: '2024-01-01', phone: '', email: '', address: '', idNumber: '', bankAccount: '', emergencyContact: '', notes: '', resignedDate: '' },
    ];
    const result = calculateStaffRanking([], employees, '2024-05');
    expect(result.length).toBe(0);
  });
});
