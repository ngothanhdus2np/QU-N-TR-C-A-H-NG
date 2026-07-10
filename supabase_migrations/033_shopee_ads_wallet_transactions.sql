-- ============================================================
-- SHOPEE ADS WALLET TRANSACTIONS (migration 033, 2026-07-09)
-- Lưu từng giao dịch gốc của Ví Quảng cáo Shopee (nạp tiền / trừ tiền), lấy từ
-- API pas/v1/transaction_history/get — xem routes/adsSpendSync.ts.
--
-- Bot chạy mỗi 30 phút, mỗi lần lấy được lô giao dịch gần nhất Shopee trả về
-- (không có tham số phân trang xác nhận được — xem ghi chú TODO ADS-PAGINATION
-- trong backfill-ads-spend.js). Nhờ upsert theo (platform, transaction_id) nên
-- giao dịch đã lưu sẽ không bị ghi trùng — theo thời gian bảng này tự tích lũy
-- thành lịch sử khá đầy đủ, dù KHÔNG backfill ngược được các giao dịch xảy ra
-- trước khi tính năng này được bật.
--
-- Dùng để phân tích sau này (tổng nạp/chi theo tuần/tháng, theo loại hình
-- quảng cáo...) — KHÔNG dùng trực tiếp cho việc tự động phân bổ ads_cost (xem
-- bảng shopee_ads_daily_spend, migration 032, cho mục đích đó).
-- ============================================================
CREATE TABLE IF NOT EXISTS shopee_ads_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  tx_date TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  transaction_group TEXT,
  transaction_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_shopee_ads_wallet_tx_date ON shopee_ads_wallet_transactions(tx_date);
