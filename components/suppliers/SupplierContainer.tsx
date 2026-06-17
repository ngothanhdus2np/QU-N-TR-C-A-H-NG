import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import SupplierListPage from './SupplierListPage';
import SupplierForm from './SupplierForm';
import SupplierDetailView from './SupplierDetailView';
import { Supplier, AppData, AppDataSurgicalUpdate } from '../../types';
import { generateId } from '../../src/lib';
import { useToast } from '../ui/Toast';
import { exportToExcel } from '../../services/exportService';
import { Modal } from '../shared/ui/Modal';

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
  const [deleteDialog, setDeleteDialog] = useState<{
    supplierId: string;
    supplierName: string;
    warning?: string;
  } | null>(null);
  const [unsafeBulkDeleteDialog, setUnsafeBulkDeleteDialog] = useState<{
    ids: string[];
    unsafeNames: string[];
    moreCount: number;
    onSuccess?: () => void;
  } | null>(null);
  const supplierFileInputRef = useRef<HTMLInputElement>(null);

  const rawSuppliers = data.suppliers || [];
  const supplierDebts = data.supplierDebts || [];
  const inventoryTransactions = data.inventoryTransactions || [];

  const normalizeSupplierKey = (value?: string | null) => value?.trim().toLowerCase() || '';
  const normalizeSupplierCode = (value?: string | null) => value?.trim().toUpperCase() || '';
  const stripComputedFields = (supplier: Supplier): Supplier => {
    const { totalPurchase: _totalPurchase, currentDebt: _currentDebt, ...cleanData } = supplier;
    return cleanData;
  };

  const getNextSupplierCode = (reservedCodes: Set<string> = new Set()) => {
    const existingCodes = rawSuppliers
      .map(s => s.code)
      .filter(Boolean)
      .filter(code => /^NCC\d+$/i.test(code!))
      .map(code => parseInt(code!.replace(/NCC/i, ''), 10))
      .filter(num => !isNaN(num));

    let nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    let nextCode = `NCC${String(nextNum).padStart(4, '0')}`;
    while (reservedCodes.has(normalizeSupplierCode(nextCode))) {
      nextNum += 1;
      nextCode = `NCC${String(nextNum).padStart(4, '0')}`;
    }
    reservedCodes.add(normalizeSupplierCode(nextCode));
    return nextCode;
  };

  const supplierGroupOptions = useMemo(
    () => Array.from(new Set(rawSuppliers.map(s => s.group?.trim()).filter(Boolean) as string[])),
    [rawSuppliers]
  );

  const supplierAreaOptions = useMemo(() => {
    const cities = new Set<string>();
    const wards = new Set<string>();
    rawSuppliers.forEach(supplier => {
      const parts = (supplier.address || '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
      if (parts.length >= 2) wards.add(parts[parts.length - 2]);
      if (parts.length >= 1) cities.add(parts[parts.length - 1]);
    });
    return { cities: Array.from(cities), wards: Array.from(wards) };
  }, [rawSuppliers]);
  const transactionBelongsToSupplier = (
    transaction: (typeof inventoryTransactions)[number],
    supplier: Supplier
  ) => {
    if (transaction.supplierId) return transaction.supplierId === supplier.id;
    const supplierText = normalizeSupplierKey(transaction.supplierName);
    return (
      supplierText !== '' &&
      (supplierText === normalizeSupplierKey(supplier.name) ||
        supplierText === normalizeSupplierKey(supplier.code))
    );
  };
  const debtBelongsToSupplier = (
    debt: (typeof supplierDebts)[number],
    supplier: Supplier
  ) => {
    if (debt.supplierId) return debt.supplierId === supplier.id;
    const supplierText = normalizeSupplierKey(debt.supplierName);
    return (
      supplierText !== '' &&
      (supplierText === normalizeSupplierKey(supplier.name) ||
        supplierText === normalizeSupplierKey(supplier.code))
    );
  };

  // Compute totalPurchase and currentDebt for each supplier
  const suppliersWithComputed = useMemo(() => {
    return rawSuppliers.map(supplier => {
      const totalPurchase = inventoryTransactions
        .filter(
          transaction =>
            transaction.type === 'Import' && transactionBelongsToSupplier(transaction, supplier)
        )
        .reduce((sum, transaction) => sum + (transaction.totalAmount || 0), 0);
      const currentDebt = supplierDebts
        .filter(debt => debtBelongsToSupplier(debt, supplier))
        .reduce(
          (sum, debt) => sum + (debt.type === 'purchase' ? debt.amount : -debt.amount),
          0
        );

      return {
        ...supplier,
        totalPurchase,
        currentDebt,
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

      const cleanData = stripComputedFields(supplierData);

      // Auto-generate supplier code if not provided
      let supplierCode = cleanData.code?.trim();
      if (!supplierCode) supplierCode = getNextSupplierCode();

      const duplicatedCode = rawSuppliers.find(
        supplier =>
          supplier.id !== supplierId &&
          normalizeSupplierCode(supplier.code) === normalizeSupplierCode(supplierCode)
      );
      if (duplicatedCode) {
        showToast(`Mã NCC "${supplierCode}" đã tồn tại ở ${duplicatedCode.name}`, 'warning');
        return;
      }

      const duplicatedName = rawSuppliers.find(
        supplier =>
          supplier.id !== supplierId &&
          normalizeSupplierKey(supplier.name) === normalizeSupplierKey(cleanData.name)
      );
      if (duplicatedName) {
        showToast(`Tên nhà cung cấp "${cleanData.name}" đã tồn tại`, 'warning');
        return;
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
      showToast(isEdit ? 'Đã cập nhật nhà cung cấp' : 'Đã thêm nhà cung cấp mới', 'success');
    } catch (err) {
      console.error('[SupplierContainer] Save failed', err);
      showToast('Lưu thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleViewDetail = (supplier: Supplier) => {
    const supplierWithComputed = suppliersWithComputed.find(s => s.id === supplier.id);
    setViewingSupplier(prev =>
      prev?.id === supplier.id ? null : supplierWithComputed || supplier
    );
  };

  const handleDeleteSupplier = (id: string) => {
    const supplier = rawSuppliers.find(s => s.id === id);
    if (!supplier) return;

    const hasDebts = supplierDebts.some(d => d.supplierId === id);
    const hasPurchases = inventoryTransactions.some(
      t => t.type === 'Import' && t.supplierId === id
    );

    let warning: string | undefined;
    if (hasDebts || hasPurchases) {
      const parts: string[] = [];
      if (hasDebts) parts.push('dữ liệu công nợ');
      if (hasPurchases) parts.push('phiếu nhập hàng');
      warning = `Nhà cung cấp này có ${parts.join(' và ')}. Xóa sẽ không xóa được lịch sử.`;
    }

    setDeleteDialog({ supplierId: id, supplierName: supplier.name, warning });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog) return;
    const { supplierId } = deleteDialog;
    setDeleteDialog(null);

    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'suppliers', item: { id: supplierId }, isDelete: true }]);
      } else {
        await onUpdateData(
          'suppliers',
          rawSuppliers.filter(s => s.id !== supplierId)
        );
      }

      if (viewingSupplier?.id === supplierId) {
        setViewingSupplier(null);
      }

      showToast('Đã xóa nhà cung cấp', 'success');
    } catch (err) {
      console.error('[SupplierContainer] Delete failed', err);
      showToast('Xóa thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleBulkDeleteSuppliers = async (ids: string[], onSuccess?: () => void) => {
    try {
      const selected = rawSuppliers.filter(supplier => ids.includes(supplier.id));
      const unsafeSuppliers = selected.filter(supplier => {
        const hasDebts = supplierDebts.some(
          debt =>
            debt.supplierId === supplier.id ||
            normalizeSupplierKey(debt.supplierName) === normalizeSupplierKey(supplier.name)
        );
        const hasPurchases = inventoryTransactions.some(
          transaction =>
            (transaction.type === 'Import' || transaction.type === 'PurchaseReturn') &&
            transactionBelongsToSupplier(transaction, supplier)
        );
        return hasDebts || hasPurchases;
      });

      if (unsafeSuppliers.length > 0) {
        const unsafeNames = unsafeSuppliers.slice(0, 5).map(s => s.name);
        const moreCount = Math.max(0, unsafeSuppliers.length - 5);
        setUnsafeBulkDeleteDialog({ ids, unsafeNames, moreCount, onSuccess });
        return;
      }

      if (onUpdateSurgical) {
        await onUpdateSurgical(
          ids.map(id => ({ key: 'suppliers', item: { id }, isDelete: true }))
        );
      } else {
        await onUpdateData(
          'suppliers',
          rawSuppliers.filter(s => !ids.includes(s.id))
        );
      }

      if (viewingSupplier && ids.includes(viewingSupplier.id)) {
        setViewingSupplier(null);
      }

      onSuccess?.();
      showToast(`Đã xóa ${ids.length} nhà cung cấp`, 'success');
    } catch (err) {
      console.error('[SupplierContainer] Bulk delete failed', err);
      showToast('Xóa thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleConfirmUnsafeBulkDelete = async () => {
    if (!unsafeBulkDeleteDialog) return;
    const { ids, onSuccess } = unsafeBulkDeleteDialog;
    setUnsafeBulkDeleteDialog(null);
    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical(ids.map(id => ({ key: 'suppliers', item: { id }, isDelete: true })));
      } else {
        await onUpdateData('suppliers', rawSuppliers.filter(s => !ids.includes(s.id)));
      }
      if (viewingSupplier && ids.includes(viewingSupplier.id)) setViewingSupplier(null);
      onSuccess?.();
      showToast(`Đã xóa ${ids.length} nhà cung cấp`, 'success');
    } catch (err) {
      console.error('[SupplierContainer] Unsafe bulk delete failed', err);
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

  const handleToggleStatus = async (supplier: Supplier) => {
    try {
      const newStatus: Supplier['status'] = supplier.status === 'inactive' ? 'active' : 'inactive';
      const cleanData = stripComputedFields(supplier);
      const updatedSupplier: Supplier = { ...cleanData, status: newStatus };

      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'suppliers', item: updatedSupplier }]);
      } else {
        await onUpdateData(
          'suppliers',
          rawSuppliers.map(s => (s.id === supplier.id ? updatedSupplier : s))
        );
      }

      setViewingSupplier(prev => (prev ? { ...prev, status: newStatus } : prev));
      showToast(
        newStatus === 'inactive' ? 'Đã ngừng hoạt động nhà cung cấp' : 'Đã kích hoạt nhà cung cấp',
        'success'
      );
    } catch (err) {
      console.error('[SupplierContainer] Toggle status failed', err);
      showToast('Cập nhật trạng thái thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleToggleFavorite = async (supplier: Supplier) => {
    try {
      const cleanData = stripComputedFields(supplier);
      const updatedSupplier: Supplier = { ...cleanData, isFavorite: !supplier.isFavorite };

      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'suppliers', item: updatedSupplier }]);
      } else {
        await onUpdateData(
          'suppliers',
          rawSuppliers.map(item => (item.id === supplier.id ? updatedSupplier : item))
        );
      }

      setViewingSupplier(prev =>
        prev?.id === supplier.id ? { ...prev, isFavorite: updatedSupplier.isFavorite } : prev
      );
      showToast(
        updatedSupplier.isFavorite ? 'Đã đánh dấu nhà cung cấp' : 'Đã bỏ đánh dấu nhà cung cấp',
        'success'
      );
    } catch (err) {
      console.error('[SupplierContainer] Toggle favorite failed', err);
      showToast('Cập nhật đánh dấu thất bại. Vui lòng thử lại.', 'error');
    }
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
        Nhóm: supplier.group || '',
        'Trạng thái': supplier.status || 'active',
        'Điện thoại': supplier.phone || '',
        Email: supplier.email || '',
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

      const existingByName = new Map(
        rawSuppliers.map(supplier => [supplier.name.trim().toLowerCase(), supplier])
      );
      const existingByCode = new Map(
        rawSuppliers
          .filter(supplier => supplier.code)
          .map(supplier => [normalizeSupplierCode(supplier.code), supplier])
      );
      const usedCodes = new Set(existingByCode.keys());
      const seenImportCodes = new Set<string>();
      const imported: Supplier[] = [];
      const skippedRows: string[] = [];

      rows.forEach((row, index) => {
        const name = String(
          getCell(row, ['Tên NCC', 'Tên nhà cung cấp', 'Nhà cung cấp', 'Name']) || ''
        ).trim();
        if (!name) return;

        const rawCode = String(
          getCell(row, ['Mã NCC', 'Mã nhà cung cấp', 'Code']) || ''
        ).trim();
        const normalizedCode = normalizeSupplierCode(rawCode);
        if (normalizedCode && seenImportCodes.has(normalizedCode)) {
          skippedRows.push(`Dòng ${index + 2}: trùng mã ${rawCode} trong file`);
          return;
        }
        if (normalizedCode) seenImportCodes.add(normalizedCode);

        const existingByImportedCode = normalizedCode ? existingByCode.get(normalizedCode) : undefined;
        const existing = existingByImportedCode || existingByName.get(name.toLowerCase());
        if (
          existingByImportedCode &&
          normalizeSupplierKey(existingByImportedCode.name) !== normalizeSupplierKey(name)
        ) {
          skippedRows.push(`Dòng ${index + 2}: mã ${rawCode} đang thuộc NCC "${existingByImportedCode.name}"`);
          return;
        }

        const code = rawCode || existing?.code || getNextSupplierCode(usedCodes);
        usedCodes.add(normalizeSupplierCode(code));
        imported.push({
          ...(existing || {}),
          id: existing?.id || generateId(),
          name,
          code,
          group:
            String(getCell(row, ['Nhóm', 'Group']) || existing?.group || '').trim() || undefined,
          phone:
            String(getCell(row, ['Điện thoại', 'SĐT', 'Phone']) || existing?.phone || '').trim() ||
            undefined,
          email: String(getCell(row, ['Email']) || existing?.email || '').trim() || undefined,
          address:
            String(getCell(row, ['Địa chỉ', 'Address']) || existing?.address || '').trim() ||
            undefined,
          notes:
            String(getCell(row, ['Ghi chú', 'Notes']) || existing?.notes || '').trim() || undefined,
          companyName:
            String(
              getCell(row, ['Công ty xuất hóa đơn', 'Tên công ty', 'Company']) ||
                existing?.companyName ||
                ''
            ).trim() || undefined,
          taxCode:
            String(getCell(row, ['Mã số thuế', 'MST', 'Tax Code']) || existing?.taxCode || '').trim() ||
            undefined,
          isFavorite: existing?.isFavorite || false,
          status: (() => {
            const raw = String(getCell(row, ['Trạng thái', 'Status']) || '').trim();
            return (['active', 'inactive'].includes(raw) ? raw : existing?.status || 'active') as Supplier['status'];
          })(),
        });
      });

      if (imported.length === 0) {
        showToast('Không tìm thấy nhà cung cấp hợp lệ trong file', 'warning');
        return;
      }

      const byId = new Map(rawSuppliers.map(supplier => [supplier.id, supplier]));
      imported.forEach(supplier => byId.set(supplier.id, supplier));
      const nextSuppliers = Array.from(byId.values());

      if (onUpdateSurgical) {
        await onUpdateSurgical(imported.map(supplier => ({ key: 'suppliers', item: supplier })));
      } else {
        await onUpdateData('suppliers', nextSuppliers);
      }
      showToast(
        `Đã import ${imported.length} nhà cung cấp${skippedRows.length ? `, bỏ qua ${skippedRows.length} dòng lỗi` : ''}`,
        skippedRows.length ? 'warning' : 'success'
      );
    } catch (err) {
      console.error('[SupplierContainer] Import suppliers failed', err);
      showToast('Import nhà cung cấp thất bại. Vui lòng kiểm tra file Excel.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const deleteModal = (
    <Modal
      isOpen={!!deleteDialog}
      onClose={() => setDeleteDialog(null)}
      title="Xác nhận xóa nhà cung cấp"
      size="sm"
    >
      {deleteDialog?.warning && (
        <div className="mb-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>{deleteDialog.warning}</span>
        </div>
      )}
      <p className="text-slate-700">
        Bạn có chắc muốn xóa nhà cung cấp{' '}
        <span className="font-semibold">"{deleteDialog?.supplierName}"</span>?
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => setDeleteDialog(null)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Hủy
        </button>
        <button
          onClick={handleConfirmDelete}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Xóa
        </button>
      </div>
    </Modal>
  );

  return (
    <>
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
            viewingSupplier={viewingSupplier}
            onCreateSupplier={handleCreateSupplier}
            onViewDetail={handleViewDetail}
            onDeleteSupplier={handleDeleteSupplier}
            onBulkDeleteSuppliers={handleBulkDeleteSuppliers}
            onImportFile={handleImportFile}
            onExportSuppliers={handleExportSuppliers}
            onToggleFavorite={handleToggleFavorite}
            expandedRowContent={
              viewingSupplier ? (
                <SupplierDetailView
                  supplier={viewingSupplier}
                  supplierDebts={supplierDebts}
                  purchaseTransactions={inventoryTransactions.filter(
                    t => t.type === 'Import' || t.type === 'PurchaseReturn'
                  )}
                  onEdit={handleEditFromDetail}
                  onDelete={handleDeleteFromDetail}
                  onClose={() => setViewingSupplier(null)}
                  onToggleStatus={handleToggleStatus}
                />
              ) : null
            }
          />
        </div>
      </div>
      {showSupplierForm && (
        <SupplierForm
          supplier={editingSupplier}
          groupOptions={supplierGroupOptions}
          cityOptions={supplierAreaOptions.cities}
          wardOptions={supplierAreaOptions.wards}
          onSave={handleSaveSupplier}
          onCancel={() => {
            setShowSupplierForm(false);
            setEditingSupplier(null);
          }}
        />
      )}
      {deleteModal}
      <Modal
        isOpen={!!unsafeBulkDeleteDialog}
        onClose={() => setUnsafeBulkDeleteDialog(null)}
        title="Xác nhận xóa nhà cung cấp"
        size="sm"
      >
        <div className="mb-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            {unsafeBulkDeleteDialog?.unsafeNames.length} nhà cung cấp có công nợ hoặc phiếu nhập/trả hàng:{' '}
            <strong>{unsafeBulkDeleteDialog?.unsafeNames.join(', ')}</strong>
            {unsafeBulkDeleteDialog?.moreCount ? ` và ${unsafeBulkDeleteDialog.moreCount} NCC khác` : ''}
            . Xóa sẽ không xóa lịch sử phát sinh.
          </span>
        </div>
        <p className="text-slate-700">Bạn vẫn muốn xóa {unsafeBulkDeleteDialog?.ids.length} nhà cung cấp?</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setUnsafeBulkDeleteDialog(null)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirmUnsafeBulkDelete}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Xóa
          </button>
        </div>
      </Modal>
    </>
  );
};

export default SupplierContainer;
