/**
 * Công thức lợi nhuận đơn Shopee (bảng Xuất kho) — NGUỒN DUY NHẤT.
 *
 * Trước 2026-07-11 công thức này bị lặp ở 4 nơi (InventoryOutTab hiển thị,
 * routes/adsSpendSync job phân bổ QC, và 3 đường ghi trong useShopeeInventoryOut)
 * và 3 đường ghi frontend dùng bản CŨ thiếu PiShip/VAT/TNCN/Phí Ads Shopee,
 * không phân nhánh đơn hủy/hoàn → cột net_profit lưu trên Supabase lệch với
 * số hiển thị (audit 2026-07-11 mục A). Mọi nơi tính lợi nhuận đơn Shopee
 * PHẢI import từ đây — không chép lại công thức.
 *
 * Tài liệu nghiệp vụ: docs/business-knowledge/FORMULAS.md §10.2.
 */

export type ShopeeOrderKind = 'success' | 'shiploss' | 'void';

/**
 * Phân loại đơn theo status. Dữ liệu mới dùng mã (OK/SHIPPING/...), dữ liệu cũ
 * import từ Excel có thể còn status tiếng Việt thô — thứ tự kiểm tra quan trọng
 * ("hoàn thành trả hàng" phải ra shiploss trước khi khớp "hoàn tất" = success).
 */
export function shopeeOrderKind(status: string | undefined): ShopeeOrderKind {
  const x = (status || '').trim();
  if (x === 'OK' || x === 'SHIPPING') return 'success';
  if (x === 'FAILED' || x === 'RETURN' || x === 'RETURNED') return 'shiploss';
  if (x === 'CANCEL' || x === 'PENDING' || x === 'LOST') return 'void';
  if (/giao hàng thất bại|giao thất bại|hoàn hàng|đang hoàn|trả hàng/i.test(x)) return 'shiploss';
  if (/hủy|huỷ/i.test(x)) return 'void';
  if (/đã giao|đã nhận được hàng|đang giao|hoàn tất/i.test(x)) return 'success';
  return 'void'; // chờ xử lý / không rõ → không tính
}

/** Các khoản Shopee trừ thẳng trên đơn (đối soát) — đơn vị đồng, camelCase như app. */
export interface ShopeePlatformFees {
  salePrice: number;
  platformFee: number;
  paymentFee: number;
  freeshipExtra: number;
  affiliateFee: number;
  /** Phí bảo vệ người bán — bot có thể lưu số âm, luôn lấy trị tuyệt đối. */
  pishipFee: number;
  vatTax: number;
  personalIncomeTax: number;
  /** AMS_COMMISSION_FEE — bot có thể lưu số âm, luôn lấy trị tuyệt đối. */
  shopeeAdsFee: number;
}

/** Chi phí phía shop (ngoài đối soát Shopee) để ra lợi nhuận cuối. */
export interface ShopeeProfitCosts {
  /** Giá vốn ĐÃ nhân số lượng. */
  importPrice: number;
  adsCost: number;
  adsTax: number;
  handlingFee: number;
}

/**
 * Sàn Thanh Toán (số tiền Shopee thật trả về) — chỉ có ở đơn thành công, còn lại 0.
 * Khớp escrow_amount thật (xác minh 2026-07-08, thiếu shopeeAdsFee từng gây lệch
 * 12-15kđ trên 65-81% đơn).
 */
export function calcShopeePlatformNet(status: string | undefined, f: ShopeePlatformFees): number {
  if (shopeeOrderKind(status) !== 'success') return 0;
  return (
    (f.salePrice || 0) -
    (f.platformFee || 0) -
    Math.abs(f.pishipFee || 0) -
    (f.freeshipExtra || 0) -
    (f.paymentFee || 0) -
    (f.vatTax || 0) -
    (f.personalIncomeTax || 0) -
    (f.affiliateFee || 0) -
    Math.abs(f.shopeeAdsFee || 0)
  );
}

/**
 * Lợi nhuận theo loại đơn:
 *  • Thành công: Sàn Thanh Toán − Giá vốn×SL − QC − Thuế QC − Phí Vận Hành
 *  • Giao thất bại / Hoàn hàng: −(PiShip + Phí Vận Hành) — không trừ giá vốn, hàng về kho
 *  • Huỷ chưa giao / chờ xử lý / khác: 0
 */
export function calcShopeeNetProfit(
  status: string | undefined,
  f: ShopeePlatformFees,
  c: ShopeeProfitCosts
): number {
  const kind = shopeeOrderKind(status);
  if (kind === 'shiploss') return -(Math.abs(f.pishipFee || 0) + (c.handlingFee || 0));
  if (kind === 'void') return 0;
  return (
    calcShopeePlatformNet(status, f) -
    (c.importPrice || 0) -
    (c.adsCost || 0) -
    (c.adsTax || 0) -
    (c.handlingFee || 0)
  );
}
