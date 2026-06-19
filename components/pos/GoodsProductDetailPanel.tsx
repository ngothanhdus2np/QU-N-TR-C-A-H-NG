import React from 'react';
import {
  Edit2,
  FileText,
  Image as ImageIcon,
  Menu,
  Package,
  PackagePlus,
  Printer,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { InventoryTransaction, POSOrder, POSProduct } from '../../types';
import { GoodsChannelLinksTab } from './GoodsChannelLinksTab';

export type DetailTab = 'info' | 'desc' | 'warranty' | 'units' | 'channels';

interface GoodsProductDetailPanelProps {
  product: POSProduct;
  transactions?: InventoryTransaction[];
  orders?: POSOrder[];
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onDelete: () => void;
  onEdit: () => void;
  onClose: () => void;
  deleteConfirmText: string;
  noBorder?: boolean;
  showSupplierActions?: boolean;
  showCopyPrintActions?: boolean;
  onAddUnit?: () => void;
  onAddAttribute?: () => void;
  onPrintLabel?: (product: POSProduct) => void;
  onAddSameType?: (product: POSProduct) => void;
  onPurchaseProduct?: (product: POSProduct) => void;
  onStopBusiness?: (product: POSProduct) => void;
}

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'desc', label: 'Mô tả, ghi chú' },
  { id: 'warranty', label: 'Thẻ kho' },
  { id: 'units', label: 'Tồn kho' },
  { id: 'channels', label: 'Liên kết kênh bán' }
];

type StockCardRow = {
  id: string;
  documentCode: string;
  date: string;
  transactionType: InventoryTransaction['type'];
  transactionLabel: string;
  partner: string;
  transactionPrice: number | null;
  costPrice: number | null;
  quantityChange: number;
  endingStock: number;
  lineAmount: number | null;
  invoiceStatus: string;
  note: string;
  transaction?: InventoryTransaction;
  order?: POSOrder;
};

type RawStockCardRow = Omit<StockCardRow, 'endingStock'> & {
  quantityChange: number;
};

const TRANSACTION_LABELS: Partial<Record<InventoryTransaction['type'], string>> = {
  Import: 'Nhập hàng',
  PurchaseReturn: 'Trả hàng nhập',
  Export: 'Xuất kho',
  Check: 'Kiểm kho',
  Sale: 'Bán hàng',
  Return: 'Trả hàng bán',
  internal_use: 'Xuất dùng nội bộ',
  disposal: 'Trừ hàng lỗi/hư',
  return: 'Trả hàng',
};

const formatMoney = (value: number | null | undefined) =>
  typeof value === 'number' ? value.toLocaleString('vi-VN') : '—';

const normalizeSku = (value?: string | null) => String(value || '').trim().toLowerCase();

const isProductTransactionItem = (
  product: POSProduct,
  item: InventoryTransaction['items'][number]
) => {
  if (item.productId === product.id) return true;
  const productSku = normalizeSku(product.sku);
  const itemSku = normalizeSku(item.sku);
  return Boolean(productSku && itemSku && productSku === itemSku);
};

const getLineAmount = (item: InventoryTransaction['items'][number]) => {
  if (typeof item.price !== 'number') return null;
  return Math.max(0, item.quantity * item.price - (item.discount || 0));
};

const findRelatedOrder = (transaction: InventoryTransaction, orders: POSOrder[] = []) =>
  orders.find(order => order.id === transaction.referenceId || order.id === transaction.id);

const findRelatedOrderItem = (product: POSProduct, order?: POSOrder) =>
  order?.items.find(item => item.productId === product.id || normalizeSku(item.sku) === normalizeSku(product.sku));

const isProductOrderItem = (product: POSProduct, item: POSOrder['items'][number]) =>
  item.productId === product.id || normalizeSku(item.sku) === normalizeSku(product.sku);

const extractCodeFromNote = (transaction: InventoryTransaction) => {
  const note = transaction.note || '';
  const match = note.match(/(?:đơn|hàng)\s+([A-ZĐ]{2,}-?\d+)/i);
  return match?.[1];
};

