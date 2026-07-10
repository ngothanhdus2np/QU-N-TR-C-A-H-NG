-- =============================================================================
-- 034 — Khoá anon cho 2 bảng Shopee Ads mới (audit 2026-07-10)
-- =============================================================================
-- Audit production-readiness 2026-07-10 phát hiện: migration 032/033 tạo 2 bảng
-- MỚI (shopee_ads_daily_spend, shopee_ads_wallet_transactions) mà KHÔNG kèm
-- ENABLE RLS / CREATE POLICY / REVOKE anon — đúng kịch bản "bom nổ chậm" mà
-- audit R3 (2026-07-03) đã cảnh báo: DEFAULT PRIVILEGES của grantor
-- supabase_admin có thể vẫn tự cấp anon full CRUD cho bảng tạo dưới role đó,
-- và migration 024 chạy dưới role postgres KHÔNG chắc gỡ được phần supabase_admin
-- (cần superuser). Vì 2 bảng này chứa dữ liệu tài chính (chi tiêu quảng cáo,
-- giao dịch ví) và anon key nhúng công khai trong bundle frontend, nếu chưa khoá
-- thì anon ĐỌC/GHI/XOÁ được qua /rest/v1 mà không cần đăng nhập.
--
-- Cách sửa: áp đúng pattern 024 (RLS là hàng rào THẬT, độc lập với grant) —
-- bật RLS + policy authenticated-all + REVOKE anon, cho từng bảng cụ thể.
-- Idempotent: DROP POLICY IF EXISTS trước khi CREATE, ENABLE RLS lặp lại vô hại.
--
-- SAU KHI CHẠY: verify bằng anon key thật trên prod (giống cách R3 verify 024):
--   curl 'https://supabase.phucsang.com.vn/rest/v1/shopee_ads_daily_spend?select=id&limit=1' \
--        -H 'apikey: <ANON>' -H 'Authorization: Bearer <ANON>'
--   → phải trả 401/42501 (hoặc []), KHÔNG được trả dữ liệu.
-- =============================================================================

-- shopee_ads_daily_spend --------------------------------------------------
ALTER TABLE public.shopee_ads_daily_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shopee_ads_daily_spend_authenticated" ON public.shopee_ads_daily_spend;
CREATE POLICY "shopee_ads_daily_spend_authenticated"
  ON public.shopee_ads_daily_spend
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.shopee_ads_daily_spend FROM anon;

-- shopee_ads_wallet_transactions ------------------------------------------
ALTER TABLE public.shopee_ads_wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shopee_ads_wallet_transactions_authenticated" ON public.shopee_ads_wallet_transactions;
CREATE POLICY "shopee_ads_wallet_transactions_authenticated"
  ON public.shopee_ads_wallet_transactions
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.shopee_ads_wallet_transactions FROM anon;
