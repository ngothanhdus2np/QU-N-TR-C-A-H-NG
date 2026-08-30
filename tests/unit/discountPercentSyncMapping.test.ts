import { describe, expect, it } from 'vitest';
import { sanitizeItem, POS_PRODUCT_BOOTSTRAP_COLUMNS } from '../../services/apiService';
import { dataMapper } from '../../services/dataMapper';
import type { POSProduct } from '../../types';

/**
 * Hồi quy cho DISCOUNT-PERCENT-0829.
 *
 * Từ commit c383992 (26/06/2026) đến 30/08/2026, hai dòng trong apiService.ts bị comment
 * kèm ghi chú "TODO: enable after running SQL migration":
 *   - discount_percent trong sanitizeItem            → giá trị KHÔNG BAO GIỜ được ghi
 *   - discount_percent trong danh sách cột bootstrap → KHÔNG BAO GIỜ được đọc về
 * Người dùng đặt giảm giá % ở Thiết lập giá, UI hiện đúng nhờ cache lạc quan, rồi mất
 * trắng khi tải lại trang — không hề báo lỗi. Test này khoá cả 3 mắt xích lại để
 * không ai vô tình comment lại lần nữa.
 */
describe('discount percent sync mapping (DISCOUNT-PERCENT-0829)', () => {
  it('ghi discountPercent xuống đúng tên cột Supabase', () => {
    const product = {
      id: 'product-1',
      name: 'Dép quai ngang',
      discountPercent: 15,
    } as POSProduct;

    expect(sanitizeItem('posProducts', product)).toEqual(
      expect.objectContaining({ discount_percent: 15 })
    );
  });

  it('ghi 0 khi không đặt giảm giá, không bỏ sót field khỏi payload', () => {
    const product = { id: 'product-2', name: 'Không giảm giá' } as POSProduct;
    const payload = sanitizeItem('posProducts', product) as Record<string, unknown>;

    // Phải CÓ MẶT trong payload (giá trị 0), không được vắng mặt — vắng mặt nghĩa là
    // cột không bao giờ bị ghi đè khi người dùng gỡ giảm giá về 0.
    expect(payload).toHaveProperty('discount_percent');
    expect(payload.discount_percent).toBe(0);
  });

  it('đọc discount_percent từ dòng Supabase trả về', () => {
    const mapped = dataMapper.mapAllData(
      {
        posProducts: [
          { id: 'product-1', name: 'Dép quai ngang', discount_percent: 15 },
          { id: 'product-2', name: 'Không giảm giá', discount_percent: 0 },
        ],
      },
      null
    );

    expect(mapped.posProducts?.[0]).toEqual(expect.objectContaining({ discountPercent: 15 }));
    expect(mapped.posProducts?.[1]).toEqual(expect.objectContaining({ discountPercent: 0 }));
  });

  it('discount_percent nằm trong danh sách cột bootstrap', () => {
    // Đây chính là mắt xích từng đứt: kể cả khi cột có dữ liệu thật trên DB, nếu tên cột
    // không nằm trong danh sách select thì PostgREST không trả về, và dataMapper luôn
    // đọc ra undefined → 0.
    expect(POS_PRODUCT_BOOTSTRAP_COLUMNS).toContain('discount_percent');
  });
});
