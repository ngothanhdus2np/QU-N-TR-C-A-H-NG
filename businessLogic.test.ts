import { describe, it, expect } from 'vitest';
import {
  calculateSeniority,
  cleanVNNumber,
  parseVNDate,
  isUUID,
  generateId,
  isStaffActive,
  normalizeHeader,
  determineCurrentPolicy,
  dummyPolicy,
} from './businessLogic';
import type { Employee, SalaryPolicy } from './types';

// ─── calculateSeniority ────────────────────────────────────────────────────

describe('calculateSeniority', () => {
  it('trả về 1 ngày khi join và tính cùng ngày (ngày đầu tiên tính 1)', () => {
    expect(calculateSeniority('2024-01-01', '2024-01-01')).toBe(1);
  });

  it('tính đúng sau 1 năm làm việc', () => {
    // 2024-01-01 → 2025-01-01: 366 ngày (2024 là năm nhuận) + 1 = 367
    expect(calculateSeniority('2024-01-01', '2025-01-01')).toBe(367);
  });

  it('trả về 0 nếu joinDate rỗng', () => {
    expect(calculateSeniority('')).toBe(0);
  });

  it('trả về 0 nếu joinDate là tương lai', () => {
    expect(calculateSeniority('2099-01-01', '2024-01-01')).toBe(0);
  });

  it('trả về 0 nếu joinDate không hợp lệ', () => {
    expect(calculateSeniority('not-a-date')).toBe(0);
  });
});

// ─── cleanVNNumber ─────────────────────────────────────────────────────────

describe('cleanVNNumber', () => {
  it('parse số nguyên thuần', () => {
    expect(cleanVNNumber(1000)).toBe(1000);
  });

  it('parse chuỗi số VN có dấu chấm phân cách nghìn', () => {
    expect(cleanVNNumber('1.500.000')).toBe(1500000);
  });

  it('parse chuỗi số VN có dấu phẩy phân cách nghìn', () => {
    expect(cleanVNNumber('1,500,000')).toBe(1500000);
  });

  it('parse chuỗi số với dấu phẩy thập phân', () => {
    expect(cleanVNNumber('1,5')).toBe(1.5);
  });

  it('parse chuỗi hỗn hợp dấu chấm và phẩy (EU format)', () => {
    expect(cleanVNNumber('1.500,50')).toBe(1500.5);
  });

  it('trả về 0 với chuỗi rỗng', () => {
    expect(cleanVNNumber('')).toBe(0);
  });

  it('trả về 0 với giá trị null/undefined', () => {
    expect(cleanVNNumber(null)).toBe(0);
    expect(cleanVNNumber(undefined)).toBe(0);
  });

  it('trả về 0 với chuỗi ---', () => {
    expect(cleanVNNumber('---')).toBe(0);
  });

  it('parse chuỗi có ký tự tiền tệ', () => {
    expect(cleanVNNumber('500.000đ')).toBe(500000);
  });

  it('trả về 0 nếu NaN', () => {
    expect(cleanVNNumber('abc')).toBe(0);
  });
});

// ─── parseVNDate ──────────────────────────────────────────────────────────

describe('parseVNDate', () => {
  it('parse định dạng YYYY-MM-DD', () => {
    expect(parseVNDate('2024-04-18')).toBe('2024-04-18');
  });

  it('parse định dạng DD/MM/YYYY (chuẩn VN)', () => {
    expect(parseVNDate('18/04/2024')).toBe('2024-04-18');
  });

  it('parse định dạng DD-MM-YYYY', () => {
    expect(parseVNDate('18-04-2024')).toBe('2024-04-18');
  });

  it('parse định dạng DD.MM.YYYY', () => {
    expect(parseVNDate('18.04.2024')).toBe('2024-04-18');
  });

  it('parse khi ngày > 12 (chắc chắn là ngày, không phải tháng)', () => {
    expect(parseVNDate('25/01/2024')).toBe('2024-01-25');
  });

  it('bỏ phần thời gian nếu có', () => {
    expect(parseVNDate('2024-04-18 15:30:00')).toBe('2024-04-18');
  });

  it('trả về chuỗi rỗng với null/undefined/rỗng', () => {
    expect(parseVNDate(null)).toBe('');
    expect(parseVNDate(undefined)).toBe('');
    expect(parseVNDate('')).toBe('');
  });

  it('trả về chuỗi rỗng với chuỗi không hợp lệ', () => {
    expect(parseVNDate('không-phải-ngày')).toBe('');
  });

  it('parse JavaScript Date object', () => {
    const d = new Date('2024-04-18');
    const result = parseVNDate(d);
    expect(result).toBe('2024-04-18');
  });
});

// ─── isUUID ───────────────────────────────────────────────────────────────

