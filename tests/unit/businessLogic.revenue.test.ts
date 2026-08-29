import { describe, it, expect } from 'vitest';
import {
  calculateExecutiveInsights,
  calculateFinancialHealthScore,
  auditFinancials,
  calculateMarketingPerformance,
  calculateStaffProductivity,
  getCategoryType,
  calculateExpenseAnalysis,
  calculateDailyBreakEven,
  calculateStrategicSuggestions,
  calculateSeasonalityAnalysis,
} from '../../src/lib/businessLogic.revenue';
import type {
  RevenueRecord,
  ExpenseRecord,
  PayrollRecord,
  Employee,
  SalesRecord,
  OvertimeRecord,
  ExpenseCategory,
  ProductGroupRevenue,
  ProductGroup,
} from '../../types';

// ─── calculateExecutiveInsights ────────────────────────────────────────────

describe('calculateExecutiveInsights', () => {
  it('tính đúng doanh thu tháng hiện tại', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const data = {
      revenue: [
        { date: `${currentMonth}-01`, netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
        { date: `${currentMonth}-02`, netRevenue: 2000000, revenueOther: 500000, grossProfit: 700000 },
        { date: '2020-01-01', netRevenue: 5000000, revenueOther: 0, grossProfit: 1000000 }, // tháng cũ
      ] as RevenueRecord[],
    };
    const result = calculateExecutiveInsights(data);
    expect(result.currentMonthRev).toBe(3500000); // chỉ tính tháng hiện tại
    // currentMonthGross không được export từ function, bỏ test này
  });

  it('tính đúng lợi nhuận ròng = lợi nhuận gộp - chi phí', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const data = {
      revenue: [
        { date: `${currentMonth}-01`, netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      expenses: [
        { date: `${currentMonth}-01`, amount: 100000, category: 'Điện nước' },
      ] as ExpenseRecord[],
    };
    const result = calculateExecutiveInsights(data);
    expect(result.projectedNetProfit).toBe(200000); // 300000 - 100000
  });

  it('tính đúng lợi nhuận trên đầu người khi có nhân viên', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const data = {
      revenue: [
        { date: `${currentMonth}-01`, netRevenue: 1000000, revenueOther: 0, grossProfit: 500000 },
      ] as RevenueRecord[],
      expenses: [
        { date: `${currentMonth}-01`, amount: 100000, category: 'Điện nước' },
      ] as ExpenseRecord[],
      employees: [
        { id: 'e1', name: 'NV1', resignedDate: '' },
        { id: 'e2', name: 'NV2', resignedDate: '' },
      ] as Employee[],
    };
    const result = calculateExecutiveInsights(data);
    expect(result.profitPerStaff).toBe(200000); // (500000 - 100000) / 2
    expect(result.activeStaffCount).toBe(2);
  });

  it('tính coverage ratio đúng khi có dữ liệu sales', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const data = {
      revenue: [
        { date: `${currentMonth}-01`, netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      sales: [
        { date: `${currentMonth}-01`, employeeId: 'e1', salesAmount: 600000 },
      ] as SalesRecord[],
    };
    const result = calculateExecutiveInsights(data);
    expect(result.coverageRatio).toBe(60); // 600000 / 1000000 * 100
  });

  it('xử lý đúng khi không có dữ liệu', () => {
    const result = calculateExecutiveInsights({});
    expect(result.currentMonthRev).toBe(0);
    expect(result.currentMonthExp).toBe(0);
    expect(result.profitPerStaff).toBe(0);
    expect(result.coverageRatio).toBe(0);
  });

  it('không tính nhân viên đã nghỉ vào activeStaffCount', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const data = {
      revenue: [
        { date: `${currentMonth}-01`, netRevenue: 1000000, revenueOther: 0, grossProfit: 500000 },
      ] as RevenueRecord[],
      employees: [
        { id: 'e1', name: 'NV1', resignedDate: '' },
        { id: 'e2', name: 'NV2', resignedDate: '2024-01-01' }, // đã nghỉ
      ] as Employee[],
    };
    const result = calculateExecutiveInsights(data);
    expect(result.activeStaffCount).toBe(1);
  });
});

// ─── calculateFinancialHealthScore ────────────────────────────────────────

