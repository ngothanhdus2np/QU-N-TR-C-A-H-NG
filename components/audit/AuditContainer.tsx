import React, { useState } from 'react';
import AuditListPage from './AuditListPage';
import { GoodsAuditForm, AuditItem } from '../pos/GoodsAuditForm';
import { InventoryTransaction, AppData, AppDataSurgicalUpdate } from '../../types';
import { generateId } from '../../businessLogic';
import { useToast } from '../ui/Toast';
import { getCurrentStaffId } from '../shared/staff';

interface AuditContainerProps {
  data: AppData;
  onUpdateData: <K extends keyof AppData>(
    key: K,
    newList: AppData[K],
    idToRemove?: string
  ) => Promise<void>;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onPushBatch?: (key: keyof AppData, items: unknown[]) => Promise<void>;
}

/**
 * Container for Audit/Inventory Check management
 * Toggles between list view and audit form
 */
const AuditContainer: React.FC<AuditContainerProps> = ({
  data,
  onUpdateData,
  onUpdateSurgical,
  onPushBatch,
}) => {
  const { showToast } = useToast();
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');

  const products = data.posProducts || [];
  const transactions = data.inventoryTransactions || [];

  // Low stock products for quick add
  const lowStockProducts = products.filter(
    p => p.status === 'Active' && p.stock <= p.minStock && p.stock > 0
  );

  const handleViewDetail = (transaction: InventoryTransaction) => {
    // TODO: Open detail modal instead of alert
    const totalDiff = transaction.totalDiff || 0;
    const increaseCount = transaction.increaseCount || 0;
    const decreaseCount = transaction.decreaseCount || 0;
    showToast(
      `Chi tiết: ${transaction.id} | Chênh lệch: ${totalDiff > 0 ? '+' : ''}${totalDiff} | Tăng: ${increaseCount} | Giảm: ${decreaseCount}`,
      'info',
      6000
    );
  };

  const handleDeleteAudit = async (id: string) => {
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) return;

      const rollbackProducts =
        transaction.type === 'Check' && transaction.status !== 'cancelled'
          ? products
              .map(product => {
                const item = transaction.items.find(i => i.productId === product.id);
                return item ? { ...product, stock: item.previousStock } : null;
              })
              .filter((product): product is typeof products[number] => product !== null)
          : [];

      if (onUpdateSurgical) {
        await onUpdateSurgical([
          { key: 'inventoryTransactions', item: { id }, isDelete: true },
          ...rollbackProducts.map(product => ({ key: 'posProducts' as const, item: product })),
        ]);
      } else {
        if (rollbackProducts.length > 0) {
          const rollbackById = new Map(rollbackProducts.map(product => [product.id, product]));
          await onUpdateData(
            'posProducts',
            products.map(product => rollbackById.get(product.id) || product)
          );
        }
        await onUpdateData(
          'inventoryTransactions',
          transactions.filter(t => t.id !== id)
        );
      }

      showToast('Đã xóa phiếu kiểm kho', 'success');
    } catch (err) {
      console.error('[AuditContainer] Delete failed', err);
      showToast('Xóa thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleConfirmAudit = async () => {
    try {
      if (auditItems.length === 0) {
        showToast('Vui lòng thêm sản phẩm vào phiếu kiểm kho', 'warning');
        return;
      }

      const now = new Date().toISOString();
      
      // Calculate statistics
      let totalActualQty = 0;
      let totalDiff = 0;
      let increaseCount = 0;
      let decreaseCount = 0;

      const items = auditItems.map(item => {
        const product = products.find(p => p.id === item.productId);
        const diff = item.actualStock - item.currentStock;
        
        totalActualQty += item.actualStock;
        totalDiff += diff;
        if (diff > 0) increaseCount++;
        if (diff < 0) decreaseCount++;

        return {
          productId: item.productId,
          sku: product?.sku || '',
          name: product?.name || item.productId,
          quantity: diff, // Store difference in quantity field
          previousStock: item.currentStock,
          newStock: item.actualStock,
        };
      });

      // Create audit transaction
      const transaction: InventoryTransaction = {
        id: generateId(),
        date: now,
        type: 'Check',
        staffId: getCurrentStaffId(),
        status: 'balanced',
        balancedDate: now,
        totalActualQty,
        totalDiff,
        increaseCount,
        decreaseCount,
        note: `Kiểm kho ngày ${new Date().toLocaleDateString('vi-VN')}`,
        items,
      };

      // Update product stock
      const updatedProducts = products.map(product => {
        const auditItem = auditItems.find(item => item.productId === product.id);
        if (auditItem) {
          return { ...product, stock: auditItem.actualStock };
        }
        return product;
      });
      const changedProducts = updatedProducts.filter(product =>
        auditItems.some(item => item.productId === product.id)
      );

      try {
        if (onUpdateSurgical) {
          await onUpdateSurgical([
            { key: 'inventoryTransactions', item: transaction },
            ...changedProducts.map(product => ({ key: 'posProducts' as const, item: product })),
          ]);
        } else {
          await onPushBatch?.('inventoryTransactions', [transaction]);
          await onUpdateData('posProducts', updatedProducts);
        }
      } catch (err) {
        if (onUpdateSurgical) {
          await onUpdateSurgical([
            { key: 'inventoryTransactions', item: { id: transaction.id }, isDelete: true },
            ...auditItems
              .map(item => products.find(product => product.id === item.productId))
              .filter((product): product is typeof products[number] => Boolean(product))
              .map(product => ({ key: 'posProducts' as const, item: product })),
          ]);
        }
        throw err;
      }

      // Reset form
      setAuditItems([]);
      setAuditSearchTerm('');
      setShowAuditForm(false);
      showToast('Đã lưu phiếu kiểm kho thành công', 'success');
    } catch (err) {
      console.error('[AuditContainer] Confirm audit failed', err);
      showToast('Lưu phiếu kiểm kho thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleCancelAudit = () => {
    if (auditItems.length > 0) {
      if (!confirm('Bạn có chắc muốn hủy phiếu kiểm kho? Dữ liệu đã nhập sẽ bị mất.')) {
        return;
      }
    }
    setAuditItems([]);
    setAuditSearchTerm('');
    setShowAuditForm(false);
  };

  if (showAuditForm) {
    return (
      <GoodsAuditForm
        products={products}
        lowStockProducts={lowStockProducts}
        auditItems={auditItems}
        setAuditItems={setAuditItems}
        auditSearchTerm={auditSearchTerm}
        setAuditSearchTerm={setAuditSearchTerm}
        onConfirmAudit={handleConfirmAudit}
        onCancel={handleCancelAudit}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <AuditListPage
          transactions={transactions}
          onCreateAudit={() => setShowAuditForm(true)}
          onViewDetail={handleViewDetail}
          onDeleteAudit={handleDeleteAudit}
        />
      </div>
    </div>
  );
};

export default AuditContainer;
