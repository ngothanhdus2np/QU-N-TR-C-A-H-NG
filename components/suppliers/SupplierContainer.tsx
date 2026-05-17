import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import SupplierListPage from './SupplierListPage';
import SupplierForm from './SupplierForm';
import SupplierDetailView from './SupplierDetailView';
import { Supplier, AppData, AppDataSurgicalUpdate } from '../../types';
import { generateId } from '../../src/lib';
import { useToast } from '../ui/Toast';
import { exportToExcel } from '../../services/exportService';

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
  const supplierFileInputRef = useRef<HTMLInputElement>(null);

  const rawSuppliers = data.suppliers || [];
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

    return rawSuppliers.map(supplier => {
      return {
        ...supplier,
        totalPurchase: totalPurchaseBySupplier.get(supplier.id) || 0,
        currentDebt: currentDebtBySupplier.get(supplier.id) || 0,
      };
    });
  }, [rawSuppliers, supplierDebts, inventoryTransactions]);

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

      // Auto-generate supplier code if not provided
      let supplierCode = cleanData.code?.trim();
      if (!supplierCode) {
        // Generate NCC0001, NCC0002, etc.
        const existingCodes = rawSuppliers
          .map(s => s.code)
          .filter(Boolean)
          .filter(code => /^NCC\d+$/.test(code!))
          .map(code => parseInt(code!.replace('NCC', ''), 10))
          .filter(num => !isNaN(num));
        
        const maxNum = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
        supplierCode = `NCC${String(maxNum + 1).padStart(4, '0')}`;
      }

      const supplier: Supplier = {
        ...cleanData,
        id: supplierId,
        code: supplierCode,
      };

      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'suppliers', item: supplier }]);
      } else {
        const updatedSuppliers = isEdit
          ? rawSuppliers.map(s => (s.id === supplierId ? supplier : s))
          : [...rawSuppliers, supplier];
        await onUpdateData('suppliers', updatedSuppliers);
      }

      setShowSupplierForm(false);
      setEditingSupplier(null);
      showToast(
        isEdit ? 'Đã cập nhật nhà cung cấp' : 'Đã thêm nhà cung cấp mới',
        'success'
      );
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
      const supplier = rawSuppliers.find(s => s.id === id);
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
        await onUpdateData('suppliers', rawSuppliers.filter(s => s.id !== id));
      }

      // Close detail view if viewing deleted supplier
      if (viewingSupplier?.id === id) {
        setViewingSupplier(null);
      }

      showToast('Đã xóa nhà cung cấp', 'success');
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
    supplierFileInputRef.current?.click();
  };

  const handleExportSuppliers = (suppliersToExport: Supplier[]) => {
    if (suppliersToExport.length === 0) {
      showToast('Chưa có nhà cung cấp để xuất', 'warning');
      return;
    }
    exportToExcel(
      suppliersToExport.map(supplier => ({
        'Mã NCC': supplier.code || supplier.id,
        'Tên NCC': supplier.name,
        'Nhóm': supplier.group || '',
        'Trạng thái': supplier.status || 'active',
        'Điện thoại': supplier.phone || '',
        'Email': supplier.email || '',
        'Địa chỉ': supplier.address || '',
        'Tổng mua': supplier.totalPurchase || 0,
        'Nợ hiện tại': supplier.currentDebt || 0,
        'Ghi chú': supplier.notes || '',
      })),
      'Danh_Sach_Nha_Cung_Cap',
      'Nhà cung cấp'
    );
  };

  const handleSupplierFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

      const getCell = (row: Record<string, unknown>, aliases: string[]) => {
        const key = Object.keys(row).find(k =>
          aliases.some(alias => k.trim().toLowerCase() === alias.trim().toLowerCase())
        );
        return key ? row[key] : '';
      };

      const existingByName = new Map(rawSuppliers.map(supplier => [supplier.name.trim().toLowerCase(), supplier]));
      const imported: Supplier[] = [];

      rows.forEach(row => {
        const name = String(getCell(row, ['Tên NCC', 'Tên nhà cung cấp', 'Nhà cung cấp', 'Name']) || '').trim();
        if (!name) return;
        const existing = existingByName.get(name.toLowerCase());
        imported.push({
          ...(existing || {}),
          id: existing?.id || generateId(),
          name,
          code: String(getCell(row, ['Mã NCC', 'Mã nhà cung cấp', 'Code']) || existing?.code || '').trim() || undefined,
          group: String(getCell(row, ['Nhóm', 'Group']) || existing?.group || '').trim() || undefined,
          phone: String(getCell(row, ['Điện thoại', 'SĐT', 'Phone']) || existing?.phone || '').trim() || undefined,
          email: String(getCell(row, ['Email']) || existing?.email || '').trim() || undefined,
          address: String(getCell(row, ['Địa chỉ', 'Address']) || existing?.address || '').trim() || undefined,
          notes: String(getCell(row, ['Ghi chú', 'Notes']) || existing?.notes || '').trim() || undefined,
          status: (String(getCell(row, ['Trạng thái', 'Status']) || existing?.status || 'active').trim() as Supplier['status']) || 'active',
        });
      });

      if (imported.length === 0) {
        showToast('Không tìm thấy nhà cung cấp hợp lệ trong file', 'warning');
        return;
      }

      const byId = new Map(rawSuppliers.map(supplier => [supplier.id, supplier]));
      imported.forEach(supplier => byId.set(supplier.id, supplier));
      const nextSuppliers = Array.from(byId.values());

      await onUpdateData('suppliers', nextSuppliers);
      showToast(`Đã import ${imported.length} nhà cung cấp`, 'success');
    } catch (err) {
      console.error('[SupplierContainer] Import suppliers failed', err);
      showToast('Import nhà cung cấp thất bại. Vui lòng kiểm tra file Excel.', 'error');
    } finally {
      event.target.value = '';
    }
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
      <input
        ref={supplierFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleSupplierFileImport}
      />
      <div className="flex-1 min-h-0">
        <SupplierListPage
          suppliers={suppliersWithComputed}
          onCreateSupplier={handleCreateSupplier}
          onViewDetail={handleViewDetail}
          onDeleteSupplier={handleDeleteSupplier}
          onImportFile={handleImportFile}
          onExportSuppliers={handleExportSuppliers}
        />
      </div>
    </div>
  );
};

export default SupplierContainer;