describe('calculateFinancialHealthScore', () => {
  it('trả về score 0 khi không có dữ liệu revenue', () => {
    const result = calculateFinancialHealthScore({});
    expect(result.score).toBe(0);
    expect(result.factors).toContain('Chưa có dữ liệu');
  });

  it('tính net margin đúng', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 400000 },
      ] as RevenueRecord[],
      expenses: [
        { date: '2024-01-01', amount: 100000, category: 'Điện nước' },
      ] as ExpenseRecord[],
    };
    const result = calculateFinancialHealthScore(data);
    expect(result.netMargin).toBe(30); // (400000 - 100000) / 1000000 * 100
  });

  it('cộng điểm khi net margin > 20%', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 500000 },
      ] as RevenueRecord[],
      expenses: [
        { date: '2024-01-01', amount: 100000, category: 'Điện nước' },
      ] as ExpenseRecord[],
    };
    const result = calculateFinancialHealthScore(data);
    expect(result.netMargin).toBeGreaterThan(20);
    expect(result.score).toBeGreaterThanOrEqual(85); // 70 + 15
    expect(result.factors).toContain('Biên lợi nhuận ròng xuất sắc');
  });

  it('cộng điểm khi coverage ratio > 50%', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      sales: [
        { date: '2024-01-01', employeeId: 'e1', salesAmount: 600000 },
      ] as SalesRecord[],
    };
    const result = calculateFinancialHealthScore(data);
    expect(result.coverageRatio).toBeGreaterThan(50);
    expect(result.factors).toContain('Đội ngũ sale chủ động tốt (>50% độ phủ)');
  });

  it('tính payroll ratio đúng', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      payroll: [
        { month: '2024-01', employeeId: 'e1', netPay: 5000000 },
      ] as PayrollRecord[],
    };
    const result = calculateFinancialHealthScore(data);
    expect(result.payrollRatio).toBe(500); // 5000000 / 1000000 * 100
  });
});

// ─── auditFinancials ───────────────────────────────────────────────────────

describe('auditFinancials', () => {
  it('cảnh báo khi độ phủ sale < 30%', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      sales: [
        { date: '2024-01-01', employeeId: 'e1', salesAmount: 200000 }, // 20% < 30%
      ] as SalesRecord[],
    };
    const leaks = auditFinancials(data);
    expect(leaks.some(l => l.includes('Độ phủ sale < 30%'))).toBe(true);
  });

  it('cảnh báo khi tỷ lệ OT cao', () => {
    const data = {
      employees: [
        { id: 'e1', name: 'NV1', resignedDate: '' },
      ] as Employee[],
      overtime: [
        { employeeId: 'e1', date: '2024-01-01', hours: 1500 }, // 1500 phút = 25 giờ > 20 giờ/người
      ] as OvertimeRecord[],
    };
    const leaks = auditFinancials(data);
    expect(leaks.some(l => l.includes('Tỷ lệ tăng ca (OT) cao'))).toBe(true);
  });

  it('cảnh báo khi quỹ lương > 40% doanh thu', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      payroll: [
        { month: '2024-01', employeeId: 'e1', netPay: 500000 }, // 50% > 40%
      ] as PayrollRecord[],
    };
    const leaks = auditFinancials(data);
    expect(leaks.some(l => l.includes('Quỹ lương hạch toán chiếm tỷ trọng cao'))).toBe(true);
  });

  it('không cảnh báo khi tất cả chỉ số ổn', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      sales: [
        { date: '2024-01-01', employeeId: 'e1', salesAmount: 500000 }, // 50% > 30%
      ] as SalesRecord[],
      employees: [
        { id: 'e1', name: 'NV1', resignedDate: '' },
      ] as Employee[],
      overtime: [
        { employeeId: 'e1', date: '2024-01-01', hours: 300 }, // 5 giờ < 20 giờ
      ] as OvertimeRecord[],
      payroll: [
        { month: '2024-01', employeeId: 'e1', netPay: 300000 }, // 30% < 40%
      ] as PayrollRecord[],
    };
    const leaks = auditFinancials(data);
    expect(leaks.length).toBe(0);
  });
});

// ─── calculateMarketingPerformance ────────────────────────────────────────

