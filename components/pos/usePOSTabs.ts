import React from 'react';
import { generateId } from '../../businessLogic';
import type { InvoiceTab } from './POSComputer';

type ConfirmConfig = {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmLabel?: string;
  onConfirm: () => void;
};

interface UsePOSTabsParams {
  tabs: InvoiceTab[];
  activeTabId: string;
  setTabs: React.Dispatch<React.SetStateAction<InvoiceTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  openConfirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;
}

const createEmptySalesTab = (id: string, name: string): InvoiceTab => ({
  id,
  name,
  mode: 'sales',
  cart: [],
  returnCart: [],
  selectedCustomer: null,
  discountValue: 0,
  discountType: 'percent',
  paymentMethod: 'Cash',
  orderNote: '',
  otherFees: 0,
  cashReceived: 0,
  returnDiscount: 0,
  returnFee: 0,
  returnOtherRefund: 0,
  splitPayment: { cash: 0, bank: 0, card: 0, momo: 0 }
});

export const usePOSTabs = ({
  tabs,
  activeTabId,
  setTabs,
  setActiveTabId,
  openConfirm,
  closeConfirm,
}: UsePOSTabsParams) => {
  const updateActiveTab = React.useCallback((updates: Partial<InvoiceTab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  }, [activeTabId, setTabs]);

  const addNewTab = React.useCallback(() => {
    const nextNum = Math.max(0, ...tabs.map(t => {
      const match = t.name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })) + 1;
    const newId = generateId();
    setTabs(prev => [...prev, createEmptySalesTab(newId, `Hóa đơn ${nextNum}`)]);
    setActiveTabId(newId);
  }, [setActiveTabId, setTabs, tabs]);

  const performCloseTab = React.useCallback((id: string) => {
    if (tabs.length === 1) {
      setTabs([createEmptySalesTab('default', 'Hóa đơn 1')]);
      setActiveTabId('default');
      return;
    }

    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id);
    }
  }, [activeTabId, setActiveTabId, setTabs, tabs]);

  const closeTab = React.useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const tabToClose = tabs.find(t => t.id === id);

    if (tabToClose && (tabToClose.cart.length > 0 || (tabToClose.returnCart && tabToClose.returnCart.length > 0))) {
      openConfirm({
        title: 'Xác nhận đóng hóa đơn',
        message: `Hóa đơn "${tabToClose.name}" đang có ${tabToClose.cart.length + (tabToClose.returnCart?.length || 0)} sản phẩm. Bạn có chắc chắn muốn đóng?`,
        variant: 'warning',
        confirmLabel: 'Đóng hóa đơn',
        onConfirm: () => {
          performCloseTab(id);
          closeConfirm();
        }
      });
      return;
    }

    performCloseTab(id);
  }, [closeConfirm, openConfirm, performCloseTab, tabs]);

  return {
    updateActiveTab,
    addNewTab,
    closeTab,
    performCloseTab,
  };
};
