import React, { useState, useMemo, useRef, useEffect } from 'react';
import { generateId } from '../../src/lib';
import POSCart from './POSCart';
import POSCheckout from './POSCheckout';
import POSReceiptModal from './POSReceiptModal';
import POSReturnModal from './POSReturnModal';
import POSHeaderToolbar from './POSHeaderToolbar';
import EndOfDayReport from './EndOfDayReport';
import POSItemDiscountPopup, { ItemDiscountPopupState } from './POSItemDiscountPopup';
import POSBillDiscountPopup from './POSBillDiscountPopup';
import POSToasts from './POSToasts';
import POSQuickCustomerModal, { QuickCustomerForm } from './POSQuickCustomerModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { getCurrentStaffId } from '../shared/staff';
import {
  POSProduct,
  POSCustomer,
  POSOrder,
  POSOrderItem,
  CustomerDebtRecord,
  Employee,
  BrandProfile,
  POSInventorySettings,
  POSKeyboardSettings,
  POSPaymentSettings,
  ProductGroup,
  DEFAULT_POS_KEYBOARD_SHORTCUTS,
} from '../../types';
import { InvoiceTab } from './types';
import { usePOSKeyboard } from './usePOSKeyboard';
import { usePOSReturnFlow } from './usePOSReturnFlow';
import { usePOSTabs } from './usePOSTabs';
import { usePOSState } from '../../hooks/usePOSState';
import POSMobileView from './POSMobileView';
import POSMobileCheckoutSheet from './POSMobileCheckoutSheet';
import ProcessOrdersModal from './ProcessOrdersModal';
import ProcessRepairsModal from './ProcessRepairsModal';
import ShortcutsModal from './ShortcutsModal';
import SelectInvoiceModal from './SelectInvoiceModal';
import { useToast } from '../ui/Toast';

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

const SKU_COLLATOR = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
const EMPTY_SPLIT_PAYMENT = { cash: 0, bank: 0, card: 0, momo: 0 } as const;
const DEFAULT_POS_STAFF = [
  { id: 'ngo-thanh-du', name: 'Ngô Thành Du', kiotvietId: '3458a3f9-2a12-551f-88b5-3b710078f807' },
  { id: 'pham-thi-vui', name: 'Phạm Thị Vui', kiotvietId: '50e28d1c-e011-5dac-acf2-7a84c9e1b48a' },
];
const STAFF_STORAGE_KEYS = ['cfo_current_staff_id', 'cfo_staff_id', 'current_staff_id'];

interface POSComputerProps {
  products: POSProduct[];
  productGroups?: ProductGroup[];
  customers: POSCustomer[];
  employees?: Employee[];
  orders: POSOrder[];
  onPlaceOrder: (
    order: POSOrder,
    updatedProducts: POSProduct[],
    updatedCustomer?: POSCustomer,
    debtRecord?: CustomerDebtRecord
  ) => Promise<void>;
  onReturnOrder: (
    order: POSOrder,
    updatedProducts: POSProduct[],
    returnedItems: POSOrderItem[],
    exchangeItems: POSOrderItem[]
  ) => Promise<void>;
  onAddCustomer: (customer: POSCustomer) => void;
  onGoToManagement?: () => void;
  brandProfile?: BrandProfile;
  paymentSettings?: POSPaymentSettings;
  inventorySettings?: POSInventorySettings;
  currentStaffName?: string;
  offlineOrderPendingCount?: number;
  isDraining?: boolean;
  isActive?: boolean;
  onDrainOfflineQueue?: () => Promise<{ synced: number; failed: number }>;
}

