import { RefObject, useEffect, useRef } from 'react';
import { POSProduct } from '../../types';

type UsePOSKeyboardArgs = {
  isActive?: boolean;
  products: POSProduct[];
  productSearchRef: RefObject<HTMLInputElement>;
  consultantSearchRef: RefObject<HTMLInputElement>;
  customerSearchRef: RefObject<HTMLInputElement>;
  checkoutRef: RefObject<() => void>;
  cartLengthRef: RefObject<number>;
  setShowConsultant: (value: boolean) => void;
  addToCart: (product: POSProduct) => void;
  showScanFeedback: (productName: string) => void;
  setSearchTerm: (value: string) => void;
  setDebouncedSearchTerm: (value: string) => void;
  setShowProductResults: (value: boolean) => void;
};

export function usePOSKeyboard({
  isActive = true,
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
}: UsePOSKeyboardArgs) {
  const barcodeBufferRef = useRef('');
  const barcodeLastTimeRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
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

      if (e.key === 'F9' && cartLengthRef.current > 0) {
        e.preventDefault();
        checkoutRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    cartLengthRef,
    checkoutRef,
    consultantSearchRef,
    customerSearchRef,
    productSearchRef,
    setShowConsultant,
  ]);

  useEffect(() => {
    if (!isActive) return;
    const handleGlobalScan = (e: KeyboardEvent) => {
      const currentTime = new Date().getTime();
      const timeDiff = currentTime - barcodeLastTimeRef.current;

      if (timeDiff > 50) {
        barcodeBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length >= 3) {
          const code = barcodeBufferRef.current;
          const match = products.find(
            p => p.status === 'Active' && !p.isParent && (p.barcode === code || p.sku === code)
          );

          if (match) {
            e.preventDefault();
            addToCart(match);
            showScanFeedback(match.name);
            setSearchTerm('');
            setDebouncedSearchTerm('');
            setShowProductResults(false);
          }
        }
        barcodeBufferRef.current = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBufferRef.current += e.key;
      }

      barcodeLastTimeRef.current = currentTime;
    };

    window.addEventListener('keydown', handleGlobalScan, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalScan, { capture: true });
  }, [
    isActive,
    addToCart,
    products,
    setDebouncedSearchTerm,
    setSearchTerm,
    setShowProductResults,
    showScanFeedback,
  ]);
}
