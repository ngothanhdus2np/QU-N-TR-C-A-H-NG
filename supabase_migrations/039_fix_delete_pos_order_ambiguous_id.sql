-- Fix: delete_pos_order_tx báo lỗi "column reference \"id\" is ambiguous" (42702).
-- RETURNS TABLE (id UUID) tạo biến PL/pgSQL tên "id" trùng với cột id của
-- pos_products/inventory_transactions/pos_customers/pos_orders. Các câu UPDATE
-- ... WHERE id = ... (không ghi rõ tên bảng) bị Postgres coi là mơ hồ.
-- Bug này có từ migration 030 nhưng bị che bởi lỗi debt_amount (migration 038 đã
-- sửa) — giờ mới lộ ra khi test xóa đơn có khách hàng/tồn kho thật.
-- Migration này chỉ qualify tên bảng cho các dòng WHERE id = ..., không đổi logic.

CREATE OR REPLACE FUNCTION delete_pos_order_tx(
  p_order_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID) AS $$
DECLARE
  v_order pos_orders%ROWTYPE;
  v_date_key DATE;
  item JSONB;
  v_qty INT;
  v_prod_imp NUMERIC;
  v_import NUMERIC;
  v_cogs NUMERIC := 0;
  v_net NUMERIC;
  v_other NUMERIC;
  tx RECORD;
BEGIN
  SELECT * INTO v_order FROM pos_orders WHERE pos_orders.id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn hàng không tồn tại: %', p_order_id;
  END IF;
  v_date_key := (v_order.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;

  -- 1) Hoàn tồn kho + hủy các inventory_transactions liên quan đơn này
  FOR tx IN SELECT * FROM inventory_transactions WHERE reference_id = p_order_id::TEXT AND status <> 'cancelled'
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(tx.items, '[]'::JSONB))
    LOOP
      v_qty := ABS(COALESCE(NULLIF(item->>'quantity', '')::INT, 0));
      IF v_qty = 0 THEN CONTINUE; END IF;
      UPDATE pos_products SET stock = stock + v_qty WHERE pos_products.id = (item->>'productId')::UUID;
    END LOOP;
    UPDATE inventory_transactions SET status = 'cancelled' WHERE inventory_transactions.id = tx.id;
  END LOOP;

  -- 2) COGS đơn = Σ importPrice × quantity (ưu tiên importPrice lưu trong item, fallback giá vốn SP)
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::JSONB))
  LOOP
    v_qty := COALESCE(NULLIF(item->>'quantity', '')::INT, 0);
    IF v_qty = 0 THEN CONTINUE; END IF;
    SELECT import_price INTO v_prod_imp FROM pos_products WHERE pos_products.id = (item->>'productId')::UUID;
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
  --    KHÔNG đụng debt_amount — cột không tồn tại trên DB, nguồn sự thật là customer_debt_history.
  IF v_order.customer_id IS NOT NULL THEN
    UPDATE pos_customers SET
      points      = GREATEST(0, COALESCE(points, 0) - COALESCE(v_order.points_earned, 0)),
      total_spent = GREATEST(0, COALESCE(total_spent, 0) - COALESCE(v_order.final_amount, 0))
    WHERE pos_customers.id = v_order.customer_id;
  END IF;

  DELETE FROM customer_debt_history WHERE customer_debt_history.order_id = p_order_id;

  -- 5) Soft-delete đơn
  UPDATE pos_orders SET status = 'cancelled' WHERE pos_orders.id = p_order_id;

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
