import React, { useState, useMemo, useRef, useEffect } from 'react';
import { generateId } from '../../src/lib';
import POSCart from './POSCart';
import POSCheckout from './POSCheckout';
import POSReceiptModal from './POSReceiptModal';
import POSReturnModal from './POSReturnModal';
import POSHeaderToolbar from './POSHeaderToolbar';
import EndOfDayReport from './EndOfDayReport';
import ManagerUnlockModal from './ManagerUnlockModal';
import POSItemDiscountPopup, { ItemDiscountPopupState } from './POSItemDiscountPopup';
import POSBillDiscountPopup from './POSBillDiscountPopup';
import POSToasts from './POSToasts';
import POSQuickCustomerModal, { QuickCustomerForm } from './POSQuickCustomerModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { getCurrentStaffId } from '../shared/staff';
import { signOut } from '../../services/auth';
import { openPrintInvoice, openPrintWarranty } from './printInvoiceFromTemplate';
import {
  AppDataSurgicalUpdate,
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
  RevenueRecord,
  DEFAULT_POS_KEYBOARD_SHORTCUTS,
  ExpenseRecord,
  ExpenseCategory,
} from '../../types';
import { AppThemeId } from '../../constants/themes';
import { InvoiceTab } from './types';
import { usePOSKeyboard } from './usePOSKeyboard';
import { usePOSReturnFlow } from './usePOSReturnFlow';
import { useEditOrderFlow } from './useEditOrderFlow';
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

// AUDIT-010: Tự động nâng hạng KH sau mỗi đơn. Chỉ upgrade, không downgrade.
function computeNewTier(newTotalSpentVnd: number, currentTier: POSCustomer['tier']): POSCustomer['tier'] {
  try {
    const stored = localStorage.getItem('customer_tier_settings');
    const s = stored ? JSON.parse(stored) : {};
    const diamondMin = (s.Diamond?.minSpend ?? 100) as number;
    const goldMin    = (s.Gold?.minSpend    ?? 20)  as number;
    const silverMin  = (s.Silver?.minSpend  ?? 5)   as number;
    const spent = newTotalSpentVnd / 1_000_000;
    const computed: POSCustomer['tier'] =
      spent >= diamondMin ? 'Diamond' :
      spent >= goldMin    ? 'Gold'    :
      spent >= silverMin  ? 'Silver'  : 'Standard';
    const rank: Record<string, number> = { Standard: 0, Silver: 1, Gold: 2, Diamond: 3 };
    return (rank[computed] ?? 0) > (rank[currentTier] ?? 0) ? computed : currentTier;
  } catch {
    return currentTier;
  }
}
const EMPTY_SPLIT_PAYMENT = { cash: 0, bank: 0, card: 0, momo: 0 } as const;
const DEFAULT_POS_STAFF = [
  { id: 'ngo-thanh-du', name: 'Ngô Thành Du', legacyId: '3458a3f9-2a12-551f-88b5-3b710078f807' },
  { id: 'pham-thi-vui', name: 'Phạm Thị Vui', legacyId: '50e28d1c-e011-5dac-acf2-7a84c9e1b48a' },
];
const STAFF_STORAGE_KEYS = ['cfo_current_staff_id', 'cfo_staff_id', 'current_staff_id'];

