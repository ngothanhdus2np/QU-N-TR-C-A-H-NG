import React, { useState, useMemo } from 'react';
import SupplierListPage from './SupplierListPage';
import SupplierForm from './SupplierForm';
import SupplierDetailView from './SupplierDetailView';
import { Supplier, AppData, AppDataSurgicalUpdate } from '../../types';
import { generateId } from '../../businessLogic';
import { useToast } from '../ui/Toast';

interface SupplierContainerProps {
  data: AppData;
  onUpdateData: <K extends keyof AppData>(
    key: K,
    newList: AppData[K],
    idToRemove?: string
  ) => Promise<void>;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
}

/**
 * Container for Supplier management
 * Toggles between list view, form, and detail view
 */
const SupplierContainer: React.FC<SupplierContainerProps> = ({
  data,
  onUpdateData,
  onUpdateSurgical,
}) => {
  const { showToast } = useToast();
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  const suppliers = data.suppliers || [];
  const supplierDebts = data.supplierDebts || [];
  const inventoryTransactions = data.inventoryTransactions || [];

  // Compute totalPurchase and currentDebt for each supplier
  const suppliersWithComputed = useMemo(() => {
    const totalPurchaseBySupplier = new Map<string, number>();
    inventoryTransactions.forEach(transaction => {
      if (transaction.type !== 'Import' || !transaction.supplierId) return;
      totalPurchaseBySupplier.set(
        transaction.supplierId,
        (totalPurchaseBySupplier.get(transaction.supplierId) || 0) +
          (transaction.totalAmount || 0)
      );
    });

    const currentDebtBySupplier = new Map<string, number>();
    supplierDebts.forEach(debt => {
      currentDebtBySupplier.set(
        debt.supplierId,
        (currentDebtBySupplier.get(debt.supplierId) || 0) +
          (debt.type === 'purchase' ? debt.amount : -debt.amount)
      );
    });

    return suppliers.map(supplier => {
      return {
        ...supplier,
        totalPurchase: totalPurchaseBySupplier.get(supplier.id) || 0,
        currentDebt: currentDebtBySupplier.get(supplier.id) || 0,
      };
    });
  }, [suppliers, supplierDebts, inventoryTransactions]);

  const handleCreateSupplier = () => {
    setEditingSupplier(null);
    setShowSupplierForm(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowSupplierForm(true);
    setViewingSupplier(null);
  };

  const handleSaveSupplier = async (supplierData: Supplier) => {
    try {
      const isEdit = editingSupplier !== null;
      const supplierId = isEdit ? editingSupplier.id : generateId();

      // Strip computed fields before saving
      const { totalPurchase: _totalPurchase, currentDebt: _currentDebt, ...cleanData } = supplierData;

      const supplier: Supplier = {
        ...cleanData,
        id: supplierId,
      };

      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'suppliers', item: supplier }]);
      } else {
        const updatedSuppliers = isEdit
          ? suppliers.map(s => (s.id === supplierId ? supplier : s))
          : [...suppliers, supplier];
        await onUpdateData('suppliers', updatedSuppliers);
      }

      setShowSupplierForm(false);
      setEditingSupplier(null);
    } catch (err) {
      console.error('[SupplierContainer] Save failed', err);
      showToast('Lưu thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleViewDetail = (supplier: Supplier) => {
    // Find the supplier with computed fields
    const supplierWithComputed = suppliersWithComputed.find(s => s.id === supplier.id);
    setViewingSupplier(supplierWithComputed || supplier);
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      const supplier = suppliers.find(s => s.id === id);
      if (!supplier) return;

      // Check if supplier has debts
      const hasDebts = supplierDebts.some(d => d.supplierId === id);
      
      // Check if supplier has purchase transactions
      const hasPurchases = inventoryTransactions.some(
        t => t.type === 'Import' && t.supplierId === id
      );

      if (hasDebts || hasPurchases) {
        const message = [];
        if (hasDebts) message.push('dữ liệu công nợ');
        if (hasPurchases) message.push('phiếu nhập hàng');
        
        if (
          !confirm(
            `Nhà cung cấp này có ${message.join(' và ')}. Xóa sẽ không xóa được lịch sử. Tiếp tục?`
          )
        ) {
          return;
        }
      }

      if (!confirm(`Xác nhận xóa nhà cung cấp "${supplier.name}"?`)) {
        return;
      }

      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'suppliers', item: { id }, isDelete: true }]);
      } else {
        await onUpdateData('suppliers', suppliers.filter(s => s.id !== id));
      }

      // Close detail view if viewing deleted supplier
      if (viewingSupplier?.id === id) {
        setViewingSupplier(null);
      }
    } catch (err) {
      console.error('[SupplierContainer] Delete failed', err);
      showToast('Xóa thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleDeleteFromDetail = async () => {
    if (!viewingSupplier) return;
    await handleDeleteSupplier(viewingSupplier.id);
  };

  const handleEditFromDetail = () => {
    if (!viewingSupplier) return;
    handleEditSupplier(viewingSupplier);
  };

  const handleImportFile = () => {
    // TODO: Implement import from Excel
    showToast('Chức năng import file đang được phát triển', 'info');
  };

  // If viewing detail
  if (viewingSupplier) {
    return (
      <SupplierDetailView
        supplier={viewingSupplier}
        supplierDebts={supplierDebts}
        purchaseTransactions={inventoryTransactions.filter(t => t.type === 'Import')}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
        onClose={() => setViewingSupplier(null)}
      />
    );
  }

  // If showing form
  if (showSupplierForm) {
    return (
      <SupplierForm
        supplier={editingSupplier}
        onSave={handleSaveSupplier}
        onCancel={() => {
          setShowSupplierForm(false);
          setEditingSupplier(null);
        }}
      />
    );
  }

  // Default: show list
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <SupplierListPage
          suppliers={suppliersWithComputed}
          onCreateSupplier={handleCreateSupplier}
          onViewDetail={handleViewDetail}
          onDeleteSupplier={handleDeleteSupplier}
          onImportFile={handleImportFile}
        />
      </div>
    </div>
  );
};

export default SupplierContainer;
