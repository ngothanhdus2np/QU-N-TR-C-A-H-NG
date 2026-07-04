-- 029: Tạo 1 đơn BÁN mới (web POS) trong 1 transaction DB — Giai đoạn 2 (TXN-RPC-01),
-- luồng cuối cùng sau delete_pos_order_tx (026), cancel_pos_return_tx (027),
-- edit_pos_order_tx (028).
--
-- Thay chuỗi nhiều lời gọi mạng riêng lẻ + rollback thủ công từng bước của
-- processPlaceOrder() (services/posOrderService.ts) — insert order + ghi inventory
-- transaction & trừ tồn kho + ghi nợ (nếu có) + cộng dồn doanh thu atomic, tất cả trong
-- 1 transaction. Không trùng với pos_mobile_checkout (019) — RPC đó dành riêng cho POS
-- mobile (staff cố định 'mobile-cashier', tự tính tier cứng trong SQL); RPC này giữ
-- nguyên order đã dựng sẵn từ client (items/giá/PTTT... không đổi được ở mobile flow).
--
-- KHÔNG xử lý: cập nhật điểm/hạng khách hàng (computeNewTier() đọc cấu hình hạng từ
-- localStorage trình duyệt — server không truy cập được) và tính sales_records — vẫn
-- là các lời gọi mạng riêng ngay sau RPC này, phía client (xem posOrderService.ts),
-- cùng ranh giới với edit_pos_order_tx.

CREATE OR REPLACE FUNCTION place_pos_order_tx(
  p_order JSONB,
  p_debt_record JSONB DEFAULT NULL,
  p_allow_sell_out_of_stock BOOLEAN DEFAULT false
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
        'reason', 'Tạo đơn hàng (RPC)'
      ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION place_pos_order_tx(JSONB, JSONB, BOOLEAN) TO authenticated;
ALTER FUNCTION place_pos_order_tx(JSONB, JSONB, BOOLEAN) SET search_path = public;