const POSComputer: React.FC<POSComputerProps> = ({
  products,
  productGroups = [],
  customers,
  employees = [],
  orders,
  onPlaceOrder,
  onReturnOrder,
  onAddCustomer,
  onGoToManagement,
  brandProfile,
  paymentSettings,
  inventorySettings,
  offlineOrderPendingCount = 0,
  isDraining = false,
  isActive = true,
  onDrainOfflineQueue,
}) => {
  const { showToast } = useToast();
  // Use custom hook for all state management
  const posState = usePOSState({ paymentSettings, isActive });

  // Destructure commonly used states for convenience
  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    setDebouncedSearchTerm,
    productSearchSort,
    setProductSearchSort,
    customerSearch,
    setCustomerSearch,
    debouncedCustomerSearch,
    showConsultant,
    setShowConsultant,
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    showAddCustomerModal,
    setShowAddCustomerModal,
    showGridMenu,
    setShowGridMenu,
    newCustomerForm,
    setNewCustomerForm,
    resetNewCustomerForm,
    useSplitPayment,
    setUseSplitPayment,
    showDiscountModal,
    setShowDiscountModal,
    billDiscountRect,
    setBillDiscountRect,
    showReceiptModal,
    setShowReceiptModal,
    isCheckoutLocked,
    setIsCheckoutLocked,
    itemDiscountPopup,
    setItemDiscountPopup,
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
    showProductResults,
    setShowProductResults,
    selectedResultIndex,
    setSelectedResultIndex,
    scanFeedback,
    setScanFeedback,
    showScanFeedback,
    stockWarning,
    setStockWarning,
    showStockWarning,
    showCheckoutSheet,
    setShowCheckoutSheet,
    confirmDialog,
    setConfirmDialog,
    openConfirm,
    closeConfirm,
  } = posState;

  // Derived active tab states
  const cart = activeTab.cart;
  const returnCart = activeTab.returnCart || [];
  const mode = activeTab.mode || 'sales';
  const selectedCustomer = activeTab.selectedCustomer;
  const discountValue = activeTab.discountValue;
  const discountType = activeTab.discountType;
  const paymentMethod = activeTab.paymentMethod;
  const orderNote = activeTab.orderNote;
  const otherFees = activeTab.otherFees;
  const cashReceived = activeTab.cashReceived;
  const returnDiscount = activeTab.returnDiscount || 0;
  const returnFee = activeTab.returnFee || 0;
  const returnOtherRefund = activeTab.returnOtherRefund || 0;
  const splitPayment = activeTab.splitPayment || EMPTY_SPLIT_PAYMENT;
  const allowSellOutOfStock = inventorySettings?.allowSellOutOfStock ?? false;
  const [currentStaffId, setCurrentStaffId] = useState(() => {
    const stored = getCurrentStaffId();
    return stored === 'unknown' ? DEFAULT_POS_STAFF[0].id : stored;
  });
  const activeEmployees = useMemo(
    () => employees.filter(employee => !employee.resignedDate),
    [employees]
  );
  const fixedStaffOptions = useMemo(
    () =>
      DEFAULT_POS_STAFF.map(staff => {
        const matchedEmployee = employees.find(employee => employee.name === staff.name);
        return {
          id: matchedEmployee?.id || staff.id,
          name: staff.name,
          position: matchedEmployee?.position || '',
          joinDate: matchedEmployee?.joinDate || '',
        };
      }),
    [employees]
  );
  const defaultStaffByFallbackId = DEFAULT_POS_STAFF.find(staff => staff.id === currentStaffId);
  const currentSalesperson =
    fixedStaffOptions.find(employee => employee.id === currentStaffId) ||
    (defaultStaffByFallbackId
      ? fixedStaffOptions.find(employee => employee.name === defaultStaffByFallbackId.name)
      : undefined) ||
    activeEmployees.find(employee => employee.id === currentStaffId) ||
    employees.find(employee => employee.id === currentStaffId);
  const defaultSalespersonName =
    currentSalesperson?.name || (currentStaffId === 'unknown' ? 'Nhân viên' : currentStaffId);
  const salespersonOptions = fixedStaffOptions;

  const withDefaultSalesperson = React.useCallback(
    (items: POSOrderItem[], lineType: POSOrderItem['lineType'] = 'sale') =>
      items.map(item => ({
        ...item,
        salespersonId: item.salespersonId || currentStaffId,
        salespersonName: item.salespersonName || defaultSalespersonName,
        lineType,
      })),
    [currentStaffId, defaultSalespersonName]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    STAFF_STORAGE_KEYS.forEach(key => localStorage.setItem(key, currentStaffId));
  }, [currentStaffId]);

  useEffect(() => {
    const fallbackStaff = DEFAULT_POS_STAFF.find(staff => staff.id === currentStaffId);
    if (!fallbackStaff) return;
    const matchedEmployeeOption = fixedStaffOptions.find(staff => staff.name === fallbackStaff.name);
    if (matchedEmployeeOption && matchedEmployeeOption.id !== currentStaffId) {
      setCurrentStaffId(matchedEmployeeOption.id);
    }
  }, [currentStaffId, fixedStaffOptions]);

  // Refs for DOM and stale closure fixes
  const productSearchRef = useRef<HTMLInputElement>(null);
  const consultantSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const searchResultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkoutRef = useRef<() => void>(() => {});
  const cartLengthRef = useRef(0);
  const isAutoPrintEnabledRef = useRef(isAutoPrintEnabled);
  const selectedCartIndexRef = useRef(selectedCartIndex);
  const cartItemsRef = useRef(activeTab.cart);
  const updateQuantityRef = useRef<(id: string, delta: number) => void>(() => {});

  const [keyboardSettings, setKeyboardSettings] = useState<POSKeyboardSettings>(() => {
    try {
      const saved = localStorage.getItem('pos_keyboard_shortcuts');
      if (saved) return { shortcuts: JSON.parse(saved) };
    } catch {}
    return { shortcuts: DEFAULT_POS_KEYBOARD_SHORTCUTS };
  });

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('pos_keyboard_shortcuts');
        if (saved) setKeyboardSettings({ shortcuts: JSON.parse(saved) });
      } catch {}
    };
    window.addEventListener('pos_keyboard_settings_changed', handler);
    return () => window.removeEventListener('pos_keyboard_settings_changed', handler);
  }, []);

  const isMobile = useIsMobile();
  const [autoPromotion] = useState(0);

  const searchableProducts = useMemo(
    () =>
      products
        .filter(product => product.status === 'Active' && !product.isParent)
        .map(product => ({
          product,
          name: product.name?.toLowerCase() || '',
          sku: product.sku?.toLowerCase() || '',
          barcode: product.barcode || '',
        })),
    [products]
  );

  const searchableCustomers = useMemo(
    () =>
      customers.map(customer => ({
        customer,
        name: customer.name.toLowerCase(),
        phone: customer.phone,
      })),
    [customers]
  );

  const { updateActiveTab, addNewTab, closeTab } = usePOSTabs({
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    openConfirm,
    closeConfirm,
    defaultPaymentMethod: paymentSettings?.defaultMethod || 'Cash',
  });

  // Debounce and auto-scroll effects are handled in usePOSState hook

  // Auto-scroll dropdown when selectedResultIndex changes
  useEffect(() => {
    if (selectedResultIndex >= 0 && searchResultRefs.current[selectedResultIndex]) {
      searchResultRefs.current[selectedResultIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedResultIndex]);

  // Search filter
  const searchFilteredProducts = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) return [];
    const search = debouncedSearchTerm.toLowerCase();
    return searchableProducts
      .filter(
        item =>
          item.name.includes(search) || item.sku.includes(search) || item.barcode.includes(search)
      )
      .map(item => item.product)
      .sort((a, b) => {
        if (productSearchSort === 'priceDesc') return b.salePrice - a.salePrice;
        return SKU_COLLATOR.compare(b.sku || '', a.sku || '');
      });
  }, [searchableProducts, debouncedSearchTerm, productSearchSort]);

  useEffect(() => {
    if (debouncedSearchTerm && searchFilteredProducts.length > 0) {
      setShowProductResults(true);
      setSelectedResultIndex(0);
    } else {
      setShowProductResults(false);
    }
  }, [debouncedSearchTerm, searchFilteredProducts]);

  const filteredCustomers = useMemo(() => {
    if (!debouncedCustomerSearch) return [];
    const search = debouncedCustomerSearch.toLowerCase();
    return searchableCustomers
      .filter(item => item.phone.includes(debouncedCustomerSearch) || item.name.includes(search))
      .map(item => item.customer)
      .slice(0, 10);
  }, [searchableCustomers, debouncedCustomerSearch]);

  const addToCart = React.useCallback(
    (product: POSProduct) => {
      if (product.isParent) return;

      // Validation: Giá bán phải > 0
      if (product.salePrice <= 0) {
        showStockWarning(`${product.name} — chưa có giá bán, vui lòng cập nhật giá`);
        return;
      }

      // Check stock outside setTabs to avoid side effects inside state updater
      const currentCart = activeTab.cart;
      const existingItem = currentCart.find(item => item.productId === product.id);
      const qtyInCart = existingItem?.quantity ?? 0;
      if (!allowSellOutOfStock && (product.stock <= 0 || qtyInCart >= product.stock)) {
        showStockWarning(`${product.name} — không đủ hàng (tồn: ${product.stock})`);
        return;
      }

      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          const prevCart = t.cart;
          const existing = prevCart.find(item => item.productId === product.id);
          let newCart;
          if (existing) {
            newCart = prevCart.map(item =>
              item.productId === product.id
                ? {
                    ...item,
                    quantity: item.quantity + 1,
                    total: (item.quantity + 1) * (item.price - item.discount),
                  }
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
                importPrice: product.importPrice || 0,
                salespersonId: currentStaffId,
                salespersonName: defaultSalespersonName,
                lineType: 'sale',
              },
            ];
          }
          return { ...t, cart: newCart };
        })
      );
    },
    [activeTabId, activeTab.cart, allowSellOutOfStock, currentStaffId, defaultSalespersonName]
  );

  usePOSKeyboard({
    isActive,
    products,
    productSearchRef,
    consultantSearchRef,
    customerSearchRef,
    checkoutRef,
    cartLengthRef,
    setShowConsultant,
    addToCart,
    showScanFeedback,
    setSearchTerm,
    setDebouncedSearchTerm,
    setShowProductResults,
    addNewTab,
    isAutoPrintEnabledRef,
    setIsAutoPrintEnabled,
    selectedCartIndexRef,
    setSelectedCartIndex,
    cartItemsRef,
    updateQuantityRef,
    keyboardSettings,
  });

  const updateQuantity = React.useCallback(
    (productId: string, delta: number) => {
      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          const newCart = t.cart.map(item => {
            if (item.productId === productId) {
              const product = products.find(p => p.id === productId);
              const maxQty = product?.stock ?? Infinity;
              const proposedQty = item.quantity + delta;

              // Cảnh báo nếu số lượng vượt ngưỡng an toàn (phát hiện nhập nhầm phím)
              const MAX_QTY_WARN = inventorySettings?.maxQtyWarning ?? 10000;
              if (proposedQty > MAX_QTY_WARN) {
                showStockWarning(`Số lượng quá lớn (${proposedQty}), vui lòng kiểm tra lại`);
              }

              const newQty = allowSellOutOfStock
                ? Math.max(1, proposedQty)
                : Math.min(maxQty, Math.max(1, proposedQty));
              return { ...item, quantity: newQty, total: newQty * (item.price - item.discount) };
            }
            return item;
          });
          return { ...t, cart: newCart };
        })
      );
    },
    [activeTabId, products, allowSellOutOfStock]
  );

  // Keep updateQuantityRef current so keyboard handler can call latest version
  updateQuantityRef.current = updateQuantity;

  const removeFromCart = React.useCallback(
    (productId: string) => {
      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          const newCart = t.cart.filter(item => item.productId !== productId);
          // Reset cashReceived to 0 if cart is empty
          const newCashReceived = newCart.length === 0 ? 0 : t.cashReceived;
          return { ...t, cart: newCart, cashReceived: newCashReceived };
        })
      );
    },
    [activeTabId]
  );

  const updateItemSalesperson = React.useCallback(
    (productId: string, employeeId: string) => {
      const employee = salespersonOptions.find(item => item.id === employeeId) || employees.find(item => item.id === employeeId);
      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            cart: t.cart.map(item =>
              item.productId === productId
                ? {
                    ...item,
                    salespersonId: employeeId,
                    salespersonName: employee?.name || employeeId,
                  }
                : item
            ),
          };
        })
      );
    },
    [activeTabId, employees, salespersonOptions]
  );

  const updateCurrentStaff = React.useCallback(
    (staffId: string) => {
      const nextStaff = salespersonOptions.find(employee => employee.id === staffId);
      if (!nextStaff) return;
      const previousStaffId = currentStaffId;
      setCurrentStaffId(staffId);
      setTabs(prevTabs =>
        prevTabs.map(t => {
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            cart: t.cart.map(item => {
              const isUsingPreviousDefault =
                !item.salespersonId ||
                item.salespersonId === previousStaffId ||
                item.salespersonId === 'unknown';
              return isUsingPreviousDefault
                ? {
                    ...item,
                    salespersonId: nextStaff.id,
                    salespersonName: nextStaff.name,
                  }
                : item;
            }),
          };
        })
      );
    },
    [activeTabId, currentStaffId, salespersonOptions]
  );

  const updateItemDiscount = React.useCallback(
    (productId: string, discountAmount: number) => {
      setTabs(prev =>
        prev.map(t => {
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            cart: t.cart.map(item => {
              if (item.productId !== productId) return item;

              // Validation: Chiết khấu không được lớn hơn giá bán
              const validDiscount = Math.min(Math.max(0, discountAmount), item.price);

              if (discountAmount > item.price) {
                showStockWarning(
                  `Chiết khấu không được lớn hơn giá bán (${item.price.toLocaleString()}đ)`
                );
              }

              return {
                ...item,
                discount: validDiscount,
                total: item.quantity * (item.price - validDiscount),
              };
            }),
          };
        })
      );
    },
    [activeTabId]
  );

  const totalBeforeDiscount = cart.reduce((acc, item) => acc + item.total, 0);

  const manualDiscountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (totalBeforeDiscount * discountValue) / 100;
    }
    return discountValue;
  }, [totalBeforeDiscount, discountValue, discountType]);

  const totalDiscount = manualDiscountAmount + autoPromotion;
  const netPayable = Math.max(0, totalBeforeDiscount - totalDiscount + otherFees);

  // Tỷ lệ tích điểm lấy từ cấu hình, mặc định 10.000đ/điểm
  const pointsRate = paymentSettings?.pointsRate ?? 10000;

  // Chỉ tích điểm từ sản phẩm có allowPoints !== false
  const productById = useMemo(
    () => new Map(products.map(p => [p.id, p])),
    [products]
  );
  const pointsEligibleAmount = useMemo(
    () => cart.reduce((sum, item) => {
      const product = productById.get(item.productId);
      if (product?.allowPoints === false) return sum;
      return sum + item.total;
    }, 0),
    [cart, productById]
  );
  const discountRatio = totalBeforeDiscount > 0 ? netPayable / totalBeforeDiscount : 1;
  const pointsEarned = Math.floor((pointsEligibleAmount * discountRatio) / pointsRate);

  const {
    updateReturnQuantity,
    removeFromReturnCart,
    totalReturnBeforeDiscount,
    finalReturnAmount,
    amountToPayCustomer,
    customerPaysDifference,
    handleReturnFast,
    handleSelectOrderReturn,
  } = usePOSReturnFlow({
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
  });

  // Dynamic Cash Suggestions based on Vietnamese Currency
  const cashSuggestions = useMemo(() => {
    if (netPayable <= 0) return [0, 0, 0, 0, 0, 0];

    const suggestions = new Set<number>();

    // 1. Exact amount
    suggestions.add(netPayable);

    // 2. Common VN denominations round-ups
    const denoms = [10000, 20000, 50000, 100000, 200000, 500000];

    denoms.forEach(d => {
      const rounded = Math.ceil(netPayable / d) * d;
      if (rounded >= netPayable) {
        suggestions.add(rounded);
      }
    });

    // Strategy to pick 6 meaningful values
    const sorted = Array.from(suggestions).sort((a, b) => a - b);
    const result = sorted.filter(s => s >= netPayable).slice(0, 6);

    // Fill if fewer than 6
    while (result.length < 6) {
      const last = result[result.length - 1] || netPayable;
      // If we don't have 500k yet and it's greater than last, add it
      if (!result.includes(500000) && 500000 > last && result.length < 5) {
        result.push(500000);
      } else {
        result.push(last + 50000);
      }
      result.sort((a, b) => a - b);
    }

    return result.slice(0, 6);
  }, [netPayable]);

  // Return Invoices filtering
  const isDebtMode = activeTab.isDebtMode;
  const currentCashReceived = isDebtMode ? 0 : cashReceived || netPayable;

  const handleCheckout = async () => {
    if (isCheckoutLocked) return;
    if (mode === 'sales' && cart.length === 0) return;
    if (mode === 'return' && returnCart.length === 0 && cart.length === 0) return;

    // Validation: Tổng tiền phải > 0
    if (mode === 'sales' && netPayable <= 0) {
      showStockWarning('Tổng tiền thanh toán phải lớn hơn 0');
      return;
    }

    // Validation: Thanh toán chia nhiều phương thức phải đủ tiền
    if (useSplitPayment && mode === 'sales' && !isDebtMode) {
      const splitTotal = splitPayment.cash + splitPayment.bank + splitPayment.card + splitPayment.momo;
      if (splitTotal < netPayable) {
        showStockWarning(
          `Tổng thanh toán còn thiếu ${(netPayable - splitTotal).toLocaleString()}đ — vui lòng điều chỉnh trước khi thanh toán`
        );
        return;
      }
    }

    // Dùng productById Map (O(1) lookup) thay vì products.find O(n) bên trong cart.find → tránh O(n²)
    const insufficientItem = allowSellOutOfStock
      ? undefined
      : cart.find(item => {
          const product = productById.get(item.productId);
          return !product || product.stock < item.quantity;
        });

    if (insufficientItem) {
      const product = productById.get(insufficientItem.productId);
      showStockWarning(
        `${insufficientItem.name} — không đủ hàng để thanh toán (tồn: ${product?.stock ?? 0}, cần: ${insufficientItem.quantity})`
      );
      return;
    }

    setIsCheckoutLocked(true);
    const orderId = generateId();
    const orderCode = `${mode === 'return' ? 'TH' : 'HD'}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const cartWithSalesperson = withDefaultSalesperson(cart, mode === 'return' ? 'exchange' : 'sale');

    if (mode === 'return') {
      const returnedItems = returnCart.map(item => ({ ...item, lineType: 'return' as const }));
      const returnOrder: POSOrder = {
        id: orderId,
        orderCode,
        date: new Date().toISOString(),
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        items: [...returnedItems, ...cartWithSalesperson],
        totalAmount: totalReturnBeforeDiscount,
        discount: returnDiscount,
        finalAmount: -finalReturnAmount,
        paymentMethod,
        staffId: currentStaffId,
        staffName: defaultSalespersonName,
        createdBy: currentStaffId,
        channel: 'direct',
        channelName: 'Bán trực tiếp',
        status: 'completed',
        pointsEarned: 0,
        notes: orderNote,
        isReturn: true,
        refundAmount: amountToPayCustomer, // tự tính: > 0 → hoàn tiền, 0 → đổi hàng
      };

      const returnedByProduct = new Map(returnCart.map(item => [item.productId, item.quantity]));
      const exchangedByProduct = new Map(cartWithSalesperson.map(item => [item.productId, item.quantity]));
      const updatedProducts = products.map(product => {
        const returnedQty = returnedByProduct.get(product.id) || 0;
        const exchangedQty = exchangedByProduct.get(product.id) || 0;
        if (returnedQty === 0 && exchangedQty === 0) return product;
        return { ...product, stock: product.stock + returnedQty - exchangedQty };
      });

      try {
        await onReturnOrder(returnOrder, updatedProducts, returnedItems, cartWithSalesperson);
        setLastOrder(returnOrder);
        if (isAutoPrintEnabled) {
          setShowReceiptModal(true);
        } else {
          handleFinishOrder();
        }
        setSearchTerm('');
        setCustomerSearch('');
      } catch (err) {
        setIsCheckoutLocked(false);
        showStockWarning(err instanceof Error ? err.message : 'Không thể xử lý trả hàng');
      }
      return;
    }

    const newOrder: POSOrder = {
      id: orderId,
      orderCode,
      date: new Date().toISOString(),
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      items: cartWithSalesperson,
      totalAmount: totalBeforeDiscount,
      discount: totalDiscount,
      finalAmount: netPayable,
      paymentMethod: paymentMethod,
      staffId: currentStaffId,
      staffName: defaultSalespersonName,
      createdBy: currentStaffId,
      channel: 'direct',
      channelName: 'Bán trực tiếp',
      status: 'completed',
      pointsEarned: pointsEarned,
      notes: orderNote,
      // Lưu phân bổ từng phương thức thanh toán khi chia nhiều — phục vụ đối soát dòng tiền
      ...(useSplitPayment && mode === 'sales' && {
        splitPayments: {
          cash: splitPayment.cash || undefined,
          bank: splitPayment.bank || undefined,
          card: splitPayment.card || undefined,
          momo: splitPayment.momo || undefined,
        },
      }),
    };

    const cartItemMap = new Map(cartWithSalesperson.map(item => [item.productId, item]));
    const updatedProducts = products.map(p => {
      const cartItem = cartItemMap.get(p.id);
      if (cartItem) {
        return { ...p, stock: p.stock - cartItem.quantity };
      }
      return p;
    });

    let updatedCustomer: POSCustomer | undefined;
    let debtRecord: CustomerDebtRecord | undefined;

    if (selectedCustomer) {
      const debtAdded = isDebtMode ? netPayable : 0;
      updatedCustomer = {
        ...selectedCustomer,
        points: selectedCustomer.points + pointsEarned,
        totalSpent: selectedCustomer.totalSpent + netPayable,
        lastVisit: new Date().toISOString(),
        debtAmount: (selectedCustomer.debtAmount ?? 0) + debtAdded,
      };
      if (debtAdded > 0) {
        debtRecord = {
          id: generateId(),
          customerId: selectedCustomer.id,
          date: new Date().toISOString(),
          orderId: orderId,
          type: 'debt',
          amount: debtAdded,
          note: `Đơn hàng ${orderCode}`,
        };
      }
    }

    try {
      await onPlaceOrder(newOrder, updatedProducts, updatedCustomer, debtRecord);

      // Set last order for receipt and show modal IF auto-print is enabled
      setLastOrder(newOrder);
      if (isAutoPrintEnabled) {
        setShowReceiptModal(true);
      } else {
        // If not printing, just handle finish order logic (reset/switch tab)
        handleFinishOrder();
      }

      setSearchTerm('');
      setCustomerSearch('');
    } catch (err) {
      setIsCheckoutLocked(false);
      showStockWarning(err instanceof Error ? err.message : 'Không thể xử lý thanh toán');
    }
  };

  useEffect(() => {
    checkoutRef.current = handleCheckout;
    cartLengthRef.current = mode === 'return' ? cart.length + returnCart.length : cart.length;
    isAutoPrintEnabledRef.current = isAutoPrintEnabled;
    selectedCartIndexRef.current = selectedCartIndex;
    cartItemsRef.current = activeTab.cart;
  });

  const handleFinishOrder = () => {
    setShowReceiptModal(false);
    setLastOrder(null);
    setIsCheckoutLocked(false);

    // Reset or Switch tab after checkout completion
    if (tabs.length > 1) {
      const remainingTabs = tabs.filter(t => t.id !== activeTabId);
      setTabs(remainingTabs);
      setActiveTabId(remainingTabs[0].id);
    } else {
      setTabs([
        {
          id: 'default',
          name: 'Hóa đơn 1',
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
          isDebtMode: false,
          returnDiscount: 0,
          returnFee: 0,
          returnOtherRefund: 0,
          splitPayment: { cash: 0, bank: 0, card: 0, momo: 0 },
        },
      ]);
      setActiveTabId('default');
    }
  };

  const resetPOSSession = () => {
    setTabs([
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
    setActiveTabId('default');
    setSearchTerm('');
    setCustomerSearch('');
    setShowGridMenu(false);
    showToast('Đã đăng xuất phiên bán hàng trên máy tính tiền', 'success');
  };

  const handleManualSync = async () => {
    if (!onDrainOfflineQueue) {
      showToast('Đồng bộ offline chưa được cấu hình cho màn hình này.', 'warning');
      return;
    }
    if (isDraining) return;
    const result = await onDrainOfflineQueue();
    if (result.failed > 0) {
      showToast(`Đồng bộ ${result.synced} thao tác, còn ${result.failed} thao tác lỗi.`, 'warning');
      return;
    }
    showToast(
      result.synced > 0 ? `Đã đồng bộ ${result.synced} thao tác offline.` : 'Không có thao tác offline cần đồng bộ.',
      'success'
    );
  };

  const handlePrint = () => {
    if (!lastOrder) return;

    const printHtml = `
      <html>
        <head>
          <title>In Hóa Đơn - ${lastOrder.orderCode}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              margin: 0; 
              padding: 0; 
              background: white; 
              font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; 
              color: #000; 
              line-height: 1.4; 
              font-size: 12px; 
            }
            .receipt { 
              width: 80mm; 
              padding: 5mm; 
              box-sizing: border-box; 
            }
            .center { text-align: center; }
            .dashed-border { border-bottom: 2px dashed #000; margin: 10px 0; }
            .flex-between { display: flex; justify-content: space-between; }
            .bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .mt-4 { margin-top: 16px; }
            .mb-2 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { border-bottom: 1px solid #000; text-align: left; padding: 4px 0; font-size: 10px; color: #666; }
            td { padding: 6px 0; vertical-align: top; }
            .totals { margin-top: 10px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .grand-total { 
              font-size: 16px; 
              font-weight: 900; 
              margin-top: 8px; 
              border-top: 1px solid #000; 
              padding-top: 8px; 
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <h1 style="font-size: 18px; margin: 0; font-weight: 900;">CFO BRAIN PROFESSIONAL</h1>
              <p style="font-size: 10px; margin: 4px 0;">123 Đường Công Nghệ, Quận 1, TP. HCM</p>
              <p style="font-size: 10px; margin: 0;">Hotline: 1900 1234</p>
            </div>
            
            <div class="dashed-border"></div>
            
            <div style="font-size: 11px;">
              <div class="flex-between"><span>Số HD:</span><span class="bold">${lastOrder.orderCode}</span></div>
              <div class="flex-between"><span>Ngày:</span><span>${new Date(lastOrder.date).toLocaleString('vi-VN')}</span></div>
              <div class="flex-between"><span>Khách:</span><span class="bold">${lastOrder.customerName || 'KHÁCH VÃNG LAI'}</span></div>
              <div class="flex-between"><span>Thu ngân:</span><span>${employees.find(e => e.id === lastOrder.staffId)?.name || defaultSalespersonName}</span></div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">MẶT HÀNG</th>
                  <th style="text-align: center; width: 40px;">SL</th>
                  <th style="text-align: right; width: 80px;">T.TIỀN</th>
                </tr>
              </thead>
              <tbody>
                ${lastOrder.items
                  .map(
                    item => `
                  <tr>
                    <td>
                      <div class="bold uppercase">${item.name}</div>
                      <div style="font-size: 10px; color: #666;">${item.price.toLocaleString()}đ</div>
                    </td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;" class="bold">${item.total.toLocaleString()}đ</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
            
            <div class="dashed-border"></div>
            
            <div class="totals">
              <div class="total-row"><span>Tiền hàng:</span><span class="bold">${lastOrder.totalAmount.toLocaleString()}đ</span></div>
              ${lastOrder.discount > 0 ? `<div class="total-row"><span>Chiết khấu:</span><span class="bold">-${lastOrder.discount.toLocaleString()}đ</span></div>` : ''}
              <div class="total-row grand-total"><span>TỔNG CỘNG:</span><span class="bold">${Math.abs(lastOrder.finalAmount).toLocaleString()}đ</span></div>
              <div class="total-row" style="margin-top: 10px;"><span>Thanh toán:</span><span class="bold uppercase">${lastOrder.paymentMethod}</span></div>
              <div class="total-row"><span>Khách đưa:</span><span class="bold">${(cashReceived || Math.abs(lastOrder.finalAmount)).toLocaleString()}đ</span></div>
              ${(cashReceived || Math.abs(lastOrder.finalAmount)) > Math.abs(lastOrder.finalAmount) ? `<div class="total-row"><span>Tiền thừa:</span><span class="bold">${((cashReceived || Math.abs(lastOrder.finalAmount)) - Math.abs(lastOrder.finalAmount)).toLocaleString()}đ</span></div>` : ''}
            </div>
            
            <div class="center mt-4">
              <p style="font-size: 10px; font-weight: bold; margin: 0;">NHẬN TRỌN NIỀM TIN - TRAO TRỌN CHẤT LƯỢNG</p>
              <p style="font-size: 9px; margin: 4px 0;">Cảm ơn quý khách và hẹn gặp lại!</p>
              <div style="margin-top: 10px; font-size: 8px; color: #999;">In lúc: ${new Date().toLocaleString('vi-VN')}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => {
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    } else {
      showToast('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in hóa đơn.', 'warning');
    }
  };

  const handleAddQuickCustomer = () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) {
      return;
    }
    const newCustomer: POSCustomer = {
      id: crypto.randomUUID(),
      name: newCustomerForm.name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email || undefined,
      address:
        [newCustomerForm.address, newCustomerForm.ward, newCustomerForm.district, newCustomerForm.province]
          .filter(Boolean)
          .join(', ') || undefined,
      notes: newCustomerForm.notes || undefined,
      points: 0,
      totalSpent: 0,
      tier: 'Standard',
    };
    onAddCustomer(newCustomer);
    updateActiveTab({ selectedCustomer: newCustomer });
    setShowAddCustomerModal(false);
    resetNewCustomerForm();
  };

  if (isMobile) {
    return (
      <div
        className="flex flex-col h-full bg-slate-50"
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <POSMobileView
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchFilteredProducts={searchFilteredProducts}
          showProductResults={showProductResults}
          setShowProductResults={setShowProductResults}
          cart={cart}
          addToCart={addToCart}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          netPayable={netPayable}
          onOpenCheckout={() => setShowCheckoutSheet(true)}
          products={products}
          allowSellOutOfStock={allowSellOutOfStock}
        />
        <POSMobileCheckoutSheet
          isOpen={showCheckoutSheet}
          onClose={() => setShowCheckoutSheet(false)}
          cart={cart}
          netPayable={netPayable}
          totalBeforeDiscount={totalBeforeDiscount}
          totalDiscount={totalDiscount}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={method => updateActiveTab({ paymentMethod: method })}
          cashReceived={cashReceived}
          onCashReceivedChange={amount => updateActiveTab({ cashReceived: amount })}
          cashSuggestions={cashSuggestions}
          selectedCustomer={selectedCustomer}
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          filteredCustomers={filteredCustomers}
          onSelectCustomer={c => {
            updateActiveTab({ selectedCustomer: c });
            setCustomerSearch('');
          }}
          onClearCustomer={() => updateActiveTab({ selectedCustomer: null })}
          onConfirm={handleCheckout}
          isCheckoutLocked={isCheckoutLocked}
        />
        {showReceiptModal && lastOrder && (
          <POSReceiptModal
            order={lastOrder}
            cashReceived={cashReceived}
            onClose={() => {
              handleFinishOrder();
              setShowCheckoutSheet(false);
            }}
            onPrint={handlePrint}
            onFinish={() => {
              handleFinishOrder();
              setShowCheckoutSheet(false);
            }}
          />
        )}
        <POSToasts scanFeedback={scanFeedback} stockWarning={stockWarning} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-slate-50"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <POSHeaderToolbar
        productSearchRef={productSearchRef}
        searchResultRefs={searchResultRefs}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setDebouncedSearchTerm={setDebouncedSearchTerm}
        productSearchSort={productSearchSort}
        setProductSearchSort={setProductSearchSort}
        searchFilteredProducts={searchFilteredProducts}
        showProductResults={showProductResults}
        setShowProductResults={setShowProductResults}
        selectedResultIndex={selectedResultIndex}
        setSelectedResultIndex={setSelectedResultIndex}
        addToCart={addToCart}
        mode={mode}
        tabs={tabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        closeTab={closeTab}
        addNewTab={addNewTab}
        setShowReturnModal={setShowReturnModal}
        offlinePendingCount={offlineOrderPendingCount}
        isDraining={isDraining}
        isAutoPrintEnabled={isAutoPrintEnabled}
        setIsAutoPrintEnabled={setIsAutoPrintEnabled}
        showGridMenu={showGridMenu}
        setShowGridMenu={setShowGridMenu}
        onGoToManagement={onGoToManagement}
        onViewEODReport={() => setShowEODReport(true)}
        onManualSync={handleManualSync}
        onProcessOrders={() => {
          setShowGridMenu(false);
          setShowProcessOrdersModal(true);
        }}
        onProcessRepairs={() => {
          setShowGridMenu(false);
          setShowProcessRepairsModal(true);
        }}
        onShowShortcuts={() => {
          setShowGridMenu(false);
          setShowShortcutsModal(true);
        }}
        onShowSelectInvoice={() => {
          setShowGridMenu(false);
          setShowSelectInvoiceModal(true);
        }}
        onShowReturnInvoice={() => {
          setShowGridMenu(false);
          setShowReturnModal(true);
        }}
        onLogout={resetPOSSession}
      />

      <div
        className="flex-1 flex overflow-hidden"
        style={{ flex: '1 1 0', display: 'flex', overflow: 'hidden' }}
      >
        {/* Main Area (Left) */}
        <POSCart
          mode={mode}
          cart={cart}
          returnCart={returnCart}
          orderNote={orderNote}
          showConsultant={showConsultant}
          setShowConsultant={setShowConsultant}
          products={products}
          productGroups={productGroups}
          employees={salespersonOptions}
          currentStaffId={currentStaffId}
          addToCart={addToCart}
          consultantSearchRef={consultantSearchRef}
          onUpdateQuantity={updateQuantity}
          onRemoveFromCart={removeFromCart}
          selectedCartIndex={selectedCartIndex}
          onSelectCartItem={idx => setSelectedCartIndex(() => idx)}
          onUpdateReturnQuantity={updateReturnQuantity}
          onRemoveFromReturnCart={removeFromReturnCart}
          onUpdateSalesperson={updateItemSalesperson}
          onDiscountClick={(productId, price, discount, rect) => {
            setItemDiscountPopup({ productId, price, discount, rect });
          }}
          onOrderNoteChange={note => updateActiveTab({ orderNote: note })}
        />

        {/* Right Sidebar (Checkout) */}
        <POSCheckout
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          customerSearchRef={customerSearchRef}
          selectedCustomer={selectedCustomer}
          filteredCustomers={filteredCustomers}
          onSelectCustomer={c => {
            updateActiveTab({ selectedCustomer: c });
            setCustomerSearch('');
          }}
          onClearCustomer={() => updateActiveTab({ selectedCustomer: null })}
          onOpenAddCustomer={() => setShowAddCustomerModal(true)}
          mode={mode}
          cart={cart}
          returnCart={returnCart}
          products={products}
          totalBeforeDiscount={totalBeforeDiscount}
          totalDiscount={totalDiscount}
          netPayable={netPayable}
          otherFees={otherFees}
          totalReturnBeforeDiscount={totalReturnBeforeDiscount}
          finalReturnAmount={finalReturnAmount}
          amountToPayCustomer={amountToPayCustomer}
          customerPaysDifference={customerPaysDifference}
          currentCashReceived={currentCashReceived}
          isDebtMode={activeTab.isDebtMode}
          pointsEarned={pointsEarned}
          paymentMethod={paymentMethod}
          paymentSettings={paymentSettings}
          useSplitPayment={useSplitPayment}
          setUseSplitPayment={setUseSplitPayment}
          splitPayment={splitPayment}
          cashSuggestions={cashSuggestions}
          staffOptions={salespersonOptions.map(employee => ({
            id: employee.id,
            name: employee.name,
          }))}
          currentStaffId={currentStaffId}
          currentStaffName={defaultSalespersonName}
          onCurrentStaffChange={updateCurrentStaff}
          onUpdateTab={updateActiveTab}
          onBillDiscountClick={rect => {
            setBillDiscountRect(rect);
            setShowDiscountModal(true);
          }}
          onCheckout={handleCheckout}
          isCheckoutLocked={isCheckoutLocked}
        />
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && lastOrder && (
        <POSReceiptModal
          order={lastOrder}
          cashReceived={cashReceived}
          onClose={handleFinishOrder}
          onPrint={handlePrint}
          onFinish={handleFinishOrder}
        />
      )}

      <POSBillDiscountPopup
        rect={showDiscountModal ? billDiscountRect : null}
        totalBeforeDiscount={totalBeforeDiscount}
        discountValue={discountValue}
        discountType={discountType}
        onUpdate={updateActiveTab}
        onClose={() => setShowDiscountModal(false)}
      />

      <POSQuickCustomerModal
        isOpen={showAddCustomerModal}
        form={newCustomerForm}
        onChange={setNewCustomerForm}
        onClose={() => setShowAddCustomerModal(false)}
        onSave={handleAddQuickCustomer}
      />

      {/* Return Invoice Modal */}
      {showReturnModal && (
        <POSReturnModal
          orders={orders}
          customers={customers}
          onClose={() => setShowReturnModal(false)}
          onReturnFast={handleReturnFast}
          onSelectOrder={handleSelectOrderReturn}
        />
      )}

      {/* End of Day Report Modal */}
      {showEODReport && (
        <EndOfDayReport
          orders={orders}
          employees={[
            ...salespersonOptions,
            // Thêm DEFAULT_POS_STAFF IDs chưa có trong salespersonOptions
            ...DEFAULT_POS_STAFF
              .filter(s => !salespersonOptions.some(o => o.id === s.id))
              .map(s => ({ id: s.id, name: s.name, position: '', joinDate: '' })),
            // Thêm KiotViet UUID aliases — map UUID KiotViet → cùng tên nhân viên
            ...DEFAULT_POS_STAFF
              .filter(s => !!s.kiotvietId)
              .map(s => ({ id: s.kiotvietId!, name: s.name, position: '', joinDate: '' })),
          ]}
          onClose={() => setShowEODReport(false)}
        />
      )}

      {/* Process Orders Modal */}
      {showProcessOrdersModal && (
        <ProcessOrdersModal
          orders={orders}
          customers={customers}
          storeName={brandProfile?.name}
          onClose={() => setShowProcessOrdersModal(false)}
        />
      )}

      {/* Process Repairs Modal */}
      {showProcessRepairsModal && (
        <ProcessRepairsModal onClose={() => setShowProcessRepairsModal(false)} />
      )}

      {/* Shortcuts Modal */}
      {showShortcutsModal && <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />}

      {/* Select Invoice Modal */}
      {showSelectInvoiceModal && (
        <SelectInvoiceModal
          orders={orders}
          customers={customers}
          onClose={() => setShowSelectInvoiceModal(false)}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />

      <POSItemDiscountPopup
        popup={itemDiscountPopup}
        onConfirm={updateItemDiscount}
        onClose={() => setItemDiscountPopup(null)}
      />

      <POSToasts scanFeedback={scanFeedback} stockWarning={stockWarning} />
    </div>
  );
};

export default POSComputer;
