-- 030: Ghi nhận "ai" thực hiện thao tác hủy/xóa/sửa/tạo đơn bán vào audit_logs.
--
-- Bối cảnh: delete_pos_order_tx (026), cancel_pos_return_tx (027), edit_pos_order_tx (028),
-- place_pos_order_tx (029) đã ghi audit_logs (best-effort) từ trước, nhưng KHÔNG biết ai gọi
-- vì route Express chỉ forward RPC mà không truyền actor. Migration này CHỈ thêm 2 tham số
-- p_actor_id/p_actor_name (đều DEFAULT NULL — không phá caller cũ nếu có) và nhét vào JSON
-- snapshot của audit_logs. KHÔNG đụng vào bất kỳ logic tính tồn kho/doanh thu/COGS nào —
-- toàn bộ phần thân hàm giữ nguyên 100%, chỉ khác đúng 2 chỗ: signature + jsonb_build_object
-- trong block audit.
--
-- Vì đổi số lượng tham số nên CREATE OR REPLACE không "thay" được hàm cũ (Postgres coi khác
-- signature là hàm khác) → phải DROP tường minh chữ ký cũ trước khi tạo lại.

-- ============================================================
-- delete_pos_order_tx
-- ============================================================
DROP FUNCTION IF EXISTS delete_pos_order_tx(UUID);

CREATE OR REPLACE FUNCTION delete_pos_order_tx(
  p_order_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS TABLE(order_id UUID) AS $$
DECLARE
  v_order      pos_orders%ROWTYPE;
  v_date_key   DATE;
  item         JSONB;
  v_qty        INT;
  v_import     NUMERIC;
  v_prod_imp   NUMERIC;
  v_cogs       NUMERIC := 0;
  v_net        NUMERIC;
  v_other      NUMERIC;
  tx           RECORD;
  v_debt_delta NUMERIC := 0;
BEGIN
  SELECT * INTO v_order FROM pos_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND:%', p_order_id;
  END IF;
  IF v_order.is_return THEN
    RAISE EXCEPTION 'RETURN_ORDER_NOT_SUPPORTED:%', v_order.order_code;
  END IF;
  IF COALESCE(v_order.status, '') = 'cancelled' THEN
    RAISE EXCEPTION 'ALREADY_CANCELLED:%', v_order.order_code;
  END IF;

  v_date_key := (v_order.date)::DATE;

  -- 1) Hoàn tồn kho + đánh dấu inventory transaction Sale của đơn là cancelled.
  --    Dựa vào items ĐÃ LƯU trong transaction (nguồn sự thật của lần trừ kho), không suy lại.
  FOR tx IN
    SELECT * FROM inventory_transactions
    WHERE reference_id = p_order_id::TEXT AND type = 'Sale' AND COALESCE(status, '') <> 'cancelled'
    FOR UPDATE
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(tx.items, '[]'::JSONB))
    LOOP
      v_qty := ABS(COALESCE(NULLIF(item->>'quantity', '')::INT, 0));
      IF v_qty = 0 THEN CONTINUE; END IF;
      UPDATE pos_products SET stock = stock + v_qty WHERE id = (item->>'productId')::UUID;
    END LOOP;
    UPDATE inventory_transactions SET status = 'cancelled' WHERE id = tx.id;
  END LOOP;

  -- 2) COGS đơn = Σ importPrice × quantity (ưu tiên importPrice lưu trong item, fallback giá vốn SP)
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::JSONB))
  LOOP
    v_qty := COALESCE(NULLIF(item->>'quantity', '')::INT, 0);
    IF v_qty = 0 THEN CONTINUE; END IF;
    SELECT import_price INTO v_prod_imp FROM pos_products WHERE id = (item->>'productId')::UUID;
    v_import := COALESCE(NULLIF(item->>'importPrice', '')::NUMERIC, v_prod_imp, 0);
    v_cogs := v_cogs + v_import * v_qty;
  END LOOP;

  -- 3) Đảo doanh thu ngày bán — nghịch của buildRevenueDelta (trừ từng field, ON CONFLICT chắc
  --    chắn có dòng vì ngày này có đơn). net/other clamp giống lúc tạo.
  v_net   := GREATEST(0, COALESCE(v_order.total_amount, 0) - COALESCE(v_order.discount, 0));
  v_other := GREATEST(0, COALESCE(v_order.final_amount, 0) - v_net);
  INSERT INTO revenue_records (
    id, date, total_gross_revenue, discount, revenue_other, returns_value, net_revenue, total_cogs, gross_profit
  ) VALUES (
    gen_random_uuid(), v_date_key,
    -COALESCE(v_order.total_amount, 0), -COALESCE(v_order.discount, 0), -v_other,
    0, -v_net, -v_cogs, -(v_net + v_other - v_cogs)
  )
  ON CONFLICT (date) DO UPDATE SET
    total_gross_revenue = revenue_records.total_gross_revenue + EXCLUDED.total_gross_revenue,
    discount            = revenue_records.discount + EXCLUDED.discount,
    revenue_other       = revenue_records.revenue_other + EXCLUDED.revenue_other,
    net_revenue         = revenue_records.net_revenue + EXCLUDED.net_revenue,
    total_cogs          = revenue_records.total_cogs + EXCLUDED.total_cogs,
    gross_profit        = revenue_records.gross_profit + EXCLUDED.gross_profit;

  -- 4) Đảo thống kê khách + xóa lịch sử nợ của đơn (nếu có khách)
  IF v_order.customer_id IS NOT NULL THEN
    SELECT COALESCE(SUM(CASE WHEN type = 'debt' THEN amount ELSE -amount END), 0)
      INTO v_debt_delta
      FROM customer_debt_history WHERE customer_debt_history.order_id = p_order_id;

    UPDATE pos_customers SET
      points      = GREATEST(0, COALESCE(points, 0) - COALESCE(v_order.points_earned, 0)),
      total_spent = GREATEST(0, COALESCE(total_spent, 0) - COALESCE(v_order.final_amount, 0)),
      debt_amount = GREATEST(0, COALESCE(debt_amount, 0) - v_debt_delta)
    WHERE id = v_order.customer_id;
  END IF;

  DELETE FROM customer_debt_history WHERE customer_debt_history.order_id = p_order_id;

  -- 5) Soft-delete đơn
  UPDATE pos_orders SET status = 'cancelled' WHERE id = p_order_id;

  -- 6) Audit (best-effort)
  BEGIN
    INSERT INTO audit_logs (id, table_name, record_id, action, snapshot)
    VALUES (gen_random_uuid(), 'pos_orders', p_order_id, 'delete',
      jsonb_build_object('orderCode', v_order.order_code, 'finalAmount', v_order.final_amount,
                         'reason', 'Xóa đơn hàng (soft-delete, RPC)',
                         'actorId', p_actor_id, 'actorName', p_actor_name));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_pos_order_tx(UUID, UUID, TEXT) TO authenticated;
