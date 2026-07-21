// Nguồn DUY NHẤT cho thao tác "tìm giá nhập gần nhất trước ngày bán" theo SKU
// từ bảng product_cost_history. Trước đây logic này bị chép y hệt ở 2 route trong
// routes/data.ts (recalculate-cogs + financial-matrix) — gộp về đây để tránh lệch
// công thức (cùng loại rủi ro mà src/lib/shopeeProfit.ts từng ra đời để diệt).
//
// LƯU Ý ngữ nghĩa (khác getHistoricalCost trong reportCalculations.ts):
//   - key theo SKU (không phải productId)
//   - LỌC entry có price > 0 (bỏ qua bản ghi giá 0), duyệt TOÀN BỘ (không break)
//   - trả 0 khi không có bản ghi hợp lệ (không có fallback param)

export interface CostHistoryEntry {
  date: string;
  price: number;
}

// Bản ghi thô từ product_cost_history (Supabase) — chỉ cần 3 cột.
interface CostHistoryRow {
  sku?: unknown;
  import_price?: unknown;
  effective_date?: unknown;
}

// Build Map<sku, [{date, price}]> từ các dòng product_cost_history.
// Kỳ vọng rows đã order theo effective_date tăng dần (giữ đúng thứ tự query gốc).
export function buildCostHistoryBySku(
  rows: CostHistoryRow[] | null | undefined
): Map<string, CostHistoryEntry[]> {
  const historyBySku = new Map<string, CostHistoryEntry[]>();
  for (const h of rows || []) {
    const sku = String(h.sku || '').trim();
    if (!sku) continue;
    if (!historyBySku.has(sku)) historyBySku.set(sku, []);
    historyBySku.get(sku)!.push({
      date: String(h.effective_date || ''),
      price: Number(h.import_price || 0),
    });
  }
  return historyBySku;
}

// Tìm giá nhập gần nhất (<= orderDate) có giá > 0 cho 1 SKU. Trả 0 nếu không có.
export function findHistoricalCostBySku(
  historyBySku: Map<string, CostHistoryEntry[]>,
  sku: string,
  orderDate: string
): number {
  const entries = historyBySku.get(sku);
  if (!entries?.length) return 0;
  let best = 0;
  for (const e of entries) {
    if (e.date <= orderDate && e.price > 0) best = e.price;
  }
  return best;
}
