-- 026: Hủy (soft-delete) 1 đơn BÁN trong 1 transaction DB — Giai đoạn 2 (TXN-RPC-01).
--
-- Thay chuỗi 4-5 lời gọi mạng riêng lẻ của deletePosOrder (services/posOrderService.ts) —
-- vốn có cửa sổ lệch nếu rớt mạng giữa chừng (đơn cancelled nhưng tồn chưa hoàn, v.v.).
-- Gói TẤT CẢ phần có-thể-lệch vào 1 transaction: trạng thái đơn + tồn kho + doanh thu +
-- khách + nợ. Lỗi bất kỳ → RAISE → rollback toàn bộ.
--
-- sales_records (doanh số NV) KHÔNG nằm trong RPC — client tính lại best-effort sau (idempotent,
-- không tới hạn; logic phân bổ theo dòng quá phức tạp để bê sang SQL). Cùng ranh giới
-- pos_mobile_checkout.
--
-- Soft-delete: đơn chuyển status='cancelled' (không xóa), inventory transaction Sale gắn đơn
-- cũng đánh dấu cancelled (giữ lịch sử kho). Đảo revenue/khách bằng công thức nghịch của
-- buildRevenueDelta + phần POSComputer cộng lúc tạo đơn.

CREATE OR REPLACE FUNCTION delete_pos_order_tx(p_order_id UUID)
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
                         'reason', 'Xóa đơn hàng (soft-delete, RPC)'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_pos_order_tx(UUID) TO authenticated;
ALTER FUNCTION delete_pos_order_tx(UUID) SET search_path = public;
