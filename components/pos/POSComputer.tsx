import React, { useState, useMemo, useRef, useEffect } from 'react';
import { generateId } from '../../businessLogic';
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
import { POSProduct, POSCustomer, POSOrder, POSOrderItem, BrandProfile } from '../../types';
import { usePOSKeyboard } from './usePOSKeyboard';
import { usePOSReturnFlow } from './usePOSReturnFlow';
import { usePOSTabs } from './usePOSTabs';

interface POSComputerProps {
  products: POSProduct[];
  customers: POSCustomer[];
  orders: POSOrder[];
  onPlaceOrder: (
    order: POSOrder,
    updatedProducts: POSProduct[],
    updatedCustomer?: POSCustomer
  ) => void;
  onReturnOrder: (
    order: POSOrder,
    updatedProducts: POSProduct[],
    returnedItems: POSOrderItem[],
    exchangeItems: POSOrderItem[]
  ) => void;
  onAddCustomer: (customer: POSCustomer) => void;
  onGoToManagement?: () => void;
  brandProfile?: BrandProfile;
  currentStaffName?: string;
  offlinePendingCount?: number;
  isDraining?: boolean;
  isActive?: boolean;
}

export interface InvoiceTab {
  id: string;
  name: string;
  mode: 'sales' | 'return';
  cart: POSOrderItem[];
  returnCart: POSOrderItem[];
  selectedCustomer: POSCustomer | null;
  discountValue: number;
  discountType: 'fixed' | 'percent';
  paymentMethod: 'Cash' | 'Bank' | 'Momo' | 'Other';
  orderNote: string;
  otherFees: number;
  cashReceived: number;
  // Return specific fields
  returnDiscount: number;
  returnFee: number;
  returnOtherRefund: number;
  // Split payment fields
  splitPayment?: {
    cash: number;
    bank: number;
    card: number;
    momo: number;
  };
}