const getDocumentCode = (transaction: InventoryTransaction, order?: POSOrder) => {
  if (transaction.type === 'Sale' || transaction.type === 'Return') {
    return order?.orderCode || extractCodeFromNote(transaction) || transaction.referenceId || transaction.id;
  }
  return transaction.referenceId || extractCodeFromNote(transaction) || transaction.id;
};

const getPartner = (transaction: InventoryTransaction, order?: POSOrder) => {
  if (transaction.type === 'Sale' || transaction.type === 'Return') {
    return order?.customerName || 'Khách lẻ';
  }
  return transaction.supplierName || transaction.note || '—';
};

const getQuantityChange = (
  transaction: InventoryTransaction,
  item: InventoryTransaction['items'][number]
) => {
  const quantity = Number(item.quantity || 0);
  if (typeof item.previousStock === 'number' && typeof item.newStock === 'number') {
    return item.newStock - item.previousStock;
  }
  if (transaction.type === 'Import' || transaction.type === 'Return' || transaction.type === 'return') {
    return Math.abs(quantity);
  }
  if (
    transaction.type === 'PurchaseReturn' ||
    transaction.type === 'Export' ||
    transaction.type === 'internal_use' ||
    transaction.type === 'disposal'
  ) {
    return -Math.abs(quantity);
  }
  return quantity;
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  full: 'Đủ HĐ',
  partial: 'HĐ một phần',
  memo_only: 'Phiếu ghi nhận',
  none: 'Chưa khai báo',
};

const getInvoiceStatus = (transaction: InventoryTransaction) => {
  if (transaction.type !== 'Import' && transaction.type !== 'PurchaseReturn') return '—';
  return INVOICE_STATUS_LABELS[transaction.invoiceStatus || 'none'] ?? 'Chưa khai báo';
};

const getSupplierNames = (
  product: POSProduct,
  transactions: InventoryTransaction[] = []
): string[] => {
  const names = new Set<string>();
  transactions
    .filter(t => t.type === 'Import' && t.supplierName)
    .forEach(t => {
      const hasProduct = t.items.some(item => isProductTransactionItem(product, item));
      if (hasProduct) names.add(t.supplierName!);
    });
  return [...names];
};

