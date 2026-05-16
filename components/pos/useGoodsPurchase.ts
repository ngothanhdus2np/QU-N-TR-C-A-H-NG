import React from 'react';
import { POSProduct, InventoryTransaction } from '../../types';
import { calculateNextImportPrice, generateId, getInventoryCostMethod } from '../../src/lib';
import { getCurrentStaffId } from '../shared/staff';
import { PurchaseDiscountType } from './GoodsPurchaseForm';

type PurchaseItem = { productId: string; quantity: number; price: number; name: string; discount: number };
type PurchaseTransactionItem = InventoryTransaction['items'][number] & { price?: number };

interface UseGoodsPurchaseArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onAddTransaction?: (transaction: InventoryTransaction) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const useGoodsPurchase = ({
  products,
  onUpdateProducts,
  onAddTransaction,
  showToast
}: UseGoodsPurchaseArgs) => {
  const [showPurchaseForm, setShowPurchaseForm] = React.useState(false);
  const [purchaseItems, setPurchaseItems] = React.useState<PurchaseItem[]>([]);
  const [purchaseSupplier, setPurchaseSupplier] = React.useState('');
  const [purchaseNote, setPurchaseNote] = React.useState('');
  const [purchaseDiscountValue, setPurchaseDiscountValue] = React.useState(0);
  const [purchaseDiscountType, setPurchaseDiscountType] = React.useState<PurchaseDiscountType>('fixed');

  const handleAddProductToPurchase = (product: POSProduct) => {
    const existing = purchaseItems.find(item => item.productId === product.id);
    if (existing) {
      setPurchaseItems(prev => prev.map(item =>
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setPurchaseItems(prev => [...prev, {
        productId: product.id,
        quantity: 1,
        price: product.importPrice,
        name: product.name,
        discount: 0
      }]);
    }
  };

  const handleAddProductsToPurchase = (selectedProducts: POSProduct[]) => {
    const purchaseableProducts = selectedProducts.filter(product => !product.isParent);
    if (purchaseableProducts.length === 0) {
      showToast('Không có hàng hóa bán thật để nhập hàng.', 'error');
      return;
    }

    setPurchaseItems(prev => {
      const next = [...prev];
      purchaseableProducts.forEach(product => {
        const existingIndex = next.findIndex(item => item.productId === product.id);
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + 1,
          };
        } else {
          next.push({
            productId: product.id,
            quantity: 1,
            price: product.importPrice,
            name: product.name,
            discount: 0,
          });
        }
      });
      return next;
    });
    setShowPurchaseForm(true);
    showToast(`Đã thêm ${purchaseableProducts.length} mặt hàng vào phiếu nhập.`);
  };

  const updatePurchaseItem = (id: string, updates: Partial<{ quantity: number; price: number; discount: number }>) => {
    setPurchaseItems(prev => prev.map(item => item.productId === id ? { ...item, ...updates } : item));
  };

  const removePurchaseItem = (id: string) => {
    setPurchaseItems(prev => prev.filter(item => item.productId !== id));
  };

  const handleCompletePurchase = () => {
    if (purchaseItems.length === 0) return;
    const costMethod = getInventoryCostMethod();
    const updatedProducts = [...products];
    const itemsForTransaction: PurchaseTransactionItem[] = [];
    const itemsNetTotal = purchaseItems.reduce(
      (sum, item) => sum + item.quantity * item.price - item.discount,
      0
    );
    const purchaseDiscountAmount =
      purchaseDiscountType === 'percent'
        ? Math.min(itemsNetTotal, Math.round((itemsNetTotal * purchaseDiscountValue) / 100))
        : Math.min(itemsNetTotal, purchaseDiscountValue);

    purchaseItems.forEach(item => {
      const idx = updatedProducts.findIndex(product => product.id === item.productId);
      if (idx !== -1) {
        const product = updatedProducts[idx];
        itemsForTransaction.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: item.quantity,
          previousStock: product.stock,
          newStock: product.stock + item.quantity,
          price: item.price,
          discount: item.discount,
          costMethod,
        });
        updatedProducts[idx] = {
          ...product,
          stock: product.stock + item.quantity,
          importPrice: calculateNextImportPrice(product, item.quantity, item.price, costMethod),
        };
      }
    });

    onUpdateProducts(updatedProducts);
    if (onAddTransaction) {
      onAddTransaction({
        id: generateId(),
        date: new Date().toISOString(),
        type: 'Import',
        staffId: getCurrentStaffId(),
        items: itemsForTransaction,
        note: purchaseNote || `Nhập hàng từ ${purchaseSupplier || 'NCC vãng lai'}`,
        totalAmount: Math.max(0, itemsNetTotal - purchaseDiscountAmount),
      });
    }
    showToast(`Nhập hàng thành công! ${itemsForTransaction.length} mặt hàng.`);
    setPurchaseItems([]);
    setPurchaseSupplier('');
    setPurchaseNote('');
    setPurchaseDiscountValue(0);
    setPurchaseDiscountType('fixed');
    setShowPurchaseForm(false);
  };

  return {
    showPurchaseForm,
    setShowPurchaseForm,
    purchaseItems,
    purchaseSupplier,
    setPurchaseSupplier,
    purchaseNote,
    setPurchaseNote,
    purchaseDiscountValue,
    purchaseDiscountType,
    setPurchaseDiscountValue,
    setPurchaseDiscountType,
    handleAddProductToPurchase,
    handleAddProductsToPurchase,
    updatePurchaseItem,
    removePurchaseItem,
    handleCompletePurchase
  };
};
