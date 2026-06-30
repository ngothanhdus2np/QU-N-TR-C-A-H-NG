-- =====================================================
-- MIGRATION 020: Atomic Revenue Delta (DATA-02 fix)
-- Created: 2026-06-30
-- Priority: P1 - Financial integrity
-- =====================================================
--
-- Vấn đề: Web POS ghi doanh thu kiểu "đọc–sửa–ghi đè cả dòng" (read-modify-write)
-- phía client. 2 máy bán cùng ngày → đua nhau → last-write-wins → MẤT doanh thu.
--
-- Cách sửa: cộng dồn DELTA atomic phía DB qua INSERT ... ON CONFLICT (date) DO UPDATE
-- SET col = col + EXCLUDED.col (đúng pattern step 3 của pos_mobile_checkout đã chạy ổn
-- trên production). Phép cộng giao hoán → an toàn cả khi nhiều máy/đơn cùng ngày, và
-- cả khi replay từ offline queue (thứ tự không quan trọng).
--
-- LƯU Ý: ON CONFLICT (date) khớp constraint THẬT trên production: UNIQUE(date)
-- (uq_revenue_records_date — đã chạy 2026-06-20). KHÔNG dùng (date, branch_id) vì
-- production chưa có constraint đó (schema drift đã ghi nhận).
--
-- p_id: client truyền id để khi INSERT (ngày mới) row dùng đúng id client đang giữ local
--       → realtime echo khớp id, tránh nhân đôi dòng doanh thu sau resync.
-- =====================================================

CREATE OR REPLACE FUNCTION apply_revenue_delta(p_id UUID, p_date_key TEXT, p_delta JSONB)
RETURNS VOID AS $$
BEGIN
  INSERT INTO revenue_records (
    id, date, total_gross_revenue, discount, revenue_other,
    returns_value, net_revenue, total_cogs, gross_profit
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_date_key::DATE,
    COALESCE((p_delta->>'totalGrossRevenue')::NUMERIC, 0),
    COALESCE((p_delta->>'discount')::NUMERIC, 0),
    COALESCE((p_delta->>'revenueOther')::NUMERIC, 0),
    COALESCE((p_delta->>'returnsValue')::NUMERIC, 0),
    COALESCE((p_delta->>'netRevenue')::NUMERIC, 0),
    COALESCE((p_delta->>'totalCogs')::NUMERIC, 0),
    COALESCE((p_delta->>'grossProfit')::NUMERIC, 0)
  )
  ON CONFLICT (date) DO UPDATE SET
    total_gross_revenue = revenue_records.total_gross_revenue + EXCLUDED.total_gross_revenue,
    discount            = revenue_records.discount            + EXCLUDED.discount,
    revenue_other       = revenue_records.revenue_other       + EXCLUDED.revenue_other,
    returns_value       = revenue_records.returns_value       + EXCLUDED.returns_value,
    net_revenue         = revenue_records.net_revenue         + EXCLUDED.net_revenue,
    total_cogs          = revenue_records.total_cogs          + EXCLUDED.total_cogs,
    gross_profit        = revenue_records.gross_profit        + EXCLUDED.gross_profit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION apply_revenue_delta(UUID, TEXT, JSONB) TO authenticated;
ALTER FUNCTION apply_revenue_delta(UUID, TEXT, JSONB) SET search_path = public;

NOTIFY pgrst, 'reload schema';
