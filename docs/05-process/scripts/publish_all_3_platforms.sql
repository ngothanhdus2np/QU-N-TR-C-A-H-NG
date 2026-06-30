-- ============================================================
-- Script: Bật tất cả sản phẩm có SKU kết nối cả 3 nền tảng
-- Điều kiện: SKU phải xuất hiện trong store_product_variants
--            VÀ shopee_product_variants của cả 2 shopee_shops
-- Tác động: is_published = TRUE cho store_products, shopee_products,
--           store_product_variants, shopee_product_variants
-- Chạy trên: Supabase Dashboard > SQL Editor
-- ============================================================

DO $$
DECLARE
  v_shop1_id UUID;
  v_shop2_id UUID;
  v_count_skus INT;
  v_count_store_products INT;
  v_count_store_variants INT;
  v_count_shopee_products INT;
  v_count_shopee_variants INT;
BEGIN
  -- Lấy ID 2 shop Shopee theo display_order
  SELECT id INTO v_shop1_id FROM shopee_shops ORDER BY display_order ASC  LIMIT 1;
  SELECT id INTO v_shop2_id FROM shopee_shops ORDER BY display_order ASC  OFFSET 1 LIMIT 1;

  IF v_shop1_id IS NULL OR v_shop2_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đủ 2 shopee_shops. Kiểm tra lại bảng shopee_shops.';
  END IF;

  RAISE NOTICE 'Shop 1: %', v_shop1_id;
  RAISE NOTICE 'Shop 2: %', v_shop2_id;

  -- --------------------------------------------------------
  -- Bước 0: Đếm SKU đủ điều kiện để xác nhận trước khi chạy
  -- --------------------------------------------------------
  SELECT COUNT(DISTINCT w.sku) INTO v_count_skus
  FROM store_product_variants w
  WHERE EXISTS (
    SELECT 1
    FROM shopee_product_variants spv1
    JOIN shopee_products sp1 ON sp1.id = spv1.shopee_product_id
    WHERE spv1.sku = w.sku
      AND sp1.shop_id = v_shop1_id
      AND sp1.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM shopee_product_variants spv2
    JOIN shopee_products sp2 ON sp2.id = spv2.shopee_product_id
    WHERE spv2.sku = w.sku
      AND sp2.shop_id = v_shop2_id
      AND sp2.deleted_at IS NULL
  );

  RAISE NOTICE 'Số SKU đủ điều kiện (kết nối cả 3 nền tảng): %', v_count_skus;

  IF v_count_skus = 0 THEN
    RAISE NOTICE 'Không có SKU nào đủ điều kiện. Script kết thúc sớm.';
    RETURN;
  END IF;

  -- --------------------------------------------------------
  -- Bước 1: Bật store_product_variants
  -- --------------------------------------------------------
  UPDATE store_product_variants w
  SET    is_published = TRUE
  WHERE  is_published = FALSE
    AND EXISTS (
      SELECT 1
      FROM shopee_product_variants spv1
      JOIN shopee_products sp1 ON sp1.id = spv1.shopee_product_id
      WHERE spv1.sku = w.sku AND sp1.shop_id = v_shop1_id AND sp1.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM shopee_product_variants spv2
      JOIN shopee_products sp2 ON sp2.id = spv2.shopee_product_id
      WHERE spv2.sku = w.sku AND sp2.shop_id = v_shop2_id AND sp2.deleted_at IS NULL
    );

  GET DIAGNOSTICS v_count_store_variants = ROW_COUNT;
  RAISE NOTICE 'store_product_variants đã bật: %', v_count_store_variants;

  -- --------------------------------------------------------
  -- Bước 2: Bật store_products cha (nếu có ít nhất 1 variant vừa đủ điều kiện)
  -- --------------------------------------------------------
  UPDATE store_products sp
  SET    is_published = TRUE,
         updated_at   = NOW()
  WHERE  is_published = FALSE
    AND  deleted_at   IS NULL
    AND EXISTS (
      SELECT 1
      FROM store_product_variants spv_w
      JOIN shopee_product_variants spv1
        ON spv1.sku = spv_w.sku
      JOIN shopee_products sh1
        ON sh1.id = spv1.shopee_product_id
       AND sh1.shop_id = v_shop1_id
       AND sh1.deleted_at IS NULL
      JOIN shopee_product_variants spv2
        ON spv2.sku = spv_w.sku
      JOIN shopee_products sh2
        ON sh2.id = spv2.shopee_product_id
       AND sh2.shop_id = v_shop2_id
       AND sh2.deleted_at IS NULL
      WHERE spv_w.store_product_id = sp.id
    );

  GET DIAGNOSTICS v_count_store_products = ROW_COUNT;
  RAISE NOTICE 'store_products đã bật: %', v_count_store_products;

  -- --------------------------------------------------------
  -- Bước 3: Bật shopee_product_variants
  -- --------------------------------------------------------
  UPDATE shopee_product_variants spv
  SET    is_published = TRUE
  WHERE  is_published = FALSE
    AND EXISTS (
      SELECT 1 FROM store_product_variants w WHERE w.sku = spv.sku
    )
    AND EXISTS (
      -- SKU này cũng phải có ở shop kia
      SELECT 1
      FROM shopee_product_variants spv_other
      JOIN shopee_products sp_other ON sp_other.id = spv_other.shopee_product_id
      JOIN shopee_products sp_self  ON sp_self.id  = spv.shopee_product_id
      WHERE spv_other.sku = spv.sku
        AND sp_other.shop_id  != sp_self.shop_id
        AND sp_other.deleted_at IS NULL
    );

  GET DIAGNOSTICS v_count_shopee_variants = ROW_COUNT;
  RAISE NOTICE 'shopee_product_variants đã bật: %', v_count_shopee_variants;

  -- --------------------------------------------------------
  -- Bước 4: Bật shopee_products cha
  -- --------------------------------------------------------
  UPDATE shopee_products sp
  SET    is_published = TRUE,
         updated_at   = NOW()
  WHERE  is_published = FALSE
    AND  deleted_at   IS NULL
    AND EXISTS (
      SELECT 1
      FROM shopee_product_variants spv_sh
      JOIN store_product_variants w ON w.sku = spv_sh.sku
      WHERE spv_sh.shopee_product_id = sp.id
    )
    AND EXISTS (
      -- Phải có variant trùng SKU ở shop Shopee còn lại
      SELECT 1
      FROM shopee_product_variants spv_sh
      JOIN shopee_product_variants spv_other
        ON spv_other.sku = spv_sh.sku
      JOIN shopee_products sp_other
        ON sp_other.id = spv_other.shopee_product_id
       AND sp_other.shop_id != sp.shop_id
       AND sp_other.deleted_at IS NULL
      WHERE spv_sh.shopee_product_id = sp.id
    );

  GET DIAGNOSTICS v_count_shopee_products = ROW_COUNT;
  RAISE NOTICE 'shopee_products đã bật: %', v_count_shopee_products;

  -- --------------------------------------------------------
  -- Tổng kết
  -- --------------------------------------------------------
  RAISE NOTICE '=== HOÀN THÀNH ===';
  RAISE NOTICE 'SKU đủ điều kiện        : %', v_count_skus;
  RAISE NOTICE 'store_product_variants  : % rows updated', v_count_store_variants;
  RAISE NOTICE 'store_products          : % rows updated', v_count_store_products;
  RAISE NOTICE 'shopee_product_variants : % rows updated', v_count_shopee_variants;
  RAISE NOTICE 'shopee_products         : % rows updated', v_count_shopee_products;
