import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Monitor, Search, ShoppingCart, User, Plus, Minus, X, CheckCircle2, 
  LayoutGrid, Filter, Zap, PackageOpen, MoreHorizontal, Scan,
  ChevronDown, ChevronUp, Printer, RotateCcw, RefreshCw, ShoppingBag,
  UserCircle, FileText, ChevronRight, Activity, Undo2, PenTool, 
  StickyNote, FileInput, Eye, Keyboard, LogOut, Trash2, MoreVertical, Package
} from 'lucide-react';
import { POSProduct, POSCustomer, POSOrder, POSOrderItem } from '../../types';

interface POSComputerProps {
  products: POSProduct[];
  customers: POSCustomer[];
  orders: POSOrder[];
  onPlaceOrder: (order: POSOrder, updatedProducts: POSProduct[], updatedCustomer?: POSCustomer) => void;
  onAddCustomer: (customer: POSCustomer) => void;
  onGoToManagement?: () => void;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

interface InvoiceTab {
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
}

const POSComputer: React.FC<POSComputerProps> = ({ products, customers, orders, onPlaceOrder, onAddCustomer, onGoToManagement }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [consultantSearch, setConsultantSearch] = useState('');
  const [debouncedConsultantSearch, setDebouncedConsultantSearch] = useState('');
  const [consultantCategory, setConsultantCategory] = useState('All');
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
      returnOtherRefund: 0
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('default');
  
  // Active Tab Data Accessor
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

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

  // Helper to update active tab
  const updateActiveTab = (updates: Partial<InvoiceTab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '' });
  
  // UI states
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(true);
  const [lastOrder, setLastOrder] = useState<POSOrder | null>(null);
  const [autoPromotion] = useState(0); 
  
  // Return Modal states
  const [returnSearch, setReturnSearch] = useState({
    invoiceId: '',
    trackingId: '',
    customer: '',
    productId: '',
    productName: '',
    fromDate: '2026-04-04', // Today based on screenshot
    toDate: ''
  });
  
