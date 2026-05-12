import React from 'react';
import { POSProduct, InventoryTransaction } from '../../types';
import { generateId } from '../../businessLogic';
import { AuditItem } from './GoodsAuditForm';
import { getCurrentStaffId } from '../shared/staff';

type GoodsTab = 'goods' | 'purchase' | 'kho' | 'audit_form' | 'product_form';
type InventoryTransactionItem = InventoryTransaction['items'][number];

interface UseGoodsAuditArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onAddTransaction?: (transaction: InventoryTransaction) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  setActiveTab: React.Dispatch<React.SetStateAction<GoodsTab>>;
}

export const useGoodsAudit = ({
  products,
  onUpdateProducts,
  onAddTransaction,
  showToast,
  setActiveTab
}: UseGoodsAuditArgs) => {
  const [auditSearchTerm, setAuditSearchTerm] = React.useState('');
  const [auditItems, setAuditItems] = React.useState<AuditItem[]>([]);

  const handleConfirmAudit = () => {
    const updatedProducts = [...products];
    const itemsForTransaction: InventoryTransactionItem[] = [];
    auditItems.forEach(audit => {
      const idx = updatedProducts.findIndex(product => product.id === audit.productId);
      if (idx !== -1) {
        const product = updatedProducts[idx];
        itemsForTransaction.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: audit.actualStock - audit.currentStock,
          previousStock: audit.currentStock,
          newStock: audit.actualStock
        });
        updatedProducts[idx] = { ...product, stock: audit.actualStock };
      }
    });
    onUpdateProducts(updatedProducts);
    if (onAddTransaction) {
      onAddTransaction({ id: generateId(), date: new Date().toISOString(), type: 'Check', staffId: getCurrentStaffId(), items: itemsForTransaction, note: 'Kiểm kho' });
    }
    showToast(`Kiểm kho hoàn tất! Đã xác nhận ${itemsForTransaction.length} mặt hàng.`);
    setAuditItems([]);
    setActiveTab('kho');
  };

  const cancelAudit = () => {
    setAuditItems([]);
    setActiveTab('kho');
  };

  return {
    auditSearchTerm,
    setAuditSearchTerm,
    auditItems,
    setAuditItems,
    handleConfirmAudit,
    cancelAudit
  };
};
