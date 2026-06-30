import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import {
  ScanLine, Search, Plus, Minus, Trash2, ChevronRight,
  ChevronLeft, User, Banknote, CreditCard, Smartphone,
  Building2, CheckCircle2, ShoppingCart, X, Loader2, Keyboard,
} from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
  import_price?: number;
  image_url?: string;
  unit?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  points: number;
  total_spent: number;
  tier: string;
  debt_amount?: number;
}

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  importPrice?: number;
}

type PaymentMethod = 'Cash' | 'Bank' | 'Card' | 'Momo';
type Step = 'cart' | 'checkout' | 'success';

const TIER_COLORS: Record<string, string> = {
  Diamond: 'text-cyan-600',
  Gold: 'text-amber-500',
  Silver: 'text-slate-400',
  Standard: 'text-slate-400',
};

export const POSQuickPage: React.FC = () => {
  // Token bí mật lấy từ QR (?t=...) — gửi kèm mọi lời gọi API mobile để xác thực
  const mobileToken = new URLSearchParams(window.location.search).get('t') || '';

  const [step, setStep] = useState<Step>('cart');

  // Sản phẩm + tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Quét barcode
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [numericMode, setNumericMode] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  // Giỏ hàng
  const [cart, setCart] = useState<CartItem[]>([]);

  // Khách hàng
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Thanh toán
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState({ cash: 0, bank: 0, card: 0, momo: 0 });
  const [cashReceived, setCashReceived] = useState('');
  const [isDebtMode, setIsDebtMode] = useState(false);
  const [notes, setNotes] = useState('');

  // Kết quả
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successOrder, setSuccessOrder] = useState<{ orderId: string; orderCode: string } | null>(null);
  const [flashProduct, setFlashProduct] = useState('');

  // Tính tổng
  const totalAmount = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalDiscount = cart.reduce((sum, i) => sum + i.discount * i.quantity, 0);
  const finalAmount = totalAmount - totalDiscount;
  const cashRcv = Number(cashReceived) || 0;
  const change = cashRcv > finalAmount ? cashRcv - finalAmount : 0;
  const splitTotal = splitPayments.cash + splitPayments.bank + splitPayments.card + splitPayments.momo;

  // Tìm sản phẩm theo text
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (!searchTerm.trim()) { setSearchResults([]); setShowResults(false); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/pos-mobile/products?q=${encodeURIComponent(searchTerm)}`, {
          headers: { 'x-pos-mobile-token': mobileToken },
        });
        const json = await res.json();
        setSearchResults(json.products || []);
        setShowResults(true);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [searchTerm]);

  // Tìm khách hàng
  const custTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(custTimeout.current);
    if (!customerSearch.trim()) { setCustomerResults([]); setShowCustomerResults(false); return; }
    custTimeout.current = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await fetch(`/api/pos-mobile/customers?q=${encodeURIComponent(customerSearch)}`, {
          headers: { 'x-pos-mobile-token': mobileToken },
        });
        const json = await res.json();
        setCustomerResults(json.customers || []);
        setShowCustomerResults(true);
      } catch { setCustomerResults([]); }
      finally { setSearchingCustomer(false); }
    }, 300);
  }, [customerSearch]);

  // Camera stream ref — dùng để dừng track khi thoát
  const streamRef = useRef<MediaStream | null>(null);
  // Cooldown chống đọc lặp cùng 1 mã trong 2 giây
  const lastScanRef = useRef<{ barcode: string; time: number } | null>(null);
  // requestAnimationFrame ID cho BarcodeDetector loop
  const rafRef = useRef<number | null>(null);

  // Khi scanning bật: getUserMedia → BarcodeDetector (native) → fallback ZXing
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const handleBarcode = async (barcode: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.barcode === barcode && now - last.time < 2000) return;
      lastScanRef.current = { barcode, time: now };
      try {
        const res = await fetch(`/api/product-info/barcode/${encodeURIComponent(barcode)}`, {
          headers: { 'x-pos-mobile-token': mobileToken },
        });
        const json = await res.json();
        if (json.error || !json.id) {
          setScanError(`Không tìm thấy sản phẩm: ${barcode}`);
          setTimeout(() => setScanError(''), 3000);
          return;
        }
        addProductToCart({
          id: json.id,
          name: json.name,
          sku: json.sku || '',
          price: json.price || 0,
          stock: json.stock ?? 99,
          import_price: json.import_price || 0,
          barcode,
        });
      } catch {
        setScanError('Lỗi kết nối, thử lại');
        setTimeout(() => setScanError(''), 3000);
      }
    };

    const startReading = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        if (!cancelled) { setScanError('Không truy cập được camera'); setScanning(false); }
        return;
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoPlay policy — bỏ qua */ }
      if (cancelled) return;

      // Ưu tiên BarcodeDetector native (iPhone 15 / iOS 17+ / Android Chrome)
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ['code_128'] });
        const scan = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const results: any[] = await detector.detect(video);
              if (results.length > 0) handleBarcode(results[0].rawValue);
            } catch { /* frame bị drop — bỏ qua */ }
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } else {
        // Fallback: ZXing (thiết bị cũ không hỗ trợ BarcodeDetector)
        const hints = new Map<DecodeHintType, unknown>([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
          [DecodeHintType.TRY_HARDER, true],
        ]);
        const reader = new BrowserMultiFormatReader(hints as Map<DecodeHintType, boolean>);
        try {
          const controls = await reader.decodeFromVideoElement(video, (result, _err, _ctrl) => {
            if (!result) return;
            handleBarcode(result.getText());
          });
          zxingControlsRef.current = controls;
        } catch {
          if (!cancelled) { setScanError('Lỗi khởi động scanner'); setScanning(false); }
        }
      }
    };

    startReading();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [scanning]);

  const stopScan = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const addProductToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, total: i.price * (i.quantity + 1) }
            : i
        );
      }
      return [...prev, {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: 1,
        price: product.price,
        discount: 0,
        total: product.price,
        importPrice: product.import_price || 0,
      }];
    });
    setFlashProduct(product.id);
    setTimeout(() => setFlashProduct(''), 600);
    setSearchTerm('');
    setShowResults(false);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.productId === productId
        ? { ...i, quantity: Math.max(0, i.quantity + delta), total: i.price * Math.max(0, i.quantity + delta) }
        : i
      )
      .filter(i => i.quantity > 0)
    );
  };

  const removeItem = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (useSplitPayment && splitTotal < finalAmount) {
      setCheckoutError(`Còn thiếu ${fmt(finalAmount - splitTotal)}`);
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/pos-mobile/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pos-mobile-token': mobileToken },
        body: JSON.stringify({
          cart,
          customerId: selectedCustomer?.id,
          customerName: selectedCustomer?.name,
          paymentMethod: useSplitPayment ? 'Cash' : paymentMethod,
          splitPayments: useSplitPayment ? splitPayments : undefined,
          cashReceived: cashRcv || undefined,
          isDebtMode,
          notes: notes || undefined,
          totalAmount,
          discount: totalDiscount,
          finalAmount,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Lỗi thanh toán');
      setSuccessOrder({ orderId: json.orderId, orderCode: json.orderCode });
      setStep('success');
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const resetAll = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setPaymentMethod('Cash');
    setUseSplitPayment(false);
    setSplitPayments({ cash: 0, bank: 0, card: 0, momo: 0 });
    setCashReceived('');
    setIsDebtMode(false);
    setNotes('');
    setCheckoutError('');
    setSuccessOrder(null);
    setStep('cart');
  };

  const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { key: 'Cash', label: 'Tiền mặt', icon: <Banknote className="h-4 w-4" /> },
    { key: 'Bank', label: 'Chuyển khoản', icon: <Building2 className="h-4 w-4" /> },
    { key: 'Card', label: 'Thẻ', icon: <CreditCard className="h-4 w-4" /> },
    { key: 'Momo', label: 'MoMo', icon: <Smartphone className="h-4 w-4" /> },
  ];

  // === SCREEN: SUCCESS ===
  if (step === 'success' && successOrder) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-9 w-9 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Thanh toán thành công!</h2>
            <p className="text-sm text-slate-500 mb-4">Đơn hàng đã được ghi nhận</p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Mã đơn</span>
                <span className="font-semibold text-indigo-600">{successOrder.orderCode}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tổng tiền</span>
                <span className="font-bold text-slate-800">{fmt(finalAmount)}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tiền thừa</span>
                  <span className="font-semibold text-green-600">{fmt(change)}</span>
                </div>
              )}
              {selectedCustomer && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Khách hàng</span>
                  <span className="font-medium">{selectedCustomer.name}</span>
                </div>
              )}
            </div>
            <button
              onClick={resetAll}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              Đơn hàng mới
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === SCREEN: CHECKOUT ===
  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setStep('cart')} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h1 className="font-bold text-slate-800 flex-1">Thanh toán</h1>
          <span className="text-sm font-bold text-indigo-600">{fmt(finalAmount)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
          {/* Tóm tắt giỏ hàng */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Giỏ hàng ({cart.length} sản phẩm)
            </h3>
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.productId} className="flex justify-between items-center text-sm">
                  <span className="text-slate-700 flex-1 truncate">{item.name}</span>
                  <span className="text-slate-500 ml-2 shrink-0">×{item.quantity}</span>
                  <span className="font-medium ml-3 shrink-0">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm mt-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500">Chiết khấu</span>
                <span className="text-rose-500">-{fmt(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-slate-200">
              <span>Tổng cộng</span>
              <span className="text-indigo-600">{fmt(finalAmount)}</span>
            </div>
          </div>

          {/* Khách hàng */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Khách hàng</h3>
            {selectedCustomer ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-400">{selectedCustomer.phone} · <span className={TIER_COLORS[selectedCustomer.tier]}>{selectedCustomer.tier}</span></p>
                  {(selectedCustomer.debt_amount ?? 0) > 0 && (
                    <p className="text-xs text-rose-500 mt-0.5">Đang nợ: {fmt(selectedCustomer.debt_amount!)}</p>
                  )}
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tên hoặc SĐT khách..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onFocus={() => customerSearch && setShowCustomerResults(true)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[16px] outline-none focus:border-indigo-400"
                />
                {searchingCustomer && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
                {showCustomerResults && customerResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerResults(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-slate-800">{c.name}</p>
                        <p className="text-xs text-slate-400">{c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phương thức thanh toán */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Phương thức thanh toán</h3>

            {/* Toggle split payment */}
            <button
              onClick={() => setUseSplitPayment(v => !v)}
              className={`w-full text-xs py-1.5 px-3 rounded-lg mb-3 border transition-colors ${useSplitPayment ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-500'}`}
            >
              {useSplitPayment ? '✓ Nhiều phương thức' : 'Chia nhiều phương thức'}
            </button>

            {!useSplitPayment ? (
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${paymentMethod === m.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {PAYMENT_METHODS.map(m => (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-slate-600">
                      {m.icon}
                      <span>{m.label}</span>
                    </div>
                    <input
                      type="number"
                      placeholder="0"
                      value={splitPayments[m.key.toLowerCase() as keyof typeof splitPayments] || ''}
                      onChange={e => setSplitPayments(prev => ({
                        ...prev,
                        [m.key.toLowerCase()]: Number(e.target.value) || 0,
                      }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-[16px] outline-none focus:border-indigo-400 text-right"
                    />
                  </div>
                ))}
                <div className={`text-xs text-right pt-1 ${splitTotal >= finalAmount ? 'text-green-600' : 'text-rose-500'}`}>
                  Tổng: {fmt(splitTotal)} / {fmt(finalAmount)}
                  {splitTotal > finalAmount && ` (dư ${fmt(splitTotal - finalAmount)})`}
                  {splitTotal < finalAmount && ` (thiếu ${fmt(finalAmount - splitTotal)})`}
                </div>
              </div>
            )}
          </div>

          {/* Tiền khách đưa / Khách nợ (chỉ hiện khi thanh toán tiền mặt 1 phương thức) */}
          {!useSplitPayment && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chi tiết thanh toán</h3>

              <button
                onClick={() => setIsDebtMode(v => !v)}
                className={`w-full text-xs py-1.5 px-3 rounded-lg border transition-colors ${isDebtMode ? 'bg-rose-50 border-rose-200 text-rose-600' : 'border-slate-200 text-slate-500'}`}
              >
                {isDebtMode ? '⚠ Khách nợ toàn bộ đơn' : 'Đánh dấu khách nợ'}
              </button>

              {!isDebtMode && paymentMethod === 'Cash' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Tiền khách đưa</label>
                  <input
                    type="number"
                    placeholder={fmt(finalAmount)}
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[16px] outline-none focus:border-indigo-400 text-right"
                  />
                  {change > 0 && (
                    <p className="text-xs text-green-600 mt-1 text-right">Tiền thừa: {fmt(change)}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ghi chú */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ghi chú</h3>
            <textarea
              placeholder="Ghi chú đơn hàng..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[16px] outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          {checkoutError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-600">
              {checkoutError}
            </div>
          )}
        </div>

        {/* Footer thanh toán */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4">
          <button
            onClick={handleCheckout}
            disabled={checkoutLoading || (useSplitPayment && splitTotal < finalAmount)}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {checkoutLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
            ) : (
              <>Xác nhận thanh toán · {fmt(finalAmount)}</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // === SCREEN: CART (default) ===
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-bold text-slate-800 text-lg">POS Nhanh</h1>
          {cart.length > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {cart.length} SP
            </span>
          )}
        </div>

        {/* Search + Scan */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              inputMode={numericMode ? 'numeric' : 'text'}
              placeholder={numericMode ? 'Nhập mã số...' : 'Tìm tên sản phẩm...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (scanning) stopScan();
                if (searchResults.length > 0) setShowResults(true);
              }}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[16px] outline-none focus:border-indigo-400 bg-slate-50"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
          <button
            onClick={() => {
              const next = !numericMode;
              setNumericMode(next);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            title={numericMode ? 'Chuyển sang bàn phím chữ' : 'Chuyển sang bàn phím số'}
            className={`px-2.5 py-2.5 rounded-xl border flex items-center transition-colors ${!numericMode ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-400 bg-white'}`}
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <button
            onClick={() => scanning ? stopScan() : setScanning(true)}
            className={`px-3 py-2.5 rounded-xl border flex items-center gap-1.5 text-sm font-medium transition-colors ${scanning ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-700 bg-white'}`}
          >
            <ScanLine className="h-4 w-4" />
            {scanning ? 'Dừng' : 'Quét'}
          </button>
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowResults(false)} />
            <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => addProductToCart(p)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku} · Tồn: {p.stock}</p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 ml-3 shrink-0">{fmt(p.price)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Camera — 1 phần tử duy nhất, ẩn/hiện bằng style */}
      <div className="relative bg-black" style={{ height: scanning ? 260 : 0, overflow: 'hidden' }}>
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        {scanning && (
          <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs opacity-70">
            Hướng camera về phía mã vạch
          </p>
        )}
      </div>

      {/* Scan error */}
      {scanError && (
        <div className="mx-4 mt-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-sm text-rose-600">
          {scanError}
        </div>
      )}

      {/* Flash notification */}
      {flashProduct && (
        <div className="mx-4 mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-600">
          ✓ Đã thêm vào giỏ
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">Giỏ hàng trống</p>
            <p className="text-xs text-slate-300 mt-1">Quét mã vạch hoặc tìm sản phẩm</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map(item => (
              <div
                key={item.productId}
                className={`bg-white rounded-2xl p-3.5 shadow-sm transition-all ${flashProduct === item.productId ? 'ring-2 ring-green-400' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 pr-2">
                    <p className="text-sm font-medium text-slate-800 leading-tight">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmt(item.price)} / sp</p>
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="p-1 text-slate-300 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.productId, -1)}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.productId, 1)}
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-slate-800">{fmt(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">{cart.reduce((s, i) => s + i.quantity, 0)} sản phẩm</span>
            <span className="font-bold text-lg text-slate-800">{fmt(finalAmount)}</span>
          </div>
          <button
            onClick={() => setStep('checkout')}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2"
          >
            Thanh toán
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default POSQuickPage;