END;
$$;

-- ============================================================
-- (Tùy chọn) Xem trước danh sách SKU đủ điều kiện TRƯỚC KHI chạy bên trên
-- Chạy SELECT này riêng để kiểm tra:
-- ============================================================
/*
WITH shops AS (
  SELECT id, name, ROW_NUMBER() OVER (ORDER BY display_order) AS rn
  FROM shopee_shops
)
SELECT DISTINCT
  w.sku,
  sp_store.name AS ten_website,
  sp1.name      AS ten_shopee_shop1,
  sp2.name      AS ten_shopee_shop2
FROM store_product_variants w
JOIN store_products sp_store ON sp_store.id = w.store_product_id AND sp_store.deleted_at IS NULL
JOIN shopee_product_variants spv1 ON spv1.sku = w.sku
JOIN shopee_products sp1 ON sp1.id = spv1.shopee_product_id
  AND sp1.shop_id = (SELECT id FROM shops WHERE rn = 1)
  AND sp1.deleted_at IS NULL
JOIN shopee_product_variants spv2 ON spv2.sku = w.sku
JOIN shopee_products sp2 ON sp2.id = spv2.shopee_product_id
  AND sp2.shop_id = (SELECT id FROM shops WHERE rn = 2)
  AND sp2.deleted_at IS NULL
ORDER BY w.sku;
*/