interface POSComputerProps {
  products: POSProduct[];
  productGroups?: ProductGroup[];
  customers: POSCustomer[];
  employees?: Employee[];
  orders: POSOrder[];
  customerDebtHistory?: CustomerDebtRecord[];
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
    exchangeItems: POSOrderItem[],
    updatedCustomer?: POSCustomer
  ) => Promise<void>;
  onEditOrder?: (
    originalOrder: POSOrder,
    updatedOrder: POSOrder,
    updatedCustomer?: POSCustomer,
    debtRecord?: CustomerDebtRecord
  ) => Promise<void>;
  // Đơn cần mở lại để sửa (từ trang Hóa đơn) — set 1 lần rồi cha xóa qua onOrderEditLoaded
  orderToEdit?: POSOrder | null;
  onOrderEditLoaded?: () => void;
  // Đơn cần mở phiếu trả (từ trang Hóa đơn) — set 1 lần rồi cha xóa qua onOrderReturnLoaded
  orderToReturn?: POSOrder | null;
  onOrderReturnLoaded?: () => void;
  onAddCustomer: (customer: POSCustomer) => void;
  onGoToManagement?: () => void;
  requireManagerAuth?: boolean;
  onManagerUnlocked?: () => void;
  brandProfile?: BrandProfile;
  paymentSettings?: POSPaymentSettings;
  inventorySettings?: POSInventorySettings;
  currentStaffName?: string;
  offlineOrderPendingCount?: number;
  isDraining?: boolean;
  isActive?: boolean;
  onDrainOfflineQueue?: () => Promise<{ synced: number; failed: number }>;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  revenue?: RevenueRecord[];
  expenses?: ExpenseRecord[];
  expenseCategories?: ExpenseCategory[];
  onAddExpense?: (expense: ExpenseRecord) => void;
  isDataReady?: boolean;
  activeThemeId?: AppThemeId;
  onThemeChange?: (id: AppThemeId) => void;
}