  // Search state enhancements
  const [showProductResults, setShowProductResults] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  
  const productSearchRef = useRef<HTMLInputElement>(null);
  const consultantSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedConsultantSearch(consultantSearch), 300);
    return () => clearTimeout(timer);
  }, [consultantSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Categories for consultant
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.categoryId || 'Khác')));
    return ['All', ...cats];
  }, [products]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          setShowConsultant(true);
          setTimeout(() => consultantSearchRef.current?.focus(), 100);
        } else {
          productSearchRef.current?.focus();
        }
      }
      if (e.key === 'F4') {
        e.preventDefault();
        customerSearchRef.current?.focus();
      }
      if (e.key === 'F9' && cart.length > 0) {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Search filter
  const searchFilteredProducts = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) return [];
    const search = debouncedSearchTerm.toLowerCase();
    return products.filter(p => 
      p.status === 'Active' && 
      ((p.name?.toLowerCase() || '').includes(search) || 
       (p.sku?.toLowerCase() || '').includes(search) ||
       (p.barcode && p.barcode.includes(search)))
    ).slice(0, 10);
  }, [products, debouncedSearchTerm]);

  useEffect(() => {
    if (debouncedSearchTerm && searchFilteredProducts.length > 0) {
      setShowProductResults(true);
      setSelectedResultIndex(0);
    } else {
      setShowProductResults(false);
    }
  }, [debouncedSearchTerm, searchFilteredProducts]);

  const filteredProducts = useMemo(() => {
    const search = debouncedConsultantSearch.toLowerCase();
    return products.filter(p => 
      p.status === 'Active' && 
      (consultantCategory === 'All' || p.categoryId === consultantCategory) &&
      ((p.name?.toLowerCase() || '').includes(search) || 
       (p.sku?.toLowerCase() || '').includes(search) ||
       (p.barcode && p.barcode.includes(search)))
    ).slice(0, 48); // Limit render to avoid performance drop with huge catalogs
  }, [products, debouncedConsultantSearch, consultantCategory]);

  const filteredCustomers = useMemo(() => {
    if (!debouncedCustomerSearch) return [];
    const search = debouncedCustomerSearch.toLowerCase();
    return customers.filter(c => 
      c.phone.includes(debouncedCustomerSearch) || 
      c.name.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [customers, debouncedCustomerSearch]);

  const addToCart = React.useCallback((product: POSProduct) => {
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      const prevCart = t.cart;
      const existing = prevCart.find(item => item.productId === product.id);
      let newCart;
      if (existing) {
        newCart = prevCart.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      } else {
        newCart = [...prevCart, {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          price: product.salePrice,
          discount: 0,
          total: product.salePrice
        }];
      }
      return { ...t, cart: newCart };
    }));
  }, [activeTabId]);

  const updateQuantity = React.useCallback((productId: string, delta: number) => {
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      const newCart = t.cart.map(item => {
        if (item.productId === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, total: newQty * item.price };
        }
        return item;
      });
      return { ...t, cart: newCart };
    }));
  }, [activeTabId]);

  const removeFromCart = React.useCallback((productId: string) => {
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      const newCart = t.cart.filter(item => item.productId !== productId);
      // Reset cashReceived to 0 if cart is empty
      const newCashReceived = newCart.length === 0 ? 0 : t.cashReceived;
      return { ...t, cart: newCart, cashReceived: newCashReceived };
    }));
  }, [activeTabId]);

  const addToReturnCart = React.useCallback((product: POSProduct) => {
    setTabs(prevTabs => prevTabs.map(t => {
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
        newCart = [...prevCart, {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          price: product.salePrice,
          discount: 0,
          total: product.salePrice
        }];
      }
      return { ...t, returnCart: newCart };
    }));
  }, [activeTabId]);

  const updateReturnQuantity = React.useCallback((productId: string, delta: number) => {
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      const newCart = (t.returnCart || []).map(item => {
        if (item.productId === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, total: newQty * item.price };
        }
        return item;
      });
      return { ...t, returnCart: newCart };
    }));
  }, [activeTabId]);

  const removeFromReturnCart = React.useCallback((productId: string) => {
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      const newCart = (t.returnCart || []).filter(item => item.productId !== productId);
      return { ...t, returnCart: newCart };
    }));
  }, [activeTabId]);

  const totalBeforeDiscount = cart.reduce((acc, item) => acc + item.total, 0);
  const totalReturnBeforeDiscount = returnCart.reduce((acc, item) => acc + item.total, 0);
  
  const manualDiscountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (totalBeforeDiscount * discountValue) / 100;
    }
    return discountValue;
  }, [totalBeforeDiscount, discountValue, discountType]);

  const totalDiscount = manualDiscountAmount + autoPromotion;
  const netPayable = Math.max(0, totalBeforeDiscount - totalDiscount + otherFees);
  const pointsEarned = Math.floor(netPayable / 10000);

  const finalReturnAmount = Math.max(0, totalReturnBeforeDiscount - returnDiscount - returnFee + returnOtherRefund);
  
  // Balance calculation: Return Value - Purchase Value
  const netReturnDifference = finalReturnAmount - netPayable;
  const amountToPayCustomer = netReturnDifference > 0 ? netReturnDifference : 0;
  const customerPaysDifference = netReturnDifference < 0 ? Math.abs(netReturnDifference) : 0;
  
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
  const filteredReturnOrders = useMemo(() => {
    return orders.filter(order => {
      const matchInvoiceId = !returnSearch.invoiceId || 
        order.orderCode.toLowerCase().includes(returnSearch.invoiceId.toLowerCase());
      
      const matchCustomer = !returnSearch.customer || 
        (order.customerName && order.customerName.toLowerCase().includes(returnSearch.customer.toLowerCase())) ||
        (order.customerId && customers.find(c => c.id === order.customerId)?.phone.includes(returnSearch.customer));

      const matchDate = (!returnSearch.fromDate || new Date(order.date) >= new Date(returnSearch.fromDate)) &&
                        (!returnSearch.toDate || new Date(order.date) <= new Date(returnSearch.toDate));

      // In a real app we'd also check products, but let's keep it simple for now as per minimal metadata logic
      return matchInvoiceId && matchCustomer && matchDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, returnSearch, customers]);

  const currentCashReceived = cashReceived || netPayable;
  const changeDue = currentCashReceived > netPayable ? currentCashReceived - netPayable : 0;

  const handleCheckout = () => {
    if (cart.length === 0) return;

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
      staffId: 'Admin',
      pointsEarned: pointsEarned,
      notes: orderNote
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
        lastVisit: new Date().toISOString()
      };
    }

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
  };

  const handleFinishOrder = () => {
    setShowReceiptModal(false);
    setLastOrder(null);

    // Reset or Switch tab after checkout completion
    if (tabs.length > 1) {
      const remainingTabs = tabs.filter(t => t.id !== activeTabId);
      setTabs(remainingTabs);
      setActiveTabId(remainingTabs[0].id);
    } else {
      setTabs([{
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
        returnOtherRefund: 0
      }]);
      setActiveTabId('default');
    }
  };

  const handleReturnFast = () => {
    const nextNum = Math.max(0, ...tabs.map(t => {
      const match = t.name.match(/Trả hàng (\d+)/);
      return match ? parseInt(match[1]) : 0;
    })) + 1;
    const newId = generateId();
    setTabs(prev => [...prev, {
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
      returnDiscount: 0,
      returnFee: 0,
      returnOtherRefund: 0
    }]);
    setActiveTabId(newId);
    setShowReturnModal(false);
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
                ${lastOrder.items.map(item => `
                  <tr>
                    <td>
                      <div class="bold uppercase">${item.name}</div>
                      <div style="font-size: 10px; color: #666;">${item.price.toLocaleString()}đ</div>
                    </td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;" class="bold">${item.total.toLocaleString()}đ</td>
                  </tr>
                `).join('')}
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
      points: 0,
      totalSpent: 0,
      tier: 'Standard'
    };
    onAddCustomer(newCustomer);
    updateActiveTab({ selectedCustomer: newCustomer });
    setShowAddCustomerModal(false);
    setNewCustomerForm({ name: '', phone: '' });
  };

  const addNewTab = () => {
    const nextNum = Math.max(0, ...tabs.map(t => {
      const match = t.name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })) + 1;
    const newId = generateId();
    setTabs(prev => [...prev, {
      id: newId,
      name: `Hóa đơn ${nextNum}`,
      cart: [],
      selectedCustomer: null,
      discountValue: 0,
      discountType: 'percent',
      paymentMethod: 'Cash',
      orderNote: '',
      otherFees: 0,
      cashReceived: 0
    }]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Just reset the single tab
      setTabs([{
        id: 'default',
        name: 'Hóa đơn 1',
        cart: [],
        selectedCustomer: null,
        discountValue: 0,
        discountType: 'percent',
        paymentMethod: 'Cash',
        orderNote: '',
        otherFees: 0,
        cashReceived: 0
      }]);
      setActiveTabId('default');
      return;
    }
    
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* CFO Brain Professional Header */}
      <div className="bg-slate-100 h-14 flex items-center px-4 gap-2 shrink-0 shadow-sm z-50 border-b border-slate-200">
        {/* Product Search */}
        <div className="relative w-[300px]">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center text-slate-400">
             <Search className="h-4 w-4" />
          </div>
          <input 
            ref={productSearchRef}
            type="text" 
            placeholder="Tìm hàng hóa (F3)" 
            className="w-full pl-10 pr-10 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-sm outline-none font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onBlur={() => {
              // Delay hiding to allow clicks on results
              setTimeout(() => setShowProductResults(false), 200);
            }}
            onFocus={() => {
              if (searchFilteredProducts.length > 0) setShowProductResults(true);
            }}
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              
              // Immediate check for exact barcode/SKU match (common for scanners)
              if (val.length >= 3) {
                const exactMatch = products.find(p => p.status === 'Active' && (p.barcode === val || p.sku === val));
                if (exactMatch) {
                  addToCart(exactMatch);
                  setSearchTerm('');
                  setDebouncedSearchTerm('');
                  setShowProductResults(false);
                }
              }
            }}
            onKeyDown={(e) => {
              if (showProductResults && searchFilteredProducts.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedResultIndex(prev => (prev + 1) % searchFilteredProducts.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedResultIndex(prev => (prev - 1 + searchFilteredProducts.length) % searchFilteredProducts.length);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (selectedResultIndex >= 0) {
                    addToCart(searchFilteredProducts[selectedResultIndex]);
                    setSearchTerm('');
                    setDebouncedSearchTerm('');
                    setShowProductResults(false);
                  }
                } else if (e.key === 'Escape') {
                  setShowProductResults(false);
                }
              } else if (e.key === 'Enter' && searchTerm) {
                // When Enter is pressed (often by scanner), find first or exact match
                const match = products.find(p => 
                  p.status === 'Active' && 
                  (p.barcode === searchTerm || p.sku === searchTerm || p.name.toLowerCase() === searchTerm.toLowerCase())
                );
                
                if (match) {
                  addToCart(match);
                  setSearchTerm('');
                  setDebouncedSearchTerm('');
                }
              }
            }}
          />
          <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 p-1 rounded-lg transition-colors">
             <Scan className="h-4 w-4" />
          </button>

          {/* Search Results Dropdown */}
          {showProductResults && searchFilteredProducts.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden z-[60] max-h-[400px] overflow-y-auto no-scrollbar">
              {searchFilteredProducts.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => {
                    addToCart(p);
                    setSearchTerm('');
                    setDebouncedSearchTerm('');
                    setShowProductResults(false);
                  }}
                  onMouseEnter={() => setSelectedResultIndex(idx)}
                  className={`w-full px-4 py-3 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-all text-left ${idx === selectedResultIndex ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-100">
                    {p.images && p.images[0] ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <PackageOpen className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className={`text-sm font-bold truncate ${idx === selectedResultIndex ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {p.name}
                      </span>
                      <span className="text-indigo-600 font-mono text-[10px] font-bold shrink-0">{p.salePrice.toLocaleString()}đ</span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{p.sku}</span>
                      <span className={`text-[10px] font-bold ${p.stock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        Tồn: {p.stock}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Invoice Tabs */}
        <div className="flex items-center self-stretch ml-2 overflow-x-auto no-scrollbar max-w-[500px]">
           {tabs.map((tab) => (
              <div 
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`h-full px-5 flex items-center gap-3 rounded-none font-bold text-sm border-t-2 transition-all cursor-pointer shadow-sm min-w-[140px] justify-between group ${activeTabId === tab.id ? 'bg-white text-indigo-600 border-indigo-500' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600'}`}
              >
                <div className="flex items-center gap-2">
                  <span>{tab.name}</span>
                </div>
                <X 
                  className={`h-4 w-4 text-slate-300 hover:text-rose-500 transition-colors ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} 
                  onClick={(e) => closeTab(e, tab.id)}
                />
              </div>
           ))}
           <div 
             onClick={addNewTab}
             className="h-full flex items-center px-4 gap-2 text-slate-500 hover:text-indigo-600 cursor-pointer border-l border-slate-200 bg-slate-50 hover:bg-white transition-all"
           >
              <Plus className="h-5 w-5" />
           </div>
        </div>

        <div className="flex-1" />

        {/* Utility Icons */}
        <div className="flex items-center gap-4 px-2 text-slate-600">
           <button title="Lượt khách" className="hover:text-indigo-600 transition-colors"><ShoppingBag className="h-4.5 w-4.5" /></button>
           <button 
             title="Đổi trả" 
             onClick={() => setShowReturnModal(true)}
             className="hover:text-indigo-600 transition-colors"
           >
             <RotateCcw className="h-4.5 w-4.5" />
           </button>
           <button title="Đồng bộ" className="hover:text-indigo-600 transition-colors"><RefreshCw className="h-4.5 w-4.5" /></button>
           <button 
             title="In (Auto)" 
             onClick={() => setIsAutoPrintEnabled(!isAutoPrintEnabled)}
             className={`transition-all ${isAutoPrintEnabled ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <Printer className="h-4.5 w-4.5" />
           </button>
           <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-700 uppercase">admin</span>
                <ChevronDown className="h-3 w-3" />
              </div>
              <div className="relative">
                <div 
                  onClick={() => setShowGridMenu(!showGridMenu)}
                  className={`h-9 w-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${showGridMenu ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`}
                >
                  <LayoutGrid className="h-4.5 w-4.5" />
                </div>

                {/* Grid Popup Menu */}
                {showGridMenu && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setShowGridMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 z-[101] overflow-hidden py-2 animate-in fade-in slide-in-from-top-4 duration-200">
                      <GridMenuItem icon={<Activity className="h-4.5 w-4.5" />} label="Xem báo cáo cuối ngày" />
                      <GridMenuItem icon={<ShoppingBag className="h-4.5 w-4.5" />} label="Xử lý đặt hàng" />
                      <GridMenuItem icon={<Undo2 className="h-4.5 w-4.5" />} label="Chọn hóa đơn trả hàng" />
                      <GridMenuItem icon={<PenTool className="h-4.5 w-4.5" />} label="Xử lý yêu cầu sửa chữa" />
                      <GridMenuItem icon={<StickyNote className="h-4.5 w-4.5 text-indigo-600" />} label="Lập phiếu thu" active />
                      <GridMenuItem icon={<FileInput className="h-4.5 w-4.5" />} label="Import file" />
                      <GridMenuItem icon={<Eye className="h-4.5 w-4.5" />} label="Tùy chọn hiển thị" />
                      <GridMenuItem icon={<Keyboard className="h-4.5 w-4.5" />} label="Phím tắt" />
                      <GridMenuItem icon={<LayoutGrid className="h-4.5 w-4.5" />} label="Quản lý" onClick={onGoToManagement} />
                      <div className="h-px bg-slate-50 my-1 mx-4" />
                      <GridMenuItem icon={<LogOut className="h-4.5 w-4.5 text-rose-500" />} label="Đăng xuất" />
                    </div>
                  </>
                )}
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Area (Left) */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar">
            {mode === 'return' ? (
              <div className="flex-1 flex flex-col">
                {/* Search Bar for Return items */}
                <div className="bg-white border-b border-slate-200 p-2 flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Tìm hàng trả (F3)" 
                      className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-slate-50 border border-slate-100 rounded-lg outline-none focus:bg-white focus:border-indigo-400 transition-all"
                    />
                  </div>
                  <Scan className="h-5 w-5 text-indigo-500" />
                </div>
                
                {/* Return Items List */}
                <div className="h-1/2 overflow-y-auto no-scrollbar border-b border-indigo-100 bg-white italic">
                   {returnCart.length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-300 py-10">
                        <p className="text-[10px] font-black uppercase tracking-widest">Danh sách hàng trả trống</p>
                     </div>
                   ) : (
                     <table className="w-full text-xs text-left">
                        <tbody className="divide-y divide-slate-100">
                           {returnCart.map((item, idx) => (
                             <CartItemRow 
                               key={item.productId} 
                               item={item} 
                               idx={returnCart.length - idx} 
                               onUpdate={updateReturnQuantity} 
                               onRemove={removeFromReturnCart} 
                               isReturnItem
                             />
                           ))}
                        </tbody>
                     </table>
                   )}
                </div>

                {/* Search Bar for Exchange items */}
                <div className="bg-indigo-600 p-2 flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                    <input 
                      type="text" 
                      placeholder="Tìm hàng đổi (F7)" 
                      className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-white/10 text-white placeholder:text-white/40 border border-white/10 rounded-lg outline-none focus:bg-white focus:text-slate-900 transition-all"
                    />
                  </div>
                  <Scan className="h-5 w-5 text-white" />
                </div>

                {/* Exchange Items List (Normal Cart) */}
                <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/30">
                   {cart.length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-300 py-10">
                        <p className="text-[10px] font-black uppercase tracking-widest">Danh sách hàng đổi trống</p>
                     </div>
                   ) : (
                     <table className="w-full text-xs text-left italic">
                        <tbody className="divide-y divide-slate-100 bg-white">
                           {cart.map((item, idx) => (
                             <CartItemRow 
                               key={item.productId} 
                               item={item} 
                               idx={cart.length - idx} 
                               onUpdate={updateQuantity} 
                               onRemove={removeFromCart} 
                             />
                           ))}
                        </tbody>
                     </table>
                   )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pt-4 flex flex-col no-scrollbar">
                 {cart.length === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                      <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-8 border border-slate-100">
                         <PackageOpen className="h-10 w-10 text-slate-200" />
                      </div>
                      <p className="font-black text-sm uppercase tracking-[0.3em] text-slate-400">Hệ thống chưa có sản phẩm</p>
                      <p className="text-[11px] mt-3 font-bold text-slate-400/60 uppercase tracking-widest italic">Quét mã vạch hoặc ấn F3 để bắt đầu bán hàng</p>
                   </div>
                 ) : (
                   <div className="bg-white border-y border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                     <table className="w-full text-xs text-left">
                        <tbody className="divide-y divide-slate-100 italic">
                           {cart.map((item, idx) => (
                             <CartItemRow 
                               key={item.productId} 
                               item={item} 
                               idx={cart.length - idx} 
                               onUpdate={updateQuantity} 
                               onRemove={removeFromCart} 
                             />
                           ))}
                        </tbody>
                     </table>
                   </div>
                 )}
              </div>
            )}
          </div>

          {/* Foot Note Section */}
          <div className="px-8 pb-8">
             <div className="bg-white border border-slate-200 rounded-[1.5rem] px-5 py-3 flex items-center gap-4 focus-within:border-indigo-400 focus-within:shadow-lg focus-within:shadow-indigo-500/5 transition-all group shadow-sm">
                <FileText className="h-4.5 w-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Ghi chú đơn hàng cho bộ phận kho hoặc nhân viên giao hàng..." 
                  className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-medium"
                  value={orderNote}
                  onChange={(e) => updateActiveTab({ orderNote: e.target.value })}
                />
             </div>
          </div>

           {/* Sales Consultant Drawer */}
          <div className={`bg-slate-200/50 transition-all duration-300 ease-in-out ${showConsultant ? 'h-[40%]' : 'h-10'} flex flex-col border-t border-slate-200`}>
            <div 
              className="h-14 bg-white flex items-center px-8 cursor-pointer hover:bg-slate-50 transition-all shrink-0 border-b border-slate-200 gap-8"
              onClick={() => setShowConsultant(!showConsultant)}
            >
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[14px] font-black uppercase text-slate-800 tracking-tight">TƯ VẤN BÁN HÀNG</span>
              </div>
              
              {showConsultant ? (
                <div className="flex flex-1 items-center gap-4" onClick={e => e.stopPropagation()}>
                    <div className="relative flex-1 max-w-xl group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            ref={consultantSearchRef}
                            type="text"
                            placeholder="(Shift + F3) Tìm kiếm"
                            className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                            value={consultantSearch}
                            onChange={(e) => setConsultantSearch(e.target.value)}
                        />
                    </div>

                    <div className="relative w-64">
                        <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
                        <select 
                            className="w-full pl-10 pr-8 py-1.5 bg-white border border-indigo-400 rounded-lg text-xs font-bold text-indigo-600 outline-none appearance-none hover:bg-indigo-50 transition-all cursor-pointer shadow-sm"
                            value={consultantCategory}
                            onChange={(e) => setConsultantCategory(e.target.value)}
                        >
                            <option value="All">Lọc theo nhóm hàng hóa</option>
                            {categories.filter(c => c !== 'All').map(cat => (
                                <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 pointer-events-none" />
                    </div>
                </div>
              ) : (
                 <div className="flex items-center gap-2 text-slate-400 ml-auto">
                    <span className="text-[9px] font-bold uppercase tracking-widest">Ấn để mở bảng tư vấn trực quan</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                 </div>
              )}
            </div>

            {showConsultant && (
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-6 gap-3 no-scrollbar animate-in fade-in slide-in-from-bottom-6 duration-500">
                 {filteredProducts.slice(0, 12).map(p => (
                    <ProductMemoCard 
                      key={p.id} 
                      product={p} 
                      onAdd={addToCart} 
                    />
                 ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar (Checkout) */}
        <div className="w-[480px] bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden relative z-20">
          {/* Active User Header */}
          <div className="px-4 h-10 flex items-center justify-between bg-white border-b border-slate-100">
             <div className="flex items-center gap-2 group cursor-pointer">
                <div className="flex items-center gap-2">
                   <span className="text-xs font-bold text-slate-700">Ngô Thành Du</span>
                   <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="w-px h-3 bg-slate-200 mx-1" />
                <UserCircle className="h-4 w-4 text-slate-400" />
                <ChevronDown className="h-3 w-3 text-slate-400" />
             </div>
             <div className="text-[10px] font-medium text-slate-500">
                {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
             </div>
          </div>

          {/* Customer Search Section */}
          <div className="p-3 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                ref={customerSearchRef}
                type="text" 
                placeholder="Tìm khách hàng (F4)" 
                className="w-full pl-9 pr-10 py-1.5 bg-slate-100 border border-slate-100 rounded-lg text-sm font-medium outline-none focus:bg-white focus:border-indigo-300 transition-all"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              <button 
                onClick={() => setShowAddCustomerModal(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all"
                title="Thêm khách hàng mới"
              >
                <Plus className="h-5 w-5" />
              </button>
              
              {/* Customer Dropdown */}
              {!selectedCustomer && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-100 z-[100] mt-1 animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 bg-slate-50/50 border-b border-slate-100 text-[8px] font-black uppercase text-slate-400 tracking-wider">Kết quả tìm kiếm</div>
                  <div className="max-h-[200px] overflow-y-auto no-scrollbar">
                    {filteredCustomers.map(c => (
                      <button 
                        key={c.id}
                        className="w-full px-4 py-2 text-left hover:bg-indigo-50/50 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-all"
                        onClick={() => { updateActiveTab({ selectedCustomer: c }); setCustomerSearch(''); }}
                      >
                        <div>
                          <div className="font-black text-xs text-slate-800 group-hover:text-indigo-700 uppercase">{c.name}</div>
                          <div className="text-[9px] text-slate-400 font-bold group-hover:text-indigo-400 flex items-center gap-2">
                             <span className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-indigo-300"></span>
                             {c.phone}
                          </div>
                        </div>
                        <ChevronRight className="h-3 w-3 text-slate-200 group-hover:text-indigo-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Selected Customer Card */}
            {selectedCustomer && (
              <div className="mt-2 bg-indigo-50/50 border border-indigo-100 p-2 rounded-xl flex items-center justify-between animate-in zoom-in-95 shadow-sm">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md">
                       {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                       <div className="text-[11px] font-black text-indigo-950 uppercase tracking-tight leading-none">{selectedCustomer.name}</div>
                       <div className="text-[9px] font-bold text-indigo-500/80 flex items-center gap-2 mt-1">
                          <span>{selectedCustomer.phone}</span>
                          <span className="w-1 h-1 rounded-full bg-indigo-200"></span>
                          <span>ĐIỂM: {selectedCustomer.points.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => updateActiveTab({ selectedCustomer: null })} className="h-6 w-6 flex items-center justify-center text-indigo-300 hover:text-rose-500 transition-all">
                    <X className="h-3.5 w-3.5" />
                 </button>
              </div>
            )}
          </div>

          {/* Billing Values */}
          <div className="flex-1 p-4 flex flex-col font-medium overflow-y-auto no-scrollbar relative space-y-4">
            {mode === 'return' ? (
              <>
                {/* Trả hàng Section */}
                <div>
                   <h3 className="text-emerald-500 font-black text-lg mb-2 uppercase tracking-tight">Trả hàng</h3>
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Tổng giá gốc hàng mua</span>
                         <div className="flex items-center gap-4">
                            <span className="font-bold text-slate-400">{returnCart.reduce((a, b) => a + b.quantity, 0)}</span>
                            <span className="font-black text-slate-900">{totalReturnBeforeDiscount.toLocaleString()}</span>
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Tổng tiền hàng trả</span>
                         <div className="flex items-center gap-4">
                            <span className="font-bold text-slate-400">{returnCart.reduce((a, b) => a + b.quantity, 0)}</span>
                            <span className="font-black text-slate-900">{totalReturnBeforeDiscount.toLocaleString()}</span>
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Giảm giá</span>
                         <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                         <span className="font-black text-slate-900">0</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Phí trả hàng</span>
                         <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                         <span className="font-black text-slate-900">0</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Hoàn trả thu khác</span>
                         <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                         <span className="font-black text-slate-900">0</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                         <span className="text-xs font-black uppercase text-slate-400">Tổng tiền trả</span>
                         <span className="text-lg font-black text-slate-950">{finalReturnAmount.toLocaleString()}</span>
                      </div>
                   </div>
                </div>

                <div className="h-px bg-slate-100 border-b-2 border-dotted border-slate-200 my-2" />

                {/* Mua hàng Section */}
                <div>
                   <div className="flex items-center justify-between mb-2">
                      <h3 className="text-emerald-500 font-black text-lg uppercase tracking-tight">Mua hàng</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Giao hàng</span>
                      </label>
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Tổng tiền hàng</span>
                         <div className="flex items-center gap-4">
                            <span className="font-bold text-slate-400">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                            <span className="font-black text-slate-900">{totalBeforeDiscount.toLocaleString()}</span>
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Giảm giá</span>
                         <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                         <span className="font-black text-slate-900">-{totalDiscount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-600 font-bold">Thu khác</span>
                         <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
                         <span className="font-black text-slate-900">{otherFees.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                         <span className="text-xs font-black uppercase text-slate-400">Tổng tiền mua</span>
                         <span className="text-lg font-black text-slate-950">{netPayable.toLocaleString()}</span>
                      </div>
                   </div>
                </div>

                <div className="pt-4 space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-sm font-black uppercase text-slate-950 tracking-tight">Cần trả khách</span>
                      <span className="text-2xl font-black text-indigo-600 italic tracking-tighter">{amountToPayCustomer.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                      <span className="text-sm font-black uppercase text-slate-950 tracking-tight">Tiền trả khách</span>
                      <div className="flex-1 border-b-2 border-slate-200 mx-6" />
                      <span className="text-xl font-black text-slate-400 tabular-nums">{amountToPayCustomer.toLocaleString()}</span>
                   </div>
                </div>
              </>
            ) : (
              <div className="space-y-2 flex flex-col flex-1">
                 <div className="flex justify-between items-center py-0.5">
                    <span className="text-[13px] font-medium text-slate-600 uppercase tracking-wide">Tiền hàng</span>
                    <div className="flex items-center gap-6">
                      <span className="text-[13px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                      <span className="text-sm font-black text-slate-900 tabular-nums">{totalBeforeDiscount.toLocaleString()}</span>
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-center py-0.5 pt-1 border-t border-slate-50 cursor-pointer group" onClick={() => setShowDiscountModal(true)}>
                    <span className="text-[13px] font-medium text-slate-600 uppercase tracking-wide">Giảm giá</span>
                    <span className="text-sm font-black text-rose-500 tabular-nums border-b border-dashed border-slate-300 w-32 text-right">-{totalDiscount.toLocaleString()}</span>
                 </div>

                 <div className="flex justify-between items-center py-0.5 border-b border-slate-50 pb-1 cursor-pointer group">
                    <span className="text-[13px] font-medium text-slate-600 uppercase tracking-wide">Phí khác</span>
                    <span className="text-sm font-black text-slate-900 tabular-nums border-b border-dashed border-slate-300 w-32 text-right">0</span>
                 </div>

                 <div className="flex justify-between items-center py-2 bg-indigo-50/30 px-3 rounded-xl border border-indigo-100">
                    <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">Cần thanh toán</span>
                    <span className="text-xl font-black text-indigo-600 tracking-tighter italic">{netPayable.toLocaleString()}</span>
                 </div>

                 <div className="flex justify-between items-center pt-2 px-1">
                    <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Khách đưa</span>
                    <span className="text-lg font-black text-slate-900 tabular-nums">{currentCashReceived.toLocaleString()}</span>
                 </div>

                 {currentCashReceived > netPayable && (
                   <div className="flex justify-between items-center py-1.5 px-3 bg-emerald-50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-top-1">
                      <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest">Tiền thừa</span>
                      <span className="text-lg font-black text-emerald-600 tabular-nums">{(currentCashReceived - netPayable).toLocaleString()}</span>
                   </div>
                 )}

                 <div className="pt-1 space-y-3 flex flex-col justify-end flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                       <PaymentMethodRadio method="Cash" current={paymentMethod} set={(m) => updateActiveTab({ paymentMethod: m })} label="Tiền mặt" />
                       <PaymentMethodRadio method="Bank" current={paymentMethod} set={(m) => updateActiveTab({ paymentMethod: m })} label="Chuyển khoản" />
                       <PaymentMethodRadio method="Other" current={paymentMethod} set={(m) => updateActiveTab({ paymentMethod: m })} label="Thẻ" />
                       <PaymentMethodRadio method="Momo" current={paymentMethod} set={(m) => updateActiveTab({ paymentMethod: m })} label="Ví" />
                       <button className="text-slate-400 hover:text-slate-600 px-1"><MoreVertical className="h-4 w-4" /></button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {cashSuggestions.map((amount, idx) => (
                         <QuickCashButton 
                            key={idx} 
                            amount={amount} 
                            onClick={() => updateActiveTab({ cashReceived: amount })} 
                         />
                      ))}
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Checkout Button */}
          <div className="p-4 shrink-0 bg-white border-t border-slate-100">
             <button 
               onClick={handleCheckout}
               disabled={cart.length === 0}
               className={`w-full py-4 bg-slate-950 hover:bg-slate-900 text-white rounded-[1.5rem] font-black shadow-xl active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-0.5 group px-4 ${cart.length === 0 ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
             >
               <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-lg tracking-widest uppercase">THANH TOÁN (F9)</span>
               </div>
               <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">+ {pointsEarned.toLocaleString()} ĐIỂM THƯỞNG</span>
             </button>
             <p className="text-center text-[7px] text-slate-300 mt-3 uppercase font-black tracking-[0.4em] opacity-40 italic">CFO Brain POS • v2.0 Terminal</p>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && lastOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
               <div>
                  <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Hóa đơn thanh toán</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{lastOrder.orderCode} • {new Date(lastOrder.date).toLocaleString('vi-VN')}</p>
               </div>
               <button onClick={() => setShowReceiptModal(false)} className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-2xl hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100">
                  <X className="h-5 w-5" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar print-area">
               {/* Receipt Header Content */}
               <div className="text-center mb-8 border-b-2 border-dashed border-slate-200 pb-6">
                  <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">CFO BRAIN PROFESSIONAL</h1>
                  <p className="text-xs font-bold text-slate-500 mt-2">123 Đường Công Nghệ, Quận 1, TP. HCM</p>
                  <p className="text-xs font-bold text-slate-500">Hotline: 1900 1234</p>
               </div>

               {/* Customer Info */}
               <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-xs">
                     <span className="font-bold text-slate-400 uppercase tracking-wider">Khách hàng:</span>
                     <span className="font-black text-slate-800">{lastOrder.customerName || 'Khách vãng lai'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                     <span className="font-bold text-slate-400 uppercase tracking-wider">Thu ngân:</span>
                     <span className="font-black text-slate-800">{lastOrder.staffId}</span>
                  </div>
               </div>

               {/* Items Table */}
               <table className="w-full text-xs mb-8">
                  <thead className="border-b border-slate-100">
                     <tr>
                        <th className="py-2 font-black text-slate-400 uppercase text-left">Mặt hàng</th>
                        <th className="py-2 font-black text-slate-400 uppercase text-center w-12">SL</th>
                        <th className="py-2 font-black text-slate-400 uppercase text-right w-24">Thành tiền</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {lastOrder.items.map((item, idx) => (
                        <tr key={idx}>
                           <td className="py-3">
                              <div className="font-black text-slate-800 uppercase">{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-bold">{item.price.toLocaleString()}đ</div>
                           </td>
                           <td className="py-3 text-center font-black text-slate-800">{item.quantity}</td>
                           <td className="py-3 text-right font-black text-indigo-600">{item.total.toLocaleString()}đ</td>
                        </tr>
                     ))}
                  </tbody>
               </table>

               {/* Totals */}
               <div className="space-y-3 border-t-2 border-dashed border-slate-200 pt-6">
                  <div className="flex justify-between items-center text-sm">
                     <span className="font-bold text-slate-500">Tổng tiền hàng:</span>
                     <span className="font-black text-slate-800">{lastOrder.totalAmount.toLocaleString()}đ</span>
                  </div>
                  {lastOrder.discount > 0 && (
                     <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-500">Chiết khấu:</span>
                        <span className="font-black text-rose-500">-{lastOrder.discount.toLocaleString()}đ</span>
                     </div>
                  )}
                  <div className="flex justify-between items-center py-3 bg-slate-50 px-4 rounded-2xl">
                     <span className="font-black text-slate-900 uppercase text-xs tracking-widest">Tổng thanh toán:</span>
                     <span className="text-xl font-black text-indigo-600 italic leading-none">{lastOrder.finalAmount.toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2">
                     <span className="font-bold text-slate-400 uppercase tracking-widest">Phương thức:</span>
                     <span className="font-black text-slate-700 uppercase">{lastOrder.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                     <span className="font-bold text-slate-400 uppercase tracking-widest">Khách đưa:</span>
                     <span className="font-black text-slate-700">{(cashReceived || lastOrder.finalAmount).toLocaleString()}đ</span>
                  </div>
                  {((cashReceived || lastOrder.finalAmount) > lastOrder.finalAmount) && (
                    <div className="flex justify-between items-center text-xs pt-1">
                       <span className="font-bold text-slate-400 uppercase tracking-widest">Tiền thừa:</span>
                       <span className="font-black text-emerald-600">{( (cashReceived || lastOrder.finalAmount) - lastOrder.finalAmount).toLocaleString()}đ</span>
                    </div>
                  )}
               </div>

               {/* Footer Note */}
               <div className="text-center mt-12 mb-4 italic">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cảm ơn quý khách và hẹn gặp lại!</p>
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-4 shrink-0">
               <button 
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-sm hover:border-indigo-400 hover:text-indigo-600 active:scale-95 transition-all"
               >
                  <Printer className="h-4 w-4" />
                  In hóa đơn
               </button>
               <button 
                  onClick={handleFinishOrder}
                  className="bg-slate-950 text-white py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-slate-950/20 active:scale-95 transition-all hover:bg-indigo-600"
               >
                  Hoàn tất
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-slate-200">
            <div className="bg-slate-50 p-8 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Chiết khấu</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Giảm giá hóa đơn</p>
              </div>
              <button onClick={() => setShowDiscountModal(false)} className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-2xl hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-8 space-y-8">
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button 
                  onClick={() => updateActiveTab({ discountType: 'fixed' })}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${discountType === 'fixed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  VNĐ
                </button>
                <button 
                  onClick={() => updateActiveTab({ discountType: 'percent' })}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${discountType === 'percent' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  %
                </button>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Giá trị giảm giá</label>
                <input 
                  type="number" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.2rem] text-xl font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:shadow-lg focus:shadow-indigo-500/5 transition-all shadow-inner placeholder:text-slate-300 text-right tabular-nums" 
                  value={discountValue || ''}
                  onChange={(e) => updateActiveTab({ discountValue: Number(e.target.value) })}
                  autoFocus
                />
              </div>
              <button 
                onClick={() => setShowDiscountModal(false)}
                className="w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-slate-950/20 active:scale-95 transition-all hover:bg-indigo-600"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal Overlay */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-slate-200">
            <div className="bg-slate-50 p-8 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Thành viên mới</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Đăng ký khách hàng CFO Brain</p>
              </div>
              <button onClick={() => setShowAddCustomerModal(false)} className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-2xl hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-8 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Tên định danh khách hàng</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-indigo-400" />
                  <input 
                    type="text" 
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.2rem] text-sm font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:shadow-lg focus:shadow-indigo-500/5 transition-all shadow-inner placeholder:text-slate-300 uppercase tracking-tight" 
                    placeholder="Ví dụ: NGUYỄN VĂN A"
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Số điện thoại liên hệ</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-300 tracking-tighter">(+84)</div>
                  <input 
                    type="text" 
                    className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.2rem] text-sm font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:shadow-lg focus:shadow-indigo-500/5 transition-all shadow-inner placeholder:text-slate-300 font-mono" 
                    placeholder="0xxxxxxxxx"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4 pt-4">
                <button 
                   onClick={handleAddQuickCustomer}
                   className="w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-slate-950/20 active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-indigo-600 hover:shadow-indigo-500/30"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Xác nhận đăng ký
                </button>
                <button 
                  onClick={() => setShowAddCustomerModal(false)}
                  className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
                >
                  Hủy thao tác
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Invoice Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[160] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col h-[85vh]">
            {/* Header */}
            <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
               <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Chọn hóa đơn trả hàng</h3>
               <button onClick={() => setShowReturnModal(false)} className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 rounded-xl hover:text-rose-500 transition-all border border-transparent hover:border-slate-100">
                  <X className="h-5 w-5" />
               </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
               {/* Left sidebar - Filters */}
               <div className="w-[300px] border-r border-slate-100 p-6 space-y-8 overflow-y-auto no-scrollbar shrink-0 bg-slate-50/50">
                  <section className="space-y-4">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tìm kiếm</h4>
                     <div className="space-y-2">
                        <ReturnInput value={returnSearch.invoiceId} onChange={val => setReturnSearch(prev => ({...prev, invoiceId: val}))} placeholder="Theo mã hóa đơn" />
                        <ReturnInput value={returnSearch.trackingId} onChange={val => setReturnSearch(prev => ({...prev, trackingId: val}))} placeholder="Theo mã vận đơn bán" />
                        <ReturnInput value={returnSearch.customer} onChange={val => setReturnSearch(prev => ({...prev, customer: val}))} placeholder="Theo khách hàng hoặc ĐT" />
                        <ReturnInput value={returnSearch.productId} onChange={val => setReturnSearch(prev => ({...prev, productId: val}))} placeholder="Theo mã hàng" />
                        <ReturnInput value={returnSearch.productName} onChange={val => setReturnSearch(prev => ({...prev, productName: val}))} placeholder="Theo tên hàng" />
                     </div>
                  </section>

                  <section className="space-y-4">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Thời gian</h4>
                     <div className="space-y-2">
                        <div className="relative">
                           <input 
                             type="date" 
                             className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all" 
                             value={returnSearch.fromDate}
                             onChange={e => setReturnSearch(prev => ({...prev, fromDate: e.target.value}))}
                           />
                        </div>
                        <div className="relative">
                           <input 
                             type="date" 
                             className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all" 
                             placeholder="Đến ngày"
                             value={returnSearch.toDate}
                             onChange={e => setReturnSearch(prev => ({...prev, toDate: e.target.value}))}
                           />
                        </div>
                     </div>
                  </section>
               </div>

               {/* Main content - Results table */}
               <div className="flex-1 flex flex-col min-w-0 bg-white">
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                     <table className="w-full text-xs text-left">
                        <thead className="sticky top-0 bg-indigo-500 text-white z-10">
                           <tr>
                              <th className="px-6 py-4 font-bold">Mã hóa đơn</th>
                              <th className="px-6 py-4 font-bold flex items-center gap-1">Thời gian <ChevronDown className="h-3 w-3" /></th>
                              <th className="px-6 py-4 font-bold">Nhân viên</th>
                              <th className="px-6 py-4 font-bold">Khách hàng</th>
                              <th className="px-6 py-4 font-bold text-right">Tổng cộng</th>
                              <th className="px-6 py-4 font-bold text-center">Thao tác</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 italic">
                           {filteredReturnOrders.map((inv, idx) => (
                              <tr key={inv.id} className="hover:bg-indigo-50/50 group transition-all">
                                 <td className="px-6 py-4 font-black text-indigo-600 cursor-pointer hover:underline">{inv.orderCode}</td>
                                 <td className="px-6 py-4 font-bold text-slate-600">{new Date(inv.date).toLocaleString('vi-VN')}</td>
                                 <td className="px-6 py-4 font-bold text-slate-700">{inv.staffId}</td>
                                 <td className="px-6 py-4 font-bold text-slate-600">{inv.customerName || 'Khách lẻ'}</td>
                                 <td className="px-6 py-4 font-black text-slate-900 text-right">{inv.finalAmount.toLocaleString()}</td>
                                 <td className="px-6 py-4 text-center">
                                    <button 
                                      className="px-4 py-1.5 border border-slate-200 rounded-lg text-[11px] font-black uppercase text-slate-600 hover:bg-slate-950 hover:text-white transition-all shadow-sm"
                                      onClick={() => {
                                        // Implementation for selecting an order to return
                                        setShowReturnModal(false);
                                      }}
                                    >
                                      Chọn
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {filteredReturnOrders.length === 0 && (
                             <tr>
                               <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest">
                                 Không tìm thấy hóa đơn phù hợp
                               </td>
                             </tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  {/* Pagination */}
                  <div className="px-8 py-6 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-1">
                        <PaginationButton icon={<Undo2 className="h-4 w-4 rotate-180" />} />
                        <PaginationButton icon={<ChevronRight className="h-4 w-4 rotate-180" />} />
                        <div className="flex items-center gap-1">
                           <button className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">1</button>
                           <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">2</button>
                           <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">3</button>
                           <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">4</button>
                           <button className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center transition-colors">5</button>
                           <span className="text-slate-300 mx-1">...</span>
                        </div>
                        <PaginationButton icon={<ChevronRight className="h-4 w-4" />} />
                        <PaginationButton icon={<Undo2 className="h-4 w-4" />} />
                     </div>
                     <div className="text-[11px] font-bold text-slate-400">Hiển thị {filteredReturnOrders.length} hóa đơn</div>
                  </div>
               </div>
            </div>

            {/* Footer action */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
               <button 
                 className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all"
                 onClick={handleReturnFast}
               >
                  Trả nhanh
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Return Modal Helpers
const ReturnInput = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder: string }) => (
  <div className="relative group">
    <input 
      type="text" 
      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 border-b-2 tracking-tight" 
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const PaginationButton = ({ icon, onClick }: { icon: React.ReactNode, onClick?: () => void }) => (
   <button onClick={onClick} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-all">
      {icon}
   </button>
);

// Optimized Sub-components
const CartItemRow = React.memo(({ item, idx, onUpdate, onRemove, isReturnItem }: { 
  item: POSOrderItem, 
  idx: number, 
  onUpdate: (id: string, delta: number) => void, 
  onRemove: (id: string) => void,
  isReturnItem?: boolean
}) => (
  <tr className={`hover:bg-slate-50/50 group transition-all font-bold ${isReturnItem ? 'bg-rose-50/20' : ''}`}>
    <td className="px-4 py-3 text-center text-slate-700 italic border-r border-slate-100">{idx}</td>
    <td className="px-4 py-3 text-center border-r border-slate-100">
      <button onClick={() => onRemove(item.productId)} className="text-slate-400 hover:text-rose-600 transition-all p-1">
        <Trash2 className="h-4.5 w-4.5" />
      </button>
    </td>
    <td className="px-4 py-3 border-r border-slate-100"><span className="text-slate-950 uppercase">{item.sku}</span></td>
    <td className="px-4 py-3 border-r border-slate-100 min-w-[200px]">
      <span className="text-slate-950 uppercase">{item.name}</span>
      {/* Example variant display if SKU contains hint or just mock it as in screenshot */}
      {item.sku === 'SP011943' && (
        <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[9px] font-bold">35 - TÍM</span>
      )}
    </td>
    <td className="px-4 py-3 border-r border-slate-100 text-center">
      <div className="flex justify-center border-b border-slate-300 w-16 mx-auto">
        <span className="text-slate-950 tabular-nums">{item.quantity}</span>
      </div>
    </td>
    <td className="px-4 py-3 border-r border-slate-100 text-right"><span className="text-slate-700 tabular-nums">{item.price.toLocaleString()}</span></td>
    <td className="px-4 py-3 border-r border-slate-100 text-right font-black"><span className="text-slate-950 tabular-nums">{item.total.toLocaleString()}</span></td>
    <td className="px-2 py-3 text-center">
      <div className="flex items-center gap-1">
        <button className="text-slate-400 hover:text-slate-600"><MoreVertical className="h-4 w-4" /></button>
      </div>
    </td>
  </tr>
));

const PaymentMethodRadio = ({ method, current, set, label }: { method: string, current: string, set: (m: any) => void, label: string }) => (
  <label className="flex items-center gap-2 cursor-pointer group">
    <div 
       onClick={() => set(method)}
       className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${current === method ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}
    >
       {current === method && <div className="w-2 h-2 rounded-full bg-white" />}
    </div>
    <span className={`text-sm font-medium ${current === method ? 'text-slate-900' : 'text-slate-600'}`}>{label}</span>
  </label>
);

const QuickCashButton: React.FC<{ amount: number, onClick: () => void }> = ({ amount, onClick }) => (
  <button 
    onClick={onClick}
    className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:border-indigo-400 hover:bg-slate-50 transition-all shadow-sm"
  >
    {amount.toLocaleString()}
  </button>
);

const ProductMemoCard = React.memo(({ product, onAdd }: { product: POSProduct, onAdd: (p: POSProduct) => void }) => (
  <button 
    onClick={() => onAdd(product)}
    className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-indigo-400 shadow-sm hover:shadow-md transition-all text-left flex flex-col group active:scale-[0.98]"
  >
    <div className="aspect-[1.5/1] bg-slate-200/50 relative overflow-hidden flex items-center justify-center">
      {product.images?.[0] ? (
        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      ) : (
        <ShoppingBag className="h-12 w-12 text-slate-300" strokeWidth={1} />
      )}
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-[#4ade80] text-white text-[11px] font-black rounded shadow-sm">
        {product.salePrice.toLocaleString('vi-VN')}
      </div>
    </div>
    <div className="px-3 py-2 bg-white flex items-center min-h-[42px]">
      <span className="text-[10px] font-bold text-slate-700 uppercase line-clamp-2 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors">
        {product.name}
      </span>
    </div>
  </button>
));

const GridMenuItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full px-6 py-3.5 flex items-center gap-4 transition-all text-left ${active ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
     <span className={active ? 'text-slate-900' : 'text-slate-500'}>
        {icon}
     </span>
     <span className={`text-[13px] font-bold ${active ? 'text-slate-900' : 'text-slate-700'}`}>
        {label}
     </span>
  </button>
);

export default POSComputer;
