-- =============================================================================
-- 023 — Fix 🟡-6 (audit 2026-07-02): đóng lỗ anon truy cập bảng storefront/misc
-- =============================================================================
-- Audit phát hiện các bảng sau RLS TẮT + role `anon` còn full grant → ai có anon
-- key (nhúng sẵn trong bundle frontend) có thể đọc/ghi thẳng /rest/v1/<bảng>.
-- Các bảng này CHỈ được truy cập qua endpoint service-role (store.ts công khai +
-- adminStore.ts) — service role BYPASS RLS nên REVOKE anon + bật RLS KHÔNG phá
-- luồng nào. App POS cũng KHÔNG đọc trực tiếp các bảng này qua anon rest (đã kiểm).
--
-- Đồng thời gốc rễ "bảng mới tự nhận grant anon" (MAINT-01): mỗi bảng mới nên có
-- bước REVOKE anon như dưới đây ở cuối migration tạo bảng.
-- =============================================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'expense_categories',
    'shipments',
    'store_collections',
    'store_order_addresses',
    'store_preorder_requests',
    'store_product_collections',
    'store_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Chỉ xử lý bảng thực sự tồn tại (tránh lỗi trên môi trường thiếu bảng storefront)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- 1) Gỡ quyền anon (đóng lỗ dùng anon key công khai)
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      -- 2) Bật RLS (defense-in-depth: nếu sau này lỡ cấp lại anon, vẫn bị RLS chặn)
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- 3) Policy cho authenticated (app đăng nhập đọc/ghi bằng JWT = role authenticated);
      --    service role bypass RLS nên storefront công khai không ảnh hưởng.
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_all', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t || '_authenticated_all', t
      );
    END IF;
  END LOOP;
END $$;
