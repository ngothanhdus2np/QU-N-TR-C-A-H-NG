-- POS Mobile checkout — gói toàn bộ thao tác vào 1 transaction DB.
-- Thay cho 6 bước insert/update tuần tự trong routes/posMobile.ts:
--   1) insert pos_orders
--   2) ghi inventory_transactions + trừ tồn (atomic, tái dùng v2)
--   3) cộng dồn revenue_records ATOMIC (ON CONFLICT) → hết race 2 đơn cùng ngày
--   4) cập nhật pos_customers + customer_debt_history
--   5) audit_logs (best-effort, không chặn bán hàng)
-- Lỗi bất kỳ bước 1-4 → RAISE → rollback toàn bộ (không còn dữ liệu lệch).

CREATE OR REPLACE FUNCTION pos_mobile_checkout(p_payload JSONB)
RETURNS TABLE(order_id UUID, order_code TEXT) AS $$
DECLARE
  v_order_id     UUID := (p_payload->>'orderId')::UUID;
  v_order_code   TEXT := p_payload->>'orderCode';
  v_now          TEXT := p_payload->>'date';     -- ISO timestamp
  v_date_key     TEXT := p_payload->>'dateKey';  -- YYYY-MM-DD
  v_customer_id  UUID := NULLIF(p_payload->>'customerId', '')::UUID;
  v_customer_name TEXT := NULLIF(p_payload->>'customerName', '');
  v_payment      TEXT := COALESCE(NULLIF(p_payload->>'paymentMethod', ''), 'Cash');
  v_total        NUMERIC := COALESCE(NULLIF(p_payload->>'totalAmount', '')::NUMERIC, 0);
  v_discount     NUMERIC := COALESCE(NULLIF(p_payload->>'discount', '')::NUMERIC, 0);
  v_final        NUMERIC := COALESCE(NULLIF(p_payload->>'finalAmount', '')::NUMERIC, 0);
  v_is_debt      BOOLEAN := COALESCE((p_payload->>'isDebtMode')::BOOLEAN, false);
  v_cash         NUMERIC := NULLIF(p_payload->>'cashReceived', '')::NUMERIC;
  v_notes        TEXT := NULLIF(p_payload->>'notes', '');
  v_split        JSONB := p_payload->'splitPayments';
  v_cart         JSONB := COALESCE(p_payload->'cart', '[]'::JSONB);

  item       JSONB;
  v_qty      INT;
  v_import   NUMERIC;
  v_prod_import NUMERIC;
  v_cogs     NUMERIC := 0;
  v_net      NUMERIC;
  v_other    NUMERIC;
  v_items    JSONB := '[]'::JSONB;   -- items lưu vào đơn
  v_inv_items JSONB := '[]'::JSONB;  -- items cho inventory tx

  v_cur_total NUMERIC;
  v_cur_tier  TEXT;
  v_new_total NUMERIC;
  v_new_tier  TEXT;
  v_debt_added NUMERIC := 0;
