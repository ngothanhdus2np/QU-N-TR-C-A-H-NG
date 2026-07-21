// Parser THUẦN cho import doanh thu KiotViet — tách khỏi handler
// /api/import/kiotviet-revenue (routes/import.ts, GĐ5 audit) để test được độc lập.
// Chỉ chứa logic parse/tính không phụ thuộc Supabase/Express.

import { parseVNDate } from '../src/lib';

export type SpreadsheetCell = string | number | boolean | Date | null;
export type SpreadsheetRow = SpreadsheetCell[];

// Tổng hợp doanh thu 1 ngày cho revenue_records (khớp shape dùng trong import.ts).
export interface RevenueDayAgg {
  totalGross: number;   // doanh thu hàng hóa (không tính đơn trả)
  discount: number;     // âm theo quy ước KiotViet
  returnsGross: number; // giá trị trả hàng (dương)
  netRev: number;
  cogs: number;
  profit: number;
}

// Ngày cuối tháng cho chuỗi "YYYY-MM" → "YYYY-MM-DD".
export const lastDayOfMonth = (yearMonth: string): string => {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${yearMonth}-${d.toString().padStart(2, '0')}`;
};

// Parse ô ngày của báo cáo "theo thời gian": nhận cả ngày đầy đủ ("31/05/2024")
// lẫn tháng ("05-2026" / "05/2026" → quy về ngày cuối tháng). Trả '' nếu không parse được.
export const parseKiotVietDateOrMonth = (raw: unknown): string => {
  if (!raw) return '';
  const s = String(raw).trim();
  const d = parseVNDate(s); // thử ngày đầy đủ trước
  if (d) return d;
  const m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) {
    const month = parseInt(m[1]), year = parseInt(m[2]);
    if (month >= 1 && month <= 12 && year > 1900) {
      const lastDay = new Date(year, month, 0).getDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }
  return '';
};

// Parse toàn bộ dòng dữ liệu (đã bỏ header) của format "Báo cáo bán hàng theo thời gian".
// Dedup theo ngày (giữ dòng ĐẦU cho mỗi ngày — khớp hành vi gốc dùng Set seenDates).
// Trả mảng {date, agg} để handler set vào dateMap. Thuần, không side-effect.
export function parseRevenueByTimeRows(dataRows: SpreadsheetRow[]): Array<{ date: string; agg: RevenueDayAgg }> {
  const seenDates = new Set<string>();
  const out: Array<{ date: string; agg: RevenueDayAgg }> = [];
  for (const row of dataRows) {
    if (!row[0]) continue;
    const date = parseKiotVietDateOrMonth(row[0]);
    if (!date || seenDates.has(date)) continue;
    seenDates.add(date);
    const gross = Math.abs(Number(row[2] || 0));
    const discount = Number(row[3] || 0); // âm theo KiotViet
    const returns = Math.abs(Number(row[6] || 0));
    const net = Number(row[7] || 0);
    out.push({
      date,
      agg: { totalGross: gross, discount, returnsGross: returns, netRev: net, cogs: 0, profit: net },
    });
  }
  return out;
}
