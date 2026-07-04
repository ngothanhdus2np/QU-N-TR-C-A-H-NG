-- 025: Persist liên kết phiếu trả → đơn gốc + phí trả hàng trên pos_orders
--
-- Bối cảnh: POSOrder trong app có originalOrderId/returnFee/returnOtherRefund nhưng
-- apiService/dataMapper không map → mất sau khi tải lại trang. Guard chống trả trùng
-- (trả cùng 1 đơn nhiều lần) và phép đảo khi hủy phiếu trả cần các cột này tồn tại thật.

ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS original_order_id TEXT;
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS return_fee NUMERIC;
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS return_other_refund NUMERIC;

-- Tra cứu "đơn X đã có những phiếu trả nào" — dùng bởi guard trả trùng
CREATE INDEX IF NOT EXISTS idx_pos_orders_original_order_id
  ON pos_orders (original_order_id)
  WHERE original_order_id IS NOT NULL;