ALTER FUNCTION delete_pos_order_tx(UUID, UUID, TEXT) SET search_path = public;

-- ============================================================
-- cancel_pos_return_tx
-- ============================================================
DROP FUNCTION IF EXISTS cancel_pos_return_tx(UUID);

CREATE OR REPLACE FUNCTION cancel_pos_return_tx(
  p_return_order_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS TABLE(order_id UUID) AS $$
DECLARE
  v_order           pos_orders%ROWTYPE;
  v_date_key        DATE;
  item              JSONB;
  v_qty             INT;
  v_import          NUMERIC;
  v_prod_imp        NUMERIC;
  v_allow_points    BOOLEAN;
  v_item_total      NUMERIC;
  v_return_cogs     NUMERIC := 0;
  v_exchange_cogs   NUMERIC := 0;
  v_return_value    NUMERIC := 0;
  v_exchange_value  NUMERIC := 0;
  v_points_restored NUMERIC := 0;
  v_points_rate     NUMERIC;
  v_return_fee      NUMERIC;
  d_other           NUMERIC;
  d_returns_value   NUMERIC;
  d_net             NUMERIC;
  d_cogs            NUMERIC;
  d_profit          NUMERIC;
  tx                RECORD;
BEGIN
  SELECT * INTO v_order FROM pos_orders WHERE id = p_return_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RETURN_NOT_FOUND:%', p_return_order_id;
  END IF;
  IF NOT COALESCE(v_order.is_return, false) THEN
    RAISE EXCEPTION 'NOT_A_RETURN_ORDER:%', v_order.order_code;
  END IF;
  IF COALESCE(v_order.status, '') = 'cancelled' THEN
    RAISE EXCEPTION 'ALREADY_CANCELLED:%', v_order.order_code;
  END IF;

  v_date_key := (v_order.date)::DATE;
  v_return_fee := COALESCE(v_order.return_fee, 0);

  SELECT (value->>'pointsRate')::NUMERIC INTO v_points_rate
    FROM system_configs WHERE key = 'pos_payment_settings';
  v_points_rate := GREATEST(1, COALESCE(v_points_rate, 10000));

  -- 1) Đảo tồn kho + đánh dấu inventory transaction của phiếu là cancelled.
  --    Dựa vào items ĐÃ LƯU trong transaction (nguồn sự thật), không suy lại từ order.items.
  FOR tx IN
    SELECT * FROM inventory_transactions
    WHERE reference_id = p_return_order_id::TEXT AND COALESCE(status, '') <> 'cancelled'
    FOR UPDATE
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(tx.items, '[]'::JSONB))
    LOOP
      v_qty := ABS(COALESCE(NULLIF(item->>'quantity', '')::INT, 0));
      IF v_qty = 0 THEN CONTINUE; END IF;

      IF tx.type = 'Return' THEN
        UPDATE pos_products SET stock = stock - v_qty
          WHERE id = (item->>'productId')::UUID AND stock >= v_qty;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'STOCK_WOULD_BE_NEGATIVE:%', item->>'productId';
        END IF;
      ELSIF tx.type = 'Sale' THEN
        UPDATE pos_products SET stock = stock + v_qty WHERE id = (item->>'productId')::UUID;
      END IF;
    END LOOP;
    UPDATE inventory_transactions SET status = 'cancelled' WHERE id = tx.id;
  END LOOP;

  -- 2) Tính lại giá trị trả/đổi + COGS + điểm khôi phục từ items của ĐƠN (khớp buildReturnRevenueDelta)
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::JSONB))
  LOOP
    v_qty := COALESCE(NULLIF(item->>'quantity', '')::INT, 0);
    IF v_qty = 0 THEN CONTINUE; END IF;
    SELECT import_price, allow_points INTO v_prod_imp, v_allow_points
      FROM pos_products WHERE id = (item->>'productId')::UUID;
    v_import := COALESCE(NULLIF(item->>'importPrice', '')::NUMERIC, v_prod_imp, 0);
    v_item_total := COALESCE(NULLIF(item->>'total', '')::NUMERIC, 0);

    IF COALESCE(item->>'lineType', 'sale') = 'exchange' THEN
      v_exchange_cogs := v_exchange_cogs + v_import * v_qty;
      v_exchange_value := v_exchange_value + v_item_total;
    ELSE
      v_return_cogs := v_return_cogs + v_import * v_qty;
      v_return_value := v_return_value + v_item_total;
      IF COALESCE(v_allow_points, true) THEN
        v_points_restored := v_points_restored + v_item_total;
      END IF;
    END IF;
  END LOOP;

  -- 3) Đảo doanh thu ngày phiếu — nghịch đảo của buildReturnRevenueDelta.
  d_other         := -v_return_fee;
  d_returns_value := -v_return_value;
  d_net           := v_return_value - v_exchange_value;
  d_cogs          := v_return_cogs - v_exchange_cogs;
  d_profit        := d_net + d_other - d_cogs;

  INSERT INTO revenue_records (
    id, date, total_gross_revenue, discount, revenue_other, returns_value, net_revenue, total_cogs, gross_profit
  ) VALUES (
    gen_random_uuid(), v_date_key, 0, 0, d_other, d_returns_value, d_net, d_cogs, d_profit
  )
  ON CONFLICT (date) DO UPDATE SET
    revenue_other  = revenue_records.revenue_other + EXCLUDED.revenue_other,
    returns_value  = revenue_records.returns_value + EXCLUDED.returns_value,
    net_revenue    = revenue_records.net_revenue + EXCLUDED.net_revenue,
    total_cogs     = revenue_records.total_cogs + EXCLUDED.total_cogs,
    gross_profit   = revenue_records.gross_profit + EXCLUDED.gross_profit;

  -- 4) Khôi phục khách hàng: điểm + tổng chi tiêu (nghịch đảo đúng công thức lúc tạo phiếu trả)
  IF v_order.customer_id IS NOT NULL THEN
    UPDATE pos_customers SET
      points      = GREATEST(0, COALESCE(points, 0) + FLOOR(v_points_restored / v_points_rate)),
      total_spent = GREATEST(0, COALESCE(total_spent, 0) + v_return_value - v_exchange_value)
    WHERE id = v_order.customer_id;
  END IF;

  -- 5) Soft-delete phiếu trả
  UPDATE pos_orders SET status = 'cancelled' WHERE id = p_return_order_id;

  -- 6) Audit (best-effort)
  BEGIN
    INSERT INTO audit_logs (id, table_name, record_id, action, snapshot)
    VALUES (gen_random_uuid(), 'pos_orders', p_return_order_id, 'delete',
      jsonb_build_object('orderCode', v_order.order_code, 'reason', 'Hủy phiếu trả hàng (soft-delete, RPC)',
                         'actorId', p_actor_id, 'actorName', p_actor_name));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT p_return_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_pos_return_tx(UUID, UUID, TEXT) TO authenticated;
