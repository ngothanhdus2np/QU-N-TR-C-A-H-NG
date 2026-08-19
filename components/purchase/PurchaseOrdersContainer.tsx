import React from 'react';
import * as XLSX from 'xlsx';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import PurchaseReturnsPage from './PurchaseReturnsPage';
import PurchaseOrderDetailModal from './PurchaseOrderDetailModal';
import GoodsPurchaseReturnForm from './GoodsPurchaseReturnForm';
import { GoodsPurchaseForm, PurchaseDiscountType, PurchaseItem } from '../pos/GoodsPurchaseForm';
import { GoodsCreateProductInfoTab } from '../pos/GoodsCreateProductInfoTab';
import { GoodsCreateProductModal, CreateProductModalTab } from '../pos/GoodsCreateProductModal';
import { GoodsCreateProductTextTab } from '../pos/GoodsCreateProductTextTab';
import SupplierForm from '../suppliers/SupplierForm';
import {
  InventoryTransaction,
  POSProduct,
  AppData,
  AppDataSurgicalUpdate,
  Supplier,
  SupplierDebtRecord,
} from '../../types';
import {
  AUTO_SKU_PLACEHOLDER,
  calcEffectiveUnitPrice,
  calculateNextImportPrice,
  generateId,
  getInventoryCostMethod,
  resolveProductSku,
} from '../../src/lib';
import { EXCEL_MAX_ROWS, assertSafeExcelBuffer, assertSafeExcelFile } from '../../src/lib/excelSafety';
import { useToast } from '../ui/Toast';
import { getCurrentStaffId } from '../shared/staff';
import { exportToExcel, printToPDF } from '../../services/exportService';
import { usePurchaseFormState } from '../../hooks/usePurchaseFormState';
import { usePurchaseQuickModals } from '../../hooks/usePurchaseQuickModals';
import { uploadPurchaseInvoice } from '../../services/invoiceService';
import { apiService } from '../../services/apiService';

interface PurchaseOrdersContainerProps {
  data: AppData;
  onUpdateData: <K extends keyof AppData>(
    key: K,
    newList: AppData[K],
    idToRemove?: string
  ) => Promise<void>;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onPushBatch?: (key: keyof AppData, items: unknown[]) => Promise<void>;
  initialView?: 'imports' | 'returns';
  onRefreshData?: () => Promise<void>;
}

/**
 * Container for Purchase Orders management
 * Toggles between list view and create form
 */
