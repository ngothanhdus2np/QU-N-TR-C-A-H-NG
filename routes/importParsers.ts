// Hàm thuần (pure) tách từ routes/import.ts để unit-test được logic parse Excel KiotViet.
// KHÔNG phụ thuộc Supabase, không phụ thuộc helper trong import.ts → test độc lập.
// Việc đổi ngày (excelDateToLocalIsoDateTime) và sinh UUID (productIdFromSku...) vẫn do
// handler thực hiện trên giá trị thô do các hàm này trả về.

export type SpreadsheetCell = string | number | boolean | Date | null;
export type SpreadsheetRow = SpreadsheetCell[];

const num = (v: SpreadsheetCell): number => Number(v || 0);
const str = (v: SpreadsheetCell): string => String(v ?? '').trim();

// ─────────────────────────────────────────────────────────────────────────────
// Format "Chi tiết hóa đơn" KiotViet (endpoint /api/import/kiotviet-revenue)
// Layout cột (0-indexed):
//   1=Mã HĐ, 6=Thời gian, 11=Mã đơn gốc (đơn trả mới có), 12=Mã KH, 13=Tên KH,
//   21=Người bán, 22=Kênh bán, 38=Tổng tiền hàng, 39=GG HĐ, 41=Khách cần trả,
//   42=Khách đã trả (số tiền khách đã thanh toán), 43=Tiền mặt, 44=Thẻ, 45=Ví, 46=CK,
//   50=Trạng thái, 52=Mã hàng, 53=Tên hàng, 57=SL, 58=Đơn giá, 60=Giảm giá dòng,
//   61=Giá bán, 62=Thành tiền
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedInvoiceItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export interface ParsedInvoiceRow {
  orderCode: string;
  status: string;
  rawDateTime: SpreadsheetCell; // handler tự đổi qua excelDateToLocalIsoDateTime
  isReturn: boolean;
  hasReturnLink: boolean; // col11 "Mã trả hàng" có giá trị → hóa đơn bán liên kết phiếu đổi/trả
  totalGross: number;
  discount: number;
  finalAmount: number;
  cashReceived: number; // col42 = "Khách đã trả"
  paymentMethod: 'Card' | 'Transfer' | 'Wallet' | 'Cash';
  staffName: string;
  channelRaw: string;
  channel: 'online' | 'direct';
  customerName: string;
  customerCode: string;
  item: ParsedInvoiceItem | null;
}

export const parseInvoiceDetailRow = (row: SpreadsheetRow): ParsedInvoiceRow => {
  const orderCode = str(row[1]);
  const card = num(row[44]);
  const wallet = num(row[45]);
  const transfer = num(row[46]);
  const channelRaw = str(row[22]);

  const sku = str(row[52]);
  const itemName = str(row[53]);
  const quantity = Math.abs(num(row[57]));
  const item: ParsedInvoiceItem | null =
    sku && itemName && quantity > 0
      ? {
          sku,
          name: itemName,
          quantity,
          price: Number(row[61] || row[58] || 0),
          discount: Math.abs(num(row[60])),
          total: Math.abs(num(row[62])),
        }
      : null;

  return {
    orderCode,
    status: str(row[50]),
    rawDateTime: row[6],
    // FIX B: đơn trả THỰC SỰ chỉ khi mã bắt đầu "TH". Có "Mã trả hàng" (col11) chỉ là
    // hóa đơn BÁN liên kết phiếu đổi/trả — KHÔNG phải đơn trả (xác nhận từ file import thật:
    // các đơn này có Khách cần/đã trả dương, là đơn bán; trước đây bị nhận nhầm thành đơn trả).
    isReturn: /^TH/i.test(orderCode),
    hasReturnLink: str(row[11]) !== '',
    totalGross: num(row[38]),
    discount: num(row[39]),
    finalAmount: num(row[41]),
    cashReceived: num(row[42]),
    paymentMethod: card > 0 ? 'Card' : transfer > 0 ? 'Transfer' : wallet > 0 ? 'Wallet' : 'Cash',
    staffName: str(row[21]),
    channelRaw,
    channel: channelRaw.toLowerCase().includes('online') ? 'online' : 'direct',
    customerName: str(row[13]),
    customerCode: str(row[12]),
    item,
  };
};

export interface DayAgg {
  totalGross: number; // doanh thu hàng hóa (không tính đơn trả)
  discount: number;
  returnsGross: number; // giá trị trả hàng (dương)
  netRev: number;
  cogs: number;
  profit: number;
}

export const emptyDayAgg = (): DayAgg => ({
  totalGross: 0,
  discount: 0,
  returnsGross: 0,
  netRev: 0,
  cogs: 0,
  profit: 0,
});

// Doanh thu thực thu của 1 đơn (dùng chung cho day-agg và khớp với calcOrderRevenue):
//   - Đơn trả thuần (mã "TH")            → âm theo giá trị hàng (-totalGross)
//   - Đơn ĐỔI/trả (có "Mã trả hàng" col11) → "Khách đã trả" (đã net phần hàng đổi)
//   - Đơn bán thường                      → "Khách cần trả" (ghi nhận ĐỦ, kể cả online/COD chưa thu)
export type OrderRevenueInput = Pick<ParsedInvoiceRow, 'isReturn' | 'hasReturnLink' | 'totalGross' | 'finalAmount' | 'cashReceived'>;
export const orderRevenue = (p: OrderRevenueInput): number =>
  p.isReturn ? -p.totalGross : p.hasReturnLink ? p.cashReceived : p.finalAmount;

