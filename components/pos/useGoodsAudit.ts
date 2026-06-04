import React from 'react';
import { AppDataSurgicalUpdate, POSProduct, InventoryTransaction } from '../../types';
import { generateId } from '../../src/lib';
import { AuditItem } from './GoodsAuditForm';
import { getCurrentStaffId } from '../shared/staff';

type GoodsTab = 'goods' | 'purchase' | 'kho' | 'pricing' | 'warranty' | 'audit_form' | 'product_form';
type InventoryTransactionItem = InventoryTransaction['items'][number];

interface UseGoodsAuditArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onAddTransaction?: (transaction: InventoryTransaction) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  setActiveTab: React.Dispatch<React.SetStateAction<GoodsTab>>;
}

export const useGoodsAudit = ({
  products,
  onUpdateProducts,
  onUpdateSurgical,
  onAddTransaction,
  showToast,
  setActiveTab
}: UseGoodsAuditArgs) => {
  const [auditSearchTerm, setAuditSearchTerm] = React.useState('');
  const [auditItems, setAuditItems] = React.useState<AuditItem[]>([]);

  const handleConfirmAudit = async (note?: string) => {
    const updatedProducts = [...products];
    const itemsForTransaction: InventoryTransactionItem[] = [];
    const surgicalUpdates: AppDataSurgicalUpdate[] = [];
    let totalActualQty = 0;
    let totalDiff = 0;
    auditItems.forEach(audit => {
      const idx = updatedProducts.findIndex(product => product.id === audit.productId);
      if (idx !== -1) {
        const product = updatedProducts[idx];
        const diff = audit.actualStock - audit.currentStock;
        totalActualQty += audit.actualStock;
        totalDiff += diff;
        itemsForTransaction.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: diff,
          previousStock: audit.currentStock,
          newStock: audit.actualStock
        });
        const updatedProduct = { ...product, stock: audit.actualStock };
        updatedProducts[idx] = updatedProduct;
        surgicalUpdates.push({ key: 'posProducts', item: updatedProduct });
      }
    });
    if (onUpdateSurgical && surgicalUpdates.length > 0) {
      await onUpdateSurgical(surgicalUpdates);
    } else {
      onUpdateProducts(updatedProducts);
    }
    if (onAddTransaction) {
      const now = new Date().toISOString();
      onAddTransaction({
        id: generateId(),
        date: now,
        type: 'Check',
        staffId: getCurrentStaffId(),
        items: itemsForTransaction,
        note: note?.trim() || 'Kiểm kho',
        status: 'balanced',
        balancedDate: now,
        totalActualQty,
        totalDiff,
      });
    }
    showToast(`Đã cân bằng kho ${itemsForTransaction.length} mặt hàng theo số lượng thực tế.`);
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
