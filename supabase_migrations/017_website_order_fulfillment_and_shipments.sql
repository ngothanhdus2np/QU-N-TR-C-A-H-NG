-- Website fulfilment workflow and SPX shipment records.
-- This migration intentionally leaves the existing stock-restock rules intact.

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS cod_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION upsert_website_shipment(
  p_order_id UUID,
  p_provider TEXT DEFAULT 'SPX',
  p_tracking_code TEXT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_cod_amount NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'ready_to_ship'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status TEXT;
  v_shipment_id UUID;
  v_provider TEXT := COALESCE(NULLIF(BTRIM(p_provider), ''), 'SPX');
  v_tracking_code TEXT := NULLIF(BTRIM(p_tracking_code), '');
  v_status TEXT := COALESCE(NULLIF(BTRIM(p_status), ''), 'ready_to_ship');
BEGIN
  SELECT status INTO v_order_status
  FROM pos_orders
  WHERE id = p_order_id AND channel = 'website'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Đơn hàng website không tồn tại');
  END IF;
  IF LENGTH(v_provider) > 100 OR LENGTH(COALESCE(v_tracking_code, '')) > 150 OR LENGTH(v_status) > 100 THEN
    RETURN jsonb_build_object('error', 'Thông tin vận đơn không hợp lệ');
  END IF;
  IF p_shipping_fee < 0 OR p_cod_amount < 0 THEN
    RETURN jsonb_build_object('error', 'Phí giao hàng và tiền COD phải lớn hơn hoặc bằng 0');
  END IF;
  IF (v_order_status = 'shipping' OR v_status = 'shipping') AND v_tracking_code IS NULL THEN
    RETURN jsonb_build_object('error', 'Cần có mã vận đơn trước khi chuyển sang đang giao');
  END IF;

  -- Existing installations may contain multiple historical shipment records.
  -- Update the newest one for this order; otherwise create the first one.
  SELECT id INTO v_shipment_id
  FROM shipments
  WHERE order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_shipment_id IS NULL THEN
    INSERT INTO shipments (
      order_id, provider, tracking_code, shipping_fee, cod_amount, status, shipped_at, created_at, updated_at
    ) VALUES (
      p_order_id, v_provider, v_tracking_code, p_shipping_fee, p_cod_amount, v_status,
      CASE WHEN v_status = 'shipping' THEN NOW() ELSE NULL END, NOW(), NOW()
    ) RETURNING id INTO v_shipment_id;
  ELSE
    UPDATE shipments
    SET provider = v_provider,
        tracking_code = v_tracking_code,
        shipping_fee = p_shipping_fee,
        cod_amount = p_cod_amount,
        status = v_status,
        shipped_at = CASE WHEN v_status = 'shipping' THEN COALESCE(shipped_at, NOW()) ELSE shipped_at END,
        updated_at = NOW()
    WHERE id = v_shipment_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'shipment_id', v_shipment_id);
END;
$$;

-- Replace the previous two-argument RPC so the shipping transition can persist
-- its required tracking data atomically with the order-status update.
DROP FUNCTION IF EXISTS update_website_order_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_website_order_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_shipment JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_items JSONB;
  v_shipment_result JSONB;
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
    'pending', 'confirmed', 'packing', 'ready_to_ship', 'shipping', 'completed',
    'cancelled', 'return_requested', 'returned'
  ) THEN
    RETURN jsonb_build_object('error', 'Trạng thái đơn hàng không hợp lệ');
  END IF;

  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object('ok', TRUE, 'idempotent', TRUE, 'restocked', FALSE);
  END IF;

  IF NOT (
    (v_current_status = 'pending' AND p_new_status IN ('confirmed', 'cancelled')) OR
    (v_current_status = 'confirmed' AND p_new_status IN ('packing', 'cancelled')) OR
    (v_current_status = 'packing' AND p_new_status IN ('ready_to_ship', 'cancelled')) OR
    (v_current_status = 'ready_to_ship' AND p_new_status IN ('shipping', 'cancelled')) OR
    (v_current_status = 'shipping' AND p_new_status IN ('completed', 'return_requested')) OR
    (v_current_status = 'completed' AND p_new_status = 'return_requested') OR
    (v_current_status = 'return_requested' AND p_new_status = 'returned')
  ) THEN
    RETURN jsonb_build_object('error', format('Không thể chuyển trạng thái từ "%s" sang "%s"', v_current_status, p_new_status));
  END IF;

  IF p_new_status = 'shipping' THEN
    IF p_shipment IS NULL OR jsonb_typeof(p_shipment) <> 'object' THEN
      RETURN jsonb_build_object('error', 'Cần có thông tin vận đơn trước khi chuyển sang đang giao');
    END IF;
    IF NULLIF(BTRIM(p_shipment->>'tracking_code'), '') IS NULL THEN
      RETURN jsonb_build_object('error', 'Cần có mã vận đơn trước khi chuyển sang đang giao');
    END IF;
    SELECT upsert_website_shipment(
      p_order_id,
      COALESCE(p_shipment->>'provider', 'SPX'),
      p_shipment->>'tracking_code',
      COALESCE((p_shipment->>'shipping_fee')::NUMERIC, 0),
      COALESCE((p_shipment->>'cod_amount')::NUMERIC, 0),
      'shipping'
    ) INTO v_shipment_result;
    IF v_shipment_result ? 'error' THEN
      RETURN v_shipment_result;
    END IF;
  END IF;

  UPDATE pos_orders
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_order_id;

  -- Keep the existing inventory rule exactly: only cancelled/returned restock.
  IF p_new_status IN ('cancelled', 'returned') THEN
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