// Cộng dồn 1 đơn (đã dedup) vào tổng theo ngày.
export const accumulateInvoiceDayAgg = (prev: DayAgg, p: Pick<ParsedInvoiceRow, 'isReturn' | 'hasReturnLink' | 'totalGross' | 'discount' | 'finalAmount' | 'cashReceived'>): DayAgg => {
  const rev = orderRevenue(p);
  return {
    totalGross: p.isReturn ? prev.totalGross : prev.totalGross + p.totalGross,
    discount: prev.discount + p.discount,
    returnsGross: p.isReturn ? prev.returnsGross + Math.abs(p.totalGross) : prev.returnsGross,
    netRev: prev.netRev + rev,
    cogs: prev.cogs,
    profit: prev.profit + rev,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Format "Danh sách chi tiết phiếu trả hàng" (endpoint /api/import/kiotviet-returns)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReturnColumns {
  iCode: number;
  iTime: number;
  iTotal: number;
  iFinal: number;
  iCashRefunded: number; // "Đã trả khách" — tiền mặt thực hoàn (cơ sở doanh thu đơn trả)
  iSku: number;
  iQty: number;
  iLineTotal: number;
  lineTotalIsUnitPrice: boolean; // true nếu cột giải quyết được là "Giá bán" (đơn giá) → phải nhân SL
  iInvoiceRef: number;
}

// Xác định vị trí cột từ header (KiotViet hay thêm/bớt cột).
export const resolveReturnColumns = (header: SpreadsheetRow): ReturnColumns => {
  const colMap = new Map<string, number>();
  header.forEach((cell, i) => {
    if (cell != null && String(cell).trim() !== '') colMap.set(String(cell).trim(), i);
  });
  const col = (name: string, fallback: number) => colMap.get(name) ?? fallback;

  // FIX iCode guard: dùng has() thay vì so sánh index === 1 (1 là index hợp lệ, không phải sentinel)
  const iCode = colMap.has('Mã phiếu trả')
    ? colMap.get('Mã phiếu trả')!
    : colMap.get('Mã trả hàng') ?? 1;

  // FIX #7: thành tiền dòng phải là "Thành tiền" (line total), KHÔNG phải "Giá bán" (đơn giá).
  // Chỉ khi file không có cột thành tiền mới fallback sang "Giá bán" và nhân số lượng.
  const lineTotalIdx = colMap.get('Thành tiền trả') ?? colMap.get('Thành tiền');
  const lineTotalIsUnitPrice = lineTotalIdx == null;
  const iLineTotal = lineTotalIdx ?? colMap.get('Giá bán') ?? 32;

  return {
    iCode,
    iTime: col('Thời gian', 6),
    // File TH dùng "Tổng tiền hàng trả"/"Cần trả khách", file HĐ dùng "Tổng tiền hàng"/"Khách cần trả"
    iTotal: colMap.get('Tổng tiền hàng trả') ?? col('Tổng tiền hàng', 13),
    iFinal: colMap.get('Cần trả khách') ?? col('Khách cần trả', 18),
    iCashRefunded: colMap.get('Đã trả khách') ?? 19,
    iSku: col('Mã hàng', 26),
    iQty: col('Số lượng', 31),
    iLineTotal,
    lineTotalIsUnitPrice,
    iInvoiceRef: col('Mã hóa đơn', 11),
  };
};

export interface ParsedReturnRow {
  returnCode: string;
  rawDateTime: SpreadsheetCell;
  totalAmount: number;    // Tổng tiền hàng trả (giá trị hàng) — cho tồn kho/đối chiếu
  finalAmount: number;    // Cần trả khách
  cashRefunded: number;   // |Đã trả khách| — tiền mặt thực hoàn (cơ sở doanh thu đơn trả)
  invoiceRef: string;
  sku: string;
  name: string;
  quantity: number;
  lineTotal: number;
}

export const parseReturnRow = (cols: ReturnColumns, row: SpreadsheetRow): ParsedReturnRow => {
  const quantity = Math.abs(num(row[cols.iQty]));
  let lineTotal = Math.abs(num(row[cols.iLineTotal]));
  // Nếu cột giải quyết là đơn giá → nhân số lượng để ra thành tiền dòng
  if (cols.lineTotalIsUnitPrice) lineTotal *= quantity;

  return {
    returnCode: str(row[cols.iCode]),
    rawDateTime: row[cols.iTime],
    totalAmount: Math.abs(num(row[cols.iTotal])),
    finalAmount: Math.abs(num(row[cols.iFinal])),
    cashRefunded: Math.abs(num(row[cols.iCashRefunded])),
    invoiceRef: str(row[cols.iInvoiceRef]),
    sku: str(row[cols.iSku]),
    name: str(row[cols.iSku + 1]),
    quantity,
    lineTotal,
  };
};
