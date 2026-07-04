import type { InventoryTransaction, POSOrder } from '../../types';

// Guard chống trả trùng: tổng số lượng ĐÃ TRẢ theo productId của 1 đơn gốc, gom từ:
// 1. Phiếu trả POS (pos_orders isReturn) — liên kết qua originalOrderId (migration 025);
//    phiếu cũ trước migration không có originalOrderId thì nhận diện qua notes chứa mã đơn.
//    Chỉ đếm dòng hàng TRẢ (lineType !== 'exchange') — hàng đổi không phải hàng trả.
// 2. Phiếu trả kiểu cũ (inventory transaction 'Return' từ trang Trả hàng trước 2026-07-04)
//    — liên kết qua referenceId = id đơn gốc. (Transaction 'Return' của phiếu POS có
//    referenceId = id phiếu TH nên không bị đếm đôi.)
// Phiếu/transaction đã hủy (status='cancelled') không đếm.
export const getReturnedQuantitiesForOrder = (
  originalOrder: POSOrder,
  orders: POSOrder[] = [],
  transactions: InventoryTransaction[] = []
): Map<string, number> => {
  const returned = new Map<string, number>();
  const add = (productId: string, quantity: number) => {
    if (!productId || quantity <= 0) return;
    returned.set(productId, (returned.get(productId) || 0) + quantity);
  };

  orders
    .filter(
      o =>
        o.isReturn === true &&
        o.status !== 'cancelled' &&
        o.id !== originalOrder.id &&
        (o.originalOrderId === originalOrder.id ||
          (!o.originalOrderId &&
            !!originalOrder.orderCode &&
            !!o.notes &&
            o.notes.includes(originalOrder.orderCode)))
    )
    .forEach(o => {
      o.items
        .filter(item => item.lineType !== 'exchange')
        .forEach(item => add(item.productId, Math.abs(Number(item.quantity) || 0)));
    });

  transactions
    .filter(
      t =>
        (t.type === 'Return' || t.type === 'return') &&
        t.status !== 'cancelled' &&
        t.referenceId === originalOrder.id
    )
    .forEach(t => {
      (t.items || []).forEach(item => add(item.productId, Math.abs(Number(item.quantity) || 0)));
    });

  return returned;
};