const POSComputer: React.FC<POSComputerProps> = ({
  products,
  customers,
  orders,
  onPlaceOrder,
  onAddCustomer,
  onGoToManagement,
  offlinePendingCount = 0,
  isDraining = false,
  isActive = true,
}) => {
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
      paymentMethod: 'Cash',
      orderNote: '',
      otherFees: 0,
      cashReceived: 0,
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
  const splitPayment = activeTab.splitPayment || { cash: 0, bank: 0, card: 0, momo: 0 };

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
    area: '',
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
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(true);
  const [lastOrder, setLastOrder] = useState<POSOrder | null>(null);
  const [autoPromotion] = useState(0);

  // Return Modal states
  // Search state enhancements
  const [showProductResults, setShowProductResults] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

  const productSearchRef = useRef<HTMLInputElement>(null);
  const consultantSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const searchResultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkoutRef = useRef<() => void>(() => {});
  const cartLengthRef = useRef(0);

  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [stockWarning, setStockWarning] = useState<string | null>(null);

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

  const openConfirm = (config: Omit<typeof confirmDialog, 'isOpen'>) => {
    setConfirmDialog({ ...config, isOpen: true });
  };
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const { updateActiveTab, addNewTab, closeTab } = usePOSTabs({
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    openConfirm,
    closeConfirm,
  });

  // Show scan feedback
  const showScanFeedback = (productName: string) => {
    setScanFeedback(productName);
    setTimeout(() => setScanFeedback(null), 2000);
  };

  const showStockWarning = (message: string) => {
    setStockWarning(message);
    setTimeout(() => setStockWarning(null), 2500);
  };

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

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
    return products
      .filter(
        p =>
          p.status === 'Active' &&
          !p.isParent &&
          ((p.name?.toLowerCase() || '').includes(search) ||
            (p.sku?.toLowerCase() || '').includes(search) ||
            (p.barcode && p.barcode.includes(search)))
      )
      .sort((a, b) => {
        if (productSearchSort === 'priceDesc') return b.salePrice - a.salePrice;
        return (b.sku || '').localeCompare(a.sku || '', 'vi', { numeric: true, sensitivity: 'base' });
      })
      .slice(0, 10);
  }, [products, debouncedSearchTerm, productSearchSort]);

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
    return customers
      .filter(
        c => c.phone.includes(debouncedCustomerSearch) || c.name.toLowerCase().includes(search)
      )
      .slice(0, 10);
  }, [customers, debouncedCustomerSearch]);

  const addToCart = React.useCallback(
    (product: POSProduct) => {
      if (product.isParent) return;

      // Check stock outside setTabs to avoid side effects inside state updater
      const currentCart = activeTab.cart;
      const existingItem = currentCart.find(item => item.productId === product.id);
      const qtyInCart = existingItem?.quantity ?? 0;
      if (product.stock <= 0 || qtyInCart >= product.stock) {
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
              },
            ];
          }
          return { ...t, cart: newCart };
        })
      );
    },
    [activeTabId, activeTab.cart]
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
              const newQty = Math.min(maxQty, Math.max(1, item.quantity + delta));
              return { ...item, quantity: newQty, total: newQty * (item.price - item.discount) };
            }
            return item;
          });
          return { ...t, cart: newCart };
        })
      );
    },
    [activeTabId, products]
  );

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

  const updateItemDiscount = React.useCallback(
    (productId: string, discountAmount: number) => {
      setTabs(prev =>
        prev.map(t => {
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            cart: t.cart.map(item =>
              item.productId !== productId
                ? item
                : {
                    ...item,
                    discount: discountAmount,
                    total: item.quantity * (item.price - discountAmount),
                  }
            ),
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
  const pointsEarned = Math.floor(netPayable / 10000);

  const {
    updateReturnQuantity,
    removeFromReturnCart,
    totalReturnBeforeDiscount,
    finalReturnAmount,
    amountToPayCustomer,
    handleReturnFast,
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
  const currentCashReceived = cashReceived || netPayable;

  const handleCheckout = () => {
    if (cart.length === 0 || isCheckoutLocked) return;

    const insufficientItem = cart.find(item => {
      const product = products.find(p => p.id === item.productId);
      return !product || product.stock < item.quantity;
    });

    if (insufficientItem) {
      const product = products.find(p => p.id === insufficientItem.productId);
      showStockWarning(
        `${insufficientItem.name} — không đủ hàng để thanh toán (tồn: ${product?.stock ?? 0}, cần: ${insufficientItem.quantity})`
      );
      return;
    }

    setIsCheckoutLocked(true);
    const orderId = generateId();
    const orderCode = `HD-${Date.now().toString().slice(-6)}`;

    const newOrder: POSOrder = {
      id: orderId,
      orderCode,
      date: new Date().toISOString(),
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      items: cart,
      totalAmount: totalBeforeDiscount,
      discount: totalDiscount,
      finalAmount: netPayable,
      paymentMethod: paymentMethod,
      staffId: getCurrentStaffId(),
      pointsEarned: pointsEarned,
      notes: orderNote,
    };

    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.productId === p.id);
      if (cartItem) {
        return { ...p, stock: p.stock - cartItem.quantity };
      }
      return p;
    });

    let updatedCustomer: POSCustomer | undefined;
    if (selectedCustomer) {
      updatedCustomer = {
        ...selectedCustomer,
        points: selectedCustomer.points + pointsEarned,
        totalSpent: selectedCustomer.totalSpent + netPayable,
        lastVisit: new Date().toISOString(),
      };
    }

    try {
      onPlaceOrder(newOrder, updatedProducts, updatedCustomer);

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
      throw err;
    }
  };

  useEffect(() => {
    checkoutRef.current = handleCheckout;
    cartLengthRef.current = cart.length;
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
          returnDiscount: 0,
          returnFee: 0,
          returnOtherRefund: 0,
          splitPayment: { cash: 0, bank: 0, card: 0, momo: 0 },
        },
      ]);
      setActiveTabId('default');
    }
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
              font-family: 'Arial', sans-serif; 
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
              <div class="flex-between"><span>Thu ngân:</span><span>${lastOrder.staffId}</span></div>
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
              <div class="total-row grand-total"><span>TỔNG CỘNG:</span><span class="bold">${lastOrder.finalAmount.toLocaleString()}đ</span></div>
              <div class="total-row" style="margin-top: 10px;"><span>Thanh toán:</span><span class="bold uppercase">${lastOrder.paymentMethod}</span></div>
              <div class="total-row"><span>Khách đưa:</span><span class="bold">${(cashReceived || lastOrder.finalAmount).toLocaleString()}đ</span></div>
              ${(cashReceived || lastOrder.finalAmount) > lastOrder.finalAmount ? `<div class="total-row"><span>Tiền thừa:</span><span class="bold">${((cashReceived || lastOrder.finalAmount) - lastOrder.finalAmount).toLocaleString()}đ</span></div>` : ''}
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
      alert('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in hóa đơn.');
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
      address: [newCustomerForm.address, newCustomerForm.ward, newCustomerForm.area]
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
    setNewCustomerForm({
      code: '',
      name: '',
      phone: '',
      group: 'Khách lẻ',
      birthday: '',
      gender: '',
      address: '',
      area: '',
      ward: '',
      taxCode: '',
      email: '',
      facebook: '',
      notes: '',
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
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
        offlinePendingCount={offlinePendingCount}
        isDraining={isDraining}
        isAutoPrintEnabled={isAutoPrintEnabled}
        setIsAutoPrintEnabled={setIsAutoPrintEnabled}
        showGridMenu={showGridMenu}
        setShowGridMenu={setShowGridMenu}
        onGoToManagement={onGoToManagement}
        onViewEODReport={() => setShowEODReport(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main Area (Left) */}
        <POSCart
          mode={mode}
          cart={cart}
          returnCart={returnCart}
          orderNote={orderNote}
          showConsultant={showConsultant}
          setShowConsultant={setShowConsultant}
          products={products}
          addToCart={addToCart}
          consultantSearchRef={consultantSearchRef}
          onUpdateQuantity={updateQuantity}
          onRemoveFromCart={removeFromCart}
          onUpdateReturnQuantity={updateReturnQuantity}
          onRemoveFromReturnCart={removeFromReturnCart}
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
          currentCashReceived={currentCashReceived}
          pointsEarned={pointsEarned}
          paymentMethod={paymentMethod}
          useSplitPayment={useSplitPayment}
          setUseSplitPayment={setUseSplitPayment}
          splitPayment={splitPayment}
          cashSuggestions={cashSuggestions}
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
          onClose={() => setShowReceiptModal(false)}
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
        />
      )}

      {/* End of Day Report Modal */}
      {showEODReport && (
        <EndOfDayReport
          orders={orders}
          onClose={() => setShowEODReport(false)}
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