const PurchaseOrdersContainer: React.FC<PurchaseOrdersContainerProps> = ({
  data,
  onUpdateData,
  onUpdateSurgical,
  onPushBatch,
  initialView = 'imports',
  onRefreshData,
}) => {
  const { showToast } = useToast();
  const activePurchaseView = initialView;

  // Use custom hooks for form state management
  const purchaseFormState = usePurchaseFormState();
  const quickModalsState = usePurchaseQuickModals();

  // Destructure for convenience
  const {
    showPurchaseForm,
    setShowPurchaseForm,
    purchaseItems,
    setPurchaseItems,
    editingTransactionId,
    setEditingTransactionId,
    editingTransactionStatus,
    setEditingTransactionStatus,
    purchaseSupplier,
    setPurchaseSupplier,
    purchaseNote,
    setPurchaseNote,
    purchaseDiscountValue,
    setPurchaseDiscountValue,
    purchaseDiscountType,
    setPurchaseDiscountType,
    resetPurchaseForm,
    getPurchaseItemsNetTotal,
    getPurchaseBillDiscountAmount,
    purchaseReferenceId,
    setPurchaseReferenceId,
    invoiceStatus,
    setInvoiceStatus,
    invoiceFile,
    setInvoiceFile,
    showPurchaseReturnForm,
    setShowPurchaseReturnForm,
    returnItems,
    setReturnItems,
    returnSupplier,
    setReturnSupplier,
    returnNote,
    setReturnNote,
    returnDiscountValue,
    setReturnDiscountValue,
    returnDiscountType,
    setReturnDiscountType,
    returnReferenceId,
    setReturnReferenceId,
    returnSupplierPaidAmount,
    setReturnSupplierPaidAmount,
    returnApplySupplierDebt,
    setReturnApplySupplierDebt,
    resetReturnForm,
    getReturnItemsNetTotal,
    getReturnBillDiscountAmount,
    getReturnSupplierMustPay,
  } = purchaseFormState;

  const {
    showQuickProductForm,
    setShowQuickProductForm,
    quickProductTarget,
    setQuickProductTarget,
    quickProductModalTab,
    setQuickProductModalTab,
    showQuickProductStockSection,
    setShowQuickProductStockSection,
    showQuickProductLocationSection,
    setShowQuickProductLocationSection,
    showQuickProductUnitsSection,
    setShowQuickProductUnitsSection,
    quickProductForm,
    setQuickProductForm,
    resetQuickProductForm,
    showQuickSupplierForm,
    setShowQuickSupplierForm,
    quickSupplierTarget,
    setQuickSupplierTarget,
  } = quickModalsState;

  // Other states
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] =
    React.useState<InventoryTransaction | null>(null);
  const purchaseFileInputRef = React.useRef<HTMLInputElement>(null);
  const returnFileInputRef = React.useRef<HTMLInputElement>(null);

  const findSupplier = (supplierText: string) => {
    const value = supplierText.trim().toLowerCase();
    if (!value) return null;
    return (
      (data.suppliers || []).find(
        supplier =>
          supplier.id.toLowerCase() === value ||
          supplier.name.toLowerCase() === value ||
          supplier.code?.toLowerCase() === value
      ) || null
    );
  };

  const handleViewDetail = (transaction: InventoryTransaction) => {
    setSelectedPurchaseDetail(transaction);
  };

  const getPurchaseLineTotal = (item: InventoryTransaction['items'][number]) => {
    const withPrice = item as typeof item & { price?: number; discount?: number };
    return item.quantity * (withPrice.price || 0) - (withPrice.discount || 0);
  };

  const buildPurchaseExportRows = (purchases: InventoryTransaction[]) =>
    purchases.flatMap(purchase =>
      purchase.items.map(item => {
        const withPrice = item as typeof item & { price?: number; discount?: number };
        return {
          'Mã phiếu': purchase.referenceId || purchase.id,
          'Ngày tạo': new Date(purchase.date).toLocaleString('vi-VN'),
          'Nhà cung cấp': purchase.supplierName || 'NCC vãng lai',
          'Người tạo': purchase.staffId || '',
          'Trạng thái': purchase.status || 'completed',
          SKU: item.sku || '',
          'Tên hàng': item.name || item.productId,
          'Số lượng': item.quantity,
          'Đơn giá': withPrice.price || 0,
          'Giảm giá': withPrice.discount || 0,
          'Thành tiền': getPurchaseLineTotal(item),
          'Ghi chú': purchase.note || '',
        };
      })
    );

  const handleExportPurchases = (purchases: InventoryTransaction[]) => {
    if (purchases.length === 0) {
      showToast('Chưa có phiếu nhập để xuất', 'warning');
      return;
    }
    exportToExcel(buildPurchaseExportRows(purchases), 'Phieu_Nhap_Hang', 'Chi tiết nhập hàng');
  };

  const handleExportReturns = (returns: InventoryTransaction[]) => {
    if (returns.length === 0) {
      showToast('Chưa có phiếu trả hàng nhập để xuất', 'warning');
      return;
    }
    exportToExcel(
      buildPurchaseExportRows(returns),
      'Phieu_Tra_Hang_Nhap',
      'Chi tiết trả hàng nhập'
    );
  };

  const handlePrintPurchase = (transaction: InventoryTransaction) => {
    const isPurchaseReturn = transaction.type === 'PurchaseReturn';
    const title = isPurchaseReturn ? 'Phiếu trả hàng nhập' : 'Phiếu nhập hàng';
    const documentCode = transaction.referenceId || transaction.id;
    const rows = transaction.items
      .map(item => {
        const withPrice = item as typeof item & { price?: number; discount?: number };
        return `<tr>
        <td>${item.sku || ''}</td>
        <td>${item.name || item.productId}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">${(withPrice.price || 0).toLocaleString('vi-VN')}đ</td>
        <td class="text-right">${(withPrice.discount || 0).toLocaleString('vi-VN')}đ</td>
        <td class="text-right">${getPurchaseLineTotal(item).toLocaleString('vi-VN')}đ</td>
      </tr>`;
      })
      .join('');

    printToPDF(
      `${title} ${documentCode}`,
      `<h1>${title} ${documentCode}</h1>
       <p class="subtitle">Ngày tạo: ${new Date(transaction.date).toLocaleString('vi-VN')} | NCC: ${transaction.supplierName || 'NCC vãng lai'} | Người tạo: ${transaction.staffId || ''}</p>
       <table>
        <thead><tr><th>SKU</th><th>Tên hàng</th><th class="text-right">SL</th><th class="text-right">Đơn giá</th><th class="text-right">Giảm</th><th class="text-right">Thành tiền</th></tr></thead>
        <tbody>${rows}</tbody>
       </table>`
    );
  };

  const handleDeletePurchase = async (id: string) => {
    try {
      const transaction = (data.inventoryTransactions || []).find(t => t.id === id);
      if (!transaction) return;

      const products = data.posProducts || [];

      // Cảnh báo nếu tồn kho hiện tại không đủ để hoàn nguyên (đã bán bớt sau khi nhập)
      if (transaction.type === 'Import' && transaction.status === 'completed') {
        const shortfallItems = transaction.items.filter(item => {
          const product = products.find(p => p.id === item.productId);
          return product && product.stock < item.quantity;
        });
        if (shortfallItems.length > 0) {
          const lines = shortfallItems
            .map(item => {
              const currentStock = products.find(p => p.id === item.productId)?.stock ?? 0;
              return `• ${item.name}: tồn ${currentStock}, cần hoàn nguyên ${item.quantity}`;
            })
            .join('\n');
          const confirmed = window.confirm(
            `Cảnh báo: Một số hàng đã được bán sau khi nhập, tồn kho không đủ để hoàn nguyên đầy đủ:\n\n${lines}\n\nXóa phiếu nhập sẽ khiến tồn kho bị sai lệch. Tiếp tục?`
          );
          if (!confirmed) return;
        }
      }

      // Bug I fix: only rollback stock for completed purchases, not drafts or cancelled
      const rollbackProducts =
        transaction.type === 'Import' && transaction.status === 'completed'
          ? products
              .map(product => {
                const item = transaction.items.find(i => i.productId === product.id);
                if (!item) return null;
                return {
                  ...product,
                  stock: Math.max(0, product.stock - item.quantity),
                  // Khôi phục giá vốn trước khi nhập nếu transaction có lưu giá trị này
                  ...(item.previousImportPrice != null
                    ? { importPrice: item.previousImportPrice }
                    : {}),
                };
              })
              .filter((product): product is POSProduct => product !== null)
          : [];

      // Tìm TẤT CẢ debt liên quan: phiếu nhập thủ công dùng UUID, phiếu KiotViet dùng referenceId (PN001072)
      const relatedDebts = (data.supplierDebts || []).filter(
        d =>
          d.description.includes(id) ||
          (transaction.referenceId && d.description.includes(transaction.referenceId))
      );

      if (onUpdateSurgical) {
        await onUpdateSurgical([
          { key: 'inventoryTransactions', item: { id }, isDelete: true },
          ...rollbackProducts.map(product => ({ key: 'posProducts' as const, item: product })),
          ...relatedDebts.map(debt => ({
            key: 'supplierDebts' as const,
            item: { id: debt.id },
            isDelete: true,
          })),
        ]);
      } else {
        if (rollbackProducts.length > 0) {
          const rollbackById = new Map(rollbackProducts.map(product => [product.id, product]));
          await onUpdateData(
            'posProducts',
            products.map(product => rollbackById.get(product.id) || product)
          );
        }
        if (relatedDebts.length > 0) {
          const debtIdsToDelete = new Set(relatedDebts.map(d => d.id));
          await onUpdateData(
            'supplierDebts',
            (data.supplierDebts || []).filter(d => !debtIdsToDelete.has(d.id))
          );
        }
        await onUpdateData(
          'inventoryTransactions',
          (data.inventoryTransactions || []).filter(t => t.id !== id)
        );
      }

      showToast('Đã xóa phiếu nhập hàng', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Delete failed', err);
      showToast('Xóa thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleDeleteReturn = async (id: string) => {
    try {
      const transaction = (data.inventoryTransactions || []).find(t => t.id === id);
      if (!transaction) return;

      const products = data.posProducts || [];
      // Bug I fix: only rollback stock for completed returns, not drafts or cancelled
      const rollbackProducts =
        transaction.type === 'PurchaseReturn' && transaction.status === 'completed'
          ? products
              .map(product => {
                const item = transaction.items.find(i => i.productId === product.id);
                return item ? { ...product, stock: product.stock + item.quantity } : null;
              })
              .filter((product): product is POSProduct => product !== null)
          : [];

      // Bug F fix: find and delete ALL supplier debt/payment records created for this return
      // (a return can create up to 2 records: cashPaymentRecord + debtOffsetRecord)
      const relatedDebts = (data.supplierDebts || []).filter(d => d.description.includes(id));

      if (onUpdateSurgical) {
        await onUpdateSurgical([
          { key: 'inventoryTransactions', item: { id }, isDelete: true },
          ...rollbackProducts.map(product => ({ key: 'posProducts' as const, item: product })),
          ...relatedDebts.map(debt => ({ key: 'supplierDebts' as const, item: { id: debt.id }, isDelete: true })),
        ]);
      } else {
        if (rollbackProducts.length > 0) {
          const rollbackById = new Map(rollbackProducts.map(product => [product.id, product]));
          await onUpdateData(
            'posProducts',
            products.map(product => rollbackById.get(product.id) || product)
          );
        }
        if (relatedDebts.length > 0) {
          const debtIdsToRemove = new Set(relatedDebts.map(d => d.id));
          await onUpdateData(
            'supplierDebts',
            (data.supplierDebts || []).filter(d => !debtIdsToRemove.has(d.id))
          );
        }
        await onUpdateData(
          'inventoryTransactions',
          (data.inventoryTransactions || []).filter(t => t.id !== id)
        );
      }

      showToast('Đã xóa phiếu trả hàng nhập', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Delete return failed', err);
      showToast('Xóa thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleAddProductToPurchase = (product: POSProduct) => {
    setPurchaseItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          quantity: 1,
          price: product.importPrice,
          name: product.name,
          discount: 0,
        },
      ];
    });
  };

  const handleAddProductToReturn = (product: POSProduct) => {
    setReturnItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: Math.min(product.stock, item.quantity + 1) }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          quantity: 1,
          price: product.importPrice,
          name: product.name,
          discount: 0,
        },
      ];
    });
  };

  const handleUpdatePurchaseItem = (
    id: string,
    updates: Partial<{ quantity: number; price: number; discount: number }>
  ) => {
    setPurchaseItems(prev =>
      prev.map(item => (item.productId === id ? { ...item, ...updates } : item))
    );
  };

  const handleRemovePurchaseItem = (id: string) => {
    setPurchaseItems(prev => prev.filter(item => item.productId !== id));
  };

  const handleUpdateReturnItem = (
    id: string,
    updates: Partial<{ quantity: number; price: number; discount: number }>
  ) => {
    setReturnItems(prev =>
      prev.map(item => (item.productId === id ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveReturnItem = (id: string) => {
    setReturnItems(prev => prev.filter(item => item.productId !== id));
  };

  const handleSaveDraft = async () => {
    if (purchaseItems.length === 0) {
      showToast('Vui lòng thêm sản phẩm trước khi lưu tạm', 'warning');
      return;
    }

    const supplier = findSupplier(purchaseSupplier);
    const supplierName = supplier?.name || purchaseSupplier.trim() || 'NCC vãng lai';
    const transaction: InventoryTransaction = {
      id: editingTransactionId || generateId(),
      date: new Date().toISOString(),
      type: 'Import',
      staffId: getCurrentStaffId(),
      supplierId: supplier?.id,
      supplierName,
      referenceId: purchaseReferenceId.trim() || undefined,
      note: purchaseNote || `Phiếu tạm nhập hàng từ ${supplierName}`,
      status: 'draft',
      invoiceStatus,
      totalAmount: Math.max(0, getPurchaseItemsNetTotal() - getPurchaseBillDiscountAmount()),
      items: purchaseItems.map(item => {
        const product = data.posProducts?.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          sku: product?.sku || '',
          name: item.name,
          quantity: item.quantity,
          previousStock: product?.stock || 0,
          newStock: product?.stock || 0,
          price: item.price,
          discount: item.discount,
        };
      }),
    };

    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'inventoryTransactions', item: transaction }]);
      } else {
        await onUpdateData('inventoryTransactions', [
          ...(data.inventoryTransactions || []),
          transaction,
        ]);
      }
      resetPurchaseForm();
      setShowPurchaseForm(false);
      showToast('Đã lưu phiếu nhập tạm', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Save draft failed', err);
      showToast('Lưu phiếu tạm thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleOpenOrder = (transaction: InventoryTransaction) => {
    resetPurchaseForm();
    setEditingTransactionId(transaction.id);
    setEditingTransactionStatus(transaction.status || 'completed');
    setPurchaseSupplier(transaction.supplierId || transaction.supplierName || '');
    if (transaction.referenceId) setPurchaseReferenceId(transaction.referenceId);
    const items: PurchaseItem[] = transaction.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      price: (item as typeof item & { price?: number }).price || 0,
      name: item.name || item.productName || item.productId,
      discount: (item as typeof item & { discount?: number }).discount || 0,
    }));
    setPurchaseItems(items);
    setShowPurchaseForm(true);
  };

  const handleSaveReturnDraft = async () => {
    if (returnItems.length === 0) {
      showToast('Vui lòng thêm sản phẩm trước khi lưu tạm', 'warning');
      return;
    }

    const supplier = findSupplier(returnSupplier);
    const supplierName = supplier?.name || returnSupplier.trim() || 'NCC vãng lai';
    const transaction: InventoryTransaction = {
      id: generateId(),
      date: new Date().toISOString(),
      type: 'PurchaseReturn',
      staffId: getCurrentStaffId(),
      supplierId: supplier?.id,
      supplierName,
      referenceId: returnReferenceId.trim() || undefined,
      note: returnNote || `Phiếu tạm trả hàng nhập cho ${supplierName}`,
      status: 'draft',
      totalAmount: getReturnSupplierMustPay(),
      items: returnItems.map(item => {
        const product = data.posProducts?.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          sku: product?.sku || '',
          name: item.name,
          quantity: item.quantity,
          previousStock: product?.stock || 0,
          newStock: product?.stock || 0,
          price: item.price,
          discount: item.discount,
        };
      }),
    };

    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'inventoryTransactions', item: transaction }]);
      } else {
        await onUpdateData('inventoryTransactions', [
          ...(data.inventoryTransactions || []),
          transaction,
        ]);
      }
      resetReturnForm();
      setShowPurchaseReturnForm(false);
      showToast('Đã lưu phiếu trả hàng nhập tạm', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Save return draft failed', err);
      showToast('Lưu phiếu tạm thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handlePurchaseFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      assertSafeExcelFile(file);
      const buffer = await file.arrayBuffer();
      assertSafeExcelBuffer(buffer, file.name);
      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        dense: true,
        sheetRows: EXCEL_MAX_ROWS,
      });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      const products = data.posProducts || [];
      const nextItems: PurchaseItem[] = [];
      const missing: string[] = [];

      const getCell = (row: Record<string, unknown>, aliases: string[]) => {
        const key = Object.keys(row).find(k =>
          aliases.some(alias => k.trim().toLowerCase() === alias.trim().toLowerCase())
        );
        return key ? row[key] : '';
      };

      rows.forEach(row => {
        const sku = String(getCell(row, ['Mã hàng', 'SKU', 'Product Code']) || '').trim();
        const name = String(getCell(row, ['Tên hàng', 'Tên sản phẩm', 'Name']) || '').trim();
        // Bug H fix: exclude parent products (isParent: true) — they have no SKU/stock
        const product = products.find(
          p => !p.isParent && (p.sku === sku || p.name.toLowerCase() === name.toLowerCase())
        );
        if (!product) {
          if (sku || name) missing.push(sku || name);
          return;
        }

        nextItems.push({
          productId: product.id,
          name: product.name,
          quantity: Math.max(1, Number(getCell(row, ['Số lượng', 'Quantity', 'SL']) || 1)),
          price: Number(
            getCell(row, ['Đơn giá', 'Giá vốn', 'Price', 'Cost']) || product.importPrice || 0
          ),
          discount: Number(getCell(row, ['Giảm giá', 'Discount']) || 0),
        });
      });

      if (nextItems.length === 0) {
        showToast('Không tìm thấy sản phẩm hợp lệ trong file nhập hàng', 'warning');
        return;
      }

      setPurchaseItems(prev => {
        const byProduct = new Map(prev.map(item => [item.productId, item]));
        nextItems.forEach(item => {
          const existing = byProduct.get(item.productId);
          byProduct.set(
            item.productId,
            existing ? { ...existing, quantity: existing.quantity + item.quantity } : item
          );
        });
        return Array.from(byProduct.values());
      });
      const missingNote =
        missing.length > 0
          ? `. Bỏ qua ${missing.length} dòng: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? `... (+${missing.length - 5} dòng)` : ''}`
          : '';
      showToast(
        `Đã nhập ${nextItems.length} dòng từ file${missingNote}`,
        missing.length > 0 ? 'warning' : 'success',
        8000
      );
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Import purchase file failed', err);
      showToast('Import file nhập hàng thất bại. Vui lòng kiểm tra định dạng.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const handleReturnFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      assertSafeExcelFile(file);
      const buffer = await file.arrayBuffer();
      assertSafeExcelBuffer(buffer, file.name);
      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        dense: true,
        sheetRows: EXCEL_MAX_ROWS,
      });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      const products = data.posProducts || [];
      const nextItems: PurchaseItem[] = [];
      const missing: string[] = [];

      const getCell = (row: Record<string, unknown>, aliases: string[]) => {
        const key = Object.keys(row).find(k =>
          aliases.some(alias => k.trim().toLowerCase() === alias.trim().toLowerCase())
        );
        return key ? row[key] : '';
      };

      rows.forEach(row => {
        const sku = String(getCell(row, ['Mã hàng', 'SKU', 'Product Code']) || '').trim();
        const name = String(getCell(row, ['Tên hàng', 'Tên sản phẩm', 'Name']) || '').trim();
        // Bug H fix: exclude parent products (isParent: true) — they have no SKU/stock
        const product = products.find(
          p => !p.isParent && (p.sku === sku || p.name.toLowerCase() === name.toLowerCase())
        );
        if (!product) {
          if (sku || name) missing.push(sku || name);
          return;
        }

        nextItems.push({
          productId: product.id,
          name: product.name,
          quantity: Math.max(1, Number(getCell(row, ['Số lượng', 'Quantity', 'SL']) || 1)),
          price: Number(
            getCell(row, ['Giá nhập', 'Đơn giá', 'Giá vốn', 'Price', 'Cost']) ||
              product.importPrice ||
              0
          ),
          discount: Number(getCell(row, ['Giảm giá', 'Discount']) || 0),
        });
      });

      if (nextItems.length === 0) {
        showToast('Không tìm thấy sản phẩm hợp lệ trong file trả hàng nhập', 'warning');
        return;
      }

      setReturnItems(prev => {
        const byProduct = new Map(prev.map(item => [item.productId, item]));
        nextItems.forEach(item => {
          const existing = byProduct.get(item.productId);
          byProduct.set(
            item.productId,
            existing ? { ...existing, quantity: existing.quantity + item.quantity } : item
          );
        });
        return Array.from(byProduct.values());
      });
      const missingNote =
        missing.length > 0
          ? `. Bỏ qua ${missing.length} dòng: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? `... (+${missing.length - 5} dòng)` : ''}`
          : '';
      showToast(
        `Đã nhập ${nextItems.length} dòng từ file${missingNote}`,
        missing.length > 0 ? 'warning' : 'success',
        8000
      );
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Import purchase return file failed', err);
      showToast('Import file trả hàng nhập thất bại. Vui lòng kiểm tra định dạng.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        'Mã hàng': 'SP000001',
        'Tên hàng': 'Tên sản phẩm mẫu',
        'Số lượng': 10,
        'Đơn giá': 50000,
        'Giảm giá': 0,
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PhieuNhap');
    XLSX.writeFile(workbook, `Mau_Phieu_Nhap_${new Date().toLocaleDateString('sv-SE')}.xlsx`);
  };

  const handleDownloadReturnTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        'Mã hàng': 'SP000001',
        'Tên hàng': 'Tên sản phẩm mẫu',
        'Số lượng': 2,
        'Giá nhập': 50000,
        'Giảm giá': 0,
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PhieuTraHangNhap');
    XLSX.writeFile(
      workbook,
      `Mau_Phieu_Tra_Hang_Nhap_${new Date().toLocaleDateString('sv-SE')}.xlsx`
    );
  };

  const handleQuickAddProduct = (target: 'purchase' | 'return' = 'purchase') => {
    setQuickProductTarget(target);
    resetQuickProductForm();
    setQuickProductModalTab('info');
    setShowQuickProductForm(true);
  };

  const handleSaveQuickProduct = async () => {
    const name = String(quickProductForm.name || '').trim();
    if (!name) {
      showToast('Vui lòng nhập tên sản phẩm', 'warning');
      return false;
    }

    const sku = resolveProductSku(quickProductForm.sku, data.posProducts || []);
    const importPrice = Number(quickProductForm.importPrice || 0);
    const salePrice = Number(quickProductForm.salePrice || importPrice);
    const product: POSProduct = {
      id: generateId(),
      sku,
      name,
      categoryId: String(quickProductForm.categoryId || quickProductForm.categoryPath || '').trim(),
      categoryPath: String(
        quickProductForm.categoryPath || quickProductForm.categoryId || ''
      ).trim(),
      brand: quickProductForm.brand,
      importPrice,
      salePrice,
      stock: Number(quickProductForm.stock || 0),
      minStock: Number(quickProductForm.minStock || 0),
      unit: quickProductForm.unit || 'Cái',
      description: quickProductForm.description,
      barcode: quickProductForm.barcode,
      status: quickProductForm.status || 'Active',
    };

    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'posProducts', item: product }]);
      } else {
        await onUpdateData('posProducts', [...(data.posProducts || []), product]);
      }
      if (quickProductTarget === 'return') {
        handleAddProductToReturn(product);
      } else {
        handleAddProductToPurchase(product);
      }
      setShowQuickProductForm(false);
      resetQuickProductForm();
      showToast(
        quickProductTarget === 'return'
          ? 'Đã thêm nhanh sản phẩm vào phiếu trả hàng nhập'
          : 'Đã thêm nhanh sản phẩm vào phiếu nhập',
        'success'
      );
      return true;
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Save quick product failed', err);
      showToast('Thêm sản phẩm thất bại. Vui lòng thử lại.', 'error');
      return false;
    }
  };

  const handleSaveAndCreateMoreQuickProduct = async () => {
    const saved = await handleSaveQuickProduct();
    if (!saved) return;
    resetQuickProductForm();
    setQuickProductModalTab('info');
    setShowQuickProductForm(true);
  };

  const handleQuickAddSupplier = (target: 'purchase' | 'return' = 'purchase') => {
    setQuickSupplierTarget(target);
    setShowQuickSupplierForm(true);
  };

  const handleSaveQuickSupplier = async (supplierData: Supplier) => {
    const supplier: Supplier = {
      ...supplierData,
      id: generateId(),
      name: supplierData.name.trim(),
      code: supplierData.code || `NCC-${Date.now().toString().slice(-6)}`,
      status: supplierData.status || 'active',
    };

    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'suppliers', item: supplier }]);
      } else {
        await onUpdateData('suppliers', [...(data.suppliers || []), supplier]);
      }
      if (quickSupplierTarget === 'return') {
        setReturnSupplier(supplier.name);
      } else {
        setPurchaseSupplier(supplier.name);
      }
      setShowQuickSupplierForm(false);
      showToast('Đã thêm nhanh nhà cung cấp', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Save quick supplier failed', err);
      showToast('Thêm nhà cung cấp thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleCompletePurchase = async () => {
    try {
      if (purchaseItems.length === 0) {
        showToast('Vui lòng thêm sản phẩm vào phiếu nhập', 'warning');
        return;
      }

      const products = data.posProducts || [];
      const supplier = findSupplier(purchaseSupplier);
      const supplierName = supplier?.name || purchaseSupplier.trim() || 'NCC vãng lai';
      // Ưu tiên costMethod từ Supabase (posInventorySettings), fallback về localStorage
      const costMethod = data.posInventorySettings?.costMethod ?? getInventoryCostMethod();

      // Tính discount toàn đơn để phân bổ vào giá vốn từng dòng
      const itemsNetTotal = Math.max(
        0,
        purchaseItems.reduce((sum, item) => sum + item.quantity * item.price - item.discount, 0)
      );
      const billDiscountAmount = getPurchaseBillDiscountAmount();

      // Nếu đang edit phiếu đã hoàn thành → xoá trước để rollback stock
      const oldTransaction = editingTransactionId
        ? (data.inventoryTransactions || []).find(t => t.id === editingTransactionId) ?? null
        : null;
      if (editingTransactionId && editingTransactionStatus === 'completed') {
        await apiService.deleteInventoryTransactionWithStock(editingTransactionId);
        // Tìm TẤT CẢ debt cũ: nhập tay dùng UUID, KiotViet dùng referenceId (PN001072)
        const oldDebts = (data.supplierDebts || []).filter(d =>
          (d as any).description?.includes(editingTransactionId) ||
          (oldTransaction?.referenceId && (d as any).description?.includes(oldTransaction.referenceId))
        );
        if (oldDebts.length > 0) {
          if (onUpdateSurgical) {
            await onUpdateSurgical(
              oldDebts.map(d => ({ key: 'supplierDebts' as const, item: { id: d.id }, isDelete: true }))
            );
          } else {
            for (const d of oldDebts) {
              await apiService.deleteItem('supplierDebts', d.id);
            }
          }
        }
      }

      // Create inventory transaction
      const transaction: InventoryTransaction = {
        id: editingTransactionId || generateId(),
        date: new Date().toISOString(),
        type: 'Import',
        staffId: getCurrentStaffId(),
        supplierId: supplier?.id,
        supplierName,
        referenceId: purchaseReferenceId.trim() || undefined,
        note: purchaseNote || `Nhập hàng từ ${supplierName}`,
        status: 'completed',
        invoiceStatus,
        totalAmount: Math.max(0, itemsNetTotal - billDiscountAmount),
        items: purchaseItems.map(item => {
          const product = products.find(p => p.id === item.productId);
          const effectiveUnitPrice = calcEffectiveUnitPrice(item, billDiscountAmount, itemsNetTotal);
          const nextImportPrice = product
            ? calculateNextImportPrice(product, item.quantity, effectiveUnitPrice, costMethod)
            : effectiveUnitPrice;
          return {
            productId: item.productId,
            sku: product?.sku || '',
            name: item.name,
            quantity: item.quantity,
            previousStock: product?.stock || 0,
            newStock: (product?.stock || 0) + item.quantity,
            price: item.price,
            discount: item.discount,
            costMethod,
            previousImportPrice: product?.importPrice ?? 0,
            nextImportPrice,
          };
        }),
      };
      const payableAmount = transaction.totalAmount || 0;
      // Chỉ ghi công nợ NCC khi thực sự đã chọn nhà cung cấp từ danh sách (có supplier.id
      // là UUID thật) — không tạo công nợ ảo cho NCC vãng lai/chưa chọn, tránh gửi giá trị
      // không hợp lệ vào cột supplier_debts.supplier_id (kiểu UUID). Xem PURCHASE-NCC-UUID-0819.
      const debtRecord: SupplierDebtRecord | null =
        supplier && payableAmount > 0
          ? {
              id: generateId(),
              supplierId: supplier.id,
              supplierName: supplier.name,
              date: transaction.date,
              type: 'purchase',
              amount: payableAmount,
              description: `Công nợ từ phiếu nhập hàng ${transaction.id}`,
            }
          : null;

      // Update product stock
      const updatedProducts = products.map(product => {
        const purchaseItem = purchaseItems.find(item => item.productId === product.id);
        if (purchaseItem) {
          const effectiveUnitPrice = calcEffectiveUnitPrice(
            purchaseItem,
            billDiscountAmount,
            itemsNetTotal
          );
          return {
            ...product,
            stock: product.stock + purchaseItem.quantity,
            importPrice: calculateNextImportPrice(
              product,
              purchaseItem.quantity,
              effectiveUnitPrice,
              costMethod
            ),
          };
        }
        return product;
      });
      const changedProducts = updatedProducts.filter(product =>
        purchaseItems.some(item => item.productId === product.id)
      );

      try {
        if (onUpdateSurgical) {
          await onUpdateSurgical([
            { key: 'inventoryTransactions', item: transaction },
            ...changedProducts.map(product => ({ key: 'posProducts' as const, item: product })),
            ...(debtRecord ? [{ key: 'supplierDebts' as const, item: debtRecord }] : []),
          ]);
        } else {
          await onPushBatch?.('inventoryTransactions', [transaction]);
          await onUpdateData('posProducts', updatedProducts);
          if (debtRecord) {
            await onUpdateData('supplierDebts', [...(data.supplierDebts || []), debtRecord]);
          }
        }
      } catch (err) {
        // Rollback phiếu mới vừa apply
        if (onUpdateSurgical) {
          await onUpdateSurgical([
            { key: 'inventoryTransactions', item: { id: transaction.id }, isDelete: true },
            ...(debtRecord
              ? [{ key: 'supplierDebts' as const, item: { id: debtRecord.id }, isDelete: true }]
              : []),
            ...purchaseItems
              .map(item => products.find(product => product.id === item.productId))
              .filter((product): product is POSProduct => Boolean(product))
              .map(product => ({ key: 'posProducts' as const, item: product })),
          ]);
        }
        // Khôi phục phiếu cũ nếu đây là thao tác sửa — tránh mất tồn kho
        if (oldTransaction) {
          try {
            await apiService.applyInventoryTransactionWithStock(oldTransaction);
          } catch (restoreErr) {
            console.error('[PurchaseOrdersContainer] Không thể khôi phục phiếu cũ sau lỗi:', restoreErr);
          }
        }
        throw err;
      }

      // Upload invoice file nếu có
      if (invoiceFile) {
        try {
          await uploadPurchaseInvoice(transaction.id, invoiceFile, getCurrentStaffId());
        } catch {
          showToast('Lưu phiếu thành công nhưng upload HĐ thất bại. Vui lòng thử lại.', 'error');
        }
      }

      // Reset form
      resetPurchaseForm();
      setShowPurchaseForm(false);
      showToast('Đã lưu phiếu nhập hàng thành công', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Complete purchase failed', err);
      showToast('Lưu phiếu nhập thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleCompleteReturn = async () => {
    try {
      if (returnItems.length === 0) {
        showToast('Vui lòng thêm sản phẩm vào phiếu trả hàng nhập', 'warning');
        return;
      }

      const products = data.posProducts || [];
      const missingItem = returnItems.find(item => !products.some(p => p.id === item.productId));
      if (missingItem) {
        showToast(`Không tìm thấy sản phẩm "${missingItem.name}" trong kho`, 'error');
        return;
      }

      const returnQtyByProduct = new Map<string, number>();
      for (const item of returnItems) {
        returnQtyByProduct.set(
          item.productId,
          (returnQtyByProduct.get(item.productId) || 0) + item.quantity
        );
      }

      const insufficientItem = returnItems.find(item => {
        const product = products.find(p => p.id === item.productId);
        return product && (returnQtyByProduct.get(item.productId) || 0) > product.stock;
      });
      if (insufficientItem) {
        showToast(`Số lượng trả của "${insufficientItem.name}" lớn hơn tồn hiện tại`, 'warning');
        return;
      }

      const supplier = findSupplier(returnSupplier);
      const supplierName = supplier?.name || returnSupplier.trim() || 'NCC vãng lai';
      const supplierMustPay = getReturnSupplierMustPay();
      const remainingDebt = Math.max(0, supplierMustPay - returnSupplierPaidAmount);
      const runningReturnStock = new Map(products.map(product => [product.id, product.stock || 0]));
      const transaction: InventoryTransaction = {
        id: generateId(),
        date: new Date().toISOString(),
        type: 'PurchaseReturn',
        staffId: getCurrentStaffId(),
        supplierId: supplier?.id,
        supplierName,
        referenceId: returnReferenceId.trim() || undefined,
        note: returnNote || `Trả hàng nhập cho ${supplierName}`,
        status: 'completed',
        totalAmount: supplierMustPay,
        items: returnItems.map(item => {
          const product = products.find(p => p.id === item.productId);
          const previousStock = runningReturnStock.get(item.productId) || 0;
          const newStock = Math.max(0, previousStock - item.quantity);
          runningReturnStock.set(item.productId, newStock);
          return {
            productId: item.productId,
            sku: product?.sku || '',
            name: item.name,
            quantity: item.quantity,
            previousStock,
            newStock,
            price: item.price,
            discount: item.discount,
          };
        }),
      };

      const updatedProducts = products.map(product => {
        const returnQuantity = returnQtyByProduct.get(product.id) || 0;
        if (returnQuantity <= 0) return product;
        return {
          ...product,
          stock: Math.max(0, product.stock - returnQuantity),
        };
      });
      const changedProducts = updatedProducts.filter(product =>
        returnItems.some(item => item.productId === product.id)
      );
      // Chỉ ghi công nợ NCC khi thực sự đã chọn nhà cung cấp từ danh sách — xem
      // PURCHASE-NCC-UUID-0819 (supplier_debts.supplier_id là UUID, không nhận giá trị ảo).
      // Ghi nhận phần NCC trả tiền mặt trực tiếp (nếu có)
      const cashPaymentRecord: SupplierDebtRecord | null =
        supplier && returnSupplierPaidAmount > 0
          ? {
              id: generateId(),
              supplierId: supplier.id,
              supplierName: supplier.name,
              date: new Date().toISOString(),
              type: 'payment',
              amount: returnSupplierPaidAmount,
              description: `NCC thanh toán tiền mặt từ phiếu trả hàng nhập ${transaction.id}`,
            }
          : null;
      // Ghi nhận phần bù trừ vào công nợ cũ (nếu có)
      const debtOffsetRecord: SupplierDebtRecord | null =
        supplier && returnApplySupplierDebt && remainingDebt > 0
          ? {
              id: generateId(),
              supplierId: supplier.id,
              supplierName: supplier.name,
              date: new Date().toISOString(),
              type: 'payment',
              amount: remainingDebt,
              description: `Bù trừ công nợ từ phiếu trả hàng nhập ${transaction.id}`,
            }
          : null;
      const debtUpdates = [
        ...(cashPaymentRecord ? [{ key: 'supplierDebts' as const, item: cashPaymentRecord }] : []),
        ...(debtOffsetRecord ? [{ key: 'supplierDebts' as const, item: debtOffsetRecord }] : []),
      ];

      try {
        if (onUpdateSurgical) {
          await onUpdateSurgical([
            { key: 'inventoryTransactions', item: transaction },
            ...changedProducts.map(product => ({ key: 'posProducts' as const, item: product })),
            ...debtUpdates,
          ]);
        } else {
          await onPushBatch?.('inventoryTransactions', [transaction]);
          await onUpdateData('posProducts', updatedProducts);
          const newDebtItems = [
            ...(cashPaymentRecord ? [cashPaymentRecord] : []),
            ...(debtOffsetRecord ? [debtOffsetRecord] : []),
          ];
          if (newDebtItems.length > 0) {
            await onUpdateData('supplierDebts', [...(data.supplierDebts || []), ...newDebtItems]);
          }
        }
      } catch (err) {
        if (onUpdateSurgical) {
          await onUpdateSurgical([
            { key: 'inventoryTransactions', item: { id: transaction.id }, isDelete: true },
            ...(cashPaymentRecord
              ? [{ key: 'supplierDebts' as const, item: { id: cashPaymentRecord.id }, isDelete: true }]
              : []),
            ...(debtOffsetRecord
              ? [{ key: 'supplierDebts' as const, item: { id: debtOffsetRecord.id }, isDelete: true }]
              : []),
            ...changedProducts.map(product => {
              const original = products.find(p => p.id === product.id);
              return original ? { key: 'posProducts' as const, item: original } : null;
            }).filter((u): u is NonNullable<typeof u> => u !== null),
          ]);
        }
        throw err;
      }

      resetReturnForm();
      setShowPurchaseReturnForm(false);
      showToast('Đã lưu phiếu trả hàng nhập thành công', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Complete purchase return failed', err);
      showToast('Lưu phiếu trả hàng nhập thất bại. Vui lòng thử lại.', 'error');
    }
  };

  if (showPurchaseForm || showPurchaseReturnForm) {
    return (
      <>
        <GoodsCreateProductModal
          isOpen={showQuickProductForm}
          editingProduct={null}
          activeTab={quickProductModalTab}
          setActiveTab={setQuickProductModalTab}
          onClose={() => {
            setShowQuickProductForm(false);
            resetQuickProductForm();
          }}
          onSaveAndCreateMore={handleSaveAndCreateMoreQuickProduct}
          onSave={handleSaveQuickProduct}
        >
          {quickProductModalTab === 'info' && (
            <GoodsCreateProductInfoTab
              products={data.posProducts || []}
              productGroups={data.productGroups || []}
              editingProduct={null}
              formData={quickProductForm}
              setFormData={setQuickProductForm}
              showStockSection={showQuickProductStockSection}
              setShowStockSection={setShowQuickProductStockSection}
              showLocationSection={showQuickProductLocationSection}
              setShowLocationSection={setShowQuickProductLocationSection}
              showUnitsSection={showQuickProductUnitsSection}
              setShowUnitsSection={setShowQuickProductUnitsSection}
              addBaseUnit={() =>
                showToast('Vui lòng thêm đơn vị tính sau khi tạo hàng hóa.', 'warning')
              }
            />
          )}
          {quickProductModalTab === 'desc' && (
            <GoodsCreateProductTextTab
              formData={quickProductForm}
              setFormData={setQuickProductForm}
              field="description"
              label="Mô tả chi tiết"
              placeholder="Nhập mô tả sản phẩm..."
            />
          )}
          {quickProductModalTab === 'warranty' && (
            <GoodsCreateProductTextTab
              formData={quickProductForm}
              setFormData={setQuickProductForm}
              field="warranty"
              label="Thông tin bảo hành, bảo trì"
              placeholder="Nhập thông tin bảo hành..."
            />
          )}
        </GoodsCreateProductModal>
        {showQuickSupplierForm && (
          <SupplierForm
            supplier={null}
            onSave={handleSaveQuickSupplier}
            onCancel={() => setShowQuickSupplierForm(false)}
          />
        )}
        <input
          ref={purchaseFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handlePurchaseFileImport}
        />
        <input
          ref={returnFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleReturnFileImport}
        />
        {showPurchaseForm && (
          <GoodsPurchaseForm
            showPurchaseForm={showPurchaseForm}
            setShowPurchaseForm={setShowPurchaseForm}
            purchaseItems={purchaseItems}
            purchaseSupplier={purchaseSupplier}
            setPurchaseSupplier={setPurchaseSupplier}
            purchaseNote={purchaseNote}
            setPurchaseNote={setPurchaseNote}
            purchaseDiscountValue={purchaseDiscountValue}
            purchaseDiscountType={purchaseDiscountType}
            setPurchaseDiscountValue={setPurchaseDiscountValue}
            setPurchaseDiscountType={setPurchaseDiscountType}
            products={data.posProducts || []}
            suppliers={data.suppliers || []}
            transactions={data.inventoryTransactions || []}
            onClickFileInput={() => purchaseFileInputRef.current?.click()}
            onOpenQuickAddProduct={() => handleQuickAddProduct('purchase')}
            onOpenQuickAddSupplier={() => handleQuickAddSupplier('purchase')}
            onAddProductToPurchase={handleAddProductToPurchase}
            onUpdatePurchaseItem={handleUpdatePurchaseItem}
            onRemovePurchaseItem={handleRemovePurchaseItem}
            purchaseReferenceId={purchaseReferenceId}
            setPurchaseReferenceId={setPurchaseReferenceId}
            onCompletePurchase={handleCompletePurchase}
            onSaveDraft={handleSaveDraft}
            onDownloadTemplate={handleDownloadTemplate}
            staffLabel={getCurrentStaffId()}
            invoiceStatus={invoiceStatus}
            setInvoiceStatus={setInvoiceStatus}
            invoiceFile={invoiceFile}
            setInvoiceFile={setInvoiceFile}
          />
        )}
        {showPurchaseReturnForm && (
          <GoodsPurchaseReturnForm
            showReturnForm={showPurchaseReturnForm}
            setShowReturnForm={setShowPurchaseReturnForm}
            returnItems={returnItems}
            returnSupplier={returnSupplier}
            setReturnSupplier={setReturnSupplier}
            returnNote={returnNote}
            setReturnNote={setReturnNote}
            returnDiscountValue={returnDiscountValue}
            returnDiscountType={returnDiscountType}
            setReturnDiscountValue={setReturnDiscountValue}
            setReturnDiscountType={setReturnDiscountType}
            supplierPaidAmount={returnSupplierPaidAmount}
            setSupplierPaidAmount={setReturnSupplierPaidAmount}
            applySupplierDebt={returnApplySupplierDebt}
            setApplySupplierDebt={setReturnApplySupplierDebt}
            products={data.posProducts || []}
            suppliers={data.suppliers || []}
            transactions={data.inventoryTransactions || []}
            onClickFileInput={() => returnFileInputRef.current?.click()}
            onOpenQuickAddProduct={() => handleQuickAddProduct('return')}
            onOpenQuickAddSupplier={() => handleQuickAddSupplier('return')}
            returnReferenceId={returnReferenceId}
            setReturnReferenceId={setReturnReferenceId}
            onAddProductToReturn={handleAddProductToReturn}
            onUpdateReturnItem={handleUpdateReturnItem}
            onRemoveReturnItem={handleRemoveReturnItem}
            onCompleteReturn={handleCompleteReturn}
            onSaveDraft={handleSaveReturnDraft}
            onDownloadTemplate={handleDownloadReturnTemplate}
            staffLabel={getCurrentStaffId()}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        {activePurchaseView === 'imports' ? (
          <PurchaseOrdersPage
            transactions={data.inventoryTransactions || []}
            suppliers={data.suppliers || []}
            onCreatePurchase={() => setShowPurchaseForm(true)}
            onDeletePurchase={handleDeletePurchase}
            onExportPurchases={handleExportPurchases}
            onPrintPurchase={handlePrintPurchase}
            onOpenOrder={handleOpenOrder}
            onRefreshData={onRefreshData}
          />
        ) : (
          <PurchaseReturnsPage
            transactions={data.inventoryTransactions || []}
            suppliers={data.suppliers || []}
            onCreateReturn={() => setShowPurchaseReturnForm(true)}
            onViewDetail={handleViewDetail}
            onDeleteReturn={handleDeleteReturn}
            onExportReturns={handleExportReturns}
          />
        )}
      </div>
      {selectedPurchaseDetail && selectedPurchaseDetail.type === 'PurchaseReturn' && (
        <PurchaseOrderDetailModal
          transaction={selectedPurchaseDetail}
          onClose={() => setSelectedPurchaseDetail(null)}
          onExport={handleExportReturns}
          onPrint={handlePrintPurchase}
        />
      )}
    </div>
  );
};

export default PurchaseOrdersContainer;