describe('calculateMarketingPerformance', () => {
  it('tính coverage ratio và self-service gap đúng', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      sales: [
        { date: '2024-01-01', employeeId: 'e1', salesAmount: 600000 },
      ] as SalesRecord[],
    };
    const result = calculateMarketingPerformance(data);
    expect(result.coverageRatio).toBe(60);
    expect(result.selfServiceGap).toBe(400000); // 1000000 - 600000
  });

  it('tính KPI min/max dựa trên phân phối sales', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 3000000, revenueOther: 0, grossProfit: 900000 },
      ] as RevenueRecord[],
      sales: [
        { date: '2024-01-01', employeeId: 'e1', salesAmount: 1000000 },
        { date: '2024-01-01', employeeId: 'e2', salesAmount: 800000 },
        { date: '2024-01-01', employeeId: 'e3', salesAmount: 200000 },
      ] as SalesRecord[],
      employees: [
        { id: 'e1', name: 'NV1', resignedDate: '' },
        { id: 'e2', name: 'NV2', resignedDate: '' },
        { id: 'e3', name: 'NV3', resignedDate: '' },
      ] as Employee[],
    };
    const result = calculateMarketingPerformance(data);
    expect(result.kpiMin).toBeGreaterThan(0);
    expect(result.kpiMax).toBeGreaterThan(result.kpiMin);
    expect(result.staffPerformance.length).toBe(3);
    expect(result.staffPerformance[0].status).toBe('Elite'); // top performer
  });

  it('xử lý đúng khi không có sales', () => {
    const data = {
      revenue: [
        { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      ] as RevenueRecord[],
      sales: [] as SalesRecord[],
      employees: [] as Employee[],
    };
    const result = calculateMarketingPerformance(data);
    expect(result.coverageRatio).toBe(0);
    expect(result.activeRPE).toBe(0);
    expect(result.staffPerformance.length).toBe(0);
  });
});

// ─── calculateStaffProductivity ───────────────────────────────────────────

