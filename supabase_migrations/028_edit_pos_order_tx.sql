-- 028: Sửa 1 đơn BÁN đã tồn tại trong 1 transaction DB — Giai đoạn 2 (TXN-RPC-01),
-- luồng thứ 3 sau delete_pos_order_tx (026) và cancel_pos_return_tx (027).
--
-- Thay chuỗi nhiều lời gọi mạng riêng lẻ của editPosOrder (services/posOrderService.ts) —
-- hoàn tồn kho đơn cũ + ghi tồn kho đơn mới + xóa/ghi nợ + ghi đè đơn + đảo doanh thu, tất cả
-- trong 1 transaction. Giữ NGUYÊN id/order_code/date (không cho đổi ngày bán).
--
-- KHÔNG xử lý: cập nhật điểm/hạng khách hàng (computeNewTier() đọc cấu hình hạng từ
-- localStorage trình duyệt — server không truy cập được) — vẫn là 1 lời gọi mạng riêng
-- ngay sau RPC này, phía client (xem posOrderService.ts). sales_records cũng ngoài phạm vi
-- RPC, tính lại best-effort sau — cùng ranh giới delete_pos_order_tx/cancel_pos_return_tx.
--
-- [ORDERS-EDIT-02] Guard chặn sửa SL thấp hơn SL đã trả được viết LẠI ở đây bằng SQL (không chỉ
-- dựa vào check phía JS) — RPC tự xác minh độc lập, không tin tưởng hoàn toàn dữ liệu client gửi.

CREATE OR REPLACE FUNCTION edit_pos_order_tx(
  p_order_id UUID,
  p_updated_order JSONB,
  p_debt_record JSONB DEFAULT NULL,
  p_allow_sell_out_of_stock BOOLEAN DEFAULT false
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
        'reason', 'Sửa đơn hàng (RPC)'
      ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION edit_pos_order_tx(UUID, JSONB, JSONB, BOOLEAN) TO authenticated;
ALTER FUNCTION edit_pos_order_tx(UUID, JSONB, JSONB, BOOLEAN) SET search_path = public;
