import { RefObject, useEffect, useRef } from 'react';
import {
  POSKeyboardSettings,
  POSOrderItem,
  POSProduct,
  DEFAULT_POS_KEYBOARD_SHORTCUTS,
} from '../../types';

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
  // new shortcut args (optional for backwards compat)
  addNewTab?: () => void;
  isAutoPrintEnabledRef?: RefObject<boolean>;
  setIsAutoPrintEnabled?: (v: boolean) => void;
  selectedCartIndexRef?: RefObject<number>;
  setSelectedCartIndex?: (fn: (prev: number) => number) => void;
  cartItemsRef?: RefObject<POSOrderItem[]>;
  updateQuantityRef?: RefObject<(id: string, delta: number) => void>;
  keyboardSettings?: POSKeyboardSettings;
};

const POS_KB_STORAGE_KEY = 'pos_keyboard_shortcuts';

function loadShortcuts(keyboardSettings?: POSKeyboardSettings) {
  if (keyboardSettings) return keyboardSettings.shortcuts;
  try {
    const saved = localStorage.getItem(POS_KB_STORAGE_KEY);
    if (saved) return JSON.parse(saved) as typeof DEFAULT_POS_KEYBOARD_SHORTCUTS;
  } catch {}
  return DEFAULT_POS_KEYBOARD_SHORTCUTS;
}

function isActionEnabled(action: string, shortcuts: ReturnType<typeof loadShortcuts>): boolean {
  const sc = shortcuts.find(s => s.action === action);
  return sc ? sc.enabled : true;
}

function matchesShortcut(
  e: KeyboardEvent,
  action: string,
  shortcuts: ReturnType<typeof loadShortcuts>
): boolean {
  const sc = shortcuts.find(s => s.action === action && s.enabled);
  if (!sc) return false;
  if (sc.key !== e.key) return false;
  if (sc.modifiers?.shift && !e.shiftKey) return false;
  if (!sc.modifiers?.shift && e.shiftKey && sc.key !== 'Shift') return false;
  if (sc.modifiers?.ctrl && !e.ctrlKey) return false;
  return true;
}

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
  addNewTab,
  isAutoPrintEnabledRef,
  setIsAutoPrintEnabled,
  selectedCartIndexRef,
  setSelectedCartIndex,
  cartItemsRef,
  updateQuantityRef,
  keyboardSettings,
}: UsePOSKeyboardArgs) {
  const barcodeBufferRef = useRef('');
  const barcodeLastTimeRef = useRef(0);

  const addNewTabRef = useRef(addNewTab);
  useEffect(() => {
    addNewTabRef.current = addNewTab;
  }, [addNewTab]);

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcuts = loadShortcuts(keyboardSettings);

      if (matchesShortcut(e, 'focusSearch', shortcuts)) {
        e.preventDefault();
        productSearchRef.current?.focus();
        return;
      }

      if (matchesShortcut(e, 'openConsultant', shortcuts)) {
        e.preventDefault();
        setShowConsultant(true);
        setTimeout(() => consultantSearchRef.current?.focus(), 100);
        return;
      }

      if (matchesShortcut(e, 'focusCustomer', shortcuts)) {
        e.preventDefault();
        customerSearchRef.current?.focus();
        return;
      }

      if (matchesShortcut(e, 'checkout', shortcuts) && cartLengthRef.current > 0) {
        e.preventDefault();
        checkoutRef.current();
        return;
      }

      if (matchesShortcut(e, 'addTab', shortcuts)) {
        e.preventDefault();
        addNewTabRef.current?.();
        return;
      }

      if (matchesShortcut(e, 'toggleAutoPrint', shortcuts)) {
        e.preventDefault();
        setIsAutoPrintEnabled?.(!isAutoPrintEnabledRef?.current);
        return;
      }

      if (matchesShortcut(e, 'toggleFullscreen', shortcuts)) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }

      // Cart navigation — only when no text input is focused
      const target = e.target as Element;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable;

      if (!isInputFocused) {
        const cart = cartItemsRef?.current ?? [];
        const idx = selectedCartIndexRef?.current ?? -1;

        if (matchesShortcut(e, 'cartQtyUp', shortcuts) && idx >= 0 && idx < cart.length) {
          e.preventDefault();
          updateQuantityRef?.current?.(cart[idx].productId, 1);
          return;
        }

        if (matchesShortcut(e, 'cartQtyDown', shortcuts) && idx >= 0 && idx < cart.length) {
          e.preventDefault();
          updateQuantityRef?.current?.(cart[idx].productId, -1);
          return;
        }

        if (matchesShortcut(e, 'cartNextItem', shortcuts) && cart.length > 0) {
          e.preventDefault();
          setSelectedCartIndex?.(prev => (prev < 0 ? 0 : (prev + 1) % cart.length));
          return;
        }

        if (matchesShortcut(e, 'cartPrevItem', shortcuts) && cart.length > 0) {
          setSelectedCartIndex?.(prev =>
            prev < 0 ? cart.length - 1 : (prev - 1 + cart.length) % cart.length
          );
          return;
        }

        if (matchesShortcut(e, 'cartSelectFirst', shortcuts) && cart.length > 0) {
          e.preventDefault();
          setSelectedCartIndex?.(() => 0);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    keyboardSettings,
    cartLengthRef,
    checkoutRef,
    consultantSearchRef,
    customerSearchRef,
    productSearchRef,
    setShowConsultant,
    isAutoPrintEnabledRef,
    setIsAutoPrintEnabled,
    selectedCartIndexRef,
    setSelectedCartIndex,
    cartItemsRef,
    updateQuantityRef,
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