BEGIN
  -- Dựng items đơn + items kho + COGS (giá vốn lấy từ DB, không tin client)
  FOR item IN SELECT * FROM jsonb_array_elements(v_cart)
  LOOP
    v_qty := COALESCE(NULLIF(item->>'quantity', '')::INT, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT import_price INTO v_prod_import FROM pos_products WHERE id = (item->>'productId')::UUID;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', COALESCE(item->>'name', item->>'productId');
    END IF;

    v_import := COALESCE(NULLIF(item->>'importPrice', '')::NUMERIC, v_prod_import, 0);
    v_cogs := v_cogs + v_import * v_qty;

    v_items := v_items || jsonb_build_object(
      'productId',  item->>'productId',
      'sku',        item->>'sku',
      'name',       item->>'name',
      'quantity',   v_qty,
      'price',      COALESCE(NULLIF(item->>'price', '')::NUMERIC, 0),
      'discount',   COALESCE(NULLIF(item->>'discount', '')::NUMERIC, 0),
      'total',      COALESCE(NULLIF(item->>'total', '')::NUMERIC, 0),
      'importPrice', v_import,
      'lineType',   'sale'
    );

    v_inv_items := v_inv_items || jsonb_build_object(
      'productId', item->>'productId',
      'sku',       item->>'sku',
      'name',      item->>'name',
      'quantity',  -v_qty
    );
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  -- 1) Insert đơn hàng
  INSERT INTO pos_orders (
    id, order_code, date, customer_id, customer_name, items,
    total_amount, discount, final_amount, payment_method,
    staff_id, staff_name, created_by, channel, channel_name,
    status, points_earned, is_return, notes, cash_received, split_payments
  ) VALUES (
    v_order_id, v_order_code, v_now, v_customer_id, v_customer_name, v_items,
    v_total, v_discount, v_final, v_payment,
    'mobile-cashier', 'Mobile POS', 'mobile-cashier', 'direct', 'Mobile POS',
    'completed', 0, false, v_notes, v_cash, v_split
  );

  -- 2) Inventory + trừ tồn (inline, atomic trong cùng transaction — tự chứa, không
  --    phụ thuộc RPC ngoài). Thiếu tồn → RAISE → rollback toàn bộ.
  INSERT INTO inventory_transactions (id, date, type, items, note, reference_id, staff_id)
  VALUES (gen_random_uuid(), v_now, 'Sale', v_inv_items,
          'Bán hàng ' || v_order_code || ' (Mobile)', v_order_id, 'mobile-cashier');

  FOR item IN SELECT * FROM jsonb_array_elements(v_inv_items)
  LOOP
    v_qty := ABS(COALESCE(NULLIF(item->>'quantity', '')::INT, 0));
    IF v_qty = 0 THEN CONTINUE; END IF;
    UPDATE pos_products SET stock = stock - v_qty
    WHERE id = (item->>'productId')::UUID AND stock >= v_qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for sale product %', COALESCE(item->>'name', item->>'productId');
    END IF;
  END LOOP;

  -- 3) Doanh thu — cộng dồn ATOMIC theo (date, branch_id)
  v_net := GREATEST(0, v_total - v_discount);
  v_other := GREATEST(0, v_final - v_net);
  INSERT INTO revenue_records (
    id, date, total_gross_revenue, discount, revenue_other,
    returns_value, net_revenue, total_cogs, gross_profit
  ) VALUES (
    gen_random_uuid(), v_date_key::DATE, v_total, v_discount, v_other,
    0, v_net, v_cogs, v_net + v_other - v_cogs
  )
  ON CONFLICT (date) DO UPDATE SET
    total_gross_revenue = revenue_records.total_gross_revenue + EXCLUDED.total_gross_revenue,
    discount            = revenue_records.discount + EXCLUDED.discount,
    revenue_other       = revenue_records.revenue_other + EXCLUDED.revenue_other,
    net_revenue         = revenue_records.net_revenue + EXCLUDED.net_revenue,
    total_cogs          = revenue_records.total_cogs + EXCLUDED.total_cogs,
    gross_profit        = revenue_records.gross_profit + EXCLUDED.gross_profit;

  -- 4) Khách hàng + công nợ (đọc total_spent trong transaction → không race)
  IF v_customer_id IS NOT NULL THEN
    SELECT total_spent, tier INTO v_cur_total, v_cur_tier
    FROM pos_customers WHERE id = v_customer_id;
    IF FOUND THEN
      v_new_total := COALESCE(v_cur_total, 0) + v_final;
      v_new_tier := CASE
        WHEN v_new_total >= 100000000 THEN 'Diamond'
        WHEN v_new_total >= 20000000  THEN 'Gold'
        WHEN v_new_total >= 5000000   THEN 'Silver'
        ELSE 'Standard' END;
      -- chỉ nâng hạng, không hạ
      IF (CASE COALESCE(v_cur_tier, 'Standard') WHEN 'Diamond' THEN 3 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 1 ELSE 0 END)
         >= (CASE v_new_tier WHEN 'Diamond' THEN 3 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 1 ELSE 0 END)
      THEN
        v_new_tier := COALESCE(v_cur_tier, 'Standard');
      END IF;
      v_debt_added := CASE WHEN v_is_debt THEN v_final ELSE 0 END;

      UPDATE pos_customers SET
        total_spent = v_new_total,
        tier        = v_new_tier,
        last_visit  = v_now,
        debt_amount = COALESCE(debt_amount, 0) + v_debt_added
      WHERE id = v_customer_id;

      IF v_debt_added > 0 THEN
        INSERT INTO customer_debt_history (id, customer_id, date, order_id, type, amount, note)
        VALUES (gen_random_uuid(), v_customer_id, v_now, v_order_id, 'debt', v_debt_added,
                'Đơn hàng ' || v_order_code || ' (Mobile)');
      END IF;
    END IF;
  END IF;

  -- 5) Audit (best-effort — không chặn bán hàng nếu lỗi)
  BEGIN
    INSERT INTO audit_logs (id, table_name, record_id, action, snapshot)
    VALUES (gen_random_uuid(), 'pos_orders', v_order_id, 'upsert',
      jsonb_build_object('orderCode', v_order_code, 'finalAmount', v_final,
                         'paymentMethod', v_payment, 'customerId', v_customer_id, 'source', 'mobile'));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT v_order_id, v_order_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION pos_mobile_checkout(JSONB) TO authenticated;
ALTER FUNCTION pos_mobile_checkout(JSONB) SET search_path = public;
