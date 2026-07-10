-- ============================================================
-- SHOPEE ADS DAILY SPEND (migration 032, 2026-07-09)
-- Bảng lưu tổng tiền quảng cáo Shopee Ads đã chi trong ngày, theo từng shop
-- (platform 'Shopee 1' / 'Shopee 2' — khớp cột `platform` đã dùng trong
-- shopee_inventory_out). Nguồn: bot shopee-monitor lấy từ API ví quảng cáo
-- Shopee (pas/v1/wallet/get), ghi tự động mỗi ~30 phút qua routes/adsSpendSync.ts.
--
-- Dùng để tự động phân bổ ads_cost cho các đơn "hiệu quả" trong ngày
-- (shopee_ads_fee > 0) — xem FORMULAS.md §10.2c.
-- ============================================================
CREATE TABLE IF NOT EXISTS shopee_ads_daily_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  platform TEXT NOT NULL,
  total_spend NUMERIC DEFAULT 0,
  effective_orders_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, platform)
);

CREATE INDEX IF NOT EXISTS idx_shopee_ads_daily_spend_date ON shopee_ads_daily_spend(date);
