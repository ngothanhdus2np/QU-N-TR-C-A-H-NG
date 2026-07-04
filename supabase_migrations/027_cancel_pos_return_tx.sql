-- 027: Hủy phiếu trả hàng (TH receipt trong pos_orders) trong 1 transaction DB —
-- Giai đoạn 2 (TXN-RPC-01), luồng thứ 2 sau delete_pos_order_tx (026).
--
-- Thay chuỗi nhiều lời gọi mạng riêng lẻ của processCancelReturn (services/posOrderService.ts) —
-- đảo tồn kho + đảo doanh thu + khôi phục khách + soft-delete phiếu. Lỗi bất kỳ → RAISE → rollback
-- toàn bộ. Chỉ áp dụng cho phiếu trả CHUẨN (TH receipt trong pos_orders, is_return=true) — KHÔNG
-- xử lý phiếu trả kiểu cũ (chỉ có inventory transaction, processCancelLegacyReturnTransaction).
--
-- sales_records (doanh số NV) KHÔNG nằm trong RPC — client tính lại best-effort sau, cùng ranh
-- giới delete_pos_order_tx/pos_mobile_checkout.
--
-- Soft-delete: phiếu chuyển status='cancelled' (không xóa, giữ lịch sử). Inventory transaction
-- liên quan cũng đánh dấu cancelled (không xóa hẳn — giữ vết cho audit kho).
-- Đảo tồn kho theo tx.type đã lưu: 'Return' (hàng trả) → TRỪ lại kho (khách lấy lại hàng, guard
-- không âm — hàng trả đã bán tiếp thì chặn); 'Sale' (hàng đổi) → CỘNG lại kho.
-- Đảo doanh thu = nghịch đảo đúng của buildReturnRevenueDelta (xem posOrderService.ts).

CREATE OR REPLACE FUNCTION cancel_pos_return_tx(p_return_order_id UUID)
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
      jsonb_build_object('orderCode', v_order.order_code, 'reason', 'Hủy phiếu trả hàng (soft-delete, RPC)'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT p_return_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_pos_return_tx(UUID) TO authenticated;
ALTER FUNCTION cancel_pos_return_tx(UUID) SET search_path = public;
