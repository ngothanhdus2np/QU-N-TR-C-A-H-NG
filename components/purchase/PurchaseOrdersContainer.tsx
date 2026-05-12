import React from 'react';
import * as XLSX from 'xlsx';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import { GoodsPurchaseForm, PurchaseItem } from '../pos/GoodsPurchaseForm';
import { InventoryTransaction, POSProduct, AppData, AppDataSurgicalUpdate, Supplier } from '../../types';
import { generateId } from '../../businessLogic';
import { useToast } from '../ui/Toast';
import { getCurrentStaffId } from '../shared/staff';

interface PurchaseOrdersContainerProps {
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
 * Container for Purchase Orders management
 * Toggles between list view and create form
 */
const PurchaseOrdersContainer: React.FC<PurchaseOrdersContainerProps> = ({
  data,
  onUpdateData,
  onUpdateSurgical,
  onPushBatch,
}) => {
  const { showToast } = useToast();
  const [showPurchaseForm, setShowPurchaseForm] = React.useState(false);
  const [purchaseItems, setPurchaseItems] = React.useState<PurchaseItem[]>([]);
  const [purchaseSupplier, setPurchaseSupplier] = React.useState('');
  const [purchaseNote, setPurchaseNote] = React.useState('');
  const purchaseFileInputRef = React.useRef<HTMLInputElement>(null);

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
    // TODO: Open detail modal instead of alert
    showToast(
      `Chi tiết: ${transaction.id} | NCC: ${transaction.supplierName || 'N/A'} | Tổng: ${transaction.totalAmount?.toLocaleString() || 'N/A'}đ`,
      'info',
      6000
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
      totalAmount: purchaseItems.reduce((sum, item) => sum + item.quantity * item.price - item.discount, 0),
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
    setPurchaseItems([]);
    setPurchaseSupplier('');
    setPurchaseNote('');
    setShowPurchaseForm(false);
    showToast('Đã lưu phiếu nhập tạm', 'success');
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

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        'Mã hàng': 'SKU001',
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

  const handleQuickAddProduct = async () => {
    const name = window.prompt('Tên sản phẩm mới');
    if (!name?.trim()) return;
    const sku = window.prompt('Mã hàng/SKU')?.trim() || `HH-${Date.now().toString().slice(-6)}`;
    const importPrice = Number(window.prompt('Giá vốn', '0') || 0);
    const salePrice = Number(window.prompt('Giá bán', String(importPrice)) || importPrice);
    const product: POSProduct = {
      id: generateId(),
      sku,
      name: name.trim(),
      categoryId: 'default',
      importPrice,
      salePrice,
      stock: 0,
      minStock: 0,
      unit: 'Cái',
      status: 'Active',
    };

    if (onUpdateSurgical) {
      await onUpdateSurgical([{ key: 'posProducts', item: product }]);
    } else {
      await onUpdateData('posProducts', [...(data.posProducts || []), product]);
    }
    handleAddProductToPurchase(product);
    showToast('Đã thêm nhanh sản phẩm vào phiếu nhập', 'success');
  };

  const handleQuickAddSupplier = async () => {
    const name = window.prompt('Tên nhà cung cấp mới');
    if (!name?.trim()) return;
    const supplier: Supplier = {
      id: generateId(),
      name: name.trim(),
      code: `NCC-${Date.now().toString().slice(-6)}`,
      status: 'active',
    };

    if (onUpdateSurgical) {
      await onUpdateSurgical([{ key: 'suppliers', item: supplier }]);
    } else {
      await onUpdateData('suppliers', [...(data.suppliers || []), supplier]);
    }
    setPurchaseSupplier(supplier.name);
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
        totalAmount: purchaseItems.reduce(
          (sum, item) => sum + item.quantity * item.price - item.discount,
          0
        ),
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
          };
        }),
      };

      // Update product stock
      const updatedProducts = products.map(product => {
        const purchaseItem = purchaseItems.find(item => item.productId === product.id);
        if (purchaseItem) {
          return { ...product, stock: product.stock + purchaseItem.quantity };
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
      setPurchaseItems([]);
      setPurchaseSupplier('');
      setPurchaseNote('');
      setShowPurchaseForm(false);
      showToast('Đã lưu phiếu nhập hàng thành công', 'success');
    } catch (err) {
      console.error('[PurchaseOrdersContainer] Complete purchase failed', err);
      showToast('Lưu phiếu nhập thất bại. Vui lòng thử lại.', 'error');
    }
  };

  if (showPurchaseForm) {
    return (
      <>
        <input
          ref={purchaseFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handlePurchaseFileImport}
        />
        <GoodsPurchaseForm
          showPurchaseForm={showPurchaseForm}
          setShowPurchaseForm={setShowPurchaseForm}
          purchaseItems={purchaseItems}
          purchaseSupplier={purchaseSupplier}
          setPurchaseSupplier={setPurchaseSupplier}
          purchaseNote={purchaseNote}
          setPurchaseNote={setPurchaseNote}
          products={data.posProducts || []}
          transactions={data.inventoryTransactions || []}
          onClickFileInput={() => purchaseFileInputRef.current?.click()}
          onOpenQuickAddProduct={handleQuickAddProduct}
          onOpenQuickAddSupplier={handleQuickAddSupplier}
          onAddProductToPurchase={handleAddProductToPurchase}
          onUpdatePurchaseItem={handleUpdatePurchaseItem}
          onRemovePurchaseItem={handleRemovePurchaseItem}
          onCompletePurchase={handleCompletePurchase}
          onSaveDraft={handleSaveDraft}
          onDownloadTemplate={handleDownloadTemplate}
          staffLabel={getCurrentStaffId()}
        />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <PurchaseOrdersPage
          transactions={data.inventoryTransactions || []}
          suppliers={data.suppliers || []}
          onCreatePurchase={() => setShowPurchaseForm(true)}
          onViewDetail={handleViewDetail}
          onDeletePurchase={handleDeletePurchase}
        />
      </div>
    </div>
  );
};

export default PurchaseOrdersContainer;
