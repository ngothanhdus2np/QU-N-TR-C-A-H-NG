-- Website order integrity: server-side website prices, aggregate duplicate SKUs,
-- and idempotent/correct inventory restocking on cancellation and return.
-- Apply this migration before deploying the updated Store API.

-- Shipping is a server-side website-order policy. It is deliberately stored on
-- the order so historical totals remain accurate if the policy changes later.
ALTER TABLE pos_orders
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION create_store_order(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_address_line TEXT DEFAULT NULL,
  p_ward TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_province TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cod',
  p_note TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_code TEXT;
  v_customer_id UUID;
  v_subtotal NUMERIC := 0;
  v_shipping_fee NUMERIC := 0;
  v_total NUMERIC := 0;
  v_request RECORD;
  v_product RECORD;
  v_items_json JSONB := '[]'::JSONB;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Giỏ hàng trống');
  END IF;

  -- Aggregate by SKU before locking/checking/deducting. This prevents duplicate
  -- cart rows from each passing an individual stock check against the same stock.
  FOR v_request IN
    SELECT
      (item->>'pos_product_id')::UUID AS pos_product_id,
      SUM((item->>'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY (item->>'pos_product_id')::UUID
    ORDER BY (item->>'pos_product_id')::UUID
  LOOP
    IF v_request.quantity IS NULL OR v_request.quantity < 1 THEN
      RETURN jsonb_build_object('error', 'Số lượng sản phẩm không hợp lệ');
    END IF;

    -- A customer cannot submit a price or buy a non-published website variant.
    -- website_price_override is authoritative when present; otherwise sale_price.
    SELECT
      p.id,
      p.name,
      p.sku,
      p.stock,
      p.status,
      COALESCE(spv.website_price_override, p.sale_price) AS website_price
    INTO v_product
    FROM pos_products AS p
    JOIN store_product_variants AS spv
      ON spv.pos_product_id = p.id
     AND spv.is_published = TRUE
    JOIN store_products AS sp
      ON sp.id = spv.store_product_id
     AND sp.is_published = TRUE
     AND sp.deleted_at IS NULL
    WHERE p.id = v_request.pos_product_id
    FOR UPDATE OF p;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Sản phẩm không tồn tại hoặc chưa được xuất bản');
    END IF;

    IF v_product.status <> 'Active' THEN
      RETURN jsonb_build_object('error', format('Sản phẩm "%s" hiện không kinh doanh', v_product.name));
    END IF;

    IF v_product.stock < v_request.quantity THEN
      RETURN jsonb_build_object(
        'error',
        format('Sản phẩm "%s" không đủ hàng (còn %s)', v_product.name, v_product.stock)
      );
    END IF;

    v_subtotal := v_subtotal + (v_product.website_price * v_request.quantity);
    v_items_json := v_items_json || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'productName', v_product.name,
      'sku', v_product.sku,
      'quantity', v_request.quantity,
      'price', v_product.website_price,
      'subtotal', v_product.website_price * v_request.quantity
    ));
  END LOOP;

  -- Website shipping policy: 30,000 VND below 800,000 VND, otherwise free.
  -- Never accept a shipping amount from the browser.
  v_shipping_fee := CASE WHEN v_subtotal < 800000 THEN 30000 ELSE 0 END;
  v_total := v_subtotal + v_shipping_fee;

  -- Only create/update the customer after the order contents have passed validation.
  SELECT id INTO v_customer_id
  FROM pos_customers
  WHERE phone = p_customer_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO pos_customers (id, name, phone, email)
    VALUES (gen_random_uuid(), p_customer_name, p_customer_phone, p_customer_email)
    RETURNING id INTO v_customer_id;
  END IF;

  v_order_code := 'PS' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYMMDD') ||
                  LPAD(FLOOR(RANDOM() * 9999 + 1)::TEXT, 4, '0');

  INSERT INTO pos_orders (
    id, order_code, date, customer_id, customer_name,
    items, shipping_fee, total_amount, final_amount, status,
    payment_method, channel, note, created_at
  ) VALUES (
    gen_random_uuid(), v_order_code,
    TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
    v_customer_id, p_customer_name,
    v_items_json, v_shipping_fee, v_total, v_total, 'pending',
    p_payment_method, 'website', p_note, NOW()
  ) RETURNING id INTO v_order_id;

  IF p_address_line IS NOT NULL THEN
    INSERT INTO store_order_addresses (order_id, recipient_name, phone, address_line, ward, district, province)
    VALUES (v_order_id, p_customer_name, p_customer_phone, p_address_line, p_ward, p_district, p_province);
  END IF;

  -- v_items_json already has one line per pos_product_id.
  FOR v_request IN SELECT value FROM jsonb_array_elements(v_items_json)
  LOOP
    UPDATE pos_products
    SET stock = stock - (v_request.value->>'quantity')::INTEGER
    WHERE id = (v_request.value->>'productId')::UUID;
  END LOOP;

  RETURN jsonb_build_object(
    'order_code', v_order_code,
    'order_id', v_order_id,
    'subtotal', v_subtotal,
    'shipping_fee', v_shipping_fee,
    'total_amount', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_website_order_status(
  p_order_id UUID,
  p_new_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_items JSONB;
BEGIN
  SELECT status, items
  INTO v_current_status, v_items
  FROM pos_orders
  WHERE id = p_order_id
    AND channel = 'website'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Đơn hàng website không tồn tại');
  END IF;

  IF p_new_status IS NULL OR p_new_status NOT IN (
    'pending', 'confirmed', 'shipping', 'completed',
    'cancelled', 'return_requested', 'returned'
  ) THEN
    RETURN jsonb_build_object('error', 'Trạng thái đơn hàng không hợp lệ');
  END IF;

  -- Idempotent retry: do not modify the order or restock a second time.
  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object('ok', TRUE, 'idempotent', TRUE, 'restocked', FALSE);
  END IF;

  -- Enforce the operational state machine. In particular, terminal statuses
  -- cannot be reopened and cancelled/returned cannot be reached twice.
  IF NOT (
    (v_current_status = 'pending' AND p_new_status IN ('confirmed', 'cancelled')) OR
    (v_current_status = 'confirmed' AND p_new_status IN ('shipping', 'cancelled')) OR
    (v_current_status = 'shipping' AND p_new_status IN ('completed', 'return_requested')) OR
    (v_current_status = 'completed' AND p_new_status = 'return_requested') OR
    (v_current_status = 'return_requested' AND p_new_status = 'returned')
  ) THEN
    RETURN jsonb_build_object('error', format('Không thể chuyển trạng thái từ "%s" sang "%s"', v_current_status, p_new_status));
  END IF;

  UPDATE pos_orders
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_order_id;

  IF p_new_status IN ('cancelled', 'returned') THEN
    -- Aggregate historical duplicate lines too, so a legacy order never adds
    -- inventory twice merely because the same SKU appears more than once.
    WITH restocks AS (
      SELECT
        (item->>'productId')::UUID AS product_id,
        SUM(COALESCE(NULLIF(item->>'quantity', '')::INTEGER, 0))::INTEGER AS quantity
      FROM jsonb_array_elements(COALESCE(v_items, '[]'::JSONB)) AS item
      GROUP BY (item->>'productId')::UUID
    )
    UPDATE pos_products AS p
    SET stock = p.stock + restocks.quantity
    FROM restocks
    WHERE p.id = restocks.product_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'idempotent', FALSE,
    'restocked', p_new_status IN ('cancelled', 'returned')
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