const buildStockCardRows = (
  product: POSProduct,
  transactions: InventoryTransaction[] = [],
  orders: POSOrder[] = []
): StockCardRow[] => {
  if (product.isParent) return [];

  const transactionRows: RawStockCardRow[] = transactions
    .filter(transaction => transaction.status !== 'draft')
    .flatMap(transaction =>
      transaction.items
        .filter(item => isProductTransactionItem(product, item))
        .map(item => ({
          transaction,
          item,
          quantityChange: getQuantityChange(transaction, item),
        }))
    )
    .filter(row => row.quantityChange !== 0)
    .map(({ transaction, item, quantityChange }) => {
      const relatedOrder = findRelatedOrder(transaction, orders);
      const relatedOrderItem = findRelatedOrderItem(product, relatedOrder);
      const transactionPrice =
        typeof item.price === 'number'
          ? item.price
          : typeof relatedOrderItem?.price === 'number'
            ? relatedOrderItem.price
            : null;
      return {
        id: `${transaction.id}-${item.productId}-${transaction.date}`,
        documentCode: getDocumentCode(transaction, relatedOrder),
        date: transaction.date,
        transactionType: transaction.type,
        transactionLabel: TRANSACTION_LABELS[transaction.type] || transaction.type,
        partner: getPartner(transaction, relatedOrder),
        transactionPrice,
        costPrice: typeof item.price === 'number' ? item.price : product.importPrice,
        quantityChange,
        lineAmount: getLineAmount(item) ?? relatedOrderItem?.total ?? null,
        invoiceStatus: getInvoiceStatus(transaction),
        note: item.note || transaction.note || '',
        transaction,
        order: relatedOrder,
      };
    });

  const hasStockTransactionForOrderItem = (order: POSOrder, item: POSOrder['items'][number]) => {
    const expectedType = order.isReturn ? 'Return' : 'Sale';
    return transactionRows.some(row =>
      row.transaction?.type === expectedType &&
      row.transaction.referenceId === order.id &&
      isProductOrderItem(product, item)
    );
  };

  const orderRows: RawStockCardRow[] = orders
    .filter(order => (order.status || 'completed') === 'completed')
    .flatMap(order =>
      order.items
        .filter(item => isProductOrderItem(product, item))
        .filter(item => !hasStockTransactionForOrderItem(order, item))
        .map(item => {
          const quantityChange = order.isReturn ? Math.abs(item.quantity) : -Math.abs(item.quantity);
          const transactionType: InventoryTransaction['type'] = order.isReturn ? 'Return' : 'Sale';
          return {
            id: `order-${order.id}-${item.productId}`,
            documentCode: order.orderCode,
            date: order.date,
            transactionType,
            transactionLabel: order.isReturn ? 'Trả hàng bán' : 'Bán hàng',
            partner: order.customerName || 'Khách lẻ',
            transactionPrice: item.price,
            costPrice: product.importPrice,
            quantityChange,
            lineAmount: item.total,
            invoiceStatus: '—',
            note: order.notes || '',
            order,
          };
        })
    )
    .filter(row => row.quantityChange !== 0);

  const rows = [...transactionRows, ...orderRows]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalChange = rows.reduce((sum, row) => sum + row.quantityChange, 0);
  let runningStock = (product.stock || 0) - totalChange;

  return rows
    .map(row => {
      runningStock += row.quantityChange;
      return { ...row, endingStock: runningStock };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const DocumentDetailModal: React.FC<{
  row: StockCardRow;
  onClose: () => void;
}> = ({ row, onClose }) => {
  const order = row.order;
  const transaction = row.transaction;
  const isOrder = Boolean(order);
  const rows = order?.items || transaction?.items || [];
  const total = order?.finalAmount || transaction?.totalAmount || row.lineAmount || 0;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-widest text-indigo-500">
              {row.transactionLabel}
            </p>
            <h3 className="mt-1 font-mono text-xl font-semibold text-slate-900">{row.documentCode}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {new Date(row.date).toLocaleString('vi-VN')} | {isOrder ? 'Khách hàng' : 'Đối tác'}: {row.partner}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[9px] uppercase text-slate-400">Trạng thái</p>
              <p className="mt-1 text-sm text-slate-800">{order?.status || transaction?.status || 'completed'}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[9px] uppercase text-slate-400">Người tạo</p>
              <p className="mt-1 text-sm text-slate-800">{order?.staffId || transaction?.staffId || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[9px] uppercase text-slate-400">Số dòng</p>
              <p className="mt-1 text-sm text-slate-800">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-[9px] uppercase text-emerald-500">Tổng tiền</p>
              <p className="mt-1 text-sm text-emerald-700">{formatMoney(total)}đ</p>
            </div>
          </div>

          {(order?.notes || transaction?.note) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
              {order?.notes || transaction?.note}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-2xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Tên hàng</th>
                  <th className="px-4 py-3 text-right">SL</th>
                  <th className="px-4 py-3 text-right">Đơn giá</th>
                  <th className="px-4 py-3 text-right">Giảm</th>
                  <th className="px-4 py-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(item => {
                  const price = 'price' in item ? item.price || 0 : 0;
                  const discount = 'discount' in item ? item.discount || 0 : 0;
                  const lineTotal = 'total' in item
                    ? item.total
                    : Math.max(0, item.quantity * price - discount);
                  return (
                    <tr key={`${item.productId}-${item.sku || item.name}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-indigo-600">{item.sku || '—'}</td>
                      <td className="px-4 py-3 text-slate-800">{item.name || item.productName || item.productId}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(price)}đ</td>
                      <td className="px-4 py-3 text-right">{formatMoney(discount)}đ</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatMoney(lineTotal)}đ</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StockCardTable: React.FC<{
  product: POSProduct;
  transactions?: InventoryTransaction[];
  orders?: POSOrder[];
}> = ({
  product,
  transactions,
  orders,
}) => {
  const [selectedDocumentRow, setSelectedDocumentRow] = React.useState<StockCardRow | null>(null);
  const rows = React.useMemo(
    () => buildStockCardRows(product, transactions, orders),
    [product, transactions, orders]
  );

  const handleExport = () => {
    if (rows.length === 0) return;
    const headers = [
      'Chứng từ',
      'Thời gian',
      'Loại giao dịch',
      'Đối tác',
      'Giá GD',
      'Giá vốn',
      'Số lượng',
      'Tồn cuối',
      'Ghi chú',
    ];
    const csvRows = rows.map(row =>
      [
        row.documentCode,
        new Date(row.date).toLocaleString('vi-VN'),
        row.transactionLabel,
        row.partner,
        row.transactionPrice ?? '',
        row.costPrice ?? '',
        row.quantityChange,
        row.endingStock,
        row.note,
      ]
        .map(value => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `the-kho-${product.sku || product.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (product.isParent) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-10 text-center">
        <Package className="h-10 w-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-normal text-slate-700">Thẻ kho chỉ áp dụng cho từng mã hàng cụ thể</p>
        <p className="text-xs text-slate-400 mt-1">Vui lòng mở một biến thể/SKU con để xem lịch sử tồn kho.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Thẻ kho</h3>
          <p className="text-xs text-slate-400 mt-1">
            Lịch sử biến động tồn của mã hàng {product.sku || product.id}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xs uppercase tracking-wide text-slate-400">Tồn hiện tại</p>
          <p className="text-lg font-normal text-slate-900 tabular-nums">{product.stock}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-xs font-normal text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Chứng từ</th>
              <th className="px-4 py-3 text-left">Thời gian</th>
              <th className="px-4 py-3 text-left">Loại giao dịch</th>
              <th className="px-4 py-3 text-left">Đối tác</th>
              <th className="px-4 py-3 text-right">Giá GD</th>
              <th className="px-4 py-3 text-right">Giá vốn</th>
              <th className="px-4 py-3 text-right">Số lượng</th>
              <th className="px-4 py-3 text-right">Tồn cuối</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-normal text-slate-700">Chưa có phát sinh thẻ kho</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Khi có phiếu nhập, bán hàng, kiểm kho hoặc trừ hàng, dữ liệu sẽ xuất hiện tại đây.
                  </p>
                </td>
              </tr>
            ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDocumentRow(row)}
                      className="font-mono text-xs font-normal text-indigo-600 hover:underline"
                    >
                      {row.documentCode}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(row.date).toLocaleString('vi-VN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.transactionLabel}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate" title={row.partner}>
                    {row.partner}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                    {formatMoney(row.transactionPrice)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                    {formatMoney(row.costPrice)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-normal tabular-nums ${
                      row.quantityChange < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {row.quantityChange > 0 ? '+' : ''}
                    {row.quantityChange}
                  </td>
                  <td className="px-4 py-3 text-right font-normal text-slate-900 tabular-nums">
                    {row.endingStock}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 bg-white px-4 py-4">
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          Xuất file
        </button>
      </div>

      {selectedDocumentRow && (
        <DocumentDetailModal
          row={selectedDocumentRow}
          onClose={() => setSelectedDocumentRow(null)}
        />
      )}
    </div>
  );
};

const InventoryBranchTable: React.FC<{ product: POSProduct }> = ({ product }) => {
  const stock = Number(product.stock || 0);
  const customerOrders = Number(product.customerOrders || 0);
  const projectedStock = stock - customerOrders;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= Number(product.minStock ?? 0);
  const expectedShortage = projectedStock < 0 ? Math.abs(projectedStock) : null;
  const statusLabel = product.status === 'Inactive'
    ? 'Ngừng kinh doanh'
    : isOutOfStock
      ? 'Hết hàng'
      : isLowStock
        ? 'Sắp hết'
        : 'Đang kinh doanh';
  const statusClass = product.status === 'Inactive'
    ? 'bg-slate-100 text-slate-500'
    : isOutOfStock
      ? 'bg-rose-100 text-rose-700'
      : isLowStock
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-700';

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-4 text-left font-bold text-slate-900">Chi nhánh</th>
            <th className="px-4 py-4 text-right font-bold text-slate-900">Tồn kho</th>
            <th className="px-4 py-4 text-right font-bold text-slate-900">KH đặt</th>
            <th className="px-4 py-4 text-left font-bold text-slate-900">Dự kiến hết hàng</th>
            <th className="px-4 py-4 text-left font-bold text-slate-900">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 bg-white">
            <td className="px-4 py-4 text-slate-900"></td>
            <td className="px-4 py-4 text-right text-lg tabular-nums text-slate-900">{stock}</td>
            <td className="px-4 py-4 text-right text-lg tabular-nums text-slate-900">
              {customerOrders}
            </td>
            <td className="px-4 py-4 text-slate-400"></td>
            <td className="px-4 py-4"></td>
          </tr>
          <tr className="bg-white">
            <td className="px-4 py-5 text-base font-normal text-slate-900">
              Chi nhánh trung tâm
            </td>
            <td className="px-4 py-5 text-right text-base font-normal tabular-nums text-slate-900">
              {stock}
            </td>
            <td className="px-4 py-5 text-right text-base font-normal tabular-nums text-slate-900">
              {customerOrders}
            </td>
            <td className="px-4 py-5 text-slate-500">
              {expectedShortage === null ? '---' : expectedShortage.toLocaleString('vi-VN')}
            </td>
            <td className="px-4 py-5">
              <span className={`inline-flex rounded-md px-2 py-1 text-xs font-normal ${statusClass}`}>
                {statusLabel}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const GoodsProductDetailPanel: React.FC<GoodsProductDetailPanelProps> = ({
  product,
  transactions,
  orders,
  activeTab,
  onTabChange,
  onDelete,
  onEdit,
  onClose: _onClose,
  deleteConfirmText,
  noBorder = false,
  showSupplierActions = false,
  showCopyPrintActions = false,
  onAddUnit,
  onAddAttribute,
  onPrintLabel,
  onAddSameType,
  onPurchaseProduct,
  onStopBusiness
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = React.useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(deleteConfirmText)) {
      onDelete();
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleMenuAction = (
    e: React.MouseEvent,
    action?: (product: POSProduct) => void
  ) => {
    e.stopPropagation();
    setIsActionMenuOpen(false);
    action?.(product);
  };

  return (
    <div className={`bg-white rounded-lg shadow-2xl mx-4 my-2 animate-in slide-in-from-top-4 duration-300${noBorder ? '' : ' border-2 border-indigo-400'}`}>
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1 px-6">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-normal border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[600px] overflow-auto bg-slate-50 p-6">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex gap-6">
                <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-normal text-slate-900 mb-2">{product.name}</h2>
                  <p className="text-sm text-slate-600 mb-3">Nhóm hàng: <span className="font-normal">{product.categoryId || 'Chưa phân loại'}</span></p>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked readOnly disabled className="rounded border-slate-300" />
                      Hàng hóa thương
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked readOnly disabled className="rounded border-slate-300" />
                      Bán trực tiếp
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={product.allowPoints} readOnly disabled className="rounded border-slate-300" />
                      Tích điểm
                    </span>
                  </div>
                  {product.variantAttributes ? (
                    <div className="mb-3">
                      <span className="text-sm text-slate-500 font-normal">Thuộc tính: </span>
                      {Object.entries(product.variantAttributes).map(([key, value]) => (
                        <span key={key} className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-normal mr-2">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <button className="text-sm text-indigo-600 font-normal hover:underline flex items-center gap-1">
                      🔗 Xem phần tích
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Mã hàng</label>
                  <div className="text-sm font-normal text-slate-900">{product.sku}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Tồn kho</label>
                  <div className="text-sm font-normal text-slate-900">{product.stock}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Định mức tồn</label>
                  <div className="text-sm font-normal text-slate-900">{product.minStock ?? 0} - {product.maxStock ?? 999999999}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Giá vốn</label>
                  <div className="text-sm font-normal text-slate-900">{(Number(product.importPrice) || 0).toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Giá bán</label>
                  <div className="text-sm font-normal text-slate-900">{(Number(product.salePrice) || 0).toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Thương hiệu</label>
                  <div className="text-sm text-slate-600">{product.brand || 'Chưa có'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Vị trí</label>
                  <div className="text-sm text-slate-600">{product.location || 'Chưa có'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-normal mb-2 block">Trọng lượng</label>
                  <div className="text-sm text-slate-600">
                    {product.weight ? `${product.weight} ${product.weightUnit || 'g'}` : 'Chưa có'}
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const supplierNames = getSupplierNames(product, transactions);
              return (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Nhà cung cấp</h3>
                  {supplierNames.length === 0 ? (
                    <span className="text-sm text-slate-400">Chưa có</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {supplierNames.map(name => (
                        <span key={name} className="px-3 py-1 bg-slate-100 text-slate-700 rounded text-sm font-normal">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {showSupplierActions && (
              <div className="space-y-2">
                <button onClick={onAddUnit} className="text-sm text-indigo-600 font-normal hover:underline flex items-center gap-1">
                  🔗 Thêm đơn vị tính
                </button>
                <button onClick={onAddAttribute} className="text-sm text-indigo-600 font-normal hover:underline flex items-center gap-1">
                  🔗 Thêm thuộc tính
                </button>
                <button onClick={() => onAddSameType?.(product)} className="text-sm text-indigo-600 font-normal hover:underline flex items-center gap-1">
                  🔗 Thêm hàng hóa cùng loại
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'desc' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="text-sm font-normal text-slate-700 mb-3 block">Mô tả chi tiết</label>
            <div className="text-sm text-slate-600 whitespace-pre-wrap">
              {product.description || 'Chưa có mô tả'}
            </div>
          </div>
        )}

        {activeTab === 'warranty' && (
          <StockCardTable product={product} transactions={transactions} orders={orders} />
        )}

        {activeTab === 'units' && (
          <InventoryBranchTable product={product} />
        )}

        {activeTab === 'channels' && (
          <GoodsChannelLinksTab product={product} />
        )}
      </div>

      {activeTab !== 'units' && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between rounded-b-lg">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Xóa
            </button>
            {showCopyPrintActions && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(`${product.sku} - ${product.name}`);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Sao chép
              </button>
            )}
          </div>
        <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-normal hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Chỉnh sửa
            </button>
            {activeTab === 'info' && (
              <>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onPrintLabel?.(product);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  In tem mã
                </button>
                {!showSupplierActions && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onAddSameType?.(product);
                    }}
                    className="px-4 py-2 border border-indigo-200 rounded-lg text-sm font-normal text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                  >
                    <PackagePlus className="h-4 w-4" />
                    Thêm hàng hóa cùng loại
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setIsActionMenuOpen(prev => !prev);
                    }}
                    className="h-10 w-10 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center"
                    aria-label="Mở thao tác hàng hóa"
                    title="Thao tác hàng hóa"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  {isActionMenuOpen && (
                    <div
                      className="absolute right-0 bottom-12 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={e => handleMenuAction(e, onPurchaseProduct)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-normal text-slate-700 hover:bg-slate-50"
                      >
                        <ShoppingCart className="h-4 w-4 text-indigo-500" />
                        Nhập hàng
                      </button>
                      <button
                        onClick={e => handleMenuAction(e, onStopBusiness)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-normal text-rose-600 hover:bg-rose-50"
                      >
                        <X className="h-4 w-4" />
                        Ngừng kinh doanh
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {showCopyPrintActions && activeTab !== 'info' && (
              <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Printer className="h-4 w-4" />
                In tem mã
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
