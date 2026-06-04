import React, { useMemo } from 'react';
import { generateId } from '../../src/lib';
import { POSProduct, POSOrder } from '../../types';
import type { InvoiceTab } from './types';

interface UsePOSReturnFlowParams {
  activeTabId: string;
  tabs: InvoiceTab[];
  returnCart: InvoiceTab['returnCart'];
  netPayable: number;
  returnDiscount: number;
  returnFee: number;
  returnOtherRefund: number;
  setTabs: React.Dispatch<React.SetStateAction<InvoiceTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  setShowReturnModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePOSReturnFlow = ({
  activeTabId,
  tabs,
  returnCart,
  netPayable,
  returnDiscount,
  returnFee,
  returnOtherRefund,
  setTabs,
  setActiveTabId,
  setShowReturnModal,
}: UsePOSReturnFlowParams) => {
  const addToReturnCart = React.useCallback(
    (product: POSProduct) => {
      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          const prevCart = t.returnCart || [];
          const existing = prevCart.find(item => item.productId === product.id);
          let newCart;
          if (existing) {
            newCart = prevCart.map(item =>
              item.productId === product.id
                ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
                : item
            );
          } else {
            newCart = [
              ...prevCart,
              {
                productId: product.id,
                sku: product.sku,
                name: product.name,
                quantity: 1,
                price: product.salePrice,
                discount: 0,
                total: product.salePrice,
              },
            ];
          }
          return { ...t, returnCart: newCart };
        })
      );
    },
    [activeTabId, setTabs]
  );

  const updateReturnQuantity = React.useCallback(
    (productId: string, delta: number) => {
      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          const newCart = (t.returnCart || []).map(item => {
            if (item.productId === productId) {
              const max = item.maxQuantity ?? Infinity;
              const newQty = Math.max(0, Math.min(max, item.quantity + delta));
              return { ...item, quantity: newQty, total: newQty * item.price };
            }
            return item;
          });
          return { ...t, returnCart: newCart };
        })
      );
    },
    [activeTabId, setTabs]
  );

  const removeFromReturnCart = React.useCallback(
    (productId: string) => {
      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          const newCart = (t.returnCart || []).filter(item => item.productId !== productId);
          return { ...t, returnCart: newCart };
        })
      );
    },
    [activeTabId, setTabs]
  );

  const totalReturnBeforeDiscount = useMemo(
    () => returnCart.reduce((acc, item) => acc + item.total, 0),
    [returnCart]
  );

  const finalReturnAmount = Math.max(
    0,
    totalReturnBeforeDiscount - returnDiscount - returnFee + returnOtherRefund
  );
  const netReturnDifference = finalReturnAmount - netPayable;
  const amountToPayCustomer = netReturnDifference > 0 ? netReturnDifference : 0;
  const customerPaysDifference = netReturnDifference < 0 ? Math.abs(netReturnDifference) : 0;

  const handleSelectOrderReturn = React.useCallback(
    (order: POSOrder) => {
      const nextNum =
        Math.max(
          0,
          ...tabs.map(t => {
            const match = t.name.match(/Trả hàng (\d+)/);
            return match ? parseInt(match[1]) : 0;
          })
        ) + 1;
      const newId = generateId();
      setTabs(prev => [
        ...prev,
        {
          id: newId,
          name: `Trả hàng ${nextNum}`,
          mode: 'return',
          cart: [],
          returnCart: order.items.map(item => ({
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            quantity: 0,
            price: item.price,
            discount: item.discount,
            total: 0,
            maxQuantity: item.quantity,
          })),
          selectedCustomer: null,
          discountValue: 0,
          discountType: 'fixed',
          paymentMethod: 'Cash',
          orderNote: '',
          otherFees: 0,
          cashReceived: 0,
          isDebtMode: false,
          returnDiscount: 0,
          returnFee: 0,
          returnOtherRefund: 0,
          splitPayment: { cash: 0, bank: 0, card: 0, momo: 0 },
        },
      ]);
      setActiveTabId(newId);
      setShowReturnModal(false);
    },
    [setActiveTabId, setShowReturnModal, setTabs, tabs]
  );

  const handleReturnFast = React.useCallback(() => {
    const nextNum =
      Math.max(
        0,
        ...tabs.map(t => {
          const match = t.name.match(/Trả hàng (\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
      ) + 1;
    const newId = generateId();
    setTabs(prev => [
      ...prev,
      {
        id: newId,
        name: `Trả hàng ${nextNum}`,
        mode: 'return',
        cart: [],
        returnCart: [],
        selectedCustomer: null,
        discountValue: 0,
        discountType: 'fixed',
        paymentMethod: 'Cash',
        orderNote: '',
        otherFees: 0,
        cashReceived: 0,
        isDebtMode: false,
        returnDiscount: 0,
        returnFee: 0,
        returnOtherRefund: 0,
        splitPayment: { cash: 0, bank: 0, card: 0, momo: 0 },
      },
    ]);
    setActiveTabId(newId);
    setShowReturnModal(false);
  }, [setActiveTabId, setShowReturnModal, setTabs, tabs]);

  return {
    addToReturnCart,
    updateReturnQuantity,
    removeFromReturnCart,
    totalReturnBeforeDiscount,
    finalReturnAmount,
    amountToPayCustomer,
    customerPaysDifference,
    handleSelectOrderReturn,
    handleReturnFast,
  };
};
