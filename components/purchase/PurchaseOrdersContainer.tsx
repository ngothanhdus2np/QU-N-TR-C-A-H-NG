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
import { InventoryTransaction, POSProduct, AppData, AppDataSurgicalUpdate, Supplier, SupplierDebtRecord } from '../../types';
import {
  AUTO_SKU_PLACEHOLDER,
  calculateNextImportPrice,
  generateId,
  getInventoryCostMethod,
  resolveProductSku,
} from '../../src/lib';
import { useToast } from '../ui/Toast';
import { getCurrentStaffId } from '../shared/staff';
import { exportToExcel, printToPDF } from '../../services/exportService';
import { usePurchaseFormState } from '../../hooks/usePurchaseFormState';
import { usePurchaseQuickModals } from '../../hooks/usePurchaseQuickModals';

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
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = React.useState<InventoryTransaction | null>(null);
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

  const buildPurchaseExportRows = (purchases: InventoryTransaction[]) => (
    purchases.flatMap(purchase => purchase.items.map(item => {
      const withPrice = item as typeof item & { price?: number; discount?: number };
      return {
        'Mã phiếu': purchase.id,
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
    }))
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
    exportToExcel(buildPurchaseExportRows(returns), 'Phieu_Tra_Hang_Nhap', 'Chi tiết trả hàng nhập');
  };

  const handlePrintPurchase = (transaction: InventoryTransaction) => {
    const isPurchaseReturn = transaction.type === 'PurchaseReturn';
    const title = isPurchaseReturn ? 'Phiếu trả hàng nhập' : 'Phiếu nhập hàng';
    const rows = transaction.items.map(item => {
      const withPrice = item as typeof item & { price?: number; discount?: number };
      return `<tr>
        <td>${item.sku || ''}</td>
        <td>${item.name || item.productId}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">${(withPrice.price || 0).toLocaleString('vi-VN')}đ</td>
        <td class="text-right">${(withPrice.discount || 0).toLocaleString('vi-VN')}đ</td>
        <td class="text-right">${getPurchaseLineTotal(item).toLocaleString('vi-VN')}đ</td>
      </tr>`;
    }).join('');

    printToPDF(
      `${title} ${transaction.id}`,
      `<h1>${title} ${transaction.id}</h1>
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
      const rollbackProducts =
        transaction.type === 'Import' && transaction.status !== 'cancelled'
          ? products
              .map(product => {
                const item = transaction.items.find(i => i.productId === product.id);
                return item
                  ? { ...product, stock: Math.max(0, product.stock - item.quantity) }
                  : null;
              })
              .filter((product): product is POSProduct => product !== null)
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
      const rollbackProducts =
        transaction.type === 'PurchaseReturn' && transaction.status !== 'cancelled'
          ? products
              .map(product => {
                const item = transaction.items.find(i => i.productId === product.id);
                return item ? { ...product, stock: product.stock + item.quantity } : null;
              })
              .filter((product): product is POSProduct => product !== null)
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
      id: generateId(),
      date: new Date().toISOString(),
      type: 'Import',
      staffId: getCurrentStaffId(),
      supplierId: supplier?.id,
      supplierName,
      note: purchaseNote || `Phiếu tạm nhập hàng từ ${supplierName}`,
      status: 'draft',
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
  };

  const handlePurchaseFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
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
        const product = products.find(p => p.sku === sku || p.name.toLowerCase() === name.toLowerCase());
        if (!product) {
          if (sku || name) missing.push(sku || name);
          return;
        }

        nextItems.push({
          productId: product.id,
          name: product.name,
          quantity: Math.max(1, Number(getCell(row, ['Số lượng', 'Quantity', 'SL']) || 1)),
          price: Number(getCell(row, ['Đơn giá', 'Giá vốn', 'Price', 'Cost']) || product.importPrice || 0),
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
      showToast(
        `Đã nhập ${nextItems.length} dòng từ file${missing.length > 0 ? `, bỏ qua ${missing.length} dòng không khớp SKU` : ''}`,
        missing.length > 0 ? 'warning' : 'success',
        6000
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
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
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
        const product = products.find(p => p.sku === sku || p.name.toLowerCase() === name.toLowerCase());
        if (!product) {
          if (sku || name) missing.push(sku || name);
          return;
        }

        nextItems.push({
          productId: product.id,
          name: product.name,
          quantity: Math.max(1, Number(getCell(row, ['Số lượng', 'Quantity', 'SL']) || 1)),
          price: Number(getCell(row, ['Giá nhập', 'Đơn giá', 'Giá vốn', 'Price', 'Cost']) || product.importPrice || 0),
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
      showToast(
        `Đã nhập ${nextItems.length} dòng từ file${missing.length > 0 ? `, bỏ qua ${missing.length} dòng không khớp SKU` : ''}`,
        missing.length > 0 ? 'warning' : 'success',
        6000
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
    XLSX.writeFile(workbook, `Mau_Phieu_Tra_Hang_Nhap_${new Date().toLocaleDateString('sv-SE')}.xlsx`);
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
      categoryPath: String(quickProductForm.categoryPath || quickProductForm.categoryId || '').trim(),
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
      const costMethod = getInventoryCostMethod();

      // Create inventory transaction
      const transaction: InventoryTransaction = {
        id: generateId(),
        date: new Date().toISOString(),
        type: 'Import',
        staffId: getCurrentStaffId(),
        supplierId: supplier?.id,
        supplierName,
        note: purchaseNote || `Nhập hàng từ ${supplierName}`,
        status: 'completed',
        totalAmount: Math.max(0, getPurchaseItemsNetTotal() - getPurchaseBillDiscountAmount()),
        items: purchaseItems.map(item => {
          const product = products.find(p => p.id === item.productId);
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
          };
        }),
      };

      // Update product stock
      const updatedProducts = products.map(product => {
        const purchaseItem = purchaseItems.find(item => item.productId === product.id);
        if (purchaseItem) {
          return {
            ...product,
            stock: product.stock + purchaseItem.quantity,
            importPrice: calculateNextImportPrice(
              product,
              purchaseItem.quantity,
              purchaseItem.price,
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
          ]);
        } else {
          await onPushBatch?.('inventoryTransactions', [transaction]);
          await onUpdateData('posProducts', updatedProducts);
        }
      } catch (err) {
        if (onUpdateSurgical) {
          await onUpdateSurgical([
            { key: 'inventoryTransactions', item: { id: transaction.id }, isDelete: true },
            ...purchaseItems
              .map(item => products.find(product => product.id === item.productId))
              .filter((product): product is POSProduct => Boolean(product))
              .map(product => ({ key: 'posProducts' as const, item: product })),
          ]);
        }
        throw err;
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
      const insufficientItem = returnItems.find(item => {
        const product = products.find(p => p.id === item.productId);
        return product && item.quantity > product.stock;
      });
      if (insufficientItem) {
        showToast(`Số lượng trả của "${insufficientItem.name}" lớn hơn tồn hiện tại`, 'warning');
        return;
      }

      const supplier = findSupplier(returnSupplier);
      const supplierName = supplier?.name || returnSupplier.trim() || 'NCC vãng lai';
      const supplierMustPay = getReturnSupplierMustPay();
      const remainingDebt = Math.max(0, supplierMustPay - returnSupplierPaidAmount);
      const transaction: InventoryTransaction = {
        id: generateId(),
        date: new Date().toISOString(),
        type: 'PurchaseReturn',
        staffId: getCurrentStaffId(),
        supplierId: supplier?.id,
        supplierName,
        note: returnNote || `Trả hàng nhập cho ${supplierName}`,
        status: 'completed',
        totalAmount: supplierMustPay,
        items: returnItems.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            sku: product?.sku || '',
            name: item.name,
            quantity: item.quantity,
            previousStock: product?.stock || 0,
            newStock: Math.max(0, (product?.stock || 0) - item.quantity),
            price: item.price,
            discount: item.discount,
          };
        }),
      };

      const updatedProducts = products.map(product => {
        const returnItem = returnItems.find(item => item.productId === product.id);
        if (!returnItem) return product;
        return {
          ...product,
          stock: Math.max(0, product.stock - returnItem.quantity),
        };
      });
      const changedProducts = updatedProducts.filter(product =>
        returnItems.some(item => item.productId === product.id)
      );
      const debtRecord: SupplierDebtRecord | null =
        supplier && returnApplySupplierDebt && remainingDebt > 0
          ? {
              id: generateId(),
              supplierId: supplier.id,
              supplierName,
              date: new Date().toISOString(),
              type: 'payment',
              amount: remainingDebt,
              description: `Bù trừ công nợ từ phiếu trả hàng nhập ${transaction.id}`,
            }
          : null;

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
              addBaseUnit={() => showToast('Vui lòng thêm đơn vị tính sau khi tạo hàng hóa.', 'warning')}
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
            transactions={data.inventoryTransactions || []}
            onClickFileInput={() => purchaseFileInputRef.current?.click()}
            onOpenQuickAddProduct={() => handleQuickAddProduct('purchase')}
            onOpenQuickAddSupplier={() => handleQuickAddSupplier('purchase')}
            onAddProductToPurchase={handleAddProductToPurchase}
            onUpdatePurchaseItem={handleUpdatePurchaseItem}
            onRemovePurchaseItem={handleRemovePurchaseItem}
            onCompletePurchase={handleCompletePurchase}
            onSaveDraft={handleSaveDraft}
            onDownloadTemplate={handleDownloadTemplate}
            staffLabel={getCurrentStaffId()}
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
            transactions={data.inventoryTransactions || []}
            onClickFileInput={() => returnFileInputRef.current?.click()}
            onOpenQuickAddProduct={() => handleQuickAddProduct('return')}
            onOpenQuickAddSupplier={() => handleQuickAddSupplier('return')}
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
            onViewDetail={handleViewDetail}
            onDeletePurchase={handleDeletePurchase}
            onExportPurchases={handleExportPurchases}
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
      {selectedPurchaseDetail && (
        <PurchaseOrderDetailModal
          transaction={selectedPurchaseDetail}
          onClose={() => setSelectedPurchaseDetail(null)}
          onExport={selectedPurchaseDetail.type === 'PurchaseReturn' ? handleExportReturns : handleExportPurchases}
          onPrint={handlePrintPurchase}
        />
      )}
    </div>
  );
};

export default PurchaseOrdersContainer;
