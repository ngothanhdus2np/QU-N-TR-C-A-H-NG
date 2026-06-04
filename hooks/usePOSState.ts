import { useState, useEffect, useMemo } from 'react';
import { POSPaymentSettings, POSOrder } from '../types';
import { QuickCustomerForm } from '../components/pos/POSQuickCustomerModal';
import { ItemDiscountPopupState } from '../components/pos/POSItemDiscountPopup';
import { InvoiceTab } from '../components/pos/types';

interface UsePOSStateProps {
  paymentSettings?: POSPaymentSettings;
  isActive?: boolean;
}

export function usePOSState({ paymentSettings, isActive = true }: UsePOSStateProps) {
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [productSearchSort, setProductSearchSort] = useState<'skuDesc' | 'priceDesc'>('skuDesc');
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [showConsultant, setShowConsultant] = useState(false);

  // Multi-tab state
  const [tabs, setTabs] = useState<InvoiceTab[]>([
    {
      id: 'default',
      name: 'Hóa đơn 1',
      mode: 'sales',
      cart: [],
      returnCart: [],
      selectedCustomer: null,
      discountValue: 0,
      discountType: 'percent',
      paymentMethod: paymentSettings?.defaultMethod || 'Cash',
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
  const [activeTabId, setActiveTabId] = useState('default');

  // Active Tab Data Accessor
  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // Modal states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState<QuickCustomerForm>({
    code: '',
    name: '',
    phone: '',
    group: 'Khách lẻ',
    birthday: '',
    gender: '',
    address: '',
    province: '',
    district: '',
    ward: '',
    taxCode: '',
    email: '',
    facebook: '',
    notes: '',
  });
  const [useSplitPayment, setUseSplitPayment] = useState(false);

  // UI states
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [billDiscountRect, setBillDiscountRect] = useState<DOMRect | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isCheckoutLocked, setIsCheckoutLocked] = useState(false);

  // Item-level discount popup
  const [itemDiscountPopup, setItemDiscountPopup] = useState<ItemDiscountPopupState | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showEODReport, setShowEODReport] = useState(false);
  const [showProcessOrdersModal, setShowProcessOrdersModal] = useState(false);
  const [showProcessRepairsModal, setShowProcessRepairsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showSelectInvoiceModal, setShowSelectInvoiceModal] = useState(false);
  const [selectedCartIndex, setSelectedCartIndex] = useState(-1);
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(true);
  const [lastOrder, setLastOrder] = useState<POSOrder | null>(null);

  // Search state enhancements
  const [showProductResults, setShowProductResults] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

  // Feedback states
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [stockWarning, setStockWarning] = useState<string | null>(null);

  // Mobile checkout sheet
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Close grid menu when switching tabs
  useEffect(() => {
    setShowGridMenu(false);
  }, [isActive]);

  // Helper functions
  const openConfirm = (config: Omit<typeof confirmDialog, 'isOpen'>) => {
    setConfirmDialog({ ...config, isOpen: true });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const showScanFeedback = (productName: string) => {
    setScanFeedback(productName);
    setTimeout(() => setScanFeedback(null), 2000);
  };

  const showStockWarning = (message: string) => {
    setStockWarning(message);
    setTimeout(() => setStockWarning(null), 2500);
  };

  const resetNewCustomerForm = () => {
    setNewCustomerForm({
      code: '',
      name: '',
      phone: '',
      group: 'Khách lẻ',
      birthday: '',
      gender: '',
      address: '',
      province: '',
      district: '',
      ward: '',
      taxCode: '',
      email: '',
      facebook: '',
      notes: '',
    });
  };

  return {
    // Search states
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    setDebouncedSearchTerm,
    productSearchSort,
    setProductSearchSort,
    customerSearch,
    setCustomerSearch,
    debouncedCustomerSearch,
    setDebouncedCustomerSearch,
    showConsultant,
    setShowConsultant,

    // Tab states
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,

    // Modal states
    showAddCustomerModal,
    setShowAddCustomerModal,
    showGridMenu,
    setShowGridMenu,
    newCustomerForm,
    setNewCustomerForm,
    resetNewCustomerForm,
    useSplitPayment,
    setUseSplitPayment,

    // UI states
    showDiscountModal,
    setShowDiscountModal,
    billDiscountRect,
    setBillDiscountRect,
    showReceiptModal,
    setShowReceiptModal,
    isCheckoutLocked,
    setIsCheckoutLocked,

    // Item discount
    itemDiscountPopup,
    setItemDiscountPopup,

    // Other modals
    showReturnModal,
    setShowReturnModal,
    showEODReport,
    setShowEODReport,
    showProcessOrdersModal,
    setShowProcessOrdersModal,
    showProcessRepairsModal,
    setShowProcessRepairsModal,
    showShortcutsModal,
    setShowShortcutsModal,
    showSelectInvoiceModal,
    setShowSelectInvoiceModal,
    selectedCartIndex,
    setSelectedCartIndex,
    isAutoPrintEnabled,
    setIsAutoPrintEnabled,
    lastOrder,
    setLastOrder,

    // Search results
    showProductResults,
    setShowProductResults,
    selectedResultIndex,
    setSelectedResultIndex,

    // Feedback
    scanFeedback,
    setScanFeedback,
    showScanFeedback,
    stockWarning,
    setStockWarning,
    showStockWarning,

    // Mobile
    showCheckoutSheet,
    setShowCheckoutSheet,

    // Confirm dialog
    confirmDialog,
    setConfirmDialog,
    openConfirm,
    closeConfirm,
  };
}
