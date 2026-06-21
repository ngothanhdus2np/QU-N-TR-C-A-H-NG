-- Migration 019: Channel management columns for shopee_shops
-- Thêm cột quản lý bot + kênh bán

ALTER TABLE shopee_shops
  ADD COLUMN IF NOT EXISTS port          INTEGER,
  ADD COLUMN IF NOT EXISTS shop_url      TEXT,
  ADD COLUMN IF NOT EXISTS profile_dir   TEXT,
  ADD COLUMN IF NOT EXISTS bot_status    TEXT DEFAULT 'stopped',
  ADD COLUMN IF NOT EXISTS last_sync_at  TIMESTAMPTZ;

-- Cập nhật 2 shop đã có sẵn
UPDATE shopee_shops SET port = 3001, profile_dir = 'shopee-profile-shop1' WHERE slug = 'phuc-sang-store';
UPDATE shopee_shops SET port = 3002, profile_dir = 'shopee-profile-shop2' WHERE slug = 'giaydepphucsang';