ALTER FUNCTION cancel_pos_return_tx(UUID, UUID, TEXT) SET search_path = public;

-- ============================================================
-- edit_pos_order_tx
-- ============================================================
DROP FUNCTION IF EXISTS edit_pos_order_tx(UUID, JSONB, JSONB, BOOLEAN);

CREATE OR REPLACE FUNCTION edit_pos_order_tx(
  p_order_id UUID,
  p_updated_order JSONB,
  p_debt_record JSONB DEFAULT NULL,
  p_allow_sell_out_of_stock BOOLEAN DEFAULT false,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS TABLE(order_id UUID) AS $$
DECLARE
  v_original     pos_orders%ROWTYPE;
  item           JSONB;
  v_pid          UUID;
  v_qty          INT;
  v_import       NUMERIC;
  v_prod_imp     NUMERIC;
  v_old_cogs     NUMERIC := 0;
  v_new_cogs     NUMERIC := 0;
  v_old_net      NUMERIC;
  v_old_other    NUMERIC;
  v_new_total    NUMERIC;
  v_new_discount NUMERIC;
  v_new_final    NUMERIC;
  v_new_net      NUMERIC;
  v_new_other    NUMERIC;
  d_gross        NUMERIC;
  d_discount     NUMERIC;
  d_net          NUMERIC;
  d_other        NUMERIC;
  d_cogs         NUMERIC;
  d_profit       NUMERIC;
  v_row          RECORD;
  new_tx_items   JSONB;
  v_customer_id  UUID;
BEGIN
  SELECT * INTO v_original FROM pos_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND:%', p_order_id;
  END IF;
  IF v_original.is_return OR COALESCE((p_updated_order->>'isReturn')::BOOLEAN, false) THEN
    RAISE EXCEPTION 'RETURN_ORDER_NOT_SUPPORTED:%', v_original.order_code;
  END IF;
  IF COALESCE(v_original.status, '') = 'cancelled' THEN
    RAISE EXCEPTION 'ALREADY_CANCELLED:%', v_original.order_code;
  END IF;

  -- [ORDERS-EDIT-02] Chặn giảm SL xuống dưới mức đã trả (2 nguồn: phiếu TH + inventory
  -- transaction 'Return' kiểu cũ — khớp getReturnedQuantitiesForOrder phía JS)
  FOR v_row IN
    WITH returned_from_orders AS (
      SELECT (ri->>'productId') AS product_id,
             SUM(ABS(COALESCE(NULLIF(ri->>'quantity', '')::NUMERIC, 0))) AS qty
      FROM pos_orders ro
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ro.items, '[]'::JSONB)) AS ri
      WHERE ro.is_return = true
        AND COALESCE(ro.status, '') <> 'cancelled'
        AND ro.id <> p_order_id
        AND COALESCE(ri->>'lineType', '') <> 'exchange'
        AND (
          ro.original_order_id = p_order_id::TEXT
          OR (ro.original_order_id IS NULL AND v_original.order_code IS NOT NULL
              AND ro.notes ILIKE '%' || v_original.order_code || '%')
        )
      GROUP BY ri->>'productId'
    ),
    returned_from_tx AS (
      SELECT (ti->>'productId') AS product_id,
             SUM(ABS(COALESCE(NULLIF(ti->>'quantity', '')::NUMERIC, 0))) AS qty
      FROM inventory_transactions tx
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(tx.items, '[]'::JSONB)) AS ti
      WHERE tx.type IN ('Return', 'return')
        AND COALESCE(tx.status, '') <> 'cancelled'
        AND tx.reference_id = p_order_id::TEXT
      GROUP BY ti->>'productId'
    ),
    returned_total AS (
      SELECT product_id, SUM(qty) AS qty FROM (
        SELECT * FROM returned_from_orders
        UNION ALL
        SELECT * FROM returned_from_tx
      ) u GROUP BY product_id
    ),
    new_items_agg AS (
      SELECT (ni->>'productId') AS product_id,
             SUM(COALESCE(NULLIF(ni->>'quantity', '')::NUMERIC, 0)) AS qty
      FROM jsonb_array_elements(COALESCE(p_updated_order->'items', '[]'::JSONB)) AS ni
      GROUP BY ni->>'productId'
    )
    SELECT rt.product_id, rt.qty AS returned_qty, COALESCE(na.qty, 0) AS new_qty
    FROM returned_total rt
    LEFT JOIN new_items_agg na ON na.product_id = rt.product_id
    WHERE COALESCE(na.qty, 0) < rt.qty
  LOOP
    RAISE EXCEPTION 'RETURN_QTY_EXCEEDS_NEW_QTY:%:new=%:returned=%',
      v_row.product_id, v_row.new_qty, v_row.returned_qty;
  END LOOP;

  -- Snapshot tồn kho hiện tại của các sản phẩm liên quan (cũ ∪ mới) — dùng ghi previousStock
  CREATE TEMP TABLE tmp_stock_before ON COMMIT DROP AS
  SELECT id AS product_id, stock AS before_stock
  FROM pos_products
  WHERE id IN (
    SELECT DISTINCT (i->>'productId')::UUID
    FROM jsonb_array_elements(COALESCE(v_original.items, '[]'::JSONB)) i
    WHERE i->>'productId' IS NOT NULL
    UNION
    SELECT DISTINCT (i->>'productId')::UUID
    FROM jsonb_array_elements(COALESCE(p_updated_order->'items', '[]'::JSONB)) i
    WHERE i->>'productId' IS NOT NULL
  );

  -- Tồn kho cuối = tồn hiện tại + SL cũ (hoàn lại) − SL mới (trừ lại), gộp theo sản phẩm
  FOR v_row IN
    WITH old_items AS (
      SELECT (i->>'productId') AS product_id,
             SUM(COALESCE(NULLIF(i->>'quantity', '')::NUMERIC, 0)) AS qty
      FROM jsonb_array_elements(COALESCE(v_original.items, '[]'::JSONB)) i
      GROUP BY i->>'productId'
    ),
    new_items AS (
      SELECT (i->>'productId') AS product_id,
             SUM(COALESCE(NULLIF(i->>'quantity', '')::NUMERIC, 0)) AS qty
      FROM jsonb_array_elements(COALESCE(p_updated_order->'items', '[]'::JSONB)) i
      GROUP BY i->>'productId'
    )
    SELECT COALESCE(o.product_id, n.product_id) AS product_id,
           COALESCE(o.qty, 0) - COALESCE(n.qty, 0) AS net
    FROM old_items o
    FULL OUTER JOIN new_items n ON o.product_id = n.product_id
  LOOP
    IF v_row.net = 0 OR v_row.product_id IS NULL THEN CONTINUE; END IF;
    v_pid := v_row.product_id::UUID;
    IF NOT p_allow_sell_out_of_stock THEN
      UPDATE pos_products SET stock = stock + v_row.net
        WHERE id = v_pid AND stock + v_row.net >= 0;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'STOCK_WOULD_BE_NEGATIVE:%', v_pid;
      END IF;
    ELSE
      UPDATE pos_products SET stock = stock + v_row.net WHERE id = v_pid;
    END IF;
  END LOOP;

  -- Xóa transaction Sale CŨ của đơn, ghi transaction MỚI theo items đã sửa
  DELETE FROM inventory_transactions WHERE reference_id = p_order_id::TEXT;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'productId', it->>'productId',
      'sku', it->>'sku',
      'name', it->>'name',
      'quantity', -COALESCE(NULLIF(it->>'quantity', '')::NUMERIC, 0),
      'previousStock', COALESCE(sb.before_stock, 0),
      'newStock', COALESCE(pp.stock, 0)
    )
  ), '[]'::JSONB)
  INTO new_tx_items
  FROM jsonb_array_elements(COALESCE(p_updated_order->'items', '[]'::JSONB)) it
  LEFT JOIN tmp_stock_before sb ON sb.product_id = (it->>'productId')::UUID
  LEFT JOIN pos_products pp ON pp.id = (it->>'productId')::UUID;

  INSERT INTO inventory_transactions (id, date, type, staff_id, items, note, reference_id)
  VALUES (
    gen_random_uuid(), v_original.date, 'Sale',
    p_updated_order->>'staffId', new_tx_items,
    'Bán hàng đơn ' || v_original.order_code, p_order_id::TEXT
  );

  -- Xóa nợ CŨ, ghi nợ MỚI (nếu đơn sửa bật bán nợ)
  DELETE FROM customer_debt_history WHERE customer_debt_history.order_id = p_order_id;
  IF p_debt_record IS NOT NULL THEN
    INSERT INTO customer_debt_history (id, customer_id, date, order_id, type, amount, note)
    VALUES (
      COALESCE(NULLIF(p_debt_record->>'id', '')::UUID, gen_random_uuid()),
      (p_debt_record->>'customerId')::UUID,
      COALESCE(p_debt_record->>'date', now()::TEXT),
      p_order_id,
      COALESCE(p_debt_record->>'type', 'debt'),
      COALESCE((p_debt_record->>'amount')::NUMERIC, 0),
      p_debt_record->>'note'
    );
  END IF;

  -- Ghi đè đơn — giữ NGUYÊN id/order_code/date, chỉ đổi phần còn lại
  v_customer_id := NULLIF(p_updated_order->>'customerId', '')::UUID;
  UPDATE pos_orders SET
    customer_id      = v_customer_id,
    customer_name    = p_updated_order->>'customerName',
    items            = COALESCE(p_updated_order->'items', '[]'::JSONB),
    total_amount     = COALESCE((p_updated_order->>'totalAmount')::NUMERIC, 0),
    discount         = COALESCE((p_updated_order->>'discount')::NUMERIC, 0),
    final_amount     = COALESCE((p_updated_order->>'finalAmount')::NUMERIC, 0),
    payment_method   = p_updated_order->>'paymentMethod',
    staff_id         = p_updated_order->>'staffId',
    staff_name       = p_updated_order->>'staffName',
    created_by       = COALESCE(p_updated_order->>'createdBy', p_updated_order->>'staffId'),
    channel          = COALESCE(p_updated_order->>'channel', 'direct'),
    channel_name     = COALESCE(p_updated_order->>'channelName', 'Bán trực tiếp'),
    price_book_id    = p_updated_order->>'priceBookId',
    price_book_name  = p_updated_order->>'priceBookName',
    notes            = p_updated_order->>'notes',
    points_earned    = COALESCE((p_updated_order->>'pointsEarned')::NUMERIC, 0),
    split_payments   = p_updated_order->'splitPayments',
    cash_received    = NULLIF(p_updated_order->>'cashReceived', '')::NUMERIC,
    updated_at       = now()
  WHERE id = p_order_id;

  -- Doanh thu: gộp delta đảo dấu đơn CŨ + delta đơn MỚI thành 1 delta ròng (ngày không đổi)
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(v_original.items, '[]'::JSONB))
  LOOP
    v_qty := COALESCE(NULLIF(item->>'quantity', '')::NUMERIC, 0);
    IF v_qty = 0 THEN CONTINUE; END IF;
    SELECT import_price INTO v_prod_imp FROM pos_products WHERE id = (item->>'productId')::UUID;
    v_import := COALESCE(NULLIF(item->>'importPrice', '')::NUMERIC, v_prod_imp, 0);
    v_old_cogs := v_old_cogs + v_import * v_qty;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_updated_order->'items', '[]'::JSONB))
  LOOP
    v_qty := COALESCE(NULLIF(item->>'quantity', '')::NUMERIC, 0);
    IF v_qty = 0 THEN CONTINUE; END IF;
    SELECT import_price INTO v_prod_imp FROM pos_products WHERE id = (item->>'productId')::UUID;
    v_import := COALESCE(NULLIF(item->>'importPrice', '')::NUMERIC, v_prod_imp, 0);
    v_new_cogs := v_new_cogs + v_import * v_qty;
  END LOOP;

  v_old_net   := GREATEST(0, COALESCE(v_original.total_amount, 0) - COALESCE(v_original.discount, 0));
  v_old_other := GREATEST(0, COALESCE(v_original.final_amount, 0) - v_old_net);

  v_new_total    := COALESCE((p_updated_order->>'totalAmount')::NUMERIC, 0);
  v_new_discount := COALESCE((p_updated_order->>'discount')::NUMERIC, 0);
  v_new_final    := COALESCE((p_updated_order->>'finalAmount')::NUMERIC, 0);
  v_new_net      := GREATEST(0, v_new_total - v_new_discount);
  v_new_other    := GREATEST(0, v_new_final - v_new_net);

  d_gross    := -COALESCE(v_original.total_amount, 0) + v_new_total;
  d_discount := -COALESCE(v_original.discount, 0) + v_new_discount;
  d_net      := -v_old_net + v_new_net;
  d_other    := -v_old_other + v_new_other;
  d_cogs     := -v_old_cogs + v_new_cogs;
  d_profit   := d_net + d_other - d_cogs;

  INSERT INTO revenue_records (
    id, date, total_gross_revenue, discount, revenue_other, returns_value, net_revenue, total_cogs, gross_profit
  ) VALUES (
    gen_random_uuid(), (v_original.date)::DATE, d_gross, d_discount, d_other, 0, d_net, d_cogs, d_profit
  )
  ON CONFLICT (date) DO UPDATE SET
    total_gross_revenue = revenue_records.total_gross_revenue + EXCLUDED.total_gross_revenue,
    discount             = revenue_records.discount + EXCLUDED.discount,
    revenue_other         = revenue_records.revenue_other + EXCLUDED.revenue_other,
    net_revenue           = revenue_records.net_revenue + EXCLUDED.net_revenue,
    total_cogs            = revenue_records.total_cogs + EXCLUDED.total_cogs,
    gross_profit          = revenue_records.gross_profit + EXCLUDED.gross_profit;

  -- Audit (best-effort)
  BEGIN
    INSERT INTO audit_logs (id, table_name, record_id, action, snapshot)
    VALUES (gen_random_uuid(), 'pos_orders', p_order_id, 'update',
      jsonb_build_object(
        'orderCode', v_original.order_code,
        'finalAmountBefore', v_original.final_amount,
        'finalAmountAfter', v_new_final,
        'reason', 'Sửa đơn hàng (RPC)',
        'actorId', p_actor_id,
        'actorName', p_actor_name
      ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION edit_pos_order_tx(UUID, JSONB, JSONB, BOOLEAN, UUID, TEXT) TO authenticated;
ALTER FUNCTION edit_pos_order_tx(UUID, JSONB, JSONB, BOOLEAN, UUID, TEXT) SET search_path = public;

-- ============================================================
-- place_pos_order_tx
-- ============================================================
DROP FUNCTION IF EXISTS place_pos_order_tx(JSONB, JSONB, BOOLEAN);

CREATE OR REPLACE FUNCTION place_pos_order_tx(
  p_order JSONB,
  p_debt_record JSONB DEFAULT NULL,
  p_allow_sell_out_of_stock BOOLEAN DEFAULT false,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS TABLE(order_id UUID) AS $$
DECLARE
  v_order_id   UUID := (p_order->>'id')::UUID;
  v_order_code TEXT := p_order->>'orderCode';
  v_date       TEXT := p_order->>'date';
  v_customer_id UUID := NULLIF(p_order->>'customerId', '')::UUID;
  v_total      NUMERIC := COALESCE((p_order->>'totalAmount')::NUMERIC, 0);
  v_discount   NUMERIC := COALESCE((p_order->>'discount')::NUMERIC, 0);
  v_final      NUMERIC := COALESCE((p_order->>'finalAmount')::NUMERIC, 0);
  v_net        NUMERIC;
  v_other      NUMERIC;
  v_cogs       NUMERIC := 0;
  v_qty        NUMERIC;
  v_import     NUMERIC;
  v_prod_import NUMERIC;
  v_pid        UUID;
  v_inv_items  JSONB;
  item         JSONB;
  v_row        RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pos_orders WHERE id = v_order_id) THEN
    RAISE EXCEPTION 'ORDER_ALREADY_EXISTS:%', v_order_id;
  END IF;
  IF COALESCE(jsonb_array_length(p_order->'items'), 0) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  -- Snapshot tồn kho hiện tại (trước khi trừ) — dùng ghi previousStock
  CREATE TEMP TABLE tmp_stock_before ON COMMIT DROP AS
  SELECT id AS product_id, stock AS before_stock
  FROM pos_products
  WHERE id IN (
    SELECT DISTINCT (i->>'productId')::UUID
    FROM jsonb_array_elements(COALESCE(p_order->'items', '[]'::JSONB)) i
    WHERE i->>'productId' IS NOT NULL
  );

  -- Trừ tồn kho theo item (gộp theo SP), guard không âm trừ khi allow_sell_out_of_stock
  FOR v_row IN
    SELECT (i->>'productId') AS product_id,
           SUM(COALESCE(NULLIF(i->>'quantity', '')::NUMERIC, 0)) AS qty
    FROM jsonb_array_elements(COALESCE(p_order->'items', '[]'::JSONB)) i
    GROUP BY i->>'productId'
  LOOP
    IF v_row.product_id IS NULL OR v_row.qty = 0 THEN CONTINUE; END IF;
    v_pid := v_row.product_id::UUID;
    IF NOT p_allow_sell_out_of_stock THEN
      UPDATE pos_products SET stock = stock - v_row.qty
        WHERE id = v_pid AND stock - v_row.qty >= 0;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'STOCK_WOULD_BE_NEGATIVE:%', v_pid;
      END IF;
    ELSE
      UPDATE pos_products SET stock = stock - v_row.qty WHERE id = v_pid;
    END IF;
  END LOOP;

  -- Dựng items cho inventory transaction (SL âm) + previousStock/newStock
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'productId', it->>'productId',
      'sku', it->>'sku',
      'name', it->>'name',
      'quantity', -COALESCE(NULLIF(it->>'quantity', '')::NUMERIC, 0),
      'previousStock', COALESCE(sb.before_stock, 0),
      'newStock', COALESCE(pp.stock, 0)
    )
  ), '[]'::JSONB)
  INTO v_inv_items
  FROM jsonb_array_elements(COALESCE(p_order->'items', '[]'::JSONB)) it
  LEFT JOIN tmp_stock_before sb ON sb.product_id = (it->>'productId')::UUID
  LEFT JOIN pos_products pp ON pp.id = (it->>'productId')::UUID;

  INSERT INTO inventory_transactions (id, date, type, staff_id, items, note, reference_id)
  VALUES (
    gen_random_uuid(), v_date, 'Sale',
    p_order->>'staffId', v_inv_items,
    'Bán hàng đơn ' || v_order_code, v_order_id::TEXT
  );

  -- COGS: giá vốn client gửi (khớp giá vốn lúc bán), fallback import_price hiện tại của SP
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_order->'items', '[]'::JSONB))
  LOOP
    v_qty := COALESCE(NULLIF(item->>'quantity', '')::NUMERIC, 0);
    IF v_qty = 0 THEN CONTINUE; END IF;
    SELECT import_price INTO v_prod_import FROM pos_products WHERE id = (item->>'productId')::UUID;
    v_import := COALESCE(NULLIF(item->>'importPrice', '')::NUMERIC, v_prod_import, 0);
    v_cogs := v_cogs + v_import * v_qty;
  END LOOP;

  -- Insert đơn hàng
  INSERT INTO pos_orders (
    id, order_code, date, customer_id, customer_name, items,
    total_amount, discount, final_amount, payment_method,
    staff_id, staff_name, created_by, channel, channel_name,
    price_book_id, price_book_name, status, notes, points_earned,
    is_return, cash_received, split_payments
  ) VALUES (
    v_order_id, v_order_code, v_date, v_customer_id, p_order->>'customerName', COALESCE(p_order->'items', '[]'::JSONB),
    v_total, v_discount, v_final, p_order->>'paymentMethod',
    p_order->>'staffId', p_order->>'staffName', COALESCE(p_order->>'createdBy', p_order->>'staffId'),
    COALESCE(p_order->>'channel', 'direct'), COALESCE(p_order->>'channelName', 'Bán trực tiếp'),
    p_order->>'priceBookId', p_order->>'priceBookName',
    COALESCE(p_order->>'status', 'completed'), p_order->>'notes',
    COALESCE((p_order->>'pointsEarned')::NUMERIC, 0),
    false, NULLIF(p_order->>'cashReceived', '')::NUMERIC, p_order->'splitPayments'
  );

  -- Ghi nợ (nếu đơn bật bán nợ)
  IF p_debt_record IS NOT NULL THEN
    INSERT INTO customer_debt_history (id, customer_id, date, order_id, type, amount, note)
    VALUES (
      COALESCE(NULLIF(p_debt_record->>'id', '')::UUID, gen_random_uuid()),
      (p_debt_record->>'customerId')::UUID,
      COALESCE(p_debt_record->>'date', v_date),
      v_order_id,
      COALESCE(p_debt_record->>'type', 'debt'),
      COALESCE((p_debt_record->>'amount')::NUMERIC, 0),
      p_debt_record->>'note'
    );
  END IF;

  -- Doanh thu: cộng dồn ATOMIC theo ngày (ON CONFLICT) — hết race 2 máy bán cùng ngày
  v_net   := GREATEST(0, v_total - v_discount);
  v_other := GREATEST(0, v_final - v_net);
  INSERT INTO revenue_records (
    id, date, total_gross_revenue, discount, revenue_other, returns_value, net_revenue, total_cogs, gross_profit
  ) VALUES (
    gen_random_uuid(), (v_date)::DATE, v_total, v_discount, v_other, 0, v_net, v_cogs, v_net + v_other - v_cogs
  )
  ON CONFLICT (date) DO UPDATE SET
    total_gross_revenue = revenue_records.total_gross_revenue + EXCLUDED.total_gross_revenue,
    discount             = revenue_records.discount + EXCLUDED.discount,
    revenue_other         = revenue_records.revenue_other + EXCLUDED.revenue_other,
    net_revenue           = revenue_records.net_revenue + EXCLUDED.net_revenue,
    total_cogs            = revenue_records.total_cogs + EXCLUDED.total_cogs,
    gross_profit          = revenue_records.gross_profit + EXCLUDED.gross_profit;

  -- Audit (best-effort)
  BEGIN
    INSERT INTO audit_logs (id, table_name, record_id, action, snapshot)
    VALUES (gen_random_uuid(), 'pos_orders', v_order_id, 'insert',
      jsonb_build_object(
        'orderCode', v_order_code,
        'finalAmount', v_final,
        'paymentMethod', p_order->>'paymentMethod',
        'reason', 'Tạo đơn hàng (RPC)',
        'actorId', p_actor_id,
        'actorName', p_actor_name
      ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION place_pos_order_tx(JSONB, JSONB, BOOLEAN, UUID, TEXT) TO authenticated;
ALTER FUNCTION place_pos_order_tx(JSONB, JSONB, BOOLEAN, UUID, TEXT) SET search_path = public;
