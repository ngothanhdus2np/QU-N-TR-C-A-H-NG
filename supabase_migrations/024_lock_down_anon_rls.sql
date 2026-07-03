-- =============================================================================
-- 024 — Fix SEC-RLS-01 (audit 2026-07-03): khoá lỗ hổng anon đọc/ghi bảng nội bộ
-- =============================================================================
-- Audit phát hiện: anon key (nhúng công khai trong bundle frontend, truy cập qua
-- proxy mở /rest/v1) ĐỌC+GHI+XÓA được THẬT trên pos_products/pos_orders/
-- sales_records/suppliers/vat_documents/attendance_records... Ba tầng cùng thủng:
--   1. DEFAULT PRIVILEGES tự cấp anon full CRUD cho MỌI bảng mới (gốc rễ MAINT-01).
--   2. RLS policy `TO anon`/`TO public USING(true)` trên loạt bảng nhạy cảm →
--      RLS "bật" nhưng vô nghĩa vì policy cho phép anon.
--   3. Proxy /rest/v1 forward thẳng anon key, không rate-limit (xử lý riêng ở code).
--
-- Cách sửa (gốc rễ, không whack-a-mole):
--   A. Với mọi bảng NỘI BỘ có policy mở cho anon/public → DROP policy đó, thay bằng
--      1 policy `FOR ALL TO authenticated` (RLS thành hàng rào THẬT, độc lập grant).
--      Khớp mô hình app: phân quyền thật nằm ở backend (requireAuth + role), RLS chỉ
--      cần "đăng nhập rồi thì được truy cập". Đây cũng là mẫu migration 023 đã dùng.
--   B. REVOKE ALL FROM anon trên các bảng đó (phòng thủ nhiều lớp).
--   C. Sửa DEFAULT PRIVILEGES: bảng/sequence MỚI không tự cấp anon nữa.
--
-- NGOẠI LỆ CÓ CHỦ ĐÍCH (KHÔNG khoá): store_products, store_product_variants giữ
-- policy `public_read` (chỉ SELECT sản phẩm is_published) — catalog công khai cho
-- website phucsang.com.vn. Storefront ghi/đọc qua backend service-role (bypass RLS)
-- nên không phụ thuộc anon rest; app nội bộ đăng nhập → role authenticated.
--
-- An toàn: LoginPage KHÔNG đọc bảng nào pre-auth (đã kiểm) → khoá anon không vỡ
-- trang đăng nhập. Sau đăng nhập, supabase-js gắn JWT authenticated → qua policy mới.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A + B: Khoá các bảng nội bộ có policy mở cho anon/public
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  excluded TEXT[] := ARRAY['store_products', 'store_product_variants'];
  affected TEXT[];
  pol RECORD;
  tbl TEXT;
BEGIN
  -- Thu thập bảng nội bộ đang có policy dính anon hoặc public
  SELECT array_agg(DISTINCT tablename) INTO affected
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%')
    AND NOT (tablename = ANY(excluded));

  IF affected IS NULL THEN
    RAISE NOTICE '[024] Không có policy anon/public nào cần khoá (đã sạch).';
    RETURN;
  END IF;

  RAISE NOTICE '[024] Khoá % bảng: %', array_length(affected, 1), affected;

  -- 1) Drop MỌI policy dính anon/public trên các bảng đó (giữ nguyên policy
  --    authenticated-only nếu đã có — không match filter nên không bị drop)
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(affected)
      AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;

  -- 2) Mỗi bảng: bật RLS + tạo policy authenticated-all (idempotent) + REVOKE anon
  FOREACH tbl IN ARRAY affected LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_authenticated_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl || '_authenticated_all', tbl
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- C: Sửa DEFAULT PRIVILEGES — bảng/sequence MỚI không tự cấp anon nữa.
--    Áp cho cả 2 grantor xuất hiện trong pg_default_acl (postgres + supabase_admin).
--    Bọc exception phòng trường hợp thiếu quyền ALTER cho role kia (không chặn migration).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Grantor: postgres (role đang chạy migration)
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  RAISE NOTICE '[024] Đã gỡ default privileges anon cho grantor postgres.';
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  RAISE NOTICE '[024] Bỏ qua default privileges (postgres): %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Grantor: supabase_admin (Supabase tạo bảng thường dưới role này)
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  RAISE NOTICE '[024] Đã gỡ default privileges anon cho grantor supabase_admin.';
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  RAISE NOTICE '[024] Bỏ qua default privileges (supabase_admin): %', SQLERRM;
END $$;
