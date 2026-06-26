import React, { useState } from 'react';
import AuditDetailModal from '../audit/AuditDetailModal';
import AuditListPage from '../audit/AuditListPage';
import { AuditItem, GoodsAuditForm } from '../pos/GoodsAuditForm';
import { AppData, AppDataSurgicalUpdate, InventoryTransaction } from '../../types';
import { generateId } from '../../src/lib';
import { exportToExcel, printToPDF } from '../../services/exportService';
import { getCurrentStaffId } from '../shared/staff';
import { useToast } from '../ui/Toast';

interface GoodsDisposalProps {
  products: AppData['posProducts'];
  data: AppData;
  onUpdateSurgical: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
}

export default function GoodsDisposal({ products, data, onUpdateSurgical }: GoodsDisposalProps) {
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<InventoryTransaction | null>(null);

  const transactions = data.inventoryTransactions || [];
  const productGroups = data.productGroups || [];
  const lowStockProducts = products.filter(
    product => product.status === 'Active' && product.stock <= product.minStock && product.stock > 0
  );

  const buildExportRows = (rows: InventoryTransaction[]) =>
    rows.flatMap(transaction =>
      transaction.items.map(item => ({
        'Mã phiếu': transaction.id,
        'Ngày tạo': new Date(transaction.date).toLocaleString('vi-VN'),
        'Người tạo': transaction.staffId || '',
        'Trạng thái': transaction.status || 'completed',
        SKU: item.sku || '',
        'Tên hàng': item.name || item.productName || item.productId,
        'Tồn trước': item.previousStock || 0,
        'SL lỗi/hư': Math.abs(item.quantity || 0),
        'Tồn sau trừ': item.newStock || 0,
        'Giá trị': Math.abs((item.quantity || 0) * (item.price || 0)),
        'Ghi chú dòng': item.note || '',
        'Ghi chú phiếu': transaction.note || '',
      }))
    );

  const handleExport = (rows: InventoryTransaction[]) => {
    if (rows.length === 0) {
      showToast('Chưa có phiếu trừ hàng lỗi/hư để xuất', 'warning');
      return;
    }
    exportToExcel(buildExportRows(rows), 'Phieu_Tru_Hang_Loi_Hu', 'Chi tiết trừ hàng lỗi/hư');
  };

  const handlePrint = (transaction: InventoryTransaction) => {
    const rows = transaction.items
      .map(item => `<tr>
        <td>${item.sku || ''}</td>
        <td>${item.name || item.productName || item.productId}</td>
        <td class="text-right">${item.previousStock || 0}</td>
        <td class="text-right">${Math.abs(item.quantity || 0)}</td>
        <td class="text-right">${item.newStock || 0}</td>
      </tr>`)
      .join('');

    printToPDF(
      `Phiếu trừ hàng lỗi/hư ${transaction.id}`,
      `<h1>Phiếu trừ hàng lỗi/hư ${transaction.id}</h1>
       <p class="subtitle">Ngày tạo: ${new Date(transaction.date).toLocaleString('vi-VN')} | Người tạo: ${transaction.staffId || ''}</p>
       <table>
        <thead><tr><th>SKU</th><th>Tên hàng</th><th class="text-right">Tồn trước</th><th class="text-right">SL lỗi/hư</th><th class="text-right">Tồn sau</th></tr></thead>
        <tbody>${rows}</tbody>
       </table>`
    );
  };

  const handleDelete = async (id: string) => {
    try {
      const transaction = transactions.find(item => item.id === id);
      if (!transaction) return;

      const rollbackProducts =
        transaction.status !== 'cancelled'
          ? products
              .map(product => {
                const item = transaction.items.find(row => row.productId === product.id);
                if (!item) return null;
                return {
                  ...product,
                  stock:
                    item.previousStock ??
                    (product.stock || 0) + Math.abs(item.quantity || 0),
                };
              })
              .filter((product): product is (typeof products)[number] => product !== null)
          : [];

      await onUpdateSurgical([
        { key: 'inventoryTransactions', item: { id }, isDelete: true },
        ...rollbackProducts.map(product => ({ key: 'posProducts' as const, item: product })),
      ]);

      showToast('Đã xóa phiếu trừ hàng lỗi/hư', 'success');
    } catch (err) {
      console.error('[GoodsDisposal] Delete failed', err);
      showToast('Xóa phiếu trừ hàng lỗi/hư thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleConfirm = async (note?: string) => {
    try {
      if (items.length === 0) {
        showToast('Vui lòng thêm sản phẩm vào phiếu trừ hàng lỗi/hư', 'warning');
        return;
      }

      const now = new Date().toISOString();
      let totalActualQty = 0;
      let totalDiff = 0;
      let decreaseCount = 0;
      let totalAmount = 0;

      const transactionItems = items.map(item => {
        const product = products.find(row => row.id === item.productId);
        const diff = item.actualStock - item.currentStock;
        const price = product?.importPrice || 0;

        totalActualQty += item.actualStock;
        totalDiff += diff;
        totalAmount += Math.abs(diff) * price;
        if (diff < 0) decreaseCount++;

        return {
          productId: item.productId,
          sku: product?.sku || '',
          name: product?.name || item.productId,
          productName: product?.name || item.productId,
          quantity: diff,
          previousStock: item.currentStock,
          newStock: item.actualStock,
          price,
          note: item.note || 'Hàng lỗi/hư',
        };
      });

      const transaction: InventoryTransaction = {
        id: generateId(),
        date: now,
        type: 'disposal',
        staffId: getCurrentStaffId(),
        status: 'completed',
        balancedDate: now,
        totalActualQty,
        totalDiff,
        increaseCount: 0,
        decreaseCount,
        totalAmount,
        note: note?.trim() || `Trừ hàng lỗi/hư ngày ${new Date().toLocaleDateString('vi-VN')}`,
        items: transactionItems,
      };

      const changedProducts = products
        .map(product => {
          const formItem = items.find(item => item.productId === product.id);
          return formItem ? { ...product, stock: formItem.actualStock } : null;
        })
        .filter((product): product is (typeof products)[number] => product !== null);

      try {
        await onUpdateSurgical([
          { key: 'inventoryTransactions', item: transaction },
          ...changedProducts.map(product => ({ key: 'posProducts' as const, item: product })),
        ]);
      } catch (err) {
        await onUpdateSurgical([
          { key: 'inventoryTransactions', item: { id: transaction.id }, isDelete: true },
          ...items
            .map(item => products.find(product => product.id === item.productId))
            .filter((product): product is (typeof products)[number] => Boolean(product))
            .map(product => ({ key: 'posProducts' as const, item: product })),
        ]);
        throw err;
      }

      setItems([]);
      setSearchTerm('');
      setShowForm(false);
      showToast('Đã lưu phiếu trừ hàng lỗi/hư thành công', 'success');
    } catch (err) {
      console.error('[GoodsDisposal] Confirm failed', err);
      showToast('Lưu phiếu trừ hàng lỗi/hư thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleCancel = () => {
    if (items.length > 0 && !confirm('Bạn có chắc muốn hủy phiếu trừ hàng lỗi/hư? Dữ liệu đã nhập sẽ bị mất.')) {
      return;
    }
    setItems([]);
    setSearchTerm('');
    setShowForm(false);
  };

  if (showForm) {
    return (
      <GoodsAuditForm
        products={products}
        lowStockProducts={lowStockProducts}
        transactions={transactions}
        productGroups={productGroups}
        auditItems={items}
        setAuditItems={setItems}
        auditSearchTerm={searchTerm}
        setAuditSearchTerm={setSearchTerm}
        auditMode="damaged"
        recentTransactionType="disposal"
        labels={{
          title: 'Phiếu trừ hàng lỗi/hư',
          actorLabel: 'Người xử lý',
          codeLabel: 'Mã phiếu',
          actualTotalLabel: 'Tổng SL sau trừ',
          diffTotalLabel: 'Tổng SL trừ',
          valueDiffLabel: 'Giá trị trừ',
          recentTitle: 'Phiếu trừ gần đây',
          recentEmpty: 'Chưa có phiếu trừ hàng lỗi/hư gần đây',
          notePlaceholder: 'Ghi chú phiếu trừ',
          emptyTitle: 'Thêm sản phẩm lỗi/hư vào phiếu',
        }}
        onConfirmAudit={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <AuditListPage
          transactions={transactions}
          onCreateAudit={() => setShowForm(true)}
          onViewDetail={setSelectedDetail}
          onDeleteAudit={handleDelete}
          onExportAudits={handleExport}
          config={{
            transactionType: 'disposal',
            sidebarTitle: 'Trừ hàng lỗi/hư',
            sidebarDescription: 'Xử lý hàng lỗi, hư hỏng, hết hạn',
            searchPlaceholder: 'Tìm mã phiếu trừ hàng lỗi/hư...',
            createButtonLabel: 'Phiếu trừ hàng lỗi/hư',
            bulkDeleteConfirmLabel: 'phiếu trừ hàng lỗi/hư',
            codeColumnLabel: 'Mã phiếu',
            balancedDateColumnLabel: 'Ngày hoàn thành',
            actualQtyColumnLabel: 'SL sau trừ',
            diffColumnLabel: 'Tổng SL trừ',
            increaseColumnLabel: 'SL tăng',
            decreaseColumnLabel: 'SL lỗi/hư',
            emptyTitle: 'Chưa có phiếu trừ hàng lỗi/hư',
            emptyDescription: 'Bấm nút "Phiếu trừ hàng lỗi/hư" để tạo phiếu mới',
            showInfoButton: false,
          }}
        />
      </div>
      {selectedDetail && (
        <AuditDetailModal
          transaction={selectedDetail}
          onClose={() => setSelectedDetail(null)}
          onExport={handleExport}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
}