describe('isUUID', () => {
  it('nhận UUID v4 hợp lệ', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('từ chối chuỗi không phải UUID', () => {
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('')).toBe(false);
    expect(isUUID('123')).toBe(false);
  });
});

// ─── generateId ───────────────────────────────────────────────────────────

describe('generateId', () => {
  it('tạo chuỗi có định dạng UUID', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('mỗi lần gọi tạo ID khác nhau', () => {
    expect(generateId()).not.toBe(generateId());
  });
});

// ─── isStaffActive ────────────────────────────────────────────────────────

describe('isStaffActive', () => {
  it('nhân viên chưa nghỉ (resignedDate rỗng) → active', () => {
    expect(isStaffActive({ resignedDate: '' })).toBe(true);
    expect(isStaffActive({ resignedDate: null })).toBe(true);
  });

  it('nhân viên đã nghỉ (có resignedDate) → không active', () => {
    expect(isStaffActive({ resignedDate: '2024-01-01' })).toBe(false);
  });

  it('resignedDate chỉ có khoảng trắng → active', () => {
    expect(isStaffActive({ resignedDate: '   ' })).toBe(true);
  });

  it('null/undefined → false', () => {
    expect(isStaffActive(null)).toBe(false);
    expect(isStaffActive(undefined)).toBe(false);
  });
});

// ─── normalizeHeader ──────────────────────────────────────────────────────

describe('normalizeHeader', () => {
  it('chuyển chữ hoa thành thường và bỏ dấu tiếng Việt', () => {
    expect(normalizeHeader('Doanh Thu')).toBe('doanhthu');
  });

  it('bỏ ký tự đặc biệt và khoảng trắng', () => {
    expect(normalizeHeader('Ngày/Tháng')).toBe('ngaythang');
  });

  it('xử lý null/undefined', () => {
    expect(normalizeHeader(null)).toBe('');
    expect(normalizeHeader(undefined)).toBe('');
  });

  it('chuyển chữ Đ/đ thành d', () => {
    expect(normalizeHeader('Đơn giá')).toBe('dongia');
  });
});

// ─── determineCurrentPolicy ───────────────────────────────────────────────

describe('determineCurrentPolicy', () => {
  const baseEmployee: Employee = {
    id: 'e1',
    name: 'Nhân Viên Test',
    position: 'Nhân viên',
    joinDate: '2023-01-01',
    photoUrl: '',
    assignedPolicyId: undefined,
  } as unknown as Employee;

  const policies: SalaryPolicy[] = [
    {
      ...dummyPolicy,
      id: 'p-new',
      name: 'Mới vào',
      startThreshold: 0,
      endThreshold: 30,
      baseSalary: 3000000,
    },
    {
      ...dummyPolicy,
      id: 'p-mid',
      name: 'Thử việc qua',
      startThreshold: 30,
      endThreshold: 365,
      baseSalary: 5000000,
    },
    {
      ...dummyPolicy,
      id: 'p-senior',
      name: 'Nhân viên chính thức',
      startThreshold: 365,
      endThreshold: 0,
      baseSalary: 7000000,
    },
  ];

  it('chọn policy phù hợp với thâm niên 10 ngày', () => {
    const { policy } = determineCurrentPolicy(baseEmployee, policies, 10);
    expect(policy.id).toBe('p-new');
  });

  it('chọn policy phù hợp với thâm niên 50 ngày', () => {
    const { policy } = determineCurrentPolicy(baseEmployee, policies, 50);
    expect(policy.id).toBe('p-mid');
  });

  it('chọn policy phù hợp với thâm niên 400 ngày (endThreshold = 0 là vô cực)', () => {
    const { policy } = determineCurrentPolicy(baseEmployee, policies, 400);
    expect(policy.id).toBe('p-senior');
  });

  it('ưu tiên assignedPolicyId nếu có', () => {
    const empWithAssigned = { ...baseEmployee, assignedPolicyId: 'p-senior' };
    const { policy } = determineCurrentPolicy(empWithAssigned as Employee, policies, 5);
    expect(policy.id).toBe('p-senior');
  });

  it('trả về dummyPolicy nếu không có policies', () => {
    const { policy } = determineCurrentPolicy(baseEmployee, [], 100);
    expect(policy.id).toBe('dummy');
  });

  it('isOfficial = false khi thâm niên < 30 ngày', () => {
    const { isOfficial } = determineCurrentPolicy(baseEmployee, policies, 10);
    expect(isOfficial).toBe(false);
  });

  it('isOfficial = true khi thâm niên >= 30 ngày', () => {
    const { isOfficial } = determineCurrentPolicy(baseEmployee, policies, 30);
    expect(isOfficial).toBe(true);
  });
});
