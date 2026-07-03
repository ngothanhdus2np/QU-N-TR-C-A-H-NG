import React from 'react';
import { generateId } from '../../src/lib';
import { CustomerDebtRecord, POSCustomer, POSOrder } from '../../types';
import type { InvoiceTab } from './types';

interface UseEditOrderFlowParams {
  tabs: InvoiceTab[];
  setTabs: React.Dispatch<React.SetStateAction<InvoiceTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  customers?: POSCustomer[];
  customerDebtHistory?: CustomerDebtRecord[];
}

// Mở lại 1 đơn BÁN đã tồn tại vào 1 tab hóa đơn mới ở chế độ sửa (editingOrderId) — mẫu theo
// đúng pattern handleSelectOrderReturn (usePOSReturnFlow.ts) nhưng nạp vào `cart` (bán) thay
// vì `returnCart` (trả hàng).
export const useEditOrderFlow = ({
  tabs,
  setTabs,
  setActiveTabId,
  customers = [],
  customerDebtHistory = [],
}: UseEditOrderFlowParams) => {
  const handleSelectOrderToEdit = React.useCallback(
    (order: POSOrder) => {
      const nextNum =
        Math.max(
          0,
          ...tabs.map(t => {
            const match = t.name.match(/Sửa (\d+)/);
            return match ? parseInt(match[1]) : 0;
          })
        ) + 1;
      const newId = generateId();
      const orderCustomer = order.customerId
        ? (customers.find(c => c.id === order.customerId) ?? null)
        : null;
      // Đơn gốc từng bán nợ thì mặc định giữ chế độ nợ khi mở lại sửa — tránh mất dấu công nợ.
      const wasDebtOrder = customerDebtHistory.some(
        d => d.orderId === order.id && d.type === 'debt'
      );

      setTabs(prev => [
        ...prev,
        {
          id: newId,
          name: `Sửa ${nextNum}`,
          mode: 'sales',
          // Chỉ nạp dòng bán gốc — bỏ dòng đổi hàng (nếu order này từng là 1 phần đổi hàng)
          cart: (order.items || []).filter(item => !item.lineType || item.lineType === 'sale'),
          returnCart: [],
          selectedCustomer: orderCustomer,
          // Quy hết giảm giá hóa đơn về dạng tiền cố định — không suy luận lại % gốc
          discountValue: order.discount || 0,
          discountType: 'fixed',
          paymentMethod: order.paymentMethod,
          orderNote: order.notes || '',
          otherFees: Math.max(
            0,
            (order.finalAmount || 0) -
              ((order.totalAmount || 0) - (order.discount || 0))
          ),
          cashReceived: 0,
          isDebtMode: wasDebtOrder,
          returnDiscount: 0,
          returnFee: 0,
          returnOtherRefund: 0,
          editingOrderId: order.id,
          splitPayment: order.splitPayments
            ? {
                cash: order.splitPayments.cash || 0,
                bank: order.splitPayments.bank || 0,
                card: order.splitPayments.card || 0,
                momo: order.splitPayments.momo || 0,
              }
            : { cash: 0, bank: 0, card: 0, momo: 0 },
        },
      ]);
      setActiveTabId(newId);
    },
    [customers, setActiveTabId, setTabs, tabs]
  );

  return { handleSelectOrderToEdit };
};
