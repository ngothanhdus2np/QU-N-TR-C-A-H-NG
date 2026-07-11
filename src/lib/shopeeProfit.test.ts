import { describe, expect, it } from 'vitest';
import {
  shopeeOrderKind,
  calcShopeePlatformNet,
  calcShopeeNetProfit,
  type ShopeePlatformFees,
} from './shopeeProfit';

// Fixture theo đơn THẬT đã xác minh khớp escrow Shopee tuyệt đối (HISTORY R45,
// 2026-07-08): 329.000 − 50.995 − 2.700 − 21.095 − 19.740 − 11.086 − 3.290 − 1.645
// = 218.449đ = escrow thật.
const realOrderFees: ShopeePlatformFees = {
  salePrice: 329000,
  platformFee: 50995,        // Phí cố định (commission)
  freeshipExtra: 21095,      // Phí Dịch Vụ (service)
  paymentFee: 19740,         // Phí xử lý giao dịch
  pishipFee: 2700,           // Phí bảo vệ người bán
  shopeeAdsFee: 11086,       // AMS_COMMISSION_FEE
  vatTax: 3290,
  personalIncomeTax: 1645,
  affiliateFee: 0,
};

const zeroFees: ShopeePlatformFees = {
  salePrice: 0, platformFee: 0, paymentFee: 0, freeshipExtra: 0,
  affiliateFee: 0, pishipFee: 0, vatTax: 0, personalIncomeTax: 0, shopeeAdsFee: 0,
};

describe('shopeeOrderKind', () => {
  it('phân loại mã status mới', () => {
    expect(shopeeOrderKind('OK')).toBe('success');
    expect(shopeeOrderKind('SHIPPING')).toBe('success');
    expect(shopeeOrderKind('FAILED')).toBe('shiploss');
    expect(shopeeOrderKind('RETURN')).toBe('shiploss');
    expect(shopeeOrderKind('RETURNED')).toBe('shiploss');
    expect(shopeeOrderKind('CANCEL')).toBe('void');
    expect(shopeeOrderKind('PENDING')).toBe('void');
    expect(shopeeOrderKind('LOST')).toBe('void');
  });

  it('phân loại status tiếng Việt thô (dữ liệu Excel cũ) — thứ tự kiểm tra quan trọng', () => {
    expect(shopeeOrderKind('Giao hàng thất bại')).toBe('shiploss');
    expect(shopeeOrderKind('Hoàn thành - trả hàng')).toBe('shiploss'); // "trả hàng" thắng "hoàn tất"
    expect(shopeeOrderKind('Đã hủy')).toBe('void');
    expect(shopeeOrderKind('Đã giao')).toBe('success');
    expect(shopeeOrderKind('Hoàn tất')).toBe('success');
  });

  it('status rỗng / không rõ → void (không tính lãi lỗ)', () => {
    expect(shopeeOrderKind(undefined)).toBe('void');
    expect(shopeeOrderKind('')).toBe('void');
    expect(shopeeOrderKind('status lạ')).toBe('void');
  });
});

describe('calcShopeePlatformNet', () => {
  it('đơn thành công: khớp escrow thật của đơn đã xác minh (218.449đ)', () => {
    expect(calcShopeePlatformNet('OK', realOrderFees)).toBe(218449);
  });

  it('bot lưu PiShip/Ads Shopee số ÂM → lấy trị tuyệt đối, kết quả không đổi', () => {
    const negativeStored = { ...realOrderFees, pishipFee: -2700, shopeeAdsFee: -11086 };
    expect(calcShopeePlatformNet('OK', negativeStored)).toBe(218449);
  });

  it('đơn không thành công → 0', () => {
    expect(calcShopeePlatformNet('CANCEL', realOrderFees)).toBe(0);
    expect(calcShopeePlatformNet('RETURN', realOrderFees)).toBe(0);
  });
});

describe('calcShopeeNetProfit', () => {
  const costs = { importPrice: 150000, adsCost: 10000, adsTax: 800, handlingFee: 2000 };

  it('đơn thành công: Sàn TT − giá vốn − QC − thuế QC − vận hành', () => {
    expect(calcShopeeNetProfit('OK', realOrderFees, costs)).toBe(218449 - 150000 - 10000 - 800 - 2000);
  });

  it('giao thất bại / hoàn hàng: −(PiShip + vận hành), KHÔNG trừ giá vốn (hàng về kho)', () => {
    expect(calcShopeeNetProfit('FAILED', realOrderFees, costs)).toBe(-(2700 + 2000));
    expect(calcShopeeNetProfit('RETURN', { ...realOrderFees, pishipFee: -2700 }, costs)).toBe(-(2700 + 2000));
  });

  it('đơn hủy / chờ xử lý → 0 (kể cả khi có phí trong record)', () => {
    expect(calcShopeeNetProfit('CANCEL', realOrderFees, costs)).toBe(0);
    expect(calcShopeeNetProfit('PENDING', realOrderFees, costs)).toBe(0);
  });

  it('đơn nhập tay không phí đối soát: chỉ trừ giá vốn/QC/vận hành', () => {
    const fees = { ...zeroFees, salePrice: 200000 };
    expect(calcShopeeNetProfit('OK', fees, { importPrice: 120000, adsCost: 0, adsTax: 0, handlingFee: 3000 }))
      .toBe(200000 - 120000 - 3000);
  });
});
