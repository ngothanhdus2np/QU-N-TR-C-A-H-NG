import { describe, it, expect } from 'vitest';
import {
  lastDayOfMonth,
  parseKiotVietDateOrMonth,
  parseRevenueByTimeRows,
  type SpreadsheetRow,
} from './kiotvietRevenueParser';

describe('lastDayOfMonth', () => {
  it('trả ngày cuối tháng đúng', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28'); // 2026 không nhuận
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29'); // nhuận
    expect(lastDayOfMonth('2026-05')).toBe('2026-05-31');
    expect(lastDayOfMonth('2026-04')).toBe('2026-04-30');
  });
});

describe('parseKiotVietDateOrMonth', () => {
  it('parse ngày đầy đủ dd/mm/yyyy', () => {
    expect(parseKiotVietDateOrMonth('31/05/2024')).toBe('2024-05-31');
  });

  it('parse tháng MM-YYYY và MM/YYYY → ngày cuối tháng', () => {
    expect(parseKiotVietDateOrMonth('05-2026')).toBe('2026-05-31');
    expect(parseKiotVietDateOrMonth('02/2024')).toBe('2024-02-29');
  });

  it('rỗng/null/không hợp lệ → chuỗi rỗng', () => {
    expect(parseKiotVietDateOrMonth(null)).toBe('');
    expect(parseKiotVietDateOrMonth('')).toBe('');
    expect(parseKiotVietDateOrMonth('không phải ngày')).toBe('');
    expect(parseKiotVietDateOrMonth('13/2026')).toBe(''); // tháng 13 không hợp lệ
  });
});

describe('parseRevenueByTimeRows', () => {
  // cột: [0]=ngày, [2]=gross, [3]=discount(âm), [6]=returns, [7]=net
  const row = (date: string, gross: number, discount: number, returns: number, net: number): SpreadsheetRow =>
    [date, null, gross, discount, null, null, returns, net];

  it('tính đúng gross/discount/returns/net cho 1 ngày', () => {
    const out = parseRevenueByTimeRows([row('31/05/2024', 1000, -50, 200, 750)]);
    expect(out).toEqual([
      { date: '2024-05-31', agg: { totalGross: 1000, discount: -50, returnsGross: 200, netRev: 750, cogs: 0, profit: 750 } },
    ]);
  });

  it('gross và returns luôn dương (Math.abs) dù dữ liệu âm', () => {
    const out = parseRevenueByTimeRows([row('01/06/2024', -1000, -50, -200, 750)]);
    expect(out[0].agg.totalGross).toBe(1000);
    expect(out[0].agg.returnsGross).toBe(200);
  });

  it('dedup theo ngày — giữ dòng ĐẦU cho mỗi ngày', () => {
    const out = parseRevenueByTimeRows([
      row('31/05/2024', 1000, 0, 0, 1000),
      row('31/05/2024', 9999, 0, 0, 9999), // trùng ngày → bỏ
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].agg.totalGross).toBe(1000);
  });

  it('bỏ qua dòng thiếu ngày hoặc ngày không parse được', () => {
    const out = parseRevenueByTimeRows([
      [null, null, 500, 0, null, null, 0, 500],
      row('rác', 500, 0, 0, 500),
      row('01/07/2024', 300, 0, 0, 300),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2024-07-01');
  });
});