const POSComputer: React.FC<POSComputerProps> = ({
  products,
  productGroups = [],
  customers,
  employees = [],
  orders,
  customerDebtHistory = [],
  onPlaceOrder,
  onReturnOrder,
  onEditOrder,
  orderToEdit,
  onOrderEditLoaded,
  orderToReturn,
  onOrderReturnLoaded,
  onAddCustomer,
  onGoToManagement,
  requireManagerAuth,
  onManagerUnlocked,
  brandProfile,
  paymentSettings,
  inventorySettings,
  offlineOrderPendingCount = 0,
  isDraining = false,
  isActive = true,
  onDrainOfflineQueue,
  onUpdateSurgical,
  revenue = [],
  isDataReady = true,
  activeThemeId,
  onThemeChange,
  expenses = [],
  expenseCategories = [],
  onAddExpense,
}) => {
  const { showToast } = useToast();
  const [showManagerUnlock, setShowManagerUnlock] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDraft, setExpenseDraft] = React.useState<{
    category: string;
    amount: string;
    description: string;
    staffName: string;
  }>({ category: '', amount: '', description: '', staffName: '' });
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
    printSettings,
    setPrintSettings,
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
  const salesAdvisorEnabled = inventorySettings?.showSalesAdvisor !== false;
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
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
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

      if (product.salePrice <= 0) {
        showStockWarning(`${product.name} — chưa có giá bán, vui lòng cập nhật giá`);
        return;
      }

      // Kiểm tra stock bên trong functional updater để tránh stale closure khi scan nhanh liên tiếp
      setTabs(prevTabs => {
        const tab = prevTabs.find(t => t.id === activeTabId);
        if (!tab) return prevTabs;

        const existingItem = tab.cart.find(item => item.productId === product.id);
        const qtyInCart = existingItem?.quantity ?? 0;

        if (!allowSellOutOfStock && (product.stock <= 0 || qtyInCart >= product.stock)) {
          setTimeout(() => showStockWarning(`${product.name} — không đủ hàng (tồn: ${product.stock})`), 0);
          return prevTabs;
        }

        const prevCart = tab.cart;
        const existing = prevCart.find(item => item.productId === product.id);
        const newCart = existing
          ? prevCart.map(item =>
              item.productId === product.id
                ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * (item.price - item.discount) }
                : item
            )
          : [
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
                lineType: 'sale' as const,
              },
            ];

        return prevTabs.map(t => (t.id !== activeTabId ? t : { ...t, cart: newCart }));
      });
    },
    [activeTabId, allowSellOutOfStock, currentStaffId, defaultSalespersonName, showStockWarning]
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
      return Math.round((totalBeforeDiscount * discountValue) / 100);
    }
    return discountValue;
  }, [totalBeforeDiscount, discountValue, discountType]);

  const totalDiscount = manualDiscountAmount + autoPromotion;
  const netPayable = Math.max(0, totalBeforeDiscount - totalDiscount + otherFees);

  // Tỷ lệ tích điểm lấy từ cấu hình, mặc định 10.000đ/điểm
  // [FIX D3] Math.max(1,...) tránh chia cho 0 nếu pointsRate bị cấu hình sai = 0
  const pointsRate = Math.max(1, paymentSettings?.pointsRate ?? 10000);

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
  // [FIX m2] Tính discountRatio không tính otherFees — phụ phí không được tích điểm
  // [FIX D1] Math.max(0,...) tránh discountRatio âm khi discount > totalAmount + otherFees
  const discountRatio = totalBeforeDiscount > 0
    ? Math.min(1, Math.max(0, (netPayable - otherFees) / totalBeforeDiscount))
    : 1;
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
    customers, // [FIX M4] auto-fill customer khi load đơn trả
  });

  const { handleSelectOrderToEdit } = useEditOrderFlow({
    tabs,
    setTabs,
    setActiveTabId,
    customers,
    customerDebtHistory,
  });

  // Mở đơn để sửa khi nhận orderToEdit từ trang Hóa đơn (điều hướng qua tab BÁN HÀNG) —
  // chỉ chạy đúng 1 lần cho mỗi order. Cần ref chặn trùng vì React.StrictMode (index.tsx) tự
  // gọi effect 2 lần liên tiếp ở dev mode — không có ref sẽ tạo 2 tab giống hệt nhau.
  const loadedEditOrderIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (orderToEdit && loadedEditOrderIdRef.current !== orderToEdit.id) {
      loadedEditOrderIdRef.current = orderToEdit.id;
      handleSelectOrderToEdit(orderToEdit);
      onOrderEditLoaded?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderToEdit]);

  // Mở tab "Trả hàng N" khi nhận orderToReturn từ trang Hóa đơn (điều hướng qua tab BÁN HÀNG) —
  // cùng pattern + cùng lý do cần ref chặn trùng như orderToEdit ở trên (React.StrictMode).
  const loadedReturnOrderIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (orderToReturn && loadedReturnOrderIdRef.current !== orderToReturn.id) {
      loadedReturnOrderIdRef.current = orderToReturn.id;
      handleSelectOrderReturn(orderToReturn);
      onOrderReturnLoaded?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderToReturn]);

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
      if (!result.includes(500000) && 500000 > last) {
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
    // [FIX C3] Chặn đơn trả khi tất cả items có quantity = 0
    if (mode === 'return' && returnCart.length > 0 && returnCart.every(item => item.quantity === 0) && cart.length === 0) {
      showStockWarning('Vui lòng chọn số lượng hàng cần trả');
      return;
    }

    // Validation: Tổng tiền phải > 0
    if (mode === 'sales' && netPayable <= 0) {
      showStockWarning('Tổng tiền thanh toán phải lớn hơn 0');
      return;
    }

    // [FIX m7] Phí trả hàng không được âm
    if (mode === 'return' && returnFee < 0) {
      showStockWarning('Phí trả hàng không được âm');
      return;
    }

    // Validation: Tiền khách đưa phải đủ (chỉ khi đã nhập rõ ràng)
    if (!useSplitPayment && !isDebtMode && mode === 'sales' && cashReceived > 0 && cashReceived < netPayable) {
      showStockWarning(
        `Tiền khách đưa (${cashReceived.toLocaleString()}đ) chưa đủ — cần thêm ${(netPayable - cashReceived).toLocaleString()}đ`
      );
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

    // Guard đa tab: nếu tab khác đang checkout trong 10 giây qua → bỏ qua
    const LOCK_KEY = 'pos_checkout_lock';
    const LOCK_TTL = 10_000;
    const existingLock = Number(localStorage.getItem(LOCK_KEY) || 0);
    if (Date.now() - existingLock < LOCK_TTL) {
      showStockWarning('Đang có giao dịch khác đang xử lý, vui lòng thử lại');
      return;
    }
    localStorage.setItem(LOCK_KEY, String(Date.now()));

    // Chế độ sửa đơn (mở lại từ trang Hóa đơn) — giữ nguyên id/orderCode/date của đơn gốc
    // thay vì tạo đơn mới, để không nhân đôi lịch sử hóa đơn.
    const originalOrderForEdit = activeTab.editingOrderId
      ? orders.find(o => o.id === activeTab.editingOrderId)
      : undefined;
    if (activeTab.editingOrderId && !originalOrderForEdit) {
      showStockWarning('Không tìm thấy đơn gốc để sửa — có thể đơn đã bị xóa. Vui lòng tải lại dữ liệu.');
      return;
    }

    setIsCheckoutLocked(true);
    const orderId = originalOrderForEdit?.id ?? generateId();
    const orderCode =
      originalOrderForEdit?.orderCode ??
      `${mode === 'return' ? 'TH' : 'HD'}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
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
        finalAmount: finalReturnAmount, // [FIX C2] Dương — isReturn:true đã phân biệt ngữ nghĩa
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
        returnFee: returnFee > 0 ? returnFee : undefined,
        returnOtherRefund: returnOtherRefund > 0 ? returnOtherRefund : undefined,
        originalOrderId: activeTab.originalOrderId,
      };

      const returnedByProduct = new Map(returnCart.map(item => [item.productId, item.quantity]));
      const exchangedByProduct = new Map(cartWithSalesperson.map(item => [item.productId, item.quantity]));
      const updatedProducts = products.map(product => {
        const returnedQty = returnedByProduct.get(product.id) || 0;
        const exchangedQty = exchangedByProduct.get(product.id) || 0;
        if (returnedQty === 0 && exchangedQty === 0) return product;
        return { ...product, stock: product.stock + returnedQty - exchangedQty };
      });

      // Trừ điểm tích lũy tương ứng hàng trả, giảm nợ nếu có
      let returnUpdatedCustomer: POSCustomer | undefined;
      if (selectedCustomer) {
        const returnPointsDeduction = Math.floor(
          returnedItems.reduce((sum, item) => {
            const product = productById.get(item.productId);
            if (product?.allowPoints === false) return sum;
            return sum + item.total;
          }, 0) / pointsRate
        );
        returnUpdatedCustomer = {
          ...selectedCustomer,
          points: Math.max(0, (selectedCustomer.points || 0) - returnPointsDeduction),
          // Không tự động giảm debtAmount — không biết đơn gốc có phải ghi nợ không
          // Cashier điều chỉnh nợ qua module quản lý nợ riêng nếu cần
          totalSpent: Math.max(0, (selectedCustomer.totalSpent || 0) + customerPaysDifference - amountToPayCustomer),
        };
      }

      try {
        await onReturnOrder(returnOrder, updatedProducts, returnedItems, cartWithSalesperson, returnUpdatedCustomer);
        // [FIX m1] Giải phóng lock ngay sau khi order confirmed — không chờ modal đóng
        localStorage.removeItem('pos_checkout_lock');
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
      // Sửa đơn: giữ nguyên ngày bán gốc — không cho đổi ngày khi sửa
      date: originalOrderForEdit?.date ?? new Date().toISOString(),
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
      // Snapshot cashReceived để in lại hóa đơn đúng dù đã chuyển tab
      cashReceived: currentCashReceived,
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
    // updatedProducts CHỈ dùng cho luồng bán mới (onPlaceOrder) — luồng sửa đơn (editPosOrder)
    // tự tính lại tồn kho ròng (hoàn đơn cũ + trừ đơn mới) bên trong service, không cần truyền vào.
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
      if (originalOrderForEdit) {
        // Sửa đơn: chỉ áp dụng CHÊNH LỆCH so với đơn gốc — đơn gốc đã cộng vào totalSpent/điểm/nợ
        // từ lúc tạo, không được cộng lại toàn bộ netPayable mới (sẽ tính trùng phần cũ).
        const oldDebtRecord = customerDebtHistory.find(
          d => d.orderId === originalOrderForEdit.id && d.type === 'debt'
        );
        const oldDebtAmount = oldDebtRecord?.amount || 0;
        const newDebtAmount = isDebtMode ? netPayable : 0;
        const totalSpentDelta = netPayable - (originalOrderForEdit.finalAmount || 0);
        const pointsDelta = pointsEarned - (originalOrderForEdit.pointsEarned || 0);
        const newTotalSpent = Math.max(0, selectedCustomer.totalSpent + totalSpentDelta);
        updatedCustomer = {
          ...selectedCustomer,
          points: Math.max(0, selectedCustomer.points + pointsDelta),
          totalSpent: newTotalSpent,
          tier: computeNewTier(newTotalSpent, selectedCustomer.tier),
          lastVisit: new Date().toISOString(),
          debtAmount: Math.max(0, (selectedCustomer.debtAmount ?? 0) + newDebtAmount - oldDebtAmount),
        };
        if (newDebtAmount > 0) {
          debtRecord = {
            id: generateId(),
            customerId: selectedCustomer.id,
            date: new Date().toISOString(),
            orderId,
            type: 'debt',
            amount: newDebtAmount,
            note: `Đơn hàng ${orderCode} (đã sửa)`,
          };
        }
      } else {
        const debtAdded = isDebtMode ? netPayable : 0;
        const newTotalSpent = selectedCustomer.totalSpent + netPayable;
        updatedCustomer = {
          ...selectedCustomer,
          points: selectedCustomer.points + pointsEarned,
          totalSpent: newTotalSpent,
          tier: computeNewTier(newTotalSpent, selectedCustomer.tier),
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
    }

    try {
      if (originalOrderForEdit) {
        if (!onEditOrder) throw new Error('Chức năng sửa đơn chưa sẵn sàng');
        await onEditOrder(originalOrderForEdit, newOrder, updatedCustomer, debtRecord);
      } else {
        await onPlaceOrder(newOrder, updatedProducts, updatedCustomer, debtRecord);
      }
      // [FIX m1] Giải phóng lock ngay sau khi order confirmed — không chờ modal đóng
      localStorage.removeItem('pos_checkout_lock');

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
      localStorage.removeItem('pos_checkout_lock');
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

  // [FIX E1] Failsafe: tự reset lock sau 30s nếu modal không render được (hot reload, JS error)
  useEffect(() => {
    if (!isCheckoutLocked) return;
    const timer = setTimeout(() => {
      setIsCheckoutLocked(false);
      localStorage.removeItem('pos_checkout_lock');
    }, 30_000);
    return () => clearTimeout(timer);
  }, [isCheckoutLocked]);

  const handleFinishOrder = () => {
    localStorage.removeItem('pos_checkout_lock');
    setShowReceiptModal(false);
    setLastOrder(null);
    setIsCheckoutLocked(false);

    // Dùng tabsRef để tránh stale closure khi modal đang hiển thị
    const latestTabs = tabsRef.current;
    if (latestTabs.length > 1) {
      const remainingTabs = latestTabs.filter(t => t.id !== activeTabId);
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
          paymentMethod: (paymentSettings?.defaultMethod || 'Cash') as InvoiceTab['paymentMethod'],
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

  const resetPOSSession = async () => {
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
    await signOut();
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
    const staffName = employees.find(e => e.id === lastOrder.staffId)?.name || defaultSalespersonName;
    const customer = customers.find(c => c.id === lastOrder.customerId);

    const invoiceOk = openPrintInvoice(
      {
        order: lastOrder,
        storeName: brandProfile?.name,
        storeAddress: brandProfile?.address,
        storePhone: brandProfile?.phone,
        customerPhone: customer?.phone,
        customerAddress: customer?.address,
        staffName,
      },
      printSettings.invoiceCopies,
    );
    if (!invoiceOk) {
      showToast('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in hóa đơn.', 'warning');
      return;
    }

    if (printSettings.autoPrintWarranty) {
      const warrantyByProductId: Record<string, string> = {};
      for (const item of lastOrder.items) {
        const product = products.find(p => p.id === item.productId);
        if (product?.warranty) warrantyByProductId[item.productId] = product.warranty;
      }
      openPrintWarranty(
        {
          order: lastOrder,
          storeName: brandProfile?.name,
          storeAddress: brandProfile?.address,
          storePhone: brandProfile?.phone,
          mode: printSettings.warrantyMode,
          warrantyByProductId,
        },
        printSettings.warrantyCopies,
      );
    }
  };

  const handleAddQuickCustomer = () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) {
      showToast('Vui lòng nhập tên và số điện thoại khách hàng', 'error');
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
          isEditMode={!!activeTab.editingOrderId}
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
          isEditMode={!!activeTab.editingOrderId}
        />
        {showReceiptModal && lastOrder && (
          <POSReceiptModal
            order={lastOrder}
            cashReceived={lastOrder.cashReceived ?? cashReceived}
            brandProfile={brandProfile}
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
        printSettings={printSettings}
        setPrintSettings={setPrintSettings}
        brandProfile={brandProfile}
        showGridMenu={showGridMenu}
        setShowGridMenu={setShowGridMenu}
        onGoToManagement={
          requireManagerAuth
            ? () => setShowManagerUnlock(true)
            : onGoToManagement
        }
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
        onCreateExpense={() => {
          setShowGridMenu(false);
          setExpenseDraft({ category: expenseCategories[0]?.name || '', amount: '', description: '', staffName: defaultSalespersonName || '' });
          setShowExpenseModal(true);
        }}
        onLogout={resetPOSSession}
        activeThemeId={activeThemeId}
        onThemeChange={onThemeChange}
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
          showConsultant={showConsultant && salesAdvisorEnabled}
          setShowConsultant={salesAdvisorEnabled ? setShowConsultant : () => {}}
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
          isDataReady={isDataReady}
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
          returnDiscount={returnDiscount}
          returnFee={returnFee}
          returnOtherRefund={returnOtherRefund}
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
          isEditMode={!!activeTab.editingOrderId}
        />
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && lastOrder && (
        <POSReceiptModal
          order={lastOrder}
          cashReceived={lastOrder.cashReceived ?? cashReceived}
          brandProfile={brandProfile}
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
            // Map legacy UUID → tên nhân viên cho đơn hàng cũ
            ...DEFAULT_POS_STAFF
              .filter(s => !!s.legacyId)
              .map(s => ({ id: s.legacyId!, name: s.name, position: '', joinDate: '' })),
          ]}
          onClose={() => setShowEODReport(false)}
        />
      )}

      {/* Process Orders Modal */}
      {showProcessOrdersModal && (
        <ProcessOrdersModal
          orders={orders}
          customers={customers}
          employees={employees}
          storeName={brandProfile?.name}
          onClose={() => setShowProcessOrdersModal(false)}
          onUpdateSurgical={onUpdateSurgical}
          onReturnInPOS={order => {
            setShowProcessOrdersModal(false);
            handleSelectOrderReturn(order);
          }}
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

      {showManagerUnlock && (
        <ManagerUnlockModal
          onSuccess={() => {
            setShowManagerUnlock(false);
            onManagerUnlocked?.();
          }}
          onCancel={() => setShowManagerUnlock(false)}
        />
      )}

      {/* Quick Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Lập phiếu chi</h3>
              <button onClick={() => setShowExpenseModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Ngày</label>
                <input
                  readOnly
                  value={new Date().toLocaleDateString('vi-VN')}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Danh mục chi <span className="text-rose-500">*</span></label>
                {expenseCategories.length > 0 ? (
                  <select
                    value={expenseDraft.category}
                    onChange={e => setExpenseDraft(p => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {expenseCategories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={expenseDraft.category}
                    onChange={e => setExpenseDraft(p => ({ ...p, category: e.target.value }))}
                    placeholder="Nhập danh mục chi..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Số tiền <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  value={expenseDraft.amount}
                  onChange={e => setExpenseDraft(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Người chi</label>
                <input
                  value={expenseDraft.staffName}
                  onChange={e => setExpenseDraft(p => ({ ...p, staffName: e.target.value }))}
                  placeholder="Tên người chi..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={expenseDraft.description}
                  onChange={e => setExpenseDraft(p => ({ ...p, description: e.target.value }))}
                  placeholder="Ghi chú thêm..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                disabled={!expenseDraft.category.trim() || !expenseDraft.amount || Number(expenseDraft.amount) <= 0}
                onClick={() => {
                  const record: ExpenseRecord = {
                    id: generateId(),
                    date: new Date().toISOString(),
                    category: expenseDraft.category.trim(),
                    amount: Number(expenseDraft.amount),
                    description: expenseDraft.description.trim(),
                    staffName: expenseDraft.staffName.trim() || undefined,
                  };
                  onAddExpense?.(record);
                  setShowExpenseModal(false);
                  showToast('Đã lập phiếu chi thành công', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-normal hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Lưu phiếu chi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSComputer;