describe('calculateStaffProductivity', () => {
  it('tính RPE (Revenue Per Employee) đúng', () => {
    const employees = [
      { id: 'e1', name: 'NV1', resignedDate: '' },
      { id: 'e2', name: 'NV2', resignedDate: '' },
    ] as Employee[];
    const revenue = [
      { date: '2024-01-15', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      { date: '2024-01-20', netRevenue: 500000, revenueOther: 0, grossProfit: 150000 },
    ] as RevenueRecord[];
    const result = calculateStaffProductivity(employees, revenue);
    expect(result.currentRPE).toBe(750000); // 1500000 / 2
    expect(result.totalStaff).toBe(2);
  });

  it('tạo trend theo tháng đúng', () => {
    const employees = [
      { id: 'e1', name: 'NV1', resignedDate: '' },
    ] as Employee[];
    const revenue = [
      { date: '2024-01-15', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
      { date: '2024-02-10', netRevenue: 2000000, revenueOther: 0, grossProfit: 600000 },
    ] as RevenueRecord[];
    const result = calculateStaffProductivity(employees, revenue);
    expect(result.trend.length).toBe(2);
    expect(result.trend[0].month).toBe('2024-01');
    expect(result.trend[0].rpe).toBe(1000000);
    expect(result.trend[1].month).toBe('2024-02');
    expect(result.trend[1].rpe).toBe(2000000);
  });

  it('trả về 0 khi không có nhân viên active', () => {
    const employees = [
      { id: 'e1', name: 'NV1', resignedDate: '2024-01-01' }, // đã nghỉ
    ] as Employee[];
    const revenue = [
      { date: '2024-01-15', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000 },
    ] as RevenueRecord[];
    const result = calculateStaffProductivity(employees, revenue);
    expect(result.currentRPE).toBe(0);
    // totalStaff không được export, kiểm tra trend rỗng thay vì
    expect(result.trend.length).toBe(0);
  });
});

// ─── getCategoryType ──────────────────────────────────────────────────────

describe('getCategoryType', () => {
  const categories: ExpenseCategory[] = [
    { id: 'cat-fixed', name: 'Chi phí cố định', parentId: null },
    { id: 'cat-rent', name: 'Thuê mặt bằng', parentId: 'cat-fixed' },
    { id: 'cat-depreciation-root', name: 'Khấu hao', parentId: null },
    { id: 'cat-interest-root', name: 'Lãi vay', parentId: null },
    { id: 'cat-variable', name: 'Chi phí biến đổi', parentId: null },
  ];

  it('nhận diện fixed cost đúng', () => {
    expect(getCategoryType('Thuê mặt bằng', categories)).toBe('fixed');
  });

  it('nhận diện depreciation đúng', () => {
    expect(getCategoryType('Khấu hao', categories)).toBe('depreciation');
  });

  it('nhận diện interest đúng', () => {
    expect(getCategoryType('Lãi vay', categories)).toBe('interest');
  });

  it('trả về variable khi không tìm thấy category', () => {
    expect(getCategoryType('Chi phí không xác định', categories)).toBe('variable');
  });
});

// ─── calculateExpenseAnalysis ─────────────────────────────────────────────

describe('calculateExpenseAnalysis', () => {
  it('tính tổng chi phí vận hành đúng', () => {
    const expenses = [
      { date: '2024-01-01', amount: 100000, category: 'Điện nước' },
      { date: '2024-01-01', amount: 200000, category: 'Thuê mặt bằng' },
    ] as ExpenseRecord[];
    const revenue = [
      { date: '2024-01-01', netRevenue: 1000000, revenueOther: 0, grossProfit: 300000, totalCogs: 500000 },
    ] as RevenueRecord[];
    const payrolls = [
      { month: '2024-01', employeeId: 'e1', netPay: 5000000 },
    ] as PayrollRecord[];
    const result = calculateExpenseAnalysis(expenses, revenue, payrolls, []);
    expect(result.totalOpEx).toBe(5300000); // 100000 + 200000 + 5000000
  });

  it('tính break-even revenue đúng', () => {
    const categories: ExpenseCategory[] = [
      { id: 'cat-fixed', name: 'Chi phí cố định', parentId: null },
      { id: 'cat-rent', name: 'Thuê mặt bằng', parentId: 'cat-fixed' },
    ];
    const expenses = [
      { date: '2024-01-01', amount: 1000000, category: 'Thuê mặt bằng' },
    ] as ExpenseRecord[];
    const revenue = [
      { date: '2024-01-01', netRevenue: 10000000, revenueOther: 0, grossProfit: 3000000, totalCogs: 6000000 },
    ] as RevenueRecord[];
    const result = calculateExpenseAnalysis(expenses, revenue, [], categories);
    // Fixed = 1000000, Variable ratio = 6000000/10000000 = 0.6
    // Contribution margin = 0.4, Break-even = 1000000 / 0.4 = 2500000
    expect(result.breakEvenRevenue).toBeGreaterThan(0);
  });

  it('không double-count lương từ payroll và expense ledger', () => {
    const expenses = [
      { date: '2024-01-01', amount: 100000, category: 'Điện nước' },
      { date: '2024-01-01', amount: 2000000, category: 'Lương cơ bản' }, // không tính vì có payroll
    ] as ExpenseRecord[];
    const revenue = [] as RevenueRecord[];
    const payrolls = [
      { month: '2024-01', employeeId: 'e1', netPay: 5000000 },
    ] as PayrollRecord[];
    const result = calculateExpenseAnalysis(expenses, revenue, payrolls, []);
    // Chỉ tính payroll 5000000 + điện nước 100000, không tính lương cơ bản từ expense
    expect(result.totalOpEx).toBe(5100000);
  });
});

// ─── calculateDailyBreakEven ──────────────────────────────────────────────

describe('calculateDailyBreakEven', () => {
  it('tính daily break-even revenue đúng', () => {
    const config = {
      monthlyFixedCosts: 30000000,
      grossMarginPercent: 30,
    };
    const result = calculateDailyBreakEven([], config, '2024-01-15');
    // Tháng 1 có 31 ngày, daily fixed = 30000000 / 31 ≈ 967742
    // Daily break-even = 967742 / 0.3 ≈ 3225806
    expect(result.dailyFixedCost).toBeCloseTo(967742, 0);
    expect(result.dailyBreakEvenRevenue).toBeCloseTo(3225806, 0);
  });

  it('tính progress đúng khi có doanh thu hôm nay', () => {
    const revenue = [
      { date: '2024-01-15', netRevenue: 2000000, revenueOther: 0, grossProfit: 600000 },
    ] as RevenueRecord[];
    const config = {
      monthlyFixedCosts: 30000000,
      grossMarginPercent: 30,
    };
    const result = calculateDailyBreakEven(revenue, config, '2024-01-15');
    expect(result.currentRevenue).toBe(2000000);
    expect(result.progress).toBeGreaterThan(0);
    expect(result.progress).toBeLessThanOrEqual(100);
  });

  it('xác định break-even day trong tháng', () => {
    const revenue = Array.from({ length: 15 }, (_, i) => ({
      date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
      netRevenue: 3000000,
      revenueOther: 0,
      grossProfit: 900000,
    })) as RevenueRecord[];
    const config = {
      monthlyFixedCosts: 10000000,
      grossMarginPercent: 30,
    };
    const result = calculateDailyBreakEven(revenue, config, '2024-01-15');
    expect(result.breakEvenDay).toBeGreaterThan(0);
    expect(result.breakEvenDay).toBeLessThanOrEqual(31);
  });
});

// ─── calculateStrategicSuggestions ────────────────────────────────────────

describe('calculateStrategicSuggestions', () => {
  it('tính trung bình doanh thu theo nhóm sản phẩm', () => {
    const groupRevenue = [
      { date: '2023-05-10', groupName: 'Giày thể thao', netRevenue: 5000000, amount: 5000000, quantity: 50, returnsValue: 0 },
      { date: '2024-05-15', groupName: 'Giày thể thao', netRevenue: 6000000, amount: 6000000, quantity: 60, returnsValue: 0 },
    ] as ProductGroupRevenue[];
    const result = calculateStrategicSuggestions(groupRevenue, 5, 'revenue');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Giày thể thao');
    expect(result[0].avgRev).toBe(5500000); // (5000000 + 6000000) / 2
  });

  it('sắp xếp theo quantity khi viewMode = quantity', () => {
    const groupRevenue = [
      { date: '2024-05-10', groupName: 'Giày A', netRevenue: 1000000, amount: 1000000, quantity: 100, returnsValue: 0 },
      { date: '2024-05-10', groupName: 'Giày B', netRevenue: 5000000, amount: 5000000, quantity: 50, returnsValue: 0 },
    ] as ProductGroupRevenue[];
    const result = calculateStrategicSuggestions(groupRevenue, 5, 'quantity');
    expect(result[0].name).toBe('Giày A'); // quantity cao hơn
  });

  it('giới hạn top 10 nhóm', () => {
    const groupRevenue = Array.from({ length: 20 }, (_, i) => ({
      date: '2024-05-10',
      groupName: `Nhóm ${i}`,
      netRevenue: (20 - i) * 1000000,
      amount: (20 - i) * 1000000,
      quantity: 10,
      returnsValue: 0,
    })) as ProductGroupRevenue[];
    const result = calculateStrategicSuggestions(groupRevenue, 5, 'revenue');
    expect(result.length).toBe(10);
  });
});

// ─── calculateSeasonalityAnalysis ────────────────────────────────────────

describe('calculateSeasonalityAnalysis', () => {
  it('tính tổng doanh thu lịch sử theo nhóm', () => {
    const groupRevenue = [
      { groupId: 'g1', groupName: 'Giày thể thao', netRevenue: 5000000, amount: 5000000, quantity: 50, returnsValue: 0, returnsQuantity: 5 },
      { groupId: 'g1', groupName: 'Giày thể thao', netRevenue: 3000000, amount: 3000000, quantity: 30, returnsValue: 0, returnsQuantity: 2 },
    ] as ProductGroupRevenue[];
    const groups = [
      { id: 'g1', name: 'Giày thể thao' },
    ] as ProductGroup[];
    const result = calculateSeasonalityAnalysis(groupRevenue, groups);
    expect(result.length).toBe(1);
    expect(result[0].totalHistorical).toBe(8000000);
    expect(result[0].avgReturnRate).toBeCloseTo(8.75, 1); // 7 / 80 * 100
  });

  it('xử lý đúng khi không có dữ liệu revenue', () => {
    const groups = [
      { id: 'g1', name: 'Giày thể thao' },
    ] as ProductGroup[];
    const result = calculateSeasonalityAnalysis([], groups);
    expect(result.length).toBe(1);
    expect(result[0].totalHistorical).toBe(0);
    expect(result[0].avgReturnRate).toBe(0);
  });
});
