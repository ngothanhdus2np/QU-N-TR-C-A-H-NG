-- Atomic inventory transaction RPC for cashier/purchase operations.
-- Run this migration on Supabase before relying on database-level atomic stock updates.

CREATE OR REPLACE FUNCTION apply_inventory_transaction_with_stock_v2(
  p_transaction JSONB
) RETURNS TABLE(transaction_id UUID, date TEXT, type TEXT) AS $$
DECLARE
  item JSONB;
  tx_id UUID := (p_transaction->>'id')::UUID;
  tx_type TEXT := p_transaction->>'type';
  allow_negative_stock BOOLEAN := COALESCE((p_transaction->>'allow_negative_stock')::BOOLEAN, false);
  product_id UUID;
  quantity INT;
  next_import_price NUMERIC;
  item_sku TEXT;
BEGIN
  INSERT INTO inventory_transactions (
    id,
    date,
    type,
    items,
    note,
    reference_id,
    staff_id,
    supplier_id,
    supplier_name,
    total_amount,
    status,
    balanced_date,
    total_actual_qty,
    total_diff,
    increase_count,
    decrease_count
  )
  VALUES (
    tx_id,
    p_transaction->>'date',
    tx_type,
    COALESCE(p_transaction->'items', '[]'::JSONB),
    p_transaction->>'note',
    p_transaction->>'reference_id',
    p_transaction->>'staff_id',
    p_transaction->>'supplier_id',
    p_transaction->>'supplier_name',
    COALESCE(NULLIF(p_transaction->>'total_amount', '')::NUMERIC, 0),
    p_transaction->>'status',
    p_transaction->>'balanced_date',
    NULLIF(p_transaction->>'total_actual_qty', '')::NUMERIC,
    NULLIF(p_transaction->>'total_diff', '')::NUMERIC,
    NULLIF(p_transaction->>'increase_count', '')::NUMERIC,
    NULLIF(p_transaction->>'decrease_count', '')::NUMERIC
  )
  ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    type = EXCLUDED.type,
    items = EXCLUDED.items,
    note = EXCLUDED.note,
    reference_id = EXCLUDED.reference_id,
    staff_id = EXCLUDED.staff_id,
    supplier_id = EXCLUDED.supplier_id,
    supplier_name = EXCLUDED.supplier_name,
    total_amount = EXCLUDED.total_amount,
    status = EXCLUDED.status,
    balanced_date = EXCLUDED.balanced_date,
    total_actual_qty = EXCLUDED.total_actual_qty,
    total_diff = EXCLUDED.total_diff,
    increase_count = EXCLUDED.increase_count,
    decrease_count = EXCLUDED.decrease_count;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_transaction->'items', '[]'::JSONB))
  LOOP
    product_id := (item->>'productId')::UUID;
    quantity := ABS(COALESCE(NULLIF(item->>'quantity', '')::INT, 0));
    next_import_price := NULLIF(item->>'nextImportPrice', '')::NUMERIC;
    item_sku := NULLIF(item->>'sku', '');

    IF product_id IS NULL OR quantity = 0 THEN
      CONTINUE;
    END IF;

    IF tx_type = 'Import' THEN
      UPDATE pos_products
      SET
        stock = pos_products.stock + quantity,
        import_price = COALESCE(next_import_price, pos_products.import_price)
      WHERE pos_products.id = product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', product_id;
      END IF;

      IF item_sku IS NOT NULL AND COALESCE(NULLIF(item->>'price', '')::NUMERIC, 0) > 0 THEN
        INSERT INTO product_cost_history (
          id,
          sku,
          product_id,
          import_price,
          effective_date,
          source
        )
        VALUES (
          gen_random_uuid(),
          item_sku,
          product_id,
          COALESCE(NULLIF(item->>'price', '')::NUMERIC, 0),
          LEFT(COALESCE(p_transaction->>'date', NOW()::TEXT), 10)::DATE,
          'purchase'
        );
      END IF;
    ELSIF tx_type = 'PurchaseReturn' THEN
      UPDATE pos_products
      SET stock = pos_products.stock - quantity
      WHERE pos_products.id = product_id
        AND pos_products.stock >= quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock for purchase return product %', product_id;
      END IF;
    ELSIF tx_type = 'Sale' THEN
      IF allow_negative_stock THEN
        UPDATE pos_products
        SET stock = pos_products.stock - quantity
        WHERE pos_products.id = product_id;
      ELSE
        UPDATE pos_products
        SET stock = pos_products.stock - quantity
        WHERE pos_products.id = product_id
          AND pos_products.stock >= quantity;
      END IF;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock for sale product %', product_id;
      END IF;
    ELSIF tx_type = 'Return' THEN
      UPDATE pos_products
      SET stock = pos_products.stock + quantity
      WHERE pos_products.id = product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', product_id;
      END IF;
    ELSIF tx_type = 'Check' THEN
      UPDATE pos_products
      SET stock = GREATEST(0, COALESCE(NULLIF(item->>'newStock', '')::INT, pos_products.stock))
      WHERE pos_products.id = product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', product_id;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT tx_id, p_transaction->>'date', tx_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_inventory_transaction_with_stock_v2(
  p_transaction_id UUID
) RETURNS TABLE(id UUID) AS $$
DECLARE
  tx inventory_transactions%ROWTYPE;
  item JSONB;
  product_id UUID;
  quantity INT;
BEGIN
  SELECT * INTO tx FROM inventory_transactions WHERE inventory_transactions.id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF COALESCE(tx.status, '') <> 'cancelled' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(tx.items, '[]'::JSONB))
    LOOP
      product_id := (item->>'productId')::UUID;
      quantity := ABS(COALESCE(NULLIF(item->>'quantity', '')::INT, 0));

      IF product_id IS NULL OR quantity = 0 THEN
        CONTINUE;
      END IF;

      IF tx.type = 'Import' THEN
        UPDATE pos_products
        SET stock = pos_products.stock - quantity
        WHERE pos_products.id = product_id
          AND pos_products.stock >= quantity;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Cannot delete import; stock would become negative for product %', product_id;
        END IF;
      ELSIF tx.type = 'PurchaseReturn' THEN
        UPDATE pos_products
        SET stock = pos_products.stock + quantity
        WHERE pos_products.id = product_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Product % not found', product_id;
        END IF;
      ELSIF tx.type = 'Sale' THEN
        UPDATE pos_products
        SET stock = pos_products.stock + quantity
        WHERE pos_products.id = product_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Product % not found', product_id;
        END IF;
      ELSIF tx.type = 'Return' THEN
        UPDATE pos_products
        SET stock = pos_products.stock - quantity
        WHERE pos_products.id = product_id
          AND pos_products.stock >= quantity;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Cannot delete return; stock would become negative for product %', product_id;
        END IF;
      ELSIF tx.type = 'Check' THEN
        UPDATE pos_products
        SET stock = GREATEST(0, COALESCE(NULLIF(item->>'previousStock', '')::INT, pos_products.stock))
        WHERE pos_products.id = product_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Product % not found', product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  DELETE FROM inventory_transactions WHERE inventory_transactions.id = p_transaction_id;
  RETURN QUERY SELECT p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION apply_inventory_transaction_with_stock_v2(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_inventory_transaction_with_stock_v2(UUID) TO authenticated;

ALTER FUNCTION apply_inventory_transaction_with_stock_v2(JSONB) SET search_path = public;
ALTER FUNCTION delete_inventory_transaction_with_stock_v2(UUID) SET search_path = public;
